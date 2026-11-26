import type { Perfil, RequestStatus, Situacao, Status } from "./types";

export const statusLabel: Record<Status, string> = {
  scheduled: "Agendada",
  done: "Realizada",
  canceled: "Cancelada",
  missed: "Faltou",
};

export const requestLabel: Record<RequestStatus, string> = {
  pending: "Aguardando",
  accepted: "Confirmada",
  declined: "Recusada",
  canceled: "Cancelada",
};

export const perfilLabel: Record<Perfil, string> = { admin: "Administrador", psicologo: "Psicólogo", cliente: "Cliente" };
export const situacaoLabel: Record<Situacao, string> = { ativo: "Ativo", inativo: "Inativo", bloqueado: "Bloqueado" };
export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** "em 25 min", "em 2 h", "agora" — para a próxima sessão. */
export function relativeFromNow(iso: string): string {
  const min = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (min <= 0) return "agora";
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `em ${h} h${min % 60 ? ` ${min % 60} min` : ""}` : `em ${Math.round(h / 24)} dias`;
}

export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatDayLong = (d: Date) =>
  cap(d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));

export const formatMonth = (d: Date) => cap(d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Segunda-feira da semana de `d`. */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (UTC) → valor para <input type="datetime-local"> no fuso do navegador. */
export const toLocalInput = (iso: string | Date) => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (value: string) => new Date(value).toISOString();

export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/** "150,00" → 15000 (centavos). Retorna 0 para vazio ou inválido. */
export function parseMoney(text: string): number {
  const n = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
export const centsToInput = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(".", ",") : "");
