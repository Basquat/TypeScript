import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, type AdminUserInput } from "../api";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import { Avatar, Empty, Pill } from "../components/Ui";
import type { Perfil, Situacao, User } from "../types";
import { formatDateTime, perfilLabel, situacaoLabel } from "../utils";

const PERFIS: Perfil[] = ["admin", "psicologo", "cliente"];
const SITUACOES: Situacao[] = ["ativo", "inativo", "bloqueado"];

function UserForm({ initial, onSaved, onCancel }: { initial?: User; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState<AdminUserInput>({
    perfil: initial?.perfil ?? "psicologo", name: initial?.name ?? "", email: initial?.email ?? "", password: "",
    crp: "", areaAtuacao: "", phone: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof AdminUserInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  // CRP só é pedido quando o usuário passa a ser psicólogo sem cadastro profissional.
  const needsCrp = f.perfil === "psicologo" && (!initial || initial.psicologoId === null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (initial) {
        await api.admin.updateUser(initial.id, {
          name: f.name,
          ...(f.perfil !== initial.perfil ? { perfil: f.perfil } : {}),
          ...(needsCrp ? { crp: f.crp } : {}),
        });
      } else {
        await api.admin.createUser({
          perfil: f.perfil, name: f.name, email: f.email, password: f.password,
          ...(f.perfil === "psicologo" ? { crp: f.crp, areaAtuacao: f.areaAtuacao || undefined } : {}),
          ...(f.perfil === "cliente" && f.phone ? { phone: f.phone } : {}),
        });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <fieldset>
        <legend>Perfil de acesso</legend>
        <div className="segmented" role="radiogroup">
          {PERFIS.map((p) => (
            <label key={p} className={f.perfil === p ? "on" : undefined}>
              <input type="radio" name="perfil" checked={f.perfil === p} onChange={() => setF({ ...f, perfil: p })} />
              {perfilLabel[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <label>Nome completo<input value={f.name} onChange={set("name")} required /></label>
      {!initial && (
        <div className="row">
          <label>E-mail<input type="email" value={f.email} onChange={set("email")} required /></label>
          <label>Senha inicial<input type="password" value={f.password} onChange={set("password")} required minLength={8} autoComplete="new-password" /></label>
        </div>
      )}
      {needsCrp && (
        <div className="row">
          <label>CRP<input value={f.crp} onChange={set("crp")} placeholder="03/12345" required /></label>
          {!initial && <label>Área de atuação<input value={f.areaAtuacao} onChange={set("areaAtuacao")} /></label>}
        </div>
      )}
      {!initial && f.perfil === "cliente" && <label>Telefone<input type="tel" value={f.phone} onChange={set("phone")} /></label>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? "Salvando…" : initial ? "Salvar" : "Cadastrar usuário"}</button>
      </div>
    </form>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [q, setQ] = useState("");
  const [perfil, setPerfil] = useState<Perfil | "">("");
  const [situacao, setSituacao] = useState<Situacao | "">("");
  const [modal, setModal] = useState<User | "new" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.admin
      .users({ q: q.trim() || undefined, perfil, situacao })
      .then((r) => setUsers(r.users))
      .catch((e) => setError(errorMessage(e)));
  }, [q, perfil, situacao]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function setStatus(u: User, s: Situacao) {
    setError("");
    try {
      await api.admin.updateUser(u.id, { situacao: s });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Controle de acesso</p>
          <h1 style={{ marginTop: 6 }}>Usuários</h1>
          <p className="muted">Ative, bloqueie ou libere contas e defina o perfil. Ninguém altera o próprio acesso.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setModal("new")}><Icon name="plus" size={16} /> Novo usuário</button>
      </header>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou e-mail" aria-label="Buscar usuário" />
        </div>
        <select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil | "")} aria-label="Filtrar por perfil">
          <option value="">Todos os perfis</option>
          {PERFIS.map((p) => <option key={p} value={p}>{perfilLabel[p]}</option>)}
        </select>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao | "")} aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          {SITUACOES.map((s) => <option key={s} value={s}>{situacaoLabel[s]}</option>)}
        </select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {users && users.length === 0 && <Empty>Nenhum usuário com esses filtros.</Empty>}

      {users && users.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Usuário</th><th>Perfil</th><th>Situação</th><th>Criado em</th><th /></tr></thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={u.name} />
                        <div><strong>{u.name}{self && <span className="faint small"> (você)</span>}</strong><span className="muted small">{u.email}{u.crp && ` · CRP ${u.crp}`}</span></div>
                      </div>
                    </td>
                    <td><Pill kind={u.perfil}>{perfilLabel[u.perfil]}</Pill></td>
                    <td><Pill kind={u.situacao}>{situacaoLabel[u.situacao]}</Pill></td>
                    <td className="num muted small">{formatDateTime(u.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        {!self && u.situacao !== "ativo" && <button type="button" className="btn sm ok" onClick={() => setStatus(u, "ativo")}>Liberar</button>}
                        {!self && u.situacao !== "bloqueado" && <button type="button" className="btn sm danger" onClick={() => setStatus(u, "bloqueado")}>Bloquear</button>}
                        {!self && u.situacao === "ativo" && <button type="button" className="btn sm ghost" onClick={() => setStatus(u, "inativo")}>Inativar</button>}
                        <button type="button" className="btn sm ghost icon" onClick={() => setModal(u)} aria-label={`Editar ${u.name}`}><Icon name="edit" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Novo usuário" : `Editar ${modal.name}`} onClose={() => setModal(null)}>
          <UserForm initial={modal === "new" ? undefined : modal} onCancel={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
        </Modal>
      )}
    </>
  );
}
