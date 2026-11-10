/**
 * Sprint 139 (BUG-080, BUG-081): provider completion rates and numeric trust values against real PostgreSQL 15, and
 * the numeric routes over HTTP with a real JWT. Missing infrastructure is a failure, never a skip.
 *
 * Proofs (spec docs/superpowers/specs/2026-11-09-sprint-139-correctness-design.md, sections C and D):
 * - Completion (the real updateProviderCompletionRate): H has two completed, one cancelled, and proposed / matched /
 *   rejected / legacy-accepted matches; another responder's history is a control. Both of H's active profiles store
 *   66.67 and, with 5-star reviews and response rate 0, trust score 80. H's inactive profile gets no row.
 * - Only-cancelled -> 0, no terminal history -> 0, no profile -> nothing written.
 * - Manual backfill runs inside reputation-service's real withTransaction and reads its results back through that
 *   connection, then a sentinel error rolls everything back — including other fixtures' scores its global sweep
 *   touched. No global count is asserted.
 * - Nightly repair: N's stored rate is 100 after one completed match; a matched match is then CANCELLED (committed,
 *   no new completion). refreshAllProviderTrustScores, run inside the rollback-isolated transaction, stores 50 and
 *   recomputes the score; outside it the committed state is unchanged. The scheduler test (unit tier) proves the 03:30
 *   callback reaches this function; the global personal phase is not run against shared fixtures here.
 * - NUMERIC readers return numbers: a community weight of 0.00 stays 0, a NULL user override stays NULL, priors are
 *   numbers. Fixtures obey the CHECKs (user overrides 0.10-0.90 or NULL, priors 0.05-0.95): zero is a community
 *   weight only.
 * - HTTP: trust-config and effective-params answer numbers for the member themself and the same 404 for another
 *   user or a non-member; trust-evolution answers a numeric prior to a live admin and 403 to a member.
 *
 * Fails before (REASONED, not run: no PostgreSQL on the Windows box; CI runs this against the fixed code).
 * - Completion: the old denominator was status IN ('accepted', 'completed'), so H stores 75 (3/4, the legacy
 *   'accepted' row counted, the cancellation not) and only-cancelled stores 0 by accident; N stays 100 after the
 *   cancellation, since nothing refreshed it and refreshAllProviderTrustScores did not exist.
 * - Numeric: every NUMERIC came back as a string, so each typeof assertion fails.
 * - Controls that pass before too: no profile, the inactive profile, the other responder, the denials.
 */
import { Pool } from 'pg';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { ServiceUrls } from '../fixtures';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://karmyq_test:test_password@localhost:5433/karmyq_test';
process.env.DATABASE_URL = DATABASE_URL; // before the first reputation-service import

/** One module instance for the whole file (see sprint-126-standing-backfill.integration.test.ts on leaked pools). */
const repDb = () => require('../../services/reputation-service/src/database/db');
const providers = () => require('../../services/reputation-service/src/services/providerTrustService');
const configDb = () => require('../../services/reputation-service/src/database/trustConfigDb');
const evolutionDb = () => require('../../services/reputation-service/src/database/trustEvolutionDb');

describe('Sprint 139 trust correctness (BUG-080, BUG-081)', () => {
  const pool = new Pool({ connectionString: DATABASE_URL });
  // H: the provider under test. O: another responder (control). CO: only cancellations. NT: no terminal outcome.
  // NP: no provider profile. N: the nightly-repair provider. Q: requester. RV: reviewer. M: a plain member of C.
  // X: a user outside C.
  const H = randomUUID(), O = randomUUID(), CO = randomUUID(), NT = randomUUID(), NP = randomUUID(), N = randomUUID();
  const Q = randomUUID(), RV = randomUUID(), M = randomUUID(), X = randomUUID();
  const users = [H, O, CO, NT, NP, N, Q, RV, M, X];
  const C = randomUUID();
  const asks: string[] = [];
  const profiles: Record<string, string> = {};
  const ownedProfiles = () => Object.values(profiles);

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  const get = (path: string, as: string) => request(ServiceUrls.REPUTATION).get(path).set('Authorization', bearer(as));

  async function matchFor(responder: string, status: string): Promise<string> {
    const ask = randomUUID();
    const askStatus = status === 'completed' ? 'completed' : status === 'matched' ? 'matched' : 'open';
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status,expired,expires_at)
      VALUES ($1,$2,'Sprint 139 ask','Fixture','generic','generic','community',$3::varchar,FALSE,NOW() + INTERVAL '1 day')`,
    [ask, Q, askStatus]);
    asks.push(ask);
    const { rows } = await pool.query(`INSERT INTO requests.matches (request_id,responder_id,status,completed_at)
      VALUES ($1,$2,$3::varchar,CASE WHEN $3::varchar = 'completed' THEN CURRENT_TIMESTAMP END) RETURNING id`,
    [ask, responder, status]);
    return rows[0].id;
  }
  async function profile(name: string, owner: string, serviceType: string, active = true) {
    const id = randomUUID();
    await pool.query(`INSERT INTO requests.provider_profiles (id,user_id,service_type,display_name,is_active)
      VALUES ($1,$2,$3,$4,$5)`, [id, owner, serviceType, `Sprint 139 ${name}`, active]);
    profiles[name] = id;
    return id;
  }
  const fiveStars = (providerId: string) =>
    pool.query('INSERT INTO reputation.provider_reviews (provider_id,reviewer_id,stars) VALUES ($1,$2,5)', [providerId, RV]);
  /** The committed score row, numbers parsed here (the column type is NUMERIC; this is the fixture's own read). */
  async function stored(providerId: string) {
    const { rows } = await pool.query(
      'SELECT completion_rate::float8 AS rate, trust_score FROM reputation.provider_trust_scores WHERE provider_id = $1', [providerId]);
    return rows[0] ? { rate: rows[0].rate, score: rows[0].trust_score } : null;
  }

  beforeAll(async () => {
    await pool.query('SELECT 1');
    expect((await request(ServiceUrls.REPUTATION).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
        [id, `Sprint 139 ${id.slice(0, 8)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)',
      [C, `Sprint 139 ${C}`, 'Fixture', H]);
    await pool.query(`INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'admin','active'),($3,$2,'member','active')`,
      [H, C, M]);
    // Zero only as a COMMUNITY weight; the prior inside its CHECK.
    await pool.query(`INSERT INTO communities.community_configs (community_id, trust_depth_weight, trust_breadth_weight, cross_community_prior)
      VALUES ($1, 0.00, 1.00, 0.65)
      ON CONFLICT (community_id) DO UPDATE SET trust_depth_weight = 0.00, trust_breadth_weight = 1.00, cross_community_prior = 0.65`, [C]);
    // A legal user override (0.10-0.90), a NULL (inherit), a legal prior (0.05-0.95).
    await pool.query(`INSERT INTO reputation.user_trust_configs (user_id, community_id, depth_weight, breadth_weight, cross_community_prior)
      VALUES ($1, $2, 0.25, NULL, 0.55)`, [H, C]);

    for (const s of ['completed', 'completed', 'cancelled', 'proposed', 'matched', 'rejected', 'accepted']) await matchFor(H, s);
    for (const s of ['completed', 'completed', 'completed']) await matchFor(O, s);
    for (const s of ['cancelled', 'cancelled']) await matchFor(CO, s);
    for (const s of ['proposed', 'matched']) await matchFor(NT, s);

    await fiveStars(await profile('h-tutoring', H, 'tutoring'));
    await fiveStars(await profile('h-repairs', H, 'repairs'));
    await profile('h-moving-inactive', H, 'moving', false);
    await profile('o-cooking', O, 'cooking');
    await profile('co-garden', CO, 'gardening');
    await profile('nt-pets', NT, 'pet_care');
    await fiveStars(await profile('n-rides', N, 'transportation'));
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM requests.matches WHERE request_id = ANY($1::uuid[])', [asks]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = ANY($1::uuid[])', [asks]);
      // provider_trust_scores and provider_reviews cascade from provider_profiles.
      await pool.query('DELETE FROM requests.provider_profiles WHERE id = ANY($1::uuid[])', [ownedProfiles()]);
      await pool.query('DELETE FROM reputation.user_trust_configs WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.community_configs WHERE community_id = $1', [C]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = $1', [C]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally {
      await pool.end();
      await repDb().default.end().catch(() => undefined);
      const { disconnectEffectiveParamsCache } = require('../../services/reputation-service/src/services/effectiveParamsCache');
      await disconnectEffectiveParamsCache().catch(() => undefined);
    }
  }, 120_000);

  describe('completion rate = completed / (completed + cancelled)', () => {
    it('H: both active profiles store 66.67 and score 80; the inactive profile gets no row', async () => {
      await providers().updateProviderCompletionRate(H);
      expect(await stored(profiles['h-tutoring'])).toEqual({ rate: 66.67, score: 80 });
      expect(await stored(profiles['h-repairs'])).toEqual({ rate: 66.67, score: 80 });
      expect(await stored(profiles['h-moving-inactive'])).toBeNull();
    });

    it('the other responder\'s three completions did not leak into H, and its own rate is 100', async () => {
      await providers().updateProviderCompletionRate(O);
      expect((await stored(profiles['o-cooking']))?.rate).toBe(100);
      expect((await stored(profiles['h-tutoring']))?.rate).toBe(66.67);
    });

    it.each([
      ['only cancellations', () => CO, 'co-garden'],
      ['no terminal outcome', () => NT, 'nt-pets'],
    ])('%s -> 0', async (_l, who, name) => {
      await providers().updateProviderCompletionRate(who());
      expect((await stored(profiles[name]))?.rate).toBe(0);
    });

    it('a user with no provider profile writes nothing', async () => {
      await expect(providers().updateProviderCompletionRate(NP)).resolves.toBeUndefined();
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM requests.provider_profiles WHERE user_id = $1', [NP]);
      expect(rows[0].n).toBe(0);
    });
  });

  /** Run `work` in reputation-service's real transaction, read inside it, then roll it all back with a sentinel. */
  async function insideRolledBack<T>(work: () => Promise<T>): Promise<T> {
    const SENTINEL = new Error('sprint-139 sentinel rollback');
    let seen: T | undefined;
    await expect(repDb().withTransaction(async () => {
      seen = await work();
      throw SENTINEL;
    })).rejects.toBe(SENTINEL);
    return seen as T;
  }
  /** Read through reputation-service's own query(): inside withTransaction that is the transaction's connection. */
  async function readThrough(providerId: string) {
    const { rows } = await repDb().query(
      'SELECT completion_rate::float8 AS rate, trust_score FROM reputation.provider_trust_scores WHERE provider_id = $1', [providerId]);
    return rows[0] ? { rate: rows[0].rate, score: rows[0].trust_score } : null;
  }

  describe('manual backfill, rolled back', () => {
    it('rates H\'s profiles inside the transaction; afterwards every write is gone', async () => {
      await pool.query('UPDATE reputation.provider_trust_scores SET completion_rate = 1, trust_score = 1 WHERE provider_id = $1',
        [profiles['h-repairs']]);
      const before = await stored(profiles['h-repairs']);
      expect(before).toEqual({ rate: 1, score: 1 });

      const inside = await insideRolledBack(async () => {
        await providers().backfillAllProviderTrustScores();
        return { tutoring: await readThrough(profiles['h-tutoring']), repairs: await readThrough(profiles['h-repairs']),
          inactive: await readThrough(profiles['h-moving-inactive']) };
      });
      expect(inside).toEqual({ tutoring: { rate: 66.67, score: 80 }, repairs: { rate: 66.67, score: 80 }, inactive: null });
      expect(await stored(profiles['h-repairs'])).toEqual(before); // rolled back
    });
  });

  describe('the nightly provider sweep repairs a cancellation that refreshed nothing', () => {
    it('N reads 100 after one completion; after a committed cancellation the sweep stores 50', async () => {
      await matchFor(N, 'completed');
      const pending = await matchFor(N, 'matched');
      await providers().updateProviderCompletionRate(N);
      const afterCompletion = await stored(profiles['n-rides']);
      expect(afterCompletion).toEqual({ rate: 100, score: 90 });

      await pool.query(`UPDATE requests.matches SET status = 'cancelled' WHERE id = $1`, [pending]); // committed, no completion
      expect(await stored(profiles['n-rides'])).toEqual(afterCompletion); // nothing refreshed it

      const inside = await insideRolledBack(async () => {
        // Inside one transaction a failed profile aborts it (25P02) and every later read would fail with that instead;
        // assert no failure first so a real one is reported as itself.
        const { failed } = await providers().refreshAllProviderTrustScores();
        expect(failed).toBe(0);
        return { n: await readThrough(profiles['n-rides']), o: await readThrough(profiles['o-cooking']),
          inactive: await readThrough(profiles['h-moving-inactive']) };
      });
      expect(inside.n).toEqual({ rate: 50, score: 75 });
      expect(inside.o?.rate).toBe(100);
      expect(inside.inactive).toBeNull();
      expect(await stored(profiles['n-rides'])).toEqual(afterCompletion); // rolled back
    });
  });

  describe('NUMERIC readers return numbers', () => {
    it('community weights: 0.00 stays the number 0', async () => {
      const c = await configDb().getCommunityTrustConfig(C);
      expect({ depth: c.depth_weight, breadth: c.breadth_weight }).toEqual({ depth: 0, breadth: 1 });
      expect([typeof c.depth_weight, typeof c.breadth_weight]).toEqual(['number', 'number']);
    });

    it('user overrides: a number or NULL (inherit); the prior is a number', async () => {
      const u = await evolutionDb().getUserTrustConfig(H, C);
      expect(u).toEqual(expect.objectContaining({ depth_weight: 0.25, breadth_weight: null, cross_community_prior: 0.55 }));
      expect([typeof u.depth_weight, typeof u.cross_community_prior]).toEqual(['number', 'number']);
    });

    it('the community evolution prior is a number', async () => {
      const e = await evolutionDb().getCommunityEvolutionConfig(C);
      expect(e.cross_community_prior).toBe(0.65);
    });
  });

  describe('the numeric routes over HTTP', () => {
    const DENIAL = { success: false, message: 'Reputation not found', error: 'REPUTATION_NOT_FOUND' };

    it('trust-config: numbers for the member themself, NULL override kept', async () => {
      const res = await get(`/reputation/trust-config/${H}/${C}`, H);
      expect(res.status).toBe(200);
      expect(res.body.data.user_config).toEqual(expect.objectContaining({ depth_weight: 0.25, breadth_weight: null, cross_community_prior: 0.55 }));
      // depth: the user's 0.25; breadth: inherits the community's 1.00; prior: the user's 0.55.
      expect(res.body.data.effective_params).toEqual({ depth_weight: 0.25, breadth_weight: 1, cross_community_prior: 0.55 });
    });

    it('effective-params: three numbers for the member themself', async () => {
      const res = await get(`/reputation/users/${H}/effective-params?communityId=${C}`, H);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ depth_weight: 0.25, breadth_weight: 1, cross_community_prior: 0.55 });
    });

    it.each([
      ['another user', () => M],
      ['a non-member', () => X],
    ])('trust-config and effective-params deny %s with the same 404 body', async (_l, as) => {
      const viewer = as();
      const path = viewer === M ? H : viewer; // M asks about H; X asks about themself in a community they are not in
      for (const res of [await get(`/reputation/trust-config/${path}/${C}`, viewer),
        await get(`/reputation/users/${path}/effective-params?communityId=${C}`, viewer)]) {
        expect({ status: res.status, body: res.body }).toEqual({ status: 404, body: DENIAL });
      }
    });

    it('trust-evolution: a live admin sees a numeric prior; a member is refused', async () => {
      const admin = await get(`/reputation/communities/${C}/trust-evolution`, H);
      expect(admin.status).toBe(200);
      expect(admin.body.data.cross_community_prior).toBe(0.65);
      expect((await get(`/reputation/communities/${C}/trust-evolution`, M)).status).toBe(403);
    });
  });
});
