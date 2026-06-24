/**
 * Sprint 112 PR A — Governance + community-export disclosure contract tests (ADR-082).
 *
 * Governance keeps computing exact trust-weight sums INTERNALLY for eligibility, but projects only
 * identity + a coarse eligibility reason + roles. Community exports remove member-level karma, trust
 * scores, and ranks, replacing them with a >=5-member non-identifying aggregate.
 */
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  __esModule: true,
  default: {
    query: (...a: any[]) => mockQuery(...a),
    connect: jest.fn().mockResolvedValue({ release: jest.fn(), query: (...a: any[]) => mockQuery(...a) }),
  },
  query: (...a: any[]) => mockQuery(...a),
  initDatabase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/events/publisher', () => ({
  initEventPublisher: jest.fn().mockResolvedValue(undefined),
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/index';
import { getGovernanceState } from '../../src/database/governanceDb';
import { assertNoForbiddenReputationKeys, GovernanceEligibleMemberSchema, GovernanceRoleHolderSchema } from '@karmyq/shared';

const SECRET = 'test-secret';
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const COMMUNITY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const token = jwt.sign({ userId: U1, email: 't@example.com', communities: [] }, SECRET);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getGovernanceState projection (ADR-082)', () => {
  it('projects eligible_members + role_holders to identity/role only — no trust_score or karma', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ governance_settings: { eligibility_threshold: 50, quorum_size: 3, template: 'small-collective' } }] })
      .mockResolvedValueOnce({ rows: [{ avg_trust: 62 }] })
      .mockResolvedValueOnce({ rows: [{ user_id: U1, name: 'Maria' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: U2, name: 'Sam', role: 'admin' }] });

    const state: any = await getGovernanceState(COMMUNITY);

    expect(state.eligible_members).toEqual([
      { user_id: U1, name: 'Maria', eligible: true, eligibility_reason: 'established_community_relationships' },
    ]);
    expect(state.role_holders).toEqual([{ user_id: U2, name: 'Sam', role: 'admin' }]);
    expect(() => GovernanceEligibleMemberSchema.parse(state.eligible_members[0])).not.toThrow();
    expect(() => GovernanceRoleHolderSchema.parse(state.role_holders[0])).not.toThrow();
    expect(() => assertNoForbiddenReputationKeys(state)).not.toThrow();
    expect(state.maturity).toEqual(expect.objectContaining({ avg_trust_score: expect.any(Number), threshold: 50 }));
  });
});

// Route exports the SQL by distinctive substring so the assertions don't depend on call ordering.
function exportMock(over: { cohort?: number } = {}) {
  return (sql: string) => {
    if (/COUNT\(\*\)::int AS n FROM community\.memberships/.test(sql)) return Promise.resolve({ rows: [{ n: over.cohort ?? 5 }] });
    if (/SELECT role FROM community\.memberships/.test(sql)) return Promise.resolve({ rows: [{ role: 'admin' }] });
    if (/FROM community\.communities/.test(sql)) return Promise.resolve({ rows: [{ id: COMMUNITY, name: 'Maplewood' }] });
    if (/COUNT\(DISTINCT k\.user_id\)/.test(sql)) return Promise.resolve({ rows: [{ participating_members: 5, transaction_count: 18, total_karma_points: 400 }] });
    if (/"Helps Given"/.test(sql)) return Promise.resolve({ rows: [{ Member: 'Sam', 'Helps Given': 2, 'Helps Received': 1, 'Requests Created': 0, 'Requests Completed': 1 }] });
    if (/FROM community\.memberships m/.test(sql)) return Promise.resolve({ rows: [{ id: 'm1', user_id: U2, user_name: 'Sam', role: 'member', status: 'active' }] });
    return Promise.resolve({ rows: [] });
  };
}

describe('GET /communities/:id/export — member reputation removed', () => {
  it('replaces per-member karma/trust with a >=5-member aggregate, never raw member rows', async () => {
    mockQuery.mockImplementation(exportMock({ cohort: 5 }) as any);
    const res = await request(app)
      .get(`/communities/${COMMUNITY}/export?format=json&requests=false&matches=false&norms=false&settings=false`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).not.toHaveProperty('karma_records');
    expect(data).not.toHaveProperty('trust_scores');
    expect(data.community_reputation_summary).toEqual({ participating_members: 5, transaction_count: 18, total_karma_points: 400 });
    // Member rows (identity) must not carry karma/trust.
    const json = JSON.stringify(data.members || []);
    expect(json).not.toMatch(/trust_score|"karma"|total_karma\b/);
  });

  it('omits the reputation aggregate entirely for a cohort below five', async () => {
    mockQuery.mockImplementation(exportMock({ cohort: 4 }) as any);
    const res = await request(app)
      .get(`/communities/${COMMUNITY}/export?format=json&requests=false&matches=false&norms=false&settings=false&members=false`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('community_reputation_summary');
  });
});

describe('GET /communities/:id/export/activity — no member reputation columns', () => {
  it('keeps activity counts but drops Total Karma / Trust Score', async () => {
    mockQuery.mockImplementation(exportMock() as any);
    const res = await request(app)
      .get(`/communities/${COMMUNITY}/export/activity?format=json`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const json = JSON.stringify(res.body.data);
    expect(json).not.toMatch(/Total Karma|Trust Score/);
    expect(json).toMatch(/Helps Given/);
  });
});
