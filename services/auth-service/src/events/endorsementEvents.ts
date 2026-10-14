import Queue from 'bull';
import { createLogger } from '@karmyq/shared/utils/logger';

/**
 * Sprint 133 PR B / ADR-100: `skill_endorsement_changed` rides a DEDICATED queue whose only consumer is
 * social-graph. The shared `karmyq-events` queue cannot carry it: Bull 4 hands any waiting job to any
 * worker and fails a job whose name that worker never registered (BUG-060; bull/lib/queue.js:1203-1208).
 * The queue name is mirrored in social-graph-service/src/events/subscriber.ts and services/registry.json.
 */
export const ENDORSEMENT_QUEUE = 'karmyq-skill-endorsement-social-graph';
export const endorsementLog = createLogger('auth-service');
/** The longest a request waits on Redis after its DB change has committed. */
const ENQUEUE_TIMEOUT_MS = 2000;

let queue: Queue.Queue | undefined;
function endorsementQueue(): Queue.Queue {
  if (!queue) {
    queue = new Queue(ENDORSEMENT_QUEUE, process.env.REDIS_URL || 'redis://localhost:6379', {
      // Fail fast when Redis is unreachable instead of queueing commands offline (directedNotifications.ts).
      redis: { maxRetriesPerRequest: 1, connectTimeout: 2000 },
      defaultJobOptions: {
        attempts: 10,
        backoff: { type: 'exponential', delay: 2000 },
        // Keep finished ids past the retry window so a retried publish of the same change dedupes.
        removeOnComplete: { age: 86400 },
        removeOnFail: false,
      },
    });
    queue.on('error', error => endorsementLog.error('Endorsement queue error', error));
  }
  return queue;
}

export interface EndorsementChange {
  /** auth.skill_endorsements.id */
  rowId: string;
  /** The row's revision after the change, or 'deleted' when a tag deletion cascaded the row. */
  revision: number | string;
  endorser_id: string;
  endorsee_id: string;
}

/** One id per CHANGE: distinct changes never collide, and a retry of the same change reuses its id. */
export function endorsementJobId(change: Pick<EndorsementChange, 'rowId' | 'revision'>): string {
  return change.revision === 'deleted' ? `endorsement-${change.rowId}-deleted` : `endorsement-${change.rowId}-r${change.revision}`;
}

/**
 * Publish AFTER the DB commit. A failed enqueue never fails the request (the endorsement is real); it is
 * logged with both user ids so an operator can run the reconcile backfill, and the pair heals on its
 * next endorsement change. ADR-100 documents this lost-enqueue gap.
 */
export async function publishEndorsementChanged(change: EndorsementChange): Promise<boolean> {
  const jobId = endorsementJobId(change);
  const payload = { endorser_id: change.endorser_id, endorsee_id: change.endorsee_id, job_id: jobId };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      endorsementQueue().add('skill_endorsement_changed', {
        eventType: 'skill_endorsement_changed', payload, timestamp: new Date().toISOString(), source: 'auth-service',
      }, { jobId }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Endorsement queue timed out')), ENQUEUE_TIMEOUT_MS); }),
    ]);
    return true;
  } catch (error) {
    endorsementLog.error('Failed to enqueue skill_endorsement_changed; trust edge stale until the next change or a backfill',
      error instanceof Error ? error : new Error(String(error)), payload);
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
