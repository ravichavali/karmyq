/**
 * Sprint 134 PR K (BUG-069, ADR-102): the decay-config write re-derives the caller's role from
 * communities.members. The stale-case caller CLAIMS admin of C, so a 403 proves the claim no longer
 * grants anything; the positive row carries an EMPTY claim, so passing proves the gate reads the row.
 *
 * Real router; the pool, the decay-config store and (for the route rows) the live-role module are
 * mocked. The helper's own cases run against the real module; its SQL is proven in
 * tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts.
 */
import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
jest.mock('../../src/config/database', () => ({ pool: { query: (...a: any[]) => mockQuery(...a) } }));
jest.mock('../../src/database/trustDecayConfigDb', () => ({
  getDecayConfig: jest.fn(),
  getGlobalDecayConfig: jest.fn(),
  upsertDecayConfig: jest.fn(),
}));
jest.mock('../../src/database/liveRole', () => ({
  ...jest.requireActual('../../src/database/liveRole'),
  getLiveRole: jest.fn(),
  isLiveAdmin: jest.fn(),
}));

import * as liveRole from '../../src/database/liveRole';
import { getDecayConfig, upsertDecayConfig } from '../../src/database/trustDecayConfigDb';
import trustDecayConfigRouter from '../../src/routes/trustDecayConfig';

const actual = jest.requireActual('../../src/database/liveRole') as typeof liveRole;
const mocked = liveRole as jest.Mocked<typeof liveRole>;

const U = '10000000-0000-4000-8000-000000000001';
const C = '20000000-0000-4000-8000-000000000001';
const CONFIG = { baseHalfLifeDays: 90, stabilityGrowthRate: 0.1, disappearanceThreshold: 0.05 };

let claim: unknown[] = [];
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { userId: U, email: 'u@test.example', communities: claim };
  next();
});
app.use('/trust', trustDecayConfigRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  for (const fn of [mocked.getLiveRole, mocked.isLiveAdmin]) fn.mockReset();
  (getDecayConfig as jest.Mock).mockReset().mockResolvedValue(CONFIG);
  (upsertDecayConfig as jest.Mock).mockReset().mockResolvedValue(CONFIG);
});

describe('liveRole helper (real module, pool mocked)', () => {
  it('reads the active row with exact params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'moderator' }], rowCount: 1 });
    expect(await actual.getLiveRole(C, U)).toBe('moderator');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(/FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2 AND status = 'active'/);
    expect(mockQuery.mock.calls[0][1]).toEqual([C, U]);
  });
  it('answers null when there is no active row', async () => {
    expect(await actual.getLiveRole(C, U)).toBeNull();
  });
  it("reads an active row whose role is NULL as 'member' (the column default)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: null }], rowCount: 1 });
    expect(await actual.getLiveRole(C, U)).toBe('member');
  });
  it.each([[undefined, U], ['not-a-uuid', U], [C, undefined]])('answers null without a query for (%p, %p)', async (c, u) => {
    expect(await actual.getLiveRole(c, u)).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('isLiveAdmin is false for a moderator and true for an admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'moderator' }], rowCount: 1 });
    expect(await actual.isLiveAdmin(C, U)).toBe(false);
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }], rowCount: 1 });
    expect(await actual.isLiveAdmin(C, U)).toBe(true);
  });
});

describe('PUT /trust/decay-config/:communityId', () => {
  it('refuses a stale admin claim and writes nothing', async () => {
    claim = [{ id: C, name: 'C', role: 'admin' }];
    mocked.isLiveAdmin.mockResolvedValue(false);
    const res = await request(app).put(`/trust/decay-config/${C}`).send(CONFIG);
    expect(res.status).toBe(403);
    expect(mocked.isLiveAdmin.mock.calls).toEqual([[C, U]]);
    expect(upsertDecayConfig).not.toHaveBeenCalled();
  });
  it('writes for a live admin with an empty claim', async () => {
    claim = [];
    mocked.isLiveAdmin.mockResolvedValue(true);
    const res = await request(app).put(`/trust/decay-config/${C}`).send(CONFIG);
    expect(res.status).toBe(200);
    expect(upsertDecayConfig).toHaveBeenCalledWith(C, CONFIG);
  });
});

describe('GET /trust/decay-config/:communityId (live membership)', () => {
  it('is not available to a non-member', async () => {
    mocked.getLiveRole.mockResolvedValue(null);
    const res = await request(app).get(`/trust/decay-config/${C}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('DECAY_CONFIG_NOT_AVAILABLE');
    expect(mocked.getLiveRole.mock.calls).toEqual([[C, U]]);
  });
  it('returns the config to an active member', async () => {
    mocked.getLiveRole.mockResolvedValue('member');
    const res = await request(app).get(`/trust/decay-config/${C}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(CONFIG);
  });
});
