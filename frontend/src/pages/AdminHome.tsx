import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import LogList from "../components/LogList";
import { Ring, Stat } from "../components/Ui";
import type { AdminSummary, LogEntry, Perfil, Situacao } from "../types";
import { perfilLabel, situacaoLabel } from "../utils";

function Bars<K extends string>({ data, labels }: { data: Record<K, number>; labels: Record<K, string> }) {
  const max = Math.max(1, ...Object.values<number>(data));
  return (
    <div className="bars">
      {(Object.keys(data) as K[]).map((k) => (
        <div key={k} className="bar-row">
          <span className="muted">{labels[k]}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(data[k] / max) * 100}%` }} /></div>
          <span className="num" style={{ textAlign: "right" }}>{data[k]}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminHome() {
  const [s, setS] = useState<AdminSummary | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.admin.summary(), api.admin.logs()])
      .then(([sum, l]) => {
        setS(sum);
        setLogs(l.logs.slice(0, 8));
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Painel administrativo</p>
          <h1 style={{ marginTop: 6 }}>Visão geral da <span className="grad-text">plataforma</span></h1>
        </div>
        <Link to="/usuarios" className="btn primary">Gerenciar acessos</Link>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      {s && (
        <>
          <section className="stats">
            <Stat icon="users" label="Usuários" value={s.users} to="/usuarios" />
            <Stat icon="badge" label="Psicólogos" value={s.psychologists} />
            <Stat icon="heart" label="Clientes / pacientes" value={s.patients} to="/pacientes" />
            <Stat icon="calendar" label="Sessões futuras" value={s.sessionsUpcoming} />
            <Stat icon="inbox" label="Pedidos pendentes" value={s.pendingRequests} />
          </section>

          <div className="grid grid-3">
            <section className="card" style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <Ring value={s.users ? s.byStatus.ativo / s.users : null} label="ativos" size={110} />
              <div>
                <h3>Contas ativas</h3>
                <p className="muted small">{s.byStatus.bloqueado} bloqueadas · {s.byStatus.inativo} inativas</p>
              </div>
            </section>
            <section className="card">
              <div className="card-head"><h2>Por situação</h2></div>
              <Bars<Situacao> data={s.byStatus} labels={situacaoLabel} />
            </section>
            <section className="card">
              <div className="card-head"><h2>Por perfil</h2></div>
              <Bars<Perfil> data={s.byRole} labels={perfilLabel} />
            </section>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Atividade recente</h2>
              <Link to="/auditoria" className="small">ver auditoria completa</Link>
            </div>
            <LogList logs={logs} showAuthor />
          </section>
        </>
      )}
    </>
  );
}
