# Inovação: agenda com confirmação

**Problema:** marcar consulta hoje é troca de mensagens — "tem horário quinta?", "só às 15h", "pode ser". O psicólogo perde
tempo, horários se chocam e nada fica registrado.

**Solução:** o cliente vê só os horários realmente livres do psicólogo e faz o pedido pelo sistema. O psicólogo confirma ou
recusa com um clique. Ao confirmar, o vínculo e a sessão nascem juntos, sem redigitar nada.

## Como os horários livres são calculados

Horários livres = janelas semanais de atendimento (`horarios_disponiveis`) **menos** sessões já agendadas **menos** pedidos
ainda pendentes. Assim dois clientes não pedem o mesmo horário e o psicólogo nunca recebe pedido para um horário ocupado.

## Fluxo

```mermaid
sequenceDiagram
  actor C as Cliente
  participant API
  participant DB as MySQL
  actor P as Psicólogo
  C->>API: GET /client/psychologists/:id
  API->>DB: janelas − sessões − pedidos pendentes
  API-->>C: perfil + horários livres
  C->>API: POST /client/requests {psychologistId, startsAt, message}
  API->>DB: INSERT solicitacoes (pendente) + log
  P->>API: GET /requests?status=pending
  P->>API: PATCH /requests/:id {action: "accept"}
  API->>DB: confere conflito de horário
  rect rgb(230, 245, 230)
    note over API,DB: transação única
    API->>DB: cria/reativa vínculo
    API->>DB: cria sessão com o valor do psicólogo
    API->>DB: solicitação = aceita, sessao_id
    API->>DB: logs solicitacao_aceita + sessao_agendada
  end
  C->>API: GET /client/sessions
  API-->>C: consulta confirmada (sem anotações)
```

## Estados de uma solicitação

```mermaid
stateDiagram-v2
  [*] --> pendente: cliente pede
  pendente --> aceita: psicólogo aceita
  pendente --> recusada: psicólogo recusa (com resposta)
  pendente --> cancelada: cliente cancela
  aceita --> [*]
  recusada --> [*]
  cancelada --> [*]
```

## Regras

- Só pedidos `pendente` podem ser respondidos ou cancelados (senão 409).
- Não dá para aceitar horário que já passou, nem horário que ficou ocupado depois do pedido.
- Aceitar é tudo-ou-nada: se qualquer passo falhar, nada é gravado.
- O cliente nunca vê anotações clínicas.

**Entidade de inovação no banco:** `solicitacoes` (ver [Banco de dados](Banco-de-Dados.md)).

## Valor gerado

- Menos troca de mensagens e nenhum choque de horário.
- O cliente se cadastra sozinho; o psicólogo não redigita dados.
- Todo pedido e resposta ficam registrados na auditoria.
