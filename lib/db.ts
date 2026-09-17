import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { serverEnv } from "@/lib/env";

declare global {
  var __larDbPool: Pool | undefined;
}

export function dbPool(): Pool {
  if (globalThis.__larDbPool) return globalThis.__larDbPool;
  const pool = new Pool({
    connectionString: serverEnv().DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 20_000,
    statement_timeout: 20_000,
    application_name: "lar-da-bencao-v216"
  });
  // Conexões ociosas podem cair (reinício/manutenção do banco): registra e deixa o pool reconectar,
  // em vez de o evento sem tratador derrubar o processo.
  pool.on("error", (error) => console.error("[db] conexão ociosa encerrada:", error.message));
  attachDatabasePool(pool);
  globalThis.__larDbPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return dbPool().query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await dbPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
