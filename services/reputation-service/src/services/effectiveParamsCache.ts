// services/reputation-service/src/services/effectiveParamsCache.ts
// Sprint 32: Redis-backed cache for user effective trust params (TTL 4h)
// Key: trust_params:{userId}:{communityId}
// Invalidated whenever upsertUserTrustConfig runs (caller-side pattern in trustEvolutionService.ts)

import Redis from 'ioredis';
import { getUserEffectiveParams } from './trustEvolutionService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TTL_SECONDS = 14400; // 4 hours

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) _redis = new Redis(REDIS_URL);
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
