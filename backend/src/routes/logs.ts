import { Router } from "express";
import { z } from "zod";
import { all, type Pool } from "../db";
import { userId } from "../middleware/auth";

interface LogRow {
  id: number;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  detalhes: Record<string, unknown> | null;
  criado_em: Date;
}

const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

/** Cada usuário consulta apenas o próprio histórico de ações. */
export function logsRouter(db: Pool) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { limit } = query.parse(req.query);
    const rows = await all<LogRow>(
      db,
      `SELECT id, acao, entidade, entidade_id, detalhes, criado_em
       FROM logs_acoes WHERE usuario_id = ? ORDER BY id DESC LIMIT ?`,
      [userId(req), limit],
    );
    res.json({
      logs: rows.map((r) => ({
        id: r.id,
        action: r.acao,
        entity: r.entidade,
        entityId: r.entidade_id,
        details: r.detalhes,
        createdAt: r.criado_em,
      })),
    });
  });
  return router;
}
