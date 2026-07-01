jest.mock('../../src/database/db', () => ({
  __esModule: true,
  query: jest.fn(),
  default: { query: jest.fn() },
}));

jest.mock('../../src/db/eligibility', () => ({
  getRequestReachability: jest.fn(),
}));

import { query } from '../../src/database/db';
import { getRequestReachability } from '../../src/db/eligibility';
import { resolveProviderOfferPair } from '../../src/db/relationshipContextDb';

const REQUEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OFFER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const REQUESTER = '11111111-1111-1111-1111-111111111111';
const PROVIDER = '22222222-2222-2222-2222-222222222222';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockReachability = getRequestReachability as jest.MockedFunction<typeof getRequestReachability>;

function reachable() {
  return {
    exists: true,
    requesterId: REQUESTER,
    status: 'open',
    expired: false,
    visibilityScope: 'platform',
    reachable: true,
    reachability: 'platform',
  } as any;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('Sprint 116 — provider-offer context exposes the collective label to the requester', () => {
  it('surfaces the collective name when the provider belongs to one', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        requester_id: REQUESTER,
        provider_user_id: PROVIDER,
        service_type: 'home_repair',
        collective_name: 'Marin Helping Hands',
      }],
      rowCount: 1,
    } as any);
    mockReachability.mockResolvedValue(reachable());

    const requesterView = await resolveProviderOfferPair(REQUEST, OFFER, REQUESTER);

    expect(requesterView).toMatchObject({
      kind: 'ok',
      pair: { provider: { serviceType: 'home_repair', collectiveName: 'Marin Helping Hands' } },
    });
    // The collective comes from a join on the collective-membership tables, not a second query.
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('provider_collective_members');
    expect(sql).toContain('provider_collectives');
  });

  it('omits collectiveName for a solo provider (null collective)', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        requester_id: REQUESTER,
        provider_user_id: PROVIDER,
        service_type: 'home_repair',
        collective_name: null,
      }],
      rowCount: 1,
    } as any);
    mockReachability.mockResolvedValue(reachable());

    const requesterView = await resolveProviderOfferPair(REQUEST, OFFER, REQUESTER);

    expect((requesterView as any).pair.provider).toEqual({ serviceType: 'home_repair' });
    expect((requesterView as any).pair.provider.collectiveName).toBeUndefined();
  });

  it('never leaks the collective to the provider viewing their own offer', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        requester_id: REQUESTER,
        provider_user_id: PROVIDER,
        service_type: 'home_repair',
        collective_name: 'Marin Helping Hands',
      }],
      rowCount: 1,
    } as any);
    mockReachability.mockResolvedValue(reachable());

    const providerView = await resolveProviderOfferPair(REQUEST, OFFER, PROVIDER);

    expect((providerView as any).pair.provider).toBeUndefined();
  });
});
