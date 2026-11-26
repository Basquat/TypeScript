import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { initials } from "../utils";
import Icon, { type IconName } from "./Icon";

/** Anel de progresso (0–1) com gradiente violeta→ciano. */
export function Ring({ value, label, size = 96 }: { value: number | null; label: string; size?: number }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b6cff" />
            <stop offset="100%" stopColor="#2fd9f2" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-grad)" strokeWidth={7}
          strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} style={{ filter: "drop-shadow(0 0 6px rgba(47,217,242,.5))" }} />
      </svg>
      <div className="ring-label">
        <strong>{value === null ? "—" : `${Math.round(v * 100)}%`}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

interface StatProps {
  icon: IconName;
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  to?: string;
}

export function Stat({ icon, label, value, foot, to }: StatProps) {
  const body = (
    <>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon"><Icon name={icon} size={16} /></span>
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </>
  );
  return to ? <Link to={to} className="card stat">{body}</Link> : <div className="card stat">{body}</div>;
}

export const Avatar = ({ name, lg }: { name: string; lg?: boolean }) => (
  <span className={`avatar${lg ? " lg" : ""}`} aria-hidden="true">{initials(name)}</span>
);

export const Pill = ({ kind, children }: { kind: string; children: ReactNode }) => (
  <span className={`pill pill-${kind}`}>{children}</span>
);

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="sparkle" size={22} />
      <p>{children}</p>
      {action}
    </div>
  );
}
