import { Router } from "express";
import { z } from "zod";
import type { Db } from "../db";
import { userId } from "../middleware/auth";

interface LogRow {
  id: number;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  detalhes: string | null;
  criado_em: string;
}

const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

/** O psicólogo consulta apenas o próprio histórico de ações. */
export function logsRouter(db: Db) {
  const router = Router();
  router.get("/", (req, res) => {
    const { limit } = query.parse(req.query);
    const rows = db
      .prepare(
        `SELECT id, acao, entidade, entidade_id, detalhes, criado_em
         FROM logs_acoes WHERE usuario_id = ? ORDER BY id DESC LIMIT ?`,
      )
      .all(userId(req), limit) as LogRow[];
    res.json({
      logs: rows.map((r) => ({
        id: r.id,
        action: r.acao,
        entity: r.entidade,
        entityId: r.entidade_id,
        details: r.detalhes ? (JSON.parse(r.detalhes) as Record<string, unknown>) : null,
        createdAt: r.criado_em,
      })),
    });
  });
  return router;
}
