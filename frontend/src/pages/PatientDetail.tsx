import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import PatientForm from "../components/PatientForm";
import SessionForm from "../components/SessionForm";
import SessionRow from "../components/SessionRow";
import { Avatar, Empty, Pill, Stat } from "../components/Ui";
import type { Patient, Session } from "../types";
import { ageFrom, money } from "../utils";

export default function PatientDetail() {
  const id = Number(useParams().id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"edit" | "schedule" | null>(null);

  const load = useCallback(() => {
    api.patients
      .get(id)
      .then((r) => {
        setPatient(r.patient);
        setSessions(r.sessions);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(load, [load]);

  async function toggleActive() {
    if (!patient) return;
    try {
      setPatient((await api.patients.update(patient.id, { active: !patient.active })).patient);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (error && !patient) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <Link to="/pacientes">Voltar para pacientes</Link>
      </>
    );
  }
  if (!patient) return <p className="muted">Carregando…</p>;

  const age = ageFrom(patient.birthDate);
  const done = sessions.filter((s) => s.status === "done");
  const missed = sessions.filter((s) => s.status === "missed").length;
  const unpaid = done.filter((s) => !s.paid).reduce((t, s) => t + s.feeCents, 0);
  const upcoming = sessions.filter((s) => s.status === "scheduled" && Date.parse(s.startsAt) > Date.now()).length;

  return (
    <>
      <p className="crumb"><Link to="/pacientes">Pacientes</Link> <Icon name="right" size={12} /> {patient.name}</p>
      <header className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar name={patient.name} lg />
          <div>
            <h1>{patient.name}</h1>
            <p className="muted" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {[age !== null && `${age} anos`, patient.phone, patient.email].filter(Boolean).join(" · ") || "Sem dados de contato."}
              {patient.active ? <Pill kind="ativo">Vínculo ativo</Pill> : <Pill kind="inativo">Arquivado</Pill>}
            </p>
          </div>
        </div>
        <div className="head-actions">
          <button type="button" className="btn ghost" onClick={() => setModal("edit")}><Icon name="edit" size={16} /> Editar</button>
          <button type="button" className="btn ghost" onClick={toggleActive}>
            <Icon name="archive" size={16} /> {patient.active ? "Arquivar" : "Reativar"}
          </button>
          {patient.active && (
            <button type="button" className="btn primary" onClick={() => setModal("schedule")}><Icon name="plus" size={16} /> Agendar</button>
          )}
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="stats">
        <Stat icon="check" label="Sessões realizadas" value={done.length} />
        <Stat icon="calendar" label="Próximas" value={upcoming} />
        <Stat icon="x" label="Faltas" value={missed} />
        <Stat icon="wallet" label="A receber" value={money(unpaid)} />
      </section>

      <section className="card" aria-labelledby="hist">
        <div className="card-head">
          <h2 id="hist">Histórico de sessões</h2>
          <span className="muted">{sessions.length} no total</span>
        </div>
        {sessions.length === 0 ? (
          <Empty>Nenhuma sessão registrada para este paciente.</Empty>
        ) : (
          <div className="list">{sessions.map((s) => <SessionRow key={s.id} session={s} variant="datetime" />)}</div>
        )}
      </section>

      {modal === "edit" && (
        <Modal title="Editar paciente" onClose={() => setModal(null)}>
          <PatientForm initial={patient} onCancel={() => setModal(null)} onSaved={(p) => { setPatient(p); setModal(null); }} />
        </Modal>
      )}
      {modal === "schedule" && (
        <Modal title="Agendar sessão" onClose={() => setModal(null)}>
          <SessionForm defaultPatientId={patient.id} onCancel={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
        </Modal>
      )}
    </>
  );
}
