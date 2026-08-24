import { psychologistService } from '@/services/api';
import type { Psicologo, Agendamento } from '@/types';

function getDemoPsychologists(): Psicologo[] {
  const raw = localStorage.getItem('psico_demo_psychologists');
  if (!raw) return [];
  return JSON.parse(raw);
}

function saveDemoPsychologists(psicologos: Psicologo[]): void {
  localStorage.setItem('psico_demo_psychologists', JSON.stringify(psicologos));
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
  if (!localStorage.getItem('psico_demo_psychologists')) {
    saveDemoPsychologists([
      { id: 1, usuarioId: 2, nome: 'Dr. Carlos Silva', crm: '12345/SP', areaAtuacao: 'Psicologia Clinica', telefone: '(11) 98765-4321', email: 'carlos@demo.com', situacao: 'ativo', bio: 'Especialista em ansiedade e depressao com 10 anos de experiencia.', valorSessao: 150, aprovado: true, avaliacao: 4.8, quantidadeSessoes: 120 },
      { id: 2, usuarioId: 3, nome: 'Dra. Ana Oliveira', crm: '67890/SP', areaAtuacao: 'Psicologia Organizacional', telefone: '(11) 91234-5678', email: 'ana@demo.com', situacao: 'ativo', bio: 'Foco em terapia cognitivo-comportamental e desenvolvimento pessoal.', valorSessao: 200, aprovado: true, avaliacao: 4.9, quantidadeSessoes: 85 },
    ]);
  }
  if (!localStorage.getItem('psico_demo_appointments')) {
    saveDemoAppointments([]);
  }
}

export function renderHomePage(): void {
  ensureDemoData();
  document.getElementById('page-login')!.style.display = 'none';
  document.getElementById('page-admin')!.style.display = 'none';
  document.getElementById('page-psychologist')!.style.display = 'none';
  const homePage = document.getElementById('page-home')!;
  homePage.style.display = 'block';
  homePage.innerHTML = `
    <div class="container" style="max-width: 1200px;">
      <div style="text-align: center; margin-bottom: 2rem;">
        <h1 class="section-title" style="font-size: 2rem;">PsicoGest</h1>
        <p style="color: var(--gray-500);">Encontre profissionais de Psicologia e agende sua sessao</p>
      </div>

      <div class="form-group" style="max-width: 600px; margin: 0 auto 2rem;">
        <input type="text" id="busca-psicologo" placeholder="Buscar por nome ou area de atuacao..." />
      </div>

      <div id="psicologos-lista" class="dashboard-grid"></div>
    </div>
  `;

  const buscarInput = document.getElementById('busca-psicologo') as HTMLInputElement;
  buscarInput.addEventListener('input', () => {
    carregarPsicologos(buscarInput.value);
  });

  carregarPsicologos();
}

async function carregarPsicologos(filtro?: string): Promise<void> {
  try {
    const psicologos = await psychologistService.listarPsicologos();
    renderPsicologos(psicologos.filter((p) => p.aprovado && p.situacao === 'ativo'), filtro);
  } catch {
    const psicologos = getDemoPsychologists();
    renderPsicologos(psicologos.filter((p) => p.aprovado && p.situacao === 'ativo'), filtro);
  }
}

function renderPsicologos(psicologos: Psicologo[], filtro?: string): void {
  const container = document.getElementById('psicologos-lista')!;
  const termo = (filtro || '').toLowerCase();

  const filtrados = psicologos.filter((p) => {
    if (!termo) return true;
    return p.nome.toLowerCase().includes(termo) || (p.areaAtuacao || '').toLowerCase().includes(termo);
  });

  if (filtrados.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Nenhum profissional encontrado.</p>';
    return;
  }

  container.innerHTML = filtrados
    .map(
      (p) => `
      <div class="card" style="cursor: pointer;" onclick="window.openPsicologoModal(${p.id})">
        <h3 style="margin-bottom: 0.5rem;">${p.nome}</h3>
        <p style="color: var(--gray-500); font-size: 0.875rem; margin-bottom: 0.5rem;">${p.areaAtuacao || 'Nao informado'}</p>
        <p style="font-size: 0.8125rem; color: var(--gray-600);">CRM: ${p.crm || 'Nao informado'}</p>
        <p style="font-size: 0.8125rem; color: var(--gray-600);">Avaliacao: ${p.avaliacao || 'Novo'} (${p.quantidadeSessoes || 0} sessoes)</p>
        <p style="font-size: 0.875rem; font-weight: 600; color: var(--primary-color); margin-top: 0.5rem;">
          ${p.valorSessao ? `R$ ${p.valorSessao.toFixed(2)}/sessao` : 'Consulte valores'}
        </p>
      </div>
    `
    )
    .join('');

  (window as unknown as Record<string, unknown>).openPsicologoModal = (psicologoId: number) => {
    openAgendamentoModal(psicologoId);
  };
}

function openAgendamentoModal(psicologoId: number): void {
  const modal = document.createElement('div');
  modal.id = 'modal-agendamento';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';

  modal.innerHTML = `
    <div class="card" style="max-width: 500px;">
      <h2 style="margin-bottom: 1.5rem;">Agendar Sessao</h2>
      <form id="agendamento-form">
        <div class="form-group">
          <label for="cliente-nome">Seu nome completo</label>
          <input type="text" id="cliente-nome" name="clienteNome" required placeholder="Digite seu nome" />
        </div>
        <div class="form-group">
          <label for="cliente-email">Seu e-mail</label>
          <input type="email" id="cliente-email" name="clienteEmail" required placeholder="seu@email.com" />
        </div>
        <div class="form-group">
          <label for="cliente-telefone">Seu telefone</label>
          <input type="tel" id="cliente-telefone" name="clienteTelefone" placeholder="(11) 99999-9999" />
        </div>
        <div class="form-group">
          <label for="data">Data da sessao</label>
          <input type="date" id="data" name="data" required min="${new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="form-group">
          <label for="hora-inicio">Horario</label>
          <input type="time" id="hora-inicio" name="horaInicio" required />
        </div>
        <div class="form-group">
          <label for="tipo">Tipo de agendamento</label>
          <select id="tipo" name="tipo" required>
            <option value="unico">Sessao unica</option>
            <option value="semanal">Toda semana (mesmo horario)</option>
          </select>
        </div>
        <div id="agendamento-error" class="alert alert-error" style="display: none;"></div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="modal-cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Solicitar Agendamento</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#modal-cancelar')!.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('#agendamento-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('agendamento-error')!;
    errorDiv.style.display = 'none';

    const form = e.target as HTMLFormElement;
    const data = {
      psicologoId,
      clienteNome: (form.elements.namedItem('clienteNome') as HTMLInputElement).value.trim(),
      clienteEmail: (form.elements.namedItem('clienteEmail') as HTMLInputElement).value.trim(),
      clienteTelefone: (form.elements.namedItem('clienteTelefone') as HTMLInputElement).value.trim(),
      data: (form.elements.namedItem('data') as HTMLInputElement).value,
      horaInicio: (form.elements.namedItem('horaInicio') as HTMLInputElement).value,
      horaFim: '',
      tipo: (form.elements.namedItem('tipo') as HTMLSelectElement).value as Agendamento['tipo'],
      situacao: 'pendente' as Agendamento['situacao'],
    };

    const [hora, minuto] = data.horaInicio.split(':').map(Number);
    const fim = new Date();
    fim.setHours(hora + 1, minuto, 0, 0);
    data.horaFim = `${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`;

    try {
      const psicologos = getDemoPsychologists();
      const psicologo = psicologos.find((p) => p.id === psicologoId);
      if (!psicologo) throw new Error('Psicologo nao encontrado.');

      let appointments = getDemoAppointments();
      const conflito = appointments.find((a) => a.psicologoId === psicologoId && a.data === data.data && a.horaInicio === data.horaInicio && a.situacao !== 'cancelado' && a.situacao !== 'recusado');
      if (conflito) {
        errorDiv.textContent = 'Este horario ja esta ocupado. Escolha outro.';
        errorDiv.style.display = 'block';
        return;
      }

      const newAppointment: Agendamento = {
        id: appointments.length ? Math.max(...appointments.map((a) => a.id)) + 1 : 1,
        psicologoId,
        clienteId: 0,
        psicologoNome: psicologo.nome,
        clienteNome: data.clienteNome,
        data: data.data,
        horaInicio: data.horaInicio,
        horaFim: data.horaFim,
        tipo: data.tipo,
        situacao: 'pendente',
        dataCriacao: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString(),
      };

      appointments.push(newAppointment);
      saveDemoAppointments(appointments);
      modal.remove();
      alert('Solicitacao de agendamento enviada! Aguarde a confirmacao do psicologo.');
    } catch (err: unknown) {
      const error = err as { message?: string };
      errorDiv.textContent = error.message || 'Erro ao solicitar agendamento.';
      errorDiv.style.display = 'block';
    }
  });
}
