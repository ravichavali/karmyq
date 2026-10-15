import Queue from 'bull';
import { consumerQueueName, DEDICATED_EVENTS, EVENT_ROUTES, EventConsumer, UNCONSUMED_EVENTS } from './routes';

const JOB_OPTIONS: Queue.JobOptions = {
  removeOnComplete: 100,
  removeOnFail: false,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
};

export function createPublisher(source: string) {
  let redis: string | undefined;
  // Opened on first use: most services publish to one consumer (or none), and each Bull queue holds Redis connections.
  const queues = new Map<EventConsumer, Queue.Queue>();

  function queueFor(consumer: EventConsumer): Queue.Queue {
    let queue = queues.get(consumer);
    if (!queue) {
      const name = consumerQueueName(consumer);
      queue = new Queue(name, redis!, { defaultJobOptions: JOB_OPTIONS });
      queue.on('error', (error) => console.error(`Event queue ${name} error:`, error));
      queues.set(consumer, queue);
    }
    return queue;
  }

  async function initEventPublisher() {
    redis = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log('✅ Event publisher ready');
  }

  /** Enqueue on the one consumer queue that handles `eventType` (ADR-101); null for an unconsumed event. */
  async function publishEvent(eventType: string, payload: any): Promise<Queue.Job | null> {
    if (!redis) throw new Error('Event queue not initialized');
    const consumer = EVENT_ROUTES[eventType];
    if (!consumer) {
      if (UNCONSUMED_EVENTS.has(eventType)) return null;
      const dedicated = DEDICATED_EVENTS[eventType];
      if (dedicated) throw new Error(`Event ${eventType} has a dedicated transport: ${dedicated.queue}`);
      throw new Error(`Event ${eventType} is not classified in packages/shared/events/routes.ts`);
    }
    const job = await queueFor(consumer).add(eventType, {
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      source,
    });
    console.log(`📤 Published event: ${eventType} → ${consumerQueueName(consumer)}`, payload);
    return job;
  }

  return { initEventPublisher, publishEvent };
}
