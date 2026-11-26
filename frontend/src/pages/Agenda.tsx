import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import SessionForm from "../components/SessionForm";
import SessionRow from "../components/SessionRow";
import { Empty } from "../components/Ui";
import type { Session } from "../types";
import { addDays, formatDayLong, formatMonth, formatTime, sameDay, startOfWeek } from "../utils";

type View = "week" | "month";
const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function Agenda() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState("");
  const [scheduling, setScheduling] = useState<Date | null>(null);

  // Semana: seg→dom. Mês: grade de 6 semanas começando na segunda antes do dia 1.
  const range = useMemo(() => {
    if (view === "week") {
      const from = startOfWeek(anchor);
      return { from, days: 7 };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { from: startOfWeek(first), days: 42 };
  }, [view, anchor]);

  const load = useCallback(() => {
    setSessions(null);
    api.sessions
      .list({ from: range.from.toISOString(), to: addDays(range.from, range.days).toISOString() })
      .then((r) => setSessions(r.sessions))
      .catch((e) => setError(errorMessage(e)));
  }, [range]);

  useEffect(load, [load]);

  const days = useMemo(() => Array.from({ length: range.days }, (_, i) => addDays(range.from, i)), [range]);
  const onDay = (d: Date) => sessions?.filter((s) => sameDay(new Date(s.startsAt), d)) ?? [];
  const step = (n: number) =>
    setAnchor(view === "week" ? addDays(anchor, 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));

  const label =
    view === "week"
      ? `${range.from.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${addDays(range.from, 6).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`
      : formatMonth(anchor);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Agenda</p>
          <h1 style={{ marginTop: 6 }}>{label}</h1>
        </div>
        <div className="head-actions">
          <div className="segmented">
            {(["week", "month"] as const).map((v) => (
              <button key={v} type="button" className={view === v ? "on" : undefined} onClick={() => setView(v)}>
                {v === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <button type="button" className="btn ghost icon" onClick={() => step(-1)} aria-label="Anterior"><Icon name="left" /></button>
          <button type="button" className="btn ghost" onClick={() => { setAnchor(new Date()); setSelected(new Date()); }}>Hoje</button>
          <button type="button" className="btn ghost icon" onClick={() => step(1)} aria-label="Próximo"><Icon name="right" /></button>
          <button type="button" className="btn primary" onClick={() => setScheduling(new Date())}><Icon name="plus" size={16} /> Nova sessão</button>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {!sessions && !error && <p className="muted">Carregando…</p>}

      {sessions && view === "week" && (
        <div className="week">
          {days.map((day) => {
            const list = onDay(day);
            return (
              <section key={day.toISOString()} className={`day${sameDay(day, new Date()) ? " is-today" : ""}`}>
                <div className="day-head">
                  <span>{day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                  <strong>{day.getDate()}</strong>
                </div>
                {list.map((s) => (
                  <Link key={s.id} to={`/sessoes/${s.id}`} className={`chip ${s.status}`}>
                    <b>{formatTime(s.startsAt)}</b>
                    <span>{s.patientName}</span>
                  </Link>
                ))}
                {list.length === 0 && <p className="faint small">Livre</p>}
              </section>
            );
          })}
        </div>
      )}

      {sessions && view === "month" && (
        <div className="split">
          <div className="card">
            <div className="month">
              {DOW.map((d) => <div key={d} className="month-dow">{d}</div>)}
              {days.map((day) => {
                const list = onDay(day);
                const cls = [
                  "month-cell",
                  day.getMonth() !== anchor.getMonth() && "out",
                  sameDay(day, new Date()) && "today",
                  sameDay(day, selected) && "sel",
                ].filter(Boolean).join(" ");
                return (
                  <button key={day.toISOString()} type="button" className={cls} onClick={() => setSelected(day)}
                    aria-label={`${formatDayLong(day)}: ${list.length} sessões`}>
                    <span className="n">{day.getDate()}</span>
                    <span className="dots">{list.slice(0, 6).map((s) => <i key={s.id} className={s.status} />)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <section className="card">
            <div className="card-head">
              <h2>{formatDayLong(selected)}</h2>
              <button type="button" className="btn sm" onClick={() => setScheduling(selected)}><Icon name="plus" size={14} /> Agendar</button>
            </div>
            {onDay(selected).length === 0 ? (
              <Empty>Nenhuma sessão neste dia.</Empty>
            ) : (
              <div className="list">{onDay(selected).map((s) => <SessionRow key={s.id} session={s} />)}</div>
            )}
          </section>
        </div>
      )}

      {scheduling && (
        <Modal title="Nova sessão" onClose={() => setScheduling(null)}>
          <SessionForm
            defaultStart={sameDay(scheduling, new Date()) ? undefined : new Date(scheduling.getFullYear(), scheduling.getMonth(), scheduling.getDate(), 9)}
            onCancel={() => setScheduling(null)}
            onSaved={() => {
              setScheduling(null);
              load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
