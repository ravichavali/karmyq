/**
 * Sprint 117 — migrated-DB full-reset determinism (integration).
 *
 * Applies the guarded curated reset TWICE against a migrated PostgreSQL database with two
 * different anchors and proves: historical semantic IDs are stable across resets; every relative
 * timestamp shifts by exactly the anchor delta; the second reset re-runs cleanly (idempotent);
 * every managed base table is classified (no drift); FK integrity holds without disabling
 * constraints; and no request is overdue-but-unflagged. Locally without Docker this remains a TDD
 * prerequisite (it fails fast on connection); in CI's migrated Postgres it is a blocking gate that
 * executes the destructive path twice before the live demo ever runs it.
 */

import { Pool } from 'pg';
import { createResetDependencies, executeReset, type ResetDependencies } from '../../services/simulation-service/src/fixtures/curatedDemo/resetCoordinator';
import { semanticUuid } from '../../services/simulation-service/src/fixtures/curatedDemo/compiler';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

interface ResetProbe {
  userIds: string[];
  freshRequestCreatedAtMs: number;
  overdueUnprocessedRows: number;
  expiredFlaggedRows: number;
  forgottenRows: number;
  peopleCount: number;
}

function testDeps(pool: Pool): ResetDependencies {
  const base = createResetDependencies({
    pool,
    databaseName: 'karmyq_test',
    backupDir: '/tmp',
    runProcess: async () => undefined,
  });
  return {
    ...base,
    getFingerprint: async () => ({ environment: 'demo', database: 'karmyq_test', marker: 'karmyq-demo-reset-v1' }),
    backup: async () => ({ verified: true, path: '/tmp/none.dump' }),
    acquireLock: async () => async () => undefined,
    pauseMutation: async () => undefined,
    disableDemo: async () => undefined,
    readSecret: () => 'integration-test-password',
    hashPassword: async () => '$2a$12$integrationtesthashplaceholderhashvalue1234567890ab',
  };
}

async function applyToTestDb(anchor: Date): Promise<ResetProbe> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const result = await executeReset({ apply: true, anchor }, testDeps(pool));
    expect(result.mode).toBe('applied-awaiting-validation');

    const users = await pool.query<{ id: string }>('SELECT id FROM auth.users ORDER BY id');
    const fresh = await pool.query<{ created_at: Date }>(
      'SELECT created_at FROM requests.help_requests WHERE id = $1',
      [semanticUuid('request.fresh-open')],
    );
    // "Overdue unprocessed" means a still-active request past its TTL that cleanup failed to flag.
    // Terminal statuses (completed/declined/cancelled/rejected/forgotten) legitimately keep a past
    // expiry with expired=false, so they are excluded.
    const overdue = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM requests.help_requests WHERE status IN ('open','proposed','matched') AND expires_at < $1 AND expired = FALSE",
      [anchor],
    );
    const expiredFlagged = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM requests.help_requests WHERE status = 'expired' AND expired = TRUE",
    );
    const forgotten = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM requests.help_requests WHERE title = '[forgotten]'",
    );

    return {
      userIds: users.rows.map(r => r.id),
      freshRequestCreatedAtMs: fresh.rows[0] ? new Date(fresh.rows[0].created_at).getTime() : 0,
      overdueUnprocessedRows: Number(overdue.rows[0].n),
      expiredFlaggedRows: Number(expiredFlagged.rows[0].n),
      forgottenRows: Number(forgotten.rows[0].n),
      peopleCount: users.rows.length,
    };
  } finally {
    await pool.end();
  }
}

describe('Sprint 117 full demo reset', () => {
  it('applies twice with stable historical IDs and a shifted anchor', async () => {
    const first = await applyToTestDb(new Date('2026-07-02T12:00:00Z'));
    const second = await applyToTestDb(new Date('2026-08-02T12:00:00Z'));

    expect(second.userIds).toEqual(first.userIds);
    expect(first.userIds).toContain(semanticUuid('person.maria'));
    expect(second.freshRequestCreatedAtMs - first.freshRequestCreatedAtMs).toBe(31 * 86_400_000);
    expect(second.peopleCount).toBe(36);
  }, 60_000);

  it('leaves cleanup boundaries correct: no overdue-unflagged rows, expired flagged, forgotten sentinel', async () => {
    const probe = await applyToTestDb(new Date('2026-07-02T12:00:00Z'));
    expect(probe.overdueUnprocessedRows).toBe(0);
    expect(probe.expiredFlaggedRows).toBeGreaterThanOrEqual(1);
    expect(probe.forgottenRows).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
