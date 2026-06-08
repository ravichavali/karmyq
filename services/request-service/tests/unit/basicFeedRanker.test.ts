import { BasicFeedRanker } from '../../src/services/feed/basicFeedRanker';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('axios');

import { query } from '../../src/database/db';
import axios from 'axios';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

const NOW = new Date().toISOString();
const OLD = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48 hours ago

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

describe('BasicFeedRanker', () => {
  let ranker: BasicFeedRanker;

  beforeEach(() => {
    jest.clearAllMocks();
    ranker = new BasicFeedRanker();
  });

  it('returns empty array given empty input from DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    const result = await ranker.generateFeed('viewer-1');
    expect(result).toEqual([]);
  });

  it('returns single-item array unchanged when one request', async () => {
    const req = makeRequest({ request_id: 'r1', requester_id: 'u2' });
    mockQuery.mockResolvedValueOnce({ rows: [req], rowCount: 1 } as any);
    mockAxiosPost.mockResolvedValueOnce(proximityResponse([{ id: 'u2', degrees: null }]) as any);

    const result = await ranker.generateFeed('viewer-1');
    expect(result).toHaveLength(1);
    expect(result[0].data.request_id).toBe('r1');
  });

  it('1° connection outranks 2°, which outranks 3°, which outranks no-connection', async () => {
    const r1 = makeRequest({ request_id: 'r1', requester_id: 'u1', urgency: 'low' });
    const r2 = makeRequest({ request_id: 'r2', requester_id: 'u2', urgency: 'low' });
    const r3 = makeRequest({ request_id: 'r3', requester_id: 'u3', urgency: 'low' });
    const r4 = makeRequest({ request_id: 'r4', requester_id: 'u4', urgency: 'low' });

    mockQuery.mockResolvedValueOnce({ rows: [r3, r4, r1, r2], rowCount: 4 } as any);
    mockAxiosPost.mockResolvedValueOnce(
      proximityResponse([
        { id: 'u1', degrees: 1 },
        { id: 'u2', degrees: 2 },
        { id: 'u3', degrees: 3 },
        { id: 'u4', degrees: null },
      ]) as any
    );

    const result = await ranker.generateFeed('viewer-1');
    const ids = result.map((item) => item.data.request_id);
    expect(ids[0]).toBe('r1'); // 1° first
    expect(ids[1]).toBe('r2'); // 2° second
    expect(ids[2]).toBe('r3'); // 3° third
    expect(ids[3]).toBe('r4'); // no connection last
  });

  it('high urgency outranks low urgency at same proximity', async () => {
    const rLow = makeRequest({ request_id: 'r-low', requester_id: 'u1', urgency: 'low' });
    const rHigh = makeRequest({ request_id: 'r-high', requester_id: 'u2', urgency: 'high' });

    mockQuery.mockResolvedValueOnce({ rows: [rLow, rHigh], rowCount: 2 } as any);
    mockAxiosPost.mockResolvedValueOnce(
      proximityResponse([
        { id: 'u1', degrees: null },
        { id: 'u2', degrees: null },
      ]) as any
    );

    const result = await ranker.generateFeed('viewer-1');
    expect(result[0].data.request_id).toBe('r-high');
  });

  it('urgent > high > medium > low urgency ordering at same proximity', async () => {
    const rLow = makeRequest({ request_id: 'r-low', requester_id: 'u1', urgency: 'low' });
    const rUrgent = makeRequest({ request_id: 'r-urgent', requester_id: 'u2', urgency: 'urgent' });
    const rMedium = makeRequest({ request_id: 'r-medium', requester_id: 'u3', urgency: 'medium' });
    const rHigh = makeRequest({ request_id: 'r-high', requester_id: 'u4', urgency: 'high' });

    mockQuery.mockResolvedValueOnce({ rows: [rLow, rMedium, rHigh, rUrgent], rowCount: 4 } as any);
    mockAxiosPost.mockResolvedValueOnce(
      proximityResponse([
        { id: 'u1', degrees: null },
        { id: 'u2', degrees: null },
        { id: 'u3', degrees: null },
        { id: 'u4', degrees: null },
      ]) as any
    );

    const result = await ranker.generateFeed('viewer-1');
    const ids = result.map((r) => r.data.request_id);
    expect(ids[0]).toBe('r-urgent');
    expect(ids[1]).toBe('r-high');
    expect(ids[2]).toBe('r-medium');
    expect(ids[3]).toBe('r-low');
  });

  it('more recent request outranks older at same proximity + urgency', async () => {
    const rOld = makeRequest({ request_id: 'r-old', requester_id: 'u1', created_at: OLD });
    const rNew = makeRequest({ request_id: 'r-new', requester_id: 'u2', created_at: NOW });

    mockQuery.mockResolvedValueOnce({ rows: [rOld, rNew], rowCount: 2 } as any);
    mockAxiosPost.mockResolvedValueOnce(
      proximityResponse([
        { id: 'u1', degrees: null },
        { id: 'u2', degrees: null },
      ]) as any
    );

    const result = await ranker.generateFeed('viewer-1');
    expect(result[0].data.request_id).toBe('r-new');
  });

  it('ranking is deterministic for identical inputs', async () => {
    const requests = [
      makeRequest({ request_id: 'r1', requester_id: 'u1' }),
      makeRequest({ request_id: 'r2', requester_id: 'u2' }),
    ];
    const proximity = proximityResponse([
      { id: 'u1', degrees: 2 },
      { id: 'u2', degrees: 1 },
    ]);

    mockQuery
      .mockResolvedValueOnce({ rows: requests, rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: requests, rowCount: 2 } as any);
    mockAxiosPost
      .mockResolvedValueOnce(proximity as any)
      .mockResolvedValueOnce(proximity as any);

    const result1 = await ranker.generateFeed('viewer-1');
    const result2 = await ranker.generateFeed('viewer-1');

    expect(result1.map((r) => r.data.request_id)).toEqual(
      result2.map((r) => r.data.request_id)
    );
  });

  it('social_proximity degrees is included in feed item data', async () => {
    const req = makeRequest({ request_id: 'r1', requester_id: 'u1' });
    mockQuery.mockResolvedValueOnce({ rows: [req], rowCount: 1 } as any);
    mockAxiosPost.mockResolvedValueOnce(
      proximityResponse([{ id: 'u1', degrees: 2 }]) as any
    );

    const result = await ranker.generateFeed('viewer-1');
    expect(result[0].data.social_proximity?.degrees).toBe(2);
  });

  it('forwards the caller Authorization header to social graph batch paths', async () => {
    const req = makeRequest({ request_id: 'r1', requester_id: 'u1' });
    mockQuery.mockResolvedValueOnce({ rows: [req], rowCount: 1 } as any);
    mockAxiosPost.mockResolvedValueOnce(
      proximityResponse([{ id: 'u1', degrees: 1 }]) as any
    );

    await ranker.generateFeed('viewer-1', 20, 'Bearer signed-token');

    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/paths/batch'),
      { target_user_ids: ['u1'] },
      { headers: { Authorization: 'Bearer signed-token' } }
    );
  });

  it('gracefully handles social graph service failure — still returns feed', async () => {
    const req = makeRequest({ request_id: 'r1', requester_id: 'u1' });
    mockQuery.mockResolvedValueOnce({ rows: [req], rowCount: 1 } as any);
    mockAxiosPost.mockRejectedValueOnce(new Error('service down'));

    const result = await ranker.generateFeed('viewer-1');
    expect(result).toHaveLength(1);
    expect(result[0].data.social_proximity).toBeUndefined();
  });
});
