#!/usr/bin/env node
/**
 * Sprint 129 (BUG-040) — read the demo story rows' retention state.
 *
 * Runs INSIDE `karmyq-auth-service` so it uses the container's own DATABASE_URL and DB role:
 *
 *   ssh <user>@<host> 'docker exec -i karmyq-auth-service node' < scripts/demo/probe-story-rows.js
 *
 * Reading through the container is deliberate. The request routes never select a request's own
 * `expires_at` (only the unrelated `boosted_expires_at`), so there is no API to ask; the
 * alternatives were publishing retention metadata on a public endpoint or shipping DATABASE_URL to
 * GitHub Actions, both worse than reusing the SSH path deploys already use.
 *
 * SELECT only. Never writes.
 *
 * Output is a single JSON line consumed by `scripts/check-demo-health.js`. It deliberately carries
 * NO story UUIDs, no persona email and no token: the result is rendered into a PUBLIC GitHub issue.
 * Only the story kind and the four fields the deletion predicates actually use are emitted.
 */

'use strict';

const { Pool } = require('pg');

const STORIES = [
  { kind: 'ordinary', env: 'DEMO_ORDINARY_REQUEST_ID' },
  { kind: 'provider', env: 'DEMO_PROVIDER_REQUEST_ID' },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  const rows = [];
  const errors = [];

  try {
    for (const { kind, env } of STORIES) {
      const id = (process.env[env] || '').trim();
      if (!id) {
        errors.push(`${kind}: ${env} is not set`);
        continue;
      }

      const result = await pool.query(
        `SELECT expired, status, expires_at, updated_at
           FROM requests.help_requests
          WHERE id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        // The BUG-039 shape exactly: configured, but the row is gone.
        errors.push(`${kind}: the configured story row no longer exists`);
        continue;
      }

      const row = result.rows[0];
      rows.push({
        kind,
        expired: row.expired === true,
        status: row.status,
        expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      });
    }
  } catch (error) {
    // Never echo a message that could carry a connection string or credential.
    const message = String((error && error.message) || error);
    errors.push(
      /:\/\/|password|secret/i.test(message)
        ? 'story probe failed: [redacted]'
        : `story probe failed: ${message}`,
    );
  } finally {
    await pool.end().catch(() => {});
  }

  process.stdout.write(JSON.stringify({ stories: rows, errors }));
}

main().catch((error) => {
  // Emit a well-formed payload even on catastrophic failure: a silent probe would let the gate
  // read "no rows" as an absence of news rather than as news.
  process.stdout.write(
    JSON.stringify({ stories: [], errors: [`story probe crashed: ${error && error.message}`] }),
  );
});
