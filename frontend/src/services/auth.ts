import { authService } from './api';
import type { LoginRequest, LoginResponse, Usuario } from '@/types';

const STORAGE_KEYS = {
  TOKEN: 'token',
  USUARIO: 'usuario',
  DEMO_USERS: 'psico_demo_users',
};

function hashSenha(senha: string): string {
  let hash = 0;
  for (let i = 0; i < senha.length; i++) {
    const chr = senha.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return String(Math.abs(hash));
}

function getDemoUsers(): Array<{ id: number; nome: string; email: string; senha: string; perfilNome: string; situacao: Usuario['situacao']; perfilId: number }> {
  const raw = localStorage.getItem(STORAGE_KEYS.DEMO_USERS);
  return raw ? JSON.parse(raw) : [];
}

function saveDemoUsers(users: Array<{ id: number; nome: string; email: string; senha: string; perfilNome: string; situacao: Usuario['situacao']; perfilId: number }>): void {
  localStorage.setItem(STORAGE_KEYS.DEMO_USERS, JSON.stringify(users));
}

function ensureDemoData(): void {
  if (!localStorage.getItem(STORAGE_KEYS.DEMO_USERS)) {
    saveDemoUsers([
      { id: 1, nome: 'Admin Demo', email: 'admin@demo.com', senha: hashSenha('admin123'), perfilNome: 'Administrador', situacao: 'ativo', perfilId: 1 },
      { id: 2, nome: 'Psicólogo Demo', email: 'psicologo@demo.com', senha: hashSenha('psicologo123'), perfilNome: 'Psicólogo', situacao: 'ativo', perfilId: 2 },
      { id: 3, nome: 'Cliente Demo', email: 'cliente@demo.com', senha: hashSenha('cliente123'), perfilNome: 'Cliente', situacao: 'ativo', perfilId: 3 },
    ]);
  }
}

export const auth = {
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  getUsuario(): Usuario | null {
    const data = localStorage.getItem(STORAGE_KEYS.USUARIO);
    return data ? JSON.parse(data) : null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  isAdmin(): boolean {
    const usuario = this.getUsuario();
    return usuario?.perfilNome?.toLowerCase() === 'administrador';
  },

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    ensureDemoData();
    const users = getDemoUsers();
    const user = users.find((u) => u.email === credentials.email && u.senha === hashSenha(credentials.senha));
    if (!user) {
      const response = await authService.login(credentials);
      return response;
    }
    const token = btoa(`${user.id}:${Date.now()}`);
    const usuario: Usuario = { id: user.id, nome: user.nome, email: user.email, perfilNome: user.perfilNome, perfilId: user.perfilId, situacao: user.situacao };
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USUARIO, JSON.stringify(usuario));
    return { token, usuario };
  },

  async cadastrarDemo(dados: { nome: string; email: string; senha: string; perfilNome: string }): Promise<Usuario> {
    ensureDemoData();
    const users = getDemoUsers();
    if (users.some((u) => u.email === dados.email)) {
      throw new Error('E-mail já cadastrado.');
    }
    const perfilId = dados.perfilNome === 'Administrador' ? 1 : dados.perfilNome === 'Psicólogo' ? 2 : 3;
    const newUser = {
      id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
      nome: dados.nome,
      email: dados.email,
      senha: hashSenha(dados.senha),
      perfilNome: dados.perfilNome,
      perfilId,
      situacao: 'ativo' as Usuario['situacao'],
    };
    users.push(newUser);
    saveDemoUsers(users);

    const usuario: Usuario = { id: newUser.id, nome: newUser.nome, email: newUser.email, perfilNome: newUser.perfilNome, perfilId: newUser.perfilId, situacao: newUser.situacao };
    const token = btoa(`${newUser.id}:${Date.now()}`);
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USUARIO, JSON.stringify(usuario));
    return usuario;
  },

  async logout(): Promise<void> {
    try {
      await authService.logout();
    } catch {
      // API pode estar indisponivel em modo demo
    }
  },
};
