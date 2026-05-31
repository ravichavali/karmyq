/**
 * Sprint 77 — idempotent POST /communities (ADR-062).
 *
 * Posting a name+location that already exists (active) must JOIN the existing
 * community (200, existing:true) and insert NO new community row. A new name,
 * or the same name in a different location, creates a new community
 * (201, existing:false).
 *
 * The DB boundary (`../../src/database/db.query`) is mocked; we assert on the
 * SQL the route issues and the HTTP response, so no live database is required.
 */
import express from 'express';
import request from 'supertest';

// Mock the DB boundary BEFORE importing the router.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));
// Mock the event publisher so the route doesn't touch Bull/Redis.
jest.mock('../../src/events/publisher', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));
// Fusion helper hits the DB on GET; stub to a no-op for safety (unused on POST).
jest.mock('../../src/routes/fusions', () => ({
  getActiveFusionProposalForCommunityRoute: jest.fn().mockResolvedValue(null),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import communitiesRouter from '../../src/routes/communities';

const CREATOR_ID = '11111111-1111-1111-1111-111111111111';
const EXISTING_ID = '22222222-2222-2222-2222-222222222222';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { userId: CREATOR_ID, email: 'creator@example.com', communities: [] };
    next();
  });
  app.use('/communities', communitiesRouter);
  return app;
}

function isCommunityInsert(sql: string): boolean {
  return /INSERT\s+INTO\s+communities\.communities/i.test(sql);
}
function isIdentitySelect(sql: string): boolean {
  return /FROM\s+communities\.communities/i.test(sql)
    && /LOWER\s*\(\s*TRIM\s*\(\s*name/i.test(sql)
    && /status\s*=\s*'active'/i.test(sql);
}

describe('Sprint 77 — idempotent POST /communities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('joins an existing active community by name+location (200, existing:true, no new row)', async () => {
    const existingRow = {
      id: EXISTING_ID,
      name: 'PDX Service Providers Network',
      location: 'Portland, OR',
      access_type: 'public',
      status: 'active',
      current_members: 5,
      created_at: '2024-01-01T00:00:00Z',
    };

    mockQuery.mockImplementation(async (sql: string) => {
      if (isIdentitySelect(sql)) return { rowCount: 1, rows: [existingRow] };
      if (/INSERT\s+INTO\s+communities\.members/i.test(sql)) return { rowCount: 1, rows: [] };
      if (/UPDATE\s+communities\.communities\s+SET\s+current_members/i.test(sql)) return { rowCount: 1, rows: [] };
      // JWT-refresh membership lookup
      if (/JOIN\s+communities\.members/i.test(sql)) {
        return { rowCount: 1, rows: [{ id: EXISTING_ID, name: existingRow.name, role: 'member' }] };
      }
      return { rowCount: 0, rows: [] };
    });

    const res = await request(makeApp())
      .post('/communities')
      .send({ name: '  pdx service providers network ', location: 'Portland, OR', community_type: 'mutual_aid' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.existing).toBe(true);
    expect(res.body.data.community.id).toBe(EXISTING_ID);

    // No new community row was inserted.
    const insertCalls = mockQuery.mock.calls.filter((c) => isCommunityInsert(c[0]));
    expect(insertCalls).toHaveLength(0);

    // The caller was upserted as a member of the existing community.
    const memberInserts = mockQuery.mock.calls.filter((c) => /INSERT\s+INTO\s+communities\.members/i.test(c[0]));
    expect(memberInserts).toHaveLength(1);
    expect(memberInserts[0][1]).toContain(EXISTING_ID);
    expect(memberInserts[0][1]).toContain(CREATOR_ID);
  });

  it('creates a new community when no active match exists (201, existing:false)', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (isIdentitySelect(sql)) return { rowCount: 0, rows: [] };
      if (/config_templates/i.test(sql)) {
        return { rowCount: 1, rows: [{ config_json: { member_cap: 150, visibility_mode: 'full', outsider_response_allowed: true, enabled_request_types: ['task'], karma_split_helper: 70, karma_split_requestor: 30, base_karma_pool_per_request: 100, karma_decay_half_life_days: 30, trust_depth_weight: 1, trust_breadth_weight: 1, trust_decay_half_life_days: 30, trust_path_max_hops: 3, min_interactions_for_trust: 1, request_approval_required: false, new_member_karma_lockout_days: 0, join_approval_required: false, joining_counts_as_interaction: true }, name: 'Cohousing Default' }] };
      }
      if (isCommunityInsert(sql)) {
        return { rowCount: 1, rows: [{ id: 'new-id', name: 'Brand New Co', location: 'Austin', status: 'active', current_members: 1 }] };
      }
      if (/JOIN\s+communities\.members/i.test(sql)) {
        return { rowCount: 1, rows: [{ id: 'new-id', name: 'Brand New Co', role: 'admin' }] };
      }
      return { rowCount: 0, rows: [] };
    });

    const res = await request(makeApp())
      .post('/communities')
      .send({ name: 'Brand New Co', location: 'Austin', community_type: 'mutual_aid' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.existing).toBe(false);

    const insertCalls = mockQuery.mock.calls.filter((c) => isCommunityInsert(c[0]));
    expect(insertCalls).toHaveLength(1);
  });
});
