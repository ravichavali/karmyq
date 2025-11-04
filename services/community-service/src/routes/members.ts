import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { publishEvent } from '../events/publisher';

const router = Router();

// GET /communities/:communityId/members - Get all members of a community
router.get('/:communityId/members', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { status = 'active' } = req.query;

    const result = await query(
      `SELECT
        m.id, m.user_id, m.role, m.status, m.joined_at,
        m.invited_by,
        u.name as user_name, u.email as user_email,
        inviter.name as invited_by_name
      FROM communities.members m
      LEFT JOIN auth.users u ON m.user_id = u.id
      LEFT JOIN auth.users inviter ON m.invited_by = inviter.id
      WHERE m.community_id = $1 AND m.status = $2
      ORDER BY m.joined_at ASC`,
      [communityId, status]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members',
      error: error.message,
    });
  }
});

// POST /communities/:communityId/members - Add member to community (join or invite)
router.post('/:communityId/members', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { user_id, invited_by, role = 'member' } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    // Check if community exists and is not full
    const communityResult = await query(
      `SELECT id, max_members, current_members, status
       FROM communities.communities
       WHERE id = $1`,
      [communityId]
    );

    if (communityResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const community = communityResult.rows[0];

    if (community.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Community is not active',
      });
    }

    if (community.current_members >= community.max_members) {
      return res.status(400).json({
        success: false,
        message: 'Community is full (Dunbar\'s number limit reached)',
      });
    }

    // Check if user is already a member
    const existingMember = await query(
      `SELECT id, status FROM communities.members
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, user_id]
    );

    if (existingMember.rowCount && existingMember.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this community',
      });
    }

    // Add member
    const memberResult = await query(
      `INSERT INTO communities.members
        (community_id, user_id, role, invited_by, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING *`,
      [communityId, user_id, role, invited_by || null]
    );

    // Increment current_members count
    await query(
      `UPDATE communities.communities
       SET current_members = current_members + 1
       WHERE id = $1`,
      [communityId]
    );

    // Publish event
    await publishEvent('user_joined_community', {
      community_id: communityId,
      user_id,
      invited_by,
      role,
    });

    res.status(201).json({
      success: true,
      data: memberResult.rows[0],
      message: 'Member added successfully',
    });
  } catch (error: any) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member',
      error: error.message,
    });
  }
});

// PUT /communities/:communityId/members/:userId - Update member role/status
router.put('/:communityId/members/:userId', async (req: Request, res: Response) => {
  try {
    const { communityId, userId } = req.params;
    const { role, status, admin_user_id } = req.body;

    // Verify admin permission
    const adminCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, admin_user_id]
    );

    if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update member roles or status',
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided',
      });
    }

    values.push(communityId, userId);

    const result = await query(
      `UPDATE communities.members
       SET ${updates.join(', ')}
       WHERE community_id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Member updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update member',
      error: error.message,
    });
  }
});

// DELETE /communities/:communityId/members/:userId - Remove member (leave or kick)
router.delete('/:communityId/members/:userId', async (req: Request, res: Response) => {
  try {
    const { communityId, userId } = req.params;
    const { admin_user_id } = req.body;

    // Check if self-remove or admin remove
    const isSelfRemove = userId === admin_user_id;

    if (!isSelfRemove) {
      // Verify admin permission for removing others
      const adminCheck = await query(
        `SELECT role FROM communities.members
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
        [communityId, admin_user_id]
      );

      if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can remove other members',
        });
      }
    }

    // Check if member exists
    const memberResult = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );

    if (memberResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    // Prevent removing the last admin
    if (memberResult.rows[0].role === 'admin') {
      const adminCount = await query(
        `SELECT COUNT(*) as count FROM communities.members
         WHERE community_id = $1 AND role = 'admin' AND status = 'active'`,
        [communityId]
      );

      if (adminCount.rows[0].count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the last admin. Assign another admin first.',
        });
      }
    }

    // Remove member (soft delete)
    await query(
      `UPDATE communities.members
       SET status = 'inactive'
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );

    // Decrement current_members count
    await query(
      `UPDATE communities.communities
       SET current_members = current_members - 1
       WHERE id = $1`,
      [communityId]
    );

    // Publish event
    await publishEvent('user_left_community', {
      community_id: communityId,
      user_id: userId,
      removed_by: admin_user_id,
      is_self_remove: isSelfRemove,
    });

    res.json({
      success: true,
      message: isSelfRemove ? 'Left community successfully' : 'Member removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message,
    });
  }
});

export default router;
