jest.mock('../../src/database/db', () => ({
  __esModule: true,
  query: jest.fn(),
  default: { query: jest.fn() },
}));

import { query } from '../../src/database/db';
import { getRequestReachability } from '../../src/db/eligibility';

const mockQuery = query as jest.MockedFunction<typeof query>;
const REQUEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const VIEWER = '11111111-1111-1111-1111-111111111111';

beforeEach(() => jest.resetAllMocks());

it.each([
  [{ is_member: true, sister_reachable: false, visibility_scope: 'platform' }, 'same_community'],
  [{ is_member: false, sister_reachable: true, visibility_scope: 'platform' }, 'sister_community'],
  [{ is_member: false, sister_reachable: false, visibility_scope: 'trust_network' }, 'trust_network'],
  [{ is_member: false, sister_reachable: false, visibility_scope: 'platform' }, 'platform'],
] as const)('derives the most local truthful reachability tier from %o', async (row, expected) => {
  mockQuery.mockResolvedValue({
    rowCount: 1,
    rows: [{
      requester_id: '22222222-2222-2222-2222-222222222222',
      status: 'open',
      expired: false,
      ...row,
    }],
  } as any);

  const result = await getRequestReachability(REQUEST, VIEWER);

  expect(result.reachable).toBe(true);
  expect(result.reachability).toBe(expected);
});

it('returns no reachability tier when a community-scoped request is outside the viewer network', async () => {
  mockQuery.mockResolvedValue({
    rowCount: 1,
    rows: [{
      requester_id: '22222222-2222-2222-2222-222222222222',
      status: 'open',
      expired: false,
      visibility_scope: 'community',
      is_member: false,
      sister_reachable: false,
    }],
  } as any);

  await expect(getRequestReachability(REQUEST, VIEWER)).resolves.toMatchObject({
    reachable: false,
    reachability: null,
  });
});
