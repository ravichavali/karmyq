import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

const router = Router();

// Helper: check if the authenticated user is an admin of any community this request belongs to
async function isAdminOfRequestCommunity(requestId: string, user: any): Promise<boolean> {
  const memberships: Array<{ id: string; role: string }> = user.communities ?? [];
  const adminCommunityIds = memberships
    .filter((m) => m.role === 'admin')
    .map((m) => m.id);

  if (adminCommunityIds.length === 0) return false;

  const result = await query(
    `SELECT community_id FROM requests.request_communities WHERE request_id = $1`,
    [requestId]
  );

  const requestCommunityIds: string[] = result.rows.map((r: any) => r.community_id);
  return adminCommunityIds.some((id) => requestCommunityIds.includes(id));
}

// POST /requests/:id/boost — Admin boosts a request for 48 hours
router.post('/:id/boost', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Verify request exists
    const requestCheck = await query(
      `SELECT id FROM requests.help_requests WHERE id = $1`,
      [id]
    );
    if (requestCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Verify admin access
    const isAdmin = await isAdminOfRequestCommunity(id, user);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Not an admin of this request\'s community' });
    }

    const result = await query(
      `UPDATE requests.help_requests
       SET is_boosted = TRUE,
           boosted_at = NOW(),
           boosted_expires_at = NOW() + INTERVAL '48 hours',
           boosted_by = $2
       WHERE id = $1
       RETURNING *`,
      [id, user.userId]
    );

    return res.json({ success: true, data: { request: result.rows[0] } });
  } catch (error: any) {
    console.error('Error boosting request:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /requests/:id/boost — Admin removes boost from a request
router.delete('/:id/boost', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Verify request exists
    const requestCheck = await query(
      `SELECT id FROM requests.help_requests WHERE id = $1`,
      [id]
    );
    if (requestCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Verify admin access
    const isAdmin = await isAdminOfRequestCommunity(id, user);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Not an admin of this request\'s community' });
    }

    const result = await query(
      `UPDATE requests.help_requests
       SET is_boosted = FALSE,
           boosted_at = NULL,
           boosted_expires_at = NULL,
           boosted_by = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return res.json({ success: true, data: { request: result.rows[0] } });
  } catch (error: any) {
    console.error('Error removing boost from request:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /requests/:id/propose-match — Admin proposes a match for a specific user
router.post('/:id/propose-match', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const user = (req as any).user;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }

    // Verify request exists
    const requestCheck = await query(
      `SELECT id FROM requests.help_requests WHERE id = $1`,
      [id]
    );
    if (requestCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Verify admin access
    const isAdmin = await isAdminOfRequestCommunity(id, user);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Not an admin of this request\'s community' });
    }

    // Verify proposed user is a member of one of this request's communities
    const memberCheck = await query(`
      SELECT 1
      FROM community.members cm
      JOIN requests.request_communities rc ON rc.community_id = cm.community_id
      WHERE rc.request_id = $1
        AND cm.user_id = $2
        AND cm.status = 'active'
      LIMIT 1
    `, [id, user_id]);

    if (memberCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Proposed user is not a member of this request\'s community' });
    }

    // Prevent duplicate proposed matches for the same user
    const existingMatch = await query(
      `SELECT id FROM requests.matches WHERE request_id = $1 AND responder_id = $2 AND status = 'proposed'`,
      [id, user_id]
    );
    if (existingMatch.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'A proposed match already exists for this user' });
    }

    const result = await query(
      `INSERT INTO requests.matches (request_id, responder_id, status, admin_proposed)
       VALUES ($1, $2, 'proposed', TRUE)
       RETURNING *`,
      [id, user_id]
    );

    const match = result.rows[0];

    // Optionally publish event — don't break if queue unavailable
    try {
      await publishEvent('match_proposed_by_admin', {
        match_id: match.id,
        request_id: id,
        responder_id: user_id,
        admin_id: user.userId,
      });
    } catch (eventError) {
      console.warn('Could not publish match_proposed_by_admin event:', eventError);
    }

    return res.status(201).json({ success: true, data: { matchId: match.id } });
  } catch (error: any) {
    console.error('Error proposing match:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /requests/:id/urgent — Admin toggles urgency on a request
router.patch('/:id/urgent', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { urgent } = req.body;
    const user = (req as any).user;

    if (typeof urgent !== 'boolean') {
      return res.status(400).json({ success: false, message: 'urgent (boolean) is required' });
    }

    // Verify request exists
    const requestCheck = await query(
      `SELECT id FROM requests.help_requests WHERE id = $1`,
      [id]
    );
    if (requestCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Verify admin access
    const isAdmin = await isAdminOfRequestCommunity(id, user);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Not an admin of this request\'s community' });
    }

    if (urgent) {
      // Always set to 'urgent' when toggling on
      const result = await query(
        `UPDATE requests.help_requests SET urgency = 'urgent', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      return res.json({ success: true, data: { request: result.rows[0] } });
    } else {
      // Only downgrade 'urgent' → 'medium'; do not overwrite 'critical'
      const current = await query(`SELECT urgency FROM requests.help_requests WHERE id = $1`, [id]);
      const currentUrgency = current.rows[0]?.urgency;

      if (currentUrgency === 'critical') {
        // No-op: urgent: false does not affect critical requests
        const existing = await query(`SELECT * FROM requests.help_requests WHERE id = $1`, [id]);
        return res.json({ success: true, data: { request: existing.rows[0] } });
      }

      const result = await query(
        `UPDATE requests.help_requests SET urgency = 'medium', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      return res.json({ success: true, data: { request: result.rows[0] } });
    }
  } catch (error: any) {
    console.error('Error updating urgency:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
