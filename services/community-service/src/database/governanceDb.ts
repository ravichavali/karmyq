import pool from './db';
import { PoolClient } from 'pg';
import { GOVERNANCE_QUORUM_POLICY, requiredRatifications, canElevateRole, GovernanceError } from './governancePolicy';

export interface GovernanceSettings {
  eligibility_threshold: number;
  template: string;
  quorum_policy: typeof GOVERNANCE_QUORUM_POLICY;
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
  electorate_size: number;
  quorum_policy_version: 1;
  viewer: { can_ratify: boolean; reason: 'eligible' | 'nominee' | 'already_ratified' | 'not_in_electorate' };
}

export interface GovernanceState {
  settings: GovernanceSettings;
  can_nominate: boolean;
  maturity: { status: string; avg_trust_score: number; threshold: number };
  eligible_members: Array<{ user_id: string; name: string; eligible: true; eligibility_reason: 'established_community_relationships' }>;
  nominations: GovernanceNomination[];
  role_holders: Array<{ user_id: string; name: string; role: string }>;
}

export async function getGovernanceState(rawCommunityId: string, rawViewerId: string): Promise<GovernanceState> {
  const communityId = rawCommunityId.toLowerCase();
  const viewerId = rawViewerId.toLowerCase();
  return governanceTransaction(communityId,viewerId,async client => {
    const membership = await client.query(`SELECT m.status, (SELECT count(*)::int FROM communities.members active
      WHERE active.community_id=$1 AND active.status='active') AS active_member_count
      FROM communities.members m WHERE m.community_id=$1 AND m.user_id=$2 FOR SHARE OF m`, [communityId,viewerId]);
    if (membership.rows[0]?.status !== 'active') throw new GovernanceError(403,'FORBIDDEN','Must be an active community member.');
    const settingsRes = await client.query(`SELECT governance_settings FROM communities.communities WHERE id=$1`, [communityId]);
    if (!settingsRes.rows.length) throw new GovernanceError(404,'NOT_FOUND','Community not found.');
    const rawSettings = settingsRes.rows[0].governance_settings;
    const settings: GovernanceSettings = {
      eligibility_threshold: eligibilityThreshold(rawSettings),
      template: typeof rawSettings?.template === 'string' ? rawSettings.template : 'small-collective',
      quorum_policy: GOVERNANCE_QUORUM_POLICY,
    };

    // Trust maturity: avg raw_weight of active edges in the community
    const maturityRes = await client.query(`
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

    // Eligible members: active community members whose total trust raw_weight >= threshold. The
    // threshold comparison stays in SQL (internal eligibility calculation), but Sprint 112 (ADR-082)
    // projects each row to identity + a coarse eligibility reason only — no member trust_score/karma
    // leaves the boundary.
    const eligibleRes = await client.query(`
      SELECT u.id AS user_id, u.name
      FROM auth.users u
      JOIN communities.members cm ON cm.user_id = u.id AND cm.community_id = $1 AND cm.status = 'active'
      WHERE COALESCE((
        SELECT SUM(te.raw_weight)
        FROM social_graph.trust_edges te
        WHERE te.community_id = $1
          AND (te.user_id_a = u.id OR te.user_id_b = u.id)
      ), 0) >= $2
    `, [communityId, settings.eligibility_threshold]);
    const eligible_members = eligibleRes.rows.map((r) => ({
      user_id: r.user_id,
      name: r.name,
      eligible: true as const,
      eligibility_reason: 'established_community_relationships' as const,
    }));

    // Pending nominations with ratification counts
    const nominationsRes = await client.query(`
      SELECT n.id, n.nominated_for_role AS role, n.status,
             n.required_ratifications, n.created_at, n.electorate_size, n.quorum_policy_version,
             nu.id AS nominated_user_id, nu.name AS nominated_user_name,
             nom.id AS nominator_id, nom.name AS nominator_name,
             EXISTS(SELECT 1 FROM communities.governance_nomination_voters v
               WHERE v.nomination_id=n.id AND v.user_id=$2) AS viewer_in_electorate
      FROM communities.governance_nominations n
      JOIN auth.users nu ON nu.id = n.nominated_user_id
      JOIN auth.users nom ON nom.id = n.nominator_id
      WHERE n.community_id = $1 AND n.status = 'pending'
      ORDER BY n.created_at DESC
    `, [communityId,viewerId]);

    const nominations: GovernanceNomination[] = [];
    for (const row of nominationsRes.rows) {
      assertNominationPolicy(row);
      const ratifiersRes = await client.query(`
        SELECT u.id AS user_id, u.name
        FROM communities.governance_ratifications r
        JOIN communities.governance_nomination_voters v ON v.nomination_id=r.nomination_id AND v.user_id=r.ratifier_id
        JOIN communities.governance_nominations n ON n.id=r.nomination_id AND n.community_id=$2
        JOIN communities.members m ON m.user_id=r.ratifier_id AND m.community_id=$2 AND m.status='active'
        JOIN auth.users u ON u.id = r.ratifier_id
        WHERE r.nomination_id = $1
        ORDER BY u.id
      `, [row.id,communityId]);
      let reason: GovernanceNomination['viewer']['reason'] = 'eligible';
      if (row.nominated_user_id === viewerId) reason = 'nominee';
      else if (!row.viewer_in_electorate) reason = 'not_in_electorate';
      else if (ratifiersRes.rows.some(r => r.user_id === viewerId)) reason = 'already_ratified';
      nominations.push({
        id: row.id,
        nominated_user: { user_id: row.nominated_user_id, name: row.nominated_user_name },
        role: row.role,
        nominator: { user_id: row.nominator_id, name: row.nominator_name },
        ratification_count: ratifiersRes.rows.length,
        required_ratifications: row.required_ratifications,
        status: row.status,
        ratifiers: ratifiersRes.rows,
        electorate_size: row.electorate_size,
        quorum_policy_version: 1,
        viewer: { can_ratify: reason === 'eligible',reason },
      });
    }

    // Current governance role holders — identity + role only (no member trust_score).
    const roleHoldersRes = await client.query(`
      SELECT u.id AS user_id, u.name, cm.role
      FROM communities.members cm
      JOIN auth.users u ON u.id = cm.user_id
      WHERE cm.community_id = $1 AND cm.role IN ('admin', 'moderator') AND cm.status = 'active'
    `, [communityId]);

    return {
      settings,
      can_nominate: membership.rows[0].active_member_count >= 4,
      maturity,
      eligible_members,
      nominations,
      role_holders: roleHoldersRes.rows,
    };
  });
}

async function governanceTransaction<T>(communityId: string, userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id',$1,true),
      set_config('app.current_community_id',$2,true), set_config('app.governance_policy_version','1',true)`, [userId,communityId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    if (error.code === '40P01') throw new GovernanceError(503, 'GOVERNANCE_RETRY', 'Another membership decision overlapped. Please refresh and retry.');
    if (error.code === '23505' && error.constraint === 'governance_one_pending_role') {
      throw new GovernanceError(409, 'GOVERNANCE_DUPLICATE_NOMINATION', 'A pending nomination already exists for this member and role.');
    }
    throw error;
  } finally { client.release(); }
}

function eligibilityThreshold(settings: any): number {
  const threshold = settings?.eligibility_threshold ?? 50;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
    throw new Error('Invalid governance eligibility configuration');
  }
  return threshold;
}

async function checkNomineeTrust(client: PoolClient, communityId: string, userId: string, threshold: number): Promise<void> {
  const trust = await client.query(`SELECT COALESCE(SUM(te.raw_weight),0) AS trust_score
    FROM social_graph.trust_edges te WHERE te.community_id=$1 AND (te.user_id_a=$2::uuid OR te.user_id_b=$2::uuid)`, [communityId,userId]);
  const score = Number(trust.rows[0]?.trust_score ?? 0);
  if (!Number.isFinite(score) || score < threshold) {
    throw new GovernanceError(422, 'GOVERNANCE_ELIGIBILITY_NOT_MET',
      'This member has not yet met the eligibility threshold through established community relationships.');
  }
}

export interface CreateNominationInput {
  communityId: string;
  nominatorId: string;
  nominatedUserId: string;
  role: 'admin' | 'moderator';
}

export async function createNomination(input: CreateNominationInput): Promise<{
  id: string; quorum_policy_version: 1; electorate_size: number; required_ratifications: number;
}> {
  const { role } = input;
  const communityId = input.communityId.toLowerCase();
  const nominatorId = input.nominatorId.toLowerCase();
  const nominatedUserId = input.nominatedUserId.toLowerCase();
  return governanceTransaction(communityId,nominatorId,async client => {
    const community = await client.query(`SELECT governance_settings FROM communities.communities WHERE id=$1`, [communityId]);
    if (!community.rows.length) throw new GovernanceError(404,'NOT_FOUND','Community not found.');
    // Only these identities need creation locks. The following roster statement defines its own snapshot.
    const members = await client.query(`SELECT user_id,role,status FROM communities.members
      WHERE community_id=$1 AND user_id=ANY($2::uuid[]) ORDER BY user_id FOR NO KEY UPDATE`, [communityId,[nominatorId,nominatedUserId]]);
    const nominator = members.rows.find(r => r.user_id === nominatorId);
    const nominee = members.rows.find(r => r.user_id === nominatedUserId);
    if (nominator?.status !== 'active' || nominee?.status !== 'active') {
      throw new GovernanceError(403,'FORBIDDEN','The nominator and nominee must be active community members.');
    }
    if (!canElevateRole(nominee.role ?? 'member',role)) {
      throw new GovernanceError(409,'GOVERNANCE_ROLE_ALREADY_HELD','The nominee already holds this or a higher role.');
    }
    await checkNomineeTrust(client,communityId,nominatedUserId,eligibilityThreshold(community.rows[0].governance_settings));
    const voters = await client.query(`SELECT user_id FROM communities.members
      WHERE community_id=$1 AND status='active' AND user_id<>$2 ORDER BY user_id`, [communityId,nominatedUserId]);
    const electorate = voters.rows.map(r => r.user_id);
    if (electorate.length < GOVERNANCE_QUORUM_POLICY.minimum) {
      throw new GovernanceError(422,'GOVERNANCE_ELECTORATE_TOO_SMALL','At least three other active members are needed to open a nomination.');
    }
    const required = requiredRatifications(electorate.length);
    const nomination = await client.query(`INSERT INTO communities.governance_nominations
      (community_id,nominated_user_id,nominated_for_role,nominator_id,quorum_policy_version,electorate_size,required_ratifications)
      VALUES($1,$2,$3,$4,1,$5,$6) RETURNING id`, [communityId,nominatedUserId,role,nominatorId,electorate.length,required]);
    const id = nomination.rows[0].id;
    await client.query(`INSERT INTO communities.governance_nomination_voters(nomination_id,user_id)
      SELECT $1,user_id FROM unnest($2::uuid[]) user_id`, [id,electorate]);
    return { id,quorum_policy_version: 1,electorate_size: electorate.length,required_ratifications: required };
  });
}

export interface RatificationInput { communityId: string; nominationId: string; ratifierId: string }

function assertNominationPolicy(nomination: any): void {
  if (nomination.quorum_policy_version !== 1 || !Number.isSafeInteger(nomination.electorate_size)
    || nomination.electorate_size < 3 || nomination.required_ratifications !== requiredRatifications(nomination.electorate_size)) {
    throw new Error('Invalid governance nomination policy metadata');
  }
}

export async function addRatification(input: RatificationInput): Promise<{
  ratified: boolean; ratification_count: number; required_ratifications: number;
}> {
  const communityId = input.communityId.toLowerCase();
  const nominationId = input.nominationId.toLowerCase();
  const ratifierId = input.ratifierId.toLowerCase();
  return governanceTransaction(communityId,ratifierId,async client => {
    const nominations = await client.query(`SELECT * FROM communities.governance_nominations
      WHERE id=$1 AND community_id=$2 FOR UPDATE`, [nominationId,communityId]);
    const nomination = nominations.rows[0];
    if (!nomination) throw new GovernanceError(404,'NOT_FOUND','Nomination not found.');
    if (nomination.status !== 'pending') throw new GovernanceError(409,'GOVERNANCE_NOMINATION_CLOSED','This nomination is closed.');
    assertNominationPolicy(nomination);
    if (nomination.nominated_user_id === ratifierId) {
      throw new GovernanceError(422,'GOVERNANCE_SELF_RATIFICATION','Cannot ratify your own nomination.');
    }
    // Lock every existing snapshot membership, including inactive rows, plus the nominee.
    // The explicit community predicate is required even when the DB role bypasses RLS.
    const members = await client.query(`SELECT m.user_id,m.role,m.status FROM communities.members m
      WHERE m.community_id=$1 AND (m.user_id=$2 OR EXISTS (
        SELECT 1 FROM communities.governance_nomination_voters v WHERE v.nomination_id=$3 AND v.user_id=m.user_id
      )) ORDER BY m.user_id FOR NO KEY UPDATE`, [communityId,nomination.nominated_user_id,nominationId]);
    if (members.rows.find(r => r.user_id === ratifierId)?.status !== 'active') {
      throw new GovernanceError(403,'GOVERNANCE_VOTER_NOT_ELIGIBLE','Only active members of the original electorate may ratify.');
    }
    await client.query(`INSERT INTO communities.governance_ratifications(nomination_id,ratifier_id)
      VALUES($1,$2) ON CONFLICT DO NOTHING`, [nominationId,ratifierId]);
    const count = await client.query(`SELECT count(*)::int AS n FROM communities.governance_ratifications r
      JOIN communities.governance_nomination_voters v ON v.nomination_id=r.nomination_id AND v.user_id=r.ratifier_id
      JOIN communities.members m ON m.user_id=v.user_id AND m.community_id=$2 AND m.status='active'
      WHERE r.nomination_id=$1`, [nominationId,communityId]);
    const ratificationCount = count.rows[0].n;
    const ratified = ratificationCount >= nomination.required_ratifications;
    if (ratified) {
      const nominee = members.rows.find(r => r.user_id === nomination.nominated_user_id);
      if (nominee?.status !== 'active') {
        throw new GovernanceError(422,'GOVERNANCE_ELIGIBILITY_NOT_MET','The nominee must still be an eligible active community member.');
      }
      if (!canElevateRole(nominee.role ?? 'member',nomination.nominated_for_role)) {
        throw new GovernanceError(409,'GOVERNANCE_ROLE_ALREADY_HELD','The nominee already holds this or a higher role.');
      }
      const community = await client.query(`SELECT governance_settings FROM communities.communities WHERE id=$1`, [communityId]);
      if (!community.rows.length) throw new GovernanceError(404,'NOT_FOUND','Community not found.');
      await checkNomineeTrust(client,communityId,nomination.nominated_user_id,eligibilityThreshold(community.rows[0].governance_settings));
      await client.query(`UPDATE communities.members SET role=$3 WHERE community_id=$1 AND user_id=$2 AND status='active'`,
        [communityId,nomination.nominated_user_id,nomination.nominated_for_role]);
      await client.query(`UPDATE communities.governance_nominations SET status='ratified',resolved_at=now()
        WHERE id=$1 AND community_id=$2`, [nominationId,communityId]);
    }
    return { ratified,ratification_count: ratificationCount,required_ratifications: nomination.required_ratifications };
  });
}
