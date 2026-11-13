import express from 'express';
import request from 'supertest';
import router from '../../src/routes/governance';
import * as governance from '../../src/database/governanceDb';
import pool from '../../src/database/db';
import { GovernanceError } from '../../src/database/governancePolicy';

jest.mock('../../src/database/governanceDb');
jest.mock('../../src/database/db', () => ({ __esModule: true, default: { query: jest.fn() } }));

const communityId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const nominatedUserId = '33333333-3333-4333-8333-333333333333';
const nominationId = '44444444-4444-4444-8444-444444444444';
const path = `/communities/${communityId}/governance`;
const logError = jest.fn();
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  if (req.headers['x-test-identity']) req.user = { userId: req.headers['x-test-identity'] };
  req.logger = { error: logError };
  next();
});
app.use('/communities', router);

beforeEach(() => {
  jest.resetAllMocks();
  (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: userId, trust_score: 100,
    nominated_user_id: nominatedUserId, governance_settings: { eligibility_threshold: 50, quorum_size: 3 } }] });
});

describe('Sprint 142 governance HTTP boundary', () => {
  it('passes the authenticated viewer to the real state operation and returns one envelope', async () => {
    (governance.getGovernanceState as jest.Mock).mockResolvedValue({ can_nominate: false, nominations: [] });
    const res = await request(app).get(path).set('x-test-identity', userId);
    expect(res.status).toBe(200);
    expect(governance.getGovernanceState).toHaveBeenCalledWith(communityId, userId);
    expect(res.body).toEqual({ success: true, data: { can_nominate: false, nominations: [] } });
  });

  it('derives creation identity and ignores injected quorum, electorate and caller fields', async () => {
    const result = { id: nominationId, quorum_policy_version: 1, electorate_size: 16, required_ratifications: 4 };
    (governance.createNomination as jest.Mock).mockResolvedValue(result);
    const res = await request(app).post(`${path}/nominate`).set('x-test-identity', userId)
      .send({ nominated_user_id: nominatedUserId, role: 'admin', quorum: 1, electorate: [], nominatorId: nominatedUserId });
    expect(res.status).toBe(201);
    expect(governance.createNomination).toHaveBeenCalledWith({ communityId, nominatorId: userId, nominatedUserId, role: 'admin' });
    expect(res.body).toEqual({ success: true, data: result });
  });

  it('scopes voting to the path community, nomination and authenticated voter', async () => {
    const result = { ratified: false, ratification_count: 1, required_ratifications: 3 };
    (governance.addRatification as jest.Mock).mockResolvedValue(result);
    const res = await request(app).post(`${path}/ratify/${nominationId}`).set('x-test-identity', userId).send({ ratifierId: nominatedUserId });
    expect(res.status).toBe(200);
    expect(governance.addRatification).toHaveBeenCalledWith({ communityId, nominationId, ratifierId: userId });
    expect(res.body).toEqual({ success: true, data: result });
  });

  it.each(['get', 'nominate', 'ratify'])('refuses missing identity before %s operations', async (operation) => {
    const res = operation === 'get' ? await request(app).get(path)
      : await request(app).post(`${path}/${operation === 'nominate' ? 'nominate' : `ratify/${nominationId}`}`)
        .send({ nominated_user_id: nominatedUserId, role: 'admin' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: expect.any(String), error: 'UNAUTHORIZED' });
    expect(governance.createNomination).not.toHaveBeenCalled();
    expect(governance.addRatification).not.toHaveBeenCalled();
    expect(governance.getGovernanceState).not.toHaveBeenCalled();
  });

  it.each([
    [`/communities/bad/governance`, 'get', {}],
    [`${path}/nominate`, 'post', { nominated_user_id: 'bad', role: 'admin' }],
    [`${path}/nominate`, 'post', { nominated_user_id: nominatedUserId, role: 'owner' }],
    [`${path}/ratify/bad`, 'post', {}],
  ])('rejects malformed request %s', async (url: string, method: string, body: object) => {
    const res = method === 'get' ? await request(app).get(url).set('x-test-identity', userId)
      : await request(app).post(url).set('x-test-identity', userId).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_REQUEST');
    expect(governance.createNomination).not.toHaveBeenCalled();
    expect(governance.addRatification).not.toHaveBeenCalled();
    expect(governance.getGovernanceState).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'GOVERNANCE_VOTER_NOT_ELIGIBLE'], [404, 'NOT_FOUND'],
    [409, 'GOVERNANCE_NOMINATION_CLOSED'], [409, 'GOVERNANCE_ROLE_ALREADY_HELD'],
    [422, 'GOVERNANCE_ELIGIBILITY_NOT_MET'], [422, 'GOVERNANCE_SELF_RATIFICATION'],
    [503, 'GOVERNANCE_RETRY'],
  ])('preserves deliberate vote denial %i %s', async (status: number, code: string) => {
    (governance.addRatification as jest.Mock).mockRejectedValue(new GovernanceError(status, code, 'Decision refused.'));
    const res = await request(app).post(`${path}/ratify/${nominationId}`).set('x-test-identity', userId).send({});
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ success: false, message: 'Decision refused.', error: code });
  });

  it.each([[409, 'GOVERNANCE_DUPLICATE_NOMINATION'], [422, 'GOVERNANCE_ELECTORATE_TOO_SMALL']])(
    'preserves deliberate creation denial %i %s', async (status: number, code: string) => {
      (governance.createNomination as jest.Mock).mockRejectedValue(new GovernanceError(status, code, 'Decision refused.'));
      const res = await request(app).post(`${path}/nominate`).set('x-test-identity', userId)
        .send({ nominated_user_id: nominatedUserId, role: 'admin' });
      expect(res.status).toBe(status);
      expect(res.body.error).toBe(code);
    },
  );

  it('logs an unexpected DB failure while withholding its private details', async () => {
    (governance.addRatification as jest.Mock).mockRejectedValue(new Error('secret SQL and trust score 88'));
    const res = await request(app).post(`${path}/ratify/${nominationId}`).set('x-test-identity', userId).send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|SQL|88/);
    expect(logError).toHaveBeenCalled();
  });
});
