import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";

const env = process.env.NODE_ENV ?? "development";
const isProd = env === "production";
const isTest = env === "test";

function secret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Defina ${name} no ambiente antes de iniciar em produção.`);
  if (!isTest) console.warn(`[aviso] ${name} não definido — usando valor de desenvolvimento.`);
  return devFallback;
}

const devKey = crypto.createHash("sha256").update("psi-app-dev-only").digest("hex");
const notesKey = Buffer.from(secret("NOTES_KEY", devKey), "hex");
if (notesKey.length !== 32) {
  throw new Error("NOTES_KEY deve ter 64 caracteres hexadecimais (32 bytes).");
}

export const config = {
  env,
  isProd,
  isTest,
  port: Number(process.env.PORT ?? 3333),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "psicogest",
  },
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtSecret: secret("JWT_SECRET", "dev-only-jwt-secret-change-me"),
  notesKey,
  bcryptCost: isTest ? 4 : 12,
  staticDir: path.resolve(__dirname, "../../frontend/dist"),
};
