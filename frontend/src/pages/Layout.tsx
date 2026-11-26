import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Icon, { type IconName } from "../components/Icon";
import { Avatar } from "../components/Ui";
import type { Perfil } from "../types";
import { perfilLabel } from "../utils";

const NAV: Record<Perfil, { to: string; label: string; icon: IconName }[]> = {
  psicologo: [
    { to: "/", label: "Hoje", icon: "home" },
    { to: "/agenda", label: "Agenda", icon: "calendar" },
    { to: "/pacientes", label: "Pacientes", icon: "users" },
    { to: "/solicitacoes", label: "Solicitações", icon: "inbox" },
    { to: "/perfil", label: "Perfil profissional", icon: "badge" },
    { to: "/atividade", label: "Atividade", icon: "activity" },
  ],
  admin: [
    { to: "/", label: "Visão geral", icon: "grid" },
    { to: "/usuarios", label: "Usuários", icon: "users" },
    { to: "/pacientes", label: "Pacientes", icon: "heart" },
    { to: "/auditoria", label: "Auditoria", icon: "shield" },
  ],
  cliente: [
    { to: "/", label: "Encontrar psicólogo", icon: "search" },
    { to: "/consultas", label: "Minhas consultas", icon: "calendar" },
    { to: "/atividade", label: "Atividade", icon: "activity" },
  ],
};

export const BrandMark = () => (
  <span className="brand-mark" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M12 3v18M5 8c0 4 3 6 7 6s7-2 7-6" />
    </svg>
  </span>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [pending, setPending] = useState(0);

  // Contador de solicitações pendentes no menu do psicólogo (atualiza ao navegar).
  useEffect(() => {
    if (user?.perfil !== "psicologo") return;
    api.requests.list(true).then((r) => setPending(r.requests.length)).catch(() => undefined);
  }, [user, pathname]);

  if (!user) return null;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            PsicoGest
            <small>{perfilLabel[user.perfil]}</small>
          </div>
        </div>
        <nav className="nav" aria-label="Principal">
          {NAV[user.perfil].map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <Icon name={n.icon} />
              <span className="label">{n.label}</span>
              {n.to === "/solicitacoes" && pending > 0 && <span className="badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <Avatar name={user.name} />
          <div className="me-info">
            <strong>{user.name}</strong>
            <span>{user.crp ? `CRP ${user.crp}` : user.email}</span>
          </div>
          <button type="button" className="btn ghost icon" onClick={logout} aria-label="Sair" title="Sair">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
