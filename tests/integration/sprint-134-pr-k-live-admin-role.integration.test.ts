/**
 * Sprint 134 PR K (BUG-069, ADR-102): every admin gate PR K fixed decides from communities.members,
 * not the JWT `communities` claim. Drives the four running services against real SQL:
 *
 * - M is an active MEMBER of C whose token claims admin of C (a demoted admin) → 403;
 * - F's row in C says role 'admin' but status 'left', and the token claims admin of C (a removed admin) → 403;
 *   a helper that dropped the status filter would let F through;
 * - A is a live admin of C whose token claims NOTHING (as for an admin of a 16th community, beyond the
 *   15-entry claim) → the route's own next answer, proving the gate passed by reading the row.
 *
 * Each A row stops at the first validation or state check after its gate where one exists, so it writes
 * nothing; the rest (boost, urgent, collective link/unlink, decay config, the trust backfill) run on
 * disposable fixtures. After every refused call, a snapshot of everything any route could write is unchanged.
 * Unavailable infrastructure fails, including under CI.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 134 PR K: admin gates read live membership, not the JWT claim (BUG-069)', () => {
  const pool = createPool();
  const A = randomUUID(), M = randomUUID(), F = randomUUID(), O = randomUUID(), A2 = randomUUID();
  const C = randomUUID(), C2 = randomUUID();
  const users = [A, M, F, O, A2];
  const staleAdmin = [{ id: C, name: 'PR K C', role: 'admin' }];
  const claims: Record<string, unknown[]> = { [A]: [], [M]: staleAdmin, [F]: staleAdmin, [O]: [{ id: C, name: 'PR K C', role: 'member' }], [A2]: [] };
  const token = (id: string) => jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: claims[id] },
    process.env.JWT_SECRET || 'dev-secret-key');

  let ask: string, ownAsk: string, fusion: string, split: string, collective: string;
  const MISSING = randomUUID(); // a trust question / choice id that does not exist: the A rows stop at 404

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const call = (base: string, method: Method, path: string, body: object | undefined, as: string) => {
    const r = request(base)[method](path).set('Authorization', `Bearer ${token(as)}`);
    return body ? r.send(body) : r;
  };

  /** Everything any route in the table could write, for this fixture. */
  const snapshot = async () => {
    const q = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows;
    return {
      ask: await q('SELECT is_boosted, boosted_by, urgency FROM requests.help_requests WHERE id=$1', [ask]),
      matches: await q('SELECT responder_id FROM requests.matches WHERE request_id=$1', [ask]),
      community: await q('SELECT tags, latitude, longitude FROM communities.communities WHERE id=$1', [C]),
      fusions: await q('SELECT id, status FROM communities.fusion_proposals WHERE $1 IN (community_a_id, community_b_id) ORDER BY id', [C]),
      splits: await q('SELECT id, status FROM communities.split_proposals WHERE community_id=$1 ORDER BY id', [C]),
      links: await q('SELECT status FROM requests.collective_community_links WHERE collective_id=$1', [collective]),
      decay: await q('SELECT base_half_life_days FROM social_graph.trust_decay_config WHERE community_id=$1', [C]),
      evolution: await q('SELECT community_evolution_enabled, cross_community_prior FROM communities.community_configs WHERE community_id=$1', [C]),
      questions: await q('SELECT COUNT(*)::int AS n FROM communities.trust_questions', []),
    };
  };

  beforeAll(async () => {
    await pool.query('SELECT 1');
    for (const base of [ServiceUrls.REQUEST, ServiceUrls.COMMUNITY, ServiceUrls.REPUTATION, ServiceUrls.SOCIAL_GRAPH]) {
      expect((await request(base).get('/health')).status).toBe(200);
    }
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, `PR K ${id.slice(0, 4)}`, `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4),($5,$6,$3,$7)',
      [C, 'PR K C', 'Fixture', A, C2, 'PR K C2', A2]);
    const join = (user: string, community: string, role: string, status: string) => pool.query(
      'INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,$3,$4)', [user, community, role, status]);
    await join(A, C, 'admin', 'active'); await join(M, C, 'member', 'active'); await join(F, C, 'admin', 'left');
    await join(O, C, 'member', 'active'); await join(A2, C2, 'admin', 'active');

    const insertAsk = async (requester: string) => {
      const id = (await pool.query(`INSERT INTO requests.help_requests(requester_id,title,description,category,status)
        VALUES ($1,'PR K fixture','Fixture','generic','open') RETURNING id`, [requester])).rows[0].id as string;
      await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [id, C]);
      return id;
    };
    ask = await insertAsk(O);
    ownAsk = await insertAsk(O);
    // 'voting' stops accept/reject (need pending_acceptance), start-vote (needs discussion) and execute (needs approved).
    fusion = (await pool.query(`INSERT INTO communities.fusion_proposals(community_a_id,community_b_id,proposed_by,merged_community_name,status)
      VALUES ($1,$2,$3,'PR K merged','voting') RETURNING id`, [C2, C, A2])).rows[0].id;
    split = (await pool.query(`INSERT INTO communities.split_proposals(community_id,proposed_by,split_type,group_a_name,group_b_name,status)
      VALUES ($1,$2,'admin_initiated','PR K a','PR K b','voting') RETURNING id`, [C, A])).rows[0].id;
    collective = (await pool.query(`INSERT INTO requests.provider_collectives(name,created_by) VALUES ('PR K collective',$1) RETURNING id`, [A2])).rows[0].id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM requests.collective_community_links WHERE collective_id=$1', [collective]);
      await pool.query('DELETE FROM requests.provider_collectives WHERE id=$1', [collective]);
      await pool.query('DELETE FROM social_graph.trust_decay_config WHERE community_id=ANY($1::uuid[])', [[C, C2]]);
      await pool.query('DELETE FROM communities.fusion_proposals WHERE community_a_id=ANY($1::uuid[]) OR community_b_id=ANY($1::uuid[])', [[C, C2]]);
      await pool.query('DELETE FROM communities.split_proposals WHERE community_id=ANY($1::uuid[])', [[C, C2]]);
      await pool.query('DELETE FROM requests.matches WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[]))', [users]);
      await pool.query('DELETE FROM requests.request_communities WHERE community_id=ANY($1::uuid[])', [[C, C2]]);
      await pool.query('DELETE FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.members WHERE community_id=ANY($1::uuid[])', [[C, C2]]);
      await pool.query('DELETE FROM communities.communities WHERE id=ANY($1::uuid[])', [[C, C2]]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  // [label, service, method, path builder, body, A's status]. Paths are built lazily: fixture ids exist only after beforeAll.
  type Row = [string, string, Method, () => string, object | undefined, number];
  const rows: Row[] = [
    ['R1 admin schemas list', ServiceUrls.REQUEST, 'get', () => '/admin/schemas', undefined, 200],
    ['R2 boost', ServiceUrls.REQUEST, 'post', () => `/requests/${ask}/boost`, undefined, 200],
    ['R2 unboost', ServiceUrls.REQUEST, 'delete', () => `/requests/${ask}/boost`, undefined, 200],
    ['R2 propose-match (proposed user is not a member)', ServiceUrls.REQUEST, 'post', () => `/requests/${ask}/propose-match`, { user_id: randomUUID() }, 400],
    ['R2 urgent', ServiceUrls.REQUEST, 'patch', () => `/requests/${ask}/urgent`, { urgent: true }, 200],
    ['R3 collective link', ServiceUrls.REQUEST, 'post', () => `/collectives/${collective}/communities`, { community_id: C }, 201],
    ['R4 collective unlink', ServiceUrls.REQUEST, 'delete', () => `/collectives/${collective}/communities/${C}`, undefined, 200],
    ['C1 tags (not an array)', ServiceUrls.COMMUNITY, 'put', () => `/communities/${C}/tags`, { tags: 'x' }, 400],
    ['C2 location (lat not a number)', ServiceUrls.COMMUNITY, 'put', () => `/communities/${C}/location`, { lat: 'x', lng: 0 }, 400],
    ['C3 fusion create (missing fields)', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/fusions`, {}, 400],
    ['C3 fusion accept', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/fusions/${fusion}/accept`, undefined, 422],
    ['C3 fusion reject', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/fusions/${fusion}/reject`, undefined, 422],
    ['C3 fusion start-vote', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/fusions/${fusion}/start-vote`, undefined, 422],
    ['C3 fusion execute', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/fusions/${fusion}/execute`, undefined, 422],
    ['C4 split create (missing fields)', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/splits`, {}, 400],
    ['C4 split assignments (not an array)', ServiceUrls.COMMUNITY, 'put', () => `/communities/${C}/splits/${split}/assignments`, {}, 400],
    ['C4 split start-vote', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/splits/${split}/start-vote`, undefined, 422],
    ['C4 split execute', ServiceUrls.COMMUNITY, 'post', () => `/communities/${C}/splits/${split}/execute`, undefined, 422],
    ['C5 trust question create (missing fields)', ServiceUrls.COMMUNITY, 'post', () => '/communities/trust-questions', {}, 400],
    ['C5 trust question update', ServiceUrls.COMMUNITY, 'put', () => `/communities/trust-questions/${MISSING}`, { question_text: 'x' }, 404],
    ['C5 trust question delete', ServiceUrls.COMMUNITY, 'delete', () => `/communities/trust-questions/${MISSING}`, undefined, 404],
    ['C5 trust choice create (missing fields)', ServiceUrls.COMMUNITY, 'post', () => `/communities/trust-questions/${MISSING}/choices`, {}, 400],
    ['C5 trust choice update', ServiceUrls.COMMUNITY, 'put', () => `/communities/trust-questions/${MISSING}/choices/${MISSING}`, { label: 'x' }, 404],
    ['C5 trust choice delete', ServiceUrls.COMMUNITY, 'delete', () => `/communities/trust-questions/${MISSING}/choices/${MISSING}`, undefined, 404],
    ['P2 trust-evolution read', ServiceUrls.REPUTATION, 'get', () => `/reputation/communities/${C}/trust-evolution`, undefined, 200],
    ['P2 trust-evolution write (no valid fields)', ServiceUrls.REPUTATION, 'put', () => `/reputation/communities/${C}/trust-evolution`, {}, 400],
    ['P2 evolution history', ServiceUrls.REPUTATION, 'get', () => `/reputation/community/${C}/evolution/history`, undefined, 200],
    ['P2 evolution summary', ServiceUrls.REPUTATION, 'get', () => `/reputation/community/${C}/evolution/summary`, undefined, 200],
    ['P2 evolution toggle (enabled missing)', ServiceUrls.REPUTATION, 'put', () => `/reputation/community/${C}/evolution/toggle`, {}, 400],
    ['P1 provider trust backfill', ServiceUrls.REPUTATION, 'post', () => '/reputation/provider-trust/recalculate', undefined, 200],
    ['S1 decay config write', ServiceUrls.SOCIAL_GRAPH, 'put', () => `/trust/decay-config/${C}`, { baseHalfLifeDays: 45 }, 200],
  ];

  it('covers all 31 routes PR K fixed', () => {
    expect(rows).toHaveLength(31);
  });

  describe.each(rows)('%s', (_label, base, method, path, body, live) => {
    it.each([['M (demoted: active member, claim says admin)', M], ['F (removed: admin row with status left, claim says admin)', F]])(
      '%s → 403, nothing written', async (_who, as) => {
        const before = await snapshot();
        expect((await call(base, method, path(), body, as)).status).toBe(403);
        expect(await snapshot()).toEqual(before);
      });
    it(`A (live admin, empty claim) passes the gate → ${live}`, async () => {
      expect((await call(base, method, path(), body, A)).status).toBe(live);
    });
  });

  it('the live-admin writes landed (positive controls with side effects)', async () => {
    const [row] = (await pool.query('SELECT is_boosted, urgency FROM requests.help_requests WHERE id=$1', [ask])).rows;
    expect(row).toEqual({ is_boosted: false, urgency: 'urgent' }); // boosted, then unboosted; urgent set
    expect((await pool.query('SELECT status FROM requests.collective_community_links WHERE collective_id=$1', [collective])).rows)
      .toEqual([{ status: 'inactive' }]); // linked, then unlinked
    expect((await pool.query('SELECT base_half_life_days FROM social_graph.trust_decay_config WHERE community_id=$1', [C])).rows)
      .toEqual([{ base_half_life_days: 45 }]);
  });

  it("an admin of another community is not an admin of this request's community", async () => {
    const before = await snapshot();
    expect((await call(ServiceUrls.REQUEST, 'post', `/requests/${ask}/boost`, undefined, A2)).status).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['tags', ServiceUrls.COMMUNITY, 'put' as Method, () => '/communities/not-a-uuid/tags', { tags: ['x'] }],
    ['collective link', ServiceUrls.REQUEST, 'post' as Method, () => `/collectives/${collective}/communities`, { community_id: 'not-a-uuid' }],
  ])('a malformed community id is 403, not 500 (%s)', async (_label, base, method, path, body) => {
    expect((await call(base, method, path(), body, A)).status).toBe(403);
  });

  it('BUG-071: a requester who administers nothing reaches their own offers', async () => {
    const res = await call(ServiceUrls.REQUEST, 'get', `/requests/${ownAsk}/offers`, undefined, O);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
