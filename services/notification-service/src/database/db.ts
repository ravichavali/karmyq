import { Pool } from 'pg';
import { createLogger } from '@karmyq/shared/utils/logger';

const logger = createLogger('notification-service');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced to 5 for multi-instance production support
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // BUG-082 (Sprint 139): routine success is debug-level — silent at the default info, opt in with
  // LOG_LEVEL=debug. Same SQL text, duration and row count; never the parameter values.
  logger.debug('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

export async function getClient() {
  return pool.connect();
}

export default pool;
