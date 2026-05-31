/**
 * Sprint 78 — executeSplit must leave both child communities usable:
 *   (a) each child gets the executing admin as an active 'admin' member, and
 *   (b) each child's current_members is recomputed from actual membership
 *       (previously left at the table default 0, so children rendered empty).
 *
 * The pg pool/client is mocked; we assert on the exact SQL the function issues.
 */
import { executeSplit } from '../../src/services/fissionService';

const PROPOSAL_ID = 'prop-1';
const ADMIN_ID = 'admin-1';
const COMMUNITY_ID = 'parent-1';
const CHILD_A = 'child-a';
const CHILD_B = 'child-b';

function makeMockPool(calls: Array<{ sql: string; params: any[] }>, proposalStatus = 'approved') {
  let childInsertCount = 0;
  const client = {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM communities\.split_proposals/i.test(sql)) {
        return { rows: [{ id: PROPOSAL_ID, status: proposalStatus, community_id: COMMUNITY_ID, group_a_name: 'A', group_b_name: 'B' }] };
      }
      if (/SELECT id FROM communities\.members/i.test(sql)) {
        return { rows: [{ id: 'm-admin' }] }; // admin is a member of parent
      }
      if (/SELECT name, description, location/i.test(sql)) {
        return { rows: [{ name: 'Parent', description: 'd', location: 'l', category: 'c', community_type: 'mutual_aid', access_type: 'public' }] };
      }
      if (/SELECT user_id, assigned_to FROM communities\.split_member_assignments/i.test(sql)) {
        return { rows: [{ user_id: 'u1', assigned_to: 'group_a' }, { user_id: 'u2', assigned_to: 'group_b' }] };
      }
      if (/INSERT INTO communities\.communities/i.test(sql)) {
        childInsertCount += 1;
        return { rows: [{ id: childInsertCount === 1 ? CHILD_A : CHILD_B }] };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return { connect: jest.fn(async () => client) } as any;
}

describe('Sprint 78 — executeSplit child finalization', () => {
  it('promotes the executing admin to admin and recomputes current_members for BOTH children', async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const pool = makeMockPool(calls);

    const result = await executeSplit(PROPOSAL_ID, ADMIN_ID, pool);
    expect(result).toEqual({ childAId: CHILD_A, childBId: CHILD_B });

    const adminUpserts = calls.filter(
      (c) => /INSERT INTO communities\.members/i.test(c.sql) && /role\s*=\s*'admin'/i.test(c.sql)
    );
    // One admin upsert per child, targeting each child id with the admin user.
    expect(adminUpserts).toHaveLength(2);
    const upsertedChildIds = adminUpserts.map((c) => c.params[0]).sort();
    expect(upsertedChildIds).toEqual([CHILD_A, CHILD_B].sort());
    adminUpserts.forEach((c) => expect(c.params[1]).toBe(ADMIN_ID));

    const recomputes = calls.filter(
      (c) => /UPDATE communities\.communities/i.test(c.sql) && /current_members\s*=\s*\(/i.test(c.sql)
    );
    expect(recomputes).toHaveLength(2);
    expect(recomputes.map((c) => c.params[0]).sort()).toEqual([CHILD_A, CHILD_B].sort());
  });

  it('refuses to execute a proposal that is not approved', async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const pool = makeMockPool(calls, 'voting');

    await expect(executeSplit(PROPOSAL_ID, ADMIN_ID, pool)).rejects.toThrow(/approved/i);

    // No child communities should have been created on the rejected path.
    expect(calls.some((c) => /INSERT INTO communities\.communities/i.test(c.sql))).toBe(false);
  });
});
