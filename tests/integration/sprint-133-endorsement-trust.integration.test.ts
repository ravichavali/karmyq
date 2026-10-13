/**
 * Sprint 133 PR B (ADR-100): skill endorsements feed the trust graph by RECONCILE, never increment.
 * Real auth API, real Bull transport (`karmyq-skill-endorsement-social-graph`), real social-graph
 * consumer container, real PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Proofs (Critical Note 6): (a) one change delivered 3x leaves the count at 1; (b) endorse -> withdraw ->
 * re-endorse gives 1, 0, 1; (c) five skills vouched by one endorser count once; (d) both directions
 * give 2; (e) deleting the endorsed tag cascades and raw_weight drops by exactly the endorsement
 * weight. Concurrency, in-process with two pool clients and the test-only barrier: (f) a stale
 * reconcile released after a withdrawal's reconcile has queued on the pair lock ends at 0, and the
 * same interleaving WITHOUT the lock ends at 1 (the negative control proving the test can fail);
 * (g) a match_completed edge update that runs while a reconcile holds the lock ends with both
 * changes and raw_weight equal to the formula over the final columns.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';
import { pool as sgPool } from '../../services/social-graph-service/src/config/database';
import {
  getInteractionWeightsForCommunity, normalizePair, upsertTrustEdge,
} from '../../services/social-graph-service/src/database/trustEdgeDb';
import {
  reconcileEndorsementPair, reconcileEndorsementPairLocked, setReconcileBarrierForTests,
} from '../../services/social-graph-service/src/services/endorsementReconcile';
import { runReconcileEndorsementEdges } from '../../services/social-graph-service/src/scripts/reconcileEndorsementEdges';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const QUEUE = 'karmyq-skill-endorsement-social-graph';
jest.setTimeout(120000);

const pool = createPool();
const users = { a: randomUUID(), b: randomUUID(), p: randomUUID(), q: randomUUID() };
const c1 = randomUUID(), c2 = randomUUID(), c3 = randomUUID();
const bTags = Array.from({ length: 5 }, () => randomUUID());
const aTag = randomUUID(), qTag = randomUUID();
const requestIds: string[] = [];

const api = (userId: string) => {
  const auth = `Bearer ${jwt.sign({ userId, email: `${userId}@endorse.test`, communities: [] }, process.env.JWT_SECRET!)}`;
  return {
    endorse: (tag_id: string) => request(ServiceUrls.AUTH).post('/auth/skills/endorsements').set('Authorization', auth).send({ tag_id }),
    withdraw: (tagId: string) => request(ServiceUrls.AUTH).delete(`/auth/skills/endorsements/${tagId}`).set('Authorization', auth),
    deleteTag: (tagId: string) => request(ServiceUrls.AUTH).delete(`/auth/profile/tags/${tagId}`).set('Authorization', auth),
    skills: (owner: string) => request(ServiceUrls.AUTH).get(`/auth/skills/users/${owner}`).set('Authorization', auth),
  };
};

async function edge(x: string, y: string, community: string) {
  const { userIdA, userIdB } = normalizePair(x, y);
  const r = await pool.query(
    `SELECT match_completed_count, endorsement_count, karma_given_count, event_count, raw_weight, stability
     FROM social_graph.trust_edges WHERE user_id_a=$1 AND user_id_b=$2 AND community_id=$3`, [userIdA, userIdB, community]);
  return r.rows[0] ?? null;
}
async function waitForCount(x: string, y: string, community: string, expected: number, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await edge(x, y, community);
    if ((row?.endorsement_count ?? 0) === expected) return row;
    if (Date.now() > deadline) throw new Error(`endorsement_count stayed ${row?.endorsement_count ?? 'absent'}, expected ${expected}`);
    await new Promise(r => setTimeout(r, 200));
  }
}
const formula = (row: any, w: { match_completed: number; endorsement: number; karma_given: number; event: number }) =>
  row.match_completed_count * w.match_completed + row.endorsement_count * w.endorsement
  + row.karma_given_count * w.karma_given + row.event_count * w.event;

async function completedMatch(requester: string, responder: string, community: string) {
  const requestId = (await pool.query(
    `INSERT INTO requests.help_requests (requester_id, request_type, category, title, description, status, urgency, payload)
     VALUES ($1,'generic','generic','S133 endorsement fixture','x','completed','medium','{}') RETURNING id`, [requester])).rows[0].id;
  requestIds.push(requestId);
  await pool.query('INSERT INTO requests.request_communities (request_id, community_id) VALUES ($1,$2)', [requestId, community]);
  await pool.query(
    "INSERT INTO requests.matches (request_id, responder_id, status, completed_at) VALUES ($1,$2,'completed',NOW()) RETURNING id",
    [requestId, responder]);
}

/** Resolves once a not-yet-granted advisory lock request exists (the second reconcile is queued). */
async function waitForAdvisoryWaiter() {
  const deadline = Date.now() + 10000;
  for (;;) {
    const r = await pool.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted");
    if (r.rows[0].n > 0) return;
    if (Date.now() > deadline) throw new Error('second writer never queued on the pair lock');
    await new Promise(res => setTimeout(res, 50));
  }
}
function pauseFirstCall() {
  let release!: () => void, paused!: () => void;
  const released = new Promise<void>(r => { release = r; });
  const reached = new Promise<void>(r => { paused = r; });
  let calls = 0;
  setReconcileBarrierForTests(async () => { if (++calls === 1) { paused(); await released; } });
  return { release, reached };
}

beforeAll(async () => {
  await pool.query('SELECT 1');
  for (const [key, id] of Object.entries(users)) {
    await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, `S133 ${key}`, `${id}@endorse.test`, 'not-a-login']);
  }
  for (const id of [c1, c2, c3]) {
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [id, `S133 endorse ${id}`, 'Fixture', users.a]);
  }
  const member = (u: string, c: string) => pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [u, c]);
  for (const c of [c1, c2]) { await member(users.a, c); await member(users.b, c); }
  await member(users.p, c3); await member(users.q, c3);
  for (const [i, id] of bTags.entries()) {
    await pool.query("INSERT INTO auth.user_tags(id,user_id,tag_type,tag_value) VALUES ($1,$2,'skill',$3)", [id, users.b, `S133 skill ${i}`]);
  }
  await pool.query("INSERT INTO auth.user_tags(id,user_id,tag_type,tag_value) VALUES ($1,$2,'skill','S133 A skill')", [aTag, users.a]);
  await pool.query("INSERT INTO auth.user_tags(id,user_id,tag_type,tag_value) VALUES ($1,$2,'skill','S133 Q skill')", [qTag, users.q]);
  // A asked, B helped, inside c1 only. c2 is shared membership with no exchange: it must stay untouched.
  await completedMatch(users.a, users.b, c1);
  await completedMatch(users.p, users.q, c3);
});

afterAll(async () => {
  setReconcileBarrierForTests(null);
  try {
    const all = Object.values(users);
    await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [all]);
    await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [requestIds]);
    await pool.query('DELETE FROM requests.request_communities WHERE request_id = ANY($1::uuid[])', [requestIds]);
    await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [requestIds]);
    await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [[c1, c2, c3]]);
    await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [all]);
  } finally {
    await pool.end();
    await sgPool.end();
  }
});

describe('end to end: auth API -> dedicated queue -> social-graph reconcile', () => {
  it('an outsider without a completed match gets 404 and no row; the partner sees can_endorse', async () => {
    const outsider = await api(users.p).endorse(bTags[0]);
    expect(outsider.status).toBe(404);
    const view = await api(users.a).skills(users.b);
    expect(view.status).toBe(200);
    expect(view.body.data.find((s: any) => s.tag_id === bTags[0])).toEqual(expect.objectContaining({
      endorsement_count: 0, endorsed_by_me: false, can_endorse: true,
    }));
  });

  it('endorse: count 1 in the match community, nothing in the other shared community', async () => {
    const res = await api(users.a).endorse(bTags[0]);
    expect(res.status).toBe(201);
    await waitForCount(users.a, users.b, c1, 1);
    expect(await edge(users.a, users.b, c2)).toBeNull();
    const view = await api(users.a).skills(users.b);
    expect(view.body.data.find((s: any) => s.tag_id === bTags[0])).toEqual(expect.objectContaining({ endorsement_count: 1, endorsed_by_me: true }));
  });

  it('(a) the same change delivered three times through the real queue leaves the count at 1', async () => {
    const queue = new Queue(QUEUE, REDIS_URL);
    try {
      const payload = { endorser_id: users.a, endorsee_id: users.b };
      const jobs = [];
      for (let i = 0; i < 3; i++) jobs.push(await queue.add('skill_endorsement_changed', { eventType: 'skill_endorsement_changed', payload }, { jobId: `s133-redelivery-${randomUUID()}` }));
      for (const job of jobs) await job.finished();
      expect((await edge(users.a, users.b, c1)).endorsement_count).toBe(1);
      for (const job of jobs) await job.remove().catch(() => undefined);
    } finally { await queue.close(); }
  });

  it('(b) withdraw -> 0, re-endorse -> 1 on the same row', async () => {
    const before = (await pool.query('SELECT id, revision FROM auth.skill_endorsements WHERE endorser_id=$1 AND user_tag_id=$2', [users.a, bTags[0]])).rows[0];
    expect((await api(users.a).withdraw(bTags[0])).status).toBe(200);
    await waitForCount(users.a, users.b, c1, 0);
    expect((await api(users.a).withdraw(bTags[0])).status).toBe(200);
    const again = await api(users.a).endorse(bTags[0]);
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(before.id);
    await waitForCount(users.a, users.b, c1, 1);
    const after = (await pool.query('SELECT revision FROM auth.skill_endorsements WHERE id=$1', [before.id])).rows[0];
    expect(Number(after.revision)).toBe(Number(before.revision) + 2);
  });

  it('(c) five skills vouched by one endorser still count once', async () => {
    for (const tag of bTags.slice(1)) expect((await api(users.a).endorse(tag)).status).toBe(201);
    expect((await api(users.a).endorse(bTags[1])).status).toBe(200);
    // Let every event drain, then prove it never rose above 1.
    const queue = new Queue(QUEUE, REDIS_URL);
    try {
      const deadline = Date.now() + 30000;
      while ((await queue.getJobCounts()).waiting + (await queue.getJobCounts()).active > 0) {
        if (Date.now() > deadline) throw new Error('endorsement queue did not drain');
        await new Promise(r => setTimeout(r, 200));
      }
    } finally { await queue.close(); }
    expect((await edge(users.a, users.b, c1)).endorsement_count).toBe(1);
  });

  it('(d) both directions give 2', async () => {
    expect((await api(users.b).endorse(aTag)).status).toBe(201);
    await waitForCount(users.a, users.b, c1, 2);
  });

  it('(e) deleting endorsed tags cascades; raw_weight drops by exactly the endorsement weight', async () => {
    // Back to one endorser (A -> B on five tags), then B deletes every tag A vouched for.
    expect((await api(users.b).withdraw(aTag)).status).toBe(200);
    const one = await waitForCount(users.a, users.b, c1, 1);
    const weights = await getInteractionWeightsForCommunity(c1);
    for (const tag of bTags) expect((await api(users.b).deleteTag(tag)).status).toBe(200);
    const zero = await waitForCount(users.a, users.b, c1, 0);
    expect(Number((await pool.query('SELECT count(*) FROM auth.skill_endorsements WHERE user_tag_id = ANY($1::uuid[])', [bTags])).rows[0].count)).toBe(0);
    expect(one.raw_weight - zero.raw_weight).toBeCloseTo(weights.endorsement, 10);
    expect(zero.raw_weight).toBeCloseTo(formula(zero, weights), 10);
    expect(zero.stability).toBe(one.stability);
  });
});

describe('concurrency on the pair lock (in-process, real PostgreSQL)', () => {
  let rowId: string;
  const activate = () => pool.query('UPDATE auth.skill_endorsements SET withdrawn_at = NULL WHERE id=$1', [rowId]);
  const withdraw = () => pool.query('UPDATE auth.skill_endorsements SET withdrawn_at = NOW() WHERE id=$1', [rowId]);
  afterEach(() => setReconcileBarrierForTests(null));

  beforeAll(async () => {
    const matchId = (await pool.query(
      `SELECT m.id FROM requests.matches m JOIN requests.help_requests r ON r.id = m.request_id WHERE r.requester_id=$1`, [users.p])).rows[0].id;
    rowId = (await pool.query(
      'INSERT INTO auth.skill_endorsements (endorser_id, endorsee_id, user_tag_id, match_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [users.p, users.q, qTag, matchId])).rows[0].id;
  });

  it('(f) a stale reconcile released after a withdrawal cannot win: final 0', async () => {
    const gate = pauseFirstCall();
    const r1 = reconcileEndorsementPair(users.p, users.q);
    await gate.reached;            // R1 read "active" and holds the pair lock
    await withdraw();              // the withdrawal commits
    const r2 = reconcileEndorsementPair(users.q, users.p);
    await waitForAdvisoryWaiter(); // R2 is queued behind R1, not racing it
    gate.release();
    await Promise.all([r1, r2]);
    expect((await edge(users.p, users.q, c3)).endorsement_count).toBe(0);
  });

  it('(f) negative control: the same interleaving WITHOUT the lock ends at 1', async () => {
    await activate();
    const gate = pauseFirstCall();
    const { userIdA, userIdB } = normalizePair(users.p, users.q);
    const unlocked = async () => {
      const client = await sgPool.connect();
      try {
        await client.query('BEGIN');
        await reconcileEndorsementPairLocked(client, userIdA, userIdB);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    };
    const r1 = unlocked();
    await gate.reached;
    await withdraw();
    await unlocked();              // R2 runs to completion: target 0, stored 0 -> no write
    gate.release();
    await r1;                      // R1 writes its stale 1
    expect((await edge(users.p, users.q, c3)).endorsement_count).toBe(1);
    await reconcileEndorsementPair(users.p, users.q); // heal for the next case
    expect((await edge(users.p, users.q, c3)).endorsement_count).toBe(0);
  });

  it('(g) a match_completed update during a held reconcile keeps both changes and an exact raw_weight', async () => {
    await activate();
    const before = await edge(users.p, users.q, c3);
    const gate = pauseFirstCall();
    const r1 = reconcileEndorsementPair(users.p, users.q);
    await gate.reached;
    const upsert = upsertTrustEdge({ userA: users.q, userB: users.p, communityId: c3, interactionType: 'match_completed' });
    await waitForAdvisoryWaiter();
    gate.release();
    await Promise.all([r1, upsert]);
    const after = await edge(users.p, users.q, c3);
    expect(after.match_completed_count).toBe(before.match_completed_count + 1);
    expect(after.endorsement_count).toBe(1);
    expect(after.raw_weight).toBeCloseTo(formula(after, await getInteractionWeightsForCommunity(c3)), 10);
  });

  it('the operator backfill reports drift in dry-run without writing, and --apply repairs it', async () => {
    const { userIdA, userIdB } = normalizePair(users.p, users.q);
    await pool.query('UPDATE social_graph.trust_edges SET endorsement_count = 2 WHERE user_id_a=$1 AND user_id_b=$2 AND community_id=$3', [userIdA, userIdB, c3]);
    const dry = await runReconcileEndorsementEdges({ apply: false, log: () => undefined });
    expect(dry.drifted).toEqual(expect.arrayContaining([expect.objectContaining({ user_id_a: userIdA, user_id_b: userIdB, community_id: c3, stored: 2, target: 1 })]));
    expect((await edge(users.p, users.q, c3)).endorsement_count).toBe(2);
    const applied = await runReconcileEndorsementEdges({ apply: true, log: () => undefined });
    expect(applied.applied).toBeGreaterThanOrEqual(1);
    const fixed = await edge(users.p, users.q, c3);
    expect(fixed.endorsement_count).toBe(1);
    expect(fixed.raw_weight).toBeCloseTo(formula(fixed, await getInteractionWeightsForCommunity(c3)), 10);
  });
});
