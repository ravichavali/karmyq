/**
 * Sprint 145 (BUG-108) — POST /communities when an active community with the same identity exists.
 *
 * The real router runs against a stateful in-memory fake of the two tables it touches. The fake applies the
 * ADR-106 counter on admitting writes, snapshots at transaction start and restores on a throw, which mirrors
 * db.ts withTransaction. A success must describe committed membership: pending, blocked, NULL and unknown
 * rows never answer joined, a left row rejoins as an ordinary member, an active row keeps its role and join
 * time, and a community that is now private gets the existing pointer, with any tentative write rolled back
 * first. Real locks and interleavings are proven in
 * tests/integration/sprint-145-admission-integrity.integration.test.ts (CI database).
 */
process.env.JWT_SECRET = 'test-secret';

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

interface Member { status: string | null; role: string; joined_at: string }
interface Community {
  id: string; name: string; location: string; status: string; access_type: string;
  current_members: number; max_members: number; created_at: string;
}
interface Fake {
  community: Community;
  member?: Member;
  tx: { opened: number; committed: number; rolledBack: number };
  txSql: string[];
  /** Runs once, right after the member row is locked (a change that committed while we waited). */
  afterLock?: (f: Fake) => void;
  /** Runs once, right after an admitting write. */
  afterWrite?: (f: Fake) => void;
  /** Plants a concurrent winner before the INSERT applies. */
  beforeInsert?: (f: Fake) => void;
  /** Removes that winner again before it can be read back. */
  afterInsertConflict?: (f: Fake) => void;
  /** Overrides the post-commit refreshed membership list. */
  refreshed?: Array<{ id: string; name: string; role: string | null }>;
  txError?: { match: RegExp; error: Error };
}

const mockState: { f?: Fake } = {};
const rows = (r: unknown[]) => ({ rows: r, rowCount: r.length });
const OLD_JOIN = '2025-01-02T03:04:05.000Z';

function mockTxQuery(sql: string, params: any[] = []) {
  const f = mockState.f!;
  f.txSql.push(sql.replace(/\s+/g, ' ').trim());
  if (f.txError && f.txError.match.test(sql)) throw f.txError.error;
  if (/FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2\s+FOR UPDATE/i.test(sql)) {
    const out = f.member ? [{ ...f.member }] : [];
    if (f.afterLock) { const hook = f.afterLock; f.afterLock = undefined; hook(f); }
    return rows(out);
  }
  if (/^\s*SELECT status, access_type FROM communities\.communities WHERE id = \$1/i.test(sql)) {
    return rows([{ status: f.community.status, access_type: f.community.access_type }]);
  }
  if (/^\s*INSERT INTO communities\.members/i.test(sql)) {
    if (f.beforeInsert) { const hook = f.beforeInsert; f.beforeInsert = undefined; hook(f); }
    if (f.member) {
      if (f.afterInsertConflict) { const hook = f.afterInsertConflict; f.afterInsertConflict = undefined; hook(f); }
      return rows([]);
    }
    f.member = { status: 'active', role: 'member', joined_at: 'NOW' };
    f.community.current_members += 1;
    if (f.afterWrite) { const hook = f.afterWrite; f.afterWrite = undefined; hook(f); }
    return rows([{ role: 'member' }]);
  }
  if (/^\s*UPDATE communities\.members/i.test(sql)) {
    if (!f.member || f.member.status !== 'left' || !/status = 'left'/.test(sql)) return rows([]);
    f.member = { status: 'active', role: 'member', joined_at: 'NOW' };
    f.community.current_members += 1;
    if (f.afterWrite) { const hook = f.afterWrite; f.afterWrite = undefined; hook(f); }
    return rows([{ role: 'member' }]);
  }
  if (/^\s*SELECT current_members, max_members FROM communities\.communities WHERE id = \$1/i.test(sql)) {
    return rows([{ current_members: f.community.current_members, max_members: f.community.max_members }]);
  }
  if (/^\s*SELECT current_members FROM communities\.communities WHERE id = \$1/i.test(sql)) {
    return rows([{ current_members: f.community.current_members }]);
  }
  throw new Error(`fake tx: unhandled SQL: ${sql}`);
}

function mockPoolQuery(sql: string) {
  const f = mockState.f!;
  if (/LOWER\s*\(\s*TRIM\s*\(\s*name/i.test(sql)) return rows([{ ...f.community, status: 'active' }]);
  if (/JOIN communities\.members/i.test(sql)) {
    if (f.refreshed) return rows(f.refreshed);
    return rows(f.member?.status === 'active' ? [{ id: f.community.id, name: f.community.name, role: f.member.role }] : []);
  }
  if (/^\s*SELECT \* FROM communities\.communities WHERE id = \$1/i.test(sql)) return rows([{ ...f.community }]);
  throw new Error(`fake pool: unhandled SQL: ${sql}`);
}

jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
  query: async (sql: string, params?: any[]) => mockPoolQuery(sql),
  withTransaction: async (fn: any) => {
    const f = mockState.f!;
    f.tx.opened++;
    const saved = { community: { ...f.community }, member: f.member ? { ...f.member } : undefined };
    try {
      const result = await fn(async (sql: string, params?: any[]) => mockTxQuery(sql, params));
      f.tx.committed++;
      return result;
    } catch (error) {
      f.tx.rolledBack++;
      f.community = saved.community;
      f.member = saved.member;
      throw error;
    }
  },
}));
jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/routes/fusions', () => ({
  getActiveFusionProposalForCommunityRoute: jest.fn().mockResolvedValue(null),
}));

import communitiesRouter from '../../src/routes/communities';

const C = 'cccccccc-1450-4000-8000-00000000000c';
const CALLER = 'bbbbbbbb-1450-4000-8000-00000000000b';
const PRIVATE_MESSAGE = 'A private community with this name and location already exists. Request approval to join.';
const RESTORE_MESSAGE = 'Ask a community admin to lift the block; then you can rejoin';
const MEMBER_WRITE = /^(INSERT INTO|UPDATE) communities\.members/;

type InstallOptions = { access?: string; current?: number; max?: number; member?: Partial<Member> | null }
  & Omit<Partial<Fake>, 'member'>;
function install(over: InstallOptions = {}): Fake {
  const { access, current, max, member, ...hooks } = over;
  mockState.f = {
    community: {
      id: C, name: 'Admission Co', location: 'Here', status: 'active', access_type: access ?? 'public',
      current_members: current ?? 3, max_members: max ?? 150, created_at: '2026-01-01T00:00:00Z',
    },
    member: member ? { status: 'active', role: 'member', joined_at: OLD_JOIN, ...member } : undefined,
    tx: { opened: 0, committed: 0, rolledBack: 0 },
    txSql: [],
    ...hooks,
  };
  return mockState.f;
}

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { req.user = { userId: CALLER, email: 'caller@test.invalid', communities: [] }; next(); });
app.use('/communities', communitiesRouter);
const create = () => request(app).post('/communities').send({ name: 'admission co', location: ' HERE ', community_type: 'mutual_aid' });
const memberWrites = (f: Fake) => f.txSql.filter((s) => MEMBER_WRITE.test(s));
const tokenCommunities = (token: string) => (jwt.verify(token, 'test-secret') as any).communities;

describe('Sprint 145 duplicate-create (public match) — state matrix', () => {
  it('admits a newcomer as an active member, reports the stored count and refreshes the token', async () => {
    const f = install({ current: 3 });
    const res = await create();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: true });
    expect(res.body.data.community).toMatchObject({ id: C, current_members: 4, role: 'member' });
    expect(tokenCommunities(res.body.data.token)).toEqual([{ id: C, name: 'Admission Co', role: 'member' }]);
    expect(f.member).toMatchObject({ status: 'active', role: 'member' });
    expect(f.tx).toEqual({ opened: 1, committed: 1, rolledBack: 0 });
  });

  it('rejoins a left former admin as an ordinary member (role reset, fresh join time)', async () => {
    const f = install({ member: { status: 'left', role: 'admin' } });
    const res = await create();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: true });
    expect(res.body.data.community).toMatchObject({ current_members: 4, role: 'member' });
    expect(f.member).toEqual({ status: 'active', role: 'member', joined_at: 'NOW' });
    const update = f.txSql.find((s) => /^UPDATE communities\.members/.test(s))!;
    expect(update).toMatch(/SET role = 'member', status = 'active', join_request_message = NULL, joined_at = CURRENT_TIMESTAMP/);
    expect(update).toMatch(/WHERE community_id = \$1 AND user_id = \$2 AND status = 'left'/);
  });

  it.each([[3, 3], [5, 3]])('keeps an active moderator idempotent at count %i / cap %i: role and join time preserved, no member write',
    async (current, max) => {
      const f = install({ current, max, member: { status: 'active', role: 'moderator' } });
      const res = await create();
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ existing: true, joined: true });
      expect(res.body.data.community).toMatchObject({ current_members: current, role: 'moderator' });
      expect(tokenCommunities(res.body.data.token)).toEqual([{ id: C, name: 'Admission Co', role: 'moderator' }]);
      expect(memberWrites(f)).toEqual([]);
      expect(f.txSql.some((s) => /current_members, max_members/.test(s))).toBe(false);
      expect(f.member).toEqual({ status: 'active', role: 'moderator', joined_at: OLD_JOIN });
    });

  it('refuses a pending applicant with 409 CONFLICT: no approval, no token, no write', async () => {
    const f = install({ member: { status: 'pending', role: 'member' } });
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'CONFLICT' });
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/token/);
    expect(memberWrites(f)).toEqual([]);
    expect(f.member!.status).toBe('pending');
    expect(f.community.current_members).toBe(3);
  });

  it.each([['inactive'], [null], ['invited']])('refuses a %p row with 409 MEMBERSHIP_RESTORE_REQUIRES_STAFF and writes nothing', async (status) => {
    const f = install({ member: { status, role: 'admin' } });
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF', message: RESTORE_MESSAGE });
    expect(res.body.data).toBeUndefined();
    expect(memberWrites(f)).toEqual([]);
    expect(f.member!.status).toBe(status);
  });

  it.each([
    ['a newcomer', undefined],
    ['a left member', { status: 'left' }],
  ])('refuses %s whose admission overfills the community with 400 COMMUNITY_FULL, rolled back, no token', async (_label, member) => {
    const f = install({ current: 3, max: 3, member: member as Partial<Member> | undefined });
    const res = await create();
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_FULL' });
    expect(res.body.data).toBeUndefined();
    expect(f.tx).toEqual({ opened: 1, committed: 0, rolledBack: 1 });
    expect(f.community.current_members).toBe(3);
    const sql = f.txSql;
    expect(sql.findIndex((s) => /current_members, max_members/.test(s))).toBeGreaterThan(sql.findIndex((s) => MEMBER_WRITE.test(s)));
  });

  it('locks the caller membership row before reading the community and before deciding', async () => {
    const f = install();
    await create();
    expect(f.txSql[0]).toMatch(/^SELECT status, role FROM communities\.members WHERE community_id = \$1 AND user_id = \$2 FOR UPDATE$/);
    expect(f.txSql[1]).toMatch(/^SELECT status, access_type FROM communities\.communities WHERE id = \$1$/);
  });
});

describe('Sprint 145 duplicate-create — private pointer, policy and state changes mid-request', () => {
  it.each([[null], ['active'], ['pending'], ['left'], ['inactive']])('answers a private match with the pointer for a %p caller: no transaction, no token', async (status) => {
    const f = install({ access: 'private', member: status ? { status, role: 'member' } : null });
    const res = await create();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: false, message: PRIVATE_MESSAGE });
    expect(res.body.data.token).toBeUndefined();
    expect(f.tx.opened).toBe(0);
  });

  it.each([
    ['a newcomer', undefined],
    ['an active member', { status: 'active', role: 'moderator' }],
  ])('returns the private pointer to %s when the community turned private before the decision', async (_label, member) => {
    const f = install({ member: member as Partial<Member> | undefined, afterLock: (x) => { x.community.access_type = 'private'; } });
    const res = await create();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: false, message: PRIVATE_MESSAGE });
    expect(res.body.data.token).toBeUndefined();
    expect(memberWrites(f)).toEqual([]);
    expect(f.tx.committed).toBe(0);
  });

  it('rolls a tentative admission back before answering the private pointer with the restored count', async () => {
    const f = install({ current: 3, afterWrite: (x) => { x.community.access_type = 'private'; } });
    const res = await create();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: false, message: PRIVATE_MESSAGE });
    expect(res.body.data.token).toBeUndefined();
    expect(f.tx).toEqual({ opened: 1, committed: 0, rolledBack: 1 });
    expect(f.member).toBeUndefined();
    expect(res.body.data.community.current_members).toBe(3);
  });

  it.each([['before the decision', 'afterLock'], ['after the admitting write', 'afterWrite']] as const)(
    'refuses with 400 COMMUNITY_INACTIVE when the community became inactive %s', async (_label, hook) => {
      const f = install({ [hook]: (x: Fake) => { x.community.status = 'archived'; } } as InstallOptions);
      const res = await create();
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_INACTIVE' });
      expect(res.body.data).toBeUndefined();
      expect(f.tx.committed).toBe(0);
      expect(f.member).toBeUndefined();
    });
});

describe('Sprint 145 duplicate-create — lost INSERT race and post-commit token truth', () => {
  it('refuses a pending winner of the INSERT race with 409 CONFLICT instead of reporting joined', async () => {
    const f = install({ beforeInsert: (x) => { x.member = { status: 'pending', role: 'member', joined_at: OLD_JOIN }; } });
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
    expect(f.tx.committed).toBe(0);
  });

  it('treats an active winner as the idempotent success with the winner\'s actual role', async () => {
    const f = install({ beforeInsert: (x) => { x.member = { status: 'active', role: 'admin', joined_at: OLD_JOIN }; } });
    const res = await create();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: true });
    expect(res.body.data.community.role).toBe('admin');
    expect(f.txSql.some((s) => /current_members, max_members/.test(s))).toBe(false);
  });

  // PR #342 review: the INSERT waited on the winner's transaction, which may also have changed the community.
  // The winner is classified only after the community is re-read, exactly as on the first path.
  it.each([['an active', 'active'], ['a pending', 'pending'], ['a blocked', 'inactive']])(
    'answers the private pointer to %s INSERT-race winner when the community turned private meanwhile', async (_label, status) => {
      const f = install({ beforeInsert: (x) => {
        x.member = { status, role: 'admin', joined_at: OLD_JOIN };
        x.community.access_type = 'private';
      } });
      const res = await create();
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ existing: true, joined: false, message: PRIVATE_MESSAGE });
      expect(res.body.data.token).toBeUndefined();
      expect(f.tx.committed).toBe(0);
      expect(memberWrites(f)).toEqual([expect.stringMatching(/^INSERT INTO communities\.members .*ON CONFLICT/)]);
    });

  it('refuses an active INSERT-race winner with 400 COMMUNITY_INACTIVE when the community was archived meanwhile', async () => {
    const f = install({ beforeInsert: (x) => {
      x.member = { status: 'active', role: 'admin', joined_at: OLD_JOIN };
      x.community.status = 'archived';
    } });
    const res = await create();
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_INACTIVE' });
    expect(res.body.data).toBeUndefined();
    expect(f.tx.committed).toBe(0);
  });

  it('refuses with retryable 409 CONFLICT when the winner cannot be read back', async () => {
    const f = install({
      beforeInsert: (x) => { x.member = { status: 'active', role: 'member', joined_at: OLD_JOIN }; },
      afterInsertConflict: (x) => { x.member = undefined; },
    });
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
    expect(f.tx.committed).toBe(0);
  });

  it('returns 409 MEMBERSHIP_CHANGED with no token when the refreshed list lacks the community (no invented role)', async () => {
    const f = install({ refreshed: [{ id: 'dddddddd-1450-4000-8000-00000000000d', name: 'Elsewhere', role: 'admin' }] });
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'MEMBERSHIP_CHANGED' });
    expect(res.body.data).toBeUndefined();
    expect(f.tx.committed).toBe(1);
  });

  it('keeps an active admin\'s real role in the response and token', async () => {
    install({ member: { status: 'active', role: 'admin' } });
    const res = await create();
    expect(res.status).toBe(200);
    expect(res.body.data.community.role).toBe('admin');
    expect(tokenCommunities(res.body.data.token)).toEqual([{ id: C, name: 'Admission Co', role: 'admin' }]);
  });

  it.each([['40P01'], ['40001']])('maps a %s transaction failure to 503 ADMISSION_RETRY', async (code) => {
    const f = install({ txError: { match: /^\s*INSERT INTO communities\.members/i, error: Object.assign(new Error('deadlock'), { code }) } });
    const res = await create();
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: 'ADMISSION_RETRY' });
    expect(f.tx.rolledBack).toBe(1);
  });
});
