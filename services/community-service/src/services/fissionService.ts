import { Pool } from 'pg';

export interface TrustEdge {
  user_id_a: string;
  user_id_b: string;
  effective_weight: number;
}

export interface ClusterResult {
  groupA: string[];
  groupB: string[];
}

// Pure function — testable without DB
export function computeSizeAlert(memberCount: number): string | null {
  if (memberCount >= 140) return 'urgent_split';
  if (memberCount >= 130) return 'recommend_split';
  if (memberCount >= 120) return 'approaching';
  return null;
}

// Pure function — testable without DB
export function clusterMembers(members: string[], edges: TrustEdge[]): ClusterResult {
  if (members.length === 0) return { groupA: [], groupB: [] };
  if (members.length === 1) return { groupA: members, groupB: [] };

  // Build adjacency: total trust degree per member
  const degree = new Map<string, number>();
  for (const m of members) degree.set(m, 0);

  for (const e of edges) {
    if (degree.has(e.user_id_a) && degree.has(e.user_id_b)) {
      degree.set(e.user_id_a, (degree.get(e.user_id_a) ?? 0) + e.effective_weight);
      degree.set(e.user_id_b, (degree.get(e.user_id_b) ?? 0) + e.effective_weight);
    }
  }

  // Sort by degree descending; members with no edges go last
  const sorted = [...members].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0));
  const half = Math.ceil(sorted.length / 2);

  const groupA = new Set<string>(sorted.slice(0, half));
  const groupB = new Set<string>(sorted.slice(half));

  // Build edge weight lookup
  const edgeWeight = (a: string, b: string): number => {
    let w = 0;
    for (const e of edges) {
      if ((e.user_id_a === a && e.user_id_b === b) || (e.user_id_a === b && e.user_id_b === a)) {
        w += e.effective_weight;
      }
    }
    return w;
  };

  const trustToGroup = (member: string, group: Set<string>): number => {
    let total = 0;
    for (const other of group) {
      if (other !== member) total += edgeWeight(member, other);
    }
    return total;
  };

  // Iterative improvement: up to 10 passes
  // Balance check: after the swap, |newA.size - newB.size| must be <= 1
  for (let pass = 0; pass < 10; pass++) {
    let swapped = false;
    for (const member of [...groupA]) {
      const toSame = trustToGroup(member, groupA);
      const toOther = trustToGroup(member, groupB);
      // After moving member from A to B: newA = size-1, newB = size+1
      const balanced = Math.abs((groupA.size - 1) - (groupB.size + 1)) <= 1;
      if (toOther > toSame && balanced) {
        groupA.delete(member);
        groupB.add(member);
        swapped = true;
      }
    }
    for (const member of [...groupB]) {
      const toSame = trustToGroup(member, groupB);
      const toOther = trustToGroup(member, groupA);
      // After moving member from B to A: newA = size+1, newB = size-1
      const balanced = Math.abs((groupA.size + 1) - (groupB.size - 1)) <= 1;
      if (toOther > toSame && balanced) {
        groupB.delete(member);
        groupA.add(member);
        swapped = true;
      }
    }
    if (!swapped) break;
  }

  return { groupA: [...groupA], groupB: [...groupB] };
}

export async function clusterCommunityMembers(
  communityId: string,
  pool: Pool
): Promise<ClusterResult> {
  const membersRes = await pool.query(
    `SELECT user_id FROM communities.members WHERE community_id = $1 AND status = 'active'`,
    [communityId]
  );
  const members: string[] = membersRes.rows.map((r: any) => r.user_id);

  const edgesRes = await pool.query(
    `SELECT user_id_a, user_id_b, current_weight AS effective_weight
     FROM social_graph.trust_edges_live
     WHERE community_id = $1
       AND user_id_a = ANY($2::uuid[])
       AND user_id_b = ANY($2::uuid[])`,
    [communityId, members]
  );
  const edges: TrustEdge[] = edgesRes.rows;

  return clusterMembers(members, edges);
}

export async function executeSplit(
  splitId: string,
  adminId: string,
  pool: Pool
): Promise<{ childAId: string; childBId: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and validate proposal
    const propRes = await client.query(
      `SELECT * FROM communities.split_proposals WHERE id = $1 FOR UPDATE`,
      [splitId]
    );
    const proposal = propRes.rows[0];
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'approved') throw new Error('Proposal must be in approved status');

    const communityId = proposal.community_id;

    // Verify admin is member of parent community
    const memberCheck = await client.query(
      `SELECT id FROM communities.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, adminId]
    );
    if (!memberCheck.rows.length) throw new Error('Admin is not an active member of this community');

    // 2. Get parent community info
    const parentRes = await client.query(
      `SELECT name, description, location, category, community_type, access_type FROM communities.communities WHERE id = $1`,
      [communityId]
    );
    const parent = parentRes.rows[0];

    // 3. Auto-assign unassigned members to the smaller group
    const assignRes = await client.query(
      `SELECT user_id, assigned_to FROM communities.split_member_assignments WHERE proposal_id = $1`,
      [splitId]
    );
    const groupACnt = assignRes.rows.filter((r: any) => r.assigned_to === 'group_a').length;
    const groupBCnt = assignRes.rows.filter((r: any) => r.assigned_to === 'group_b').length;
    const defaultGroup = groupACnt <= groupBCnt ? 'group_a' : 'group_b';
    await client.query(
      `UPDATE communities.split_member_assignments
       SET assigned_to = $1
       WHERE proposal_id = $2 AND assigned_to = 'unassigned'`,
      [defaultGroup, splitId]
    );

    // 4. Create child community A
    const childARes = await client.query(
      `INSERT INTO communities.communities (name, description, location, category, community_type, access_type, creator_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id`,
      [proposal.group_a_name, parent.description, parent.location, parent.category, parent.community_type, parent.access_type, adminId]
    );
    const childAId = childARes.rows[0].id;

    // 5. Create child community B
    const childBRes = await client.query(
      `INSERT INTO communities.communities (name, description, location, category, community_type, access_type, creator_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id`,
      [proposal.group_b_name, parent.description, parent.location, parent.category, parent.community_type, parent.access_type, adminId]
    );
    const childBId = childBRes.rows[0].id;

    // 6. Move members to child communities
    const finalAssignments = await client.query(
      `SELECT user_id, assigned_to FROM communities.split_member_assignments WHERE proposal_id = $1`,
      [splitId]
    );
    for (const row of finalAssignments.rows) {
      const targetId = row.assigned_to === 'group_a' ? childAId : childBId;
      await client.query(
        `INSERT INTO communities.members (community_id, user_id, role, status)
         VALUES ($1, $2, 'member', 'active')
         ON CONFLICT (community_id, user_id) DO NOTHING`,
        [targetId, row.user_id]
      );
    }

    // The members assigned to each child — used to carry their existing bonds + karma forward.
    const groupA = finalAssignments.rows.filter((r: any) => r.assigned_to === 'group_a').map((r: any) => r.user_id);
    const groupB = finalAssignments.rows.filter((r: any) => r.assigned_to === 'group_b').map((r: any) => r.user_id);

    // 6b. Finalize each child: promote the executing admin, recompute current_members, and CARRY the
    //     members' existing relationships forward. executeSplit previously moved members but left their
    //     trust edges + karma under the (now 'split') parent community_id, so each child started at 0 —
    //     defeating the whole point of clustering on strong bonds. We now copy, per child:
    //       • within-group trust edges at FULL strength (the relationship is intact; the split just
    //         relabels the container). Cross-group trust still flows via the split_origin link (0.40).
    //       • karma records, so reputation doesn't reset on a split.
    for (const [childId, group] of [[childAId, groupA], [childBId, groupB]] as const) {
      await client.query(
        `INSERT INTO communities.members (community_id, user_id, role, status)
         VALUES ($1, $2, 'admin', 'active')
         ON CONFLICT (community_id, user_id)
         DO UPDATE SET role = 'admin', status = 'active'`,
        [childId, adminId]
      );
      await client.query(
        `UPDATE communities.communities c
         SET current_members = (
           SELECT count(*) FROM communities.members m
           WHERE m.community_id = c.id AND m.status = 'active'
         )
         WHERE c.id = $1`,
        [childId]
      );

      if (group.length > 0) {
        // Within-group trust edges → child, full weight (both endpoints stayed together).
        await client.query(
          `INSERT INTO social_graph.trust_edges
             (user_id_a, user_id_b, community_id, match_completed_count, endorsement_count,
              karma_given_count, event_count, raw_weight, last_interaction_at)
           SELECT user_id_a, user_id_b, $1, match_completed_count, endorsement_count,
                  karma_given_count, event_count, raw_weight, last_interaction_at
           FROM social_graph.trust_edges
           WHERE community_id = $2 AND user_id_a = ANY($3::uuid[]) AND user_id_b = ANY($3::uuid[])
           ON CONFLICT (user_id_a, user_id_b, community_id) DO NOTHING`,
          [childId, communityId, group]
        );
        // Karma records → child, so members don't restart at 0.
        await client.query(
          `INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
           SELECT user_id, $1, points, reason, related_entity_id, created_at
           FROM reputation.karma_records
           WHERE community_id = $2 AND user_id = ANY($3::uuid[])`,
          [childId, communityId, group]
        );
      }
    }

    // 7. Create split_origin community link between siblings
    await client.query(
      `INSERT INTO communities.community_links
         (community_a_id, community_b_id, link_type, trust_carry_factor, created_by_admin_a, created_by_admin_b, status)
       VALUES ($1, $2, 'split_origin', 0.40, $3, $3, 'active')`,
      [childAId, childBId, adminId]
    );

    // 8. Mark proposal as executed
    await client.query(
      `UPDATE communities.split_proposals
       SET status = 'executed', executed_at = NOW(), child_community_a_id = $1, child_community_b_id = $2
       WHERE id = $3`,
      [childAId, childBId, splitId]
    );

    // 9. Mark parent as split (not deleted — history stays)
    await client.query(
      `UPDATE communities.communities SET status = 'split' WHERE id = $1`,
      [communityId]
    );

    await client.query('COMMIT');
    return { childAId, childBId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
