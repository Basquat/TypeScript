# Contexto e requisitos

## Situação-problema

Profissionais de Psicologia — clínica, organizacional, escolar, hospitalar, jurídica e outras áreas — costumam controlar
clientes, agenda e atendimentos em planilhas, agendas pessoais e aplicativos de mensagem. Isso gera retrabalho, cadastros
duplicados, nenhuma rastreabilidade de quem alterou o quê e risco de acesso indevido a dados sensíveis.

A organização que contratou o sistema também não tem como saber quem pode acessar a plataforma, nem acompanhar usuários
ativos, inativos e bloqueados.

**Problema:** como oferecer uma plataforma segura, organizada e flexível que centralize a gestão dos psicólogos e de seus
clientes/pacientes, com controle de acesso, persistência em MySQL e integração completa entre front-end e back-end?

## Objetivos

**Geral:** entregar uma aplicação web responsiva que centralize cadastro, agenda e acompanhamento de atendimentos, com controle de acesso por perfil e auditoria.

**Específicos:**
- Autenticar usuários com e-mail e senha (hash bcrypt) e direcionar cada perfil ao seu painel.
- Permitir ao administrador gerenciar contas, perfis e situação (ativo / inativo / bloqueado).
- Permitir ao psicólogo gerenciar seus pacientes, agenda, anotações e perfil profissional.
- Permitir ao cliente encontrar psicólogos e pedir horários (inovação).
- Registrar ações relevantes numa auditoria somente-inserção.
- Persistir tudo em MySQL com integridade referencial.

## Público-alvo e perfis de acesso

| Perfil | Quem é | Pode | Não pode |
| --- | --- | --- | --- |
| **Administrador** | Gestor da organização | Ver indicadores; cadastrar, editar, ativar, bloquear e inativar usuários; definir perfis; cadastrar pacientes e vinculá-los a psicólogos; consultar toda a auditoria | Ver senhas; apagar ou alterar logs; alterar o próprio perfil/situação |
| **Psicólogo** | Profissional de qualquer área | Gerenciar os próprios pacientes, sessões, anotações, horários e formação; responder pedidos de horário | Ver pacientes de outros psicólogos; acessar o painel admin |
| **Cliente** | Pessoa que busca atendimento | Buscar psicólogos, ver horários livres, pedir e cancelar horários, ver as próprias consultas | Ver anotações clínicas; ver dados de outros clientes |

> O perfil opcional "Atendente" do enunciado não foi implementado — ver [Conclusão](Conclusao.md).

## Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF01 | Login com e-mail e senha; logout; rotas internas protegidas |
| RF02 | Identificar o perfil após o login e abrir o painel correspondente |
| RF03 | Cadastro público de psicólogo (com CRP) ou cliente; admin só é criado por outro admin ou pelo script SQL |
| RF04 | Painel admin com totais de usuários, psicólogos e pacientes e contas por situação/perfil |
| RF05 | Admin cadastra, consulta, edita, ativa, bloqueia e inativa usuários e define o perfil |
| RF06 | Admin cadastra pacientes já vinculados a um psicólogo e altera vínculos |
| RF07 | Admin consulta a auditoria completa com busca |
| RF08 | Psicólogo cadastra, edita, pesquisa, arquiva e reativa pacientes |
| RF09 | Psicólogo agenda sessões (únicas ou semanais), com bloqueio de horário sobreposto |
| RF10 | Psicólogo registra situação, valor, pagamento e anotação de cada sessão |
| RF11 | Psicólogo vê painel com indicadores (sessões da semana, a receber, comparecimento) |
| RF12 | Psicólogo mantém perfil profissional: área, apresentação, valor, horários e formação |
| RF13 | Cliente busca psicólogos por nome/área e vê horários livres |
| RF14 | Cliente pede horário; psicólogo aceita ou recusa; cliente pode cancelar pedido pendente |
| RF15 | Cada usuário vê o próprio histórico de atividade |

## Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF01 | Back-end Node.js + TypeScript, API REST (Express 5) |
| RNF02 | Front-end React + TypeScript, responsivo |
| RNF03 | MySQL 8 com PK, FK, `UNIQUE`, `CHECK`, triggers e dados fictícios |
| RNF04 | Senhas em bcrypt; JWT (HS256, 8 h); segredos em variáveis de ambiente |
| RNF05 | Anotações clínicas criptografadas com AES-256-GCM |
| RNF06 | Validação de toda entrada com Zod; erros sem detalhes internos |
| RNF07 | Limite de tentativas no login/cadastro; cabeçalhos de segurança (helmet) |
| RNF08 | Testes automatizados de integração da API |

## Regras de negócio

1. Só usuário autenticado e **ativo** acessa páginas internas; perfil e situação são relidos do banco a cada requisição (bloqueio vale na hora).
2. Só o administrador ativa, bloqueia ou inativa usuários e altera perfis.
3. Ninguém altera o próprio perfil ou situação — o admin inclusive.
4. Senhas nunca são exibidas nem armazenadas em texto puro.
5. Psicólogo só vê pacientes com vínculo com ele.
6. Autorização sempre validada no back-end, mesmo com o botão oculto no front.
7. Sem exclusão de histórico: paciente é **arquivado** (vínculo encerrado), não apagado; sessão com anotação não pode ser excluída.
8. Toda entrada é validada antes de gravar no MySQL.
9. Erros retornam mensagem compreensível, sem stack trace nem credenciais.
10. Sessões do mesmo psicólogo não podem se sobrepor; série semanal é tudo-ou-nada.
11. Auditoria é somente-inserção: triggers do MySQL recusam `UPDATE` e `DELETE` em `logs_acoes`; conteúdo clínico nunca vai para o log.
12. Todos os dados de demonstração são fictícios.

## Escopo

**Dentro:** autenticação, três perfis, painel admin, pacientes, vínculos, sessões, anotações criptografadas, perfil profissional, agenda com confirmação, auditoria.

**Fora:** pagamentos online, videochamada, notificações por e-mail/SMS, prontuário completo, aplicativo móvel nativo.
