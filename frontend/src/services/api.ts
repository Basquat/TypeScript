import axios from 'axios';
import type { LoginRequest, LoginResponse, Usuario, Psicologo, ClientePaciente, LogAcao, Certificado, Curso, HorarioDisponivel, Agendamento } from '@/types';

const API_URL = (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/api/auth/login', credentials);
    return data;
  },

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  },
};

export const userService = {
  async listarUsuarios(): Promise<Usuario[]> {
    const { data } = await api.get<Usuario[]>('/api/users');
    return data;
  },

  async cadastrarUsuario(usuario: Partial<Usuario> & { senha: string }): Promise<Usuario> {
    const { data } = await api.post<Usuario>('/api/users', usuario);
    return data;
  },

  async atualizarUsuario(id: number, usuario: Partial<Usuario>): Promise<Usuario> {
    const { data } = await api.patch<Usuario>(`/api/users/${id}`, usuario);
    return data;
  },
};

export const psychologistService = {
  async listarPsicologos(): Promise<Psicologo[]> {
    const { data } = await api.get<Psicologo[]>('/api/psychologists');
    return data;
  },

  async cadastrarPsicologo(psicologo: Partial<Psicologo>): Promise<Psicologo> {
    const { data } = await api.post<Psicologo>('/api/psychologists', psicologo);
    return data;
  },

  async atualizarPerfil(psicologoId: number, perfil: Partial<Psicologo>): Promise<Psicologo> {
    const { data } = await api.patch<Psicologo>(`/api/psychologists/${psicologoId}/perfil`, perfil);
    return data;
  },

  async aprovarPsicologo(id: number, aprovado: boolean): Promise<Psicologo> {
    const { data } = await api.patch<Psicologo>(`/api/psychologists/${id}/aprovar`, { aprovado });
    return data;
  },
};

export const patientService = {
  async listarPacientes(): Promise<ClientePaciente[]> {
    const { data } = await api.get<ClientePaciente[]>('/api/patients');
    return data;
  },

  async buscarPaciente(id: number): Promise<ClientePaciente> {
    const { data } = await api.get<ClientePaciente>(`/api/patients/${id}`);
    return data;
  },

  async cadastrarPaciente(paciente: Partial<ClientePaciente>): Promise<ClientePaciente> {
    const { data } = await api.post<ClientePaciente>('/api/patients', paciente);
    return data;
  },

  async atualizarPaciente(id: number, paciente: Partial<ClientePaciente>): Promise<ClientePaciente> {
    const { data } = await api.patch<ClientePaciente>(`/api/patients/${id}`, paciente);
    return data;
  },
};

export const certificateService = {
  async listar(psicologoId: number): Promise<Certificado[]> {
    const { data } = await api.get<Certificado[]>(`/api/psychologists/${psicologoId}/certificates`);
    return data;
  },

  async cadastrar(psicologoId: number, certificado: Partial<Certificado>): Promise<Certificado> {
    const { data } = await api.post<Certificado>(`/api/psychologists/${psicologoId}/certificates`, certificado);
    return data;
  },

  async remover(psicologoId: number, certificadoId: number): Promise<void> {
    await api.delete(`/api/psychologists/${psicologoId}/certificates/${certificadoId}`);
  },
};

export const courseService = {
  async listar(psicologoId: number): Promise<Curso[]> {
    const { data } = await api.get<Curso[]>(`/api/psychologists/${psicologoId}/courses`);
    return data;
  },

  async cadastrar(psicologoId: number, curso: Partial<Curso>): Promise<Curso> {
    const { data } = await api.post<Curso>(`/api/psychologists/${psicologoId}/courses`, curso);
    return data;
  },

  async remover(psicologoId: number, cursoId: number): Promise<void> {
    await api.delete(`/api/psychologists/${psicologoId}/courses/${cursoId}`);
  },
};

export const scheduleService = {
  async listar(psicologoId: number): Promise<HorarioDisponivel[]> {
    const { data } = await api.get<HorarioDisponivel[]>(`/api/psychologists/${psicologoId}/schedule`);
    return data;
  },

  async cadastrar(psicologoId: number, horario: Partial<HorarioDisponivel>): Promise<HorarioDisponivel> {
    const { data } = await api.post<HorarioDisponivel>(`/api/psychologists/${psicologoId}/schedule`, horario);
    return data;
  },

  async remover(psicologoId: number, horarioId: number): Promise<void> {
    await api.delete(`/api/psychologists/${psicologoId}/schedule/${horarioId}`);
  },
};

export const appointmentService = {
  async listarPorPsicologo(psicologoId: number): Promise<Agendamento[]> {
    const { data } = await api.get<Agendamento[]>(`/api/appointments/psychologist/${psicologoId}`);
    return data;
  },

  async listarPorCliente(clienteId: number): Promise<Agendamento[]> {
    const { data } = await api.get<Agendamento[]>(`/api/appointments/client/${clienteId}`);
    return data;
  },

  async cadastrar(agendamento: Partial<Agendamento>): Promise<Agendamento> {
    const { data } = await api.post<Agendamento>('/api/appointments', agendamento);
    return data;
  },

  async atualizarStatus(id: number, situacao: Agendamento['situacao']): Promise<Agendamento> {
    const { data } = await api.patch<Agendamento>(`/api/appointments/${id}/status`, { situacao });
    return data;
  },
};

export const auditService = {
  async listarLogs(): Promise<LogAcao[]> {
    const { data } = await api.get<LogAcao[]>('/api/audit-logs');
    return data;
  },
};
