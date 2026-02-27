import { query } from '../database/db';
import { publishEvent } from '../events/publisher';
import { calculateCommunityTrustScore } from './communityTrustService';

/**
 * Calculate and store community health metrics snapshot
 * Social Karma v2.0: Community-level health tracking
 */
export async function calculateCommunityHealthMetrics(communityId: string): Promise<void> {
  try {
    console.log(`Calculating health metrics for community: ${communityId}`);

    // Get all completed matches for this community
    const matchesResult = await query(
      `SELECT COUNT(*) as total
       FROM requests.matches m
       INNER JOIN requests.help_requests r ON m.request_id = r.id
       WHERE r.community_id = $1 AND m.status = 'completed'`,
      [communityId]
    );

    const totalMatches = parseInt(matchesResult.rows[0].total || 0);

    // Get unique participants (requesters and helpers)
    const participantsResult = await query(
      `SELECT
         COUNT(DISTINCT r.requester_id) as requesters,
         COUNT(DISTINCT m.responder_id) as helpers
       FROM requests.matches m
       INNER JOIN requests.help_requests r ON m.request_id = r.id
       WHERE r.community_id = $1 AND m.status = 'completed'`,
      [communityId]
    );

    const totalRequesters = parseInt(participantsResult.rows[0].requesters || 0);
    const totalHelpers = parseInt(participantsResult.rows[0].helpers || 0);
    const uniqueParticipants = totalRequesters + totalHelpers;

    // Get average interaction quality from feedback
    const qualityResult = await query(
      `SELECT
         AVG(f.helpfulness) as avg_helpfulness,
         AVG(f.responsiveness) as avg_responsiveness,
         AVG(f.clarity) as avg_clarity
       FROM requests.interaction_feedback f
       INNER JOIN requests.matches m ON f.match_id = m.id
       INNER JOIN requests.help_requests r ON m.request_id = r.id
       WHERE r.community_id = $1`,
      [communityId]
    );

    const avgHelpfulness = parseFloat(qualityResult.rows[0]?.avg_helpfulness || 0);
    const avgResponsiveness = parseFloat(qualityResult.rows[0]?.avg_responsiveness || 0);
    const avgClarity = parseFloat(qualityResult.rows[0]?.avg_clarity || 0);

    // Calculate network density (matches per member)
    const communityResult = await query(
      `SELECT current_members FROM communities.communities WHERE id = $1`,
      [communityId]
    );
    const totalMembers = parseInt(communityResult.rows[0]?.current_members || 1);
    const networkDensity = totalMatches / totalMembers;

    // Get previous snapshot for growth calculation (7 days ago)
    const previousSnapshot = await query(
      `SELECT
         total_matches_completed,
         unique_participant_count
       FROM reputation.community_health_metrics
       WHERE community_id = $1
         AND snapshot_date = CURRENT_DATE - INTERVAL '7 days'`,
      [communityId]
    );

    let growthRateMatches = 0;
    let growthRateParticipants = 0;

    if (previousSnapshot.rowCount > 0) {
      const prevMatches = parseInt(previousSnapshot.rows[0].total_matches_completed || 0);
      const prevParticipants = parseInt(previousSnapshot.rows[0].unique_participant_count || 0);

      if (prevMatches > 0) {
        growthRateMatches = ((totalMatches - prevMatches) / prevMatches) * 100;
      }

      if (prevParticipants > 0) {
        growthRateParticipants = ((uniqueParticipants - prevParticipants) / prevParticipants) * 100;
      }
    }

    // Store snapshot (upsert for today)
    await query(
      `INSERT INTO reputation.community_health_metrics (
         community_id,
         snapshot_date,
         total_matches_completed,
         total_active_requesters,
         total_active_helpers,
         unique_participant_count,
         avg_helpfulness,
         avg_responsiveness,
         avg_clarity,
         network_density,
         growth_rate_matches,
         growth_rate_participants
       ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (community_id, snapshot_date)
       DO UPDATE SET
         total_matches_completed = EXCLUDED.total_matches_completed,
         total_active_requesters = EXCLUDED.total_active_requesters,
         total_active_helpers = EXCLUDED.total_active_helpers,
         unique_participant_count = EXCLUDED.unique_participant_count,
         avg_helpfulness = EXCLUDED.avg_helpfulness,
         avg_responsiveness = EXCLUDED.avg_responsiveness,
         avg_clarity = EXCLUDED.avg_clarity,
         network_density = EXCLUDED.network_density,
         growth_rate_matches = EXCLUDED.growth_rate_matches,
         growth_rate_participants = EXCLUDED.growth_rate_participants`,
      [
        communityId,
        totalMatches,
        totalRequesters,
        totalHelpers,
        uniqueParticipants,
        avgHelpfulness,
        avgResponsiveness,
        avgClarity,
        networkDensity,
        growthRateMatches,
        growthRateParticipants,
      ]
    );

    // Update community health summary cache
    await updateHealthSummary(communityId, totalMatches, uniqueParticipants, networkDensity, avgHelpfulness, avgResponsiveness, avgClarity, growthRateMatches);

    // Publish event
    await publishEvent('health_metrics_calculated', {
      community_id: communityId,
      snapshot_date: new Date().toISOString().split('T')[0],
      total_matches: totalMatches,
      unique_participants: uniqueParticipants,
      growth_rate_matches: growthRateMatches,
    });

    console.log(`Health metrics calculated for community ${communityId}: ${totalMatches} matches, ${uniqueParticipants} participants`);
  } catch (error) {
    console.error(`Error calculating health metrics for community ${communityId}:`, error);
    throw error;
  }
}

/**
 * Calculate all community health metrics (daily job)
 */
export async function calculateAllCommunityMetrics(): Promise<void> {
  try {
    console.log('Starting daily health metrics calculation for all communities');

    // Get all active communities
    const communities = await query(
      `SELECT id FROM communities.communities WHERE status = 'active'`
    );

    console.log(`Found ${communities.rowCount} active communities`);

    for (const community of communities.rows) {
      await calculateCommunityHealthMetrics(community.id);
      await calculateCommunityTrustScore(community.id);
    }

    console.log('Completed daily health metrics calculation for all communities');
  } catch (error) {
    console.error('Error in daily health metrics calculation:', error);
    throw error;
  }
}

/**
 * Update cached health summary in communities schema
 */
async function updateHealthSummary(
  communityId: string,
  totalExchanges: number,
  activeMembers: number,
  networkDensity: number,
  avgHelpfulness: number,
  avgResponsiveness: number,
  avgClarity: number,
  trendPercentage: number
): Promise<void> {
  // Calculate network strength
  const matchesPerParticipant = activeMembers > 0 ? totalExchanges / activeMembers : 0;
  const activityScore = Math.min(100, matchesPerParticipant * 20);

  const avgQuality = (avgHelpfulness + avgResponsiveness + avgClarity) / 3;
  const qualityScore = (avgQuality / 5) * 100;

  const densityScore = Math.min(100, networkDensity * 100);

  const networkStrength = (
    activityScore * 0.4 +
    qualityScore * 0.4 +
    densityScore * 0.2
  );

  const trendDirection = trendPercentage > 5 ? 'growing' :
                        trendPercentage < -5 ? 'declining' : 'stable';

  await query(
    `INSERT INTO communities.health_summary (
       community_id,
       total_exchanges,
       active_members,
       network_strength,
       trend_direction,
       trend_percentage,
       last_calculated
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (community_id)
     DO UPDATE SET
       total_exchanges = EXCLUDED.total_exchanges,
       active_members = EXCLUDED.active_members,
       network_strength = EXCLUDED.network_strength,
       trend_direction = EXCLUDED.trend_direction,
       trend_percentage = EXCLUDED.trend_percentage,
       last_calculated = NOW()`,
    [
      communityId,
      totalExchanges,
      activeMembers,
      networkStrength,
      trendDirection,
      trendPercentage,
    ]
  );
}
