/**
 * Sprint 145 (BUG-106) — the acceptance operation at its client boundary: one checked-out client,
 * BEGIN/COMMIT/ROLLBACK, client release or destruction, statement order, global user-id lock order and
 * logging only after commit. The pool is an in-memory fake (tests/helpers/fakeInvitationDb.ts); the
 * operation and the live-role helper are real. Real row locks and interleavings are proven in
 * tests/integration/sprint-145-admission-integrity.integration.test.ts (CI database).
 */
import {
  createFakeDb, DB_NOW, pgError, type FakeDb, type FakeDbOptions, type FakeMember, type FakeState,
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

import { acceptInvitation, InvitationAcceptanceError } from '../../src/services/invitationAcceptance';

const C = 'c1450000-0000-4000-8000-00000000000c';
const LOW = '01450000-0000-4000-8000-000000000001';
const HIGH = 'f1450000-0000-4000-8000-0000000000ff';
const INV_ID = 'e1450000-0000-4000-8000-00000000000e';
const CODE = 'KARMYQ-S145-2026-AB12';

const member = (user_id: string, over: Partial<FakeMember> = {}): FakeMember => ({
  community_id: C, user_id, status: 'active', role: 'member', joined_at: new Date('2025-01-01T00:00:00Z'),
  join_request_message: null, ...over,
});

function state(inviter: string, invitee: string, inviteeRow?: Partial<FakeMember>): FakeState {
  return {
    invitations: [{ id: INV_ID, invitation_code: CODE, inviter_id: inviter, invitee_id: null, community_id: C, invitation_accepted_at: null }],
    communities: [{ id: C, status: 'active', access_type: 'public', current_members: inviteeRow?.status === 'active' ? 2 : 1, max_members: 150 }],
    members: [member(inviter), ...(inviteeRow ? [member(invitee, inviteeRow)] : [])],
    users: {},
    acceptedStats: {},
  };
}
function install(s: FakeState, options?: FakeDbOptions): FakeDb {
  mockDb.current = createFakeDb(s, options);
  return mockDb.current;
}
const idx = (db: FakeDb, re: RegExp) => db.sql().findIndex((s) => re.test(s));

beforeEach(() => {
  for (const fn of Object.values(mockLogger)) fn.mockReset();
});

describe('Sprint 145 acceptInvitation — transaction and client lifecycle', () => {
  it('propagates a connect failure without running any statement', async () => {
    const boom = new Error('connect ECONNREFUSED');
    const db = install(state(LOW, HIGH), { connectError: boom });
    await expect(acceptInvitation({ userId: HIGH, invitationCode: CODE })).rejects.toBe(boom);
    expect(db.calls).toEqual([]);
    expect(db.release).not.toHaveBeenCalled();
  });

  it('runs every statement on one checked-out client, commits, releases once, then logs success', async () => {
    const db = install(state(LOW, HIGH));
    const result = await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    expect(result).toEqual({ inviter_id: LOW, community_id: C, accepted_at: DB_NOW });
    expect(db.calls.every((c) => c.via === 'client')).toBe(true);
    expect(db.sql()[0]).toBe('BEGIN');
    expect(db.sql()[db.sql().length - 1]).toBe('COMMIT');
    expect(db.release).toHaveBeenCalledTimes(1);
    expect(db.release).toHaveBeenCalledWith();
    const commitOrder = db.client.query.mock.invocationCallOrder[db.calls.length - 1];
    const accepted = mockLogger.info.mock.calls.findIndex(([m]) => m === 'Invitation accepted');
    expect(accepted).toBeGreaterThanOrEqual(0);
    expect(mockLogger.info.mock.invocationCallOrder[accepted]).toBeGreaterThan(commitOrder);
    expect(mockLogger.info.mock.invocationCallOrder[accepted]).toBeGreaterThan(db.release.mock.invocationCallOrder[0]);
  });

  it('rolls back and releases (not destroys) on a typed refusal, throwing the typed error', async () => {
    const s = state(LOW, HIGH);
    s.invitations[0].invitation_accepted_at = new Date('2025-06-01T00:00:00Z');
    const db = install(s);
    const error = await acceptInvitation({ userId: HIGH, invitationCode: CODE }).catch((e) => e);
    expect(error).toBeInstanceOf(InvitationAcceptanceError);
    expect(error).toMatchObject({ status: 400, code: 'INVITATION_ALREADY_USED' });
    expect(db.sql()).toContain('ROLLBACK');
    expect(db.sql()).not.toContain('COMMIT');
    expect(db.release).toHaveBeenCalledTimes(1);
    expect(db.release).toHaveBeenCalledWith(undefined);
    expect(mockLogger.info.mock.calls.map(([m]) => m)).not.toContain('Invitation accepted');
  });

  it('rolls back, releases and rethrows an unexpected query failure unchanged', async () => {
    const boom = new Error('connection terminated');
    const db = install(state(LOW, HIGH), { failOn: { match: /^\s*UPDATE auth\.users/i, error: boom } });
    await expect(acceptInvitation({ userId: HIGH, invitationCode: CODE })).rejects.toBe(boom);
    expect(db.sql()).toContain('ROLLBACK');
    expect(db.release).toHaveBeenCalledTimes(1);
    expect(db.release).toHaveBeenCalledWith(undefined);
    expect(db.state().members.find((m) => m.user_id === HIGH)).toBeUndefined();
    expect(db.state().acceptedStats).toEqual({});
  });

  it('destroys the client when ROLLBACK itself fails, so no broken transaction returns to the pool', async () => {
    const boom = new Error('connection terminated');
    const rollbackError = new Error('rollback failed');
    const db = install(state(LOW, HIGH), { failOn: { match: /^\s*UPDATE auth\.users/i, error: boom }, rollbackError });
    await expect(acceptInvitation({ userId: HIGH, invitationCode: CODE })).rejects.toBe(boom);
    expect(db.release).toHaveBeenCalledTimes(1);
    expect(db.release).toHaveBeenCalledWith(rollbackError);
  });

  it.each([['40P01'], ['40001']])('maps %s to a typed 503 ADMISSION_RETRY without retrying', async (code) => {
    const db = install(state(LOW, HIGH), { failOn: { match: /^\s*INSERT INTO communities\.members/i, error: pgError('x', { code }) } });
    const error = await acceptInvitation({ userId: HIGH, invitationCode: CODE }).catch((e) => e);
    expect(error).toBeInstanceOf(InvitationAcceptanceError);
    expect(error).toMatchObject({ status: 503, code: 'ADMISSION_RETRY' });
    expect(db.sql().filter((s) => s === 'BEGIN')).toHaveLength(1);
    expect(db.release).toHaveBeenCalledTimes(1);
  });

  it('does not log an acceptance for the D1 no-op and writes nothing', async () => {
    const db = install(state(LOW, HIGH, { status: 'active' }));
    const result = await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    expect(result).toEqual({ inviter_id: LOW, community_id: C, accepted_at: null, already_member: true });
    expect(db.writes()).toEqual([]);
    expect(db.release).toHaveBeenCalledTimes(1);
    expect(mockLogger.info.mock.calls.map(([m]) => m)).not.toContain('Invitation accepted');
  });
});

describe('Sprint 145 acceptInvitation — statement and lock order', () => {
  const SHARE = /FROM communities\.members WHERE community_id = \$1 AND user_id = \$2 FOR SHARE$/;
  const UPDATE_LOCK = /FROM communities\.members WHERE community_id = \$1 AND user_id = \$2 FOR UPDATE$/;
  const lockCalls = (db: FakeDb) => db.calls
    .filter((c) => /FOR (SHARE|UPDATE)\s*$/i.test(c.sql) && /communities\.members/.test(c.sql))
    .map((c) => [/FOR SHARE\s*$/i.test(c.sql) ? 'SHARE' : 'UPDATE', c.params[1]]);

  it('locks the invitation first, then the inviter FOR SHARE and invitee FOR UPDATE in ascending user id (inviter lower)', async () => {
    const db = install(state(LOW, HIGH));
    await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    expect(db.sql()[1]).toMatch(/FROM auth\.user_invitations WHERE invitation_code = \$1 FOR UPDATE$/);
    expect(lockCalls(db).slice(0, 2)).toEqual([['SHARE', LOW], ['UPDATE', HIGH]]);
    expect(idx(db, SHARE)).toBeLessThan(idx(db, UPDATE_LOCK));
  });

  it('takes the invitee lock first when the invitee has the lower user id', async () => {
    const db = install(state(HIGH, LOW));
    await acceptInvitation({ userId: LOW, invitationCode: CODE });
    expect(lockCalls(db).slice(0, 2)).toEqual([['UPDATE', LOW], ['SHARE', HIGH]]);
  });

  it('orders by canonical (lowercase) id even when the caller id arrives upper-cased', async () => {
    const db = install(state(HIGH, LOW));
    await acceptInvitation({ userId: LOW.toUpperCase(), invitationCode: CODE });
    expect(lockCalls(db).slice(0, 2)).toEqual([['UPDATE', LOW], ['SHARE', HIGH]]);
    expect(db.state().members.find((m) => m.user_id === LOW)).toMatchObject({ status: 'active' });
  });

  it('never locks the community row ahead of the member rows', async () => {
    const db = install(state(LOW, HIGH));
    await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    expect(db.sql().some((s) => /FROM communities\.communities[\s\S]*FOR (UPDATE|SHARE|NO KEY UPDATE)/i.test(s))).toBe(false);
  });

  // PR #342 review: a live-role read cannot stand in for the authority lock. A row committed after the
  // FOR SHARE select found nothing is visible to the later read but was never locked, so a removal could
  // commit before this admission does.
  it.each([['lower', LOW, HIGH], ['higher', HIGH, LOW]])(
    'refuses with 403 when the inviter FOR SHARE locked no row, even though the row exists by the live-role read (inviter id %s)',
    async (_label, inviter, invitee) => {
      const s = state(inviter, invitee);
      s.members = [];
      const db = install(s, { afterInviterLock: (x) => { x.members.push(member(inviter)); } });
      const error = await acceptInvitation({ userId: invitee, invitationCode: CODE }).catch((e) => e);
      expect(error).toBeInstanceOf(InvitationAcceptanceError);
      expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect(db.writes()).toEqual([]);
      expect(db.sql()).toContain('ROLLBACK');
      expect(db.sql()).not.toContain('COMMIT');
    });

  it('reads inviter authority on the transaction client after the inviter lock', async () => {
    const db = install(state(LOW, HIGH));
    await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    const live = idx(db, /SELECT role FROM communities\.members WHERE community_id = \$1 AND user_id = \$2 AND status = 'active'/);
    expect(live).toBeGreaterThan(idx(db, SHARE));
    expect(db.calls[live]).toMatchObject({ via: 'client', params: [C, LOW] });
    expect(db.pool.query).not.toHaveBeenCalled();
  });

  it('post-checks capacity after the member write, then consumes the invitation, then attributes the user', async () => {
    const db = install(state(LOW, HIGH));
    await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    const insert = idx(db, /^INSERT INTO communities\.members/);
    const capacity = db.sql().findIndex((s, i) => i > insert && /current_members, max_members FROM communities\.communities WHERE id = \$1/.test(s));
    const consume = idx(db, /^UPDATE auth\.user_invitations/);
    const attribute = idx(db, /^UPDATE auth\.users/);
    expect(insert).toBeGreaterThan(0);
    expect(capacity).toBeGreaterThan(insert);
    expect(consume).toBeGreaterThan(capacity);
    expect(attribute).toBeGreaterThan(consume);
    expect(db.calls[consume].params).toEqual([HIGH, INV_ID]);
    expect(db.calls[attribute].params).toEqual([LOW, HIGH]);
    expect(db.sql().some((s) => /UPDATE communities\.communities|inviter_stats/i.test(s))).toBe(false);
  });

  it('reads a lost INSERT race winner under FOR UPDATE before classifying it', async () => {
    const db = install(state(LOW, HIGH), { beforeMemberInsert: (s) => { s.members.push(member(HIGH)); } });
    await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    const insert = idx(db, /^INSERT INTO communities\.members/);
    expect(db.sql()[insert]).toMatch(/ON CONFLICT \(community_id, user_id\) DO NOTHING RETURNING/);
    expect(db.sql()[insert + 1]).toMatch(UPDATE_LOCK);
  });

  it('makes left/pending rejoins conditional on the classified stored state', async () => {
    const db = install(state(LOW, HIGH, { status: 'pending' }));
    await acceptInvitation({ userId: HIGH, invitationCode: CODE });
    const update = db.calls.find((c) => /^\s*UPDATE communities\.members/i.test(c.sql))!;
    expect(update.sql).toMatch(/WHERE community_id = \$1 AND user_id = \$2 AND status = \$3\s+RETURNING/);
    expect(update.params).toEqual([C, HIGH, 'pending']);
  });
});
