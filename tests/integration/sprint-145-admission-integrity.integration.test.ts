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
/** Poll until every [pattern, n] has n lock waiters (or the contenders settle, or time runs out). */
async function waitForWaiters(waits: Array<[string, number]>, done: () => boolean, timeoutMs = 15000): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  const read = () => Promise.all(waits.map(([pattern]) => waiting(pattern)));
  let counts = await read();
  while (counts.some((n, i) => n < waits[i][1]) && !done() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    counts = await read();
  }
  return counts;
}

/** The lock waiters a barrier saw did not match what it demanded. */
class BarrierError extends Error {
  constructor(readonly expected: number[], readonly counts: number[], patterns: string[]) {
    super(`barrier expected lock waiters ${JSON.stringify(expected)} on ${JSON.stringify(patterns)}, saw ${JSON.stringify(counts)}`);
    this.name = 'BarrierError';
  }
}

/** Wait for the [pattern, n] waiters; throw a BarrierError (after the timeout) when they do not appear. */
async function expectWaiters(waits: Array<[string, number]>, done: () => boolean): Promise<void> {
  const counts = await waitForWaiters(waits, done);
  const expected = waits.map(([, n]) => n);
  if (counts.some((n, i) => n !== expected[i])) throw new BarrierError(expected, counts, waits.map(([p]) => p));
}

/**
 * Hold `lock.sql` on a barrier client, fire the contenders, and wait until exactly the expected number block
 * on each statement pattern. Then run `whileHeld` (probes), then `lock.mutate` (a change the contenders
 * must see once they get the lock), and release. Unlock comes first and unconditionally: a failed
 * expectation must not return a locked client to the pool (PR #341 review). The barrier COMMITs only when its
 * mutation ran, otherwise it rolls back; a barrier whose COMMIT/ROLLBACK fails is destroyed. In-flight requests
 * are always settled before the helper returns or rethrows.
 *
 * `fire` may return any thenable. A supertest request is one: it has then/catch but no finally, and it is
 * sent (and its ephemeral server closed) only once something calls then. Calling `.finally` on it directly
 * threw before the request was sent and left the server listening, so Jest never exited (PR #342 CI).
 */
async function holdAndRace<T>(
  lock: { sql: string; params: unknown[]; mutate?: (barrier: PoolClient) => Promise<unknown> },
  waits: Array<[string, number]>,
  fire: () => PromiseLike<T>,
  whileHeld?: () => Promise<void>,
): Promise<T> {
  const barrier = await pool.connect();
  let pending: Promise<T> | undefined;
  let finished = false;
  let commit = false;
  try {
    await barrier.query('BEGIN');
    await barrier.query(lock.sql, lock.params);
    pending = Promise.resolve().then(fire).finally(() => { finished = true; });
    pending.catch(() => undefined);
    await expectWaiters(waits, () => finished);
    if (whileHeld) await whileHeld();
    if (lock.mutate) {
      await lock.mutate(barrier);
      commit = true;
    }
  } finally {
    barrier.release(await barrier.query(commit ? 'COMMIT' : 'ROLLBACK').then(() => undefined, (error: Error) => error));
    await pending?.catch(() => undefined);
  }
  return pending!;
}
const COMMUNITY_ROW_LOCK = (c: string) => ({ sql: `SELECT 1 FROM communities.communities WHERE id=$1 FOR UPDATE`, params: [c] });
const MEMBER_INSERT = '%INSERT INTO communities.members%';

/**
 * Under `lock`, park `first` on `firstPark`, run `whileFirstParked` (probes), then park `second` on
 * `secondPark`, release, and return both responses. Both requests are settled on every path.
 *
 * Arrival order decides the winner only when the second contender waits on a lock the first one already
 * holds or queues ahead for: an exclusive row lock (FOR UPDATE) the first waiter holds the tuple lock for, or
 * the first's own share lock. Capacity races do not qualify: an INSERT's foreign-key FOR KEY SHARE waiters
 * on the community row wake together, so those cases keep asserting whichever winner committed.
 */
async function raceInOrder<A, B>(
  lock: { sql: string; params: unknown[] },
  first: () => PromiseLike<A>, firstPark: string,
  second: () => PromiseLike<B>, secondPark: string,
  whileFirstParked?: () => Promise<void>,
): Promise<[A, B]> {
  let later: Promise<B> | undefined;
  try {
    const firstResponse = await holdAndRace(lock, [[firstPark, 1]], first, async () => {
      if (whileFirstParked) await whileFirstParked();
      let laterDone = false;
      later = Promise.resolve().then(second).finally(() => { laterDone = true; });
      later.catch(() => undefined);
      await expectWaiters([[secondPark, 1]], () => laterDone);
    });
    return [firstResponse, await later!];
  } finally {
    await later?.catch(() => undefined);
  }
}

/** The invitation side of a race: consumed, attributed and counted exactly when it won, untouched otherwise. */
async function expectInvitationSettled(c: string, invitee: string, inviter: string, invitationId: string, won: boolean) {
  expect(await invitationRow(invitationId)).toMatchObject(won
    ? { invitee_id: invitee, invitation_accepted_at: expect.any(Date) }
    : { invitee_id: null, invitation_accepted_at: null });
  expect(await attribution(invitee)).toEqual(won
    ? { invited_by: inviter, invitation_accepted_at: expect.any(Date) }
    : { invited_by: null, invitation_accepted_at: null });
  expect(await acceptedStat(inviter, c)).toBe(won ? 1 : 0);
}

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
      [['%FROM auth.user_invitations%FOR UPDATE%', 2]],
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
    const responses = await holdAndRace(COMMUNITY_ROW_LOCK(c), [[MEMBER_INSERT, 2]],
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
    const responses = await holdAndRace(COMMUNITY_ROW_LOCK(c), [[MEMBER_INSERT, 2]],
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

// ─── Task 4: duplicate-create (BUG-108) and cross-path interleavings ──────────────────────────────────────

/** The identity-matching create body for community `c` (case and spacing differ from the stored row). */
async function duplicateBody(c: string) {
  const { rows } = await pool.query(`SELECT name, location FROM communities.communities WHERE id=$1`, [c]);
  return { name: `  ${rows[0].name.toUpperCase()} `, location: rows[0].location.toLowerCase(), community_type: 'mutual_aid' };
}
const UPDATE_MEMBER = '%UPDATE communities.members%';
const MEMBER_ROW_LOCK = (c: string, u: string) => ({
  sql: `SELECT 1 FROM communities.members WHERE community_id=$1 AND user_id=$2 FOR UPDATE`, params: [c, u],
});
const PRIVATE_POINTER = {
  existing: true, joined: false,
  message: 'A private community with this name and location already exists. Request approval to join.',
};

describe('Sprint 145 duplicate-create — state matrix on the shared table (real SQL and triggers)', () => {
  it('joins a newcomer as an active member with the stored count and a token carrying the membership', async () => {
    const { c } = await invitingCommunity();
    const [p] = await users(1);
    const res = await as(p).create(await duplicateBody(c));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: true });
    expect(res.body.data.community).toMatchObject({ id: c, current_members: 3, role: 'member' });
    expect((jwt.decode(res.body.data.token) as any).communities).toContainEqual(expect.objectContaining({ id: c, role: 'member' }));
    expect(await memberRow(c, p)).toMatchObject({ role: 'member', status: 'active' });
    expect(await count(c)).toBe(await activeRows(c));
  });

  it.each(STATE_MATRIX)('public: a duplicate create by $label answers per the approved table', async ({ status, role, duplicate }) => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    await addMember(c, p, status, role, 'request note');
    const before = await snapshot(c, p, inviter, []);
    const res = await as(p).create(await duplicateBody(c));
    expect(res.status).toBe(duplicate.http);
    if (duplicate.http === 409) {
      expect(res.body).toMatchObject({ success: false, error: duplicate.error });
      expect(res.body.data).toBeUndefined();
      expect(await snapshot(c, p, inviter, [])).toEqual(before);
    } else if (duplicate.kind === 'noop') {
      expect(res.body.data).toMatchObject({ existing: true, joined: true });
      expect(res.body.data.community).toMatchObject({ current_members: before.community.current_members, role });
      expect(await snapshot(c, p, inviter, [])).toEqual(before);
    } else {
      expect(res.body.data).toMatchObject({ existing: true, joined: true });
      expect(res.body.data.community.role).toBe('member');
      expect(await memberRow(c, p)).toMatchObject({ role: 'member', status: 'active', join_request_message: null });
      expect(await count(c)).toBe(before.community.current_members + 1);
      expect(res.body.data.community.current_members).toBe(await count(c));
    }
  });

  it('keeps the active no-op successful at full and overfull counts, preserving role and join time', async () => {
    const { c, inviter } = await invitingCommunity({ max: 3 });
    const [p] = await users(1);
    await addMember(c, p, 'active', 'moderator');
    for (const max of [3, 2]) {
      await setMax(c, max);
      const before = await snapshot(c, p, inviter, []);
      const res = await as(p).create(await duplicateBody(c));
      expect(res.status).toBe(200);
      expect(res.body.data.community).toMatchObject({ current_members: 3, role: 'moderator' });
      expect(await snapshot(c, p, inviter, [])).toEqual(before);
    }
  });

  it.each([['a newcomer', null], ['a left member', 'left']])('refuses %s whose admission overfills with 400 COMMUNITY_FULL, persisting nothing',
    async (_label, status) => {
      const { c, inviter } = await invitingCommunity({ max: 2 });
      const [p] = await users(1);
      if (status) await addMember(c, p, status, 'admin');
      const before = await snapshot(c, p, inviter, []);
      const res = await as(p).create(await duplicateBody(c));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('COMMUNITY_FULL');
      expect(await snapshot(c, p, inviter, [])).toEqual(before);
    });

  it.each([[null], ['active'], ['pending'], ['left'], ['inactive']])('answers a private match with the pointer for a %p caller and writes nothing',
    async (status) => {
      const { c, inviter } = await invitingCommunity({ access: 'private' });
      const [p] = await users(1);
      if (status) await addMember(c, p, status, 'member');
      const before = await snapshot(c, p, inviter, []);
      const res = await as(p).create(await duplicateBody(c));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject(PRIVATE_POINTER);
      expect(res.body.data.token).toBeUndefined();
      expect(await snapshot(c, p, inviter, [])).toEqual(before);
    });
});

describe('Sprint 145 last-slot capacity races across admission paths', () => {
  type Contenders = (c: string, a: string, b: string, inviter: string, admin: string) => Promise<request.Response[]>;

  /** Exactly one of two contenders is admitted at the last slot; stored count == active rows == cap. */
  async function lastSlot(fire: Contenders, waits: Array<[string, number]> = [[MEMBER_INSERT, 2]],
    setup?: (c: string, a: string, b: string) => Promise<void>) {
    const { c, inviter, admin } = await invitingCommunity({ max: 3 });
    const [a, b] = await users(2);
    if (setup) await setup(c, a, b);
    const responses = await holdAndRace(COMMUNITY_ROW_LOCK(c), waits, () => fire(c, a, b, inviter, admin));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 400).map((r) => r.body.error)).toEqual(['COMMUNITY_FULL']);
    expect(await count(c)).toBe(3);
    expect(await activeRows(c)).toBe(3);
    return { c, a, b, inviter, responses };
  }

  // Winner order here is whichever admission's trigger update commits first (see raceInOrder): each case
  // asserts the full outcome for the winner it observed, both admissions' rows and the invitation's effects.
  it('invitation versus ordinary join: one admission; a losing invitation leaves its code unconsumed', async () => {
    let id = '';
    const { c, a, b, inviter, responses } = await lastSlot(async (c0, a0, b0, inv0) => {
      const inv = await invite(inv0, c0);
      id = inv.id;
      return Promise.all([as(a0).accept(inv.code), as(b0).join(c0)]);
    });
    const invitationWon = responses[0].status === 200;
    expect(await memberRow(c, invitationWon ? a : b)).toMatchObject({ status: 'active', role: 'member' });
    expect(await memberRow(c, invitationWon ? b : a)).toBeUndefined();
    await expectInvitationSettled(c, a, inviter, id, invitationWon);
  });

  it('invitation versus staff add', async () => {
    let id = '';
    const { c, a, b, inviter, responses } = await lastSlot(async (c0, a0, b0, inv0, admin0) => {
      const inv = await invite(inv0, c0);
      id = inv.id;
      return Promise.all([as(a0).accept(inv.code), as(admin0).add(c0, b0)]);
    });
    const invitationWon = responses[0].status === 200;
    expect(await memberRow(c, invitationWon ? a : b)).toMatchObject({ status: 'active', role: 'member' });
    expect(await memberRow(c, invitationWon ? b : a)).toBeUndefined();
    await expectInvitationSettled(c, a, inviter, id, invitationWon);
  });

  it('invitation versus staff approval of a different pending applicant (ordinary-member inviter)', async () => {
    let id = '';
    const { c, a, b, inviter, responses } = await lastSlot(async (c0, a0, b0, inv0, admin0) => {
      const inv = await invite(inv0, c0);
      id = inv.id;
      return Promise.all([as(a0).accept(inv.code), as(admin0).put(c0, b0, { status: 'active' })]);
    }, [[MEMBER_INSERT, 1], [UPDATE_MEMBER, 1]], async (c0, _a0, b0) => { await addMember(c0, b0, 'pending'); });
    const invitationWon = responses[0].status === 200;
    if (invitationWon) expect(await memberRow(c, a)).toMatchObject({ status: 'active', role: 'member' });
    else expect(await memberRow(c, a)).toBeUndefined();
    expect(await memberRow(c, b)).toMatchObject({ status: invitationWon ? 'pending' : 'active', role: 'member' });
    await expectInvitationSettled(c, a, inviter, id, invitationWon);
  });

  it('invitation versus duplicate-create join', async () => {
    let id = '';
    const { c, a, b, inviter, responses } = await lastSlot(async (c0, a0, b0, inv0) => {
      const inv = await invite(inv0, c0);
      id = inv.id;
      const body = await duplicateBody(c0);
      return Promise.all([as(a0).accept(inv.code), as(b0).create(body)]);
    });
    const invitationWon = responses[0].status === 200;
    expect(await memberRow(c, invitationWon ? a : b)).toMatchObject({ status: 'active', role: 'member' });
    expect(await memberRow(c, invitationWon ? b : a)).toBeUndefined();
    if (!invitationWon) expect(responses[1].body.data).toMatchObject({ existing: true, joined: true });
    await expectInvitationSettled(c, a, inviter, id, invitationWon);
  });

  it('two duplicate-create joins', async () => {
    const { c, a, b, responses } = await lastSlot(async (c0, a0, b0) => {
      const body = await duplicateBody(c0);
      return Promise.all([as(a0).create(body), as(b0).create(body)]);
    });
    const winner = responses[0].status === 200 ? a : b;
    expect(await memberRow(c, winner)).toMatchObject({ status: 'active', role: 'member' });
    expect(await memberRow(c, winner === a ? b : a)).toBeUndefined();
  });

  it('two left members rejoining, by invitation and by duplicate create', async () => {
    let id = '';
    const { c, a, b, inviter, responses } = await lastSlot(async (c0, a0, b0, inv0) => {
      const inv = await invite(inv0, c0);
      id = inv.id;
      const body = await duplicateBody(c0);
      return Promise.all([as(a0).accept(inv.code), as(b0).create(body)]);
    }, [[UPDATE_MEMBER, 2]], async (c0, a0, b0) => {
      await addMember(c0, a0, 'left', 'admin');
      await addMember(c0, b0, 'left', 'moderator');
    });
    const invitationWon = responses[0].status === 200;
    expect(await memberRow(c, invitationWon ? a : b)).toMatchObject({ status: 'active', role: 'member' });
    // The loser keeps its stored row exactly: still left, with its former role.
    if (invitationWon) expect(await memberRow(c, b)).toMatchObject({ status: 'left', role: 'moderator' });
    else expect(await memberRow(c, a)).toMatchObject({ status: 'left', role: 'admin' });
    await expectInvitationSettled(c, a, inviter, id, invitationWon);
  });
});

describe('Sprint 145 state and authority interleavings — the committed winner decides', () => {
  // Both contenders take FOR UPDATE on the applicant's row, so arrival order under the barrier decides the
  // winner (raceInOrder). Each order runs, with the exact outcome for both sides.
  const INVITEE_LOCK = '%SELECT status, role FROM communities.members%FOR UPDATE%';
  const STAFF_LOCK = '%communities.members%ORDER BY user_id FOR UPDATE%';
  it.each([
    { action: 'approval', order: 'invitation first' },
    { action: 'rejection', order: 'invitation first' },
    { action: 'approval', order: 'staff first' },
    { action: 'rejection', order: 'staff first' },
  ])('a pending applicant\'s invitation against a moderator $action of the same request, $order', async ({ action, order }) => {
    const staffStatus = action === 'approval' ? 'active' : 'inactive';
    const { c, inviter } = await invitingCommunity({ access: 'private' });
    const [mod, q] = await users(2);
    await addMember(c, mod, 'active', 'moderator');
    await addMember(c, q, 'pending', 'member', 'please');
    const inv = await invite(inviter, c);
    const accept = () => as(q).accept(inv.code);
    const staff = () => as(mod).put(c, q, { status: staffStatus });
    let acceptRes: request.Response;
    let staffRes: request.Response;
    if (order === 'invitation first') {
      [acceptRes, staffRes] = await raceInOrder(MEMBER_ROW_LOCK(c, q), accept, INVITEE_LOCK, staff, STAFF_LOCK);
      // The invitation admitted the applicant (D2); the staff action then met an active member.
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data).toMatchObject({ community_id: c, inviter_id: inviter, accepted_at: expect.any(String) });
      expect(acceptRes.body.data.already_member).toBeUndefined();
      // Approving an active member is a same-state retry; a moderator may not block an active member.
      expect(staffRes.status).toBe(action === 'approval' ? 409 : 403);
      expect(staffRes.body.error).toBe(action === 'approval' ? 'INVALID_MEMBERSHIP_TRANSITION' : 'FORBIDDEN');
      expect(await memberRow(c, q)).toMatchObject({ status: 'active', role: 'member', join_request_message: null });
    } else {
      [staffRes, acceptRes] = await raceInOrder(MEMBER_ROW_LOCK(c, q), staff, STAFF_LOCK, accept, INVITEE_LOCK);
      // The staff decision committed first; the invitation answered from that state.
      expect(staffRes.status).toBe(200);
      expect(await memberRow(c, q)).toMatchObject({ status: staffStatus, role: 'member' });
      if (action === 'approval') {
        expect(acceptRes.status).toBe(200);
        expect(acceptRes.body.data).toMatchObject({ already_member: true, accepted_at: null });
      } else {
        expect(acceptRes.status).toBe(409);
        expect(acceptRes.body).toMatchObject({ success: false, error: 'MEMBERSHIP_RESTORE_REQUIRES_STAFF' });
      }
    }
    await expectInvitationSettled(c, q, inviter, inv.id, order === 'invitation first');
    expect(await count(c)).toBe(await activeRows(c));
    expect(await activeRows(c)).toBe(staffStatus === 'inactive' && order === 'staff first' ? 3 : 4);
  });

  it('a staff removal of the inviter waits behind an acceptance holding the shared authority lock', async () => {
    const { c, inviter, admin } = await invitingCommunity();
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    // The acceptance parks at its member INSERT holding FOR SHARE on the inviter row; the removal then parks on
    // lockTargetAndAdmins' FOR UPDATE of that row and runs only after the acceptance commits.
    const [accepted, removed] = await raceInOrder(COMMUNITY_ROW_LOCK(c),
      () => as(p).accept(inv.code), MEMBER_INSERT,
      () => as(admin).del(c, inviter), STAFF_LOCK,
      () => expectRowShareLocked(c, inviter));
    expect(accepted.status).toBe(200);
    expect(removed.status).toBe(200);
    expect(await memberRow(c, p)).toMatchObject({ status: 'active' });
    expect(await memberRow(c, inviter)).toMatchObject({ status: 'inactive' });
    expect((await invitationRow(inv.id)).invitee_id).toBe(p);
  });

  it('an acceptance waiting behind the inviter\'s removal is refused with 403 and consumes nothing', async () => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    const before = await snapshot(c, p, inviter, [inv.id]);
    const res = await holdAndRace({
      ...MEMBER_ROW_LOCK(c, inviter),
      mutate: (b) => b.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`, [c, inviter]),
    }, [['%communities.members%FOR SHARE%', 1]], () => as(p).accept(inv.code));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    const after = await snapshot(c, p, inviter, [inv.id]);
    expect(after.invitations).toEqual(before.invitations);
    expect(after.attribution).toEqual(before.attribution);
    expect(await memberRow(c, p)).toBeUndefined();
  });

  it('an invitee blocked while the acceptance waits on its row is refused with 409 and consumes nothing', async () => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    await addMember(c, p, 'left', 'member');
    const inv = await invite(inviter, c);
    const res = await holdAndRace({
      ...MEMBER_ROW_LOCK(c, p),
      mutate: (b) => b.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`, [c, p]),
    }, [['%SELECT status, role FROM communities.members%FOR UPDATE%', 1]], () => as(p).accept(inv.code));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('MEMBERSHIP_RESTORE_REQUIRES_STAFF');
    expect(await invitationRow(inv.id)).toMatchObject({ invitee_id: null, invitation_accepted_at: null });
    expect(await memberRow(c, p)).toMatchObject({ status: 'inactive' });
  });

  it.each(['acceptance', 'duplicate create'])('a community archived while the %s waits is refused with 400 COMMUNITY_INACTIVE', async (path) => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    const body = await duplicateBody(c);
    const res = await holdAndRace({
      ...COMMUNITY_ROW_LOCK(c),
      mutate: (b) => b.query(`UPDATE communities.communities SET status='archived' WHERE id=$1`, [c]),
    }, [[MEMBER_INSERT, 1]], () => (path === 'acceptance' ? as(p).accept(inv.code) : as(p).create(body)));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COMMUNITY_INACTIVE');
    expect(await memberRow(c, p)).toBeUndefined();
    expect(await count(c)).toBe(2);
    expect(await invitationRow(inv.id)).toMatchObject({ invitee_id: null, invitation_accepted_at: null });
  });

  it('a public community made private while a duplicate create waits answers the pointer after rolling back', async () => {
    const { c } = await invitingCommunity();
    const [p] = await users(1);
    const body = await duplicateBody(c);
    const res = await holdAndRace({
      ...COMMUNITY_ROW_LOCK(c),
      mutate: (b) => b.query(`UPDATE communities.communities SET access_type='private' WHERE id=$1`, [c]),
    }, [[MEMBER_INSERT, 1]], () => as(p).create(body));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject(PRIVATE_POINTER);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.community.current_members).toBe(2);
    expect(await memberRow(c, p)).toBeUndefined();
    expect(await count(c)).toBe(2);
  });

  // PR #342 review, finding 1: the duplicate create's INSERT waits on a winner's transaction that inserts the
  // caller's own row and also changes the community. Losing that race must answer from the community's new state.
  it.each([
    { change: 'made private', sql: `UPDATE communities.communities SET access_type='private' WHERE id=$1` },
    { change: 'archived', sql: `UPDATE communities.communities SET status='archived' WHERE id=$1` },
  ])('a duplicate create that loses its INSERT to a transaction that also $change the community answers from the new state', async ({ change, sql }) => {
    const { c } = await invitingCommunity();
    const [p] = await users(1);
    const body = await duplicateBody(c);
    const res = await holdAndRace({
      sql: `INSERT INTO communities.members(community_id,user_id,role,status,joined_at) VALUES($1,$2,'member','active',$3)`,
      params: [c, p, OLD_JOIN],
      mutate: (b) => b.query(sql, [c]),
    }, [[MEMBER_INSERT, 1]], () => as(p).create(body));
    if (change === 'made private') {
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject(PRIVATE_POINTER);
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.community.current_members).toBe(3);
    } else {
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_INACTIVE' });
      expect(res.body.data).toBeUndefined();
    }
    // Only the winner's committed row exists: the duplicate create wrote nothing of its own.
    expect(await memberRow(c, p)).toMatchObject({ status: 'active', role: 'member' });
    expect(await count(c)).toBe(3);
    expect(await activeRows(c)).toBe(3);
  });

  // PR #342 review, finding 2: the inviter's FOR SHARE select is the authority lock. Ids are ordered so the
  // acceptance runs that select first (finding no row), then parks on the invitee row while the inviter's
  // membership commits. The later live-role read would see that row, but it was never locked.
  it('refuses with 403 when the inviter\'s membership commits after the authority lock found no row', async () => {
    const [inviter, p] = (await users(2)).sort();
    const [admin] = await users(1);
    const c = await community({ creator: admin });
    await addMember(c, admin, 'active', 'admin');
    await addMember(c, p, 'left', 'member');
    const inv = await invite(inviter, c);
    const res = await holdAndRace({
      ...MEMBER_ROW_LOCK(c, p),
      mutate: (b) => b.query(`INSERT INTO communities.members(community_id,user_id,role,status,joined_at)
        VALUES($1,$2,'member','active',$3)`, [c, inviter, OLD_JOIN]),
    }, [[INVITEE_LOCK, 1]], () => as(p).accept(inv.code));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: 'FORBIDDEN' });
    expect(await memberRow(c, inviter)).toMatchObject({ status: 'active' });
    expect(await memberRow(c, p)).toMatchObject({ status: 'left', role: 'member' });
    await expectInvitationSettled(c, p, inviter, inv.id, false);
    expect(await count(c)).toBe(2);
    expect(await activeRows(c)).toBe(2);
  });

  it('unlocks and settles when a barrier expectation fails (the failed-barrier cleanup path)', async () => {
    const { c, inviter } = await invitingCommunity();
    const [p] = await users(1);
    const inv = await invite(inviter, c);
    // Demand a waiter count that cannot happen: the helper must still unlock and settle the acceptance. The
    // failure must be the barrier's own count (one acceptance parked, two demanded), not any other error.
    const failure = await holdAndRace(COMMUNITY_ROW_LOCK(c), [[MEMBER_INSERT, 2]], () => as(p).accept(inv.code))
      .then(() => undefined, (error: unknown) => error);
    expect(failure).toBeInstanceOf(BarrierError);
    expect(failure).toMatchObject({ expected: [2], counts: [1] });
    // Settled after the unlock: the acceptance committed.
    expect(await memberRow(c, p)).toMatchObject({ status: 'active' });
    expect((await invitationRow(inv.id)).invitee_id).toBe(p);
    const probe = await pool.connect();
    try {
      await probe.query('BEGIN');
      await expect(probe.query(`SELECT 1 FROM communities.communities WHERE id=$1 FOR UPDATE NOWAIT`, [c])).resolves.toBeDefined();
    } finally {
      probe.release(await probe.query('ROLLBACK').then(() => undefined, (error: Error) => error));
    }
  });
});
