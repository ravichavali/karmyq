import request from 'supertest';
import express from 'express';

// Mock the service so the route test only exercises HTTP mapping.
jest.mock('../../src/services/demoSessionService', () => {
  const actual = jest.requireActual('../../src/services/demoSessionService');
  return {
    ...actual,
    createDemoSession: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
import authRoutes from '../../src/routes/auth';
import {
  createDemoSession,
  DemoSessionUnavailableError,
} from '../../src/services/demoSessionService';

const mockCreate = createDemoSession as jest.MockedFunction<typeof createDemoSession>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
}

const app = buildApp();

describe('POST /auth/demo-session (Sprint 116, Task 12)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with the session on success', async () => {
    mockCreate.mockResolvedValue({
      user: { id: 'u', email: 'maria.reyes@test.karmyq.com', name: 'Maria', communities: [] },
      token: 'demo.jwt.token',
      demo: {
        expiresInMinutes: 30,
        stories: [
          { kind: 'ordinary', requestId: 'r1', matchId: 'm1' },
          { kind: 'provider', requestId: 'r2', offerId: 'o1' },
        ],
      },
    });

    const res = await request(app).post('/auth/demo-session').send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('demo.jwt.token');
    expect(res.body.data.demo.expiresInMinutes).toBe(30);
    // No refresh token is ever issued for a demo session.
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it('returns a generic 503 DEMO_UNAVAILABLE on any config/state failure', async () => {
    mockCreate.mockRejectedValue(new DemoSessionUnavailableError('Persona not found'));

    const res = await request(app).post('/auth/demo-session').send({});

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DEMO_UNAVAILABLE');
    // The opaque message must not leak which check failed.
    expect(res.body.message).not.toContain('Persona');
  });

  it('returns the same generic 503 on an unexpected error (no leak)', async () => {
    mockCreate.mockRejectedValue(new Error('db exploded'));

    const res = await request(app).post('/auth/demo-session').send({});

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('DEMO_UNAVAILABLE');
    expect(res.body.message).not.toContain('db');
  });
});
