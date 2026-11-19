/**
 * Sprint 144 — staff membership write integrity, real-database proof (ADR-106; BUG-103/104/105).
 *
 * The database owns communities.current_members: a sync trigger on communities.members applies
 * each row's active-delta, a column guard ignores every other write to the column, and
 * communities.recount_current_members() converges stored drift. CI and the disposable test DB run
 * as a superuser that bypasses RLS, so every query here names its community explicitly (gotcha
 * database-roles-bypass-rls-so-rls-is-not-an-isolation-proof).
 *
 * "The trigger did not write" is proved with the community row's xmin, never with count equality:
 * an accidental active→active firing would do −1 then +1, leave the count unchanged and still take
 * the community row lock.
 */
import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
const MIGRATION = '20261119-community-member-count-trigger.sql';
const migrationText = () => readFileSync(
  resolve(__dirname, '../../infrastructure/postgres/migrations', MIGRATION), 'utf8',
);
const TRIGGERS = [
  ['communities_guard_current_members', 'communities.communities'],
  ['members_sync_current_members_ins_del', 'communities.members'],
  ['members_sync_current_members_upd', 'communities.members'],
] as const;

const createdCommunities: string[] = [];
const createdUsers: string[] = [];

async function users(n: number): Promise<string[]> {
  const ids = Array.from({ length: n }, () => randomUUID());
  await pool.query(`INSERT INTO auth.users(id,email,name,password_hash)
    SELECT id, id::text || '@s144.invalid', 'S144 member', 'unused' FROM unnest($1::uuid[]) id`, [ids]);
  createdUsers.push(...ids);
  return ids;
}

async function community(opts: { access?: 'public' | 'private'; max?: number; creator?: string } = {}): Promise<string> {
  const id = randomUUID();
  const creator = opts.creator ?? (await users(1))[0];
  await pool.query(`INSERT INTO communities.communities(id,name,creator_id,access_type,max_members)
    VALUES($1,$2,$3,$4,$5)`, [id, `S144 ${id}`, creator, opts.access ?? 'public', opts.max ?? 150]);
  createdCommunities.push(id);
  return id;
}

const addMember = (c: string, u: string, status: string | null = 'active', role = 'member', q: Pick<Pool, 'query'> = pool) =>
  q.query(`INSERT INTO communities.members(community_id,user_id,role,status) VALUES($1,$2,$3,$4)`, [c, u, role, status]);
const setStatus = (c: string, u: string, status: string | null) =>
  pool.query(`UPDATE communities.members SET status=$3 WHERE community_id=$1 AND user_id=$2`, [c, u, status]);
const count = async (c: string, q: Pick<Pool, 'query'> = pool): Promise<number> =>
  (await q.query(`SELECT current_members FROM communities.communities WHERE id=$1`, [c])).rows[0].current_members;
const xmin = async (c: string): Promise<string> =>
  (await pool.query(`SELECT xmin::text AS v FROM communities.communities WHERE id=$1`, [c])).rows[0].v;
const activeRows = async (c: string): Promise<number> => (await pool.query(
  `SELECT count(*)::int AS n FROM communities.members WHERE community_id=$1 AND status='active'`, [c])).rows[0].n;

/** Store a count the way pre-ADR-106 code could: through the sync flag, on one client, in one transaction. */
async function storeDriftedCount(c: string, value: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('karmyq.member_count_sync','on',true)`);
    await client.query(`UPDATE communities.communities SET current_members=$2 WHERE id=$1`, [c, value]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>, finish: 'COMMIT' | 'ROLLBACK' = 'COMMIT'): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query(finish);
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

afterEach(async () => {
  if (createdUsers.length) {
    await pool.query(`DELETE FROM auth.user_invitations WHERE inviter_id=ANY($1::uuid[]) OR invitee_id=ANY($1::uuid[])`,
      [createdUsers]);
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

// In-process routes, as Sprint 143's file drives them: real withTransaction, real triggers.
const app = express();
app.use(express.json());
app.use('/communities', authMiddleware, communitiesRouter);
app.use('/communities', authMiddleware, membersRouter);
app.use('/invitations', authMiddleware, invitationsRouter);
const tokenFor = (userId: string) => jwt.sign(
  { userId, email: `${userId}@s144.invalid`, communities: [] }, process.env.JWT_SECRET!,
);
const as = (userId: string) => ({
  join: (c: string) => request(app).post(`/communities/${c}/join`).auth(tokenFor(userId), { type: 'bearer' }).send({}),
  add: (c: string, user_id: string) => request(app).post(`/communities/${c}/members`)
    .auth(tokenFor(userId), { type: 'bearer' }).send({ user_id }),
  put: (c: string, target: string, body: object) => request(app).put(`/communities/${c}/members/${target}`)
    .auth(tokenFor(userId), { type: 'bearer' }).send(body),
  del: (c: string, target: string) => request(app).delete(`/communities/${c}/members/${target}`)
    .auth(tokenFor(userId), { type: 'bearer' }).send({}),
  create: (body: object) => request(app).post('/communities').auth(tokenFor(userId), { type: 'bearer' }).send(body),
  accept: (code: string) => request(app).post('/invitations/accept').auth(tokenFor(userId), { type: 'bearer' })
    .send({ invitation_code: code }),
});
const memberRow = async (c: string, u: string) => (await pool.query(
  `SELECT role, status FROM communities.members WHERE community_id=$1 AND user_id=$2`, [c, u])).rows[0];

/** A community with an active admin and `others` more active members, at `max` capacity. */
async function staffedCommunity(opts: { others?: number; max?: number; access?: 'public' | 'private' } = {}) {
  const [admin] = await users(1);
  const c = await community({ creator: admin, max: opts.max, access: opts.access });
  await addMember(c, admin, 'active', 'admin');
  const others = await users(opts.others ?? 0);
  for (const u of others) await addMember(c, u);
  return { c, admin, others };
}

/** Poll until `expected` backends wait on a lock in a communities.members statement (or give up). */
async function lockWaiters(expected: number, done: () => boolean): Promise<number> {
  const deadline = Date.now() + 15000;
  let waiting = 0;
  while (waiting < expected && !done() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    waiting = (await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%communities.members%'`)).rows[0].n;
  }
  return waiting;
}

/**
 * Force the race the post-check exists for: hold the community row lock, start the admissions,
 * wait until `waiters` of them are blocked inside the sync trigger's UPDATE, then release. Every
 * admission has passed the pre-write "is it full?" read by then.
 */
async function raceOnCommunityRow<T>(c: string, waiters: number, fire: () => Promise<T>): Promise<T> {
  const barrier = await pool.connect();
  try {
    await barrier.query('BEGIN');
    await barrier.query(`SELECT 1 FROM communities.communities WHERE id=$1 FOR UPDATE`, [c]);
    let settled = false;
    const pending = fire().finally(() => { settled = true; });
    const waiting = await lockWaiters(waiters, () => settled);
    expect(waiting).toBe(waiters);
    await barrier.query('ROLLBACK');
    return await pending;
  } finally {
    barrier.release();
  }
}

describe('Sprint 144 database role evidence', () => {
  it('records the DB role flags used to exercise explicit community predicates', async () => {
    const result = await pool.query(`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    console.warn('Sprint 144 DB role evidence', result.rows[0]);
    expect(result.rows).toHaveLength(1);
  });
});

describe('Sprint 144 sync trigger deltas (ADR-106)', () => {
  it('counts an active INSERT and ignores a pending INSERT', async () => {
    const c = await community();
    const [a, p] = await users(2);
    expect(await count(c)).toBe(0);
    await addMember(c, a, 'active');
    expect(await count(c)).toBe(1);
    await addMember(c, p, 'pending');
    expect(await count(c)).toBe(1);
  });

  it.each([
    ['pending', 'active', 0, 1],
    ['active', 'inactive', 1, 0],
    ['active', 'left', 1, 0],
    ['inactive', 'left', 0, 0],
    ['left', 'active', 0, 1],
    ['active', 'pending', 1, 0],
  ])('applies %s → %s (count %i → %i)', async (from, to, before, after) => {
    const c = await community();
    const [u] = await users(1);
    await addMember(c, u, from);
    expect(await count(c)).toBe(before);
    await setStatus(c, u, to);
    expect(await count(c)).toBe(after);
    expect(await count(c)).toBe(await activeRows(c));
  });

  it('decrements on DELETE of an active row and not of a pending row', async () => {
    const c = await community();
    const [a, b, p] = await users(3);
    await addMember(c, a);
    await addMember(c, b);
    await addMember(c, p, 'pending');
    expect(await count(c)).toBe(2);
    await pool.query(`DELETE FROM communities.members WHERE community_id=$1 AND user_id=$2`, [c, a]);
    expect(await count(c)).toBe(1);
    await pool.query(`DELETE FROM communities.members WHERE community_id=$1 AND user_id=$2`, [c, p]);
    expect(await count(c)).toBe(1);
  });

  it('counts a NULL status as not active', async () => {
    const c = await community();
    const [u] = await users(1);
    await addMember(c, u, null);
    expect(await count(c)).toBe(0);
    await setStatus(c, u, 'active');
    expect(await count(c)).toBe(1);
    await setStatus(c, u, null);
    expect(await count(c)).toBe(0);
  });

  it('deletes a community that still has active members without error', async () => {
    const c = await community();
    const [a, b] = await users(2);
    await addMember(c, a);
    await addMember(c, b);
    await pool.query(`DELETE FROM communities.communities WHERE id=$1`, [c]);
    expect((await pool.query(`SELECT 1 FROM communities.members WHERE community_id=$1`, [c])).rowCount).toBe(0);
  });

  it('serializes many concurrent joins into an exact count', async () => {
    const c = await community();
    const ids = await users(12);
    await Promise.all(ids.map((u) => addMember(c, u)));
    expect(await count(c)).toBe(12);
  });
});

describe('Sprint 144 updates that must not write the community row (note 14: xmin, not count)', () => {
  it('leaves xmin unchanged for a role-only update', async () => {
    const c = await community();
    const [u] = await users(1);
    await addMember(c, u);
    const before = await xmin(c);
    await pool.query(`UPDATE communities.members SET role='moderator' WHERE community_id=$1 AND user_id=$2`, [c, u]);
    expect(await xmin(c)).toBe(before);
    expect(await count(c)).toBe(1);
  });

  it.each(['active', 'pending', 'inactive', 'left'])('leaves xmin unchanged when a %s row is rewritten to the same status', async (status) => {
    const c = await community();
    const [u] = await users(1);
    await addMember(c, u, status);
    const before = await xmin(c);
    await pool.query(`UPDATE communities.members SET status=$3, joined_at=CURRENT_TIMESTAMP
      WHERE community_id=$1 AND user_id=$2`, [c, u, status]);
    expect(await xmin(c)).toBe(before);
  });
});

describe('Sprint 144 membership rows never move between communities', () => {
  it('raises check_violation on a community_id change and changes nothing', async () => {
    const [from, to] = [await community(), await community()];
    const [u] = await users(1);
    await addMember(from, u);
    await expect(pool.query(`UPDATE communities.members SET community_id=$2 WHERE community_id=$1 AND user_id=$3`, [from, to, u]))
      .rejects.toMatchObject({ code: '23514' });
    expect((await pool.query(`SELECT community_id FROM communities.members WHERE user_id=$1`, [u])).rows)
      .toEqual([{ community_id: from }]);
    expect([await count(from), await count(to)]).toEqual([1, 0]);
  });
});

describe('Sprint 144 column guard (decision 7)', () => {
  it('stores 0 for a community inserted with an explicit count', async () => {
    const [creator] = await users(1);
    const id = randomUUID();
    createdCommunities.push(id);
    await pool.query(`INSERT INTO communities.communities(id,name,creator_id,current_members) VALUES($1,$2,$3,7)`,
      [id, `S144 guard ${id}`, creator]);
    expect(await count(id)).toBe(0);
  });

  it('ignores a direct UPDATE of the count', async () => {
    const c = await community();
    const [u] = await users(1);
    await addMember(c, u);
    await pool.query(`UPDATE communities.communities SET current_members=99 WHERE id=$1`, [c]);
    expect(await count(c)).toBe(1);
  });

  it('applies the other columns of a mixed UPDATE and ignores the count', async () => {
    const c = await community();
    const [u] = await users(1);
    await addMember(c, u);
    await pool.query(`UPDATE communities.communities SET access_type='private', current_members=4 WHERE id=$1`, [c]);
    expect((await pool.query(`SELECT access_type, current_members FROM communities.communities WHERE id=$1`, [c])).rows)
      .toEqual([{ access_type: 'private', current_members: 1 }]);
  });
});

describe('Sprint 144 flag discipline (note 13)', () => {
  it('ignores an old-code +1 issued after a member INSERT in the same transaction', async () => {
    const c = await community();
    const [u] = await users(1);
    await inTransaction(async (client) => {
      await addMember(c, u, 'active', 'member', client);
      expect(await count(c, client)).toBe(1);
      await client.query(`UPDATE communities.communities SET current_members=current_members+1 WHERE id=$1`, [c]);
      expect(await count(c, client)).toBe(1);
      const flag = (await client.query(`SELECT current_setting('karmyq.member_count_sync', true) AS v`)).rows[0].v;
      expect(flag).not.toBe('on');
    });
    expect(await count(c)).toBe(1);
  });

  it('restores a caller\'s prior flag value instead of clearing it', async () => {
    const c = await community();
    const [u] = await users(1);
    const flag = await inTransaction(async (client) => {
      await client.query(`SELECT set_config('karmyq.member_count_sync','on',true)`);
      await addMember(c, u, 'active', 'member', client);
      return (await client.query(`SELECT current_setting('karmyq.member_count_sync', true) AS v`)).rows[0].v;
    }, 'ROLLBACK');
    expect(flag).toBe('on');
  });
});

describe('Sprint 144 converging recount', () => {
  it('repairs high, low and zero-member drift, then is a no-op on rerun', async () => {
    const [high, low, empty] = [await community(), await community(), await community()];
    const ids = await users(5);
    await addMember(high, ids[0]);
    await addMember(high, ids[1]);
    for (const u of ids.slice(2)) await addMember(low, u);
    await storeDriftedCount(high, 9);
    await storeDriftedCount(low, 1);
    await storeDriftedCount(empty, 5);
    expect([await count(high), await count(low), await count(empty)]).toEqual([9, 1, 5]);

    await pool.query(migrationText());
    expect([await count(high), await count(low), await count(empty)]).toEqual([2, 3, 0]);

    const versions = [await xmin(high), await xmin(low), await xmin(empty)];
    await pool.query(migrationText());
    expect([await xmin(high), await xmin(low), await xmin(empty)]).toEqual(versions);
    expect((await pool.query(`SELECT communities.recount_current_members() AS n`)).rows[0].n).toBe(0);
  });

  it('repairs one named community and reports its changed-row count', async () => {
    const [a, b] = [await community(), await community()];
    const [u, v] = await users(2);
    await addMember(a, u);
    await addMember(b, v);
    await storeDriftedCount(a, 6);
    await storeDriftedCount(b, 8);
    expect((await pool.query(`SELECT communities.recount_current_members($1) AS n`, [a])).rows[0].n).toBe(1);
    expect([await count(a), await count(b)]).toEqual([1, 8]);
    expect((await pool.query(`SELECT communities.recount_current_members($1) AS n`, [a])).rows[0].n).toBe(0);
    expect((await pool.query(`SELECT communities.recount_current_members($1) AS n`, [b])).rows[0].n).toBe(1);
    expect(await count(b)).toBe(1);
  });

  it('leaves the sync flag as the caller had it', async () => {
    const flag = await inTransaction(async (client) => {
      await client.query(`SELECT communities.recount_current_members()`);
      return (await client.query(`SELECT current_setting('karmyq.member_count_sync', true) AS v`)).rows[0].v;
    }, 'ROLLBACK');
    expect(flag).not.toBe('on');
  });

  it('documents the column', async () => {
    const comment = (await pool.query(`SELECT col_description('communities.communities'::regclass, attnum) AS c
      FROM pg_attribute WHERE attrelid='communities.communities'::regclass AND attname='current_members'`)).rows[0].c;
    expect(comment).toMatch(/ADR-106/);
    expect(comment).toMatch(/recount_current_members/);
  });

  it('replays over the pre-ADR shape: rows inserted with no triggers converge, and the triggers come back', async () => {
    const result = await inTransaction(async (client) => {
      for (const [name, table] of TRIGGERS) await client.query(`DROP TRIGGER IF EXISTS ${name} ON ${table}`);
      const [creator, a, b] = Array.from({ length: 3 }, () => randomUUID());
      await client.query(`INSERT INTO auth.users(id,email,name,password_hash)
        SELECT id, id::text || '@s144.invalid', 'S144 replay', 'unused' FROM unnest($1::uuid[]) id`, [[creator, a, b]]);
      const c = randomUUID();
      await client.query(`INSERT INTO communities.communities(id,name,creator_id,current_members) VALUES($1,$2,$3,7)`,
        [c, `S144 replay ${c}`, creator]);
      await addMember(c, a, 'active', 'member', client);
      await addMember(c, b, 'pending', 'member', client);
      const stored = await count(c, client);
      await client.query(migrationText());
      const converged = await count(c, client);
      await client.query(migrationText());
      const rerun = (await client.query(`SELECT communities.recount_current_members($1) AS n`, [c])).rows[0].n;
      const triggers = (await client.query(`SELECT tgname FROM pg_trigger
        WHERE tgname = ANY($1::text[]) AND NOT tgisinternal ORDER BY tgname`, [TRIGGERS.map(([name]) => name)])).rows
        .map((row) => row.tgname);
      return { stored, converged, rerun, triggers };
    }, 'ROLLBACK');
    expect(result).toEqual({
      stored: 7,
      converged: 1,
      rerun: 0,
      triggers: TRIGGERS.map(([name]) => name).sort(),
    });
  });
});

describe('Sprint 144 atomic capacity (decision 5, note 4)', () => {
  it('admits exactly one of two concurrent public joins into the last free slot', async () => {
    const { c } = await staffedCommunity({ others: 1, max: 3 });
    const [j1, j2] = await users(2);
    expect(await count(c)).toBe(2);
    const responses = await raceOnCommunityRow(c, 2, () => Promise.all([as(j1).join(c), as(j2).join(c)]));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(responses.find((r) => r.status === 400)!.body.error).toBe('COMMUNITY_FULL');
    expect(await count(c)).toBe(3);
    expect(await activeRows(c)).toBe(3);
  });

  it('admits exactly one of two concurrent staff adds into the last free slot', async () => {
    const { c, admin } = await staffedCommunity({ others: 1, max: 3 });
    const [n1, n2] = await users(2);
    const responses = await raceOnCommunityRow(c, 2, () => Promise.all([as(admin).add(c, n1), as(admin).add(c, n2)]));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(responses.find((r) => r.status === 400)!.body.error).toBe('COMMUNITY_FULL');
    expect(await count(c)).toBe(3);
    const refused = responses[0].status === 400 ? n1 : n2;
    expect(await memberRow(c, refused)).toBeUndefined();
  });

  it('refuses a staff add into a full community and leaves no member row', async () => {
    const { c, admin } = await staffedCommunity({ others: 1, max: 2 });
    const [n] = await users(1);
    const res = await as(admin).add(c, n);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COMMUNITY_FULL');
    expect(await memberRow(c, n)).toBeUndefined();
    expect(await count(c)).toBe(2);
  });

  it('counts an accepted invitation exactly once', async () => {
    const { c, admin } = await staffedCommunity({ others: 1 });
    const [invitee] = await users(1);
    const code = `KARMYQ-S144-2026-${randomUUID().slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;
    await pool.query(`INSERT INTO auth.user_invitations(inviter_id, invitation_code, community_id) VALUES($1,$2,$3)`,
      [admin, code, c]);
    expect(await count(c)).toBe(2);
    const res = await as(invitee).accept(code);
    expect(res.status).toBe(200);
    expect(await memberRow(c, invitee)).toEqual({ role: 'member', status: 'active' });
    expect(await count(c)).toBe(3);
    expect(await activeRows(c)).toBe(3);
  });

  it('creates a community whose stored and reported count is its creator', async () => {
    const [creator] = await users(1);
    const res = await as(creator).create({ name: `S144 create ${randomUUID()}`, community_type: 'mutual_aid' });
    expect(res.status).toBe(201);
    const id = res.body.data.community.id;
    createdCommunities.push(id);
    expect(await count(id)).toBe(1);
    expect(res.body.data.community.current_members).toBe(1);
  });

  it('joins an existing community by duplicate create once, reporting the stored count', async () => {
    const { c } = await staffedCommunity({ others: 1 });
    const name = (await pool.query(`SELECT name FROM communities.communities WHERE id=$1`, [c])).rows[0].name;
    const [joiner] = await users(1);
    const first = await as(joiner).create({ name: name.toUpperCase(), community_type: 'mutual_aid' });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ existing: true, joined: true });
    expect(await count(c)).toBe(3);
    expect(first.body.data.community.current_members).toBe(3);
    const again = await as(joiner).create({ name, community_type: 'mutual_aid' });
    expect(again.status).toBe(200);
    expect(await count(c)).toBe(3);
    expect(again.body.data.community.current_members).toBe(3);
  });

  it('refuses a duplicate-create join into a full community and leaves no member row', async () => {
    const { c } = await staffedCommunity({ others: 1, max: 2 });
    const name = (await pool.query(`SELECT name FROM communities.communities WHERE id=$1`, [c])).rows[0].name;
    const [joiner] = await users(1);
    const res = await as(joiner).create({ name, community_type: 'mutual_aid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COMMUNITY_FULL');
    expect(await memberRow(c, joiner)).toBeUndefined();
    expect(await count(c)).toBe(2);
  });
});

describe('Sprint 144 staff PUT transition table (BUG-104, BUG-105, decision 8)', () => {
  const setRow = (c: string, u: string, status: string, role = 'member') => pool.query(
    `UPDATE communities.members SET status=$3, role=$4 WHERE community_id=$1 AND user_id=$2`, [c, u, status, role]);

  it.each([
    ['demotion', { role: 'member' }],
    ['deactivation', { status: 'inactive' }],
  ])('refuses the sole admin\'s %s through an uppercase UUID and leaves the row (BUG-104)', async (_label, body) => {
    const { c, admin } = await staffedCommunity({ others: 2 });
    const res = await as(admin).put(c.toUpperCase(), admin.toUpperCase(), body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('LAST_ADMIN');
    expect(await memberRow(c, admin)).toEqual({ role: 'admin', status: 'active' });
    expect(await count(c)).toBe(3);
  });

  it.each([
    ['lift the block on', { status: 'left' }],
    ['reactivate', { status: 'active' }],
  ])('refuses a moderator trying to %s an inactive stored admin (BUG-105)', async (_label, body) => {
    const { c, others: [mod, removed] } = await staffedCommunity({ others: 2 });
    await setRow(c, mod, 'active', 'moderator');
    await setRow(c, removed, 'inactive', 'admin');
    const res = await as(mod).put(c, removed, body);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(await memberRow(c, removed)).toEqual({ role: 'admin', status: 'inactive' });
  });

  it('refuses a moderator deactivating a non-last admin (BUG-105)', async () => {
    const { c, others: [mod, coAdmin] } = await staffedCommunity({ others: 2 });
    await setRow(c, mod, 'active', 'moderator');
    await setRow(c, coAdmin, 'active', 'admin');
    const res = await as(mod).put(c, coAdmin, { status: 'inactive' });
    expect(res.status).toBe(403);
    expect(await memberRow(c, coAdmin)).toEqual({ role: 'admin', status: 'active' });
    expect(await count(c)).toBe(3);
  });

  it.each(['public', 'private'] as const)('returns a departed, blocked person only through their own %s rejoin (Codex F3)', async (access) => {
    const { c, admin, others: [person] } = await staffedCommunity({ others: 2, access });
    await setRow(c, person, 'active', 'moderator');
    expect((await as(person).del(c, person)).status).toBe(200);
    expect(await memberRow(c, person)).toEqual({ role: 'moderator', status: 'left' });
    expect(await count(c)).toBe(2);

    expect((await as(admin).del(c, person)).status).toBe(200);
    expect(await memberRow(c, person)).toEqual({ role: 'moderator', status: 'inactive' });
    const blocked = await as(person).join(c);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('MEMBERSHIP_RESTORE_REQUIRES_STAFF');

    const reactivate = await as(admin).put(c, person, { status: 'active' });
    expect(reactivate.status).toBe(409);
    expect(await memberRow(c, person)).toEqual({ role: 'moderator', status: 'inactive' });

    const lift = await as(admin).put(c, person, { status: 'left' });
    expect(lift.status).toBe(200);
    expect(await memberRow(c, person)).toEqual({ role: 'member', status: 'left' });
    expect(await count(c)).toBe(2);

    const rejoin = await as(person).join(c);
    expect(rejoin.status).toBe(200);
    const expected = access === 'public' ? 'active' : 'pending';
    expect(await memberRow(c, person)).toEqual({ role: 'member', status: expected });
    expect(await count(c)).toBe(access === 'public' ? 3 : 2);
  });

  it('applies the capacity post-check to a lifted person\'s own rejoin', async () => {
    const { c, admin, others: [person] } = await staffedCommunity({ others: 2, max: 3 });
    await setRow(c, person, 'inactive');
    expect((await as(admin).put(c, person, { status: 'left' })).status).toBe(200);
    const [filler] = await users(1);
    expect((await as(filler).join(c)).status).toBe(200);
    expect(await count(c)).toBe(3);
    const rejoin = await as(person).join(c);
    expect(rejoin.status).toBe(400);
    expect(rejoin.body.error).toBe('COMMUNITY_FULL');
    expect(await memberRow(c, person)).toEqual({ role: 'member', status: 'left' });
  });

  it.each([{ status: 'active' }, { status: 'left' }, { status: 'inactive' }, { role: 'admin' }])(
    'refuses %j against a left row with 409 MEMBER_MUST_REJOIN', async (body) => {
      const { c, admin, others: [person] } = await staffedCommunity({ others: 1 });
      await setRow(c, person, 'left');
      const res = await as(admin).put(c, person, body);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('MEMBER_MUST_REJOIN');
      expect(await memberRow(c, person)).toEqual({ role: 'member', status: 'left' });
    });

  it('keeps staff direct-add as the documented exception: an active member, counted once (decision 10)', async () => {
    const { c, admin } = await staffedCommunity({ others: 1 });
    const [added] = await users(1);
    const res = await as(admin).add(c, added.toUpperCase());
    expect(res.status).toBe(201);
    expect(await memberRow(c, added)).toEqual({ role: 'member', status: 'active' });
    expect(await count(c)).toBe(3);
  });

  it('lets a moderator approve (role reset to member, counted) and reject (not counted)', async () => {
    const { c, others: [mod, approved, rejected] } = await staffedCommunity({ others: 3 });
    await setRow(c, mod, 'active', 'moderator');
    await setRow(c, approved, 'pending', 'admin');
    await setRow(c, rejected, 'pending');
    expect(await count(c)).toBe(2);
    const ok = await as(mod).put(c, approved, { status: 'active' });
    expect(ok.status).toBe(200);
    expect(await memberRow(c, approved)).toEqual({ role: 'member', status: 'active' });
    expect(await count(c)).toBe(3);
    const no = await as(mod).put(c, rejected, { status: 'inactive' });
    expect(no.status).toBe(200);
    expect(await memberRow(c, rejected)).toEqual({ role: 'member', status: 'inactive' });
    expect(await count(c)).toBe(3);
  });

  it('approves exactly one of two pending applicants racing for the last free slot', async () => {
    const { c, admin, others: [a, b] } = await staffedCommunity({ others: 3, max: 3 });
    await setRow(c, a, 'pending');
    await setRow(c, b, 'pending');
    expect(await count(c)).toBe(2);
    const responses = await raceOnCommunityRow(c, 2, () => Promise.all([
      as(admin).put(c, a, { status: 'active' }), as(admin).put(c, b, { status: 'active' }),
    ]));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(responses.find((r) => r.status === 400)!.body.error).toBe('COMMUNITY_FULL');
    expect(await count(c)).toBe(3);
    const statuses = [(await memberRow(c, a)).status, (await memberRow(c, b)).status].sort();
    expect(statuses).toEqual(['active', 'pending']);
  });

  it('refuses a moderator whose demotion commits while their approve waits on the admin locks', async () => {
    const { c, admin, others: [mod, applicant] } = await staffedCommunity({ others: 2 });
    await setRow(c, mod, 'active', 'moderator');
    await setRow(c, applicant, 'pending');
    expect(await count(c)).toBe(2);
    // The demoting admin's PUT, paused after its lock: target + active admins, user-id ordered.
    const demotion = await pool.connect();
    let approve: Promise<request.Response>;
    try {
      await demotion.query('BEGIN');
      await demotion.query(`SELECT user_id FROM communities.members
        WHERE community_id=$1 AND (user_id=$2 OR (role='admin' AND status='active')) ORDER BY user_id FOR UPDATE`, [c, mod]);
      await demotion.query(`UPDATE communities.members SET role='member' WHERE community_id=$1 AND user_id=$2`, [c, mod]);
      let settled = false;
      approve = as(mod).put(c, applicant, { status: 'active' }).then((r) => r).finally(() => { settled = true; });
      expect(await lockWaiters(1, () => settled)).toBe(1);
      await demotion.query('COMMIT');
    } catch (error) {
      await demotion.query('ROLLBACK');
      throw error;
    } finally {
      demotion.release();
    }
    const res = await approve!;
    expect(res.status).toBe(403);
    expect(await memberRow(c, applicant)).toEqual({ role: 'member', status: 'pending' });
    expect(await memberRow(c, mod)).toEqual({ role: 'member', status: 'active' });
    expect(await count(c)).toBe(2);
    void admin;
  });
});
