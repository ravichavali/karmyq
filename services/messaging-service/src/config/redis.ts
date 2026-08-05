import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  // node-redis 6 defaults this to 'auto' under RESP3, which sends an
  // Enterprise-only `CLIENT MAINT_NOTIFICATIONS ON` at handshake and resolves
  // the host via DNS on every connect. We run OSS redis:7-alpine everywhere
  // (compose, CI services, demo), never Redis Enterprise, so the feature can
  // never fire — 'auto' only survives because it swallows the handshake error.
  // Disabling it removes a per-connect DNS lookup and a silently-failed command.
  maintNotifications: 'disabled',
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

// Create a duplicate for subscriber (Redis requires dedicated connection for sub)
export const redisSubscriber = redisClient.duplicate();

// The subscriber needs its OWN listeners. `duplicate()` constructs a brand-new
// client from the parent's options — it copies no EventEmitter registrations —
// and an 'error' event with no listener THROWS, which terminates the process.
// Without this, every socket error on the subscriber connection is fatal.
redisSubscriber.on('error', (err) => console.log('Redis Subscriber Error', err));
redisSubscriber.on('connect', () => console.log('Redis Subscriber Connected'));

/**
 * Open a connection without blocking module evaluation.
 *
 * The .catch is required, not defensive: `connect()` already returns a promise,
 * and an unhandled rejection terminates the process on Node 20+ — so a Redis
 * that is merely slow to accept connections would take the whole messaging
 * service down instead of logging and letting the client retry.
 */
function connectInBackground(client: typeof redisClient, label: string): void {
    if (client.isOpen) return;
    client.connect().catch((err) => console.error(`${label} failed to connect`, err));
}

connectInBackground(redisClient, 'Redis Client');
connectInBackground(redisSubscriber, 'Redis Subscriber');
