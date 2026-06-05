/**
 * Sprint 86 follow-up — executeFusion must leave the merged community with a correct
 * member count:
 *   (a) the executing admin is upserted as an active 'admin' member, and
 *   (b) current_members is recomputed from actual membership (previously left at the table
 *       default 0 → merged community rendered "0 members" in the header while the member list
 *       showed everyone). Mirrors the executeSplit guarantees (sprint-78-fission-execute).
 *
 * The pg pool/client is mocked; we assert on the exact SQL the function issues.
 */
import { executeFusion } from '../../src/services/fusionService';

const PROPOSAL_ID = 'fusion-1';
const ADMIN_ID = 'admin-1';
const A_ID = 'comm-a';
const B_ID = 'comm-b';
const MERGED_ID = 'merged-1';

function makeMockPool(calls: Array<{ sql: string; params: any[] }>, proposalStatus = 'approved') {
  const client = {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM communities\.fusion_proposals/i.test(sql)) {
        return { rows: [{ id: PROPOSAL_ID, status: proposalStatus, community_a_id: A_ID, community_b_id: B_ID, merged_community_name: 'Merged' }] };
      }
      if (/SELECT description, location/i.test(sql)) {
        return { rows: [{ description: 'd', location: 'l', category: 'c', community_type: 'mutual_aid', access_type: 'public' }] };
      }
      if (/INSERT INTO communities\.communities/i.test(sql)) {
        return { rows: [{ id: MERGED_ID }] };
      }
      if (/SELECT DISTINCT user_id FROM communities\.members/i.test(sql)) {
        return { rows: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }] };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return { connect: jest.fn(async () => client) } as any;
}

describe('Sprint 86 — executeFusion merged-community finalization', () => {
  it('upserts the executing admin and recomputes current_members for the merged community', async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const pool = makeMockPool(calls);

    const result = await executeFusion(PROPOSAL_ID, ADMIN_ID, pool);
    expect(result).toEqual(expect.objectContaining({ mergedId: MERGED_ID }));

    // Exactly one admin upsert, targeting the merged community with the executing admin.
    const adminUpserts = calls.filter(
      (c) => /INSERT INTO communities\.members/i.test(c.sql) && /role\s*=\s*'admin'/i.test(c.sql)
    );
    expect(adminUpserts).toHaveLength(1);
    expect(adminUpserts[0].params[0]).toBe(MERGED_ID);
    expect(adminUpserts[0].params[1]).toBe(ADMIN_ID);

    // Exactly one current_members recompute, targeting the merged community.
    const recomputes = calls.filter(
      (c) => /UPDATE communities\.communities/i.test(c.sql) && /current_members\s*=\s*\(/i.test(c.sql)
    );
    expect(recomputes).toHaveLength(1);
    expect(recomputes[0].params[0]).toBe(MERGED_ID);
  });

  it('refuses to execute a proposal that is not approved', async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const pool = makeMockPool(calls, 'voting');

    await expect(executeFusion(PROPOSAL_ID, ADMIN_ID, pool)).rejects.toThrow(/approved/i);

    // No merged community should have been created on the rejected path.
    expect(calls.some((c) => /INSERT INTO communities\.communities/i.test(c.sql))).toBe(false);
  });
});
