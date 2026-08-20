/**
 * Sprint 126 — the canonical completed-match standing policy.
 *
 * Sprint 126 exists because two implementations of "what a completed match does to standing"
 * drifted apart on four axes: reason labels (prose vs snake_case), milestone schedule (1/10/50/100
 * vs 1/5/10/25), milestone scope ((helper, community) vs platform-wide), and community selection
 * (up to 3 shared request communities vs every configured community, uncapped). This file pins the
 * ONE policy both paths must now share, so an equivalence claim is a test that can fail rather than
 * a comment asserting two functions are "held identical".
 *
 * Pure policy only — no database, no clock. The transactional adapter is proved separately.
 */

import {
  COMPLETED_MATCH_REASONS,
  COMPLETED_MATCH_MILESTONES,
  MAX_COMMUNITIES_PER_KARMA_AWARD,
  DEFAULT_KARMA_POOL,
  compareReplayKeys,
  selectStandingCommunities,
  allocateCompletedMatchKarma,
  planCompletedMatchStanding,
  type StandingCommunityCandidate,
  type CompletedMatchStandingFacts,
} from '@karmyq/shared';

const HELPER = 'helper-1';
const REQUESTER = 'requester-1';
const MATCH = 'match-1';
const OCCURRED = new Date('2026-03-01T12:00:00.000Z');

function candidate(
  id: string,
  priorHelperKarma: number,
  helperHelpCountThroughAsOf = 1,
  split: { helper: number; requestor: number } = { helper: 60, requestor: 40 },
): StandingCommunityCandidate {
  return {
    community_id: id,
    karma_split_helper: split.helper,
    karma_split_requestor: split.requestor,
    priorHelperKarma,
    helperHelpCountThroughAsOf,
  };
}

function facts(
  candidates: StandingCommunityCandidate[],
  overrides: Partial<CompletedMatchStandingFacts> = {},
): CompletedMatchStandingFacts {
  return {
    matchId: MATCH,
    requesterId: REQUESTER,
    helperId: HELPER,
    occurredAt: OCCURRED,
    candidates,
    ...overrides,
  };
}

describe('canonical constants', () => {
  it('uses the production prose vocabulary, not the fixture snake_case', () => {
    expect(COMPLETED_MATCH_REASONS).toEqual({
      provided: 'Provided help',
      received: 'Received help',
      first: 'First help in community',
      milestone10: '10 exchanges milestone',
      milestone50: '50 exchanges milestone',
      milestone100: '100 exchanges milestone',
    });
  });

  it('uses the production milestone schedule 1/10/50/100, not the fixture 1/5/10/25', () => {
    expect([...COMPLETED_MATCH_MILESTONES].map((m) => m.count)).toEqual([1, 10, 50, 100]);
    expect([...COMPLETED_MATCH_MILESTONES].map((m) => m.points)).toEqual([15, 25, 50, 100]);
  });

  it('caps karma at exactly three communities per match', () => {
    expect(MAX_COMMUNITIES_PER_KARMA_AWARD).toBe(3);
  });

  it('defaults the karma pool to the production base pool', () => {
    expect(DEFAULT_KARMA_POOL).toBe(100);
  });
});

describe('compareReplayKeys', () => {
  const earlier = new Date('2026-01-01T00:00:00.000Z');
  const later = new Date('2026-06-01T00:00:00.000Z');

  it('orders by completion time first', () => {
    expect(
      compareReplayKeys({ completedAt: earlier, matchId: 'z' }, { completedAt: later, matchId: 'a' }),
    ).toBeLessThan(0);
  });

  it('breaks a timestamp tie by match id so replay is deterministic', () => {
    const sameTime = new Date('2026-04-04T04:04:04.000Z');
    expect(
      compareReplayKeys({ completedAt: sameTime, matchId: '0002' }, { completedAt: sameTime, matchId: '0001' }),
    ).toBeGreaterThan(0);
    expect(
      compareReplayKeys({ completedAt: sameTime, matchId: '0001' }, { completedAt: sameTime, matchId: '0002' }),
    ).toBeLessThan(0);
  });

  it('returns 0 only for the identical key', () => {
    const t = new Date('2026-04-04T04:04:04.000Z');
    expect(compareReplayKeys({ completedAt: t, matchId: 'm' }, { completedAt: t, matchId: 'm' })).toBe(0);
  });

  it('sorts a mixed batch oldest-first with stable tie-breaking', () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-02-01T00:00:00.000Z');
    const keys = [
      { completedAt: t2, matchId: 'feb-b' },
      { completedAt: t1, matchId: 'jan-b' },
      { completedAt: t2, matchId: 'feb-a' },
      { completedAt: t1, matchId: 'jan-a' },
    ];
    expect([...keys].sort(compareReplayKeys).map((k) => k.matchId)).toEqual([
      'jan-a',
      'jan-b',
      'feb-a',
      'feb-b',
    ]);
  });
});

describe('selectStandingCommunities', () => {
  it('returns a single candidate unchanged', () => {
    expect(selectStandingCommunities([candidate('community-a', 0)]).map((c) => c.community_id)).toEqual([
      'community-a',
    ]);
  });

  it('orders by prior helper karma descending', () => {
    const selected = selectStandingCommunities([
      candidate('community-a', 5),
      candidate('community-b', 90),
      candidate('community-c', 40),
    ]);
    expect(selected.map((c) => c.community_id)).toEqual(['community-b', 'community-c', 'community-a']);
  });

  it('caps at three and drops the lowest-karma candidate', () => {
    const selected = selectStandingCommunities([
      candidate('community-a', 1),
      candidate('community-b', 90),
      candidate('community-c', 40),
      candidate('community-d', 70),
    ]);
    expect(selected.map((c) => c.community_id)).toEqual(['community-b', 'community-d', 'community-c']);
  });

  it('breaks a karma tie by community id so selection is deterministic', () => {
    const selected = selectStandingCommunities([
      candidate('community-d', 10),
      candidate('community-b', 10),
      candidate('community-c', 10),
      candidate('community-a', 10),
    ]);
    expect(selected.map((c) => c.community_id)).toEqual(['community-a', 'community-b', 'community-c']);
  });

  it('does not mutate the caller array', () => {
    const input = [candidate('community-a', 1), candidate('community-b', 90)];
    const snapshot = input.map((c) => c.community_id);
    selectStandingCommunities(input);
    expect(input.map((c) => c.community_id)).toEqual(snapshot);
  });

  it('honours an explicit limit', () => {
    const selected = selectStandingCommunities(
      [candidate('community-a', 1), candidate('community-b', 90), candidate('community-c', 40)],
      2,
    );
    expect(selected.map((c) => c.community_id)).toEqual(['community-b', 'community-c']);
  });
});

describe('allocateCompletedMatchKarma', () => {
  it('splits one community 60/40 with no leftover', () => {
    expect(allocateCompletedMatchKarma([candidate('c1', 0)], 100)).toEqual([
      { community_id: 'c1', helperPoints: 60, requesterPoints: 40 },
    ]);
  });

  it('keeps the pool fixed and integral regardless of community count', () => {
    for (const ids of [['c1'], ['c1', 'c2'], ['c1', 'c2', 'c3']]) {
      const allocations = allocateCompletedMatchKarma(
        ids.map((id) => candidate(id, 0)),
        100,
      );
      const total = allocations.reduce((sum, a) => sum + a.helperPoints + a.requesterPoints, 0);
      // Largest-remainder rounding: integer awards must still sum EXACTLY to the pool, so being in
      // three communities never awards more total karma than being in one.
      expect(total).toBe(100);
      for (const a of allocations) {
        expect(Number.isInteger(a.helperPoints)).toBe(true);
        expect(Number.isInteger(a.requesterPoints)).toBe(true);
      }
    }
  });

  it('applies a per-community request-type multiplier', () => {
    const withMultiplier: StandingCommunityCandidate = {
      ...candidate('c1', 0),
      enabled_request_types: [{ name: 'errand', karma_multiplier: 2 }],
    };
    expect(allocateCompletedMatchKarma([withMultiplier], 100, 'errand')).toEqual([
      { community_id: 'c1', helperPoints: 120, requesterPoints: 80 },
    ]);
    expect(allocateCompletedMatchKarma([withMultiplier], 100, 'other')).toEqual([
      { community_id: 'c1', helperPoints: 60, requesterPoints: 40 },
    ]);
  });

  it('returns nothing for no communities', () => {
    expect(allocateCompletedMatchKarma([], 100)).toEqual([]);
  });
});

describe('planCompletedMatchStanding', () => {
  it('emits provided, received, and the first-help bonus for a first exchange', () => {
    const plan = planCompletedMatchStanding(facts([candidate('c1', 0, 1)]));
    expect(plan.rows.map((row) => row.reason)).toEqual([
      'Provided help',
      'Received help',
      'First help in community',
    ]);
  });

  it('stamps every row with the match completion time, never a clock read', () => {
    const plan = planCompletedMatchStanding(facts([candidate('c1', 0, 1)]));
    for (const row of plan.rows) {
      expect(row.createdAt).toEqual(OCCURRED);
      expect(row.relatedEntityId).toBe(MATCH);
    }
  });

  it('attributes helper and requester rows to the right users', () => {
    const plan = planCompletedMatchStanding(facts([candidate('c1', 0, 2)]));
    const byReason = Object.fromEntries(plan.rows.map((r) => [r.reason, r.userId]));
    expect(byReason['Provided help']).toBe(HELPER);
    expect(byReason['Received help']).toBe(REQUESTER);
  });

  it('emits no bonus on an ordinary non-milestone exchange', () => {
    const plan = planCompletedMatchStanding(facts([candidate('c1', 0, 7)]));
    expect(plan.rows.map((r) => r.reason)).toEqual(['Provided help', 'Received help']);
  });

  it.each([
    [10, '10 exchanges milestone', 25],
    [50, '50 exchanges milestone', 50],
    [100, '100 exchanges milestone', 100],
  ] as Array<[number, string, number]>)(
    'emits the %s-exchange milestone with its exact points',
    (count, reason, points) => {
    const plan = planCompletedMatchStanding(facts([candidate('c1', 0, count)]));
    const bonus = plan.rows.find((r) => r.reason === reason);
    expect(bonus).toBeDefined();
    expect(bonus!.points).toBe(points);
    expect(bonus!.userId).toBe(HELPER);
    },
  );

  it('ranks milestones per community, not platform-wide', () => {
    // The helper is at count 1 in c1 and count 10 in c2 for the SAME match. Each community gets its
    // own bonus; the fixture's platform-wide counter could only ever produce one.
    const plan = planCompletedMatchStanding(
      facts([candidate('c1', 50, 1), candidate('c2', 90, 10)]),
    );
    const bonuses = plan.rows.filter(
      (r) =>
        r.reason !== COMPLETED_MATCH_REASONS.provided && r.reason !== COMPLETED_MATCH_REASONS.received,
    );
    expect(
      bonuses.map((b) => `${b.communityId}:${b.reason}`).sort(),
    ).toEqual(['c1:First help in community', 'c2:10 exchanges milestone']);
  });

  it('awards only the three highest-karma communities when four are eligible', () => {
    const plan = planCompletedMatchStanding(
      facts([
        candidate('community-a', 1),
        candidate('community-b', 90),
        candidate('community-c', 40),
        candidate('community-d', 70),
      ]),
    );
    expect(plan.communityIds).toEqual(['community-b', 'community-d', 'community-c']);
    expect(new Set(plan.rows.map((r) => r.communityId))).toEqual(
      new Set(['community-b', 'community-d', 'community-c']),
    );
  });

  it('keeps the karma pool fixed no matter how many communities are selected', () => {
    const one = planCompletedMatchStanding(facts([candidate('c1', 0, 5)]));
    const three = planCompletedMatchStanding(
      facts([candidate('c1', 0, 5), candidate('c2', 0, 5), candidate('c3', 0, 5)]),
    );
    const poolOf = (rows: typeof one.rows) =>
      rows
        .filter((r) => r.reason === 'Provided help' || r.reason === 'Received help')
        .reduce((sum, r) => sum + r.points, 0);
    expect(poolOf(one.rows)).toBe(DEFAULT_KARMA_POOL);
    expect(poolOf(three.rows)).toBe(DEFAULT_KARMA_POOL);
  });

  it('exposes the replay key built from the match completion time and id', () => {
    const plan = planCompletedMatchStanding(facts([candidate('c1', 0, 1)]));
    expect(plan.replayKey).toEqual({ completedAt: OCCURRED, matchId: MATCH });
  });

  it('produces no rows when no community is eligible', () => {
    const plan = planCompletedMatchStanding(facts([]));
    expect(plan.rows).toEqual([]);
    expect(plan.communityIds).toEqual([]);
    expect(plan.allocations).toEqual([]);
  });

  it('is deterministic: the same facts produce byte-identical plans', () => {
    const input = facts([candidate('c1', 10, 10), candidate('c2', 5, 1)]);
    expect(JSON.stringify(planCompletedMatchStanding(input))).toBe(
      JSON.stringify(planCompletedMatchStanding(input)),
    );
  });

  it('never emits a reason outside the canonical vocabulary', () => {
    const canonical = new Set(Object.values(COMPLETED_MATCH_REASONS));
    const plan = planCompletedMatchStanding(
      facts([candidate('c1', 0, 1), candidate('c2', 0, 10), candidate('c3', 0, 100)]),
    );
    for (const row of plan.rows) {
      expect(canonical.has(row.reason)).toBe(true);
    }
  });
});
