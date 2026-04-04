import express, { Request, Response } from 'express';
import { query } from '../database/db';
import { computeNetworkCohesion } from '../services/networkCohesionService';

const router = express.Router();

/**
 * GET /reputation/community-health/:communityId
 * Get community health metrics and trends (Social Karma v2.0)
 */
router.get('/community-health/:communityId', async (req: Request, res: Response) => {
  const { communityId } = req.params;
  const { period = '7d' } = req.query;

  try {
    // Parse period to days
    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;

    // Get latest snapshot
    const latestSnapshot = await query(
      `SELECT
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
       FROM reputation.community_health_metrics
       WHERE community_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [communityId]
    );

    if (latestSnapshot.rowCount === 0) {
      // No metrics yet - calculate current state
      const currentMetrics = await calculateCurrentMetrics(communityId);

      return res.json({
        success: true,
        data: {
          current: currentMetrics,
          trend: {
            matches_growth: 0,
            participants_growth: 0,
            direction: 'stable',
          },
          period: period as string,
          snapshot_date: new Date().toISOString().split('T')[0],
        },
      });
    }

    const latest = latestSnapshot.rows[0];

    // Calculate network strength
    const networkStrength = calculateNetworkStrength(
      latest.total_matches_completed,
      latest.unique_participant_count,
      latest.avg_helpfulness,
      latest.avg_responsiveness,
      latest.avg_clarity,
      latest.network_density
    );

    // Determine trend direction
    const direction = latest.growth_rate_matches > 5 ? 'growing' :
                     latest.growth_rate_matches < -5 ? 'declining' : 'stable';

    res.json({
      success: true,
      data: {
        current: {
          total_matches_completed: latest.total_matches_completed,
          unique_participants: latest.unique_participant_count,
          total_active_requesters: latest.total_active_requesters,
          total_active_helpers: latest.total_active_helpers,
          avg_helpfulness: parseFloat(latest.avg_helpfulness || 0),
          avg_responsiveness: parseFloat(latest.avg_responsiveness || 0),
          avg_clarity: parseFloat(latest.avg_clarity || 0),
          network_density: parseFloat(latest.network_density || 0),
          network_strength: networkStrength,
        },
        trend: {
          matches_growth: parseFloat(latest.growth_rate_matches || 0),
          participants_growth: parseFloat(latest.growth_rate_participants || 0),
          direction,
        },
        period: period as string,
        snapshot_date: latest.snapshot_date,
      },
    });
  } catch (error) {
    (req as any).logger?.error('Error fetching community health', error instanceof Error ? error : new Error(String(error)), { service: 'reputation-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community health metrics',
    });
  }
});

/**
 * GET /reputation/milestones/:communityId
 * Get community milestone achievements (Social Karma v2.0)
 */
router.get('/milestones/:communityId', async (req: Request, res: Response) => {
  const { communityId } = req.params;
  const { limit = '10' } = req.query;

  try {
    const result = await query(
      `SELECT
        id,
        milestone_type,
        milestone_value,
        description,
        is_featured,
        achieved_at
       FROM reputation.milestone_events
       WHERE community_id = $1
       ORDER BY achieved_at DESC
       LIMIT $2`,
      [communityId, parseInt(limit as string)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    (req as any).logger?.error('Error fetching milestones', error instanceof Error ? error : new Error(String(error)), { service: 'reputation-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch milestones',
    });
  }
});

/**
 * Helper: Calculate current metrics for a community
 */
async function calculateCurrentMetrics(communityId: string) {
  // Get total completed matches
  const matchesResult = await query(
    `SELECT COUNT(*) as total
     FROM requests.matches m
     INNER JOIN requests.help_requests r ON m.request_id = r.id
     WHERE r.community_id = $1 AND m.status = 'completed'`,
    [communityId]
  );

  // Get unique participants
  const participantsResult = await query(
    `SELECT
       COUNT(DISTINCT r.requester_id) as requesters,
       COUNT(DISTINCT m.responder_id) as helpers
     FROM requests.matches m
     INNER JOIN requests.help_requests r ON m.request_id = r.id
     WHERE r.community_id = $1 AND m.status = 'completed'`,
    [communityId]
  );

  // Get average interaction quality
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

  const totalMatches = parseInt(matchesResult.rows[0].total || 0);
  const totalRequesters = parseInt(participantsResult.rows[0].requesters || 0);
  const totalHelpers = parseInt(participantsResult.rows[0].helpers || 0);
  const uniqueParticipants = totalRequesters + totalHelpers;

  const avgHelpfulness = parseFloat(qualityResult.rows[0]?.avg_helpfulness || 0);
  const avgResponsiveness = parseFloat(qualityResult.rows[0]?.avg_responsiveness || 0);
  const avgClarity = parseFloat(qualityResult.rows[0]?.avg_clarity || 0);

  // Calculate network density (connections per member)
  const communityResult = await query(
    `SELECT current_members FROM communities.communities WHERE id = $1`,
    [communityId]
  );
  const totalMembers = parseInt(communityResult.rows[0]?.current_members || 1);
  const networkDensity = totalMatches / totalMembers;

  const networkStrength = calculateNetworkStrength(
    totalMatches,
    uniqueParticipants,
    avgHelpfulness,
    avgResponsiveness,
    avgClarity,
    networkDensity
  );

  return {
    total_matches_completed: totalMatches,
    unique_participants: uniqueParticipants,
    total_active_requesters: totalRequesters,
    total_active_helpers: totalHelpers,
    avg_helpfulness: avgHelpfulness,
    avg_responsiveness: avgResponsiveness,
    avg_clarity: avgClarity,
    network_density: networkDensity,
    network_strength: networkStrength,
  };
}

/**
 * Helper: Calculate network strength score (0-100)
 *
 * Formula:
 * network_strength = weighted_average(
 *   activity_score * 0.4,
 *   quality_score * 0.4,
 *   density_score * 0.2
 * )
 */
function calculateNetworkStrength(
  totalMatches: number,
  uniqueParticipants: number,
  avgHelpfulness: number,
  avgResponsiveness: number,
  avgClarity: number,
  networkDensity: number
): number {
  // Activity score: based on matches per participant (0-100)
  const matchesPerParticipant = uniqueParticipants > 0 ? totalMatches / uniqueParticipants : 0;
  const activityScore = Math.min(100, matchesPerParticipant * 20); // Cap at 100

  // Quality score: average of interaction ratings normalized to 0-100
  const avgQuality = (avgHelpfulness + avgResponsiveness + avgClarity) / 3;
  const qualityScore = (avgQuality / 5) * 100; // Convert 1-5 to 0-100

  // Density score: network density normalized to 0-100
  const densityScore = Math.min(100, networkDensity * 100); // Cap at 100

  // Weighted average
  const networkStrength = (
    activityScore * 0.4 +
    qualityScore * 0.4 +
    densityScore * 0.2
  );

  return parseFloat(networkStrength.toFixed(2));
}

/**
 * GET /reputation/network-metrics/:communityId
 * Compute graph-theory network cohesion metrics for a community.
 */
router.get('/network-metrics/:communityId', async (req: Request, res: Response) => {
  const { communityId } = req.params;

  try {
    const metrics = await computeNetworkCohesion(communityId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    (req as any).logger?.error('Error computing network cohesion metrics', error instanceof Error ? error : new Error(String(error)), { service: 'reputation-service' });
    res.status(500).json({
      success: false,
      message: 'Failed to compute network cohesion metrics',
      error: 'NETWORK_METRICS_ERROR',
    });
  }
});

export default router;
