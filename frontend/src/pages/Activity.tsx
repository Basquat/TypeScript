import { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import LogList from "../components/LogList";
import type { LogEntry } from "../types";

export default function Activity() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .logs()
      .then((r) => setLogs(r.logs))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Atividade</p>
          <h1 style={{ marginTop: 6 }}>Seu histórico</h1>
          <p className="muted">Registro imutável das suas ações. Textos de anotações clínicas nunca aparecem aqui.</p>
        </div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!logs && !error && <p className="muted">Carregando…</p>}
      {logs && <section className="card"><LogList logs={logs} links={user?.perfil === "psicologo"} /></section>}
    </>
  );
}
