import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import servicePool from '../../services/community-service/src/database/db';
import { createNomination } from '../../services/community-service/src/database/governanceDb';

const migration = () => readFileSync(resolve(__dirname,
  '../../infrastructure/postgres/migrations/20261112-governance-quorum.sql'), 'utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 6 });
const dropGuards = `
  DROP TRIGGER IF EXISTS governance_nomination_protocol ON communities.governance_nominations;
  DROP TRIGGER IF EXISTS governance_ballot_protocol ON communities.governance_ratifications;
`;

async function seed(client: PoolClient) {
  const user = randomUUID();
  const community = randomUUID();
  await client.query(`INSERT INTO auth.users(id,email,name,password_hash) VALUES($1,$2,'S142 test','unused')`,
    [user, `${user}@s142.invalid`]);
  await client.query(`INSERT INTO communities.communities(id,name,creator_id) VALUES($1,'S142 test',$2)`, [community, user]);
  return { user, community };
}

async function legacyNomination(client: PoolClient, community: string, user: string, status = 'pending') {
  const result = await client.query(`INSERT INTO communities.governance_nominations
    (community_id,nominated_user_id,nominator_id,nominated_for_role,status)
    VALUES($1,$2,$2,'moderator',$3) RETURNING id`, [community, user, status]);
  return result.rows[0].id;
}

afterAll(async () => { await servicePool.end(); await pool.end(); });

describe('Sprint 142 migration on the fully migrated integration schema', () => {
  it('records the actual role flags; predicate checks, not RLS, must supply isolation', async () => {
    const result = await pool.query(`SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    expect(result.rows).toHaveLength(1);
    expect(typeof result.rows[0].rolsuper).toBe('boolean');
    expect(typeof result.rows[0].rolbypassrls).toBe('boolean');
    // CI suppresses console.log; stderr retains the actual privilege evidence.
    console.warn('Sprint 142 DB role evidence', result.rows[0]);
  });

  it('legacy replay rolls back guard removal and preserves resolved history and ballots', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(dropGuards);
      const { user, community } = await seed(client);
      const pending = await legacyNomination(client, community, user);
      const resolved = await legacyNomination(client, community, user, 'ratified');
      await client.query(`INSERT INTO communities.governance_ratifications(nomination_id,ratifier_id) VALUES($1,$2)`, [pending, user]);
      await client.query(migration());
      const rows = await client.query(`SELECT id,status,resolved_at FROM communities.governance_nominations WHERE id=ANY($1::uuid[])`, [[pending, resolved]]);
      expect(rows.rows.find(r => r.id === pending)).toEqual(expect.objectContaining({ status: 'withdrawn', resolved_at: expect.any(Date) }));
      expect(rows.rows.find(r => r.id === resolved).status).toBe('ratified');
      expect((await client.query(`SELECT * FROM communities.governance_ratifications WHERE nomination_id=$1`, [pending])).rowCount).toBe(1);
      await client.query(`SELECT set_config('app.governance_policy_version','1',true)`);
      const current = await client.query(`INSERT INTO communities.governance_nominations
        (community_id,nominated_user_id,nominator_id,nominated_for_role,quorum_policy_version,electorate_size,required_ratifications)
        VALUES($1,$2,$2,'admin',1,16,4) RETURNING id`, [community,user]);
      await client.query(migration());
      expect((await client.query(`SELECT status FROM communities.governance_nominations WHERE id=$1`, [current.rows[0].id])).rows[0].status).toBe('pending');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    const guards = await pool.query(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname=ANY($1::text[])`,
      [['governance_nomination_protocol','governance_ballot_protocol']]);
    expect(guards.rows.map(r => r.tgname).sort()).toEqual(['governance_ballot_protocol','governance_nomination_protocol']);
  });

  it('rejects the legacy creator and ballot sequence without changing a role or retaining a ballot', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { user, community } = await seed(client);
      await client.query('SAVEPOINT old_create');
      await expect(legacyNomination(client,community,user)).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT old_create');
      await client.query(`SELECT set_config('app.governance_policy_version','1',true)`);
      const current = await client.query(`INSERT INTO communities.governance_nominations
        (community_id,nominated_user_id,nominator_id,nominated_for_role,quorum_policy_version,electorate_size,required_ratifications)
        VALUES($1,$2,$2,'moderator',1,3,3) RETURNING id`, [community,user]);
      await client.query(`SELECT set_config('app.governance_policy_version','',true)`);
      await client.query('SAVEPOINT old_ballot');
      await expect(client.query(`INSERT INTO communities.governance_ratifications(nomination_id,ratifier_id)
        VALUES($1,$2) ON CONFLICT DO NOTHING`, [current.rows[0].id,user])).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT old_ballot');
      expect((await client.query(`SELECT * FROM communities.governance_ratifications WHERE nomination_id=$1`, [current.rows[0].id])).rowCount).toBe(0);
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  it('legacy transaction finishes before cutoff in an independently committing scratch DB', async () => {
    const scratch = `s142_cutoff_${randomUUID().replace(/-/g, '')}`;
    // Generated identifier only; never accept a database name from request/config input.
    if (!/^s142_cutoff_[a-f0-9]{32}$/.test(scratch)) throw new Error('Invalid scratch database');
    await pool.query(`CREATE DATABASE "${scratch}"`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${scratch}`;
    const scratchPool = new Pool({ connectionString: url.toString(), max: 4 });
    let old: PoolClient | undefined;
    let migrator: PoolClient | undefined;
    let cutoff: Promise<{ error?: Error }> | undefined;
    try {
      await scratchPool.query(readFileSync(resolve(__dirname, '../../infrastructure/postgres/init.sql'), 'utf8'));
      await scratchPool.query(dropGuards);
      old = await scratchPool.connect();
      migrator = await scratchPool.connect();
      const { user, community } = await seed(old);
      await old.query(`INSERT INTO communities.members(community_id,user_id) VALUES($1,$2)`, [community,user]);
      const nomination = await legacyNomination(old,community,user);
      await old.query('BEGIN');
      await old.query(`INSERT INTO communities.governance_ratifications(nomination_id,ratifier_id) VALUES($1,$2)`, [nomination,user]);
      const pid = (await migrator.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await migrator.query(`SET lock_timeout = '8s'`);
      cutoff = migrator.query(migration()).then(() => ({}), error => ({ error }));
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (Date.now() < deadline) {
        waiting = (await scratchPool.query(`SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1`, [pid])).rows[0]?.waiting;
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      // Complete the exact legacy write order while cutoff waits for the ballot table lock.
      await old.query(`UPDATE communities.members SET role='moderator' WHERE community_id=$1 AND user_id=$2`, [community,user]);
      await old.query(`UPDATE communities.governance_nominations SET status='ratified',resolved_at=now() WHERE id=$1`, [nomination]);
      await old.query('COMMIT');
      expect(await cutoff).toEqual({});
      expect((await scratchPool.query(`SELECT status FROM communities.governance_nominations WHERE id=$1`, [nomination])).rows[0].status).toBe('ratified');
      await expect(legacyNomination(old,community,user)).rejects.toMatchObject({ code: '23514' });
      await expect(old.query(`INSERT INTO communities.governance_ratifications(nomination_id,ratifier_id)
        VALUES($1,$2) ON CONFLICT DO NOTHING`, [nomination,user])).rejects.toMatchObject({ code: '23514' });
    } finally {
      if (old) { await old.query('ROLLBACK'); old.release(); }
      if (cutoff) await cutoff;
      if (migrator) migrator.release();
      try {
        await scratchPool.query(migration());
        const guards = await scratchPool.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal
          AND tgname=ANY($1::text[])`, [['governance_nomination_protocol','governance_ballot_protocol']]);
        expect(guards.rows[0].n).toBe(2);
      } finally {
        await scratchPool.end();
        await pool.query(`DROP DATABASE "${scratch}"`);
      }
    }
  }, 60000);
});

type CreateInput = { communityId: string; nominatorId: string; nominatedUserId: string; role: 'admin' | 'moderator' };
const create = (input: CreateInput) => createNomination(input);
let fixture: { community: string; users: string[] };

async function memberFixture(count = 5) {
  const users = Array.from({ length: count }, () => randomUUID());
  const community = randomUUID();
  await pool.query(`INSERT INTO auth.users(id,email,name,password_hash)
    SELECT id, id::text || '@s142.invalid', 'S142 member', 'unused' FROM unnest($1::uuid[]) id`, [users]);
  await pool.query(`INSERT INTO communities.communities(id,name,creator_id,current_members)
    VALUES($1,'S142 creation fixture',$2,$3)`, [community,users[0],count]);
  await pool.query(`INSERT INTO communities.members(community_id,user_id,role)
    SELECT $1,id,CASE WHEN id=$3 THEN 'admin' ELSE 'member' END FROM unnest($2::uuid[]) id`, [community,users,users[0]]);
  const [a,b] = [users[0],users[1]].sort();
  await pool.query(`INSERT INTO social_graph.trust_edges(community_id,user_id_a,user_id_b,raw_weight) VALUES($1,$2,$3,100)`, [community,a,b]);
  return { community, users };
}

describe('Sprint 142 nomination creation using shipped SQL', () => {
  beforeEach(async () => { fixture = await memberFixture(); });
  afterEach(async () => {
    if (!fixture) return;
    await pool.query(`DELETE FROM communities.communities WHERE id=$1`, [fixture.community]);
    await pool.query(`DELETE FROM auth.users WHERE id=ANY($1::uuid[])`, [fixture.users]);
  });
  const input = (): CreateInput => ({ communityId: fixture.community, nominatorId: fixture.users[0], nominatedUserId: fixture.users[1], role: 'moderator' });

  it('stores a fixed nominee-excluding roster and gives the nominator no automatic vote', async () => {
    const result = await create(input());
    expect(result).toEqual({ id: expect.any(String), quorum_policy_version: 1, electorate_size: 4, required_ratifications: 3 });
    const roster = await pool.query(`SELECT user_id FROM communities.governance_nomination_voters WHERE nomination_id=$1`, [result.id]);
    expect(roster.rows.map(r => r.user_id).sort()).toEqual(fixture.users.filter(u => u !== fixture.users[1]).sort());
    expect((await pool.query(`SELECT * FROM communities.governance_ratifications WHERE nomination_id=$1`, [result.id])).rowCount).toBe(0);
  });

  it.each(['nominator','nominee'])('refuses inactive %s membership without a partial nomination', async (who) => {
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=$2`,
      [fixture.community,fixture.users[who === 'nominator' ? 0 : 1]]);
    await expect(create(input())).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect((await pool.query(`SELECT * FROM communities.governance_nominations WHERE community_id=$1`, [fixture.community])).rowCount).toBe(0);
  });

  it('refuses foreign/nonmember identities despite a privileged DB role', async () => {
    await expect(create({ ...input(), nominatorId: randomUUID() })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    await expect(create({ ...input(), nominatedUserId: randomUUID() })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('refuses fewer than three other voters, without capping the quorum', async () => {
    await pool.query(`UPDATE communities.members SET status='inactive' WHERE community_id=$1 AND user_id=ANY($2::uuid[])`,
      [fixture.community,fixture.users.slice(3)]);
    await expect(create(input())).rejects.toMatchObject({ status: 422, code: 'GOVERNANCE_ELECTORATE_TOO_SMALL' });
  });

  it('denies an ineligible nominee without disclosing a score', async () => {
    await pool.query(`UPDATE social_graph.trust_edges SET raw_weight=0 WHERE community_id=$1`, [fixture.community]);
    await expect(create(input())).rejects.toMatchObject({ status: 422, code: 'GOVERNANCE_ELIGIBILITY_NOT_MET' });
  });

  it('enforces duplicate creation atomically', async () => {
    const results = await Promise.allSettled([create(input()), create(input())]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const denied = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(denied.reason).toMatchObject({ status: 409, code: 'GOVERNANCE_DUPLICATE_NOMINATION' });
  });

  it.each(['admin','moderator'])('rejects a moderator nomination for an existing %s', async role => {
    await pool.query(`UPDATE communities.members SET role=$3 WHERE community_id=$1 AND user_id=$2`,
      [fixture.community,fixture.users[1],role]);
    await expect(create(input())).rejects.toMatchObject({ status: 409, code: 'GOVERNANCE_ROLE_ALREADY_HELD' });
  });
});
