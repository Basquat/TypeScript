import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import helmet from "helmet";
import { ZodError } from "zod";
import { config } from "./config";
import type { Pool } from "./db";
import { HttpError } from "./http";
import { requireAuth, requireRole } from "./middleware/auth";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { logsRouter } from "./routes/logs";
import { patientsRouter } from "./routes/patients";
import { profileRouter } from "./routes/profile";
import { clientRouter, requestsRouter } from "./routes/requests";
import { sessionsRouter } from "./routes/sessions";
import { summaryRouter } from "./routes/summary";

/** Express 5: erros lançados em rotas assíncronas chegam sozinhos ao tratador no fim. */
export function createApp(db: Pool) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      // Sem "upgrade-insecure-requests": o app também precisa funcionar em http na rede local.
      // Em produção, sirva sempre atrás de HTTPS (proxy reverso).
      contentSecurityPolicy: { useDefaults: true, directives: { "upgrade-insecure-requests": null } },
    }),
  );
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter(db));

  // Autorização sempre no back-end: cada grupo de rotas exige login + perfil.
  const auth = requireAuth(db);
  const psi = [auth, requireRole("psicologo")];
  app.use("/api/patients", psi, patientsRouter(db));
  app.use("/api/sessions", psi, sessionsRouter(db));
  app.use("/api/summary", psi, summaryRouter(db));
  app.use("/api/profile", psi, profileRouter(db));
  app.use("/api/requests", psi, requestsRouter(db));
  app.use("/api/admin", auth, requireRole("admin"), adminRouter(db));
  app.use("/api/client", auth, requireRole("cliente"), clientRouter(db));
  app.use("/api/logs", auth, logsRouter(db));
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Rota não encontrada.")));

  // Em produção, serve o frontend compilado (frontend/dist).
  if (fs.existsSync(config.staticDir)) {
    app.use(express.static(config.staticDir));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(config.staticDir, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.issues.map((i) => i.message).join(" ") });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "JSON inválido." });
    } else {
      console.error(err);
      res.status(500).json({ error: "Erro interno. Tente novamente em instantes." });
    }
  });

  return app;
}
