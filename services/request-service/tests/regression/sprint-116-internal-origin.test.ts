jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import axios from 'axios';
import {
  fetchRelationshipTopology,
  RelationshipContextUnavailableError,
} from '../../src/services/socialGraphContextClient';

const post = axios.post as jest.MockedFunction<typeof axios.post>;
const VIEWER = '11111111-1111-1111-1111-111111111111';
const COUNTERPART = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.resetAllMocks();
  process.env.INTERNAL_SECRET = 'internal-secret';
});

afterEach(() => {
  delete process.env.INTERNAL_SECRET;
  delete process.env.SOCIAL_GRAPH_API_URL;
});

it('rejects an unrecognized social-graph origin before making a request', async () => {
  process.env.SOCIAL_GRAPH_API_URL = 'https://attacker.example';

  await expect(fetchRelationshipTopology(VIEWER, COUNTERPART)).rejects.toMatchObject<
    Partial<RelationshipContextUnavailableError>
  >({
    name: 'RelationshipContextUnavailableError',
    kind: 'configuration',
  });
  expect(post).not.toHaveBeenCalled();
});
