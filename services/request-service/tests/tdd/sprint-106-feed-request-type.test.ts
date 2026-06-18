/**
 * Sprint 106 / BUG-014 — the Dashboard feed ranker must carry the PERSISTED `request_type` enum
 * onto each feed item, never the mixed-vocab `category` column.
 *
 * Regression context: `basicFeedRanker.ts` projected `request_type: item.request.category`. The
 * `category` column is mixed-vocab (a skill token like `'plumbing'` on seed/old rows, an enum-ish
 * token on newer rows), so a service ask whose `category` held a skill token was projected with a
 * non-enum `request_type`. The frontend offer-action copy helper switches on `request_type ===
 * 'service'` to read "Offer service", so the ask fell through to the generic "Offer help" label.
 *
 * The fix carries `hr.request_type` (the `request_type_enum`: generic|ride|borrow|service|event)
 * through the ranker. These tests assert the projected enum is the persisted value regardless of
 * what `category` holds.
 */
import { BasicFeedRanker } from '../../src/services/feed/basicFeedRanker';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('axios');

import { query } from '../../src/database/db';
import axios from 'axios';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

const OLD = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    request_id: 'req-1',
    title: 'Test request',
    description: 'Needs help',
    requester_id: 'u-requester',
    requester_name: 'Alice',
    community_id: 'c1',
    community_name: 'Community 1',
    urgency: 'low',
    status: 'open',
    // The persisted enum is the source of truth for request_type:
    request_type: 'generic',
    // The mixed-vocab column — deliberately distinct from request_type to prove no conflation:
    category: 'other',
    created_at: OLD,
    offers_count: 1,
    is_boosted: false,
    boosted_expires_at: null,
    ...overrides,
  };
}

function proximityResponse(pairs: Array<{ id: string; degrees: number | null }>) {
  return {
    data: {
      success: true,
      data: pairs.map((p) => ({
        target_user_id: p.id,
        degrees_of_separation: p.degrees,
        trust_score: undefined,
      })),
    },
  };
}

describe('BasicFeedRanker — BUG-014 request_type projection', () => {
  let ranker: BasicFeedRanker;

  beforeEach(() => {
    jest.clearAllMocks();
    ranker = new BasicFeedRanker();
  });

  it('projects the persisted request_type=service even when category holds a skill token', async () => {
    const req = makeRequest({
      request_id: 'r-service',
      requester_id: 'u1',
      request_type: 'service',
      category: 'plumbing', // skill-token category, NOT an enum value
    });
    mockQuery.mockResolvedValueOnce({ rows: [req], rowCount: 1 } as any);
    mockAxiosPost.mockResolvedValueOnce(proximityResponse([{ id: 'u1', degrees: null }]) as any);

    const result = await ranker.generateFeed('viewer-1');

    expect(result[0].data.request_type).toBe('service');
    // category still travels separately for the payload renderer — it is NOT the request_type.
    expect(result[0].data.category).toBe('plumbing');
  });

  it('carries each request_type_enum value through unchanged (not service-only)', async () => {
    const types = ['generic', 'ride', 'borrow', 'service', 'event'] as const;
    const rows = types.map((t, i) =>
      makeRequest({ request_id: `r-${t}`, requester_id: `u${i}`, request_type: t, category: `cat-${t}` })
    );
    mockQuery.mockResolvedValueOnce({ rows, rowCount: rows.length } as any);
    mockAxiosPost.mockResolvedValueOnce(
      proximityResponse(rows.map((_, i) => ({ id: `u${i}`, degrees: null }))) as any
    );

    const result = await ranker.generateFeed('viewer-1');

    const byId = new Map(result.map((item) => [item.data.request_id, item.data.request_type]));
    for (const t of types) {
      expect(byId.get(`r-${t}`)).toBe(t);
    }
  });

  it('falls back to generic when the persisted request_type is missing (legacy rows)', async () => {
    const req = makeRequest({ request_id: 'r-legacy', requester_id: 'u1', request_type: null, category: 'errand' });
    mockQuery.mockResolvedValueOnce({ rows: [req], rowCount: 1 } as any);
    mockAxiosPost.mockResolvedValueOnce(proximityResponse([{ id: 'u1', degrees: null }]) as any);

    const result = await ranker.generateFeed('viewer-1');

    expect(result[0].data.request_type).toBe('generic');
    // A null/legacy request_type must never silently become the category token.
    expect(result[0].data.request_type).not.toBe('errand');
  });
});
