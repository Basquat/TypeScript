import { renderLogin } from '@/pages/Login';
import { renderAdminDashboard } from '@/pages/AdminDashboard';
import { renderPsychologistDashboard } from '@/pages/PsychologistDashboard';
import { renderHomePage } from '@/pages/HomePage';
import type { Usuario } from '@/types';

function init(): void {
  const logoutFlag = sessionStorage.getItem('psico_logout');
  if (logoutFlag) {
    sessionStorage.removeItem('psico_logout');
    renderLogin();
    return;
  }

  const stored = localStorage.getItem('psico_demo_session');
  if (stored) {
    const usuario = JSON.parse(stored) as Usuario;
    const perfil = usuario.perfilNome?.toLowerCase() || '';
    if (perfil === 'administrador') {
      renderAdminDashboard(usuario);
    } else if (perfil === 'psicólogo' || perfil === 'psicologo') {
      renderPsychologistDashboard(usuario);
    } else if (perfil === 'cliente') {
      renderHomePage();
    } else {
      renderLogin();
    }
  } else {
    const usuarioDemo: Usuario = {
      id: 1,
      nome: 'Admin Demo',
      email: 'admin@demo.com',
      perfilNome: 'Administrador',
      perfilId: 1,
      situacao: 'ativo',
    };
    localStorage.setItem('psico_demo_session', JSON.stringify(usuarioDemo));
    renderAdminDashboard(usuarioDemo);
  }
}

init();
