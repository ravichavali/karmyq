/**
 * Sprint 100 / BUG-010 (G2) — a community must be splittable more than once (integration).
 *
 * The bug: `communities.split_proposals` had `UNIQUE (community_id, status)`, which permits at most
 * ONE proposal per status per community for all time — including the terminal 'executed' status. So
 * executeSplit's final `UPDATE … SET status = 'executed'` collided (23505) with a prior executed
 * proposal, rolling the whole split back → the API returned 500 "Failed to execute split". Live repro:
 * community 446c2c65… had an executed split (2026-06-01) and an approved one (2026-06-08) that could
 * never execute.
 *
 * The fix (migration 20260615-split-proposal-active-unique.sql) replaces the full constraint with a
 * PARTIAL unique index over ACTIVE statuses only:
 *   UNIQUE (community_id) WHERE status NOT IN ('executed','rejected')
 * so any number of terminal proposals may exist over time, while two concurrent in-flight proposals
 * are still blocked.
 *
 * This test reproduces the exact constraint behaviour directly at the DB layer (the mocked fission
 * unit tests cannot — a mock pool doesn't enforce constraints). DB-backed: runs in CI / the deploy
 * integration step (the migration must be applied); fails on connection locally without a DB.
 */

import pool from '../../src/database/db';

describe('Sprint 100 BUG-010: split_proposals active-only uniqueness (integration)', () => {
  let communityId: string;
  const proposalIds: string[] = [];

  async function insertProposal(status: string): Promise<string> {
    const res = await pool.query(
      `INSERT INTO communities.split_proposals
         (community_id, proposed_by, split_type, rationale, group_a_name, group_b_name, status)
       VALUES ($1, $1, 'admin_initiated', 's100 g2', 'A', 'B', $2)
       RETURNING id`,
      [communityId, status],
    );
    proposalIds.push(res.rows[0].id);
    return res.rows[0].id;
  }

  beforeAll(async () => {
    communityId = (
      await pool.query(`INSERT INTO communities.communities (name, description) VALUES ($1,$2) RETURNING id`, ['S100 Re-split Community', 's100 g2'])
    ).rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM communities.split_proposals WHERE community_id = $1`, [communityId]).catch(() => {});
    await pool.query(`DELETE FROM communities.communities WHERE id = $1`, [communityId]).catch(() => {});
    await pool.end().catch(() => {});
  });

  it('allows a SECOND executed proposal for the same community (the BUG-010 collision is gone)', async () => {
    // First split already executed historically.
    await insertProposal('executed');

    // A second proposal reaches 'executed' — under the old full unique constraint this threw 23505.
    await expect(insertProposal('executed')).resolves.toBeTruthy();

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM communities.split_proposals WHERE community_id = $1 AND status = 'executed'`,
      [communityId],
    );
    expect(rows[0].n).toBe(2);
  });

  it('still blocks a SECOND concurrent ACTIVE proposal for the same community (preserves create-409)', async () => {
    await insertProposal('discussion');
    // A second active (in-flight) proposal must still violate the partial unique index.
    await expect(insertProposal('discussion')).rejects.toMatchObject({ code: '23505' });
  });
});
