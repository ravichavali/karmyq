/**
 * Sprint 134 PR A (BUG-063, /code-review) — the export date filter and error contract.
 *
 * - date_start / date_end are calendar dates (YYYY-MM-DD). Anything else is a 400, not a Postgres 500.
 * - date_end includes its whole day (`< end::date + 1`), not just its first instant. Both bounds are always
 *   bound as $2/$3; a missing one is NULL and COALESCEs to an open end.
 * - The ADR-082 community reputation summary ignores the date filter: two overlapping windows could
 *   otherwise be subtracted to recover one member's exact karma, which the >=5 cohort does not stop.
 * - Every error carries an ADR-074 `error` code.
 * Real-SQL semantics are proven by tests/integration/sprint-134-community-export.integration.test.ts.
 */
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {
    query: (...a: any[]) => mockQuery(...a),
    connect: jest.fn().mockResolvedValue({ release: jest.fn(), query: (...a: any[]) => mockQuery(...a) }),
  },
  query: (...a: any[]) => mockQuery(...a),
  initDatabase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/index';

const ADMIN = '11111111-1111-1111-1111-111111111111';
const COMMUNITY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const token = jwt.sign({ userId: ADMIN, email: 'a@example.com', communities: [] }, 'test-secret');

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql: string) => {
    if (/SELECT role FROM communities\.members/.test(sql)) return Promise.resolve({ rows: [{ role: 'admin' }] });
    if (/FROM communities\.communities/.test(sql)) return Promise.resolve({ rows: [{ id: COMMUNITY }] });
    return Promise.resolve({ rows: [] });
  });
});

const getAs = (path: string) =>
  request(app).get(`/communities/${COMMUNITY}/${path}`).set('Authorization', `Bearer ${token}`);
const exportWith = (qs: string) => getAs(`export?format=json&${qs}`);
const callFor = (pattern: RegExp) => mockQuery.mock.calls.find(([sql]) => pattern.test(sql)) as [string, unknown[]];

describe('export date filter (Sprint 134 PR A)', () => {
  it.each(['yesterday', '2026-02-31', '2026-10-01T00:00:00Z', ''])('rejects date_start=%p with 400', async (value) => {
    const res = await exportWith(`date_start=${encodeURIComponent(value)}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'date_start and date_end must be dates (YYYY-MM-DD)', error: 'INVALID_DATE_RANGE' });
  });

  it('rejects a repeated date_end with 400', async () => {
    const res = await exportWith('date_end=2026-10-01&date_end=2026-10-02');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_DATE_RANGE');
  });

  it('binds both bounds in order and includes the whole end day', async () => {
    const res = await exportWith('date_start=2026-10-01&date_end=2026-10-31');
    expect(res.status).toBe(200);
    const [sql, params] = callFor(/FROM communities\.members m\s+JOIN auth\.users/);
    expect(params).toEqual([COMMUNITY, '2026-10-01', '2026-10-31']);
    expect(sql).toContain("AND (m.joined_at >= COALESCE($2::date, '-infinity') AND m.joined_at < COALESCE($3::date + 1, 'infinity'))");
  });

  it('binds a missing bound as NULL, so each bound keeps its own parameter', async () => {
    await exportWith('date_end=2026-10-31');
    expect(callFor(/FROM requests\.help_requests r/)[1]).toEqual([COMMUNITY, null, '2026-10-31']);
    mockQuery.mockClear();
    await exportWith('');
    expect(callFor(/FROM requests\.help_requests r/)[1]).toEqual([COMMUNITY, null, null]);
  });

  it('keeps the community reputation summary all-time, whatever the date filter', async () => {
    await exportWith('date_start=2026-10-01&date_end=2026-10-31');
    const [sql, params] = callFor(/COUNT\(DISTINCT k\.user_id\)/);
    expect(params).toEqual([COMMUNITY]);
    expect(sql).not.toMatch(/k\.created_at|\$2/);
  });
});

describe('export errors carry an ADR-074 code (Sprint 134 PR A)', () => {
  it.each(['export', 'export/members', 'export/activity'])('403 FORBIDDEN for a non-admin on /%s', async (path) => {
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [{ role: 'member' }] }));
    const res = await getAs(path);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, message: 'Only community admins can export data', error: 'FORBIDDEN' });
  });

  it('404 NOT_FOUND when the community row is missing', async () => {
    mockQuery.mockImplementation((sql: string) => Promise.resolve({ rows: /SELECT role/.test(sql) ? [{ role: 'admin' }] : [] }));
    const res = await exportWith('');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Community not found', error: 'NOT_FOUND' });
  });

  it.each([
    ['export', 'Failed to export community data'],
    ['export/members', 'Failed to export members'],
    ['export/activity', 'Failed to export activity report'],
  ])('500 INTERNAL_ERROR when /%s fails', async (path, message) => {
    mockQuery.mockImplementation((sql: string) =>
      /SELECT role/.test(sql) ? Promise.resolve({ rows: [{ role: 'admin' }] }) : Promise.reject(new Error('boom')));
    const res = await getAs(path);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, message, error: 'INTERNAL_ERROR' });
  });
});
