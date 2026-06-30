jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import axios from 'axios';
import {
  fetchRelationshipTopology,
  RelationshipContextUnavailableError,
} from '../../src/services/socialGraphContextClient';

const VIEWER = '11111111-1111-1111-1111-111111111111';
const COUNTERPART = '22222222-2222-2222-2222-222222222222';
const SECRET = 'request-to-social-secret';
const post = axios.post as jest.MockedFunction<typeof axios.post>;

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

beforeEach(() => {
  jest.resetAllMocks();
  process.env.INTERNAL_SECRET = SECRET;
  process.env.SOCIAL_GRAPH_API_URL = 'http://social-graph-service:3010/';
});

afterAll(() => {
  delete process.env.INTERNAL_SECRET;
  delete process.env.SOCIAL_GRAPH_API_URL;
});

it('uses a 2.5s service-only call and never forwards browser authorization', async () => {
  post.mockResolvedValue({ data: { success: true, data: topology } });

  await expect(fetchRelationshipTopology(VIEWER, COUNTERPART)).resolves.toEqual(topology);
  expect(post).toHaveBeenCalledWith(
    'http://social-graph-service:3010/internal/relationship-context',
    { viewerId: VIEWER, counterpartId: COUNTERPART },
    {
      timeout: 2500,
      headers: { 'x-internal-secret': SECRET },
    },
  );
  expect(JSON.stringify(post.mock.calls[0][2])).not.toMatch(/authorization|bearer/i);
});

it('fails closed before the network call when INTERNAL_SECRET is absent', async () => {
  delete process.env.INTERNAL_SECRET;

  await expect(fetchRelationshipTopology(VIEWER, COUNTERPART)).rejects.toBeInstanceOf(
    RelationshipContextUnavailableError,
  );
  expect(post).not.toHaveBeenCalled();
});

it('maps timeout/unavailable and malformed internal output to the safe unavailable error', async () => {
  post.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
  await expect(fetchRelationshipTopology(VIEWER, COUNTERPART)).rejects.toBeInstanceOf(
    RelationshipContextUnavailableError,
  );

  post.mockResolvedValueOnce({ data: { success: true, data: { ...topology, trust_score: 827 } } });
  await expect(fetchRelationshipTopology(VIEWER, COUNTERPART)).rejects.toBeInstanceOf(
    RelationshipContextUnavailableError,
  );
});
it('rejects a confused-deputy response whose anchors do not match the requested pair', async () => {
  post.mockResolvedValue({
    data: {
      success: true,
      data: { ...topology, viewer: { id: COUNTERPART, name: 'Ben' } },
    },
  });

  await expect(fetchRelationshipTopology(VIEWER, COUNTERPART)).rejects.toBeInstanceOf(
    RelationshipContextUnavailableError,
  );
});
