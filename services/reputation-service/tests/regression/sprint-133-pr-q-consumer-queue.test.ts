/**
 * Sprint 133 PR Q (ADR-101, BUG-060): reputation-service consumes its own queue for the events routed
 * to it and keeps the legacy shared-queue handler for jobs published before the deploy.
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
const mockQuery = jest.fn();
jest.mock('../../src/services/standingProjector', () => ({ awardKarmaForCompletedMatch: jest.fn() }));
jest.mock('../../src/services/badgeService', () => ({ checkAndAwardBadges: jest.fn() }));
jest.mock('../../src/services/providerTrustService', () => ({ updateProviderCompletionRate: jest.fn() }));
jest.mock('../../src/services/trustEvolutionService', () => ({ evaluateUserEvolution: jest.fn(), EVOLUTION_SIGNALS: {} }));
jest.mock('../../src/database/trustEvolutionDb', () => ({ isCrossCommunityParticipant: jest.fn(), getDiverseCommunityCount: jest.fn() }));
jest.mock('../../src/services/communityEvolutionService', () => ({ applyCommunityEvolution: jest.fn() }));
jest.mock('../../src/database/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }));
import { eventsFor } from '@karmyq/shared';
import { initEventSubscriber } from '../../src/events/subscriber';

beforeEach(async () => { await initEventSubscriber(); });

it('attaches exactly the routed reputation events to karmyq-events-reputation', () => {
  expect(Object.keys(mockQueues['karmyq-events-reputation']).sort()).toEqual(eventsFor('reputation'));
});

it('keeps the same feedback handler on the legacy queue and leaves completion on its own queues', () => {
  expect(mockQueues['karmyq-events'].interaction_feedback_submitted).toBe(mockQueues['karmyq-events-reputation'].interaction_feedback_submitted);
  expect(mockQueues['karmyq-events'].match_completed).toBe(mockQueues['karmyq-completion-reputation'].match_completed);
  expect(mockQueues['karmyq-events-reputation'].match_completed).toBeUndefined();
});

it('the routed handler updates the trust score from the envelope payload', async () => {
  mockQuery
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ts', avg_helpfulness: 4, avg_responsiveness: 4, avg_clarity: 4, total_feedback_received: 1 }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [] });
  await mockQueues['karmyq-events-reputation'].interaction_feedback_submitted({
    data: { eventType: 'interaction_feedback_submitted', payload: { to_user_id: 'u', community_id: 'c', helpfulness: 5, responsiveness: 5, clarity: 5 } },
  });
  expect(mockQuery.mock.calls[1][1]).toEqual([4.5, 4.5, 4.5, 2, 'ts']);
});

// BUG-067: mocks accept any SQL, so check the handler's SET columns against the real schema. init.sql is generated from
// the migration chain and held to it by CI's drift check, so it is the live arbiter for column names.
it('BUG-067: every column the feedback handler sets exists on reputation.trust_scores', async () => {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const initSql: string = readFileSync(join(__dirname, '..', '..', '..', '..', 'infrastructure', 'postgres', 'init.sql'), 'utf8');
  const table = initSql.match(/CREATE TABLE reputation\.trust_scores \(([\s\S]*?)\n\);/);
  expect(table).not.toBeNull();
  const columns = new Set(table![1].split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean));
  expect(columns.has('total_feedback_received')).toBe(true); // the parse found the real column list

  mockQuery
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ts', avg_helpfulness: 4, avg_responsiveness: 4, avg_clarity: 4, total_feedback_received: 1 }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [] });
  await mockQueues['karmyq-events-reputation'].interaction_feedback_submitted({
    data: { eventType: 'interaction_feedback_submitted', payload: { to_user_id: 'u', community_id: 'c', helpfulness: 5, responsiveness: 5, clarity: 5 } },
  });
  const update: string = mockQuery.mock.calls[1][0];
  const setColumns = update.split(/\bSET\b/i)[1].split(/\bWHERE\b/i)[0].split(',').map((s) => s.trim().split(/\s*=/)[0]);
  expect(setColumns.length).toBe(5);
  expect(setColumns.filter((c) => !columns.has(c))).toEqual([]);
});

// node-pg returns numeric(3,2) columns as strings ('4.00'), and a rating may be omitted or arrive as a string.
it('averages with numeric DB strings, an omitted rating and a string rating without throwing or concatenating', async () => {
  mockQuery
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ts', avg_helpfulness: '4.00', avg_responsiveness: '4.00', avg_clarity: '3.00', total_feedback_received: 1 }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [] });
  await mockQueues['karmyq-events-reputation'].interaction_feedback_submitted({
    data: { eventType: 'interaction_feedback_submitted', payload: { to_user_id: 'u', community_id: 'c', helpfulness: '5', clarity: 4 } },
  });
  expect(mockQuery.mock.calls[1][1]).toEqual([4.5, 4, 3.5, 2, 'ts']);
});
