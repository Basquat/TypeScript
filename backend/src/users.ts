import bcrypt from "bcryptjs";
import { z } from "zod";
import { registrarLog } from "./audit";
import { config } from "./config";
import type { Db } from "./db";
import { HttpError } from "./http";

export const PERFIS = ["admin", "psicologo", "cliente"] as const;
export type Perfil = (typeof PERFIS)[number];

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")])
  .nullish()
  .transform((v) => (v ? v : null));

export const nameField = z.string().trim().min(2, "Informe o nome completo.").max(120);
const emailField = z.string().trim().toLowerCase().email("E-mail inválido.");
const passwordField = z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").max(200);
export const crpField = z
  .string()
  .trim()
  .regex(/^(CRP[- ]?)?\d{2}\/\d{3,6}$/i, "Use o formato do CRP, por exemplo 03/12345.")
  .transform((v) => v.replace(/^CRP[- ]?/i, ""));

/** Cadastro público: psicólogo (com CRP) ou cliente. Administradores só nascem pelo admin ou pelo seed. */
export const registerSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("psicologo"),
    name: nameField,
    email: emailField,
    password: passwordField,
    crp: crpField,
    areaAtuacao: optionalText(120),
  }),
  z.object({
    tipo: z.literal("cliente"),
    name: nameField,
    email: emailField,
    password: passwordField,
    phone: optionalText(30),
    birthDate: optionalDate,
  }),
]);

export const adminCreateSchema = z.object({
  perfil: z.enum(PERFIS),
  name: nameField,
  email: emailField,
  password: passwordField,
  crp: crpField.optional(),
  areaAtuacao: optionalText(120),
  phone: optionalText(30),
  birthDate: optionalDate,
});

export interface NovoUsuario {
  perfil: Perfil;
  name: string;
  email: string;
  password: string;
  crp?: string | null;
  areaAtuacao?: string | null;
  phone?: string | null;
  birthDate?: string | null;
}

/** Usuário + perfil + dados profissionais, como vêm do banco. */
export interface UserRecord {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  situacao: "ativo" | "inativo" | "bloqueado";
  perfil: Perfil;
  psicologo_id: number | null;
  crp: string | null;
  area_atuacao: string | null;
  criado_em: string;
}

export const USER_SELECT = `
  SELECT u.id, u.nome, u.email, u.senha_hash, u.situacao, u.criado_em, p.nome AS perfil,
         ps.id AS psicologo_id, ps.crp, ps.area_atuacao
  FROM usuarios u
  JOIN perfis p ON p.id = u.perfil_id
  LEFT JOIN psicologos ps ON ps.usuario_id = u.id`;

export const findUserByEmail = (db: Db, email: string) =>
  db.prepare(`${USER_SELECT} WHERE u.email = ?`).get(email) as UserRecord | undefined;

export const findUserById = (db: Db, id: number) =>
  db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id) as UserRecord | undefined;

export const publicUser = (u: UserRecord) => ({
  id: u.id,
  name: u.nome,
  email: u.email,
  perfil: u.perfil,
  situacao: u.situacao,
  crp: u.crp,
  areaAtuacao: u.area_atuacao,
  psicologoId: u.psicologo_id,
  createdAt: u.criado_em,
});

export const perfilId = (db: Db, perfil: Perfil) =>
  (db.prepare("SELECT id FROM perfis WHERE nome = ?").get(perfil) as { id: number }).id;

export function assertCrpLivre(db: Db, crp: string) {
  if (db.prepare("SELECT 1 FROM psicologos WHERE crp = ?").get(crp)) {
    throw new HttpError(409, "Já existe um psicólogo cadastrado com este CRP.");
  }
}

/**
 * Cria a conta e o registro do perfil (psicologos ou clientes_pacientes) numa única transação.
 * `autorId` é quem cadastrou (o admin); sem ele, o próprio usuário (cadastro público).
 */
export function cadastrarUsuario(
  db: Db,
  input: NovoUsuario,
  opts: { autorId?: number; origem?: string } = {},
): UserRecord {
  if (db.prepare("SELECT 1 FROM usuarios WHERE email = ?").get(input.email)) {
    throw new HttpError(409, "Já existe uma conta com este e-mail.");
  }
  if (input.perfil === "psicologo") {
    if (!input.crp) throw new HttpError(400, "Informe o CRP do psicólogo.");
    assertCrpLivre(db, input.crp);
  }

  const hash = bcrypt.hashSync(input.password, config.bcryptCost);
  const id = db.transaction(() => {
    const u = db
      .prepare("INSERT INTO usuarios (perfil_id, nome, email, senha_hash) VALUES (?, ?, ?, ?)")
      .run(perfilId(db, input.perfil), input.name, input.email, hash);
    const userId = Number(u.lastInsertRowid);
    if (input.perfil === "psicologo") {
      db.prepare("INSERT INTO psicologos (usuario_id, crp, area_atuacao) VALUES (?, ?, ?)").run(
        userId,
        input.crp,
        input.areaAtuacao ?? null,
      );
    }
    if (input.perfil === "cliente") {
      db.prepare(
        "INSERT INTO clientes_pacientes (usuario_id, nome, email, telefone, data_nascimento) VALUES (?, ?, ?, ?, ?)",
      ).run(userId, input.name, input.email, input.phone ?? null, input.birthDate ?? null);
    }
    registrarLog(db, {
      usuarioId: opts.autorId ?? userId,
      acao: opts.autorId ? "usuario_criado" : "cadastro",
      entidade: "usuario",
      entidadeId: userId,
      detalhes: { origem: opts.origem ?? "web", perfil: input.perfil },
    });
    return userId;
  })();

  return findUserById(db, id)!;
}

/** Ficha de paciente da conta de cliente; criada na primeira necessidade se ainda não existir. */
export function pacienteDoCliente(db: Db, userId: number): number {
  const row = db.prepare("SELECT id FROM clientes_pacientes WHERE usuario_id = ?").get(userId) as
    | { id: number }
    | undefined;
  if (row) return row.id;
  const u = findUserById(db, userId)!;
  return Number(
    db
      .prepare("INSERT INTO clientes_pacientes (usuario_id, nome, email) VALUES (?, ?, ?)")
      .run(userId, u.nome, u.email).lastInsertRowid,
  );
}
