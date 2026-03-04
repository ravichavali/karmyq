import { Router, Response } from 'express';
import { query } from '../database/db';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendConflict,
  sendInternalError,
} from '@karmyq/shared/utils/response';

const router = Router();

// Helper: verify the requesting user is an admin of the given community
async function isAdmin(userId: string, communityId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM communities.members
     WHERE community_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'`,
    [communityId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// Helper: fetch a link by id, returning both community IDs
async function getLinkById(linkId: string) {
  const result = await query(
    `SELECT * FROM communities.community_links WHERE id = $1`,
    [linkId]
  );
  return result.rows[0] ?? null;
}

// POST /communities/:communityId/links
// Propose a link from communityId to another community (admin-only)
router.post('/:communityId/links', async (req: any, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user?.userId;

    if (!userId) return sendUnauthorized(res, 'Authentication required');

    const adminOfA = await isAdmin(userId, communityId);
    if (!adminOfA) {
      return sendError(res, 'FORBIDDEN', 'Only admins of this community can propose links', 403);
    }

    const { target_community_id, link_type = 'sister', trust_carry_factor, show_in_sister_feeds = false } = req.body;

    if (!target_community_id) {
      return sendValidationError(res, 'target_community_id is required');
    }
    if (!['sister', 'parent_child', 'split_origin'].includes(link_type)) {
      return sendValidationError(res, 'link_type must be sister, parent_child, or split_origin');
    }
    if (target_community_id === communityId) {
      return sendValidationError(res, 'Cannot link a community to itself');
    }

    // Verify target community exists
    const targetResult = await query(
      `SELECT id, name FROM communities.communities WHERE id = $1 AND status = 'active'`,
      [target_community_id]
    );
    if (targetResult.rowCount === 0) {
      return sendNotFound(res, 'Target community');
    }

    // Check for existing link (in either direction)
    const existing = await query(
      `SELECT id, status FROM communities.community_links
       WHERE (community_a_id = $1 AND community_b_id = $2)
          OR (community_a_id = $2 AND community_b_id = $1)`,
      [communityId, target_community_id]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return sendConflict(res, 'A link between these communities already exists');
    }

    const defaultCarry = link_type === 'parent_child' ? 0.60 : link_type === 'split_origin' ? 0.50 : 0.40;
    const carryFactor = trust_carry_factor !== undefined ? Number(trust_carry_factor) : defaultCarry;

    if (carryFactor < 0 || carryFactor > 1) {
      return sendValidationError(res, 'trust_carry_factor must be between 0 and 1');
    }

    const result = await query(
      `INSERT INTO communities.community_links
         (community_a_id, community_b_id, link_type, trust_carry_factor, show_in_sister_feeds, created_by_admin_a, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [communityId, target_community_id, link_type, carryFactor, show_in_sister_feeds, userId]
    );

    return sendSuccess(res, result.rows[0], 201);
  } catch (error: any) {
    return sendInternalError(res, error);
  }
});

// PUT /communities/:communityId/links/:linkId
// Approve a pending link (admin of the other community), or update trust settings (either admin)
router.put('/:communityId/links/:linkId', async (req: any, res: Response) => {
  try {
    const { communityId, linkId } = req.params;
    const userId = req.user?.userId;

    if (!userId) return sendUnauthorized(res, 'Authentication required');

    const link = await getLinkById(linkId);
    if (!link) return sendNotFound(res, 'Link');

    // Ensure this community is part of the link
    const isPartyA = link.community_a_id === communityId;
    const isPartyB = link.community_b_id === communityId;
    if (!isPartyA && !isPartyB) {
      return sendError(res, 'FORBIDDEN', 'This community is not part of the link', 403);
    }

    const adminOfThis = await isAdmin(userId, communityId);
    if (!adminOfThis) {
      return sendError(res, 'FORBIDDEN', 'Only admins can update community links', 403);
    }

    const { action, trust_carry_factor, show_in_sister_feeds } = req.body;

    // Approval: only the other community's admin (party B) can approve
    if (action === 'approve') {
      if (link.status !== 'pending') {
        return sendError(res, 'INVALID_STATE', 'Link is not pending approval', 400);
      }
      if (isPartyA) {
        return sendError(res, 'FORBIDDEN', 'Only the other community admin can approve this link', 403);
      }
      const result = await query(
        `UPDATE communities.community_links
         SET status = 'active', created_by_admin_b = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [userId, linkId]
      );
      return sendSuccess(res, result.rows[0]);
    }

    // Deactivate
    if (action === 'deactivate') {
      const result = await query(
        `UPDATE communities.community_links SET status = 'inactive', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [linkId]
      );
      return sendSuccess(res, result.rows[0]);
    }

    // Update settings (trust_carry_factor, show_in_sister_feeds)
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (trust_carry_factor !== undefined) {
      const carry = Number(trust_carry_factor);
      if (carry < 0 || carry > 1) return sendValidationError(res, 'trust_carry_factor must be 0–1');
      updates.push(`trust_carry_factor = $${idx++}`);
      values.push(carry);
    }
    if (show_in_sister_feeds !== undefined) {
      updates.push(`show_in_sister_feeds = $${idx++}`);
      values.push(Boolean(show_in_sister_feeds));
    }

    if (updates.length === 0) {
      return sendValidationError(res, 'No valid fields to update. Use action=approve/deactivate or provide trust_carry_factor/show_in_sister_feeds');
    }

    updates.push(`updated_at = NOW()`);
    values.push(linkId);
    const result = await query(
      `UPDATE communities.community_links SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return sendSuccess(res, result.rows[0]);
  } catch (error: any) {
    return sendInternalError(res, error);
  }
});

// GET /communities/:communityId/links
// List all links for a community (active and pending)
router.get('/:communityId/links', async (req: any, res: Response) => {
  try {
    const { communityId } = req.params;
    const { status } = req.query;

    const statusFilter = status ? `AND cl.status = $2` : '';
    const params: any[] = [communityId];
    if (status) params.push(status);

    const result = await query(
      `SELECT
        cl.*,
        ca.name AS community_a_name,
        cb.name AS community_b_name,
        CASE
          WHEN cl.community_a_id = $1 THEN cl.community_b_id
          ELSE cl.community_a_id
        END AS partner_community_id,
        CASE
          WHEN cl.community_a_id = $1 THEN cb.name
          ELSE ca.name
        END AS partner_community_name
       FROM communities.community_links cl
       JOIN communities.communities ca ON ca.id = cl.community_a_id
       JOIN communities.communities cb ON cb.id = cl.community_b_id
       WHERE (cl.community_a_id = $1 OR cl.community_b_id = $1)
         ${statusFilter}
       ORDER BY cl.created_at DESC`,
      params
    );

    return sendSuccess(res, { links: result.rows, count: result.rowCount });
  } catch (error: any) {
    return sendInternalError(res, error);
  }
});

// DELETE /communities/:communityId/links/:linkId
// Remove (set inactive) a link — either admin can do this
router.delete('/:communityId/links/:linkId', async (req: any, res: Response) => {
  try {
    const { communityId, linkId } = req.params;
    const userId = req.user?.userId;

    if (!userId) return sendUnauthorized(res, 'Authentication required');

    const link = await getLinkById(linkId);
    if (!link) return sendNotFound(res, 'Link');

    if (link.community_a_id !== communityId && link.community_b_id !== communityId) {
      return sendError(res, 'FORBIDDEN', 'This community is not part of the link', 403);
    }

    const adminOfThis = await isAdmin(userId, communityId);
    if (!adminOfThis) {
      return sendError(res, 'FORBIDDEN', 'Only admins can remove community links', 403);
    }

    await query(
      `UPDATE communities.community_links SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [linkId]
    );

    return sendSuccess(res, { message: 'Link removed' });
  } catch (error: any) {
    return sendInternalError(res, error);
  }
});

export default router;
