import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { registrarLog } from "../audit";
import { config } from "../config";
import type { Pool } from "../db";
import { HttpError } from "../http";
import { requireAuth, signToken, userId } from "../middleware/auth";
import { cadastrarUsuario, findUserByEmail, findUserById, publicUser, registerSchema } from "../users";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

// Hash fictício para que o tempo de resposta não revele se o e-mail existe.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", config.bcryptCost);

export function authRouter(db: Pool) {
  const router = Router();
  const limiter = config.isTest
    ? (_req: unknown, _res: unknown, next: () => void) => next()
    : rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

  // Cadastro público: psicólogo ou cliente (nunca administrador).
  router.post("/register", limiter, async (req, res) => {
    const { tipo, ...input } = registerSchema.parse(req.body);
    const user = await cadastrarUsuario(db, { perfil: tipo, ...input });
    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  });

  router.post("/login", limiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await findUserByEmail(db, email);
    const ok = await bcrypt.compare(password, user?.senha_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      if (user) await registrarLog(db, { usuarioId: user.id, acao: "login_falhou", entidade: "usuario", entidadeId: user.id });
      throw new HttpError(401, "E-mail ou senha incorretos.");
    }
    if (user.situacao !== "ativo") throw new HttpError(403, "Esta conta não está ativa. Fale com o administrador.");
    await registrarLog(db, { usuarioId: user.id, acao: "login", entidade: "usuario", entidadeId: user.id });
    res.json({ token: signToken(user.id), user: publicUser(user) });
  });

  router.get("/me", requireAuth(db), async (req, res) => {
    res.json({ user: publicUser((await findUserById(db, userId(req)))!) });
  });

  return router;
}
