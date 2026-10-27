import express, { Request, Response } from 'express';
import { RouteParams } from '@karmyq/shared/middleware/auth';
import { query } from '../database/db';
import { readCurrentCommunityMetrics, calculateNetworkStrength } from '../services/communityHealthMetrics';
import { computeNetworkCohesion } from '../services/networkCohesionService';
import { checkAggregateAccess } from '../utils/disclosureAuth';

const router = express.Router();

// Sprint 112 (ADR-082): community aggregates require active membership + a >=5-member cohort.
// Non-member and undersized cohort both return the same 404 to avoid leaking existence/size.
function denyAggregate(res: Response) {
  return res.status(404).json({ success: false, message: 'Community aggregate not available', error: 'AGGREGATE_NOT_AVAILABLE' });
}

/**
 * GET /reputation/community-health/:communityId
 * Get community health metrics and trends (Social Karma v2.0)
 */
router.get('/community-health/:communityId', async (req: Request<RouteParams>, res: Response) => {
  const { communityId } = req.params;
  const { period = '7d' } = req.query;

  try {
    const access = await checkAggregateAccess((req as any).user?.userId, communityId);
    if (!access.allowed) return denyAggregate(res);
    // Get latest snapshot
    const latestSnapshot = await query(
      `SELECT
        snapshot_date,
        total_matches_completed,
        total_active_requesters,
        total_active_helpers,
        unique_participant_count,
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
      const currentMetrics = await readCurrentCommunityMetrics(communityId);

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
router.get('/milestones/:communityId', async (req: Request<RouteParams>, res: Response) => {
  const { communityId } = req.params;
  const { limit = '10' } = req.query;

  try {
    const access = await checkAggregateAccess((req as any).user?.userId, communityId);
    if (!access.allowed) return denyAggregate(res);
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
 * GET /reputation/network-metrics/:communityId
 * Compute graph-theory network cohesion metrics for a community.
 */
router.get('/network-metrics/:communityId', async (req: Request<RouteParams>, res: Response) => {
  const { communityId } = req.params;

  try {
    const access = await checkAggregateAccess((req as any).user?.userId, communityId);
    if (!access.allowed) return denyAggregate(res);
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
