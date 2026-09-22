import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../../middleware/rateLimit';

/**
 * BUG-049: `keyGenerator` returned `undefined` for anonymous requests, and
 * express-rate-limit has no fallback for an undefined key — so every anonymous
 * caller counted against ONE shared bucket. These tests pin per-IP keying.
 *
 * `trust proxy` is set to 1 here to mirror the demo topology: one nginx hop,
 * appending the real client IP last in X-Forwarded-For.
 */
const buildAnonymousApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(createRateLimiter({ windowMs: 60_000, max: 1, message: 'Slow down' }));
  app.get('/limited', (_req, res) => {
    res.json({ success: true });
  });
  return app;
};

describe('shared rate limiter key generation (BUG-049)', () => {
  it('gives two different client IPs two separate buckets', async () => {
    const app = buildAnonymousApp();

    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(200);
    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(429);

    // The second client has spent nothing; it must still get its own first hit.
    await request(app).get('/limited').set('X-Forwarded-For', '198.51.100.4').expect(200);
  });

  it('ignores a client-supplied X-Forwarded-For prefix, so a spoofer cannot escape its own bucket', async () => {
    const app = buildAnonymousApp();

    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(200);
    // nginx appends the real client LAST; anything the client forged sits to its left.
    await request(app)
      .get('/limited')
      .set('X-Forwarded-For', '9.9.9.9, 203.0.113.9')
      .expect(429);
  });

  it('keys an IPv6 client by its /56 subnet', async () => {
    const app = buildAnonymousApp();

    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8:1234:5600::1').expect(200);
    // Same /56 — a host must not escape its bucket by rotating within its own prefix.
    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8:1234:5622::2').expect(429);
    // Different /56 — a separate bucket.
    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8:9999:0000::1').expect(200);
  });

  it('keys an authenticated request by user id, independent of IP', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use((req, _res, next) => {
      (req as unknown as { user: { userId: string } }).user = { userId: 'user-1' };
      next();
    });
    app.use(createRateLimiter({ windowMs: 60_000, max: 1, message: 'Slow down' }));
    app.get('/limited', (_req, res) => {
      res.json({ success: true });
    });

    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(200);
    // Same user, different IP — still one bucket.
    await request(app).get('/limited').set('X-Forwarded-For', '198.51.100.4').expect(429);
  });
});
