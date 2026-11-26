import mysql from "mysql2/promise";
import { config } from "./config";

/**
 * Conexão com o MySQL. O esquema e os dados de demonstração vêm de `psicogest.sql` (raiz do repositório).
 * Datas trafegam como `Date` em UTC; colunas DATE (nascimento) voltam como texto "AAAA-MM-DD".
 */
export type Pool = mysql.Pool;
export type Db = mysql.Pool | mysql.PoolConnection;

export function openDb(database = config.db.database): Pool {
  const pool = mysql.createPool({
    ...config.db,
    database,
    namedPlaceholders: true,
    dateStrings: ["DATE"],
    decimalNumbers: true,
    timezone: "Z",
    charset: "utf8mb4",
    connectionLimit: 10,
  });
  // CURRENT_TIMESTAMP também em UTC, igual às datas gravadas pela aplicação.
  pool.pool.on("connection", (c) => void c.query("SET time_zone = '+00:00'"));
  return pool;
}

/** Parâmetros posicionais (`?`, array) ou nomeados (`:nome`, objeto). */
type Params = unknown[] | Record<string, unknown>;

export async function all<T>(db: Db, sql: string, params?: Params): Promise<T[]> {
  const [rows] = await db.query(sql, params as mysql.QueryValues);
  return rows as T[];
}

export const one = async <T>(db: Db, sql: string, params?: Params): Promise<T | undefined> =>
  (await all<T>(db, sql, params))[0];

export async function run(db: Db, sql: string, params?: Params): Promise<mysql.ResultSetHeader> {
  const [result] = await db.query<mysql.ResultSetHeader>(sql, params as mysql.QueryValues);
  return result;
}

/** Executa `fn` numa transação; qualquer erro desfaz tudo. */
export async function tx<T>(pool: Pool, fn: (c: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
