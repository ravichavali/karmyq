/**
 * Sprint 62: Karma Multipliers TDD tests
 *
 * Tests the allocateKarma() function's per-request-type multiplier logic.
 * These are pure unit tests — no DB or network required.
 */

import { allocateKarma, CommunityKarmaConfig } from '../../src/services/karmaAllocation';

const BASE_CONFIG: CommunityKarmaConfig = {
  community_id: 'comm-1',
  karma_split_helper: 60,
  karma_split_requestor: 40,
};

const CONFIG_WITH_TYPES: CommunityKarmaConfig = {
  ...BASE_CONFIG,
  enabled_request_types: [
    { name: 'ride', karma_multiplier: 2.0 },
    { name: 'generic', karma_multiplier: 1.0 },
  ],
};

describe('Sprint 62: Karma Multipliers', () => {
  it('returns base pool when no requestType provided', () => {
    const allocations = allocateKarma([BASE_CONFIG], 100);
    expect(allocations).toHaveLength(1);
    // With 60/40 split on 100 pool: helper=60, requester=40
    expect(allocations[0].helperPoints + allocations[0].requesterPoints).toBe(100);
  });

  it('returns base pool when community config has no enabled_request_types', () => {
    const allocations = allocateKarma([BASE_CONFIG], 100, 'ride');
    expect(allocations[0].helperPoints + allocations[0].requesterPoints).toBe(100);
  });

  it('applies multiplier when request type matches config entry', () => {
    const allocations = allocateKarma([CONFIG_WITH_TYPES], 100, 'ride');
    // Multiplier = 2.0, so pool per community = 100 * 2.0 = 200
    // helper = 200 * 0.6 = 120, requester = 200 * 0.4 = 80
    expect(allocations[0].helperPoints).toBe(120);
    expect(allocations[0].requesterPoints).toBe(80);
    expect(allocations[0].helperPoints + allocations[0].requesterPoints).toBe(200);
  });

  it('returns base pool when request type has no entry in enabled_request_types', () => {
    const allocations = allocateKarma([CONFIG_WITH_TYPES], 100, 'borrow');
    // 'borrow' not in enabled_request_types → multiplier = 1.0
    expect(allocations[0].helperPoints + allocations[0].requesterPoints).toBe(100);
  });

  it('applies per-community multipliers independently across multiple communities', () => {
    const commA: CommunityKarmaConfig = {
      community_id: 'comm-a',
      karma_split_helper: 50,
      karma_split_requestor: 50,
      enabled_request_types: [{ name: 'ride', karma_multiplier: 2.0 }],
    };
    const commB: CommunityKarmaConfig = {
      community_id: 'comm-b',
      karma_split_helper: 50,
      karma_split_requestor: 50,
      // No multiplier for ride
    };

    const allocations = allocateKarma([commA, commB], 100, 'ride');
    const a = allocations.find(x => x.community_id === 'comm-a')!;
    const b = allocations.find(x => x.community_id === 'comm-b')!;

    // commA: base = 100/2 = 50, multiplier = 2.0 → pool = 100, helper=50, requester=50
    expect(a.helperPoints + a.requesterPoints).toBe(100);
    // commB: base = 100/2 = 50, multiplier = 1.0 → pool = 50, helper=25, requester=25
    expect(b.helperPoints + b.requesterPoints).toBe(50);
  });
});
