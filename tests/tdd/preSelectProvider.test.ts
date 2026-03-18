import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3003';
const AUTH_URL = 'http://localhost:3001';

async function loginAs(email: string) {
  const res = await axios.post(`${AUTH_URL}/auth/login`, { email, password: 'password123' });
  return res.data.data.token;
}

describe('Pre-select provider on POST /requests', () => {
  let requesterToken: string;
  let communityId: string;
  let activeProviderId: string;

  beforeAll(async () => {
    requesterToken = await loginAs('user1@test.karmyq.com');

    const commRes = await axios.get(`http://localhost:3002/community/my`, {
      headers: { Authorization: `Bearer ${requesterToken}` },
    });
    communityId = commRes.data.data[0]?.id;

    const provRes = await axios.get(`${BASE_URL}/providers?service_type=tutor&limit=1`);
    activeProviderId = provRes.data.data[0]?.id;
  }, 30000);

  it('files request with valid preferred_provider_id → stores it on row', async () => {
    // Requires simulation to have run and created at least one tutor provider.
    // Intentional conditional: these are integration tests against live seed data.
    if (!activeProviderId) throw new Error('No tutor provider in DB — run simulation first to seed providers');
    const res = await axios.post(
      `${BASE_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'service',
        title: 'Need a math tutor',
        description: 'Help with calculus',
        urgency: 'medium',
        preferred_provider_id: activeProviderId,
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(res.status).toBe(201);
    expect(res.data.data.preferred_provider_id).toBe(activeProviderId);
  });

  it('returns 400 PROVIDER_NOT_FOUND for non-existent provider', async () => {
    await expect(
      axios.post(
        `${BASE_URL}/requests`,
        {
          community_id: communityId,
          request_type: 'generic',
          title: 'Test',
          description: 'Test',
          urgency: 'low',
          preferred_provider_id: '00000000-0000-0000-0000-000000000000',
        },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: 'PROVIDER_NOT_FOUND' } },
    });
  });

  it('returns 400 PROVIDER_TYPE_MISMATCH when provider service_type does not match request_type', async () => {
    // Reuses the tutor provider from beforeAll; files a 'ride' request to trigger the mismatch.
    if (!activeProviderId) throw new Error('No tutor provider in DB — run simulation first to seed providers');
    await expect(
      axios.post(
        `${BASE_URL}/requests`,
        {
          community_id: communityId,
          request_type: 'ride',
          title: 'Need a ride',
          description: 'To the airport',
          urgency: 'medium',
          preferred_provider_id: activeProviderId, // tutor provider on a ride request → mismatch
        },
        { headers: { Authorization: `Bearer ${requesterToken}` } }
      )
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: 'PROVIDER_TYPE_MISMATCH' } },
    });
  });

  it('files request without preferred_provider_id → preferred_provider_id is null', async () => {
    const res = await axios.post(
      `${BASE_URL}/requests`,
      {
        community_id: communityId,
        request_type: 'generic',
        title: 'Regular request',
        description: 'No provider pre-selected',
        urgency: 'low',
      },
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    expect(res.status).toBe(201);
    expect(res.data.data.preferred_provider_id).toBeNull();
  });
});
