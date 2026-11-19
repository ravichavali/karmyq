import express from 'express';
import request from 'supertest';
import router from '../../src/routes/governance';
import * as governance from '../../src/database/governanceDb';
import { GovernanceError } from '../../src/database/governancePolicy';

jest.mock('../../src/database/governanceDb');
jest.mock('../../src/database/db', () => ({ __esModule: true, default: { query: jest.fn() } }));

const communityId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
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
});

describe('Sprint 143 nomination close routes', () => {
  it.each([
    ['withdraw', 'withdrawn'],
    ['decline', 'declined'],
  ] as const)('scopes %s to the path and JWT identity', async (action, status) => {
    (governance.closeNomination as jest.Mock).mockResolvedValue({ id: nominationId, status });
    const res = await request(app).post(`${path}/${action}/${nominationId}`)
      .set('x-test-identity', userId)
      .send({ user_id: '99999999-9999-4999-8999-999999999999', callerId: userId });

    expect(res.status).toBe(200);
    expect(governance.closeNomination).toHaveBeenCalledWith({
      communityId,
      nominationId,
      callerId: userId,
      action,
    });
    expect(res.body).toEqual({ success: true, data: { id: nominationId, status } });
  });

  it.each(['withdraw', 'decline'])('rejects a malformed nomination UUID before %s reaches the DB', async (action) => {
    const res = await request(app).post(`${path}/${action}/not-a-uuid`).set('x-test-identity', userId);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'A valid nomination identifier is required.',
      error: 'INVALID_REQUEST',
    });
    expect(governance.closeNomination).not.toHaveBeenCalled();
  });

  it.each([
    ['withdraw', 403, 'GOVERNANCE_NOT_NOMINATOR'],
    ['decline', 403, 'GOVERNANCE_NOT_NOMINEE'],
    ['withdraw', 409, 'GOVERNANCE_NOMINATION_EXPIRED'],
    ['decline', 409, 'GOVERNANCE_NOMINATION_EXPIRED'],
  ] as const)('maps %s refusal %i %s to an ADR-074 envelope', async (action, status, code) => {
    (governance.closeNomination as jest.Mock).mockRejectedValue(
      new GovernanceError(status, code, 'Nomination could not be closed.'),
    );
    const res = await request(app).post(`${path}/${action}/${nominationId}`).set('x-test-identity', userId);
    expect(res.status).toBe(status);
    expect(res.body).toEqual({
      success: false,
      message: 'Nomination could not be closed.',
      error: code,
    });
  });

  it.each(['withdraw', 'decline'])('logs unexpected %s failures without exposing SQL', async (action) => {
    (governance.closeNomination as jest.Mock).mockRejectedValue(new Error('secret SQL nomination details'));
    const res = await request(app).post(`${path}/${action}/${nominationId}`).set('x-test-identity', userId);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: 'The governance operation could not be completed.',
      error: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/secret|SQL|nomination details/);
    expect(logError).toHaveBeenCalled();
  });
});
