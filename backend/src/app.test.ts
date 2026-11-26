import "./test-setup";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import mysql from "mysql2/promise";
import { createApp } from "./app";
import { config } from "./config";
import { all, one, openDb, run, type Pool } from "./db";
import { cadastrarUsuario } from "./users";

const TEST_DB = "psicogest_test";
let server: Server;
let base: string;
let db: Pool;
let crpSeq = 0;

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function register(email: string, name = "Ana Souza", areaAtuacao?: string) {
  const r = await call("POST", "/auth/register", {
    tipo: "psicologo",
    name,
    email,
    password: "senha-forte-123",
    crp: `03/${String(10000 + ++crpSeq)}`,
    areaAtuacao,
  });
  assert.equal(r.status, 201);
  return { token: r.body.token as string, user: r.body.user };
}

before(async () => {
  // Recria um banco só para testes a partir do psicogest.sql (estrutura + dados fictícios).
  const sql = fs
    .readFileSync(path.resolve(__dirname, "../../psicogest.sql"), "utf8")
    .replace(/(DATABASE IF EXISTS|CREATE DATABASE|USE) psicogest\b/g, `$1 ${TEST_DB}`);
  const conn = await mysql.createConnection({ ...config.db, database: undefined, multipleStatements: true });
  await conn.query(sql);
  await conn.end();

  db = openDb(TEST_DB);
  server = createApp(db).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  server.close();
  await db.end();
});

describe("modelo de dados", () => {
  test("perfis admin, psicologo e cliente e todas as entidades do modelo mínimo", async () => {
    const perfis = await all<{ nome: string }>(db, "SELECT nome FROM perfis ORDER BY nome");
    assert.deepEqual(perfis.map((p) => p.nome), ["admin", "cliente", "psicologo"]);
    const tabelas = (
      await all<{ name: string }>(db, "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()")
    ).map((t) => t.name);
    for (const t of ["usuarios", "perfis", "psicologos", "clientes_pacientes", "vinculos", "logs_acoes", "solicitacoes"]) {
      assert.ok(tabelas.includes(t), `tabela ausente: ${t}`);
    }
  });
});

describe("autenticação", () => {
  test("cadastra psicólogo (usuario + psicologos), entra e devolve o usuário logado", async () => {
    const { token, user } = await register("ana@exemplo.com", "Ana Souza", "Psicologia clínica");
    assert.equal(user.perfil, "psicologo");
    assert.equal(user.situacao, "ativo");
    assert.equal(user.areaAtuacao, "Psicologia clínica");

    const login = await call("POST", "/auth/login", { email: "ANA@exemplo.com", password: "senha-forte-123" });
    assert.equal(login.status, 200);
    const me = await call("GET", "/auth/me", undefined, token);
    assert.equal(me.body.user.email, "ana@exemplo.com");
    assert.equal(me.body.user.senha_hash, undefined);
    assert.equal(me.body.user.password_hash, undefined);

    const row = (await one<{ crp: string; senha_hash: string }>(
      db,
      "SELECT ps.crp, u.senha_hash FROM psicologos ps JOIN usuarios u ON u.id = ps.usuario_id WHERE u.email = ?",
      ["ana@exemplo.com"],
    ))!;
    assert.match(row.crp, /^03\/\d+$/);
    assert.ok(row.senha_hash.startsWith("$2"), "senha deve estar em hash bcrypt");
  });

  test("rejeita senha errada, e-mail repetido, CRP repetido e CRP inválido", async () => {
    assert.equal((await call("POST", "/auth/login", { email: "ana@exemplo.com", password: "errada-123" })).status, 401);

    const dupEmail = await call("POST", "/auth/register", {
      tipo: "psicologo",
      name: "Outra Ana", email: "ana@exemplo.com", password: "senha-forte-123", crp: "05/99999",
    });
    assert.equal(dupEmail.status, 409);

    const existingCrp = (await one<{ crp: string }>(db, "SELECT crp FROM psicologos LIMIT 1"))!.crp;
    const dupCrp = await call("POST", "/auth/register", {
      tipo: "psicologo",
      name: "Clone", email: "clone@exemplo.com", password: "senha-forte-123", crp: `CRP-${existingCrp}`,
    });
    assert.equal(dupCrp.status, 409);
    assert.match(dupCrp.body.error, /CRP/);

    const bad = await call("POST", "/auth/register", {
      tipo: "psicologo",
      name: "Sem CRP", email: "x@exemplo.com", password: "senha-forte-123", crp: "abc",
    });
    assert.equal(bad.status, 400);
  });

  test("bloqueia rotas sem token ou com token falso", async () => {
    assert.equal((await call("GET", "/patients")).status, 401);
    assert.equal((await call("GET", "/sessions", undefined, "token-falso")).status, 401);
  });

  test("conta bloqueada perde acesso imediatamente, mesmo com token válido", async () => {
    const { token, user } = await register("bloqueado@exemplo.com", "Beto Bloqueado");
    assert.equal((await call("GET", "/patients", undefined, token)).status, 200);

    await run(db, "UPDATE usuarios SET situacao = 'bloqueado' WHERE id = ?", [user.id]);
    assert.equal((await call("GET", "/patients", undefined, token)).status, 403);
    const login = await call("POST", "/auth/login", { email: "bloqueado@exemplo.com", password: "senha-forte-123" });
    assert.equal(login.status, 403);
  });
});

describe("pacientes, vínculos e sessões", () => {
  let token: string;
  let userId: number;
  let patientId: number;
  let sessionId: number;
  const SEGREDO = "Paciente relatou conflito com o pai e melhora no sono.";

  before(async () => {
    const r = await register("bruno@exemplo.com", "Bruno Lima");
    token = r.token;
    userId = r.user.id;
  });

  test("cadastrar paciente cria o vínculo com o psicólogo", async () => {
    const created = await call("POST", "/patients", { name: "Maria Clara", phone: "71 99999-0000" }, token);
    assert.equal(created.status, 201);
    assert.equal(created.body.patient.active, true);
    patientId = created.body.patient.id;

    const v = await one<{ situacao: string }>(
      db,
      `SELECT v.situacao FROM vinculos v JOIN psicologos ps ON ps.id = v.psicologo_id
       WHERE ps.usuario_id = ? AND v.cliente_paciente_id = ?`,
      [userId, patientId],
    );
    assert.equal(v?.situacao, "ativo");

    assert.equal((await call("GET", "/patients?q=clara", undefined, token)).body.patients.length, 1);
  });

  test("agenda sessão e impede horários sobrepostos", async () => {
    const ok = await call("POST", "/sessions", {
      patientId, startsAt: "2026-09-22T14:00:00.000Z", durationMin: 50, feeCents: 15000,
    }, token);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.session.status, "scheduled");
    sessionId = ok.body.session.id;

    const overlap = await call("POST", "/sessions", { patientId, startsAt: "2026-09-22T14:30:00.000Z" }, token);
    assert.equal(overlap.status, 409);
    const adjacent = await call("POST", "/sessions", { patientId, startsAt: "2026-09-22T14:50:00.000Z" }, token);
    assert.equal(adjacent.status, 201);
  });

  test("anotações ficam criptografadas no banco e voltam legíveis pela API", async () => {
    const saved = await call("PATCH", `/sessions/${sessionId}`, { status: "done", note: SEGREDO }, token);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.session.note, SEGREDO);
    assert.equal(saved.body.session.status, "done");

    const raw = (await one<{ anotacao_cripto: string; situacao: string }>(
      db, "SELECT anotacao_cripto, situacao FROM sessoes WHERE id = ?", [sessionId],
    ))!;
    assert.ok(raw.anotacao_cripto && !raw.anotacao_cripto.includes("conflito"));
    assert.equal(raw.situacao, "realizada");

    const list = await call("GET", "/sessions", undefined, token);
    assert.equal(list.body.sessions[0].note, undefined);
    assert.equal(list.body.sessions[0].hasNote, true);
  });

  test("não exclui sessão com anotações", async () => {
    assert.equal((await call("DELETE", `/sessions/${sessionId}`, undefined, token)).status, 409);
  });

  test("resumo financeiro conta sessões realizadas e não pagas", async () => {
    assert.equal((await call("GET", "/summary", undefined, token)).body.unpaidCents, 15000);
    await call("PATCH", `/sessions/${sessionId}`, { paid: true }, token);
    assert.equal((await call("GET", "/summary", undefined, token)).body.unpaidCents, 0);
  });

  test("outro psicólogo, sem vínculo, não enxerga nem altera dados alheios", async () => {
    const other = (await register("carla@exemplo.com", "Carla Dias")).token;
    assert.equal((await call("GET", `/patients/${patientId}`, undefined, other)).status, 404);
    assert.equal((await call("PATCH", `/patients/${patientId}`, { name: "Hackeado" }, other)).status, 404);
    assert.equal((await call("GET", `/sessions/${sessionId}`, undefined, other)).status, 404);
    assert.equal((await call("PATCH", `/sessions/${sessionId}`, { note: "x" }, other)).status, 404);
    assert.equal((await call("POST", "/sessions", { patientId, startsAt: "2026-09-23T14:00:00.000Z" }, other)).status, 404);
    assert.equal((await call("GET", "/patients", undefined, other)).body.patients.length, 0);
  });

  test("arquivar encerra o vínculo e impede novos agendamentos; reativar reabre", async () => {
    const archived = await call("PATCH", `/patients/${patientId}`, { active: false }, token);
    assert.equal(archived.body.patient.active, false);
    const v = (await one<{ situacao: string; fim: Date | null }>(
      db, "SELECT situacao, fim FROM vinculos WHERE cliente_paciente_id = ?", [patientId],
    ))!;
    assert.equal(v.situacao, "encerrado");
    assert.ok(v.fim);

    assert.equal((await call("POST", "/sessions", { patientId, startsAt: "2026-09-25T14:00:00.000Z" }, token)).status, 409);
    assert.equal((await call("GET", "/patients", undefined, token)).body.patients.length, 0);
    assert.equal((await call("GET", "/patients?archived=1", undefined, token)).body.patients.length, 1);

    const back = await call("PATCH", `/patients/${patientId}`, { active: true }, token);
    assert.equal(back.body.patient.active, true);
  });
});

describe("logs_acoes", () => {
  test("registra ações relevantes, sem vazar conteúdo clínico", async () => {
    const { token } = await register("dora@exemplo.com", "Dora Reis");
    const p = await call("POST", "/patients", { name: "Paciente Log" }, token);
    const s = await call("POST", "/sessions", { patientId: p.body.patient.id, startsAt: "2026-10-01T13:00:00.000Z" }, token);
    const nota = "TEXTO-CLINICO-CONFIDENCIAL-123";
    await call("PATCH", `/sessions/${s.body.session.id}`, { note: nota }, token);
    await call("GET", `/sessions/${s.body.session.id}`, undefined, token);
    await call("PATCH", `/patients/${p.body.patient.id}`, { active: false }, token);

    const { logs } = (await call("GET", "/logs", undefined, token)).body as {
      logs: { action: string; entity: string; details: Record<string, unknown> | null; createdAt: string }[];
    };
    const acoes = logs.map((l) => l.action);
    for (const a of ["cadastro", "paciente_criado", "sessao_agendada", "sessao_atualizada", "anotacao_lida", "paciente_arquivado"]) {
      assert.ok(acoes.includes(a), `faltou log: ${a}`);
    }
    assert.ok(!JSON.stringify(logs).includes(nota), "log não pode conter o texto da anotação");
    assert.ok(!Number.isNaN(Date.parse(logs[0].createdAt)));
    assert.deepEqual(logs.find((l) => l.action === "sessao_atualizada")!.details, { campos: ["note"] });
  });

  test("cada psicólogo vê só o próprio histórico", async () => {
    const a = (await register("eva@exemplo.com", "Eva")).token;
    const logs = (await call("GET", "/logs", undefined, a)).body.logs as { action: string }[];
    assert.deepEqual(logs.map((l) => l.action), ["cadastro"]);
  });

  test("é somente-inserção: UPDATE e DELETE são recusados pelo banco", async () => {
    await assert.rejects(run(db, "UPDATE logs_acoes SET acao = 'x'"), /somente insercao/);
    await assert.rejects(run(db, "DELETE FROM logs_acoes"), /somente insercao/);
  });

  test("login e tentativa falha ficam registrados", async () => {
    await call("POST", "/auth/login", { email: "eva@exemplo.com", password: "errada-123" });
    await call("POST", "/auth/login", { email: "eva@exemplo.com", password: "senha-forte-123" });
    const acoes = (await all<{ acao: string }>(
      db,
      "SELECT l.acao FROM logs_acoes l JOIN usuarios u ON u.id = l.usuario_id WHERE u.email = 'eva@exemplo.com' ORDER BY l.id",
    )).map((r) => r.acao);
    assert.deepEqual(acoes, ["cadastro", "login_falhou", "login"]);
  });
});

describe("administrador", () => {
  let admin: string;
  let adminId: number;

  before(async () => {
    adminId = (await cadastrarUsuario(db, { perfil: "admin", name: "Adm", email: "adm@exemplo.com", password: "senha-forte-123" })).id;
    admin = (await call("POST", "/auth/login", { email: "adm@exemplo.com", password: "senha-forte-123" })).body.token;
  });

  test("só o admin acessa /admin e o cadastro público não cria admin", async () => {
    const psi = (await register("fabio@exemplo.com", "Fábio")).token;
    assert.equal((await call("GET", "/admin/users", undefined, psi)).status, 403);
    const fake = await call("POST", "/auth/register", {
      tipo: "admin", name: "Intruso", email: "intruso@exemplo.com", password: "senha-forte-123",
    });
    assert.equal(fake.status, 400);
    assert.equal((await call("GET", "/admin/summary", undefined, admin)).status, 200);
  });

  test("cria usuário, bloqueia e não altera o próprio perfil", async () => {
    const c = await call("POST", "/admin/users", {
      perfil: "psicologo", name: "Gil", email: "gil@exemplo.com", password: "senha-forte-123", crp: "07/77777",
    }, admin);
    assert.equal(c.status, 201);
    const b = await call("PATCH", `/admin/users/${c.body.user.id}`, { situacao: "bloqueado" }, admin);
    assert.equal(b.body.user.situacao, "bloqueado");
    assert.equal((await call("POST", "/auth/login", { email: "gil@exemplo.com", password: "senha-forte-123" })).status, 403);
    assert.equal((await call("PATCH", `/admin/users/${adminId}`, { perfil: "cliente" }, admin)).status, 403);
  });

  test("cadastra paciente já vinculado a um psicólogo", async () => {
    const { token, user } = await register("hel@exemplo.com", "Helena");
    const p = await call("POST", "/admin/patients", { name: "Paciente do Admin", psychologistId: user.psicologoId }, admin);
    assert.equal(p.status, 201);
    assert.equal(p.body.patient.psychologists, "Helena");
    assert.equal((await call("GET", "/patients", undefined, token)).body.patients.length, 1);
  });
});

describe("cliente e agenda com confirmação", () => {
  test("cliente pede horário livre, psicólogo aceita e a sessão aparece sem anotações", async () => {
    const psi = await register("ines@exemplo.com", "Ines Rocha");
    const availability = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "08:00", end: "20:00" }));
    assert.equal((await call("PUT", "/profile", { name: "Ines Rocha", feeCents: 20000, availability, bio: "TCC" }, psi.token)).status, 200);

    const cli = await call("POST", "/auth/register", {
      tipo: "cliente", name: "Joana", email: "joana@exemplo.com", password: "senha-forte-123",
    });
    assert.equal(cli.status, 201);
    const ct = cli.body.token as string;
    assert.equal((await call("GET", "/patients", undefined, ct)).status, 403);

    assert.equal((await call("GET", "/client/psychologists?q=Rocha", undefined, ct)).body.psychologists.length, 1);
    const psiId = psi.user.psicologoId as number;
    const slot = (await call("GET", `/client/psychologists/${psiId}`, undefined, ct)).body.slots[1] as string;
    assert.ok(slot, "deveria haver horário livre");

    const past = await call("POST", "/client/requests", { psychologistId: psiId, startsAt: "2020-01-01T10:00:00.000Z" }, ct);
    assert.equal(past.status, 409);
    const r = await call("POST", "/client/requests", { psychologistId: psiId, startsAt: slot, message: "Oi" }, ct);
    assert.equal(r.status, 201);
    assert.ok(!(await call("GET", `/client/psychologists/${psiId}`, undefined, ct)).body.slots.includes(slot));

    assert.equal((await call("GET", "/requests?status=pending", undefined, psi.token)).body.requests.length, 1);
    const ok = await call("PATCH", `/requests/${r.body.request.id}`, { action: "accept" }, psi.token);
    assert.equal(ok.body.request.status, "accepted");
    assert.equal((await call("PATCH", `/requests/${r.body.request.id}`, { action: "decline" }, psi.token)).status, 409);

    await call("PATCH", `/sessions/${ok.body.request.sessionId}`, { note: "segredo clinico" }, psi.token);
    const mine = await call("GET", "/client/sessions", undefined, ct);
    assert.equal(mine.body.sessions.length, 1);
    assert.equal(mine.body.sessions[0].feeCents, 20000);
    assert.ok(!JSON.stringify(mine.body).includes("segredo"));
    assert.equal((await call("GET", "/patients", undefined, psi.token)).body.patients[0].name, "Joana");
  });

  test("sessão semanal cria N sessões e recusa todas se uma colidir", async () => {
    const { token } = await register("kai@exemplo.com", "Kai");
    const p = (await call("POST", "/patients", { name: "Semanal" }, token)).body.patient.id;
    const four = await call("POST", "/sessions", { patientId: p, startsAt: "2030-03-04T13:00:00.000Z", repeatWeeks: 4 }, token);
    assert.equal(four.body.created, 4);
    const clash = await call("POST", "/sessions", { patientId: p, startsAt: "2030-02-25T13:00:00.000Z", repeatWeeks: 3 }, token);
    assert.equal(clash.status, 409);
    assert.equal((await call("GET", "/sessions", undefined, token)).body.sessions.length, 4);
  });
});
