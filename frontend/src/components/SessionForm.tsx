import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../api";
import type { Patient, Session } from "../types";
import { centsToInput, fromLocalInput, parseMoney, toLocalInput } from "../utils";

interface Props {
  defaultPatientId?: number;
  /** Data/hora sugerida (ISO). Padrão: próxima hora cheia. */
  defaultStart?: Date;
  onSaved: (session: Session) => void;
  onCancel: () => void;
}

function nextFullHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export default function SessionForm({ defaultPatientId, defaultStart, onSaved, onCancel }: Props) {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [patientId, setPatientId] = useState<number | "">(defaultPatientId ?? "");
  const [start, setStart] = useState(toLocalInput(defaultStart ?? nextFullHour()));
  const [duration, setDuration] = useState(50);
  const [fee, setFee] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Valor padrão vem do perfil profissional.
    Promise.all([api.patients.list(), api.profile.get()])
      .then(([p, prof]) => {
        setPatients(p.patients);
        setFee((f) => f || centsToInput(prof.profile.feeCents));
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (patientId === "") return setError("Escolha um paciente.");
    setError("");
    setSaving(true);
    try {
      const r = await api.sessions.create({
        patientId,
        startsAt: fromLocalInput(start),
        durationMin: duration,
        feeCents: parseMoney(fee),
        repeatWeeks,
      });
      onSaved(r.session);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  if (patients && patients.length === 0) {
    return (
      <div className="form">
        <p>Você ainda não tem pacientes ativos. Cadastre um paciente para poder agendar sessões.</p>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="form">
      <label>
        Paciente
        <select
          value={patientId}
          onChange={(e) => setPatientId(e.target.value ? Number(e.target.value) : "")}
          required
          disabled={!patients}
        >
          <option value="">{patients ? "Selecione…" : "Carregando…"}</option>
          {patients?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <label>
          Data e hora
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          Duração (min)
          <input
            type="number"
            min={10}
            max={240}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            required
          />
        </label>
      </div>
      <div className="row">
        <label>
          Valor da sessão (R$)
          <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder={centsToInput(15000)} />
        </label>
        <label>
          Repetição
          <select value={repeatWeeks} onChange={(e) => setRepeatWeeks(Number(e.target.value))}>
            <option value={1}>Sessão única</option>
            {[4, 8, 12].map((n) => (
              <option key={n} value={n}>Semanal · {n} semanas</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Agendando…" : repeatWeeks > 1 ? `Agendar ${repeatWeeks} sessões` : "Agendar sessão"}
        </button>
      </div>
    </form>
  );
}
