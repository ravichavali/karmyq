/**
 * Sprint 128 PR C — the preview and the writer must share ONE recency window.
 *
 * `standingPreview.RECENT_WINDOW_MS` and the writer's `TWELVE_MONTHS_AGO` (`karmaService.ts:23`)
 * are two spellings of 365 days, in two files, with nothing tying them together. That is the last
 * metric input where drift between preview and writer is still free — and drift between those two
 * is the entire defect this sprint fixed.
 *
 * A shared constant would be the structural fix, but it edits the live writer, which PR C's scope
 * excludes. So this asserts the agreement instead, against the cutoff `updateTrustScore` actually
 * puts on the wire. It fails if EITHER side moves.
 *
 * This file mocks only the database, so the real `updateTrustScore` runs.
 */

import { RECENT_WINDOW_MS } from '../../src/services/standingPreview';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((work: () => Promise<unknown>) => work()),
}));
jest.mock('../../src/services/effectiveParamsCache', () => ({
  getCachedEffectiveParams: jest.fn(async () => ({
    depth_weight: 0.6, breadth_weight: 0.4, cross_community_prior: 0.5,
  })),
}));

const USER = '40000000-0000-0000-0000-0000000000a1';
const COMMUNITY = '10000000-0000-0000-0000-0000000000c1';
const FROZEN = Date.parse('2026-06-15T12:00:00.000Z');

describe('the recency window the writer uses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is exactly RECENT_WINDOW_MS before the evaluation instant', async () => {
    const { query } = require('../../src/database/db');
    (query as jest.Mock).mockImplementation(async (sql: unknown) => {
      const text = String(sql);
      if (text.includes('recent_interactions')) {
        return { rows: [{ offers_accepted: '0', requests_completed: '0', recent_interactions: '0' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(FROZEN);
    try {
      const { updateTrustScore } = require('../../src/services/karmaService');
      await updateTrustScore(USER, COMMUNITY);
    } finally {
      nowSpy.mockRestore();
    }

    const statsCall = (query as jest.Mock).mock.calls
      .find(([sql]: [unknown]) => String(sql).includes('recent_interactions'));
    expect(statsCall).toBeDefined();

    // $3 is the cutoff the writer compares `created_at >=` against.
    const cutoff = statsCall[1][2];
    expect(cutoff).toBe(new Date(FROZEN - RECENT_WINDOW_MS).toISOString());

    // And state the value plainly, so a change to either side has to be deliberate.
    expect(RECENT_WINDOW_MS).toBe(365 * 24 * 60 * 60 * 1000);
  });
});
