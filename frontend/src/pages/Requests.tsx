import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import { Avatar, Empty, Pill } from "../components/Ui";
import type { BookingRequest } from "../types";
import { formatDateTime, formatDayLong, formatTime, requestLabel } from "../utils";

export default function Requests() {
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.requests
      .list()
      .then((r) => setRequests(r.requests))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function decide(r: BookingRequest, action: "accept" | "decline") {
    setBusy(r.id);
    setError("");
    try {
      await api.requests.decide(r.id, action, replies[r.id] || undefined);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const history = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Agenda com confirmação</p>
          <h1 style={{ marginTop: 6 }}>Solicitações de horário</h1>
          <p className="muted">Clientes escolhem um horário livre do seu perfil. Ao confirmar, o vínculo e a sessão são criados.</p>
        </div>
        <Link to="/perfil" className="btn ghost"><Icon name="clock" size={16} /> Ajustar horários</Link>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {!requests && !error && <p className="muted">Carregando…</p>}

      {requests && (
        <section className="grid">
          <h2>Pendentes {pending.length > 0 && <span className="badge">{pending.length}</span>}</h2>
          {pending.length === 0 ? (
            <Empty>Nenhuma solicitação aguardando resposta.</Empty>
          ) : (
            <div className="grid grid-2">
              {pending.map((r) => (
                <article key={r.id} className="card glow" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Avatar name={r.clientName} />
                    <div style={{ minWidth: 0 }}>
                      <strong>{r.clientName}</strong>
                      <p className="muted small">{r.clientEmail}</p>
                    </div>
                  </div>
                  <div>
                    <div className="clock" style={{ fontSize: "1.6rem" }}>{formatTime(r.startsAt)}</div>
                    <p className="muted small">{formatDayLong(new Date(r.startsAt))} · {r.durationMin} min</p>
                  </div>
                  {r.message && <p style={{ fontStyle: "italic", color: "var(--muted)" }}>“{r.message}”</p>}
                  <input
                    placeholder="Resposta opcional ao cliente"
                    value={replies[r.id] ?? ""}
                    onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })}
                    maxLength={500}
                    aria-label={`Resposta para ${r.clientName}`}
                  />
                  <div className="actions">
                    <button type="button" className="btn danger" disabled={busy === r.id} onClick={() => decide(r, "decline")}>
                      <Icon name="x" size={16} /> Recusar
                    </button>
                    <button type="button" className="btn primary" disabled={busy === r.id} onClick={() => decide(r, "accept")}>
                      <Icon name="check" size={16} /> Confirmar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <>
              <h2 style={{ marginTop: 12 }}>Histórico</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Horário</th><th>Situação</th><th /></tr></thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id}>
                        <td><div className="cell-user"><Avatar name={r.clientName} /><div><strong>{r.clientName}</strong><span className="muted small">{r.clientEmail}</span></div></div></td>
                        <td className="num">{formatDateTime(r.startsAt)}</td>
                        <td><Pill kind={r.status}>{requestLabel[r.status]}</Pill></td>
                        <td className="row-actions">{r.sessionId && <Link to={`/sessoes/${r.sessionId}`}>ver sessão</Link>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
