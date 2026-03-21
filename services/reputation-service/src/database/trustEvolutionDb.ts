// services/reputation-service/src/database/trustEvolutionDb.ts
import { query } from './db';

export interface UserTrustConfig {
  user_id: string;
  community_id: string;
  depth_weight: number | null;
  breadth_weight: number | null;
  cross_community_prior: number;
  evolution_enabled: boolean;
}

export interface EvolutionLogEntry {
  id?: string;
  user_id: string;
  community_id: string;
  parameter: string;
  old_value: number | null;
  new_value: number;
  trigger_signal: string;
  trigger_event_id?: string;
  created_at?: string;
}

export async function getUserTrustConfig(
  userId: string,
  communityId: string
): Promise<UserTrustConfig | null> {
  const result = await query(
    `SELECT user_id, community_id, depth_weight, breadth_weight,
            cross_community_prior, evolution_enabled
     FROM reputation.user_trust_configs
     WHERE user_id = $1 AND community_id = $2`,
    [userId, communityId]
  );
  return result.rows[0] ?? null;
}

export async function upsertUserTrustConfig(
  userId: string,
  communityId: string,
  patch: Partial<Pick<UserTrustConfig, 'depth_weight' | 'breadth_weight' | 'cross_community_prior' | 'evolution_enabled'>>
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const columns = Object.keys(patch);
  const values = Object.values(patch);
  const setClauses = columns.map((col, i) => `${col} = $${i + 3}`).join(', ');
  await query(
    `INSERT INTO reputation.user_trust_configs (user_id, community_id, ${columns.join(', ')})
     VALUES ($1, $2, ${values.map((_, i) => `$${i + 3}`).join(', ')})
     ON CONFLICT (user_id, community_id) DO UPDATE SET ${setClauses}, updated_at = NOW()`,
    [userId, communityId, ...values]
  );
}

export async function insertEvolutionLog(entry: EvolutionLogEntry): Promise<void> {
  await query(
    `INSERT INTO reputation.user_trust_evolution_log
       (user_id, community_id, parameter, old_value, new_value, trigger_signal, trigger_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.user_id, entry.community_id, entry.parameter,
      entry.old_value, entry.new_value, entry.trigger_signal,
      entry.trigger_event_id ?? null,
    ]
  );
}

export async function getEvolutionLog(
  userId: string,
  communityId: string,
  limit = 50,
  offset = 0
): Promise<EvolutionLogEntry[]> {
  const result = await query(
    `SELECT id, user_id, community_id, parameter, old_value, new_value,
            trigger_signal, trigger_event_id, created_at
     FROM reputation.user_trust_evolution_log
     WHERE user_id = $1 AND community_id = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, communityId, limit, offset]
  );
  return result.rows;
}

export async function getLastEvolutionForParameter(
  userId: string,
  communityId: string,
  parameter: string
): Promise<Date | null> {
  const result = await query(
    `SELECT MAX(created_at) AS last_at
     FROM reputation.user_trust_evolution_log
     WHERE user_id = $1 AND community_id = $2 AND parameter = $3`,
    [userId, communityId, parameter]
  );
  return result.rows[0]?.last_at ?? null;
}

export async function getCommunityEvolutionConfig(
  communityId: string
): Promise<{ community_evolution_enabled: boolean; cross_community_prior: number }> {
  const result = await query(
    `SELECT community_evolution_enabled, cross_community_prior
     FROM communities.community_configs
     WHERE community_id = $1`,
    [communityId]
  );
  return result.rows[0] ?? { community_evolution_enabled: false, cross_community_prior: 0.50 };
}

export async function updateCommunityEvolutionConfig(
  communityId: string,
  patch: { community_evolution_enabled?: boolean; cross_community_prior?: number }
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const columns = Object.keys(patch);
  const values = Object.values(patch);
  const setClauses = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
  await query(
    `UPDATE communities.community_configs SET ${setClauses} WHERE community_id = $1`,
    [communityId, ...values]
  );
}

export async function getEvolutionOptInRate(
  communityId: string
): Promise<{ opted_in: number; total: number }> {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE utc.evolution_enabled = true) AS opted_in,
       COUNT(cm.user_id) AS total
     FROM communities.members cm
     LEFT JOIN reputation.user_trust_configs utc
       ON utc.user_id = cm.user_id AND utc.community_id = cm.community_id
     WHERE cm.community_id = $1 AND cm.status = 'active'`,
    [communityId]
  );
  return {
    opted_in: parseInt(result.rows[0]?.opted_in ?? '0', 10),
    total: parseInt(result.rows[0]?.total ?? '0', 10),
  };
}

export async function getDiverseCommunityCount(
  userId: string,
  days = 30
): Promise<number> {
  const result = await query(
    `SELECT COUNT(DISTINCT community_id) AS community_count
     FROM reputation.karma_records
     WHERE user_id = $1
       AND reason IN ('Provided help', 'Received help')
       AND created_at >= NOW() - INTERVAL '1 day' * $2`,
    [userId, days]
  );
  return parseInt(result.rows[0]?.community_count ?? '0', 10);
}

// Sprint 32: Global evolution opt-out per user
export async function getGlobalEvolutionPreference(userId: string): Promise<boolean> {
  const result = await query(
    `SELECT global_evolution_enabled FROM reputation.user_trust_preferences WHERE user_id = $1`,
    [userId]
  );
  // Missing row = opted in by default (TRUE)
  return result.rows[0]?.global_evolution_enabled ?? true;
}

export async function upsertGlobalEvolutionPreference(userId: string, enabled: boolean): Promise<void> {
  await query(
    `INSERT INTO reputation.user_trust_preferences (user_id, global_evolution_enabled, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       global_evolution_enabled = $2,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, enabled]
  );
}

export async function isCrossCommunityParticipant(
  fromUserId: string,
  communityId: string
): Promise<boolean> {
  const result = await query(
    `SELECT NOT EXISTS (
       SELECT 1 FROM communities.members
       WHERE user_id = $1 AND community_id = $2 AND status = 'active'
     ) AS is_cross_community`,
    [fromUserId, communityId]
  );
  return result.rows[0]?.is_cross_community ?? true;
}
