import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import StatusPill from "../components/StatusPill";
import type { Session, Status } from "../types";
import { centsToInput, formatDayLong, fromLocalInput, parseMoney, statusLabel, toLocalInput } from "../utils";

const STATUS_ORDER: Status[] = ["scheduled", "done", "missed", "canceled"];

export default function SessionDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("scheduled");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(50);
  const [fee, setFee] = useState("");
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function fill(s: Session) {
    setSession(s);
    setStatus(s.status);
    setStart(toLocalInput(s.startsAt));
    setDuration(s.durationMin);
    setFee(centsToInput(s.feeCents));
    setPaid(s.paid);
    setNote(s.note ?? "");
  }

  useEffect(() => {
    api.sessions
      .get(id)
      .then((r) => fill(r.session))
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const r = await api.sessions.update(id, {
        status,
        startsAt: fromLocalInput(start),
        durationMin: duration,
        feeCents: parseMoney(fee),
        paid,
        note,
      });
      fill(r.session);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!session || !window.confirm("Excluir esta sessão agendada?")) return;
    try {
      await api.sessions.remove(id);
      navigate(`/pacientes/${session.patientId}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (error && !session) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <Link to="/agenda">Voltar para a agenda</Link>
      </>
    );
  }
  if (!session) return <p className="muted">Carregando…</p>;

  return (
    <>
      <p className="crumb"><Link to={`/pacientes/${session.patientId}`}>{session.patientName}</Link> <Icon name="right" size={12} /> Sessão</p>
      <header className="page-head">
        <div>
          <p className="eyebrow">Sessão com {session.patientName}</p>
          <h1 style={{ marginTop: 6 }}>{formatDayLong(new Date(session.startsAt))}</h1>
          <p className="muted"><StatusPill status={session.status} /></p>
        </div>
      </header>

      <form onSubmit={save} className="card form session-form">
        <fieldset>
          <legend>Situação</legend>
          <div className="segmented" role="radiogroup" aria-label="Situação da sessão">
            {STATUS_ORDER.map((s) => (
              <label key={s} className={status === s ? "on" : undefined}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                {statusLabel[s]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="row">
          <label>
            Data e hora
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            Duração (min)
            <input type="number" min={10} max={240} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
          </label>
        </div>

        <div className="row">
          <label>
            Valor (R$)
            <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          </label>
          <label className="check inline">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Pagamento recebido
          </label>
        </div>

        <label>
          Anotações da sessão
          <textarea
            rows={12}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Registre o que for relevante para o acompanhamento."
          />
          <span className="lock-note"><Icon name="lock" size={14} /> Somente você lê este texto. Criptografado (AES-256-GCM) antes de ser salvo.</span>
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        {saved && <p className="ok" role="status">Alterações salvas.</p>}

        <div className="actions">
          {session.status === "scheduled" && !session.hasNote && (
            <button type="button" className="btn danger" onClick={remove}>Excluir sessão</button>
          )}
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </>
  );
}
