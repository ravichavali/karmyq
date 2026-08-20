/**
 * Sprint 126 Task 7 — read-only standing backfill preflight.
 *
 * Breaks caught here:
 * - a dry-run that mutates storage;
 * - fixture reasons being treated as already-canonical standing;
 * - inactive/no-history memberships disappearing from the report;
 * - conflicting canonical rows being silently accepted;
 * - provider-floor counts being tuned independently of projected scores.
 */

import { query } from '../../src/database/db';
import { analyzeStandingBackfill, type StandingBackfillReport } from '../../src/services/standingBackfillService';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));

const mockQuery = query as jest.MockedFunction<typeof query>;

const C1 = '10000000-0000-0000-0000-000000000001';
const MATCH_1 = '20000000-0000-0000-0000-000000000001';
const MATCH_2 = '20000000-0000-0000-0000-000000000002';
const REQUEST_1 = '30000000-0000-0000-0000-000000000001';
const REQUEST_2 = '30000000-0000-0000-0000-000000000002';
const HELPER = '40000000-0000-0000-0000-000000000001';
const REQUESTER_1 = '40000000-0000-0000-0000-000000000002';
const REQUESTER_2 = '40000000-0000-0000-0000-000000000003';
const IDLE = '40000000-0000-0000-0000-000000000004';
const COMPLETED_1 = new Date('2026-01-01T00:00:00.000Z');
const COMPLETED_2 = new Date('2026-02-01T00:00:00.000Z');

type Fixture = ReturnType<typeof baseFixture>;

function matchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_1,
    request_id: REQUEST_1,
    requester_id: REQUESTER_1,
    responder_id: HELPER,
    status: 'completed',
    completed_at: COMPLETED_1,
    request_type: 'generic',
    request_community_ids: [C1],
    eligible_community_ids: [C1],
    ...overrides,
  };
}

function karmaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '50000000-0000-0000-0000-000000000001',
    user_id: HELPER,
    community_id: C1,
    points: 60,
    reason: 'help_provided',
    related_entity_id: MATCH_1,
    created_at: COMPLETED_1,
    ...overrides,
  };
}

function baseFixture() {
  return {
    matches: [
      matchRow(),
      matchRow({
        id: MATCH_2,
        request_id: REQUEST_2,
        requester_id: REQUESTER_2,
        completed_at: COMPLETED_2,
      }),
    ],
    configs: [{
      community_id: C1,
      karma_split_helper: 60,
      karma_split_requestor: 40,
      enabled_request_types: [],
      trust_depth_weight: 0.6,
      trust_breadth_weight: 0.4,
      trust_feedback_threshold: 3,
      min_interactions_for_trust: 1,
      trust_negative_allowed: false,
    }],
    karma: [
      karmaRow(),
      karmaRow({
        id: '50000000-0000-0000-0000-000000000002',
        user_id: REQUESTER_1,
        points: 40,
        reason: 'help_received',
      }),
      karmaRow({
        id: '50000000-0000-0000-0000-000000000003',
        points: 15,
        reason: 'first_help_bonus',
      }),
    ],
    activities: [] as Array<Record<string, unknown>>,
    memberships: [HELPER, REQUESTER_1, REQUESTER_2, IDLE].map((user_id) => ({
      user_id,
      community_id: C1,
    })),
    feedback: [] as Array<Record<string, unknown>>,
    userConfigs: [] as Array<Record<string, unknown>>,
    providers: [{ provider_id: 'provider-1', user_id: HELPER, community_id: C1 }],
  };
}

function result(rows: unknown[]) {
  return Promise.resolve({ rows, rowCount: rows.length } as any);
}

function arm(fixture: Fixture = baseFixture()) {
  mockQuery.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes('standing-backfill:matches')) return result(fixture.matches);
    if (text.includes('standing-backfill:community-configs')) return result(fixture.configs);
    if (text.includes('standing-backfill:karma')) return result(fixture.karma);
    if (text.includes('standing-backfill:activity')) return result(fixture.activities);
    if (text.includes('standing-backfill:memberships')) return result(fixture.memberships);
    if (text.includes('standing-backfill:feedback')) return result(fixture.feedback);
    if (text.includes('standing-backfill:user-configs')) return result(fixture.userConfigs);
    if (text.includes('standing-backfill:providers')) return result(fixture.providers);
    throw new Error(`Unexpected preflight query: ${text}`);
  });
  return fixture;
}

function canonicalRowsForFirstMatch() {
  return [
    karmaRow({ reason: 'Provided help' }),
    karmaRow({
      id: '50000000-0000-0000-0000-000000000002',
      user_id: REQUESTER_1,
      points: 40,
      reason: 'Received help',
    }),
    karmaRow({
      id: '50000000-0000-0000-0000-000000000003',
      points: 15,
      reason: 'First help in community',
    }),
  ];
}

describe('Sprint 126 standing backfill preflight', () => {
  beforeEach(() => jest.clearAllMocks());

  it('derives realistic standing from completed-match facts and remains read-only', async () => {
    const fixture = arm();
    const before = JSON.stringify(fixture);

    const report = await analyzeStandingBackfill();

    expect(report).toMatchObject<Partial<StandingBackfillReport>>({
      canApply: true,
      completedMatches: 2,
      eligibleMatches: 2,
      alreadyProjectedMatches: 0,
      activeMembershipPairs: 4,
      sourcedPairs: 3,
      zeroHistoryPairs: 1,
      legacy: { attributableRows: 3, unattributableRows: 0, exactDuplicates: 0 },
      predicted: { karmaRows: 5, activityRows: 4, trustRowsEvaluated: 4 },
      scoreBuckets: { '0': 1, '1-19': 2, '20-39': 1, '40-59': 0, '60-79': 0, '80-100': 0 },
      interactionDepthBuckets: { '0': 4, '1': 0, '2-3': 0, '4+': 0 },
      interactionBreadthBuckets: { '0': 1, '1': 2, '2-3': 1, '4+': 0 },
      providerEligibility: { '1': 1, '20': 1, '40': 0, '60': 0 },
    });
    expect(report.anomalies).toEqual([]);

    const issuedSql = mockQuery.mock.calls.map(([sql]) => String(sql));
    expect(issuedSql).toHaveLength(8);
    for (const sql of issuedSql) {
      expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT)\b/i);
    }
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('counts a fully matching canonical projection as already projected', async () => {
    const fixture = baseFixture();
    fixture.matches = [fixture.matches[0]];
    fixture.karma = canonicalRowsForFirstMatch();
    fixture.activities = [
      { user_id: HELPER, community_id: C1, activity_type: 'complete_request', related_entity_id: MATCH_1, created_at: COMPLETED_1 },
      { user_id: REQUESTER_1, community_id: C1, activity_type: 'complete_offer', related_entity_id: MATCH_1, created_at: COMPLETED_1 },
    ];
    fixture.memberships = fixture.memberships.filter(({ user_id }) => [HELPER, REQUESTER_1].includes(user_id));
    arm(fixture);

    const report = await analyzeStandingBackfill();

    expect(report.alreadyProjectedMatches).toBe(1);
    expect(report.predicted.karmaRows).toBe(0);
    expect(report.predicted.activityRows).toBe(0);
    expect(report.canApply).toBe(true);
  });

  it('uses real recency-weighted feedback facts in the predicted score buckets', async () => {
    const fixture = baseFixture();
    fixture.feedback = [{
      to_user_id: REQUESTER_1,
      community_id: C1,
      rating: 5,
      created_at: new Date(),
    }];
    arm(fixture);

    const report = await analyzeStandingBackfill();

    // Without feedback requester-1 scores 17. A fresh 5-star rating contributes +25 and moves the
    // same source history to 42; this catches a dry-run that silently assumes neutral quality.
    expect(report.scoreBuckets).toEqual({
      '0': 1, '1-19': 1, '20-39': 1, '40-59': 1, '60-79': 0, '80-100': 0,
    });
  });

  it('reads the typed enabled_request_types column from community configs', async () => {
    arm();
    await analyzeStandingBackfill();

    const sql = mockQuery.mock.calls
      .map(([text]) => String(text))
      .find((text) => text.includes('standing-backfill:community-configs'))!;
    expect(sql).toMatch(/\benabled_request_types\b/i);
    expect(sql).not.toMatch(/\bconfig\s*->/i);
  });

  it('fails closed when a completed match has no eligible shared request community', async () => {
    const fixture = baseFixture();
    fixture.matches = [matchRow({ request_community_ids: [C1], eligible_community_ids: [] })];
    fixture.karma = [];
    arm(fixture);

    const report = await analyzeStandingBackfill();

    expect(report.canApply).toBe(false);
    expect(report.eligibleMatches).toBe(0);
    expect(report.anomalies).toEqual([
      { code: 'NO_ELIGIBLE_COMMUNITY', matchId: MATCH_1, detail: 'Completed match has no active shared request community' },
    ]);
  });

  it.each([
    ['participants', { requester_id: null }, 'MISSING_MATCH_PARTICIPANTS'],
    ['request communities', { request_community_ids: [] }, 'NO_REQUEST_COMMUNITY'],
    ['completion timestamp', { completed_at: null }, 'MISSING_COMPLETION_TIME'],
  ])('fails closed when completed-match %s are missing', async (_label, overrides, code) => {
    const fixture = baseFixture();
    fixture.matches = [matchRow(overrides)];
    fixture.karma = [];
    arm(fixture);

    const report = await analyzeStandingBackfill();

    expect(report.canApply).toBe(false);
    expect(report.eligibleMatches).toBe(0);
    expect(report.anomalies).toEqual([
      expect.objectContaining({ code, matchId: MATCH_1 }),
    ]);
  });

  it('fails closed on a canonical identity whose points conflict with replayed facts', async () => {
    const fixture = baseFixture();
    fixture.matches = [fixture.matches[0]];
    fixture.karma = canonicalRowsForFirstMatch();
    fixture.karma[0] = { ...fixture.karma[0], points: 999 };
    arm(fixture);

    const report = await analyzeStandingBackfill();

    expect(report.canApply).toBe(false);
    expect(report.anomalies).toContainEqual({
      code: 'CONFLICTING_KARMA_PROJECTION',
      matchId: MATCH_1,
      detail: `Stored projection differs from canonical replay for ${HELPER}/${C1}/Provided help`,
    });
  });

  it('reports unattributable legacy rows without deleting, aliasing, or blocking them', async () => {
    const fixture = baseFixture();
    fixture.karma.push(karmaRow({
      id: '50000000-0000-0000-0000-000000000099',
      points: 50,
      reason: 'milestone_help_10',
      related_entity_id: '90000000-0000-0000-0000-000000000099',
      created_at: new Date('2025-01-01T00:00:00.000Z'),
    }));
    arm(fixture);

    const report = await analyzeStandingBackfill();

    expect(report.legacy).toEqual({ attributableRows: 3, unattributableRows: 1, exactDuplicates: 0 });
    expect(report.canApply).toBe(true);
    expect(report.anomalies).toEqual([]);
  });

  it('counts duplicate stored projection identities and refuses to apply', async () => {
    const fixture = baseFixture();
    const duplicate = { ...fixture.karma[0], id: '50000000-0000-0000-0000-000000000088' };
    fixture.karma.push(duplicate);
    arm(fixture);

    const report = await analyzeStandingBackfill();

    expect(report.legacy.exactDuplicates).toBe(1);
    expect(report.canApply).toBe(false);
    expect(report.anomalies).toContainEqual({
      code: 'DUPLICATE_KARMA_IDENTITY',
      matchId: MATCH_1,
      detail: 'Stored karma contains a duplicate projection identity',
    });
  });
});
