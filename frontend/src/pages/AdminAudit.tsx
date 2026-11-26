import { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import Icon from "../components/Icon";
import LogList from "../components/LogList";
import { Empty } from "../components/Ui";
import type { LogEntry } from "../types";

export default function AdminAudit() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api.admin
        .logs(q.trim() || undefined)
        .then((r) => setLogs(r.logs))
        .catch((e) => setError(errorMessage(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">logs_acoes · somente inserção</p>
          <h1 style={{ marginTop: 6 }}>Auditoria</h1>
          <p className="muted">Quem fez o quê e quando. O banco recusa alterar ou apagar registros, inclusive do administrador.</p>
        </div>
      </header>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ação ou autor (ex.: login, Ana)" aria-label="Filtrar auditoria" />
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {logs && logs.length === 0 && <Empty>Nada encontrado.</Empty>}
      {logs && logs.length > 0 && <section className="card"><LogList logs={logs} showAuthor /></section>}
    </>
  );
}
