import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/db/providerOffersDb', () => ({
  createProviderOffer: jest.fn(),
  getMyProviderOffers: jest.fn(),
  withdrawProviderOffer: jest.fn(),
  validateRequestForOffer: jest.fn(),
}));

jest.mock('../../src/events/publisher', () => ({
  publishEvent: jest.fn(),
}));

import { query } from '../../src/database/db';
import { createProviderOffer, validateRequestForOffer } from '../../src/db/providerOffersDb';
import { publishEvent } from '../../src/events/publisher';

const JWT_SECRET = 'provider-offer-column-test-secret';
const PROVIDER = '11111111-1111-1111-1111-111111111111';
const REQUESTER = '22222222-2222-2222-2222-222222222222';
const REQUEST = '33333333-3333-3333-3333-333333333333';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockCreateProviderOffer = createProviderOffer as jest.MockedFunction<typeof createProviderOffer>;
const mockValidateRequest = validateRequestForOffer as jest.MockedFunction<typeof validateRequestForOffer>;
const mockPublishEvent = publishEvent as jest.MockedFunction<typeof publishEvent>;

function buildApp() {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  app.use('/providers', require('../../src/routes/providerOffers').default);
  return app;
}

describe('Sprint 116 provider-offer requester notification lookup', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockValidateRequest.mockResolvedValue({ valid: true });
    mockCreateProviderOffer.mockResolvedValue({
      id: 'offer-1',
      provider_id: 'profile-1',
      provider_user_id: PROVIDER,
      request_id: REQUEST,
      price: null,
      note: 'Available this weekend.',
      status: 'pending',
    });
    mockPublishEvent.mockResolvedValue(undefined as never);
    mockQuery.mockImplementation(async (sql) => {
      const statement = String(sql);
      if (statement.includes('requests.provider_profiles')) {
        return { rows: [{ id: 'profile-1' }], rowCount: 1 } as any;
      }
      if (statement.includes('SELECT user_id FROM requests.help_requests')) {
        throw new Error('column "user_id" does not exist');
      }
      if (statement.includes('SELECT requester_id FROM requests.help_requests')) {
        return { rows: [{ requester_id: REQUESTER }], rowCount: 1 } as any;
      }
      throw new Error(`Unexpected query: ${statement}`);
    });
  });

  it('returns 201 and notifies the request owner after the offer insert succeeds', async () => {
    const token = jwt.sign({ userId: PROVIDER, email: 'provider@test.karmyq.com' }, JWT_SECRET);

    const response = await request(buildApp())
      .post('/providers/offers')
      .set('Authorization', `Bearer ${token}`)
      .send({ request_id: REQUEST, price: null, note: 'Available this weekend.' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, data: { id: 'offer-1' } });
    expect(mockPublishEvent).toHaveBeenCalledWith('offer_submitted', expect.objectContaining({
      requesterUserId: REQUESTER,
      requestId: REQUEST,
      offerId: 'offer-1',
    }));
  });
});
