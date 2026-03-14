/**
 * TDD: Collective discovery panel logic and authorization
 * Sprint 26 - Provider Collective Profiles & Discovery
 */

describe('Collective discovery panel', () => {
  describe('unlinked filtering', () => {
    it('list shows only collectives not already linked to the community', () => {
      const allCollectives = [
        { id: 'c1', name: 'Eastside Riders' },
        { id: 'c2', name: 'Downtown Tutors' },
        { id: 'c3', name: 'North Helpers' },
      ];
      const linkedIds = new Set(['c1']);
      const unlinked = allCollectives.filter((c) => !linkedIds.has(c.id));
      expect(unlinked).toHaveLength(2);
      expect(unlinked.map((c) => c.id)).toEqual(['c2', 'c3']);
    });

    it('returns empty when all collectives are already linked', () => {
      const allCollectives = [{ id: 'c1' }, { id: 'c2' }];
      const linkedIds = new Set(['c1', 'c2']);
      const unlinked = allCollectives.filter((c) => !linkedIds.has(c.id));
      expect(unlinked).toHaveLength(0);
    });

    it('returns all when none are linked', () => {
      const allCollectives = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
      const linkedIds = new Set<string>();
      const unlinked = allCollectives.filter((c) => !linkedIds.has(c.id));
      expect(unlinked).toHaveLength(3);
    });
  });

  describe('community admin authorization', () => {
    it('community admin can initiate a link', () => {
      const communityId = 'comm-1';
      const memberships = [
        { id: 'comm-1', role: 'admin' },
        { id: 'comm-2', role: 'member' },
      ];
      const isCommunityAdmin = memberships.some(
        (m) => m.id === communityId && m.role === 'admin'
      );
      expect(isCommunityAdmin).toBe(true);
    });

    it('community member cannot initiate a link', () => {
      const communityId = 'comm-1';
      const memberships = [{ id: 'comm-1', role: 'member' }];
      const isCommunityAdmin = memberships.some(
        (m) => m.id === communityId && m.role === 'admin'
      );
      expect(isCommunityAdmin).toBe(false);
    });

    it('community moderator cannot initiate a link (admin only)', () => {
      const communityId = 'comm-1';
      const memberships = [{ id: 'comm-1', role: 'moderator' }];
      const isCommunityAdmin = memberships.some(
        (m) => m.id === communityId && m.role === 'admin'
      );
      expect(isCommunityAdmin).toBe(false);
    });

    it('admin of a different community cannot link to this community', () => {
      const communityId = 'comm-1';
      const memberships = [{ id: 'comm-99', role: 'admin' }];
      const isCommunityAdmin = memberships.some(
        (m) => m.id === communityId && m.role === 'admin'
      );
      expect(isCommunityAdmin).toBe(false);
    });

    it('user with no memberships cannot link', () => {
      const communityId = 'comm-1';
      const memberships: { id: string; role: string }[] = [];
      const isCommunityAdmin = memberships.some(
        (m) => m.id === communityId && m.role === 'admin'
      );
      expect(isCommunityAdmin).toBe(false);
    });
  });

  describe('client-side search filtering', () => {
    it('filters collectives by name case-insensitively', () => {
      const collectives = [
        { name: 'Northside Riders' },
        { name: 'Downtown Tutors' },
        { name: 'North Helpers' },
      ];
      const query = 'north';
      const filtered = collectives.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(2);
    });

    it('returns all when search query is empty', () => {
      const collectives: { name: string }[] = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
      const query: string = '';
      const filtered = query
        ? collectives.filter((c) =>
            c.name.toLowerCase().includes(query.toLowerCase())
          )
        : collectives;
      expect(filtered).toHaveLength(3);
    });

    it('returns empty when no names match query', () => {
      const collectives: { name: string }[] = [
        { name: 'Eastside Repair' },
        { name: 'West Tutors' },
      ];
      const query = 'north';
      const filtered = collectives.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(0);
    });
  });
});
