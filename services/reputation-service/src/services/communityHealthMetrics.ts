import { query } from '../database/db';

export interface CurrentCommunityMetrics {
  total_matches_completed: number;
  unique_participants: number;
  total_active_requesters: number;
  total_active_helpers: number;
  network_density: number;
  network_strength: number;
}

/**
 * Quality is an optional normalized score (0–100), reserved for an explicitly chosen future
 * source. Current callers omit it: the retired interaction averages never supplied live data.
 * Keep the existing 40/40/20 weights, so retiring those averages does not inflate the score.
 */
export function calculateNetworkStrength(
  totalMatches: number,
  uniqueParticipants: number,
  networkDensity: number,
  qualityScore = 0,
): number {
  const matchesPerParticipant = uniqueParticipants > 0 ? totalMatches / uniqueParticipants : 0;
  const activity = Math.min(100, Math.max(0, matchesPerParticipant * 20));
  const density = Math.min(100, Math.max(0, networkDensity * 100));
  const quality = Number.isFinite(qualityScore) ? Math.min(100, Math.max(0, qualityScore)) : 0;
  return Number((activity * 0.4 + quality * 0.4 + density * 0.2).toFixed(2));
}

/** The snapshot writer and HTTP fallback must read the same community-scoped source. */
export async function readCurrentCommunityMetrics(communityId: string): Promise<CurrentCommunityMetrics> {
  const matches = await query(
    `SELECT COUNT(*) AS total
       FROM requests.matches m
      WHERE m.status = 'completed'
        AND EXISTS (SELECT 1 FROM requests.request_communities rc
                     WHERE rc.request_id = m.request_id AND rc.community_id = $1)`,
    [communityId],
  );
  const participants = await query(
    `SELECT COUNT(DISTINCT r.requester_id) AS requesters,
            COUNT(DISTINCT m.responder_id) AS helpers
       FROM requests.matches m
       JOIN requests.help_requests r ON r.id = m.request_id
      WHERE m.status = 'completed'
        AND EXISTS (SELECT 1 FROM requests.request_communities rc
                     WHERE rc.request_id = r.id AND rc.community_id = $1)`,
    [communityId],
  );
  const community = await query(
    `SELECT current_members FROM communities.communities WHERE id = $1`,
    [communityId],
  );
  const totalMatches = Number(matches.rows[0]?.total) || 0;
  const requesters = Number(participants.rows[0]?.requesters) || 0;
  const helpers = Number(participants.rows[0]?.helpers) || 0;
  // Preserve the existing sum of role counts; a member occupying both roles counts in each.
  const uniqueParticipants = requesters + helpers;
  const members = Number(community.rows[0]?.current_members) || 0;
  const density = totalMatches / Math.max(1, members);
  return {
    total_matches_completed: totalMatches,
    unique_participants: uniqueParticipants,
    total_active_requesters: requesters,
    total_active_helpers: helpers,
    network_density: density,
    network_strength: calculateNetworkStrength(totalMatches, uniqueParticipants, density),
  };
}
