import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3003';

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

async function loginAs(email: string) {
  try {
    const res = await axios.post(`http://localhost:3001/auth/login`, {
      email,
      password: 'password123',
    });
    return res.data.data.token;
  } catch (err) {
    throw sanitizeAxiosError(err);
  }
}

describe('Rate Cards API', () => {
  let ownerToken: string;
  let otherToken: string;
  let providerId: string;
  let cardId: string;
  let servicesAvailable = true;

  beforeAll(async () => {
    try {
      ownerToken = await loginAs('provider1@test.karmyq.com');
      otherToken = await loginAs('user2@test.karmyq.com');

      const res = await axios.get(`${BASE_URL}/providers/my`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      providerId = res.data.data[0]?.id;
      if (!providerId) throw new Error('No provider profile found for test user — run simulation first');
    } catch (err) {
      servicesAvailable = false;
      const clean = sanitizeAxiosError(err);
      console.warn(`[rateCards] Services unavailable — skipping live tests: ${clean.message}`);
    }
  }, 30000);

  it('creates a rate card as owner → 201', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    const res = await axios.post(
      `${BASE_URL}/providers/${providerId}/rate-cards`,
      {
        label: 'Tutoring — Math',
        service_type: 'tutor',
        pricing_model: 'standard',
        rate_amount: 30,
        rate_unit: 'per_hour',
        notes: 'First session free',
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    expect(res.status).toBe(201);
    expect(res.data.data.label).toBe('Tutoring — Math');
    expect(res.data.data.rate_amount).toBe('30.00');
    cardId = res.data.data.id;
  });

  it('returns 403 when non-owner tries to create a card', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    await expect(
      axios.post(
        `${BASE_URL}/providers/${providerId}/rate-cards`,
        { label: 'X', pricing_model: 'free' },
        { headers: { Authorization: `Bearer ${otherToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('returns 400 when standard pricing_model missing rate_amount', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    await expect(
      axios.post(
        `${BASE_URL}/providers/${providerId}/rate-cards`,
        { label: 'Bad', pricing_model: 'standard', rate_unit: 'per_hour' },
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('returns 400 when free pricing_model has rate_amount set', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    await expect(
      axios.post(
        `${BASE_URL}/providers/${providerId}/rate-cards`,
        { label: 'Bad', pricing_model: 'free', rate_amount: 10 },
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('returns 400 when service_type is invalid', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    await expect(
      axios.post(
        `${BASE_URL}/providers/${providerId}/rate-cards`,
        { label: 'Bad', pricing_model: 'free', service_type: 'wizard' },
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      )
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('GET /providers/:id/rate-cards returns only active cards (public)', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    const res = await axios.get(
      `${BASE_URL}/providers/${providerId}/rate-cards`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data)).toBe(true);
    res.data.data.forEach((c: any) => expect(c.is_active).toBe(true));
  });

  it('updates a rate card as owner → 200', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!cardId) throw new Error('cardId not set — create test must pass first');
    const res = await axios.put(
      `${BASE_URL}/providers/${providerId}/rate-cards/${cardId}`,
      { label: 'Tutoring — Math & Science', rate_amount: 35 },
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    expect(res.status).toBe(200);
    expect(res.data.data.label).toBe('Tutoring — Math & Science');
  });

  it('soft-deletes a rate card → card absent from public active-only list', async () => {
    // DELETE is a soft-delete (sets is_active = FALSE, not a hard delete).
    // The public GET /providers/:id/rate-cards endpoint filters WHERE is_active = TRUE,
    // so a soft-deleted card will not appear in the list — expect undefined is correct.
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    if (!cardId) throw new Error('cardId not set — create test must pass first');
    const res = await axios.delete(
      `${BASE_URL}/providers/${providerId}/rate-cards/${cardId}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    expect(res.status).toBe(200);

    // Public list returns only active cards — soft-deleted card should not appear
    const list = await axios.get(
      `${BASE_URL}/providers/${providerId}/rate-cards`
    );
    const found = list.data.data.find((c: any) => c.id === cardId);
    expect(found).toBeUndefined();
  });

  it('GET /providers/:id includes rate_cards array', async () => {
    if (!servicesAvailable) throw new Error('Services not available — run simulation first');
    const res = await axios.get(`${BASE_URL}/providers/${providerId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.data.rate_cards)).toBe(true);
  });
});
