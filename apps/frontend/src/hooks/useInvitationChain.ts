import { useEffect, useState } from 'react';
import { socialGraphService } from '../lib/api';
import { InvitationChainNode } from '../components/InvitationChain';

interface UseInvitationChainOptions {
  enabled?: boolean;
}

/**
 * Custom hook to fetch the user's invitation chain (how they joined the platform)
 * @param options - Configuration options
 * @returns Invitation chain data, loading state, and error
 */
export function useInvitationChain(options: UseInvitationChainOptions = {}) {
  const [chain, setChain] = useState<InvitationChainNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) {
      setChain(null);
      return;
    }

    let cancelled = false;

    async function fetchInvitationChain() {
      setLoading(true);
      setError(null);

      try {
        const response = await socialGraphService.getInvitations();

        if (!cancelled) {
          // Extract the invitation chain from the received invitation
          if (response.data.received) {
            // Build chain: current user <- inviter <- inviter's inviter <- ...
            // For now, we only have 1 degree (current user <- inviter)
            // Future: Recursively fetch inviter's inviter for full chain
            const chainData: InvitationChainNode[] = [
              {
                id: response.data.received.inviter.id,
                name: response.data.received.inviter.name,
                invited_at: response.data.received.invited_at,
              }
            ];

            setChain(chainData);
          } else {
            // No invitation - user is a founding member or admin
            setChain([]);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to fetch invitation chain');
          setChain(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInvitationChain();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { chain, loading, error };
}
