import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../src/config/database';
import {
  redactNodeMetrics,
  getTrustGraph,
  getFullCommunityGraph,
  getTrustGraphAggregate,
} from '../../src/database/trustEdgeDb';

const mockQuery = (pool as any).query;

/**
 * Sprint 111 follow-up — reputation privacy at the API boundary (ADR-081).
 *
 * A node's trust_score/karma is the owner's reputation and must NOT leave the API for anyone but the
 * authenticated caller. Every graph read keeps names + edges (structure) but zeroes the reputation
 * numbers on non-caller nodes. This locks that for community, aggregate, and full-community reads;
 * the neighborhood read is covered in sprint-111-neighborhood.test.ts.
 */
describe('sprint-111 reputation-metric privacy', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('redactNodeMetrics', () => {
    it('preserves the caller, zeroes everyone else, and keeps non-metric fields', () => {
      const out = redactNodeMetrics([
        { id: 'me', isCurrentUser: true, trust_score: 12.5, karma: 8, degrees_of_separation: 0 } as any,
        { id: 'other', isCurrentUser: false, trust_score: 9.9, karma: 4, degrees_of_separation: 1 } as any,
      ]);
      expect(out[0]).toEqual(expect.objectContaining({ id: 'me', trust_score: 12.5, karma: 8 }));
      expect(out[1]).toEqual(
        expect.objectContaining({ id: 'other', trust_score: 0, karma: 0, degrees_of_separation: 1 })
      );
    });
  });

  // Each graph read issues nodes-then-edges; we only need the nodes (first) result for metrics.
  const callerAndPeerRows = {
    rows: [
      { id: 'me', name: 'Me', trust_score: '12.5', karma: '8', is_current_user: true },
      { id: 'sarah', name: 'Sarah Patel', trust_score: '17.4', karma: '3', is_current_user: false },
    ],
  };

  const assertRedacted = (nodes: any[]) => {
    const me = nodes.find(n => n.id === 'me');
    const sarah = nodes.find(n => n.id === 'sarah');
    expect(me.trust_score).toBe(12.5);
    expect(me.karma).toBe(8);
    expect(sarah.trust_score).toBe(0); // not exposed
    expect(sarah.karma).toBe(0); // not exposed
    expect(sarah.name).toBe('Sarah Patel'); // structure stays
  };

  it('getTrustGraph zeroes other members\' metrics', async () => {
    mockQuery.mockResolvedValueOnce(callerAndPeerRows).mockResolvedValueOnce({ rows: [] });
    const graph = await getTrustGraph('c1', 'me');
    assertRedacted(graph.nodes);
  });

  it('getFullCommunityGraph zeroes other members\' metrics', async () => {
    mockQuery.mockResolvedValueOnce(callerAndPeerRows).mockResolvedValueOnce({ rows: [] });
    const graph = await getFullCommunityGraph('c1', 'me');
    assertRedacted(graph.nodes);
  });

  it('getTrustGraphAggregate zeroes other members\' metrics', async () => {
    mockQuery.mockResolvedValueOnce(callerAndPeerRows).mockResolvedValueOnce({ rows: [] });
    const graph = await getTrustGraphAggregate('me');
    assertRedacted(graph.nodes);
  });
});
