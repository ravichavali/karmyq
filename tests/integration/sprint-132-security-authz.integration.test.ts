/**
 * Sprint 132 PR S — BUG-055 + BUG-057 against the REAL services and database.
 *
 * The workspace tests prove the SQL shape and the bound caller id with the DB boundary mocked. This
 * file proves the predicates actually filter rows in Postgres, through the running request- and
 * notification-service containers (tests/docker-compose.test.yml), with real JWTs from auth-service.
 *
 * Cast: R (requester) posts a platform-visible request; H (helper) offers on it, creating a real
 * proposed match; X (outsider) has no relation to either. Every prerequisite THROWS on failure. A
 * skipped setup would turn every assertion below into a false green (see complete-workflow.test.ts,
 * which logs "Skipping" and passes).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';

const AUTH = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const COMMUNITY = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
const REQUESTS = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATIONS = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

interface Actor { id: string; token: string }

function must<T>(value: T | undefined | null, what: string, body: unknown): T {
  if (value === undefined || value === null) {
    throw new Error(`Sprint 132 PR S setup failed: ${what}. Response body: ${JSON.stringify(body)}`);
  }
  return value;
}

async function register(tag: string): Promise<Actor> {
  const stamp = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await request(AUTH).post('/auth/register').send({
    email: `${stamp}@karmyq.test`,
    password: 'SecurePassword123!',
    name: stamp,
  });
  return {
    id: must(res.body?.data?.user?.id, `register ${tag} (status ${res.status})`, res.body),
    token: must(res.body?.data?.token, `token for ${tag}`, res.body),
  };
}

const auth = (a: Actor) => `Bearer ${a.token}`;

describe('Sprint 132 PR S: caller and participant scoping (real services)', () => {
  let pool: Pool;
  let R: Actor;
  let H: Actor;
  let X: Actor;
  let communityId: string;
  let requestId: string;
  let matchId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('SELECT 1'); // fail loudly, not skip, when the database is unreachable

    [R, H, X] = await Promise.all([register('s132-requester'), register('s132-helper'), register('s132-outsider')]);

    const community = await request(COMMUNITY)
      .post('/communities')
      .set('Authorization', auth(R))
      .send({ name: `S132 authz ${Date.now()}`, description: 'Sprint 132 PR S', location: 'Test City' });
    communityId = must(community.body?.data?.community?.id, `create community (status ${community.status})`, community.body);

    const created = await request(REQUESTS)
      .post('/requests')
      .set('Authorization', auth(R))
      .set('X-Community-ID', communityId)
      .send({
        community_id: communityId,
        title: 'S132 private-ish ask',
        description: 'Sprint 132 PR S participant-scope fixture',
        urgency: 'medium',
        // platform scope: H may offer without joining, so the only relation H has is the match itself
        visibility_scope: 'platform',
      });
    requestId = must(created.body?.data?.id ?? created.body?.data?.request?.id, `create request (status ${created.status})`, created.body);

    const offer = await request(REQUESTS)
      .post('/matches')
      .set('Authorization', auth(H))
      .send({ request_id: requestId });
    if (offer.status !== 201 && offer.status !== 200) {
      throw new Error(`Sprint 132 PR S setup failed: H offer (status ${offer.status}): ${JSON.stringify(offer.body)}`);
    }
    const row = await pool.query(
      'SELECT id FROM requests.matches WHERE request_id = $1 AND responder_id = $2',
      [requestId, H.id]
    );
    matchId = must(row.rows[0]?.id, 'match row for H', row.rows);
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    if (requestId) {
      await pool.query('DELETE FROM requests.matches WHERE request_id = $1', [requestId]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = $1', [requestId]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = $1', [requestId]);
    }
    if (communityId) {
      await pool.query('DELETE FROM communities.members WHERE community_id = $1', [communityId]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [communityId]);
    }
    for (const a of [R, H, X].filter(Boolean)) {
      await pool.query('DELETE FROM notifications.notifications WHERE user_id = $1', [a.id]);
      await pool.query('DELETE FROM auth.users WHERE id = $1', [a.id]);
    }
    await pool.end();
  });

  // ─── BUG-057: match views ───────────────────────────────────────────────

  it.each([
    ['requester', () => R],
    ['helper', () => H],
  ])('GET /matches/:id → 200 for the %s', async (_label, who) => {
    const res = await request(REQUESTS).get(`/matches/${matchId}`).set('Authorization', auth(who()));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(matchId);
  });

  it('GET /matches/:id → 404 for an outsider (no title, no emails)', async () => {
    const res = await request(REQUESTS).get(`/matches/${matchId}`).set('Authorization', auth(X));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('S132 private-ish ask');
  });

  it('GET /matches with NO filters: the outsider sees none of R/H\'s matches', async () => {
    const res = await request(REQUESTS).get('/matches').query({ limit: 200 }).set('Authorization', auth(X));
    expect(res.status).toBe(200);
    expect(res.body.data.matches.map((m: { id: string }) => m.id)).not.toContain(matchId);
    for (const m of res.body.data.matches) {
      expect([m.requester_id, m.responder_id]).toContain(X.id);
    }
  });

  it.each([
    ['user_id', () => ({ user_id: R.id })],
    ['request_id', () => ({ request_id: requestId })],
  ])('GET /matches with a spoofed %s filter: the outsider still gets nothing', async (_label, params) => {
    const res = await request(REQUESTS).get('/matches').query(params()).set('Authorization', auth(X));
    expect(res.status).toBe(200);
    expect(res.body.data.matches).toEqual([]);
  });

  it('GET /matches: the requester and the helper each see exactly this match for the request', async () => {
    for (const who of [R, H]) {
      const res = await request(REQUESTS).get('/matches').query({ request_id: requestId }).set('Authorization', auth(who));
      expect(res.status).toBe(200);
      expect(res.body.data.matches.map((m: { id: string }) => m.id)).toEqual([matchId]);
    }
  });

  it('GET /matches/:id/feedback: the outsider naming a participant in ?user_id → 403; the requester → 200', async () => {
    const cross = await request(REQUESTS)
      .get(`/matches/${matchId}/feedback`)
      .query({ user_id: R.id })
      .set('Authorization', auth(X));
    expect(cross.status).toBe(403);

    const own = await request(REQUESTS).get(`/matches/${matchId}/feedback`).set('Authorization', auth(R));
    expect(own.status).toBe(200);
  });

  // ─── BUG-055: notification routes ───────────────────────────────────────

  it.each([
    ['get', (id: string) => `/notifications/${id}`],
    ['get', (id: string) => `/notifications/${id}/unread-count`],
    ['get', (id: string) => `/notifications/${id}/preferences`],
    ['put', (id: string) => `/notifications/${id}/read-all`],
  ] as const)('%s %s: another user\'s id → 403; own id → 200', async (method, path) => {
    const call = (who: Actor, target: string) =>
      request(NOTIFICATIONS)[method](path(target)).set('Authorization', auth(who));

    const cross = await call(X, R.id);
    expect(cross.status).toBe(403);
    expect(cross.body.error).toBe('FORBIDDEN');

    const own = await call(R, R.id);
    expect(own.status).toBe(200);
  });

  it('PUT /notifications/:id/read with a body user_id cannot touch another user\'s notification', async () => {
    const inserted = await pool.query(
      `INSERT INTO notifications.notifications (user_id, type, title, body, read)
       VALUES ($1, 'system', 'S132 probe', 'S132 probe', false) RETURNING id`,
      [R.id]
    );
    const notificationId = inserted.rows[0].id;

    const cross = await request(NOTIFICATIONS)
      .put(`/notifications/${notificationId}/read`)
      .set('Authorization', auth(X))
      .send({ user_id: R.id });
    expect(cross.status).toBe(404);
    const after = await pool.query('SELECT read FROM notifications.notifications WHERE id = $1', [notificationId]);
    expect(after.rows[0].read).toBe(false);

    const own = await request(NOTIFICATIONS)
      .put(`/notifications/${notificationId}/read`)
      .set('Authorization', auth(R))
      .send({});
    expect(own.status).toBe(200);
  });
});
