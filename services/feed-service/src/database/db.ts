import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export async function initDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 10, // Standardized to prevent connection exhaustion (8 services × 10 = 80 max connections)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  const client = await pool.connect();
  await client.query('SELECT NOW()');
  client.release();
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool is not initialized. Call initDatabase() first.');
  }
  return pool;
}

export async function query(text: string, params?: any[]): Promise<any> {
  const pool = getPool();
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}
