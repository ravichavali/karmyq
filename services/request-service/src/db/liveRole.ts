import { query } from '../database/db';

/**
 * The caller's LIVE community role (BUG-069, ADR-102). Every authorization decision reads
 * communities.members, never the JWT `communities` claim: the claim is a login-time snapshot that a
 * demoted or removed admin keeps until the token expires, and it lists at most 15 communities.
 *
 * Arguments are always (communityId, userId). A malformed id is simply not a community the caller
 * belongs to: answering null/false (not a Postgres 22P02 → 500) keeps every gate's 403 identical for
 * bad and foreign ids. userId comes from the verified JWT.
 */
export type LiveRole = 'admin' | 'moderator' | 'member' | null;
type Role = Exclude<LiveRole, null>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

export async function getLiveRole(communityId: unknown, userId: string | undefined): Promise<LiveRole> {
  if (!userId || !isUuid(communityId)) return null;
  const result = await query(
    `SELECT role FROM communities.members
     WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, userId]
  );
  if (result.rows.length === 0) return null;
  // `role` is nullable with DEFAULT 'member': an active row is a membership whatever its role says.
  return (result.rows[0].role ?? 'member') as LiveRole;
}

export async function isLiveAdmin(communityId: unknown, userId: string | undefined): Promise<boolean> {
  return (await getLiveRole(communityId, userId)) === 'admin';
}

/** For platform-wide admin surfaces that admit an admin of any community (`requireAdmin`). */
export async function isLiveAdminOfAnyCommunity(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const result = await query(
    `SELECT 1 FROM communities.members
     WHERE user_id = $1 AND status = 'active' AND role = 'admin' LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

/** An active row with one of `roles` in ANY community the request belongs to. */
export async function hasLiveRoleInRequestCommunities(
  requestId: unknown,
  userId: string | undefined,
  roles: readonly Role[]
): Promise<boolean> {
  if (!userId || !isUuid(requestId)) return false;
  const result = await query(
    `SELECT 1 FROM requests.request_communities rc
     JOIN communities.members m ON m.community_id = rc.community_id
     WHERE rc.request_id = $1 AND m.user_id = $2 AND m.status = 'active' AND m.role = ANY($3::text[])
     LIMIT 1`,
    [requestId, userId, roles]
  );
  return result.rows.length > 0;
}
