/**
 * Sprint 134 PR A: BUG-063. The three community export routes 500'd for everyone: they named a schema
 * (`community`) and nine columns that do not exist. This drives the running community-service against
 * real SQL: every section of the full export by exact id set, a second community D that must never leak
 * into C's export, the admin gate read from communities.members (not the JWT claim) on all three routes,
 * exact activity counts, and a date-filtered export (the filter was an ambiguous column in joined queries).
 * Unavailable infrastructure fails, including under CI.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createPool, ServiceUrls } from '../fixtures';

describe('Sprint 134 PR A community export against the live schema (BUG-063)', () => {
  const pool = createPool();
  // C: A active admin, M active member, F former admin (left) whose JWT claim still says admin of C.
  // D: AD active admin, MD active member. X belongs to neither.
  const A = randomUUID(), M = randomUUID(), F = randomUUID(), X = randomUUID(), AD = randomUUID(), MD = randomUUID();
  const C = randomUUID(), D = randomUUID();
  const users = [A, M, F, X, AD, MD];
  const names: Record<string, string> = {
    [A]: 'Export A', [M]: 'Export M', [F]: 'Export F', [X]: 'Export X', [AD]: 'Export AD', [MD]: 'Export MD',
  };
  const claims: Record<string, Array<{ id: string; name: string; role: string }>> = {
    [F]: [{ id: C, name: 'Export C', role: 'admin' }],
  };
  const token = (id: string) => jwt.sign({ userId: id, email: `${id}@karmyq.test`, communities: claims[id] ?? [] },
    process.env.JWT_SECRET || 'dev-secret-key');
  const get = (id: string, url: string) =>
    request(ServiceUrls.COMMUNITY).get(url).set('Authorization', `Bearer ${token(id)}`);
  const ids = (rows: Array<{ id: string }>) => rows.map(r => r.id).sort();

  const asks: Record<string, string> = {};
  const matches: Record<string, string> = {};
  let normC: string;

  const insertAsk = async (requester: string, communities: string[], extra: { status?: string; directedTo?: string } = {}) => {
    const row = (await pool.query(`INSERT INTO requests.help_requests
      (requester_id,title,description,category,status,is_directed,directed_to_community_id)
      VALUES ($1,'Export fixture','Fixture','generic',$2,$3,$4) RETURNING id`,
    [requester, extra.status ?? 'open', extra.directedTo != null, extra.directedTo ?? null])).rows[0];
    for (const community of communities) {
      await pool.query('INSERT INTO requests.request_communities(request_id,community_id) VALUES ($1,$2)', [row.id, community]);
    }
    return row.id as string;
  };
  const insertMatch = async (ask: string, responder: string, status: 'completed' | 'proposed') =>
    (await pool.query(`INSERT INTO requests.matches(request_id,responder_id,status,completed_at)
      VALUES ($1,$2,$3,${status === 'completed' ? 'NOW()' : 'NULL'}) RETURNING id`, [ask, responder, status])).rows[0].id as string;
  const insertNorm = async (community: string, creator: string, approvers: string[]) => {
    const id = (await pool.query(`INSERT INTO communities.norms(community_id,description,created_by,status)
      VALUES ($1,'Export fixture norm',$2,'approved') RETURNING id`, [community, creator])).rows[0].id as string;
    for (const approver of approvers) {
      await pool.query('INSERT INTO communities.norm_approvals(norm_id,approved_by) VALUES ($1,$2)', [id, approver]);
    }
    return id;
  };

  beforeAll(async () => {
    await pool.query('SELECT 1'); expect((await request(ServiceUrls.COMMUNITY).get('/health')).status).toBe(200);
    for (const id of users) {
      await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, names[id], `${id}@karmyq.test`, 'not-a-login']);
    }
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4),($5,$6,$3,$7)',
      [C, 'Export C', 'Fixture', A, D, 'Export D', AD]);
    const join = (user: string, community: string, role: string, status: string) => pool.query(
      'INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,$3,$4)', [user, community, role, status]);
    await join(A, C, 'admin', 'active'); await join(M, C, 'member', 'active'); await join(F, C, 'admin', 'left');
    await join(AD, D, 'admin', 'active'); await join(MD, D, 'member', 'active');

    asks.completed = await insertAsk(M, [C], { status: 'completed' });
    asks.proposed = await insertAsk(M, [C]);
    asks.both = await insertAsk(M, [C, D]);
    asks.directed = await insertAsk(M, [C], { directedTo: C });
    asks.dOnly = await insertAsk(MD, [D], { status: 'completed' });
    matches.completed = await insertMatch(asks.completed, A, 'completed');
    // A proposed (not completed) match: listed in the export, never counted as a help given.
    matches.proposed = await insertMatch(asks.proposed, A, 'proposed');
    matches.dOnly = await insertMatch(asks.dOnly, AD, 'completed');

    normC = await insertNorm(C, A, [A, M]);
    await insertNorm(D, AD, [AD]);
    await pool.query('INSERT INTO communities.settings(community_id,request_ttl_days) VALUES ($1,11),($2,22)', [C, D]);
    // Two karma participants in C: below the ADR-082 cohort of five, so the summary must be absent.
    await pool.query(`INSERT INTO reputation.karma_records(user_id,community_id,points,reason)
      VALUES ($1,$3,10,'export fixture'),($2,$3,5,'export fixture')`, [A, M, C]);
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM reputation.karma_records WHERE community_id=ANY($1::uuid[])', [[C, D]]);
      await pool.query('DELETE FROM requests.matches WHERE request_id IN (SELECT id FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])) OR responder_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM requests.request_communities WHERE community_id=ANY($1::uuid[])', [[C, D]]);
      await pool.query('DELETE FROM requests.help_requests WHERE requester_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM communities.norms WHERE community_id=ANY($1::uuid[])', [[C, D]]);
      await pool.query('DELETE FROM communities.settings WHERE community_id=ANY($1::uuid[])', [[C, D]]);
      await pool.query('DELETE FROM communities.members WHERE community_id=ANY($1::uuid[])', [[C, D]]);
      await pool.query('DELETE FROM communities.communities WHERE id=ANY($1::uuid[])', [[C, D]]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  const expectFullExport = (data: any) => {
    expect(data.community.id).toBe(C);
    expect(data.members.map((m: { user_id: string }) => m.user_id).sort()).toEqual([A, M, F].sort());
    expect(ids(data.requests)).toEqual([asks.completed, asks.proposed, asks.both].sort());
    expect(ids(data.matches)).toEqual([matches.completed, matches.proposed].sort());
    expect(data.norms.map((n: { id: string; approval_count: number }) => [n.id, n.approval_count])).toEqual([[normC, 2]]);
    expect(Object.keys(data.settings).sort()).toEqual([
      'activity_types', 'message_ttl_days', 'notification_ttl_days', 'offer_ttl_days',
      'reputation_half_life_months', 'request_ttl_days', 'updated_at',
    ]);
    expect(data.settings.request_ttl_days).toBe(11);
    expect(data).not.toHaveProperty('community_reputation_summary');
  };

  it('exports every section of C, exactly, to C\'s active admin', async () => {
    const res = await get(A, `/communities/${C}/export?format=json`);
    expect(res.status).toBe(200);
    expectFullExport(res.body.data);
  });

  it('applies a date filter in every joined query without hiding rows', async () => {
    const res = await get(A, `/communities/${C}/export?format=json&date_start=2000-01-01`);
    expect(res.status).toBe(200);
    expectFullExport(res.body.data);
  });

  it.each([
    ['a plain member', 'M'], ['a non-member', 'X'], ['a former admin with a stale admin claim', 'F'], ['another community\'s admin', 'AD'],
  ])('refuses %s on all three routes', async (_label, who) => {
    const viewer = { M, X, F, AD }[who as 'M' | 'X' | 'F' | 'AD'];
    const statuses = [];
    for (const path of ['export', 'export/members', 'export/activity']) {
      statuses.push((await get(viewer, `/communities/${C}/${path}`)).status);
    }
    expect(statuses).toEqual([403, 403, 403]);
  });

  it('exports the member roster as CSV and JSON', async () => {
    const csv = await get(A, `/communities/${C}/export/members`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/^text\/csv/);
    const lines = csv.text.split('\n');
    expect(lines[0]).toBe('Name,Email,Role,Status,Joined Date');
    expect(lines).toHaveLength(4);

    const json = await get(A, `/communities/${C}/export/members?format=json`);
    expect(json.status).toBe(200);
    expect(json.body.data.map((r: { Name: string }) => r.Name).sort()).toEqual(['Export A', 'Export F', 'Export M']);
  });

  it('reports exact activity counts for C\'s active members, alphabetically, with no reputation', async () => {
    const res = await get(A, `/communities/${C}/export/activity?format=json`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { Member: 'Export A', 'Helps Given': 1, 'Helps Received': 0, 'Requests Created': 0, 'Requests Completed': 0 },
      { Member: 'Export M', 'Helps Given': 0, 'Helps Received': 1, 'Requests Created': 3, 'Requests Completed': 1 },
    ]);
  });
});
