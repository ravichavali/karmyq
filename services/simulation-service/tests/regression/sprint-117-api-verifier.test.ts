import {
  findForbiddenKeys,
  verifyCuratedDemo,
  type DemoVerificationDeps,
} from '../../src/fixtures/curatedDemo/verifier';
import { compileManifest, expectedSkillDirectory, semanticUuid, skillKey as keyOf } from '../../src/fixtures/curatedDemo/compiler';
import { CURATED_DEMO_MANIFEST } from '../../src/fixtures/curatedDemo/manifest';

// Sprint 133 PR D: the five skills/offer deps, answering a healthy demo so these Sprint 117 cases still
// isolate the check under test. Their failure modes are covered in tests/tdd/sprint-133.
function healthySkillsAndOffers(): Pick<DemoVerificationDeps,
  'getViewerUserId' | 'getMemberSkills' | 'getSkillDirectory' | 'searchCommunitySkills' | 'listOffers' | 'getOffer'> {
  const baseline = compileManifest(CURATED_DEMO_MANIFEST, new Date());
  const id = semanticUuid;
  const keys = (person: string) => new Set(baseline.skills.filter(s => s.userId === id(person)).map(keyOf));
  const x = [...keys('person.ambient-09')].filter(k => keys('person.bridge').has(k))[0];
  const directory = Object.entries(expectedSkillDirectory(baseline, 'community.providers', 'person.provider'))
    .map(([skill_key, member_count]) => ({ skill_key, label: skill_key, member_count }));
  const ridesOffer = id('offer.rides-airport');
  const persona = { maria: 'person.maria', provider: 'person.provider', unrelated: 'person.outsider' } as const;
  return {
    getViewerUserId: async viewer => id(persona[viewer]),
    getMemberSkills: async (viewer, userId) => {
      if (viewer === 'provider') return { status: 404, data: null };
      const count = userId === id('person.maria') ? 2 : 1;
      return { status: 200, data: [{ tag_id: 't', label: 'Cooking', skill_slug: 'cooking', endorsement_count: count }] };
    },
    getSkillDirectory: async (viewer) => viewer === 'provider'
      ? { status: 200, data: directory }
      : { status: 200, data: [{ skill_key: 'cooking', label: 'Cooking', member_count: 2 }] },
    searchCommunitySkills: async (_viewer, _community, skill) => ({
      status: 200, data: skill === x ? [{ user_id: id('person.bridge') }] : [],
    }),
    listOffers: async () => ({ status: 200, data: [{ id: id('offer.sophia-meal-prep') }, { id: id('offer.priya-tutoring') }] }),
    getOffer: async (viewer, offerId) => offerId === ridesOffer && viewer === 'maria'
      ? { status: 404, data: null }
      : { status: 200, data: { id: offerId } },
  };
}

const ORD_REQ = '11111111-1111-5111-8111-111111111111';
const MATCH = '22222222-2222-5222-8222-222222222222';
const PROV_REQ = '33333333-3333-5333-8333-333333333333';
const OFFER = '44444444-4444-5444-8444-444444444444';

interface WorldOverrides {
  mariaRoles?: string[];
  reciprocalTopology?: boolean;
  unrelatedContextStatus?: number;
  ordinaryFloor?: { pathDegree: number; sharedConnections: number; mariaOneHop: number; helperOneHop: number };
  runwayDays?: number;
  ordinaryContext?: Record<string, unknown>;
  providerContext?: Record<string, unknown>;
  providerStoryValid?: boolean;
}

function fakeWorld(overrides: WorldOverrides = {}): DemoVerificationDeps {
  const {
    mariaRoles = ['member'],
    reciprocalTopology = true,
    unrelatedContextStatus = 404,
    ordinaryFloor = { pathDegree: 2, sharedConnections: 3, mariaOneHop: 4, helperOneHop: 4 },
    runwayDays = 59,
    ordinaryContext = { bond_depth: 2 },
    providerContext = { bond_depth: 1, provider_rating: 4.5 },
    providerStoryValid = true,
  } = overrides;
  return {
    getMariaMemberships: async () => mariaRoles.map(role => ({ communityId: 'community-a', role })),
    getOrdinaryFloor: async () => ordinaryFloor,
    getReciprocalTopology: async () => reciprocalTopology,
    getUnrelatedContextStatus: async () => unrelatedContextStatus,
    getRunwayDays: async () => runwayDays,
    getOrdinaryContext: async () => ordinaryContext,
    getProviderContext: async () => providerContext,
    getProviderStoryValid: async () => providerStoryValid,
    getStoryIds: async () => ({
      ordinaryRequestId: ORD_REQ,
      ordinaryMatchId: MATCH,
      providerRequestId: PROV_REQ,
      providerOfferId: OFFER,
    }),
    ...healthySkillsAndOffers(),
  };
}

describe('Sprint 117 curated demo API verifier', () => {
  it('reports ready only for non-admin coherent reciprocal privacy-safe stories', async () => {
    const report = await verifyCuratedDemo(fakeWorld({
      mariaRoles: ['member'],
      reciprocalTopology: true,
      unrelatedContextStatus: 404,
      ordinaryFloor: { pathDegree: 2, sharedConnections: 3, mariaOneHop: 4, helperOneHop: 4 },
      runwayDays: 59,
    }));
    expect(report.ready).toBe(true);
    expect(report.storyIds).toEqual({
      ordinaryRequestId: ORD_REQ,
      ordinaryMatchId: MATCH,
      providerRequestId: PROV_REQ,
      providerOfferId: OFFER,
    });
  });

  it.each([
    ['admin Maria', { mariaRoles: ['admin'] }],
    ['forbidden metric', { ordinaryContext: { trust_score: 91 } }],
    ['unrelated access', { unrelatedContextStatus: 200 }],
    ['short runway', { runwayDays: 10 }],
    ['non-reciprocal topology', { reciprocalTopology: false }],
    ['thin one-hop', { ordinaryFloor: { pathDegree: 2, sharedConnections: 3, mariaOneHop: 3, helperOneHop: 4 } }],
    ['deep path', { ordinaryFloor: { pathDegree: 3, sharedConnections: 3, mariaOneHop: 4, helperOneHop: 4 } }],
    ['invalid provider story', { providerStoryValid: false }],
  ])('fails closed for %s', async (_name, patch) => {
    const report = await verifyCuratedDemo(fakeWorld(patch));
    expect(report.ready).toBe(false);
    expect(report.storyIds).toBeUndefined();
  });

  it('allows bond_depth and the provider-rating exception but not raw metrics', () => {
    expect(findForbiddenKeys({ bond_depth: 2, provider_rating: 4.5 })).toEqual([]);
    expect(findForbiddenKeys({ nested: { trust_score: 5 } })).toEqual(['$.nested.trust_score']);
    expect(findForbiddenKeys([{ raw_weight: 1 }])).toEqual(['$[0].raw_weight']);
  });
});
