/**
 * Sprint 141 (BUG-073, ADR-105): the trust questionnaire (`communities.trust_questions` and its choices, a global
 * table with no community column) is edited by live PLATFORM admins only (a row in `auth.platform_admins`). A
 * community admin, including any community's creator, is refused with the shared body and nothing is written.
 * Communities still answer the questionnaire: the GET stays public.
 *
 * Real router; the PostgreSQL boundary and the live-role module are mocked. Community-service's jest config does not
 * reset mocks between tests, so every mock is reset here. The helper's SQL is proven against the real schema in
 * tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts.
 */
import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...args: any[]) => mockQuery(...args) },
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn({ query: (...args: any[]) => mockQuery(...args) }),
  initDatabase: jest.fn(),
}));
// Automock: every export is a jest.fn (the helper's own cases use jest.requireActual).
jest.mock('../../src/utils/liveRole');

import * as liveRole from '../../src/utils/liveRole';
import trustQuestionsRouter from '../../src/routes/trust-questions';

const actual = jest.requireActual('../../src/utils/liveRole') as typeof liveRole;
const mocked = liveRole as jest.Mocked<typeof liveRole>;

const U = '10000000-0000-4000-8000-000000000001';
const C = '20000000-0000-4000-8000-000000000001';
const Q = '40000000-0000-4000-8000-000000000001';
const CHOICE = '40000000-0000-4000-8000-000000000002';
const ADMIN_OF_C = [{ id: C, name: 'Mine', role: 'admin' }];
const PLATFORM_ADMIN_REQUIRED = { success: false, message: 'Platform admin access required', error: 'PLATFORM_ADMIN_REQUIRED' };

let caller: { userId: string; email: string; communities: unknown[] } | null = null;
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  if (caller) req.user = caller;
  next();
});
app.use('/communities/trust-questions', trustQuestionsRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  for (const fn of Object.values(mocked)) {
    if (typeof fn === 'function' && 'mockReset' in fn) (fn as jest.Mock).mockReset();
  }
  caller = null;
});

type Method = 'get' | 'post' | 'put' | 'delete';
const send = (method: Method, path: string, body: unknown, communities: unknown[] | null) => {
  caller = communities === null ? null : { userId: U, email: 'u@test.example', communities };
  const r = request(app)[method](path);
  return body === undefined ? r : r.send(body as object);
};
const writes = () => mockQuery.mock.calls.map(([sql]) => String(sql))
  .filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql) && /communities\.trust_question/.test(sql));

describe('isLivePlatformAdmin (real module, pg mocked)', () => {
  it('reads auth.platform_admins with the exact SQL and [userId]', async () => {
    expect(await actual.isLivePlatformAdmin(U)).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toBe('SELECT 1 FROM auth.platform_admins WHERE user_id = $1 LIMIT 1');
    expect(mockQuery.mock.calls[0][1]).toEqual([U]);
  });
  it('is true for one grant row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    expect(await actual.isLivePlatformAdmin(U)).toBe(true);
  });
  it('is false without a query for no user', async () => {
    expect(await actual.isLivePlatformAdmin(undefined)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// [method, path, body, the status once past the gate]: the same bodies and statuses as the PR K integration rows C5.
const writeRoutes: Array<[Method, string, unknown, number]> = [
  ['post', '/communities/trust-questions', {}, 400],
  ['put', `/communities/trust-questions/${Q}`, { question_text: 'x' }, 404],
  ['delete', `/communities/trust-questions/${Q}`, undefined, 404],
  ['post', `/communities/trust-questions/${Q}/choices`, {}, 400],
  ['put', `/communities/trust-questions/${Q}/choices/${CHOICE}`, { label: 'x' }, 404],
  ['delete', `/communities/trust-questions/${Q}/choices/${CHOICE}`, undefined, 404],
];

describe('trust-question writes admit platform admins only (BUG-073)', () => {
  it.each(writeRoutes)('%s %s: a live community admin with no platform grant → 403, nothing written', async (method, path, body) => {
    // Every community-role check this module offers says "admin of C".
    mocked.getLiveRole.mockResolvedValue('admin');
    mocked.isLiveAdmin.mockResolvedValue(true);
    mocked.isLivePlatformAdmin.mockResolvedValue(false);
    const res = await send(method, path, body, ADMIN_OF_C);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(PLATFORM_ADMIN_REQUIRED);
    expect(mocked.isLivePlatformAdmin.mock.calls).toEqual([[U]]);
    expect(writes()).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each(writeRoutes)('%s %s: a platform admin with no community role and an empty claim reaches validation', async (method, path, body, passed) => {
    mocked.getLiveRole.mockResolvedValue(null);
    mocked.isLiveAdmin.mockResolvedValue(false);
    mocked.isLivePlatformAdmin.mockResolvedValue(true);
    const res = await send(method, path, body, []);
    expect(res.status).toBe(passed);
    expect(mocked.isLivePlatformAdmin.mock.calls).toEqual([[U]]);
  });

  it.each(writeRoutes)('%s %s: no authenticated user → 401, no role lookup', async (method, path, body) => {
    const res = await send(method, path, body, null);
    expect(res.status).toBe(401);
    expect(mocked.isLivePlatformAdmin).not.toHaveBeenCalled();
  });

  it('a platform admin creating a valid question writes it', async () => {
    mocked.isLivePlatformAdmin.mockResolvedValue(true);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: Q, slug: 's141' }], rowCount: 1 });
    const res = await send('post', '/communities/trust-questions', { slug: 's141', question_text: 'Who?', display_order: 5 }, []);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ question: { id: Q, slug: 's141' } });
    expect(mockQuery.mock.calls[0][0]).toMatch(/^\s*INSERT INTO communities\.trust_questions \(slug, question_text, subtext, display_order\)/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['s141', 'Who?', null, 5]);
  });
});

describe('GET /communities/trust-questions stays public', () => {
  it('answers 200 with no authenticated user, and consults no role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: Q, slug: 's141', choices: [] }], rowCount: 1 });
    const res = await send('get', '/communities/trust-questions', undefined, null);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { questions: [{ id: Q, slug: 's141', choices: [] }] } });
    expect(mocked.isLivePlatformAdmin).not.toHaveBeenCalled();
  });
});
