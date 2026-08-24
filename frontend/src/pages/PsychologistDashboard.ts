import { auth } from '@/services/auth';
import { psychologistService, certificateService, courseService, scheduleService, appointmentService } from '@/services/api';
import type { Usuario, Psicologo, Certificado, Curso, HorarioDisponivel, Agendamento } from '@/types';

function getDemoPsychologists(): Psicologo[] {
  const raw = localStorage.getItem('psico_demo_psychologists');
  if (!raw) return [];
  return JSON.parse(raw);
}

function getDemoCertificates(): Certificado[] {
  const raw = localStorage.getItem('psico_demo_certificates');
  if (!raw) return [];
  return JSON.parse(raw);
}

function saveDemoCertificates(certificates: Certificado[]): void {
  localStorage.setItem('psico_demo_certificates', JSON.stringify(certificates));
}

function getDemoCourses(): Curso[] {
  const raw = localStorage.getItem('psico_demo_courses');
  if (!raw) return [];
  return JSON.parse(raw);
}

function saveDemoCourses(courses: Curso[]): void {
  localStorage.setItem('psico_demo_courses', JSON.stringify(courses));
}

function getDemoSchedule(): HorarioDisponivel[] {
  const raw = localStorage.getItem('psico_demo_schedule');
  if (!raw) return [];
  return JSON.parse(raw);
}

function saveDemoSchedule(schedule: HorarioDisponivel[]): void {
  localStorage.setItem('psico_demo_schedule', JSON.stringify(schedule));
}

function getDemoAppointments(): Agendamento[] {
  const raw = localStorage.getItem('psico_demo_appointments');
  if (!raw) return [];
  return JSON.parse(raw);
}

function saveDemoAppointments(appointments: Agendamento[]): void {
  localStorage.setItem('psico_demo_appointments', JSON.stringify(appointments));
}

function ensureDemoData(): void {
  if (!localStorage.getItem('psico_demo_certificates')) {
    saveDemoCertificates([
      { id: 1, psicologoId: 2, titulo: 'Especializacao em TCC', instituicao: 'Universidade XYZ', dataEmissao: '2022-06-15', descricao: 'Curso de 360h em Terapia Cognitivo-Comportamental' },
    ]);
  }
  if (!localStorage.getItem('psico_demo_courses')) {
    saveDemoCourses([
      { id: 1, psicologoId: 2, nome: 'Psicologia Positiva', instituicao: 'Instituto ABC', cargaHoraria: 40, dataConclusao: '2023-03-10' },
    ]);
  }
  if (!localStorage.getItem('psico_demo_schedule')) {
    saveDemoSchedule([
      { id: 1, psicologoId: 2, diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', duracaoMinutos: 60 },
      { id: 2, psicologoId: 2, diaSemana: 3, horaInicio: '14:00', horaFim: '18:00', duracaoMinutos: 60 },
    ]);
  }
}

export async function renderPsychologistDashboard(usuario: Usuario): Promise<void> {
  ensureDemoData();
  document.getElementById('page-login')!.style.display = 'none';
  document.getElementById('page-admin')!.style.display = 'none';
  const psychologistPage = document.getElementById('page-psychologist')!;
  psychologistPage.style.display = 'block';

  const navbar = document.getElementById('navbar') as HTMLElement;
  navbar.style.display = 'flex';
  document.getElementById('nav-user-name')!.textContent = `${usuario.nome} (Psicologo)`;

  const logoutBtn = document.getElementById('nav-logout')!;
  logoutBtn.onclick = async () => {
    await auth.logout();
    localStorage.removeItem('psico_demo_session');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    sessionStorage.setItem('psico_logout', '1');
    location.reload();
  };

  psychologistPage.innerHTML = `
    <div class="container">
      <h1 class="section-title">Painel do Psicologo</h1>

      <div class="header-actions">
        <h2 class="section-title" style="margin-bottom: 0;">Meu Perfil Profissional</h2>
        <button id="btn-editar-perfil" class="btn btn-primary">Editar Perfil</button>
      </div>

      <div id="perfil-container" class="table-container" style="margin-bottom: 2rem;">
        <p style="padding: 1rem; color: var(--gray-500);">Carregando perfil...</p>
      </div>

      <div class="header-actions">
        <h2 class="section-title" style="margin-bottom: 0;">Solicitacoes de Agendamento</h2>
      </div>

      <div id="agendamentos-container" class="table-container" style="margin-bottom: 2rem;">
        <p style="padding: 1rem; color: var(--gray-500);">Carregando agendamentos...</p>
      </div>

      <div class="header-actions">
        <h2 class="section-title" style="margin-bottom: 0;">Calendario</h2>
      </div>

      <div id="calendario-container" class="table-container">
        <p style="padding: 1rem; color: var(--gray-500);">Carregando calendario...</p>
      </div>
    </div>
  `;

  document.getElementById('btn-editar-perfil')!.addEventListener('click', () => {
    openPerfilModal(usuario);
  });

  await carregarPerfil(usuario);
  await carregarAgendamentos(usuario);
  await carregarCalendario(usuario);
}

async function carregarPerfil(usuario: Usuario): Promise<void> {
  const container = document.getElementById('perfil-container')!;
  try {
    const psicologos = await psychologistService.listarPsicologos();
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (!psicologo) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--gray-500);">Perfil profissional nao configurado.</p>';
      return;
    }

    const [certificados, cursos, horarios] = await Promise.all([
      certificateService.listar(psicologo.id),
      courseService.listar(psicologo.id),
      scheduleService.listar(psicologo.id),
    ]);

    const diasSemana = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

    container.innerHTML = `
      <table>
        <tbody>
          <tr><th>Nome</th><td>${psicologo.nome}</td></tr>
          <tr><th>CRM</th><td>${psicologo.crm || '-'}</td></tr>
          <tr><th>Area de Atuacao</th><td>${psicologo.areaAtuacao || '-'}</td></tr>
          <tr><th>Telefone</th><td>${psicologo.telefone || '-'}</td></tr>
          <tr><th>E-mail</th><td>${psicologo.email || '-'}</td></tr>
          <tr><th>Bio</th><td>${psicologo.bio || '-'}</td></tr>
          <tr><th>Valor da Sessao</th><td>${psicologo.valorSessao ? `R$ ${psicologo.valorSessao.toFixed(2)}` : '-'}</td></tr>
          <tr><th>Situacao</th><td><span class="badge badge-${psicologo.aprovado ? 'success' : 'warning'}">${psicologo.aprovado ? 'Aprovado' : 'Aguardando aprovacao'}</span></td></tr>
        </tbody>
      </table>

      <div style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Certificados</h3>
        ${certificados.length === 0 ? '<p style="color: var(--gray-500); font-size: 0.875rem;">Nenhum certificado cadastrado.</p>' : ''}
        <ul style="margin-left: 1.25rem; margin-bottom: 1rem;">
          ${certificados.map((c) => `<li style="margin-bottom: 0.25rem;"><strong>${c.titulo}</strong> - ${c.instituicao} (${c.dataEmissao || 'Sem data'})</li>`).join('')}
        </ul>
      </div>

      <div style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Cursos</h3>
        ${cursos.length === 0 ? '<p style="color: var(--gray-500); font-size: 0.875rem;">Nenhum curso cadastrado.</p>' : ''}
        <ul style="margin-left: 1.25rem; margin-bottom: 1rem;">
          ${cursos.map((c) => `<li style="margin-bottom: 0.25rem;"><strong>${c.nome}</strong> - ${c.instituicao} (${c.cargaHoraria || 0}h) ${c.dataConclusao ? `- ${c.dataConclusao}` : ''}</li>`).join('')}
        </ul>
      </div>

      <div style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Horarios Disponiveis</h3>
        ${horarios.length === 0 ? '<p style="color: var(--gray-500); font-size: 0.875rem;">Nenhum horario cadastrado.</p>' : ''}
        <ul style="margin-left: 1.25rem;">
          ${horarios.map((h) => `<li style="margin-bottom: 0.25rem;">${diasSemana[h.diaSemana] || 'Dia ' + h.diaSemana}: ${h.horaInicio} as ${h.horaFim} (${h.duracaoMinutos} min)</li>`).join('')}
        </ul>
      </div>
    `;
  } catch {
    const psicologos = getDemoPsychologists();
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (!psicologo) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--gray-500);">Perfil profissional nao configurado.</p>';
      return;
    }

    const certificados = getDemoCertificates().filter((c) => c.psicologoId === psicologo.id);
    const cursos = getDemoCourses().filter((c) => c.psicologoId === psicologo.id);
    const horarios = getDemoSchedule().filter((h) => h.psicologoId === psicologo.id);
    const diasSemana = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

    container.innerHTML = `
      <table>
        <tbody>
          <tr><th>Nome</th><td>${psicologo.nome}</td></tr>
          <tr><th>CRM</th><td>${psicologo.crm || '-'}</td></tr>
          <tr><th>Area de Atuacao</th><td>${psicologo.areaAtuacao || '-'}</td></tr>
          <tr><th>Telefone</th><td>${psicologo.telefone || '-'}</td></tr>
          <tr><th>E-mail</th><td>${psicologo.email || '-'}</td></tr>
          <tr><th>Bio</th><td>${psicologo.bio || '-'}</td></tr>
          <tr><th>Valor da Sessao</th><td>${psicologo.valorSessao ? `R$ ${psicologo.valorSessao.toFixed(2)}` : '-'}</td></tr>
          <tr><th>Situacao</th><td><span class="badge badge-${psicologo.aprovado ? 'success' : 'warning'}">${psicologo.aprovado ? 'Aprovado' : 'Aguardando aprovacao'}</span></td></tr>
        </tbody>
      </table>

      <div style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Certificados</h3>
        ${certificados.length === 0 ? '<p style="color: var(--gray-500); font-size: 0.875rem;">Nenhum certificado cadastrado.</p>' : ''}
        <ul style="margin-left: 1.25rem; margin-bottom: 1rem;">
          ${certificados.map((c) => `<li style="margin-bottom: 0.25rem;"><strong>${c.titulo}</strong> - ${c.instituicao} (${c.dataEmissao || 'Sem data'})</li>`).join('')}
        </ul>
      </div>

      <div style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Cursos</h3>
        ${cursos.length === 0 ? '<p style="color: var(--gray-500); font-size: 0.875rem;">Nenhum curso cadastrado.</p>' : ''}
        <ul style="margin-left: 1.25rem; margin-bottom: 1rem;">
          ${cursos.map((c) => `<li style="margin-bottom: 0.25rem;"><strong>${c.nome}</strong> - ${c.instituicao} (${c.cargaHoraria || 0}h) ${c.dataConclusao ? `- ${c.dataConclusao}` : ''}</li>`).join('')}
        </ul>
      </div>

      <div style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Horarios Disponiveis</h3>
        ${horarios.length === 0 ? '<p style="color: var(--gray-500); font-size: 0.875rem;">Nenhum horario cadastrado.</p>' : ''}
        <ul style="margin-left: 1.25rem;">
          ${horarios.map((h) => `<li style="margin-bottom: 0.25rem;">${diasSemana[h.diaSemana] || 'Dia ' + h.diaSemana}: ${h.horaInicio} as ${h.horaFim} (${h.duracaoMinutos} min)</li>`).join('')}
        </ul>
      </div>
    `;
  }
}

async function carregarAgendamentos(usuario: Usuario): Promise<void> {
  const container = document.getElementById('agendamentos-container')!;
  try {
    const psicologos = await psychologistService.listarPsicologos();
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (!psicologo) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--gray-500);">Perfil profissional nao encontrado.</p>';
      return;
    }

    const agendamentos = await appointmentService.listarPorPsicologo(psicologo.id);
    renderAgendamentos(agendamentos);
  } catch {
    const psicologos = getDemoPsychologists();
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (!psicologo) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--gray-500);">Perfil profissional nao encontrado.</p>';
      return;
    }

    const agendamentos = getDemoAppointments().filter((a) => a.psicologoId === psicologo.id);
    renderAgendamentos(agendamentos);
  }
}

function renderAgendamentos(agendamentos: Agendamento[]): void {
  const container = document.getElementById('agendamentos-container')!;

  const pendentes = agendamentos.filter((a) => a.situacao === 'pendente');
  const confirmados = agendamentos.filter((a) => a.situacao === 'confirmado');

  let html = '';

  if (pendentes.length > 0) {
    html += '<h3 style="margin-bottom: 1rem; font-size: 1rem;">Pendentes</h3>';
    html += '<table style="margin-bottom: 2rem;"><thead><tr><th>Paciente</th><th>Data</th><th>Horario</th><th>Tipo</th><th>Acoes</th></tr></thead><tbody>';
    pendentes.forEach((a) => {
      html += `<tr>
        <td>${a.clienteNome || '-'}</td>
        <td>${a.data}</td>
        <td>${a.horaInicio} - ${a.horaFim}</td>
        <td>${a.tipo === 'semanal' ? 'Semanal' : 'Unico'}</td>
        <td>
          <button class="btn btn-sm btn-success btn-confirmar" data-id="${a.id}">Confirmar</button>
          <button class="btn btn-sm btn-danger btn-recusar" data-id="${a.id}">Recusar</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
  }

  if (confirmados.length > 0) {
    html += '<h3 style="margin-bottom: 1rem; font-size: 1rem;">Confirmados</h3>';
    html += '<table><thead><tr><th>Paciente</th><th>Data</th><th>Horario</th><th>Tipo</th></tr></thead><tbody>';
    confirmados.forEach((a) => {
      html += `<tr>
        <td>${a.clienteNome || '-'}</td>
        <td>${a.data}</td>
        <td>${a.horaInicio} - ${a.horaFim}</td>
        <td>${a.tipo === 'semanal' ? 'Semanal' : 'Unico'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
  }

  if (!html) {
    html = '<p style="padding: 1rem; color: var(--gray-500);">Nenhum agendamento encontrado.</p>';
  }

  container.innerHTML = html;

  container.querySelectorAll('.btn-confirmar').forEach((btn) => {
    btn.addEventListener('click', () => atualizarStatusAgendamento(Number((btn as HTMLElement).dataset.id), 'confirmado'));
  });

  container.querySelectorAll('.btn-recusar').forEach((btn) => {
    btn.addEventListener('click', () => atualizarStatusAgendamento(Number((btn as HTMLElement).dataset.id), 'recusado'));
  });
}

async function atualizarStatusAgendamento(id: number, situacao: Agendamento['situacao']): Promise<void> {
  try {
    await appointmentService.atualizarStatus(id, situacao);
    const usuario = auth.getUsuario();
    if (usuario) {
      await carregarAgendamentos(usuario);
      await carregarCalendario(usuario);
    }
  } catch {
    const appointments = getDemoAppointments();
    const idx = appointments.findIndex((a) => a.id === id);
    if (idx !== -1) {
      appointments[idx].situacao = situacao;
      appointments[idx].dataAtualizacao = new Date().toISOString();
      saveDemoAppointments(appointments);
      const usuario = auth.getUsuario();
      if (usuario) {
        await carregarAgendamentos(usuario);
        await carregarCalendario(usuario);
      }
    }
  }
}

async function carregarCalendario(usuario: Usuario): Promise<void> {
  const container = document.getElementById('calendario-container')!;
  try {
    const psicologos = await psychologistService.listarPsicologos();
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (!psicologo) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--gray-500);">Perfil profissional nao encontrado.</p>';
      return;
    }

    const agendamentos = await appointmentService.listarPorPsicologo(psicologo.id);
    renderCalendario(agendamentos);
  } catch {
    const psicologos = getDemoPsychologists();
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (!psicologo) {
      container.innerHTML = '<p style="padding: 1rem; color: var(--gray-500);">Perfil profissional nao encontrado.</p>';
      return;
    }

    const agendamentos = getDemoAppointments().filter((a) => a.psicologoId === psicologo.id);
    renderCalendario(agendamentos);
  }
}

function renderCalendario(agendamentos: Agendamento[]): void {
  const container = document.getElementById('calendario-container')!;
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();

  const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const agendamentosPorData = agendamentos.reduce<Record<string, Agendamento[]>>((acc, a) => {
    if (!acc[a.data]) acc[a.data] = [];
    acc[a.data].push(a);
    return acc;
  }, {});

  let html = `<h3 style="margin-bottom: 1rem; font-size: 1rem;">${meses[mesAtual]} ${anoAtual}</h3>`;
  html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; text-align: center;">';

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  diasSemana.forEach((d) => {
    html += `<div style="font-weight: 600; font-size: 0.875rem; padding: 0.5rem; color: var(--gray-600);">${d}</div>`;
  });

  for (let i = 0; i < primeiroDia; i++) {
    html += '<div></div>';
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const agendamentosDoDia = agendamentosPorData[dataStr] || [];
    const confirmados = agendamentosDoDia.filter((a) => a.situacao === 'confirmado').length;
    const pendentes = agendamentosDoDia.filter((a) => a.situacao === 'pendente').length;

    let corFundo = 'transparent';
    if (confirmados > 0) corFundo = '#dcfce7';
    else if (pendentes > 0) corFundo = '#fef3c7';

    html += `<div style="padding: 0.5rem; border-radius: 0.375rem; background: ${corFundo}; min-height: 60px; cursor: default;">
      <div style="font-weight: 600; font-size: 0.875rem;">${dia}</div>
      ${confirmados > 0 ? `<div style="font-size: 0.75rem; color: var(--success-color);">${confirmados} confirmado(s)</div>` : ''}
      ${pendentes > 0 ? `<div style="font-size: 0.75rem; color: var(--warning-color);">${pendentes} pendente(s)</div>` : ''}
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function openPerfilModal(usuario: Usuario): void {
  const modal = document.createElement('div');
  modal.id = 'modal-perfil';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';

  modal.innerHTML = `
    <div class="card" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
      <h2 style="margin-bottom: 1.5rem;">Editar Perfil Profissional</h2>
      <form id="perfil-form">
        <div class="form-group">
          <label for="bio">Biografia</label>
          <textarea id="bio" name="bio" rows="4" style="width: 100%; padding: 0.625rem; border: 1px solid var(--gray-300); border-radius: 0.375rem; font-size: 0.9375rem;"></textarea>
        </div>
        <div class="form-group">
          <label for="valorSessao">Valor da Sessao (R$)</label>
          <input type="number" id="valorSessao" name="valorSessao" step="0.01" min="0" />
        </div>

        <h3 style="margin: 1.5rem 0 1rem; font-size: 1rem;">Certificados</h3>
        <div id="certificados-lista"></div>
        <button type="button" id="btn-add-certificado" class="btn btn-secondary" style="margin-bottom: 1.5rem;">Adicionar Certificado</button>

        <h3 style="margin: 1.5rem 0 1rem; font-size: 1rem;">Cursos</h3>
        <div id="cursos-lista"></div>
        <button type="button" id="btn-add-curso" class="btn btn-secondary" style="margin-bottom: 1.5rem;">Adicionar Curso</button>

        <h3 style="margin: 1.5rem 0 1rem; font-size: 1rem;">Horarios Disponiveis</h3>
        <div id="horarios-lista"></div>
        <button type="button" id="btn-add-horario" class="btn btn-secondary" style="margin-bottom: 1.5rem;">Adicionar Horario</button>

        <div id="perfil-error" class="alert alert-error" style="display: none;"></div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="modal-cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#modal-cancelar')!.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  psychologistService.listarPsicologos().then((psicologos) => {
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (psicologo) {
      (modal.querySelector('#bio') as HTMLTextAreaElement).value = psicologo.bio || '';
      (modal.querySelector('#valorSessao') as HTMLInputElement).value = psicologo.valorSessao ? String(psicologo.valorSessao) : '';
    }
  }).catch(() => {
    const psicologo = getDemoPsychologists().find((p) => p.usuarioId === usuario.id);
    if (psicologo) {
      (modal.querySelector('#bio') as HTMLTextAreaElement).value = psicologo.bio || '';
      (modal.querySelector('#valorSessao') as HTMLInputElement).value = psicologo.valorSessao ? String(psicologo.valorSessao) : '';
    }
  });

  modal.querySelector('#btn-add-certificado')!.addEventListener('click', () => {
    adicionarLinhaCertificado();
  });

  modal.querySelector('#btn-add-curso')!.addEventListener('click', () => {
    adicionarLinhaCurso();
  });

  modal.querySelector('#btn-add-horario')!.addEventListener('click', () => {
    adicionarLinhaHorario();
  });

  function adicionarLinhaCertificado(dados?: Certificado): void {
    const div = document.createElement('div');
    div.style.cssText = 'display: grid; grid-template-columns: 2fr 2fr 1fr 2fr auto; gap: 0.5rem; margin-bottom: 0.5rem; align-items: end;';
    div.innerHTML = `
      <input type="text" placeholder="Titulo" value="${dados?.titulo || ''}" />
      <input type="text" placeholder="Instituicao" value="${dados?.instituicao || ''}" />
      <input type="date" value="${dados?.dataEmissao || ''}" />
      <input type="text" placeholder="Descricao (opcional)" value="${dados?.descricao || ''}" />
      <button type="button" class="btn btn-sm btn-danger btn-remover">X</button>
    `;
    div.querySelector('.btn-remover')!.addEventListener('click', () => div.remove());
    (modal.querySelector('#certificados-lista') as HTMLElement).appendChild(div);
  }

  function adicionarLinhaCurso(dados?: Curso): void {
    const div = document.createElement('div');
    div.style.cssText = 'display: grid; grid-template-columns: 2fr 2fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem; align-items: end;';
    div.innerHTML = `
      <input type="text" placeholder="Nome do curso" value="${dados?.nome || ''}" />
      <input type="text" placeholder="Instituicao" value="${dados?.instituicao || ''}" />
      <input type="number" placeholder="Carga (h)" min="1" value="${dados?.cargaHoraria || ''}" />
      <input type="date" value="${dados?.dataConclusao || ''}" />
      <button type="button" class="btn btn-sm btn-danger btn-remover">X</button>
    `;
    div.querySelector('.btn-remover')!.addEventListener('click', () => div.remove());
    (modal.querySelector('#cursos-lista') as HTMLElement).appendChild(div);
  }

  function adicionarLinhaHorario(dados?: HorarioDisponivel): void {
    const div = document.createElement('div');
    div.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem; align-items: end;';
    div.innerHTML = `
      <select>
        <option value="0">Domingo</option>
        <option value="1">Segunda</option>
        <option value="2">Terca</option>
        <option value="3">Quarta</option>
        <option value="4">Quinta</option>
        <option value="5">Sexta</option>
        <option value="6">Sabado</option>
      </select>
      <input type="time" value="${dados?.horaInicio || ''}" />
      <input type="time" value="${dados?.horaFim || ''}" />
      <input type="number" placeholder="Duracao (min)" min="15" value="${dados?.duracaoMinutos || 60}" />
      <button type="button" class="btn btn-sm btn-danger btn-remover">X</button>
    `;
    if (dados) {
      (div.querySelector('select') as HTMLSelectElement).value = String(dados.diaSemana);
    }
    div.querySelector('.btn-remover')!.addEventListener('click', () => div.remove());
    (modal.querySelector('#horarios-lista') as HTMLElement).appendChild(div);
  }

  psychologistService.listarPsicologos().then((psicologos) => {
    const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
    if (psicologo) {
      certificateService.listar(psicologo.id).then((certs) => {
        certs.forEach(adicionarLinhaCertificado);
      }).catch(() => {
        getDemoCertificates().filter((c) => c.psicologoId === psicologo.id).forEach(adicionarLinhaCertificado);
      });

      courseService.listar(psicologo.id).then((cursos) => {
        cursos.forEach(adicionarLinhaCurso);
      }).catch(() => {
        getDemoCourses().filter((c) => c.psicologoId === psicologo.id).forEach(adicionarLinhaCurso);
      });

      scheduleService.listar(psicologo.id).then((horarios) => {
        horarios.forEach(adicionarLinhaHorario);
      }).catch(() => {
        getDemoSchedule().filter((h) => h.psicologoId === psicologo.id).forEach(adicionarLinhaHorario);
      });
    }
  }).catch(() => {
    const psicologo = getDemoPsychologists().find((p) => p.usuarioId === usuario.id);
    if (psicologo) {
      getDemoCertificates().filter((c) => c.psicologoId === psicologo.id).forEach(adicionarLinhaCertificado);
      getDemoCourses().filter((c) => c.psicologoId === psicologo.id).forEach(adicionarLinhaCurso);
      getDemoSchedule().filter((h) => h.psicologoId === psicologo.id).forEach(adicionarLinhaHorario);
    }
  });

  modal.querySelector('#perfil-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('perfil-error')!;
    errorDiv.style.display = 'none';

    const form = e.target as HTMLFormElement;
    const bio = (form.elements.namedItem('bio') as HTMLTextAreaElement).value.trim();
    const valorSessao = Number((form.elements.namedItem('valorSessao') as HTMLInputElement).value) || undefined;

    try {
      const psicologos = await psychologistService.listarPsicologos();
      const psicologo = psicologos.find((p) => p.usuarioId === usuario.id);
      if (!psicologo) throw new Error('Perfil nao encontrado.');

      await psychologistService.atualizarPerfil(psicologo.id, { bio, valorSessao });

      const certRows = modal.querySelectorAll('#certificados-lista > div');
      for (const row of certRows) {
        const inputs = row.querySelectorAll('input');
        await certificateService.cadastrar(psicologo.id, {
          titulo: inputs[0].value,
          instituicao: inputs[1].value,
          dataEmissao: inputs[2].value,
          descricao: inputs[3].value,
        });
      }

      const courseRows = modal.querySelectorAll('#cursos-lista > div');
      for (const row of courseRows) {
        const inputs = row.querySelectorAll('input');
        await courseService.cadastrar(psicologo.id, {
          nome: inputs[0].value,
          instituicao: inputs[1].value,
          cargaHoraria: Number(inputs[2].value) || undefined,
          dataConclusao: inputs[3].value,
        });
      }

      const scheduleRows = modal.querySelectorAll('#horarios-lista > div');
      for (const row of scheduleRows) {
        const inputs = row.querySelectorAll('input, select');
        const diaSemana = (inputs[0] as HTMLSelectElement).value;
        const horaInicio = (inputs[1] as HTMLInputElement).value;
        const horaFim = (inputs[2] as HTMLInputElement).value;
        const duracaoMinutos = Number((inputs[3] as HTMLInputElement).value) || 60;
        await scheduleService.cadastrar(psicologo.id, {
          diaSemana: Number(diaSemana),
          horaInicio,
          horaFim,
          duracaoMinutos,
        });
      }

      modal.remove();
      await carregarPerfil(usuario);
      alert('Perfil atualizado com sucesso!');
    } catch (err: unknown) {
      const error = err as { message?: string };
      errorDiv.textContent = error.message || 'Erro ao salvar perfil.';
      errorDiv.style.display = 'block';
    }
  });
}
