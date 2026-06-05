import { Pool } from 'pg';

const TRUST_CARRY_FACTOR = 0.70;

export async function executeFusion(proposalId: string, adminId: string, pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock and validate proposal
    const proposalRes = await client.query(
      `SELECT * FROM communities.fusion_proposals WHERE id = $1 FOR UPDATE`,
      [proposalId]
    );
    const proposal = proposalRes.rows[0];
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'approved') throw new Error('Proposal must be in approved status');

    const { community_a_id: aId, community_b_id: bId } = proposal;

    // 2. Get community A attributes for merged community
    const parentRes = await client.query(
      `SELECT description, location, category, community_type, access_type FROM communities.communities WHERE id = $1`,
      [aId]
    );
    const parent = parentRes.rows[0];

    // 3. Create merged community
    const mergedRes = await client.query(
      `INSERT INTO communities.communities
         (name, description, location, category, community_type, access_type, creator_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id`,
      [proposal.merged_community_name, parent.description, parent.location, parent.category,
       parent.community_type, parent.access_type, adminId]
    );
    const mergedId = mergedRes.rows[0].id;

    // 4. Collect all active members from both communities
    const membersRes = await client.query(
      `SELECT DISTINCT user_id FROM communities.members
       WHERE community_id = ANY($1) AND status = 'active'`,
      [[aId, bId]]
    );
    const memberIds: string[] = membersRes.rows.map((r: any) => r.user_id);

    // 5. Add all members to merged community
    for (const uid of memberIds) {
      await client.query(
        `INSERT INTO communities.members (community_id, user_id, role, status)
         VALUES ($1, $2, 'member', 'active')
         ON CONFLICT (community_id, user_id) DO NOTHING`,
        [mergedId, uid]
      );
    }

    // 5b. Ensure the executing admin administers the merged community, and set the denormalized
    //     current_members to match the actual active membership. Without the recompute the merged
    //     community is created with current_members at the table default (0) — so the header shows
    //     "0 members" while the member list shows everyone (mirror of executeSplit, fissionService).
    await client.query(
      `INSERT INTO communities.members (community_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active')
       ON CONFLICT (community_id, user_id)
       DO UPDATE SET role = 'admin', status = 'active'`,
      [mergedId, adminId]
    );
    await client.query(
      `UPDATE communities.communities c
       SET current_members = (
         SELECT count(*) FROM communities.members m
         WHERE m.community_id = c.id AND m.status = 'active'
       )
       WHERE c.id = $1`,
      [mergedId]
    );

    // 6. Copy trust edges (raw_weight × carry factor; stability carried as-is — it's the bond's
    //    decay-resistance, not its strength — so trust_edges_live decay math is preserved).
    const edgesRes = await client.query(
      `SELECT user_id_a, user_id_b, raw_weight, stability
       FROM social_graph.trust_edges
       WHERE community_id = ANY($1)`,
      [[aId, bId]]
    );
    for (const edge of edgesRes.rows) {
      const [ua, ub] = [edge.user_id_a, edge.user_id_b].sort(); // enforce normalization
      await client.query(
        `INSERT INTO social_graph.trust_edges
           (user_id_a, user_id_b, community_id, raw_weight, stability, last_interaction_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id_a, user_id_b, community_id) DO NOTHING`,
        [ua, ub, mergedId, Math.round(parseFloat(edge.raw_weight) * TRUST_CARRY_FACTOR * 100) / 100, edge.stability]
      );
    }

    // 7. Copy karma records from both communities
    await client.query(
      `INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
       SELECT user_id, $1, points, reason, related_entity_id, created_at
       FROM reputation.karma_records
       WHERE community_id = ANY($2)`,
      [mergedId, [aId, bId]]
    );

    // 8. Create fusion_origin community_links (merged↔A and merged↔B)
    await client.query(
      `INSERT INTO communities.community_links
         (community_a_id, community_b_id, link_type, trust_carry_factor, created_by_admin_a, created_by_admin_b, status)
       VALUES ($1, $2, 'fusion_origin', $3, $4, $4, 'active')`,
      [mergedId, aId, TRUST_CARRY_FACTOR, adminId]
    );
    await client.query(
      `INSERT INTO communities.community_links
         (community_a_id, community_b_id, link_type, trust_carry_factor, created_by_admin_a, created_by_admin_b, status)
       VALUES ($1, $2, 'fusion_origin', $3, $4, $4, 'active')`,
      [mergedId, bId, TRUST_CARRY_FACTOR, adminId]
    );

    // 9. Mark proposal executed
    await client.query(
      `UPDATE communities.fusion_proposals
       SET status = 'executed', executed_at = NOW(), merged_community_id = $1
       WHERE id = $2`,
      [mergedId, proposalId]
    );

    // 10. Archive both parent communities
    await client.query(
      `UPDATE communities.communities SET status = 'merged' WHERE id = ANY($1)`,
      [[aId, bId]]
    );

    await client.query('COMMIT');
    return { mergedId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
