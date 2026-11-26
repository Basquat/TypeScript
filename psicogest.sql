-- =====================================================================
-- PsicoGest — banco de dados MySQL 8 (AV3 · Projeto Integrador)
-- Cria o banco, as tabelas, os relacionamentos e dados fictícios.
--
-- Uso:   mysql -u root -p < psicogest.sql
-- (ou abra no MySQL Workbench e execute o script inteiro)
--
-- ATENÇÃO: apaga e recria o banco `psicogest`.
-- Todos os dados abaixo são fictícios.
-- =====================================================================

DROP DATABASE IF EXISTS psicogest;
CREATE DATABASE psicogest CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE psicogest;

-- Datas e horas (DATETIME) são gravadas em UTC; a aplicação converte para o fuso de quem usa.
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------

-- Perfis de acesso: administrador, psicólogo e cliente.
CREATE TABLE perfis (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(30)  NOT NULL UNIQUE,
  descricao VARCHAR(200) NOT NULL
);

-- Credenciais e situação da conta. A senha fica só como hash bcrypt.
CREATE TABLE usuarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  perfil_id  INT          NOT NULL,
  nome       VARCHAR(120) NOT NULL,
  email      VARCHAR(190) NOT NULL UNIQUE,
  senha_hash CHAR(60)     NOT NULL,
  situacao   ENUM('ativo','inativo','bloqueado') NOT NULL DEFAULT 'ativo',
  criado_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_perfil FOREIGN KEY (perfil_id) REFERENCES perfis (id)
);

-- Dados profissionais (1:1 com usuarios).
CREATE TABLE psicologos (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id            INT          NOT NULL UNIQUE,
  crp                   VARCHAR(12)  NOT NULL UNIQUE,
  area_atuacao          VARCHAR(120),
  bio                   TEXT,
  valor_sessao_centavos INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_psicologos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- Janelas semanais de atendimento (0 = domingo … 6 = sábado).
CREATE TABLE horarios_disponiveis (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  psicologo_id INT     NOT NULL,
  dia_semana   TINYINT NOT NULL,
  hora_inicio  TIME    NOT NULL,
  hora_fim     TIME    NOT NULL,
  CONSTRAINT chk_horarios_dia CHECK (dia_semana BETWEEN 0 AND 6),
  CONSTRAINT chk_horarios_intervalo CHECK (hora_inicio < hora_fim),
  CONSTRAINT fk_horarios_psicologo FOREIGN KEY (psicologo_id) REFERENCES psicologos (id) ON DELETE CASCADE
);

-- Cursos e certificados do perfil público.
CREATE TABLE formacoes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  psicologo_id INT          NOT NULL,
  tipo         ENUM('certificado','curso') NOT NULL,
  titulo       VARCHAR(160) NOT NULL,
  instituicao  VARCHAR(160),
  ano          SMALLINT,
  CONSTRAINT fk_formacoes_psicologo FOREIGN KEY (psicologo_id) REFERENCES psicologos (id) ON DELETE CASCADE
);

-- Dados administrativos do cliente/paciente. usuario_id liga à conta de cliente, quando existe.
CREATE TABLE clientes_pacientes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNIQUE,
  nome            VARCHAR(120) NOT NULL,
  data_nascimento DATE,
  telefone        VARCHAR(30),
  email           VARCHAR(190),
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pacientes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
);

-- Associação psicólogo ↔ paciente. Arquivar = encerrar (não há exclusão).
CREATE TABLE vinculos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  psicologo_id        INT      NOT NULL,
  cliente_paciente_id INT      NOT NULL,
  situacao            ENUM('ativo','encerrado') NOT NULL DEFAULT 'ativo',
  inicio              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fim                 DATETIME,
  CONSTRAINT uq_vinculo UNIQUE (psicologo_id, cliente_paciente_id),
  CONSTRAINT fk_vinculos_psicologo FOREIGN KEY (psicologo_id) REFERENCES psicologos (id) ON DELETE CASCADE,
  CONSTRAINT fk_vinculos_paciente FOREIGN KEY (cliente_paciente_id) REFERENCES clientes_pacientes (id) ON DELETE CASCADE
);

-- Agenda, valor, pagamento e anotação clínica (criptografada pela aplicação, AES-256-GCM).
CREATE TABLE sessoes (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  psicologo_id        INT          NOT NULL,
  cliente_paciente_id INT          NOT NULL,
  inicio              DATETIME     NOT NULL,
  duracao_min         SMALLINT     NOT NULL DEFAULT 50,
  situacao            ENUM('agendada','realizada','cancelada','faltou') NOT NULL DEFAULT 'agendada',
  valor_centavos      INT UNSIGNED NOT NULL DEFAULT 0,
  pago                BOOLEAN      NOT NULL DEFAULT FALSE,
  anotacao_cripto     TEXT,
  criado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_sessoes_duracao CHECK (duracao_min BETWEEN 10 AND 240),
  CONSTRAINT fk_sessoes_psicologo FOREIGN KEY (psicologo_id) REFERENCES psicologos (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessoes_paciente FOREIGN KEY (cliente_paciente_id) REFERENCES clientes_pacientes (id) ON DELETE CASCADE,
  INDEX idx_sessoes_psicologo_inicio (psicologo_id, inicio)
);

-- entidade_inovacao — agenda com confirmação: o cliente pede um horário livre,
-- o psicólogo aceita (vira sessão + vínculo) ou recusa.
CREATE TABLE solicitacoes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  cliente_usuario_id INT      NOT NULL,
  psicologo_id       INT      NOT NULL,
  inicio             DATETIME NOT NULL,
  duracao_min        SMALLINT NOT NULL DEFAULT 50,
  mensagem           VARCHAR(500),
  situacao           ENUM('pendente','aceita','recusada','cancelada') NOT NULL DEFAULT 'pendente',
  resposta           VARCHAR(500),
  sessao_id          INT,
  criado_em          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_solicitacoes_cliente FOREIGN KEY (cliente_usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_solicitacoes_psicologo FOREIGN KEY (psicologo_id) REFERENCES psicologos (id) ON DELETE CASCADE,
  CONSTRAINT fk_solicitacoes_sessao FOREIGN KEY (sessao_id) REFERENCES sessoes (id) ON DELETE SET NULL,
  INDEX idx_solicitacoes_psicologo (psicologo_id, situacao)
);

-- Registro de ações relevantes: autor, ação, entidade e data/hora. Nunca guarda conteúdo clínico.
CREATE TABLE logs_acoes (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT,
  acao        VARCHAR(40)  NOT NULL,
  entidade    VARCHAR(20)  NOT NULL,
  entidade_id INT,
  detalhes    JSON,
  criado_em   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_logs_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  INDEX idx_logs_usuario (usuario_id, id)
);

-- O log é somente inserção: nem a aplicação nem o administrador alteram ou apagam registros.
CREATE TRIGGER logs_acoes_sem_update BEFORE UPDATE ON logs_acoes FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'logs_acoes e somente insercao';
CREATE TRIGGER logs_acoes_sem_delete BEFORE DELETE ON logs_acoes FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'logs_acoes e somente insercao';

-- ---------------------------------------------------------------------
-- Dados fictícios de demonstração
-- Senhas: admin123 · psicologo123 · cliente123 (gravadas como hash bcrypt)
-- Datas das sessões são relativas ao dia em que o script roda.
-- ---------------------------------------------------------------------

INSERT INTO perfis (id, nome, descricao) VALUES
  (1, 'admin',     'Administrador: gerencia usuários, perfis, cadastros e auditoria'),
  (2, 'psicologo', 'Psicólogo: gerencia seus pacientes, agenda e anotações de sessão'),
  (3, 'cliente',   'Cliente: encontra psicólogos e solicita horários');

INSERT INTO usuarios (id, perfil_id, nome, email, senha_hash) VALUES
  (1, 1, 'Admin Demo',  'admin@demo.com',     '$2a$10$t2H3vYQk.uCZWGVtHa.Tt.mxwpvyiFvLp9ADcVZ8e8ORdcaMzfrkG'),
  (2, 2, 'Ana Souza',   'psicologo@demo.com', '$2a$10$Q7tVbnO13geKTMwJ5f2HVeeWIpXBKR5bzXbrElwl5AeA8/ZKJsvVq'),
  (3, 2, 'Bruno Lima',  'bruno@demo.com',     '$2a$10$Q7tVbnO13geKTMwJ5f2HVeeWIpXBKR5bzXbrElwl5AeA8/ZKJsvVq'),
  (4, 2, 'Lia Moreira', 'lia@demo.com',       '$2a$10$Q7tVbnO13geKTMwJ5f2HVeeWIpXBKR5bzXbrElwl5AeA8/ZKJsvVq'),
  (5, 3, 'Carla Dias',  'cliente@demo.com',   '$2a$10$U02FAlr8i.oX0wHmLrBvveTXLDiHn9vtw30bwuWqLFI1fHhCsS5XK');

INSERT INTO psicologos (id, usuario_id, crp, area_atuacao, bio, valor_sessao_centavos) VALUES
  (1, 2, '03/12345', 'Psicologia clínica',        'Atendo adultos com ansiedade e depressão usando TCC. Sessões online e presenciais.', 18000),
  (2, 3, '06/54321', 'Neuropsicologia',           'Avaliação neuropsicológica de crianças e adultos, TDAH e reabilitação cognitiva.',   25000),
  (3, 4, '05/22222', 'Psicologia organizacional', 'Carreira, liderança e saúde mental no trabalho.',                                   15000);

INSERT INTO horarios_disponiveis (psicologo_id, dia_semana, hora_inicio, hora_fim) VALUES
  (1, 1, '08:00', '12:00'), (1, 1, '14:00', '18:00'),
  (1, 2, '08:00', '12:00'), (1, 2, '14:00', '18:00'),
  (1, 3, '08:00', '12:00'), (1, 3, '14:00', '18:00'),
  (1, 4, '08:00', '12:00'), (1, 4, '14:00', '18:00'),
  (1, 5, '08:00', '12:00'), (1, 5, '14:00', '18:00'),
  (2, 2, '09:00', '17:00'), (2, 4, '09:00', '17:00'),
  (3, 6, '09:00', '13:00');

INSERT INTO formacoes (psicologo_id, tipo, titulo, instituicao, ano) VALUES
  (1, 'curso',       'Especialização em Terapia Cognitivo-Comportamental', 'Instituto Fictício de Psicologia', 2019),
  (1, 'certificado', 'Terapia do Esquema — formação básica',               'Centro Demo',                      2022),
  (2, 'curso',       'Mestrado em Neurociências',                          'Universidade Exemplo',             2017),
  (3, 'certificado', 'Coaching de carreira',                               'Escola Modelo',                    2021);

INSERT INTO clientes_pacientes (id, usuario_id, nome, data_nascimento, telefone, email) VALUES
  (1, NULL, 'Marina Alves',      '1994-03-12', '(71) 99111-0001', 'marina@exemplo.com'),
  (2, NULL, 'João Pedro Santos', '1988-11-02', '(71) 99111-0002', NULL),
  (3, NULL, 'Lúcia Fernandes',   '2001-07-25', NULL,              'lucia@exemplo.com'),
  (4, NULL, 'Rafael Costa',      '1979-01-30', '(71) 99111-0004', NULL),
  (5, 5,    'Carla Dias',        NULL,         '(71) 98888-0000', 'cliente@demo.com');

INSERT INTO vinculos (psicologo_id, cliente_paciente_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (2, 4);

-- Horários em UTC: 12:00 UTC = 09:00 em Brasília (UTC−3).
INSERT INTO sessoes (psicologo_id, cliente_paciente_id, inicio, situacao, valor_centavos, pago) VALUES
  (1, 1, TIMESTAMP(UTC_DATE() - INTERVAL 14 DAY, '12:00'), 'realizada', 18000, TRUE),
  (1, 2, TIMESTAMP(UTC_DATE() - INTERVAL 7 DAY,  '13:00'), 'faltou',    18000, FALSE),
  (1, 1, TIMESTAMP(UTC_DATE() - INTERVAL 7 DAY,  '12:00'), 'realizada', 18000, TRUE),
  (1, 3, TIMESTAMP(UTC_DATE() - INTERVAL 6 DAY,  '18:00'), 'realizada', 18000, TRUE),
  (1, 4, TIMESTAMP(UTC_DATE() - INTERVAL 1 DAY,  '19:00'), 'realizada', 18000, FALSE),
  (1, 1, TIMESTAMP(UTC_DATE(),                   '12:00'), 'realizada', 18000, FALSE),
  (1, 2, TIMESTAMP(UTC_DATE(),                   '17:00'), 'agendada',  18000, FALSE),
  (1, 3, TIMESTAMP(UTC_DATE(),                   '19:00'), 'agendada',  18000, FALSE),
  (1, 4, TIMESTAMP(UTC_DATE() + INTERVAL 1 DAY,  '13:00'), 'agendada',  18000, FALSE),
  (1, 3, TIMESTAMP(UTC_DATE() + INTERVAL 3 DAY,  '14:00'), 'cancelada', 18000, FALSE),
  (1, 1, TIMESTAMP(UTC_DATE() + INTERVAL 7 DAY,  '12:00'), 'agendada',  18000, FALSE);

-- Pedido pendente da cliente Carla para a próxima segunda-feira às 10h (Brasília).
INSERT INTO solicitacoes (cliente_usuario_id, psicologo_id, inicio, mensagem) VALUES
  (5, 1, TIMESTAMP(UTC_DATE() + INTERVAL (7 - WEEKDAY(UTC_DATE())) DAY, '13:00'),
   'Olá! Gostaria de começar terapia por causa de ansiedade no trabalho.');

INSERT INTO logs_acoes (usuario_id, acao, entidade, entidade_id, detalhes) VALUES
  (1, 'cadastro', 'usuario', 1, JSON_OBJECT('origem', 'seed', 'perfil', 'admin')),
  (2, 'cadastro', 'usuario', 2, JSON_OBJECT('origem', 'seed', 'perfil', 'psicologo')),
  (3, 'cadastro', 'usuario', 3, JSON_OBJECT('origem', 'seed', 'perfil', 'psicologo')),
  (4, 'cadastro', 'usuario', 4, JSON_OBJECT('origem', 'seed', 'perfil', 'psicologo')),
  (5, 'cadastro', 'usuario', 5, JSON_OBJECT('origem', 'seed', 'perfil', 'cliente')),
  (5, 'solicitacao_criada', 'solicitacao', 1, NULL);

-- Conferência rápida
SELECT 'usuarios' AS tabela, COUNT(*) AS linhas FROM usuarios
UNION ALL SELECT 'psicologos', COUNT(*) FROM psicologos
UNION ALL SELECT 'clientes_pacientes', COUNT(*) FROM clientes_pacientes
UNION ALL SELECT 'sessoes', COUNT(*) FROM sessoes
UNION ALL SELECT 'solicitacoes', COUNT(*) FROM solicitacoes;
