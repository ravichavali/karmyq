/**
 * Sprint 144 (decision 5, note 4) — capacity is checked AFTER the admitting write, inside the same
 * transaction, and a full community rolls the write back with 400 COMMUNITY_FULL.
 *
 * The trigger's UPDATE holds the community row lock until commit, so concurrent admitters serialize
 * on it and the second one's post-check sees the first one's committed count. A pre-write check alone
 * lets two concurrent admissions both pass. The real-database race is in
 * tests/integration/sprint-144-staff-write-integrity.integration.test.ts; this file pins the
 * placement: post-check after the member write, both on the one transaction client, throw → rollback.
 */
process.env.JWT_SECRET = 'test-secret';

import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
const mockTxQuery = jest.fn();
const tx = { opened: 0, rolledBack: 0, committed: 0 };
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
  query: (...args: any[]) => mockQuery(...args),
  // Mirrors db.ts: one client per transaction; any throw rolls it back and propagates.
  withTransaction: async (fn: any) => {
    tx.opened++;
    try {
      const result = await fn((...args: any[]) => mockTxQuery(...args));
      tx.committed++;
      return result;
    } catch (error) {
      tx.rolledBack++;
      throw error;
    }
  },
}));
const mockPublish = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: (...args: any[]) => mockPublish(...args),
}));
jest.mock('../../src/routes/fusions', () => ({
  getActiveFusionProposalForCommunityRoute: jest.fn().mockResolvedValue(null),
}));

import membersRouter from '../../src/routes/members';
import communitiesRouter from '../../src/routes/communities';
import { assertWithinCapacity, CommunityFullError } from '../../src/database/memberCapacity';

const COMMUNITY = 'cccccccc-1440-4000-8000-00000000000c';
const ADMIN = 'aaaaaaaa-1440-4000-8000-00000000000a';
const JOINER = 'bbbbbbbb-1440-4000-8000-00000000000b';

function app(userId: string) {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res, next) => { req.user = { userId, email: `${userId}@test.invalid`, communities: [] }; next(); });
  a.use('/communities', communitiesRouter);
  a.use('/communities', membersRouter);
  return a;
}

const CAPACITY_READ = /SELECT current_members, max_members FROM communities\.communities WHERE id = \$1/i;
const COMMUNITY_STATE_READ = /SELECT status, access_type FROM communities\.communities WHERE id = \$1/i;
type Rows = { rows: any[]; rowCount: number };
const rows = (r: any[]): Rows => ({ rows: r, rowCount: r.length });

/** Pool and transaction handlers; `capacity` is what the in-transaction post-check reads. */
function installDb(opts: {
  access?: 'public' | 'private';
  preCount?: number;
  capacity: { current_members: number; max_members: number };
  existingMember?: { status: string };
  callerRole?: string;
  identityMatch?: boolean;
}) {
  const community = {
    id: COMMUNITY, name: 'Capacity Co', location: 'Here', status: 'active',
    access_type: opts.access ?? 'public', max_members: opts.capacity.max_members,
    current_members: opts.preCount ?? 1, created_at: '2026-01-01T00:00:00Z',
  };
  mockQuery.mockImplementation(async (sql: string) => {
    if (/LOWER\s*\(\s*TRIM\s*\(\s*name/i.test(sql)) return opts.identityMatch ? rows([community]) : rows([]);
    if (/SELECT role FROM communities\.members/i.test(sql)) return opts.callerRole ? rows([{ role: opts.callerRole }]) : rows([]);
    if (/SELECT id, status FROM communities\.members/i.test(sql)) return opts.existingMember ? rows([{ id: 'm1', ...opts.existingMember }]) : rows([]);
    if (/FROM communities\.communities/i.test(sql) && /max_members/i.test(sql)) return rows([community]);
    if (/JOIN communities\.members/i.test(sql)) return rows([{ id: COMMUNITY, name: community.name, role: 'member' }]);
    return rows([]);
  });
  mockTxQuery.mockImplementation(async (sql: string, params: any[] = []) => {
    if (CAPACITY_READ.test(sql)) return rows([opts.capacity]);
    // Sprint 145 (BUG-108): the duplicate-create join re-reads the community on the transaction client.
    if (COMMUNITY_STATE_READ.test(sql)) return rows([{ status: 'active', access_type: opts.access ?? 'public' }]);
    if (/^\s*INSERT INTO communities\.members/i.test(sql)) {
      return rows([{ community_id: params[0], user_id: params[1], role: 'member', status: params[2] ?? 'active' }]);
    }
    if (/^\s*UPDATE communities\.members/i.test(sql)) return rows([{ community_id: params[0], user_id: params[1], status: params[2] }]);
    return rows([]);
  });
}

const allSql = () => [...mockQuery.mock.calls, ...mockTxQuery.mock.calls].map(([sql]) => String(sql));
const txSql = () => mockTxQuery.mock.calls.map(([sql]) => String(sql));
const indexOf = (list: string[], re: RegExp) => list.findIndex((sql) => re.test(sql));

beforeEach(() => {
  mockQuery.mockReset();
  mockTxQuery.mockReset();
  mockPublish.mockClear();
  Object.assign(tx, { opened: 0, rolledBack: 0, committed: 0 });
});

describe('Sprint 144 assertWithinCapacity', () => {
  const q = (row: any) => jest.fn().mockResolvedValue(rows(row ? [row] : []));

  it('throws CommunityFullError when the count exceeds max_members', async () => {
    const read = q({ current_members: 4, max_members: 3 });
    await expect(assertWithinCapacity(read, COMMUNITY)).rejects.toBeInstanceOf(CommunityFullError);
    expect(read).toHaveBeenCalledWith(expect.stringMatching(CAPACITY_READ), [COMMUNITY]);
  });

  it('passes at exactly max_members and returns the count', async () => {
    await expect(assertWithinCapacity(q({ current_members: 3, max_members: 3 }), COMMUNITY))
      .resolves.toEqual({ current_members: 3, max_members: 3 });
  });

  it('passes below max_members', async () => {
    await expect(assertWithinCapacity(q({ current_members: 1, max_members: 150 }), COMMUNITY))
      .resolves.toEqual({ current_members: 1, max_members: 150 });
  });
});

describe('Sprint 144 POST /communities/:communityId/join post-check', () => {
  it('rolls back a public join that overfills the community with 400 COMMUNITY_FULL', async () => {
    installDb({ preCount: 2, capacity: { current_members: 4, max_members: 3 } });
    const res = await request(app(JOINER)).post(`/communities/${COMMUNITY}/join`).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_FULL' });
    const sql = txSql();
    expect(indexOf(sql, /INSERT INTO communities\.members/i)).toBeGreaterThanOrEqual(0);
    expect(indexOf(sql, CAPACITY_READ)).toBeGreaterThan(indexOf(sql, /INSERT INTO communities\.members/i));
    expect(tx).toEqual({ opened: 1, rolledBack: 1, committed: 0 });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('checks a public rejoin after its UPDATE', async () => {
    installDb({ preCount: 2, existingMember: { status: 'left' }, capacity: { current_members: 4, max_members: 3 } });
    const res = await request(app(JOINER)).post(`/communities/${COMMUNITY}/join`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('COMMUNITY_FULL');
    const sql = txSql();
    expect(indexOf(sql, CAPACITY_READ)).toBeGreaterThan(indexOf(sql, /UPDATE communities\.members/i));
    expect(tx.rolledBack).toBe(1);
  });

  it('commits a public join that fits, without writing the counter', async () => {
    installDb({ preCount: 2, capacity: { current_members: 3, max_members: 3 } });
    const res = await request(app(JOINER)).post(`/communities/${COMMUNITY}/join`).send({});
    expect(res.status).toBe(200);
    expect(tx).toEqual({ opened: 1, rolledBack: 0, committed: 1 });
    expect(allSql().some((sql) => /UPDATE communities\.communities/i.test(sql))).toBe(false);
  });

  it('skips the post-check for a private (pending) join request', async () => {
    installDb({ access: 'private', preCount: 2, capacity: { current_members: 9, max_members: 3 } });
    const res = await request(app(JOINER)).post(`/communities/${COMMUNITY}/join`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(txSql().some((sql) => CAPACITY_READ.test(sql))).toBe(false);
  });
});

describe('Sprint 144 POST /communities/:communityId/members (staff add) post-check', () => {
  it('rolls back an add that overfills the community with 400 COMMUNITY_FULL', async () => {
    installDb({ callerRole: 'admin', preCount: 2, capacity: { current_members: 4, max_members: 3 } });
    const res = await request(app(ADMIN)).post(`/communities/${COMMUNITY}/members`).send({ user_id: JOINER });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_FULL' });
    const sql = txSql();
    expect(indexOf(sql, CAPACITY_READ)).toBeGreaterThan(indexOf(sql, /INSERT INTO communities\.members/i));
    expect(indexOf(sql, /INSERT INTO communities\.members/i)).toBeGreaterThanOrEqual(0);
    expect(tx).toEqual({ opened: 1, rolledBack: 1, committed: 0 });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('adds inside one transaction without writing the counter', async () => {
    installDb({ callerRole: 'admin', preCount: 2, capacity: { current_members: 3, max_members: 3 } });
    const res = await request(app(ADMIN)).post(`/communities/${COMMUNITY}/members`).send({ user_id: JOINER });
    expect(res.status).toBe(201);
    expect(tx).toEqual({ opened: 1, rolledBack: 0, committed: 1 });
    expect(allSql().some((sql) => /UPDATE communities\.communities/i.test(sql))).toBe(false);
    expect(mockPublish).toHaveBeenCalledWith('user_joined_community', expect.objectContaining({ community_id: COMMUNITY, user_id: JOINER }));
  });

  it('answers an unexpected failure with INTERNAL_ERROR and no raw detail', async () => {
    installDb({ callerRole: 'admin', capacity: { current_members: 1, max_members: 3 } });
    mockTxQuery.mockRejectedValue(new Error('secret SQL detail: relation communities.members'));
    const res = await request(app(ADMIN)).post(`/communities/${COMMUNITY}/members`).send({ user_id: JOINER });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|relation|SQL/);
  });
});

describe('Sprint 144 POST /communities duplicate-create join and create', () => {
  const create = (userId: string) => request(app(userId))
    .post('/communities')
    .send({ name: 'Capacity Co', location: 'Here', community_type: 'mutual_aid' });

  it('rolls back a duplicate-create join that overfills the community with 400 COMMUNITY_FULL', async () => {
    installDb({ identityMatch: true, preCount: 3, capacity: { current_members: 4, max_members: 3 } });
    const res = await create(JOINER);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'COMMUNITY_FULL' });
    const sql = txSql();
    expect(indexOf(sql, CAPACITY_READ)).toBeGreaterThan(indexOf(sql, /INSERT INTO communities\.members/i));
    expect(indexOf(sql, /INSERT INTO communities\.members/i)).toBeGreaterThanOrEqual(0);
    expect(tx).toEqual({ opened: 1, rolledBack: 1, committed: 0 });
  });

  it('reports the count the database holds after a duplicate-create join, with no counter write', async () => {
    installDb({ identityMatch: true, preCount: 5, capacity: { current_members: 6, max_members: 150 } });
    const res = await create(JOINER);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ existing: true, joined: true });
    expect(res.body.data.community.current_members).toBe(6);
    expect(tx).toEqual({ opened: 1, rolledBack: 0, committed: 1 });
    expect(allSql().some((sql) => /UPDATE communities\.communities/i.test(sql))).toBe(false);
  });

  it('reports the stored count when the caller was already a member (active no-op) and skips the post-check', async () => {
    installDb({ identityMatch: true, preCount: 5, capacity: { current_members: 5, max_members: 3 } });
    // Sprint 145: the caller's row is read locked inside the transaction; an active row is a no-op with
    // no member write at all (it no longer relies on an ON CONFLICT no-op).
    mockTxQuery.mockImplementation(async (sql: string) => {
      if (/FROM communities\.members\s+WHERE community_id = \$1 AND user_id = \$2\s+FOR UPDATE/i.test(sql)) {
        return rows([{ status: 'active', role: 'member' }]);
      }
      if (COMMUNITY_STATE_READ.test(sql)) return rows([{ status: 'active', access_type: 'public' }]);
      if (/SELECT current_members FROM communities\.communities WHERE id = \$1/i.test(sql)) return rows([{ current_members: 5 }]);
      return rows([]);
    });
    const res = await create(JOINER);
    expect(res.status).toBe(200);
    expect(res.body.data.community.current_members).toBe(5);
    expect(txSql().some((sql) => CAPACITY_READ.test(sql))).toBe(false);
    expect(txSql().some((sql) => /^\s*(INSERT INTO|UPDATE) communities\.members/i.test(sql))).toBe(false);
  });

  it('inserts a new community with a literal 0 and reports the post-trigger count', async () => {
    installDb({ capacity: { current_members: 1, max_members: 150 } });
    mockQuery.mockImplementation(async (sql: string) => {
      if (/LOWER\s*\(\s*TRIM\s*\(\s*name/i.test(sql)) return rows([]);
      if (/^\s*INSERT\s+INTO\s+communities\.communities/i.test(sql)) {
        return rows([{ id: COMMUNITY, name: 'Capacity Co', status: 'active', current_members: 0 }]);
      }
      if (/SELECT current_members FROM communities\.communities WHERE id = \$1/i.test(sql)) return rows([{ current_members: 1 }]);
      if (/JOIN communities\.members/i.test(sql)) return rows([{ id: COMMUNITY, name: 'Capacity Co', role: 'admin' }]);
      return rows([]);
    });
    const res = await create(ADMIN);
    expect(res.status).toBe(201);
    expect(res.body.data.community.current_members).toBe(1);
    const insert = mockQuery.mock.calls.map(([sql]) => String(sql)).find((sql) => /INSERT\s+INTO\s+communities\.communities/i.test(sql));
    expect(insert).toMatch(/VALUES\s*\(\$1, \$2, \$3, \$4, \$5, 0, \$6/);
  });
});
