import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

/**
 * Modelo de dados (baseado no "modelo mínimo" do trabalho):
 *   perfis ─< usuarios ─1:1─ psicologos >─< clientes_pacientes   (via vinculos)
 *   usuarios ─< logs_acoes          psicologos ─< sessoes >─ clientes_pacientes
 *   psicologos ─< horarios_disponiveis, formacoes, solicitacoes >─ usuarios (cliente)
 */
export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfis (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nome      TEXT NOT NULL UNIQUE,
      descricao TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      perfil_id  INTEGER NOT NULL REFERENCES perfis(id),
      nome       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      senha_hash TEXT NOT NULL,
      situacao   TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','inativo','bloqueado')),
      criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS psicologos (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id            INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
      crp                   TEXT NOT NULL UNIQUE,
      area_atuacao          TEXT,
      bio                   TEXT,
      valor_sessao_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_sessao_centavos >= 0)
    );

    -- Janelas semanais de atendimento (0 = domingo … 6 = sábado), em horário local "HH:MM".
    CREATE TABLE IF NOT EXISTS horarios_disponiveis (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      psicologo_id INTEGER NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
      dia_semana   INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
      hora_inicio  TEXT NOT NULL,
      hora_fim     TEXT NOT NULL,
      CHECK (hora_inicio < hora_fim)
    );

    -- Certificados e cursos exibidos no perfil público do psicólogo.
    CREATE TABLE IF NOT EXISTS formacoes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      psicologo_id INTEGER NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
      tipo         TEXT NOT NULL CHECK (tipo IN ('certificado','curso')),
      titulo       TEXT NOT NULL,
      instituicao  TEXT,
      ano          INTEGER
    );

    -- usuario_id liga o paciente à conta de cliente (quando ele mesmo se cadastrou).
    CREATE TABLE IF NOT EXISTS clientes_pacientes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id      INTEGER UNIQUE REFERENCES usuarios(id),
      nome            TEXT NOT NULL,
      data_nascimento TEXT,
      telefone        TEXT,
      email           TEXT,
      criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vinculos (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      psicologo_id        INTEGER NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
      cliente_paciente_id INTEGER NOT NULL REFERENCES clientes_pacientes(id) ON DELETE CASCADE,
      situacao            TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','encerrado')),
      inicio              TEXT NOT NULL DEFAULT (datetime('now')),
      fim                 TEXT,
      UNIQUE (psicologo_id, cliente_paciente_id)
    );
    CREATE INDEX IF NOT EXISTS idx_vinculos_paciente ON vinculos(cliente_paciente_id);

    CREATE TABLE IF NOT EXISTS sessoes (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      psicologo_id        INTEGER NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
      cliente_paciente_id INTEGER NOT NULL REFERENCES clientes_pacientes(id) ON DELETE CASCADE,
      inicio              TEXT NOT NULL,
      duracao_min         INTEGER NOT NULL DEFAULT 50,
      situacao            TEXT NOT NULL DEFAULT 'agendada'
                          CHECK (situacao IN ('agendada','realizada','cancelada','faltou')),
      valor_centavos      INTEGER NOT NULL DEFAULT 0,
      pago                INTEGER NOT NULL DEFAULT 0,
      anotacao_cripto     TEXT,
      criado_em           TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessoes_psicologo_inicio ON sessoes(psicologo_id, inicio);
    CREATE INDEX IF NOT EXISTS idx_sessoes_paciente ON sessoes(cliente_paciente_id);

    -- entidade_inovacao: agenda com confirmação. O cliente pede um horário livre,
    -- o psicólogo aceita (vira sessão + vínculo) ou recusa.
    CREATE TABLE IF NOT EXISTS solicitacoes (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      psicologo_id       INTEGER NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
      inicio             TEXT NOT NULL,
      duracao_min        INTEGER NOT NULL DEFAULT 50,
      mensagem           TEXT,
      situacao           TEXT NOT NULL DEFAULT 'pendente'
                         CHECK (situacao IN ('pendente','aceita','recusada','cancelada')),
      resposta           TEXT,
      sessao_id          INTEGER REFERENCES sessoes(id) ON DELETE SET NULL,
      criado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_psicologo ON solicitacoes(psicologo_id, situacao);

    CREATE TABLE IF NOT EXISTS logs_acoes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER REFERENCES usuarios(id),
      acao        TEXT NOT NULL,
      entidade    TEXT NOT NULL,
      entidade_id INTEGER,
      detalhes    TEXT,
      criado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_acoes(usuario_id, id);

    -- O log é somente-inserção: ninguém (nem a aplicação) altera ou apaga registros.
    CREATE TRIGGER IF NOT EXISTS logs_acoes_sem_update BEFORE UPDATE ON logs_acoes
      BEGIN SELECT RAISE(ABORT, 'logs_acoes é somente inserção'); END;
    CREATE TRIGGER IF NOT EXISTS logs_acoes_sem_delete BEFORE DELETE ON logs_acoes
      BEGIN SELECT RAISE(ABORT, 'logs_acoes é somente inserção'); END;

    INSERT OR IGNORE INTO perfis (nome, descricao) VALUES
      ('admin', 'Administrador: gerencia usuários, perfis, cadastros e auditoria'),
      ('psicologo', 'Psicólogo: gerencia seus pacientes, agenda e anotações de sessão'),
      ('cliente', 'Cliente: encontra psicólogos e solicita horários');
  `);
  return db;
}
