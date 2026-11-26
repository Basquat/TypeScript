import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../api";
import type { Patient } from "../types";

interface Props<P extends Patient> {
  initial?: P;
  /** Modo administrador: escolhe o psicólogo do vínculo (obrigatório ao cadastrar, opcional ao editar). */
  psychologists?: { id: number; name: string }[];
  onSaved: (patient: P) => void;
  onCancel: () => void;
}

export default function PatientForm<P extends Patient>({ initial, psychologists, onSaved, onCancel }: Props<P>) {
  const [name, setName] = useState(initial?.name ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [psiId, setPsiId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const input = { name, birthDate: birthDate || null, phone: phone || null, email: email || null };
    try {
      let saved: Patient;
      if (psychologists) {
        saved = initial
          ? (await api.admin.updatePatient(initial.id, { ...input, linkPsychologistId: psiId || undefined })).patient
          : (await api.admin.createPatient({ ...input, psychologistId: Number(psiId) })).patient;
      } else {
        saved = initial ? (await api.patients.update(initial.id, input)).patient : (await api.patients.create(input)).patient;
      }
      onSaved(saved as P);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <label>
        Nome completo
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <div className="row">
        <label>
          Data de nascimento
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        <label>
          Telefone
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(71) 90000-0000" />
        </label>
      </div>
      <label>
        E-mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {psychologists && (
        <label>
          {initial ? "Vincular a mais um psicólogo (opcional)" : "Psicólogo responsável"}
          <select value={psiId} onChange={(e) => setPsiId(e.target.value ? Number(e.target.value) : "")} required={!initial}>
            <option value="">{initial ? "Manter vínculos atuais" : "Selecione…"}</option>
            {psychologists.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar paciente"}
        </button>
      </div>
    </form>
  );
}
