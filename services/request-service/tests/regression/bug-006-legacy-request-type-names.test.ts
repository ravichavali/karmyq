/**
 * BUG-006: legacy request-type names in community_configs.enabled_request_types
 *
 * Seed data (init.sql, migrations 011/012) populates enabled_request_types with legacy
 * names like meal_share / tool_borrow / childcare. The backend enforced against those raw
 * names, so POST /requests with request_type='generic' 400'd with REQUEST_TYPE_NOT_ENABLED —
 * even though the admin UI (which normalizes legacy names to the 5 built-ins) showed generic
 * as enabled.
 *
 * Fix: the backend must ignore legacy names when enforcing — only restrict against KNOWN
 * built-in request types. If a community's enabled_request_types contains no built-in names
 * (all legacy), treat it as unrestricted (mirrors the frontend normalization + the existing
 * empty/null => accept-any semantics).
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

import express from 'express';
import request from 'supertest';

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

describe('BUG-006: legacy request-type names in enabled_request_types', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishEvent.mockResolvedValue(undefined);
  });

  it('accepts generic when enabled_request_types holds ONLY legacy names (all-legacy => unrestricted)', async () => {
    // Exactly the init.sql / migration 011-012 seed shape: legacy names, no built-ins.
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'member-1' }] })                          // member check
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_ttl_days: 60, default_request_scope: 'community', enabled_request_types: [{ name: 'meal_share', karma_multiplier: 1.0 }, { name: 'tool_borrow', karma_multiplier: 1.0 }, { name: 'childcare', karma_multiplier: 1.0 }] }] })  // settings
      .mockResolvedValueOnce({ rowCount: 1, rows: [MOCK_CREATED_REQUEST] })                        // INSERT
      .mockResolvedValue({ rowCount: 1, rows: [] });                                               // remaining queries

    const app = await buildRequestsApp();
    const res = await request(app).post('/requests').send(GENERIC_BODY);
    expect(res.body.error).not.toBe('REQUEST_TYPE_NOT_ENABLED');
  });

  it('still enforces a real built-in restriction even when legacy names are mixed in', async () => {
    // Admin genuinely restricted to 'ride' (a built-in); the legacy 'meal_share' is ignored,
    // but the 'ride' restriction stands, so 'generic' is still blocked.
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'member-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_ttl_days: 60, default_request_scope: 'community', enabled_request_types: [{ name: 'ride', karma_multiplier: 1.5 }, { name: 'meal_share', karma_multiplier: 1.0 }] }] })
      .mockResolvedValue({ rowCount: 0, rows: [] });

    const app = await buildRequestsApp();
    const res = await request(app).post('/requests').send(GENERIC_BODY);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('REQUEST_TYPE_NOT_ENABLED');
  });
});
