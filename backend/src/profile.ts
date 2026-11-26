import { all, one, type Db } from "./db";
import { HttpError } from "./http";

export const SLOT_MIN = 50;
const STEP_MIN = 60;
const MIN_LEAD_MIN = 60;

interface ProfileRow {
  id: number;
  nome: string;
  situacao: string;
  crp: string;
  area_atuacao: string | null;
  bio: string | null;
  valor_sessao_centavos: number;
}
interface WindowRow {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

// TIME volta como "HH:MM:SS"; a aplicação usa "HH:MM".
const windows = async (db: Db, psiId: number) =>
  (
    await all<WindowRow>(
      db,
      "SELECT dia_semana, hora_inicio, hora_fim FROM horarios_disponiveis WHERE psicologo_id = ? ORDER BY dia_semana, hora_inicio",
      [psiId],
    )
  ).map((w) => ({ ...w, hora_inicio: w.hora_inicio.slice(0, 5), hora_fim: w.hora_fim.slice(0, 5) }));

/** Perfil profissional (o mesmo que o cliente vê no catálogo). */
export async function loadProfile(db: Db, psiId: number) {
  const p = await one<ProfileRow>(
    db,
    `SELECT ps.id, u.nome, u.situacao, ps.crp, ps.area_atuacao, ps.bio, ps.valor_sessao_centavos
     FROM psicologos ps JOIN usuarios u ON u.id = ps.usuario_id WHERE ps.id = ?`,
    [psiId],
  );
  if (!p) throw new HttpError(404, "Psicólogo não encontrado.");
  const education = await all<{ id: number; tipo: "certificado" | "curso"; titulo: string; instituicao: string | null; ano: number | null }>(
    db,
    "SELECT id, tipo, titulo, instituicao, ano FROM formacoes WHERE psicologo_id = ? ORDER BY ano DESC, id DESC",
    [psiId],
  );
  return {
    id: p.id,
    name: p.nome,
    active: p.situacao === "ativo",
    crp: p.crp,
    areaAtuacao: p.area_atuacao,
    bio: p.bio,
    feeCents: p.valor_sessao_centavos,
    availability: (await windows(db, psiId)).map((w) => ({ weekday: w.dia_semana, start: w.hora_inicio, end: w.hora_fim })),
    education: education.map((e) => ({ id: e.id, kind: e.tipo, title: e.titulo, institution: e.instituicao, year: e.ano })),
  };
}

const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
};

/**
 * Horários livres para o cliente pedir: janelas semanais do psicólogo, de hora em hora,
 * menos sessões agendadas e pedidos pendentes, com 1 h de antecedência mínima.
 * ponytail: horários das janelas no fuso do servidor; guardar o fuso do psicólogo se a clínica atender fora dele.
 */
export async function freeSlots(db: Db, psiId: number, days = 14, now = new Date()): Promise<string[]> {
  const ws = await windows(db, psiId);
  if (!ws.length) return [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const until = new Date(today);
  until.setDate(today.getDate() + days);

  const busy = (
    await all<{ inicio: Date; duracao_min: number }>(
      db,
      `SELECT inicio, duracao_min FROM sessoes WHERE psicologo_id = :psi AND situacao = 'agendada' AND inicio >= :de AND inicio < :ate
       UNION ALL
       SELECT inicio, duracao_min FROM solicitacoes WHERE psicologo_id = :psi AND situacao = 'pendente' AND inicio >= :de AND inicio < :ate`,
      { psi: psiId, de: today, ate: until },
    )
  ).map((b) => [b.inicio.getTime(), b.inicio.getTime() + b.duracao_min * 60_000] as const);

  const earliest = now.getTime() + MIN_LEAD_MIN * 60_000;
  const out: string[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    for (const w of ws.filter((x) => x.dia_semana === day.getDay())) {
      const end = at(day, w.hora_fim);
      for (let t = at(day, w.hora_inicio); t + SLOT_MIN * 60_000 <= end; t += STEP_MIN * 60_000) {
        const tEnd = t + SLOT_MIN * 60_000;
        if (t >= earliest && !busy.some(([s, e]) => s < tEnd && e > t)) out.push(new Date(t).toISOString());
      }
    }
  }
  return out;
}
