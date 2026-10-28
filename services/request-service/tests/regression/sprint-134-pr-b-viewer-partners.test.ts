import express from 'express';
import request from 'supertest';

// Sprint 134 PR B: GET /requests/:id gains viewer_partners, the viewer's completed exchanges on this ask.
// These mocked tests pin the SQL contract and the wire shape only. They prove nothing about who
// actually receives a partner: the exposure matrix (requester, completed helpers, rejected helper,
// preferred provider, member, outsider) runs against real SQL in the root
// tests/integration/sprint-134-pr-b-viewer-partners.integration.test.ts (CI-only on Windows).
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), connect: jest.fn() },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: unknown[]) => mockQuery(...args)),
}));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import requestsRouter from '../../src/routes/requests';

const VIEWER = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';
const REQUEST_ID = '33333333-3333-3333-3333-333333333333';
const COMMUNITY = '44444444-4444-4444-4444-444444444444';

function app(caller = VIEWER) {
  const server = express();
  server.use((req: any, _res, next) => {
    req.user = { userId: caller, email: 'caller@example.test', communities: [] };
    next();
  });
  server.use('/requests', requestsRouter);
  return server;
}

function mockDetailRow(row: Record<string, unknown>) {
  mockQuery.mockImplementation(async () => ({
    rowCount: 1,
    rows: [{
      id: REQUEST_ID,
      requester_id: OWNER,
      title: 'Hang a fan',
      status: 'completed',
      expired: false,
      category: 'generic',
      is_directed: false,
      visibility_scope: 'community',
      requester_name: 'Owner',
      viewer_match_id: null,
      viewer_match_status: null,
      ...row,
    }],
  }));
}

function detailSql(): string {
  const call = mockQuery.mock.calls.find(([sql]) => String(sql).includes('/* request-readable */'));
  return String(call?.[0] ?? '');
}

// The partner subquery sits in the SELECT list right after viewer_match_status. Slicing that segment
// lets the assertions prove each predicate belongs to the partner projection, not to some other clause.
function partnerSegment(sql: string): string {
  const start = sql.indexOf('AS viewer_match_status');
  const end = sql.indexOf('AS viewer_partners');
  return start >= 0 && end > start ? sql.slice(start, end) : '';
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /requests/:id viewer_partners SQL contract', () => {
  it('selects partners per completed exchange the viewer took part in, inside the guarded statement', async () => {
    mockDetailRow({});
    await request(app()).get(`/requests/${REQUEST_ID}`);
    const sql = detailSql();
    const segment = partnerSegment(sql);

    expect(sql).toContain('AS viewer_partners');
    expect(segment).toContain("pm.status = 'completed'");
    expect(segment).toContain('/* match-participant */ (r.requester_id = $2 OR pm.responder_id = $2)');
    expect(segment).toContain('CASE WHEN r.requester_id = $2 THEN pm.responder_id ELSE r.requester_id END');
    // rated_by_me is the VIEWER's own rating; a to_user_id test would leak whether the partner rated them.
    expect(segment).toContain('pf.request_match_id = pm.id AND pf.from_user_id = $2');
    expect(segment).toContain('LIMIT 20');
  });

  it('never derives partner status from read permission', async () => {
    mockDetailRow({});
    await request(app()).get(`/requests/${REQUEST_ID}`);
    const sql = detailSql();
    const segment = partnerSegment(sql);

    expect(segment).not.toBe('');
    expect(segment).not.toContain('request-readable');
    // The read guard itself is unchanged and still gates the whole statement.
    expect(sql).toContain('WHERE r.id = $1 AND /* request-readable */');
  });
});

describe('GET /requests/:id viewer_partners wire shape', () => {
  it('defaults viewer_partners to [] when the row carries none', async () => {
    mockDetailRow({});
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.viewer_partners).toEqual([]);
  });

  it('returns the requester every partner in SQL order and strips the raw match columns', async () => {
    const partners = [
      { match_id: 'match-b', user_id: 'user-b', name: 'Bea', completed_at: '2026-10-28T12:00:00',
        rated_by_me: false, rating_community_id: COMMUNITY },
      { match_id: 'match-a', user_id: 'user-a', name: 'Ari', completed_at: '2026-10-27T12:00:00',
        rated_by_me: true, rating_community_id: COMMUNITY },
    ];
    mockDetailRow({ requester_id: VIEWER, viewer_partners: partners });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.viewer_partners).toEqual(partners);
    expect(res.body.data.viewer_relation).toBe('own_request');
    expect(res.body.data.viewer_match).toBeNull();
    expect(res.body.data).not.toHaveProperty('viewer_match_id');
    expect(res.body.data).not.toHaveProperty('viewer_match_status');
  });

  it('returns a completed helper only the requester and leaves the relation not_actionable', async () => {
    const partners = [
      { match_id: 'match-v', user_id: OWNER, name: 'Owner', completed_at: '2026-10-28T12:00:00',
        rated_by_me: false, rating_community_id: COMMUNITY },
    ];
    mockDetailRow({ viewer_partners: partners });
    const res = await request(app()).get(`/requests/${REQUEST_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.viewer_partners).toEqual(partners);
    expect(res.body.data.viewer_relation).toBe('not_actionable');
    expect(res.body.data.viewer_match).toBeNull();
  });
});
