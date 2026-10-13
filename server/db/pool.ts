import { Pool, QueryResult, QueryResultRow } from "pg";
import { config } from "../config";

export let pool: Pool | null = null;

function createPool(
  connectionString: string,
  connectionTimeoutMillis = 10000,
): Pool {
  const parsed = new URL(connectionString);
  const isLocalhost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const instance = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });
  instance.on("error", (err) => {
    console.error(
      "Unexpected PostgreSQL client error on idle client:",
      err.message,
    );
  });
  return instance;
}

function getPool(): Pool {
  if (pool) return pool;
  if (!config.databaseUrl) {
    throw new Error(
      "Database pool is not configured. Set DATABASE_URL for the application or explicitly configure a verified test pool.",
    );
  }
  pool = createPool(config.databaseUrl);
  return pool;
}

export function configurePool(
  connectionString: string,
  connectionTimeoutMillis = 10000,
): void {
  if (pool)
    throw new Error(
      "Database pool is already initialized. Close it before configuring another pool.",
    );
  pool = createPool(connectionString, connectionTimeoutMillis);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function getClient() {
  return getPool().connect();
}

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const client = await getPool().connect();
    try {
      await client.query("SELECT 1");
      return { connected: true, latencyMs: Date.now() - start };
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    return {
      connected: false,
      error:
        err instanceof Error ? err.message : "Failed to connect to database",
    };
  }
}
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
