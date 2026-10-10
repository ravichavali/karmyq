/**
 * Sprint 132 BUG-061: community routes must derive the caller from the verified JWT, never
 * from a client-supplied body id (ADR-064; Sprint 93 closed the same hole on DELETE members).
 *
 * Before this fix these handlers authorized `req.body.user_id` / `req.body.created_by`:
 *   - POST /communities/:id/members     anyone could add anyone, with any body `role` (admin)
 *   - PUT/DELETE /communities/:id       edit or archive a community by naming an admin
 *   - POST norms, approve, DELETE norm  propose, vote or archive as another member
 *
 * The query mock answers membership lookups by the BOUND user id ($2), so each spoof case is
 * RED on a body-trusting handler (the named admin/member passes) and GREEN on the fix (the JWT
 * caller has no role). Every spoof case also asserts no write statement reached the database.
 */

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../../src/database/db', () => {
  const q = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
  };
  return {
    __esModule: true,
    default: mockPool,
    initDatabase: jest.fn().mockResolvedValue(undefined),
    query: q,
    withTransaction: (fn: any) => fn((...args: any[]) => q(...args)),
  };
});

jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/index';
import { query } from '../../src/database/db';

const mockQuery = query as jest.MockedFunction<typeof query>;
const SECRET = 'test-secret';
const COMMUNITY = '11111111-1111-4111-8111-111111111111';
const NORM = '22222222-2222-4222-8222-222222222222';
const ADMIN = 'admin-user';
const MEMBER = 'member-user';
const ATTACKER = 'attacker-user';
const NEWBIE = 'newbie-user';

const tokenFor = (userId: string) =>
  `Bearer ${jwt.sign({ userId, email: `${userId}@test.com`, communities: [] }, SECRET)}`;

const ROLES: Record<string, string> = { [ADMIN]: 'admin', [MEMBER]: 'member' };

function mockDb({ normCreator = MEMBER }: { normCreator?: string } = {}) {
  mockQuery.mockImplementation((async (sql: string, params: unknown[] = []) => {
    const s = String(sql);
    if (/COUNT\(\*\)/i.test(s)) return { rows: [{ count: '10' }], rowCount: 1 };
    if (/FROM communities\.members/.test(s) && /user_id = \$2/.test(s)) {
      const role = ROLES[params[1] as string];
      return role
        ? { rows: [{ id: `m-${params[1]}`, role, status: 'active' }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/SELECT created_by FROM communities\.norms/.test(s))
      return { rows: [{ created_by: normCreator }], rowCount: 1 };
    if (/SELECT status FROM communities\.norms/.test(s))
      return { rows: [{ status: 'proposed' }], rowCount: 1 };
    if (/FROM communities\.norm_approvals/.test(s)) return { rows: [], rowCount: 0 };
    if (/^\s*SELECT[\s\S]*FROM communities\.communities/.test(s))
      return { rows: [{ id: COMMUNITY, max_members: 150, current_members: 5, status: 'active' }], rowCount: 1 };
    return { rows: [{ id: NORM }], rowCount: 1 };
  }) as any);
}

const writes = () =>
  mockQuery.mock.calls.filter(([sql]) => /^\s*(UPDATE|INSERT|DELETE)\b/i.test(String(sql)));

beforeEach(() => {
  mockQuery.mockReset();
  mockDb();
});

describe('BUG-061: POST /communities/:id/members is admin-only and never trusts body identity', () => {
  it('rejects a non-member granting themselves admin', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/members`)
      .set('Authorization', tokenFor(ATTACKER))
      .send({ user_id: ATTACKER, role: 'admin', invited_by: ADMIN });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('rejects an ordinary member adding someone', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/members`)
      .set('Authorization', tokenFor(MEMBER))
      .send({ user_id: NEWBIE });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('lets an admin add a member, recording the JWT caller as invited_by', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/members`)
      .set('Authorization', tokenFor(ADMIN))
      .send({ user_id: NEWBIE, invited_by: ATTACKER });
    expect(res.status).toBe(201);
    const insert = writes().find(([sql]) => /INSERT INTO communities\.members/.test(String(sql)));
    expect(insert![1]).toEqual([COMMUNITY, NEWBIE, 'member', ADMIN]);
  });

  it('rejects an unknown role', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/members`)
      .set('Authorization', tokenFor(ADMIN))
      .send({ user_id: NEWBIE, role: 'superuser' });
    expect(res.status).toBe(400);
    expect(writes()).toHaveLength(0);
  });
});

describe('BUG-061: PUT/DELETE /communities/:id authorize the JWT caller', () => {
  it('PUT rejects a non-admin naming an admin in the body', async () => {
    const res = await request(app)
      .put(`/communities/${COMMUNITY}`)
      .set('Authorization', tokenFor(ATTACKER))
      .send({ name: 'Hijacked', user_id: ADMIN });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('PUT succeeds for the admin with no body user_id', async () => {
    const res = await request(app)
      .put(`/communities/${COMMUNITY}`)
      .set('Authorization', tokenFor(ADMIN))
      .send({ name: 'Renamed' });
    expect(res.status).toBe(200);
  });

  it('DELETE rejects a non-admin naming an admin in the body', async () => {
    const res = await request(app)
      .delete(`/communities/${COMMUNITY}`)
      .set('Authorization', tokenFor(ATTACKER))
      .send({ user_id: ADMIN });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('DELETE succeeds for the admin with no body user_id', async () => {
    const res = await request(app)
      .delete(`/communities/${COMMUNITY}`)
      .set('Authorization', tokenFor(ADMIN));
    expect(res.status).toBe(200);
  });
});

describe('BUG-061: norm routes authorize the JWT caller', () => {
  it('create rejects a non-member naming a member as created_by', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/norms`)
      .set('Authorization', tokenFor(ATTACKER))
      .send({ description: 'Forged norm', created_by: MEMBER });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('create records the JWT caller as created_by and creator approval', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/norms`)
      .set('Authorization', tokenFor(MEMBER))
      .send({ description: 'Be kind', created_by: ATTACKER });
    expect(res.status).toBe(201);
    const [normInsert, approvalInsert] = writes();
    expect(normInsert[1]).toEqual([COMMUNITY, 'Be kind', null, MEMBER]);
    expect(approvalInsert[1]).toEqual([NORM, MEMBER]);
  });

  it('approve rejects a non-member voting as a member', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/norms/${NORM}/approve`)
      .set('Authorization', tokenFor(ATTACKER))
      .send({ user_id: MEMBER });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('approve records the JWT caller, ignoring a body user_id', async () => {
    const res = await request(app)
      .post(`/communities/${COMMUNITY}/norms/${NORM}/approve`)
      .set('Authorization', tokenFor(MEMBER))
      .send({ user_id: ADMIN });
    expect(res.status).toBe(200);
    const approval = writes().find(([sql]) => /INSERT INTO communities\.norm_approvals/.test(String(sql)));
    expect(approval![1]).toEqual([NORM, MEMBER]);
  });

  it('DELETE rejects a non-admin claiming to be the creator', async () => {
    const res = await request(app)
      .delete(`/communities/${COMMUNITY}/norms/${NORM}`)
      .set('Authorization', tokenFor(ATTACKER))
      .send({ user_id: MEMBER });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('DELETE succeeds for the real creator with no body user_id', async () => {
    const res = await request(app)
      .delete(`/communities/${COMMUNITY}/norms/${NORM}`)
      .set('Authorization', tokenFor(MEMBER));
    expect(res.status).toBe(200);
  });
});
