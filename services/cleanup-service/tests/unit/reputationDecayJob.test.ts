import { updateDecayedTrustScores } from '../../src/jobs/reputationDecayJob';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.MockedFunction<typeof query>;

/**
 * Sprint 126 (ADR-096) — this job must NOT write trust scores.
 *
 * It previously overwrote `reputation.trust_scores.score` with
 * `min(100, floor(decayed_karma / 10))`, a pre-ADR-037 formula. ADR-039 Phase 2 moved decay into
 * the canonical calculator (`updateTrustScore` already applies a 12-month recency window and
 * recency-weighted feedback), so this second formula did not add decay — it replaced the real
 * score with a cruder one.
 *
 * That was invisible because `trust_scores` held zero rows platform-wide (BUG-037), so the nightly
 * 03:00 cron selected nothing. Once Sprint 126's backfill populates the table, the old behaviour
 * would have wiped every projected score within 24 hours and re-emptied ADR-095's provider reach
 * gate. The tests below exist so that cannot come back.
 */
describe('updateDecayedTrustScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues no database query at all', async () => {
    await updateDecayedTrustScores();

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('never writes reputation.trust_scores, even if rows exist', async () => {
    // Arrange a database that WOULD have produced an overwrite under the old formula: a populated
    // trust_scores table and a decayed-karma value that maps to a different score.
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'ts1', user_id: 'u1', community_id: 'c1', current_score: 74 }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({ rows: [{ decayed_karma: 100 }], rowCount: 1 } as never);

    await updateDecayedTrustScores();

    const writes = mockQuery.mock.calls.filter((call) =>
      /UPDATE\s+reputation\.trust_scores/i.test(String(call[0])),
    );
    expect(writes).toEqual([]);
  });

  it('does not recompute scores through its own formula', async () => {
    await updateDecayedTrustScores();

    const scoreMath = mockQuery.mock.calls.filter((call) =>
      /calculate_decayed_karma/i.test(String(call[0])),
    );
    // Trust scores are owned by reputation-service. Deriving them here at all is the defect.
    expect(scoreMath).toEqual([]);
  });

  it('resolves without throwing so the cron and admin endpoint stay healthy', async () => {
    await expect(updateDecayedTrustScores()).resolves.toBeUndefined();
  });
});
