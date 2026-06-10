/**
 * Sprint 92 — BUG-001: a community must never become adminless.
 *
 * The DELETE (leave/kick) path already blocks removing the last admin, but the
 * role-update path (PUT /communities/:communityId/members/:userId) did not — an
 * admin could demote the sole admin to 'member' (or deactivate them), leaving the
 * community with zero admins. This locks the guard on the demote/deactivate path.
 *
 * (The historical adminless communities are repaired by the idempotent migration
 * 20260608-backfill-community-admins.sql.)
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
    // Run the guard transaction inline against the same query mock so the
    // content-based mock drives both the lock SELECT and the UPDATE.
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
const token = jwt.sign({ userId: 'u1', email: 'a@test.com', communities: [] }, SECRET);

/**
 * Content-based mock so middleware queries (tenant/db-context) don't offset a brittle
 * call sequence. `activeAdmins` is the set of active-admin user_ids the FOR UPDATE lock
 * SELECT returns; the guard blocks when the target is in that set and it has size <= 1.
 */
function mockMembersDb({ activeAdmins }: { activeAdmins: string[] }) {
  mockQuery.mockImplementation((sql: any) => {
    const s = String(sql);
    // Last-admin guard's row-locking SELECT.
    if (/SELECT user_id\s+FROM communities\.members/i.test(s) && /FOR UPDATE/i.test(s)) {
      return Promise.resolve({ rows: activeAdmins.map((id) => ({ user_id: id })), rowCount: activeAdmins.length } as any);
    }
    // Caller admin-permission check.
    if (/SELECT role\s+FROM communities\.members/i.test(s)) {
      return Promise.resolve({ rows: [{ role: 'admin' }], rowCount: 1 } as any);
    }
    if (/^\s*UPDATE communities\.members/i.test(s)) {
      return Promise.resolve({ rows: [{ id: 'm1', role: 'member', status: 'active' }], rowCount: 1 } as any);
    }
    return Promise.resolve({ rows: [], rowCount: 0 } as any);
  });
}

describe('Sprint 92 BUG-001: last-admin guard on role update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects demoting the sole admin with 400', async () => {
    mockMembersDb({ activeAdmins: ['u2'] }); // u2 is the only active admin
    const res = await request(app)
      .put('/communities/comm-1/members/u2')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'member' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last admin/i);
  });

  it('rejects deactivating the sole admin with 400', async () => {
    mockMembersDb({ activeAdmins: ['u2'] });
    const res = await request(app)
      .put('/communities/comm-1/members/u2')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last admin/i);
  });

  it('allows demoting an admin when another admin remains', async () => {
    mockMembersDb({ activeAdmins: ['u2', 'u9'] });
    const res = await request(app)
      .put('/communities/comm-1/members/u2')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'member' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('locks the active-admin rows (FOR UPDATE) so concurrent demotions serialize', async () => {
    mockMembersDb({ activeAdmins: ['u2'] });
    await request(app)
      .put('/communities/comm-1/members/u2')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'member' });
    // The guard must read the admin set under a row lock, not a bare count.
    const lockingSelect = mockQuery.mock.calls.find(([sql]: any) =>
      /SELECT user_id\s+FROM communities\.members/i.test(String(sql)) && /FOR UPDATE/i.test(String(sql))
    );
    expect(lockingSelect).toBeDefined();
  });
});
