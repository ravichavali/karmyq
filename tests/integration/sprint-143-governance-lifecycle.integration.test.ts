import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import servicePool from '../../services/community-service/src/database/db';
import membersRouter from '../../services/community-service/src/routes/members';
import { authMiddleware } from '../../packages/shared/middleware/auth';
import {
  addRatification,
  closeNomination,
  createNomination,
  getGovernanceState,
} from '../../services/community-service/src/database/governanceDb';
import { assertNoForbiddenReputationKeys } from '@karmyq/shared';

jest.mock('../../services/community-service/src/events/publisher', () => ({
  publishEvent: jest.fn(),
  initEventPublisher: jest.fn(),
}));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const migration = (name: string) => readFileSync(
  resolve(__dirname, '../../infrastructure/postgres/migrations', name), 'utf8',
);
const quorumMigration = () => migration('20261112-governance-quorum.sql');
const lifecycleMigration = () => migration('20261115-governance-nomination-lifecycle.sql');
const dropGuards = `
  DROP TRIGGER IF EXISTS governance_nomination_protocol ON communities.governance_nominations;
  DROP TRIGGER IF EXISTS governance_ballot_protocol ON communities.governance_ratifications;
`;
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

describe('Sprint 143 migration replay from the pre-lifecycle shape', () => {
  it('backfills v1 rows, upgrades the guards, is idempotent and rolls back cleanly', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(dropGuards);
      const user = randomUUID();
      const community = randomUUID();
      await client.query(`INSERT INTO auth.users(id,email,name,password_hash)
        VALUES($1,$2,'S143 replay','unused')`, [user, `${user}@s143.invalid`]);
      await client.query(`INSERT INTO communities.communities(id,name,creator_id)
        VALUES($1,'S143 replay',$2)`, [community, user]);
      await client.query(`ALTER TABLE communities.governance_nominations DROP COLUMN expires_at`);
      expect((await client.query(`SELECT 1 FROM pg_constraint
        WHERE conrelid='communities.governance_nominations'::regclass
        AND conname='governance_expiry_metadata'`)).rowCount).toBe(0);
      await client.query(`ALTER TABLE communities.governance_nominations DROP CONSTRAINT valid_nomination_status`);
      await client.query(`ALTER TABLE communities.governance_nominations ADD CONSTRAINT valid_nomination_status
        CHECK (status IN ('pending','ratified','rejected','withdrawn'))`);

      const legacy = (await client.query(`INSERT INTO communities.governance_nominations
        (community_id,nominated_user_id,nominator_id,nominated_for_role,status,resolved_at)
        VALUES($1,$2,$2,'moderator','rejected',NOW()) RETURNING id`, [community, user])).rows[0].id;
      const pending = (await client.query(`INSERT INTO communities.governance_nominations
        (community_id,nominated_user_id,nominator_id,nominated_for_role,status,
         quorum_policy_version,electorate_size,required_ratifications,created_at)
        VALUES($1,$2,$2,'moderator','pending',1,3,3,NOW()-interval '10 days') RETURNING id`,
      [community, user])).rows[0].id;
      const ratified = (await client.query(`INSERT INTO communities.governance_nominations
        (community_id,nominated_user_id,nominator_id,nominated_for_role,status,resolved_at,
         quorum_policy_version,electorate_size,required_ratifications,created_at)
        VALUES($1,$2,$2,'moderator','ratified',NOW()-interval '20 days',1,3,3,NOW()-interval '20 days') RETURNING id`,
      [community, user])).rows[0].id;

      await client.query(quorumMigration());
      await client.query(lifecycleMigration());
      const backfilled = await client.query(`SELECT id,created_at,expires_at FROM communities.governance_nominations
        WHERE id=ANY($1::uuid[]) ORDER BY id`, [[legacy, pending, ratified]]);
      for (const row of backfilled.rows.filter(row => row.id !== legacy)) {
        expect(row.expires_at.getTime() - row.created_at.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
      }
      expect(backfilled.rows.find(row => row.id === legacy).expires_at).toBeNull();

      const guard = () => client.query(`SELECT pg_get_functiondef(
        'communities.require_governance_protocol_v1()'::regprocedure) AS definition`);
      expect((await guard()).rows[0].definition).toEqual(expect.stringContaining('GOVERNANCE_NOMINATION_EXPIRED'));
      for (const check of [
        'GOVERNANCE_PROTOCOL_REQUIRED',
        'GOVERNANCE_POLICY_METADATA_REQUIRED',
        "current_setting('app.governance_policy_version', true) IS DISTINCT FROM '1'",
        'NEW.quorum_policy_version IS DISTINCT FROM 1',
        'NEW.electorate_size IS NULL',
      ]) {
        expect((await guard()).rows[0].definition).toEqual(expect.stringContaining(check));
      }

      await client.query(`SELECT set_config('app.governance_policy_version','1',true)`);
      const current = (await client.query(`INSERT INTO communities.governance_nominations
        (community_id,nominated_user_id,nominator_id,nominated_for_role,
         quorum_policy_version,electorate_size,required_ratifications)
        VALUES($1,$2,$2,'admin',1,3,3) RETURNING id,created_at,expires_at`, [community, user])).rows[0];
      expect(current.expires_at.getTime() - current.created_at.getTime()).toBe(30 * 24 * 60 * 60 * 1000);

      await client.query('SAVEPOINT null_expiry');
      await expect(client.query(`UPDATE communities.governance_nominations SET expires_at=NULL WHERE id=$1`,
        [current.id])).rejects.toMatchObject({ code: '23514', constraint: 'governance_expiry_metadata' });
      await client.query('ROLLBACK TO SAVEPOINT null_expiry');
      for (const status of ['declined', 'expired']) {
        await client.query('SAVEPOINT accepted_status');
        await client.query(`UPDATE communities.governance_nominations SET status=$2 WHERE id=$1`, [current.id, status]);
        await client.query('ROLLBACK TO SAVEPOINT accepted_status');
      }
      await client.query('SAVEPOINT unknown_status');
      await expect(client.query(`UPDATE communities.governance_nominations SET status='unknown' WHERE id=$1`,
        [current.id])).rejects.toMatchObject({ code: '23514', constraint: 'valid_nomination_status' });
      await client.query('ROLLBACK TO SAVEPOINT unknown_status');

      const snapshot = async () => ({
        rows: (await client.query(`SELECT id,status,required_ratifications,quorum_policy_version,electorate_size,
          created_at,resolved_at,expires_at FROM communities.governance_nominations
          WHERE community_id=$1 ORDER BY id`, [community])).rows,
        constraints: (await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conrelid='communities.governance_nominations'::regclass
          AND conname=ANY($1::text[]) ORDER BY conname`,
        [['governance_quorum_metadata', 'governance_expiry_metadata', 'valid_nomination_status']])).rows,
        guard: (await guard()).rows[0].definition,
      });
      const before = await snapshot();
      await client.query(lifecycleMigration());
      expect(await snapshot()).toEqual(before);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }

    const column = await pool.query(`SELECT data_type,column_default FROM information_schema.columns
      WHERE table_schema='communities' AND table_name='governance_nominations' AND column_name='expires_at'`);
    expect(column.rows).toHaveLength(1);
    expect(column.rows[0].data_type).toBe('timestamp with time zone');
    expect(column.rows[0].column_default).toContain('30 days');
    const constraints = await pool.query(`SELECT conname FROM pg_constraint
      WHERE conrelid='communities.governance_nominations'::regclass AND conname=ANY($1::text[]) ORDER BY conname`,
    [['governance_expiry_metadata', 'valid_nomination_status']]);
    expect(constraints.rows.map(row => row.conname)).toEqual(['governance_expiry_metadata', 'valid_nomination_status']);
    const triggers = await pool.query(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND (
      (tgrelid='communities.governance_nominations'::regclass AND tgname='governance_nomination_protocol') OR
      (tgrelid='communities.governance_ratifications'::regclass AND tgname='governance_ballot_protocol')) ORDER BY tgname`);
    expect(triggers.rows.map(row => row.tgname)).toEqual(['governance_ballot_protocol', 'governance_nomination_protocol']);
    const currentGuard = await pool.query(`SELECT pg_get_functiondef(
      'communities.require_governance_protocol_v1()'::regprocedure) AS definition`);
    expect(currentGuard.rows[0].definition).toContain('GOVERNANCE_NOMINATION_EXPIRED');
  }, 60000);
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
    const rejected = outcomes.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toMatchObject({ status: 409, code: 'GOVERNANCE_NOMINATION_CLOSED' });
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


describe('Sprint 143 governance GET projection and POST mirror', () => {
  beforeEach(async () => { fixture = await memberFixture(); });

  const readNomination = async (viewer = fixture.users[0]) => {
    const state = await getGovernanceState(fixture.community, viewer);
    expect(state.nominations).toHaveLength(1);
    return state.nominations[0];
  };

  const restoreQuorumWithoutFinalizing = async (nominationId: string) => {
    await vote(nominationId, fixture.users[0]);
    await vote(nominationId, fixture.users[2]);
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[2]]);
    await vote(nominationId, fixture.users[3]);
    await pool.query(`UPDATE communities.members SET status='active' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[2]]);
  };

  it('returns exact expiry and party flags, hides expired rows and preserves disclosure boundaries', async () => {
    const nomination = await create();
    const stored = await nominationRow(nomination.id);
    const nominatorView = await readNomination();
    expect(nominatorView.expires_at).toEqual(stored.expires_at);
    expect(stored.expires_at.getTime() - stored.created_at.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(nominatorView.nominee_eligible).toBe(true);
    expect(nominatorView.viewer).toEqual({
      can_ratify: true,
      reason: 'eligible',
      can_withdraw: true,
      can_decline: false,
    });
    expect(nominatorView).not.toHaveProperty('voters');
    expect((await readNomination(fixture.users[1])).viewer).toEqual({
      can_ratify: false,
      reason: 'nominee',
      can_withdraw: false,
      can_decline: true,
    });
    const state = await getGovernanceState(fixture.community, fixture.users[0]);
    expect(() => assertNoForbiddenReputationKeys(state)).not.toThrow();

    await expire(nomination.id);
    expect((await getGovernanceState(fixture.community, fixture.users[0])).nominations).toEqual([]);
  });

  it.each(['inactive', 'trust', 'role'])('reports nominee_eligible false for %s', async (reason) => {
    const nomination = await create();
    if (reason === 'inactive') {
      await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
        [fixture.community, fixture.users[1]]);
    } else if (reason === 'trust') {
      await pool.query(`UPDATE social_graph.trust_edges SET raw_weight=0 WHERE community_id=$1`, [fixture.community]);
    } else {
      await pool.query(`UPDATE communities.members SET role='moderator' WHERE community_id=$1 AND user_id=$2`,
        [fixture.community, fixture.users[1]]);
    }
    expect((await readNomination()).nominee_eligible).toBe(false);
    expect((await nominationRow(nomination.id)).status).toBe('pending');
  });

  it('mirrors nominee refusal without a ballot or finalization', async () => {
    const nomination = await create();
    const view = await readNomination(fixture.users[1]);
    expect(view.viewer).toMatchObject({ can_ratify: false, reason: 'nominee' });
    await expect(vote(nomination.id, fixture.users[1]))
      .rejects.toMatchObject({ status: 422, code: 'GOVERNANCE_SELF_RATIFICATION' });
    expect(await ballotCount(nomination.id)).toBe(0);
    expect((await nominationRow(nomination.id)).status).toBe('pending');
    expect(await nomineeRole()).toBe('member');
  });

  it('mirrors not_in_electorate refusal without a ballot or finalization', async () => {
    const nomination = await create();
    const lateUser = randomUUID();
    fixture.users.push(lateUser);
    await pool.query(`INSERT INTO auth.users(id,email,name,password_hash) VALUES($1,$2,'Late voter','unused')`,
      [lateUser, `${lateUser}@s143.invalid`]);
    await pool.query(`INSERT INTO communities.members(community_id,user_id) VALUES($1,$2)`,
      [fixture.community, lateUser]);
    expect((await readNomination(lateUser)).viewer).toEqual({
      can_ratify: false,
      reason: 'not_in_electorate',
      can_withdraw: false,
      can_decline: false,
    });
    await expect(vote(nomination.id, lateUser))
      .rejects.toMatchObject({ status: 403, code: 'GOVERNANCE_VOTER_NOT_ELIGIBLE' });
    expect(await ballotCount(nomination.id)).toBe(0);
    expect((await nominationRow(nomination.id)).status).toBe('pending');
    expect(await nomineeRole()).toBe('member');
  });

  it('mirrors already_ratified below quorum to an idempotent POST with no changes', async () => {
    const nomination = await create();
    await vote(nomination.id, fixture.users[2]);
    expect((await readNomination(fixture.users[2])).viewer).toMatchObject({
      can_ratify: false,
      reason: 'already_ratified',
    });
    await expect(vote(nomination.id, fixture.users[2])).resolves.toEqual({
      ratified: false,
      ratification_count: 1,
      required_ratifications: 3,
    });
    expect(await ballotCount(nomination.id)).toBe(1);
    expect((await nominationRow(nomination.id)).status).toBe('pending');
    expect(await nomineeRole()).toBe('member');
  });

  it('mirrors ready_to_finalize to finalization without another ballot', async () => {
    const nomination = await create();
    await restoreQuorumWithoutFinalizing(nomination.id);
    expect((await readNomination()).viewer).toMatchObject({ can_ratify: true, reason: 'ready_to_finalize' });
    await expect(vote(nomination.id, fixture.users[0])).resolves.toEqual({
      ratified: true,
      ratification_count: 3,
      required_ratifications: 3,
    });
    expect(await ballotCount(nomination.id)).toBe(3);
    expect((await nominationRow(nomination.id)).status).toBe('ratified');
    expect(await nomineeRole()).toBe('moderator');
  });

  it('mirrors restored quorum with an ineligible nominee to a rollback with no changes', async () => {
    const nomination = await create();
    await restoreQuorumWithoutFinalizing(nomination.id);
    await pool.query(`UPDATE social_graph.trust_edges SET raw_weight=0 WHERE community_id=$1`, [fixture.community]);
    expect((await readNomination()).viewer).toMatchObject({ can_ratify: false, reason: 'nominee_ineligible' });
    await expect(vote(nomination.id, fixture.users[0]))
      .rejects.toMatchObject({ status: 422, code: 'GOVERNANCE_ELIGIBILITY_NOT_MET' });
    expect(await ballotCount(nomination.id)).toBe(3);
    expect((await nominationRow(nomination.id)).status).toBe('pending');
    expect(await nomineeRole()).toBe('member');
  });

  it('mirrors a deciding ballot with an ineligible nominee to a rollback with no changes', async () => {
    const nomination = await create();
    await vote(nomination.id, fixture.users[0]);
    await vote(nomination.id, fixture.users[2]);
    await pool.query(`UPDATE social_graph.trust_edges SET raw_weight=0 WHERE community_id=$1`, [fixture.community]);
    expect((await readNomination(fixture.users[3])).viewer).toMatchObject({
      can_ratify: false,
      reason: 'nominee_ineligible',
    });
    await expect(vote(nomination.id, fixture.users[3]))
      .rejects.toMatchObject({ status: 422, code: 'GOVERNANCE_ELIGIBILITY_NOT_MET' });
    expect(await ballotCount(nomination.id)).toBe(2);
    expect((await nominationRow(nomination.id)).status).toBe('pending');
    expect(await nomineeRole()).toBe('member');
  });

  it('offers and records a non-deciding ballot even when the nominee is ineligible', async () => {
    const nomination = await create();
    await pool.query(`UPDATE social_graph.trust_edges SET raw_weight=0 WHERE community_id=$1`, [fixture.community]);
    expect((await readNomination(fixture.users[2])).viewer).toMatchObject({
      can_ratify: true,
      reason: 'eligible',
    });
    await expect(vote(nomination.id, fixture.users[2])).resolves.toEqual({
      ratified: false,
      ratification_count: 1,
      required_ratifications: 3,
    });
    expect(await ballotCount(nomination.id)).toBe(1);
    expect((await nominationRow(nomination.id)).status).toBe('pending');
    expect(await nomineeRole()).toBe('member');
  });

  it.each(['Infinity', '-Infinity', 'NaN'])('keeps non-finite trust %s ineligible in GET and POST', async (weight) => {
    const nomination = await create();
    await restoreQuorumWithoutFinalizing(nomination.id);
    await pool.query(`UPDATE social_graph.trust_edges SET raw_weight=$2::float8 WHERE community_id=$1`, [fixture.community, weight]);
    const state = await getGovernanceState(fixture.community, fixture.users[0]);
    expect(state.eligible_members).toEqual([]);
    expect(state.nominations[0]).toMatchObject({
      nominee_eligible: false,
      viewer: { can_ratify: false, reason: 'nominee_ineligible' },
    });
    await expect(vote(nomination.id, fixture.users[0]))
      .rejects.toMatchObject({ status: 422, code: 'GOVERNANCE_ELIGIBILITY_NOT_MET' });
    expect((await nominationRow(nomination.id)).status).toBe('pending');
    expect(await nomineeRole()).toBe('member');
  });
});


const membersApp = express();
membersApp.use(express.json());
membersApp.use('/communities', authMiddleware, membersRouter);
const memberToken = (userId: string) => jwt.sign(
  { userId, email: `${userId}@s143.invalid`, communities: [] },
  process.env.JWT_SECRET!,
);
const join = (userId: string) => request(membersApp)
  .post(`/communities/${fixture.community}/join`)
  .auth(memberToken(userId), { type: 'bearer' })
  .send({});
const depart = (callerId: string, targetId = callerId) => request(membersApp)
  .delete(`/communities/${fixture.community}/members/${targetId}`)
  .auth(memberToken(callerId), { type: 'bearer' })
  .send({});
const memberRow = async (userId: string) => (await pool.query(
  `SELECT role,status FROM communities.members WHERE community_id=$1 AND user_id=$2`,
  [fixture.community, userId],
)).rows[0];
const currentMembers = async () => (await pool.query(
  `SELECT current_members FROM communities.communities WHERE id=$1`, [fixture.community],
)).rows[0].current_members;

 describe('Sprint 143 membership departure and rejoin', () => {
  beforeEach(async () => { fixture = await memberFixture(); });

  it('records the DB role flags used to exercise explicit member predicates', async () => {
    const result = await pool.query(`SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    console.warn('Sprint 143 membership DB role evidence', result.rows[0]);
    expect(result.rows).toHaveLength(1);
  });

  it.each(['active', 'pending'])('lets a %s member leave and only decrements for active membership', async (status) => {
    await pool.query(`UPDATE communities.members SET status=$3 WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1], status]);
    const response = await depart(fixture.users[1]);
    expect(response.status).toBe(200);
    expect(await memberRow(fixture.users[1])).toEqual({ role: 'member', status: 'left' });
    expect(await currentMembers()).toBe(status === 'active' ? 4 : 5);
    if (status === 'active') {
      const claims = jwt.verify(response.body.data.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
      expect(claims.communities).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: fixture.community }),
      ]));
    } else {
      expect(response.body.data.token).toBeUndefined();
    }
  });

  it('refuses self-departure from inactive without changing the row', async () => {
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1]]);
    expect((await depart(fixture.users[1])).status).toBe(409);
    expect((await memberRow(fixture.users[1])).status).toBe('inactive');
    expect(await currentMembers()).toBe(5);
  });

  it.each(['pending', 'left'])('lets an admin remove a %s row without changing the active counter', async (status) => {
    await pool.query(`UPDATE communities.members SET status=$3 WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1], status]);
    const response = await depart(fixture.users[0], fixture.users[1]);
    expect(response.status).toBe(200);
    expect((await memberRow(fixture.users[1])).status).toBe('inactive');
    expect(await currentMembers()).toBe(5);
  });

  it('still refuses a sole admin self-leave', async () => {
    const response = await depart(fixture.users[0]);
    expect(response.status).toBe(400);
    expect((await memberRow(fixture.users[0])).status).toBe('active');
    expect(await currentMembers()).toBe(5);
  });

  it('rejoins a public community as an active member, never restoring a stored staff role', async () => {
    await pool.query(`UPDATE communities.members SET status='left',role='admin',joined_at='2000-01-01' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1]]);
    await pool.query(`UPDATE communities.communities SET current_members=4 WHERE id=$1`, [fixture.community]);
    const response = await join(fixture.users[1]);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'active', role: 'member', token: expect.any(String) });
    expect(new Date(response.body.data.joined_at).getTime()).toBeGreaterThan(new Date('2000-01-01').getTime());
    expect(await memberRow(fixture.users[1])).toEqual({ role: 'member', status: 'active' });
    expect(await currentMembers()).toBe(5);
    const claims = jwt.verify(response.body.data.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(claims.communities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fixture.community, role: 'member' }),
    ]));
  });

  it('rejoins a private community as pending without changing the active counter', async () => {
    await pool.query(`UPDATE communities.communities SET access_type='private',current_members=4 WHERE id=$1`,
      [fixture.community]);
    await pool.query(`UPDATE communities.members SET status='left',role='admin' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1]]);
    const response = await join(fixture.users[1]);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'pending', role: 'member' });
    expect(response.body.data.token).toBeUndefined();
    expect(await currentMembers()).toBe(4);
  });

  it('requires staff to restore inactive membership', async () => {
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1]]);
    const response = await join(fixture.users[1]);
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('MEMBERSHIP_RESTORE_REQUIRES_STAFF');
    expect((await memberRow(fixture.users[1])).status).toBe('inactive');
  });

  it('serializes concurrent rejoins to one success and one conflict', async () => {
    await pool.query(`UPDATE communities.members SET status='left' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1]]);
    await pool.query(`UPDATE communities.communities SET current_members=4 WHERE id=$1`, [fixture.community]);
    const responses = await Promise.all([join(fixture.users[1]), join(fixture.users[1])]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await memberRow(fixture.users[1])).status).toBe('active');
    expect(await currentMembers()).toBe(5);
  });

  it('maps concurrent first joins to one success and one conflict, never 500', async () => {
    const userId = randomUUID();
    fixture.users.push(userId);
    await pool.query(`INSERT INTO auth.users(id,email,name,password_hash) VALUES($1,$2,'First join','unused')`,
      [userId, `${userId}@s143.invalid`]);
    const responses = await Promise.all([join(userId), join(userId)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await memberRow(userId)).status).toBe('active');
    expect(await currentMembers()).toBe(6);
  });

  it.each([2, 3])('serializes two admin self-leaves with %i initial admins', async (adminCount) => {
    await pool.query(`UPDATE communities.members SET role='admin' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1]]);
    if (adminCount === 3) {
      await pool.query(`UPDATE communities.members SET role='admin' WHERE community_id=$1 AND user_id=$2`,
        [fixture.community, fixture.users[2]]);
    }
    const responses = await Promise.all([depart(fixture.users[0]), depart(fixture.users[1])]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual(adminCount === 3 ? [200, 200] : [200, 400]);
    expect(statuses).not.toContain(500);
    const admins = await pool.query(`SELECT user_id FROM communities.members
      WHERE community_id=$1 AND role='admin' AND status='active'`, [fixture.community]);
    expect(admins.rows).toHaveLength(1);
    expect(await currentMembers()).toBe(adminCount === 3 ? 3 : 4);
  });

  it('finishes a staff status update racing an admin removal without deadlock', async () => {
    await pool.query(`UPDATE communities.members SET role='admin' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[1]]);
    const statusUpdate = request(membersApp)
      .put(`/communities/${fixture.community}/members/${fixture.users[1]}`)
      .auth(memberToken(fixture.users[0]), { type: 'bearer' })
      .send({ status: 'inactive' });
    const [updateResponse, departureResponse] = await Promise.all([
      statusUpdate,
      depart(fixture.users[0], fixture.users[2]),
    ]);
    expect([updateResponse.status, departureResponse.status]).toEqual([200, 200]);
    expect((await memberRow(fixture.users[1])).status).toBe('inactive');
    expect((await memberRow(fixture.users[2])).status).toBe('inactive');
  }, 60000);

  it('finishes a self-leave racing a final ratification without deadlock', async () => {
    const nomination = await create();
    await vote(nomination.id, fixture.users[0]);
    await vote(nomination.id, fixture.users[2]);
    const [departure, ballot] = await Promise.allSettled([
      depart(fixture.users[3]),
      vote(nomination.id, fixture.users[3]),
    ]);
    expect(departure.status).toBe('fulfilled');
    if (departure.status === 'fulfilled') expect(departure.value.status).toBe(200);
    if (ballot.status === 'fulfilled') expect([false, true]).toContain(ballot.value.ratified);
    else expect(ballot.reason).toMatchObject({ status: 403, code: 'GOVERNANCE_VOTER_NOT_ELIGIBLE' });
    expect(['pending', 'ratified']).toContain((await nominationRow(nomination.id)).status);
  }, 60000);

  it('allows an ordinary member to leave a community with no active admin', async () => {
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community, fixture.users[0]]);
    expect((await depart(fixture.users[2])).status).toBe(200);
    expect((await memberRow(fixture.users[2])).status).toBe('left');
  });

  it('restores an original voter ballot after that voter rejoins', async () => {
    const nomination = await create();
    await vote(nomination.id, fixture.users[2]);
    expect((await depart(fixture.users[2])).status).toBe(200);
    expect((await getGovernanceState(fixture.community, fixture.users[0])).nominations[0].ratification_count).toBe(0);
    expect((await join(fixture.users[2])).status).toBe(200);
    const nominationView = (await getGovernanceState(fixture.community, fixture.users[0])).nominations[0];
    expect(nominationView.ratification_count).toBe(1);
    expect(nominationView.required_ratifications).toBe(3);
  });
});
