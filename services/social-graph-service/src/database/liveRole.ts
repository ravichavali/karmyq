import { pool } from '../config/database';

/**
 * The caller's LIVE community role (BUG-069, ADR-102). Every authorization and visibility decision
 * reads communities.members, never the JWT `communities` claim: the claim is a login-time snapshot
 * that a demoted or removed admin keeps until the token expires, and it lists at most 15 communities.
 *
 * Arguments are always (communityId, userId). A malformed id is simply not a community the caller
 * belongs to: answering null/false (not a Postgres 22P02 → 500) keeps every gate's answer identical
 * for bad and foreign ids. userId comes from the verified JWT.
 */
export type LiveRole = 'admin' | 'moderator' | 'member' | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getLiveRole(communityId: unknown, userId: string | undefined): Promise<LiveRole> {
  if (!userId || typeof communityId !== 'string' || !UUID_RE.test(communityId)) return null;
  const result = await pool.query(
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
