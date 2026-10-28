/**
 * Sprint 132 BUG-061: request/offer routes must derive the caller from the verified JWT, never
 * from a client-supplied body id (ADR-064).
 *
 * Before this fix:
 *   - DELETE /requests/:id   authorized `req.body.user_id`, so anyone could cancel any request,
 *                            including a private directed ask, by naming its requester
 *   - POST /offers           posted as `req.body.offerer_id`
 *   - PUT/DELETE /offers/:id edited or withdrew as `req.body.user_id`
 *
 * The DB boundary is mocked; ownership lookups return OWNER, so each spoof case is RED on a
 * body-trusting handler (the body names OWNER) and GREEN on the fix (the JWT caller is ATTACKER).
 * Every spoof case also asserts no write statement reached the database.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import express from 'express';
import request from 'supertest';

const OWNER = 'owner-user';
const ATTACKER = 'attacker-user';
const COMMUNITY = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';

async function buildApp(userId: string) {
  const { default: requestsRouter } = await import('../../src/routes/requests');
  const { default: offersRouter } = await import('../../src/routes/offers');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { userId, email: 'u@test.com', communities: [] };
    next();
  });
  app.use('/offers', offersRouter);
  app.use('/requests', requestsRouter);
  return app;
}

const writes = () =>
  mockQuery.mock.calls.filter(([sql]) => /^\s*(UPDATE|INSERT|DELETE)\b/i.test(String(sql)));

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const s = String(sql);
    if (/SELECT requester_id FROM requests\.help_requests/.test(s))
      return params[1] === OWNER ? { rows: [{ requester_id: OWNER }], rowCount: 1 } : { rows: [], rowCount: 0 };
    // The offer exists and belongs to OWNER. Owner writes look it up `WHERE id = $1 AND offerer_id = $2`
    // (BUG-064), so the row comes back only when the bound offerer is OWNER.
    if (/FROM requests\.help_offers WHERE id = \$1 AND offerer_id = \$2/.test(s))
      return params[1] === OWNER ? { rows: [{ id: ID, status: 'active' }], rowCount: 1 } : { rows: [], rowCount: 0 };
    if (/FROM communities\.members/.test(s))
      return params[1] === OWNER ? { rows: [{ id: 'm1' }], rowCount: 1 } : { rows: [], rowCount: 0 };
    if (/offer_ttl_days/.test(s)) return { rows: [], rowCount: 0 };
    return { rows: [{ id: ID }], rowCount: 1 };
  });
});

describe('BUG-061: DELETE /requests/:id cancels only as the JWT requester', () => {
  it('rejects a non-requester naming the requester in the body', async () => {
    const res = await request(await buildApp(ATTACKER)).delete(`/requests/${ID}`).send({ user_id: OWNER });
    expect(res.status).toBe(404);
    expect(writes()).toHaveLength(0);
  });

  it('lets the requester cancel with no body user_id', async () => {
    const res = await request(await buildApp(OWNER)).delete(`/requests/${ID}`);
    expect(res.status).toBe(200);
    expect(writes()).toHaveLength(1);
  });
});

describe('BUG-061: offer routes act only as the JWT caller', () => {
  it('POST rejects a non-member naming a member as offerer_id', async () => {
    const res = await request(await buildApp(ATTACKER))
      .post('/offers')
      .send({ community_id: COMMUNITY, offerer_id: OWNER, title: 'Forged', type: 'tools' });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('POST records the JWT caller as offerer_id, ignoring the body', async () => {
    const res = await request(await buildApp(OWNER))
      .post('/offers')
      .send({ community_id: COMMUNITY, offerer_id: ATTACKER, title: 'Ladder', type: 'tools' });
    expect(res.status).toBe(201);
    expect(writes()[0][1][1]).toBe(OWNER);
  });

  // Rejected as 404, not 403, since BUG-064: a foreign offer answers exactly like a missing one.
  it('PUT rejects a non-offerer naming the offerer in the body', async () => {
    const res = await request(await buildApp(ATTACKER)).put(`/offers/${ID}`).send({ title: 'Hijacked', user_id: OWNER });
    expect(res.status).toBe(404);
    expect(writes()).toHaveLength(0);
  });

  it('PUT succeeds for the offerer with no body user_id', async () => {
    const res = await request(await buildApp(OWNER)).put(`/offers/${ID}`).send({ title: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE rejects a non-offerer naming the offerer in the body', async () => {
    const res = await request(await buildApp(ATTACKER)).delete(`/offers/${ID}`).send({ user_id: OWNER });
    expect(res.status).toBe(404);
    expect(writes()).toHaveLength(0);
  });

  it('DELETE succeeds for the offerer with no body user_id', async () => {
    const res = await request(await buildApp(OWNER)).delete(`/offers/${ID}`);
    expect(res.status).toBe(200);
  });
});
