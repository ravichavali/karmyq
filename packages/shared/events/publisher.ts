import Queue from 'bull';
import { consumerQueueName, DEDICATED_EVENTS, EVENT_CONSUMERS, EVENT_ROUTES, EventConsumer, UNCONSUMED_EVENTS } from './routes';

const JOB_OPTIONS: Queue.JobOptions = {
  removeOnComplete: 100,
  removeOnFail: false,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
};

export function createPublisher(source: string) {
  let queues: Map<EventConsumer, Queue.Queue> | undefined;

  async function initEventPublisher() {
    const redis = process.env.REDIS_URL || 'redis://localhost:6379';
    queues = new Map(EVENT_CONSUMERS.map((consumer) => {
      const queue = new Queue(consumerQueueName(consumer), redis, { defaultJobOptions: JOB_OPTIONS });
      queue.on('error', (error) => console.error(`Event queue ${consumerQueueName(consumer)} error:`, error));
      return [consumer, queue] as const;
    }));
    console.log('✅ Event publisher connected to Redis');
  }

  /** Enqueue on the one consumer queue that handles `eventType` (ADR-101); null for an unconsumed event. */
  async function publishEvent(eventType: string, payload: any): Promise<Queue.Job | null> {
    if (!queues) throw new Error('Event queue not initialized');
    const consumer = EVENT_ROUTES[eventType];
    if (!consumer) {
      if (UNCONSUMED_EVENTS.has(eventType)) return null;
      const dedicated = DEDICATED_EVENTS[eventType];
      if (dedicated) throw new Error(`Event ${eventType} has a dedicated transport: ${dedicated.queue}`);
      throw new Error(`Event ${eventType} is not classified in packages/shared/events/routes.ts`);
    }
    const job = await queues.get(consumer)!.add(eventType, {
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
