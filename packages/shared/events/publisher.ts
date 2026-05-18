import Queue from 'bull';

const QUEUE_NAME = 'karmyq-events';

export function createPublisher(source: string) {
  let eventQueue: Queue.Queue;

  async function initEventPublisher() {
    try {
      eventQueue = new Queue(QUEUE_NAME, process.env.REDIS_URL || 'redis://localhost:6379', {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: false,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      });

      eventQueue.on('error', (error) => {
        console.error('Event queue error:', error);
      });

      console.log('✅ Event publisher connected to Redis');
    } catch (error) {
      console.error('❌ Event publisher initialization failed:', error);
      throw error;
    }
  }

  async function publishEvent(eventType: string, payload: any) {
    if (!eventQueue) {
      throw new Error('Event queue not initialized');
    }

    await eventQueue.add(eventType, {
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      source,
    });

    console.log(`📤 Published event: ${eventType}`, payload);
  }

  function getEventQueue() {
    return eventQueue;
  }

  return { initEventPublisher, publishEvent, getEventQueue };
}
