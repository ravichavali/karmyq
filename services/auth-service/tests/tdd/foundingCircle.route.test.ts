import request from 'supertest';
import express from 'express';
import foundingCircleRoutes from '../../src/routes/foundingCircle';
import { insertFoundingCircleSubmission } from '../../src/database/foundingCircleDb';

// Mock the DB layer — no real database in auth-service tests.
jest.mock('../../src/database/foundingCircleDb');

const mockInsert = insertFoundingCircleSubmission as jest.MockedFunction<
  typeof insertFoundingCircleSubmission
>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/founding-circle', foundingCircleRoutes);
  return app;
}

const app = buildApp();

describe('POST /founding-circle/submissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists a valid submission and returns 201 with the new id', async () => {
    mockInsert.mockResolvedValue('11111111-2222-3333-4444-555555555555');

    const res = await request(app)
      .post('/founding-circle/submissions')
      .send({
        email: 'you@example.com',
        lens: 'organizer',
        contribution: 'host skill-shares',
        concern: 'trust at scale',
        website: '',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('11111111-2222-3333-4444-555555555555');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith({
      email: 'you@example.com',
      lens: 'organizer',
      contribution: 'host skill-shares',
      concern: 'trust at scale',
      source_page: 'join',
    });
  });

  it('silently succeeds without persisting when the honeypot is filled', async () => {
    const res = await request(app)
      .post('/founding-circle/submissions')
      .send({ email: 'bot@example.com', website: 'http://spam.example' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed email with 400 VALIDATION_ERROR and does not persist', async () => {
    const res = await request(app)
      .post('/founding-circle/submissions')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects an empty body with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/founding-circle/submissions').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects an over-length field with 400', async () => {
    const res = await request(app)
      .post('/founding-circle/submissions')
      .send({ email: 'you@example.com', contribution: 'x'.repeat(4001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 500 INTERNAL_ERROR when the DB insert throws', async () => {
    mockInsert.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/founding-circle/submissions')
      .send({ email: 'you@example.com' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });
});
