import { query } from '../database/db';

/**
 * Member-row visibility (BUG-062, Sprint 133).
 *
 * - `user_email` is shown only to a LIVE active admin of the community, or on the caller's own row.
 * - Non-active rows (pending join requests and their messages) are shown only to live admins and
 *   moderators, who approve joins (members.ts PUT), and to the member themself.
 *
 * The role is always read from `communities.members` — the JWT `communities` claim is a login-time
 * snapshot and never decides visibility (CLAUDE.md *Authentication*).
 */
export type LiveRole = 'admin' | 'moderator' | 'member' | null;

export async function getLiveRole(communityId: string, userId: string | undefined): Promise<LiveRole> {
  if (!userId) return null;
  const result = await query(
    `SELECT role FROM communities.members
     WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, userId]
  );
  return (result.rows[0]?.role as LiveRole) ?? null;
}

export function canSeeNonActiveMembers(role: LiveRole): boolean {
  return role === 'admin' || role === 'moderator';
}

/** Applies both rules to rows that carry `user_id`, `status` and (possibly) `user_email`. */
export function shapeMemberRows<T extends { user_id: string; status: string; user_email?: string | null }>(
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
      const { user_email: _hidden, ...rest } = row;
      return rest as T;
    });
}
