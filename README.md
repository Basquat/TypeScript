# UJCaps — PsicoGest

[![CI](https://github.com/Basquat/TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/Basquat/TypeScript/actions/workflows/ci.yml)

📚 **Documentação completa:** [Wiki](https://github.com/Basquat/TypeScript/wiki) · [pasta `docs/`](docs/Home.md) —
requisitos, casos de uso, arquitetura, DER, API, testes, inovação e manual do usuário.

Plataforma web de gestão para profissionais de Psicologia (AV3 — Projeto Integrador).
Front-end e back-end 100% em **TypeScript**.

| Camada | Tecnologias |
| ------ | ----------- |
| Banco  | MySQL 8 — script [`psicogest.sql`](psicogest.sql) |
| API    | Node.js 22/24, Express 5, mysql2, Zod, JWT, bcrypt, helmet |
| Web    | React 18, React Router 7, Vite 7 |

---

## 1. Banco de dados (MySQL)

O arquivo [`psicogest.sql`](psicogest.sql), na raiz do repositório, cria o banco `psicogest`, todas as tabelas,
chaves primárias e estrangeiras, restrições, triggers e os dados fictícios de demonstração.

**Pré-requisito:** MySQL Server 8 instalado ([dev.mysql.com/downloads/mysql](https://dev.mysql.com/downloads/mysql/)).

**Opção A — linha de comando**

No Windows (PowerShell), a pasta atual precisa ser a do projeto:

```powershell
cmd /c "mysql -u root -p < psicogest.sql"
```

No macOS/Linux:

```bash
mysql -u root -p < psicogest.sql
```

Se o `mysql` não for reconhecido no Windows, use o caminho completo do `mysql.exe` (ex.: `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe`).

**Opção B — MySQL Workbench**

1. Abra uma conexão com o servidor local.
2. *File → Open SQL Script…* e escolha `psicogest.sql`.
3. Execute o script inteiro (ícone do raio ⚡).

Ao final, o script mostra a contagem de linhas por tabela. Para conferir:

```sql
USE psicogest;
SHOW TABLES;
SELECT u.nome, p.nome AS perfil, u.situacao FROM usuarios u JOIN perfis p ON p.id = u.perfil_id;
```

> O script apaga e recria o banco `psicogest` a cada execução. Todos os dados são fictícios.

### Modelo de dados

```
perfis ─< usuarios ─1:1─ psicologos ─< vinculos >─ clientes_pacientes
              │               ├─< sessoes >───────────────┘
              │               ├─< horarios_disponiveis
              │               ├─< formacoes
              │               └─< solicitacoes >── usuarios (cliente)
              └─< logs_acoes
```

| Tabela | Finalidade |
| ------ | ---------- |
| `perfis` | Administrador, psicólogo e cliente |
| `usuarios` | Nome, e-mail, hash bcrypt da senha, situação (ativo / inativo / bloqueado) e perfil |
| `psicologos` | CRP, área de atuação, apresentação e valor da sessão (1:1 com `usuarios`) |
| `clientes_pacientes` | Dados administrativos do cliente/paciente |
| `vinculos` | Psicólogo ↔ paciente, com situação (ativo / encerrado), início e fim |
| `sessoes` | Agenda, duração, situação, valor, pagamento e anotação clínica criptografada |
| `horarios_disponiveis` | Janelas semanais de atendimento do psicólogo |
| `formacoes` | Cursos e certificados do psicólogo |
| `solicitacoes` | **Entidade de inovação** — pedidos de horário dos clientes |
| `logs_acoes` | Autor, ação, entidade e data/hora. Triggers impedem UPDATE e DELETE |

---

## 2. Rodando a aplicação

**Pré-requisitos:** Node.js 22 ou 24 ([nodejs.org](https://nodejs.org)) e o banco do passo 1 já importado.
Todos os comandos são executados na **pasta raiz do projeto** (a que contém `package.json` e `psicogest.sql`).

1. Crie o arquivo de configuração do back-end:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

   No macOS/Linux: `cp backend/.env.example backend/.env`

   Abra `backend/.env` e preencha `DB_PASSWORD` com a senha do usuário `root` do seu MySQL
   (ou troque `DB_USER`/`DB_PASSWORD` por outro usuário com acesso ao banco `psicogest`).
   Esse arquivo guarda senhas e não vai para o Git (já está no `.gitignore`).

2. Instale as dependências. Um único `npm install` na raiz instala o back-end e o front-end:

   ```powershell
   npm install
   ```

3. Suba a API e a interface juntas:

   ```powershell
   npm run dev
   ```

   - API: http://localhost:3333
   - Web: http://localhost:5173

Deixe esse terminal aberto enquanto usa a aplicação. Para parar, pressione `Ctrl+C`.

Abra **http://localhost:5173**. Tudo o que for cadastrado na aplicação é gravado no banco `psicogest` do MySQL.
A tela de login tem botões de acesso rápido para as contas criadas pelo script:

| Perfil | E-mail | Senha |
| ------ | ------ | ----- |
| Administrador | admin@demo.com | admin123 |
| Psicóloga | psicologo@demo.com | psicologo123 |
| Cliente | cliente@demo.com | cliente123 |

Outros comandos:

| Comando | O que faz |
| ------- | --------- |
| `npm test` | 21 testes de integração da API. Cria um banco separado `psicogest_test` a partir do `psicogest.sql` |
| `npm run typecheck` | Verifica os tipos do back e do front |
| `npm run build` e `npm start` | Versão compilada (API + front) em http://localhost:3333 |

Em produção, preencha também `JWT_SECRET` e `NOTES_KEY` no `backend/.env`.

### Problemas comuns

| Sintoma | Causa e solução |
| ------- | --------------- |
| `ER_ACCESS_DENIED_ERROR` ao rodar `npm run dev` ou `npm test` | `DB_USER`/`DB_PASSWORD` em `backend/.env` não batem com o MySQL. Corrija e rode de novo. |
| `ER_BAD_DB_ERROR` / `Unknown database 'psicogest'` | O `psicogest.sql` não foi importado. Volte ao passo 1. |
| `'mysql' não é reconhecido` (Windows) | O cliente MySQL não está no PATH. Use o caminho completo do `mysql.exe` ou o MySQL Workbench. |
| `npm.ps1 não pode ser carregado` (Windows) | Use `npm.cmd install` e `npm.cmd run dev` no lugar de `npm`. |
| `EADDRINUSE` na porta 3333 | Outro processo usa a porta. Feche o `npm run dev` anterior ou troque `PORT` em `backend/.env`. |
| Aviso `JWT_SECRET não definido` ou `NOTES_KEY não definido` | Normal em desenvolvimento. Em produção são obrigatórios. |
| Login não aceita os botões de demonstração | Confira se o script rodou: `SELECT COUNT(*) FROM psicogest.usuarios;` deve retornar `5`. |

---

## 3. Funcionalidades

**Administrador** — painel com totais e contas por situação/perfil; cadastra, edita, **ativa, bloqueia e inativa** usuários
e define o perfil (ninguém altera o próprio acesso); cadastra pacientes e os vincula a psicólogos; consulta a auditoria completa.

**Psicólogo** — painel do dia com indicadores (sessões na semana, a receber, comparecimento); agenda semanal e mensal com
bloqueio de conflito e sessões semanais recorrentes; pacientes com busca e arquivamento; anotações de sessão
criptografadas (AES-256-GCM); perfil profissional com horários de atendimento e formação; responde solicitações.

**Cliente** — encontra psicólogos por nome ou área, vê horários realmente livres, pede um horário e acompanha suas consultas.

### Inovação: agenda com confirmação

O cliente escolhe um horário livre (janelas do psicólogo menos sessões e pedidos pendentes). O psicólogo confirma ou recusa;
ao confirmar, o vínculo e a sessão são criados numa única transação.

### Segurança

Senhas só em hash bcrypt · JWT com perfil e situação relidos do banco a cada requisição (bloqueio vale na hora) ·
autorização validada no back-end · validação de entrada com Zod · limite de tentativas no login ·
anotações clínicas criptografadas e nunca registradas em log · auditoria somente-inserção.

---

## 4. API (resumo)

```
POST /api/auth/register · POST /api/auth/login · GET /api/auth/me · GET /api/logs

Psicólogo   /api/patients · /api/sessions · /api/summary · /api/profile · /api/requests
Cliente     /api/client/psychologists · /api/client/requests · /api/client/sessions
Admin       /api/admin/summary · /api/admin/users · /api/admin/patients · /api/admin/logs
```

---

## 5. Estrutura

```
psicogest.sql   Banco MySQL: estrutura + dados fictícios
backend/        API Express + TypeScript (rotas, regras, autenticação, testes)
frontend/       Interface React + TypeScript (telas de admin, psicólogo e cliente)
docs/           Documentação completa (espelhada na Wiki)
AV3-UJ.docx     Enunciado da atividade
```
