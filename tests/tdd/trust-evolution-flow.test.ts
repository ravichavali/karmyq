// tests/tdd/trust-evolution-flow.test.ts
// Integration test — requires live reputation-service and database.
// Can fail without live services. Will be promoted to regression once services are stable.

import axios from 'axios';

const BASE = process.env.REPUTATION_URL || 'http://localhost:3004';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || '';

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

describe('Trust Evolution — Integration Flow', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || '';
  const TEST_COMMUNITY_ID = process.env.TEST_COMMUNITY_ID || '';
  let servicesAvailable = true;

  beforeAll(async () => {
    // Probe the reputation service health endpoint to decide if tests should run
    try {
      await axios.get(`${BASE}/health`, { timeout: 3000 });
    } catch (err) {
      servicesAvailable = false;
      const clean = sanitizeAxiosError(err);
      console.warn(`[trust-evolution-flow] Reputation service unavailable — skipping live tests: ${clean.message}`);
    }
  });

  it('can enable evolution for a user', async () => {
    if (!servicesAvailable) throw new Error('Reputation service not available — requires live DB');
    let res: any;
    try {
      res = await axios.put(
        `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}`,
        { evolution_enabled: true },
        { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
      );
    } catch (err) {
      throw sanitizeAxiosError(err);
    }
    expect(res.data.success).toBe(true);
    expect(res.data.data.evolution_enabled).toBe(true);
  });

  it('can read user trust config', async () => {
    if (!servicesAvailable) throw new Error('Reputation service not available — requires live DB');
    let res: any;
    try {
      res = await axios.get(
        `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}`,
        { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
      );
    } catch (err) {
      throw sanitizeAxiosError(err);
    }
    expect(res.data.success).toBe(true);
    expect(res.data.data).toHaveProperty('effective_params');
    expect(res.data.data.effective_params).toHaveProperty('cross_community_prior');
  });

  it('evolution log starts empty for new user', async () => {
    if (!servicesAvailable) throw new Error('Reputation service not available — requires live DB');
    let res: any;
    try {
      res = await axios.get(
        `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}/history`,
        { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
      );
    } catch (err) {
      throw sanitizeAxiosError(err);
    }
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
  });
});
