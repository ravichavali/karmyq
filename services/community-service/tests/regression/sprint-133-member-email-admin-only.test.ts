import express from 'express';
import request from 'supertest';

// BUG-062: community detail and the members list returned every member's email to any viewer, and
// the members list accepted any `status`. Email is now visible only to a LIVE active admin (or on the
// caller's own row); pending members are visible only to live admins/moderators (who approve joins)
// and to the pending member themself. The role comes from communities.members, never the JWT claim.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: unknown[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));
jest.mock('../../src/routes/fusions', () => ({
  getActiveFusionProposalForCommunityRoute: jest.fn().mockResolvedValue(null),
}));

import communitiesRouter from '../../src/routes/communities';
import membersRouter from '../../src/routes/members';

const COMMUNITY = '99999999-9999-9999-9999-999999999999';
const CALLER = '11111111-1111-1111-1111-111111111111';
const ACTIVE_OTHER = '22222222-2222-2222-2222-222222222222';
const PENDING_OTHER = '33333333-3333-3333-3333-333333333333';

type LiveRole = 'admin' | 'moderator' | 'member' | null;

function app(jwtClaimRole = 'member') {
  const server = express();
  server.use(express.json());
  server.use((req: any, _res, next) => {
    // The JWT claim is deliberately independent of the live role so tests can prove it is ignored.
    req.user = { userId: CALLER, email: 'caller@example.test', communities: [{ id: COMMUNITY, name: 'C', role: jwtClaimRole }] };
    next();
  });
  server.use('/communities', membersRouter);
  server.use('/communities', communitiesRouter);
  return server;
}

function memberRows(sql: string, statuses: string[], callerStatus: string) {
  const all = [
    { id: 'm1', user_id: CALLER, role: 'member', status: callerStatus, user_name: 'Caller', join_request_message: 'let me in' },
    { id: 'm2', user_id: ACTIVE_OTHER, role: 'member', status: 'active', user_name: 'Active', join_request_message: null },
    { id: 'm3', user_id: PENDING_OTHER, role: 'member', status: 'pending', user_name: 'Pending', join_request_message: 'hello' },
  ];
  const withEmail = /user_email/.test(sql);
  return all
    .filter((r) => statuses.includes(r.status))
    .map((r) => (withEmail ? { ...r, user_email: `${r.user_id}@private.test` } : r));
}

function mockLive(liveRole: LiveRole, callerStatus = 'active') {
  mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (/SELECT role FROM communities\.members/i.test(sql)) {
      const rows = liveRole && callerStatus === 'active' ? [{ role: liveRole }] : [];
      return { rows, rowCount: rows.length };
    }
    if (/FROM communities\.communities c/i.test(sql)) {
      return { rows: [{ id: COMMUNITY, name: 'C', current_members: 3 }], rowCount: 1 };
    }
    if (/FROM communities\.members m/i.test(sql)) {
      // Detail query reads active + pending; list query binds the requested status.
      const statuses = /status IN \('active', 'pending'\)/.test(sql) ? ['active', 'pending'] : [String(params[1])];
      const rows = memberRows(sql, statuses, callerStatus);
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  });
}

const byUser = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.user_id, r]));

beforeEach(() => mockQuery.mockReset());

describe.each([
  ['GET /communities/:id', `/communities/${COMMUNITY}`, (body: any) => body.data.members],
  ['GET /communities/:id/members', `/communities/${COMMUNITY}/members`, (body: any) => body.data],
])('%s member email (BUG-062)', (_name, url, rowsOf) => {
  it('includes user_email on every row for a live admin', async () => {
    mockLive('admin');
    const res = await request(app()).get(url);
    expect(res.status).toBe(200);
    const rows = rowsOf(res.body);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(row.user_email).toBe(`${row.user_id}@private.test`);
  });

  it.each<[string, LiveRole]>([['a plain member', 'member'], ['a moderator', 'moderator'], ['a non-member', null]])(
    'shows %s only their own email',
    async (_who, liveRole) => {
      mockLive(liveRole);
      const res = await request(app()).get(url);
      expect(res.status).toBe(200);
      const rows = byUser(rowsOf(res.body));
      expect(rows[ACTIVE_OTHER]).toBeDefined();
      expect(rows[ACTIVE_OTHER]).not.toHaveProperty('user_email');
      if (liveRole) expect(rows[CALLER].user_email).toBe(`${CALLER}@private.test`);
      for (const row of Object.values(rows) as any[]) {
        if (row.user_id !== CALLER) expect(row).not.toHaveProperty('user_email');
      }
    },
  );

  it('ignores a JWT claiming admin when the live role is member', async () => {
    mockLive('member');
    const res = await request(app('admin')).get(url);
    expect(res.status).toBe(200);
    expect(byUser(rowsOf(res.body))[ACTIVE_OTHER]).not.toHaveProperty('user_email');
  });
});

describe('GET /communities/:id pending members (BUG-062)', () => {
  it('hides other pending members and their join messages from a plain member', async () => {
    mockLive('member');
    const res = await request(app()).get(`/communities/${COMMUNITY}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.members.map((m: any) => m.user_id);
    expect(ids).toEqual(expect.arrayContaining([CALLER, ACTIVE_OTHER]));
    expect(ids).not.toContain(PENDING_OTHER);
  });

  it('still shows a pending caller their own row so the page knows they are pending', async () => {
    mockLive(null, 'pending');
    const res = await request(app()).get(`/communities/${COMMUNITY}`);
    const own = res.body.data.members.find((m: any) => m.user_id === CALLER);
    expect(own).toMatchObject({ status: 'pending', join_request_message: 'let me in' });
    expect(res.body.data.members.map((m: any) => m.user_id)).not.toContain(PENDING_OTHER);
  });

  it.each<LiveRole>(['admin', 'moderator'])('shows pending members to a live %s', async (liveRole) => {
    mockLive(liveRole);
    const res = await request(app()).get(`/communities/${COMMUNITY}`);
    const pending = res.body.data.members.find((m: any) => m.user_id === PENDING_OTHER);
    expect(pending).toMatchObject({ status: 'pending', join_request_message: 'hello' });
  });
});

describe('GET /communities/:id/members status filter (BUG-062)', () => {
  it.each(['pending', 'left', 'removed'])('returns 403 to a plain member asking for status=%s', async (status) => {
    mockLive('member');
    const res = await request(app()).get(`/communities/${COMMUNITY}/members?status=${status}`);
    expect(res.status).toBe(403);
    expect(mockQuery.mock.calls.some(([sql]) => /FROM communities\.members m/.test(String(sql)))).toBe(false);
  });

  it('returns 403 to a JWT-claimed admin without a live admin row', async () => {
    mockLive('member');
    const res = await request(app('admin')).get(`/communities/${COMMUNITY}/members?status=pending`);
    expect(res.status).toBe(403);
  });

  it.each<LiveRole>(['admin', 'moderator'])('returns pending members to a live %s', async (liveRole) => {
    mockLive(liveRole);
    const res = await request(app()).get(`/communities/${COMMUNITY}/members?status=pending`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((m: any) => m.user_id)).toContain(PENDING_OTHER);
  });

  it('defaults to active members for a plain member', async () => {
    mockLive('member');
    const res = await request(app()).get(`/communities/${COMMUNITY}/members`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((m: any) => m.status === 'active')).toBe(true);
  });
});

describe('join_request_message on active rows (code-review follow-up)', () => {
  it('strips another active member join message from a plain member', async () => {
    mockLive('member');
    mockQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (/SELECT role FROM communities\.members/i.test(sql)) return { rows: [{ role: 'member' }], rowCount: 1 };
      if (/FROM communities\.communities c/i.test(sql)) return { rows: [{ id: COMMUNITY, name: 'C' }], rowCount: 1 };
      if (/FROM communities\.members m/i.test(sql)) {
        return { rowCount: 2, rows: [
          { user_id: CALLER, status: 'active', role: 'member', join_request_message: 'mine' },
          { user_id: ACTIVE_OTHER, status: 'active', role: 'member', join_request_message: 'private reason' },
        ] };
      }
      return { rows: [], rowCount: 0 };
    });
    const res = await request(app()).get(`/communities/${COMMUNITY}`);
    const rows = byUser(res.body.data.members);
    expect(rows[ACTIVE_OTHER]).not.toHaveProperty('join_request_message');
    expect(rows[CALLER].join_request_message).toBe('mine');
  });
});
