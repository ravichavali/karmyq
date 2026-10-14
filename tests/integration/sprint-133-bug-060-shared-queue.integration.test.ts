/**
 * Sprint 133 PR B Task B1: BUG-060 reproduction (evidence, not a fix).
 *
 * Three services attach workers to the shared `karmyq-events` queue, each registering only its own
 * job names. Bull 4.16.5 pops ANY waiting job (`brpoplpush` wait -> active, lib/queue.js:1246; the
 * moveToActive Lua script has no name filter) and fails a job whose name has no local handler
 * ('Missing process handler for job type <name>', lib/queue.js:1203-1208). This file proves both
 * halves against real Redis and the real running subscribers:
 *   1. the mechanism, deterministically, on a scratch queue;
 *   2. the live behavior, by publishing N `request_created` jobs (handled ONLY by
 *      notification-service) with the production publisher's job options and recording every job's
 *      final state, every attempt's error, and the notification rows each delivery wrote.
 * Missing infrastructure is a failure, never a skip.
 */
import Queue from 'bull';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { createPool } from '../fixtures';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const MISSING = /^Missing process handler for job type /;
const N = 60;
// The production publisher's options (packages/shared/events/publisher.ts).
const PRODUCTION_JOB_OPTIONS = { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: false, removeOnFail: false };
const SUBSCRIBER_CONTAINERS = ['karmyq-notification-service-test', 'karmyq-reputation-service-test', 'karmyq-social-graph-service-test'];

const containerIps = (name: string): string[] =>
  execFileSync('docker', ['inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}', name], { encoding: 'utf8' })
    .trim().split(/\s+/).filter(Boolean);

async function settle(jobs: Queue.Job[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const fresh = await Promise.all(jobs.map(async (j) => (await j.queue.getJob(j.id))!));
    const states = await Promise.all(fresh.map((j) => j.getState()));
    if (states.every((s) => s === 'completed' || s === 'failed')) return fresh.map((j, i) => ({ job: j, state: states[i] }));
    if (Date.now() > deadline) throw new Error(`jobs did not settle: ${JSON.stringify(states)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('Sprint 133 BUG-060: shared karmyq-events queue competition', () => {
  jest.setTimeout(120000);

  it('mechanism: a worker that registered only other names takes a foreign job and fails it', async () => {
    const probe = new Queue(`karmyq-bug060-probe-${randomUUID()}`, REDIS_URL);
    try {
      let otherRan = 0;
      probe.process('some_other_event', async () => { otherRan++; });
      const job = await probe.add('request_created', { probe: true }, { attempts: 1, removeOnFail: false });
      const [{ job: settled, state }] = await settle([job], 20000);
      expect(state).toBe('failed');
      expect(settled.failedReason).toBe('Missing process handler for job type request_created');
      expect(otherRan).toBe(0);
    } finally {
      await probe.obliterate({ force: true }).catch(() => undefined);
      await probe.close();
    }
  });

  describe('live: request_created against the real notification, reputation and social-graph subscribers', () => {
    const pool = createPool();
    const events = new Queue('karmyq-events', REDIS_URL);
    const requester = randomUUID(), member = randomUUID(), community = randomUUID();
    const published: Queue.Job[] = [];

    beforeAll(async () => {
      await pool.query('SELECT 1');
      for (const id of [requester, member]) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, 'BUG-060 fixture', `${id}@bug060.test`, 'not-a-login']);
      await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [community, `BUG-060 ${community}`, 'Fixture', requester]);
      for (const id of [requester, member]) await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, community]);
    });
    afterAll(async () => {
      try {
        for (const j of published) await j.remove().catch(() => undefined);
        await pool.query('DELETE FROM notifications.notifications WHERE user_id=$1', [member]);
        await pool.query('DELETE FROM communities.communities WHERE id=$1', [community]);
        await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [[requester, member]]);
      } finally {
        await events.close();
        await pool.end();
      }
    });

    it('records every job outcome; any failure is a missing-handler failure and every completion wrote its notification', async () => {
      const workers: Array<{ addr?: string }> = (await events.getWorkers()) ?? [];
      const workerIps = new Set(workers.map((w) => (w.addr ?? '').replace(/:\d+$/, '')));
      for (const name of SUBSCRIBER_CONTAINERS) {
        expect({ name, attached: containerIps(name).some((ip) => workerIps.has(ip)) }).toEqual({ name, attached: true });
      }

      const requestIds = Array.from({ length: N }, () => randomUUID());
      for (const request_id of requestIds) {
        published.push(await events.add('request_created', {
          eventType: 'request_created',
          payload: { request_id, community_id: community, requester_id: requester, title: 'BUG-060 probe' },
          timestamp: new Date().toISOString(),
          source: 'sprint-133-bug-060-test',
        }, PRODUCTION_JOB_OPTIONS));
      }
      const outcomes = await settle(published, 90000);

      const rows = await pool.query(
        "SELECT data->>'request_id' AS request_id, count(*)::int AS n FROM notifications.notifications WHERE user_id=$1 AND type='new_request' GROUP BY 1",
        [member]);
      const delivered = new Map<string, number>(rows.rows.map((r) => [r.request_id, r.n]));

      const records = outcomes.map(({ job, state }) => ({
        request_id: job.data.payload.request_id as string,
        state,
        attemptsMade: job.attemptsMade,
        errors: (job.stacktrace ?? []).map((s) => s.split('\n')[0].replace(/^Error: /, '')),
        notifications: delivered.get(job.data.payload.request_id) ?? 0,
      }));
      const lostAttempts = records.reduce((n, r) => n + r.errors.filter((e) => MISSING.test(e)).length, 0);
      const summary = {
        published: N,
        completed: records.filter((r) => r.state === 'completed').length,
        failed: records.filter((r) => r.state === 'failed').length,
        jobsWithMissingHandlerAttempt: records.filter((r) => r.errors.some((e) => MISSING.test(e))).length,
        missingHandlerAttempts: lostAttempts,
        neverReachedNotification: records.filter((r) => r.notifications === 0).length,
        workersOnKarmyqEvents: workers.length,
      };
      // Evidence for BUGS.md / ADR-100: printed in the CI job log on every run.
      console.warn(`BUG-060 EVIDENCE ${JSON.stringify(summary)}`);
      console.warn(`BUG-060 FAILED JOBS ${JSON.stringify(records.filter((r) => r.state === 'failed'))}`);

      // Every error observed is the shared-queue mechanism, not a handler fault.
      for (const r of records) for (const e of r.errors) expect(e).toMatch(MISSING);
      // A completed job reached notification exactly once; a failed one never did.
      for (const r of records) expect({ id: r.request_id, n: r.notifications }).toEqual({ id: r.request_id, n: r.state === 'completed' ? 1 : 0 });
      // One clean run cannot refute competition (the mechanism test above proves it); it can only fail to observe it.
      expect(summary.completed + summary.failed).toBe(N);
    });
  });
});
