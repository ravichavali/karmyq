/**
 * Sprint 98 — Request-service relationship label truth (BUG-098-004)
 *
 * Audit (checks 4 & 5) found the LIVE data clean, but the candidate-selection SQL did
 * not *enforce* active membership: getMutualAidCandidates / getEligibleCandidates admitted
 * anyone in communities.members of a shared community regardless of status. An inactive
 * (departed/removed) member could then be surfaced as a dibs candidate and labelled
 * `community_connection` — implying a current shared community that no longer exists.
 *
 * Invariant: a neighbour/provider candidate must be an ACTIVE member of a shared community.
 * With that enforced at selection, deriveDibsReason's `community_connection` (the zero-prior
 * fallback) is truthful by construction.
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

import { getEligibleCandidates, getMutualAidCandidates } from '../../src/db/dibsDb';
import { deriveDibsReason } from '../../src/services/dibsReason';
import type { RelationshipContext } from '../../src/db/dibsDb';

const ctx = (over: Partial<RelationshipContext> = {}): RelationshipContext => ({
  priorCompletedMatches: 0,
  lastInteractionAt: null,
  similarCategory: false,
  ...over,
});

describe('Sprint 98: dibs candidate selection requires active shared membership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('getMutualAidCandidates only admits ACTIVE members of a shared community', async () => {
    await getMutualAidCandidates('requester', ['c1']);
    const sql = mockQuery.mock.calls[0][0] as string;
    // The community-membership admission subquery must require active status.
    expect(sql).toContain('communities.members');
    expect(sql).toMatch(/cm\.status\s*=\s*'active'/);
  });

  it('getEligibleCandidates (provider path) only admits ACTIVE members of a shared community', async () => {
    await getEligibleCandidates('requester', ['c1']);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('communities.members');
    expect(sql).toMatch(/cm\.status\s*=\s*'active'/);
  });
});

describe('Sprint 98: deriveDibsReason is truthful given active-only selection', () => {
  it('zero prior completed matches → community_connection (active shared community, no work claimed)', () => {
    expect(deriveDibsReason('neighbor', ctx({ priorCompletedMatches: 0 }))).toBe('community_connection');
  });

  it('a prior completed match in a different category → trusted_neighbor', () => {
    expect(deriveDibsReason('neighbor', ctx({ priorCompletedMatches: 2, similarCategory: false }))).toBe('trusted_neighbor');
  });

  it('a prior completed similar match → prior_similar_success', () => {
    expect(deriveDibsReason('neighbor', ctx({ priorCompletedMatches: 1, similarCategory: true }))).toBe('prior_similar_success');
  });

  it('provider candidate → provider_match (never community_connection)', () => {
    expect(deriveDibsReason('provider', ctx({ priorCompletedMatches: 0 }))).toBe('provider_match');
  });
});
