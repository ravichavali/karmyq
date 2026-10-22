/**
 * Sprint 133 PR Q (ADR-101): BUG-060 fixed. Events go through the REAL routed publisher to
 * per-consumer queues that only the consumer's container attaches to. Expect zero lost jobs.
 * Sprint 134 PR L removed the legacy `karmyq-events` handlers and reputation's consumer queue (its one
 * routed event was retired, BUG-068), so notification is the only consumer and nothing attaches to either
 * retired queue. Missing infrastructure is a failure, never a skip.
 */
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { consumerQueueName, createPublisher } from '@karmyq/shared';
import { createPool } from '../fixtures';
import { containerIps, newCommunityFixture, removeCommunityFixture, seedCommunityFixture, settle, workerIps } from './queueHelpers';

process.env.REDIS_URL ??= 'redis://localhost:6380'; // createPublisher reads it at init; its own default is 6379
const REDIS_URL = process.env.REDIS_URL;
const SOURCE = 'sprint-133-pr-q-test';
const N = 60;

// Match on this test's own jobs, never on queue totals: containers can still emit events left over from earlier suites.
async function jobsWhere(queue: Queue.Queue, pred: (data: any) => boolean): Promise<string[]> {
  const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
  return jobs.filter((j) => j && pred(j.data)).map((j) => String(j.id));
}

describe('Sprint 133 PR Q: per-consumer queues deliver every job', () => {
  jest.setTimeout(120000);
  const pool = createPool();
  const publisher = createPublisher(SOURCE);
  const notificationQ = new Queue(consumerQueueName('notification'), REDIS_URL);
  const legacy = new Queue('karmyq-events', REDIS_URL);
  const retiredReputationQ = new Queue('karmyq-events-reputation', REDIS_URL);
  const fx = newCommunityFixture();
  const { requester, member, community } = fx;
  const published: Queue.Job[] = [];

  beforeAll(async () => {
    await publisher.initEventPublisher();
    await seedCommunityFixture(pool, fx, 'PR Q');
  });
  afterAll(async () => {
    try {
      for (const j of published) await j.remove().catch(() => undefined);
      await removeCommunityFixture(pool, fx);
    } finally {
      const publisherQueues = new Set(published.map((j) => j.queue)); // the publisher has no close(); its queues are reachable from its jobs
      await Promise.all([...publisherQueues, notificationQ, legacy, retiredReputationQ].map((q) => q.close()));
      await pool.end();
    }
  });

  it('attaches only the notification container to its queue, and nothing to the retired queues', async () => {
    const notifIps = new Set(containerIps('karmyq-notification-service-test'));
    const onNotif = await workerIps(notificationQ);
    expect(onNotif.length).toBeGreaterThan(0);
    expect(onNotif.filter((ip) => !notifIps.has(ip))).toEqual([]);
    expect({ legacy: await workerIps(legacy), reputation: await workerIps(retiredReputationQ) }).toEqual({ legacy: [], reputation: [] });
  });

  it(`delivers all ${N} request_created with no failed attempt, never touching karmyq-events`, async () => {
    const requestIds = Array.from({ length: N }, () => randomUUID());
    for (const request_id of requestIds) {
      published.push((await publisher.publishEvent('request_created', { request_id, community_id: community, requester_id: requester, title: 'PR Q probe' }))!);
    }
    const outcomes = await settle(published, 90000);

    const failedAttempts = outcomes.flatMap(({ job, state }) => (job.stacktrace ?? []).map((s) => `${job.name}:${state}:${s.split('\n')[0]}`));
    console.warn(`PR Q EVIDENCE ${JSON.stringify({ published: outcomes.length, completed: outcomes.filter((o) => o.state === 'completed').length, failedAttempts: failedAttempts.length })}`);
    expect(failedAttempts).toEqual([]);
    expect(outcomes.map((o) => o.state)).toEqual(Array(N).fill('completed'));

    const rows = await pool.query("SELECT data->>'request_id' AS request_id, count(*)::int AS n FROM notifications.notifications WHERE user_id=$1 AND type='new_request' GROUP BY 1", [member]);
    const delivered = new Map<string, number>(rows.rows.map((r) => [r.request_id, r.n]));
    expect(requestIds.map((id) => delivered.get(id) ?? 0)).toEqual(Array(N).fill(1));

    expect(await jobsWhere(legacy, (d) => d?.source === SOURCE)).toEqual([]);
  });

  it('an unconsumed event never reaches Redis', async () => {
    const marker = randomUUID();
    await expect(publisher.publishEvent('user_created', { userId: marker })).resolves.toBeNull();
    for (const q of [notificationQ, legacy, retiredReputationQ]) {
      expect({ queue: q.name, jobs: await jobsWhere(q, (d) => d?.payload?.userId === marker) }).toEqual({ queue: q.name, jobs: [] });
    }
  });
});
