import { useEffect, useState } from 'react';
import { socialGraphService } from '../lib/api';
import { TrustPath } from '../components/TrustPathBadge';

interface UseTrustPathOptions {
  enabled?: boolean; // Set to false to disable automatic fetching
  /** Active community context (BUG-098-001). Omitted => platform-wide path. */
  communityId?: string;
}

/** Read the signed-in user's id from localStorage, tolerating a corrupt value. */
function readCurrentUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')?.id;
  } catch {
    return undefined;
  }
}

/**
 * Custom hook to fetch trust path to a specific user
 * @param targetUserId - The user ID to find the path to
 * @param options - Configuration options
 * @returns Trust path data, loading state, and error
 */
export function useTrustPath(targetUserId: string | null | undefined, options: UseTrustPathOptions = {}) {
  const [trustPath, setTrustPath] = useState<TrustPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enabled = true, communityId } = options;

  useEffect(() => {
    const currentUserId = readCurrentUserId();

    if (!targetUserId || !enabled || targetUserId === currentUserId) {
      setTrustPath(null);
      return;
    }

    let cancelled = false;

    async function fetchTrustPath() {
      if (!targetUserId) return; // Type guard

      setLoading(true);
      setError(null);

      try {
        const response = await socialGraphService.getTrustPath(targetUserId, communityId);

        if (!cancelled) {
          setTrustPath(response.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          // Don't show error for "no path found" case
          if (err.response?.data?.degrees_of_separation === null) {
            setTrustPath({ degrees_of_separation: null });
          } else {
            setError(err.response?.data?.message || 'Failed to fetch trust path');
            setTrustPath(null);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrustPath();

    return () => {
      cancelled = true;
    };
  }, [targetUserId, enabled, communityId]);

  return { trustPath, loading, error };
}

/**
 * Custom hook to fetch trust paths to multiple users (for feed ranking)
 * @param targetUserIds - Array of user IDs
 * @param options - Configuration options
 * @returns Map of userId -> trust path data, loading state, and error
 */
export function useBatchTrustPaths(targetUserIds: string[], options: UseTrustPathOptions = {}) {
  // Sprint 112 (ADR-082): batch paths carry degrees only — the numeric path trust_score is no longer
  // returned (feed proximity ranks on degrees).
  const [trustPaths, setTrustPaths] = useState<Map<string, { degrees: number | null }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enabled = true, communityId } = options;

  useEffect(() => {
    if (!targetUserIds || targetUserIds.length === 0 || !enabled) {
      setTrustPaths(new Map());
      return;
    }

    let cancelled = false;

    async function fetchBatchPaths() {
      setLoading(true);
      setError(null);

      try {
        const response = await socialGraphService.getBatchTrustPaths(targetUserIds, communityId);

        if (!cancelled) {
          const pathsMap = new Map();

          response.data.forEach((item: {
            target_user_id: string;
            degrees_of_separation: number | null;
          }) => {
            pathsMap.set(item.target_user_id, {
              degrees: item.degrees_of_separation,
            });
          });

          setTrustPaths(pathsMap);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to fetch trust paths');
          setTrustPaths(new Map());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBatchPaths();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(targetUserIds), enabled, communityId]);

  return { trustPaths, loading, error };
}
