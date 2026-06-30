jest.mock('../../src/database/db', () => ({
  __esModule: true,
  query: jest.fn(),
  default: { query: jest.fn() },
}));

jest.mock('../../src/db/eligibility', () => ({
  getRequestReachability: jest.fn(),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import axios from 'axios';
import { query } from '../../src/database/db';
import { getRequestReachability } from '../../src/db/eligibility';
import {
  resolveMatchPair,
  resolveProviderOfferPair,
} from '../../src/db/relationshipContextDb';
import relationshipContextRouter from '../../src/routes/relationshipContext';
import {
  fetchRelationshipTopology,
  RelationshipContextUnavailableError,
} from '../../src/services/socialGraphContextClient';

const REQUEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MATCH = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OFFER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const REQUESTER = '11111111-1111-1111-1111-111111111111';
const HELPER = '22222222-2222-2222-2222-222222222222';
const post = axios.post as jest.MockedFunction<typeof axios.post>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockReachability = getRequestReachability as jest.MockedFunction<typeof getRequestReachability>;

beforeEach(() => {
  jest.resetAllMocks();
  process.env.INTERNAL_SECRET = 'internal-secret';
  process.env.SOCIAL_GRAPH_API_URL = 'http://social-graph-service:3010';
});

afterAll(() => {
  delete process.env.INTERNAL_SECRET;
  delete process.env.SOCIAL_GRAPH_API_URL;
});

it.each([
  ['ordinary match', 'responder_id', MATCH, resolveMatchPair],
  ['provider offer', 'provider_user_id', OFFER, resolveProviderOfferPair],
] as const)('returns permanent no-context for a historical community-scoped %s', async (
  _label,
  counterpartColumn,
  resourceId,
  resolver,
) => {
  mockQuery.mockResolvedValue({
    rows: [{
      requester_id: REQUESTER,
      [counterpartColumn]: HELPER,
      visibility_scope: 'community',
      service_type: 'tutor',
    }],
    rowCount: 1,
  } as any);
  mockReachability.mockResolvedValue({
    exists: true,
    requesterId: REQUESTER,
    status: 'completed',
    expired: false,
    visibilityScope: 'community',
    reachable: false,
    reachability: null,
  });

  await expect(resolver(REQUEST, resourceId, REQUESTER)).resolves.toEqual({ kind: 'no_context' });
});

it('scopes the expensive request context middleware to the three context routes', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'index.ts'), 'utf8');

  expect(source).toContain("'/requests/:requestId/relationship-context'");
  expect(source).toContain("'/requests/:requestId/matches/:matchId/relationship-context'");
  expect(source).toContain("'/requests/:requestId/provider-offers/:offerId/relationship-context'");
  expect(source).toMatch(/app\.get\(\s*\[/s);
  expect(source).not.toMatch(
    /app\.use\(\s*'\/requests',\s*rateLimiters\.readLight,\s*authMiddleware,\s*optionalTenantMiddleware,\s*dbContextMiddleware/s,
  );
});

it('runs the route-scoped chain once for context and never for ordinary request traffic', async () => {
  const scopedMiddleware = jest.fn((_req, _res, next) => next());
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { userId: REQUESTER };
    next();
  });
  app.get(
    [
      '/requests/:requestId/relationship-context',
      '/requests/:requestId/matches/:matchId/relationship-context',
      '/requests/:requestId/provider-offers/:offerId/relationship-context',
    ],
    scopedMiddleware,
  );
  app.use('/requests', relationshipContextRouter);
  mockReachability.mockResolvedValue({
    exists: true,
    requesterId: HELPER,
    status: 'open',
    expired: false,
    visibilityScope: 'platform',
    reachable: true,
    reachability: 'platform',
  });
  post.mockResolvedValue({
    data: {
      success: true,
      data: {
        viewer: { id: REQUESTER, name: 'Asha' },
        counterpart: { id: HELPER, name: 'Ben' },
        path: { scope: 'platform', degrees: null, nodes: [] },
        networks: { viewer: [], counterpart: [], shared: [], truncated: false },
        links: [],
        summary: 'No completed-help path is visible within 6 degrees.',
      },
    },
  });

  expect((await request(app).get(`/requests/${REQUEST}/relationship-context`)).status).toBe(200);
  expect(scopedMiddleware).toHaveBeenCalledTimes(1);

  expect((await request(app).get(`/requests/${REQUEST}`)).status).toBe(404);
  expect(scopedMiddleware).toHaveBeenCalledTimes(1);
});

it('preserves failure kind/cause and emits diagnostics before returning a safe 503', async () => {
  post.mockResolvedValue({ data: { success: true, data: { malformed: true } } });

  let failure: RelationshipContextUnavailableError | undefined;
  try {
    await fetchRelationshipTopology(REQUESTER, HELPER);
  } catch (error) {
    failure = error as RelationshipContextUnavailableError;
  }
  expect(failure).toBeInstanceOf(RelationshipContextUnavailableError);
  expect(failure).toMatchObject({ kind: 'contract' });
  expect(failure?.cause).toBeInstanceOf(Error);

  const logger = { error: jest.fn(), warn: jest.fn() };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { userId: REQUESTER };
    req.logger = logger;
    next();
  });
  mockReachability.mockResolvedValue({
    exists: true,
    requesterId: HELPER,
    status: 'open',
    expired: false,
    visibilityScope: 'platform',
    reachable: true,
    reachability: 'platform',
  });
  app.use('/requests', relationshipContextRouter);

  const response = await request(app).get(`/requests/${REQUEST}/relationship-context`);

  expect(response.status).toBe(503);
  expect(logger.error).toHaveBeenCalledWith(
    'Relationship context dependency contract failure',
    expect.any(Error),
    expect.objectContaining({ failureKind: 'contract' }),
  );
});
