import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { sseAuthMiddleware, type SSEAuthenticatedRequest } from '../../src/middleware/sseAuth';
import { sseHandler } from '../../src/routes/notifications';

function createResponse() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.write = jest.fn();
  return res as Response;
}

function createRequest(overrides: Partial<SSEAuthenticatedRequest> = {}): SSEAuthenticatedRequest {
  return {
    headers: {},
    params: {},
    query: {},
    on: jest.fn(),
    ...overrides,
  } as unknown as SSEAuthenticatedRequest;
}

describe('Sprint 81 — SSE auth hardening', () => {
  const CURRENT_SECRET = 'current-secret-for-tests';
  const PREVIOUS_SECRET = 'previous-secret-for-tests';

  beforeEach(() => {
    process.env.JWT_SECRET = CURRENT_SECRET;
    process.env.JWT_SECRET_PREVIOUS = PREVIOUS_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_SECRET_PREVIOUS;
    jest.clearAllMocks();
  });

  it('returns 401 when token is missing', () => {
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    sseAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token is invalid', () => {
    const req = createRequest({
      query: { access_token: 'not-a-jwt' },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    sseAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts valid token via access_token query and sets req.user', () => {
    const token = jwt.sign(
      { userId: 'user-123', email: 'u@example.com', communities: [] },
      CURRENT_SECRET
    );
    const req = createRequest({
      query: { access_token: token },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    sseAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.userId).toBe('user-123');
  });

  it('accepts token signed with JWT_SECRET_PREVIOUS', () => {
    const token = jwt.sign(
      { userId: 'legacy-user', email: 'legacy@example.com', communities: [] },
      PREVIOUS_SECRET
    );
    const req = createRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    sseAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.userId).toBe('legacy-user');
  });

  it('returns 403 when legacy path userId does not match token userId', () => {
    const req = createRequest({
      params: { userId: 'target-user' },
      user: {
        userId: 'different-user',
        email: 'd@example.com',
        communities: [],
      },
    });
    const res = createResponse();

    sseHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FORBIDDEN' })
    );
  });
});

