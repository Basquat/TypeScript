import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import SessionForm from "../components/SessionForm";
import SessionRow from "../components/SessionRow";
import { Empty, Ring, Stat } from "../components/Ui";
import type { Session, Summary } from "../types";
import { addDays, formatDayLong, formatTime, money, relativeFromNow, startOfDay } from "../utils";

export default function Today() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const load = useCallback(() => {
    const from = startOfDay(new Date());
    Promise.all([api.sessions.list({ from: from.toISOString(), to: addDays(from, 1).toISOString() }), api.summary()])
      .then(([s, sum]) => {
        setSessions(s.sessions);
        setSummary(sum);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(load, [load]);

  const now = Date.now();
  const next = sessions?.find((s) => s.status === "scheduled" && Date.parse(s.startsAt) + s.durationMin * 60_000 > now);
  const done = sessions?.filter((s) => s.status === "done").length ?? 0;
  const firstName = user?.name.split(" ")[0];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{formatDayLong(new Date())}</p>
          <h1 style={{ marginTop: 6 }}>Olá, <span className="grad-text">{firstName}</span></h1>
        </div>
        <button type="button" className="btn primary" onClick={() => setScheduling(true)}>
          <Icon name="plus" size={16} /> Nova sessão
        </button>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      {summary && (
        <section className="stats" aria-label="Indicadores">
          <Stat icon="calendar" label="Sessões na semana" value={summary.weekSessions} foot="sem contar canceladas" />
          <Stat icon="users" label="Pacientes ativos" value={summary.activePatients} to="/pacientes" />
          <Stat icon="wallet" label="A receber" value={money(summary.unpaidCents)} foot={`${summary.unpaidCount} sessões realizadas`} />
          <Stat icon="sparkle" label="Recebido no mês" value={money(summary.monthReceivedCents)} />
          <Stat
            icon="inbox"
            label="Solicitações"
            value={summary.pendingRequests}
            foot={summary.pendingRequests ? "aguardando sua resposta" : "nenhuma pendente"}
            to="/solicitacoes"
          />
        </section>
      )}

      <div className="split">
        <section className="card" aria-labelledby="today-title">
          <div className="card-head">
            <h2 id="today-title">Linha do tempo de hoje</h2>
            <span className="muted">{sessions ? `${done}/${sessions.length} realizadas` : ""}</span>
          </div>
          {!sessions ? (
            <p className="muted">Carregando…</p>
          ) : sessions.length === 0 ? (
            <Empty action={<button type="button" className="btn ghost" onClick={() => setScheduling(true)}>Agendar uma sessão</button>}>
              Nenhuma sessão marcada para hoje.
            </Empty>
          ) : (
            <ol className="timeline">
              {sessions.map((s) => (
                <li key={s.id} className={s.id === next?.id ? "is-next" : undefined}>
                  <SessionRow session={s} highlight={s.id === next?.id} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="grid">
          <section className="card glow">
            <p className="eyebrow">Próxima sessão</p>
            {next ? (
              <div className="hero-next" style={{ marginTop: 10 }}>
                <div>
                  <div className="when">{formatTime(next.startsAt)}</div>
                  <p><strong>{next.patientName}</strong></p>
                  <p className="muted small">{relativeFromNow(next.startsAt)} · {next.durationMin} min</p>
                </div>
                <Link to={`/sessoes/${next.id}`} className="btn primary">Abrir</Link>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 10 }}>Sem mais sessões hoje. Respire.</p>
            )}
          </section>
          {summary && (
            <section className="card" style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Ring value={summary.attendanceRate} label="presença" />
              <div>
                <h3>Comparecimento</h3>
                <p className="muted small">Realizadas ÷ (realizadas + faltas) nos últimos 30 dias.</p>
              </div>
            </section>
          )}
        </aside>
      </div>

      {scheduling && (
        <Modal title="Nova sessão" onClose={() => setScheduling(false)}>
          <SessionForm
            onCancel={() => setScheduling(false)}
            onSaved={(s) => {
              setScheduling(false);
              navigate(`/sessoes/${s.id}`);
            }}
          />
        </Modal>
      )}
    </>
  );
}
