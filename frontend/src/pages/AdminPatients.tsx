import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import PatientForm from "../components/PatientForm";
import { Avatar, Empty, Pill } from "../components/Ui";
import type { AdminPatient } from "../types";
import { ageFrom } from "../utils";

export default function AdminPatients() {
  const [patients, setPatients] = useState<AdminPatient[] | null>(null);
  const [psychologists, setPsychologists] = useState<{ id: number; name: string }[]>([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<AdminPatient | "new" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.admin
      .patients(q.trim() || undefined)
      .then((r) => setPatients(r.patients))
      .catch((e) => setError(errorMessage(e)));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.admin
      .users({ perfil: "psicologo", situacao: "ativo" })
      .then((r) => setPsychologists(r.users.filter((u) => u.psicologoId).map((u) => ({ id: u.psicologoId!, name: u.name }))))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Cadastros</p>
          <h1 style={{ marginTop: 6 }}>Clientes e pacientes</h1>
          <p className="muted">O administrador cadastra e vincula pacientes a psicólogos. Prontuários continuam restritos ao psicólogo.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setModal("new")} disabled={!psychologists.length}>
          <Icon name="plus" size={16} /> Novo paciente
        </button>
      </header>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" aria-label="Buscar paciente" />
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {patients && patients.length === 0 && <Empty>Nenhum paciente encontrado.</Empty>}

      {patients && patients.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Paciente</th><th>Contato</th><th>Psicólogo(s)</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {patients.map((p) => {
                const age = ageFrom(p.birthDate);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={p.name} />
                        <div><strong>{p.name}</strong><span className="muted small">{age !== null ? `${age} anos` : "—"}{p.hasAccount && " · conta de cliente"}</span></div>
                      </div>
                    </td>
                    <td className="small">{[p.phone, p.email].filter(Boolean).join(" · ") || <span className="faint">—</span>}</td>
                    <td className="small">{p.psychologists ?? <span className="faint">sem vínculo ativo</span>}</td>
                    <td>{p.active ? <Pill kind="ativo">Ativo</Pill> : <Pill kind="inativo">Sem vínculo</Pill>}</td>
                    <td className="row-actions">
                      <button type="button" className="btn sm ghost" onClick={() => setModal(p)}><Icon name="link" size={14} /> Editar / vincular</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Novo paciente" : `Editar ${modal.name}`} onClose={() => setModal(null)}>
          <PatientForm<AdminPatient>
            initial={modal === "new" ? undefined : modal}
            psychologists={psychologists}
            onCancel={() => setModal(null)}
            onSaved={() => { setModal(null); load(); }}
          />
        </Modal>
      )}
    </>
  );
}
