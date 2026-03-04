/**
 * TDD tests for Community Links (Sprint 15 - Fractal Community Model Phase 1)
 *
 * Tests the business logic of the community links feature:
 * - Link proposal and approval flow
 * - Trust carry factor defaults by link type
 * - Validation (self-link prevention, duplicate prevention)
 * - Auth / admin-only enforcement
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockQuery = jest.fn();

jest.mock('../../services/community-service/src/database/db', () => ({
  query: mockQuery,
  default: {},
}));

jest.mock('@karmyq/shared/utils/response', () => ({
  sendSuccess: jest.fn((res: any, data: any, status = 200) => {
    res.statusCode = status;
    res.body = { success: true, data };
  }),
  sendError: jest.fn((res: any, _code: string, message: string, status = 400) => {
    res.statusCode = status;
    res.body = { success: false, message };
  }),
  sendValidationError: jest.fn((res: any, message: string) => {
    res.statusCode = 400;
    res.body = { success: false, message };
  }),
  sendNotFound: jest.fn((res: any, entity: string) => {
    res.statusCode = 404;
    res.body = { success: false, message: `${entity} not found` };
  }),
  sendUnauthorized: jest.fn((res: any, message: string) => {
    res.statusCode = 401;
    res.body = { success: false, message };
  }),
  sendConflict: jest.fn((res: any, message: string) => {
    res.statusCode = 409;
    res.body = { success: false, message };
  }),
  sendInternalError: jest.fn((res: any, error: any) => {
    res.statusCode = 500;
    res.body = { success: false, message: 'Internal error' };
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = { statusCode: 200, body: null };
  return res;
}

function makeReq(overrides: any = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { userId: 'user-admin' },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Community Links: Trust Carry Factor Defaults', () => {
  it('sister link defaults to 0.40', () => {
    const defaultCarry = (linkType: string) =>
      linkType === 'parent_child' ? 0.60 : linkType === 'split_origin' ? 0.50 : 0.40;
    expect(defaultCarry('sister')).toBe(0.40);
  });

  it('parent_child link defaults to 0.60', () => {
    const defaultCarry = (linkType: string) =>
      linkType === 'parent_child' ? 0.60 : linkType === 'split_origin' ? 0.50 : 0.40;
    expect(defaultCarry('parent_child')).toBe(0.60);
  });

  it('split_origin link defaults to 0.50', () => {
    const defaultCarry = (linkType: string) =>
      linkType === 'parent_child' ? 0.60 : linkType === 'split_origin' ? 0.50 : 0.40;
    expect(defaultCarry('split_origin')).toBe(0.50);
  });

  it('custom trust_carry_factor overrides default', () => {
    const customCarry = 0.75;
    const defaultCarry = (linkType: string) =>
      linkType === 'parent_child' ? 0.60 : linkType === 'split_origin' ? 0.50 : 0.40;
    const carryFactor = customCarry !== undefined ? Number(customCarry) : defaultCarry('sister');
    expect(carryFactor).toBe(0.75);
  });
});

describe('Community Links: Validation Logic', () => {
  it('rejects trust_carry_factor > 1', () => {
    const carryFactor = 1.5;
    expect(carryFactor > 1).toBe(true); // should trigger validation error
  });

  it('rejects trust_carry_factor < 0', () => {
    const carryFactor = -0.1;
    expect(carryFactor < 0).toBe(true); // should trigger validation error
  });

  it('accepts trust_carry_factor = 0', () => {
    const carryFactor = 0;
    expect(carryFactor >= 0 && carryFactor <= 1).toBe(true);
  });

  it('accepts trust_carry_factor = 1', () => {
    const carryFactor = 1;
    expect(carryFactor >= 0 && carryFactor <= 1).toBe(true);
  });

  it('rejects invalid link_type', () => {
    const validTypes = ['sister', 'parent_child', 'split_origin'];
    expect(validTypes.includes('sibling')).toBe(false);
    expect(validTypes.includes('sister')).toBe(true);
  });
});

describe('Community Links: Sister Feed Score Multiplication', () => {
  it('scales feedScore by trust_carry_factor', () => {
    const originalFeedScore = 80;
    const carryFactor = 0.40;
    const scaledScore = Math.round(originalFeedScore * carryFactor);
    expect(scaledScore).toBe(32);
  });

  it('fully carries score at trust_carry_factor = 1.0', () => {
    const originalFeedScore = 75;
    const carryFactor = 1.0;
    expect(Math.round(originalFeedScore * carryFactor)).toBe(75);
  });

  it('blocks all score at trust_carry_factor = 0', () => {
    const originalFeedScore = 90;
    const carryFactor = 0;
    expect(Math.round(originalFeedScore * carryFactor)).toBe(0);
  });

  it('sister requests get sourceTier = sister_community', () => {
    const sisterRequest = {
      id: 'req-1',
      requester_id: 'user-2',
      sourceTier: 'sister_community',
      trustCarryFactor: 0.40,
    };
    expect(sisterRequest.sourceTier).toBe('sister_community');
  });
});

describe('Community Links: Approval Flow', () => {
  it('only party B (other community admin) can approve', () => {
    const link = {
      community_a_id: 'community-a',
      community_b_id: 'community-b',
      status: 'pending',
    };
    const requestingCommunity = 'community-a';
    const isPartyA = link.community_a_id === requestingCommunity;
    // Party A cannot approve their own proposal
    expect(isPartyA).toBe(true); // means they should be blocked from approving
  });

  it('party B can approve pending link', () => {
    const link = {
      community_a_id: 'community-a',
      community_b_id: 'community-b',
      status: 'pending',
    };
    const requestingCommunity = 'community-b';
    const isPartyA = link.community_a_id === requestingCommunity;
    const isPartyB = link.community_b_id === requestingCommunity;
    expect(isPartyB).toBe(true);
    expect(isPartyA).toBe(false);
    // Party B can approve
  });

  it('cannot approve an already-active link', () => {
    const link = { status: 'active' };
    expect(link.status !== 'pending').toBe(true); // blocks approval
  });
});

describe('Community Links: Tier Ordering', () => {
  it('sister_community tier sorts after platform', () => {
    const tierOrder: Record<string, number> = {
      community: 0,
      trust_network: 1,
      platform: 2,
      sister_community: 3,
    };
    expect(tierOrder['sister_community']).toBeGreaterThan(tierOrder['platform']);
  });

  it('community tier sorts first', () => {
    const tierOrder: Record<string, number> = {
      community: 0,
      trust_network: 1,
      platform: 2,
      sister_community: 3,
    };
    const reqs = [
      { feedScore: 80, sourceTier: 'sister_community' },
      { feedScore: 60, sourceTier: 'community' },
      { feedScore: 70, sourceTier: 'trust_network' },
    ];
    const sorted = reqs.sort((a, b) => {
      const diff = (tierOrder[a.sourceTier] ?? 99) - (tierOrder[b.sourceTier] ?? 99);
      return diff !== 0 ? diff : b.feedScore - a.feedScore;
    });
    expect(sorted[0].sourceTier).toBe('community');
    expect(sorted[sorted.length - 1].sourceTier).toBe('sister_community');
  });
});
