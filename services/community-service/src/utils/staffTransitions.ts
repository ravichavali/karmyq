/**
 * The staff membership transition table (Sprint 144; BUG-105; decisions 4 and 8; D1–D4).
 *
 * What staff may do to SOMEONE ELSE's membership through PUT /communities/:communityId/members/:userId.
 * memberLifecycle.ts answers the other question (what a member may do to their own membership).
 *
 * Pure: the route locks the target and the active admins, reads the caller's live role on the same
 * transaction client (ADR-102), and executes whatever this returns. Order of checks:
 *   1. body shape (400, D1)          4. a `left` row belongs to the member (409, D3)
 *   2. caller is live staff (403)    5. same state is a retry (409, D4)
 *   3. target row exists (404)       6. the transition itself (moderators: approve/reject only)
 */

import type { LiveRole } from './liveRole';

export type CallerRole = LiveRole;
export type StaffStatus = 'active' | 'inactive' | 'left';
export type StaffRole = 'member' | 'moderator' | 'admin';

export interface Target {
  status: string | null;
  role: string | null;
  /** The target is an active admin and no other active admin exists (computed under the row lock). */
  isSoleActiveAdmin: boolean;
}

export type StaffRequest = { kind: 'status'; value: StaffStatus } | { kind: 'role'; value: StaffRole };

export type RefusalCode =
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'LAST_ADMIN'
  | 'INVALID_MEMBERSHIP_TRANSITION'
  | 'MEMBER_MUST_REJOIN';

export type Refusal = { kind: 'refuse'; http: 400 | 403 | 404 | 409; code: RefusalCode; message: string };

export type Plan =
  | { kind: 'write'; set: { status?: StaffStatus; role?: StaffRole }; admits: boolean }
  | Refusal;

const STATUSES: readonly string[] = ['active', 'inactive', 'left'];
/** Every community member role, the one list for validation (staff PUT and staff add). */
export const ROLES: readonly string[] = ['member', 'moderator', 'admin'];
const IGNORED_KEYS = new Set(['admin_user_id']);

const refuse = (http: Refusal['http'], code: RefusalCode, message: string): Refusal =>
  ({ kind: 'refuse', http, code, message });

/** D1: exactly one of `role` or `status`, each a known value; only the legacy `admin_user_id` is ignored. */
export function validateStaffBody(body: unknown): StaffRequest | Refusal {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return refuse(400, 'VALIDATION_ERROR', 'Send a JSON object with exactly one of role or status');
  }
  const keys = Object.keys(body).filter((key) => !IGNORED_KEYS.has(key));
  const unknown = keys.filter((key) => key !== 'role' && key !== 'status');
  if (unknown.length > 0) {
    return refuse(400, 'VALIDATION_ERROR', `Unknown field: ${unknown[0]}`);
  }
  if (keys.length !== 1) {
    return refuse(400, 'VALIDATION_ERROR', 'Send exactly one of role or status');
  }
  const value = (body as Record<string, unknown>)[keys[0]];
  if (keys[0] === 'status') {
    if (typeof value !== 'string' || !STATUSES.includes(value)) {
      return refuse(400, 'VALIDATION_ERROR', 'status must be one of active, inactive, left');
    }
    return { kind: 'status', value: value as StaffStatus };
  }
  if (typeof value !== 'string' || !ROLES.includes(value)) {
    return refuse(400, 'VALIDATION_ERROR', 'role must be one of member, moderator, admin');
  }
  return { kind: 'role', value: value as StaffRole };
}

export function planStaffChange(caller: CallerRole, target: Target | null, body: unknown): Plan {
  const request = validateStaffBody(body);
  if (request.kind === 'refuse') return request;

  if (caller !== 'admin' && caller !== 'moderator') {
    return refuse(403, 'FORBIDDEN', 'Only community admins or moderators can update members');
  }
  if (request.kind === 'role' && caller !== 'admin') {
    return refuse(403, 'FORBIDDEN', 'Only community admins can change member roles');
  }
  if (!target) return refuse(404, 'NOT_FOUND', 'Member not found');

  if (target.status === 'left') {
    return refuse(409, 'MEMBER_MUST_REJOIN', 'This person left the community; only they can rejoin');
  }

  return request.kind === 'role' ? planRole(target, request.value) : planStatus(caller, target, request.value);
}

function planRole(target: Target, role: StaffRole): Plan {
  if (target.status !== 'active') {
    return refuse(409, 'INVALID_MEMBERSHIP_TRANSITION', 'Only an active member can have their role changed');
  }
  const stored = target.role ?? 'member';
  if (stored === role) {
    return refuse(409, 'INVALID_MEMBERSHIP_TRANSITION', 'The member already has that role');
  }
  if (stored === 'admin' && target.isSoleActiveAdmin) {
    return refuse(400, 'LAST_ADMIN', 'Cannot demote the last admin. Assign another admin first.');
  }
  return { kind: 'write', set: { role }, admits: false };
}

function planStatus(caller: 'admin' | 'moderator', target: Target, status: StaffStatus): Plan {
  if (target.status === status) {
    return refuse(409, 'INVALID_MEMBERSHIP_TRANSITION', `The membership is already ${status}`);
  }

  // Decision 4: approve and reject are the only transitions open to moderators.
  if (target.status === 'pending' && status === 'active') {
    return { kind: 'write', set: { status: 'active', role: 'member' }, admits: true };
  }
  if (target.status === 'pending' && status === 'inactive') {
    return { kind: 'write', set: { status: 'inactive' }, admits: false };
  }
  if (caller !== 'admin') {
    return refuse(403, 'FORBIDDEN', 'Moderators can only approve or reject join requests');
  }

  if (target.status === 'active' && status === 'inactive') {
    if (target.isSoleActiveAdmin) {
      return refuse(400, 'LAST_ADMIN', 'Cannot deactivate the last admin. Assign another admin first.');
    }
    return { kind: 'write', set: { status: 'inactive' }, admits: false };
  }
  if (target.status === 'inactive' && status === 'left') {
    // Decision 8: lifting a block hands the decision back to the person; it admits nobody.
    return { kind: 'write', set: { status: 'left', role: 'member' }, admits: false };
  }
  if (target.status === 'inactive' && status === 'active') {
    return refuse(409, 'INVALID_MEMBERSHIP_TRANSITION',
      'Staff cannot reactivate a membership. Lift the block (status: left); the person then rejoins themselves');
  }
  if (status === 'left' && (target.status === 'active' || target.status === 'pending')) {
    return refuse(409, 'INVALID_MEMBERSHIP_TRANSITION', 'Only the member can leave a community');
  }
  return refuse(409, 'INVALID_MEMBERSHIP_TRANSITION', 'This membership change is not allowed');
}
