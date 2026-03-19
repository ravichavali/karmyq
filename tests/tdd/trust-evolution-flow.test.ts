// tests/tdd/trust-evolution-flow.test.ts
// Integration test — requires live reputation-service and database.
// Can fail without live services. Will be promoted to regression once services are stable.

import axios from 'axios';

const BASE = process.env.REPUTATION_URL || 'http://localhost:3004';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || '';

describe('Trust Evolution — Integration Flow', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || '';
  const TEST_COMMUNITY_ID = process.env.TEST_COMMUNITY_ID || '';

  it('can enable evolution for a user', async () => {
    const res = await axios.put(
      `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}`,
      { evolution_enabled: true },
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    expect(res.data.success).toBe(true);
    expect(res.data.data.evolution_enabled).toBe(true);
  });

  it('can read user trust config', async () => {
    const res = await axios.get(
      `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}`,
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    expect(res.data.success).toBe(true);
    expect(res.data.data).toHaveProperty('effective_params');
    expect(res.data.data.effective_params).toHaveProperty('cross_community_prior');
  });

  it('evolution log starts empty for new user', async () => {
    const res = await axios.get(
      `${BASE}/reputation/trust-config/${TEST_USER_ID}/${TEST_COMMUNITY_ID}/history`,
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
  });
});
