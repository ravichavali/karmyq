import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import servicePool from '../../services/community-service/src/database/db';
import {
  addRatification,
  closeNomination,
  createNomination,
} from '../../services/community-service/src/database/governanceDb';

jest.mock('../../services/community-service/src/events/publisher', () => ({
  publishEvent: jest.fn(),
  initEventPublisher: jest.fn(),
}));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
type CreateInput = {
  communityId: string;
  nominatorId: string;
  nominatedUserId: string;
  role: 'admin' | 'moderator';
};

let fixture: { community: string; users: string[] };

async function memberFixture(count = 5) {
  const users = Array.from({ length: count }, () => randomUUID());
  const community = randomUUID();
  await pool.query(`INSERT INTO auth.users(id,email,name,password_hash)
    SELECT id, id::text || '@s143.invalid', 'S143 member', 'unused' FROM unnest($1::uuid[]) id`, [users]);
  await pool.query(`INSERT INTO communities.communities(id,name,creator_id,current_members)
    VALUES($1,'S143 lifecycle fixture',$2,$3)`, [community, users[0], count]);
  await pool.query(`INSERT INTO communities.members(community_id,user_id,role)
    SELECT $1,id,CASE WHEN id=$3 THEN 'admin' ELSE 'member' END FROM unnest($2::uuid[]) id`,
  [community, users, users[0]]);
  const [a, b] = [users[0], users[1]].sort();
  await pool.query(`INSERT INTO social_graph.trust_edges(community_id,user_id_a,user_id_b,raw_weight)
    VALUES($1,$2,$3,100)`, [community, a, b]);
  return { community, users };
}

async function foreignCommunity(member: string) {
  const id = randomUUID();
  await pool.query(`INSERT INTO communities.communities(id,name,creator_id)
    VALUES($1,'S143 foreign community',$2)`, [id, member]);
  await pool.query(`INSERT INTO communities.members(community_id,user_id,role)
    VALUES($1,$2,'admin')`, [id, member]);
  return id;
}

const input = (): CreateInput => ({
  communityId: fixture.community,
  nominatorId: fixture.users[0],
  nominatedUserId: fixture.users[1],
  role: 'moderator',
});
const create = (overrides: Partial<CreateInput> = {}) => createNomination({ ...input(), ...overrides });
const vote = (nominationId: string, ratifierId: string, communityId = fixture.community) =>
  addRatification({ communityId, nominationId, ratifierId });
const close = (nominationId: string, callerId: string, action: 'withdraw' | 'decline', communityId = fixture.community) =>
  closeNomination({ communityId, nominationId, callerId, action });
const nominationRow = async (id: string) =>
  (await pool.query(`SELECT * FROM communities.governance_nominations WHERE id=$1`, [id])).rows[0];
const nomineeRole = async () => (await pool.query(
  `SELECT role FROM communities.members WHERE community_id=$1 AND user_id=$2`,
  [fixture.community, fixture.users[1]],
)).rows[0].role;
const ballotCount = async (id: string) => (await pool.query(
  `SELECT count(*)::int AS n FROM communities.governance_ratifications WHERE nomination_id=$1`, [id],
)).rows[0].n;
const expire = (id: string) => pool.query(`UPDATE communities.governance_nominations
  SET created_at=created_at-interval '31 days',expires_at=expires_at-interval '31 days' WHERE id=$1`, [id]);

afterEach(async () => {
  if (!fixture) return;
  await pool.query(`DELETE FROM communities.communities WHERE id=$1`, [fixture.community]);
  await pool.query(`DELETE FROM auth.users WHERE id=ANY($1::uuid[])`, [fixture.users]);
});

afterAll(async () => {
  await servicePool.end();
  await pool.end();
});

describe('Sprint 143 nomination close operations', () => {
  beforeEach(async () => { fixture = await memberFixture(); });

  it('allows only the nominator to withdraw, preserves ballots and refuses retries', async () => {
    const nomination = await create();
    await vote(nomination.id, fixture.users[2]);
    await expect(close(nomination.id, fixture.users[2], 'withdraw'))
      .rejects.toMatchObject({ status: 403, code: 'GOVERNANCE_NOT_NOMINATOR' });
    await expect(close(nomination.id, fixture.users[0], 'withdraw')).resolves.toEqual({
      id: nomination.id,
      status: 'withdrawn',
    });
    expect(await nominationRow(nomination.id)).toMatchObject({ status: 'withdrawn' });
    expect(await ballotCount(nomination.id)).toBe(1);
    await expect(close(nomination.id, fixture.users[0], 'withdraw'))
      .rejects.toMatchObject({ status: 409, code: 'GOVERNANCE_NOMINATION_CLOSED' });
  });

  it('allows only the nominee to decline, including at quorum', async () => {
    const nomination = await create();
    await vote(nomination.id, fixture.users[0]);
    await vote(nomination.id, fixture.users[2]);
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[2]]);
    await vote(nomination.id, fixture.users[3]);
    await pool.query(`UPDATE communities.members SET status='active' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[2]]);
    await expect(close(nomination.id, fixture.users[0], 'decline'))
      .rejects.toMatchObject({ status: 403, code: 'GOVERNANCE_NOT_NOMINEE' });
    await expect(close(nomination.id, fixture.users[1], 'decline')).resolves.toEqual({
      id: nomination.id,
      status: 'declined',
    });
    expect(await ballotCount(nomination.id)).toBe(3);
    expect(await nomineeRole()).toBe('member');
    await expect(close(nomination.id, fixture.users[1], 'decline'))
      .rejects.toMatchObject({ status: 409, code: 'GOVERNANCE_NOMINATION_CLOSED' });
  });

  it('gives an admin who is neither party no close power', async () => {
    const nomination = await create();
    await pool.query(`UPDATE communities.members SET role='admin' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[2]]);
    await expect(close(nomination.id, fixture.users[2], 'withdraw'))
      .rejects.toMatchObject({ status: 403, code: 'GOVERNANCE_NOT_NOMINATOR' });
    await expect(close(nomination.id, fixture.users[2], 'decline'))
      .rejects.toMatchObject({ status: 403, code: 'GOVERNANCE_NOT_NOMINEE' });
    expect((await nominationRow(nomination.id)).status).toBe('pending');
  });

  it.each(['withdraw', 'decline'] as const)('refuses an inactive %s caller without writing', async (action) => {
    const nomination = await create();
    const caller = action === 'withdraw' ? fixture.users[0] : fixture.users[1];
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, caller]);
    await expect(close(nomination.id, caller, action))
      .rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect((await nominationRow(nomination.id)).status).toBe('pending');
  });

  it.each(['withdraw', 'decline'] as const)('returns 404 for a foreign community and leaves %s unchanged', async (action) => {
    const nomination = await create();
    const foreign = await foreignCommunity(fixture.users[0]);
    try {
      await expect(close(nomination.id, fixture.users[0], action, foreign))
        .rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
      expect((await nominationRow(nomination.id)).status).toBe('pending');
    } finally {
      await pool.query(`DELETE FROM communities.communities WHERE id=$1`, [foreign]);
    }
  });

  it.each(['withdraw', 'decline'] as const)('lets a self-nomination use %s', async (action) => {
    const nomination = await create({ nominatorId: fixture.users[1] });
    await expect(close(nomination.id, fixture.users[1], action)).resolves.toEqual({
      id: nomination.id,
      status: action === 'withdraw' ? 'withdrawn' : 'declined',
    });
  });
});

describe('Sprint 143 lazy expiry and DB backstop', () => {
  beforeEach(async () => { fixture = await memberFixture(); });

  it.each(['ratify', 'withdraw', 'decline'] as const)('commits expiry before refusing %s', async (operation) => {
    const nomination = await create();
    await expire(nomination.id);
    const expected = await nominationRow(nomination.id);
    let outcome: Promise<unknown>;
    if (operation === 'ratify') outcome = vote(nomination.id, fixture.users[0]);
    else outcome = close(nomination.id, fixture.users[operation === 'withdraw' ? 0 : 1], operation);
    await expect(outcome).rejects.toMatchObject({ status: 409, code: 'GOVERNANCE_NOMINATION_EXPIRED' });

    const fresh = await nominationRow(nomination.id);
    expect(fresh.status).toBe('expired');
    expect(fresh.resolved_at).toEqual(expected.expires_at);
    expect(await ballotCount(nomination.id)).toBe(0);
  });

  it('reclaims an expired slot for a new nomination', async () => {
    const old = await create();
    await expire(old.id);
    const replacement = await create();
    expect(replacement.id).not.toBe(old.id);
    expect((await nominationRow(old.id)).status).toBe('expired');
    expect((await nominationRow(replacement.id)).status).toBe('pending');
  });

  it('refuses raw ballots and ratification on an expired row with the protocol marker set', async () => {
    const nomination = await create();
    await expire(nomination.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.governance_policy_version','1',true)`);
      await client.query('SAVEPOINT expired_ballot');
      await expect(client.query(`INSERT INTO communities.governance_ratifications(nomination_id,ratifier_id)
        VALUES($1,$2)`, [nomination.id, fixture.users[0]]))
        .rejects.toMatchObject({ code: '23514', message: 'GOVERNANCE_NOMINATION_EXPIRED' });
      await client.query('ROLLBACK TO SAVEPOINT expired_ballot');
      await client.query('SAVEPOINT expired_ratified');
      await expect(client.query(`UPDATE communities.governance_nominations SET status='ratified' WHERE id=$1`,
        [nomination.id])).rejects.toMatchObject({ code: '23514', message: 'GOVERNANCE_NOMINATION_EXPIRED' });
      await client.query('ROLLBACK TO SAVEPOINT expired_ratified');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect((await nominationRow(nomination.id)).status).toBe('pending');
  });
});

describe('Sprint 143 lifecycle races', () => {
  beforeEach(async () => { fixture = await memberFixture(); });

  it.each(['decline', 'withdraw'] as const)('serializes %s against final ratification', async (action) => {
    const nomination = await create();
    await vote(nomination.id, fixture.users[0]);
    await vote(nomination.id, fixture.users[2]);
    const caller = action === 'decline' ? fixture.users[1] : fixture.users[0];
    const outcomes = await Promise.allSettled([
      close(nomination.id, caller, action),
      vote(nomination.id, fixture.users[3]),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const row = await nominationRow(nomination.id);
    expect([action === 'decline' ? 'declined' : 'withdrawn', 'ratified']).toContain(row.status);
    if (row.status === 'ratified') expect(await nomineeRole()).toBe('moderator');
    else expect(await nomineeRole()).toBe('member');
  }, 60000);

  it('reclaims an expired slot while a concurrent ratification fails closed', async () => {
    const old = await create();
    await expire(old.id);
    const outcomes = await Promise.allSettled([create(), vote(old.id, fixture.users[0])]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1].status).toBe('rejected');
    if (outcomes[0].status === 'fulfilled') {
      expect((await nominationRow(old.id)).status).toBe('expired');
      expect((await nominationRow(outcomes[0].value.id)).status).toBe('pending');
    }
    if (outcomes[1].status === 'rejected') {
      expect([409, 503]).toContain(outcomes[1].reason.status);
      expect(['GOVERNANCE_NOMINATION_EXPIRED', 'GOVERNANCE_NOMINATION_CLOSED', 'GOVERNANCE_RETRY'])
        .toContain(outcomes[1].reason.code);
    }
  }, 60000);
});
