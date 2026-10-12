import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

let pool: Pool | null = null;

if (config.databaseUrl) {
  const isLocalhost = config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1');

  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL client error on idle client:', err.message);
  });
} else {
  console.warn('⚠️  DATABASE_URL is not set. Database operations will be unavailable until configured in .env.');
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error('Database pool not initialized. Please set DATABASE_URL in your environment.');
  }
  return pool.query<T>(text, params);
}

export async function getClient() {
  if (!pool) {
    throw new Error('Database pool not initialized. Please set DATABASE_URL in your environment.');
  }
  return pool.connect();
}

export async function checkDatabaseConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  if (!pool) {
    return { connected: false, error: 'DATABASE_URL not configured' };
  }

  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { connected: true, latencyMs: Date.now() - start };
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Failed to connect to database',
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export { pool };
