/**
 * Invitation acceptance as one transaction on one checked-out client (Sprint 145, BUG-106; approved D1–D3).
 *
 * A success describes committed membership. An actual admission (new, left or pending invitee) writes the
 * membership, lets the ADR-106 trigger move and lock the community count, checks capacity on the same
 * client, consumes the invitation (the inviter-stats trigger fires inside this transaction) and writes the
 * invitee's attribution. A refusal rolls all of it back. An already-active invitee (D1) gets a no-write
 * success and the code stays usable.
 *
 * Lock order: invitation row → the inviter (FOR SHARE) and invitee (FOR UPDATE) member rows in ascending
 * user id → the community row, taken only by the counter trigger. It matches the staff and governance paths
 * (both ascending user id) and never locks a community ahead of a member. Inviter locks are shared, so two
 * acceptances through one inviter do not serialize on the inviter; a staff removal of that inviter waits.
 *
 * The inviter's authority is the live row read inside this transaction (ADR-102, D3: any active member may
 * admit to a private community). Neither the caller's JWT claims nor a membership in another community
 * confers it. Generation still mints codes without a membership check (BUG-109, out of scope); this read is
 * what stops such a code from admitting anyone.
 */
import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { getLiveRole } from '../database/liveRole';

export type InvitationAcceptance =
  | { inviter_id: string; community_id: string; accepted_at: Date }
  | { inviter_id: string; community_id: string; accepted_at: null; already_member: true };

/** A refusal with its HTTP status and ADR-074 code. Anything else escaping acceptInvitation is unexpected. */
export class InvitationAcceptanceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'InvitationAcceptanceError';
    this.status = status;
    this.code = code;
  }
}

const INVITATION_USED_MESSAGE = 'This invitation code has already been used';
const INVITATION_CONFLICT_MESSAGE = 'You previously joined this community through this inviter. Ask a different '
  + 'member for an invitation. If the community is public, rejoin from its community page.';
/** Same copy as community-service's memberCapacity.ts, so both admission paths read alike. */
const COMMUNITY_FULL_MESSAGE = 'Community is full (Dunbar\'s number limit reached)';
const RESTORE_MESSAGE = 'Ask a community admin to lift the block; then you can rejoin';
const MEMBERSHIP_CHANGED_MESSAGE = 'Your membership changed; please try again';

/** auth.user_invitations UNIQUE (inviter_id, invitee_id, community_id): a repeat admission through one inviter. */
const TRIPLET_CONSTRAINT = 'user_invitations_inviter_id_invitee_id_community_id_key';
const SELF_INVITATION_CONSTRAINT = 'no_self_invitation';
const RETRYABLE_CODES = new Set(['40P01', '40001']);

const refuse = (status: number, code: string, message: string) => new InvitationAcceptanceError(status, code, message);
const restoreRequired = () => refuse(409, 'MEMBERSHIP_RESTORE_REQUIRES_STAFF', RESTORE_MESSAGE);

type MembershipState = 'new' | 'active' | 'pending' | 'left' | 'blocked';

/** The approved state table. A missing row is 'new'; a NULL or unrecognized status fails closed as 'blocked'. */
function classify(row: { status?: unknown } | undefined): MembershipState {
  if (!row) return 'new';
  switch (row.status) {
    case 'active': return 'active';
    case 'pending': return 'pending';
    case 'left': return 'left';
    default: return 'blocked';
  }
}

/** Read the community on the transaction client; refuse a missing (404) or inactive (400) one. */
async function requireActiveCommunity(client: PoolClient, communityId: string): Promise<{ current_members: number; max_members: number }> {
  const row = (await client.query(
    `SELECT status, current_members, max_members FROM communities.communities WHERE id = $1`,
    [communityId]
  )).rows[0];
  if (!row) throw refuse(404, 'NOT_FOUND', 'Community not found');
  if (row.status !== 'active') throw refuse(400, 'COMMUNITY_INACTIVE', 'Community is not active');
  return row;
}

async function admit(client: PoolClient, userId: string, invitationCode: string): Promise<InvitationAcceptance> {
  const invitation = (await client.query(
    `SELECT id, inviter_id, invitee_id, community_id, invitation_accepted_at
     FROM auth.user_invitations
     WHERE invitation_code = $1
     FOR UPDATE`,
    [invitationCode]
  )).rows[0];
  if (!invitation) throw refuse(404, 'NOT_FOUND', 'Invalid invitation code');
  if (invitation.invitation_accepted_at) throw refuse(400, 'INVITATION_ALREADY_USED', INVITATION_USED_MESSAGE);

  const inviterId = String(invitation.inviter_id).toLowerCase();
  // Before any membership read: an active member holding their own code must not reach D1's 200.
  if (inviterId === userId) throw refuse(400, 'VALIDATION_ERROR', 'You cannot accept your own invitation');
  if (invitation.invitee_id && String(invitation.invitee_id).toLowerCase() !== userId) {
    throw refuse(403, 'FORBIDDEN', 'This invitation was issued to someone else');
  }
  if (!invitation.community_id) throw refuse(404, 'NOT_FOUND', 'Community not found');
  const communityId = String(invitation.community_id).toLowerCase();
  await requireActiveCommunity(client, communityId);

  const lockInviter = () => client.query(
    `SELECT user_id FROM communities.members
     WHERE community_id = $1 AND user_id = $2
     FOR SHARE`,
    [communityId, inviterId]
  );
  const lockInvitee = async () => (await client.query(
    `SELECT status, role FROM communities.members
     WHERE community_id = $1 AND user_id = $2
     FOR UPDATE`,
    [communityId, userId]
  )).rows[0];

  let invitee: { status?: unknown } | undefined;
  if (inviterId < userId) {
    await lockInviter();
    invitee = await lockInvitee();
  } else {
    invitee = await lockInvitee();
    await lockInviter();
  }
  if (!(await getLiveRole(communityId, inviterId, client))) {
    throw refuse(403, 'FORBIDDEN', 'The member who invited you is no longer active in this community');
  }

  let state = classify(invitee);
  if (state === 'new') {
    const inserted = await client.query(
      `INSERT INTO communities.members (community_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW())
       ON CONFLICT (community_id, user_id) DO NOTHING RETURNING status`,
      [communityId, userId]
    );
    if ((inserted.rowCount ?? 0) === 0) {
      // Lost the INSERT race: lock and classify the winner's row. A no-op is never a join.
      const winner = await lockInvitee();
      if (!winner) throw refuse(409, 'CONFLICT', MEMBERSHIP_CHANGED_MESSAGE);
      state = classify(winner);
    }
  }
  if (state === 'blocked') throw restoreRequired();
  if (state === 'active') {
    // D1: re-check the community after the locks, then admit nobody and write nothing.
    await requireActiveCommunity(client, communityId);
    return { inviter_id: inviterId, community_id: communityId, accepted_at: null, already_member: true };
  }
  if (state === 'pending' || state === 'left') {
    const updated = await client.query(
      `UPDATE communities.members
       SET status = 'active', role = 'member', joined_at = NOW(), join_request_message = NULL
       WHERE community_id = $1 AND user_id = $2 AND status = $3
       RETURNING status`,
      [communityId, userId, state]
    );
    if ((updated.rowCount ?? 0) === 0) throw refuse(409, 'CONFLICT', MEMBERSHIP_CHANGED_MESSAGE);
  }

  // The counter trigger has moved and locked the community row; read it back on this client.
  const after = await requireActiveCommunity(client, communityId);
  if (Number(after.current_members) > Number(after.max_members)) throw refuse(400, 'COMMUNITY_FULL', COMMUNITY_FULL_MESSAGE);

  const consumed = await client.query(
    `UPDATE auth.user_invitations
     SET invitee_id = $1, invitation_accepted_at = NOW()
     WHERE id = $2
     RETURNING invitation_accepted_at`,
    [userId, invitation.id]
  );
  await client.query(
    `UPDATE auth.users
     SET invited_by = $1, invitation_accepted_at = NOW()
     WHERE id = $2`,
    [inviterId, userId]
  );
  return { inviter_id: inviterId, community_id: communityId, accepted_at: consumed.rows[0].invitation_accepted_at };
}

function toAcceptanceError(error: unknown): unknown {
  if (error instanceof InvitationAcceptanceError) return error;
  const { code, constraint } = (error ?? {}) as { code?: string; constraint?: string };
  if (code && RETRYABLE_CODES.has(code)) {
    return refuse(503, 'ADMISSION_RETRY', 'The invitation could not be accepted because of a concurrent change; please try again');
  }
  if (code === '23505' && constraint === TRIPLET_CONSTRAINT) return refuse(409, 'INVITATION_CONFLICT', INVITATION_CONFLICT_MESSAGE);
  if (code === '23514' && constraint === SELF_INVITATION_CONSTRAINT) {
    return refuse(400, 'VALIDATION_ERROR', 'You cannot accept your own invitation');
  }
  return error;
}

/**
 * Accept `invitationCode` for the verified caller `userId`. Resolves only after COMMIT; logs only after the
 * client is released. Throws InvitationAcceptanceError for a refusal (everything rolled back) and rethrows
 * anything else unchanged. A client whose ROLLBACK fails is destroyed rather than returned to the pool.
 * No automatic retry: a retryable failure surfaces as 503 ADMISSION_RETRY for the caller to resend.
 */
export async function acceptInvitation(input: { userId: string; invitationCode: string }): Promise<InvitationAcceptance> {
  const userId = input.userId.toLowerCase();
  const client = await pool.connect();
  let outcome: InvitationAcceptance;
  try {
    await client.query('BEGIN');
    outcome = await admit(client, userId, input.invitationCode);
    await client.query('COMMIT');
  } catch (error) {
    const rollbackError = await client.query('ROLLBACK').then(() => undefined, (failure: Error) => failure);
    client.release(rollbackError);
    throw toAcceptanceError(error);
  }
  client.release();

  const context = { inviterId: outcome.inviter_id, inviteeId: userId, communityId: outcome.community_id };
  if (outcome.accepted_at === null) {
    logger.info('Invitation left unconsumed: invitee is already an active member', context);
  } else {
    logger.info('Invitation accepted', context);
  }
  return outcome;
}
