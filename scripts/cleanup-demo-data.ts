/**
 * cleanup-demo-data.ts — dry-run-first hygiene for the demo/QA database.
 *
 * Removes two classes of cruft that accumulate on the demo server (IDEAS 2026-05-24):
 *   1. Orphaned rows — matches/offers/requests whose FK target no longer exists.
 *      Detection ranks each row against its REAL FK target via LEFT JOIN ... IS NULL
 *      (per the FK-dedup lesson: never assume a single canonical parent).
 *   2. Stale terminal rows — requests/offers long past expiry in a terminal state,
 *      and simulation-owned (@test.karmyq.com) terminal rows from retired sim runs.
 *
 * SAFETY: dry-run by DEFAULT. It prints per-table counts + sample rows of what it
 * WOULD delete and mutates nothing unless invoked with `--apply`. Apply runs inside
 * a single transaction and rolls back on any error. Simulation USER accounts (the
 * actor pool) are never deleted — only their stale request/offer content.
 *
 * Usage:
 *   node scripts/cleanup-demo-data.ts                 # dry-run (default)
 *   node scripts/cleanup-demo-data.ts --apply         # actually delete (after review)
 *   node scripts/cleanup-demo-data.ts --ttl-days 60   # change the stale grace window
 *
 * Connection comes from DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD (same defaults
 * as the other scripts; point these at the demo DB before running there).
 */

import { Pool } from 'pg';
import type { PoolClient } from 'pg';

const APPLY = process.argv.includes('--apply');
const ttlFlagIdx = process.argv.indexOf('--ttl-days');
const TTL_DAYS = ttlFlagIdx !== -1 ? Number(process.argv[ttlFlagIdx + 1]) : 30;

if (!Number.isFinite(TTL_DAYS) || TTL_DAYS < 0) {
  console.error(`Invalid --ttl-days value: ${process.argv[ttlFlagIdx + 1]}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'karmyq',
  user: process.env.DB_USER || 'karmyq_user',
  password: process.env.DB_PASSWORD || 'karmyq_password',
});

// Sim actors are tagged by email domain (mirrors simulation-service db-user-loader).
const SIM_USER_FILTER = "email LIKE '%@test.karmyq.com' AND email NOT LIKE '%@karmyq.test'";

// Terminal states past which a request/offer is safe to consider stale.
const TERMINAL_REQUEST_STATES = "('completed', 'cancelled', 'expired', 'closed')";
const TERMINAL_OFFER_STATES = "('completed', 'cancelled', 'expired', 'withdrawn')";

interface CleanupTarget {
  key: string;
  description: string;
  /** Rows this target would remove (also used to render the sample). */
  selectSql: string;
  /** The matching DELETE (run only under --apply). Must target the same rows. */
  deleteSql: string;
}

/**
 * Deletion order respects FKs: orphan leaf rows first, then stale parents (whose
 * deletes cascade to matches/request_communities via ON DELETE CASCADE).
 */
const TARGETS: CleanupTarget[] = [
  {
    key: 'orphan_matches_missing_request',
    description: 'Matches whose request_id no longer resolves to a help_requests row',
    selectSql: `
      SELECT m.id, m.request_id, m.responder_id, m.status, m.created_at
      FROM requests.matches m
      LEFT JOIN requests.help_requests r ON r.id = m.request_id
      WHERE r.id IS NULL`,
    deleteSql: `
      DELETE FROM requests.matches m
      WHERE NOT EXISTS (
        SELECT 1 FROM requests.help_requests r WHERE r.id = m.request_id
      )`,
  },
  {
    key: 'orphan_matches_missing_responder',
    description: 'Matches whose responder_id no longer resolves to an auth.users row',
    selectSql: `
      SELECT m.id, m.request_id, m.responder_id, m.status, m.created_at
      FROM requests.matches m
      LEFT JOIN auth.users u ON u.id = m.responder_id
      WHERE u.id IS NULL`,
    deleteSql: `
      DELETE FROM requests.matches m
      WHERE NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = m.responder_id
      )`,
  },
  {
    key: 'orphan_offers_missing_offerer',
    description: 'Help offers whose offerer_id no longer resolves to an auth.users row',
    selectSql: `
      SELECT o.id, o.offerer_id, o.community_id, o.status, o.created_at
      FROM requests.help_offers o
      LEFT JOIN auth.users u ON u.id = o.offerer_id
      WHERE u.id IS NULL`,
    deleteSql: `
      DELETE FROM requests.help_offers o
      WHERE NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = o.offerer_id
      )`,
  },
  {
    key: 'orphan_requests_missing_requester',
    description: 'Help requests whose requester_id no longer resolves to an auth.users row',
    selectSql: `
      SELECT r.id, r.requester_id, r.title, r.status, r.created_at
      FROM requests.help_requests r
      LEFT JOIN auth.users u ON u.id = r.requester_id
      WHERE u.id IS NULL`,
    deleteSql: `
      DELETE FROM requests.help_requests r
      WHERE NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = r.requester_id
      )`,
  },
  {
    key: 'stale_terminal_requests',
    description: `Requests in a terminal state, expired more than ${TTL_DAYS} days ago`,
    selectSql: `
      SELECT r.id, r.requester_id, r.title, r.status, r.expires_at
      FROM requests.help_requests r
      WHERE (r.expired = TRUE OR r.status IN ${TERMINAL_REQUEST_STATES})
        AND r.expires_at IS NOT NULL
        AND r.expires_at < NOW() - INTERVAL '${TTL_DAYS} days'`,
    deleteSql: `
      DELETE FROM requests.help_requests r
      WHERE (r.expired = TRUE OR r.status IN ${TERMINAL_REQUEST_STATES})
        AND r.expires_at IS NOT NULL
        AND r.expires_at < NOW() - INTERVAL '${TTL_DAYS} days'`,
  },
  {
    key: 'stale_simulation_requests',
    description: `Simulation-owned requests in a terminal state, created more than ${TTL_DAYS} days ago`,
    selectSql: `
      SELECT r.id, r.requester_id, r.title, r.status, r.created_at
      FROM requests.help_requests r
      JOIN auth.users u ON u.id = r.requester_id
      WHERE u.${SIM_USER_FILTER}
        AND r.status IN ${TERMINAL_REQUEST_STATES}
        AND r.created_at < NOW() - INTERVAL '${TTL_DAYS} days'`,
    deleteSql: `
      DELETE FROM requests.help_requests r
      USING auth.users u
      WHERE u.id = r.requester_id
        AND u.${SIM_USER_FILTER}
        AND r.status IN ${TERMINAL_REQUEST_STATES}
        AND r.created_at < NOW() - INTERVAL '${TTL_DAYS} days'`,
  },
  {
    key: 'stale_terminal_offers',
    description: `Offers in a terminal state, expired more than ${TTL_DAYS} days ago`,
    selectSql: `
      SELECT o.id, o.offerer_id, o.community_id, o.status, o.expires_at
      FROM requests.help_offers o
      WHERE (o.expired = TRUE OR o.status IN ${TERMINAL_OFFER_STATES})
        AND o.expires_at IS NOT NULL
        AND o.expires_at < NOW() - INTERVAL '${TTL_DAYS} days'`,
    deleteSql: `
      DELETE FROM requests.help_offers o
      WHERE (o.expired = TRUE OR o.status IN ${TERMINAL_OFFER_STATES})
        AND o.expires_at IS NOT NULL
        AND o.expires_at < NOW() - INTERVAL '${TTL_DAYS} days'`,
  },
];

async function countAndSample(
  runner: Pool | PoolClient,
  target: CleanupTarget
): Promise<{ count: number; sample: any[] }> {
  const res = await runner.query(target.selectSql);
  return { count: res.rowCount ?? 0, sample: res.rows.slice(0, 5) };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  Demo-data cleanup — ${APPLY ? 'APPLY (mutating)' : 'DRY RUN (read-only)'}`.padEnd(64) + '║');
  console.log(`║  Stale grace window: ${TTL_DAYS} days`.padEnd(64) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Always compute the report read-only first, so apply prints exactly what it removes.
  let grandTotal = 0;
  for (const target of TARGETS) {
    const { count, sample } = await countAndSample(pool, target);
    grandTotal += count;
    console.log(`▸ ${target.key} — ${count} row(s)`);
    console.log(`  ${target.description}`);
    if (sample.length > 0) {
      console.log('  sample:');
      for (const row of sample) {
        console.log(`    ${JSON.stringify(row)}`);
      }
    }
    console.log('');
  }

  console.log(`Total rows targeted: ${grandTotal}\n`);

  if (!APPLY) {
    console.log('Dry run — nothing was deleted. Re-run with --apply to remove these rows.');
    return;
  }

  if (grandTotal === 0) {
    console.log('Nothing to delete. Exiting.');
    return;
  }

  console.log('Applying deletions in a single transaction...\n');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const target of TARGETS) {
      const res = await client.query(target.deleteSql);
      console.log(`  ✓ ${target.key}: deleted ${res.rowCount ?? 0} row(s)`);
    }
    await client.query('COMMIT');
    console.log('\nDone — transaction committed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nError during apply — transaction ROLLED BACK. No rows deleted.');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
