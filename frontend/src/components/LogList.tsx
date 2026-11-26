import { Link } from "react-router-dom";
import type { LogEntry } from "../types";
import { formatDateTime } from "../utils";
import Icon, { type IconName } from "./Icon";

const ACTION_LABEL: Record<string, string> = {
  cadastro: "Conta criada",
  login: "Login realizado",
  login_falhou: "Tentativa de login com senha incorreta",
  usuario_criado: "Usuário cadastrado pelo administrador",
  usuario_atualizado: "Usuário alterado pelo administrador",
  paciente_criado: "Paciente cadastrado",
  paciente_editado: "Dados do paciente alterados",
  paciente_arquivado: "Paciente arquivado (vínculo encerrado)",
  paciente_reativado: "Paciente reativado (vínculo reaberto)",
  vinculo_criado: "Paciente vinculado a um psicólogo",
  sessao_agendada: "Sessão agendada",
  sessao_atualizada: "Sessão atualizada",
  sessao_excluida: "Sessão excluída",
  anotacao_lida: "Anotação de sessão aberta",
  perfil_atualizado: "Perfil profissional atualizado",
  solicitacao_criada: "Horário solicitado",
  solicitacao_aceita: "Solicitação confirmada",
  solicitacao_recusada: "Solicitação recusada",
  solicitacao_cancelada: "Solicitação cancelada pelo cliente",
};

const ENTITY_ICON: Record<string, IconName> = {
  usuario: "user", paciente: "heart", sessao: "calendar", solicitacao: "inbox", perfil: "badge",
};

/** `links`: só o psicólogo tem telas de paciente/sessão para abrir. */
export default function LogList({ logs, showAuthor, links }: { logs: LogEntry[]; showAuthor?: boolean; links?: boolean }) {
  const target = (l: LogEntry) => {
    if (!links || l.entityId === null) return null;
    if (l.entity === "paciente") return <Link to={`/pacientes/${l.entityId}`}>ver paciente</Link>;
    if (l.entity === "sessao" && l.action !== "sessao_excluida") return <Link to={`/sessoes/${l.entityId}`}>ver sessão</Link>;
    return null;
  };
  return (
    <ul className="log-list">
      {logs.map((l) => (
        <li key={l.id} className="log-row">
          <span className="log-dot" style={l.action === "login_falhou" ? { color: "var(--danger)" } : undefined}>
            <Icon name={ENTITY_ICON[l.entity] ?? "activity"} size={14} />
          </span>
          <div className="log-body">
            <span>{ACTION_LABEL[l.action] ?? l.action}</span>
            <span className="log-meta">
              <span className="num">{formatDateTime(l.createdAt)}</span>
              {showAuthor && <span>por {l.author ?? "sistema"}</span>}
              {l.entityId !== null && <span>#{l.entity} {l.entityId}</span>}
              {target(l)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
