/**
 * Sprint 128 PR C — the pure preview metric helper.
 *
 * These tests pin `standingPreview.ts` to the SQL semantics of the live score writer, read out of
 * `src/database/trustMetricsDb.ts` and `src/services/karmaService.ts`:
 *
 *   - distinct_communities : GLOBAL. `WHERE user_id = $1` only — no community predicate, and no
 *                            related_entity_id predicate (trustMetricsDb.ts:26-32).
 *   - recent_interactions  : LOCAL row COUNT, `user_id AND community_id`, `created_at >= now-365d`,
 *                            multiplicity retained, no join (karmaService.ts:26-34).
 *   - distinct_people      : `me` is local, `other` is NOT community-filtered; the join is on
 *                            related_entity_id, so NULL match identity never joins
 *                            (trustMetricsDb.ts:36-47).
 *   - repeat_pairs         : same join, counterparties with >= 2 DISTINCT me.related_entity_id
 *                            (trustMetricsDb.ts:50-66).
 *
 * All four SQL predicates name exactly ('Provided help', 'Received help') — NOT the full canonical
 * reason set. The backfill's own CANONICAL_REASONS includes the milestone/bonus reasons, so reusing
 * it here would count a milestone row as an interaction and as a join partner.
 */

import {
  buildPreviewIndex,
  computePreviewMetrics,
  type PreviewKarmaRow,
} from '../../src/services/standingPreview';

// The report-level suite below drives `analyzeStandingBackfill` over a fixture, so the service's
// database, projector and score writer are replaced. The pure helper suite touches none of them.
jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((work: () => Promise<unknown>) => work()),
}));
jest.mock('../../src/services/standingProjector', () => ({
  projectCompletedMatchStanding: jest.fn(),
}));
jest.mock('../../src/services/karmaService', () => ({ updateTrustScore: jest.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-07T12:00:00Z');

const row = (
  user_id: string,
  community_id: string,
  reason: string,
  related_entity_id: string | null,
  created_at: Date | string = new Date(NOW),
): PreviewKarmaRow => ({ user_id, community_id, reason, related_entity_id, created_at });

const provided = (u: string, c: string, m: string | null, at?: Date | string) =>
  row(u, c, 'Provided help', m, at);
const received = (u: string, c: string, m: string | null, at?: Date | string) =>
  row(u, c, 'Received help', m, at);

describe('buildPreviewIndex / computePreviewMetrics', () => {
  it('retains global breadth for a membership with no local history', () => {
    const now = Date.parse('2026-09-07T12:00:00Z');
    const rows = [
      { user_id: 'u', community_id: 'c1', reason: 'Provided help', related_entity_id: 'm1', created_at: new Date(now) },
      { user_id: 'v', community_id: 'c1', reason: 'Received help', related_entity_id: 'm1', created_at: new Date(now) },
    ];
    const index = buildPreviewIndex(rows);
    expect(computePreviewMetrics(index, 'u', 'c2', now)).toEqual({
      recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 1,
    });
    expect(computePreviewMetrics(index, 'idle', 'c2', now)).toEqual({
      recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 0,
    });
  });

  it('counts only the two interaction reasons, not the whole canonical set', () => {
    // Milestone/bonus rows are canonical, carry a match id, and must contribute NOTHING: not to
    // breadth, not to the local recent count, and not as a counterparty.
    const index = buildPreviewIndex([
      row('u', 'c1', 'First help in community', 'm1'),
      row('u', 'c2', '10 exchanges milestone', 'm1'),
      row('v', 'c1', '50 exchanges milestone', 'm1'),
      row('u', 'c3', 'help_provided', 'm2'), // legacy snake_case — not canonical at all
      row('v', 'c3', 'help_received', 'm2'),
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW)).toEqual({
      recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 0,
    });
    expect(computePreviewMetrics(index, 'u', 'c3', NOW)).toEqual({
      recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 0,
    });
  });

  it('treats the 365-day recency boundary as inclusive, exactly as `created_at >= $3` does', () => {
    const onBoundary = new Date(NOW - 365 * DAY);
    const justOutside = new Date(NOW - 365 * DAY - 1);
    const index = buildPreviewIndex([
      provided('u', 'c1', 'm1', onBoundary),
      provided('u', 'c1', 'm2', justOutside),
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW).recentInteractions).toBe(1);
  });

  it('never joins rows whose match identity is null', () => {
    // SQL `other.related_entity_id = me.related_entity_id` is NULL = NULL → not true, so these two
    // are not counterparties. They ARE still local interactions and still global breadth.
    const index = buildPreviewIndex([
      provided('u', 'c1', null),
      received('v', 'c1', null),
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW)).toEqual({
      recentInteractions: 1, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 1,
    });
  });

  it('counts one match projected into several communities once per community', () => {
    const index = buildPreviewIndex([
      provided('u', 'c1', 'm1'), received('v', 'c1', 'm1'),
      provided('u', 'c2', 'm1'), received('v', 'c2', 'm1'),
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW)).toEqual({
      recentInteractions: 1, repeatPairs: 0, distinctPeople: 1, distinctCommunities: 2,
    });
    expect(computePreviewMetrics(index, 'u', 'c2', NOW)).toEqual({
      recentInteractions: 1, repeatPairs: 0, distinctPeople: 1, distinctCommunities: 2,
    });
  });

  it('counts a counterparty seen in two matches as one repeat pair', () => {
    const index = buildPreviewIndex([
      provided('u', 'c1', 'm1'), received('v', 'c1', 'm1'),
      provided('u', 'c1', 'm2'), received('v', 'c1', 'm2'),
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW)).toEqual({
      recentInteractions: 2, repeatPairs: 1, distinctPeople: 1, distinctCommunities: 1,
    });
  });

  it('counts a counterparty whose row sits in a different community, as the SQL join does', () => {
    // `other` carries NO community predicate. A counterparty row in c9 still joins to me in c1.
    const index = buildPreviewIndex([
      provided('u', 'c1', 'm1'),
      received('v', 'c9', 'm1'),
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW).distinctPeople).toBe(1);
  });

  it('keeps globally unrelated canonical history out of the local metrics', () => {
    const index = buildPreviewIndex([
      provided('u', 'c1', 'm1'), received('v', 'c1', 'm1'),
      provided('x', 'c5', 'm9'), received('y', 'c5', 'm9'), // nothing to do with u
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW)).toEqual({
      recentInteractions: 1, repeatPairs: 0, distinctPeople: 1, distinctCommunities: 1,
    });
  });

  it('does not mutate the input rows', () => {
    const rows = [provided('u', 'c1', 'm1'), received('v', 'c1', 'm1')];
    const before = JSON.parse(JSON.stringify(rows));
    const index = buildPreviewIndex(rows);
    computePreviewMetrics(index, 'u', 'c1', NOW);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(before);
  });

  it('answers many memberships and many timestamps from one materialized index', () => {
    // Proves the index does not retain or rescan the input array: the view is revoked after
    // construction, so any later read of it would throw.
    const rows = [
      provided('u', 'c1', 'm1', new Date(NOW - 400 * DAY)),
      provided('u', 'c1', 'm2', new Date(NOW - 200 * DAY)),
      received('v', 'c1', 'm1', new Date(NOW - 400 * DAY)),
      received('v', 'c1', 'm2', new Date(NOW - 200 * DAY)),
      provided('u', 'c2', 'm3', new Date(NOW - 10 * DAY)),
      received('w', 'c2', 'm3', new Date(NOW - 10 * DAY)),
    ];
    const { proxy, revoke } = Proxy.revocable(rows, {});
    const index = buildPreviewIndex(proxy as PreviewKarmaRow[]);
    revoke();

    expect(computePreviewMetrics(index, 'u', 'c1', NOW)).toEqual({
      recentInteractions: 1, repeatPairs: 1, distinctPeople: 1, distinctCommunities: 2,
    });
    expect(computePreviewMetrics(index, 'u', 'c2', NOW)).toEqual({
      recentInteractions: 1, repeatPairs: 0, distinctPeople: 1, distinctCommunities: 2,
    });
    // Same index, different evaluation instants, at and around the boundary.
    const at401 = NOW - 400 * DAY + 365 * DAY;
    expect(computePreviewMetrics(index, 'u', 'c1', at401).recentInteractions).toBe(2);
    expect(computePreviewMetrics(index, 'u', 'c1', at401 + 1).recentInteractions).toBe(1);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW + 400 * DAY).recentInteractions).toBe(0);
    // A membership never seen in any row still resolves.
    expect(computePreviewMetrics(index, 'nobody', 'c1', NOW)).toEqual({
      recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 0,
    });
  });

  it('accepts string timestamps as well as Date, as pg rows may carry either', () => {
    const index = buildPreviewIndex([
      provided('u', 'c1', 'm1', '2026-09-01T00:00:00Z'),
    ]);
    expect(computePreviewMetrics(index, 'u', 'c1', NOW).recentInteractions).toBe(1);
  });
});

/**
 * Report-level behaviour, over the Sprint 126 fixture conventions.
 *
 * That fixture never had a membership whose history sat in ANOTHER community, which is exactly why
 * a report that dropped global breadth stayed green there.
 */
describe('analyzeStandingBackfill score inputs', () => {
  const C1 = '10000000-0000-0000-0000-000000000001';
  const C2 = '10000000-0000-0000-0000-000000000002';
  const C3 = '10000000-0000-0000-0000-000000000003';
  const MATCH_1 = '20000000-0000-0000-0000-000000000001';
  const REQUEST_1 = '30000000-0000-0000-0000-000000000001';
  const HELPER = '40000000-0000-0000-0000-000000000001';
  const REQUESTER = '40000000-0000-0000-0000-000000000002';
  const IDLE = '40000000-0000-0000-0000-000000000004';
  const COMPLETED_1 = new Date(Date.now() - 30 * DAY);

  const WRITE_SQL = new RegExp(
    String.raw`\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT)\b`, 'i');

  function communityConfig(community_id: string, overrides: Record<string, unknown> = {}) {
    return {
      community_id,
      karma_split_helper: 60,
      karma_split_requestor: 40,
      enabled_request_types: [],
      trust_depth_weight: 0.6,
      trust_breadth_weight: 0.4,
      trust_feedback_threshold: 3,
      min_interactions_for_trust: 1,
      trust_negative_allowed: false,
      ...overrides,
    };
  }

  /** Both participants belong to C1 AND C2; the single match is posted to C1 only. */
  function crossCommunityFixture() {
    return {
      activitySettings: [] as Array<Record<string, unknown>>,
      matches: [{
        id: MATCH_1,
        request_id: REQUEST_1,
        requester_id: REQUESTER,
        responder_id: HELPER,
        status: 'completed',
        completed_at: COMPLETED_1,
        request_type: 'generic',
        request_community_ids: [C1],
        eligible_community_ids: [C1],
      }],
      configs: [communityConfig(C1), communityConfig(C2)],
      karma: [] as Array<Record<string, unknown>>,
      activities: [] as Array<Record<string, unknown>>,
      memberships: [
        { user_id: HELPER, community_id: C1 },
        { user_id: REQUESTER, community_id: C1 },
        { user_id: HELPER, community_id: C2 },
        { user_id: REQUESTER, community_id: C2 },
      ],
      feedback: [] as Array<Record<string, unknown>>,
      userConfigs: [] as Array<Record<string, unknown>>,
      providers: [] as Array<Record<string, unknown>>,
    };
  }

  type Fixture = ReturnType<typeof crossCommunityFixture>;

  function arm(fixture: Fixture) {
    const { query } = require('../../src/database/db');
    (query as jest.Mock).mockImplementation(async (sql: unknown) => {
      const text = String(sql);
      const rows =
        text.includes('standing-backfill:matches') ? fixture.matches :
        text.includes('standing-backfill:community-configs') ? fixture.configs :
        text.includes('standing-backfill:karma') ? fixture.karma :
        text.includes('standing-backfill:activity-settings') ? fixture.activitySettings :
        text.includes('standing-backfill:activity') ? fixture.activities :
        text.includes('standing-backfill:memberships') ? fixture.memberships :
        text.includes('standing-backfill:feedback') ? fixture.feedback :
        text.includes('standing-backfill:user-configs') ? fixture.userConfigs :
        text.includes('standing-backfill:providers') ? fixture.providers :
        null;
      if (rows === null) throw new Error(`Unexpected preflight query: ${text}`);
      return { rows, rowCount: rows.length };
    });
  }

  function analyze() {
    return require('../../src/services/standingBackfillService').analyzeStandingBackfill();
  }

  beforeEach(() => jest.clearAllMocks());

  it('scores a membership with global-only history at 1, not 0', async () => {
    arm(crossCommunityFixture());
    const report = await analyze();

    // C1 pairs: 1 interaction, 1 counterparty, 1 community → 10 + (2+3)*0.4 + 5 = 17.
    // C2 pairs: no local history, but global breadth 1 → (0 + 3)*0.4 = 1.2 → 1. Not 0.
    expect(report.scoreBuckets).toEqual({
      '0': 0, '1-19': 4, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
    // Still zero LOCAL history for the two C2 pairs — the operator-facing counter is unchanged.
    expect(report.sourcedPairs).toBe(2);
    expect(report.zeroHistoryPairs).toBe(2);
  });

  it('counts local history that is stale or has no match id as sourced, not as zero-history', async () => {
    const fixture = crossCommunityFixture();
    // HELPER's only C2 history: a canonical row far outside the 365-day window, with a NULL match
    // id — the exact shape `normalizeUnattributableLegacy` leaves behind. It contributes no recent
    // interactions and no counterparties, so a test based on those two would call it zero-history.
    fixture.karma = [{
      id: 'k-stale', user_id: HELPER, community_id: C2, points: 60,
      reason: 'Provided help', related_entity_id: null,
      created_at: new Date(Date.now() - 800 * DAY),
    }];
    arm(fixture);

    const report = await analyze();
    expect(report.sourcedPairs).toBe(3);      // both C1 pairs, plus HELPER|C2
    expect(report.zeroHistoryPairs).toBe(1);  // only REQUESTER|C2
  });

  it('scores a member with no history anywhere at 0 — no floor is introduced', async () => {
    const fixture = crossCommunityFixture();
    fixture.memberships.push({ user_id: IDLE, community_id: C2 });
    arm(fixture);

    const report = await analyze();
    expect(report.scoreBuckets['0']).toBe(1);
    expect(report.activeMembershipPairs).toBe(5);
  });

  it('does not double-count an identity that is already projected', async () => {
    const fixture = crossCommunityFixture();
    // The canonical rows this match produces are already stored. Replaying must not add a second
    // copy and inflate the recent-interaction count.
    fixture.karma = [
      { id: 'k1', user_id: HELPER, community_id: C1, points: 60, reason: 'Provided help', related_entity_id: MATCH_1, created_at: COMPLETED_1 },
      { id: 'k2', user_id: REQUESTER, community_id: C1, points: 40, reason: 'Received help', related_entity_id: MATCH_1, created_at: COMPLETED_1 },
    ];
    arm(fixture);

    const report = await analyze();
    expect(report.scoreBuckets).toEqual({
      '0': 0, '1-19': 4, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
  });

  it('replaces attributable legacy rows rather than counting them twice', async () => {
    const fixture = crossCommunityFixture();
    fixture.karma = [
      { id: 'k1', user_id: HELPER, community_id: C1, points: 60, reason: 'help_provided', related_entity_id: MATCH_1, created_at: COMPLETED_1 },
      { id: 'k2', user_id: REQUESTER, community_id: C1, points: 40, reason: 'help_received', related_entity_id: MATCH_1, created_at: COMPLETED_1 },
    ];
    arm(fixture);

    const report = await analyze();
    // The legacy pair is deleted by apply and replaced by the canonical pair: still ONE interaction.
    expect(report.scoreBuckets).toEqual({
      '0': 0, '1-19': 4, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
  });

  it('normalizes unattributable legacy history into global breadth', async () => {
    const fixture = crossCommunityFixture();
    // A legacy row in a THIRD community attached to no completed match: apply normalizes its reason
    // in place, so it becomes canonical history and lifts HELPER's global community count to 2.
    fixture.karma = [
      { id: 'k9', user_id: HELPER, community_id: C3, points: 60, reason: 'help_provided', related_entity_id: null, created_at: COMPLETED_1 },
    ];
    arm(fixture);

    const report = await analyze();
    expect(report.scoreBuckets).toEqual({
      '0': 0, '1-19': 4, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
    // The legacy row is unattributable, so it is normalized rather than deleted.
    expect(report.legacy).toEqual({ attributableRows: 0, unattributableRows: 1, exactDuplicates: 0 });
  });

  it('collapses a legacy row onto its canonical twin regardless of row order', async () => {
    // Apply's collision check asks whether ANY OTHER row holds the normalized identity — a question
    // about the whole table. So the projection must not depend on which of the pair `KARMA_QUERY`
    // (`ORDER BY created_at, id`) returns first. Both rows are unattributable (no completed match
    // owns SYNTHETIC), so the legacy one normalizes onto the canonical one and apply deletes it.
    const SYNTHETIC = '20000000-0000-0000-0000-0000000000ff';
    const canonical = {
      id: 'k-canonical', user_id: HELPER, community_id: C1, points: 60,
      reason: 'Provided help', related_entity_id: SYNTHETIC, created_at: COMPLETED_1,
    };
    const legacy = {
      id: 'k-legacy', user_id: HELPER, community_id: C1, points: 60,
      reason: 'help_provided', related_entity_id: SYNTHETIC, created_at: COMPLETED_1,
    };

    // C1 is configured so its score is VOLUME ALONE. Without that, the surviving-row count moves
    // HELPER|C1 from 22 to 27 — both inside bucket '20-39', so the report would look identical
    // whether or not the row was double-counted. Stripped to volume, two rows give 15 and three
    // give 20, which land in different buckets and make the defect visible.
    const volumeOnlyC1 = () => {
      const fixture = crossCommunityFixture();
      fixture.configs = [
        communityConfig(C1, {
          trust_depth_weight: 0, trust_breadth_weight: 0, min_interactions_for_trust: 99,
        }),
        communityConfig(C2),
      ];
      return fixture;
    };

    const legacyFirst = volumeOnlyC1();
    legacyFirst.karma = [legacy, canonical];
    arm(legacyFirst);
    const withLegacyFirst = await analyze();

    jest.clearAllMocks();

    const canonicalFirst = volumeOnlyC1();
    canonicalFirst.karma = [canonical, legacy];
    arm(canonicalFirst);
    const withCanonicalFirst = await analyze();

    expect(withLegacyFirst.scoreBuckets).toEqual(withCanonicalFirst.scoreBuckets);
    // Pin the value too, so both orders agreeing on a WRONG answer cannot pass. HELPER|C1 keeps
    // TWO interaction rows — the match and the one surviving row of the collapsed pair — for
    // floor(log2(3) * 10) = 15. A third row would score 20 and show up in '20-39'.
    expect(withLegacyFirst.scoreBuckets).toEqual({
      '0': 0, '1-19': 4, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
  });

  it('honours numeric-string and zero weight overrides exactly as the writer resolves them', async () => {
    const fixture = crossCommunityFixture();
    fixture.userConfigs = [
      // Zero is a real weight, not "absent": breadth collapses to 0, so C2 scores 0.
      { user_id: HELPER, community_id: C2, depth_weight: null, breadth_weight: 0 },
      // Numeric strings arrive from pg NUMERIC columns.
      { user_id: REQUESTER, community_id: C2, depth_weight: '0.6', breadth_weight: '1.0' },
    ];
    arm(fixture);

    const report = await analyze();
    // HELPER|C2 → 0. REQUESTER|C2 → (0 + 3) * 1.0 = 3. Both C1 pairs → 17.
    expect(report.scoreBuckets).toEqual({
      '0': 1, '1-19': 3, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
  });

  it('carries a negative score, and blends the rating that caused it across communities', async () => {
    const fixture = crossCommunityFixture();
    fixture.configs = [communityConfig(C1), communityConfig(C2, { trust_negative_allowed: true })];
    // One-star feedback in C2 only, well under the threshold.
    fixture.feedback = [
      { to_user_id: HELPER, community_id: C2, rating: 1, created_at: new Date() },
    ];
    arm(fixture);

    const report = await analyze();

    // HELPER|C2: quality = round(((1 - 3) / 2) * 25) = -25, breadth 1.2 → -23.8 → -24, which C2
    // permits. HELPER|C1: feedback is blended GLOBALLY (ADR-039, 70 local / 30 global), and HELPER
    // has no local C1 rating, so the C2 star is used whole — 10 + (-25) + 2 + 5 = -8, which C1
    // clamps to 0. So the single rating moves BOTH memberships, and both land in bucket '0'.
    expect(report.scoreBuckets).toEqual({
      '0': 2, '1-19': 2, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0,
    });
    // Worth stating plainly: the bucket contract is `score <= 0`, so the report cannot distinguish
    // a permitted negative from a clamped zero. Any operator question about which one a membership
    // got has to be answered from reputation.trust_scores, not from this report.
  });

  it('issues only SELECTs and never touches the projector or the score writer', async () => {
    arm(crossCommunityFixture());
    const { query } = require('../../src/database/db');
    const { projectCompletedMatchStanding } = require('../../src/services/standingProjector');
    const { updateTrustScore } = require('../../src/services/karmaService');

    await analyze();

    const issued = (query as jest.Mock).mock.calls.map(([sql]: [unknown]) => String(sql));
    expect(issued).toHaveLength(9);
    for (const sql of issued) expect(sql).not.toMatch(WRITE_SQL);
    expect(projectCompletedMatchStanding).not.toHaveBeenCalled();
    expect(updateTrustScore).not.toHaveBeenCalled();
  });

  /**
   * `providerEligibility` counts PROVIDER-PROFILE / COMMUNITY PAIRS, keyed `provider_id|community_id`
   * — not people. provider_profiles carries no community_id and is unique on (user_id, service_type),
   * so one user with two service types in one community is TWO eligible pairs.
   *
   * Its floors 1/20/40/60 are deliberately fixed what-if scenarios. Live reach instead uses each
   * community's configured `provider_min_personal_trust_score`, so these counts answer "how many
   * pairs would clear this floor", not "how many are reachable today".
   *
   * The active-profile, active-member, enabled-community and service-allowlist filters live in
   * PROVIDERS_QUERY itself (`standingBackfillService.ts:236`), so rows arriving here have already
   * passed them. Those filters are proved against real SQL in the root integration suite; what is
   * provable here is the pair unit, the score lookup and the floor comparison.
   */
  describe('providerEligibility', () => {
    it('counts two profiles owned by one user in one community twice', async () => {
      const fixture = crossCommunityFixture();
      fixture.providers = [
        { provider_id: 'p-ride', user_id: HELPER, community_id: C1 },
        { provider_id: 'p-repair', user_id: HELPER, community_id: C1 },
      ];
      arm(fixture);

      const report = await analyze();
      // HELPER|C1 scores 17: both pairs clear floor 1, neither clears floor 20.
      expect(report.providerEligibility).toEqual({ '1': 2, '20': 0, '40': 0, '60': 0 });
    });

    it('counts one profile once per community it reaches, at that community\'s own score', async () => {
      const fixture = crossCommunityFixture();
      fixture.providers = [
        { provider_id: 'p-ride', user_id: HELPER, community_id: C1 },
        { provider_id: 'p-ride', user_id: HELPER, community_id: C2 },
      ];
      arm(fixture);

      const report = await analyze();
      // HELPER|C1 = 17 and HELPER|C2 = 1. Both clear floor 1; neither clears 20.
      expect(report.providerEligibility).toEqual({ '1': 2, '20': 0, '40': 0, '60': 0 });
    });

    it('collapses duplicate rows for the same profile and community', async () => {
      const fixture = crossCommunityFixture();
      fixture.providers = [
        { provider_id: 'p-ride', user_id: HELPER, community_id: C1 },
        { provider_id: 'p-ride', user_id: HELPER, community_id: C1 },
      ];
      arm(fixture);

      const report = await analyze();
      expect(report.providerEligibility).toEqual({ '1': 1, '20': 0, '40': 0, '60': 0 });
    });

    it('treats a provider with no evaluated membership as score 0', async () => {
      const fixture = crossCommunityFixture();
      // Not an active member anywhere in the membership list, so no score was computed for the pair.
      fixture.providers = [{ provider_id: 'p-ghost', user_id: IDLE, community_id: C1 }];
      arm(fixture);

      const report = await analyze();
      expect(report.providerEligibility).toEqual({ '1': 0, '20': 0, '40': 0, '60': 0 });
    });

    it('includes a score exactly equal to a floor', async () => {
      const fixture = crossCommunityFixture();
      // HELPER|C2 is breadth-only: score = round(distinctCommunities(1) * 3 * breadth_weight).
      // 20/3 lands it on exactly 20, the boundary the `>=` comparison has to include.
      fixture.userConfigs = [
        { user_id: HELPER, community_id: C2, depth_weight: null, breadth_weight: 20 / 3 },
      ];
      fixture.providers = [{ provider_id: 'p-ride', user_id: HELPER, community_id: C2 }];
      arm(fixture);

      const report = await analyze();
      expect(report.providerEligibility).toEqual({ '1': 1, '20': 1, '40': 0, '60': 0 });
    });
  });
});
