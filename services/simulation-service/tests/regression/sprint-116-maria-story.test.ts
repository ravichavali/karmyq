import fs from 'fs';
import path from 'path';
import {
  planMariaRelationshipStory,
  applyMariaRelationshipStory,
  meetsRichFloor,
  RICH_FLOOR,
  PROVIDER_REQUEST_TITLE,
  type MariaStoryState,
  type StoryOverlap,
} from '../../src/scenarios/mariaRelationshipStory';

const MARIA = '11111111-1111-1111-1111-111111111111';
const C1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const C2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const rich: StoryOverlap = { pathDegree: 2, sharedConnections: 4, mariaOneHop: 6, helperOneHop: 5 };
const sparse: StoryOverlap = { pathDegree: 4, sharedConnections: 1, mariaOneHop: 2, helperOneHop: 2 };

function baseState(overrides: Partial<MariaStoryState> = {}): MariaStoryState {
  return {
    maria: { id: MARIA, communityId: C1 },
    helperCandidates: [
      { id: 'h-cross', communityId: C2, overlap: rich },          // cross-community + rich → preferred
      { id: 'h-same', communityId: C1, overlap: rich },           // rich but same community
      { id: 'h-sparse', communityId: C2, overlap: sparse },
    ],
    providerCandidates: [
      { id: 'p-overlap', communityId: C1, serviceType: 'tradesperson', overlap: { ...rich, sharedConnections: 3 } },
      { id: 'p-contrast', communityId: C2, serviceType: 'tradesperson', overlap: { pathDegree: null, sharedConnections: 0, mariaOneHop: 5, helperOneHop: 1 } },
    ],
    existing: {},
    ...overrides,
  };
}

describe('Sprint 116 — meetsRichFloor invariant', () => {
  it('encodes ≤2-degree path, ≥3 shared, ≥4 one-hop per side', () => {
    expect(RICH_FLOOR).toEqual({ maxPathDegree: 2, minShared: 3, minOneHopPerSide: 4 });
    expect(meetsRichFloor(rich)).toBe(true);
    expect(meetsRichFloor({ ...rich, sharedConnections: 2 })).toBe(false);
    expect(meetsRichFloor({ ...rich, pathDegree: 3 })).toBe(false);
    expect(meetsRichFloor({ ...rich, pathDegree: null })).toBe(false);
    expect(meetsRichFloor({ ...rich, mariaOneHop: 3 })).toBe(false);
    expect(meetsRichFloor({ ...rich, helperOneHop: 3 })).toBe(false);
  });
});

describe('Sprint 116 — planMariaRelationshipStory selection', () => {
  it('selects a rich, cross-community ordinary helper and a low-overlap provider contrast', () => {
    const plan = planMariaRelationshipStory(baseState());
    expect(plan.selection.ordinaryHelperId).toBe('h-cross');
    expect(plan.selection.ordinaryCrossCommunity).toBe(true);
    expect(plan.selection.providerId).toBe('p-contrast');
    expect(plan.floor.met).toBe(true);
    expect(plan.warnings).toEqual([]);
  });

  it('scaffolds both stories with ordinary APIs when nothing exists yet', () => {
    const plan = planMariaRelationshipStory(baseState());
    expect(plan.actions.map(a => a.type)).toEqual([
      'create_ordinary_request',
      'create_ordinary_offer',
      'create_provider_request',
      'submit_provider_offer',
    ]);
    // The ordinary request is Maria's own, placed in her home community (the cross-community reach
    // comes from the helper living elsewhere, not from posting into the helper's community).
    const ordinaryReq = plan.actions.find(a => a.type === 'create_ordinary_request') as any;
    expect(ordinaryReq.actor).toBe('maria');
    expect(ordinaryReq.communityId).toBe(C1);
    expect(plan.expected).toEqual({ ordinary: {}, provider: {} });
  });

  it('is idempotent: a fully-realized story plans zero mutations', () => {
    const plan = planMariaRelationshipStory(baseState({
      existing: {
        ordinaryRequestId: 'req-o',
        ordinaryMatchId: 'match-o',
        providerRequestId: 'req-p',
        providerOfferId: 'offer-p',
      },
    }));
    expect(plan.actions).toEqual([]);
    expect(plan.expected).toEqual({
      ordinary: { requestId: 'req-o', matchId: 'match-o' },
      provider: { requestId: 'req-p', offerId: 'offer-p' },
    });
  });

  it('plans only the missing half when one story already exists', () => {
    const plan = planMariaRelationshipStory(baseState({
      existing: { ordinaryRequestId: 'req-o', ordinaryMatchId: 'match-o' },
    }));
    expect(plan.actions.map(a => a.type)).toEqual(['create_provider_request', 'submit_provider_offer']);
    expect(plan.expected.ordinary).toEqual({ requestId: 'req-o', matchId: 'match-o' });
  });

  it('refuses to validate a sparse picture: warns and marks the floor unmet when no helper qualifies', () => {
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-sparse', communityId: C2, overlap: sparse }],
    }));
    expect(plan.floor.met).toBe(false);
    expect(plan.warnings.join(' ')).toMatch(/rich floor/i);
  });
});

describe('Sprint 116 — applyMariaRelationshipStory (API-only, dry-run gated by caller)', () => {
  function fakeClients() {
    return {
      maria: {
        createRequest: jest.fn(async (d: any) => ({ id: d.title === PROVIDER_REQUEST_TITLE ? 'req-p' : 'req-o' })),
      },
      helper: {
        offerHelp: jest.fn(async () => ({ id: 'match-o' })),
      },
      provider: {
        submitProviderOffer: jest.fn(async () => ({ id: 'offer-p' })),
      },
    } as any;
  }

  it('executes scaffolding through ordinary API methods and fills the verified IDs', async () => {
    const plan = planMariaRelationshipStory(baseState());
    const clients = fakeClients();

    const result = await applyMariaRelationshipStory(plan, clients);

    expect(clients.maria.createRequest).toHaveBeenCalledTimes(2);
    expect(clients.helper.offerHelp).toHaveBeenCalledTimes(1);
    expect(clients.provider.submitProviderOffer).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ordinary: { requestId: 'req-o', matchId: 'match-o' },
      provider: { requestId: 'req-p', offerId: 'offer-p' },
    });
  });

  it('never applies a sparse story', async () => {
    const plan = planMariaRelationshipStory(baseState({
      helperCandidates: [{ id: 'h-sparse', communityId: C2, overlap: sparse }],
    }));
    await expect(applyMariaRelationshipStory(plan, fakeClients())).rejects.toThrow(/rich floor/i);
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
