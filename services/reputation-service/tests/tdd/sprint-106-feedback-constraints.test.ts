/**
 * Sprint 106 / BUG-013 hardening — POST /reputation/feedback is the rating write path. Today it
 * accepts a rating from ANY authenticated user for ANY match, guarding only against double-submission
 * per (rater, match). This sprint adds participant + completed-match validation while keeping the
 * per-rater double-submission guard intact, so BOTH parties can still rate the same match.
 *
 * Requirements pinned here:
 *  - A participant of EITHER role can submit on a completed match.
 *  - The per-(rater, match) double-submission guard still lets the OTHER party rate independently.
 *  - A non-participant is rejected (403).
 *  - Rating a non-completed match is rejected (409).
 *  - An unknown match is rejected (404).
 *  - `to_user_id` must be the counterparty, not an arbitrary user (400).
 */
import express from 'express';
import request from 'supertest';

// Controllable identity for the mocked auth middleware.
let currentUser: any = null;
jest.mock('@karmyq/shared/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

// The feedback DB layer under test control. getMatchParticipation is the new hardening query.
const mockGetMatchParticipation = jest.fn();
const mockHasSubmittedFeedback = jest.fn();
const mockInsertFeedback = jest.fn();
jest.mock('../../src/database/feedbackDb', () => ({
  getMatchParticipation: (...a: any[]) => mockGetMatchParticipation(...a),
  hasSubmittedFeedback: (...a: any[]) => mockHasSubmittedFeedback(...a),
  insertFeedback: (...a: any[]) => mockInsertFeedback(...a),
}));

// Peripheral modules — kept DB-free so importing the router is cheap.
jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
jest.mock('../../src/services/karmaService', () => ({
  getUserKarma: jest.fn(),
  getUserKarmaWithDecay: jest.fn(),
  getUserTrustScore: jest.fn(),
  getOverallTrustScore: jest.fn(),
  getCommunityLeaderboard: jest.fn(),
  updateTrustScore: jest.fn().mockResolvedValue(42),
}));
jest.mock('../../src/database/communityTrustDb', () => ({ getCommunityTrustScore: jest.fn() }));
jest.mock('../../src/services/communityTrustService', () => ({ calculateCommunityTrustScore: jest.fn() }));
jest.mock('../../src/services/badgeService', () => ({ getUserBadges: jest.fn() }));
jest.mock('../../src/services/trustEvolutionService', () => ({
  evaluateUserEvolution: jest.fn(),
  getUserEffectiveParams: jest.fn(),
  EVOLUTION_SIGNALS: {
    CROSS_COMMUNITY_POSITIVE_FEEDBACK: 'pos',
    CROSS_COMMUNITY_NEGATIVE_FEEDBACK: 'neg',
  },
}));
jest.mock('../../src/database/trustEvolutionDb', () => ({
  isCrossCommunityParticipant: jest.fn().mockResolvedValue(false),
  getUserTrustConfig: jest.fn(),
  upsertUserTrustConfig: jest.fn(),
  getEvolutionLog: jest.fn(),
  getCommunityEvolutionConfig: jest.fn(),
  updateCommunityEvolutionConfig: jest.fn(),
  getEvolutionOptInRate: jest.fn(),
  getGlobalEvolutionPreference: jest.fn(),
  upsertGlobalEvolutionPreference: jest.fn(),
}));
jest.mock('../../src/services/effectiveParamsCache', () => ({ getCachedEffectiveParams: jest.fn() }));
jest.mock('../../src/database/communityEvolutionDb', () => ({
  getCommunityEvolutionHistory: jest.fn(),
  getCommunityEvolutionSummary: jest.fn(),
}));

import reputationRouter from '../../src/routes/reputation';

const REQUESTER = 'user-requester';
const RESPONDER = 'user-responder';
const STRANGER = 'user-stranger';
const MATCH = 'match-1';
const COMMUNITY = 'community-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/reputation', reputationRouter);
  return app;
}

const body = (over: Record<string, any> = {}) => ({
  match_id: MATCH,
  to_user_id: RESPONDER,
  community_id: COMMUNITY,
  rating: 5,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = { userId: REQUESTER, email: 'r@example.com', communities: [] };
  mockGetMatchParticipation.mockResolvedValue({
    requesterId: REQUESTER,
    responderId: RESPONDER,
    status: 'completed',
    communityIds: [COMMUNITY],
  });
  mockHasSubmittedFeedback.mockResolvedValue(false);
  mockInsertFeedback.mockResolvedValue(undefined);
});

describe('POST /reputation/feedback — BUG-013 participant + completed hardening', () => {
  it('lets the requester rate the responder on a completed match', async () => {
    const res = await request(buildApp()).post('/reputation/feedback').send(body());
    expect(res.status).toBe(200);
    expect(mockInsertFeedback).toHaveBeenCalledWith(REQUESTER, RESPONDER, MATCH, COMMUNITY, 5);
  });

  it('lets the responder rate the requester on the same completed match (symmetric)', async () => {
    currentUser = { userId: RESPONDER, email: 'b@example.com', communities: [] };
    const res = await request(buildApp())
      .post('/reputation/feedback')
      .send(body({ to_user_id: REQUESTER }));
    expect(res.status).toBe(200);
    expect(mockInsertFeedback).toHaveBeenCalledWith(RESPONDER, REQUESTER, MATCH, COMMUNITY, 5);
  });

  it('checks double-submission per rater, so the other party can still rate', async () => {
    // The requester already rated, but the responder has not — the responder must still succeed.
    currentUser = { userId: RESPONDER, email: 'b@example.com', communities: [] };
    mockHasSubmittedFeedback.mockResolvedValue(false);
    const res = await request(buildApp())
      .post('/reputation/feedback')
      .send(body({ to_user_id: REQUESTER }));
    expect(res.status).toBe(200);
    expect(mockHasSubmittedFeedback).toHaveBeenCalledWith(RESPONDER, MATCH);
  });

  it('rejects a second submission from the SAME rater (409)', async () => {
    mockHasSubmittedFeedback.mockResolvedValue(true);
    const res = await request(buildApp()).post('/reputation/feedback').send(body());
    expect(res.status).toBe(409);
    expect(mockInsertFeedback).not.toHaveBeenCalled();
  });

  it('rejects a non-participant (403)', async () => {
    currentUser = { userId: STRANGER, email: 's@example.com', communities: [] };
    const res = await request(buildApp()).post('/reputation/feedback').send(body({ to_user_id: REQUESTER }));
    expect(res.status).toBe(403);
    expect(mockInsertFeedback).not.toHaveBeenCalled();
  });

  it('rejects rating a match that is not completed (409)', async () => {
    mockGetMatchParticipation.mockResolvedValue({
      requesterId: REQUESTER,
      responderId: RESPONDER,
      status: 'matched',
    });
    const res = await request(buildApp()).post('/reputation/feedback').send(body());
    expect(res.status).toBe(409);
    expect(mockInsertFeedback).not.toHaveBeenCalled();
  });

  it('rejects an unknown match (404)', async () => {
    mockGetMatchParticipation.mockResolvedValue(null);
    const res = await request(buildApp()).post('/reputation/feedback').send(body());
    expect(res.status).toBe(404);
    expect(mockInsertFeedback).not.toHaveBeenCalled();
  });

  it('rejects a to_user_id that is not the counterparty (400)', async () => {
    // Requester tries to rate someone who is not the responder.
    const res = await request(buildApp()).post('/reputation/feedback').send(body({ to_user_id: STRANGER }));
    expect(res.status).toBe(400);
    expect(mockInsertFeedback).not.toHaveBeenCalled();
  });

  it('rejects a community_id the match was not posted to (400) — no cross-community attribution', async () => {
    // Participant + completed + correct counterparty, but an arbitrary community the match never touched.
    const res = await request(buildApp())
      .post('/reputation/feedback')
      .send(body({ community_id: 'community-not-on-this-match' }));
    expect(res.status).toBe(400);
    expect(mockInsertFeedback).not.toHaveBeenCalled();
  });
});
