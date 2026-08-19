/**
 * Sprint 93 — F1 (ADR-073): community-scoped provider discovery.
 *
 * GET /providers stays public, but when called WITH a token it annotates each provider
 * with `shared_communities` — the communities the provider and viewer both belong to.
 * The viewer's communities are derived from LIVE `communities.members` (keyed on the
 * signed JWT userId), NOT the JWT `communities` claim, so a stale token can't badge a
 * community the viewer has since left. Unauthenticated responses are unchanged. No schema
 * change — uses existing communities.members.
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

  it('ignores the JWT communities claim — keys the live lookup on the signed userId (stale-token guard)', async () => {
    // The token CLAIMS community c-stale, but the live membership join returns nothing
    // (the viewer has since left). The provider in c-stale must NOT be badged.
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor' }] })
      .mockResolvedValueOnce({ rows: [] }); // live-membership join → no shared communities

    const res = await request(app)
      .get('/providers')
      .set('Authorization', `Bearer ${tokenWith([{ id: 'c-stale', name: 'Left Community' }])}`);

    expect(res.body.data[0].shared_communities).toEqual([]);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(String(sql)).toMatch(/communities\.members vm/);   // viewer's LIVE membership
    expect(String(sql)).toMatch(/vm\.user_id = \$1/);
    expect(params[0]).toBe('viewer-1');                        // signed userId, NOT the claimed community ids
    expect(params[1]).toEqual(['u1']);                         // provider user ids
    expect(params).not.toContainEqual(['c-stale']);            // the stale claim is never bound
  });

  /*
   * ⚠️ SUPERSEDED BY ADR-095 (Sprint 125). This case used to assert that an UNAUTHENTICATED caller
   * got 200 with no `shared_communities` annotation — the Sprint 93 contract, when `GET /providers`
   * was public. The directory now requires authentication, so the same request is rejected before
   * any query runs.
   *
   * The Sprint 93 behaviour this file exists to protect is unchanged and still asserted above and
   * below: the annotation is derived from LIVE `communities.members`, never the JWT claim. Only the
   * anonymous entry point is gone.
   */
  it('rejects an unauthenticated request outright (ADR-095) and runs NO query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor' }] });

    const res = await request(app).get('/providers');

    expect(res.status).toBe(401);
    // Still the stronger half of the original assertion: no database work on an anonymous caller.
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('annotates [] for an authenticated viewer with no live shared community (still queries live membership)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/providers')
      .set('Authorization', `Bearer ${tokenWith([])}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].shared_communities).toEqual([]);
    expect(mockQuery).toHaveBeenCalledTimes(2); // providers + live-membership join
  });
});
