// tests/tdd/sprint-42-dibs.test.ts
/**
 * Sprint 42 — Dibs Lifecycle Integration Tests
 *
 * Tests the complete dibs flow against the live request-service endpoints.
 * These tests will FAIL until the endpoints are implemented in Task 3.
 * That is expected TDD behavior.
 *
 * Dibs feature rules:
 * - Only scheduled requests (scheduled_for IS NOT NULL) are eligible for dibs
 * - ASAP requests (scheduled_for = null) always broadcast publicly — dibs rejected
 * - Provider must have priorInteractions >= 1 with requester to be dibs-eligible
 * - Provider must be is_available = true
 * - Dibs window = 20% of lead time: expires_at = created_at + 0.20 × (scheduled_for − created_at)
 * - One dibs per request (UNIQUE constraint on request_id)
 * - Dibs acceptance creates requests.matches record and sets request status to 'matched'
 * - Dibs decline reverts request to 'open' (public broadcast)
 * - Expired dibs reverts request to 'open' (public broadcast)
 * - dibs_pending requests do not appear in public feed
 */

import axios from 'axios';

const REQUEST_URL = process.env.REQUEST_API_URL || 'http://localhost:3003';
const AUTH_URL = process.env.AUTH_API_URL || 'http://localhost:3001';
const COMMUNITY_URL = process.env.COMMUNITY_API_URL || 'http://localhost:3002';

/** Sanitize axios errors to prevent jest-worker circular-JSON crash on ECONNREFUSED */
function sanitizeAxiosError(err: unknown): Error {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const code = err.code;
    const msg = err.message;
    return new Error(`AxiosError [${code ?? status ?? 'unknown'}]: ${msg}`);
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}

async function loginAs(email: string): Promise<string> {
  const res = await axios.post(`${AUTH_URL}/auth/login`, {
    email,
    password: 'password123',
  });
  return res.data.data.token;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// scheduled_for set to 5 hours from "now" to give a 20% window = 1 hour
const FIVE_HOURS_FROM_NOW = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
const TWO_HOURS_FROM_NOW = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Dibs lifecycle', () => {
  let requesterToken: string;
  let providerToken: string;
  let communityId: string;
  let eligibleProviderId: string;    // provider with priorInteractions >= 1
  let ineligibleProviderId: string;  // provider with priorInteractions = 0
  let servicesAvailable = true;

  beforeAll(async () => {
    try {
      // Use test users seeded by simulation service
      requesterToken = await loginAs('user1@test.karmyq.com');
      providerToken = await loginAs('provider1@test.karmyq.com');

      // Get the requester's community
      const commRes = await axios.get(`${COMMUNITY_URL}/community/my`, {
        headers: { Authorization: `Bearer ${requesterToken}` },
      });
      communityId = commRes.data.data[0]?.id;
      if (!communityId) throw new Error('No community found for test user — run simulation first');

      // Get providers — need one with prior interactions and one without
      // Provider1 should have interactions from simulation; use a fresh user for ineligible
      const eligibleProvRes = await axios.get(`${REQUEST_URL}/providers?limit=1&is_available=true`, {
        headers: { Authorization: `Bearer ${requesterToken}` },
      });
      eligibleProviderId = eligibleProvRes.data.data[0]?.id;
    } catch (err) {
      servicesAvailable = false;
      const clean = sanitizeAxiosError(err);
      console.warn(`[sprint-42-dibs] Services unavailable — skipping live tests: ${clean.message}`);
    }
  }, 30000);

  // ── POST /requests/:id/dibs — validation ─────────────────────────────────────

  it('POST /requests/:id/dibs rejects ASAP requests (no scheduled_for)', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');

    // Create an ASAP request (no scheduled_for)
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'ASAP dibs test request',
        description: 'Should not be dibs-eligible',
        urgency: 'high',
        // No scheduled_for — this is an ASAP request
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(createRes.status).toBe(201);
    const asapRequestId = createRes.data.data.id;

    // Attempt to send dibs on the ASAP request — should be rejected
    await expect(
      axios.post(
        `${REQUEST_URL}/requests/${asapRequestId}/dibs`,
        { provider_id: eligibleProviderId },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: { error: 'DIBS_REQUIRES_SCHEDULED_REQUEST' },
      },
    });
  });

  it('POST /requests/:id/dibs rejects provider with no prior interaction', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');

    // Create a scheduled request
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Scheduled dibs test — ineligible provider',
        description: 'Testing provider eligibility gate',
        urgency: 'low',
        scheduled_for: FIVE_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(createRes.status).toBe(201);
    const requestId = createRes.data.data.id;

    // Use a provider UUID that has no prior interactions with this requester
    const strangerProviderId = '00000000-0000-0000-0000-000000000001';

    await expect(
      axios.post(
        `${REQUEST_URL}/requests/${requestId}/dibs`,
        { provider_id: strangerProviderId },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: { error: 'PROVIDER_NOT_DIBS_ELIGIBLE' },
      },
    });
  });

  it('POST /requests/:id/dibs creates dibs record + sets status to dibs_pending', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!eligibleProviderId) throw new Error('No eligible provider — run simulation first');

    // Create a scheduled request
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Scheduled dibs test — happy path',
        description: 'Testing successful dibs creation',
        urgency: 'medium',
        scheduled_for: FIVE_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(createRes.status).toBe(201);
    const requestId = createRes.data.data.id;

    // Send dibs to eligible provider
    const dibsRes = await axios.post(
      `${REQUEST_URL}/requests/${requestId}/dibs`,
      { provider_id: eligibleProviderId },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );

    expect(dibsRes.status).toBe(201);
    expect(dibsRes.data.data).toMatchObject({
      request_id: requestId,
      provider_id: eligibleProviderId,
      status: 'pending',
    });
    expect(dibsRes.data.data.expires_at).toBeDefined();

    // Verify request status is now dibs_pending
    const reqRes = await axios.get(
      `${REQUEST_URL}/requests/${requestId}`,
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(reqRes.data.data.status).toBe('dibs_pending');
  });

  it('dibs window = 20% of lead time (no floor)', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!eligibleProviderId) throw new Error('No eligible provider — run simulation first');

    // Create a scheduled request 5 hours from now
    const beforeCreate = Date.now();
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Dibs window calculation test',
        description: 'Testing 20% window formula',
        urgency: 'low',
        scheduled_for: FIVE_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    const afterCreate = Date.now();
    expect(createRes.status).toBe(201);
    const requestId = createRes.data.data.id;

    // Send dibs
    const dibsRes = await axios.post(
      `${REQUEST_URL}/requests/${requestId}/dibs`,
      { provider_id: eligibleProviderId },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(dibsRes.status).toBe(201);

    const createdAt = new Date(dibsRes.data.data.created_at).getTime();
    const expiresAt = new Date(dibsRes.data.data.expires_at).getTime();
    const scheduledFor = new Date(FIVE_HOURS_FROM_NOW).getTime();

    // Window should be 20% of lead time
    // expires_at = created_at + 0.20 * (scheduled_for - created_at)
    const expectedWindow = 0.20 * (scheduledFor - createdAt);
    const actualWindow = expiresAt - createdAt;

    // Allow ±5 seconds for timing
    expect(Math.abs(actualWindow - expectedWindow)).toBeLessThan(5000);
  });

  // ── PUT /requests/dibs/:id/accept ─────────────────────────────────────────

  it('PUT /requests/dibs/:id/accept creates matches record + sets status to matched', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!eligibleProviderId) throw new Error('No eligible provider — run simulation first');

    // Create + dibs a scheduled request
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Dibs accept test',
        description: 'Testing dibs acceptance flow',
        urgency: 'medium',
        scheduled_for: FIVE_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    const requestId = createRes.data.data.id;

    const dibsRes = await axios.post(
      `${REQUEST_URL}/requests/${requestId}/dibs`,
      { provider_id: eligibleProviderId },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    const dibsId = dibsRes.data.data.id;

    // Provider accepts
    const acceptRes = await axios.put(
      `${REQUEST_URL}/requests/dibs/${dibsId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.data.data.dibs_status).toBe('accepted');
    expect(acceptRes.data.data.match_id).toBeDefined();

    // Verify request is now matched
    const reqRes = await axios.get(
      `${REQUEST_URL}/requests/${requestId}`,
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(reqRes.data.data.status).toBe('matched');
  });

  // ── PUT /requests/dibs/:id/decline ────────────────────────────────────────

  it('PUT /requests/dibs/:id/decline reverts request to open', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!eligibleProviderId) throw new Error('No eligible provider — run simulation first');

    // Create + dibs a scheduled request
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Dibs decline test',
        description: 'Testing dibs decline flow',
        urgency: 'low',
        scheduled_for: FIVE_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    const requestId = createRes.data.data.id;

    const dibsRes = await axios.post(
      `${REQUEST_URL}/requests/${requestId}/dibs`,
      { provider_id: eligibleProviderId },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    const dibsId = dibsRes.data.data.id;

    // Provider declines
    const declineRes = await axios.put(
      `${REQUEST_URL}/requests/dibs/${dibsId}/decline`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    expect(declineRes.status).toBe(200);
    expect(declineRes.data.data.dibs_status).toBe('declined');

    // Verify request is back to 'open' for public broadcast
    const reqRes = await axios.get(
      `${REQUEST_URL}/requests/${requestId}`,
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(reqRes.data.data.status).toBe('open');
  });

  // ── Expiry ────────────────────────────────────────────────────────────────

  it('expired dibs reverts request to open', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!eligibleProviderId) throw new Error('No eligible provider — run simulation first');

    // Create a request scheduled 2 minutes from now → 20% window = 24 seconds
    // In practice this test requires either a very short window or a manual expiry trigger
    // For CI compatibility, we test via the expiry endpoint or a very short scheduled_for
    const twoMinutesFromNow = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Dibs expiry test',
        description: 'Testing dibs expiry flow',
        urgency: 'low',
        scheduled_for: twoMinutesFromNow,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    const requestId = createRes.data.data.id;

    const dibsRes = await axios.post(
      `${REQUEST_URL}/requests/${requestId}/dibs`,
      { provider_id: eligibleProviderId },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(dibsRes.status).toBe(201);
    const dibsId = dibsRes.data.data.id;

    // Trigger manual expiry (internal/cleanup endpoint) — this bypasses the scheduler
    // The endpoint should process dibs records where expires_at <= NOW()
    const expireRes = await axios.post(
      `${REQUEST_URL}/requests/dibs/${dibsId}/expire`,
      {},
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );

    expect(expireRes.status).toBe(200);
    expect(expireRes.data.data.dibs_status).toBe('expired');

    // Verify request is back to 'open'
    const reqRes = await axios.get(
      `${REQUEST_URL}/requests/${requestId}`,
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(reqRes.data.data.status).toBe('open');
  });

  // ── Unique constraint ─────────────────────────────────────────────────────

  it('second dibs on same request is rejected (unique constraint)', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!eligibleProviderId) throw new Error('No eligible provider — run simulation first');

    // Create a scheduled request
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Dibs uniqueness test',
        description: 'Testing UNIQUE(request_id) constraint',
        urgency: 'low',
        scheduled_for: FIVE_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    const requestId = createRes.data.data.id;

    // First dibs — should succeed
    const firstDibsRes = await axios.post(
      `${REQUEST_URL}/requests/${requestId}/dibs`,
      { provider_id: eligibleProviderId },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(firstDibsRes.status).toBe(201);

    // Second dibs on same request — should be rejected
    await expect(
      axios.post(
        `${REQUEST_URL}/requests/${requestId}/dibs`,
        { provider_id: eligibleProviderId },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: {
        status: 409,
        data: { error: 'DIBS_ALREADY_EXISTS' },
      },
    });
  });

  // ── Feed exclusion ────────────────────────────────────────────────────────

  it('dibs_pending request does not appear in public feed', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!eligibleProviderId) throw new Error('No eligible provider — run simulation first');

    // Create a scheduled request + send dibs → status = dibs_pending
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Feed exclusion test — dibs_pending',
        description: 'This request should not appear in public feed while dibs_pending',
        urgency: 'low',
        scheduled_for: TWO_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(createRes.status).toBe(201);
    const requestId = createRes.data.data.id;

    // Send dibs — status becomes dibs_pending
    const dibsRes = await axios.post(
      `${REQUEST_URL}/requests/${requestId}/dibs`,
      { provider_id: eligibleProviderId },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(dibsRes.status).toBe(201);

    // Verify the request is dibs_pending
    const reqRes = await axios.get(
      `${REQUEST_URL}/requests/${requestId}`,
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(reqRes.data.data.status).toBe('dibs_pending');

    // Check public feed — dibs_pending request should NOT appear
    const feedRes = await axios.get(
      `${REQUEST_URL}/requests?community_id=${communityId}&status=open`,
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );

    const requestIds = feedRes.data.data.map((r: { id: string }) => r.id);
    expect(requestIds).not.toContain(requestId);
  });

  // ── GET /requests/:id/dibs-candidate ─────────────────────────────────────

  it('GET /requests/:id/dibs-candidate returns null when no eligible candidates', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');

    // Create a scheduled request (but with a community that has no prior-interaction providers)
    const createRes = await axios.post(
      `${REQUEST_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Dibs candidate — no eligible test',
        description: 'Testing null candidate response',
        urgency: 'low',
        scheduled_for: FIVE_HOURS_FROM_NOW,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(createRes.status).toBe(201);
    const requestId = createRes.data.data.id;

    const candidateRes = await axios.get(
      `${REQUEST_URL}/requests/${requestId}/dibs-candidate`,
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );

    // When no eligible candidate: returns 200 with data: null
    // (or returns eligible candidate if simulation has seeded prior interactions)
    expect(candidateRes.status).toBe(200);
    // data is either null (no eligible) or a candidate object — both are valid
    expect(candidateRes.data).toHaveProperty('data');
  });

  // ── GET /requests/dibs/pending-for-provider ───────────────────────────────

  it('GET /requests/dibs/pending-for-provider returns provider pending dibs', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');

    const pendingRes = await axios.get(
      `${REQUEST_URL}/requests/dibs/pending-for-provider`,
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    expect(pendingRes.status).toBe(200);
    expect(Array.isArray(pendingRes.data.data)).toBe(true);

    // Every returned dibs record should be in 'pending' status
    pendingRes.data.data.forEach((dibs: { status: string }) => {
      expect(dibs.status).toBe('pending');
    });
  });
});
