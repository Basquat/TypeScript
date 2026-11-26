import { Router } from "express";
import { z } from "zod";
import { registrarLog } from "../audit";
import { all, one, run, tx, type Db, type Pool } from "../db";
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
  inicio: Date;
  duracao_min: number;
  mensagem: string | null;
  situacao: keyof typeof STATUS;
  resposta: string | null;
  sessao_id: number | null;
  criado_em: Date;
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
  startsAt: r.inicio.toISOString(),
  durationMin: r.duracao_min,
  message: r.mensagem,
  status: STATUS[r.situacao],
  reply: r.resposta,
  sessionId: r.sessao_id,
  createdAt: r.criado_em,
});

const ORDER = "ORDER BY r.situacao = 'pendente' DESC, r.inicio ASC LIMIT 200";
const byId = async (db: Db, id: number) => toRequest((await one<RequestRow>(db, `${SELECT} WHERE r.id = ?`, [id]))!);

/** Lado do psicólogo: pedidos recebidos; aceitar cria vínculo + sessão. */
export function requestsRouter(db: Pool) {
  const router = Router();

  router.get("/", async (req, res) => {
    const pendingOnly = req.query.status === "pending";
    const rows = await all<RequestRow>(
      db,
      `${SELECT} WHERE r.psicologo_id = ? ${pendingOnly ? "AND r.situacao = 'pendente'" : ""} ${ORDER}`,
      [psicologoId(req)],
    );
    res.json({ requests: rows.map(toRequest) });
  });

  const decisionSchema = z.object({ action: z.enum(["accept", "decline"]), reply: optionalText(500) });

  router.patch("/:id", async (req, res) => {
    const psi = psicologoId(req);
    const { action, reply } = decisionSchema.parse(req.body);
    const r = await one<RequestRow>(db, `${SELECT} WHERE r.id = ? AND r.psicologo_id = ?`, [idParam(req.params.id), psi]);
    if (!r) throw new HttpError(404, "Solicitação não encontrada.");
    if (r.situacao !== "pendente") throw new HttpError(409, "Esta solicitação já foi respondida.");

    if (action === "decline") {
      await tx(db, async (c) => {
        await run(c, "UPDATE solicitacoes SET situacao = 'recusada', resposta = ? WHERE id = ?", [reply, r.id]);
        await registrarLog(c, { usuarioId: userId(req), acao: "solicitacao_recusada", entidade: "solicitacao", entidadeId: r.id });
      });
    } else {
      if (r.inicio.getTime() < Date.now()) throw new HttpError(409, "Este horário já passou. Recuse e sugira outro.");
      const clash = await findConflict(db, psi, r.inicio, r.duracao_min);
      if (clash) throw new HttpError(409, `Horário ocupado por uma sessão com ${clash.patientName}.`);
      await tx(db, async (c) => {
        const pacienteId = await pacienteDoCliente(c, r.cliente_usuario_id);
        await run(
          c,
          `INSERT INTO vinculos (psicologo_id, cliente_paciente_id) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE situacao = 'ativo', fim = NULL`,
          [psi, pacienteId],
        );
        const fee = (await one<{ v: number }>(c, "SELECT valor_sessao_centavos AS v FROM psicologos WHERE id = ?", [psi]))!.v;
        const sessaoId = (
          await run(
            c,
            "INSERT INTO sessoes (psicologo_id, cliente_paciente_id, inicio, duracao_min, valor_centavos) VALUES (?, ?, ?, ?, ?)",
            [psi, pacienteId, r.inicio, r.duracao_min, fee],
          )
        ).insertId;
        await run(c, "UPDATE solicitacoes SET situacao = 'aceita', resposta = ?, sessao_id = ? WHERE id = ?", [reply, sessaoId, r.id]);
        await registrarLog(c, { usuarioId: userId(req), acao: "solicitacao_aceita", entidade: "solicitacao", entidadeId: r.id });
        await registrarLog(c, { usuarioId: userId(req), acao: "sessao_agendada", entidade: "sessao", entidadeId: sessaoId });
      });
    }
    res.json({ request: await byId(db, r.id) });
  });

  return router;
}

/** Lado do cliente: catálogo de psicólogos, horários livres, pedidos e as próprias sessões. */
export function clientRouter(db: Pool) {
  const router = Router();

  router.get("/psychologists", async (req, res) => {
    const q = z.string().trim().max(100).optional().parse(req.query.q);
    const rows = await all<{
      id: number; nome: string; crp: string; area_atuacao: string | null; bio: string | null;
      valor_sessao_centavos: number; agenda: number;
    }>(
      db,
      `SELECT ps.id, u.nome, ps.crp, ps.area_atuacao, ps.bio, ps.valor_sessao_centavos,
              EXISTS (SELECT 1 FROM horarios_disponiveis h WHERE h.psicologo_id = ps.id) AS agenda
       FROM psicologos ps JOIN usuarios u ON u.id = ps.usuario_id
       WHERE u.situacao = 'ativo' AND (:q IS NULL OR u.nome LIKE :q OR ps.area_atuacao LIKE :q)
       ORDER BY agenda DESC, u.nome`,
      { q: q ? `%${q}%` : null },
    );
    res.json({
      psychologists: rows.map((r) => ({
        id: r.id, name: r.nome, crp: r.crp, areaAtuacao: r.area_atuacao, bio: r.bio,
        feeCents: r.valor_sessao_centavos, hasAvailability: !!r.agenda,
      })),
    });
  });

  router.get("/psychologists/:id", async (req, res) => {
    const id = idParam(req.params.id);
    const profile = await loadProfile(db, id);
    if (!profile.active) throw new HttpError(404, "Psicólogo não encontrado.");
    res.json({ profile, slots: await freeSlots(db, id) });
  });

  router.get("/requests", async (req, res) => {
    const rows = await all<RequestRow>(db, `${SELECT} WHERE r.cliente_usuario_id = ? ${ORDER}`, [userId(req)]);
    res.json({ requests: rows.map(toRequest) });
  });

  const createSchema = z.object({
    psychologistId: z.number().int().positive(),
    startsAt: z.string().datetime({ message: "Data e hora inválidas." }),
    message: optionalText(500),
  });

  router.post("/requests", async (req, res) => {
    const input = createSchema.parse(req.body);
    const profile = await loadProfile(db, input.psychologistId);
    if (!profile.active) throw new HttpError(404, "Psicólogo não encontrado.");
    const startsAt = new Date(input.startsAt);
    if (!(await freeSlots(db, profile.id)).includes(startsAt.toISOString())) {
      throw new HttpError(409, "Este horário não está mais disponível. Escolha outro.");
    }
    const id = await tx(db, async (c) => {
      const rid = (
        await run(c, "INSERT INTO solicitacoes (cliente_usuario_id, psicologo_id, inicio, duracao_min, mensagem) VALUES (?, ?, ?, ?, ?)", [
          userId(req), profile.id, startsAt, SLOT_MIN, input.message,
        ])
      ).insertId;
      await registrarLog(c, { usuarioId: userId(req), acao: "solicitacao_criada", entidade: "solicitacao", entidadeId: rid });
      return rid;
    });
    res.status(201).json({ request: await byId(db, id) });
  });

  router.patch("/requests/:id", async (req, res) => {
    z.object({ action: z.literal("cancel") }).parse(req.body);
    const id = idParam(req.params.id);
    const info = await run(
      db,
      "UPDATE solicitacoes SET situacao = 'cancelada' WHERE id = ? AND cliente_usuario_id = ? AND situacao = 'pendente'",
      [id, userId(req)],
    );
    if (!info.affectedRows) throw new HttpError(409, "Só é possível cancelar pedidos pendentes.");
    await registrarLog(db, { usuarioId: userId(req), acao: "solicitacao_cancelada", entidade: "solicitacao", entidadeId: id });
    res.json({ request: await byId(db, id) });
  });

  // Sessões do próprio cliente — nunca inclui anotações clínicas.
  router.get("/sessions", async (req, res) => {
    const rows = await all<{
      id: number; inicio: Date; duracao_min: number; situacao: string; valor_centavos: number; pago: number;
      psicologo_nome: string;
    }>(
      db,
      `SELECT s.id, s.inicio, s.duracao_min, s.situacao, s.valor_centavos, s.pago, pu.nome AS psicologo_nome
       FROM sessoes s
       JOIN clientes_pacientes cp ON cp.id = s.cliente_paciente_id
       JOIN psicologos ps ON ps.id = s.psicologo_id
       JOIN usuarios pu ON pu.id = ps.usuario_id
       WHERE cp.usuario_id = ? ORDER BY s.inicio DESC LIMIT 200`,
      [userId(req)],
    );
    res.json({
      sessions: rows.map((s) => ({
        id: s.id, startsAt: s.inicio.toISOString(), durationMin: s.duracao_min, status: FROM_DB[s.situacao],
        feeCents: s.valor_centavos, paid: !!s.pago, psychologistName: s.psicologo_nome,
      })),
    });
  });

  return router;
}
