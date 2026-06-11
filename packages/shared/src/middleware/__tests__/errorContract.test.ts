import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createRateLimiter } from '../../../middleware/rateLimit';
import { adminOnlyMiddleware, tenantMiddleware } from '../../../middleware/tenant';
import { validate, validateMultiple } from '../../../middleware/validate';

function makeResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function bodyFrom(res: any) {
  return res.json.mock.calls[0][0];
}

describe('shared middleware error contract', () => {
  it('validate returns VALIDATION_ERROR with top-level message and details', async () => {
    const req = { body: {} } as any;
    const res = makeResponse();
    const next = jest.fn();
    const middleware = validate(z.object({ email: z.string().email() }));

    await middleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(bodyFrom(res)).toMatchObject({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      details: expect.any(Array),
    });
  });

  it('validateMultiple returns VALIDATION_ERROR with top-level message and details', async () => {
    const req = { params: {}, body: {} } as any;
    const res = makeResponse();
    const next = jest.fn();
    const middleware = validateMultiple({
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ name: z.string().min(2) }),
    });

    await middleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(bodyFrom(res)).toMatchObject({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      details: expect.any(Array),
    });
  });

  it('tenantMiddleware returns stable string error codes', () => {
    const req = { headers: {}, query: {}, body: {}, params: {} } as any;
    const res = makeResponse();
    const next = jest.fn();

    tenantMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(bodyFrom(res)).toMatchObject({
      success: false,
      message: 'Authentication required',
      error: 'UNAUTHORIZED',
    });
  });

  it('adminOnlyMiddleware returns FORBIDDEN with a top-level message', () => {
    const req = { communityRole: 'member' } as any;
    const res = makeResponse();
    const next = jest.fn();

    adminOnlyMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(bodyFrom(res)).toMatchObject({
      success: false,
      message: 'This action requires community admin privileges',
      error: 'FORBIDDEN',
    });
  });

  it('rate limiter returns RATE_LIMIT_EXCEEDED with top-level retry metadata', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60 * 1000, max: 1, message: 'Slow down' }));
    app.get('/limited', (_req, res) => res.json({ success: true }));

    await request(app).get('/limited').expect(200);
    const response = await request(app).get('/limited').expect(429);

    expect(response.body).toMatchObject({
      success: false,
      message: 'Slow down',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  });
});
