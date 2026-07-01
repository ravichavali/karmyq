import fs from 'fs';
import path from 'path';
import {
  planMariaRelationshipStory,
  applyMariaRelationshipStory,
  overlapFromNeighborhoods,
  meetsRichFloor,
  hasStructuralOverlap,
  RICH_FLOOR,
  STORY_REQUEST_SCOPE,
  PROVIDER_REQUEST_TITLE,
  type MariaStoryState,
  type StoryOverlap,
} from '../../src/scenarios/mariaRelationshipStory';

const MARIA = '11111111-1111-1111-1111-111111111111';
const C1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const C2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const C3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// Structural overlap present (shared people + one-hop breadth) — cannot be synthesized.
const richPath: StoryOverlap = { pathDegree: 2, sharedConnections: 4, mariaOneHop: 6, helperOneHop: 5 };
// Same structural overlap but the direct path is too far — repairable via a Maria↔helper exchange.
const farPath: StoryOverlap = { pathDegree: 5, sharedConnections: 4, mariaOneHop: 6, helperOneHop: 5 };
// No structural overlap — a single exchange cannot manufacture 3 shared people.
const sparse: StoryOverlap = { pathDegree: null, sharedConnections: 1, mariaOneHop: 2, helperOneHop: 2 };
const lowOverlap: StoryOverlap = { pathDegree: null, sharedConnections: 0, mariaOneHop: 5, helperOneHop: 1 };

function baseState(overrides: Partial<MariaStoryState> = {}): MariaStoryState {
  return {
    maria: { id: MARIA, communityIds: [C1] },
    helperCandidates: [
      { id: 'h-cross', communityIds: [C2], overlap: richPath },       // structural + path ok + cross
      { id: 'h-same', communityIds: [C1], overlap: richPath },        // structural + path ok, same community
    ],
    providerCandidates: [
      { id: 'p-overlap', communityIds: [C1], serviceType: 'tradesperson', overlap: { ...richPath, sharedConnections: 3 } },
      { id: 'p-contrast', communityIds: [C2], serviceType: 'tradesperson', overlap: lowOverlap },
    ],
    existing: { ordinaryMatches: [], providerOffers: [] },
    ...overrides,
  };
}

describe('Sprint 116 — floor invariants', () => {
  it('separates structural overlap (unsynthesizable) from the full rich floor (path repairable)', () => {
    expect(RICH_FLOOR).toEqual({ maxPathDegree: 2, minShared: 3, minOneHopPerSide: 4 });
    expect(hasStructuralOverlap(richPath)).toBe(true);
    expect(hasStructuralOverlap(farPath)).toBe(true);        // shared/one-hop present; only the path is far
    expect(hasStructuralOverlap(sparse)).toBe(false);
    expect(meetsRichFloor(richPath)).toBe(true);
    expect(meetsRichFloor(farPath)).toBe(false);             // path degree 5 > 2
  });
});

describe('Sprint 116 — overlap measurement excludes ego centers and both anchors', () => {
  const M = 'maria', H = 'helper';
  const node = (id: string, deg: number) => ({ id, degrees_of_separation: deg });

  it('counts only degrees_of_separation === 1 and never the two anchors', () => {
    // Both egos include their own center (deg 0) and, post-repair, the opposite anchor at deg 1,
    // plus three genuine mutual friends and one private neighbour each.
    const mariaNodes = [node(M, 0), node(H, 1), node('a', 1), node('b', 1), node('c', 1), node('m-only', 1), node('far', 2)];
    const helperNodes = [node(H, 0), node(M, 1), node('a', 1), node('b', 1), node('c', 1), node('h-only', 1)];

    const o = overlapFromNeighborhoods(mariaNodes, helperNodes, M, H, 1);
    expect(o.sharedConnections).toBe(3);   // a, b, c — NOT Maria/helper
    expect(o.mariaOneHop).toBe(4);         // a, b, c, m-only — the helper anchor and deg-2 excluded
    expect(o.helperOneHop).toBe(4);        // a, b, c, h-only — Maria anchor excluded
    expect(o.pathDegree).toBe(1);
  });

  it('does not let the two anchors alone satisfy the floor (one true shared → fails)', () => {
    const mariaNodes = [node(M, 0), node(H, 1), node('x', 1), node('m1', 1), node('m2', 1)];
    const helperNodes = [node(H, 0), node(M, 1), node('x', 1), node('h1', 1), node('h2', 1)];
    const o = overlapFromNeighborhoods(mariaNodes, helperNodes, M, H, 1);
    expect(o.sharedConnections).toBe(1);   // only x; anchors excluded
    expect(meetsRichFloor(o)).toBe(false);
  });
});

describe('Sprint 116 — selection', () => {
  it('prefers a structurally-rich, cross-community helper and a low-overlap provider contrast', () => {
    const plan = planMariaRelationshipStory(baseState());
    expect(plan.selection.ordinaryHelperId).toBe('h-cross');
    expect(plan.selection.ordinaryCrossCommunity).toBe(true);
    expect(plan.selection.providerId).toBe('p-contrast');
    expect(plan.floor).toMatchObject({ met: true, achievable: true, needsRepair: false });
  });

  it('classifies cross-community by community-set disjointness, not the first community', () => {
    // helper's first community differs from Maria's, but the sets still intersect (both include C1).
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-multi', communityIds: [C2, C1], overlap: richPath }],
    }));
    expect(plan.selection.ordinaryHelperId).toBe('h-multi');
    expect(plan.selection.ordinaryCrossCommunity).toBe(false);
  });
});

describe('Sprint 116 — repair vs refuse', () => {
  it('repairs a far path with request→offer→accept→two-sided-completion actions', () => {
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-far', communityIds: [C3], overlap: farPath }],
    }));
    expect(plan.floor).toMatchObject({ achievable: true, needsRepair: true, met: false });
    expect(plan.warnings).toEqual([]);
    expect(plan.actions.map(a => a.type)).toEqual([
      'create_ordinary_request',
      'create_ordinary_offer',
      'create_provider_request',
      'submit_provider_offer',
      'create_repair_request',
      'offer_repair',
      'accept_repair',
      'complete_repair',
      'complete_repair',
    ]);
    // two-sided completion: one completion by each participant
    const completions = plan.actions.filter(a => a.type === 'complete_repair') as Array<{ actor: string }>;
    expect(completions.map(c => c.actor).sort()).toEqual(['helper', 'maria']);
  });

  it('refuses (warns, no repair, apply throws) when no candidate has structural overlap', () => {
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-sparse', communityIds: [C3], overlap: sparse }],
    }));
    expect(plan.floor).toMatchObject({ achievable: false });
    expect(plan.warnings.join(' ')).toMatch(/rich floor|structural/i);
    expect(plan.actions.some(a => a.type === 'create_repair_request')).toBe(false);
  });

  it('creates every request at platform scope so a cross-community helper can reach it', () => {
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-far', communityIds: [C3], overlap: farPath }],
    }));
    const creates = plan.actions.filter(a => a.type.endsWith('_request')) as Array<{ visibilityScope: string }>;
    expect(creates).toHaveLength(3); // ordinary, provider, repair
    expect(creates.every(a => a.visibilityScope === STORY_REQUEST_SCOPE)).toBe(true);
    expect(STORY_REQUEST_SCOPE).toBe('platform');
  });
});

describe('Sprint 116 — repair is resumable after a partial prior run', () => {
  it('re-uses an accepted repair match and only completes the missing side', () => {
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-far', communityIds: [C3], overlap: farPath }],
      existing: {
        ordinaryRequestId: 'req-o',
        ordinaryMatches: [{ id: 'match-o', responderId: 'h-far', status: 'proposed' }],
        providerRequestId: 'req-p',
        providerOffers: [{ id: 'offer-p', providerUserId: 'p-contrast', status: 'pending' }],
        repair: {
          requestId: 'req-repair',
          matches: [{ id: 'repair-match', responderId: 'h-far', status: 'matched', requesterDone: true, responderDone: false }],
        },
      },
    }));
    // Only the helper's completion remains — no new repair request, offer, accept, or Maria completion.
    expect(plan.actions.map(a => a.type)).toEqual(['complete_repair']);
    expect((plan.actions[0] as any).actor).toBe('helper');
    expect(plan.repair).toEqual({ requestId: 'req-repair', matchId: 'repair-match' });
  });

  it('re-uses an existing repair request (no match yet) instead of creating a duplicate', () => {
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-far', communityIds: [C3], overlap: farPath }],
      existing: {
        ordinaryRequestId: 'req-o',
        ordinaryMatches: [{ id: 'match-o', responderId: 'h-far', status: 'proposed' }],
        providerRequestId: 'req-p',
        providerOffers: [{ id: 'offer-p', providerUserId: 'p-contrast', status: 'pending' }],
        repair: { requestId: 'req-repair', matches: [] },
      },
    }));
    expect(plan.actions.map(a => a.type)).toEqual(['offer_repair', 'accept_repair', 'complete_repair', 'complete_repair']);
    expect(plan.actions.some(a => a.type === 'create_repair_request')).toBe(false);
  });
});

describe('Sprint 116 — selection-aware existing-state reconciliation', () => {
  it('only treats a match/offer as existing when it belongs to the SELECTED helper/provider', () => {
    const plan = planMariaRelationshipStory(baseState({
      existing: {
        ordinaryRequestId: 'req-o',
        // a match exists, but from a DIFFERENT responder → the selected helper still needs to offer
        ordinaryMatches: [{ id: 'match-other', responderId: 'someone-else', status: 'proposed' }],
        providerRequestId: 'req-p',
        // an offer exists, but from a DIFFERENT provider → the selected provider still needs to submit
        providerOffers: [{ id: 'offer-other', providerUserId: 'other-provider', status: 'pending' }],
      },
    }));
    expect(plan.actions.map(a => a.type)).toEqual(['create_ordinary_offer', 'submit_provider_offer']);
    expect(plan.expected).toEqual({ ordinary: { requestId: 'req-o' }, provider: { requestId: 'req-p' } });
  });

  it('ignores terminal-status rows: a rejected match / declined offer is not the reviewable story', () => {
    const plan = planMariaRelationshipStory(baseState({
      existing: {
        ordinaryRequestId: 'req-o',
        ordinaryMatches: [{ id: 'match-dead', responderId: 'h-cross', status: 'rejected' }],
        providerRequestId: 'req-p',
        providerOffers: [{ id: 'offer-dead', providerUserId: 'p-contrast', status: 'declined' }],
      },
    }));
    expect(plan.actions.map(a => a.type)).toEqual(['create_ordinary_offer', 'submit_provider_offer']);
    expect(plan.expected).toEqual({ ordinary: { requestId: 'req-o' }, provider: { requestId: 'req-p' } });
  });

  it('is idempotent when the selected helper/provider already have their match/offer and the path is close', () => {
    const plan = planMariaRelationshipStory(baseState({
      existing: {
        ordinaryRequestId: 'req-o',
        ordinaryMatches: [{ id: 'match-o', responderId: 'h-cross', status: 'proposed' }],
        providerRequestId: 'req-p',
        providerOffers: [{ id: 'offer-p', providerUserId: 'p-contrast', status: 'pending' }],
      },
    }));
    expect(plan.actions).toEqual([]);
    expect(plan.expected).toEqual({
      ordinary: { requestId: 'req-o', matchId: 'match-o' },
      provider: { requestId: 'req-p', offerId: 'offer-p' },
    });
  });
});

describe('Sprint 116 — apply re-reads authoritative state and verifies before reporting IDs', () => {
  function fakeClients(readback: any) {
    return {
      maria: {
        createRequest: jest.fn(async (d: any) => ({ id: d.title === PROVIDER_REQUEST_TITLE ? 'req-p' : d.title.startsWith('Repair') ? 'req-repair' : 'req-o' })),
        acceptMatch: jest.fn(async () => ({})),
        completeMatch: jest.fn(async () => ({})),
      },
      helper: {
        offerHelp: jest.fn(async () => ({ id: 'match-mutation-resp' })),
        completeMatch: jest.fn(async () => ({})),
      },
      provider: {
        submitProviderOffer: jest.fn(async () => ({ id: 'offer-mutation-resp' })),
      },
      readback,
    } as any;
  }

  // Re-read reports the authoritative rows tied to the selected personas; overlap already at the floor.
  function confirmingReadback(overrides: any = {}) {
    return {
      getRequest: jest.fn(async (id: string) => ({ id, status: 'open' })),
      getMatchesForRequest: jest.fn(async () => [{ id: 'match-authoritative', responderId: 'h-cross', status: 'proposed' }]),
      getOffersForRequest: jest.fn(async () => [{ id: 'offer-authoritative', providerUserId: 'p-contrast', status: 'pending' }]),
      measureHelperOverlap: jest.fn(async () => richPath),
      ...overrides,
    };
  }

  const noSleep = async () => {};

  it('derives the demo IDs from re-read (not the mutation responses) and confirms the request exists', async () => {
    const plan = planMariaRelationshipStory(baseState());
    const readback = confirmingReadback();
    const result = await applyMariaRelationshipStory(plan, fakeClients(readback), { sleep: noSleep });

    expect(readback.getMatchesForRequest).toHaveBeenCalledWith('req-o');
    expect(readback.getOffersForRequest).toHaveBeenCalledWith('req-p');
    expect(result).toEqual({
      ordinary: { requestId: 'req-o', matchId: 'match-authoritative' },
      provider: { requestId: 'req-p', offerId: 'offer-authoritative' },
    });
  });

  it('throws when re-read cannot confirm the selected helper’s match', async () => {
    const plan = planMariaRelationshipStory(baseState());
    const readback = confirmingReadback({
      getMatchesForRequest: jest.fn(async () => [{ id: 'match-x', responderId: 'someone-else', status: 'proposed' }]),
    });
    await expect(applyMariaRelationshipStory(plan, fakeClients(readback), { sleep: noSleep })).rejects.toThrow(/verif|not found|no proposed/i);
  });

  it('throws when the match transitioned out of proposed between apply and readback', async () => {
    const plan = planMariaRelationshipStory(baseState());
    const readback = confirmingReadback({
      getMatchesForRequest: jest.fn(async () => [{ id: 'match-authoritative', responderId: 'h-cross', status: 'rejected' }]),
    });
    await expect(applyMariaRelationshipStory(plan, fakeClients(readback), { sleep: noSleep })).rejects.toThrow(/no proposed/i);
  });

  it('throws when the ordinary request is no longer open on readback', async () => {
    const plan = planMariaRelationshipStory(baseState());
    const readback = confirmingReadback({
      getRequest: jest.fn(async (id: string) => ({ id, status: 'matched' })),
    });
    await expect(applyMariaRelationshipStory(plan, fakeClients(readback), { sleep: noSleep })).rejects.toThrow(/not open/i);
  });

  it('throws when the helper overlap never reaches the rich floor (projection failed)', async () => {
    const plan = planMariaRelationshipStory(baseState());
    // Structural people are present but the path never lands within the floor → not verified.
    const readback = confirmingReadback({ measureHelperOverlap: jest.fn(async () => farPath) });
    await expect(
      applyMariaRelationshipStory(plan, fakeClients(readback), { sleep: noSleep, verifyAttempts: 3 }),
    ).rejects.toThrow(/rich floor|did not reach/i);
    expect(readback.measureHelperOverlap).toHaveBeenCalledTimes(3);
  });

  it('polls past asynchronous projection lag and verifies once the overlap lands', async () => {
    const plan = planMariaRelationshipStory(baseState());
    let calls = 0;
    const readback = confirmingReadback({
      measureHelperOverlap: jest.fn(async () => (++calls < 3 ? farPath : richPath)),
    });
    const sleep = jest.fn(async () => {});
    const result = await applyMariaRelationshipStory(plan, fakeClients(readback), { sleep, verifyAttempts: 5 });
    expect(readback.measureHelperOverlap).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(result.ordinary.matchId).toBe('match-authoritative');
  });

  it('executes the repair exchange and never applies a story without structural overlap', async () => {
    const repairPlan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-far', communityIds: [C3], overlap: farPath }],
    }));
    const clients = fakeClients(confirmingReadback({
      getMatchesForRequest: jest.fn(async () => [{ id: 'match-authoritative', responderId: 'h-far', status: 'proposed' }]),
    }));
    await applyMariaRelationshipStory(repairPlan, clients, { sleep: noSleep });
    // repair = one accept + two completions
    expect(clients.maria.acceptMatch).toHaveBeenCalledTimes(1);
    expect(clients.maria.completeMatch).toHaveBeenCalledTimes(1);
    expect(clients.helper.completeMatch).toHaveBeenCalledTimes(1);

    const sparsePlan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-sparse', communityIds: [C3], overlap: sparse }],
    }));
    await expect(applyMariaRelationshipStory(sparsePlan, fakeClients(confirmingReadback()), { sleep: noSleep })).rejects.toThrow(/rich floor|structural/i);
  });
});

describe('Sprint 116 — rehearsal never writes product tables directly', () => {
  it('the scenario and script import no database pool', () => {
    for (const rel of ['src/scenarios/mariaRelationshipStory.ts', 'src/scripts/rehearseMariaRelationshipStory.ts']) {
      const source = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(source).not.toMatch(/getPool|from ['"]pg['"]|database\/db/);
    }
  });
});
