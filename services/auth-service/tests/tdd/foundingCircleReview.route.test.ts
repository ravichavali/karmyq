import request from 'supertest';
import express, { NextFunction, Response } from 'express';
import foundingCircleRoutes from '../../src/routes/foundingCircle';
import {
  isFoundingCircleReviewer,
  listFoundingCircleSubmissions,
  updateFoundingCircleSubmissionStatus,
} from '../../src/database/foundingCircleDb';

jest.mock('@karmyq/shared/middleware', () => ({
  authMiddleware: (req: any, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token provided', error: 'UNAUTHORIZED' });
    }
    req.user = { userId: token, email: `${token}@example.com`, communities: [] };
    next();
  },
}));

jest.mock('../../src/database/foundingCircleDb');

const mockIsReviewer = isFoundingCircleReviewer as jest.MockedFunction<typeof isFoundingCircleReviewer>;
const mockList = listFoundingCircleSubmissions as jest.MockedFunction<typeof listFoundingCircleSubmissions>;
const mockUpdate = updateFoundingCircleSubmissionStatus as jest.MockedFunction<
  typeof updateFoundingCircleSubmissionStatus
>;

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/founding-circle', foundingCircleRoutes);
  return testApp;
}

describe('Sprint 103 founding-circle review endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FOUNDING_CIRCLE_REVIEWER_IDS;
    delete process.env.FOUNDING_CIRCLE_REVIEWER_EMAILS;
    mockIsReviewer.mockImplementation(async (userId) => userId === 'reviewer');
  });

  it('requires auth for listing submissions', async () => {
    const res = await request(app()).get('/founding-circle/submissions');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('rejects active community admins unless they are explicitly allowlisted', async () => {
    const res = await request(app()).get('/founding-circle/submissions').set('Authorization', 'Bearer reviewer');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('rejects allowlisted users who are not active community admins', async () => {
    process.env.FOUNDING_CIRCLE_REVIEWER_IDS = 'member';

    const res = await request(app()).get('/founding-circle/submissions').set('Authorization', 'Bearer member');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('lets reviewers list submissions by status', async () => {
    process.env.FOUNDING_CIRCLE_REVIEWER_IDS = 'reviewer';
    mockList.mockResolvedValue({
      items: [
        {
          id: 's1',
          email: 'founder@example.com',
          lens: 'organizer',
          contribution: 'I can host reviews.',
          concern: 'Trust at scale.',
          source_page: 'join',
          status: 'new',
          created_at: '2026-06-17T00:00:00.000Z',
          reviewed_at: null,
        },
      ],
      count: 1,
      limit: 25,
      offset: 0,
    });

    const res = await request(app())
      .get('/founding-circle/submissions?status=new&limit=25&offset=0')
      .set('Authorization', 'Bearer reviewer');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith({ status: 'new', limit: 25, offset: 0 });
  });

  it('lets reviewers update submission status', async () => {
    process.env.FOUNDING_CIRCLE_REVIEWER_EMAILS = 'REVIEWER@example.com';
    mockUpdate.mockResolvedValue({
      id: 's1',
      email: 'founder@example.com',
      lens: 'organizer',
      contribution: 'I can host reviews.',
      concern: 'Trust at scale.',
      source_page: 'join',
      status: 'reviewed',
      created_at: '2026-06-17T00:00:00.000Z',
      reviewed_at: '2026-06-17T01:00:00.000Z',
    });

    const res = await request(app())
      .patch('/founding-circle/submissions/s1/status')
      .set('Authorization', 'Bearer reviewer')
      .send({ status: 'reviewed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reviewed');
    expect(mockUpdate).toHaveBeenCalledWith('s1', 'reviewed');
  });

  it('rejects invalid status updates', async () => {
    process.env.FOUNDING_CIRCLE_REVIEWER_IDS = 'reviewer';
    const res = await request(app())
      .patch('/founding-circle/submissions/s1/status')
      .set('Authorization', 'Bearer reviewer')
      .send({ status: 'emailed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for missing submissions', async () => {
    process.env.FOUNDING_CIRCLE_REVIEWER_IDS = 'reviewer';
    mockUpdate.mockResolvedValue(null);

    const res = await request(app())
      .patch('/founding-circle/submissions/missing/status')
      .set('Authorization', 'Bearer reviewer')
      .send({ status: 'archived' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
