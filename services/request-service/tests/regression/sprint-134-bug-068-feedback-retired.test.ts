/**
 * Sprint 134 PR L, BUG-068: the dead interaction-feedback routes on /matches are retired. POST always 500ed
 * (it selected help_requests.community_id, which does not exist), so requests.interaction_feedback was never
 * written and GET could only ever return empty feedback. Ratings go through reputation-service
 * POST /reputation/feedback (ADR-036). Real app and middleware; only the PostgreSQL boundary is replaced.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
process.env.JWT_SECRET = 'sprint-134-feedback-retired-test-secret';
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {
    query: (...args: any[]) => mockQuery(...args),
    connect: async () => ({ query: (...args: any[]) => mockQuery(...args), release: () => {} }),
  },
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
  initDatabase: jest.fn(),
}));

const REQUESTER = '10000000-0000-4000-8000-000000000001';
const HELPER = '10000000-0000-4000-8000-000000000002';
const MATCH = '40000000-0000-4000-8000-000000000001';
let app: any;
const auth = () => `Bearer ${jwt.sign({ userId: REQUESTER, email: 'r@test.example', communities: [] }, process.env.JWT_SECRET!)}`;
const feedbackSql = () => mockQuery.mock.calls.map(([sql]) => String(sql)).filter((sql) => /interaction_feedback/i.test(sql));

beforeAll(async () => {
  app = (await import('../../src/index')).default;
});
beforeEach(() => {
  mockQuery.mockReset();
  // A completed match the caller took part in: the old routes would have gone on to read or write feedback.
  mockQuery.mockImplementation(async (sql: string) => (/FROM requests\.matches/i.test(sql)
    ? { rowCount: 1, rows: [{ id: MATCH, status: 'completed', requester_id: REQUESTER, responder_id: HELPER, requester_visible: true, responder_visible: true }] }
    : { rowCount: 0, rows: [] }));
});

it.each([
  ['get', undefined],
  ['post', { helpfulness: 5, responsiveness: 4, clarity: 3 }],
] as const)('%s /matches/:id/feedback is gone: the app 404 handler answers and no feedback SQL runs', async (method, body) => {
  const call = request(app)[method](`/matches/${MATCH}/feedback`).set('Authorization', auth());
  const res = body ? await call.send(body) : await call;
  expect(res.status).toBe(404);
  expect(res.body).toMatchObject({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
  expect(feedbackSql()).toEqual([]);
});
