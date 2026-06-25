/**
 * Sprint 112 PR A — Feed + dibs disclosure contract tests (ADR-082).
 *
 * Cross-agent review found two request-service leaks the original inventory missed: the curated feed
 * returned the requester's exact karma/trust, and the dibs candidate spread an ordinary neighbor's
 * trustScore. This suite locks the dibs-candidate projection with a NON-ZERO sentinel; the curated
 * feed's requester karma/trust removal is additionally covered by the disclosure-gate fixture scan.
 */
// The dibs route applies the real authMiddleware per-route; mock it to a pass-through that sets the
// caller identity (the GET handler reads req.user.userId).
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: '11111111-1111-1111-1111-111111111111', email: 'c@test.com', communities: [] };
    next();
  },
}));

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...a: any[]) => mockQuery(...a), connect: jest.fn() },
  query: (...a: any[]) => mockQuery(...a),
  withTransaction: (fn: any) => fn((...a: any[]) => mockQuery(...a)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

const mockGetMutualAidBestCandidate = jest.fn();
const mockGetBestCandidate = jest.fn();
jest.mock('../../src/services/dibsScoringService', () => ({
  getBestCandidate: (...a: any[]) => mockGetBestCandidate(...a),
  getMutualAidBestCandidate: (...a: any[]) => mockGetMutualAidBestCandidate(...a),
}));
jest.mock('../../src/services/dibsReason', () => ({ deriveDibsReason: () => 'trusted_neighbor' }));
jest.mock('../../src/db/dibsDb', () => ({
  deriveSimilarityKey: () => 'tools',
  getRelationshipContext: jest.fn().mockResolvedValue({ priorCompletedMatches: 2, lastInteractionAt: null, similarCategory: true }),
}));

import express from 'express';
import request from 'supertest';
import dibsRouter from '../../src/routes/dibs';
import requestsRouter from '../../src/routes/requests';

const CALLER = '11111111-1111-1111-1111-111111111111';
const NEIGHBOR = '22222222-2222-2222-2222-222222222222';
const REQUESTER = '33333333-3333-3333-3333-333333333333';
const SENTINEL_TRUST = 827;
const SENTINEL_KARMA = 913;
const SENTINEL_SCORE = 614;

function app() {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => { req.user = { userId: CALLER, email: 'c@test.com', communities: [] }; next(); });
  a.use('/requests', dibsRouter);
  return a;
}

function curatedApp() {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    // Member of the test community so the community-view membership guard passes.
    req.user = { userId: CALLER, email: 'c@test.com', communities: [{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', role: 'member' }] };
    req.logger = { error: () => {} }; // handler logs via req.logger?.error; no-op in test
    next();
  });
  a.use('/requests', requestsRouter);
  return a;
}

beforeEach(() => {
  jest.clearAllMocks();
  // trustPath enrichment is a non-fatal fetch — make it fail so the handler skips it.
  (global as any).fetch = jest.fn().mockRejectedValue(new Error('no social-graph in test'));
});

describe('GET /requests/:id/dibs-candidate — ADR-082', () => {
  it('omits an ordinary neighbor candidate\'s exact trustScore', async () => {
    mockQuery
      // 1. fetch the request (caller is the requester)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1', requester_id: CALLER, request_type: 'borrow', category: 'tools', payload: {} }] })
      // 2. request_communities
      .mockResolvedValueOnce({ rows: [{ community_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }] });
    mockGetMutualAidBestCandidate.mockResolvedValue({
      providerId: 'p1',
      providerUserId: NEIGHBOR,
      displayName: 'Sam',
      trustScore: SENTINEL_TRUST, // sentinel — must NOT appear in the response
      score: SENTINEL_SCORE, // derived ranking score — also reconstruction-enabling; must NOT appear
      priorInteractions: 2,
      similarPriorInteractions: 1,
      trustGraphConnection: 'direct',
      isAvailable: true,
      kind: 'neighbor',
    });

    const res = await request(app()).get('/requests/req-1/dibs-candidate');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    // The candidate identity + relationship structure survive…
    expect(res.body.data.providerUserId).toBe(NEIGHBOR);
    expect(res.body.data.priorInteractions).toBe(2);
    // …but neither the neighbor's exact trustScore NOR the derived ranking score does, by key OR value.
    expect(res.body.data).not.toHaveProperty('trustScore');
    expect(res.body.data).not.toHaveProperty('score');
    expect(JSON.stringify(res.body.data)).not.toMatch(/trustScore|"trust_score"|"score"|827|614/);
  });
});

describe('GET /requests/curated — live response carries no requester reputation (ADR-082)', () => {
  // Substring-keyed query mock: seed the requester's karma/trust with NON-ZERO sentinels and prove
  // they never reach the outward feed (neither as requesterKarma/requesterTrustScore nor via
  // feedBreakdown.requesterTrust.raw in the legacy raw response).
  const makeCuratedMock = (requestCount = 1, configRow: Record<string, unknown> | null = null) => (sql: string) => {
    // getUserProfile: the caller must resolve.
    if (/FROM auth\.users WHERE id/.test(sql)) {
      return Promise.resolve({ rowCount: 1, rows: [{ id: CALLER, name: 'Caller' }] });
    }
    // TRAP: requester karma/trust batch lookup. Round-6 removed this query from the handler entirely
    // (requester reputation is no longer read for ranking). If it ever returns, the sentinels would
    // surface and the leak assertions would catch them.
    if (/FROM reputation\.karma_records kr/.test(sql)) {
      return Promise.resolve({ rows: [{ user_id: REQUESTER, total_karma: SENTINEL_KARMA, best_trust_score: SENTINEL_TRUST }] });
    }
    // Founder feed-weight config (optional) — used by the adversarial/legacy tests to attempt
    // reputation isolation via weights.
    if (/community_configs cc/.test(sql)) {
      return Promise.resolve({ rowCount: configRow ? 1 : 0, rows: configRow ? [configRow] : [] });
    }
    // Sister-community links (only consulted when includeSisterCommunities=true) — one linked sister.
    if (/community_links cl/.test(sql)) {
      return Promise.resolve({ rowCount: 1, rows: [{ sister_community_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', trust_carry_factor: 0.40 }] });
    }
    // user_request_preferences → subscribe to 'generic' so the (generic) request survives filtering.
    if (/user_request_preferences/.test(sql)) {
      return Promise.resolve({ rowCount: 1, rows: [{ request_type: 'generic', subscribed: true }] });
    }
    // The main feed query: N open, in-community requests from REQUESTER (→ sourceTier 'community').
    if (/FROM requests\.help_requests r/.test(sql)) {
      const rows = Array.from({ length: requestCount }, (_v, i) => ({
        id: `req-curated-${i + 1}`, requester_id: REQUESTER, request_type: 'generic', title: `Need a hand ${i + 1}`,
        description: 'help', urgency: i === 0 ? 'high' : 'low', payload: {}, status: 'open',
        created_at: new Date().toISOString(),
        community_ids: 'cccccccc-cccc-cccc-cccc-cccccccccccc', in_user_community: true,
        visibility_scope: 'community', visibility_max_degrees: 3,
      }));
      return Promise.resolve({ rowCount: rows.length, rows });
    }
    return Promise.resolve({ rowCount: 0, rows: [] });
  }

  it('legacy curated response exposes no requester reputation or reconstruction-enabling score', async () => {
    mockQuery.mockImplementation(makeCuratedMock(1) as any);
    const res = await request(curatedApp()).get('/requests/curated?minScore=0');

    expect(res.status).toBe(200);
    const requests = res.body.data?.requests ?? [];
    expect(requests.length).toBeGreaterThan(0);
    const item = requests[0];
    // Identity + the request itself survive; the server-sorted ORDER is the outward ranking signal.
    expect(item.requester_id).toBe(REQUESTER);
    // The requester's exact reputation does not appear — neither directly (karma/trust) nor via the
    // reconstruction-enabling composite feedScore + its component signals nor the raw breakdowns.
    expect(item).not.toHaveProperty('requesterKarma');
    expect(item).not.toHaveProperty('requesterTrustScore');
    expect(item).not.toHaveProperty('feedScore');
    expect(item).not.toHaveProperty('priorInteractionScore');
    expect(item).not.toHaveProperty('recencyScore');
    expect(item).not.toHaveProperty('feedBreakdown');
    expect(item).not.toHaveProperty('matchBreakdown');
    expect(JSON.stringify(res.body.data)).not.toMatch(/913|827|requesterTrust|feedScore|feedBreakdown/);
  });

  it('view=home priority is a non-reversible rank, not the composite feedScore', async () => {
    mockQuery.mockImplementation(makeCuratedMock(1) as any);
    const res = await request(curatedApp()).get('/requests/curated?view=home&minScore=0');

    expect(res.status).toBe(200);
    const items = res.body.data?.items ?? [];
    const requestItem = items.find((i: any) => i.kind === 'request');
    expect(requestItem).toBeTruthy();
    // With one request, the rank-based priority is PRIORITY_REQUEST_BASE(1000) + rank(1) = 1001,
    // NOT 1000 + round(feedScore). The exact composite never reaches the wire.
    expect(requestItem.priority).toBe(1001);
    expect(JSON.stringify(res.body.data)).not.toMatch(/913|827|requesterTrust|feedScore|"feed_score"/);
  });

  // Multi-item: priorities are distinct rank positions (1000 + rank), preserving order without
  // encoding any score. Both home and community views go through buildRequestItem(data, rank).
  it.each(['home', 'community'])('view=%s maps each request to its exact rank priority (order preserved)', async (view) => {
    // req-curated-1 has high urgency → top feedScore → rank 3 → priority 1003; the two low-urgency
    // requests tie and keep input order (req-2 then req-3) → 1002, 1001. Asserting the exact
    // id→priority mapping (not just the multiset) so a reversed rank assignment would fail.
    mockQuery.mockImplementation(makeCuratedMock(3) as any);
    const res = await request(curatedApp()).get(`/requests/curated?view=${view}&community_id=cccccccc-cccc-cccc-cccc-cccccccccccc&minScore=0`);

    expect(res.status).toBe(200);
    const reqItems = (res.body.data?.items ?? []).filter((i: any) => i.kind === 'request');
    expect(reqItems.length).toBe(3);
    const byId = Object.fromEntries(reqItems.map((i: any) => [i.data.request_id, i.priority]));
    expect(byId).toEqual({ 'req-curated-1': 1003, 'req-curated-2': 1002, 'req-curated-3': 1001 });
    // Emitted order matches descending priority (the server owns ordering; client renders as received).
    expect(reqItems.map((i: any) => i.data.request_id)).toEqual(['req-curated-1', 'req-curated-2', 'req-curated-3']);
    expect(JSON.stringify(res.body.data)).not.toMatch(/913|827|requesterTrust|feedScore|"feed_score"/);
  });

  it('an arbitrary minScore is NOT honored — the threshold is server-fixed (no probing oracle)', async () => {
    mockQuery.mockImplementation(makeCuratedMock(1) as any);
    // A caller-supplied intermediate threshold must collapse to the default; the echoed effective
    // threshold proves the server ignored 37 — so the inclusion boundary can't be moved to probe.
    const res = await request(curatedApp()).get('/requests/curated?minScore=37');
    expect(res.status).toBe(200);
    expect(res.body.data?.filters?.minMatchScore).toBe(30);
  });

  // Adversarial: a founder weight config that tries to ISOLATE reputation cannot affect the feed.
  // Round-6 removes requester reputation from ranking entirely (signal 0 + weight 0 + renormalized),
  // so no weight allocation can make order/threshold depend on a target's trust — and the requester
  // karma/trust query is never even issued.
  it('founder weights that isolate requester-trust cannot influence ordering or read reputation', async () => {
    const isolatingConfig = {
      community_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      enabled_request_types: [],
      feed_weight_skill_match: 0, feed_weight_trust_distance: 0, feed_weight_community_relevance: 0,
      feed_weight_urgency: 0, feed_weight_requester_trust: 1, // the isolation attempt
      feed_weight_prior_interaction: 0, feed_weight_recency: 0,
    };
    mockQuery.mockImplementation(makeCuratedMock(2, isolatingConfig) as any);
    const res = await request(curatedApp()).get('/requests/curated?view=home&minScore=0');

    expect(res.status).toBe(200); // does not throw despite a weight vector that sums to 1.0 on trust
    const reqItems = (res.body.data?.items ?? []).filter((i: any) => i.kind === 'request');
    expect(reqItems.length).toBe(2);
    // Ordering follows the non-reputation signals (req-1 has high urgency), NOT requester trust.
    expect(reqItems.map((i: any) => i.data.request_id)).toEqual(['req-curated-1', 'req-curated-2']);
    expect(reqItems.map((i: any) => i.priority)).toEqual([1002, 1001]);
    // The requester karma/trust query is never issued (reputation is not read for ranking)…
    const queriedReputation = mockQuery.mock.calls.some((c) => /reputation\.karma_records|reputation\.trust_scores/.test(String(c[0])));
    expect(queriedReputation).toBe(false);
    // …and no trust sentinel leaks.
    expect(JSON.stringify(res.body.data)).not.toMatch(/913|827|requesterTrust|feedScore/);
  });

  it('a legacy stored feed_weight_requester_trust=1 config neither breaks the feed nor leaks trust', async () => {
    // A pre-branch row could have persisted requester_trust=1 (with the other defaults). The query-time
    // normalization + signal=0 neutralize it: 200, requests present, no reputation read, no leak.
    const legacyConfig = {
      community_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      enabled_request_types: [],
      feed_weight_skill_match: 0.25, feed_weight_trust_distance: 0.20, feed_weight_community_relevance: 0.15,
      feed_weight_urgency: 0.10, feed_weight_requester_trust: 1, feed_weight_prior_interaction: 0.10,
      feed_weight_recency: 0.05,
    };
    mockQuery.mockImplementation(makeCuratedMock(2, legacyConfig) as any);
    const res = await request(curatedApp()).get('/requests/curated?view=home&minScore=0');

    expect(res.status).toBe(200);
    const reqItems = (res.body.data?.items ?? []).filter((i: any) => i.kind === 'request');
    expect(reqItems.map((i: any) => i.data.request_id)).toEqual(['req-curated-1', 'req-curated-2']);
    const queriedReputation = mockQuery.mock.calls.some((c) => /reputation\.karma_records|reputation\.trust_scores/.test(String(c[0])));
    expect(queriedReputation).toBe(false);
    expect(JSON.stringify(res.body.data)).not.toMatch(/913|827|requesterTrust|feedScore/);
  });
});
