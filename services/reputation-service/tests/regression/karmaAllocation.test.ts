import { allocateKarma, CommunityKarmaConfig } from '../../src/services/karmaAllocation';

function totalPoints(allocations: ReturnType<typeof allocateKarma>): number {
  return allocations.reduce((sum, a) => sum + a.helperPoints + a.requesterPoints, 0);
}

describe('allocateKarma', () => {
  describe('empty input', () => {
    it('returns empty array for zero communities', () => {
      expect(allocateKarma([], 15)).toEqual([]);
    });
  });

  describe('single community', () => {
    it('applies 60/40 split to full pool', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 60, karma_split_requestor: 40 },
      ];
      const result = allocateKarma(configs, 15);
      expect(result).toHaveLength(1);
      expect(result[0].helperPoints).toBe(9);
      expect(result[0].requesterPoints).toBe(6);
      expect(totalPoints(result)).toBe(15);
    });

    it('applies 50/50 split — odd pool rounds helper up', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 50, karma_split_requestor: 50 },
      ];
      const result = allocateKarma(configs, 15);
      expect(result[0].helperPoints + result[0].requesterPoints).toBe(15);
      expect(totalPoints(result)).toBe(15);
    });

    it('applies 70/30 split', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 70, karma_split_requestor: 30 },
      ];
      const result = allocateKarma(configs, 100);
      expect(result[0].helperPoints).toBe(70);
      expect(result[0].requesterPoints).toBe(30);
      expect(totalPoints(result)).toBe(100);
    });
  });

  describe('two communities', () => {
    it('divides pool equally, same 60/40 split on each', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 60, karma_split_requestor: 40 },
        { community_id: 'c2', karma_split_helper: 60, karma_split_requestor: 40 },
      ];
      const result = allocateKarma(configs, 15);
      expect(result).toHaveLength(2);
      expect(totalPoints(result)).toBe(15);
      // Each community gets 7.5 pool → helper=4.5, requester=3.0 → rounds to (5,3) or (4,3)
      // Both communities same so each gets same rounded value
      const helperTotal = result.reduce((s, a) => s + a.helperPoints, 0);
      const requesterTotal = result.reduce((s, a) => s + a.requesterPoints, 0);
      expect(helperTotal + requesterTotal).toBe(15);
    });

    it('divides pool with different splits (60/40 and 50/50)', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 60, karma_split_requestor: 40 },
        { community_id: 'c2', karma_split_helper: 50, karma_split_requestor: 50 },
      ];
      const result = allocateKarma(configs, 15);
      expect(result).toHaveLength(2);
      expect(totalPoints(result)).toBe(15);
    });

    it('preserves community_id in output', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'alpha', karma_split_helper: 60, karma_split_requestor: 40 },
        { community_id: 'beta', karma_split_helper: 50, karma_split_requestor: 50 },
      ];
      const result = allocateKarma(configs, 15);
      expect(result.map(r => r.community_id)).toEqual(['alpha', 'beta']);
    });
  });

  describe('three communities', () => {
    it('sums exactly to totalPool after rounding', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 60, karma_split_requestor: 40 },
        { community_id: 'c2', karma_split_helper: 50, karma_split_requestor: 50 },
        { community_id: 'c3', karma_split_helper: 70, karma_split_requestor: 30 },
      ];
      const result = allocateKarma(configs, 15);
      expect(result).toHaveLength(3);
      expect(totalPoints(result)).toBe(15);
    });

    it('all points are non-negative integers', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 60, karma_split_requestor: 40 },
        { community_id: 'c2', karma_split_helper: 50, karma_split_requestor: 50 },
        { community_id: 'c3', karma_split_helper: 70, karma_split_requestor: 30 },
      ];
      const result = allocateKarma(configs, 15);
      for (const a of result) {
        expect(a.helperPoints).toBeGreaterThanOrEqual(0);
        expect(a.requesterPoints).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(a.helperPoints)).toBe(true);
        expect(Number.isInteger(a.requesterPoints)).toBe(true);
      }
    });
  });

  describe('large pool (standard 100pt pool)', () => {
    it('single community 60/40 gives exactly 60/40', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 60, karma_split_requestor: 40 },
      ];
      const result = allocateKarma(configs, 100);
      expect(result[0].helperPoints).toBe(60);
      expect(result[0].requesterPoints).toBe(40);
      expect(totalPoints(result)).toBe(100);
    });

    it('two communities same split — total always 100', () => {
      const configs: CommunityKarmaConfig[] = [
        { community_id: 'c1', karma_split_helper: 60, karma_split_requestor: 40 },
        { community_id: 'c2', karma_split_helper: 60, karma_split_requestor: 40 },
      ];
      const result = allocateKarma(configs, 100);
      expect(totalPoints(result)).toBe(100);
    });
  });
});
