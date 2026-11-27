# Instalação e execução

O passo a passo completo (Windows, macOS/Linux e solução de problemas) está no [README](../README.md). Resumo:

**Pré-requisitos:** MySQL 8 e Node.js 22 ou 24.

```powershell
# 1. Banco (na pasta do projeto)
cmd /c "mysql -u root -p < psicogest.sql"

# 2. Configuração: copie e preencha DB_PASSWORD
Copy-Item backend/.env.example backend/.env

# 3. Dependências (back + front)
npm install

# 4. Sobe API (:3333) e web (:5173)
npm run dev
```

Abra http://localhost:5173.

## Contas de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | admin@demo.com | admin123 |
| Psicóloga | psicologo@demo.com | psicologo123 |
| Cliente | cliente@demo.com | cliente123 |

## Variáveis de ambiente (`backend/.env`)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | 3333 | Porta da API |
| `CORS_ORIGIN` | http://localhost:5173 | Origem do front |
| `DB_HOST` / `DB_PORT` | localhost / 3306 | MySQL |
| `DB_USER` / `DB_PASSWORD` | root / vazio | Credenciais do MySQL |
| `DB_NAME` | psicogest | Banco |
| `JWT_SECRET` | valor de dev | **Obrigatório em produção** |
| `NOTES_KEY` | valor de dev | 64 hex (32 bytes) para cifrar anotações. **Obrigatório em produção; guarde backup** |

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API + web em modo desenvolvimento |
| `npm test` | Testes de integração (cria o banco `psicogest_test`) |
| `npm run typecheck` | Checagem de tipos do back e do front |
| `npm run build` + `npm start` | Versão compilada, API servindo o front em http://localhost:3333 |
