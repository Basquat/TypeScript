import { Router } from "express";
import { z } from "zod";
import { registrarLog } from "../audit";
import type { Db } from "../db";
import { HttpError } from "../http";
import { idParam, userId } from "../middleware/auth";
import {
  adminCreateSchema, assertCrpLivre, cadastrarUsuario, crpField, findUserById, nameField, PERFIS, perfilId,
  publicUser, USER_SELECT, type UserRecord,
} from "../users";
import { patientSchema } from "./patients";

const SITUACOES = ["ativo", "inativo", "bloqueado"] as const;

/** Administrador geral: usuários, perfis, cadastros de pacientes e auditoria completa. */
export function adminRouter(db: Db) {
  const router = Router();

  router.get("/summary", (_req, res) => {
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    const byStatus = Object.fromEntries(
      SITUACOES.map((s) => [s, count(`SELECT COUNT(*) AS n FROM usuarios WHERE situacao = '${s}'`)]),
    );
    const byRole = Object.fromEntries(
      PERFIS.map((p) => [
        p,
        count(`SELECT COUNT(*) AS n FROM usuarios u JOIN perfis pf ON pf.id = u.perfil_id WHERE pf.nome = '${p}'`),
      ]),
    );
    res.json({
      users: count("SELECT COUNT(*) AS n FROM usuarios"),
      psychologists: count("SELECT COUNT(*) AS n FROM psicologos"),
      patients: count("SELECT COUNT(*) AS n FROM clientes_pacientes"),
      sessionsUpcoming: count(
        `SELECT COUNT(*) AS n FROM sessoes WHERE situacao = 'agendada' AND inicio >= strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      ),
      pendingRequests: count("SELECT COUNT(*) AS n FROM solicitacoes WHERE situacao = 'pendente'"),
      byStatus,
      byRole,
    });
  });

  // ---- Usuários --------------------------------------------------------------
  const listQuery = z.object({
    q: z.string().trim().max(100).optional(),
    perfil: z.enum(PERFIS).optional(),
    situacao: z.enum(SITUACOES).optional(),
  });

  router.get("/users", (req, res) => {
    const q = listQuery.parse(req.query);
    const rows = db
      .prepare(
        `${USER_SELECT}
         WHERE (@q IS NULL OR u.nome LIKE @q OR u.email LIKE @q)
           AND (@perfil IS NULL OR p.nome = @perfil) AND (@situacao IS NULL OR u.situacao = @situacao)
         ORDER BY u.nome COLLATE NOCASE LIMIT 500`,
      )
      .all({ q: q.q ? `%${q.q}%` : null, perfil: q.perfil ?? null, situacao: q.situacao ?? null }) as UserRecord[];
    res.json({ users: rows.map(publicUser) });
  });

  router.post("/users", (req, res) => {
    const input = adminCreateSchema.parse(req.body);
    const user = cadastrarUsuario(db, input, { autorId: userId(req), origem: "admin" });
    res.status(201).json({ user: publicUser(user) });
  });

  const updateSchema = z.object({
    name: nameField.optional(),
    situacao: z.enum(SITUACOES).optional(),
    perfil: z.enum(PERFIS).optional(),
    crp: crpField.optional(),
  });

  router.patch("/users/:id", (req, res) => {
    const id = idParam(req.params.id);
    const input = updateSchema.parse(req.body);
    const current = findUserById(db, id);
    if (!current) throw new HttpError(404, "Usuário não encontrado.");
    // Ninguém altera o próprio perfil nem a própria situação (evita auto-elevação e auto-bloqueio).
    if (id === userId(req) && (input.perfil || input.situacao)) {
      throw new HttpError(403, "Você não pode alterar o próprio perfil ou a própria situação.");
    }
    const virouPsicologo = input.perfil === "psicologo" && current.psicologo_id === null;
    if (virouPsicologo) {
      if (!input.crp) throw new HttpError(400, "Informe o CRP para tornar este usuário psicólogo.");
      assertCrpLivre(db, input.crp);
    }

    db.transaction(() => {
      db.prepare("UPDATE usuarios SET nome = ?, situacao = ?, perfil_id = ? WHERE id = ?").run(
        input.name ?? current.nome,
        input.situacao ?? current.situacao,
        perfilId(db, input.perfil ?? current.perfil),
        id,
      );
      if (virouPsicologo) db.prepare("INSERT INTO psicologos (usuario_id, crp) VALUES (?, ?)").run(id, input.crp);
      const campos = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
      registrarLog(db, {
        usuarioId: userId(req), acao: "usuario_atualizado", entidade: "usuario", entidadeId: id,
        detalhes: { campos, ...(input.situacao ? { situacao: input.situacao } : {}), ...(input.perfil ? { perfil: input.perfil } : {}) },
      });
    })();
    res.json({ user: publicUser(findUserById(db, id)!) });
  });

  // ---- Pacientes (todos, com psicólogos vinculados) ---------------------------
  interface AdminPatientRow {
    id: number; nome: string; data_nascimento: string | null; telefone: string | null; email: string | null;
    criado_em: string; usuario_id: number | null; psicologos: string | null; ativos: number;
  }
  const PATIENT_SELECT = `
    SELECT cp.id, cp.nome, cp.data_nascimento, cp.telefone, cp.email, cp.criado_em, cp.usuario_id,
           GROUP_CONCAT(CASE WHEN v.situacao = 'ativo' THEN pu.nome END, ', ') AS psicologos,
           COALESCE(SUM(v.situacao = 'ativo'), 0) AS ativos
    FROM clientes_pacientes cp
    LEFT JOIN vinculos v ON v.cliente_paciente_id = cp.id
    LEFT JOIN psicologos ps ON ps.id = v.psicologo_id
    LEFT JOIN usuarios pu ON pu.id = ps.usuario_id`;
  const toAdminPatient = (r: AdminPatientRow) => ({
    id: r.id, name: r.nome, birthDate: r.data_nascimento, phone: r.telefone, email: r.email,
    createdAt: r.criado_em, hasAccount: r.usuario_id !== null, psychologists: r.psicologos, active: r.ativos > 0,
  });
  const findPatient = (id: number) => {
    const r = db.prepare(`${PATIENT_SELECT} WHERE cp.id = ? GROUP BY cp.id`).get(id) as AdminPatientRow | undefined;
    if (!r) throw new HttpError(404, "Paciente não encontrado.");
    return r;
  };
  const assertPsicologo = (psiId: number) => {
    if (!db.prepare("SELECT 1 FROM psicologos WHERE id = ?").get(psiId)) throw new HttpError(400, "Psicólogo inválido.");
  };

  router.get("/patients", (req, res) => {
    const q = z.string().trim().max(100).optional().parse(req.query.q);
    const rows = db
      .prepare(`${PATIENT_SELECT} WHERE (@q IS NULL OR cp.nome LIKE @q) GROUP BY cp.id ORDER BY cp.nome COLLATE NOCASE LIMIT 500`)
      .all({ q: q ? `%${q}%` : null }) as AdminPatientRow[];
    res.json({ patients: rows.map(toAdminPatient) });
  });

  const adminPatientSchema = patientSchema.extend({ psychologistId: z.number().int().positive() });

  router.post("/patients", (req, res) => {
    const input = adminPatientSchema.parse(req.body);
    assertPsicologo(input.psychologistId);
    const id = db.transaction(() => {
      const pid = Number(
        db
          .prepare("INSERT INTO clientes_pacientes (nome, data_nascimento, telefone, email) VALUES (?, ?, ?, ?)")
          .run(input.name, input.birthDate, input.phone, input.email).lastInsertRowid,
      );
      db.prepare("INSERT INTO vinculos (psicologo_id, cliente_paciente_id) VALUES (?, ?)").run(input.psychologistId, pid);
      registrarLog(db, { usuarioId: userId(req), acao: "paciente_criado", entidade: "paciente", entidadeId: pid, detalhes: { origem: "admin" } });
      return pid;
    })();
    res.status(201).json({ patient: toAdminPatient(findPatient(id)) });
  });

  /** Edita dados e, opcionalmente, vincula a mais um psicólogo (ou reabre o vínculo encerrado). */
  router.patch("/patients/:id", (req, res) => {
    const current = findPatient(idParam(req.params.id));
    const input = patientSchema.partial().extend({ linkPsychologistId: z.number().int().positive().optional() }).parse(req.body);
    const body = req.body as Record<string, unknown>;
    db.transaction(() => {
      db.prepare("UPDATE clientes_pacientes SET nome = ?, data_nascimento = ?, telefone = ?, email = ? WHERE id = ?").run(
        input.name ?? current.nome,
        "birthDate" in body ? input.birthDate ?? null : current.data_nascimento,
        "phone" in body ? input.phone ?? null : current.telefone,
        "email" in body ? input.email ?? null : current.email,
        current.id,
      );
      registrarLog(db, { usuarioId: userId(req), acao: "paciente_editado", entidade: "paciente", entidadeId: current.id, detalhes: { origem: "admin" } });
      if (input.linkPsychologistId) {
        assertPsicologo(input.linkPsychologistId);
        db.prepare(
          `INSERT INTO vinculos (psicologo_id, cliente_paciente_id) VALUES (?, ?)
           ON CONFLICT (psicologo_id, cliente_paciente_id) DO UPDATE SET situacao = 'ativo', fim = NULL`,
        ).run(input.linkPsychologistId, current.id);
        registrarLog(db, { usuarioId: userId(req), acao: "vinculo_criado", entidade: "paciente", entidadeId: current.id });
      }
    })();
    res.json({ patient: toAdminPatient(findPatient(current.id)) });
  });

  // ---- Auditoria completa ------------------------------------------------------
  router.get("/logs", (req, res) => {
    const { limit, q } = z
      .object({ limit: z.coerce.number().int().min(1).max(500).default(200), q: z.string().trim().max(60).optional() })
      .parse(req.query);
    const rows = db
      .prepare(
        `SELECT l.id, l.acao, l.entidade, l.entidade_id, l.detalhes, l.criado_em, u.nome AS autor, u.email AS autor_email
         FROM logs_acoes l LEFT JOIN usuarios u ON u.id = l.usuario_id
         WHERE (@q IS NULL OR l.acao LIKE @q OR u.nome LIKE @q)
         ORDER BY l.id DESC LIMIT @limit`,
      )
      .all({ q: q ? `%${q}%` : null, limit }) as {
      id: number; acao: string; entidade: string; entidade_id: number | null; detalhes: string | null;
      criado_em: string; autor: string | null; autor_email: string | null;
    }[];
    res.json({
      logs: rows.map((r) => ({
        id: r.id, action: r.acao, entity: r.entidade, entityId: r.entidade_id,
        details: r.detalhes ? (JSON.parse(r.detalhes) as Record<string, unknown>) : null,
        createdAt: r.criado_em, author: r.autor, authorEmail: r.autor_email,
      })),
    });
  });

  return router;
}
