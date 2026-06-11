/**
 * Sprint 93 — ADR-064 close-out: DELETE members must derive the caller from the
 * verified JWT, never from a spoofable request body.
 *
 * Before this fix, DELETE /communities/:communityId/members/:userId read
 * `admin_user_id` from req.body. An attacker could either (a) pass any admin's id to
 * satisfy the admin check, or (b) set admin_user_id === the target userId to fake a
 * "self-remove" and bypass the admin check entirely — removing any member.
 *
 * The PUT handler was already hardened (members.ts:294-295, "always use verified
 * userId from JWT"). This locks the DELETE path to the same pattern:
 * caller = req.user.userId, request body ignored.
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
    // Run the guard transaction inline against the same query mock.
    withTransaction: (fn: any) => fn((...args: any[]) => q(...args)),
  };
});

jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/index';
import { query } from '../../src/database/db';
import { publishEvent } from '../../src/events/publisher';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockPublish = publishEvent as jest.MockedFunction<typeof publishEvent>;
const SECRET = 'test-secret';

const tokenFor = (userId: string) =>
  jwt.sign({ userId, email: `${userId}@test.com`, communities: [] }, SECRET);

/**
 * Param-aware content mock: role lookups resolve by the queried user_id ($2), so the
 * tests can distinguish "caller from JWT" from "admin_user_id from body". That is what
 * makes the spoof cases RED on the old (body-trusting) handler and GREEN on the fix.
 * `roles` maps userId → membership role; `activeAdmins` is the set the FOR UPDATE
 * last-admin lock returns.
 */
function mockDeleteDb({ roles, activeAdmins }: { roles: Record<string, string>; activeAdmins: string[] }) {
  mockQuery.mockImplementation((sql: any, params?: any) => {
    const s = String(sql);
    const p: any[] = params || [];
    // Last-admin guard's row-locking SELECT.
    if (/SELECT user_id\s+FROM communities\.members/i.test(s) && /FOR UPDATE/i.test(s)) {
      return Promise.resolve({ rows: activeAdmins.map((id) => ({ user_id: id })), rowCount: activeAdmins.length } as any);
    }
    // Role lookups (caller admin-check AND target-exists check) resolve by user_id param.
    if (/SELECT role\s+FROM communities\.members/i.test(s)) {
      const uid = p[1];
      const role = roles[uid];
      return Promise.resolve((role ? { rows: [{ role }], rowCount: 1 } : { rows: [], rowCount: 0 }) as any);
    }
    if (/^\s*UPDATE communities\.members/i.test(s)) {
      return Promise.resolve({ rows: [], rowCount: 1 } as any);
    }
    if (/^\s*UPDATE communities\.communities/i.test(s)) {
      return Promise.resolve({ rows: [], rowCount: 1 } as any);
    }
    return Promise.resolve({ rows: [], rowCount: 0 } as any);
  });
}

describe('Sprint 93 ADR-064: DELETE members derives caller from JWT, ignores body', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ignores a spoofed body admin_user_id naming another admin (non-admin caller → 403)', async () => {
    mockDeleteDb({ roles: { attacker: 'member', victim: 'member', 'real-admin': 'admin' }, activeAdmins: [] });
    const res = await request(app)
      .delete('/communities/comm-1/members/victim')
      .set('Authorization', `Bearer ${tokenFor('attacker')}`)
      .send({ admin_user_id: 'real-admin' });
    expect(res.status).toBe(403);
  });

  it('ignores a body admin_user_id that fakes a self-remove (the exploit) → 403', async () => {
    mockDeleteDb({ roles: { attacker: 'member', victim: 'member' }, activeAdmins: [] });
    const res = await request(app)
      .delete('/communities/comm-1/members/victim')
      .set('Authorization', `Bearer ${tokenFor('attacker')}`)
      .send({ admin_user_id: 'victim' }); // old code: isSelfRemove = (victim === victim) → bypass
    expect(res.status).toBe(403);
  });

  it('allows a member to remove themselves with no body (JWT userId === target)', async () => {
    mockDeleteDb({ roles: { u1: 'member' }, activeAdmins: [] });
    const res = await request(app)
      .delete('/communities/comm-1/members/u1')
      .set('Authorization', `Bearer ${tokenFor('u1')}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/left community/i);
  });

  it('allows an admin to remove another member with no body', async () => {
    mockDeleteDb({ roles: { admin1: 'admin', victim: 'member' }, activeAdmins: ['admin1'] });
    const res = await request(app)
      .delete('/communities/comm-1/members/victim')
      .set('Authorization', `Bearer ${tokenFor('admin1')}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/removed/i);
  });

  it('still blocks removing the last admin (sole-admin self-remove → 400)', async () => {
    mockDeleteDb({ roles: { admin1: 'admin' }, activeAdmins: ['admin1'] });
    const res = await request(app)
      .delete('/communities/comm-1/members/admin1')
      .set('Authorization', `Bearer ${tokenFor('admin1')}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last admin/i);
  });

  it('publishes user_left_community with removed_by = JWT caller, not the body value', async () => {
    mockDeleteDb({ roles: { admin1: 'admin', victim: 'member', spoofed: 'admin' }, activeAdmins: ['admin1'] });
    await request(app)
      .delete('/communities/comm-1/members/victim')
      .set('Authorization', `Bearer ${tokenFor('admin1')}`)
      .send({ admin_user_id: 'spoofed' });
    expect(mockPublish).toHaveBeenCalledWith(
      'user_left_community',
      expect.objectContaining({ removed_by: 'admin1', is_self_remove: false })
    );
  });
});
