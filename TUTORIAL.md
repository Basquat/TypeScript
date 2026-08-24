# TUTORIAL - Como rodar o projeto sozinho

## O que voce precisa instalar no Fedora Linux

### 1. Node.js (versao 18 ou superior)
O Node.js e necessario para rodar o front-end e o futuro back-end.

Instale pelo terminal:
```bash
sudo dnf install nodejs npm
```

Verifique a instalacao:
```bash
node -v
npm -v
```

### 2. MySQL (banco de dados)
Necessario para o back-end e persistencia dos dados.

Instale pelo terminal:
```bash
sudo dnf install mysql-server
sudo systemctl enable --now mysqld
sudo mysql_secure_installation
```

### 3. (Opcional) VS Code
Editor de codigo recomendado.
```bash
sudo dnf install code
```

---

## Como rodar o FRONT-END (ja esta pronto)

```bash
cd /home/basquat/Documentos/ProjetoTypeScript/frontend
npm install
npm run dev
```

Acesse no navegador:
```
http://localhost:3000
```

**O que acontece agora:** A tela de login esta desativada temporariamente e voce entra direto no Painel do Administrador com dados de demonstracao.

Para reativar o login depois, basta restaurar o arquivo `frontend/src/main.ts` para a versao anterior.

---

## Como rodar o BACK-END (ainda nao implementado)

Quando o back-end for criado, voce precisara de uma pasta `backend/` na raiz do projeto com:
- `package.json`
- `tsconfig.json`
- `src/server.ts` (servidor Express/Fastify)
- `src/routes/` (rotas da API)
- `src/services/` (regras de negocio)
- `.env` (variaveis de ambiente)

Comandos tipicos:
```bash
cd backend
npm install
npm run dev
```

Acesse a API em:
```
http://localhost:4000
```

---

## Estrutura do projeto

```
ProjetoTypeScript/
├── frontend/          # Front-end (ja pronto)
│   ├── src/
│   └── package.json
├── backend/           # Back-end (criar depois)
├── database/          # Scripts SQL do MySQL (criar depois)
├── memorias.md
└── README.md
```

---

## Comandos uteis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` (no frontend) | Inicia o servidor de desenvolvimento na porta 3000 |
| `npm run build` (no frontend) | Gera a versao de producao |
| `npm install` | Instala as dependencias do projeto |
| `sudo systemctl status mysqld` | Verifica se o MySQL esta rodando |
| `sudo systemctl start mysqld` | Inicia o MySQL |
