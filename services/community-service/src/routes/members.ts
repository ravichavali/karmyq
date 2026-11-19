import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../database/db';
import { publishEvent } from '../events/publisher';
import { canSeeNonActiveMembers, shapeMemberRows } from '../utils/memberVisibility';
import { getLiveRole, LiveRole } from '../utils/liveRole';
import { canSelfDepart, classifyExistingMembership, departureStatus } from '../utils/memberLifecycle';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendConflict,
  sendInternalError,
  HTTP_STATUS
} from '@karmyq/shared/utils/response';

const router = Router();

// GET /communities/:communityId/members - Get all members of a community
router.get('/:communityId/members', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { status = 'active' } = req.query;
    const callerId = (req as any).user?.userId as string | undefined;

    // BUG-062: only live admins/moderators may list non-active members; emails are admin-only.
    // The default (active) list can never be forbidden, so its role lookup runs alongside the query.
    const listMembers = () => query(
      `SELECT
        m.id, m.user_id, m.role, m.status, m.joined_at,
        m.invited_by,
        u.name as user_name, u.email as user_email,
        inviter.name as invited_by_name,
        calculate_community_layer(m.user_id, m.community_id) as layer
      FROM communities.members m
      LEFT JOIN auth.users u ON m.user_id = u.id
      LEFT JOIN auth.users inviter ON m.invited_by = inviter.id
      WHERE m.community_id = $1 AND m.status = $2
      ORDER BY m.joined_at ASC`,
      [communityId, status]
    );
    let callerRole: LiveRole;
    let result: Awaited<ReturnType<typeof listMembers>>;
    if (status === 'active') {
      [callerRole, result] = await Promise.all([getLiveRole(String(communityId), callerId), listMembers()]);
    } else {
      callerRole = await getLiveRole(String(communityId), callerId);
      if (!canSeeNonActiveMembers(callerRole)) {
        return sendForbidden(res, 'Only community admins or moderators can list non-active members', { requestId: (req as any).id });
      }
      result = await listMembers();
    }

    const rows = shapeMemberRows(result.rows, callerId, callerRole);
    res.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error: any) {
    (req as any).logger?.error('Error fetching members', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'GET /:communityId/members' });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members',
      error: error.message,
    });
  }
});

async function issueMembershipToken(req: Request, userId: string, communityId: string): Promise<string | undefined> {
  try {
    const communitiesResult = await query(
      `SELECT c.id, c.name, m.role
       FROM communities.communities c
       JOIN communities.members m ON m.community_id = c.id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY c.name`,
      [userId]
    );
    return jwt.sign(
      {
        userId,
        email: (req as any).user.email,
        communities: communitiesResult.rows.map((row: any) => ({ id: row.id, role: row.role, name: row.name })),
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
  } catch {
    (req as any).logger?.warn('Failed to generate membership refresh token', { userId, communityId });
    return undefined;
  }
}

// POST /communities/:communityId/join - Join a community (handles public/private)
router.post('/:communityId/join', async (req: any, res: Response) => {
  try {
    const { communityId } = req.params;
    const { message } = req.body;
    const user_id = req.user?.userId;
    if (!user_id) return sendUnauthorized(res, 'Authentication required');

    const communityResult = await query(
      `SELECT id, name, max_members, current_members, status, access_type
       FROM communities.communities WHERE id = $1`, [communityId]
    );
    if (communityResult.rowCount === 0) return sendNotFound(res, 'Community');
    const community = communityResult.rows[0];
    if (community.status !== 'active') return sendError(res, 'COMMUNITY_INACTIVE', 'Community is not active', 400);
    if (community.current_members >= community.max_members) {
      return sendError(res, 'COMMUNITY_FULL', 'Community is full (Dunbar\'s number limit reached)', 400);
    }

    const existingMember = await query(
      `SELECT id, status FROM communities.members WHERE community_id = $1 AND user_id = $2`,
      [communityId, user_id]
    );
    const classification = classifyExistingMembership(existingMember.rows[0]?.status);
    if (classification === 'already_active') return sendConflict(res, 'You are already a member of this community');
    if (classification === 'already_pending') {
      return sendConflict(res, 'You already have a pending join request for this community');
    }
    if (classification === 'staff_only') {
      return sendError(res, 'MEMBERSHIP_RESTORE_REQUIRES_STAFF', 'Only community staff can restore this membership', 409);
    }

    const memberStatus = community.access_type === 'public' ? 'active' : 'pending';
    const member = await withTransaction(async (q) => {
      const result = classification === 'rejoin'
        ? await q(`UPDATE communities.members
            SET role='member',status=$3,join_request_message=$4,joined_at=CURRENT_TIMESTAMP
            WHERE community_id=$1 AND user_id=$2 AND status='left' RETURNING *`,
          [communityId, user_id, memberStatus, message || null])
        : await q(`INSERT INTO communities.members(community_id,user_id,role,status,join_request_message)
            VALUES($1,$2,'member',$3,$4) RETURNING *`,
          [communityId, user_id, memberStatus, message || null]);
      if (result.rowCount === 0) {
        return undefined;
      }
      if (memberStatus === 'active') {
        await q(`UPDATE communities.communities SET current_members=current_members+1 WHERE id=$1`, [communityId]);
      }
      return result.rows[0];
    });
    if (!member) return sendConflict(res, 'Your membership changed; please refresh and try again');

    if (memberStatus === 'active') {
      await publishEvent('user_joined_community', { community_id: communityId, user_id, role: 'member' });
    } else {
      await publishEvent('join_request_created', { community_id: communityId, user_id, message });
    }
    const newToken = memberStatus === 'active'
      ? await issueMembershipToken(req, user_id, communityId)
      : undefined;
    res.status(200).json({
      success: true,
      data: {
        ...member,
        message: memberStatus === 'active' ? 'Successfully joined community' : 'Join request submitted. Waiting for approval.',
        ...(newToken ? { token: newToken } : {}),
      },
    });
  } catch (error: any) {
    if (error.code === '23505' && error.constraint === 'members_community_id_user_id_key') {
      return sendConflict(res, 'You are already a member of this community');
    }
    (req as any).logger?.error('Error joining community', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /:communityId/join' });
    return sendInternalError(res, 'Failed to join community', error);
  }
});

// POST /communities/:communityId/members - Add member to community (join or invite)
router.post('/:communityId/members', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.params;
    const { user_id, role = 'member' } = req.body;
    // SECURITY (BUG-061, ADR-064): only an active admin may add members directly; the inviter
    // is the verified JWT caller. Self-service joining goes through POST /:communityId/join,
    // which applies the community's access policy.
    const invited_by = (req as any).user?.userId;
    if (!invited_by) {
      return sendUnauthorized(res, 'Authentication required');
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    if (!['member', 'moderator', 'admin'].includes(role)) {
      return sendValidationError(res, 'Invalid role');
    }

    const callerCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, invited_by]
    );
    if (callerCheck.rows[0]?.role !== 'admin') {
      return sendForbidden(res, 'Only community admins can add members');
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
      [communityId, user_id, role, invited_by]
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
    (req as any).logger?.error('Error adding member', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /:communityId/members' });
    res.status(500).json({
      success: false,
      message: 'Failed to add member',
      error: error.message,
    });
  }
});

// PUT /communities/:communityId/members/:userId - Update member role/status
// SECURITY: admin_user_id comes from verified JWT token, not from request body
router.put('/:communityId/members/:userId', async (req: Request, res: Response) => {
  try {
    const { communityId, userId } = req.params;
    const { role, status } = req.body;
    // SECURITY: Always use verified userId from JWT, never trust client-provided admin_user_id
    const admin_user_id = (req as any).user?.userId;

    if (!admin_user_id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify admin permission
    const adminCheck = await query(
      `SELECT role FROM communities.members
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [communityId, admin_user_id]
    );

    const callerRole = adminCheck.rows[0]?.role

    if (!callerRole) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or moderators can update members',
      });
    }

    if (callerRole === 'moderator') {
      // Moderators can only update status (approve/reject), not role
      if (req.body.role !== undefined) {
        return res.status(403).json({
          success: false,
          message: 'Moderators cannot change member roles',
        });
      }
      // Allow status-only updates to proceed
    } else if (callerRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins or moderators can update members',
      });
    }
    // callerRole === 'admin': allow all updates

    // Build the update set (validation only — no DB yet).
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

    // Last-admin guard (BUG-001): demoting or deactivating the sole active admin would
    // leave the community adminless. Lock the target and active admins in the same
    // user-id order as DELETE so concurrent membership writes cannot lock in reverse order.
    const demotesRole = role !== undefined && role !== 'admin';
    const deactivates = status !== undefined && status !== 'active';

    const outcome = await withTransaction(async (q) => {
      if (demotesRole || deactivates) {
        const locked = await q(
          `SELECT user_id,role,status FROM communities.members
           WHERE community_id=$1 AND (user_id=$2 OR (role='admin' AND status='active'))
           ORDER BY user_id FOR UPDATE`,
          [communityId, userId]
        );
        const activeAdmins = locked.rows.filter((row: any) => row.role === 'admin' && row.status === 'active');
        const targetIsSoleAdmin =
          activeAdmins.some((r: any) => r.user_id === userId) && activeAdmins.length <= 1;
        if (targetIsSoleAdmin) return { lastAdmin: true as const };
      }

      const result = await q(
        `UPDATE communities.members
         SET ${updates.join(', ')}
         WHERE community_id = $${paramCount} AND user_id = $${paramCount + 1}
         RETURNING *`,
        [...values, communityId, userId]
      );
      return { result };
    });

    if ('lastAdmin' in outcome) {
      return res.status(400).json({
        success: false,
        message: 'Cannot demote the last admin. Assign another admin first.',
      });
    }

    if (outcome.result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    res.json({
      success: true,
      data: outcome.result.rows[0],
      message: 'Member updated successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error updating member', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'PUT /:communityId/members/:userId' });
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
    // SECURITY (ADR-064): the caller's identity comes from the verified JWT, never the
    // request body. Reading admin_user_id from req.body let an attacker spoof an admin —
    // or set it equal to the target userId to fake a "self-remove" and skip the admin
    // check entirely. Mirror the PUT handler's JWT-caller pattern (members.ts:294-295).
    const caller = (req as any).user?.userId;

    if (!caller) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if self-remove or admin remove
    const isSelfRemove = userId === caller;

    if (!isSelfRemove) {
      // Verify admin permission for removing others
      const adminCheck = await query(
        `SELECT role FROM communities.members
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
        [communityId, caller]
      );

      if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can remove other members',
        });
      }
    }

    const outcome = await withTransaction(async (q) => {
      const locked = await q(
        `SELECT user_id,role,status FROM communities.members
         WHERE community_id=$1 AND (user_id=$2 OR (role='admin' AND status='active'))
         ORDER BY user_id FOR UPDATE`,
        [communityId, userId]
      );
      const target = locked.rows.find((row: any) => row.user_id === userId);
      if (!target) return 'not_found' as const;
      if (isSelfRemove && !canSelfDepart(target.status)) return 'invalid_departure' as const;
      const activeAdmins = locked.rows.filter((row: any) => row.role === 'admin' && row.status === 'active');
      if (activeAdmins.some((row: any) => row.user_id === userId) && activeAdmins.length <= 1) {
        return 'last_admin' as const;
      }
      await q(`UPDATE communities.members SET status=$3 WHERE community_id=$1 AND user_id=$2`,
        [communityId, userId, departureStatus(isSelfRemove)]);
      if (target.status === 'active') {
        await q(`UPDATE communities.communities SET current_members=current_members-1 WHERE id=$1`, [communityId]);
      }
      return { wasActive: target.status === 'active' };
    });

    if (outcome === 'not_found') {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    if (outcome === 'invalid_departure') {
      return sendConflict(res, 'Only active or pending memberships can be left directly');
    }
    if (outcome === 'last_admin') {
      return res.status(400).json({ success: false, message: 'Cannot remove the last admin. Assign another admin first.' });
    }

    const newToken = isSelfRemove && outcome.wasActive
      ? await issueMembershipToken(req, caller, String(communityId))
      : undefined;
    await publishEvent('user_left_community', {
      community_id: communityId,
      user_id: userId,
      removed_by: caller,
      is_self_remove: isSelfRemove,
    });
    res.json({
      success: true,
      data: { ...(newToken ? { token: newToken } : {}) },
      message: isSelfRemove ? 'Left community successfully' : 'Member removed successfully',
    });
  } catch (error: any) {
    (req as any).logger?.error('Error removing member', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'DELETE /:communityId/members/:userId' });
    return sendInternalError(res, 'Failed to remove member', error);
  }
});

export default router;
