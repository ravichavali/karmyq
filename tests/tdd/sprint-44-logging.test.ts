/**
 * Sprint 44 — Structured Logger Smoke Tests
 *
 * Verifies that the shared logger module works correctly and that
 * requestLoggingMiddleware attaches a logger to the request object.
 */

import express from 'express';
import request from 'supertest';

// Use relative path to avoid @karmyq/shared module resolution in test env
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createLogger, requestLoggingMiddleware } = require('../../packages/shared/dist/utils/logger');

describe('createLogger', () => {
  it('returns a logger with error, info, warn, debug methods', () => {
    const logger = createLogger('test-service');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('logger.error does not throw when called with message only', () => {
    const logger = createLogger('test-service');
    expect(() => logger.error('test error')).not.toThrow();
  });

  it('logger.error does not throw when called with Error object', () => {
    const logger = createLogger('test-service');
    expect(() => logger.error('test error', new Error('underlying'), { service: 'test' })).not.toThrow();
  });

  it('logger.child returns a logger with the same interface', () => {
    const logger = createLogger('test-service');
    const child = logger.child({ requestId: 'req_123' });
    expect(typeof child.error).toBe('function');
    expect(typeof child.info).toBe('function');
  });
});

describe('requestLoggingMiddleware', () => {
  it('attaches logger to req.logger', async () => {
    const app = express();
    const logger = createLogger('test-service');
    app.use(requestLoggingMiddleware(logger));

    let capturedLogger: unknown;
    app.get('/test', (req: any, res) => {
      capturedLogger = req.logger;
      res.json({ ok: true });
    });

    await request(app).get('/test').expect(200);
    expect(capturedLogger).toBeDefined();
    expect(typeof (capturedLogger as any).error).toBe('function');
  });

  it('attaches requestId to req.requestId', async () => {
    const app = express();
    const logger = createLogger('test-service');
    app.use(requestLoggingMiddleware(logger));

    let capturedRequestId: unknown;
    app.get('/test', (req: any, res) => {
      capturedRequestId = req.requestId;
      res.json({ ok: true });
    });

    await request(app).get('/test').expect(200);
    expect(capturedRequestId).toBeDefined();
    expect(typeof capturedRequestId).toBe('string');
  });

  it('uses x-request-id header when provided', async () => {
    const app = express();
    const logger = createLogger('test-service');
    app.use(requestLoggingMiddleware(logger));

    let capturedRequestId: unknown;
    app.get('/test', (req: any, res) => {
      capturedRequestId = req.requestId;
      res.json({ ok: true });
    });

    await request(app)
      .get('/test')
      .set('x-request-id', 'custom-request-id')
      .expect(200);

    expect(capturedRequestId).toBe('custom-request-id');
  });
});
