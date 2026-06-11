/**
 * Sprint 93 — F1 (ADR-073): community-scoped provider discovery.
 *
 * GET /providers stays public, but when called WITH a token it annotates each provider
 * with `shared_communities` — the communities the provider and the viewer both belong to.
 * The UI groups/badges "providers in your communities" vs others, putting the directory
 * behind the same community trust lens as dibs/matching. Unauthenticated responses are
 * unchanged. No schema change — uses existing communities.members.
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
import { query } from '../../src/database/db';
const mockQuery = query as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const providersRouter = require('../../src/routes/providers').default;
  app.use('/providers', providersRouter);
  return app;
}

const JWT_SECRET = 'test-secret';
function tokenWith(communities: { id: string; name: string }[]) {
  return jwt.sign({ userId: 'viewer-1', email: 'v@test.com', communities }, JWT_SECRET);
}

describe('Sprint 93 F1: community-scoped provider discovery', () => {
  let app: express.Express;
  beforeAll(() => { process.env.JWT_SECRET = JWT_SECRET; app = buildApp(); });
  afterEach(() => mockQuery.mockReset());

  it('annotates each provider with the communities shared with the authenticated viewer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [
        { id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor' },
        { id: 'p2', user_id: 'u2', display_name: 'Bob', service_type: 'ride' },
      ] })
      .mockResolvedValueOnce({ rows: [
        { user_id: 'u1', community_id: 'c1', community_name: 'Berkeley Community Care' },
      ] });

    const res = await request(app)
      .get('/providers')
      .set('Authorization', `Bearer ${tokenWith([{ id: 'c1', name: 'Berkeley Community Care' }])}`);

    expect(res.status).toBe(200);
    const [alice, bob] = res.body.data;
    expect(alice.shared_communities).toEqual([{ id: 'c1', name: 'Berkeley Community Care' }]);
    expect(bob.shared_communities).toEqual([]); // listed in the directory but not in a shared community
  });

  it('scopes the shared-community lookup to the viewer community ids and the listed providers', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor' }] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get('/providers')
      .set('Authorization', `Bearer ${tokenWith([{ id: 'c1', name: 'Berkeley' }, { id: 'c2', name: 'PDX' }])}`);

    const [sql, params] = mockQuery.mock.calls[1];
    expect(String(sql)).toMatch(/communities\.members/);
    expect(params[0]).toEqual(['c1', 'c2']); // viewer community ids
    expect(params[1]).toEqual(['u1']);        // provider user ids
  });

  it('does NOT annotate (and runs no extra query) for unauthenticated requests', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor' }] });

    const res = await request(app).get('/providers');

    expect(res.status).toBe(200);
    expect(res.body.data[0].shared_communities).toBeUndefined();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('skips the shared-community query when the viewer has no communities (annotates [])', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor' }] });

    const res = await request(app)
      .get('/providers')
      .set('Authorization', `Bearer ${tokenWith([])}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].shared_communities).toEqual([]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
