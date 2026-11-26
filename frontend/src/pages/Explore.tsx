import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import { Avatar, Empty, Pill } from "../components/Ui";
import type { PsychologistCard } from "../types";
import { money } from "../utils";

export default function Explore() {
  const { user } = useAuth();
  const [list, setList] = useState<PsychologistCard[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api.client
        .psychologists(q.trim() || undefined)
        .then((r) => setList(r.psychologists))
        .catch((e) => setError(errorMessage(e)));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Olá, {user?.name.split(" ")[0]}</p>
          <h1 style={{ marginTop: 6 }}>Encontre o profissional <span className="grad-text">certo para você</span></h1>
          <p className="muted">Escolha um horário livre e o psicólogo confirma o atendimento.</p>
        </div>
      </header>

      <div className="toolbar">
        <div className="search" style={{ maxWidth: 520 }}>
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou área (ex.: clínica, neuro…)" aria-label="Buscar psicólogo" />
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {list && list.length === 0 && <Empty>Nenhum psicólogo encontrado.</Empty>}

      <div className="grid grid-3">
        {list?.map((p) => (
          <Link key={p.id} to={`/psicologos/${p.id}`} className="card person" style={{ flexDirection: "column", alignItems: "stretch", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar name={p.name} lg />
              <div className="person-info">
                <strong style={{ fontSize: "1.05rem" }}>{p.name}</strong>
                <span className="muted small">{p.areaAtuacao ?? "Psicologia"}</span>
                <span className="faint small">CRP {p.crp}</span>
              </div>
            </div>
            <p className="muted small" style={{ minHeight: 40 }}>{p.bio ? (p.bio.length > 120 ? `${p.bio.slice(0, 120)}…` : p.bio) : "Sem apresentação."}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="num">{p.feeCents ? money(p.feeCents) : "A combinar"}</span>
              {p.hasAvailability ? <Pill kind="done">Agenda aberta</Pill> : <Pill kind="canceled">Sem horários</Pill>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
