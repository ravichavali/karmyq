import Queue from 'bull';

const TARGETS = ['reputation', 'notification', 'social-graph'] as const;
const options: Queue.QueueOptions = {
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: 'exponential', delay: 2000 },
    // Keep successful identities beyond the entire retry window; count eviction could
    // otherwise let a busy queue duplicate a successful target on a partial-fanout retry.
    removeOnComplete: { age: 86400 },
    removeOnFail: false,
  },
};
let dispatch: Queue.Queue | undefined;

export function startCompletionDelivery(): void {
  if (dispatch) return;
  const redis = process.env.REDIS_URL || 'redis://localhost:6379';
  dispatch = new Queue('karmyq-completion-dispatch', redis, options);
  const targets = TARGETS.map(name => new Queue(`karmyq-completion-${name}`, redis, options));
  for (const queue of [dispatch, ...targets]) queue.on('error', error => console.error('Completion queue error:', error));
  dispatch.process('match_completed', async job => {
    const id = completionId(job.data.payload);
    await Promise.all(targets.map(queue => queue.add('match_completed', job.data, { jobId: id })));
  });
}

function completionId(payload: any): string {
  if (typeof payload?.match_id !== 'string' || !payload.match_id) throw new Error('Completion event requires match_id');
  return `completion-${payload.match_id}`;
}

export async function publishCompletionEvent(payload: any): Promise<void> {
  if (!dispatch) throw new Error('Completion delivery not initialized');
  await dispatch.add('match_completed', {
    eventType: 'match_completed', payload, timestamp: new Date().toISOString(), source: 'request-service',
  }, { jobId: completionId(payload) });
}
