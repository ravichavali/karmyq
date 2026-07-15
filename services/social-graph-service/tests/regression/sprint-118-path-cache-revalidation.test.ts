/**
 * Sprint 118 / BUG-028 follow-up: cached exchange paths must not bypass the new live-edge
 * derivation. A pre-S118 auth.social_distances row may have been computed from raw completed
 * matches; before returning it, the route must prove every cached hop still exists in the same
 * live, active-membership edge set the graph discloses.
 */
import request from 'supertest';
import express from 'express';
import pathRoutes from '../../src/routes/paths';
import * as pathComputation from '../../src/services/pathComputation';

jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../src/services/pathComputation', () => ({
  computeTrustPath: jest.fn(),
  isCachedExchangePathLive: jest.fn(),
  // Sprint 119: batch route pre-fetches community names for cached community_member rows;
  // cached invitation_chain names re-project through the identity gate.
  getSharedCommunityName: jest.fn().mockResolvedValue(undefined),
  getSharedCommunityNames: jest.fn().mockResolvedValue(new Map()),
  gateCachedPathIdentities: jest.fn(async (path: unknown) => path),
}));

const { pool } = require('../../src/config/database');

const CURRENT = '11111111-1111-1111-1111-111111111111';
const TARGET = '22222222-2222-2222-2222-222222222222';
const BRIDGE = '33333333-3333-3333-3333-333333333333';
const COMMUNITY = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { userId: CURRENT, currentCommunityId: COMMUNITY };
  next();
});
app.use('/paths', pathRoutes);

describe('Sprint 118 / BUG-028: path cache revalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
  });

  it('does not return a cached exchange path whose hops are no longer live graph edges', async () => {
    pool.query
      // Cache lookup returns a pre-S118 exchange path.
      .mockResolvedValueOnce({
        rows: [{
          degrees_of_separation: 2,
          shortest_path: [CURRENT, BRIDGE, TARGET],
          path_trust_score: 99,
          connection_type: 'exchange',
          computed_at: '2026-07-01T00:00:00.000Z',
        }],
      })
      // Stale cache delete.
      .mockResolvedValueOnce({ rows: [] });

    (pathComputation.isCachedExchangePathLive as jest.Mock).mockResolvedValueOnce(false);
    (pathComputation.computeTrustPath as jest.Mock).mockResolvedValueOnce(null);

    const response = await request(app).get(`/paths/${TARGET}`).expect(200);

    expect(pathComputation.isCachedExchangePathLive).toHaveBeenCalledWith([CURRENT, BRIDGE, TARGET]);
    expect(response.body.data).toMatchObject({
      degrees_of_separation: null,
      path: null,
      connection_type: null,
      cached: false,
    });
    expect(response.body.data.cached).not.toBe(true);
    expect(pathComputation.computeTrustPath).toHaveBeenCalledWith(CURRENT, TARGET, COMMUNITY);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM auth.social_distances'),
      [CURRENT, TARGET, COMMUNITY],
    );
  });

  it('revalidates stale exchange rows before returning batch cached paths', async () => {
    pool.query
      // Batch cache lookup returns a pre-S118 exchange path.
      .mockResolvedValueOnce({
        rows: [{
          user_b_id: TARGET,
          degrees_of_separation: 2,
          shortest_path: [CURRENT, BRIDGE, TARGET],
          path_trust_score: 99,
          connection_type: 'exchange',
        }],
      })
      // Stale cache delete.
      .mockResolvedValueOnce({ rows: [] });

    (pathComputation.isCachedExchangePathLive as jest.Mock).mockResolvedValueOnce(false);
    (pathComputation.computeTrustPath as jest.Mock).mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/paths/batch')
      .send({ target_user_ids: [TARGET] })
      .expect(200);

    expect(pathComputation.isCachedExchangePathLive).toHaveBeenCalledWith([CURRENT, BRIDGE, TARGET]);
    expect(response.body.data).toEqual([{
      target_user_id: TARGET,
      degrees_of_separation: null,
      connection_type: null,
      cached: false,
    }]);
    expect(pathComputation.computeTrustPath).toHaveBeenCalledWith(CURRENT, TARGET, COMMUNITY);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM auth.social_distances'),
      [CURRENT, TARGET, COMMUNITY],
    );
  });
});
