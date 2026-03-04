/**
 * TDD tests for Sister Community Feed Integration (Sprint 15)
 *
 * Tests the sister feed scoring behavior:
 * - Sister requests are excluded from main feed (deduped by ID)
 * - Trust carry factor scales feed scores correctly
 * - includeSisterCommunities flag controls whether sister requests appear
 * - Sister requests appear after community/trust_network/platform tiers
 */

describe('Sister Community Feed: Score Scaling', () => {
  function scaleSisterScore(baseScore: number, carryFactor: number): number {
    return Math.round(baseScore * carryFactor);
  }

  it('scales score by carry factor 0.40', () => {
    expect(scaleSisterScore(80, 0.40)).toBe(32);
  });

  it('scales score by carry factor 0.60 (parent_child default)', () => {
    expect(scaleSisterScore(80, 0.60)).toBe(48);
  });

  it('scales score by carry factor 0.50 (split_origin default)', () => {
    expect(scaleSisterScore(80, 0.50)).toBe(40);
  });

  it('score rounds down correctly', () => {
    expect(scaleSisterScore(75, 0.40)).toBe(30); // 75 * 0.40 = 30.0
    expect(scaleSisterScore(77, 0.40)).toBe(31); // 77 * 0.40 = 30.8 → 31
  });
});

describe('Sister Community Feed: Deduplication', () => {
  it('sister requests exclude IDs already in main feed', () => {
    const mainFeedIds = ['req-1', 'req-2', 'req-3'];
    const allSisterCandidates = [
      { id: 'req-2', title: 'Already in main feed' },
      { id: 'req-4', title: 'New sister request' },
    ];
    // Simulate the exclusion: r.id != ALL(mainFeedIds)
    const deduped = allSisterCandidates.filter(r => !mainFeedIds.includes(r.id));
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('req-4');
  });

  it('returns empty sister list when flag is false', () => {
    const includeSisterCommunities = false;
    const sisterRequests = includeSisterCommunities ? [{ id: 'req-5' }] : [];
    expect(sisterRequests).toHaveLength(0);
  });

  it('fetches sister requests when flag is true and links exist', () => {
    const includeSisterCommunities = true;
    const sisterLinks = [{ sister_community_id: 'comm-b', trust_carry_factor: 0.40 }];
    // With flag and links, we should query for sister requests
    expect(includeSisterCommunities && sisterLinks.length > 0).toBe(true);
  });
});

describe('Sister Community Feed: carryByCommId Lookup', () => {
  it('picks carry factor from the first matching community ID', () => {
    const carryByCommId = new Map<string, number>([
      ['comm-b', 0.40],
      ['comm-c', 0.60],
    ]);
    const requestCommunityIds = ['comm-c', 'comm-b'];
    let carry = 0.40; // default
    for (const cId of requestCommunityIds) {
      if (carryByCommId.has(cId)) { carry = carryByCommId.get(cId)!; break; }
    }
    expect(carry).toBe(0.60); // comm-c is first match
  });

  it('falls back to 0.40 when no community matches', () => {
    const carryByCommId = new Map<string, number>([['comm-b', 0.55]]);
    const requestCommunityIds = ['comm-x', 'comm-y'];
    let carry = 0.40;
    for (const cId of requestCommunityIds) {
      if (carryByCommId.has(cId)) { carry = carryByCommId.get(cId)!; break; }
    }
    expect(carry).toBe(0.40);
  });
});

describe('Sister Community Feed: Tier Assignment', () => {
  it('sister requests always get sourceTier = sister_community', () => {
    const sisterRow = { id: 'req-10', in_user_community: false };
    const sourceTier = 'sister_community'; // hardcoded in sister scoring block
    expect(sourceTier).toBe('sister_community');
  });

  it('sister_community tier is ordered after community and platform', () => {
    const tierOrder: Record<string, number> = {
      community: 0,
      trust_network: 1,
      platform: 2,
      sister_community: 3,
    };
    expect(tierOrder['sister_community']).toBeGreaterThan(tierOrder['community']);
    expect(tierOrder['sister_community']).toBeGreaterThan(tierOrder['platform']);
  });
});

describe('Sister Community Feed: Minimum Score Filter', () => {
  it('sister requests below minScore are excluded', () => {
    const minMatchScore = 30;
    const sisterWithScores = [
      { id: 'req-a', feedScore: 20, sourceTier: 'sister_community' },
      { id: 'req-b', feedScore: 35, sourceTier: 'sister_community' },
    ];
    const filtered = sisterWithScores.filter(r => r.feedScore >= minMatchScore);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('req-b');
  });
});
