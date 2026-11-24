/**
 * Sprint 145 (BUG-106; approved D1–D3) — POST /invitations/accept through the real router.
 *
 * The pool is an in-memory fake (tests/helpers/fakeInvitationDb.ts) that applies the member-counter and
 * inviter-stats triggers and honours BEGIN/ROLLBACK; the router, the acceptance operation and the live-role
 * helper are real. Every refusal case is paired with an eligible success, so a blanket deny cannot pass.
 * Locks, interleavings and real SQL are proven in
 * tests/integration/sprint-145-admission-integrity.integration.test.ts (CI database).
 */
import express from 'express';
import request from 'supertest';
import {
  createFakeDb, DB_NOW, pgError,
  type FakeDb, type FakeDbOptions, type FakeMember, type FakeState,
} from '../helpers/fakeInvitationDb';

const mockDb: { current?: FakeDb } = {};
jest.mock('../../src/config/database', () => ({
  pool: {
    query: (...a: any[]) => (mockDb.current!.pool.query as any)(...a),
    connect: (...a: any[]) => (mockDb.current!.pool.connect as any)(...a),
  },
}));
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../src/config/logger', () => ({ logger: mockLogger }));

import invitationsRouter from '../../src/routes/invitations';

const C = 'c1450000-0000-4000-8000-00000000000c';
const OTHER_C = 'c1450000-0000-4000-8000-0000000000ff';
const INVITER = 'a1450000-0000-4000-8000-00000000000a';
const INVITEE = 'b1450000-0000-4000-8000-00000000000b';
const STRANGER = 'd1450000-0000-4000-8000-00000000000d';
const INV_ID = 'e1450000-0000-4000-8000-00000000000e';
const CODE = 'KARMYQ-S145-2026-AB12';
const OLD_JOIN = new Date('2025-01-02T03:04:05.000Z');

const USED_MESSAGE = 'This invitation code has already been used';
const CONFLICT_MESSAGE = 'You previously joined this community through this inviter. Ask a different member '
  + 'for an invitation. If the community is public, rejoin from its community page.';
const RESTORE_MESSAGE = 'Ask a community admin to lift the block; then you can rejoin';
const FULL_MESSAGE = 'Community is full (Dunbar\'s number limit reached)';

const memberRow = (user_id: string, over: Partial<FakeMember> = {}): FakeMember => ({
  community_id: C, user_id, status: 'active', role: 'member', joined_at: OLD_JOIN, join_request_message: null, ...over,
});

/** An active inviter in a public community of `current` active members (inviter included) and cap 150. */
function scenario(over: {
  access?: 'public' | 'private';
  communityStatus?: string;
  current?: number;
  max?: number;
  inviterRole?: string;
  inviter?: Partial<FakeMember> | null;
  invitee?: Partial<FakeMember> | null;
  invitation?: Partial<FakeState['invitations'][number]>;
  noCommunity?: boolean;
  priorAccepted?: boolean;
} = {}): FakeState {
  const members: FakeMember[] = [];
  if (over.inviter !== null) members.push(memberRow(INVITER, { role: over.inviterRole ?? 'member', ...over.inviter }));
  if (over.invitee) members.push(memberRow(INVITEE, over.invitee));
  const invitations: FakeState['invitations'] = [{
    id: INV_ID, invitation_code: CODE, inviter_id: INVITER, invitee_id: null, community_id: C,
    invitation_accepted_at: null, ...over.invitation,
  }];
  if (over.priorAccepted) {
    invitations.push({ id: 'f1450000-0000-4000-8000-00000000000f', invitation_code: 'KARMYQ-S145-2026-OLD1',
      inviter_id: INVITER, invitee_id: INVITEE, community_id: C, invitation_accepted_at: OLD_JOIN });
  }
  return {
    invitations,
    communities: over.noCommunity ? [] : [{
      id: C, status: over.communityStatus ?? 'active', access_type: over.access ?? 'public',
      current_members: over.current ?? members.filter((m) => m.status === 'active').length, max_members: over.max ?? 150,
    }],
    members,
    users: { [INVITEE]: { invited_by: null, invitation_accepted_at: null } },
    acceptedStats: over.priorAccepted ? { [`${INVITER}:${C}`]: 1 } : {},
  };
}

function install(state: FakeState, options?: FakeDbOptions): FakeDb {
  mockDb.current = createFakeDb(state, options);
  return mockDb.current;
}

function app(userId: unknown) {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res, next) => { req.user = { userId, email: 'x@test.invalid', communities: [] }; next(); });
  a.use('/invitations', invitationsRouter);
  return a;
}
const accept = (body: unknown, userId: unknown = INVITEE) =>
  request(app(userId)).post('/invitations/accept').send(body as object);

const inviteeRow = (db: FakeDb) => db.state().members.find((m) => m.user_id === INVITEE);
const count = (db: FakeDb) => db.state().communities[0]?.current_members;
const stats = (db: FakeDb) => db.state().acceptedStats[`${INVITER}:${C}`] ?? 0;
const invitation = (db: FakeDb) => db.state().invitations.find((i) => i.id === INV_ID)!;

/** Nothing persisted: the code is unused, no attribution, no stat, membership and count untouched. */
function expectNothingPersisted(db: FakeDb, before: FakeState) {
  expect(invitation(db)).toEqual(before.invitations.find((i) => i.id === INV_ID));
  expect(db.state().users).toEqual(before.users);
  expect(db.state().acceptedStats).toEqual(before.acceptedStats);
  expect(db.state().members).toEqual(before.members);
  expect(db.state().communities).toEqual(before.communities);
}

beforeEach(() => {
  for (const fn of Object.values(mockLogger)) fn.mockReset();
});

describe('Sprint 145 accept — input validation before any SQL', () => {
  it.each([[undefined], ['not-a-uuid'], [42]])('refuses a caller identity of %p with 401 UNAUTHORIZED', async (userId) => {
    const db = install(scenario());
    const res = await accept({ invitation_code: CODE }, userId);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: 'UNAUTHORIZED' });
    expect(db.calls).toEqual([]);
  });

  it.each([[null], [''], ['   '], [42], [['KARMYQ-S145-2026-AB12']], [{ code: CODE }]])(
    'refuses invitation_code %p with 400 VALIDATION_ERROR', async (code) => {
      const db = install(scenario());
      const res = await accept({ invitation_code: code });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, error: 'VALIDATION_ERROR' });
      expect(db.calls).toEqual([]);
    });

  it('refuses a missing body field with 400 VALIDATION_ERROR', async () => {
    const db = install(scenario());
    const res = await accept({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(db.calls).toEqual([]);
  });
});

describe('Sprint 145 accept — actual admissions', () => {
  it.each([
    ['public', 'member'], ['public', 'moderator'], ['public', 'admin'],
    ['private', 'member'], ['private', 'moderator'], ['private', 'admin'],
  ] as const)('admits a newcomer to a %s community invited by an active %s (D3)', async (access, inviterRole) => {
    const db = install(scenario({ access, inviterRole }));
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.data).toEqual({ inviter_id: INVITER, community_id: C, accepted_at: DB_NOW.toISOString() });
    expect(inviteeRow(db)).toMatchObject({ status: 'active', role: 'member' });
    expect(count(db)).toBe(2);
    expect(invitation(db)).toMatchObject({ invitee_id: INVITEE, invitation_accepted_at: DB_NOW });
    expect(db.state().users[INVITEE]).toEqual({ invited_by: INVITER, invitation_accepted_at: DB_NOW });
    expect(stats(db)).toBe(1);
  });

  it('rejoins a left former admin as an ordinary member with a fresh join time and no request message', async () => {
    const db = install(scenario({ invitee: { status: 'left', role: 'admin', join_request_message: 'old note' } }));
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(200);
    expect(res.body.data.accepted_at).toBe(DB_NOW.toISOString());
    expect(inviteeRow(db)).toEqual(memberRow(INVITEE, { joined_at: DB_NOW }));
    expect(count(db)).toBe(2);
    expect(stats(db)).toBe(1);
  });

  it.each(['public', 'private'] as const)('promotes a pending applicant of a %s community to an active member (D2)', async (access) => {
    const db = install(scenario({ access, invitee: { status: 'pending', role: 'moderator', join_request_message: 'let me in' } }));
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ inviter_id: INVITER, community_id: C, accepted_at: DB_NOW.toISOString() });
    expect(inviteeRow(db)).toEqual(memberRow(INVITEE, { joined_at: DB_NOW }));
    expect(count(db)).toBe(2);
    expect(invitation(db).invitee_id).toBe(INVITEE);
    expect(stats(db)).toBe(1);
  });

  it('admits at exactly the cap (the post-write count equals max_members)', async () => {
    const db = install(scenario({ max: 2 }));
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(200);
    expect(count(db)).toBe(2);
  });
});

describe('Sprint 145 accept — D1 already-active invitee is a no-write success', () => {
  it.each([['member', 2, 150], ['moderator', 5, 3], ['admin', 3, 3]] as const)(
    'returns already_member for an active %s (count %i, cap %i) and writes nothing', async (role, current, max) => {
      const state = scenario({ invitee: { status: 'active', role }, current, max });
      const db = install(state);
      const res = await accept({ invitation_code: CODE });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ inviter_id: INVITER, community_id: C, accepted_at: null, already_member: true });
      expect(db.writes()).toEqual([]);
      expectNothingPersisted(db, state);
      expect(mockLogger.info.mock.calls.map(([m]) => m)).not.toContain('Invitation accepted');
    });

  it('still refuses an already-used code for an active member (no idempotent replay)', async () => {
    const state = scenario({ invitee: { status: 'active' }, invitation: { invitee_id: INVITEE, invitation_accepted_at: OLD_JOIN } });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'INVITATION_ALREADY_USED', message: USED_MESSAGE });
    expect(db.writes()).toEqual([]);
  });

  it('still requires the inviter to be live for an active member', async () => {
    const state = scenario({ invitee: { status: 'active' }, inviter: { status: 'left' } });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(db.writes()).toEqual([]);
  });
});

describe('Sprint 145 accept — refusals change nothing', () => {
  it.each([['inactive'], [null], ['invited'], ['banned']])('refuses a %p membership with 409 MEMBERSHIP_RESTORE_REQUIRES_STAFF', async (status) => {
    const state = scenario({ invitee: { status, role: 'admin' } });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF', message: RESTORE_MESSAGE });
    expect(db.writes()).toEqual([]);
    expectNothingPersisted(db, state);
  });

  it.each([
    ['a newcomer', undefined, 2, 2],
    ['a left member', { status: 'left' }, 2, 2],
    ['a pending applicant', { status: 'pending' }, 3, 3],
  ] as const)('refuses %s when the post-write count exceeds the cap with 400 COMMUNITY_FULL and rolls back', async (_label, invitee, current, max) => {
    const state = scenario({ invitee: invitee as Partial<FakeMember> | undefined, current, max });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_FULL', message: FULL_MESSAGE });
    expectNothingPersisted(db, state);
  });

  it('refuses an unknown code with 404 NOT_FOUND', async () => {
    const db = install(scenario());
    const res = await accept({ invitation_code: 'KARMYQ-S145-2026-ZZZZ' });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'NOT_FOUND', message: 'Invalid invitation code' });
    expect(db.writes()).toEqual([]);
  });

  it('refuses an already-used code with 400 INVITATION_ALREADY_USED and its existing message', async () => {
    const state = scenario({ invitation: { invitee_id: STRANGER, invitation_accepted_at: OLD_JOIN } });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'INVITATION_ALREADY_USED', message: USED_MESSAGE });
    expectNothingPersisted(db, state);
  });

  it.each([[INVITER], [INVITER.toUpperCase()]])('refuses accepting one\'s own invitation (caller %s) with 400, not 500 or D1', async (caller) => {
    const state = scenario();
    const db = install(state);
    const res = await accept({ invitation_code: CODE }, caller);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(db.writes()).toEqual([]);
    expectNothingPersisted(db, state);
  });

  it('maps the database self-invitation constraint to 400 if it is ever reached', async () => {
    const state = scenario();
    const db = install(state, { failOn: { match: /^\s*UPDATE auth\.user_invitations/i,
      error: pgError('violates check constraint "no_self_invitation"', { code: '23514', constraint: 'no_self_invitation' }) } });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expectNothingPersisted(db, state);
  });

  it('refuses an invitation bound to a different invitee with 403 FORBIDDEN', async () => {
    const state = scenario({ invitation: { invitee_id: STRANGER } });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expectNothingPersisted(db, state);
  });

  it('accepts an invitation bound to the caller, compared canonically', async () => {
    const db = install(scenario({ invitation: { invitee_id: INVITEE } }));
    const res = await accept({ invitation_code: CODE }, INVITEE.toUpperCase());
    expect(res.status).toBe(200);
    expect(inviteeRow(db)).toMatchObject({ status: 'active', role: 'member' });
  });

  it.each([
    ['has no membership row', null],
    ['has left', { status: 'left' }],
    ['was removed', { status: 'inactive' }],
    ['is still pending', { status: 'pending' }],
    ['is active only in another community', { community_id: OTHER_C }],
  ] as const)('refuses with 403 FORBIDDEN when the inviter %s', async (_label, inviter) => {
    const state = scenario({ inviter: inviter as Partial<FakeMember> | null });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: 'FORBIDDEN' });
    expect(db.writes()).toEqual([]);
    expectNothingPersisted(db, state);
  });

  it('refuses an invitation with no stored community with 404 NOT_FOUND', async () => {
    const state = scenario({ invitation: { community_id: null } });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expectNothingPersisted(db, state);
  });

  it('refuses an invitation whose community no longer exists with 404 NOT_FOUND', async () => {
    const state = scenario({ noCommunity: true });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expectNothingPersisted(db, state);
  });

  it('refuses an inactive community with 400 COMMUNITY_INACTIVE', async () => {
    const state = scenario({ communityStatus: 'archived' });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COMMUNITY_INACTIVE');
    expectNothingPersisted(db, state);
  });

  it('refuses a repeat admission through the same inviter with 409 INVITATION_CONFLICT and rolls every effect back', async () => {
    const state = scenario({ invitee: { status: 'left', role: 'admin' }, priorAccepted: true });
    const db = install(state);
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'INVITATION_CONFLICT', message: CONFLICT_MESSAGE });
    expectNothingPersisted(db, state);
  });

  it('does not map an unrelated unique violation to INVITATION_CONFLICT', async () => {
    const state = scenario();
    const db = install(state, { failOn: { match: /^\s*UPDATE auth\.user_invitations/i,
      error: pgError('duplicate key', { code: '23505', constraint: 'user_invitations_invitation_code_key' }) } });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
    expectNothingPersisted(db, state);
  });

  it.each([['40P01'], ['40001']])('maps a %s transaction failure to 503 ADMISSION_RETRY and rolls back', async (code) => {
    const state = scenario();
    const db = install(state, { failOn: { match: /^\s*UPDATE auth\.users/i, error: pgError('deadlock detected', { code }) } });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: 'ADMISSION_RETRY' });
    expectNothingPersisted(db, state);
  });
});

describe('Sprint 145 accept — a lost membership INSERT race is classified, never assumed', () => {
  it('treats an active winner as the D1 no-op and leaves the code unconsumed', async () => {
    const state = scenario();
    const db = install(state, { beforeMemberInsert: (s) => { s.members.push(memberRow(INVITEE, { role: 'moderator' })); } });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ inviter_id: INVITER, community_id: C, accepted_at: null, already_member: true });
    expect(invitation(db)).toEqual(state.invitations[0]);
    expect(stats(db)).toBe(0);
    expect(inviteeRow(db)).toMatchObject({ status: 'active', role: 'moderator' });
  });

  it('promotes a pending winner (D2) rather than reporting the no-op as a join', async () => {
    const db = install(scenario(), { beforeMemberInsert: (s) => { s.members.push(memberRow(INVITEE, { status: 'pending' })); } });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(200);
    expect(res.body.data.accepted_at).toBe(DB_NOW.toISOString());
    expect(inviteeRow(db)).toEqual(memberRow(INVITEE, { joined_at: DB_NOW }));
    expect(stats(db)).toBe(1);
  });

  it('refuses a blocked winner with 409 and consumes nothing', async () => {
    const state = scenario();
    const db = install(state, { beforeMemberInsert: (s) => { s.members.push(memberRow(INVITEE, { status: 'inactive' })); } });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('MEMBERSHIP_RESTORE_REQUIRES_STAFF');
    expect(invitation(db)).toEqual(state.invitations[0]);
    expect(stats(db)).toBe(0);
  });

  it('refuses with retryable 409 CONFLICT when the winner cannot be read back', async () => {
    const state = scenario();
    const db = install(state, {
      beforeMemberInsert: (s) => { s.members.push(memberRow(INVITEE)); },
      afterMemberInsertConflict: (s) => { s.members = s.members.filter((m) => m.user_id !== INVITEE); },
    });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
    expect(invitation(db)).toEqual(state.invitations[0]);
    expect(stats(db)).toBe(0);
  });
});

describe('Sprint 145 accept — unexpected failures are opaque to the client and legible to the operator', () => {
  it('returns INTERNAL_ERROR without SQL or the raw message and logs the route and the error', async () => {
    const state = scenario();
    const boom = new Error('relation "auth.users" does not exist SECRET-DETAIL');
    const db = install(state, { failOn: { match: /^\s*UPDATE auth\.users/i, error: boom } });
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to accept invitation' });
    expect(JSON.stringify(res.body)).not.toMatch(/SECRET-DETAIL|relation|auth\.users/);
    expect(mockLogger.error).toHaveBeenCalledWith('Error accepting invitation', boom,
      expect.objectContaining({ route: 'POST /invitations/accept' }));
    expectNothingPersisted(db, state);
  });

  it('pairs the failure with the same scenario succeeding', async () => {
    const db = install(scenario());
    const res = await accept({ invitation_code: CODE });
    expect(res.status).toBe(200);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(stats(db)).toBe(1);
  });
});

