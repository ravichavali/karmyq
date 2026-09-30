// services/reputation-service/src/services/effectiveParamsCache.ts
// Sprint 32: Redis-backed cache for user effective trust params (TTL 4h)
// Sprint 131 D9: ioredis 6 uses RESP3; pin v5 retry backoff to preserve outage fallback timing.
// Key: trust_params:{userId}:{communityId}
// Invalidated whenever upsertUserTrustConfig runs (caller-side pattern in trustEvolutionService.ts)

import Redis from 'ioredis';
import { getUserEffectiveParams } from './trustEvolutionService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TTL_SECONDS = 14400; // 4 hours

let _redis: Redis | null = null;

/**
 * ioredis 5's default backoff. ioredis 6 changed the default to exponential with jitter
 * (`min(50 * 2^(n-1), 5000) + 0..199 ms`). ioredis flushes queued commands only every 21st retry (maxRetriesPerRequest
 * 20), and the attempt count keeps growing through an outage, so a cache command waits up to one 21-retry window
 * before the DB fallback runs: about 10.5 s at outage start and up to about 42 s once capped, versus about 73 s
 * and 107 s under the v6 default. This pins only the
 * outage retry timing; RESP3 and keepAlive retain ioredis 6 defaults. Gate: case C in the D9 regression.
 */
const V5_RETRY_STRATEGY = (times: number): number => Math.min(times * 50, 2000);

/** Build the cache's Redis client. Exported so the D9 gate can observe the real client's wire and retry behavior. */
export function createCacheClient(): Redis {
  return new Redis(REDIS_URL, { retryStrategy: V5_RETRY_STRATEGY });
}

function getRedis(): Redis {
  if (!_redis) _redis = createCacheClient();
  return _redis;
}

/**
 * Release the lazily-created Redis client.
 *
 * Long-running processes (the standing backfill CLI) otherwise never exit: ioredis reconnects
 * indefinitely and keeps the event loop alive, so the operator sees the final report followed by a
 * hang that is indistinguishable from a crash. No-op when no client was ever created.
 */
export async function disconnectEffectiveParamsCache(): Promise<void> {
  if (!_redis) return;
  const client = _redis;
  _redis = null;
  await client.quit().catch(() => client.disconnect());
}

function cacheKey(userId: string, communityId: string): string {
  return `trust_params:${userId}:${communityId}`;
}

export async function getCachedEffectiveParams(
  userId: string,
  communityId: string
): Promise<{ depth_weight: number; breadth_weight: number; cross_community_prior: number }> {
  try {
    const cached = await getRedis().get(cacheKey(userId, communityId));
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — fall through to DB
  }
  const params = await getUserEffectiveParams(userId, communityId);
  try {
    await getRedis().setex(cacheKey(userId, communityId), TTL_SECONDS, JSON.stringify(params));
  } catch {
    // Non-fatal — return params even if cache write fails
  }
  return params;
}

export async function invalidateEffectiveParamsCache(
  userId: string,
  communityId: string
): Promise<void> {
  try {
    await getRedis().del(cacheKey(userId, communityId));
  } catch {
    // Non-fatal
  }
}
