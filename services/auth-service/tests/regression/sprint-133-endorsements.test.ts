import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Sprint 133 PR B: endorsement routes through the real auth mount and JWT middleware. The pg Pool and the
// Bull queue are the external boundary; db.ts (query, withTransaction), the routes, SQL builders and the
// event module are real.
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: (...args: unknown[]) => mockQuery(...args),
    connect: async () => ({ query: (...args: unknown[]) => mockClientQuery(...args), release: mockRelease }),
  })),
}));
jest.mock('../../src/events/publisher', () => ({ initEventPublisher: async () => {}, publishEvent: jest.fn() }));
const mockAdd = jest.fn();
const mockQueueNames: string[] = [];
jest.mock('bull', () => jest.fn().mockImplementation((name: string) => {
  mockQueueNames.push(name);
  return { add: (...args: unknown[]) => mockAdd(...args), on: jest.fn() };
}));

const CALLER = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const TAG = '44444444-4444-4444-8444-444444444444';
const ROW = '55555555-5555-4555-8555-555555555555';
const OTHER_ENDORSER = '77777777-7777-4777-8777-777777777777';
const ROW_2 = '88888888-8888-4888-8888-888888888888';
const CREATED = '2026-10-13T00:00:00.000Z';
let app: express.Express;
const token = (userId = CALLER) => `Bearer ${jwt.sign({ userId, email: 'caller@example.test', communities: [] }, process.env.JWT_SECRET!)}`;
const post = (body: unknown) => request(app).post('/auth/skills/endorsements').set('Authorization', token()).send(body as object);
const del = (tagId = TAG) => request(app).delete(`/auth/skills/endorsements/${tagId}`).set('Authorization', token());
const stableError = (res: request.Response) => ({ success: res.body.success, error: res.body.error, message: res.body.message });

type Row = Record<string, unknown>;
/** Route SQL by intent: the self check, the gated upsert, the gated existing-row read, the withdrawal. */
function db(opts: { own?: boolean; upsert?: Row[]; existing?: Row[]; withdraw?: Row[] } = {}) {
  mockQuery.mockImplementation(async (sql: string) => {
    const rows = /INSERT INTO auth\.skill_endorsements/.test(sql) ? opts.upsert ?? []
      : /UPDATE auth\.skill_endorsements/.test(sql) ? opts.withdraw ?? []
      : /FROM auth\.skill_endorsements/.test(sql) ? opts.existing ?? []
      : /FROM auth\.user_tags/.test(sql) && /user_id = \$2/.test(sql) ? (opts.own ? [{ own: true }] : [])
      : [];
    return { rows, rowCount: rows.length };
  });
}
const sqlOf = (re: RegExp) => mockQuery.mock.calls.filter(([sql]) => re.test(String(sql)));

beforeAll(async () => {
  process.env.RATE_LIMIT_DISABLED = 'true';
  const booted = new Promise<express.Express>(resolve => {
    jest.spyOn(express.application, 'listen').mockImplementation(function (this: express.Express) {
      resolve(this);
      return {} as any;
    } as any);
  });
  require('../../src/index');
  app = await booted;
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockRelease.mockReset();
  mockAdd.mockReset();
  mockAdd.mockResolvedValue({});
  db();
});

describe('POST /auth/skills/endorsements', () => {
  it('requires a JWT before any DB access', async () => {
    const res = await request(app).post('/auth/skills/endorsements').send({ tag_id: TAG });
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each([{}, { tag_id: 'not-a-uuid' }, { tag_id: 7 }])('rejects body %j with 400 before querying', async body => {
    expect((await post(body)).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects endorsing your own skill with 400; the writing statement itself excludes self', async () => {
    db({ own: true });
    const res = await post({ tag_id: TAG });
    expect(res.status).toBe(400);
    const [[insertSql]] = sqlOf(/INSERT INTO auth\.skill_endorsements/);
    expect(insertSql).toContain('u.id <> $2::uuid');
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('gives no completed match, a hidden tag and a missing tag the same 404 (no existence oracle)', async () => {
    const res = await post({ tag_id: TAG });
    const unknown = await post({ tag_id: '99999999-9999-4999-8999-999999999999' });
    expect(res.status).toBe(404);
    expect(stableError(res)).toEqual(stableError(unknown));
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('gates the write in ONE statement: visibility predicate, completed match, caller bound as a parameter', async () => {
    await post({ tag_id: TAG });
    const [[sql, params]] = sqlOf(/INSERT INTO auth\.skill_endorsements/);
    expect(sql).toContain('/* skill-visible */');
    expect(sql).toContain('requests.matches');
    expect(sql).toMatch(/status = 'completed'/);
    expect(sql).toContain('requests.help_requests');
    expect(sql).toMatch(/withdrawn_at IS NOT NULL/);
    expect(sql).toMatch(/revision = (?:auth\.)?skill_endorsements\.revision \+ 1/);
    expect(sql).not.toContain(CALLER);
    expect(params).toEqual([TAG, CALLER]);
    // The existing-row read is gated by the same eligibility, so a 200 cannot leak a hidden tag.
    const [[existingSql]] = sqlOf(/FROM auth\.skill_endorsements/).filter(([s]) => !/INSERT/.test(String(s)));
    expect(existingSql).toContain('/* skill-visible */');
    expect(existingSql).toMatch(/status = 'completed'/);
  });

  it('first endorsement: 201, the documented shape, and exactly one event with job id endorsement-<id>-r1', async () => {
    db({ upsert: [{ id: ROW, tag_id: TAG, endorsee_id: OWNER, created_at: CREATED, revision: 1, inserted: true }] });
    const res = await post({ tag_id: TAG });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: ROW, tag_id: TAG, endorsee_id: OWNER, created_at: CREATED });
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const [name, data, options] = mockAdd.mock.calls[0];
    expect(name).toBe('skill_endorsement_changed');
    expect(data.payload).toEqual({ endorser_id: CALLER, endorsee_id: OWNER, job_id: `endorsement-${ROW}-r1` });
    expect(options).toEqual({ jobId: `endorsement-${ROW}-r1` });
  });

  it('repeat endorsement of an active row: 200 no-op, no event, the existing row returned', async () => {
    db({ existing: [{ id: ROW, tag_id: TAG, endorsee_id: OWNER, created_at: CREATED }] });
    const res = await post({ tag_id: TAG });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: ROW, tag_id: TAG, endorsee_id: OWNER, created_at: CREATED });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('re-endorsing a withdrawn row: 200, the SAME row id, and the bumped revision in the job id', async () => {
    db({ upsert: [{ id: ROW, tag_id: TAG, endorsee_id: OWNER, created_at: CREATED, revision: 3, inserted: false }] });
    const res = await post({ tag_id: TAG });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ROW);
    expect(mockAdd.mock.calls.map(c => c[2].jobId)).toEqual([`endorsement-${ROW}-r3`]);
  });

  it('a failed enqueue after commit still returns success and logs both user ids', async () => {
    const { endorsementLog } = require('../../src/events/endorsementEvents');
    const errorSpy = jest.spyOn(endorsementLog, 'error').mockImplementation(() => undefined);
    mockAdd.mockRejectedValue(new Error('redis down'));
    db({ upsert: [{ id: ROW, tag_id: TAG, endorsee_id: OWNER, created_at: CREATED, revision: 1, inserted: true }] });
    const res = await post({ tag_id: TAG });
    expect(res.status).toBe(201);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, , context] = errorSpy.mock.calls[0];
    expect(context).toEqual(expect.objectContaining({ endorser_id: CALLER, endorsee_id: OWNER, job_id: `endorsement-${ROW}-r1` }));
    errorSpy.mockRestore();
  });

  it('a hung enqueue (Redis unreachable) is bounded: the committed endorsement still answers promptly and logs', async () => {
    const { endorsementLog } = require('../../src/events/endorsementEvents');
    const errorSpy = jest.spyOn(endorsementLog, 'error').mockImplementation(() => undefined);
    mockAdd.mockImplementation(() => new Promise(() => undefined));
    db({ upsert: [{ id: ROW, tag_id: TAG, endorsee_id: OWNER, created_at: CREATED, revision: 1, inserted: true }] });
    const started = Date.now();
    const res = await post({ tag_id: TAG });
    expect(res.status).toBe(201);
    expect(Date.now() - started).toBeLessThan(4000);
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Error),
      expect.objectContaining({ endorser_id: CALLER, endorsee_id: OWNER }));
    errorSpy.mockRestore();
  });

  it('a tag deleted mid-request (FK violation) answers the same 404', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (/INSERT INTO auth\.skill_endorsements/.test(sql)) throw Object.assign(new Error('fk'), { code: '23503' });
      return { rows: [], rowCount: 0 };
    });
    const res = await post({ tag_id: TAG });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /auth/skills/endorsements/:tagId', () => {
  it('withdraws an active endorsement: 200, revision bumped only for an active row, one event', async () => {
    db({ withdraw: [{ id: ROW, endorsee_id: OWNER, revision: 2 }] });
    const res = await del();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ withdrawn: true });
    const [[sql, params]] = sqlOf(/UPDATE auth\.skill_endorsements/);
    expect(sql).toMatch(/withdrawn_at IS NULL/);
    expect(sql).toMatch(/revision = revision \+ 1/);
    expect(params).toEqual([CALLER, TAG]);
    expect(mockAdd.mock.calls.map(c => c[2].jobId)).toEqual([`endorsement-${ROW}-r2`]);
  });

  it('is idempotent: already withdrawn or absent gives 200 and no event', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ withdrawn: true });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('validates the tag id before querying', async () => {
    expect((await del('nope')).status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('endorsement job ids (Critical Note 8)', () => {
  it('two changes in one frozen millisecond get two distinct ids; re-publishing one change reuses its id', async () => {
    const { publishEndorsementChanged, ENDORSEMENT_QUEUE } = require('../../src/events/endorsementEvents');
    const frozen = jest.spyOn(Date, 'now').mockReturnValue(1760313600000);
    const change = (revision: number) => ({ rowId: ROW, revision, endorser_id: CALLER, endorsee_id: OWNER });
    await publishEndorsementChanged(change(2));
    await publishEndorsementChanged(change(3));
    await publishEndorsementChanged(change(3));
    frozen.mockRestore();
    expect(mockAdd.mock.calls.map(c => c[2].jobId)).toEqual([`endorsement-${ROW}-r2`, `endorsement-${ROW}-r3`, `endorsement-${ROW}-r3`]);
    expect(ENDORSEMENT_QUEUE).toBe('karmyq-skill-endorsement-social-graph');
    expect(mockQueueNames).toContain('karmyq-skill-endorsement-social-graph');
    expect(mockQueueNames).not.toContain('karmyq-events');
  });
});

describe('DELETE /auth/profile/tags/:tagId cascades endorsements', () => {
  it('locks the tag, collects active endorsers in the transaction, deletes, commits, THEN publishes one -deleted event per row', async () => {
    const order: string[] = [];
    mockClientQuery.mockImplementation(async (sql: string) => {
      order.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
      if (/FROM auth\.user_tags/.test(sql) && /FOR UPDATE/.test(sql)) return { rows: [{ id: TAG }], rowCount: 1 };
      if (/FROM auth\.skill_endorsements/.test(sql)) return { rows: [{ id: ROW, endorser_id: CALLER }, { id: ROW_2, endorser_id: OTHER_ENDORSER }], rowCount: 2 };
      return { rows: [], rowCount: 1 };
    });
    mockAdd.mockImplementation(async () => { order.push('publish'); return {}; });
    const res = await request(app).delete(`/auth/profile/tags/${TAG}`).set('Authorization', token(OWNER));
    expect(res.status).toBe(200);
    const commit = order.indexOf('COMMIT');
    expect(order[0]).toBe('BEGIN');
    expect(commit).toBeGreaterThan(order.findIndex(s => s.startsWith('DELETE')));
    expect(order.slice(commit + 1)).toEqual(['publish', 'publish']);
    expect(mockAdd.mock.calls.map(c => [c[1].payload, c[2]])).toEqual([
      [{ endorser_id: CALLER, endorsee_id: OWNER, job_id: `endorsement-${ROW}-deleted` }, { jobId: `endorsement-${ROW}-deleted` }],
      [{ endorser_id: OTHER_ENDORSER, endorsee_id: OWNER, job_id: `endorsement-${ROW_2}-deleted` }, { jobId: `endorsement-${ROW_2}-deleted` }],
    ]);
    const [endorsementSql, endorsementParams] = mockClientQuery.mock.calls.find(([sql]) => /FROM auth\.skill_endorsements/.test(String(sql)))!;
    expect(endorsementParams).toEqual([TAG]);
    // Every row for the tag, withdrawn ones included, locked: a concurrent revive (an UPDATE that takes no
    // FK lock on the tag) must wait for this delete instead of slipping in between read and cascade.
    expect(endorsementSql).not.toMatch(/withdrawn_at/);
    expect(endorsementSql).toMatch(/FOR UPDATE/);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('a tag with no endorsements publishes nothing; a foreign tag deletes nothing and publishes nothing', async () => {
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await request(app).delete(`/auth/profile/tags/${TAG}`).set('Authorization', token(OWNER));
    expect(res.status).toBe(200);
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockClientQuery.mock.calls.some(([sql]) => /^\s*DELETE/.test(String(sql)))).toBe(false);
  });

  it('rolls back and publishes nothing when the delete fails', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (/^\s*DELETE/.test(sql)) throw new Error('boom');
      if (/FROM auth\.user_tags/.test(sql)) return { rows: [{ id: TAG }], rowCount: 1 };
      if (/FROM auth\.skill_endorsements/.test(sql)) return { rows: [{ id: ROW, endorser_id: CALLER }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await request(app).delete(`/auth/profile/tags/${TAG}`).set('Authorization', token(OWNER));
    expect(res.status).toBe(500);
    expect(mockClientQuery.mock.calls.map(([sql]) => String(sql).trim())).toContain('ROLLBACK');
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe('GET /auth/skills/users/:userId endorsement fields', () => {
  it('returns endorsement_count, endorsed_by_me and can_endorse from one gated statement', async () => {
    const skills = [{ tag_id: TAG, label: 'Carpentry', skill_slug: 'carpentry', endorsement_count: 2, endorsed_by_me: true, can_endorse: true }];
    mockQuery.mockResolvedValue({ rows: [{ skills }], rowCount: 1 });
    const res = await request(app).get(`/auth/skills/users/${OWNER}`).set('Authorization', token());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(skills);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('/* skill-visible */');
    expect(sql).toContain("'endorsement_count'");
    expect(sql).toContain("'endorsed_by_me'");
    expect(sql).toContain("'can_endorse'");
    expect(sql).toMatch(/withdrawn_at IS NULL/);
    expect(sql).toMatch(/status = 'completed'/);
    expect(params).toEqual([OWNER, CALLER]);
  });
});
