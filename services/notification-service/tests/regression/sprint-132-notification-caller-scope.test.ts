/**
 * Sprint 132 PR S — BUG-055 gate: every user-facing notification route acts on the JWT caller only.
 *
 * Before the fix, `GET /notifications/:userId`, `/:userId/unread-count`, `PUT /:userId/read-all` and
 * `GET/PUT /:userId/preferences` trusted the URL id, and `PUT /:notificationId/read` /
 * `DELETE /:notificationId` trusted a BODY `user_id`. Any logged-in user could read or change another
 * user's notifications. RLS does not help: services connect as the table owner.
 *
 * Drives the REAL Express app with the REAL authMiddleware. Only the DB-facing notification helpers,
 * the database and the Bull subscriber are mocked. Every rejection also asserts the helper was never
 * called, and every acceptance asserts the helper received the JWT id and never the attacker-supplied one.
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

jest.mock('../../src/services/notificationService', () => {
  const actual = jest.requireActual('../../src/services/notificationService');
  return {
    ...actual,
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    getUserPreferences: jest.fn(),
    updateGlobalPreferences: jest.fn(),
  };
});

import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/index';
import * as svc from '../../src/services/notificationService';

const m = svc as jest.Mocked<typeof svc>;

const JWT_SECRET = 'bug-055-jwt-secret';
const CALLER = '11111111-1111-1111-1111-111111111111';
const VICTIM = '22222222-2222-2222-2222-222222222222';
const NOTIFICATION = '33333333-3333-3333-3333-333333333333';

function bearer(userId = CALLER): string {
  return `Bearer ${jwt.sign({ userId, email: 'caller@example.com', communities: [] }, JWT_SECRET)}`;
}

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  m.getUserNotifications.mockResolvedValue([] as never);
  m.getUnreadCount.mockResolvedValue(0 as never);
  m.markAllAsRead.mockResolvedValue(0 as never);
  m.getUserPreferences.mockResolvedValue({ in_app_enabled: true } as never);
  m.updateGlobalPreferences.mockResolvedValue({ in_app_enabled: false } as never);
  m.markAsRead.mockResolvedValue({ id: NOTIFICATION } as never);
  m.deleteNotification.mockResolvedValue({ id: NOTIFICATION } as never);
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

type Method = 'get' | 'put';
// [method, path template, the helper that must never see another user's id]
const USER_ROUTES: Array<[Method, (id: string) => string, keyof typeof m]> = [
  ['get', (id) => `/notifications/${id}`, 'getUserNotifications'],
  ['get', (id) => `/notifications/${id}/unread-count`, 'getUnreadCount'],
  ['put', (id) => `/notifications/${id}/read-all`, 'markAllAsRead'],
  ['get', (id) => `/notifications/${id}/preferences`, 'getUserPreferences'],
  ['put', (id) => `/notifications/${id}/preferences`, 'updateGlobalPreferences'],
];

describe('BUG-055: /:userId routes are scoped to the JWT caller', () => {
  it.each(USER_ROUTES)('%s %s → 403 FORBIDDEN for another user id, helper never called', async (method, path, helper) => {
    const response = await request(app)[method](path(VICTIM)).set('Authorization', bearer()).send({ in_app_enabled: false });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: 'Forbidden: user does not match token user',
      error: 'FORBIDDEN',
    });
    expect(m[helper]).not.toHaveBeenCalled();
  });

  it.each(USER_ROUTES)('%s %s → 200 for the caller\'s own id, helper called with exactly the JWT id', async (method, path, helper) => {
    const response = await request(app)[method](path(CALLER)).set('Authorization', bearer()).send({ in_app_enabled: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(m[helper]).toHaveBeenCalled();
    for (const call of (m[helper] as jest.Mock).mock.calls) {
      expect(call[0]).toBe(CALLER);
    }
  });
});

describe('BUG-055: notification-id routes take the owner from the JWT, never the body', () => {
  it.each([
    ['put', `/notifications/${NOTIFICATION}/read`, 'markAsRead'],
    ['delete', `/notifications/${NOTIFICATION}`, 'deleteNotification'],
  ] as const)('%s %s ignores a body user_id naming someone else', async (method, path, helper) => {
    await request(app)[method](path).set('Authorization', bearer()).send({ user_id: VICTIM });

    expect(m[helper]).toHaveBeenCalledTimes(1);
    expect((m[helper] as jest.Mock).mock.calls[0]).toEqual([NOTIFICATION, CALLER]);
  });

  it.each([
    ['put', `/notifications/${NOTIFICATION}/read`, 'markAsRead'],
    ['delete', `/notifications/${NOTIFICATION}`, 'deleteNotification'],
  ] as const)('%s %s works for the owner with no body user_id', async (method, path, helper) => {
    const response = await request(app)[method](path).set('Authorization', bearer()).send({});

    expect(response.status).toBe(200);
    expect((m[helper] as jest.Mock).mock.calls[0]).toEqual([NOTIFICATION, CALLER]);
  });

  it.each([
    ['put', `/notifications/${NOTIFICATION}/read`, 'markAsRead'],
    ['delete', `/notifications/${NOTIFICATION}`, 'deleteNotification'],
  ] as const)('%s %s → 404 when the notification is not the caller\'s', async (method, path, helper) => {
    (m[helper] as jest.Mock).mockResolvedValue(null);

    const response = await request(app)[method](path).set('Authorization', bearer()).send({ user_id: VICTIM });

    expect(response.status).toBe(404);
    expect((m[helper] as jest.Mock).mock.calls[0]).toEqual([NOTIFICATION, CALLER]);
  });
});
