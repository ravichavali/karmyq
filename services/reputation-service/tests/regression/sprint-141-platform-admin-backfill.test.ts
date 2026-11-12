/**
 * Sprint 141 (BUG-073, ADR-105): `POST /reputation/provider-trust/recalculate` recomputes every provider's trust
 * score on the whole platform, so it admits a live PLATFORM admin (a row in `auth.platform_admins`) and nobody else.
 * A community admin, including any community's creator, is refused with the shared body and the backfill never runs.
 *
 * Real router; auth, the PostgreSQL boundary, the backfill service and the live-role module are mocked (the
 * sprint-134-pr-k-live-role pattern). The helper's own cases run against the real module; its SQL is proven against
 * the real schema in tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts.
 */
import express from 'express';
import request from 'supertest';

let currentUser: any = null;
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a) }));
jest.mock('../../src/services/providerTrustService', () => ({
  recalculateProviderTrustScore: jest.fn(), backfillAllProviderTrustScores: jest.fn(),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));
// Automock: every export is a jest.fn (the helper's own cases use jest.requireActual).
jest.mock('../../src/utils/liveRole');

import * as liveRole from '../../src/utils/liveRole';
import { backfillAllProviderTrustScores } from '../../src/services/providerTrustService';
import providerReviewsRouter from '../../src/routes/providerReviews';

const actual = jest.requireActual('../../src/utils/liveRole') as typeof liveRole;
const mocked = liveRole as jest.Mocked<typeof liveRole>;

const U = '10000000-0000-4000-8000-000000000001';
const C = '20000000-0000-4000-8000-000000000001';
const ADMIN_OF_C = { userId: U, email: 'u@test.example', communities: [{ id: C, name: 'Mine', role: 'admin' }] };
const EMPTY_CLAIM = { userId: U, email: 'u@test.example', communities: [] };
const PLATFORM_ADMIN_REQUIRED = { success: false, message: 'Platform admin access required', error: 'PLATFORM_ADMIN_REQUIRED' };

const app = express();
app.use(express.json());
app.use('/reputation', providerReviewsRouter);

// The root jest config resets every mock before each test (resetMocks), so implementations are armed per test.
beforeEach(() => {
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

const recalculate = (user: object) => {
  currentUser = user;
  return request(app).post('/reputation/provider-trust/recalculate');
};

describe('isLivePlatformAdmin (real module, pg mocked)', () => {
  it('reads auth.platform_admins with the exact SQL and [userId]', async () => {
    expect(await actual.isLivePlatformAdmin(U)).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toBe('SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1');
    expect(mockQuery.mock.calls[0][1]).toEqual([U]);
  });
  it('is true for one grant row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    expect(await actual.isLivePlatformAdmin(U)).toBe(true);
  });
  it('is false without a query for no user', async () => {
    expect(await actual.isLivePlatformAdmin(undefined)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('POST /reputation/provider-trust/recalculate admits platform admins only (BUG-073)', () => {
  it('a live community admin with no platform grant → 403, and the backfill never runs', async () => {
    mocked.getLiveRole.mockResolvedValue('admin');
    mocked.isLiveAdmin.mockResolvedValue(true);
    mocked.isLivePlatformAdmin.mockResolvedValue(false);
    const res = await recalculate(ADMIN_OF_C);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(PLATFORM_ADMIN_REQUIRED);
    expect(mocked.isLivePlatformAdmin.mock.calls).toEqual([[U]]);
    expect(backfillAllProviderTrustScores).not.toHaveBeenCalled();
  });

  it('a platform admin with no community role and an empty claim runs it', async () => {
    mocked.getLiveRole.mockResolvedValue(null);
    mocked.isLiveAdmin.mockResolvedValue(false);
    mocked.isLivePlatformAdmin.mockResolvedValue(true);
    (backfillAllProviderTrustScores as jest.Mock).mockResolvedValue(7);
    const res = await recalculate(EMPTY_CLAIM);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { updated: 7 }, message: 'Recalculated trust scores for 7 providers' });
    expect(backfillAllProviderTrustScores).toHaveBeenCalledTimes(1);
  });
});
