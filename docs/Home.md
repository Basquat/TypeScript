# PsicoGest — Documentação

| | |
|---|---|
| **Disciplina** | Projeto Integrador — AV3 |
| **Título** | PsicoGest: plataforma web de gestão para profissionais de Psicologia |
| **Turma** | _(preencher)_ |
| **Integrantes** | _(preencher)_ |
| **Data** | _(preencher)_ |

## Resumo do produto

O **PsicoGest** centraliza, num único sistema web, o que hoje fica espalhado em planilhas, agendas e aplicativos de mensagem:
cadastro de psicólogos e de clientes/pacientes, vínculos entre eles, agenda de sessões, anotações clínicas e controle de acesso.
Há três perfis — **administrador**, **psicólogo** e **cliente** — e toda ação relevante fica registrada numa auditoria que nem o administrador consegue apagar.

O diferencial é a **agenda com confirmação**: o cliente vê os horários realmente livres de um psicólogo, pede um horário, e o
psicólogo confirma ou recusa. Ao confirmar, o vínculo e a sessão são criados numa única transação.

Front-end (React) e back-end (Express) em **TypeScript**, banco **MySQL 8**.

## Páginas

1. [Contexto e requisitos](Contexto-e-Requisitos.md) — situação-problema, objetivos, perfis, requisitos, regras de negócio
2. [Casos de uso](Casos-de-Uso.md) — histórias de usuário por perfil
3. [Arquitetura](Arquitetura.md) — camadas, tecnologias, organização do código, segurança
4. [Banco de dados](Banco-de-Dados.md) — DER e dicionário de dados
5. [API](API.md) — todas as rotas REST
6. [Telas e navegação](Telas-e-Navegacao.md) — telas por perfil e fluxo
7. [Instalação e execução](Instalacao.md)
8. [Testes](Testes.md) — plano e resultados
9. [Inovação: agenda com confirmação](Inovacao.md)
10. [Manual do usuário](Manual-do-Usuario.md)
11. [Conclusão e referências](Conclusao.md)
