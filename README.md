# UJCaps — PsicoGest

Plataforma web de gestão para profissionais de Psicologia (AV3 — Projeto Integrador).
Front-end e back-end 100% em **TypeScript**.

| Camada | Tecnologias |
| ------ | ----------- |
| API    | Node 22/24, Express, SQLite (better-sqlite3), Zod, JWT, bcrypt, helmet, rate limit |
| Web    | React 18, React Router 7, Vite 7 — tema escuro próprio, sem biblioteca de UI |

## Perfis e funcionalidades

**Administrador**
- Visão geral: usuários, psicólogos, pacientes, sessões futuras, pedidos pendentes, contas por situação e por perfil.
- Usuários: cadastrar (qualquer perfil), editar, trocar perfil, **ativar / bloquear / inativar**. Ninguém altera o próprio perfil ou a própria situação.
- Pacientes: cadastrar já vinculado a um psicólogo, editar, vincular a mais psicólogos.
- Auditoria completa (`logs_acoes`), com autor e filtro.

**Psicólogo**
- Hoje: indicadores (sessões na semana, a receber, recebido no mês, comparecimento em 30 dias, solicitações), linha do tempo e próxima sessão.
- Agenda semanal e mensal, com bloqueio de horários sobrepostos e **sessões semanais recorrentes** (4, 8 ou 12 semanas, tudo ou nada).
- Pacientes: cadastro (cria o vínculo), busca, arquivar/reativar (sem exclusão: prontuário tem prazo de guarda).
- Sessão: situação, valor, pagamento e **anotações criptografadas (AES-256-GCM)**.
- Perfil profissional: apresentação, valor padrão, janelas semanais de atendimento, cursos e certificados.
- **Solicitações** (funcionalidade de inovação): confirmar ou recusar pedidos de horário; confirmar cria vínculo + sessão.

**Cliente**
- Catálogo de psicólogos ativos com busca por nome ou área.
- Perfil público com **horários livres reais** (janelas do psicólogo menos sessões e pedidos pendentes) e pedido de horário com mensagem.
- Minhas consultas: pedidos (cancelar pendentes), próxima consulta e histórico. Nunca vê anotações clínicas.

## Funcionalidade de inovação — agenda com confirmação

Tabela `solicitacoes` (a `entidade_inovacao` do modelo). O cliente escolhe um horário livre; o psicólogo confirma ou recusa.
Ao confirmar, o sistema cria (ou reabre) o vínculo e agenda a sessão com o valor do perfil, numa única transação.

## Como rodar

Requisito: Node.js 22 ou 24 (LTS).

```bash
npm install
npm run seed     # dados fictícios de demonstração (roda uma vez)
npm run dev      # API em :3333 e web em http://localhost:5173
```

Contas de demonstração (fictícias, criadas pelo seed; também há botões na tela de login):

| Perfil | E-mail | Senha |
| ------ | ------ | ----- |
| Administrador | admin@demo.com | admin123 |
| Psicóloga | psicologo@demo.com | psicologo123 |
| Cliente | cliente@demo.com | cliente123 |

Produção:

```bash
cp backend/.env.example backend/.env   # preencha JWT_SECRET e NOTES_KEY
npm run build
npm start                              # API + front compilado em http://localhost:3333
```

Gere os segredos com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Faça backup do `NOTES_KEY` (sem ele as anotações não podem ser lidas) e do banco (`backend/data/psi.db`).

## Comandos

| Comando | O que faz |
| ------- | --------- |
| `npm run dev` | API + web com recarga automática |
| `npm test` | Testes de integração da API (banco em memória) |
| `npm run typecheck` | Verifica tipos do back e do front |
| `npm run build` | Compila back e front |
| `npm run seed` | Popula o banco com dados fictícios |

## Modelo de dados

```
perfis ─< usuarios ─1:1─ psicologos ─< vinculos >─ clientes_pacientes
              │               ├─< sessoes >───────────────┘
              │               ├─< horarios_disponiveis, formacoes
              │               └─< solicitacoes >─ usuarios (cliente)
              └─< logs_acoes   (somente inserção: triggers bloqueiam UPDATE/DELETE)
```

## API (resumo)

```
POST /api/auth/register  (tipo: psicologo | cliente)   POST /api/auth/login   GET /api/auth/me
GET  /api/logs                                          (histórico do próprio usuário)

Psicólogo
GET|POST /api/patients            GET|PATCH /api/patients/:id
GET|POST /api/sessions            GET|PATCH|DELETE /api/sessions/:id   (POST aceita repeatWeeks)
GET /api/summary                  GET|PUT /api/profile   POST|DELETE /api/profile/education[/:id]
GET /api/requests                 PATCH /api/requests/:id  (accept | decline)

Cliente
GET /api/client/psychologists     GET /api/client/psychologists/:id  (perfil + horários livres)
GET|POST /api/client/requests     PATCH /api/client/requests/:id  (cancel)
GET /api/client/sessions

Administrador
GET /api/admin/summary            GET|POST /api/admin/users     PATCH /api/admin/users/:id
GET|POST /api/admin/patients      PATCH /api/admin/patients/:id GET /api/admin/logs
```

A autorização é sempre validada no back-end: perfil e situação da conta são relidos do banco a cada requisição.

## Pendências conhecidas

- **Banco**: a AV3 exige MySQL; esta versão usa SQLite. A troca fica concentrada em `backend/src/db.ts` e nas consultas das rotas.
- Só as anotações são criptografadas em nível de campo; nome e contato do paciente ficam em texto no banco.
- O JWT fica no `localStorage`; para endurecer, migrar para cookie `HttpOnly`.
- Horários livres usam o fuso do servidor.
