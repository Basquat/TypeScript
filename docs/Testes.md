# Testes

## Plano

Testes de **integração** da API em [`backend/src/app.test.ts`](../backend/src/app.test.ts), com `node:test`.
Antes de rodar, o teste recria um banco separado `psicogest_test` a partir do próprio `psicogest.sql` — então o script SQL
também é testado. Cada teste sobe a API de verdade e faz chamadas HTTP contra um MySQL real (nada é simulado).

```powershell
npm test
```

O GitHub Actions ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) roda `typecheck`, `test` e `build` com um MySQL 8.4
a cada push na `main` e em todo pull request. O resultado de cada execução fica na aba **Actions** do repositório.

## Casos

| Grupo | Caso | Regra coberta |
| --- | --- | --- |
| Modelo de dados | Perfis e todas as entidades mínimas existem | Modelo mínimo do enunciado |
| Autenticação | Cadastra psicólogo (usuário + psicologos), entra e retorna o usuário | RF01, RF03 |
| | Rejeita senha errada, e-mail repetido, CRP repetido e CRP inválido | RN8, RN9 |
| | Bloqueia rotas sem token ou com token falso | RN1 |
| | Conta bloqueada perde acesso na hora, mesmo com token válido | RN1, RN2 |
| Pacientes e sessões | Cadastrar paciente cria o vínculo | RF08 |
| | Agenda sessão e impede horários sobrepostos | RN10 |
| | Anotações ficam cifradas no banco e voltam legíveis pela API | RNF05 |
| | Não exclui sessão com anotações | RN7 |
| | Resumo financeiro conta sessões realizadas e não pagas | RF11 |
| | Outro psicólogo sem vínculo não vê nem altera dados alheios | RN5 |
| | Arquivar encerra o vínculo e impede agendar; reativar reabre | RN7 |
| Auditoria | Registra ações relevantes sem vazar conteúdo clínico | RN11 |
| | Cada psicólogo vê só o próprio histórico | RN5 |
| | É somente-inserção: UPDATE e DELETE recusados pelo banco | RN11 |
| | Login e tentativa falha ficam registrados | RN11 |
| Administrador | Só admin acessa `/admin`; cadastro público não cria admin | RN2, RN3 |
| | Cria usuário, bloqueia e não altera o próprio perfil | RF05, RN3 |
| | Cadastra paciente já vinculado a um psicólogo | RF06 |
| Inovação | Cliente pede horário livre, psicólogo aceita e a sessão aparece sem anotações | RF14 |
| | Sessão semanal cria N sessões e recusa todas se uma colidir | RN10 |

**Total: 21 testes.** Os códigos RF/RNF/RN referem-se a [Contexto e requisitos](Contexto-e-Requisitos.md).

## Resultados

Execução no GitHub Actions em 27/11/2026 (MySQL 8.4, Node 22):
[run 46058621841](https://github.com/Basquat/TypeScript/actions/runs/46058621841)

```
# tests 21
# suites 6
# pass 21
# fail 0
```

`npm run typecheck` e `npm run build` também passaram no mesmo job. Execuções mais recentes ficam na aba **Actions**.

## Testes manuais (fluxos principais)

| # | Fluxo | Resultado esperado |
| --- | --- | --- |
| 1 | Entrar com cada conta demo | Abre o painel do perfil |
| 2 | Admin bloqueia a psicóloga; ela tenta navegar | A próxima ação dela é recusada: "Esta conta não está ativa" |
| 3 | Psicóloga agenda duas sessões no mesmo horário | A segunda é recusada |
| 4 | Cliente pede horário; psicóloga aceita | Sessão aparece na agenda e em "Consultas" do cliente |
| 5 | Admin abre a auditoria | Todas as ações acima aparecem com autor e data/hora |
