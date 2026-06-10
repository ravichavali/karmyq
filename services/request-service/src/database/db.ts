import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced to 5 for multi-instance production support
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

/**
 * Run `fn` inside a single DB transaction. `fn` receives a `q` that runs on the
 * transaction's dedicated client; all statements commit together or roll back
 * together. Used for multi-statement lifecycle mutations (match accept/reject/
 * complete/cancel, last-admin guard) so a mid-sequence failure can never leave
 * split match/request/offer state, and `SELECT … FOR UPDATE` reads can serialize
 * concurrent writers.
 */
export async function withTransaction<T>(
  fn: (q: (text: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
