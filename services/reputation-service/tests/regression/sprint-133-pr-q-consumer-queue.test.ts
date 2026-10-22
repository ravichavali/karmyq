/**
 * Sprint 133 PR Q (ADR-101, BUG-060) gave reputation-service its own consumer queue. Sprint 134 PR L retired
 * its one routed event (interaction_feedback_submitted, BUG-068) and the legacy shared-queue handlers, so it
 * now attaches only to its dedicated queues: match_completed on its completion queue, plus community evolution.
 */
const mockQueues: Record<string, Record<string, (job: any) => Promise<unknown>>> = {};
// A plain constructor, not jest.fn(impl): the root config's resetMocks would wipe the implementation.
jest.mock('bull', () => function MockBull(name: string) {
  mockQueues[name] ??= {};
  return {
    process: (nameOrFn: unknown, fn?: any) => { if (typeof nameOrFn === 'string' && fn) mockQueues[name][nameOrFn] = fn; },
    on: () => undefined, add: () => undefined, close: () => undefined,
  };
});
jest.mock('../../src/services/standingProjector', () => ({ awardKarmaForCompletedMatch: jest.fn() }));
jest.mock('../../src/services/badgeService', () => ({ checkAndAwardBadges: jest.fn() }));
jest.mock('../../src/services/providerTrustService', () => ({ updateProviderCompletionRate: jest.fn() }));
jest.mock('../../src/services/trustEvolutionService', () => ({ evaluateUserEvolution: jest.fn(), EVOLUTION_SIGNALS: {} }));
jest.mock('../../src/database/trustEvolutionDb', () => ({ isCrossCommunityParticipant: jest.fn(), getDiverseCommunityCount: jest.fn() }));
jest.mock('../../src/services/communityEvolutionService', () => ({ applyCommunityEvolution: jest.fn() }));
jest.mock('../../src/database/db', () => ({ query: jest.fn() }));
import { initEventSubscriber } from '../../src/events/subscriber';

beforeAll(async () => { await initEventSubscriber(); });

it('opens only its dedicated queues: no consumer queue and no legacy karmyq-events queue', () => {
  expect(Object.keys(mockQueues).sort()).toEqual(['karmyq-community-evolution', 'karmyq-completion-reputation']);
});

it('takes match_completed only from its completion queue', () => {
  expect(Object.keys(mockQueues['karmyq-completion-reputation'])).toEqual(['match_completed']);
});
