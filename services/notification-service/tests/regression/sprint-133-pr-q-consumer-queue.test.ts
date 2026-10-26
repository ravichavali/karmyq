/**
 * Sprint 133 PR Q (ADR-101, BUG-060, BUG-066): notification-service consumes its own queue and its
 * push handlers read the published envelope's payload. Sprint 134 PR L removed the legacy shared queue.
 */
const mockQueues: Record<string, Record<string, (job: any) => Promise<void>>> = {};
const mockQuery = jest.fn();
const mockPush = jest.fn();
// A plain constructor, not jest.fn(impl): the root config's resetMocks would wipe the implementation.
jest.mock('bull', () => function MockBull(name: string) {
  mockQueues[name] ??= {};
  return { process: (type: string, handler: any) => { mockQueues[name][type] = handler; }, on: () => undefined };
});
jest.mock('../../src/database/db', () => ({ query: (...a: any[]) => mockQuery(...a), getClient: async () => ({ query: (...a: any[]) => mockQuery(...a), release: jest.fn() }) }));
jest.mock('../../src/lib/expoPush', () => ({ sendPushToUsers: (...a: any[]) => mockPush(...a) }));
import { eventsFor } from '@karmyq/shared';
import { initEventSubscriber } from '../../src/events/subscriber';

const envelope = (eventType: string, payload: Record<string, unknown>) => ({ data: { eventType, payload, timestamp: 't', source: 'request-service' } });

beforeAll(async () => { await initEventSubscriber(); });
beforeEach(() => { mockQuery.mockReset(); mockPush.mockReset(); });

describe('ADR-101: notification consumes its own queue', () => {
  it('attaches exactly the routed notification events to karmyq-events-notification', () => {
    expect(Object.keys(mockQueues['karmyq-events-notification']).sort()).toEqual(eventsFor('notification'));
  });

  it('opens no legacy karmyq-events queue (Sprint 134 PR L) and takes match_completed only from its completion queue', () => {
    expect(Object.keys(mockQueues).sort()).toEqual(['karmyq-completion-notification', 'karmyq-directed-notifications', 'karmyq-events-notification']);
    expect(Object.keys(mockQueues['karmyq-completion-notification'])).toEqual(['match_completed']);
  });
});

describe('BUG-066: push handlers read the published envelope', () => {
  const handler = (name: string) => mockQueues['karmyq-events-notification'][name];

  it('provider_went_on_duty pushes the open-request count to the provider', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'r1', title: 'a' }, { id: 'r2', title: 'b' }] });
    await handler('provider_went_on_duty')(envelope('provider_went_on_duty', { providerId: 'prov', providerUserId: 'P', communityIds: ['C'] }));
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM requests.help_requests'), [['C']]);
    expect(mockPush).toHaveBeenCalledWith(['P'], 'Requests waiting in your community', '2 open requests match your services. Tap to view.', { type: 'provider_on_duty', count: 2 });
  });

  it('offer_submitted pushes the requester with the price', async () => {
    await handler('offer_submitted')(envelope('offer_submitted', { offerId: 'o', requestId: 'r', requesterUserId: 'R', providerName: 'x', price: 40 }));
    expect(mockPush).toHaveBeenCalledWith(['R'], 'Someone offered to help', 'You received an offer for $40. Tap to review.', { type: 'offer_received' });
  });

  it('offer_accepted pushes the provider', async () => {
    await handler('offer_accepted')(envelope('offer_accepted', { offerId: 'o', providerUserId: 'P', requesterName: 'x' }));
    expect(mockPush).toHaveBeenCalledWith(['P'], 'Offer accepted!', 'Your offer was accepted. Check your commitments.', { type: 'offer_accepted' });
  });

  it('offer_declined pushes the provider', async () => {
    await handler('offer_declined')(envelope('offer_declined', { offerId: 'o', providerUserId: 'P' }));
    expect(mockPush).toHaveBeenCalledWith(['P'], 'Offer declined', 'Your offer was not accepted this time.', { type: 'offer_declined' });
  });

  it.each([
    ['provider_went_on_duty', { communityIds: ['C'] }],
    ['offer_submitted', { price: 40 }],
    ['offer_accepted', {}],
    ['offer_declined', {}],
  ])('%s without its recipient sends nothing', async (name, payload) => {
    await handler(name)(envelope(name, payload));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
