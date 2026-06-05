/**
 * Sprint 88 — Curated feed controls.
 *
 * Locks two small but high-impact feed controls:
 * - minScore=0 is a valid threshold for "show more open requests" (not coerced to default 30)
 * - request impression logging builds exact feed_events inserts for already-scored request rows
 */

import {
  buildImpressionInsert,
  parseMinScore,
  requestMeetsMinScore,
} from '../../src/routes/requests';

describe('parseMinScore', () => {
  it('defaults missing and invalid values to 30, but preserves explicit zero', () => {
    expect(parseMinScore(undefined)).toBe(30);
    expect(parseMinScore('')).toBe(30);
    expect(parseMinScore('not-a-number')).toBe(30);
    expect(parseMinScore('0')).toBe(0);
    expect(parseMinScore('12')).toBe(12);
  });

  it('lets the show-more threshold include below-30 requests', () => {
    expect(requestMeetsMinScore({ feedScore: 12 }, 30)).toBe(false);
    expect(requestMeetsMinScore({ feedScore: 12 }, 0)).toBe(true);
  });
});

describe('buildImpressionInsert', () => {
  it('builds exact feed_events insert SQL and flattened values for request rows', () => {
    const insert = buildImpressionInsert('user-1', [
      { id: 'req-low', feedScore: 12, sourceTier: 'community' },
      { id: 'req-high', feedScore: 81, sourceTier: 'trust_network' },
    ]);

    expect(insert).toEqual({
      queryText:
        `INSERT INTO requests.feed_events (user_id, request_id, event_type, feed_score, feed_rank, source_tier)
             VALUES ($1, $2, 'impression', $3, $4, $5), ($6, $7, 'impression', $8, $9, $10)
             ON CONFLICT DO NOTHING`,
      values: [
        'user-1',
        'req-low',
        12,
        1,
        'community',
        'user-1',
        'req-high',
        81,
        2,
        'trust_network',
      ],
    });
  });

  it('returns null when there are no request rows to log', () => {
    expect(buildImpressionInsert('user-1', [])).toBeNull();
  });
});
