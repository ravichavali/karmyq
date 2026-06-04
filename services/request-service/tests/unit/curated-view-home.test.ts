/**
 * Sprint 85 — Unified Feed `view=home` union (TDD).
 *
 * Unit tests for the pure assembly logic behind GET /requests/curated?view=home:
 *   - match_score normalized to one 0–100 integer scale (never 0–1)
 *   - server-side action altitude: decisions you owe rank ABOVE requests you can fill
 *   - the prior-interaction signal reads the DECAYED edge weight, not a raw count
 *
 * Per the robust-testing standard: exact values and exact ordering, no shallow truthiness.
 */

import {
  assembleHomeFeed,
  buildDecisionItem,
  buildRequestItem,
  decisionPriority,
  normalizeMatchScore,
  requestPriority,
  scorePriorInteraction,
  PRIORITY_DECISION_BASE,
  PRIORITY_REQUEST_BASE,
  type DecisionData,
} from '../../src/services/unifiedFeed';

describe('normalizeMatchScore — one 0–100 integer scale at the API boundary', () => {
  it('scales a 0–1 fraction up and passes 0–100 through', () => {
    expect(normalizeMatchScore(0.42)).toBe(42);
    expect(normalizeMatchScore(1)).toBe(100);
    expect(normalizeMatchScore(42)).toBe(42);
    expect(normalizeMatchScore(87.4)).toBe(87);
  });

  it('never emits a 0–1 value — the card always sees an integer percentage or null', () => {
    for (const raw of [0.01, 0.5, 0.999, 12, 73.6]) {
      const n = normalizeMatchScore(raw)!;
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it('distinguishes "no score" (null) from "scored zero"', () => {
    expect(normalizeMatchScore(undefined)).toBeNull();
    expect(normalizeMatchScore(null)).toBeNull();
    expect(normalizeMatchScore(Number.NaN)).toBeNull();
    expect(normalizeMatchScore(0)).toBe(0);
  });
});

describe('scorePriorInteraction — reads the DECAYED edge weight (ADR-066 "designed to forget")', () => {
  it('maps a fresh, strong edge near the ceiling and a faded edge near the floor', () => {
    // raw_weight ≈ 10 (one fresh completed match), decay ≈ 1 → current_weight ≈ 10 → ~100
    expect(scorePriorInteraction(10)).toBe(100);
    // same raw history, but ~5 half-lives elapsed → current_weight ≈ 0.3 → ~3
    expect(scorePriorInteraction(0.3)).toBe(3);
  });

  it('contributes ~0 for a fully decayed (effectively forgotten) edge', () => {
    expect(scorePriorInteraction(0)).toBe(0);
    expect(scorePriorInteraction(0.04)).toBe(0); // rounds to 0
    expect(scorePriorInteraction(null)).toBe(0);
    expect(scorePriorInteraction(undefined)).toBe(0);
  });

  it('ranks two requesters with EQUAL raw history but different recency by decayed weight', () => {
    // Both requesters once had the same raw interaction count, so a raw-count signal would tie
    // them. The decayed weights differ by recency — the recent one must rank strictly higher.
    const recentWeight = 9.5; // interacted days ago
    const staleWeight = 0.6; // same raw history, interacted months ago
    expect(scorePriorInteraction(recentWeight)).toBeGreaterThan(scorePriorInteraction(staleWeight));
    // monotonic in the decayed weight
    expect(scorePriorInteraction(5)).toBeGreaterThan(scorePriorInteraction(2));
  });
});

describe('action altitude — decisions you owe rank above requests you can fill', () => {
  it('puts every decision priority strictly above every request priority', () => {
    // request band tops out at base + 100; decision band starts at base (>= request ceiling).
    expect(requestPriority(100)).toBe(PRIORITY_REQUEST_BASE + 100);
    expect(decisionPriority(['mark_done'])).toBeGreaterThan(requestPriority(100));
    expect(PRIORITY_DECISION_BASE).toBeGreaterThan(PRIORITY_REQUEST_BASE + 100);
  });

  it('orders a response a counterparty awaits above the member’s own housekeeping', () => {
    expect(decisionPriority(['accept_offer', 'decline_offer'])).toBeGreaterThan(
      decisionPriority(['withdraw_offer']),
    );
    expect(decisionPriority(['withdraw_offer'])).toBeGreaterThan(decisionPriority(['mark_done']));
  });

  it('ranks higher-scoring requests above lower-scoring ones', () => {
    expect(requestPriority(80)).toBeGreaterThan(requestPriority(40));
  });
});

describe('assembleHomeFeed — the assembled union', () => {
  const decision = (id: string, actions: DecisionData['actions'], role: DecisionData['member_role']): DecisionData => ({
    subject_id: id,
    subject_kind: 'match',
    request_id: `req-${id}`,
    title: `Decision ${id}`,
    community_name: 'Hawthorne',
    counterparty_name: 'Sam',
    member_role: role,
    actions,
  });

  it('returns { items } with decisions first, then requests by descending feed score — exact order', () => {
    const items = [
      buildRequestItem({ request_id: 'r-low' }, 40),
      buildRequestItem({ request_id: 'r-high' }, 80),
      buildDecisionItem(decision('d-withdraw', ['withdraw_offer'], 'responder')),
      buildDecisionItem(decision('d-accept', ['accept_offer', 'decline_offer'], 'requester')),
    ];

    const { items: ranked } = assembleHomeFeed(items);

    expect(ranked.map((i) => i.kind)).toEqual(['decision', 'decision', 'request', 'request']);
    // accept (counterparty waiting) above withdraw (own housekeeping); high-score request above low
    expect((ranked[0].data as { subject_id: string }).subject_id).toBe('d-accept');
    expect((ranked[1].data as { subject_id: string }).subject_id).toBe('d-withdraw');
    expect((ranked[2].data as { request_id: string }).request_id).toBe('r-high');
    expect((ranked[3].data as { request_id: string }).request_id).toBe('r-low');
    // exact priorities
    expect(ranked.map((i) => i.priority)).toEqual([2050, 2030, 1080, 1040]);
  });

  it('is a stable sort — equal-priority items keep input order', () => {
    const { items } = assembleHomeFeed([
      buildRequestItem({ request_id: 'a' }, 50),
      buildRequestItem({ request_id: 'b' }, 50),
    ]);
    expect(items.map((i) => (i.data as { request_id: string }).request_id)).toEqual(['a', 'b']);
  });

  it('produces an empty union when the member has nothing to act on', () => {
    expect(assembleHomeFeed([])).toEqual({ items: [] });
  });
});
