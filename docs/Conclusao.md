# Conclusão, limitações e referências

## Conclusão

O PsicoGest entrega o escopo mínimo da AV3 integrado de ponta a ponta: login com três perfis, painel administrativo com
gestão de acesso, cadastro de psicólogos e pacientes com vínculos, agenda e anotações seguras, auditoria somente-inserção e,
como inovação, a agenda com confirmação. Tudo persiste em MySQL e as regras de autorização são validadas no back-end e
cobertas por testes automatizados.

## Limitações

- **Logout sem invalidar o token no servidor:** o JWT é sem estado; sair descarta o token no navegador. Mitigado pela releitura da situação da conta a cada requisição e pela validade de 8 h.
- **Perfil "Atendente"** (opcional no enunciado) não foi implementado.
- **Paciente sem situação própria:** ativo/arquivado é a situação do vínculo com o psicólogo.
- Rotas adaptadas da API sugerida (ver [API](API.md#correspondência-com-a-api-sugerida-no-enunciado)).
- Sem notificações por e-mail; o psicólogo vê pedidos pendentes no painel.
- Sem HTTPS próprio: em produção deve ficar atrás de um proxy reverso com TLS.

## Possíveis melhorias

- Lista de tokens revogados (ou refresh token) para logout no servidor.
- Perfil Atendente com acesso só a cadastros administrativos.
- Lembretes por e-mail/WhatsApp antes da sessão.
- Formulários de anamnese configuráveis por área de atuação.
- Relatórios administrativos exportáveis (PDF/CSV).
- Testes de interface (end-to-end) no front.

## Referências

- Conselho Federal de Psicologia. *Resolução CFP nº 001/2009* — registro documental decorrente da prestação de serviços psicológicos.
- Brasil. *Lei nº 13.709/2018* — Lei Geral de Proteção de Dados Pessoais (LGPD).
- Express 5 — https://expressjs.com
- React — https://react.dev
- MySQL 8 Reference Manual — https://dev.mysql.com/doc/refman/8.0/en/
- Zod — https://zod.dev
- OWASP Password Storage Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- RFC 7519 — JSON Web Token (JWT)
- NIST SP 800-38D — modo GCM (AES-GCM)
