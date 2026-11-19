import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../database/db';
import { publishEvent } from '../events/publisher';
import { canSeeNonActiveMembers, shapeMemberRows } from '../utils/memberVisibility';
import { getLiveRole, LiveRole } from '../utils/liveRole';
import { canSelfDepart, classifyExistingMembership, departureStatus } from '../utils/memberLifecycle';
import { canonicalUuid } from '../utils/uuid';
import { planStaffChange, validateStaffBody, CallerRole, Refusal } from '../utils/staffTransitions';
import { assertWithinCapacity, CommunityFullError } from '../database/memberCapacity';

const COMMUNITY_FULL_MESSAGE = 'Community is full (Dunbar\'s number limit reached)';
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
    // Friendly early refusal only; the post-check inside the transaction is authoritative.
    if (community.current_members >= community.max_members) {
      return sendError(res, 'COMMUNITY_FULL', COMMUNITY_FULL_MESSAGE, 400);
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
      // ADR-106: the sync trigger counted the active row; re-check capacity after it, on this client.
      if (memberStatus === 'active') await assertWithinCapacity(q, communityId);
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
    if (error instanceof CommunityFullError) {
      return sendError(res, 'COMMUNITY_FULL', COMMUNITY_FULL_MESSAGE, 400);
    }
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
    const { role = 'member' } = req.body;
    // SECURITY (BUG-061, ADR-064): only an active admin may add members directly; the inviter
    // is the verified JWT caller. Self-service joining goes through POST /:communityId/join,
    // which applies the community's access policy.
    const invited_by = (req as any).user?.userId;
    if (!invited_by) {
      return sendUnauthorized(res, 'Authentication required');
    }

    // Sprint 144 (BUG-104): canonical at parse, so every later comparison sees the DB's spelling.
    if (req.body?.user_id === undefined || req.body?.user_id === null || req.body?.user_id === '') {
      return sendValidationError(res, 'user_id is required');
    }
    const user_id = canonicalUuid(req.body.user_id);
    if (!user_id) {
      return sendValidationError(res, 'user_id must be a valid UUID');
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
      return sendNotFound(res, 'Community');
    }

    const community = communityResult.rows[0];

    if (community.status !== 'active') {
      return sendError(res, 'COMMUNITY_INACTIVE', 'Community is not active', 400);
    }

    // Friendly early refusal only; the post-check inside the transaction is authoritative.
    if (community.current_members >= community.max_members) {
      return sendError(res, 'COMMUNITY_FULL', COMMUNITY_FULL_MESSAGE, 400);
    }

    // Check if user is already a member
    const existingMember = await query(
      `SELECT id, status FROM communities.members
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, user_id]
    );

    if (existingMember.rowCount && existingMember.rowCount > 0) {
      return sendError(res, 'ALREADY_MEMBER', 'User is already a member of this community', 400);
    }

    // Decision 10 (BUG-107): staff direct-add stays a documented consent exception; it activates the
    // user directly. ADR-106: the sync trigger counts the row; capacity is re-checked after it.
    const member = await withTransaction(async (q) => {
      const inserted = await q(
        `INSERT INTO communities.members
          (community_id, user_id, role, invited_by, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *`,
        [communityId, user_id, role, invited_by]
      );
      await assertWithinCapacity(q, String(communityId));
      return inserted.rows[0];
    });

    // Publish event
    await publishEvent('user_joined_community', {
      community_id: communityId,
      user_id,
      invited_by,
      role,
    });

    res.status(201).json({
      success: true,
      data: member,
      message: 'Member added successfully',
    });
  } catch (error: any) {
    if (error instanceof CommunityFullError) {
      return sendError(res, 'COMMUNITY_FULL', COMMUNITY_FULL_MESSAGE, 400);
    }
    if (error.code === '23505' && error.constraint === 'members_community_id_user_id_key') {
      return sendError(res, 'ALREADY_MEMBER', 'User is already a member of this community', 400);
    }
    (req as any).logger?.error('Error adding member', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'POST /:communityId/members' });
    return sendInternalError(res, 'Failed to add member', error);
  }
});

// PUT /communities/:communityId/members/:userId - Staff change to someone else's membership
// Sprint 144 (BUG-104, BUG-105, decision 8): the route executes the transition table in
// utils/staffTransitions.ts. Inside ONE transaction it locks the target and the active admins in the
// same user-id order as DELETE, then reads the caller's LIVE role on that client (ADR-102), plans, and
// writes. Every demotion or removal of staff is itself a locked PUT/DELETE over the same admin rows,
// so it serializes with this request: a moderator demoted before this lock is granted cannot write.
// SECURITY: the caller comes from the verified JWT; the legacy body admin_user_id is ignored.
router.put('/:communityId/members/:userId', async (req: Request, res: Response) => {
  try {
    const caller = (req as any).user?.userId;
    if (!caller) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const communityId = canonicalUuid(req.params.communityId);
    const userId = canonicalUuid(req.params.userId);
    if (!communityId || !userId) {
      return sendValidationError(res, 'communityId and userId must be valid UUIDs');
    }
    const parsed = validateStaffBody(req.body);
    if (parsed.kind === 'refuse') return sendRefusal(res, parsed);

    const outcome = await withTransaction(async (q) => {
      const locked = await q(
        `SELECT user_id,role,status FROM communities.members
         WHERE community_id=$1 AND (user_id=$2 OR (role='admin' AND status='active'))
         ORDER BY user_id FOR UPDATE`,
        [communityId, userId]
      );
      const callerRow = await q(
        `SELECT role FROM communities.members
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
        [communityId, caller]
      );
      // `role` is nullable with DEFAULT 'member': an active row is a membership whatever its role says.
      const callerRole = callerRow.rows.length > 0 ? ((callerRow.rows[0].role ?? 'member') as CallerRole) : null;

      const targetRow = locked.rows.find((row: any) => row.user_id === userId);
      const activeAdmins = locked.rows.filter((row: any) => row.role === 'admin' && row.status === 'active');
      const target = targetRow
        ? {
            status: targetRow.status,
            role: targetRow.role,
            isSoleActiveAdmin: activeAdmins.length <= 1 && activeAdmins.some((row: any) => row.user_id === userId),
          }
        : null;

      const plan = planStaffChange(callerRole, target, req.body);
      if (plan.kind === 'refuse') return plan;

      const values: any[] = [communityId, userId];
      const assignments: string[] = [];
      if (plan.set.status) {
        values.push(plan.set.status);
        assignments.push(`status = $${values.length}`);
      }
      if (plan.set.role) {
        values.push(plan.set.role);
        assignments.push(`role = $${values.length}`);
      }
      // ADR-106: the sync trigger applies any active-delta of this status change.
      const updated = await q(
        `UPDATE communities.members SET ${assignments.join(', ')}
         WHERE community_id = $1 AND user_id = $2
         RETURNING *`,
        values
      );
      if (plan.admits) await assertWithinCapacity(q, communityId);
      return { member: updated.rows[0] };
    });

    if ('kind' in outcome) return sendRefusal(res, outcome);

    res.json({
      success: true,
      data: outcome.member,
      message: 'Member updated successfully',
    });
  } catch (error: any) {
    if (error instanceof CommunityFullError) {
      return sendError(res, 'COMMUNITY_FULL', COMMUNITY_FULL_MESSAGE, 400);
    }
    (req as any).logger?.error('Error updating member', error instanceof Error ? error : new Error(String(error)), { service: 'community-service', endpoint: 'PUT /:communityId/members/:userId' });
    return sendInternalError(res, 'Failed to update member', error);
  }
});

function sendRefusal(res: Response, refusal: Refusal) {
  return sendError(res, refusal.code, refusal.message, refusal.http);
}

// DELETE /communities/:communityId/members/:userId - Remove member (leave or kick)
router.delete('/:communityId/members/:userId', async (req: Request, res: Response) => {
  try {
    // SECURITY (ADR-064): the caller's identity comes from the verified JWT, never the
    // request body. Reading admin_user_id from req.body let an attacker spoof an admin —
    // or set it equal to the target userId to fake a "self-remove" and skip the admin
    // check entirely. Mirror the PUT handler's JWT-caller pattern.
    const caller = (req as any).user?.userId;

    if (!caller) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Sprint 144 (BUG-104): canonical path ids; the JWT id is compared as issued.
    const communityId = canonicalUuid(req.params.communityId);
    const userId = canonicalUuid(req.params.userId);
    if (!communityId || !userId) {
      return sendValidationError(res, 'communityId and userId must be valid UUIDs');
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
      // ADR-106: the sync trigger applies the active → left/inactive decrement.
      await q(`UPDATE communities.members SET status=$3 WHERE community_id=$1 AND user_id=$2`,
        [communityId, userId, departureStatus(isSelfRemove)]);
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
