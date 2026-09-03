import { Pool, PoolClient } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced to 5 for multi-instance production support
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Sprint 126 (ADR-096) — the connection the current async context must use.
 *
 * Standing projection has to write every row for one match atomically. Every reputation database
 * helper already funnels through the exported `query()` below, so publishing a checked-out client
 * here lets all of them join a transaction without threading an optional client parameter through
 * a dozen call sites — and without the risk that one forgotten helper silently writes outside the
 * transaction, which is exactly the bug that parameter-threading invites.
 */
const transactionClient = new AsyncLocalStorage<PoolClient>();

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
  // Inside withTransaction this is the transaction's client; outside it, the pool.
  const executor = transactionClient.getStore() ?? pool;
  const res = await executor.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

/**
 * Run `work` inside one database transaction. Every `query()` call made anywhere in its async call
 * tree uses the same connection and commits or rolls back together.
 *
 * Nested calls JOIN the outer transaction rather than opening their own. A nested `BEGIN` would be
 * a no-op in PostgreSQL while the inner `COMMIT` would commit the OUTER work early — so a caller
 * that wraps a projector call in its own transaction would silently lose atomicity.
 */
export async function withTransaction<T>(work: () => Promise<T>): Promise<T> {
  const existing = transactionClient.getStore();
  if (existing) return work();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await transactionClient.run(client, work);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Never let a rollback failure mask the original error, or skip the release below.
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
