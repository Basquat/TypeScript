import { run, type Db } from "./db";

export interface LogEntry {
  usuarioId: number | null;
  acao: string;
  entidade: "usuario" | "paciente" | "sessao" | "solicitacao" | "perfil";
  entidadeId?: number | null;
  /** Nunca inclua conteúdo clínico (anotações) aqui — apenas nomes de campos e metadados. */
  detalhes?: Record<string, unknown>;
}

export async function registrarLog(db: Db, e: LogEntry): Promise<void> {
  await run(db, "INSERT INTO logs_acoes (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, ?, ?, ?)", [
    e.usuarioId,
    e.acao,
    e.entidade,
    e.entidadeId ?? null,
    e.detalhes ? JSON.stringify(e.detalhes) : null,
  ]);
}
