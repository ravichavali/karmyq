import { clusterMembers, computeSizeAlert, TrustEdge } from '../../src/services/fissionService';

describe('Sprint 69 — Fission Mechanism', () => {
  describe('computeSizeAlert', () => {
    it('returns null below 120 members', () => {
      expect(computeSizeAlert(0)).toBeNull();
      expect(computeSizeAlert(119)).toBeNull();
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
      expect(computeSizeAlert(200)).toBe('urgent_split');
    });
  });

  describe('clusterMembers', () => {
    it('returns empty groups for empty member list', () => {
      const result = clusterMembers([], []);
      expect(result.groupA).toHaveLength(0);
      expect(result.groupB).toHaveLength(0);
    });

    it('puts single member in groupA', () => {
      const result = clusterMembers(['user-1'], []);
      expect(result.groupA).toEqual(['user-1']);
      expect(result.groupB).toHaveLength(0);
    });

    it('splits two members with no edges into balanced groups', () => {
      const result = clusterMembers(['user-1', 'user-2'], []);
      expect(result.groupA).toHaveLength(1);
      expect(result.groupB).toHaveLength(1);
      const all = [...result.groupA, ...result.groupB].sort();
      expect(all).toEqual(['user-1', 'user-2']);
    });

    it('produces balanced groups for even member count', () => {
      const members = ['u1', 'u2', 'u3', 'u4'];
      const result = clusterMembers(members, []);
      expect(result.groupA).toHaveLength(2);
      expect(result.groupB).toHaveLength(2);
    });

    it('produces balanced groups for odd member count (off by 1)', () => {
      const members = ['u1', 'u2', 'u3', 'u4', 'u5'];
      const result = clusterMembers(members, []);
      const diff = Math.abs(result.groupA.length - result.groupB.length);
      expect(diff).toBeLessThanOrEqual(1);
    });

    it('seeds the highest-trust-degree members into the larger initial group', () => {
      // u1, u2, u3 form a tight cluster (degree ~20 each)
      // u4, u5 form a smaller cluster (degree ~10 each)
      // With 5 members, top-3 by degree seed into groupA — all from the tight cluster
      const members = ['u1', 'u2', 'u3', 'u4', 'u5'];
      const edges: TrustEdge[] = [
        { user_id_a: 'u1', user_id_b: 'u2', effective_weight: 10 },
        { user_id_a: 'u2', user_id_b: 'u3', effective_weight: 10 },
        { user_id_a: 'u1', user_id_b: 'u3', effective_weight: 10 },
        { user_id_a: 'u4', user_id_b: 'u5', effective_weight: 10 },
        { user_id_a: 'u1', user_id_b: 'u4', effective_weight: 0.1 },
      ];
      const result = clusterMembers(members, edges);
      // Top-3 degree nodes (u1, u2, u3) all seed into groupA
      const groupASet = new Set(result.groupA);
      expect(groupASet.has('u1')).toBe(true);
      expect(groupASet.has('u2')).toBe(true);
      expect(groupASet.has('u3')).toBe(true);
    });

    it('covers all members with no duplicates', () => {
      const members = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
      const edges: TrustEdge[] = [
        { user_id_a: 'u1', user_id_b: 'u2', effective_weight: 5 },
        { user_id_a: 'u3', user_id_b: 'u4', effective_weight: 3 },
      ];
      const result = clusterMembers(members, edges);
      const all = [...result.groupA, ...result.groupB].sort();
      expect(all).toEqual([...members].sort());
    });
  });
});
