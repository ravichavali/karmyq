import Queue from 'bull';

let eventQueue: Queue.Queue | null = null;

export async function initEventPublisher() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    eventQueue = new Queue('karmyq-events', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    eventQueue.on('error', (error) => {
      console.error('Event queue error:', error);
    });

    console.log('✅ Event publisher initialized');
  } catch (error) {
    console.error('Failed to initialize event publisher:', error);
    throw error;
  }
}

export async function publishEvent(eventType: string, payload: any) {
  if (!eventQueue) {
    throw new Error('Event queue not initialized - cannot publish events');
  }

  try {
    await eventQueue.add(eventType, {
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      source: 'auth-service'
    });

    console.log(`📤 Published event: ${eventType}`, payload);
  } catch (error) {
    console.error(`Failed to publish event ${eventType}:`, error);
    throw error; // Re-throw to ensure callers handle the failure
  }
}
