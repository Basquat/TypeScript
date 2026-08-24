export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfilId: number;
  perfilNome?: string;
  situacao: 'ativo' | 'inativo' | 'bloqueado';
  createdAt?: string;
}

export interface Perfil {
  id: number;
  nome: string;
  descricao?: string;
}

export interface Psicologo {
  id: number;
  usuarioId: number;
  nome: string;
  crm?: string;
  areaAtuacao?: string;
  telefone?: string;
  email?: string;
  situacao: 'ativo' | 'inativo';
  bio?: string;
  valorSessao?: number;
  aprovado?: boolean;
  avaliacao?: number;
  quantidadeSessoes?: number;
}

export interface ClientePaciente {
  id: number;
  nome: string;
  dataNascimento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  psicologoId?: number;
  psicologoNome?: string;
  situacao: 'ativo' | 'inativo';
  createdAt?: string;
}

export interface Vinculo {
  id: number;
  psicologoId: number;
  clienteId: number;
  dataVinculo: string;
}

export interface LogAcao {
  id: number;
  usuarioId: number;
  usuarioNome?: string;
  acao: string;
  entidade: string;
  entidadeId?: number;
  dataHora: string;
}

export interface Certificado {
  id: number;
  psicologoId: number;
  titulo: string;
  instituicao: string;
  dataEmissao?: string;
  descricao?: string;
}

export interface Curso {
  id: number;
  psicologoId: number;
  nome: string;
  instituicao: string;
  cargaHoraria?: number;
  dataConclusao?: string;
}

export interface HorarioDisponivel {
  id: number;
  psicologoId: number;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  duracaoMinutos: number;
}

export interface Agendamento {
  id: number;
  psicologoId: number;
  clienteId: number;
  psicologoNome?: string;
  clienteNome?: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: 'unico' | 'semanal';
  situacao: 'pendente' | 'confirmado' | 'recusado' | 'cancelado';
  dataCriacao: string;
  dataAtualizacao: string;
}

export interface PerfilPsicologo {
  bio?: string;
  certificados: Certificado[];
  cursos: Curso[];
  horarios: HorarioDisponivel[];
  valorSessao?: number;
  aprovado: boolean;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface ApiError {
  message: string;
  statusCode: number;
}
