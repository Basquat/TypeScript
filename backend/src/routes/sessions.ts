import { Router } from "express";
import { z } from "zod";
import { registrarLog } from "../audit";
import { decrypt, encrypt } from "../crypto";
import type { Db } from "../db";
import { HttpError } from "../http";
import { idParam, psicologoId, userId } from "../middleware/auth";

export const STATUSES = ["scheduled", "done", "canceled", "missed"] as const;
type Status = (typeof STATUSES)[number];

// A API fala inglês (contrato do frontend); o banco guarda em português.
const TO_DB: Record<Status, string> = {
  scheduled: "agendada",
  done: "realizada",
  canceled: "cancelada",
  missed: "faltou",
};
export const FROM_DB = Object.fromEntries(Object.entries(TO_DB).map(([k, v]) => [v, k])) as Record<string, Status>;

interface SessionRow {
  id: number;
  psicologo_id: number;
  cliente_paciente_id: number;
  paciente_nome: string;
  inicio: string;
  duracao_min: number;
  situacao: string;
  valor_centavos: number;
  pago: number;
  anotacao_cripto: string | null;
}

const SELECT = `
  SELECT s.*, cp.nome AS paciente_nome
  FROM sessoes s JOIN clientes_pacientes cp ON cp.id = s.cliente_paciente_id`;

function toSession(r: SessionRow, withNote = false) {
  return {
    id: r.id,
    patientId: r.cliente_paciente_id,
    patientName: r.paciente_nome,
    startsAt: r.inicio,
    durationMin: r.duracao_min,
    status: FROM_DB[r.situacao],
    feeCents: r.valor_centavos,
    paid: !!r.pago,
    hasNote: !!r.anotacao_cripto,
    ...(withNote ? { note: r.anotacao_cripto ? decrypt(r.anotacao_cripto) : "" } : {}),
  };
}

export function sessionsForPatient(db: Db, psiId: number, pacienteId: number) {
  const rows = db
    .prepare(`${SELECT} WHERE s.psicologo_id = ? AND s.cliente_paciente_id = ? ORDER BY s.inicio DESC`)
    .all(psiId, pacienteId) as SessionRow[];
  return rows.map((r) => toSession(r));
}

const isoDate = z.string().datetime({ message: "Data e hora inválidas." });

const createSchema = z.object({
  patientId: z.number().int().positive(),
  startsAt: isoDate,
  durationMin: z.number().int().min(10).max(240).default(50),
  feeCents: z.number().int().min(0).max(10_000_000).default(0),
  /** 1 = sessão única; N = mesma hora por N semanas seguidas (tudo ou nada). */
  repeatWeeks: z.number().int().min(1).max(12).default(1),
});

const updateSchema = z.object({
  startsAt: isoDate.optional(),
  durationMin: z.number().int().min(10).max(240).optional(),
  status: z.enum(STATUSES).optional(),
  feeCents: z.number().int().min(0).max(10_000_000).optional(),
  paid: z.boolean().optional(),
  note: z.string().max(50_000).nullable().optional(),
});

const listQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  patientId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUSES).optional(),
});

function findOwned(db: Db, psiId: number, id: number): SessionRow {
  const row = db.prepare(`${SELECT} WHERE s.id = ? AND s.psicologo_id = ?`).get(id, psiId) as
    | SessionRow
    | undefined;
  if (!row) throw new HttpError(404, "Sessão não encontrada.");
  return row;
}

/** Procura outra sessão agendada que se sobreponha ao intervalo informado. */
export function findConflict(db: Db, psiId: number, startsAt: string, durationMin: number, excludeId = -1) {
  const start = Date.parse(startsAt);
  const end = start + durationMin * 60_000;
  // Nenhuma sessão dura mais de 240 min; a janela de 5h antes cobre qualquer início relevante.
  const rows = db
    .prepare(
      `${SELECT} WHERE s.psicologo_id = ? AND s.situacao = 'agendada' AND s.id != ?
         AND s.inicio > ? AND s.inicio < ?`,
    )
    .all(psiId, excludeId, new Date(start - 5 * 3_600_000).toISOString(), new Date(end).toISOString()) as SessionRow[];
  const hit = rows.find((r) => {
    const s = Date.parse(r.inicio);
    return s < end && s + r.duracao_min * 60_000 > start;
  });
  return hit && { patientName: hit.paciente_nome };
}

export function sessionsRouter(db: Db) {
  const router = Router();

  router.get("/", (req, res) => {
    const q = listQuery.parse(req.query);
    const where = ["s.psicologo_id = @psi"];
    const params: Record<string, unknown> = { psi: psicologoId(req) };
    if (q.from) (where.push("s.inicio >= @from"), (params.from = q.from));
    if (q.to) (where.push("s.inicio < @to"), (params.to = q.to));
    if (q.patientId) (where.push("s.cliente_paciente_id = @patientId"), (params.patientId = q.patientId));
    if (q.status) (where.push("s.situacao = @status"), (params.status = TO_DB[q.status]));
    const rows = db
      .prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY s.inicio ASC LIMIT 500`)
      .all(params) as SessionRow[];
    res.json({ sessions: rows.map((r) => toSession(r)) });
  });

  router.post("/", (req, res) => {
    const input = createSchema.parse(req.body);
    const psi = psicologoId(req);

    const vinculo = db
      .prepare("SELECT situacao FROM vinculos WHERE psicologo_id = ? AND cliente_paciente_id = ?")
      .get(psi, input.patientId) as { situacao: string } | undefined;
    if (!vinculo) throw new HttpError(404, "Paciente não encontrado.");
    if (vinculo.situacao !== "ativo") throw new HttpError(409, "Este paciente está arquivado. Reative-o para agendar.");

    // Semanas seguidas na mesma hora local (setDate respeita horário de verão).
    const starts = Array.from({ length: input.repeatWeeks }, (_, i) => {
      const d = new Date(input.startsAt);
      d.setDate(d.getDate() + 7 * i);
      return d.toISOString();
    });

    const ids = db.transaction(() =>
      starts.map((startsAt) => {
        const clash = findConflict(db, psi, startsAt, input.durationMin);
        if (clash) {
          const dia = new Date(startsAt).toLocaleDateString("pt-BR");
          throw new HttpError(409, `Horário ocupado em ${dia} por uma sessão com ${clash.patientName}.`);
        }
        const info = db
          .prepare(
            "INSERT INTO sessoes (psicologo_id, cliente_paciente_id, inicio, duracao_min, valor_centavos) VALUES (?, ?, ?, ?, ?)",
          )
          .run(psi, input.patientId, startsAt, input.durationMin, input.feeCents);
        const sessaoId = Number(info.lastInsertRowid);
        registrarLog(db, { usuarioId: userId(req), acao: "sessao_agendada", entidade: "sessao", entidadeId: sessaoId });
        return sessaoId;
      }),
    )();
    res.status(201).json({ session: toSession(findOwned(db, psi, ids[0])), created: ids.length });
  });

  router.get("/:id", (req, res) => {
    const row = findOwned(db, psicologoId(req), idParam(req.params.id));
    // Abrir uma anotação clínica fica registrado (trilha de acesso a dado sensível).
    if (row.anotacao_cripto) {
      registrarLog(db, { usuarioId: userId(req), acao: "anotacao_lida", entidade: "sessao", entidadeId: row.id });
    }
    res.json({ session: toSession(row, true) });
  });

  router.patch("/:id", (req, res) => {
    const psi = psicologoId(req);
    const current = findOwned(db, psi, idParam(req.params.id));
    const input = updateSchema.parse(req.body);

    const startsAt = input.startsAt ? new Date(input.startsAt).toISOString() : current.inicio;
    const durationMin = input.durationMin ?? current.duracao_min;
    const status: Status = input.status ?? FROM_DB[current.situacao];

    const timeChanged = startsAt !== current.inicio || durationMin !== current.duracao_min;
    if (status === "scheduled" && (timeChanged || current.situacao !== "agendada")) {
      const clash = findConflict(db, psi, startsAt, durationMin, current.id);
      if (clash) throw new HttpError(409, `Horário ocupado por uma sessão com ${clash.patientName}.`);
    }

    let noteEnc = current.anotacao_cripto;
    if (input.note !== undefined) noteEnc = input.note?.trim() ? encrypt(input.note) : null;

    db.transaction(() => {
      db.prepare(
        `UPDATE sessoes SET inicio = @inicio, duracao_min = @dur, situacao = @sit,
           valor_centavos = @valor, pago = @pago, anotacao_cripto = @nota WHERE id = @id`,
      ).run({
        id: current.id,
        inicio: startsAt,
        dur: durationMin,
        sit: TO_DB[status],
        valor: input.feeCents ?? current.valor_centavos,
        pago: input.paid === undefined ? current.pago : input.paid ? 1 : 0,
        nota: noteEnc,
      });
      // Só nomes de campos — nunca o conteúdo da anotação.
      const campos = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
      registrarLog(db, {
        usuarioId: userId(req), acao: "sessao_atualizada", entidade: "sessao",
        entidadeId: current.id, detalhes: { campos },
      });
    })();
    res.json({ session: toSession(findOwned(db, psi, current.id), true) });
  });

  router.delete("/:id", (req, res) => {
    const current = findOwned(db, psicologoId(req), idParam(req.params.id));
    if (current.situacao !== "agendada" || current.anotacao_cripto) {
      throw new HttpError(409, "Só é possível excluir sessões agendadas e sem anotações. Marque como cancelada.");
    }
    db.transaction(() => {
      db.prepare("DELETE FROM sessoes WHERE id = ?").run(current.id);
      registrarLog(db, { usuarioId: userId(req), acao: "sessao_excluida", entidade: "sessao", entidadeId: current.id });
    })();
    res.status(204).end();
  });

  return router;
}
