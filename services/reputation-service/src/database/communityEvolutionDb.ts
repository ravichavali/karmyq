// services/reputation-service/src/database/communityEvolutionDb.ts
import { query } from './db';

export interface CommunityEvolutionLogEntry {
  id?: string;
  community_id: string;
  parameter: string;
  old_value: number;
  new_value: number;
  aggregate_delta: number;
  contributing_member_count: number;
  interaction_rate_snapshot: number | null;
  damping_applied: number;
  applied_at?: string;
}

/** Compute each active evolving member's delta for cross_community_prior.
 *  Baseline = first old_value in user_trust_evolution_log for that member.
 *  Members with no evolution log entries are excluded. */
export async function getMemberPriorDeltas(
  communityId: string
): Promise<{ user_id: string; delta: number }[]> {
  const result = await query(
    `WITH first_log AS (
       SELECT DISTINCT ON (user_id)
         user_id, old_value AS baseline
       FROM reputation.user_trust_evolution_log
       WHERE community_id = $1 AND parameter = 'cross_community_prior'
       ORDER BY user_id, created_at ASC
     )
     SELECT
       fl.user_id,
       (utc.cross_community_prior - fl.baseline) AS delta
     FROM first_log fl
     JOIN reputation.user_trust_configs utc
       ON utc.user_id = fl.user_id AND utc.community_id = $1
     JOIN communities.members cm
       ON cm.user_id = fl.user_id AND cm.community_id = $1 AND cm.status = 'active'
     WHERE utc.evolution_enabled = TRUE`,
    [communityId]
  );
  return result.rows.map(r => ({
    user_id: r.user_id,
    delta: parseFloat(r.delta),
  }));
}

/** Current interaction rate: completed matches per active member in last 30 days. */
export async function getInteractionRate(communityId: string): Promise<number> {
  const result = await query(
    `WITH active_members AS (
       SELECT COUNT(*) AS cnt
       FROM communities.members
       WHERE community_id = $1 AND status = 'active'
     ),
     completed AS (
       SELECT COUNT(DISTINCT m.id) AS cnt
       FROM requests.matches m
       JOIN requests.request_communities rc ON rc.request_id = m.request_id
       WHERE rc.community_id = $1
         AND m.status = 'completed'
         AND m.updated_at >= NOW() - INTERVAL '30 days'
     )
     SELECT
       CASE WHEN am.cnt = 0 THEN 0
            ELSE (c.cnt::decimal / am.cnt)
       END AS rate
     FROM active_members am, completed c`,
    [communityId]
  );
  return parseFloat(result.rows[0]?.rate ?? '0');
}

/** Previous interaction rate from the most recent evolution log entry. */
export async function getPreviousInteractionRate(
  communityId: string
): Promise<number | null> {
  const result = await query(
    `SELECT interaction_rate_snapshot
     FROM reputation.community_evolution_log
     WHERE community_id = $1
     ORDER BY applied_at DESC
     LIMIT 1`,
    [communityId]
  );
  const val = result.rows[0]?.interaction_rate_snapshot;
  return val != null ? parseFloat(val) : null;
}

/** Days since last community evolution cycle. Returns null if never evolved. */
export async function getDaysSinceLastEvolution(
  communityId: string
): Promise<number | null> {
  const result = await query(
    `SELECT MAX(applied_at) AS last_at
     FROM reputation.community_evolution_log
     WHERE community_id = $1`,
    [communityId]
  );
  const last = result.rows[0]?.last_at;
  if (!last) return null;
  return (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
}

/** The aggregate_delta values from the last N community evolution log entries for cross_community_prior.
 *  Used for the direction consensus gate on trust_path_max_hops. */
export async function getRecentPriorEvolutionDeltas(
  communityId: string,
  count = 3
): Promise<number[]> {
  const result = await query(
    `SELECT aggregate_delta
     FROM reputation.community_evolution_log
     WHERE community_id = $1 AND parameter = 'cross_community_prior'
     ORDER BY applied_at DESC
     LIMIT $2`,
    [communityId, count]
  );
  return result.rows.map(r => parseFloat(r.aggregate_delta));
}

/** Current community config values for the three evolving parameters. */
export async function getCommunityEvolvingParams(
  communityId: string
): Promise<{
  community_evolution_enabled: boolean;
  cross_community_prior: number;
  karma_split_helper: number;
  trust_path_max_hops: number;
} | null> {
  const result = await query(
    `SELECT
       community_evolution_enabled,
       cross_community_prior,
       karma_split_helper,
       trust_path_max_hops
     FROM communities.community_configs
     WHERE community_id = $1`,
    [communityId]
  );
  if (!result.rows[0]) return null;
  const r = result.rows[0];
  return {
    community_evolution_enabled: r.community_evolution_enabled,
    cross_community_prior: parseFloat(r.cross_community_prior),
    karma_split_helper: parseInt(r.karma_split_helper, 10),
    trust_path_max_hops: parseInt(r.trust_path_max_hops, 10),
  };
}

/** Apply the nudge to the three evolving parameters in community_configs. */
export async function applyCommunityConfigNudge(
  communityId: string,
  patch: {
    cross_community_prior?: number;
    karma_split_helper?: number;
    trust_path_max_hops?: number;
  }
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

/** Log a community evolution event. */
export async function insertCommunityEvolutionLog(
  entry: Omit<CommunityEvolutionLogEntry, 'id' | 'applied_at'>
): Promise<void> {
  await query(
    `INSERT INTO reputation.community_evolution_log
       (community_id, parameter, old_value, new_value, aggregate_delta,
        contributing_member_count, interaction_rate_snapshot, damping_applied)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.community_id, entry.parameter, entry.old_value, entry.new_value,
      entry.aggregate_delta, entry.contributing_member_count,
      entry.interaction_rate_snapshot, entry.damping_applied,
    ]
  );
}

/** Paginated evolution history for a community. */
export async function getCommunityEvolutionHistory(
  communityId: string,
  limit = 50,
  offset = 0
): Promise<CommunityEvolutionLogEntry[]> {
  const result = await query(
    `SELECT id, community_id, parameter, old_value, new_value, aggregate_delta,
            contributing_member_count, interaction_rate_snapshot, damping_applied, applied_at
     FROM reputation.community_evolution_log
     WHERE community_id = $1
     ORDER BY applied_at DESC
     LIMIT $2 OFFSET $3`,
    [communityId, limit, offset]
  );
  return result.rows;
}

/** Summary: first evolution date, count of evolved parameters, contributing member count. */
export async function getCommunityEvolutionSummary(communityId: string): Promise<{
  first_evolution_at: string | null;
  evolved_parameter_count: number;
  last_contributing_member_count: number;
}> {
  const result = await query(
    `SELECT
       MIN(applied_at) AS first_evolution_at,
       COUNT(DISTINCT parameter) AS evolved_parameter_count,
       (SELECT contributing_member_count
        FROM reputation.community_evolution_log
        WHERE community_id = $1
        ORDER BY applied_at DESC LIMIT 1) AS last_contributing_member_count
     FROM reputation.community_evolution_log
     WHERE community_id = $1`,
    [communityId]
  );
  const r = result.rows[0];
  return {
    first_evolution_at: r?.first_evolution_at ?? null,
    evolved_parameter_count: parseInt(r?.evolved_parameter_count ?? '0', 10),
    last_contributing_member_count: parseInt(r?.last_contributing_member_count ?? '0', 10),
  };
}
