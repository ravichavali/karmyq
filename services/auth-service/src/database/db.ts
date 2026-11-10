import { Pool } from 'pg';
import { createLogger } from '@karmyq/shared/utils/logger';

// Created on first use, not at import: index.ts imports this module before dotenv.config() runs, and the
// shared logger reads LOG_LEVEL when it is constructed, so a LOG_LEVEL from .env would otherwise never apply.
let logger: ReturnType<typeof createLogger> | undefined;
const queryLogger = () => (logger ??= createLogger('auth-service'));

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
  // BUG-082 (Sprint 139): routine success is debug-level — silent at the default info, opt in with
  // LOG_LEVEL=debug. Same SQL text, duration and row count; never the parameter values.
  queryLogger().debug('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

/** Run `fn` in one transaction on a dedicated client (same shape as request-service's helper). */
export async function withTransaction<T>(fn: (q: (text: string, params?: any[]) => Promise<any>) => Promise<T>): Promise<T> {
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
