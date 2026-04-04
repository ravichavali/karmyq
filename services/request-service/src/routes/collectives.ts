import { Router, Response } from 'express';
import { query } from '../database/db';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware/auth';
import type { CreateCollectiveInput } from '@karmyq/shared/schemas/providers';

const router = Router();

// GET /requests/collectives - List collectives, filter by service_type
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { service_type, community_id, unlinked_from, limit = 20, offset = 0 } = req.query;

    let queryText = `
      SELECT
        pc.id, pc.name, pc.description, pc.service_types, pc.location_notes,
        pc.is_active, pc.created_by, pc.created_at, pc.updated_at,
        COUNT(DISTINCT pcm.provider_id) as member_count,
        AVG(pts.trust_score) as avg_trust_score
      FROM requests.provider_collectives pc
      LEFT JOIN requests.provider_collective_members pcm ON pc.id = pcm.collective_id
      LEFT JOIN reputation.provider_trust_scores pts ON pcm.provider_id = pts.provider_id
      WHERE pc.is_active = TRUE
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (service_type) {
      queryText += ` AND $${paramCount} = ANY(pc.service_types)`;
      params.push(service_type);
      paramCount++;
    }

    if (community_id) {
      queryText += ` AND pc.id IN (
        SELECT collective_id FROM requests.collective_community_links
        WHERE community_id = $${paramCount} AND status = 'active'
      )`;
      params.push(community_id);
      paramCount++;
    }

    if (unlinked_from) {
      queryText += ` AND pc.id NOT IN (
        SELECT collective_id FROM requests.collective_community_links
        WHERE community_id = $${paramCount} AND status = 'active'
      )`;
      params.push(unlinked_from);
      paramCount++;
    }

    queryText += `
      GROUP BY pc.id
      ORDER BY AVG(pts.trust_score) DESC NULLS LAST, pc.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows.map((row: any) => ({
        ...row,
        member_count: parseInt(row.member_count, 10),
        avg_trust_score: row.avg_trust_score ? parseFloat(row.avg_trust_score) : null,
      })),
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching collectives', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch collectives', error: error.message });
  }
});

// GET /requests/collectives/my - Get collectives the authenticated user belongs to (via their provider profiles)
router.get('/my', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await query(`
      SELECT DISTINCT
        pc.id, pc.name, pc.description, pc.service_types, pc.location_notes,
        pc.is_active, pc.created_at, pc.updated_at
      FROM requests.provider_collectives pc
      JOIN requests.provider_collective_members pcm ON pc.id = pcm.collective_id
      JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
      WHERE pp.user_id = $1 AND pc.is_active = TRUE
      ORDER BY pc.created_at ASC
    `, [userId]);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching user collectives', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch collectives', error: error.message });
  }
});

// GET /requests/collectives/:id/stats - Collective performance stats
// MUST be registered before /:id to avoid Express consuming 'stats' as an id param
router.get('/:id/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        (
          SELECT COUNT(DISTINCT m.request_id)
          FROM requests.matches m
          JOIN auth.users u ON m.responder_id = u.id
          JOIN requests.provider_profiles pp ON pp.user_id = u.id
          JOIN requests.provider_collective_members pcm ON pcm.provider_id = pp.id
          WHERE pcm.collective_id = $1
        ) AS total_requests_matched,
        (
          SELECT CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(COUNT(*) FILTER (WHERE m.status = 'completed')::numeric / COUNT(*) * 100, 1)
          END
          FROM requests.matches m
          JOIN auth.users u ON m.responder_id = u.id
          JOIN requests.provider_profiles pp ON pp.user_id = u.id
          JOIN requests.provider_collective_members pcm ON pcm.provider_id = pp.id
          WHERE pcm.collective_id = $1
        ) AS fulfillment_rate,
        (
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600)::numeric, 1)
          FROM requests.matches m
          JOIN auth.users u ON m.responder_id = u.id
          JOIN requests.provider_profiles pp ON pp.user_id = u.id
          JOIN requests.provider_collective_members pcm ON pcm.provider_id = pp.id
          WHERE pcm.collective_id = $1 AND m.completed_at IS NOT NULL
        ) AS avg_completion_hours,
        (
          SELECT COUNT(*)
          FROM requests.collective_community_links
          WHERE collective_id = $1 AND status = 'active'
        ) AS communities_served_count,
        (
          SELECT COUNT(*)
          FROM requests.provider_collective_members pcm
          JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
          WHERE pcm.collective_id = $1 AND pp.is_available = TRUE AND pp.is_active = TRUE
        ) AS available_member_count`,
      [id]
    );

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        total_requests_matched: parseInt(row.total_requests_matched, 10),
        fulfillment_rate: parseFloat(row.fulfillment_rate) || 0,
        avg_completion_hours: row.avg_completion_hours != null ? parseFloat(row.avg_completion_hours) : null,
        communities_served_count: parseInt(row.communities_served_count, 10),
        available_member_count: parseInt(row.available_member_count, 10),
      },
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching collective stats', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch collective stats', error: error.message });
  }
});

// GET /requests/collectives/:id - Collective detail with members + communities served
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const collectiveResult = await query(
      `SELECT
        pc.id, pc.name, pc.description, pc.service_types, pc.location_notes,
        pc.is_active, pc.created_by, pc.created_at, pc.updated_at,
        COUNT(DISTINCT pcm.provider_id) as member_count,
        AVG(pts.trust_score) as avg_trust_score
      FROM requests.provider_collectives pc
      LEFT JOIN requests.provider_collective_members pcm ON pc.id = pcm.collective_id
      LEFT JOIN reputation.provider_trust_scores pts ON pcm.provider_id = pts.provider_id
      WHERE pc.id = $1
      GROUP BY pc.id`,
      [id]
    );

    if (collectiveResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Collective not found' });
    }

    const collective = collectiveResult.rows[0];
    collective.member_count = parseInt(collective.member_count, 10);
    collective.avg_trust_score = collective.avg_trust_score ? parseFloat(collective.avg_trust_score) : null;

    // Get members with provider info
    const membersResult = await query(
      `SELECT
        pcm.collective_id, pcm.provider_id, pcm.role, pcm.joined_at,
        pp.display_name, pp.service_type, pp.bio, pp.pricing_notes, pp.is_available,
        pts.trust_score, pts.avg_stars, pts.total_reviews
      FROM requests.provider_collective_members pcm
      JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
      LEFT JOIN reputation.provider_trust_scores pts ON pp.id = pts.provider_id
      WHERE pcm.collective_id = $1
      ORDER BY pcm.role DESC, pcm.joined_at ASC`,
      [id]
    );

    // Get communities served
    const communitiesResult = await query(
      `SELECT
        ccl.collective_id, ccl.community_id, ccl.status, ccl.established_at,
        c.name as community_name
      FROM requests.collective_community_links ccl
      JOIN communities.communities c ON ccl.community_id = c.id
      WHERE ccl.collective_id = $1 AND ccl.status = 'active'
      ORDER BY ccl.established_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...collective,
        members: membersResult.rows,
        communities: communitiesResult.rows,
      },
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching collective', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to fetch collective', error: error.message });
  }
});

// POST /requests/collectives - Create collective
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, description, service_types = [], location_notes }: CreateCollectiveInput = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const result = await query(
      `INSERT INTO requests.provider_collectives
        (name, description, service_types, location_notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description || null, service_types, location_notes || null, userId]
    );

    const collective = result.rows[0];

    // Creator becomes admin member (requires a provider profile)
    const providerCheck = await query(
      `SELECT id FROM requests.provider_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (providerCheck.rowCount && providerCheck.rowCount > 0) {
      await query(
        `INSERT INTO requests.provider_collective_members (collective_id, provider_id, role)
         VALUES ($1, $2, 'admin')
         ON CONFLICT DO NOTHING`,
        [collective.id, providerCheck.rows[0].id]
      );
    }

    res.status(201).json({ success: true, data: collective });
  } catch (error: any) {
    (req as any).logger?.error('Error creating collective', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to create collective', error: error.message });
  }
});

// PUT /requests/collectives/:id - Update collective (collective admin only)
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, description, service_types, location_notes, is_active } = req.body;

    const adminCheck = await query(
      `SELECT pcm.role FROM requests.provider_collective_members pcm
       JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
       WHERE pcm.collective_id = $1 AND pp.user_id = $2 AND pcm.role = 'admin'`,
      [id, userId]
    );

    if (adminCheck.rowCount === 0) {
      // Also allow the creator
      const creatorCheck = await query(
        `SELECT id FROM requests.provider_collectives WHERE id = $1 AND created_by = $2`,
        [id, userId]
      );
      if (creatorCheck.rowCount === 0) {
        return res.status(403).json({ success: false, message: 'Only collective admins can update' });
      }
    }

    const result = await query(
      `UPDATE requests.provider_collectives
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         service_types = COALESCE($3, service_types),
         location_notes = COALESCE($4, location_notes),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, description, service_types, location_notes, is_active, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Collective not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    (req as any).logger?.error('Error updating collective', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to update collective', error: error.message });
  }
});

// DELETE /requests/collectives/:id - Delete collective (collective admin only)
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const creatorCheck = await query(
      `SELECT id FROM requests.provider_collectives WHERE id = $1 AND created_by = $2`,
      [id, userId]
    );

    if (creatorCheck.rowCount === 0) {
      return res.status(403).json({ success: false, message: 'Only the collective creator can delete it' });
    }

    await query(`DELETE FROM requests.provider_collectives WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Collective deleted' });
  } catch (error: any) {
    (req as any).logger?.error('Error deleting collective', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to delete collective', error: error.message });
  }
});

// POST /requests/collectives/:id/members - Join collective (user's provider profile joins)
router.post('/:id/members', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { provider_id, role = 'member' } = req.body;

    // If provider_id provided, verify caller is collective admin; otherwise use caller's own provider profile
    let resolvedProviderId = provider_id;

    if (!resolvedProviderId) {
      const providerResult = await query(
        `SELECT id FROM requests.provider_profiles WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (providerResult.rowCount === 0) {
        return res.status(400).json({ success: false, message: 'You must have a provider profile to join a collective' });
      }
      resolvedProviderId = providerResult.rows[0].id;
    } else {
      // Verify caller is admin when adding someone else
      const adminCheck = await query(
        `SELECT pcm.role FROM requests.provider_collective_members pcm
         JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
         WHERE pcm.collective_id = $1 AND pp.user_id = $2 AND pcm.role = 'admin'`,
        [id, userId]
      );
      if (adminCheck.rowCount === 0) {
        return res.status(403).json({ success: false, message: 'Only collective admins can add other providers' });
      }
    }

    await query(
      `INSERT INTO requests.provider_collective_members (collective_id, provider_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (collective_id, provider_id) DO NOTHING`,
      [id, resolvedProviderId, role]
    );

    res.status(201).json({ success: true, message: 'Joined collective' });
  } catch (error: any) {
    (req as any).logger?.error('Error joining collective', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to join collective', error: error.message });
  }
});

// DELETE /requests/collectives/:id/members/:providerId - Remove member
router.delete('/:id/members/:providerId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, providerId } = req.params;

    // Allow self-removal or admin removal
    const ownProfileCheck = await query(
      `SELECT pp.id FROM requests.provider_profiles pp
       WHERE pp.id = $1 AND pp.user_id = $2`,
      [providerId, userId]
    );

    if (ownProfileCheck.rowCount === 0) {
      const adminCheck = await query(
        `SELECT pcm.role FROM requests.provider_collective_members pcm
         JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
         WHERE pcm.collective_id = $1 AND pp.user_id = $2 AND pcm.role = 'admin'`,
        [id, userId]
      );
      if (adminCheck.rowCount === 0) {
        return res.status(403).json({ success: false, message: 'Cannot remove this member' });
      }
    }

    await query(
      `DELETE FROM requests.provider_collective_members WHERE collective_id = $1 AND provider_id = $2`,
      [id, providerId]
    );

    res.json({ success: true, message: 'Member removed' });
  } catch (error: any) {
    (req as any).logger?.error('Error removing member', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to remove member', error: error.message });
  }
});

// POST /requests/collectives/:id/communities - Link collective to a community
router.post('/:id/communities', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { community_id } = req.body;

    if (!community_id) {
      return res.status(400).json({ success: false, message: 'community_id is required' });
    }

    // Allow collective admins/creator OR community admins
    const authCheck = await query(
      `SELECT 1 FROM requests.provider_collectives pc
       LEFT JOIN requests.provider_collective_members pcm ON pc.id = pcm.collective_id
       LEFT JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
       WHERE pc.id = $1 AND (pc.created_by = $2 OR (pp.user_id = $2 AND pcm.role = 'admin'))
       LIMIT 1`,
      [id, userId]
    );

    const memberships = req.user!.communities ?? [];
    const isCommunityAdmin = memberships.some(
      (m: any) => m.id === community_id && m.role === 'admin'
    );

    if (authCheck.rowCount === 0 && !isCommunityAdmin) {
      return res.status(403).json({ success: false, message: 'Only collective admins or community admins can link to communities' });
    }

    await query(
      `INSERT INTO requests.collective_community_links (collective_id, community_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (collective_id, community_id) DO UPDATE SET status = 'active'`,
      [id, community_id]
    );

    res.status(201).json({ success: true, message: 'Linked to community' });
  } catch (error: any) {
    (req as any).logger?.error('Error linking community', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to link community', error: error.message });
  }
});

// DELETE /requests/collectives/:id/communities/:communityId - Unlink
router.delete('/:id/communities/:communityId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, communityId } = req.params;

    const authCheck = await query(
      `SELECT 1 FROM requests.provider_collectives pc
       LEFT JOIN requests.provider_collective_members pcm ON pc.id = pcm.collective_id
       LEFT JOIN requests.provider_profiles pp ON pcm.provider_id = pp.id
       WHERE pc.id = $1 AND (pc.created_by = $2 OR (pp.user_id = $2 AND pcm.role = 'admin'))
       LIMIT 1`,
      [id, userId]
    );

    const memberships = req.user!.communities ?? [];
    const isCommunityAdmin = memberships.some(
      (m: any) => m.id === communityId && m.role === 'admin'
    );

    if (authCheck.rowCount === 0 && !isCommunityAdmin) {
      return res.status(403).json({ success: false, message: 'Only collective admins or community admins can unlink communities' });
    }

    await query(
      `UPDATE requests.collective_community_links SET status = 'inactive' WHERE collective_id = $1 AND community_id = $2`,
      [id, communityId]
    );

    res.json({ success: true, message: 'Unlinked from community' });
  } catch (error: any) {
    (req as any).logger?.error('Error unlinking community', error instanceof Error ? error : new Error(String(error)), { service: 'request-service' });
    res.status(500).json({ success: false, message: 'Failed to unlink community', error: error.message });
  }
});

export default router;
