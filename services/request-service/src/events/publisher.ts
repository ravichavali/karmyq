import Queue from 'bull';

let eventQueue: Queue.Queue;

export async function initEventPublisher() {
  try {
    eventQueue = new Queue('karmyq-events', process.env.REDIS_URL || 'redis://localhost:6379');

    eventQueue.on('error', (error) => {
      console.error('Event queue error:', error);
    });

    console.log('✅ Event publisher connected to Redis');
  } catch (error) {
    console.error('❌ Event publisher initialization failed:', error);
    throw error;
  }
}

export async function publishEvent(eventType: string, payload: any) {
  if (!eventQueue) {
    throw new Error('Event queue not initialized');
  }

  await eventQueue.add(eventType, {
    eventType,
    payload,
    timestamp: new Date().toISOString(),
    source: 'request-service',
  });

  console.log(`📤 Published event: ${eventType}`, payload);
}

export function getEventQueue() {
  return eventQueue;
}
