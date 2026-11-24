/**
 * Sprint 145 — admission integrity, real-database proof (BUG-106 invitation acceptance, BUG-108
 * duplicate-create; approved D1–D3).
 *
 * In-process routes with real JWT verification, both real service pools, real SQL and the real ADR-106
 * member-count and inviter-stats triggers; only community-service event delivery is mocked. CI runs as a
 * superuser that bypasses RLS, so every query names its community explicitly (gotcha
 * database-roles-bypass-rls-so-rls-is-not-an-isolation-proof) and no case credits RLS with isolation.
 *
 * "Nothing persisted" compares a full snapshot: the community's member rows (role, status, joined_at,
 * request message), stored count and xmin (a trigger write that nets to zero still changes xmin), the
 * invitation rows, the invitee's attribution and the inviter's accepted-stat.
 *
 * Race barriers hold one row lock, wait until the contenders block on a SPECIFIC statement, then release
 * unconditionally in `finally` and settle every request (the corrected Sprint 144 helper). A waiter count
 * keyed on a statement prefix, not on a table name, is what stops a lock regression from counting as a
 * pass: the inviter FOR SHARE select also mentions communities.members.
 */
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import servicePool from '../../services/community-service/src/database/db';
import membersRouter from '../../services/community-service/src/routes/members';
import communitiesRouter from '../../services/community-service/src/routes/communities';
import invitationsRouter from '../../services/social-graph-service/src/routes/invitations';
import { pool as socialGraphPool } from '../../services/social-graph-service/src/config/database';
import { authMiddleware } from '../../packages/shared/middleware/auth';

jest.mock('../../services/community-service/src/events/publisher', () => ({
  publishEvent: jest.fn(),
  initEventPublisher: jest.fn(),
}));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const OLD_JOIN = '2025-01-02T03:04:05';
const CONFLICT_MESSAGE = 'You previously joined this community through this inviter. Ask a different member '
  + 'for an invitation. If the community is public, rejoin from its community page.';
const RESTORE_MESSAGE = 'Ask a community admin to lift the block; then you can rejoin';
const USED_MESSAGE = 'This invitation code has already been used';

const createdCommunities: string[] = [];
const createdUsers: string[] = [];

async function users(n: number): Promise<string[]> {
  const ids = Array.from({ length: n }, () => randomUUID());
  await pool.query(`INSERT INTO auth.users(id,email,name,password_hash)
    SELECT id, id::text || '@s145.invalid', 'S145 member', 'unused' FROM unnest($1::uuid[]) id`, [ids]);
  createdUsers.push(...ids);
  return ids;
}

async function community(opts: { access?: 'public' | 'private'; max?: number; creator?: string; status?: string; name?: string } = {}): Promise<string> {
  const id = randomUUID();
  const creator = opts.creator ?? (await users(1))[0];
  await pool.query(`INSERT INTO communities.communities(id,name,location,creator_id,access_type,max_members,status)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
  [id, opts.name ?? `S145 ${id}`, `S145 place ${id}`, creator, opts.access ?? 'public', opts.max ?? 150, opts.status ?? 'active']);
  createdCommunities.push(id);
  return id;
}

const addMember = (c: string, u: string, status: string | null = 'active', role = 'member', message: string | null = null) =>
  pool.query(`INSERT INTO communities.members(community_id,user_id,role,status,join_request_message,joined_at)
    VALUES($1,$2,$3,$4,$5,$6)`, [c, u, role, status, message, OLD_JOIN]);
const setMax = (c: string, max: number) => pool.query(`UPDATE communities.communities SET max_members=$2 WHERE id=$1`, [c, max]);
const count = async (c: string): Promise<number> =>
  (await pool.query(`SELECT current_members FROM communities.communities WHERE id=$1`, [c])).rows[0].current_members;
const activeRows = async (c: string): Promise<number> => (await pool.query(
  `SELECT count(*)::int AS n FROM communities.members WHERE community_id=$1 AND status='active'`, [c])).rows[0].n;
const memberRow = async (c: string, u: string) => (await pool.query(
  `SELECT role, status, joined_at, join_request_message FROM communities.members WHERE community_id=$1 AND user_id=$2`,
  [c, u])).rows[0];

/** A valid code (CHECK invitation_code_format); the 8-hex middle segment keeps codes unique within a run. */
const newCode = () => {
  const hex = randomUUID().replace(/-/g, '').toUpperCase();
  return `KARMYQ-S145${hex.slice(0, 8)}-2026-${hex.slice(8, 12)}`;
};
async function invite(inviter: string, c: string | null, invitee: string | null = null): Promise<{ id: string; code: string }> {
  const code = newCode();
  const { rows } = await pool.query(`INSERT INTO auth.user_invitations(inviter_id,invitee_id,community_id,invitation_code,invitation_method)
    VALUES($1,$2,$3,$4,'link') RETURNING id`, [inviter, invitee, c, code]);
  return { id: rows[0].id, code };
}
const invitationRow = async (id: string) => (await pool.query(
  `SELECT inviter_id, invitee_id, community_id, invitation_accepted_at FROM auth.user_invitations WHERE id=$1`, [id])).rows[0];
const attribution = async (u: string) => (await pool.query(
  `SELECT invited_by, invitation_accepted_at FROM auth.users WHERE id=$1`, [u])).rows[0];
const acceptedStat = async (inviter: string, c: string): Promise<number> => (await pool.query(
  `SELECT total_invitations_accepted AS n FROM auth.inviter_stats WHERE user_id=$1 AND community_id=$2`, [inviter, c])).rows[0]?.n ?? 0;

/** Everything an admission could touch, for exact "nothing persisted" comparisons. */
async function snapshot(c: string, invitee: string, inviter: string, invitationIds: string[]) {
  return {
    members: (await pool.query(`SELECT user_id, role, status, joined_at, join_request_message FROM communities.members
      WHERE community_id=$1 ORDER BY user_id`, [c])).rows,
    community: (await pool.query(`SELECT current_members, xmin::text AS xmin FROM communities.communities WHERE id=$1`, [c])).rows[0],
    invitations: (await pool.query(`SELECT id, invitee_id, invitation_accepted_at FROM auth.user_invitations
      WHERE id = ANY($1::uuid[]) ORDER BY id`, [invitationIds])).rows,
    attribution: await attribution(invitee),
    stat: await acceptedStat(inviter, c),
  };
}

afterEach(async () => {
  if (createdUsers.length || createdCommunities.length) {
    await pool.query(`DELETE FROM auth.user_invitations
      WHERE inviter_id=ANY($1::uuid[]) OR invitee_id=ANY($1::uuid[]) OR community_id=ANY($2::uuid[])`,
    [createdUsers, createdCommunities]);
  }
  if (createdCommunities.length) {
    await pool.query(`DELETE FROM communities.communities WHERE id=ANY($1::uuid[])`, [createdCommunities.splice(0)]);
  }
  if (createdUsers.length) {
    await pool.query(`DELETE FROM auth.users WHERE id=ANY($1::uuid[])`, [createdUsers.splice(0)]);
  }
});

afterAll(async () => {
  await servicePool.end();
  await socialGraphPool.end();
  await pool.end();
});

// In-process routes, as the Sprint 143/144 files drive them: real JWT, real transactions, real triggers.
const app = express();
app.use(express.json());
app.use('/communities', authMiddleware, communitiesRouter);
app.use('/communities', authMiddleware, membersRouter);
app.use('/invitations', authMiddleware, invitationsRouter);
const tokenFor = (userId: string, communities: unknown[] = []) => jwt.sign(
  { userId, email: `${userId}@s145.invalid`, communities }, process.env.JWT_SECRET!,
);
const as = (userId: string, claims: unknown[] = []) => ({
  accept: (code: unknown) => request(app).post('/invitations/accept').auth(tokenFor(userId, claims), { type: 'bearer' })
    .send({ invitation_code: code }),
  join: (c: string) => request(app).post(`/communities/${c}/join`).auth(tokenFor(userId), { type: 'bearer' }).send({}),
  add: (c: string, user_id: string) => request(app).post(`/communities/${c}/members`)
    .auth(tokenFor(userId), { type: 'bearer' }).send({ user_id }),
  put: (c: string, target: string, body: object) => request(app).put(`/communities/${c}/members/${target}`)
    .auth(tokenFor(userId), { type: 'bearer' }).send(body),
  del: (c: string, target: string) => request(app).delete(`/communities/${c}/members/${target}`)
    .auth(tokenFor(userId), { type: 'bearer' }).send({}),
  create: (body: object) => request(app).post('/communities').auth(tokenFor(userId), { type: 'bearer' }).send(body),
});

/** A community with an active `inviterRole` inviter plus `others` active members, at cap `max`. */
async function invitingCommunity(opts: { access?: 'public' | 'private'; max?: number; inviterRole?: string; others?: number } = {}) {
  const [admin, inviter] = await users(2);
  const c = await community({ creator: admin, max: opts.max, access: opts.access });
  await addMember(c, admin, 'active', 'admin');
  await addMember(c, inviter, 'active', opts.inviterRole ?? 'member');
  const others = await users(opts.others ?? 0);
  for (const u of others) await addMember(c, u);
  return { c, admin, inviter, others };
}

/** Lock-waiting backends whose current statement matches `pattern` (ILIKE). */
async function waiting(pattern: string): Promise<number> {
  return (await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity
    WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE $1`, [pattern])).rows[0].n;
}
async function waitForWaiters(pattern: string, expected: number, done: () => boolean, timeoutMs = 15000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let n = await waiting(pattern);
  while (n < expected && !done() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    n = await waiting(pattern);
  }
  return n;
}

/**
 * Hold `lockSql` on a barrier client, fire the contenders, wait for exactly `expected` of them to block on a
 * statement matching `waitPattern`, run `whileHeld` (more probes, more contenders), then release. Unlock comes
 * first and unconditionally: a failed expectation must not return a locked client to the pool (PR #341
 * review). A barrier whose ROLLBACK fails is destroyed, which ends its transaction too. In-flight requests are
 * always settled before the helper returns or rethrows.
 */
async function holdAndRace<T>(
  lock: { sql: string; params: unknown[]; commit?: (barrier: PoolClient) => Promise<void> },
  waitPattern: string,
  expected: number,
  fire: () => Promise<T>,
  whileHeld?: () => Promise<void>,
): Promise<T> {
  const barrier = await pool.connect();
  let pending: Promise<T> | undefined;
  let finished = false;
  try {
    await barrier.query('BEGIN');
    await barrier.query(lock.sql, lock.params);
    pending = fire().finally(() => { finished = true; });
    pending.catch(() => undefined);
    expect(await waitForWaiters(waitPattern, expected, () => finished)).toBe(expected);
    if (whileHeld) await whileHeld();
    if (lock.commit) await lock.commit(barrier);
  } finally {
    barrier.release(await barrier.query(lock.commit ? 'COMMIT' : 'ROLLBACK').then(() => undefined, (error: Error) => error));
    await pending?.catch(() => undefined);
  }
  return pending!;
}
const COMMUNITY_ROW_LOCK = (c: string) => ({ sql: `SELECT 1 FROM communities.communities WHERE id=$1 FOR UPDATE`, params: [c] });
const MEMBER_INSERT = '%INSERT INTO communities.members%';

/** A share lock held by an acceptance makes an exclusive lock on the same member row unavailable. */
async function expectRowShareLocked(c: string, u: string) {
  const probe = await pool.connect();
  try {
    await probe.query('BEGIN');
    await expect(probe.query(`SELECT 1 FROM communities.members WHERE community_id=$1 AND user_id=$2 FOR UPDATE NOWAIT`, [c, u]))
      .rejects.toMatchObject({ code: '55P03' });
  } finally {
    probe.release(await probe.query('ROLLBACK').then(() => undefined, (error: Error) => error));
  }
}

/**
 * The shared admission state table (spec "Membership decisions"): one row per stored invitee/caller state,
 * driving both endpoints so the two services' local classifications are proven to agree on the real schema.
 * `null` and `'invited'` are stored statuses with no admission meaning and must fail closed.
 */
type Outcome =
  | { http: 200; kind: 'admitted' }
  | { http: 200; kind: 'noop' }
  | { http: 409; error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' | 'CONFLICT' };
const STATE_MATRIX: Array<{ label: string; status: string | null; role: string; accept: Outcome; duplicate: Outcome }> = [
  { label: 'a left former admin', status: 'left', role: 'admin', accept: { http: 200, kind: 'admitted' }, duplicate: { http: 200, kind: 'admitted' } },
  { label: 'an active moderator', status: 'active', role: 'moderator', accept: { http: 200, kind: 'noop' }, duplicate: { http: 200, kind: 'noop' } },
  { label: 'a pending applicant', status: 'pending', role: 'moderator', accept: { http: 200, kind: 'admitted' }, duplicate: { http: 409, error: 'CONFLICT' } },
  { label: 'an inactive (blocked) member', status: 'inactive', role: 'admin', accept: { http: 409, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' }, duplicate: { http: 409, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' } },
  { label: 'a NULL-status row', status: null, role: 'member', accept: { http: 409, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' }, duplicate: { http: 409, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' } },
  { label: 'an unknown stored status', status: 'invited', role: 'member', accept: { http: 409, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' }, duplicate: { http: 409, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' } },
];

describe('Sprint 145 database role evidence', () => {
  it('records the DB role flags used to exercise explicit community predicates', async () => {
    const result = await pool.query(`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    console.warn('Sprint 145 DB role evidence', result.rows[0]);
    expect(result.rows).toHaveLength(1);
  });
});

describe('Sprint 145 invitation acceptance — state matrix (real SQL and triggers)', () => {
  it.each(['public', 'private'] as const)('admits a newcomer to a %s community through an ordinary member (D3) atomically', async (access) => {
    const { c, inviter } = await invitingCommunity({ access });
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    const res = await as(p).accept(inv.code);
    expect(res.status).toBe(200);
    const row = await invitationRow(inv.id);
    expect(res.body.data).toEqual({ inviter_id: inviter, community_id: c, accepted_at: row.invitation_accepted_at.toISOString() });
    expect(row.invitee_id).toBe(p);
    expect(await memberRow(c, p)).toMatchObject({ role: 'member', status: 'active', join_request_message: null });
    expect(await attribution(p)).toEqual({ invited_by: inviter, invitation_accepted_at: row.invitation_accepted_at });
    expect(await acceptedStat(inviter, c)).toBe(1);
    expect(await count(c)).toBe(3);
    expect(await activeRows(c)).toBe(3);
  });

  it.each(['admin', 'moderator'])('admits through an active %s inviter', async (inviterRole) => {
    const { c, inviter } = await invitingCommunity({ inviterRole });
    const [p] = await users(1);
    const res = await as(p).accept((await invite(inviter, c)).code);
    expect(res.status).toBe(200);
    expect(await memberRow(c, p)).toMatchObject({ role: 'member', status: 'active' });
  });

  for (const access of ['public', 'private'] as const) {
    it.each(STATE_MATRIX)(`${access}: an invitation for $label answers per the approved table`, async ({ status, role, accept }) => {
      const { c, inviter } = await invitingCommunity({ access });
      const [p] = await users(1);
      await addMember(c, p, status, role, 'request note');
      const inv = await invite(inviter, c);
      const before = await snapshot(c, p, inviter, [inv.id]);
      const res = await as(p).accept(inv.code);
      expect(res.status).toBe(accept.http);
      if (accept.http === 409) {
        expect(res.body).toMatchObject({ success: false, error: accept.error, message: RESTORE_MESSAGE });
        expect(await snapshot(c, p, inviter, [inv.id])).toEqual(before);
      } else if (accept.kind === 'noop') {
        // D1: no consumption, no membership/timestamp change, no stat, no attribution, no trigger write.
        expect(res.body.data).toEqual({ inviter_id: inviter, community_id: c, accepted_at: null, already_member: true });
        expect(await snapshot(c, p, inviter, [inv.id])).toEqual(before);
      } else {
        const after = await memberRow(c, p);
        expect(after).toMatchObject({ role: 'member', status: 'active', join_request_message: null });
        expect(after.joined_at.getTime()).not.toBe(before.members.find((m: any) => m.user_id === p).joined_at.getTime());
        expect((await invitationRow(inv.id)).invitee_id).toBe(p);
        expect(await acceptedStat(inviter, c)).toBe(1);
        expect(await count(c)).toBe(before.community.current_members + 1);
        expect(await count(c)).toBe(await activeRows(c));
      }
    });
  }

  it('keeps the D1 no-op successful when the community is full and overfull, and the code usable by a newcomer', async () => {
    const { c, inviter } = await invitingCommunity({ max: 3 });
    const [p, newcomer] = await users(2);
    await addMember(c, p, 'active', 'moderator');
    const inv = await invite(inviter, c);
    const full = await snapshot(c, p, inviter, [inv.id]);
    expect((await as(p).accept(inv.code)).body.data).toMatchObject({ already_member: true, accepted_at: null });
    expect(await snapshot(c, p, inviter, [inv.id])).toEqual(full);
    await setMax(c, 2);
    const overfull = await snapshot(c, p, inviter, [inv.id]);
    const res = await as(p).accept(inv.code);
    expect(res.status).toBe(200);
    expect(res.body.data.already_member).toBe(true);
    expect(await snapshot(c, p, inviter, [inv.id])).toEqual(overfull);
    // The code was never consumed; an eligible newcomer can still use it once there is room.
    await setMax(c, 4);
    const used = await as(newcomer).accept(inv.code);
    expect(used.status).toBe(200);
    expect(used.body.data.already_member).toBeUndefined();
    expect((await invitationRow(inv.id)).invitee_id).toBe(newcomer);
  });

  it.each([
    ['a newcomer', null],
    ['a left member', 'left'],
    ['a pending applicant', 'pending'],
  ])('refuses %s when the community is full with 400 COMMUNITY_FULL and persists nothing', async (_label, status) => {
    const { c, inviter } = await invitingCommunity({ max: 2 });
    const [p] = await users(1);
    if (status) await addMember(c, p, status, 'member');
    const inv = await invite(inviter, c);
    const before = await snapshot(c, p, inviter, [inv.id]);
    const res = await as(p).accept(inv.code);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COMMUNITY_FULL');
    expect(await snapshot(c, p, inviter, [inv.id])).toEqual(before);
  });
});

describe('Sprint 145 invitation acceptance — identity, authority and invitation refusals', () => {
  it('refuses accepting one\'s own invitation with 400 even when the inviter is an active member (not a D1 no-op)', async () => {
    const { c, inviter } = await invitingCommunity();
    const inv = await invite(inviter, c);
    const before = await snapshot(c, inviter, inviter, [inv.id]);
    const res = await as(inviter).accept(inv.code);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(await snapshot(c, inviter, inviter, [inv.id])).toEqual(before);
  });

  it('keeps the database self-invitation guard (no_self_invitation CHECK)', async () => {
    const { c, inviter } = await invitingCommunity();
    const inv = await invite(inviter, c);
    await expect(pool.query(`UPDATE auth.user_invitations SET invitee_id=inviter_id WHERE id=$1`, [inv.id]))
      .rejects.toMatchObject({ code: '23514', constraint: 'no_self_invitation' });
  });

  it('refuses a code bound to a different invitee with 403 and persists nothing (synthetic fixture)', async () => {
    const { c, inviter } = await invitingCommunity();
    const [p, someoneElse] = await users(2);
    const inv = await invite(inviter, c, someoneElse);
    const before = await snapshot(c, p, inviter, [inv.id]);
    const res = await as(p).accept(inv.code);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(await snapshot(c, p, inviter, [inv.id])).toEqual(before);
    // Paired success: the bound invitee themself is admitted.
    expect((await as(someoneElse).accept(inv.code)).status).toBe(200);
  });

  it.each([
    ['left', 'left'],
    ['was removed', 'inactive'],
    ['is pending', 'pending'],
  ])('refuses with 403 when the inviter %s, persisting nothing', async (_label, status) => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    await pool.query(`UPDATE communities.members SET status=$3 WHERE community_id=$1 AND user_id=$2`, [c, inviter, status]);
    const before = await snapshot(c, p, inviter, [inv.id]);
    const res = await as(p).accept(inv.code);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(await snapshot(c, p, inviter, [inv.id])).toEqual(before);
  });

  it('refuses an outsider-minted code for a private community (no inviter row), and a foreign membership confers nothing', async () => {
    const { c } = await invitingCommunity({ access: 'private' });
    const elsewhere = await community();
    const [outsider, p] = await users(2);
    await addMember(elsewhere, outsider, 'active', 'admin');
    const inv = await invite(outsider, c);
    const before = await snapshot(c, p, outsider, [inv.id]);
    // The caller's forged claim of admin in C is irrelevant: authority is the INVITER's live row in C.
    const res = await as(p, [{ id: c, name: 'C', role: 'admin' }]).accept(inv.code);
    expect(res.status).toBe(403);
    expect(await snapshot(c, p, outsider, [inv.id])).toEqual(before);
  });

  it('refuses a code with no stored community, and one whose community does not exist, with 404', async () => {
    const [inviter, p] = await users(2);
    const orphan = await invite(inviter, null);
    const missing = await invite(inviter, randomUUID());
    for (const inv of [orphan, missing]) {
      const res = await as(p).accept(inv.code);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
      expect(await invitationRow(inv.id)).toMatchObject({ invitee_id: null, invitation_accepted_at: null });
    }
    expect(await attribution(p)).toEqual({ invited_by: null, invitation_accepted_at: null });
  });

  it('refuses an inactive community with 400 COMMUNITY_INACTIVE', async () => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    await pool.query(`UPDATE communities.communities SET status='archived' WHERE id=$1`, [c]);
    const before = await snapshot(c, p, inviter, [inv.id]);
    const res = await as(p).accept(inv.code);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COMMUNITY_INACTIVE');
    expect(await snapshot(c, p, inviter, [inv.id])).toEqual(before);
  });

  it('refuses a used code for everyone, including the member who used it, and an unknown code with 404', async () => {
    const { c, inviter } = await invitingCommunity();
    const [first, second] = await users(2);
    const inv = await invite(inviter, c);
    expect((await as(first).accept(inv.code)).status).toBe(200);
    const after = await snapshot(c, first, inviter, [inv.id]);
    for (const u of [second, first]) {
      const res = await as(u).accept(inv.code);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'INVITATION_ALREADY_USED', message: USED_MESSAGE });
    }
    expect(await snapshot(c, first, inviter, [inv.id])).toEqual(after);
    expect(await memberRow(c, second)).toBeUndefined();
    const unknown = await as(second).accept(newCode());
    expect(unknown.status).toBe(404);
  });

  it.each([[''], [null], [['x']], [7]])('refuses invitation_code %p with 400 before any SQL', async (code) => {
    const [p] = await users(1);
    const res = await as(p).accept(code);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('Sprint 145 invitation acceptance — real repeat-invitation history (same inviter, same community)', () => {
  /** Admit `p` through `inviter`'s first code, then let `p` leave through the real self-removal route. */
  async function joinedThenLeft(access: 'public' | 'private') {
    const { c, inviter, admin } = await invitingCommunity({ access });
    const [p] = await users(1);
    const first = await invite(inviter, c);
    expect((await as(p).accept(first.code)).status).toBe(200);
    expect((await as(p).del(c, p)).status).toBe(200);
    expect(await memberRow(c, p)).toMatchObject({ status: 'left' });
    return { c, inviter, admin, p, first };
  }

  it('refuses a left member\'s fresh code from the same inviter with 409 INVITATION_CONFLICT and keeps every row', async () => {
    const { c, inviter, p, first } = await joinedThenLeft('public');
    const firstRow = await invitationRow(first.id);
    const fresh = await invite(inviter, c);
    const before = await snapshot(c, p, inviter, [first.id, fresh.id]);
    const res = await as(p).accept(fresh.code);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'INVITATION_CONFLICT', message: CONFLICT_MESSAGE });
    expect(await snapshot(c, p, inviter, [first.id, fresh.id])).toEqual(before);
    expect(await invitationRow(first.id)).toEqual(firstRow);
    expect(await invitationRow(fresh.id)).toMatchObject({ invitee_id: null, invitation_accepted_at: null });
    expect(await memberRow(c, p)).toMatchObject({ status: 'left' });
    expect(await acceptedStat(inviter, c)).toBe(1);
  });

  it('lets the same person rejoin through a different member\'s code', async () => {
    const { c, inviter, admin, p } = await joinedThenLeft('public');
    expect((await as(p).accept((await invite(inviter, c)).code)).status).toBe(409);
    const other = await invite(admin, c);
    const res = await as(p).accept(other.code);
    expect(res.status).toBe(200);
    expect(await memberRow(c, p)).toMatchObject({ status: 'active', role: 'member' });
    expect((await attribution(p)).invited_by).toBe(admin);
    expect(await acceptedStat(admin, c)).toBe(1);
  });

  it('lets the same person self-rejoin a public community instead', async () => {
    const { c, inviter, p } = await joinedThenLeft('public');
    expect((await as(p).accept((await invite(inviter, c)).code)).status).toBe(409);
    const res = await as(p).join(c);
    expect(res.status).toBe(200);
    expect(await memberRow(c, p)).toMatchObject({ status: 'active', role: 'member' });
  });

  it('refuses a re-applied (pending) person\'s fresh code from the same inviter and leaves the request pending', async () => {
    const { c, inviter, admin, p, first } = await joinedThenLeft('private');
    expect((await as(p).join(c)).status).toBe(200);
    expect(await memberRow(c, p)).toMatchObject({ status: 'pending' });
    const fresh = await invite(inviter, c);
    const before = await snapshot(c, p, inviter, [first.id, fresh.id]);
    const res = await as(p).accept(fresh.code);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'INVITATION_CONFLICT', message: CONFLICT_MESSAGE });
    expect(await snapshot(c, p, inviter, [first.id, fresh.id])).toEqual(before);
    // A different member's code admits the pending person (D2).
    expect((await as(p).accept((await invite(admin, c)).code)).status).toBe(200);
    expect(await memberRow(c, p)).toMatchObject({ status: 'active', role: 'member' });
  });
});

describe('Sprint 145 invitation acceptance — trigger effects roll back with the admission', () => {
  it('rolls the accepted-stats trigger back when user attribution fails after the invitation update', async () => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    const before = await snapshot(c, p, inviter, [inv.id]);
    const executed: string[] = [];
    // Failure injection, not a mocked success: every statement except the attribution UPDATE runs on the
    // real checked-out client, and the real ROLLBACK must undo the trigger-written stat with the rest.
    const realConnect = socialGraphPool.connect.bind(socialGraphPool) as () => Promise<PoolClient>;
    const spy = jest.spyOn(socialGraphPool, 'connect').mockImplementation((async () => {
      const client = await realConnect();
      const realQuery = client.query.bind(client);
      const realRelease = client.release.bind(client);
      (client as any).query = (text: any, params?: any) => {
        if (/^\s*UPDATE auth\.users/i.test(String(text))) return Promise.reject(new Error('injected attribution failure'));
        executed.push(String(text).replace(/\s+/g, ' ').trim());
        return realQuery(text, params);
      };
      (client as any).release = (err?: Error) => {
        (client as any).query = realQuery;
        (client as any).release = realRelease;
        return realRelease(err);
      };
      return client;
    }) as any);
    try {
      const res = await as(p).accept(inv.code);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('INTERNAL_ERROR');
    } finally {
      spy.mockRestore();
    }
    expect(executed.some((s) => /^UPDATE auth\.user_invitations/.test(s))).toBe(true);
    expect(executed[executed.length - 1]).toBe('ROLLBACK');
    expect(await snapshot(c, p, inviter, [inv.id])).toEqual(before);
    expect(await acceptedStat(inviter, c)).toBe(0);
  });
});

describe('Sprint 145 invitation acceptance — single-use and capacity races', () => {
  it('lets exactly one of two newcomers consume the same code; the loser leaves no partial effect', async () => {
    const { c, inviter } = await invitingCommunity();
    const [n1, n2] = await users(2);
    const inv = await invite(inviter, c);
    const responses = await holdAndRace(
      { sql: `SELECT 1 FROM auth.user_invitations WHERE id=$1 FOR UPDATE`, params: [inv.id] },
      '%FROM auth.user_invitations%FOR UPDATE%', 2,
      () => Promise.all([as(n1).accept(inv.code), as(n2).accept(inv.code)]),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    const winner = responses[0].status === 200 ? n1 : n2;
    const loser = winner === n1 ? n2 : n1;
    expect(responses.find((r) => r.status === 400)!.body.error).toBe('INVITATION_ALREADY_USED');
    expect((await invitationRow(inv.id)).invitee_id).toBe(winner);
    expect(await memberRow(c, loser)).toBeUndefined();
    expect(await attribution(loser)).toEqual({ invited_by: null, invitation_accepted_at: null });
    expect(await acceptedStat(inviter, c)).toBe(1);
    expect(await count(c)).toBe(3);
    expect(await count(c)).toBe(await activeRows(c));
  });

  it('admits one person once from two codes by different inviters; the other is a D1 no-op and stays usable', async () => {
    const { c, inviter, admin } = await invitingCommunity();
    const [p] = await users(1);
    const a = await invite(inviter, c);
    const b = await invite(admin, c);
    const responses = await holdAndRace(COMMUNITY_ROW_LOCK(c), MEMBER_INSERT, 2,
      () => Promise.all([as(p).accept(a.code), as(p).accept(b.code)]));
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const actual = responses.findIndex((r) => r.body.data.already_member === undefined);
    expect(actual).toBeGreaterThanOrEqual(0);
    expect(responses[1 - actual].body.data).toMatchObject({ already_member: true, accepted_at: null });
    const [won, lost] = actual === 0 ? [a, b] : [b, a];
    const wonBy = actual === 0 ? inviter : admin;
    const lostBy = actual === 0 ? admin : inviter;
    expect(await invitationRow(won.id)).toMatchObject({ invitee_id: p });
    expect(await invitationRow(lost.id)).toMatchObject({ invitee_id: null, invitation_accepted_at: null });
    expect((await attribution(p)).invited_by).toBe(wonBy);
    expect(await acceptedStat(wonBy, c)).toBe(1);
    expect(await acceptedStat(lostBy, c)).toBe(0);
    expect(await count(c)).toBe(3);
    expect(await count(c)).toBe(await activeRows(c));
  });

  it('serializes two newcomers invited by the SAME inviter on the last slot; both hold the shared authority lock', async () => {
    const { c, inviter } = await invitingCommunity({ max: 3 });
    const [n1, n2] = await users(2);
    const i1 = await invite(inviter, c);
    const i2 = await invite(inviter, c);
    const responses = await holdAndRace(COMMUNITY_ROW_LOCK(c), MEMBER_INSERT, 2,
      () => Promise.all([as(n1).accept(i1.code), as(n2).accept(i2.code)]),
      // Both contenders are parked at their member INSERT, past the inviter FOR SHARE: the shared lock is held.
      () => expectRowShareLocked(c, inviter));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    const winnerIdx = responses.findIndex((r) => r.status === 200);
    expect(responses[1 - winnerIdx].body.error).toBe('COMMUNITY_FULL');
    const [winner, loser] = winnerIdx === 0 ? [n1, n2] : [n2, n1];
    const [won, lost] = winnerIdx === 0 ? [i1, i2] : [i2, i1];
    expect(await memberRow(c, winner)).toMatchObject({ status: 'active' });
    expect(await memberRow(c, loser)).toBeUndefined();
    expect((await invitationRow(won.id)).invitee_id).toBe(winner);
    expect(await invitationRow(lost.id)).toMatchObject({ invitee_id: null, invitation_accepted_at: null });
    expect(await attribution(loser)).toEqual({ invited_by: null, invitation_accepted_at: null });
    expect(await acceptedStat(inviter, c)).toBe(1);
    expect(await count(c)).toBe(3);
    expect(await activeRows(c)).toBe(3);
  });
});
