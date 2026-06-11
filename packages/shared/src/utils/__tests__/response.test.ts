import {
  sendConflict,
  sendError,
  sendForbidden,
  sendInternalError,
  sendNotFound,
  sendUnauthorized,
  sendValidationError,
} from '../../../utils/response';

function makeResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function bodyFrom(res: any) {
  return res.json.mock.calls[0][0];
}

describe('error response helpers', () => {
  it('sendError emits string error code with top-level message and details', () => {
    const res = makeResponse();

    sendError(res as any, 'VALIDATION_ERROR', 'Email is required', 400, { field: 'email' }, { requestId: 'req-1' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bodyFrom(res)).toMatchObject({
      success: false,
      message: 'Email is required',
      error: 'VALIDATION_ERROR',
      details: { field: 'email' },
      meta: {
        requestId: 'req-1',
      },
    });
    expect(typeof bodyFrom(res).error).toBe('string');
  });

  it('wrapper helpers preserve the canonical error shape', () => {
    const cases: Array<[string, (res: any) => void, number, string]> = [
      ['validation', res => sendValidationError(res, 'Invalid input'), 400, 'VALIDATION_ERROR'],
      ['not found', res => sendNotFound(res, 'User'), 404, 'NOT_FOUND'],
      ['unauthorized', res => sendUnauthorized(res, 'Missing token'), 401, 'UNAUTHORIZED'],
      ['forbidden', res => sendForbidden(res, 'Admins only'), 403, 'FORBIDDEN'],
      ['conflict', res => sendConflict(res, 'Email exists'), 409, 'CONFLICT'],
    ];

    for (const [_name, call, statusCode, code] of cases) {
      const res = makeResponse();

      call(res);

      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(bodyFrom(res).success).toBe(false);
      expect(bodyFrom(res).error).toBe(code);
      expect(typeof bodyFrom(res).message).toBe('string');
    }
  });

  it('sendInternalError keeps dev stack out of the error field', () => {
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = makeResponse();
    const error = new Error('boom');

    try {
      sendInternalError(res as any, 'Database failed', error, { requestId: 'req-2' });
    } finally {
      process.env.NODE_ENV = oldNodeEnv;
    }

    expect(res.status).toHaveBeenCalledWith(500);
    expect(bodyFrom(res)).toMatchObject({
      success: false,
      message: 'Database failed',
      error: 'INTERNAL_ERROR',
      details: {
        stack: expect.stringContaining('boom'),
      },
      meta: {
        requestId: 'req-2',
      },
    });
    expect(typeof bodyFrom(res).error).toBe('string');
  });
});
