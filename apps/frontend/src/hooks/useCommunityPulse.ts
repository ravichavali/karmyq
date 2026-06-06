import { useEffect, useState } from 'react';
import { requestService } from '../lib/api';

/**
 * Sprint 89 / ADR-068 — the community's weekly help-loop pulse, shown in the warm Home hero.
 * All counts come from the server (the reused S86 texture aggregation); there is no client-side
 * member-recency seam. The envelope is already unwrapped by the api interceptor → read `res.data`.
 */
export interface CommunityPulse {
  helpedThisWeek: number;
  openAsks: number;
  timeSensitive: number;
  recentJoins: number;
  recentHelpers: { name: string; count: number }[];
  windowDays: number;
}

/**
 * Fetch the community pulse when Home is the active surface. Fail-soft: on any error the pulse is
 * simply hidden (returns null) and the page still renders — the hero/feed never depend on it.
 *
 * @param communityId - The community to summarize.
 * @param enabled - Only fetch when Home is active (default true).
 */
export function useCommunityPulse(communityId: string | null | undefined, enabled = true) {
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!communityId || !enabled) {
      setPulse(null);
      return;
    }

    let cancelled = false;

    async function fetchPulse() {
      if (!communityId) return; // Type guard
      setLoading(true);
      setError(null);
      try {
        const res = await requestService.getCommunityPulse(communityId);
        if (!cancelled) setPulse(res.data as CommunityPulse);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load community pulse');
          setPulse(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPulse();

    return () => {
      cancelled = true;
    };
  }, [communityId, enabled]);

  return { pulse, loading, error };
}
