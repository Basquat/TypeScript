import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { Db } from "../db";
import { HttpError } from "../http";
import { findUserById, type Perfil } from "../users";

export interface AuthInfo {
  userId: number;
  perfil: Perfil;
  /** id em `psicologos` (dono dos pacientes e sessões); null para admin e cliente. */
  psicologoId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

export function signToken(userId: number): string {
  return jwt.sign({}, config.jwtSecret, { subject: String(userId), expiresIn: "8h", algorithm: "HS256" });
}

/**
 * Valida o JWT e recarrega o usuário do banco a cada requisição: perfil e situação
 * vêm sempre do banco, então bloquear/inativar uma conta ou trocar o perfil tem efeito imediato.
 */
export function requireAuth(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const [scheme, token] = (req.header("authorization") ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw new HttpError(401, "Faça login para continuar.");

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, "Sessão expirada. Entre novamente.");
    }

    const user = await findUserById(db, Number(payload.sub));
    if (!user) throw new HttpError(401, "Conta não encontrada.");
    if (user.situacao !== "ativo") throw new HttpError(403, "Esta conta não está ativa.");
    req.auth = { userId: user.id, perfil: user.perfil, psicologoId: user.psicologo_id };
    next();
  };
}

export function requireRole(...perfis: Perfil[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !perfis.includes(req.auth.perfil)) {
      throw new HttpError(403, "Você não tem permissão para acessar este recurso.");
    }
    next();
  };
}

export const userId = (req: Request): number => req.auth!.userId;
export const psicologoId = (req: Request): number => {
  const id = req.auth?.psicologoId;
  if (!id) throw new HttpError(403, "Conta de psicólogo sem cadastro profissional (CRP).");
  return id;
};

export const idParam = (v: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Identificador inválido.");
  return n;
};
