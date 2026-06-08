/**
 * Sprint 92 — BUG-007 (Option A reframe): dibs candidates carry a neighbor/provider
 * discriminator so the UI can frame a mutual-aid first-ask as a *neighbor*, not a
 * "provider."
 *
 * - getEligibleCandidates  (service requests)     → kind = 'provider'
 * - getMutualAidCandidates (non-service requests) → kind = 'neighbor'
 *
 * RED before the candidate functions tag `kind`; GREEN after.
 * Run: npm run test:unit -- dibs-candidate-kind
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

import { getEligibleCandidates, getMutualAidCandidates } from '../../src/db/dibsDb';

describe('Sprint 92 BUG-007: dibs candidates carry a neighbor/provider kind', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getEligibleCandidates tags candidates kind="provider"', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        providerId: 'p1', providerUserId: 'u1', displayName: 'P',
        trustScore: 60, priorInteractions: 2, trustGraphConnection: 'direct', isAvailable: true,
      }],
    });
    const [c] = await getEligibleCandidates('requester', ['c1']);
    expect(c.kind).toBe('provider');
  });

  it('getMutualAidCandidates tags candidates kind="neighbor"', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        providerId: 'n1', providerUserId: 'u2', displayName: 'N',
        trustScore: 55, priorInteractions: 1, trustGraphConnection: 'direct',
      }],
    });
    const [c] = await getMutualAidCandidates('requester', ['c1']);
    expect(c.kind).toBe('neighbor');
  });
});
