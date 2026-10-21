/**
 * Sprint 134 PR A (BUG-063, /code-review) — the export date filter.
 *
 * - date_start / date_end are calendar dates (YYYY-MM-DD). Anything else is a 400, not a Postgres 500.
 * - date_end includes the whole end day (`< end::date + 1`), not just its first instant.
 * - The ADR-082 community reputation summary ignores the date filter: two overlapping windows could
 *   otherwise be subtracted to recover one member's exact karma, which the >=5 cohort does not stop.
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

const exportWith = (qs: string) =>
  request(app).get(`/communities/${COMMUNITY}/export?format=json&${qs}`).set('Authorization', `Bearer ${token}`);
const callFor = (pattern: RegExp) => mockQuery.mock.calls.find(([sql]) => pattern.test(sql)) as [string, unknown[]];

describe('export date filter (Sprint 134 PR A)', () => {
  it.each(['yesterday', '2026-02-31', '2026-10-01T00:00:00Z', ''])('rejects date_start=%p with 400', async (value) => {
    const res = await exportWith(`date_start=${encodeURIComponent(value)}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'date_start and date_end must be dates (YYYY-MM-DD)', error: 'INVALID_DATE_RANGE' });
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
    expect(sql).toContain('AND (m.joined_at >= $2::date AND m.joined_at < $3::date + 1)');
  });

  it('binds a lone date_end as $2', async () => {
    await exportWith('date_end=2026-10-31');
    const [sql, params] = callFor(/FROM requests\.help_requests r/);
    expect(params).toEqual([COMMUNITY, '2026-10-31']);
    expect(sql).toContain('AND (r.created_at < $2::date + 1)');
  });

  it('keeps the community reputation summary all-time, whatever the date filter', async () => {
    await exportWith('date_start=2026-10-01&date_end=2026-10-31');
    const [sql, params] = callFor(/COUNT\(DISTINCT k\.user_id\)/);
    expect(params).toEqual([COMMUNITY]);
    expect(sql).not.toMatch(/k\.created_at|\$2/);
  });
});
