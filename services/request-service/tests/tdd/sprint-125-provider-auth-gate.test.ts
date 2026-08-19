/**
 * Sprint 125 (ADR-095) — the provider directory requires authentication.
 *
 * Three routes were fully public: `GET /providers`, `GET /providers/:providerId` and
 * `GET /providers/:providerId/rate-cards`. ADR-041 described the directory as "publicly visible",
 * which in practice meant anyone on the internet could enumerate every provider profile in the
 * platform — display name, bio, location notes, pricing, and the owner's user id — without an
 * account. ADR-095 narrows that to "visible to any authenticated member", having verified that no
 * unauthenticated consumer exists (the landing app never calls these routes).
 *
 * This file asserts the REFUSALS. A directory that returns 200 to a logged-in caller proves
 * nothing about whether it also returns 200 to an anonymous one — that is the only question here.
 *
 * Placed in tests/tdd/ per CLAUDE.md ("new sprint tests start in the changed workspace's
 * tests/tdd/"); promote-tdd-tests.js moves it to regression/ once green.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/database/db';
const mockQuery = query as jest.Mock;

const JWT_SECRET = 'test-secret';
const PROVIDER_ID = '33333333-3333-3333-3333-333333333333';

function buildApp() {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const providersRouter = require('../../src/routes/providers').default;
  app.use('/providers', providersRouter);
  return app;
}

const PUBLICLY_READABLE_BEFORE_SPRINT_125 = [
  ['the directory listing', '/providers'],
  ['a single provider profile', `/providers/${PROVIDER_ID}`],
  ['a provider rate card', `/providers/${PROVIDER_ID}/rate-cards`],
] as const;

describe('Provider directory rejects anonymous callers (ADR-095)', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => mockQuery.mockReset());

  it.each(PUBLICLY_READABLE_BEFORE_SPRINT_125)(
    'returns 401 for %s with no Authorization header',
    async (_label, path) => {
      const res = await request(app).get(path);

      expect(res.status).toBe(401);
      // The database must never be touched on behalf of an unauthenticated caller. A 401 rendered
      // after the query already ran would still have leaked the row into the process.
      expect(mockQuery).not.toHaveBeenCalled();
    }
  );

  it.each(PUBLICLY_READABLE_BEFORE_SPRINT_125)(
    'returns 401 for %s with a malformed bearer token',
    async (_label, path) => {
      const res = await request(app).get(path).set('Authorization', 'Bearer not-a-jwt');

      expect(res.status).toBe(401);
      expect(mockQuery).not.toHaveBeenCalled();
    }
  );

  it.each(PUBLICLY_READABLE_BEFORE_SPRINT_125)(
    'returns 401 for %s with a token signed by the wrong secret',
    async (_label, path) => {
      // The forged-token case: a well-formed JWT is not the same as a trusted one.
      const forged = jwt.sign({ userId: 'attacker' }, 'wrong-secret');
      const res = await request(app).get(path).set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(401);
      expect(mockQuery).not.toHaveBeenCalled();
    }
  );
});

describe('Provider directory still serves authenticated callers', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => mockQuery.mockReset());

  const token = () =>
    jwt.sign({ userId: 'user-123', email: 'v@test.com', communities: [] }, JWT_SECRET);

  it('returns the directory to a valid token', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Ali Rickshaw' }] })
      .mockResolvedValueOnce({ rows: [] }); // shared_communities annotation

    const res = await request(app).get('/providers').set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('still annotates shared_communities now that the viewer is always present', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', display_name: 'Ali' }] })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', community_id: 'c1', community_name: 'Riverside' }],
      });

    const res = await request(app).get('/providers').set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].shared_communities).toEqual([{ id: 'c1', name: 'Riverside' }]);
  });
});

describe('decodeOptionalViewer is gone', () => {
  it('is no longer exported or referenced by the providers router', () => {
    // The helper existed only to tolerate an absent token on a public route. With auth required
    // it is dead code, and dead auth-adjacent code is the kind that gets re-wired by accident.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'src', 'routes', 'providers.ts'),
      'utf8'
    );
    expect(source).not.toContain('decodeOptionalViewer');
  });
});
