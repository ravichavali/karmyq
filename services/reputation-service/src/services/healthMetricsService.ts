import { query } from '../database/db';
import { readCurrentCommunityMetrics } from './communityHealthMetrics';
import { publishEvent } from '../events/publisher';
import { calculateCommunityTrustScore } from './communityTrustService';

/**
 * Calculate and store community health metrics snapshot
 * Social Karma v2.0: Community-level health tracking
 */
export async function calculateCommunityHealthMetrics(communityId: string): Promise<void> {
  try {
    console.log(`Calculating health metrics for community: ${communityId}`);

    const current = await readCurrentCommunityMetrics(communityId);
    const {
      total_matches_completed: totalMatches,
      total_active_requesters: totalRequesters,
      total_active_helpers: totalHelpers,
      unique_participants: uniqueParticipants,
      network_density: networkDensity,
      network_strength: networkStrength,
    } = current;

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

    if ((previousSnapshot.rowCount ?? 0) > 0) {
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
         network_density,
         growth_rate_matches,
         growth_rate_participants
       ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (community_id, snapshot_date)
       DO UPDATE SET
         total_matches_completed = EXCLUDED.total_matches_completed,
         total_active_requesters = EXCLUDED.total_active_requesters,
         total_active_helpers = EXCLUDED.total_active_helpers,
         unique_participant_count = EXCLUDED.unique_participant_count,
         network_density = EXCLUDED.network_density,
         growth_rate_matches = EXCLUDED.growth_rate_matches,
         growth_rate_participants = EXCLUDED.growth_rate_participants`,
      [
        communityId,
        totalMatches,
        totalRequesters,
        totalHelpers,
        uniqueParticipants,
        networkDensity,
        growthRateMatches,
        growthRateParticipants,
      ]
    );

    // Update community health summary cache
    await updateHealthSummary(communityId, totalMatches, uniqueParticipants, networkStrength, growthRateMatches);

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
      try {
        await calculateCommunityHealthMetrics(community.id);
        await calculateCommunityTrustScore(community.id);
      } catch (error) {
        console.error(`[healthMetrics] Failed for ${community.id}:`, error);
      }
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
  networkStrength: number,
  trendPercentage: number
): Promise<void> {
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
