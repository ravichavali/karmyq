import { NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuthMiddleware, isDemoReadOnlySession } from '../../../middleware/auth';

// verifyTokenWithRotation reads JWT_SECRET at call time, so setting it here is enough.
const secret = 'test-jwt-secret';
process.env.JWT_SECRET = secret;

function makeResMock(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(method: string, payload: Record<string, unknown>): any {
  const token = jwt.sign(payload, secret);
  return { method, headers: { authorization: `Bearer ${token}` } };
}

const demoPayload = {
  userId: 'demo-user',
  email: 'maria.reyes@test.karmyq.com',
  communities: [],
  sessionMode: 'demo_read_only',
};

const ordinaryPayload = {
  userId: 'real-user',
  email: 'real@example.com',
  communities: [],
};

describe('authMiddleware — demo_read_only write guard (Sprint 116)', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'allows read-only method %s for a demo session and attaches req.user',
    (method) => {
      const req = makeReq(method, demoPayload);
      const res = makeResMock();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user?.userId).toBe('demo-user');
      expect(req.user?.sessionMode).toBe('demo_read_only');
    }
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects mutating method %s for a demo session with 403 FORBIDDEN and does not attach req.user',
    (method) => {
      const req = makeReq(method, demoPayload);
      const res = makeResMock();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(body.error).toBe('FORBIDDEN');
      expect(req.user).toBeUndefined();
    }
  );

  it('leaves ordinary (non-demo) POST behavior unchanged — next() is called', () => {
    const req = makeReq('POST', ordinaryPayload);
    const res = makeResMock();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user?.userId).toBe('real-user');
    expect(req.user?.sessionMode).toBeUndefined();
  });
});

describe('optionalAuthMiddleware — demo_read_only write guard (Sprint 116)', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('allows a demo GET and attaches req.user', () => {
    const req = makeReq('GET', demoPayload);
    const res = makeResMock();

    optionalAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user?.sessionMode).toBe('demo_read_only');
  });

  it('rejects a demo POST with 403 FORBIDDEN and does not attach req.user', () => {
    const req = makeReq('POST', demoPayload);
    const res = makeResMock();

    optionalAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(req.user).toBeUndefined();
  });

  it('leaves a no-token request untouched (still optional)', () => {
    const req: any = { method: 'POST', headers: {} };
    const res = makeResMock();

    optionalAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('isDemoReadOnlySession', () => {
  it('is true only for the demo_read_only session mode', () => {
    expect(isDemoReadOnlySession({ sessionMode: 'demo_read_only' })).toBe(true);
    expect(isDemoReadOnlySession({ sessionMode: 'something_else' })).toBe(false);
    expect(isDemoReadOnlySession({})).toBe(false);
    expect(isDemoReadOnlySession(null)).toBe(false);
    expect(isDemoReadOnlySession(undefined)).toBe(false);
  });
});
