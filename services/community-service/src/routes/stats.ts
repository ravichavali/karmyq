import { Router, Request, Response } from 'express';
import { query } from '../database/db';

const router = Router();

/**
 * GET /communities/:communityId/stats
 * Get community statistics (admin only)
 */
router.get('/:communityId/stats', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify user is an admin of this community
    const memberCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, userId]
    );

    if (memberCheck.rowCount === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can view statistics',
      });
    }

    // Begin transaction and disable RLS for admin stats query
    // This is safe because we've already verified the user is a community admin
    await query('BEGIN');
    await query('SET LOCAL row_security = off');

    try {
      // Get comprehensive community statistics
      const statsQuery = `
        WITH
        -- Basic member counts
        member_stats AS (
        SELECT
          COUNT(*)::int AS total_members,
          COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_members,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_members,
          COUNT(CASE WHEN role = 'admin' THEN 1 END)::int AS admin_count,
          COUNT(CASE WHEN role = 'moderator' THEN 1 END)::int AS moderator_count
        FROM communities.members
        WHERE community_id = $1
      ),

      -- Request statistics
      request_stats AS (
        SELECT
          COUNT(*)::int AS total_requests,
          COUNT(CASE WHEN status = 'open' THEN 1 END)::int AS open_requests,
          COUNT(CASE WHEN status = 'matched' THEN 1 END)::int AS matched_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_requests,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END)::int AS requests_this_week,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END)::int AS requests_this_month
        FROM requests.help_requests
        WHERE community_id = $1
          AND (expires_at IS NULL OR expires_at > NOW())
      ),

      -- Match statistics
      match_stats AS (
        SELECT
          COUNT(*)::int AS total_matches,
          COUNT(CASE WHEN m.status = 'proposed' THEN 1 END)::int AS proposed_matches,
          COUNT(CASE WHEN m.status = 'matched' THEN 1 END)::int AS active_matches,
          COUNT(CASE WHEN m.status = 'completed' THEN 1 END)::int AS completed_matches,
          COUNT(CASE WHEN m.completed_at > NOW() - INTERVAL '7 days' THEN 1 END)::int AS matches_completed_this_week,
          COUNT(CASE WHEN m.completed_at > NOW() - INTERVAL '30 days' THEN 1 END)::int AS matches_completed_this_month
        FROM requests.matches m
        JOIN requests.help_requests r ON m.request_id = r.id
        WHERE r.community_id = $1
      ),

      -- Top helpers this month
      top_helpers AS (
        SELECT
          u.name,
          u.id as user_id,
          COUNT(*)::int as help_count,
          AVG(kr.points)::int as avg_karma
        FROM requests.matches m
        JOIN requests.help_requests r ON m.request_id = r.id
        JOIN auth.users u ON m.responder_id = u.id
        LEFT JOIN reputation.karma_records kr ON kr.user_id = u.id AND kr.community_id = r.community_id
        WHERE r.community_id = $1
          AND m.status = 'completed'
          AND m.completed_at > NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.name
        ORDER BY help_count DESC, avg_karma DESC
        LIMIT 5
      ),

      -- Top requesters this month
      top_requesters AS (
        SELECT
          u.name,
          u.id as user_id,
          COUNT(*)::int as request_count
        FROM requests.help_requests r
        JOIN auth.users u ON r.requester_id = u.id
        WHERE r.community_id = $1
          AND r.created_at > NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.name
        ORDER BY request_count DESC
        LIMIT 5
      ),

      -- Activity by day (last 30 days)
      daily_activity AS (
        SELECT
          date::date,
          COALESCE(request_count, 0)::int as requests,
          COALESCE(match_count, 0)::int as matches
        FROM generate_series(NOW() - INTERVAL '30 days', NOW(), '1 day'::interval) date
        LEFT JOIN (
          SELECT DATE(created_at) as day, COUNT(*)::int as request_count
          FROM requests.help_requests
          WHERE community_id = $1
            AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY day
        ) r ON DATE(date) = r.day
        LEFT JOIN (
          SELECT DATE(m.created_at) as day, COUNT(*)::int as match_count
          FROM requests.matches m
          JOIN requests.help_requests req ON m.request_id = req.id
          WHERE req.community_id = $1
            AND m.created_at > NOW() - INTERVAL '30 days'
          GROUP BY day
        ) m ON DATE(date) = m.day
        ORDER BY date DESC
      ),

      -- Average karma in community
      karma_stats AS (
        SELECT
          AVG(kr.points)::int as avg_karma,
          MAX(kr.points)::int as max_karma,
          COUNT(DISTINCT kr.user_id)::int as users_with_karma
        FROM reputation.karma_records kr
        JOIN communities.members cm ON kr.user_id = cm.user_id AND kr.community_id = cm.community_id
        WHERE kr.community_id = $1
          AND cm.status = 'active'
      )

      SELECT
        -- Serialize aggregated stats
        (SELECT row_to_json(m) FROM member_stats m) as member_stats,
        (SELECT row_to_json(r) FROM request_stats r) as request_stats,
        (SELECT row_to_json(m) FROM match_stats m) as match_stats,
        (SELECT row_to_json(k) FROM karma_stats k) as karma_stats,
        (SELECT json_agg(t) FROM top_helpers t) as top_helpers,
        (SELECT json_agg(t) FROM top_requesters t) as top_requesters,
        (SELECT json_agg(d) FROM daily_activity d) as daily_activity
    `;

      const result = await query(statsQuery, [communityId]);

      if (result.rowCount === 0) {
        await query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Community not found',
        });
      }

      const stats = result.rows[0];

      // Commit transaction
      await query('COMMIT');

      res.json({
        success: true,
        data: {
          members: stats.member_stats || {},
          requests: stats.request_stats || {},
          matches: stats.match_stats || {},
          karma: stats.karma_stats || {},
          topHelpers: stats.top_helpers || [],
          topRequesters: stats.top_requesters || [],
          dailyActivity: stats.daily_activity || [],
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      // Rollback transaction on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Error fetching community statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community statistics',
      error: error.message,
    });
  }
});

export default router;
