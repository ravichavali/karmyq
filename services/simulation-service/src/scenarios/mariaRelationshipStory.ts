/**
 * Sprint 116 — deterministic Maria relationship-story rehearsal (PR B, Task 10).
 *
 * This module is PURE planning + API-only application. It never seeds trust edges, graph coordinates,
 * or product-table rows directly (no DB pool import). It reads the current world, selects truthful
 * personas, and emits the minimum ordinary request/offer actions needed to stand up two contrasting
 * helping-decision stories for the demo:
 *   - an ORDINARY story that meets the rich-overlap floor (a visibly connected helper), and
 *   - a PROVIDER story used as a low-overlap contrast.
 *
 * Application is gated by the caller: the CLI is dry-run by default and only invokes
 * applyMariaRelationshipStory when the operator passes --apply.
 */

/** The rich-overlap floor an ordinary Maria story must clear so we never validate a sparse picture. */
export const RICH_FLOOR = { maxPathDegree: 2, minShared: 3, minOneHopPerSide: 4 } as const;

export interface StoryOverlap {
  /** Trust-path degree between Maria and the candidate; null when no path exists. */
  pathDegree: number | null;
  /** Mutual one-hop connections shared by both. */
  sharedConnections: number;
  /** Maria's visible one-hop count. */
  mariaOneHop: number;
  /** The candidate's visible one-hop count. */
  helperOneHop: number;
}

export interface HelperCandidate {
  id: string;
  communityId: string;
  overlap: StoryOverlap;
}

export interface ProviderCandidate {
  id: string;
  communityId: string;
  serviceType: string;
  overlap: StoryOverlap;
}

export interface MariaStoryState {
  maria: { id: string; communityId: string };
  helperCandidates: HelperCandidate[];
  providerCandidates: ProviderCandidate[];
  existing: {
    ordinaryRequestId?: string;
    ordinaryMatchId?: string;
    providerRequestId?: string;
    providerOfferId?: string;
  };
}

export type StoryAction =
  | { type: 'create_ordinary_request'; actor: 'maria'; communityId: string; title: string }
  | { type: 'create_ordinary_offer'; actor: 'helper'; helperId: string }
  | { type: 'create_provider_request'; actor: 'maria'; communityId: string; title: string }
  | { type: 'submit_provider_offer'; actor: 'provider'; providerId: string };

export interface MariaStoryPlan {
  selection: { ordinaryHelperId: string; providerId: string; ordinaryCrossCommunity: boolean };
  actions: StoryAction[];
  expected: {
    ordinary: { requestId?: string; matchId?: string };
    provider: { requestId?: string; offerId?: string };
  };
  floor: { met: boolean; helperOverlap: StoryOverlap };
  warnings: string[];
}

export const ORDINARY_REQUEST_TITLE = 'Help moving a couch this weekend';
export const PROVIDER_REQUEST_TITLE = 'Provider quote: fix a leaking kitchen tap';

export function meetsRichFloor(o: StoryOverlap): boolean {
  return (
    o.pathDegree !== null &&
    o.pathDegree <= RICH_FLOOR.maxPathDegree &&
    o.sharedConnections >= RICH_FLOOR.minShared &&
    o.mariaOneHop >= RICH_FLOOR.minOneHopPerSide &&
    o.helperOneHop >= RICH_FLOOR.minOneHopPerSide
  );
}

/**
 * Deterministically pick the ordinary helper. Prefer a candidate that BOTH clears the rich floor and
 * lives in a different community (so the story also demonstrates cross-community reach), then rank by
 * shared overlap desc and id asc for stability. If none clear the floor, return the best-overlap
 * candidate but flag the floor unmet — we never silently validate a sparse story.
 */
function selectHelper(state: MariaStoryState): { helper: HelperCandidate; met: boolean } {
  const byRichness = (a: HelperCandidate, b: HelperCandidate) =>
    b.overlap.sharedConnections - a.overlap.sharedConnections || a.id.localeCompare(b.id);
  const qualifying = state.helperCandidates.filter(c => meetsRichFloor(c.overlap)).sort(byRichness);
  const crossCommunity = qualifying.filter(c => c.communityId !== state.maria.communityId);
  const chosen = crossCommunity[0] ?? qualifying[0];
  if (chosen) return { helper: chosen, met: true };
  // Nothing qualifies — surface the best available so the operator can see how far short it falls.
  const fallback = [...state.helperCandidates].sort(byRichness)[0];
  return { helper: fallback, met: false };
}

/** Pick the lowest-overlap provider so the provider story reads as a deliberate contrast. */
function selectProvider(state: MariaStoryState): ProviderCandidate {
  return [...state.providerCandidates].sort(
    (a, b) => a.overlap.sharedConnections - b.overlap.sharedConnections || a.id.localeCompare(b.id),
  )[0];
}

export function planMariaRelationshipStory(state: MariaStoryState): MariaStoryPlan {
  const { helper, met } = selectHelper(state);
  const provider = selectProvider(state);
  const { existing } = state;

  const actions: StoryAction[] = [];
  if (!existing.ordinaryRequestId) {
    actions.push({ type: 'create_ordinary_request', actor: 'maria', communityId: state.maria.communityId, title: ORDINARY_REQUEST_TITLE });
  }
  if (!existing.ordinaryMatchId) {
    actions.push({ type: 'create_ordinary_offer', actor: 'helper', helperId: helper.id });
  }
  if (!existing.providerRequestId) {
    actions.push({ type: 'create_provider_request', actor: 'maria', communityId: state.maria.communityId, title: PROVIDER_REQUEST_TITLE });
  }
  if (!existing.providerOfferId) {
    actions.push({ type: 'submit_provider_offer', actor: 'provider', providerId: provider.id });
  }

  const warnings: string[] = [];
  if (!met) {
    warnings.push(
      `Selected ordinary helper ${helper.id} does not clear the rich floor ` +
        `(need ≤${RICH_FLOOR.maxPathDegree}-degree path, ≥${RICH_FLOOR.minShared} shared, ` +
        `≥${RICH_FLOOR.minOneHopPerSide} one-hop per side). Add real shared history before applying.`,
    );
  }

  return {
    selection: {
      ordinaryHelperId: helper.id,
      providerId: provider.id,
      ordinaryCrossCommunity: helper.communityId !== state.maria.communityId,
    },
    actions,
    expected: {
      ordinary: {
        ...(existing.ordinaryRequestId && { requestId: existing.ordinaryRequestId }),
        ...(existing.ordinaryMatchId && { matchId: existing.ordinaryMatchId }),
      },
      provider: {
        ...(existing.providerRequestId && { requestId: existing.providerRequestId }),
        ...(existing.providerOfferId && { offerId: existing.providerOfferId }),
      },
    },
    floor: { met, helperOverlap: helper.overlap },
    warnings,
  };
}

export interface StoryResult {
  ordinary: { requestId?: string; matchId?: string };
  provider: { requestId?: string; offerId?: string };
}

/** The minimal client surface the apply step needs — each method maps to an ordinary HTTP API. */
export interface StoryClients {
  maria: {
    createRequest(data: { community_id: string; title: string; description: string; request_type: string }): Promise<any>;
  };
  helper: {
    offerHelp(requestId: string, responderId: string): Promise<any>;
  };
  provider: {
    submitProviderOffer(requestId: string, price: number | null, note: string | null): Promise<any>;
  };
}

const idOf = (res: any): string | undefined => res?.id ?? res?.data?.id ?? res?.data?.data?.id;

/**
 * Apply the plan through ordinary APIs only. Refuses to run a sparse story so the demo never shows two
 * thin pictures. Resumable: an empty plan (everything already exists) is a no-op that returns the
 * already-verified IDs.
 */
export async function applyMariaRelationshipStory(
  plan: MariaStoryPlan,
  clients: StoryClients,
): Promise<StoryResult> {
  if (!plan.floor.met) {
    throw new Error(
      `Refusing to apply: ordinary story does not clear the rich floor. ${plan.warnings.join(' ')}`,
    );
  }
  const result: StoryResult = {
    ordinary: { ...plan.expected.ordinary },
    provider: { ...plan.expected.provider },
  };

  for (const action of plan.actions) {
    switch (action.type) {
      case 'create_ordinary_request': {
        const res = await clients.maria.createRequest({
          community_id: action.communityId,
          title: action.title,
          description: 'Looking for a hand moving a couch on Saturday afternoon.',
          request_type: 'generic',
        });
        result.ordinary.requestId = idOf(res);
        break;
      }
      case 'create_ordinary_offer': {
        if (!result.ordinary.requestId) throw new Error('Ordinary request must exist before offering');
        const res = await clients.helper.offerHelp(result.ordinary.requestId, action.helperId);
        result.ordinary.matchId = idOf(res);
        break;
      }
      case 'create_provider_request': {
        const res = await clients.maria.createRequest({
          community_id: action.communityId,
          title: action.title,
          description: 'Need a tradesperson to quote and fix a leaking kitchen tap.',
          request_type: 'service',
        });
        result.provider.requestId = idOf(res);
        break;
      }
      case 'submit_provider_offer': {
        if (!result.provider.requestId) throw new Error('Provider request must exist before submitting an offer');
        const res = await clients.provider.submitProviderOffer(result.provider.requestId, 40, 'Available this weekend.');
        result.provider.offerId = idOf(res);
        break;
      }
    }
  }

  return result;
}
