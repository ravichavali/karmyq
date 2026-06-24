import { Router, Request, Response } from 'express';
import pool from '../database/db';
import { createLogger } from '@karmyq/shared/utils/logger';

const router = Router();
const logger = createLogger('community-service:export');

interface ExportOptions {
  format: 'json' | 'csv';
  include?: {
    members?: boolean;
    requests?: boolean;
    matches?: boolean;
    norms?: boolean;
    settings?: boolean;
    karma?: boolean;
  };
  dateRange?: {
    start?: string;
    end?: string;
  };
}

// Helper to convert data to CSV
function toCSV(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) return '';

  const keys = headers || Object.keys(data[0]);
  const headerRow = keys.join(',');
  const rows = data.map(row =>
    keys.map(key => {
      const value = row[key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      if (value instanceof Date) return value.toISOString();
      return String(value);
    }).join(',')
  );

  return [headerRow, ...rows].join('\n');
}

// GET /communities/:communityId/export
// Export community data in JSON or CSV format
router.get('/:communityId/export', async (req: Request, res: Response) => {
  const { communityId } = req.params;
  const userId = (req as any).user?.userId;
  const format = (req.query.format as string || 'json').toLowerCase() as 'json' | 'csv';

  // Parse include options from query string
  const include = {
    members: req.query.members !== 'false',
    requests: req.query.requests !== 'false',
    matches: req.query.matches !== 'false',
    norms: req.query.norms !== 'false',
    settings: req.query.settings !== 'false',
    karma: req.query.karma !== 'false',
  };

  const dateStart = req.query.date_start as string;
  const dateEnd = req.query.date_end as string;

  try {
    // Verify user is admin of this community
    const memberCheck = await pool.query(`
      SELECT role FROM community.memberships
      WHERE community_id = $1 AND user_id = $2 AND status = 'active'
    `, [communityId, userId]);

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can export data',
      });
    }

    // Get community info
    const communityResult = await pool.query(`
      SELECT id, name, description, access_type, current_members, max_members, created_at
      FROM community.communities
      WHERE id = $1
    `, [communityId]);

    if (communityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const exportData: any = {
      exported_at: new Date().toISOString(),
      community: communityResult.rows[0],
    };

    // Build date filter
    const dateFilter = [];
    const dateParams: any[] = [communityId];
    let paramIndex = 2;

    if (dateStart) {
      dateFilter.push(`created_at >= $${paramIndex}`);
      dateParams.push(dateStart);
      paramIndex++;
    }
    if (dateEnd) {
      dateFilter.push(`created_at <= $${paramIndex}`);
      dateParams.push(dateEnd);
      paramIndex++;
    }
    const dateClause = dateFilter.length > 0 ? `AND ${dateFilter.join(' AND ')}` : '';

    // Export members
    if (include.members) {
      const membersResult = await pool.query(`
        SELECT
          m.id,
          m.user_id,
          u.name as user_name,
          u.email as user_email,
          m.role,
          m.status,
          m.joined_at,
          m.created_at
        FROM community.memberships m
        JOIN auth.users u ON m.user_id = u.id
        WHERE m.community_id = $1 ${dateClause}
        ORDER BY m.joined_at
      `, dateParams);
      exportData.members = membersResult.rows;
    }

    // Export help requests
    if (include.requests) {
      const requestsResult = await pool.query(`
        SELECT
          r.id,
          r.requester_id,
          u.name as requester_name,
          r.title,
          r.description,
          r.category,
          r.status,
          r.created_at,
          r.expires_at
        FROM requests.help_requests r
        JOIN auth.users u ON r.requester_id = u.id
        WHERE r.community_id = $1 ${dateClause}
        ORDER BY r.created_at DESC
      `, dateParams);
      exportData.requests = requestsResult.rows;
    }

    // Export matches
    if (include.matches) {
      const matchesResult = await pool.query(`
        SELECT
          m.id,
          m.request_id,
          r.title as request_title,
          m.responder_id,
          u.name as responder_name,
          m.status,
          m.created_at,
          m.completed_at
        FROM requests.matches m
        JOIN requests.help_requests r ON m.request_id = r.id
        JOIN auth.users u ON m.responder_id = u.id
        WHERE r.community_id = $1 ${dateClause.replace(/created_at/g, 'm.created_at')}
        ORDER BY m.created_at DESC
      `, dateParams);
      exportData.matches = matchesResult.rows;
    }

    // Export norms
    if (include.norms) {
      const normsResult = await pool.query(`
        SELECT
          n.id,
          n.description,
          n.rationale,
          n.status,
          n.approval_count,
          n.created_by,
          u.name as creator_name,
          n.created_at
        FROM community.norms n
        JOIN auth.users u ON n.created_by = u.id
        WHERE n.community_id = $1 ${dateClause}
        ORDER BY n.created_at
      `, dateParams);
      exportData.norms = normsResult.rows;
    }

    // Export settings
    if (include.settings) {
      const settingsResult = await pool.query(`
        SELECT
          request_ttl_days,
          offer_ttl_days,
          match_ttl_days,
          notification_ttl_days,
          message_ttl_days,
          session_ttl_days,
          karma_decay_enabled,
          karma_half_life_months,
          updated_at
        FROM community.settings
        WHERE community_id = $1
      `, [communityId]);
      exportData.settings = settingsResult.rows[0] || null;
    }

    // Reputation export — Sprint 112 (ADR-082). Member-level karma records, trust scores, and ranks
    // are NOT exported (no admin browsing exception for another member's exact reputation). Instead,
    // a non-identifying community aggregate is included ONLY when at least five active members keep
    // it from being decomposed back to an individual; below that cohort the section is omitted.
    if (include.karma) {
      const aggRes = await pool.query(`
        SELECT
          COUNT(DISTINCT k.user_id)::int AS participating_members,
          COUNT(*)::int AS transaction_count,
          COALESCE(SUM(k.points), 0)::int AS total_karma_points
        FROM reputation.karma_records k
        WHERE k.community_id = $1 ${dateClause}
      `, dateParams);
      const agg = aggRes.rows[0];
      // Suppress on the count of DISTINCT CONTRIBUTING members, not total active membership — a
      // 50-member community where only one person earned karma must still be suppressed, else the
      // totals are that one member's exact reputation.
      if ((agg?.participating_members ?? 0) >= 5) {
        exportData.community_reputation_summary = agg;
      }
    }

    logger.info('Community data exported', {
      communityId,
      userId,
      format,
      includedSections: Object.entries(include).filter(([_, v]) => v).map(([k]) => k),
    });

    // Return data in requested format
    if (format === 'csv') {
      // For CSV, we need to return multiple files or a combined format
      // We'll return a ZIP-like structure as JSON with CSV strings
      // Or just return the main data as CSV

      // For simplicity, return members as the primary CSV export
      // More sophisticated: could use archiver to create a ZIP
      const csvData = include.members ? toCSV(exportData.members || []) : '';

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="community-${communityId}-export.csv"`);
      return res.send(csvData);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="community-${communityId}-export.json"`);
    return res.json({
      success: true,
      data: exportData,
    });

  } catch (error) {
    logger.error('Failed to export community data', error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      message: 'Failed to export community data',
    });
  }
});

// GET /communities/:communityId/export/members
// Export just members in CSV format
router.get('/:communityId/export/members', async (req: Request, res: Response) => {
  const { communityId } = req.params;
  const userId = (req as any).user?.userId;
  const format = (req.query.format as string || 'csv').toLowerCase();

  try {
    // Verify user is admin
    const memberCheck = await pool.query(`
      SELECT role FROM community.memberships
      WHERE community_id = $1 AND user_id = $2 AND status = 'active'
    `, [communityId, userId]);

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can export data',
      });
    }

    const result = await pool.query(`
      SELECT
        u.name as "Name",
        u.email as "Email",
        m.role as "Role",
        m.status as "Status",
        to_char(m.joined_at, 'YYYY-MM-DD') as "Joined Date"
      FROM community.memberships m
      JOIN auth.users u ON m.user_id = u.id
      WHERE m.community_id = $1
      ORDER BY m.joined_at
    `, [communityId]);

    if (format === 'json') {
      return res.json({
        success: true,
        data: result.rows,
      });
    }

    const csv = toCSV(result.rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="members-${communityId}.csv"`);
    return res.send(csv);

  } catch (error) {
    logger.error('Failed to export members', error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      message: 'Failed to export members',
    });
  }
});

// GET /communities/:communityId/export/activity
// Export activity/karma report
router.get('/:communityId/export/activity', async (req: Request, res: Response) => {
  const { communityId } = req.params;
  const userId = (req as any).user?.userId;
  const format = (req.query.format as string || 'csv').toLowerCase();

  try {
    // Verify user is admin
    const memberCheck = await pool.query(`
      SELECT role FROM community.memberships
      WHERE community_id = $1 AND user_id = $2 AND status = 'active'
    `, [communityId, userId]);

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only community admins can export data',
      });
    }

    // Sprint 112 (ADR-082): the stewardship activity report keeps per-member ACTIVITY counts
    // (helps given/received, requests created/completed) but NOT member reputation — no Total Karma,
    // no Trust Score, and no karma-ranked ordering (which would itself reveal relative reputation).
    const result = await pool.query(`
      SELECT
        u.name as "Member",
        COALESCE(t.helps_given, 0) as "Helps Given",
        COALESCE(t.helps_received, 0) as "Helps Received",
        (SELECT COUNT(*) FROM requests.help_requests r
         WHERE r.requester_id = m.user_id AND r.community_id = $1) as "Requests Created",
        (SELECT COUNT(*) FROM requests.matches mt
         JOIN requests.help_requests r ON mt.request_id = r.id
         WHERE mt.responder_id = m.user_id AND r.community_id = $1
         AND mt.status = 'completed') as "Requests Completed"
      FROM community.memberships m
      JOIN auth.users u ON m.user_id = u.id
      LEFT JOIN reputation.trust_scores t ON t.user_id = m.user_id AND t.community_id = $1
      WHERE m.community_id = $1 AND m.status = 'active'
      ORDER BY u.name ASC
    `, [communityId]);

    if (format === 'json') {
      return res.json({
        success: true,
        data: result.rows,
      });
    }

    const csv = toCSV(result.rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="activity-${communityId}.csv"`);
    return res.send(csv);

  } catch (error) {
    logger.error('Failed to export activity', error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      message: 'Failed to export activity report',
    });
  }
});

export default router;
