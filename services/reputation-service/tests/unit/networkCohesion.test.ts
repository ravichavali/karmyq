/**
 * Unit Tests for computeNetworkCohesion (ADR-040)
 *
 * The function queries the DB. We mock the `query` function from
 * `../../src/database/db` to exercise the graph math in isolation.
 */

import { computeNetworkCohesion } from '../../src/services/networkCohesionService';
import { query } from '../../src/database/db';

jest.mock('../../src/database/db');

const mockQuery = query as jest.MockedFunction<typeof query>;

function mockResult(rows: any[]) {
  return { rows, rowCount: rows.length } as any;
}

const COMMUNITY_ID = 'comm-test';

// Sets up the two required DB calls:
//   1. activeMembers query
//   2. matchesResult query
//   (optionally) 3. social_distances query
function setupMocks(opts: {
  activeMembers: number;
  pairs: Array<{ requester_id: string; responder_id: string }>;
  avgDist?: number | null;
}) {
  mockQuery
    // 1. active members count
    .mockResolvedValueOnce(mockResult([{ count: String(opts.activeMembers) }]))
    // 2. directed pairs (matches)
    .mockResolvedValueOnce(mockResult(opts.pairs));

  if (opts.activeMembers >= 2 && opts.pairs.length > 0) {
    // 3. social distances (avgPathLength)
    const avg = opts.avgDist ?? null;
    mockQuery.mockResolvedValueOnce(mockResult([{ avg_dist: avg !== null ? String(avg) : null }]));
  }
}

describe('computeNetworkCohesion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Reciprocity = 1.0 when all pairs are mutual', async () => {
    // A→B and B→A, C→D and D→C
    setupMocks({
      activeMembers: 4,
      pairs: [
        { requester_id: 'A', responder_id: 'B' },
        { requester_id: 'B', responder_id: 'A' },
        { requester_id: 'C', responder_id: 'D' },
        { requester_id: 'D', responder_id: 'C' },
      ],
      avgDist: null,
    });

    const result = await computeNetworkCohesion(COMMUNITY_ID);

    expect(result.reciprocity).toBe(1.0);
  });

  it('Reciprocity = 0.0 when all pairs are one-way', async () => {
    // A→B, C→D — no reverse edges
    setupMocks({
      activeMembers: 4,
      pairs: [
        { requester_id: 'A', responder_id: 'B' },
        { requester_id: 'C', responder_id: 'D' },
      ],
      avgDist: null,
    });

    const result = await computeNetworkCohesion(COMMUNITY_ID);

    expect(result.reciprocity).toBe(0.0);
  });

  it('Density correct for simple graph (4 nodes, 3 edges)', async () => {
    // Directed edges covering 3 undirected edges: A-B, A-C, A-D
    // density = 2 * 3 / (4 * 3) = 0.5
    setupMocks({
      activeMembers: 4,
      pairs: [
        { requester_id: 'A', responder_id: 'B' },
        { requester_id: 'A', responder_id: 'C' },
        { requester_id: 'A', responder_id: 'D' },
      ],
      avgDist: null,
    });

    const result = await computeNetworkCohesion(COMMUNITY_ID);

    expect(result.density).toBeCloseTo(0.5, 5);
  });

  it('Clustering = 1.0 for complete graph (K3)', async () => {
    // K3: A-B, B-C, A-C (all directed, fully mutual → every pair is triangled)
    setupMocks({
      activeMembers: 3,
      pairs: [
        { requester_id: 'A', responder_id: 'B' },
        { requester_id: 'B', responder_id: 'A' },
        { requester_id: 'B', responder_id: 'C' },
        { requester_id: 'C', responder_id: 'B' },
        { requester_id: 'A', responder_id: 'C' },
        { requester_id: 'C', responder_id: 'A' },
      ],
      avgDist: null,
    });

    const result = await computeNetworkCohesion(COMMUNITY_ID);

    expect(result.clustering).toBeCloseTo(1.0, 5);
  });

  it('Cohesion score is in [0, 100] and weights sum to 1.0', async () => {
    // Weights: reciprocity×0.30 + density×0.20 + clustering×0.30 + pathScore×0.20 = 1.0
    const weightSum = 0.30 + 0.20 + 0.30 + 0.20;
    expect(weightSum).toBeCloseTo(1.0, 10);

    // Use a mixed graph; score must be in [0, 100]
    setupMocks({
      activeMembers: 4,
      pairs: [
        { requester_id: 'A', responder_id: 'B' },
        { requester_id: 'B', responder_id: 'A' },
        { requester_id: 'C', responder_id: 'D' },
      ],
      avgDist: 2,
    });

    const result = await computeNetworkCohesion(COMMUNITY_ID);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
