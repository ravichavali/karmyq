/**
 * Sprint 133 PR B Task B1: BUG-060 reproduction (evidence, not a fix).
 *
 * Bull 4.16.5 pops ANY waiting job (`brpoplpush` wait -> active, lib/queue.js:1246; the moveToActive
 * Lua script has no name filter) and fails a job whose name has no local handler ('Missing process
 * handler for job type <name>', lib/queue.js:1203-1208). That is why no queue may carry two services'
 * workers (ADR-101). This file proves the mechanism, deterministically, on a scratch queue.
 *
 * The live half, which published to the shared `karmyq-events` queue and recorded the jobs the three
 * competing subscribers lost, was retired in Sprint 134 PR L with the legacy handlers themselves.
 * sprint-133-pr-q-per-consumer-queues.integration.test.ts now asserts that no container attaches to
 * `karmyq-events` at all. Missing infrastructure is a failure, never a skip.
 */
import Queue from 'bull';
import { randomUUID } from 'crypto';
import { settle } from './queueHelpers';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

describe('Sprint 133 BUG-060: a shared queue loses jobs to foreign workers', () => {
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
});
