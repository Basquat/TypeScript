import { Router } from "express";
import { z } from "zod";
import { registrarLog } from "../audit";
import type { Db } from "../db";
import { HttpError } from "../http";
import { idParam, psicologoId, userId } from "../middleware/auth";
import { nameField, optionalDate, optionalText } from "../users";
import { sessionsForPatient } from "./sessions";

interface PatientRow {
  id: number;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  criado_em: string;
  vinculo_situacao: "ativo" | "encerrado";
}

/** O paciente só é visível para psicólogos com vínculo (ativo ou encerrado) com ele. */
const SELECT = `
  SELECT cp.id, cp.nome, cp.data_nascimento, cp.telefone, cp.email, cp.criado_em,
         v.situacao AS vinculo_situacao
  FROM clientes_pacientes cp
  JOIN vinculos v ON v.cliente_paciente_id = cp.id`;

export const toPatient = (r: PatientRow) => ({
  id: r.id,
  name: r.nome,
  birthDate: r.data_nascimento,
  phone: r.telefone,
  email: r.email,
  active: r.vinculo_situacao === "ativo",
  createdAt: r.criado_em,
});

export const patientSchema = z.object({
  name: nameField,
  birthDate: optionalDate,
  phone: optionalText(30),
  email: z
    .union([z.literal(""), z.string().trim().email("E-mail do paciente inválido.")])
    .nullish()
    .transform((v) => (v ? v : null)),
});

const updateSchema = patientSchema.partial().extend({ active: z.boolean().optional() });

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  archived: z.enum(["0", "1"]).optional(),
});

function findOwned(db: Db, psiId: number, id: number): PatientRow {
  const row = db.prepare(`${SELECT} WHERE v.psicologo_id = ? AND cp.id = ?`).get(psiId, id) as
    | PatientRow
    | undefined;
  if (!row) throw new HttpError(404, "Paciente não encontrado.");
  return row;
}

export function patientsRouter(db: Db) {
  const router = Router();

  router.get("/", (req, res) => {
    const { q, archived } = listQuery.parse(req.query);
    const where = ["v.psicologo_id = @psi"];
    const params: Record<string, unknown> = { psi: psicologoId(req) };
    if (archived !== "1") where.push("v.situacao = 'ativo'");
    if (q) {
      where.push("cp.nome LIKE @q");
      params.q = `%${q}%`;
    }
    const rows = db
      .prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY cp.nome COLLATE NOCASE`)
      .all(params) as PatientRow[];
    res.json({ patients: rows.map(toPatient) });
  });

  // Cadastrar um paciente cria também o vínculo com o psicólogo logado.
  router.post("/", (req, res) => {
    const input = patientSchema.parse(req.body);
    const psi = psicologoId(req);
    const id = db.transaction(() => {
      const info = db
        .prepare("INSERT INTO clientes_pacientes (nome, data_nascimento, telefone, email) VALUES (?, ?, ?, ?)")
        .run(input.name, input.birthDate, input.phone, input.email);
      const pacienteId = Number(info.lastInsertRowid);
      db.prepare("INSERT INTO vinculos (psicologo_id, cliente_paciente_id) VALUES (?, ?)").run(psi, pacienteId);
      registrarLog(db, { usuarioId: userId(req), acao: "paciente_criado", entidade: "paciente", entidadeId: pacienteId });
      return pacienteId;
    })();
    res.status(201).json({ patient: toPatient(findOwned(db, psi, id)) });
  });

  router.get("/:id", (req, res) => {
    const psi = psicologoId(req);
    const row = findOwned(db, psi, idParam(req.params.id));
    res.json({ patient: toPatient(row), sessions: sessionsForPatient(db, psi, row.id) });
  });

  router.patch("/:id", (req, res) => {
    const psi = psicologoId(req);
    const current = findOwned(db, psi, idParam(req.params.id));
    const input = updateSchema.parse(req.body);
    const body = req.body as Record<string, unknown>;
    const campos = ["name", "birthDate", "phone", "email"].filter((k) => k in body);

    db.transaction(() => {
      db.prepare(
        `UPDATE clientes_pacientes SET nome = @nome, data_nascimento = @nasc, telefone = @tel, email = @email
         WHERE id = @id`,
      ).run({
        id: current.id,
        nome: input.name ?? current.nome,
        nasc: "birthDate" in body ? input.birthDate ?? null : current.data_nascimento,
        tel: "phone" in body ? input.phone ?? null : current.telefone,
        email: "email" in body ? input.email ?? null : current.email,
      });
      if (campos.length) {
        registrarLog(db, {
          usuarioId: userId(req), acao: "paciente_editado", entidade: "paciente",
          entidadeId: current.id, detalhes: { campos },
        });
      }

      // "Arquivar" = encerrar o vínculo com este psicólogo; "reativar" = reabrir.
      const wasActive = current.vinculo_situacao === "ativo";
      if (input.active !== undefined && input.active !== wasActive) {
        db.prepare(
          "UPDATE vinculos SET situacao = @s, fim = @fim WHERE psicologo_id = @psi AND cliente_paciente_id = @id",
        ).run({
          s: input.active ? "ativo" : "encerrado",
          fim: input.active ? null : new Date().toISOString(),
          psi,
          id: current.id,
        });
        registrarLog(db, {
          usuarioId: userId(req),
          acao: input.active ? "paciente_reativado" : "paciente_arquivado",
          entidade: "paciente",
          entidadeId: current.id,
        });
      }
    })();

    res.json({ patient: toPatient(findOwned(db, psi, current.id)) });
  });

  // Sem DELETE de propósito: prontuários têm prazo mínimo de guarda; use "arquivar".

  return router;
}
