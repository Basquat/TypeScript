/**
 * Dados fictícios para demonstração (npm run seed). Idempotente: não roda duas vezes.
 *   admin@demo.com / admin123 · psicologo@demo.com / psicologo123 · cliente@demo.com / cliente123
 */
import { config } from "../config";
import { encrypt } from "../crypto";
import { openDb } from "../db";
import { freeSlots } from "../profile";
import { cadastrarUsuario } from "../users";

const db = openDb(config.dbPath);
if (db.prepare("SELECT 1 FROM usuarios WHERE email = 'admin@demo.com'").get()) {
  console.log("Seed já aplicado — nada a fazer.");
  process.exit(0);
}

const seed = { origem: "seed" };
cadastrarUsuario(db, { perfil: "admin", name: "Admin Demo", email: "admin@demo.com", password: "admin123" }, seed);
const ana = cadastrarUsuario(db, {
  perfil: "psicologo", name: "Ana Souza", email: "psicologo@demo.com", password: "psicologo123",
  crp: "03/12345", areaAtuacao: "Psicologia clínica",
}, seed).psicologo_id!;
const bruno = cadastrarUsuario(db, {
  perfil: "psicologo", name: "Bruno Lima", email: "bruno@demo.com", password: "psicologo123",
  crp: "06/54321", areaAtuacao: "Neuropsicologia",
}, seed).psicologo_id!;
const lia = cadastrarUsuario(db, {
  perfil: "psicologo", name: "Lia Moreira", email: "lia@demo.com", password: "psicologo123",
  crp: "05/22222", areaAtuacao: "Psicologia organizacional",
}, seed).psicologo_id!;
const cliente = cadastrarUsuario(db, {
  perfil: "cliente", name: "Carla Dias", email: "cliente@demo.com", password: "cliente123", phone: "(71) 98888-0000",
}, seed).id;

const perfil = db.prepare("UPDATE psicologos SET bio = ?, valor_sessao_centavos = ? WHERE id = ?");
perfil.run("Atendo adultos com ansiedade e depressão usando TCC. Sessões online e presenciais.", 18000, ana);
perfil.run("Avaliação neuropsicológica de crianças e adultos, TDAH e reabilitação cognitiva.", 25000, bruno);
perfil.run("Carreira, liderança e saúde mental no trabalho.", 15000, lia);

const janela = db.prepare("INSERT INTO horarios_disponiveis (psicologo_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)");
for (const d of [1, 2, 3, 4, 5]) (janela.run(ana, d, "08:00", "12:00"), janela.run(ana, d, "14:00", "18:00"));
for (const d of [2, 4]) janela.run(bruno, d, "09:00", "17:00");
janela.run(lia, 6, "09:00", "13:00");

const formacao = db.prepare("INSERT INTO formacoes (psicologo_id, tipo, titulo, instituicao, ano) VALUES (?, ?, ?, ?, ?)");
formacao.run(ana, "curso", "Especialização em Terapia Cognitivo-Comportamental", "Instituto Fictício de Psicologia", 2019);
formacao.run(ana, "certificado", "Terapia do Esquema — formação básica", "Centro Demo", 2022);
formacao.run(bruno, "curso", "Mestrado em Neurociências", "Universidade Exemplo", 2017);
formacao.run(lia, "certificado", "Coaching de carreira", "Escola Modelo", 2021);

const paciente = db.prepare("INSERT INTO clientes_pacientes (nome, data_nascimento, telefone, email) VALUES (?, ?, ?, ?)");
const vinculo = db.prepare("INSERT INTO vinculos (psicologo_id, cliente_paciente_id) VALUES (?, ?)");
const pacientes = [
  ["Marina Alves", "1994-03-12", "(71) 99111-0001", "marina@exemplo.com"],
  ["João Pedro Santos", "1988-11-02", "(71) 99111-0002", null],
  ["Lúcia Fernandes", "2001-07-25", null, "lucia@exemplo.com"],
  ["Rafael Costa", "1979-01-30", "(71) 99111-0004", null],
].map((p) => {
  const id = Number(paciente.run(...p).lastInsertRowid);
  vinculo.run(ana, id);
  return id;
});
vinculo.run(bruno, pacientes[3]);

const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
};
const sessao = db.prepare(
  `INSERT INTO sessoes (psicologo_id, cliente_paciente_id, inicio, duracao_min, situacao, valor_centavos, pago, anotacao_cripto)
   VALUES (?, ?, ?, 50, ?, 18000, ?, ?)`,
);
const nota = encrypt("Paciente relata melhora no sono. Seguir com registro de pensamentos automáticos.");
const [marina, joao, lucia, rafael] = pacientes;
sessao.run(ana, marina, at(-14, 9), "realizada", 1, nota);
sessao.run(ana, joao, at(-7, 10), "faltou", 0, null);
sessao.run(ana, lucia, at(-6, 15), "realizada", 1, null);
sessao.run(ana, marina, at(-7, 9), "realizada", 1, nota);
sessao.run(ana, rafael, at(-1, 16), "realizada", 0, null);
sessao.run(ana, marina, at(0, 9), "realizada", 0, nota);
sessao.run(ana, joao, at(0, 14), "agendada", 0, null);
sessao.run(ana, lucia, at(0, 16), "agendada", 0, null);
sessao.run(ana, rafael, at(1, 10), "agendada", 0, null);
sessao.run(ana, marina, at(7, 9), "agendada", 0, null);
sessao.run(ana, lucia, at(3, 11), "cancelada", 0, null);

const slot = freeSlots(db, ana)[3];
if (slot) {
  db.prepare("INSERT INTO solicitacoes (cliente_usuario_id, psicologo_id, inicio, mensagem) VALUES (?, ?, ?, ?)").run(
    cliente, ana, slot, "Olá! Gostaria de começar terapia por causa de ansiedade no trabalho.",
  );
}

console.log("Seed aplicado. Contas: admin@demo.com/admin123 · psicologo@demo.com/psicologo123 · cliente@demo.com/cliente123");
