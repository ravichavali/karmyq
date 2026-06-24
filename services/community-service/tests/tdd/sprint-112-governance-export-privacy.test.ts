/**
 * Sprint 112 PR A — Governance + community-export disclosure contract tests (ADR-082).
 *
 * Governance keeps computing exact trust-weight sums INTERNALLY to decide eligibility, but its
 * outward projection carries only identity + a coarse eligibility reason + roles — never a member's
 * trust score or karma. (Community export member-reputation removal is asserted in Task 7.)
 */
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: { query: (...a: any[]) => mockQuery(...a), connect: jest.fn() },
}));

import { getGovernanceState } from '../../src/database/governanceDb';
import { assertNoForbiddenReputationKeys, GovernanceEligibleMemberSchema, GovernanceRoleHolderSchema } from '@karmyq/shared';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getGovernanceState projection (ADR-082)', () => {
  it('projects eligible_members + role_holders to identity/role only — no trust_score or karma', async () => {
    mockQuery
      // 1. settings
      .mockResolvedValueOnce({ rows: [{ governance_settings: { eligibility_threshold: 50, quorum_size: 3, template: 'small-collective' } }] })
      // 2. maturity (community aggregate — allowed)
      .mockResolvedValueOnce({ rows: [{ avg_trust: 62 }] })
      // 3. eligible members (the SQL now selects identity only; threshold filter stays in SQL)
      .mockResolvedValueOnce({ rows: [{ user_id: U1, name: 'Maria' }] })
      // 4. nominations (none -> no per-nomination ratifier queries)
      .mockResolvedValueOnce({ rows: [] })
      // 5. role holders (identity + role only)
      .mockResolvedValueOnce({ rows: [{ user_id: U2, name: 'Sam', role: 'admin' }] });

    const state: any = await getGovernanceState('cccccccc-cccc-cccc-cccc-cccccccccccc');

    expect(state.eligible_members).toEqual([
      { user_id: U1, name: 'Maria', eligible: true, eligibility_reason: 'established_community_relationships' },
    ]);
    expect(state.role_holders).toEqual([{ user_id: U2, name: 'Sam', role: 'admin' }]);

    // Each member row conforms to the strict shared schema (rejects trust_score/karma).
    expect(() => GovernanceEligibleMemberSchema.parse(state.eligible_members[0])).not.toThrow();
    expect(() => GovernanceRoleHolderSchema.parse(state.role_holders[0])).not.toThrow();

    // No forbidden reputation key anywhere in the governance response. The community maturity
    // aggregate (avg_trust_score) and the configured policy threshold are allowed exceptions.
    expect(() => assertNoForbiddenReputationKeys(state)).not.toThrow();
    expect(state.maturity).toEqual(expect.objectContaining({ avg_trust_score: expect.any(Number), threshold: 50 }));
  });
});
