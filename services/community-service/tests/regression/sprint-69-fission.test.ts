import { clusterMembers, computeSizeAlert, TrustEdge } from '../../src/services/fissionService';

describe('Sprint 69 — Fission Mechanism', () => {
  describe('computeSizeAlert', () => {
    it('returns null below 120 members', () => {
      expect(computeSizeAlert(119)).toBeNull();
      expect(computeSizeAlert(0)).toBeNull();
    });

    it('returns approaching at exactly 120', () => {
      expect(computeSizeAlert(120)).toBe('approaching');
    });

    it('returns approaching between 120 and 129', () => {
      expect(computeSizeAlert(125)).toBe('approaching');
      expect(computeSizeAlert(129)).toBe('approaching');
    });

    it('returns recommend_split at exactly 130', () => {
      expect(computeSizeAlert(130)).toBe('recommend_split');
    });

    it('returns recommend_split between 130 and 139', () => {
      expect(computeSizeAlert(135)).toBe('recommend_split');
      expect(computeSizeAlert(139)).toBe('recommend_split');
    });

    it('returns urgent_split at exactly 140', () => {
      expect(computeSizeAlert(140)).toBe('urgent_split');
    });

    it('returns urgent_split above 140', () => {
      expect(computeSizeAlert(150)).toBe('urgent_split');
    });
  });

  describe('clusterMembers', () => {
    it('splits members into two balanced groups', () => {
      const members = ['a', 'b', 'c', 'd'];
      const edges: TrustEdge[] = [
        { user_id_a: 'a', user_id_b: 'b', effective_weight: 0.9 },
        { user_id_a: 'a', user_id_b: 'c', effective_weight: 0.8 },
        { user_id_a: 'b', user_id_b: 'c', effective_weight: 0.7 },
      ];
      const result = clusterMembers(members, edges);
      expect(Math.abs(result.groupA.length - result.groupB.length)).toBeLessThanOrEqual(1);
      expect(result.groupA.length + result.groupB.length).toBe(4);
    });

    it('handles members with no trust edges (distributes evenly)', () => {
      const members = ['a', 'b', 'c', 'd'];
      const result = clusterMembers(members, []);
      expect(result.groupA.length).toBe(2);
      expect(result.groupB.length).toBe(2);
      const allMembers = [...result.groupA, ...result.groupB].sort();
      expect(allMembers).toEqual(['a', 'b', 'c', 'd']);
    });

    it('keeps trust-dense subgraphs together', () => {
      // a-b-c are tightly connected; d is isolated from them
      const members = ['a', 'b', 'c', 'd'];
      const edges: TrustEdge[] = [
        { user_id_a: 'a', user_id_b: 'b', effective_weight: 0.95 },
        { user_id_a: 'a', user_id_b: 'c', effective_weight: 0.90 },
        { user_id_a: 'c', user_id_b: 'd', effective_weight: 0.01 },
      ];
      const result = clusterMembers(members, edges);
      // a and b should end up in the same group (very high trust edge between them)
      const aGroup = result.groupA.includes('a') ? 'groupA' : 'groupB';
      const bGroup = result.groupA.includes('b') ? 'groupA' : 'groupB';
      expect(aGroup).toBe(bGroup);
    });

    it('returns correct total membership count', () => {
      const members = ['a', 'b', 'c', 'd', 'e', 'f'];
      const edges: TrustEdge[] = [
        { user_id_a: 'a', user_id_b: 'b', effective_weight: 0.8 },
        { user_id_a: 'c', user_id_b: 'd', effective_weight: 0.8 },
        { user_id_a: 'e', user_id_b: 'f', effective_weight: 0.8 },
      ];
      const result = clusterMembers(members, edges);
      expect(result.groupA.length + result.groupB.length).toBe(6);
      expect(Math.abs(result.groupA.length - result.groupB.length)).toBeLessThanOrEqual(1);
    });

    it('handles a single member edge case', () => {
      const result = clusterMembers(['a'], []);
      expect(result.groupA).toContain('a');
      expect(result.groupB).toHaveLength(0);
    });

    it('handles empty members list', () => {
      const result = clusterMembers([], []);
      expect(result.groupA).toHaveLength(0);
      expect(result.groupB).toHaveLength(0);
    });

    it('ignores edges to non-members', () => {
      const members = ['a', 'b'];
      const edges: TrustEdge[] = [
        { user_id_a: 'a', user_id_b: 'z', effective_weight: 0.9 }, // z is not a member
        { user_id_a: 'a', user_id_b: 'b', effective_weight: 0.5 },
      ];
      const result = clusterMembers(members, edges);
      expect(result.groupA.length + result.groupB.length).toBe(2);
      expect([...result.groupA, ...result.groupB].sort()).toEqual(['a', 'b']);
    });
  });
});
