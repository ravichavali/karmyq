import pool from './db';

export interface GovernanceSettings {
  eligibility_threshold: number;
  quorum_size: number;
  template: string;
}

export interface GovernanceNomination {
  id: string;
  nominated_user: { user_id: string; name: string };
  role: string;
  nominator: { user_id: string; name: string };
  ratification_count: number;
  required_ratifications: number;
  status: string;
  ratifiers: Array<{ user_id: string; name: string }>;
}

export async function getGovernanceState(communityId: string) {
  const settingsRes = await pool.query(
    `SELECT governance_settings FROM communities.communities WHERE id = $1`,
    [communityId]
  );
  const settings: GovernanceSettings = settingsRes.rows[0]?.governance_settings ??
    { eligibility_threshold: 50, quorum_size: 3, template: 'small-collective' };

  // Trust maturity: avg raw_weight of active edges in the community
  const maturityRes = await pool.query(`
    SELECT AVG(te.raw_weight) AS avg_trust
    FROM social_graph.trust_edges te
    JOIN communities.members cm_a ON cm_a.user_id = te.user_id_a AND cm_a.community_id = $1 AND cm_a.status = 'active'
    JOIN communities.members cm_b ON cm_b.user_id = te.user_id_b AND cm_b.community_id = $1 AND cm_b.status = 'active'
    WHERE te.community_id = $1
  `, [communityId]);
  const avgTrust = parseFloat(maturityRes.rows[0]?.avg_trust) || 0;
  const maturity = {
    status: avgTrust >= settings.eligibility_threshold ? 'mature' : 'constrained',
    avg_trust_score: Math.round(avgTrust * 10) / 10,
    threshold: settings.eligibility_threshold,
  };

  // Eligible members: active community members whose total trust raw_weight >= threshold
  const eligibleRes = await pool.query(`
    SELECT u.id AS user_id, u.name,
           COALESCE(SUM(te.raw_weight), 0) AS trust_score,
           COALESCE(SUM(kr.points), 0) AS karma
    FROM auth.users u
    JOIN communities.members cm ON cm.user_id = u.id AND cm.community_id = $1 AND cm.status = 'active'
    LEFT JOIN social_graph.trust_edges te ON (te.user_id_a = u.id OR te.user_id_b = u.id)
      AND te.community_id = $1
    LEFT JOIN reputation.karma_records kr ON kr.user_id = u.id AND kr.community_id = $1
    GROUP BY u.id, u.name
    HAVING COALESCE(SUM(te.raw_weight), 0) >= $2
  `, [communityId, settings.eligibility_threshold]);

  // Pending nominations with ratification counts
  const nominationsRes = await pool.query(`
    SELECT n.id, n.nominated_for_role AS role, n.status,
           n.required_ratifications, n.created_at,
           nu.id AS nominated_user_id, nu.name AS nominated_user_name,
           nom.id AS nominator_id, nom.name AS nominator_name,
           COUNT(r.ratifier_id) AS ratification_count
    FROM communities.governance_nominations n
    JOIN auth.users nu ON nu.id = n.nominated_user_id
    JOIN auth.users nom ON nom.id = n.nominator_id
    LEFT JOIN communities.governance_ratifications r ON r.nomination_id = n.id
    WHERE n.community_id = $1 AND n.status = 'pending'
    GROUP BY n.id, nu.id, nu.name, nom.id, nom.name
    ORDER BY n.created_at DESC
  `, [communityId]);

  const nominations: GovernanceNomination[] = await Promise.all(
    nominationsRes.rows.map(async (row) => {
      const ratifiersRes = await pool.query(`
        SELECT u.id AS user_id, u.name
        FROM communities.governance_ratifications r
        JOIN auth.users u ON u.id = r.ratifier_id
        WHERE r.nomination_id = $1
      `, [row.id]);
      return {
        id: row.id,
        nominated_user: { user_id: row.nominated_user_id, name: row.nominated_user_name },
        role: row.role,
        nominator: { user_id: row.nominator_id, name: row.nominator_name },
        ratification_count: parseInt(row.ratification_count),
        required_ratifications: row.required_ratifications,
        status: row.status,
        ratifiers: ratifiersRes.rows,
      };
    })
  );

  // Current governance role holders
  const roleHoldersRes = await pool.query(`
    SELECT u.id AS user_id, u.name, cm.role,
           COALESCE(SUM(te.raw_weight), 0) AS trust_score
    FROM communities.members cm
    JOIN auth.users u ON u.id = cm.user_id
    LEFT JOIN social_graph.trust_edges te ON (te.user_id_a = u.id OR te.user_id_b = u.id)
      AND te.community_id = $1
    WHERE cm.community_id = $1 AND cm.role IN ('admin', 'moderator') AND cm.status = 'active'
    GROUP BY u.id, u.name, cm.role
  `, [communityId]);

  return {
    settings,
    maturity,
    eligible_members: eligibleRes.rows,
    nominations,
    role_holders: roleHoldersRes.rows,
  };
}

export async function createNomination(
  communityId: string,
  nominatorId: string,
  nominatedUserId: string,
  role: string,
  quorumSize: number
): Promise<{ id: string }> {
  const existing = await pool.query(`
    SELECT id FROM communities.governance_nominations
    WHERE community_id = $1 AND nominated_user_id = $2 AND nominated_for_role = $3 AND status = 'pending'
  `, [communityId, nominatedUserId, role]);
  if (existing.rows.length > 0) throw new Error('DUPLICATE_NOMINATION');

  const res = await pool.query(`
    INSERT INTO communities.governance_nominations
      (community_id, nominated_user_id, nominated_for_role, nominator_id, required_ratifications)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [communityId, nominatedUserId, role, nominatorId, quorumSize]);
  return { id: res.rows[0].id };
}

export async function addRatification(
  nominationId: string,
  ratifierId: string
): Promise<{ ratified: boolean; ratification_count: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO communities.governance_ratifications (nomination_id, ratifier_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [nominationId, ratifierId]);

    const countRes = await client.query(`
      SELECT n.required_ratifications, COUNT(r.ratifier_id) AS count,
             n.nominated_user_id, n.nominated_for_role, n.community_id
      FROM communities.governance_nominations n
      LEFT JOIN communities.governance_ratifications r ON r.nomination_id = n.id
      WHERE n.id = $1
      GROUP BY n.id, n.required_ratifications, n.nominated_user_id, n.nominated_for_role, n.community_id
    `, [nominationId]);
    const row = countRes.rows[0];
    const ratificationCount = parseInt(row.count);

    let ratified = false;
    if (ratificationCount >= parseInt(row.required_ratifications)) {
      await client.query(`
        UPDATE communities.members SET role = $1
        WHERE user_id = $2 AND community_id = $3
      `, [row.nominated_for_role, row.nominated_user_id, row.community_id]);

      await client.query(`
        UPDATE communities.governance_nominations
        SET status = 'ratified', resolved_at = NOW()
        WHERE id = $1
      `, [nominationId]);
      ratified = true;
    }

    await client.query('COMMIT');
    return { ratified, ratification_count: ratificationCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
