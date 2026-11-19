import { query, TxQuery } from '../database/db';
import { isUuid } from './uuid';

/**
 * The caller's LIVE community role (BUG-069, ADR-102). Every authorization and visibility decision
 * reads communities.members, never the JWT `communities` claim: the claim is a login-time snapshot
 * that a demoted or removed admin keeps until the token expires, and it lists at most 15 communities.
 *
 * Arguments are always (communityId, userId). A malformed id is simply not a community the caller
 * belongs to: answering null/false (not a Postgres 22P02 → 500) keeps every gate's 403 identical for
 * bad and foreign ids. userId comes from the verified JWT. Pass a transaction's `q` to read the role on
 * that client, after its row locks (the staff PUT does, Sprint 144).
 */
export type LiveRole = 'admin' | 'moderator' | 'member' | null;

export async function getLiveRole(communityId: unknown, userId: string | undefined, q: TxQuery = query): Promise<LiveRole> {
  if (!userId || !isUuid(communityId)) return null;
  const result = await q(
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

/**
 * Platform admin (ADR-105): an explicit auth.platform_admins grant, read live. Grants no community role. The trust
 * questionnaire is global, so its writes use this, never a community role (BUG-073).
 */
export async function isLivePlatformAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const result = await query('SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows.length > 0;
}
