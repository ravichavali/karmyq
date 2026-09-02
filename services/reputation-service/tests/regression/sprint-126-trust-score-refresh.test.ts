/**
 * Sprint 126 — the daily canonical trust-score refresh.
 *
 * `computeTrustScore` reads a MOVING 12-month window, so a stored score only decays if something
 * recomputes it. `updateTrustScore` runs on match completion — exactly what a dormant member does
 * not do. And the ADR-095 provider reach gate reads the CACHED value, not a fresh one, so a frozen
 * cache keeps dormant providers visible indefinitely.
 *
 * cleanup-service used to sweep at 03:00 with a pre-ADR-037 `karma/10` formula. Sprint 126 stopped
 * that job writing scores — correctly, it was replacing the real score rather than decaying it —
 * but that removed the only refresh cadence. These tests pin the replacement: same cadence, the
 * canonical calculator, owned by the service that owns the data.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockUpdateTrustScore = jest.fn<Promise<void>, [string, string]>(async () => undefined);
jest.mock('../../src/services/karmaService', () => ({
  updateTrustScore: (u: string, c: string) => mockUpdateTrustScore(u, c),
}));

const mockSchedule = jest.fn();
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: (expr: string, fn: unknown) => mockSchedule(expr, fn) },
}));

import { refreshAllTrustScores, initTrustScoreRefresh } from '../../src/cron/trustScoreRefresh';

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateTrustScore.mockImplementation(async () => undefined);
});

describe('refreshAllTrustScores', () => {
  it('recalculates every ACTIVE membership through the canonical calculator', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_id: 'u1', community_id: 'c1' },
        { user_id: 'u2', community_id: 'c1' },
        { user_id: 'u1', community_id: 'c2' },
      ],
    });

    const result = await refreshAllTrustScores();

    expect(result).toEqual({ evaluated: 3, failed: 0 });
    expect(mockUpdateTrustScore).toHaveBeenCalledTimes(3);
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('u1', 'c1');
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('u2', 'c1');
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('u1', 'c2');
  });

  it('selects only active memberships', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await refreshAllTrustScores();

    expect(String(mockQuery.mock.calls[0][0])).toMatch(/status = 'active'/);
  });

  it('derives nothing itself — the score comes only from updateTrustScore', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', community_id: 'c1' }] });
    await refreshAllTrustScores();

    const sql = mockQuery.mock.calls.map((c) => String(c[0])).join(' | ');
    // The whole point: no second formula. cleanup-service's karma/10 is what this replaces.
    expect(sql).not.toMatch(/calculate_decayed_karma/i);
    expect(sql).not.toMatch(/UPDATE\s+reputation\.trust_scores/i);
  });

  it('keeps sweeping when one pair fails, rather than abandoning the rest', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_id: 'u1', community_id: 'c1' },
        { user_id: 'u2', community_id: 'c1' },
        { user_id: 'u3', community_id: 'c1' },
      ],
    });
    mockUpdateTrustScore.mockImplementationOnce(async () => undefined);
    mockUpdateTrustScore.mockImplementationOnce(async () => {
      throw new Error('one bad pair');
    });
    mockUpdateTrustScore.mockImplementationOnce(async () => undefined);

    const result = await refreshAllTrustScores();

    // A partially refreshed table beats a wholly stale one.
    expect(result).toEqual({ evaluated: 2, failed: 1 });
    expect(mockUpdateTrustScore).toHaveBeenCalledTimes(3);
  });

  it('handles an empty platform without error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(refreshAllTrustScores()).resolves.toEqual({ evaluated: 0, failed: 0 });
  });
});

describe('initTrustScoreRefresh', () => {
  it('schedules a daily sweep', async () => {
    initTrustScoreRefresh();

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const [expression, handler] = mockSchedule.mock.calls[0] as [string, () => Promise<void>];
    // Daily, and clear of the 02:00 health-metrics job.
    expect(expression).toBe('30 3 * * *');

    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', community_id: 'c1' }] });
    await handler();
    expect(mockUpdateTrustScore).toHaveBeenCalledWith('u1', 'c1');
  });

  it('does not let a sweep failure crash the scheduler', async () => {
    initTrustScoreRefresh();
    const [, handler] = mockSchedule.mock.calls[0] as [string, () => Promise<void>];

    mockQuery.mockRejectedValueOnce(new Error('database unreachable'));

    await expect(handler()).resolves.toBeUndefined();
  });
});
