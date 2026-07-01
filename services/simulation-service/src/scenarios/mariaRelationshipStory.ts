/**
 * Sprint 116 — deterministic Maria relationship-story rehearsal (PR B, Task 10).
 *
 * PURE planning + API-only application. It never seeds trust edges, graph coordinates, or
 * product-table rows directly (no DB pool import). It reads the current world, selects truthful
 * personas, and emits the minimum ordinary request/offer/exchange actions needed to stand up two
 * contrasting helping-decision stories for the demo:
 *   - an ORDINARY story whose helper clears the rich-overlap floor, and
 *   - a PROVIDER story used as a low-overlap contrast.
 *
 * The rich floor has two parts. STRUCTURAL overlap (≥3 shared people, ≥4 one-hop per side) can only
 * come from the real graph — it is never synthesized. The PATH degree, by contrast, is repairable: if
 * a structurally-rich helper is more than two hops from Maria, we plan a single Maria↔helper
 * request→offer→accept→two-sided-completion exchange to create the direct bond. A helper without
 * structural overlap cannot be repaired by one exchange, so the plan warns and apply refuses rather
 * than validate a sparse picture.
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
  /** All communities the candidate belongs to (not just the first). */
  communityIds: string[];
  overlap: StoryOverlap;
}

export interface ProviderCandidate {
  id: string;
  communityIds: string[];
  serviceType: string;
  overlap: StoryOverlap;
}

/** A match already present on the ordinary request, tied to its responder. */
export interface ExistingMatch {
  id: string;
  responderId: string;
  status: string;
}

/** A provider offer already present on the provider request, tied to its provider. */
export interface ExistingOffer {
  id: string;
  providerUserId: string;
  status: string;
}

/** A repair-exchange match, with two-sided completion flags. */
export interface RepairMatch {
  id: string;
  responderId: string;
  status: string;
  requesterDone: boolean;
  responderDone: boolean;
}

/**
 * State of a prior (possibly partial) repair exchange, for resumable planning. `matches` are all the
 * matches on the repair request; the planner picks the one whose responder is the SELECTED helper.
 */
export interface ExistingRepair {
  requestId?: string;
  matches: RepairMatch[];
}

export interface MariaStoryState {
  maria: { id: string; communityIds: string[] };
  helperCandidates: HelperCandidate[];
  providerCandidates: ProviderCandidate[];
  existing: {
    ordinaryRequestId?: string;
    ordinaryMatches: ExistingMatch[];
    providerRequestId?: string;
    providerOffers: ExistingOffer[];
    /** A prior repair exchange for the selected helper (matched by responder), if any. */
    repair?: ExistingRepair;
  };
}

export type VisibilityScope = 'community' | 'trust_network' | 'platform';

/**
 * Requests the rehearsal creates are platform-scoped: the selected ordinary helper and provider may
 * live in a different community, and the server otherwise falls back to the community's default scope
 * (usually `community`), which would leave a disjoint helper unable to reach — and therefore offer on
 * — Maria's request. Platform scope guarantees reachability for the deliberately cross-community story.
 */
export const STORY_REQUEST_SCOPE: VisibilityScope = 'platform';

export type StoryAction =
  | { type: 'create_ordinary_request'; actor: 'maria'; communityId: string; title: string; visibilityScope: VisibilityScope }
  | { type: 'create_ordinary_offer'; actor: 'helper'; helperId: string }
  | { type: 'create_provider_request'; actor: 'maria'; communityId: string; title: string; visibilityScope: VisibilityScope }
  | { type: 'submit_provider_offer'; actor: 'provider'; providerId: string }
  // Repair: a single Maria↔helper completed exchange that creates the direct bond so the trust path
  // falls within the floor. request → offer → accept → two-sided completion. Resumable: only the
  // missing steps are emitted when a prior run partially built the exchange.
  | { type: 'create_repair_request'; actor: 'maria'; communityId: string; title: string; visibilityScope: VisibilityScope }
  | { type: 'offer_repair'; actor: 'helper'; helperId: string }
  | { type: 'accept_repair'; actor: 'maria' }
  | { type: 'complete_repair'; actor: 'maria' | 'helper' };

/** A neighborhood node as returned by the social-graph ego endpoint (center is degree 0). */
export interface NeighborhoodNode {
  id: string;
  degrees_of_separation?: number;
}

/**
 * Compute overlap from two ego neighborhoods, counting ONLY true one-hop neighbours
 * (`degrees_of_separation === 1`) and excluding both anchors. Without this, each ego's own center
 * (degree 0) and — after a direct repair — the opposite anchor leak in as fake shared connections and
 * inflate one-hop breadth, letting a thin story falsely clear the ≥3 shared / ≥4 one-hop floor.
 */
export function overlapFromNeighborhoods(
  mariaNodes: NeighborhoodNode[],
  candidateNodes: NeighborhoodNode[],
  mariaId: string,
  candidateId: string,
  pathDegree: number | null,
): StoryOverlap {
  const oneHop = (nodes: NeighborhoodNode[]) =>
    new Set(nodes.filter(n => n.degrees_of_separation === 1).map(n => n.id));
  const mariaHop = oneHop(mariaNodes);
  const candidateHop = oneHop(candidateNodes);
  let shared = 0;
  for (const id of mariaHop) {
    if (candidateHop.has(id) && id !== mariaId && id !== candidateId) shared += 1;
  }
  const sizeExcluding = (set: Set<string>, exclude: string) =>
    [...set].filter(id => id !== exclude).length;
  return {
    pathDegree,
    sharedConnections: shared,
    mariaOneHop: sizeExcluding(mariaHop, candidateId), // surrounding network, minus the helper anchor
    helperOneHop: sizeExcluding(candidateHop, mariaId), // minus Maria anchor
  };
}

export interface StoryFloor {
  /** Structural overlap present, so the floor can be reached (repairing the path if needed). */
  achievable: boolean;
  /** A repair exchange is planned because the path is currently too far. */
  needsRepair: boolean;
  /** Floor already met with no repair required. */
  met: boolean;
  helperOverlap: StoryOverlap;
}

export interface MariaStoryPlan {
  selection: { ordinaryHelperId: string; providerId: string; ordinaryCrossCommunity: boolean };
  actions: StoryAction[];
  expected: {
    ordinary: { requestId?: string; matchId?: string };
    provider: { requestId?: string; offerId?: string };
  };
  /** Existing repair-exchange IDs so apply can resume mid-exchange without recreating rows. */
  repair: { requestId?: string; matchId?: string };
  floor: StoryFloor;
  warnings: string[];
}

export const ORDINARY_REQUEST_TITLE = 'Help moving a couch this weekend';
export const PROVIDER_REQUEST_TITLE = 'Provider quote: fix a leaking kitchen tap';
export const REPAIR_REQUEST_TITLE = 'Repair-history exchange (rehearsal bootstrap)';

/** Structural overlap — shared people + one-hop breadth. This cannot be synthesized by an exchange. */
export function hasStructuralOverlap(o: StoryOverlap): boolean {
  return (
    o.sharedConnections >= RICH_FLOOR.minShared &&
    o.mariaOneHop >= RICH_FLOOR.minOneHopPerSide &&
    o.helperOneHop >= RICH_FLOOR.minOneHopPerSide
  );
}

/** The full floor: structural overlap AND a close-enough path. */
export function meetsRichFloor(o: StoryOverlap): boolean {
  return (
    hasStructuralOverlap(o) &&
    o.pathDegree !== null &&
    o.pathDegree <= RICH_FLOOR.maxPathDegree
  );
}

function intersects(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return b.some(id => set.has(id));
}

/**
 * Deterministically pick the ordinary helper. Only structurally-rich candidates are eligible (their
 * shared/one-hop overlap is real and unsynthesizable); among those, prefer a cross-community candidate,
 * then higher shared overlap, then id for stability. If none are structurally rich, return the best
 * available and flag the floor unachievable — a single exchange cannot manufacture shared people.
 */
function selectHelper(
  state: MariaStoryState,
): { helper: HelperCandidate; achievable: boolean } {
  const crossScore = (c: HelperCandidate) => (intersects(c.communityIds, state.maria.communityIds) ? 0 : 1);
  const rank = (a: HelperCandidate, b: HelperCandidate) =>
    crossScore(b) - crossScore(a) ||
    b.overlap.sharedConnections - a.overlap.sharedConnections ||
    a.id.localeCompare(b.id);

  const structural = state.helperCandidates.filter(c => hasStructuralOverlap(c.overlap)).sort(rank);
  if (structural.length) return { helper: structural[0], achievable: true };
  return { helper: [...state.helperCandidates].sort(rank)[0], achievable: false };
}

/** Pick the lowest-overlap provider so the provider story reads as a deliberate contrast. */
function selectProvider(state: MariaStoryState): ProviderCandidate {
  return [...state.providerCandidates].sort(
    (a, b) => a.overlap.sharedConnections - b.overlap.sharedConnections || a.id.localeCompare(b.id),
  )[0];
}

export function planMariaRelationshipStory(state: MariaStoryState): MariaStoryPlan {
  const { helper, achievable } = selectHelper(state);
  const provider = selectProvider(state);
  const { existing } = state;

  // Selection-aware reconciliation: a pre-existing match/offer only counts when it belongs to the
  // SELECTED helper/provider AND is still reviewable. A rejected/completed match or a
  // declined/accepted offer is not the reviewable story, so the story still needs a fresh one —
  // reusing a terminal row would configure the demo with a dead decision.
  const ordinaryMatchId = existing.ordinaryMatches.find(
    m => m.responderId === helper.id && m.status === 'proposed',
  )?.id;
  const providerOfferId = existing.providerOffers.find(
    o => o.providerUserId === provider.id && o.status === 'pending',
  )?.id;

  const pathWithinFloor = helper.overlap.pathDegree !== null && helper.overlap.pathDegree <= RICH_FLOOR.maxPathDegree;
  const needsRepair = achievable && !pathWithinFloor;
  const homeCommunity = state.maria.communityIds[0];
  const repair: ExistingRepair = existing.repair ?? { matches: [] };
  // The repair match, if any, is the one whose responder is the SELECTED helper.
  const repairMatch = repair.matches.find(m => m.responderId === helper.id);

  const actions: StoryAction[] = [];
  if (!existing.ordinaryRequestId) {
    actions.push({ type: 'create_ordinary_request', actor: 'maria', communityId: homeCommunity, title: ORDINARY_REQUEST_TITLE, visibilityScope: STORY_REQUEST_SCOPE });
  }
  if (!ordinaryMatchId) {
    actions.push({ type: 'create_ordinary_offer', actor: 'helper', helperId: helper.id });
  }
  if (!existing.providerRequestId) {
    actions.push({ type: 'create_provider_request', actor: 'maria', communityId: homeCommunity, title: PROVIDER_REQUEST_TITLE, visibilityScope: STORY_REQUEST_SCOPE });
  }
  if (!providerOfferId) {
    actions.push({ type: 'submit_provider_offer', actor: 'provider', providerId: provider.id });
  }
  if (needsRepair) {
    // Resumable: emit only the repair steps not already done by a prior (possibly partial) run.
    if (!repair.requestId) {
      actions.push({ type: 'create_repair_request', actor: 'maria', communityId: homeCommunity, title: REPAIR_REQUEST_TITLE, visibilityScope: STORY_REQUEST_SCOPE });
    }
    if (!repairMatch) {
      actions.push(
        { type: 'offer_repair', actor: 'helper', helperId: helper.id },
        { type: 'accept_repair', actor: 'maria' },
        { type: 'complete_repair', actor: 'maria' },
        { type: 'complete_repair', actor: 'helper' },
      );
    } else {
      if (repairMatch.status === 'proposed') actions.push({ type: 'accept_repair', actor: 'maria' });
      if (!repairMatch.requesterDone) actions.push({ type: 'complete_repair', actor: 'maria' });
      if (!repairMatch.responderDone) actions.push({ type: 'complete_repair', actor: 'helper' });
    }
  }

  const warnings: string[] = [];
  if (!achievable) {
    warnings.push(
      `No candidate clears the structural rich floor (need ≥${RICH_FLOOR.minShared} shared and ` +
        `≥${RICH_FLOOR.minOneHopPerSide} one-hop per side). Best available helper is ${helper.id}. ` +
        `Shared connections cannot be synthesized by an exchange — add real shared history first.`,
    );
  }

  return {
    selection: {
      ordinaryHelperId: helper.id,
      providerId: provider.id,
      ordinaryCrossCommunity: !intersects(helper.communityIds, state.maria.communityIds),
    },
    actions,
    expected: {
      ordinary: {
        ...(existing.ordinaryRequestId && { requestId: existing.ordinaryRequestId }),
        ...(ordinaryMatchId && { matchId: ordinaryMatchId }),
      },
      provider: {
        ...(existing.providerRequestId && { requestId: existing.providerRequestId }),
        ...(providerOfferId && { offerId: providerOfferId }),
      },
    },
    repair: {
      ...(repair.requestId && { requestId: repair.requestId }),
      ...(repairMatch?.id && { matchId: repairMatch.id }),
    },
    floor: { achievable, needsRepair, met: achievable && !needsRepair, helperOverlap: helper.overlap },
    warnings,
  };
}

export interface StoryResult {
  ordinary: { requestId?: string; matchId?: string };
  provider: { requestId?: string; offerId?: string };
}

/**
 * The minimal client surface apply needs. Mutations go through ordinary HTTP APIs; `readback` re-reads
 * authoritative state so the demo IDs come from the server, not from mutation responses.
 */
export interface StoryClients {
  maria: {
    createRequest(data: { community_id: string; title: string; description: string; request_type: string; visibility_scope: VisibilityScope }): Promise<any>;
    acceptMatch(matchId: string): Promise<any>;
    completeMatch(matchId: string): Promise<any>;
  };
  helper: {
    offerHelp(requestId: string): Promise<any>;
    completeMatch(matchId: string): Promise<any>;
  };
  provider: {
    submitProviderOffer(requestId: string): Promise<any>;
  };
  readback: {
    getRequest(requestId: string): Promise<{ id: string; status: string } | null>;
    getMatchesForRequest(requestId: string): Promise<ExistingMatch[]>;
    getOffersForRequest(requestId: string): Promise<ExistingOffer[]>;
    /**
     * Re-measure the SELECTED helper's overlap with Maria from authoritative graph state. Used after
     * a repair exchange to confirm the trust projection actually landed within the rich floor.
     */
    measureHelperOverlap(): Promise<StoryOverlap>;
  };
}

export interface ApplyOptions {
  /** Attempts to re-measure the helper overlap, tolerating async trust-projection lag. */
  verifyAttempts?: number;
  verifyDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const idOf = (res: any): string | undefined => res?.id ?? res?.data?.id ?? res?.data?.data?.id;
function need(id: string | undefined, what: string): string {
  if (!id) throw new Error(`${what} must exist before the next action`);
  return id;
}

/**
 * Apply the plan through ordinary APIs, then VERIFY by re-reading authoritative state and deriving the
 * demo IDs from the server (never from mutation responses). Refuses to run a story whose structural
 * overlap is missing, so the demo never shows a sparse picture. Resumable: an empty plan re-reads and
 * verifies the already-existing IDs.
 */
export async function applyMariaRelationshipStory(
  plan: MariaStoryPlan,
  clients: StoryClients,
  options: ApplyOptions = {},
): Promise<StoryResult> {
  if (!plan.floor.achievable) {
    throw new Error(
      `Refusing to apply: the ordinary helper lacks structural rich-floor overlap. ${plan.warnings.join(' ')}`,
    );
  }

  const requestId = { ordinary: plan.expected.ordinary.requestId, provider: plan.expected.provider.requestId };
  // Resume a partial repair: reuse any request/match a prior run already created.
  let repairRequestId: string | undefined = plan.repair.requestId;
  let repairMatchId: string | undefined = plan.repair.matchId;

  for (const action of plan.actions) {
    switch (action.type) {
      case 'create_ordinary_request':
        requestId.ordinary = idOf(await clients.maria.createRequest(requestBody(action)));
        break;
      case 'create_ordinary_offer':
        await clients.helper.offerHelp(need(requestId.ordinary, 'Ordinary request'));
        break;
      case 'create_provider_request':
        requestId.provider = idOf(await clients.maria.createRequest(requestBody(action)));
        break;
      case 'submit_provider_offer':
        await clients.provider.submitProviderOffer(need(requestId.provider, 'Provider request'));
        break;
      case 'create_repair_request':
        repairRequestId = idOf(await clients.maria.createRequest(requestBody(action)));
        break;
      case 'offer_repair':
        repairMatchId = idOf(await clients.helper.offerHelp(need(repairRequestId, 'Repair request')));
        break;
      case 'accept_repair':
        await clients.maria.acceptMatch(need(repairMatchId, 'Repair match'));
        break;
      case 'complete_repair':
        await (action.actor === 'maria' ? clients.maria : clients.helper).completeMatch(
          need(repairMatchId, 'Repair match'),
        );
        break;
    }
  }

  // Verify by authoritative re-read: the demo IDs are whatever the server now reports for the SELECTED
  // helper/provider — not the transient mutation responses.
  // Lifecycle-aware verification: the reviewable story requires an OPEN request with a still-live
  // decision (a proposed match / pending offer). A concurrent transition to rejected/declined/closed
  // must fail verification rather than be printed as "verified".
  const result: StoryResult = { ordinary: {}, provider: {} };
  if (requestId.ordinary) {
    const req = await clients.readback.getRequest(requestId.ordinary);
    if (!req || req.status !== 'open') throw new Error('Verification failed: ordinary request is not open on re-read');
    const match = (await clients.readback.getMatchesForRequest(requestId.ordinary)).find(
      m => m.responderId === plan.selection.ordinaryHelperId && m.status === 'proposed',
    );
    if (!match) throw new Error('Verification failed: no proposed ordinary match for the selected helper on re-read');
    result.ordinary = { requestId: requestId.ordinary, matchId: match.id };
  }
  if (requestId.provider) {
    const req = await clients.readback.getRequest(requestId.provider);
    if (!req || req.status !== 'open') throw new Error('Verification failed: provider request is not open on re-read');
    const offer = (await clients.readback.getOffersForRequest(requestId.provider)).find(
      o => o.providerUserId === plan.selection.providerId && o.status === 'pending',
    );
    if (!offer) throw new Error('Verification failed: no pending provider offer for the selected provider on re-read');
    result.provider = { requestId: requestId.provider, offerId: offer.id };
  }

  // Structural verification: confirm the ordinary helper actually reaches the rich floor now. A repair
  // exchange only lands in the graph after the asynchronous match_completed projection, so re-measure
  // with bounded retries and fail loudly rather than print "verified" for a relationship that is not
  // yet (or never) rich enough.
  const attempts = Math.max(1, options.verifyAttempts ?? 6);
  const delayMs = options.verifyDelayMs ?? 2000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  let overlap: StoryOverlap | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    overlap = await clients.readback.measureHelperOverlap();
    if (meetsRichFloor(overlap)) break;
    if (attempt < attempts - 1) await sleep(delayMs);
  }
  if (!overlap || !meetsRichFloor(overlap)) {
    throw new Error(
      'Verification failed: the ordinary helper did not reach the rich floor after repair/projection ' +
        `(${JSON.stringify(overlap)}).`,
    );
  }

  return result;
}

type CreateRequestAction = Extract<
  StoryAction,
  { type: 'create_ordinary_request' | 'create_provider_request' | 'create_repair_request' }
>;

function requestBody(action: CreateRequestAction) {
  const descriptions: Record<string, string> = {
    create_ordinary_request: 'Looking for a hand moving a couch on Saturday afternoon.',
    create_provider_request: 'Need a tradesperson to quote and fix a leaking kitchen tap.',
    create_repair_request: 'A small mutual exchange to establish direct rehearsal history.',
  };
  return {
    community_id: action.communityId,
    title: action.title,
    description: descriptions[action.type] ?? action.title,
    request_type: action.type === 'create_provider_request' ? 'service' : 'generic',
    // Platform scope so a cross-community helper/provider can actually reach and offer on the request.
    visibility_scope: action.visibilityScope,
  };
}
