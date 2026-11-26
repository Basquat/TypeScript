export type Status = "scheduled" | "done" | "canceled" | "missed";
export type Perfil = "admin" | "psicologo" | "cliente";
export type Situacao = "ativo" | "inativo" | "bloqueado";
export type RequestStatus = "pending" | "accepted" | "declined" | "canceled";

export interface User {
  id: number;
  name: string;
  email: string;
  crp: string | null;
  areaAtuacao: string | null;
  psicologoId: number | null;
  perfil: Perfil;
  situacao: Situacao;
  createdAt: string;
}

export interface Patient {
  id: number;
  name: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: string;
}

export interface AdminPatient extends Patient {
  hasAccount: boolean;
  psychologists: string | null;
}

export interface Session {
  id: number;
  patientId: number;
  patientName: string;
  startsAt: string;
  durationMin: number;
  status: Status;
  feeCents: number;
  paid: boolean;
  hasNote: boolean;
  note?: string;
}

export interface ClientSession {
  id: number;
  startsAt: string;
  durationMin: number;
  status: Status;
  feeCents: number;
  paid: boolean;
  psychologistName: string;
}

export interface Summary {
  activePatients: number;
  unpaidCount: number;
  unpaidCents: number;
  weekSessions: number;
  attendanceRate: number | null;
  monthReceivedCents: number;
  pendingRequests: number;
}

export interface AdminSummary {
  users: number;
  psychologists: number;
  patients: number;
  sessionsUpcoming: number;
  pendingRequests: number;
  byStatus: Record<Situacao, number>;
  byRole: Record<Perfil, number>;
}

export interface LogEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  author?: string | null;
  authorEmail?: string | null;
}

export interface Availability {
  weekday: number;
  start: string;
  end: string;
}

export interface Education {
  id: number;
  kind: "certificado" | "curso";
  title: string;
  institution: string | null;
  year: number | null;
}

export interface Profile {
  id: number;
  name: string;
  active: boolean;
  crp: string;
  areaAtuacao: string | null;
  bio: string | null;
  feeCents: number;
  availability: Availability[];
  education: Education[];
}

export interface PsychologistCard {
  id: number;
  name: string;
  crp: string;
  areaAtuacao: string | null;
  bio: string | null;
  feeCents: number;
  hasAvailability: boolean;
}

export interface BookingRequest {
  id: number;
  clientName: string;
  clientEmail: string;
  psychologistId: number;
  psychologistName: string;
  startsAt: string;
  durationMin: number;
  message: string | null;
  status: RequestStatus;
  reply: string | null;
  sessionId: number | null;
  createdAt: string;
}
