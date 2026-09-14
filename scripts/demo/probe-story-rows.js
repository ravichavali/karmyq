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
    // ALLOW-LIST, not a deny-list. This output is rendered into a PUBLIC GitHub issue, and an
    // earlier version passed through any message not matching /:\/\/|password|secret/. That let
    // ordinary pg failures publish internal detail verbatim — `connect ECONNREFUSED 172.19.0.4:5432`
    // (internal Docker address), `getaddrinfo ENOTFOUND karmyq-postgres` (container hostname),
    // `role "karmyq_prod" does not exist` (DB role), and `invalid input syntax for type uuid:
    // "<configured story id>"`, which published the very UUID this file's header promises to
    // withhold. A deny-list cannot enforce that contract; only an allow-list can.
    //
    // Emit the driver's CODE and nothing else. pg gives ECONNREFUSED/ENOTFOUND/ETIMEDOUT and
    // SQLSTATE codes (42P01 undefined_table, 28P01 invalid_password, 22P02 invalid_text_
    // representation) — enough for an operator to act on, with no host, role, or row identity.
    const code = (error && (error.code || error.name)) || 'unknown';
    errors.push(`story probe failed (code: ${String(code).slice(0, 40)})`);
  } finally {
    await pool.end().catch(() => {});
  }

  process.stdout.write(JSON.stringify({ stories: rows, errors }));
}

main().catch((error) => {
  // Emit a well-formed payload even on catastrophic failure: a silent probe would let the gate
  // read "no rows" as an absence of news rather than as news.
  // Same allow-list rule as the catch above: a code, never a message.
  const code = (error && (error.code || error.name)) || 'unknown';
  process.stdout.write(
    JSON.stringify({ stories: [], errors: [`story probe crashed (code: ${String(code).slice(0, 40)})`] }),
  );
});
