/**
 * Two-phase match completion tests
 *
 * Validates that clicking "Done" records a per-party timestamp rather than
 * immediately setting status='completed'. The match becomes fully completed
 * only after both parties have confirmed.
 */

// The complete endpoint uses the `query` helper from '../database/db'.
// We mock it so we can simulate different DB states without a real DB.
const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

const mockPublishEvent = jest.fn();
jest.mock('../../src/events/publisher', () => ({ publishEvent: (...args: any[]) => mockPublishEvent(...args) }));

// Dynamically import the router *after* mocks are in place
import express from 'express';
import request from 'supertest';

// Build a minimal app that mounts just the matches router
async function buildApp() {
  const { default: matchesRouter } = await import('../../src/routes/matches');
  const app = express();
  app.use(express.json());
  // Inject a fake authenticated user so auth middleware is bypassed
  app.use((req: any, _res: any, next: any) => {
    req.user = { userId: 'requester-user', email: 'r@test.com', communities: [] };
    next();
  });
  app.use('/matches', matchesRouter);
  return app;
}

const BASE_MATCH = {
  id: 'match-1',
  request_id: 'req-1',
  offer_id: 'offer-1',
  requester_id: 'requester-user',
  responder_id: 'helper-user',
  status: 'matched',
};

describe('PUT /matches/:id/complete — two-phase completion', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('records requester_done_at but does NOT set status=completed when only requester marks done', async () => {
    // First SELECT returns the match; UPDATE RETURNING shows only requester done
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [BASE_MATCH] })          // SELECT match
      .mockResolvedValueOnce({                                               // UPDATE SET requester_done_at
        rows: [{ requester_done_at: new Date(), responder_done_at: null }],
      })

    const app = await buildApp();
    const res = await request(app)
      .put('/matches/match-1/complete')
      .send({ user_id: 'requester-user' });

    expect(res.status).toBe(200);
    expect(res.body.data.fully_completed).toBe(false);
    expect(res.body.data.waiting_for).toBe('helper');

    // Should NOT have called the final UPDATE status='completed'
    const updateStatusCall = mockQuery.mock.calls.find(
      (args: any[]) => args[0]?.includes?.("status = 'completed'")
    );
    expect(updateStatusCall).toBeUndefined();

    // Should NOT have published match_completed event
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('sets status=completed and publishes event when both parties have marked done', async () => {
    // RETURNING shows both done_at timestamps set
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [BASE_MATCH] })           // SELECT match
      .mockResolvedValueOnce({                                                // UPDATE SET responder_done_at
        rows: [{ requester_done_at: new Date(), responder_done_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] })                                   // UPDATE status='completed'
      .mockResolvedValueOnce({ rows: [] })                                   // UPDATE help_requests status='completed'
      .mockResolvedValueOnce({ rows: [] });                                   // feed_events INSERT (fire-and-forget)

    const app = await buildApp();
    const res = await request(app)
      .put('/matches/match-1/complete')
      .send({ user_id: 'helper-user' });

    expect(res.status).toBe(200);
    expect(res.body.data.fully_completed).toBe(true);
    expect(res.body.data.waiting_for).toBeNull();

    // Must have published the karma event exactly once
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith('match_completed', expect.objectContaining({
      match_id: 'match-1',
      requester_id: 'requester-user',
      responder_id: 'helper-user',
    }));
  });

  it('returns 403 when caller is not a party to the match', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [BASE_MATCH] });

    const app = await buildApp();
    const res = await request(app)
      .put('/matches/match-1/complete')
      .send({ user_id: 'random-stranger' });

    expect(res.status).toBe(403);
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('returns 404 when match does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const app = await buildApp();
    const res = await request(app)
      .put('/matches/nonexistent/complete')
      .send({ user_id: 'requester-user' });

    expect(res.status).toBe(404);
  });
});
