import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('../../src/events/publisher', () => ({ publishEvent: jest.fn() }));

import offersRouter from '../../src/routes/offers';
import { publishEvent } from '../../src/events/publisher';

const OWNER = '11111111-1111-1111-1111-111111111111';
const OFFER = '22222222-2222-2222-2222-222222222222';

function app() {
  const server = express(); server.use(express.json());
  server.use((req: any, _res, next) => { req.user = { userId: OWNER, communities: [] }; next(); });
  server.use('/offers', offersRouter);
  return server;
}

beforeEach(() => {
  mockQuery.mockReset(); jest.mocked(publishEvent).mockClear();
  mockQuery.mockImplementation(async (sql: string) => {
    if (/SELECT/.test(sql)) return { rowCount: 1, rows: [{ id: OFFER, status: 'active' }] };
    return { rowCount: 1, rows: [{ id: OFFER, offerer_visibility_consent: true,
      ...(/RETURNING[^;]*\bis_public\b/.test(sql) ? { is_public: true } : {}) }] };
  });
});

it('rejects the retired flag alone without changing any setting or publishing an event', async () => {
  const res = await request(app()).put(`/offers/${OFFER}/privacy`).send({ is_public: true });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ success: false, message: 'No privacy settings provided to update' });
  expect(mockQuery).toHaveBeenCalledTimes(1);
  expect(publishEvent).not.toHaveBeenCalled();
});

it.each([{ offerer_visibility_consent: true }, { offerer_visibility_consent: true, is_public: true }])(
  'updates consent only and omits the retired flag from SQL, response and event: %j', async body => {
    const res = await request(app()).put(`/offers/${OFFER}/privacy`).send(body);
    expect(res.status).toBe(200);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(sql).not.toMatch(/\bis_public\b/);
    expect(params).toEqual([true, OFFER]);
    expect(res.body.data).toEqual({ id: OFFER, offerer_visibility_consent: true });
    expect(publishEvent).toHaveBeenCalledWith('privacy_settings_updated', {
      entity_type: 'offer', entity_id: OFFER, user_id: OWNER, offerer_visibility_consent: true,
    });
  },
);

it('checks ownership before validating a retired-only body', async () => {
  mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
  const res = await request(app()).put(`/offers/${OFFER}/privacy`).send({ is_public: true });
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ success: false, message: 'Offer not found' });
  expect(mockQuery.mock.calls[0][1]).toEqual([OFFER, OWNER]);
  expect(mockQuery).toHaveBeenCalledTimes(1);
  expect(publishEvent).not.toHaveBeenCalled();
});
