/**
 * Sprint 106 / BUG-013 — the decisions feed must surface a durable `rate` decision for a
 * FULLY-completed match the viewer has not yet rated, for BOTH the requester and the responder,
 * independently. Today rating is only unlocked in-place for whoever happens to click the final
 * `mark_done`; the other party (and a reload) loses the affordance entirely.
 *
 * These tests pin the projection contract: a completed-unrated match row becomes a `rate` decision
 * with the counterparty + community ids the rating write needs, and the query is scoped to
 * completed matches the viewer has not already rated (NOT EXISTS against feedback).
 */
import { fetchDecisions } from '../../src/routes/requests';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));

import { query } from '../../src/database/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

const REQUESTER = 'user-requester';
const RESPONDER = 'user-responder';

function rateRow(over: Record<string, any> = {}) {
  return {
    id: 'match-done-1',
    request_id: 'req-1',
    completed_at: '2026-06-17T10:00:00.000Z',
    requester_id: REQUESTER,
    responder_id: RESPONDER,
    title: 'Fix the leaky tap',
    description: 'Kitchen tap drips',
    payload: null,
    category: 'plumbing',
    requester_name: 'Alice',
    responder_name: 'Bob',
    community_name: 'Maple Street',
    community_id: 'community-1',
    ...over,
  };
}

/** Mock the four sequential decision queries: matches, dibs, offers, then the rate query. */
function mockDecisionQueries(rateRows: any[]) {
  mockQuery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // proposed/matched matches
    .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // dibs
    .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // provider offers
    .mockResolvedValueOnce({ rows: rateRows, rowCount: rateRows.length } as any); // rate (completed-unrated)
}

describe('fetchDecisions — BUG-013 rate decision', () => {
  beforeEach(() => jest.clearAllMocks());

  it('surfaces a rate decision for the responder of a completed, unrated match', async () => {
    mockDecisionQueries([rateRow()]);

    const items = await fetchDecisions({} as any, RESPONDER);
    const rate = items.map((i) => i.data).filter((d) => d.actions.includes('rate' as any));

    expect(rate).toHaveLength(1);
    expect(rate[0].subject_id).toBe('match-done-1');
    expect(rate[0].subject_kind).toBe('match');
    expect(rate[0].actions).toEqual(['rate']);
    expect(rate[0].member_role).toBe('responder');
    // Rating attribution ids the write path needs: the counterparty is the requester.
    expect(rate[0].counterparty_id).toBe(REQUESTER);
    expect(rate[0].counterparty_name).toBe('Alice');
    expect(rate[0].community_id).toBe('community-1');
  });

  it('surfaces the same rate decision for the requester (symmetric)', async () => {
    mockDecisionQueries([rateRow()]);

    const items = await fetchDecisions({} as any, REQUESTER);
    const rate = items.map((i) => i.data).filter((d) => d.actions.includes('rate' as any));

    expect(rate).toHaveLength(1);
    expect(rate[0].member_role).toBe('requester');
    expect(rate[0].counterparty_id).toBe(RESPONDER);
    expect(rate[0].counterparty_name).toBe('Bob');
  });

  it('produces no rate decision when the viewer has already rated (query returns none)', async () => {
    mockDecisionQueries([]);

    const items = await fetchDecisions({} as any, RESPONDER);
    const rate = items.map((i) => i.data).filter((d) => d.actions.includes('rate' as any));

    expect(rate).toHaveLength(0);
  });

  it('scopes the rate query to completed matches the viewer has not yet rated', async () => {
    mockDecisionQueries([rateRow()]);

    await fetchDecisions({} as any, RESPONDER);

    const rateCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && /feedback\.feedback/i.test(sql)
    );
    expect(rateCall).toBeDefined();
    const sql = rateCall![0] as string;
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).toMatch(/'completed'/);
    // Scoped to the viewer (single bound param reused for participant + already-rated guard).
    expect(rateCall![1]).toContain(RESPONDER);
  });
});
