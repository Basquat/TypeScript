import { Router } from "express";
import type { Db } from "../db";
import { psicologoId } from "../middleware/auth";

/** Indicadores do painel do psicólogo. Semana/mês no fuso do servidor. */
export function summaryRouter(db: Db) {
  const router = Router();
  router.get("/", (req, res) => {
    const psi = psicologoId(req);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const last30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    const one = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).get(psi, ...params) as T;

    const patients = one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM vinculos WHERE psicologo_id = ? AND situacao = 'ativo'",
    );
    const unpaid = one<{ n: number; total: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(valor_centavos), 0) AS total FROM sessoes
       WHERE psicologo_id = ? AND situacao = 'realizada' AND pago = 0 AND valor_centavos > 0`,
    );
    const week = one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sessoes
       WHERE psicologo_id = ? AND situacao != 'cancelada' AND inicio >= ? AND inicio < ?`,
      weekStart.toISOString(),
      weekEnd.toISOString(),
    );
    const att = one<{ done: number; missed: number }>(
      `SELECT COALESCE(SUM(situacao = 'realizada'), 0) AS done, COALESCE(SUM(situacao = 'faltou'), 0) AS missed
       FROM sessoes WHERE psicologo_id = ? AND inicio >= ?`,
      last30,
    );
    const received = one<{ total: number }>(
      `SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM sessoes
       WHERE psicologo_id = ? AND situacao = 'realizada' AND pago = 1 AND inicio >= ?`,
      monthStart,
    );
    const pending = one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM solicitacoes WHERE psicologo_id = ? AND situacao = 'pendente'",
    );

    res.json({
      activePatients: patients.n,
      unpaidCount: unpaid.n,
      unpaidCents: unpaid.total,
      weekSessions: week.n,
      attendanceRate: att.done + att.missed ? att.done / (att.done + att.missed) : null,
      monthReceivedCents: received.total,
      pendingRequests: pending.n,
    });
  });
  return router;
}
