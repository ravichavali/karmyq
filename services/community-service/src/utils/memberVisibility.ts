import type { LiveRole } from './liveRole';

/**
 * Member-row visibility (BUG-062, Sprint 133).
 *
 * - `user_email` is shown only to a LIVE active admin of the community, or on the caller's own row.
 * - Non-active rows (pending join requests) and every `join_request_message` are shown only to live
 *   admins and moderators, who approve joins (members.ts PUT), and to the member themself. Approval
 *   never clears the message, so it must be stripped from ACTIVE rows too.
 *
 * The role is always read from `communities.members` — the JWT `communities` claim is a login-time
 * snapshot and never decides visibility (CLAUDE.md *Authentication*). The caller passes the role from
 * ./liveRole `getLiveRole`.
 */

export function canSeeNonActiveMembers(role: LiveRole): boolean {
  return role === 'admin' || role === 'moderator';
}

/** Applies both rules to rows that carry `user_id`, `status` and (possibly) `user_email`. */
export function shapeMemberRows<T extends {
  user_id: string; status: string; user_email?: string | null; join_request_message?: string | null;
}>(
  rows: T[],
  callerId: string | undefined,
  role: LiveRole
): T[] {
  const isAdmin = role === 'admin';
  const seesNonActive = canSeeNonActiveMembers(role);
  return rows
    .filter((row) => row.status === 'active' || seesNonActive || row.user_id === callerId)
    .map((row) => {
      if (isAdmin || row.user_id === callerId) return row;
      const { user_email: _email, ...rest } = row;
      if (seesNonActive) return rest as T;
      const { join_request_message: _message, ...shown } = rest;
      return shown as T;
    });
}
