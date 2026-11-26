import { Link } from "react-router-dom";
import type { Session } from "../types";
import { formatDateTime, formatTime, money } from "../utils";
import StatusPill from "./StatusPill";

interface Props {
  session: Session;
  /** "time": mostra só o horário (agenda do dia). "datetime": data completa (histórico do paciente). */
  variant?: "time" | "datetime";
  highlight?: boolean;
}

export default function SessionRow({ session: s, variant = "time", highlight }: Props) {
  const meta: string[] = [];
  if (s.feeCents > 0) {
    meta.push(s.status === "done" ? `${money(s.feeCents)} · ${s.paid ? "pago" : "a receber"}` : money(s.feeCents));
  }
  if (s.hasNote) meta.push("🔒 com anotações");

  return (
    <Link to={`/sessoes/${s.id}`} className={`session-row${highlight ? " is-next" : ""}`}>
      <div className="session-when">
        {variant === "time" ? (
          <>
            <span className="clock">{formatTime(s.startsAt)}</span>
            <span className="muted small">{s.durationMin} min</span>
          </>
        ) : (
          <span className="date-line">{formatDateTime(s.startsAt)}</span>
        )}
      </div>
      <div className="session-who">
        {variant === "time" && <strong>{s.patientName}</strong>}
        <span className="muted small">{meta.join(" · ")}</span>
      </div>
      <StatusPill status={s.status} />
    </Link>
  );
}
