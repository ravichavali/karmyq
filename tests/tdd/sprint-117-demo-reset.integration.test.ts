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
 *
 * Sprint 133 PR D adds the skills layer and standing offers. After EVERY reset it proves, with
 * production code rather than a mirror (plan Critical Notes 4 and 9):
 *  - social-graph's own `reconcileEndorsementPairLocked` (dry run, under the pair lock) plans no
 *    write for any pair with a seeded endorsement, and DOES plan one when a count is bumped (the
 *    negative case, inside a rolled-back transaction);
 *  - the exact reconciled endorsement counts, by pair identity;
 *  - `raw_weight` equals the formula over the stored columns and the table weights, for EVERY
 *    trust edge the reset wrote (weights resolved by social-graph's getInteractionWeightsForCommunity);
 *  - the seeded rows by key: skills, endorsements (active/withdrawn), privacy settings, items,
 *    shares and offers;
 *  - the Providers skill directory and search, run as Noah with auth-service's own route statements
 *    (read from routes/skills.ts at run time, resolved with its exported `skillVisibleToSql` /
 *    `activeMemberSql`), equal `expectedSkillDirectory` and hide ambient-09;
 *  - the pair lock is withPairLock's own statement, read from social-graph's source at run time;
 *  - PR V's offer boundary predicate, read out of request-service's source at run time.
 */

import fs from 'fs';
import path from 'path';
import { Pool, type PoolClient } from 'pg';
import { createResetDependencies, executeReset, type ResetDependencies } from '../../services/simulation-service/src/fixtures/curatedDemo/resetCoordinator';
import {
  CURATED_DEMO_MANIFEST,
  compileManifest,
  expectedSkillDirectory,
  semanticUuid,
} from '../../services/simulation-service/src/fixtures/curatedDemo/compiler';
import type { CompiledDemoBaseline } from '../../services/simulation-service/src/fixtures/curatedDemo/types';
import { computeRawWeight, getInteractionWeightsForCommunity, normalizePair } from '../../services/social-graph-service/src/database/trustEdgeDb';
import { reconcileEndorsementPairLocked } from '../../services/social-graph-service/src/services/endorsementReconcile';
import { activeMemberSql, skillVisibleToSql } from '../../services/auth-service/src/db/skillVisibility';

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
    databaseUrl: DATABASE_URL,
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

// ---------------------------------------------------------------------------
// Sprint 133 PR D: skills layer and standing offers
// ---------------------------------------------------------------------------

const key = (k: string) => semanticUuid(k);
const sortedIds = (rows: Array<{ id: string }>) => rows.map(r => r.id).sort();
const pairId = (x: string, y: string, community: string) => {
  const { userIdA, userIdB } = normalizePair(key(x), key(y));
  return `${userIdA}|${userIdB}|${key(community)}`;
};

/**
 * The plan's reconciled pair counts (Seed content), stated by pair identity, independent of the
 * compiler's derivation: Maria-Sophia 2, Maria-Wei 1, Maria-James 0 (only vouch withdrawn),
 * Elena-Fatima 2, Amina-Noah 1.
 */
const EXPECTED_PAIR_COUNTS: Array<[string, string, string, number]> = [
  ['person.maria', 'person.shared-sophia', 'community.portland-mutual-aid', 2],
  ['person.maria', 'person.maria-exclusive', 'community.portland-mutual-aid', 1],
  ['person.maria', 'person.shared-james', 'community.portland-mutual-aid', 0],
  ['person.helper', 'person.helper-exclusive', 'community.southeast-pdx', 2],
  ['person.bridge', 'person.provider', 'community.providers', 1],
];

const REPO = path.resolve(__dirname, '../..');
const readSource = (relative: string) => fs.readFileSync(path.join(REPO, relative), 'utf8');

/**
 * The advisory-lock statement, read out of social-graph's `withPairLock` at run time (never restated
 * here), with its parameter binding checked: `[pair.userIdA, pair.userIdB]`.
 */
function pairLockSql(): string {
  const source = readSource('services/social-graph-service/src/database/trustEdgeDb.ts');
  const fn = /export async function withPairLock[\s\S]*?\n\}/.exec(source);
  if (!fn) throw new Error('withPairLock not found in social-graph trustEdgeDb.ts');
  const lock = /client\.query\(\s*(["'`])(SELECT pg_advisory_xact_lock\([\s\S]*?\))\1\s*,\s*\[\s*pair\.userIdA\s*,\s*pair\.userIdB\s*\]\s*\)/.exec(fn[0]);
  if (!lock) throw new Error('withPairLock no longer takes pg_advisory_xact_lock with [pair.userIdA, pair.userIdB]');
  return lock[2];
}

/** Take the pair lock with withPairLock's own statement, then run the real reconcile in dry run. */
async function dryRunReconcile(client: PoolClient, a: string, b: string) {
  await client.query(pairLockSql(), [a, b]);
  return reconcileEndorsementPairLocked(client, a, b, { dryRun: true });
}

/**
 * The skill directory and search statements, read out of auth-service's routes/skills.ts at run time.
 * The route builds them from module-local template strings (`normalizedSkillSql`, `skillKey`,
 * `communityJoins`, `communityWhere`) plus the exported `activeMemberSql` / `skillVisibleToSql`.
 * This resolves exactly those interpolations, so a change to any join, filter or the skill_key
 * expression in the route changes what this test runs. Anything it cannot resolve is a failure.
 */
function skillsRouteSql(): { directory: string; search: string; skillKey: string } {
  const source = readSource('services/auth-service/src/routes/skills.ts');
  if (!/import\s*\{[^}]*\bactiveMemberSql\b[^}]*\}\s*from\s*'\.\.\/db\/skillVisibility'/.test(source)
    || !/import\s*\{[^}]*\bskillVisibleToSql\b[^}]*\}\s*from\s*'\.\.\/db\/skillVisibility'/.test(source)) {
    throw new Error('routes/skills.ts no longer imports activeMemberSql and skillVisibleToSql from ../db/skillVisibility');
  }
  const consts = new Map<string, string>();
  for (const m of source.matchAll(/const (\w+) = `([^`]*)`;/g)) consts.set(m[1], m[2]);
  const functions = new Map<string, (...args: string[]) => string>([
    ['activeMemberSql', (c, v) => activeMemberSql(c, v)],
    ['skillVisibleToSql', (o, v) => skillVisibleToSql(o, v)],
  ]);
  for (const m of source.matchAll(/const (\w+) = \((\w+): string\) => `([^`]*)`;/g)) {
    const [, name, param, body] = m;
    functions.set(name, (arg: string) => body.split(`\${${param}}`).join(arg));
  }

  const resolve = (template: string, depth = 0): string => {
    if (depth > 8) throw new Error('routes/skills.ts interpolation nests too deeply to resolve');
    return template.replace(/\$\{([^{}]*)\}/g, (_whole, expr: string) => {
      const e = expr.trim();
      if (consts.has(e)) return resolve(consts.get(e)!, depth + 1);
      const call = /^(\w+)\((.*)\)$/.exec(e);
      if (call && functions.has(call[1]) && /^\s*'[^']*'\s*(,\s*'[^']*'\s*)*$/.test(call[2])) {
        const args = [...call[2].matchAll(/'([^']*)'/g)].map(a => a[1]);
        return resolve(functions.get(call[1])!(...args), depth + 1);
      }
      throw new Error(`routes/skills.ts interpolation this test cannot resolve: \${${e}}`);
    });
  };

  const routeQuery = (route: string): string => {
    const start = source.indexOf(`router.get('${route}', `);
    if (start < 0) throw new Error(`routes/skills.ts route ${route} not found`);
    const q = /await query\(`([^`]*)`/.exec(source.slice(start));
    if (!q) throw new Error(`routes/skills.ts route ${route} has no query template`);
    return resolve(q[1]);
  };

  if (!consts.has('skillKey')) throw new Error('routes/skills.ts skillKey expression not found');
  const sql = {
    directory: routeQuery('/communities/:communityId'),
    search: routeQuery('/communities/:communityId/search'),
    skillKey: resolve(consts.get('skillKey')!),
  };
  for (const [name, text] of Object.entries(sql)) {
    if (text.includes('${')) throw new Error(`unresolved interpolation in ${name}: ${text}`);
  }
  if (!/AS skill_key/.test(sql.directory) || !/member_count/.test(sql.directory) || !/AS user_id/.test(sql.search)) {
    throw new Error('routes/skills.ts directory/search statements no longer return skill_key/member_count/user_id');
  }
  return sql;
}

/**
 * PR V's offer read boundary, read out of request-service's source at run time. `offerReadableSql` is
 * module-local (routes/offers.ts:18) and must stay so; a pasted copy here would be a shadow that never
 * fails when the route changes. No match is a failure, never a skip.
 */
function offerReadablePredicate(alias: string, viewerParam: string): string {
  const source = fs.readFileSync(path.resolve(__dirname, '../../services/request-service/src/routes/offers.ts'), 'utf8');
  const fn = /function offerReadableSql\((\w+): string, (\w+): string\): string \{\s*return `([\s\S]*?)`;\s*\}/.exec(source);
  if (!fn) throw new Error('offerReadableSql(alias, viewerParam) body not found in request-service routes/offers.ts');
  const [, aliasName, viewerName, body] = fn;
  const predicate = body.split(`\${${aliasName}}`).join(alias).split(`\${${viewerName}}`).join(viewerParam);
  if (predicate.includes('${')) throw new Error(`offerReadableSql has an interpolation this test cannot substitute: ${predicate}`);
  if (!predicate.includes(`${alias}.offerer_id`) || !predicate.includes(viewerParam)) {
    throw new Error(`offerReadableSql substitution did not bind the alias and viewer: ${predicate}`);
  }
  return predicate;
}

async function assertSkillsAndOffersLayer(pool: Pool, baseline: CompiledDemoBaseline): Promise<void> {
  // --- Seeded rows, by key ---------------------------------------------------------------------
  const tags = await pool.query<{ id: string; user_id: string; tag_type: string; tag_value: string; skill_slug: string | null }>(
    'SELECT id, user_id, tag_type, tag_value, skill_slug FROM auth.user_tags ORDER BY id');
  expect(tags.rows.map(r => ({ id: r.id, user: r.user_id, type: r.tag_type, value: r.tag_value, slug: r.skill_slug })))
    .toEqual([...baseline.skills].sort((x, y) => x.id.localeCompare(y.id))
      .map(s => ({ id: s.id, user: s.userId, type: 'skill', value: s.tagValue, slug: s.skillSlug })));

  const endorsements = await pool.query<{ id: string; withdrawn_at: Date | null; revision: string }>(
    'SELECT id, withdrawn_at, revision FROM auth.skill_endorsements ORDER BY id');
  const activeIds = baseline.endorsements.filter(e => e.withdrawnAt === null).map(e => e.id).sort();
  const withdrawnIds = baseline.endorsements.filter(e => e.withdrawnAt !== null).map(e => e.id).sort();
  expect(endorsements.rows.filter(r => r.withdrawn_at === null).map(r => r.id)).toEqual(activeIds);
  expect(endorsements.rows.filter(r => r.withdrawn_at !== null).map(r => r.id)).toEqual(withdrawnIds);
  expect(withdrawnIds).toEqual([key('endorsement.james-maria-driving')]);
  expect(activeIds).toHaveLength(6);
  for (const row of endorsements.rows) {
    expect({ id: row.id, revision: Number(row.revision) }).toEqual({ id: row.id, revision: row.withdrawn_at === null ? 1 : 2 });
  }

  const privacy = await pool.query<{ user_id: string; share_skills_with_communities: boolean }>(
    'SELECT user_id, share_skills_with_communities FROM auth.user_privacy_settings ORDER BY user_id');
  expect(privacy.rows).toEqual([{ user_id: key('person.ambient-09'), share_skills_with_communities: false }]);

  const items = await pool.query<{ id: string; owner_user_id: string | null; owner_community_id: string | null; created_by: string | null }>(
    'SELECT id, owner_user_id, owner_community_id, created_by FROM inventory.items ORDER BY id');
  expect(sortedIds(items.rows)).toEqual(baseline.items.map(i => i.id).sort());
  const toolLibraryItems = items.rows.filter(r => r.owner_community_id === key('community.tool-library'));
  expect(toolLibraryItems).toHaveLength(4);
  for (const item of toolLibraryItems) expect(item.created_by).toBe(key('person.steward-tools'));

  const shares = await pool.query<{ item_id: string; community_id: string }>('SELECT item_id, community_id FROM inventory.item_shares');
  expect(shares.rows.map(r => `${r.item_id}|${r.community_id}`).sort())
    .toEqual(baseline.itemShares.map(s => `${s.itemId}|${s.communityId}`).sort());
  expect(shares.rows.filter(r => toolLibraryItems.some(i => i.id === r.item_id))).toEqual([]);

  const offers = await pool.query<{ id: string; status: string; expired: boolean }>(
    'SELECT id, status, expired FROM requests.help_offers ORDER BY id');
  expect(offers.rows).toEqual(
    [key('offer.priya-tutoring'), key('offer.rides-airport'), key('offer.sophia-meal-prep')].sort()
      .map(id => ({ id, status: 'active', expired: false })));
  expect(sortedIds(offers.rows)).toEqual(baseline.offers.map(o => o.id).sort());

  // --- Critical Note 4: production reconcile plans nothing; counts and weights are exact -------
  const endorsedPairs = new Map<string, { a: string; b: string }>();
  for (const e of baseline.endorsements) {
    const { userIdA, userIdB } = normalizePair(e.endorserId, e.endorseeId);
    endorsedPairs.set(`${userIdA}|${userIdB}`, { a: userIdA, b: userIdB });
  }
  expect([...endorsedPairs.keys()].sort())
    .toEqual(EXPECTED_PAIR_COUNTS.map(([x, y, c]) => pairId(x, y, c).split('|').slice(0, 2).join('|')).sort());

  for (const { a, b } of endorsedPairs.values()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const plan = await dryRunReconcile(client, a, b);
      expect({ pair: `${a}|${b}`, plan }).toEqual({ pair: `${a}|${b}`, plan: { updates: [], inserts: [] } });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  // Negative case: the same check must be able to fail. Bump Maria-Wei (1 -> 2) in a rolled-back
  // transaction; the reconcile must plan exactly the update back to 1.
  {
    const { userIdA, userIdB } = normalizePair(key('person.maria'), key('person.maria-exclusive'));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const bumped = await client.query(
        `UPDATE social_graph.trust_edges SET endorsement_count = endorsement_count + 1
         WHERE user_id_a = $1 AND user_id_b = $2 AND community_id = $3`,
        [userIdA, userIdB, key('community.portland-mutual-aid')]);
      expect(bumped.rowCount).toBe(1);
      const plan = await dryRunReconcile(client, userIdA, userIdB);
      expect(plan.inserts).toEqual([]);
      expect(plan.updates.map(u => ({ community: u.community_id, n: u.n, from: u.from })))
        .toEqual([{ community: key('community.portland-mutual-aid'), n: 1, from: 2 }]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  const edges = await pool.query<{
    user_id_a: string; user_id_b: string; community_id: string; match_completed_count: number;
    endorsement_count: number; karma_given_count: number; event_count: number; raw_weight: number;
  }>(`SELECT user_id_a, user_id_b, community_id, match_completed_count, endorsement_count,
            karma_given_count, event_count, raw_weight FROM social_graph.trust_edges`);
  const edgeByPair = new Map(edges.rows.map(r => [`${r.user_id_a}|${r.user_id_b}|${r.community_id}`, r]));
  for (const [x, y, c, n] of EXPECTED_PAIR_COUNTS) {
    const edge = edgeByPair.get(pairId(x, y, c));
    expect({ pair: `${x}~${y}@${c}`, exists: edge !== undefined, count: edge?.endorsement_count })
      .toEqual({ pair: `${x}~${y}@${c}`, exists: true, count: n });
  }
  // No other edge carries an endorsement count.
  expect(edges.rows.filter(r => r.endorsement_count !== 0).map(r => `${r.user_id_a}|${r.user_id_b}|${r.community_id}`).sort())
    .toEqual(EXPECTED_PAIR_COUNTS.filter(([, , , n]) => n > 0).map(([x, y, c]) => pairId(x, y, c)).sort());

  // raw_weight = the formula over the stored columns and the table weights, for EVERY edge the reset wrote.
  expect(edges.rows.length).toBeGreaterThan(0);
  const weights = new Map<string, Awaited<ReturnType<typeof getInteractionWeightsForCommunity>>>();
  for (const communityId of new Set(edges.rows.map(r => r.community_id))) {
    weights.set(communityId, await getInteractionWeightsForCommunity(communityId, pool));
  }
  for (const r of edges.rows) {
    const w = weights.get(r.community_id)!;
    // social-graph's own formula, not a restatement of it.
    const expected = computeRawWeight({
      match_completed: r.match_completed_count, endorsement: r.endorsement_count,
      karma_given: r.karma_given_count, event: r.event_count,
    }, w);
    expect({ edge: `${r.user_id_a}|${r.user_id_b}|${r.community_id}`, raw: Number(r.raw_weight.toFixed(9)) })
      .toEqual({ edge: `${r.user_id_a}|${r.user_id_b}|${r.community_id}`, raw: Number(expected.toFixed(9)) });
  }

  // --- Critical Note 9: the Providers directory and search, as Noah, through auth-service's SQL ----
  const providers = key('community.providers');
  const noah = key('person.provider');
  const optOut = key('person.ambient-09');
  const amina = key('person.bridge');
  // The route's own statements and skill_key expression, read from routes/skills.ts (no restated SQL).
  const routeSql = skillsRouteSql();
  const skillKeySql = routeSql.skillKey;

  const directory = await pool.query<{ skill_key: string; member_count: number }>(routeSql.directory, [providers, noah]);
  expect(Object.fromEntries(directory.rows.map(r => [r.skill_key, r.member_count])))
    .toEqual(expectedSkillDirectory(baseline, 'community.providers', 'person.provider'));

  // X: every skill key ambient-09 and Amina both hold, read from the reset database itself.
  const shared = await pool.query<{ skill_key: string }>(
    `SELECT ${skillKeySql} AS skill_key FROM auth.user_tags t WHERE t.tag_type = 'skill' AND t.user_id = $1
     INTERSECT
     SELECT ${skillKeySql} AS skill_key FROM auth.user_tags t WHERE t.tag_type = 'skill' AND t.user_id = $2`,
    [optOut, amina]);
  expect(shared.rows.length).toBeGreaterThanOrEqual(1);
  for (const { skill_key: x } of shared.rows) {
    // $3 is what the route binds after resolveSkillSlug: a slug, or the text it normalizes itself.
    const search = await pool.query<{ user_id: string }>(routeSql.search, [providers, noah, x]);
    const found = search.rows.map(r => r.user_id);
    expect({ x, amina: found.includes(amina), optOut: found.includes(optOut) }).toEqual({ x, amina: true, optOut: false });
  }

  // --- PR V's offer boundary on the reset database ----------------------------------------------
  const readable = offerReadablePredicate('o', '$1');
  const visibleTo = async (viewerKey: string) =>
    sortedIds((await pool.query<{ id: string }>(`SELECT o.id FROM requests.help_offers o WHERE ${readable}`, [key(viewerKey)])).rows);
  expect(await visibleTo('person.maria')).toEqual([key('offer.sophia-meal-prep'), key('offer.priya-tutoring')].sort());
  // Marcus Lee: a PDX Rides Collective member who is not the offerer, so the membership half grants it.
  expect(await visibleTo('person.outsider')).toEqual([key('offer.rides-airport')]);
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
    // Expiry is carried by the `expired` boolean, not a 'expired' status (which chk_help_requests_status
    // does not allow — the lifecycle maps to 'open' with expired=TRUE).
    const expiredFlagged = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM requests.help_requests WHERE expired = TRUE",
    );
    const forgotten = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM requests.help_requests WHERE title = '[forgotten]'",
    );

    await assertSkillsAndOffersLayer(pool, compileManifest(CURATED_DEMO_MANIFEST, anchor));

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
