/**
 * Sprint 131 — BUG-051 regression gate: the internal push route must fail CLOSED.
 *
 * `POST /notifications/push/send` is mounted ahead of `authMiddleware` and is reachable from the
 * public internet through nginx (`location ~ ^/api/notifications(/.*)?$`). Its only credential is
 * the internal-secret header, so an unconfigured server must REFUSE the request rather than wave
 * it through. The original guard read `if (secret && supplied !== secret)`, which passed every
 * request when `INTERNAL_SECRET` was unset — and no Compose file ever set it for this service.
 *
 * These assertions drive the REAL Express app with the REAL guard. Only the push transport
 * (`sendPushToUsers`), the database and the Bull subscriber are mocked, so no assertion here can
 * pass because a stub said so. Every rejection additionally asserts the transport was never
 * invoked: a status code alone would not prove the guard ran BEFORE the handler, and mount order
 * is the half of BUG-051 that a status-only check cannot see.
 */

jest.mock('../../src/database/db', () => {
  const pool = { query: jest.fn(), end: jest.fn(), on: jest.fn() };
  return { __esModule: true, default: pool, query: jest.fn(), getClient: jest.fn() };
});

jest.mock('../../src/events/subscriber', () => ({
  __esModule: true,
  default: { process: jest.fn(), on: jest.fn(), close: jest.fn() },
  initEventSubscriber: jest.fn(),
}));

jest.mock('../../src/lib/expoPush', () => ({
  __esModule: true,
  sendPushToUsers: jest.fn(),
}));

import request from 'supertest';
import app from '../../src/index';
import { sendPushToUsers } from '../../src/lib/expoPush';

const sendPush = sendPushToUsers as jest.MockedFunction<typeof sendPushToUsers>;

const SECRET = 'bug-051-internal-secret-value';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const PAYLOAD = { user_ids: [USER_ID], title: 'Community update', body: 'A neighbour replied' };

// Root jest config sets resetMocks, which wipes module-scope implementations before each test.
beforeEach(() => {
  process.env.INTERNAL_SECRET = SECRET;
  sendPush.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.INTERNAL_SECRET;
});

describe('POST /notifications/push/send — internal guard', () => {
  it('fails closed with 503 when the server has no INTERNAL_SECRET configured', async () => {
    delete process.env.INTERNAL_SECRET;

    const response = await request(app)
      .post('/notifications/push/send')
      .set('x-internal-secret', SECRET)
      .send(PAYLOAD);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      message: 'Internal route unavailable',
      error: 'SERVICE_UNAVAILABLE',
    });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when INTERNAL_SECRET is configured but empty', async () => {
    process.env.INTERNAL_SECRET = '';

    const response = await request(app)
      .post('/notifications/push/send')
      .set('x-internal-secret', '')
      .send(PAYLOAD);

    expect(response.status).toBe(503);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('rejects an anonymous caller with 403 when the secret IS configured', async () => {
    const response = await request(app).post('/notifications/push/send').send(PAYLOAD);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: 'Forbidden',
      error: 'FORBIDDEN',
    });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret of identical length, exercising the digest comparison', async () => {
    const wrong = 'x'.repeat(SECRET.length);
    expect(wrong).toHaveLength(SECRET.length);

    const response = await request(app)
      .post('/notifications/push/send')
      .set('x-internal-secret', wrong)
      .send(PAYLOAD);

    expect(response.status).toBe(403);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret of different length without throwing', async () => {
    const response = await request(app)
      .post('/notifications/push/send')
      .set('x-internal-secret', 'short')
      .send(PAYLOAD);

    expect(response.status).toBe(403);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('never leaks the configured secret in a rejection body', async () => {
    const response = await request(app)
      .post('/notifications/push/send')
      .set('x-internal-secret', 'wrong')
      .send(PAYLOAD);

    expect(JSON.stringify(response.body)).not.toContain(SECRET);
  });

  it('admits the correct secret and forwards the exact payload to the transport', async () => {
    const data = { requestId: 'abc' };

    const response = await request(app)
      .post('/notifications/push/send')
      .set('x-internal-secret', SECRET)
      .send({ ...PAYLOAD, data });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: {} });
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith([USER_ID], PAYLOAD.title, PAYLOAD.body, data);
  });

  it('still validates the body AFTER the guard admits the caller', async () => {
    const response = await request(app)
      .post('/notifications/push/send')
      .set('x-internal-secret', SECRET)
      .send({ user_ids: [], title: '', body: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('MISSING_FIELDS');
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('guards the route ahead of JWT auth, so no Authorization header can bypass it', async () => {
    // The push router is mounted before authMiddleware; a bearer token must not change the verdict.
    const response = await request(app)
      .post('/notifications/push/send')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(PAYLOAD);

    expect(response.status).toBe(403);
    expect(sendPush).not.toHaveBeenCalled();
  });
});

/**
 * Blast radius. The push router is mounted at `/notifications`, NOT at `/notifications/push`, so a
 * `router.use(internalAuth)` would gate every sibling route under that prefix — the authenticated
 * list, unread-count and preferences routes that are meant to fall through to the next mount.
 *
 * That mistake is invisible while INTERNAL_SECRET is unset, because the guard's 403 branch is
 * unreachable; wiring the secret in (the other half of BUG-051) is exactly what arms it. It would
 * have answered 403 to every notifications read on the platform. The guard is therefore attached
 * to the single route, and these assertions hold the line.
 */
describe('the internal guard does not leak onto sibling /notifications routes', () => {
  const OTHER_ROUTES = [
    '/notifications/11111111-1111-1111-1111-111111111111',
    '/notifications/11111111-1111-1111-1111-111111111111/unread-count',
    '/notifications/preferences',
  ];

  it.each(OTHER_ROUTES)(
    'GET %s is not answered by the internal guard when the secret IS configured',
    async (path) => {
      process.env.INTERNAL_SECRET = SECRET;

      const response = await request(app).get(path);

      // Whatever these routes answer (401 from authMiddleware, etc.), it must not be the internal
      // guard's verdict — reaching authMiddleware at all proves the guard did not intercept.
      expect(response.body?.error).not.toBe('FORBIDDEN');
      expect(response.body?.error).not.toBe('SERVICE_UNAVAILABLE');
      expect(response.status).not.toBe(503);
    },
  );

  it.each(OTHER_ROUTES)(
    'GET %s is not turned into a 503 when INTERNAL_SECRET is unset',
    async (path) => {
      delete process.env.INTERNAL_SECRET;

      const response = await request(app).get(path);

      expect(response.status).not.toBe(503);
      expect(response.body?.error).not.toBe('SERVICE_UNAVAILABLE');
    },
  );
});
