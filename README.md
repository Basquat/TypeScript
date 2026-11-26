# UJCaps — PsicoGest

Plataforma web de gestão para profissionais de Psicologia (AV3 — Projeto Integrador).
Front-end e back-end 100% em **TypeScript**.

| Camada | Tecnologias |
| ------ | ----------- |
| Banco  | MySQL 8 — script [`psicogest.sql`](psicogest.sql) |
| API    | Node.js 22/24, Express, Zod, JWT, bcrypt, helmet — grava num arquivo SQLite local (`backend/data/psi.db`) com o mesmo modelo |
| Web    | React 18, React Router 7, Vite 7 |

---

## 1. Banco de dados (MySQL)

O arquivo [`psicogest.sql`](psicogest.sql), na raiz do repositório, cria o banco `psicogest`, todas as tabelas,
chaves primárias e estrangeiras, restrições, triggers e os dados fictícios de demonstração.

**Pré-requisito:** MySQL Server 8 instalado ([dev.mysql.com/downloads/mysql](https://dev.mysql.com/downloads/mysql/)).

**Opção A — linha de comando**

```bash
mysql -u root -p < psicogest.sql
```

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

**Pré-requisito:** Node.js 22 ou 24 ([nodejs.org](https://nodejs.org)).

```bash
npm install
npm run seed     # cria as contas de demonstração
npm run dev      # API em :3333 · web em http://localhost:5173
```

Abra **http://localhost:5173**. A tela de login tem botões de acesso rápido:

| Perfil | E-mail | Senha |
| ------ | ------ | ----- |
| Administrador | admin@demo.com | admin123 |
| Psicóloga | psicologo@demo.com | psicologo123 |
| Cliente | cliente@demo.com | cliente123 |

Outros comandos: `npm test` (testes da API), `npm run typecheck`, `npm run build` e `npm start` (versão compilada em `:3333`).
Em produção, copie `backend/.env.example` para `backend/.env` e preencha `JWT_SECRET` e `NOTES_KEY`.

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
AV3-UJ.docx     Enunciado da atividade
```
