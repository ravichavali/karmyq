import Queue from 'bull';
import { withTransaction } from '../database/db';

let queue: Queue.Queue | undefined;
let relayRunning = false;
let timer: ReturnType<typeof setInterval> | undefined;
function notificationQueue() {
  if (!queue) {
    queue = new Queue('karmyq-directed-notifications', process.env.REDIS_URL || 'redis://localhost:6379', {
      redis: { maxRetriesPerRequest: 1, connectTimeout: 2000 },
      defaultJobOptions: { attempts: 10, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: false },
    });
    queue.on('error', error => console.error('Directed notification queue error:', error));
  }
  return queue;
}
export async function publishDirectedNotification(payload: { request_id: string }) {
  // Bounded wait: an uncertain acknowledgement leaves the durable outbox pending. A late add
  // and the relay use the same ID; database recipient uniqueness remains the final arbiter.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const id = `directed-${payload.request_id}`;
        const existing = await notificationQueue().getJob(id);
        if (existing) {
          if (await existing.getState() === 'failed') await existing.retry();
          return;
        }
        await notificationQueue().add('directed_request_created', { eventType: 'directed_request_created', payload }, { jobId: id });
      })(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Directed notification queue timed out')), 2000); }),
    ]);
  } finally { if (timeout) clearTimeout(timeout); }
}
export async function relayDirectedNotifications() {
  if (relayRunning) return;
  relayRunning = true;
  try {
    await withTransaction(async q => {
      const pending = await q(`SELECT request_id,payload FROM inventory.borrow_notification_outbox
        WHERE delivered_at IS NULL AND (published_at IS NULL OR published_at<NOW()-INTERVAL '5 minutes')
        ORDER BY request_id LIMIT 20 FOR UPDATE SKIP LOCKED`);
      for (const row of pending.rows) {
        await publishDirectedNotification(row.payload);
        await q('UPDATE inventory.borrow_notification_outbox SET published_at=NOW() WHERE request_id=$1', [row.request_id]);
      }
    });
  } finally { relayRunning = false; }
}
export function startDirectedNotificationRelay() {
  if (timer) return;
  const flush = () => { void relayDirectedNotifications().catch(error => console.error('Directed notification relay will retry:', error)); };
  timer = setInterval(flush, 5000); timer.unref(); flush();
}
