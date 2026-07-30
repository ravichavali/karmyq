import express from 'express';
import request from 'supertest';
import { normalizeRequestBody } from '@karmyq/shared/middleware';

/**
 * Express 5 regression guard — the one this sprint actually shipped a 500 for.
 *
 * body-parser 1 (Express 4) set `req.body = {}` for every request, even one with no body.
 * body-parser 2 (Express 5) leaves it **undefined** unless a body was actually parsed. 76
 * handlers across 7 services do `const { x } = req.body`, which throws a TypeError on a
 * bodyless request and surfaces as a 500 — caught in CI by
 * `community-flow.integration.test.ts` (`POST /communities/:id/join` sends no body).
 *
 * `normalizeRequestBody` restores the Express 4 default in one place. These tests pin both
 * halves: that the raw Express 5 behaviour is what we think it is, and that the middleware
 * fixes it without disturbing real bodies.
 */

describe('Sprint 122 — express 5 leaves req.body undefined without the shim', () => {
  it('reproduces the raw express 5 behaviour: bodyless POST destructure throws', async () => {
    const app = express();
    app.use(express.json());
    app.post('/join', (req, res) => {
      // Exactly the shape of services/community-service/src/routes/members.ts:58
      const { message } = req.body as { message?: string };
      res.json({ ok: true, message: message ?? null });
    });
    // No .send() — same as the integration test's join call.
    const res = await request(app).post('/join');
    expect(res.status).toBe(500);
  });

  it('normalizeRequestBody restores the express 4 default so the same handler returns 200', async () => {
    const app = express();
    app.use(express.json());
    app.use(normalizeRequestBody);
    app.post('/join', (req, res) => {
      const { message } = req.body as { message?: string };
      res.json({ ok: true, message: message ?? null });
    });

    const res = await request(app).post('/join');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: null });
  });

  it('does not disturb a real JSON body', async () => {
    const app = express();
    app.use(express.json());
    app.use(normalizeRequestBody);
    app.post('/echo', (req, res) => {
      res.json({ got: req.body });
    });

    const res = await request(app).post('/echo').send({ message: 'hello', n: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ got: { message: 'hello', n: 1 } });
  });

  it('does not flatten a parsed array body into {}', async () => {
    const app = express();
    app.use(express.json());
    app.use(normalizeRequestBody);
    app.post('/echo', (req, res) => {
      res.json({ isArray: Array.isArray(req.body), got: req.body });
    });

    const res = await request(app).post('/echo').send([1, 2, 3]);
    expect(res.status).toBe(200);
    // An array body must survive as an array, not be flattened into {}.
    expect(res.body.isArray).toBe(true);
    expect(res.body.got).toEqual([1, 2, 3]);
  });

  it('preserves an explicit null body when a parser is configured to allow one', async () => {
    // Under the DEFAULT `strict: true`, express.json() rejects a bare `null` with 400
    // entity.parse.failed and this middleware never runs — so the only way to prove the
    // `undefined`-only guard actually distinguishes null from missing is `strict: false`.
    // Every Karmyq service uses the strict default; this pins the guard's semantics so a
    // future service opting into strict:false does not silently get `null` rewritten to {}.
    const app = express();
    app.use(express.json({ strict: false }));
    app.use(normalizeRequestBody);
    app.post('/echo', (req, res) => {
      res.json({ isNull: req.body === null, type: typeof req.body });
    });

    const res = await request(app).post('/echo').set('Content-Type', 'application/json').send('null');
    expect(res.status).toBe(200);
    expect(res.body.isNull).toBe(true);
  });

  it('confirms the strict default rejects an explicit null before this middleware runs', async () => {
    // Documents why the test above needs strict:false, so the pair cannot drift apart.
    let reached = false;
    const app = express();
    app.use(express.json());
    app.use((_req, _res, next) => {
      reached = true;
      next();
    });
    app.post('/echo', (_req, res) => res.json({ ok: true }));

    const res = await request(app).post('/echo').set('Content-Type', 'application/json').send('null');
    expect(res.status).toBe(400);
    expect(reached).toBe(false);
  });

  it('leaves GET requests with a normalized body rather than undefined', async () => {
    const app = express();
    app.use(express.json());
    app.use(normalizeRequestBody);
    app.get('/read', (req, res) => {
      res.json({ typeofBody: typeof req.body, body: req.body });
    });

    const res = await request(app).get('/read');
    expect(res.status).toBe(200);
    expect(res.body.typeofBody).toBe('object');
    expect(res.body.body).toEqual({});
  });
});
