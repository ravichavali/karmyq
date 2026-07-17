/**
 * Sprint 120 / BUG-030: path scores are fractional, and one failed cache write must
 * not take down every result in the feed-ranking batch.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../src/services/pathComputation', () => ({
  computeTrustPath: jest.fn(),
  isCachedExchangePathLive: jest.fn(),
  getSharedCommunityName: jest.fn().mockResolvedValue(undefined),
  getSharedCommunityNames: jest.fn().mockResolvedValue(new Map()),
  gateCachedPathIdentities: jest.fn(async (path: unknown) => path),
}));

const { pool } = require('../../src/config/database');
const { logger } = require('../../src/config/logger');
const pathComputation = require('../../src/services/pathComputation');
const pathRoutes = require('../../src/routes/paths').default;

const CURRENT = '11111111-1111-1111-1111-111111111111';
const TARGET_ONE = '22222222-2222-2222-2222-222222222222';
const TARGET_TWO = '33333333-3333-3333-3333-333333333333';
const TARGET_THREE = '44444444-4444-4444-4444-444444444444';
const COMMUNITY = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const FRACTIONAL_SCORE = 18.2445981519795;

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { userId: CURRENT, currentCommunityId: COMMUNITY };
  next();
});
app.use('/paths', pathRoutes);

function computedPath(target: string, degrees: number, trustScore = FRACTIONAL_SCORE) {
  return {
    degrees,
    path: [{ id: CURRENT, name: 'Maria' }, { id: target, name: 'Neighbour' }],
    trustScore,
    connectionType: 'exchange',
  };
}

describe('Sprint 120 / BUG-030: fractional path score cache writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
    pathComputation.getSharedCommunityNames.mockResolvedValue(new Map());
  });

  it('passes a fractional score to the single-path cache INSERT without rounding', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    pathComputation.computeTrustPath.mockResolvedValue(
      computedPath(TARGET_ONE, 1, FRACTIONAL_SCORE),
    );

    await request(app).get(`/paths/${TARGET_ONE}`).expect(200);

    const insertCall = pool.query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO auth.social_distances'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1][5]).toBe(FRACTIONAL_SCORE);
  });

  it('degrades one failed batch cache write to no-connection and preserves other ranking degrees', async () => {
    pool.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT') && sql.includes('auth.social_distances')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO auth.social_distances') && params?.[1] === TARGET_TWO) {
        return Promise.reject(new Error('integer out of range'));
      }
      return Promise.resolve({ rows: [] });
    });
    pathComputation.computeTrustPath.mockImplementation(
      async (_source: string, target: string) => {
        if (target === TARGET_ONE) return computedPath(target, 1);
        if (target === TARGET_TWO) return computedPath(target, 2);
        return computedPath(target, 3);
      },
    );

    const response = await request(app)
      .post('/paths/batch')
      .send({ target_user_ids: [TARGET_ONE, TARGET_TWO, TARGET_THREE] })
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({ target_user_id: TARGET_ONE, degrees_of_separation: 1 }),
      {
        target_user_id: TARGET_TWO,
        degrees_of_separation: null,
        connection_type: null,
        cached: false,
      },
      expect.objectContaining({ target_user_id: TARGET_THREE, degrees_of_separation: 3 }),
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      'Error computing batch path for target',
      expect.any(Error),
      expect.objectContaining({ targetUserId: TARGET_TWO }),
    );
  });
});
