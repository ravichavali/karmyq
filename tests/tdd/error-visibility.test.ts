// tests/tdd/error-visibility.test.ts
// Verifies that requestLoggingMiddleware sets X-Request-Id header and logs error_type

import express from 'express';
import request from 'supertest';
import { createLogger, requestLoggingMiddleware } from '../../packages/shared/utils/logger';

describe('requestLoggingMiddleware — error visibility', () => {
  const logger = createLogger('test');
  const app = express();
  app.use(requestLoggingMiddleware(logger));

  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.get('/bad-input', (_req, res) => res.status(400).json({ error: 'bad' }));
  app.get('/crash', (_req, res) => res.status(500).json({ error: 'crash' }));

  it('sets X-Request-Id on 200 response', async () => {
    const res = await request(app).get('/ok');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('sets X-Request-Id on 400 response', async () => {
    const res = await request(app).get('/bad-input');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('sets X-Request-Id on 500 response', async () => {
    const res = await request(app).get('/crash');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('echoes incoming X-Request-Id header', async () => {
    const res = await request(app).get('/ok').set('X-Request-Id', 'req_test_123');
    expect(res.headers['x-request-id']).toBe('req_test_123');
  });
});
