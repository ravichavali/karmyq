/**
 * Sprint 132 BUG-061 against the REAL services and database.
 *
 * The workspace tests (services/{community,request}-service/tests/regression/
 * sprint-132-body-identity.test.ts) prove each handler binds the JWT caller with the DB mocked.
 * This file proves the spoofed writes never land in Postgres, through the running containers
 * (tests/docker-compose.test.yml), with real JWTs from auth-service.
 *
 * Cast: A creates the community (its admin) and a request; X is an ordinary user. Every
 * prerequisite THROWS on failure so a broken setup cannot pass as green.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Pool } from 'pg';

const AUTH = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const COMMUNITY = process.env.COMMUNITY_SERVICE_URL || 'http://localhost:3002';
const REQUESTS = process.env.REQUEST_SERVICE_URL || 'http://localhost:3003';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';

interface Actor { id: string; token: string }

function must<T>(value: T | undefined | null, what: string, body: unknown): T {
  if (value === undefined || value === null) {
    throw new Error(`BUG-061 setup failed: ${what}. Response body: ${JSON.stringify(body)}`);
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

describe('Sprint 132 BUG-061: body-supplied identity is ignored (real services)', () => {
  let pool: Pool;
  let A: Actor;
  let X: Actor;
  let communityId: string;
  let communityName: string;
  let requestId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('SELECT 1'); // fail loudly, not skip, when the database is unreachable

    [A, X] = await Promise.all([register('s132-b61-admin'), register('s132-b61-outsider')]);

    communityName = `S132 BUG-061 ${Date.now()}`;
    const community = await request(COMMUNITY)
      .post('/communities')
      .set('Authorization', auth(A))
      .send({ name: communityName, description: 'Sprint 132 BUG-061', location: 'Test City' });
    communityId = must(community.body?.data?.community?.id, `create community (status ${community.status})`, community.body);

    const created = await request(REQUESTS)
      .post('/requests')
      .set('Authorization', auth(A))
      .set('X-Community-ID', communityId)
      .send({
        community_id: communityId,
        title: 'S132 BUG-061 ask',
        description: 'Sprint 132 BUG-061 cancel fixture',
        urgency: 'medium',
      });
    requestId = must(created.body?.data?.id ?? created.body?.data?.request?.id, `create request (status ${created.status})`, created.body);
  });

  afterAll(async () => {
    await pool?.end();
  });

  const membership = async (userId: string) =>
    (await pool.query('SELECT role, invited_by FROM communities.members WHERE community_id = $1 AND user_id = $2', [communityId, userId])).rows[0];

  it('a non-member cannot add themselves as admin via POST /members', async () => {
    const res = await request(COMMUNITY)
      .post(`/communities/${communityId}/members`)
      .set('Authorization', auth(X))
      .send({ user_id: X.id, role: 'admin', invited_by: A.id });
    expect(res.status).toBe(403);
    expect(await membership(X.id)).toBeUndefined();
  });

  it('the admin adds a member, and invited_by is the JWT caller', async () => {
    const res = await request(COMMUNITY)
      .post(`/communities/${communityId}/members`)
      .set('Authorization', auth(A))
      .send({ user_id: X.id, invited_by: X.id });
    expect(res.status).toBe(201);
    expect(await membership(X.id)).toEqual({ role: 'member', invited_by: A.id });
  });

  it('a member cannot edit or archive the community by naming the admin', async () => {
    const put = await request(COMMUNITY)
      .put(`/communities/${communityId}`)
      .set('Authorization', auth(X))
      .send({ name: 'Hijacked', user_id: A.id });
    const del = await request(COMMUNITY)
      .delete(`/communities/${communityId}`)
      .set('Authorization', auth(X))
      .send({ user_id: A.id });
    expect([put.status, del.status]).toEqual([403, 403]);
    const row = (await pool.query('SELECT name, status FROM communities.communities WHERE id = $1', [communityId])).rows[0];
    expect(row).toEqual({ name: communityName, status: 'active' });
  });

  it('a non-requester cannot cancel the request by naming the requester', async () => {
    const res = await request(REQUESTS)
      .delete(`/requests/${requestId}`)
      .set('Authorization', auth(X))
      .send({ user_id: A.id });
    expect(res.status).toBe(404);
    const row = (await pool.query('SELECT status FROM requests.help_requests WHERE id = $1', [requestId])).rows[0];
    expect(row.status).toBe('open');
  });

  it('the requester cancels with no body user_id', async () => {
    const res = await request(REQUESTS).delete(`/requests/${requestId}`).set('Authorization', auth(A));
    expect(res.status).toBe(200);
    const row = (await pool.query('SELECT status FROM requests.help_requests WHERE id = $1', [requestId])).rows[0];
    expect(row.status).toBe('cancelled');
  });
});
