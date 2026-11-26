import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import PatientForm from "../components/PatientForm";
import { Avatar, Empty } from "../components/Ui";
import type { Patient } from "../types";
import { ageFrom } from "../utils";

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.patients
        .list({ q: q.trim() || undefined, archived })
        .then((r) => {
          setPatients(r.patients);
          setError("");
        })
        .catch((e) => setError(errorMessage(e)));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, archived]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Pacientes</p>
          <h1 style={{ marginTop: 6 }}>
            {patients ? `${patients.length} ${archived ? "no total" : patients.length === 1 ? "ativo" : "ativos"}` : " "}
          </h1>
        </div>
        <button type="button" className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Novo paciente</button>
      </header>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" aria-label="Buscar paciente por nome" />
        </div>
        <label className="check">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Incluir arquivados
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {patients && patients.length === 0 ? (
        <Empty action={!q && <button type="button" className="btn ghost" onClick={() => setCreating(true)}>Cadastrar primeiro paciente</button>}>
          {q ? "Nenhum paciente encontrado com esse nome." : "Você ainda não tem pacientes."}
        </Empty>
      ) : (
        <div className="people">
          {patients?.map((p) => {
            const age = ageFrom(p.birthDate);
            return (
              <Link key={p.id} to={`/pacientes/${p.id}`} className="person" style={p.active ? undefined : { opacity: 0.55 }}>
                <Avatar name={p.name} />
                <div className="person-info">
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {[age !== null && `${age} anos`, p.phone, !p.active && "arquivado"].filter(Boolean).join(" · ") || "sem contato"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {creating && (
        <Modal title="Novo paciente" onClose={() => setCreating(false)}>
          <PatientForm
            onCancel={() => setCreating(false)}
            onSaved={(p) => {
              setCreating(false);
              navigate(`/pacientes/${p.id}`);
            }}
          />
        </Modal>
      )}
    </>
  );
}
