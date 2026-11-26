import { Router } from "express";
import { z } from "zod";
import { registrarLog } from "../audit";
import type { Db } from "../db";
import { HttpError } from "../http";
import { idParam, psicologoId, userId } from "../middleware/auth";
import { freeSlots, loadProfile, SLOT_MIN } from "../profile";
import { optionalText, pacienteDoCliente } from "../users";
import { findConflict, FROM_DB } from "./sessions";

const STATUS = { pendente: "pending", aceita: "accepted", recusada: "declined", cancelada: "canceled" } as const;

interface RequestRow {
  id: number;
  cliente_usuario_id: number;
  psicologo_id: number;
  inicio: string;
  duracao_min: number;
  mensagem: string | null;
  situacao: keyof typeof STATUS;
  resposta: string | null;
  sessao_id: number | null;
  criado_em: string;
  cliente_nome: string;
  cliente_email: string;
  psicologo_nome: string;
}

const SELECT = `
  SELECT r.*, cu.nome AS cliente_nome, cu.email AS cliente_email, pu.nome AS psicologo_nome
  FROM solicitacoes r
  JOIN usuarios cu ON cu.id = r.cliente_usuario_id
  JOIN psicologos ps ON ps.id = r.psicologo_id
  JOIN usuarios pu ON pu.id = ps.usuario_id`;

const toRequest = (r: RequestRow) => ({
  id: r.id,
  clientName: r.cliente_nome,
  clientEmail: r.cliente_email,
  psychologistId: r.psicologo_id,
  psychologistName: r.psicologo_nome,
  startsAt: r.inicio,
  durationMin: r.duracao_min,
  message: r.mensagem,
  status: STATUS[r.situacao],
  reply: r.resposta,
  sessionId: r.sessao_id,
  createdAt: r.criado_em,
});

const ORDER = "ORDER BY r.situacao = 'pendente' DESC, r.inicio ASC LIMIT 200";

/** Lado do psicólogo: pedidos recebidos; aceitar cria vínculo + sessão. */
export function requestsRouter(db: Db) {
  const router = Router();

  router.get("/", (req, res) => {
    const pendingOnly = req.query.status === "pending";
    const rows = db
      .prepare(`${SELECT} WHERE r.psicologo_id = ? ${pendingOnly ? "AND r.situacao = 'pendente'" : ""} ${ORDER}`)
      .all(psicologoId(req)) as RequestRow[];
    res.json({ requests: rows.map(toRequest) });
  });

  const decisionSchema = z.object({ action: z.enum(["accept", "decline"]), reply: optionalText(500) });

  router.patch("/:id", (req, res) => {
    const psi = psicologoId(req);
    const { action, reply } = decisionSchema.parse(req.body);
    const r = db.prepare(`${SELECT} WHERE r.id = ? AND r.psicologo_id = ?`).get(idParam(req.params.id), psi) as
      | RequestRow
      | undefined;
    if (!r) throw new HttpError(404, "Solicitação não encontrada.");
    if (r.situacao !== "pendente") throw new HttpError(409, "Esta solicitação já foi respondida.");

    if (action === "decline") {
      db.transaction(() => {
        db.prepare("UPDATE solicitacoes SET situacao = 'recusada', resposta = ? WHERE id = ?").run(reply, r.id);
        registrarLog(db, { usuarioId: userId(req), acao: "solicitacao_recusada", entidade: "solicitacao", entidadeId: r.id });
      })();
    } else {
      if (Date.parse(r.inicio) < Date.now()) throw new HttpError(409, "Este horário já passou. Recuse e sugira outro.");
      const clash = findConflict(db, psi, r.inicio, r.duracao_min);
      if (clash) throw new HttpError(409, `Horário ocupado por uma sessão com ${clash.patientName}.`);
      db.transaction(() => {
        const pacienteId = pacienteDoCliente(db, r.cliente_usuario_id);
        db.prepare(
          `INSERT INTO vinculos (psicologo_id, cliente_paciente_id) VALUES (?, ?)
           ON CONFLICT (psicologo_id, cliente_paciente_id) DO UPDATE SET situacao = 'ativo', fim = NULL`,
        ).run(psi, pacienteId);
        const fee = (db.prepare("SELECT valor_sessao_centavos AS v FROM psicologos WHERE id = ?").get(psi) as { v: number }).v;
        const sessaoId = Number(
          db
            .prepare(
              "INSERT INTO sessoes (psicologo_id, cliente_paciente_id, inicio, duracao_min, valor_centavos) VALUES (?, ?, ?, ?, ?)",
            )
            .run(psi, pacienteId, r.inicio, r.duracao_min, fee).lastInsertRowid,
        );
        db.prepare("UPDATE solicitacoes SET situacao = 'aceita', resposta = ?, sessao_id = ? WHERE id = ?").run(
          reply,
          sessaoId,
          r.id,
        );
        registrarLog(db, { usuarioId: userId(req), acao: "solicitacao_aceita", entidade: "solicitacao", entidadeId: r.id });
        registrarLog(db, { usuarioId: userId(req), acao: "sessao_agendada", entidade: "sessao", entidadeId: sessaoId });
      })();
    }
    res.json({ request: toRequest(db.prepare(`${SELECT} WHERE r.id = ?`).get(r.id) as RequestRow) });
  });

  return router;
}

/** Lado do cliente: catálogo de psicólogos, horários livres, pedidos e as próprias sessões. */
export function clientRouter(db: Db) {
  const router = Router();

  router.get("/psychologists", (req, res) => {
    const q = z.string().trim().max(100).optional().parse(req.query.q);
    const rows = db
      .prepare(
        `SELECT ps.id, u.nome, ps.crp, ps.area_atuacao, ps.bio, ps.valor_sessao_centavos,
                EXISTS (SELECT 1 FROM horarios_disponiveis h WHERE h.psicologo_id = ps.id) AS agenda
         FROM psicologos ps JOIN usuarios u ON u.id = ps.usuario_id
         WHERE u.situacao = 'ativo' AND (@q IS NULL OR u.nome LIKE @q OR ps.area_atuacao LIKE @q)
         ORDER BY agenda DESC, u.nome COLLATE NOCASE`,
      )
      .all({ q: q ? `%${q}%` : null }) as {
      id: number; nome: string; crp: string; area_atuacao: string | null; bio: string | null;
      valor_sessao_centavos: number; agenda: number;
    }[];
    res.json({
      psychologists: rows.map((r) => ({
        id: r.id, name: r.nome, crp: r.crp, areaAtuacao: r.area_atuacao, bio: r.bio,
        feeCents: r.valor_sessao_centavos, hasAvailability: !!r.agenda,
      })),
    });
  });

  router.get("/psychologists/:id", (req, res) => {
    const id = idParam(req.params.id);
    const profile = loadProfile(db, id);
    if (!profile.active) throw new HttpError(404, "Psicólogo não encontrado.");
    res.json({ profile, slots: freeSlots(db, id) });
  });

  router.get("/requests", (req, res) => {
    const rows = db.prepare(`${SELECT} WHERE r.cliente_usuario_id = ? ${ORDER}`).all(userId(req)) as RequestRow[];
    res.json({ requests: rows.map(toRequest) });
  });

  const createSchema = z.object({
    psychologistId: z.number().int().positive(),
    startsAt: z.string().datetime({ message: "Data e hora inválidas." }),
    message: optionalText(500),
  });

  router.post("/requests", (req, res) => {
    const input = createSchema.parse(req.body);
    const profile = loadProfile(db, input.psychologistId);
    if (!profile.active) throw new HttpError(404, "Psicólogo não encontrado.");
    const startsAt = new Date(input.startsAt).toISOString();
    if (!freeSlots(db, profile.id).includes(startsAt)) {
      throw new HttpError(409, "Este horário não está mais disponível. Escolha outro.");
    }
    const id = db.transaction(() => {
      const rid = Number(
        db
          .prepare("INSERT INTO solicitacoes (cliente_usuario_id, psicologo_id, inicio, duracao_min, mensagem) VALUES (?, ?, ?, ?, ?)")
          .run(userId(req), profile.id, startsAt, SLOT_MIN, input.message).lastInsertRowid,
      );
      registrarLog(db, { usuarioId: userId(req), acao: "solicitacao_criada", entidade: "solicitacao", entidadeId: rid });
      return rid;
    })();
    res.status(201).json({ request: toRequest(db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as RequestRow) });
  });

  router.patch("/requests/:id", (req, res) => {
    z.object({ action: z.literal("cancel") }).parse(req.body);
    const id = idParam(req.params.id);
    const info = db
      .prepare("UPDATE solicitacoes SET situacao = 'cancelada' WHERE id = ? AND cliente_usuario_id = ? AND situacao = 'pendente'")
      .run(id, userId(req));
    if (!info.changes) throw new HttpError(409, "Só é possível cancelar pedidos pendentes.");
    registrarLog(db, { usuarioId: userId(req), acao: "solicitacao_cancelada", entidade: "solicitacao", entidadeId: id });
    res.json({ request: toRequest(db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as RequestRow) });
  });

  // Sessões do próprio cliente — nunca inclui anotações clínicas.
  router.get("/sessions", (req, res) => {
    const rows = db
      .prepare(
        `SELECT s.id, s.inicio, s.duracao_min, s.situacao, s.valor_centavos, s.pago, pu.nome AS psicologo_nome
         FROM sessoes s
         JOIN clientes_pacientes cp ON cp.id = s.cliente_paciente_id
         JOIN psicologos ps ON ps.id = s.psicologo_id
         JOIN usuarios pu ON pu.id = ps.usuario_id
         WHERE cp.usuario_id = ? ORDER BY s.inicio DESC LIMIT 200`,
      )
      .all(userId(req)) as {
      id: number; inicio: string; duracao_min: number; situacao: string; valor_centavos: number; pago: number;
      psicologo_nome: string;
    }[];
    res.json({
      sessions: rows.map((s) => ({
        id: s.id, startsAt: s.inicio, durationMin: s.duracao_min, status: FROM_DB[s.situacao],
        feeCents: s.valor_centavos, paid: !!s.pago, psychologistName: s.psicologo_nome,
      })),
    });
  });

  return router;
}
