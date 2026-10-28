/**
 * Sprint 134 PR B: GET /requests/:id lists viewer_partners, the viewer's completed exchanges on an ask,
 * and the request page closes them out with a rating and a vouch. Real JWT, request, reputation and
 * auth services over HTTP, real PostgreSQL. Missing infrastructure is a failure, never a skip.
 *
 * Proofs: (1) the exposure matrix: read permission is not partner status, so a rejected helper, the
 * preferred provider and a plain member read the ask and get []; (2) the panel's exact rating payload
 * is accepted by POST /reputation/feedback and flips only the rater's rated_by_me; (3) the vouch row's
 * source flag (can_endorse from GET /auth/skills/users/:id) agrees with POST /auth/skills/endorsements
 * both ways.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 134 PR B viewer_partners (vouch from a completed exchange)', () => {
  const pool = createPool();
  // R requester; A and B completed helpers (B more recent); C rejected helper; P preferred provider;
  // M same-community member; X member of another community.
  const R = randomUUID(), A = randomUUID(), B = randomUUID(), C = randomUUID();
  const P = randomUUID(), M = randomUUID(), X = randomUUID();
  const Cm = randomUUID(), OTHER = randomUUID();
  const users = [R, A, B, C, P, M, X];
  const names: Record<string, string> = { [R]: 'S134 Rae', [A]: 'S134 Ari', [B]: 'S134 Bea', [C]: 'S134 Cal',
    [P]: 'S134 Pia', [M]: 'S134 Max', [X]: 'S134 Xan' };
  const Q = randomUUID(), providerProfile = randomUUID(), bSkill = randomUUID();
  let matchA: string, matchB: string;

  const bearer = (id: string) => `Bearer ${jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: [] }, process.env.JWT_SECRET || 'dev-secret-key')}`;
  const detail = (id: string) => request(ServiceUrls.REQUEST).get(`/requests/${Q}`).set('Authorization', bearer(id));
  const skillsOf = (viewer: string, owner: string) => request(ServiceUrls.AUTH)
    .get(`/auth/skills/users/${owner}`).set('Authorization', bearer(viewer));
  const endorse = (viewer: string, tag_id: string) => request(ServiceUrls.AUTH)
    .post('/auth/skills/endorsements').set('Authorization', bearer(viewer)).send({ tag_id });
  const partnerIds = (res: request.Response) => res.body.data.viewer_partners.map((p: any) => p.user_id);

  beforeAll(async () => {
    await pool.query('SELECT 1');
    for (const url of [ServiceUrls.REQUEST, ServiceUrls.AUTH, ServiceUrls.REPUTATION]) {
      expect((await request(url).get('/health')).status).toBe(200);
    }
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, names[id], `${id}@karmyq.test`, 'not-a-login']);
    }
    for (const id of [Cm, OTHER]) {
      await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [id, `S134 PR B ${id}`, 'Fixture', R]);
    }
    for (const id of [R, A, B, C, P, M]) {
      await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, Cm]);
    }
    await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [X, OTHER]);
    await pool.query(`INSERT INTO requests.provider_profiles(id,user_id,service_type,display_name)
      VALUES ($1,$2,'handyman','S134 Pia services')`, [providerProfile, P]);
    await pool.query(`INSERT INTO requests.help_requests
      (id,requester_id,title,description,category,request_type,visibility_scope,status,preferred_provider_id)
      VALUES ($1,$2,'Hang a fan','Fixture','generic','generic','community','completed',$3)`, [Q, R, providerProfile]);
    await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [Q, Cm]);
    // Literal statuses only: no parameter is compared with requests.matches.status here.
    matchA = (await pool.query(`INSERT INTO requests.matches(request_id,responder_id,status,completed_at)
      VALUES ($1,$2,'completed',NOW() - INTERVAL '2 hours') RETURNING id`, [Q, A])).rows[0].id;
    matchB = (await pool.query(`INSERT INTO requests.matches(request_id,responder_id,status,completed_at)
      VALUES ($1,$2,'completed',NOW() - INTERVAL '1 hour') RETURNING id`, [Q, B])).rows[0].id;
    await pool.query("INSERT INTO requests.matches(request_id,responder_id,status) VALUES ($1,$2,'rejected')", [Q, C]);
    await pool.query("INSERT INTO auth.user_tags(id,user_id,tag_type,tag_value) VALUES ($1,$2,'skill','S134 Carpentry')", [bSkill, B]);
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM social_graph.trust_edges WHERE user_id_a = ANY($1::uuid[]) OR user_id_b = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM auth.skill_endorsements WHERE endorser_id = ANY($1::uuid[]) OR endorsee_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM feedback.feedback WHERE from_user_id = ANY($1::uuid[])', [users]);
      // trust_scores.community_id has no ON DELETE CASCADE: clear it before the communities go.
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM auth.user_tags WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.matches WHERE request_id = $1', [Q]);
      await pool.query('DELETE FROM requests.request_communities WHERE request_id = $1', [Q]);
      await pool.query('DELETE FROM requests.help_requests WHERE id = $1', [Q]);
      await pool.query('DELETE FROM requests.provider_profiles WHERE id = $1', [providerProfile]);
      await pool.query('DELETE FROM communities.members WHERE user_id = ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.communities WHERE id = ANY($1::uuid[])', [[Cm, OTHER]]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  describe('exposure matrix', () => {
    it('gives the requester every completed helper, newest first, with rating facts', async () => {
      const res = await detail(R);
      expect(res.status).toBe(200);
      expect(partnerIds(res)).toEqual([B, A]);
      expect(res.body.data.viewer_partners.map((p: any) => p.match_id)).toEqual([matchB, matchA]);
      expect(res.body.data.viewer_partners.map((p: any) => p.name)).toEqual(['S134 Bea', 'S134 Ari']);
      for (const p of res.body.data.viewer_partners) {
        expect(p.rated_by_me).toBe(false);
        expect(p.rating_community_id).toBe(Cm);
      }
    });

    it('gives each completed helper only the requester, never the other helper', async () => {
      const a = await detail(A);
      const b = await detail(B);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(partnerIds(a)).toEqual([R]);
      expect(a.body.data.viewer_partners[0]).toEqual(expect.objectContaining({ match_id: matchA, name: 'S134 Rae' }));
      expect(partnerIds(b)).toEqual([R]);
      expect(b.body.data.viewer_partners[0].match_id).toBe(matchB);
    });

    it.each([
      ['a rejected helper', C],
      ['the preferred provider', P],
      ['a same-community member', M],
    ])('lets %s read the ask but lists no partner', async (_who, viewer) => {
      const res = await detail(viewer);
      expect(res.status).toBe(200);
      expect(res.body.data.viewer_partners).toEqual([]);
    });

    it('keeps the read boundary: a member of another community gets 404', async () => {
      expect((await detail(X)).status).toBe(404);
    });
  });

  describe("the panel's rating payload through the real write path", () => {
    it('accepts the exact payload and flips only the rater\'s rated_by_me', async () => {
      const rated = await request(ServiceUrls.REPUTATION).post('/reputation/feedback').set('Authorization', bearer(A))
        .send({ match_id: matchA, to_user_id: R, community_id: Cm, rating: 5 });
      expect(rated.status).toBe(200);

      const a = await detail(A);
      expect(a.body.data.viewer_partners).toEqual([expect.objectContaining({ match_id: matchA, rated_by_me: true })]);
      const r = await detail(R);
      expect(r.body.data.viewer_partners.map((p: any) => [p.match_id, p.rated_by_me])).toEqual([[matchB, false], [matchA, false]]);
    });
  });

  describe('vouch eligibility agrees with the listing', () => {
    it('lets the requester vouch for a listed partner: can_endorse true and POST 201', async () => {
      const view = await skillsOf(R, B);
      expect(view.status).toBe(200);
      expect(view.body.data.find((s: any) => s.tag_id === bSkill)).toEqual(expect.objectContaining({ can_endorse: true, endorsed_by_me: false }));
      expect((await endorse(R, bSkill)).status).toBe(201);
    });

    it('refuses a non-partner member both ways: can_endorse false and POST 404', async () => {
      const view = await skillsOf(M, B);
      expect(view.status).toBe(200);
      expect(view.body.data.find((s: any) => s.tag_id === bSkill)).toEqual(expect.objectContaining({ can_endorse: false }));
      expect((await endorse(M, bSkill)).status).toBe(404);
    });

    it("gives another helper on the same ask no vouch for B: can_endorse false", async () => {
      const view = await skillsOf(A, B);
      expect(view.status).toBe(200);
      expect(view.body.data.find((s: any) => s.tag_id === bSkill)).toEqual(expect.objectContaining({ can_endorse: false }));
    });
  });
});
