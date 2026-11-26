import type {
  AdminPatient, AdminSummary, Availability, BookingRequest, ClientSession, Education, LogEntry, Patient, Perfil,
  Profile, PsychologistCard, Session, Situacao, Status, Summary, User,
} from "./types";

const TOKEN_KEY = "psi_token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event("psi:unauthorized"));
    throw new ApiError(res.status, data?.error ?? "Algo deu errado. Tente novamente.");
  }
  return data as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export interface PatientInput {
  name: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
}

export interface SessionInput {
  patientId: number;
  startsAt: string;
  durationMin: number;
  feeCents: number;
  repeatWeeks: number;
}

export interface SessionPatch {
  startsAt?: string;
  durationMin?: number;
  status?: Status;
  feeCents?: number;
  paid?: boolean;
  note?: string | null;
}

export type RegisterInput =
  | { tipo: "psicologo"; name: string; email: string; password: string; crp: string; areaAtuacao?: string }
  | { tipo: "cliente"; name: string; email: string; password: string; phone?: string };

export interface AdminUserInput {
  perfil: Perfil;
  name: string;
  email: string;
  password: string;
  crp?: string;
  areaAtuacao?: string;
  phone?: string;
}

export interface ProfileInput {
  name: string;
  areaAtuacao: string | null;
  bio: string | null;
  feeCents: number;
  availability: Availability[];
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/login", { email, password }),
  register: (input: RegisterInput) => request<{ token: string; user: User }>("POST", "/auth/register", input),
  me: () => request<{ user: User }>("GET", "/auth/me"),
  summary: () => request<Summary>("GET", "/summary"),
  logs: (limit = 100) => request<{ logs: LogEntry[] }>("GET", `/logs?limit=${limit}`),

  patients: {
    list: (opts: { q?: string; archived?: boolean } = {}) =>
      request<{ patients: Patient[] }>("GET", `/patients${qs({ q: opts.q, archived: opts.archived ? 1 : undefined })}`),
    get: (id: number) => request<{ patient: Patient; sessions: Session[] }>("GET", `/patients/${id}`),
    create: (input: PatientInput) => request<{ patient: Patient }>("POST", "/patients", input),
    update: (id: number, input: Partial<PatientInput> & { active?: boolean }) =>
      request<{ patient: Patient }>("PATCH", `/patients/${id}`, input),
  },

  sessions: {
    list: (opts: { from?: string; to?: string; patientId?: number } = {}) =>
      request<{ sessions: Session[] }>("GET", `/sessions${qs(opts)}`),
    get: (id: number) => request<{ session: Session }>("GET", `/sessions/${id}`),
    create: (input: SessionInput) => request<{ session: Session; created: number }>("POST", "/sessions", input),
    update: (id: number, patch: SessionPatch) => request<{ session: Session }>("PATCH", `/sessions/${id}`, patch),
    remove: (id: number) => request<void>("DELETE", `/sessions/${id}`),
  },

  profile: {
    get: () => request<{ profile: Profile }>("GET", "/profile"),
    save: (input: ProfileInput) => request<{ profile: Profile }>("PUT", "/profile", input),
    addEducation: (e: Omit<Education, "id">) => request<{ profile: Profile }>("POST", "/profile/education", e),
    removeEducation: (id: number) => request<{ profile: Profile }>("DELETE", `/profile/education/${id}`),
  },

  requests: {
    list: (pendingOnly = false) =>
      request<{ requests: BookingRequest[] }>("GET", `/requests${pendingOnly ? "?status=pending" : ""}`),
    decide: (id: number, action: "accept" | "decline", reply?: string) =>
      request<{ request: BookingRequest }>("PATCH", `/requests/${id}`, { action, reply }),
  },

  client: {
    psychologists: (q?: string) => request<{ psychologists: PsychologistCard[] }>("GET", `/client/psychologists${qs({ q })}`),
    psychologist: (id: number) => request<{ profile: Profile; slots: string[] }>("GET", `/client/psychologists/${id}`),
    requests: () => request<{ requests: BookingRequest[] }>("GET", "/client/requests"),
    request: (psychologistId: number, startsAt: string, message?: string) =>
      request<{ request: BookingRequest }>("POST", "/client/requests", { psychologistId, startsAt, message }),
    cancel: (id: number) => request<{ request: BookingRequest }>("PATCH", `/client/requests/${id}`, { action: "cancel" }),
    sessions: () => request<{ sessions: ClientSession[] }>("GET", "/client/sessions"),
  },

  admin: {
    summary: () => request<AdminSummary>("GET", "/admin/summary"),
    users: (f: { q?: string; perfil?: Perfil | ""; situacao?: Situacao | "" } = {}) =>
      request<{ users: User[] }>("GET", `/admin/users${qs(f)}`),
    createUser: (input: AdminUserInput) => request<{ user: User }>("POST", "/admin/users", input),
    updateUser: (id: number, patch: { name?: string; situacao?: Situacao; perfil?: Perfil; crp?: string }) =>
      request<{ user: User }>("PATCH", `/admin/users/${id}`, patch),
    patients: (q?: string) => request<{ patients: AdminPatient[] }>("GET", `/admin/patients${qs({ q })}`),
    createPatient: (input: PatientInput & { psychologistId: number }) =>
      request<{ patient: AdminPatient }>("POST", "/admin/patients", input),
    updatePatient: (id: number, input: Partial<PatientInput> & { linkPsychologistId?: number }) =>
      request<{ patient: AdminPatient }>("PATCH", `/admin/patients/${id}`, input),
    logs: (q?: string) => request<{ logs: LogEntry[] }>("GET", `/admin/logs${qs({ q, limit: 300 })}`),
  },
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente novamente.");
