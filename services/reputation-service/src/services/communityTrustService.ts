import { query } from '../database/db';
import { upsertCommunityTrustScore } from '../database/communityTrustDb';

// ADR-040: Community Trust Score
// Measures how much a community can be trusted to fulfill its mutual aid purpose.
// Structured around Putnam's bonding vs. bridging social capital:
//   - Bonding: internal cohesion (members helping each other)
//   - Bridging: external reach (members engaging across community lines)
// Communities configure the balance via community_trust_bonding_weight / bridging_weight.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

interface CommunityTrustConfig {
  bonding_weight: number;
  bridging_weight: number;
}

async function getCommunityTrustConfig(community_id: string): Promise<CommunityTrustConfig> {
  const result = await query(
    `SELECT community_trust_bonding_weight, community_trust_bridging_weight
     FROM communities.community_configs
     WHERE community_id = $1`,
    [community_id]
  );
  const row = result.rows[0];
  return {
    bonding_weight: parseFloat(row?.community_trust_bonding_weight ?? '0.60'),
    bridging_weight: parseFloat(row?.community_trust_bridging_weight ?? '0.40'),
  };
}

export async function calculateCommunityTrustScore(community_id: string): Promise<number> {
  const NINETY_DAYS_AGO = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
  const config = await getCommunityTrustConfig(community_id);

  // --- Signal 1: Member Quality (40 pts) ---
  // Average trust score of members active in the last 90 days.
  const memberQualityResult = await query(
    `SELECT
       COUNT(DISTINCT kr.user_id) as active_member_count,
       AVG(ts.score) as avg_member_trust
     FROM reputation.karma_records kr
     JOIN reputation.trust_scores ts ON kr.user_id = ts.user_id AND kr.community_id = ts.community_id
     WHERE kr.community_id = $1
       AND kr.reason IN ('Provided help', 'Received help')
       AND kr.created_at >= $2`,
    [community_id, NINETY_DAYS_AGO]
  );
  const mq = memberQualityResult.rows[0];
  const activeMemberCount = parseInt(mq?.active_member_count ?? '0');
  const avgMemberTrust = parseFloat(mq?.avg_member_trust ?? '0') || 0;
  const member_quality_score = Math.round((avgMemberTrust / 100) * 40);

  // --- Signal 2: Bonding (internal cohesion) ---
  // Sub-signal A: Completion rate — % of matched requests that were completed in last 90 days
  const completionResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE m.status = 'completed') as completed_count,
       COUNT(*) as total_matched
     FROM requests.matches m
     JOIN requests.request_communities rc ON m.request_id = rc.request_id
     WHERE rc.community_id = $1
       AND m.created_at >= $2`,
    [community_id, NINETY_DAYS_AGO]
  );
  const cr = completionResult.rows[0];
  const completedCount = parseInt(cr?.completed_count ?? '0');
  const totalMatched = parseInt(cr?.total_matched ?? '0');
  const completion_rate = totalMatched > 0 ? completedCount / totalMatched : 0;

  // Sub-signal B: Retention — % of members with 2+ completed interactions ever
  const retentionResult = await query(
    `SELECT
       COUNT(DISTINCT m.user_id) as total_members,
       COUNT(DISTINCT kr.user_id) as retained_members
     FROM communities.members m
     LEFT JOIN (
       SELECT user_id, COUNT(*) as interaction_count
       FROM reputation.karma_records
       WHERE community_id = $1
         AND reason IN ('Provided help', 'Received help')
       GROUP BY user_id
       HAVING COUNT(*) >= 2
     ) kr ON m.user_id = kr.user_id
     WHERE m.community_id = $1 AND m.status = 'active'`,
    [community_id]
  );
  const ret = retentionResult.rows[0];
  const totalMembers = parseInt(ret?.total_members ?? '0');
  const retainedMembers = parseInt(ret?.retained_members ?? '0');
  const retention_rate = totalMembers > 0 ? retainedMembers / totalMembers : 0;

  const bonding_score = Math.round(
    (completion_rate * 0.5 + retention_rate * 0.5) * config.bonding_weight * 30
  );

  // --- Signal 3: Bridging (external reach) ---
  // Sub-signal A: Cross-community interaction rate — interactions involving members from other communities
  const crossCommunityResult = await query(
    `SELECT
       COUNT(*) as total_interactions,
       COUNT(*) FILTER (
         WHERE EXISTS (
           SELECT 1 FROM reputation.karma_records kr2
           WHERE kr2.related_entity_id = kr.related_entity_id
             AND kr2.community_id != $1
         )
       ) as cross_community_interactions
     FROM reputation.karma_records kr
     WHERE kr.community_id = $1
       AND kr.reason IN ('Provided help', 'Received help')
       AND kr.created_at >= $2`,
    [community_id, NINETY_DAYS_AGO]
  );
  const cc = crossCommunityResult.rows[0];
  const totalInteractions = parseInt(cc?.total_interactions ?? '0');
  const crossCommunityInteractions = parseInt(cc?.cross_community_interactions ?? '0');
  const cross_community_rate = totalInteractions > 0 ? crossCommunityInteractions / totalInteractions : 0;

  // Sub-signal B: External help rate — % of help provided to people outside this community
  // Approximation: interactions where the match's requester is not a member of this community
  const externalHelpResult = await query(
    `SELECT
       COUNT(*) as total_helped,
       COUNT(*) FILTER (
         WHERE NOT EXISTS (
           SELECT 1 FROM communities.members cm
           WHERE cm.user_id = kr.user_id AND cm.community_id = $1 AND cm.status = 'active'
         )
       ) as external_helped
     FROM reputation.karma_records kr
     WHERE kr.community_id = $1
       AND kr.reason = 'Provided help'
       AND kr.created_at >= $2`,
    [community_id, NINETY_DAYS_AGO]
  );
  const eh = externalHelpResult.rows[0];
  const totalHelped = parseInt(eh?.total_helped ?? '0');
  const externalHelped = parseInt(eh?.external_helped ?? '0');
  const external_help_rate = totalHelped > 0 ? externalHelped / totalHelped : 0;

  const bridging_score = Math.round(
    (cross_community_rate * 0.5 + external_help_rate * 0.5) * config.bridging_weight * 30
  );

  // --- Final score ---
  const raw_score = member_quality_score + bonding_score + bridging_score;
  const score = Math.max(0, Math.min(100, raw_score));

  await upsertCommunityTrustScore(community_id, {
    score,
    member_quality_score,
    bonding_score,
    bridging_score,
    active_member_count: activeMemberCount,
  });

  return score;
}

export async function calculateAllCommunityTrustScores(): Promise<void> {
  const result = await query(
    `SELECT id FROM communities.communities WHERE status = 'active'`,
    []
  );
  for (const row of result.rows) {
    try {
      await calculateCommunityTrustScore(row.id);
    } catch (err) {
      console.error(`[communityTrust] Failed for community ${row.id}:`, err);
    }
  }
}
