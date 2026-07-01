import jwt from 'jsonwebtoken';
import {
  createDemoSession,
  DemoSessionUnavailableError,
  DemoSessionDeps,
} from '../../src/services/demoSessionService';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

const PERSONA_ID = '11111111-1111-1111-1111-111111111111';
const ORD_REQ = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORD_MATCH = 'aaaaaaaa-0000-0000-0000-000000000002';
const PROV_REQ = 'bbbbbbbb-0000-0000-0000-000000000001';
const PROV_OFFER = 'bbbbbbbb-0000-0000-0000-000000000002';

function setValidConfig() {
  process.env.DEMO_SESSION_ENABLED = 'true';
  process.env.DEMO_PERSONA_EMAIL = 'maria.reyes@test.karmyq.com';
  process.env.DEMO_ORDINARY_REQUEST_ID = ORD_REQ;
  process.env.DEMO_ORDINARY_MATCH_ID = ORD_MATCH;
  process.env.DEMO_PROVIDER_REQUEST_ID = PROV_REQ;
  process.env.DEMO_PROVIDER_OFFER_ID = PROV_OFFER;
}

function clearConfig() {
  delete process.env.DEMO_SESSION_ENABLED;
  delete process.env.DEMO_PERSONA_EMAIL;
  delete process.env.DEMO_ORDINARY_REQUEST_ID;
  delete process.env.DEMO_ORDINARY_MATCH_ID;
  delete process.env.DEMO_PROVIDER_REQUEST_ID;
  delete process.env.DEMO_PROVIDER_OFFER_ID;
}

// Fully valid, coherent Maria fixture: she owns both requests; the match/offer
// hang off the correct requests; she has an active non-admin membership.
function validDeps(overrides: Partial<DemoSessionDeps> = {}): DemoSessionDeps {
  return {
    getPersonaByEmail: jest.fn().mockResolvedValue({
      id: PERSONA_ID,
      email: 'maria.reyes@test.karmyq.com',
      name: 'Maria Reyes',
    }),
    getMembershipRoles: jest
      .fn()
      .mockResolvedValue([{ role: 'member', status: 'active' }]),
    getRequestOwner: jest.fn().mockImplementation(async (id: string) => {
      if (id === ORD_REQ) return { id: ORD_REQ, requester_id: PERSONA_ID };
      if (id === PROV_REQ) return { id: PROV_REQ, requester_id: PERSONA_ID };
      return null;
    }),
    getMatch: jest
      .fn()
      .mockResolvedValue({ id: ORD_MATCH, request_id: ORD_REQ }),
    getProviderOffer: jest
      .fn()
      .mockResolvedValue({ id: PROV_OFFER, request_id: PROV_REQ }),
    getUserCommunities: jest
      .fn()
      .mockResolvedValue([{ id: 'c1', role: 'member', name: 'Marin Helping Hands' }]),
    ...overrides,
  };
}

describe('createDemoSession (Sprint 116, Task 12)', () => {
  beforeEach(() => {
    clearConfig();
    setValidConfig();
  });

  afterAll(() => clearConfig());

  it('throws DemoSessionUnavailableError when disabled', async () => {
    process.env.DEMO_SESSION_ENABLED = 'false';
    await expect(createDemoSession(validDeps())).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when a required story ID is missing', async () => {
    delete process.env.DEMO_PROVIDER_OFFER_ID;
    await expect(createDemoSession(validDeps())).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the configured persona email is not @test.karmyq.com', async () => {
    process.env.DEMO_PERSONA_EMAIL = 'maria.reyes@karmyq.com';
    await expect(createDemoSession(validDeps())).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the persona does not exist', async () => {
    const deps = validDeps({ getPersonaByEmail: jest.fn().mockResolvedValue(null) });
    await expect(createDemoSession(deps)).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the resolved account email is not @test.karmyq.com even if config was', async () => {
    const deps = validDeps({
      getPersonaByEmail: jest
        .fn()
        .mockResolvedValue({ id: PERSONA_ID, email: 'maria.reyes@test.karmyq.com.evil.com', name: 'X' }),
    });
    // Config passes the suffix check but the DB row must independently satisfy it.
    process.env.DEMO_PERSONA_EMAIL = 'maria.reyes@test.karmyq.com';
    await expect(createDemoSession(deps)).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the persona has no active membership (inactive)', async () => {
    const deps = validDeps({
      getMembershipRoles: jest
        .fn()
        .mockResolvedValue([{ role: 'member', status: 'inactive' }]),
    });
    await expect(createDemoSession(deps)).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the persona is an admin of any active community', async () => {
    const deps = validDeps({
      getMembershipRoles: jest
        .fn()
        .mockResolvedValue([{ role: 'admin', status: 'active' }]),
    });
    await expect(createDemoSession(deps)).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the ordinary request is not owned by the persona', async () => {
    const deps = validDeps({
      getRequestOwner: jest.fn().mockImplementation(async (id: string) => {
        if (id === ORD_REQ) return { id: ORD_REQ, requester_id: 'someone-else' };
        if (id === PROV_REQ) return { id: PROV_REQ, requester_id: PERSONA_ID };
        return null;
      }),
    });
    await expect(createDemoSession(deps)).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the match does not belong to the ordinary request', async () => {
    const deps = validDeps({
      getMatch: jest
        .fn()
        .mockResolvedValue({ id: ORD_MATCH, request_id: 'other-request' }),
    });
    await expect(createDemoSession(deps)).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('throws when the provider offer does not belong to the provider request', async () => {
    const deps = validDeps({
      getProviderOffer: jest
        .fn()
        .mockResolvedValue({ id: PROV_OFFER, request_id: 'other-request' }),
    });
    await expect(createDemoSession(deps)).rejects.toBeInstanceOf(
      DemoSessionUnavailableError
    );
  });

  it('issues a read-only session with no refresh token and both stories on success', async () => {
    const result = await createDemoSession(validDeps());

    // No refresh token anywhere in the result.
    expect((result as any).refreshToken).toBeUndefined();
    expect((result.demo as any).refreshToken).toBeUndefined();

    expect(result.user.id).toBe(PERSONA_ID);
    expect(result.user.email).toBe('maria.reyes@test.karmyq.com');
    expect(result.demo.expiresInMinutes).toBe(30);
    expect(result.demo.stories).toEqual([
      { kind: 'ordinary', requestId: ORD_REQ, matchId: ORD_MATCH },
      { kind: 'provider', requestId: PROV_REQ, offerId: PROV_OFFER },
    ]);
  });

  it('signs a demo_read_only token that expires in 30 minutes', async () => {
    const result = await createDemoSession(validDeps());
    const decoded = jwt.verify(result.token, JWT_SECRET) as any;

    expect(decoded.userId).toBe(PERSONA_ID);
    expect(decoded.sessionMode).toBe('demo_read_only');
    expect(decoded.exp - decoded.iat).toBe(30 * 60);
  });
});
