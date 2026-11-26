import { Router } from "express";
import { one, type Pool } from "../db";
import { psicologoId } from "../middleware/auth";

/** Indicadores do painel do psicólogo. Semana/mês no fuso do servidor. */
export function summaryRouter(db: Pool) {
  const router = Router();
  router.get("/", async (req, res) => {
    const psi = psicologoId(req);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(now.getTime() - 30 * 86_400_000);

    const get = async <T>(sql: string, ...params: unknown[]) => (await one<T>(db, sql, [psi, ...params]))!;

    const patients = await get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM vinculos WHERE psicologo_id = ? AND situacao = 'ativo'",
    );
    const unpaid = await get<{ n: number; total: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(valor_centavos), 0) AS total FROM sessoes
       WHERE psicologo_id = ? AND situacao = 'realizada' AND pago = 0 AND valor_centavos > 0`,
    );
    const week = await get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sessoes
       WHERE psicologo_id = ? AND situacao != 'cancelada' AND inicio >= ? AND inicio < ?`,
      weekStart,
      weekEnd,
    );
    const att = await get<{ done: number; missed: number }>(
      `SELECT COALESCE(SUM(situacao = 'realizada'), 0) AS done, COALESCE(SUM(situacao = 'faltou'), 0) AS missed
       FROM sessoes WHERE psicologo_id = ? AND inicio >= ?`,
      last30,
    );
    const received = await get<{ total: number }>(
      `SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM sessoes
       WHERE psicologo_id = ? AND situacao = 'realizada' AND pago = 1 AND inicio >= ?`,
      monthStart,
    );
    const pending = await get<{ n: number }>(
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
