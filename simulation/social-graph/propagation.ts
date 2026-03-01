/**
 * Social graph propagation — adjusts persona action weights based on
 * recent activity in their network. This is what makes behavior feel
 * causally connected rather than independently random.
 */

import { PersonaState, ActionWeights, Persona } from '../personas/types';
import { SimApiClient } from '../api/client';
import { log } from '../utils/logger';

export interface PropagationContext {
  /** Proposed matches waiting for this user to accept (as requester) */
  pendingOffers: number;
  /** Matches this user helped with that were recently completed */
  recentCompletions: number;
  /** New activity in communities this user belongs to */
  feedItemCount: number;
  /** Whether this user has been helped recently (boosts create-request) */
  wasHelped: boolean;
}

/**
 * Fetches current social context for a persona from the feed API.
 * Returns a lightweight PropagationContext used to bias action selection.
 */
export async function fetchContext(
  client: SimApiClient,
  state: PersonaState
): Promise<PropagationContext> {
  try {
    const [dashboard, matches] = await Promise.all([
      client.getDashboard().catch(() => null),
      client.getMatches('proposed').catch(() => []),
    ]);

    const feedItemCount = dashboard?.feed?.length ?? dashboard?.items?.length ?? 0;
    const pendingOffers = Array.isArray(matches) ? matches.length : 0;

    // Check if any recent match completions show someone helped us
    const completedMatches = await client.getMatches('completed').catch(() => []);
    const recentCompletions = Array.isArray(completedMatches)
      ? completedMatches.filter((m: any) => {
          const completedAt = new Date(m.completed_at || m.updated_at || 0).getTime();
          const cutoff = Date.now() - 48 * 60 * 60 * 1000; // last 48h
          return completedAt > cutoff;
        }).length
      : 0;

    const wasHelped = recentCompletions > 0 || state.recentlyHelped;

    return { pendingOffers, recentCompletions, feedItemCount, wasHelped };
  } catch (err: any) {
    log('warn', state.persona.id, 'Failed to fetch social context', { error: err.message });
    return { pendingOffers: 0, recentCompletions: 0, feedItemCount: 0, wasHelped: false };
  }
}

/**
 * Adjusts action weights based on social context and persona's social bias.
 * Returns a modified copy of the base weights — does not mutate.
 */
export function applyPropagation(
  base: ActionWeights,
  context: PropagationContext,
  persona: Persona
): ActionWeights {
  const weights = { ...base };
  const bias = persona.socialBias;

  // If someone helped me recently → more likely to create a request (positive loop)
  // and more likely to invite (want to share the platform)
  if (context.wasHelped) {
    weights.createRequest = Math.min(1, weights.createRequest * bias.reciprocity);
    if (bias.inviteAfterHelped) {
      weights.generateInvite = Math.min(1, weights.generateInvite * 1.5);
    }
  }

  // If I helped someone and they completed → more likely to invite (pay it forward)
  if (context.recentCompletions > 0 && bias.requestAfterMatch) {
    weights.createRequest = Math.min(1, weights.createRequest * 1.3);
  }

  // Pending offers waiting for me → boost acceptOffer
  if (context.pendingOffers > 0) {
    weights.acceptOffer = Math.min(1, weights.acceptOffer * (1 + context.pendingOffers * 0.3));
  }

  // Active feed → more likely to browse and help
  if (context.feedItemCount > 5) {
    weights.browseRequests = Math.min(1, weights.browseRequests * 1.2);
    weights.offerHelp = Math.min(1, weights.offerHelp * 1.15);
  }

  return weights;
}
