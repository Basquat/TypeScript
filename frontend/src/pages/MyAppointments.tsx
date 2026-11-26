import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import StatusPill from "../components/StatusPill";
import { Avatar, Empty, Pill } from "../components/Ui";
import type { BookingRequest, ClientSession } from "../types";
import { formatDateTime, formatDayLong, formatTime, money, relativeFromNow, requestLabel } from "../utils";

export default function MyAppointments() {
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([api.client.requests(), api.client.sessions()])
      .then(([r, s]) => {
        setRequests(r.requests);
        setSessions(s.sessions);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function cancel(id: number) {
    if (!window.confirm("Cancelar esta solicitação?")) return;
    try {
      await api.client.cancel(id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const now = Date.now();
  const upcoming = sessions.filter((s) => s.status === "scheduled" && Date.parse(s.startsAt) > now).reverse();
  const past = sessions.filter((s) => !upcoming.includes(s));
  const next = upcoming[0];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Minhas consultas</p>
          <h1 style={{ marginTop: 6 }}>Seus atendimentos</h1>
        </div>
        <Link to="/" className="btn primary"><Icon name="plus" size={16} /> Nova solicitação</Link>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {!requests && !error && <p className="muted">Carregando…</p>}

      {requests && (
        <>
          {next && (
            <section className="card glow hero-next">
              <div>
                <p className="eyebrow">Próxima consulta</p>
                <div className="when" style={{ marginTop: 6 }}>{formatTime(next.startsAt)}</div>
                <p>{formatDayLong(new Date(next.startsAt))} · {relativeFromNow(next.startsAt)}</p>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar name={next.psychologistName} />
                <div><strong>{next.psychologistName}</strong><p className="muted small">{next.durationMin} min · {money(next.feeCents)}</p></div>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>Solicitações</h2><span className="muted">{requests.length}</span></div>
            {requests.length === 0 ? (
              <Empty action={<Link to="/" className="btn ghost">Encontrar psicólogo</Link>}>Você ainda não pediu nenhum horário.</Empty>
            ) : (
              <div className="list">
                {requests.map((r) => (
                  <div key={r.id} className="session-row" style={{ gridTemplateColumns: "1fr auto auto" }}>
                    <div className="session-who">
                      <strong>{r.psychologistName}</strong>
                      <span className="muted small num">{formatDateTime(r.startsAt)}</span>
                      {r.reply && <span className="small" style={{ color: "var(--cyan)" }}>Resposta: “{r.reply}”</span>}
                    </div>
                    <Pill kind={r.status}>{requestLabel[r.status]}</Pill>
                    {r.status === "pending" ? (
                      <button type="button" className="btn sm danger" onClick={() => cancel(r.id)}>Cancelar</button>
                    ) : <span />}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Histórico de sessões</h2><span className="muted">{past.length}</span></div>
            {past.length === 0 ? (
              <Empty>Nenhuma sessão passada.</Empty>
            ) : (
              <div className="table-wrap" style={{ border: 0, background: "none" }}>
                <table>
                  <thead><tr><th>Data</th><th>Psicólogo</th><th>Situação</th><th>Valor</th></tr></thead>
                  <tbody>
                    {past.map((s) => (
                      <tr key={s.id}>
                        <td className="num">{formatDateTime(s.startsAt)}</td>
                        <td>{s.psychologistName}</td>
                        <td><StatusPill status={s.status} /></td>
                        <td className="num">{money(s.feeCents)} {s.status === "done" && <span className="muted small">· {s.paid ? "pago" : "pendente"}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
