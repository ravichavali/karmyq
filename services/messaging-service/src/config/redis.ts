import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

// Connect immediately
(async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
})();

// Create a duplicate for subscriber (Redis requires dedicated connection for sub)
export const redisSubscriber = redisClient.duplicate();

(async () => {
    await redisSubscriber.connect();
})();
