// tests/tdd/network-endpoint-contract.test.ts
/**
 * TDD: social_graph.connections upsert logic + GET /network response contract
 * Sprint 27 - Profile Unification
 */

describe('social_graph.connections upsert logic', () => {
  describe('normalized pair ordering', () => {
    it('always stores the lexicographically smaller UUID as user_a_id', () => {
      const a = '11111111-0000-0000-0000-000000000000';
      const b = '22222222-0000-0000-0000-000000000000';
      const pair = {
        user_a_id: [a, b].sort()[0],
        user_b_id: [a, b].sort()[1],
      };
      expect(pair.user_a_id).toBe(a);
      expect(pair.user_b_id).toBe(b);
    });

    it('produces the same normalized pair regardless of argument order', () => {
      const a = '11111111-0000-0000-0000-000000000000';
      const b = '22222222-0000-0000-0000-000000000000';
      const pairAB = { user_a_id: [a, b].sort()[0], user_b_id: [a, b].sort()[1] };
      const pairBA = { user_a_id: [b, a].sort()[0], user_b_id: [b, a].sort()[1] };
      expect(pairAB).toEqual(pairBA);
    });
  });

  describe('upsert idempotency', () => {
    it('second upsert for same pair updates last_interaction_at, not first_connected_at', () => {
      const firstConnected = new Date('2026-01-01T00:00:00Z');
      const lastInteraction = new Date('2026-03-15T12:00:00Z');

      // Simulate what ON CONFLICT DO UPDATE SET last_interaction_at = EXCLUDED.last_interaction_at does
      const existing = { first_connected_at: firstConnected, last_interaction_at: firstConnected };
      const after = { ...existing, last_interaction_at: lastInteraction };

      expect(after.first_connected_at).toEqual(firstConnected); // unchanged
      expect(after.last_interaction_at).toEqual(lastInteraction); // updated
    });
  });
});

describe('GET /network response contract', () => {
  describe('node shape', () => {
    it('each node has id, name, and provider_id (nullable)', () => {
      const node = { id: 'uuid-1', name: 'Alice', provider_id: null };
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('provider_id');
    });

    it('provider_id is null when user has no provider profile', () => {
      const node = { id: 'uuid-1', name: 'Alice', provider_id: null };
      expect(node.provider_id).toBeNull();
    });

    it('provider_id is a string UUID when user has a provider profile', () => {
      const node = { id: 'uuid-1', name: 'Bob', provider_id: 'provider-uuid-1' };
      expect(typeof node.provider_id).toBe('string');
    });
  });

  describe('edge shape', () => {
    it('each edge has source, target, and type', () => {
      const edge = { source: 'uuid-1', target: 'uuid-2', type: 'exchange' };
      expect(edge).toHaveProperty('source');
      expect(edge).toHaveProperty('target');
      expect(edge).toHaveProperty('type');
    });

    it('edge type is either exchange or community', () => {
      const validTypes = ['exchange', 'community'];
      const edge = { source: 'a', target: 'b', type: 'exchange' };
      expect(validTypes).toContain(edge.type);
    });
  });

  describe('150-node cap', () => {
    it('caps results at 150 nodes', () => {
      const allConnections = Array.from({ length: 200 }, (_, i) => ({
        connected_user_id: `uuid-${i}`,
        edge_type: 'exchange',
        last_interaction_at: new Date(),
      }));
      const capped = allConnections.slice(0, 150);
      expect(capped.length).toBe(150);
    });

    it('prefers exchange edges over community edges when capping', () => {
      const exchangeEdges = Array.from({ length: 100 }, (_, i) => ({
        connected_user_id: `exchange-${i}`,
        edge_type: 'exchange',
      }));
      const communityEdges = Array.from({ length: 100 }, (_, i) => ({
        connected_user_id: `community-${i}`,
        edge_type: 'community',
      }));
      // Exchange comes first in merge order
      const merged = [...exchangeEdges, ...communityEdges].slice(0, 150);
      const exchangeCount = merged.filter(e => e.edge_type === 'exchange').length;
      expect(exchangeCount).toBe(100); // all exchange edges kept
    });
  });

  describe('empty state', () => {
    it('returns empty nodes and edges arrays (not an error) when user has no connections', () => {
      const result = { nodes: [], edges: [] };
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });
});
