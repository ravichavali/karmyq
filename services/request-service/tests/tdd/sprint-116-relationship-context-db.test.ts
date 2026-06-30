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
import {
  resolveMatchPair,
  resolveProviderOfferPair,
  resolveRequestPair,
} from '../../src/db/relationshipContextDb';
import { validateRequestForOffer } from '../../src/db/providerOffersDb';

const REQUEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MATCH = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OFFER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const REQUESTER = '11111111-1111-1111-1111-111111111111';
const HELPER = '22222222-2222-2222-2222-222222222222';
const OUTSIDER = '33333333-3333-3333-3333-333333333333';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockReachability = getRequestReachability as jest.MockedFunction<typeof getRequestReachability>;

function reachable(
  reachability: 'same_community' | 'sister_community' | 'trust_network' | 'platform',
  visibilityScope: 'community' | 'trust_network' | 'platform' = 'community',
) {
  return {
    exists: true,
    requesterId: REQUESTER,
    status: 'open',
    expired: false,
    visibilityScope,
    reachable: true,
    reachability,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('resolveRequestPair', () => {
  it.each([
    ['same_community', 'community'],
    ['sister_community', 'community'],
    ['trust_network', 'trust_network'],
    ['platform', 'platform'],
  ] as const)('preserves %s request reachability', async (tier, scope) => {
    mockReachability.mockResolvedValue(reachable(tier, scope));

    await expect(resolveRequestPair(REQUEST, HELPER)).resolves.toEqual({
      kind: 'ok',
      pair: {
        viewerId: HELPER,
        counterpartId: REQUESTER,
        requestId: REQUEST,
        visibilityScope: scope,
        reachability: tier,
      },
    });
  });

  it('returns no context for the request owner and forbids an unreachable member', async () => {
    mockReachability.mockResolvedValueOnce(reachable('same_community'));
    await expect(resolveRequestPair(REQUEST, REQUESTER)).resolves.toEqual({ kind: 'no_context' });

    mockReachability.mockResolvedValueOnce({ ...reachable('same_community'), reachable: false, reachability: null });
    await expect(resolveRequestPair(REQUEST, OUTSIDER)).resolves.toEqual({ kind: 'forbidden' });
  });

  it('does not disclose pre-offer context after the request stops being actionable', async () => {
    mockReachability.mockResolvedValue({ ...reachable('platform', 'platform'), status: 'matched' });

    await expect(resolveRequestPair(REQUEST, HELPER)).resolves.toEqual({ kind: 'forbidden' });
  });
});

describe('participant-bound offer resolvers', () => {
  it('orients an ordinary match around either authenticated participant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ requester_id: REQUESTER, responder_id: HELPER }], rowCount: 1 } as any);
    mockReachability.mockResolvedValue(reachable('sister_community'));

    const requesterView = await resolveMatchPair(REQUEST, MATCH, REQUESTER);
    const helperView = await resolveMatchPair(REQUEST, MATCH, HELPER);

    expect(requesterView).toMatchObject({ kind: 'ok', pair: { viewerId: REQUESTER, counterpartId: HELPER } });
    expect(helperView).toMatchObject({ kind: 'ok', pair: { viewerId: HELPER, counterpartId: REQUESTER } });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('m.id = $2');
    expect(sql).toContain('m.request_id = $1');
    expect(params).toEqual([REQUEST, MATCH]);
  });

  it('returns 404 semantics for a mismatched match/request pair and 403 semantics for a nonparticipant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    await expect(resolveMatchPair(REQUEST, MATCH, REQUESTER)).resolves.toEqual({ kind: 'not_found' });

    mockQuery.mockResolvedValueOnce({ rows: [{ requester_id: REQUESTER, responder_id: HELPER }], rowCount: 1 } as any);
    await expect(resolveMatchPair(REQUEST, MATCH, OUTSIDER)).resolves.toEqual({ kind: 'forbidden' });
  });

  it('does not invent same-community history when a community participant is no longer reachable', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ requester_id: REQUESTER, responder_id: HELPER, visibility_scope: 'community' }],
      rowCount: 1,
    } as any);
    mockReachability.mockResolvedValue({
      ...reachable('same_community'),
      reachable: false,
      reachability: null,
    });

    await expect(resolveMatchPair(REQUEST, MATCH, REQUESTER)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('decorates only the requester-facing provider counterpart', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        requester_id: REQUESTER,
        provider_user_id: HELPER,
        service_type: 'tutor',
      }],
      rowCount: 1,
    } as any);
    mockReachability.mockResolvedValue(reachable('platform', 'platform'));

    const requesterView = await resolveProviderOfferPair(REQUEST, OFFER, REQUESTER);
    const providerView = await resolveProviderOfferPair(REQUEST, OFFER, HELPER);

    expect(requesterView).toMatchObject({
      kind: 'ok',
      pair: {
        viewerId: REQUESTER,
        counterpartId: HELPER,
        provider: { serviceType: 'tutor' },
      },
    });
    expect(providerView).toMatchObject({
      kind: 'ok',
      pair: { viewerId: HELPER, counterpartId: REQUESTER },
    });
    expect((providerView as any).pair.provider).toBeUndefined();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('o.id = $2');
    expect(sql).toContain('o.request_id = $1');
    expect(params).toEqual([REQUEST, OFFER]);
  });

  it('returns 404 for a mismatched provider offer/request and 403 for a nonparticipant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    await expect(resolveProviderOfferPair(REQUEST, OFFER, REQUESTER)).resolves.toEqual({ kind: 'not_found' });

    mockQuery.mockResolvedValueOnce({
      rows: [{ requester_id: REQUESTER, provider_user_id: HELPER, service_type: 'tutor' }],
      rowCount: 1,
    } as any);
    await expect(resolveProviderOfferPair(REQUEST, OFFER, OUTSIDER)).resolves.toEqual({ kind: 'forbidden' });
  });
});

describe('provider offer eligibility uses the common visibility boundary', () => {
  it.each([
    ['sister_community', 'community'],
    ['trust_network', 'trust_network'],
    ['platform', 'platform'],
  ] as const)('allows %s reachability without requiring shared membership SQL', async (tier, scope) => {
    mockReachability.mockResolvedValue(reachable(tier, scope));

    await expect(validateRequestForOffer(REQUEST, HELPER)).resolves.toEqual({ valid: true });
    expect(mockReachability).toHaveBeenCalledWith(REQUEST, HELPER);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each([
    [{ exists: false }, 'Request not found'],
    [{ requesterId: HELPER }, 'You cannot offer on your own request'],
    [{ status: 'matched' }, 'Request is no longer open'],
    [{ expired: true }, 'Request is no longer open'],
    [{ reachable: false, reachability: null }, 'Request is outside your available network'],
  ])('keeps provider lifecycle and audience guards for %o', async (override, reason) => {
    mockReachability.mockResolvedValue({ ...reachable('platform', 'platform'), ...override } as any);

    await expect(validateRequestForOffer(REQUEST, HELPER)).resolves.toEqual({ valid: false, reason });
  });
});
