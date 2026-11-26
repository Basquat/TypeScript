import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import { Avatar, Empty } from "../components/Ui";
import type { Profile } from "../types";
import { formatDayLong, formatTime, money, WEEKDAYS } from "../utils";

const dayKey = (iso: string) => new Date(iso).toDateString();

export default function PsychologistPublic() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.client
      .psychologist(id)
      .then((r) => {
        setProfile(r.profile);
        setSlots(r.slots);
        setDay(r.slots[0] ? dayKey(r.slots[0]) : "");
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  // Agrupa horários livres por dia, na ordem.
  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots) map.set(dayKey(s), [...(map.get(dayKey(s)) ?? []), s]);
    return [...map.entries()];
  }, [slots]);

  async function send() {
    setError("");
    setSending(true);
    try {
      await api.client.request(id, slot, message || undefined);
      navigate("/consultas");
    } catch (e) {
      setError(errorMessage(e));
      setSending(false);
    }
  }

  if (!profile) return error ? <p className="error" role="alert">{error}</p> : <p className="muted">Carregando…</p>;

  const windows = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => ({ d, ws: profile.availability.filter((w) => w.weekday === d) }))
    .filter((x) => x.ws.length);

  return (
    <>
      <p className="crumb"><Link to="/">Psicólogos</Link> <Icon name="right" size={12} /> {profile.name}</p>
      <header className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar name={profile.name} lg />
          <div>
            <h1>{profile.name}</h1>
            <p className="muted">{profile.areaAtuacao ?? "Psicologia"} · CRP {profile.crp}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "12px 18px" }}>
          <span className="muted small">Valor da sessão</span>
          <div className="stat-value" style={{ fontSize: "1.4rem" }}>{profile.feeCents ? money(profile.feeCents) : "A combinar"}</div>
        </div>
      </header>

      <div className="split">
        <section className="card glow" aria-labelledby="book">
          <div className="card-head">
            <h2 id="book">Escolha um horário</h2>
            <span className="muted">próximos 14 dias · 50 min</span>
          </div>
          {days.length === 0 ? (
            <Empty>Sem horários livres no momento. Volte mais tarde.</Empty>
          ) : (
            <div className="form">
              <div className="slot-days" role="tablist" aria-label="Dias">
                {days.map(([k, list]) => {
                  const d = new Date(list[0]!);
                  return (
                    <button key={k} type="button" role="tab" aria-selected={day === k} className={`slot-day${day === k ? " on" : ""}`}
                      onClick={() => { setDay(k); setSlot(""); }}>
                      <span className="small">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                      <strong>{d.getDate()}</strong>
                      <span className="small">{list.length} livres</span>
                    </button>
                  );
                })}
              </div>
              <div className="slots">
                {(days.find(([k]) => k === day)?.[1] ?? []).map((s) => (
                  <button key={s} type="button" className={`slot${slot === s ? " on" : ""}`} onClick={() => setSlot(s)} aria-pressed={slot === s}>
                    {formatTime(s)}
                  </button>
                ))}
              </div>
              <label>
                Mensagem para o psicólogo (opcional)
                <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500}
                  placeholder="Conte brevemente o que te traz à terapia." style={{ minHeight: 80 }} />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="muted small">
                  {slot ? `${formatDayLong(new Date(slot))}, ${formatTime(slot)}` : "Selecione um horário"}
                </span>
                <button type="button" className="btn primary" disabled={!slot || sending} onClick={send}>
                  <Icon name="send" size={16} /> {sending ? "Enviando…" : "Solicitar horário"}
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="grid">
          <section className="card">
            <h2>Sobre</h2>
            <p className="muted" style={{ marginTop: 10 }}>{profile.bio ?? "Sem apresentação."}</p>
          </section>
          <section className="card">
            <h2>Atendimento</h2>
            <dl className="kv" style={{ marginTop: 12 }}>
              {windows.map(({ d, ws }) => (
                <div key={d} style={{ display: "contents" }}>
                  <dt>{WEEKDAYS[d]}</dt>
                  <dd className="num">{ws.map((w) => `${w.start}–${w.end}`).join(" · ")}</dd>
                </div>
              ))}
            </dl>
            {windows.length === 0 && <p className="muted small">Horários não informados.</p>}
          </section>
          {profile.education.length > 0 && (
            <section className="card">
              <h2>Formação</h2>
              <div className="edu" style={{ marginTop: 12 }}>
                {profile.education.map((e) => (
                  <div key={e.id} className="edu-item">
                    <span className="stat-icon"><Icon name={e.kind === "curso" ? "book" : "award"} size={16} /></span>
                    <div><strong>{e.title}</strong><p className="muted small">{[e.institution, e.year].filter(Boolean).join(" · ")}</p></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
