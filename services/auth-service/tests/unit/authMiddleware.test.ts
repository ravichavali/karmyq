import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../../../packages/shared/middleware/auth';

const secret = process.env.JWT_SECRET!;

function makeResMock(): Partial<Response> {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('valid token — calls next() and populates req.user with userId', () => {
    const token = jwt.sign(
      { userId: 'u1', email: 'x@x.com', communities: [] },
      secret
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = makeResMock() as Response;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.userId).toBe('u1');
  });

  it('valid token — req.user.communities is the decoded array', () => {
    const communities = [{ id: 'c1', name: 'Test', role: 'admin' as const }];
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities }, secret);
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = makeResMock() as Response;

    authMiddleware(req, res, next);

    expect(req.user?.communities).toHaveLength(1);
    expect(req.user?.communities[0].role).toBe('admin');
  });

  it('missing Authorization header — returns 401', () => {
    const req = { headers: {} } as any;
    const res = makeResMock() as Response;

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('Authorization header without Bearer prefix — returns 401', () => {
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities: [] }, secret);
    const req = { headers: { authorization: token } } as any;
    const res = makeResMock() as Response;

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('expired token — returns 401 with session expired message', () => {
    const token = jwt.sign(
      { userId: 'u1', email: 'x@x.com', communities: [] },
      secret,
      { expiresIn: -1 }
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = makeResMock() as Response;

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.error.message).toContain('expired');
  });

  it('tampered token — returns 401', () => {
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities: [] }, 'wrong-secret');
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = makeResMock() as Response;

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
