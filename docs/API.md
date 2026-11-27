# API REST

Base: `http://localhost:3333/api` · JSON · autenticação por `Authorization: Bearer <token>` (JWT, válido por 8 h).

Erros sempre no formato `{ "error": "mensagem" }`:

| Status | Quando |
| --- | --- |
| 400 | Entrada inválida (Zod) ou JSON malformado |
| 401 | Sem token, token inválido/expirado, login errado |
| 403 | Conta não ativa ou perfil sem permissão |
| 404 | Recurso inexistente ou de outro dono |
| 409 | Conflito: e-mail/CRP repetido, horário ocupado, pedido já respondido |
| 429 | Muitas tentativas de login/cadastro |
| 500 | Erro interno (mensagem genérica, detalhe só no log do servidor) |

## Público

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Verifica se a API está no ar |
| POST | `/auth/register` | Cadastro público. Body `tipo: "psicologo"` (`name, email, password, crp, areaAtuacao?`) ou `tipo: "cliente"` (`name, email, password, phone?, birthDate?`). Retorna `{ token, user }` |
| POST | `/auth/login` | Body `{ email, password }`. Retorna `{ token, user }` |

## Qualquer usuário logado

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/auth/me` | Usuário logado (perfil e situação atuais) |
| GET | `/logs?limit=50` | Histórico de ações do próprio usuário |

**Logout:** o JWT não guarda estado no servidor; sair = o front descarta o token (`localStorage`). Uma conta bloqueada perde o acesso na hora porque cada requisição relê a situação no banco.

## Psicólogo (`perfil = psicologo`)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/patients?q=&archived=0\|1` | Lista pacientes vinculados, com busca por nome e filtro de arquivados |
| POST | `/patients` | Cadastra paciente e cria o vínculo. Body `name, birthDate?, phone?, email?` |
| GET | `/patients/:id` | Paciente vinculado |
| PATCH | `/patients/:id` | Edita dados; `active: false` arquiva (encerra vínculo), `true` reativa |
| GET | `/sessions?from=&to=&patientId=&status=` | Lista sessões |
| POST | `/sessions` | Agenda. Body `patientId, startsAt (ISO), durationMin=50, feeCents=0, repeatWeeks=1..12` |
| GET | `/sessions/:id` | Sessão com anotação decifrada |
| PATCH | `/sessions/:id` | `startsAt, durationMin, status, feeCents, paid, note` |
| DELETE | `/sessions/:id` | Exclui só sessão `agendada` e sem anotação (senão 409: marque como cancelada) |
| GET | `/summary` | Indicadores do painel: pacientes ativos, sessões da semana, a receber, comparecimento, pedidos pendentes |
| GET | `/profile` | Perfil profissional |
| PUT | `/profile` | `name, areaAtuacao?, bio?, feeCents, availability: [{ weekday 0–6, start "HH:MM", end "HH:MM" }]` |
| POST | `/profile/education` | Adiciona formação `kind, title, institution?, year?` |
| DELETE | `/profile/education/:id` | Remove formação |
| GET | `/requests?status=pending` | Pedidos de horário recebidos |
| PATCH | `/requests/:id` | `{ action: "accept" \| "decline", reply? }` — aceitar cria vínculo + sessão numa transação |

## Cliente (`perfil = cliente`)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/client/psychologists?q=` | Busca psicólogos por nome ou área |
| GET | `/client/psychologists/:id` | Perfil público + horários livres |
| GET | `/client/requests` | Meus pedidos |
| POST | `/client/requests` | Pede horário: `psychologistId, startsAt, message?` |
| PATCH | `/client/requests/:id` | `{ action: "cancel" }` — cancela pedido pendente |
| GET | `/client/sessions` | Minhas consultas (sem anotações) |

## Administrador (`perfil = admin`)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/admin/summary` | Totais de usuários, psicólogos, pacientes e contas por situação/perfil |
| GET | `/admin/users?q=&perfil=&situacao=` | Lista usuários com filtros |
| POST | `/admin/users` | Cria usuário de qualquer perfil (`perfil, name, email, password, crp?, …`) |
| PATCH | `/admin/users/:id` | Edita dados, `situacao` e `perfil` (recusado para a própria conta) |
| GET | `/admin/patients?q=` | Todos os pacientes |
| POST | `/admin/patients` | Cadastra paciente já vinculado: `psychologistId` + dados |
| PATCH | `/admin/patients/:id` | Edita dados; `linkPsychologistId` cria/reativa vínculo |
| GET | `/admin/logs?limit=200&q=` | Auditoria completa |

## Correspondência com a API sugerida no enunciado

| Sugerida | Implementada |
| --- | --- |
| `POST /api/auth/login` | `POST /api/auth/login` |
| `POST /api/auth/logout` | Logout no cliente (JWT sem estado) |
| `GET/POST /api/users`, `PATCH /api/users/:id` | `/api/admin/users` |
| `GET/POST /api/psychologists` | `/api/admin/users` com `perfil=psicologo`; catálogo em `/api/client/psychologists` |
| `GET/POST /api/patients`, `GET/PATCH /api/patients/:id` | `/api/patients` (psicólogo) e `/api/admin/patients` (admin) |
| `GET /api/audit-logs` | `/api/admin/logs` (tudo) e `/api/logs` (próprio usuário) |

## Exemplo

```bash
TOKEN=$(curl -s -X POST localhost:3333/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"psicologo@demo.com","password":"psicologo123"}' | jq -r .token)

curl -s localhost:3333/api/patients -H "authorization: Bearer $TOKEN"
```
