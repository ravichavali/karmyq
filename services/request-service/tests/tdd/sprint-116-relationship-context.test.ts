jest.mock('../../src/db/relationshipContextDb', () => ({
  resolveRequestPair: jest.fn(),
  resolveMatchPair: jest.fn(),
  resolveProviderOfferPair: jest.fn(),
}));

jest.mock('../../src/services/socialGraphContextClient', () => {
  const actual = jest.requireActual('../../src/services/socialGraphContextClient');
  return { ...actual, fetchRelationshipTopology: jest.fn() };
});

import express from 'express';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import {
  resolveMatchPair,
  resolveProviderOfferPair,
  resolveRequestPair,
} from '../../src/db/relationshipContextDb';
import {
  fetchRelationshipTopology,
  RelationshipContextUnavailableError,
} from '../../src/services/socialGraphContextClient';
import relationshipContextRouter from '../../src/routes/relationshipContext';

const REQUEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MATCH = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OFFER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const VIEWER = '11111111-1111-1111-1111-111111111111';
const COUNTERPART = '22222222-2222-2222-2222-222222222222';

const mockRequestPair = resolveRequestPair as jest.MockedFunction<typeof resolveRequestPair>;
const mockMatchPair = resolveMatchPair as jest.MockedFunction<typeof resolveMatchPair>;
const mockProviderPair = resolveProviderOfferPair as jest.MockedFunction<typeof resolveProviderOfferPair>;
const mockTopology = fetchRelationshipTopology as jest.MockedFunction<typeof fetchRelationshipTopology>;

const memberPair = {
  viewerId: VIEWER,
  counterpartId: COUNTERPART,
  requestId: REQUEST,
  visibilityScope: 'community' as const,
  reachability: 'sister_community' as const,
};

const topology = {
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

function appFor(userId = VIEWER) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { userId, email: `${userId}@test.karmyq.com`, communities: [] };
    next();
  });
  app.use('/requests', relationshipContextRouter);
  return app;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockTopology.mockResolvedValue(topology);
});

it('returns strict member context for an eligible pre-offer request', async () => {
  mockRequestPair.mockResolvedValue({ kind: 'ok', pair: memberPair });

  const response = await request(appFor()).get(`/requests/${REQUEST}/relationship-context`);

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    viewer: topology.viewer,
    counterpart: { ...topology.counterpart, role: 'member' },
    request: {
      id: REQUEST,
      visibilityScope: 'community',
      reachability: 'sister_community',
    },
  });
  expect(mockTopology).toHaveBeenCalledWith(VIEWER, COUNTERPART);
});

it('returns no counterpart context for an owner viewing their own pre-offer request', async () => {
  mockRequestPair.mockResolvedValue({ kind: 'no_context' });

  const response = await request(appFor()).get(`/requests/${REQUEST}/relationship-context`);

  expect(response.status).toBe(204);
  expect(mockTopology).not.toHaveBeenCalled();
});

it.each([
  ['not_found', 404, 'NOT_FOUND'],
  ['forbidden', 403, 'FORBIDDEN'],
  ['unavailable', 503, 'RELATIONSHIP_CONTEXT_UNAVAILABLE'],
] as const)('maps %s authorization without calling social graph', async (kind, status, code) => {
  mockRequestPair.mockResolvedValue({ kind } as any);

  const response = await request(appFor()).get(`/requests/${REQUEST}/relationship-context`);

  expect(response.status).toBe(status);
  expect(response.body.error).toBe(code);
  expect(mockTopology).not.toHaveBeenCalled();
});

it('uses the match-bound resolver for reciprocal ordinary-offer review', async () => {
  mockMatchPair.mockResolvedValue({ kind: 'ok', pair: memberPair });

  const response = await request(appFor()).get(
    `/requests/${REQUEST}/matches/${MATCH}/relationship-context`,
  );

  expect(response.status).toBe(200);
  expect(response.body.data.counterpart.role).toBe('member');
  expect(mockMatchPair).toHaveBeenCalledWith(REQUEST, MATCH, VIEWER);
});

it('adds provider role metadata only on requester-facing provider-offer context', async () => {
  mockProviderPair.mockResolvedValue({
    kind: 'ok',
    pair: { ...memberPair, provider: { serviceType: 'tutor' } },
  });

  const response = await request(appFor()).get(
    `/requests/${REQUEST}/provider-offers/${OFFER}/relationship-context`,
  );

  expect(response.status).toBe(200);
  expect(response.body.data.counterpart).toEqual({
    ...topology.counterpart,
    role: 'provider',
    provider: { serviceType: 'tutor' },
  });
  expect(mockProviderPair).toHaveBeenCalledWith(REQUEST, OFFER, VIEWER);
});

it('maps timeout, unavailable, and invalid internal output to a retryable 503', async () => {
  mockRequestPair.mockResolvedValue({ kind: 'ok', pair: memberPair });
  mockTopology.mockRejectedValue(new RelationshipContextUnavailableError());

  const response = await request(appFor()).get(`/requests/${REQUEST}/relationship-context`);

  expect(response.status).toBe(503);
  expect(response.body.error).toBe('RELATIONSHIP_CONTEXT_UNAVAILABLE');
});

it('rejects malformed route IDs and exposes no arbitrary target-user route', async () => {
  const malformed = await request(appFor()).get('/requests/not-a-uuid/relationship-context');
  expect(malformed.status).toBe(400);

  const source = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'src', 'routes', 'relationshipContext.ts'),
    'utf8',
  );
  expect(source).not.toMatch(/targetUserId|relationship-context\/:/);
});
