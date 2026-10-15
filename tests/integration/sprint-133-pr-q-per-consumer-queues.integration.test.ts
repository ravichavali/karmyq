/**
 * Sprint 133 PR Q (ADR-101): BUG-060 fixed. Events go through the REAL routed publisher to
 * per-consumer queues that only the consumer's container attaches to. Expect zero lost jobs.
 * Missing infrastructure is a failure, never a skip.
 */
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { consumerQueueName, createPublisher } from '@karmyq/shared';
import { createPool } from '../fixtures';
import { containerIps, settle } from './queueHelpers';

process.env.REDIS_URL ??= 'redis://localhost:6380'; // createPublisher reads it at init; its own default is 6379
const REDIS_URL = process.env.REDIS_URL;
const SOURCE = 'sprint-133-pr-q-test';
const N = 60;
const M = 20;

async function workerIps(queue: Queue.Queue): Promise<string[]> {
  const workers: Array<{ addr?: string }> = (await queue.getWorkers()) ?? [];
  return workers.map((w) => (w.addr ?? '').replace(/:\d+$/, ''));
}
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
  const reputationQ = new Queue(consumerQueueName('reputation'), REDIS_URL);
  const legacy = new Queue('karmyq-events', REDIS_URL);
  const requester = randomUUID(), member = randomUUID(), community = randomUUID();
  const published: Queue.Job[] = [];

  beforeAll(async () => {
    await publisher.initEventPublisher();
    for (const id of [requester, member]) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, 'PR Q fixture', `${id}@prq.test`, 'not-a-login']);
    await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [community, `PR Q ${community}`, 'Fixture', requester]);
    for (const id of [requester, member]) await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, community]);
    await pool.query('INSERT INTO reputation.trust_scores(user_id,community_id,total_feedback_received) VALUES ($1,$2,0)', [member, community]);
  });
  afterAll(async () => {
    try {
      for (const j of published) await j.remove().catch(() => undefined);
      await pool.query('DELETE FROM notifications.notifications WHERE user_id=$1', [member]);
      await pool.query('DELETE FROM reputation.trust_scores WHERE user_id=$1', [member]);
      await pool.query('DELETE FROM communities.communities WHERE id=$1', [community]);
      await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [[requester, member]]);
    } finally {
      const publisherQueues = new Set(published.map((j) => j.queue)); // the publisher has no close(); its queues are reachable from its jobs
      await Promise.all([...publisherQueues, notificationQ, reputationQ, legacy].map((q) => q.close()));
      await pool.end();
    }
  });

  it('attaches only the consumer container to each consumer queue', async () => {
    const notifIps = new Set(containerIps('karmyq-notification-service-test'));
    const repIps = new Set(containerIps('karmyq-reputation-service-test'));
    const onNotif = await workerIps(notificationQ);
    const onRep = await workerIps(reputationQ);
    expect(onNotif.length).toBeGreaterThan(0);
    expect(onRep.length).toBeGreaterThan(0);
    expect(onNotif.filter((ip) => !notifIps.has(ip))).toEqual([]);
    expect(onRep.filter((ip) => !repIps.has(ip))).toEqual([]);
  });

  it(`delivers all ${N} request_created and all ${M} interaction_feedback_submitted with no failed attempt, never touching karmyq-events`, async () => {
    const requestIds = Array.from({ length: N }, () => randomUUID());
    for (const request_id of requestIds) {
      published.push((await publisher.publishEvent('request_created', { request_id, community_id: community, requester_id: requester, title: 'PR Q probe' }))!);
    }
    for (let i = 0; i < M; i++) {
      published.push((await publisher.publishEvent('interaction_feedback_submitted', { to_user_id: member, community_id: community, helpfulness: 5, responsiveness: 4, clarity: 3 }))!);
    }
    const outcomes = await settle(published, 90000);

    const failedAttempts = outcomes.flatMap(({ job, state }) => (job.stacktrace ?? []).map((s) => `${job.name}:${state}:${s.split('\n')[0]}`));
    console.warn(`PR Q EVIDENCE ${JSON.stringify({ published: outcomes.length, completed: outcomes.filter((o) => o.state === 'completed').length, failedAttempts: failedAttempts.length })}`);
    expect(failedAttempts).toEqual([]);
    expect(outcomes.map((o) => o.state)).toEqual(Array(N + M).fill('completed'));

    const rows = await pool.query("SELECT data->>'request_id' AS request_id, count(*)::int AS n FROM notifications.notifications WHERE user_id=$1 AND type='new_request' GROUP BY 1", [member]);
    const delivered = new Map<string, number>(rows.rows.map((r) => [r.request_id, r.n]));
    expect(requestIds.map((id) => delivered.get(id) ?? 0)).toEqual(Array(N).fill(1));

    const ts = await pool.query('SELECT total_feedback_received, avg_helpfulness::float AS h, avg_responsiveness::float AS r, avg_clarity::float AS c FROM reputation.trust_scores WHERE user_id=$1 AND community_id=$2', [member, community]);
    expect(ts.rows[0]).toEqual({ total_feedback_received: M, h: 5, r: 4, c: 3 });

    expect(await jobsWhere(legacy, (d) => d?.source === SOURCE)).toEqual([]);
  });

  it('an unconsumed event never reaches Redis', async () => {
    const marker = randomUUID();
    await expect(publisher.publishEvent('user_created', { userId: marker })).resolves.toBeNull();
    for (const q of [notificationQ, reputationQ, legacy]) {
      expect({ queue: q.name, jobs: await jobsWhere(q, (d) => d?.payload?.userId === marker) }).toEqual({ queue: q.name, jobs: [] });
    }
  });
});
