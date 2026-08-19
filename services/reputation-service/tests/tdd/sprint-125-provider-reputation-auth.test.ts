/**
 * Sprint 125 / ADR-095 — the provider surface in reputation-service requires auth too.
 *
 * ADR-095 closed the three provider read routes in request-service. Code review caught that
 * `GET /reputation/provider-trust/:providerId` and `/provider-reviews/:providerId` stayed fully
 * public — the same provider surface, reachable through a different service. Leaving them open
 * would have made ADR-095's central claim false: the directory would still be anonymously
 * enumerable, just one hop sideways.
 *
 * `/provider-reviews` is the sharper of the two: it returns `reviewer_name`, the real names of
 * members who left reviews.
 *
 * These assert the REFUSALS — the only question that matters here.
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
const PROVIDER_ID = '44444444-4444-4444-4444-444444444444';

function buildApp() {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const router = require('../../src/routes/providerReviews').default;
  app.use('/reputation', router);
  return app;
}

const PUBLIC_BEFORE_SPRINT_125 = [
  ['provider trust score', `/reputation/provider-trust/${PROVIDER_ID}`],
  ['provider reviews (leaks reviewer names)', `/reputation/provider-reviews/${PROVIDER_ID}`],
] as const;

describe('Provider reputation reads reject anonymous callers (ADR-095)', () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    app = buildApp();
  });

  afterEach(() => mockQuery.mockReset());

  it.each(PUBLIC_BEFORE_SPRINT_125)('returns 401 for %s with no token', async (_label, path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each(PUBLIC_BEFORE_SPRINT_125)(
    'returns 401 for %s with a token signed by the wrong secret',
    async (_label, path) => {
      const forged = jwt.sign({ userId: 'attacker' }, 'wrong-secret');
      const res = await request(app).get(path).set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(401);
      expect(mockQuery).not.toHaveBeenCalled();
    }
  );

  it('still serves the trust score to an authenticated caller', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ display_name: 'Ali', service_type: 'ride', user_id: 'u1', trust_score: 80 }],
    });
    const token = jwt.sign({ userId: 'u-1', email: 'v@test.com', communities: [] }, JWT_SECRET);

    const res = await request(app)
      .get(`/reputation/provider-trust/${PROVIDER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
