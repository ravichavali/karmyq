/**
 * Sprint 93 — `community_connection` dibs reason.
 *
 * A neighbour admitted to the mutual-aid dibs pool via an *exchange* trust edge with
 * ZERO completed matches (dibsDb.ts:292-295) was previously labelled `trusted_neighbor`,
 * so DibsPrompt rendered "You've worked with {name} before" — false. The new
 * `community_connection` reason re-labels the zero-history case honestly. Pool admission
 * is unchanged; this only changes the reason label (GET/POST symmetry preserved).
 */

import { deriveDibsReason } from '../../src/services/dibsReason';
import type { RelationshipContext } from '../../src/db/dibsDb';

const ctx = (over: Partial<RelationshipContext> = {}): RelationshipContext => ({
  priorCompletedMatches: 0,
  lastInteractionAt: null,
  similarCategory: false,
  ...over,
});

describe('Sprint 93: deriveDibsReason — community_connection for zero-history neighbours', () => {
  it('zero completed matches → community_connection (not the false "trusted_neighbor")', () => {
    expect(deriveDibsReason('neighbor', ctx({ priorCompletedMatches: 0 }))).toBe('community_connection');
  });

  it('zero completed matches but a similar category → still community_connection (no prior success to claim)', () => {
    expect(deriveDibsReason('neighbor', ctx({ priorCompletedMatches: 0, similarCategory: true }))).toBe('community_connection');
  });

  it('>= 1 completed match without a similar category → trusted_neighbor', () => {
    expect(deriveDibsReason('neighbor', ctx({ priorCompletedMatches: 2, similarCategory: false }))).toBe('trusted_neighbor');
  });

  it('>= 1 completed match with a similar category → prior_similar_success', () => {
    expect(deriveDibsReason('neighbor', ctx({ priorCompletedMatches: 3, similarCategory: true }))).toBe('prior_similar_success');
  });

  it('provider candidate is unchanged → provider_match regardless of history', () => {
    expect(deriveDibsReason('provider', ctx({ priorCompletedMatches: 0 }))).toBe('provider_match');
    expect(deriveDibsReason('provider', ctx({ priorCompletedMatches: 5, similarCategory: true }))).toBe('provider_match');
  });
});
