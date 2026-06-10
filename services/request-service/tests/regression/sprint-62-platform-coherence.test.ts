/**
 * Sprint 62: Platform Coherence TDD tests
 *
 * Covers:
 * 1. Withdraw Offer — responder can now call PUT /matches/:id/reject
 * 2. Request Type Enforcement — POST /requests validates against community config
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({
  query: (...args: any[]) => mockQuery(...args),
  withTransaction: (fn: any) => fn((...args: any[]) => mockQuery(...args)),
}));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

import express from 'express';
import request from 'supertest';

// ─── Withdraw Offer ───────────────────────────────────────────────────────────

const BASE_MATCH = {
  id: 'match-1',
  request_id: 'req-1',
  requester_id: 'requester-user',
  responder_id: 'helper-user',
  status: 'proposed',
};

async function buildMatchesApp(userId: string) {
  const { default: matchesRouter } = await import('../../src/routes/matches');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { userId, email: 'u@test.com', communities: [] };
    next();
  });
  app.use('/matches', matchesRouter);
  return app;
}

describe('Sprint 62: Withdraw Offer (PUT /matches/:id/reject)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('allows requester to reject a match', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [BASE_MATCH] })          // matchCheck
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })                    // UPDATE status='rejected'
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] });    // remaining proposed (> 0, skip reopen)

    const app = await buildMatchesApp('requester-user');
    const res = await request(app)
      .put('/matches/match-1/reject')
      .send({ user_id: 'requester-user' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows responder to withdraw their offer', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [BASE_MATCH] })          // matchCheck
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })                    // UPDATE status='rejected'
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] });    // remaining proposed (> 0, skip reopen)

    const app = await buildMatchesApp('helper-user');
    const res = await request(app)
      .put('/matches/match-1/reject')
      .send({ user_id: 'helper-user' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects calls from unrelated users', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [BASE_MATCH] }); // matchCheck

    const app = await buildMatchesApp('unrelated-user');
    const res = await request(app)
      .put('/matches/match-1/reject')
      .send({ user_id: 'unrelated-user' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ─── Request Type Enforcement ──────────────────────────────────────────────────
// Note: use request_type='generic' for Zod-safe test bodies (ride/service require payload).
// The community config test uses generic=disallowed to verify enforcement.

describe('Sprint 62: Request Type Enforcement (POST /requests)', () => {
  async function buildRequestsApp() {
    const { default: requestsRouter } = await import('../../src/routes/requests');
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId: 'user-1', email: 'u@test.com', communities: [{ id: 'comm-1', role: 'member' }] };
      next();
    });
    app.use('/requests', requestsRouter);
    return app;
  }

  const GENERIC_BODY = {
    community_id: 'comm-1',
    request_type: 'generic',
    title: 'Help with moving',
    description: 'I need help moving boxes',
    urgency: 'medium',
  };

  const MOCK_CREATED_REQUEST = {
    id: 'req-1', requester_id: 'user-1', title: 'Help with moving',
    description: 'I need help moving boxes', request_type: 'generic', urgency: 'medium',
    status: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    expires_at: new Date().toISOString(), visibility_scope: 'community',
    visibility_max_degrees: 3, preferred_provider_id: null, scheduled_for: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('accepts any request type when community has no enabled_request_types config', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'member-1' }] })                          // member check
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_ttl_days: 60, default_request_scope: 'community', enabled_request_types: null }] })  // settings
      .mockResolvedValueOnce({ rowCount: 1, rows: [MOCK_CREATED_REQUEST] })                        // INSERT
      .mockResolvedValue({ rowCount: 1, rows: [] });                                               // remaining queries

    const app = await buildRequestsApp();
    const res = await request(app).post('/requests').send(GENERIC_BODY);
    expect(res.body.error).not.toBe('REQUEST_TYPE_NOT_ENABLED');
  });

  it('accepts request type when it is in enabled_request_types', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'member-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_ttl_days: 60, default_request_scope: 'community', enabled_request_types: [{ name: 'generic', karma_multiplier: 1.0 }] }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [MOCK_CREATED_REQUEST] })
      .mockResolvedValue({ rowCount: 1, rows: [] });

    const app = await buildRequestsApp();
    const res = await request(app).post('/requests').send(GENERIC_BODY);
    expect(res.body.error).not.toBe('REQUEST_TYPE_NOT_ENABLED');
  });

  it('rejects generic request type when community only allows ride', async () => {
    // Community only allows 'ride' — 'generic' should be blocked
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'member-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_ttl_days: 60, default_request_scope: 'community', enabled_request_types: [{ name: 'ride', karma_multiplier: 1.5 }] }] })
      .mockResolvedValue({ rowCount: 0, rows: [] });

    const app = await buildRequestsApp();
    const res = await request(app).post('/requests').send(GENERIC_BODY);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('REQUEST_TYPE_NOT_ENABLED');
  });

  it('accepts request type when enabled_request_types is empty array', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'member-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_ttl_days: 60, default_request_scope: 'community', enabled_request_types: [] }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [MOCK_CREATED_REQUEST] })
      .mockResolvedValue({ rowCount: 1, rows: [] });

    const app = await buildRequestsApp();
    const res = await request(app).post('/requests').send(GENERIC_BODY);
    expect(res.body.error).not.toBe('REQUEST_TYPE_NOT_ENABLED');
  });
});
