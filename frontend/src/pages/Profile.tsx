import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import { Avatar, Empty } from "../components/Ui";
import type { Availability, Profile as ProfileT } from "../types";
import { centsToInput, money, parseMoney, WEEKDAYS } from "../utils";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro

export default function Profile() {
  const [profile, setProfile] = useState<ProfileT | null>(null);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [fee, setFee] = useState("");
  const [avail, setAvail] = useState<Availability[]>([]);
  const [edu, setEdu] = useState({ kind: "curso" as "curso" | "certificado", title: "", institution: "", year: "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function fill(p: ProfileT) {
    setProfile(p);
    setName(p.name);
    setArea(p.areaAtuacao ?? "");
    setBio(p.bio ?? "");
    setFee(centsToInput(p.feeCents));
    setAvail(p.availability);
  }

  useEffect(() => {
    api.profile.get().then((r) => fill(r.profile)).catch((e) => setError(errorMessage(e)));
  }, []);

  const patchWin = (i: number, patch: Partial<Availability>) => setAvail(avail.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      fill((await api.profile.save({ name, areaAtuacao: area || null, bio: bio || null, feeCents: parseMoney(fee), availability: avail })).profile);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addEdu(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api.profile.addEducation({
        kind: edu.kind, title: edu.title, institution: edu.institution || null, year: edu.year ? Number(edu.year) : null,
      });
      setProfile(r.profile);
      setEdu({ ...edu, title: "", institution: "", year: "" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeEdu(id: number) {
    try {
      setProfile((await api.profile.removeEducation(id)).profile);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!profile) return error ? <p className="error" role="alert">{error}</p> : <p className="muted">Carregando…</p>;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Perfil profissional · CRP {profile.crp}</p>
          <h1 style={{ marginTop: 6 }}>Como os clientes veem você</h1>
          <p className="muted">Dados, valor da sessão e janelas de atendimento alimentam o catálogo e os horários livres.</p>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="split">
        <form onSubmit={save} className="card form">
          <h2>Dados e atendimento</h2>
          <div className="row">
            <label>
              Nome de exibição
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Área de atuação
              <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} placeholder="Psicologia clínica" />
            </label>
          </div>
          <label>
            Valor padrão da sessão (R$)
            <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="180,00" />
          </label>
          <label>
            Apresentação
            <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000}
              placeholder="Abordagem, público atendido, modalidade (online/presencial)…" />
          </label>

          <fieldset>
            <legend>Janelas de atendimento (sessões de 50 min, de hora em hora)</legend>
            <div className="avail">
              {ORDER.map((d) => (
                <div key={d} className="avail-day">
                  <span>{WEEKDAYS[d]}</span>
                  <div className="avail-wins">
                    {avail.map((w, i) =>
                      w.weekday !== d ? null : (
                        <span key={i} className="win">
                          <input type="time" value={w.start} onChange={(e) => patchWin(i, { start: e.target.value })} aria-label={`Início ${WEEKDAYS[d]}`} required />
                          <span className="faint">→</span>
                          <input type="time" value={w.end} onChange={(e) => patchWin(i, { end: e.target.value })} aria-label={`Fim ${WEEKDAYS[d]}`} required />
                          <button type="button" className="btn ghost icon sm" onClick={() => setAvail(avail.filter((_, j) => j !== i))} aria-label="Remover janela">
                            <Icon name="x" size={14} />
                          </button>
                        </span>
                      ),
                    )}
                    <button type="button" className="btn sm ghost" onClick={() => setAvail([...avail, { weekday: d, start: "09:00", end: "12:00" }])}>
                      <Icon name="plus" size={14} /> janela
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          {saved && <p className="ok" role="status">Perfil salvo.</p>}
          <div className="actions">
            <button type="submit" className="btn primary" disabled={saving}>{saving ? "Salvando…" : "Salvar perfil"}</button>
          </div>
        </form>

        <aside className="grid">
          <section className="card glow">
            <p className="eyebrow">Prévia no catálogo</p>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12 }}>
              <Avatar name={name || profile.name} lg />
              <div>
                <h3>{name || profile.name}</h3>
                <p className="muted small">{area || "Área não informada"} · CRP {profile.crp}</p>
                <p className="num" style={{ marginTop: 4 }}>{money(parseMoney(fee))} <span className="muted small">/ sessão</span></p>
              </div>
            </div>
            {bio && <p className="muted small" style={{ marginTop: 12 }}>{bio}</p>}
          </section>

          <section className="card">
            <div className="card-head"><h2>Formação</h2><span className="muted">{profile.education.length} itens</span></div>
            <div className="edu">
              {profile.education.length === 0 && <Empty>Adicione cursos e certificados.</Empty>}
              {profile.education.map((e) => (
                <div key={e.id} className="edu-item">
                  <span className="stat-icon"><Icon name={e.kind === "curso" ? "book" : "award"} size={16} /></span>
                  <div>
                    <strong>{e.title}</strong>
                    <p className="muted small">{[e.institution, e.year].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button type="button" className="btn ghost icon sm" onClick={() => removeEdu(e.id)} aria-label={`Remover ${e.title}`}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addEdu} className="form" style={{ marginTop: 14 }}>
              <div className="row">
                <label>
                  Tipo
                  <select value={edu.kind} onChange={(e) => setEdu({ ...edu, kind: e.target.value as "curso" | "certificado" })}>
                    <option value="curso">Curso</option>
                    <option value="certificado">Certificado</option>
                  </select>
                </label>
                <label>
                  Ano
                  <input type="number" min={1950} max={2100} value={edu.year} onChange={(e) => setEdu({ ...edu, year: e.target.value })} />
                </label>
              </div>
              <label>
                Título
                <input value={edu.title} onChange={(e) => setEdu({ ...edu, title: e.target.value })} required minLength={2} />
              </label>
              <label>
                Instituição
                <input value={edu.institution} onChange={(e) => setEdu({ ...edu, institution: e.target.value })} />
              </label>
              <div className="actions"><button type="submit" className="btn"><Icon name="plus" size={14} /> Adicionar</button></div>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
