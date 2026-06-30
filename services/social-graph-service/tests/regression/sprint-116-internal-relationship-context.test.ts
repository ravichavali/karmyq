jest.mock('bull', () =>
  jest.fn().mockImplementation(() => ({
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
);

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  },
}));

import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../../src/config/database';
import { buildRelationshipContext } from '../../src/services/relationshipContextService';
import app from '../../src/index';

jest.mock('../../src/services/relationshipContextService', () => {
  const actual = jest.requireActual('../../src/services/relationshipContextService');
  return { ...actual, buildRelationshipContext: jest.fn() };
});

const build = buildRelationshipContext as jest.MockedFunction<typeof buildRelationshipContext>;
const VIEWER = '11111111-1111-1111-1111-111111111111';
const COUNTERPART = '22222222-2222-2222-2222-222222222222';
const SECRET = 'sprint-116-internal-secret';

const projection = {
  viewer: { id: VIEWER, name: 'Asha' },
  counterpart: { id: COUNTERPART, name: 'Ben' },
  path: {
    scope: 'platform' as const,
    degrees: 1,
    nodes: [
      { id: VIEWER, name: 'Asha' },
      { id: COUNTERPART, name: 'Ben' },
    ],
  },
  networks: { viewer: [], counterpart: [], shared: [], truncated: false },
  links: [{
    source: VIEWER,
    target: COUNTERPART,
    relationship_state: 'warm' as const,
    bond_depth: 'growing' as const,
  }],
  summary: 'Asha and Ben have completed help directly.',
};

beforeEach(() => {
  jest.resetAllMocks();
  process.env.INTERNAL_SECRET = SECRET;
  build.mockResolvedValue(projection);
});

afterAll(async () => {
  delete process.env.INTERNAL_SECRET;
  await pool.end();
});

describe('POST /internal/relationship-context', () => {
  it('fails closed with 503 when the server has no internal-secret configuration', async () => {
    delete process.env.INTERNAL_SECRET;

    const response = await request(app)
      .post('/internal/relationship-context')
      .set('x-internal-secret', SECRET)
      .send({ viewerId: VIEWER, counterpartId: COUNTERPART });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      message: 'Internal route unavailable',
      error: 'SERVICE_UNAVAILABLE',
    });
    expect(build).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['wrong', 'not-the-secret'],
  ])('rejects a %s internal secret with 403', async (_label, supplied) => {
    const call = request(app).post('/internal/relationship-context');
    if (supplied) call.set('x-internal-secret', supplied);
    const response = await call.send({ viewerId: VIEWER, counterpartId: COUNTERPART });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('FORBIDDEN');
    expect(build).not.toHaveBeenCalled();
  });

  it('rejects malformed or identical participant IDs before projection', async () => {
    const malformed = await request(app)
      .post('/internal/relationship-context')
      .set('x-internal-secret', SECRET)
      .send({ viewerId: 'not-a-uuid', counterpartId: COUNTERPART });
    const identical = await request(app)
      .post('/internal/relationship-context')
      .set('x-internal-secret', SECRET)
      .send({ viewerId: VIEWER, counterpartId: VIEWER });

    expect(malformed.status).toBe(400);
    expect(identical.status).toBe(400);
    expect(build).not.toHaveBeenCalled();
  });

  it('returns strict topology with the secret and no member JWT', async () => {
    const response = await request(app)
      .post('/internal/relationship-context')
      .set('x-internal-secret', SECRET)
      .send({ viewerId: VIEWER, counterpartId: COUNTERPART });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: projection });
    expect(build).toHaveBeenCalledWith(VIEWER, COUNTERPART, { capPerSide: 8 });
  });

  it('rejects an unsafe projection at the route boundary instead of serializing it', async () => {
    build.mockResolvedValue({ ...projection, trust_score: 827 } as any);

    const response = await request(app)
      .post('/internal/relationship-context')
      .set('x-internal-secret', SECRET)
      .send({ viewerId: VIEWER, counterpartId: COUNTERPART });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('827');
    expect(response.body).toEqual({
      success: false,
      message: 'Unable to build relationship context',
      error: 'INTERNAL_ERROR',
    });
  });
});

describe('public gateway boundary', () => {
  it.each([
    ['nginx.conf', '/api/social-graph/internal/'],
    ['karmyq.com.conf', '/api/social/internal/'],
    ['karmyq.com-http-only.conf', '/api/social/internal/'],
  ])('%s blocks the internal social-graph prefix', (file, publicPrefix) => {
    const root = path.resolve(__dirname, '..', '..', '..', '..');
    const config = fs.readFileSync(path.join(root, 'infrastructure', 'nginx', file), 'utf8');
    const normalizedConfig = config.replace(/\s+/g, ' ');
    expect(config).toContain(`location ^~ ${publicPrefix}`);
    expect(normalizedConfig).toContain(`location ^~ ${publicPrefix} { return 404;`);
  });
});
