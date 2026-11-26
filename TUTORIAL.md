# TUTORIAL - Como rodar o projeto sozinho

## O que voce precisa instalar no Fedora Linux

### 1. Node.js (versao 22 ou 24)
O Node.js roda o front-end e o back-end.

```bash
sudo dnf install nodejs npm
node -v
npm -v
```

### 2. (Opcional) VS Code
```bash
sudo dnf install code
```

O banco desta versao e um arquivo SQLite criado automaticamente em `backend/data/psi.db`, entao nao e preciso instalar servidor de banco para rodar.

---

## Como rodar (front-end + back-end juntos)

Na raiz do projeto:

```bash
npm install
npm run seed
npm run dev
```

Acesse no navegador:
```
http://localhost:5173
```

A API roda em `http://localhost:3333` (o front repassa `/api` para ela).

Na tela de login ha botoes de demonstracao (Admin, Psicologa, Cliente) que entram com as contas criadas pelo `npm run seed`.

Para comecar do zero, apague `backend/data/psi.db` e rode `npm run seed` de novo.

---

## Estrutura do projeto

```
ProjetoTypeScript/
├── backend/           # API Express + TypeScript (rotas, regras, banco, testes)
│   └── src/
├── frontend/          # React + TypeScript (telas de admin, psicologo e cliente)
│   └── src/
├── package.json       # scripts que rodam os dois juntos
├── memorias.md
└── README.md
```

---

## Comandos uteis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Inicia API (3333) e front (5173) |
| `npm test` | Roda os testes da API |
| `npm run typecheck` | Verifica os tipos do back e do front |
| `npm run build` | Gera a versao de producao |
| `npm run seed` | Cria os dados ficticios de demonstracao |
