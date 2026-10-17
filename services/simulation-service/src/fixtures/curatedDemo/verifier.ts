/**
 * Sprint 117 — Curated Demo Fixtures: outward-API verifier.
 *
 * The only authority that may declare the demo ready and surface the server-generated story IDs.
 * It asserts, through ordinary APIs (never direct DB reads), that: Maria is member-only; the
 * ordinary story keeps its rich floor (≤2-degree path, ≥3 shared, ≥4 one-hop per side); topology
 * is reciprocal; an unrelated viewer is denied; live stories have runway ≥ the manifest minimum;
 * ordinary/provider responses expose no ADR-082 raw metrics (allowing `bond_depth` and the
 * provider-rating exception); and a demo-session write is rejected 403. Fails closed: unless every
 * check passes, `ready` is false and `storyIds` is withheld.
 */

import { compileManifest, expectedSkillDirectory, semanticUuid, skillKey } from './compiler';
import type { CompiledDemoBaseline } from './types';
import { CURATED_DEMO_MANIFEST, STORY_HARD_FLOOR } from './manifest';

/** ADR-082 raw reputation/relationship metrics that must never appear in ordinary responses. */
export const FORBIDDEN_ORDINARY_KEYS = new Set([
  'trust_score', 'karma', 'raw_weight', 'effective_weight', 'current_weight',
  'interaction_count', 'match_completed_count', 'last_interaction_at',
]);

/** Recursively collect JSON paths of any forbidden key in a response value. */
export function findForbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findForbiddenKeys(item, `${path}[${i}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(FORBIDDEN_ORDINARY_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenKeys(child, `${path}.${key}`),
  ]);
}

/** Which persona a skills/offer read is authenticated as (Noah is the provider persona). */
export type DemoViewer = 'maria' | 'provider' | 'unrelated';

/** An HTTP read that never throws: status 0 is a transport error, `data` is null unless it succeeded. */
export interface ApiRead<T> { status: number; data: T | null }

/** `GET /auth/skills/users/:id` row (auth-service routes/skills.ts). */
export interface MemberSkillView {
  tag_id: string;
  label: string;
  skill_slug: string | null;
  endorsement_count: number;
  endorsed_by_me?: boolean;
  can_endorse?: boolean;
}
/** `GET /auth/skills/communities/:id` row. */
export interface SkillDirectoryEntry { skill_key: string; label: string; member_count: number }
/** `GET /auth/skills/communities/:id/search` row. */
export interface SkillSearchRow { user_id: string; name?: string }
/** `GET /offers` / `GET /offers/:id` row (request-service routes/offers.ts). */
export interface OfferView {
  id: string;
  community_id?: string;
  offerer_id?: string;
  title?: string;
  category?: string;
  status?: string;
}

export interface VerifiedStoryIds {
  ordinaryRequestId: string;
  ordinaryMatchId: string;
  providerRequestId: string;
  providerOfferId: string;
}

export interface OrdinaryFloor {
  pathDegree: number;
  sharedConnections: number;
  mariaOneHop: number;
  helperOneHop: number;
}

/**
 * The outward reads the verifier needs. Each is authenticated as the appropriate viewer (Maria
 * for her own neighbourhood, an unrelated member for the denial check) so privacy scope is real.
 */
export interface DemoVerificationDeps {
  getMariaMemberships(): Promise<Array<{ communityId: string; role: string }>>;
  getOrdinaryFloor(): Promise<OrdinaryFloor>;
  getReciprocalTopology(): Promise<boolean>;
  getUnrelatedContextStatus(): Promise<number>;
  getRunwayDays(): Promise<number>;
  getOrdinaryContext(): Promise<Record<string, unknown>>;
  getProviderContext(): Promise<Record<string, unknown>>;
  /** True only if the configured provider offer exists, is live/pending, and belongs to the provider. */
  getProviderStoryValid(): Promise<boolean>;
  getStoryIds(): Promise<VerifiedStoryIds>;
  /** GET /auth/skills/users/:userId as the viewer. */
  getMemberSkills(viewer: DemoViewer, userId: string): Promise<ApiRead<MemberSkillView[]>>;
  /** GET /auth/skills/communities/:communityId as the viewer. */
  getSkillDirectory(viewer: DemoViewer, communityId: string): Promise<ApiRead<SkillDirectoryEntry[]>>;
  /** GET /auth/skills/communities/:communityId/search?skill= as the viewer. */
  searchCommunitySkills(viewer: DemoViewer, communityId: string, skill: string): Promise<ApiRead<SkillSearchRow[]>>;
  /** GET /offers as the viewer. */
  listOffers(viewer: DemoViewer): Promise<ApiRead<OfferView[]>>;
  /** GET /offers/:id as the viewer. */
  getOffer(viewer: DemoViewer, offerId: string): Promise<ApiRead<OfferView>>;
}

export interface DemoVerificationReport {
  ready: boolean;
  checks: {
    mariaMemberOnly: boolean;
    richFloor: boolean;
    reciprocalTopology: boolean;
    unrelatedDenied: boolean;
    runway: boolean;
    ordinaryPrivacy: boolean;
    providerPrivacy: boolean;
    providerStory: boolean;
    skillsVisible: boolean;
    offerBoundary: boolean;
  };
  /** Ids of the skills/offer sub-reads that failed (empty when both checks hold). */
  failedReads: string[];
  forbiddenKeyPaths: string[];
  runwayDays: number;
  storyIds?: VerifiedStoryIds;
}

const PERSON = {
  maria: 'person.maria',
  sophia: 'person.shared-sophia',
  amina: 'person.bridge',
  noah: 'person.provider',
  optOut: 'person.ambient-09',
} as const;
const COMMUNITY = { pma: 'community.portland-mutual-aid', providers: 'community.providers' } as const;

/** Run a read; a thrown error (deps should not throw) fails closed as a transport error. */
async function safeRead<T>(read: () => Promise<ApiRead<T>>): Promise<ApiRead<T>> {
  try {
    return await read();
  } catch {
    return { status: 0, data: null };
  }
}

function ok<T>(read: ApiRead<T>): read is ApiRead<T> & { data: T } {
  return read.status === 200 && read.data !== null && read.data !== undefined;
}

/**
 * Critical Note 9, skills half. The opt-out is proven by SEARCH with Amina as the positive control
 * (the directory exposes no identities), and the Providers directory must equal the compiler's
 * expectation for Noah exactly.
 */
async function checkSkillsVisible(deps: DemoVerificationDeps, baseline: CompiledDemoBaseline): Promise<string[]> {
  const failed: string[] = [];
  const id = semanticUuid;

  const sophia = await safeRead(() => deps.getMemberSkills('maria', id(PERSON.sophia)));
  if (!(ok(sophia) && sophia.data.some(s => s.endorsement_count >= 1))) failed.push('skills.member-profile');

  const own = await safeRead(() => deps.getMemberSkills('maria', id(PERSON.maria)));
  if (!(ok(own) && own.data.some(s => s.skill_slug === 'cooking' && s.endorsement_count === 2))) {
    failed.push('skills.own-cooking-vouches');
  }

  const pma = await safeRead(() => deps.getSkillDirectory('maria', id(COMMUNITY.pma)));
  if (!(ok(pma) && pma.data.some(e => e.member_count > 0))) failed.push('skills.community-directory');

  const hidden = await safeRead(() => deps.getMemberSkills('provider', id(PERSON.optOut)));
  if (hidden.status !== 404) failed.push('skills.opt-out-profile-hidden');

  // X: a skill key both the opted-out member and Amina hold, so Amina is a positive control.
  const keysOf = (personKey: string) =>
    new Set(baseline.skills.filter(s => s.userId === id(personKey)).map(skillKey));
  const aminaKeys = keysOf(PERSON.amina);
  const sharedX = [...keysOf(PERSON.optOut)].filter(k => aminaKeys.has(k)).sort()[0];
  const search: ApiRead<SkillSearchRow[]> = sharedX
    ? await safeRead(() => deps.searchCommunitySkills('provider', id(COMMUNITY.providers), sharedX))
    : { status: 0, data: null };
  if (!(ok(search) && search.data.some(r => r.user_id === id(PERSON.amina)))) failed.push('skills.opt-out-search-control');
  if (!(ok(search) && !search.data.some(r => r.user_id === id(PERSON.optOut)))) failed.push('skills.opt-out-search-absent');

  const directory = await safeRead(() => deps.getSkillDirectory('provider', id(COMMUNITY.providers)));
  const expected = expectedSkillDirectory(baseline, COMMUNITY.providers, PERSON.noah);
  const actual = ok(directory) ? Object.fromEntries(directory.data.map(e => [e.skill_key, e.member_count])) : null;
  const expectedKeys = Object.keys(expected);
  const exact = actual !== null && Object.keys(actual).length === expectedKeys.length &&
    expectedKeys.every(k => actual[k] === expected[k]);
  if (!exact) failed.push('skills.directory-exact');
  return failed;
}

/**
 * Critical Note 9, offers half. A foreign offer is 404 (never 403) and absent from the list, and the
 * unrelated persona (a member of the offer's community) reading it as 200 proves the 404 is not vacuous.
 */
async function checkOfferBoundary(deps: DemoVerificationDeps): Promise<string[]> {
  const failed: string[] = [];
  const sophiaOffer = semanticUuid('offer.sophia-meal-prep');
  const priyaOffer = semanticUuid('offer.priya-tutoring');
  const ridesOffer = semanticUuid('offer.rides-airport');

  const list = await safeRead(() => deps.listOffers('maria'));
  const listed = ok(list) ? new Set(list.data.map(o => o.id)) : null;
  if (!(listed && listed.has(sophiaOffer) && listed.has(priyaOffer))) failed.push('offers.member-list');
  if (!(listed && !listed.has(ridesOffer))) failed.push('offers.foreign-list-absent');

  const foreign = await safeRead(() => deps.getOffer('maria', ridesOffer));
  if (foreign.status !== 404) failed.push('offers.foreign-read-404');

  const own = await safeRead(() => deps.getOffer('maria', sophiaOffer));
  if (own.status !== 200) failed.push('offers.member-read');

  const outsider = await safeRead(() => deps.getOffer('unrelated', ridesOffer));
  if (outsider.status !== 200) failed.push('offers.non-vacuous-read');
  return failed;
}

export async function verifyCuratedDemo(deps: DemoVerificationDeps): Promise<DemoVerificationReport> {
  const memberships = await deps.getMariaMemberships();
  const mariaMemberOnly = memberships.length > 0 && memberships.every(m => m.role === 'member');

  const floor = await deps.getOrdinaryFloor();
  const richFloor =
    floor.pathDegree <= STORY_HARD_FLOOR.maxPathDegree &&
    floor.sharedConnections >= STORY_HARD_FLOOR.minSharedPeople &&
    floor.mariaOneHop >= STORY_HARD_FLOOR.minOneHopPerSide &&
    floor.helperOneHop >= STORY_HARD_FLOOR.minOneHopPerSide;

  const reciprocalTopology = await deps.getReciprocalTopology();

  const unrelatedStatus = await deps.getUnrelatedContextStatus();
  const unrelatedDenied = unrelatedStatus === 403 || unrelatedStatus === 404;

  const runwayDays = await deps.getRunwayDays();
  const runway = runwayDays >= CURATED_DEMO_MANIFEST.tuning.minimumStoryRunwayDays;

  const ordinaryContext = await deps.getOrdinaryContext();
  const providerContext = await deps.getProviderContext();
  const forbiddenKeyPaths = [
    ...findForbiddenKeys(ordinaryContext, '$.ordinary'),
    ...findForbiddenKeys(providerContext, '$.provider'),
  ];
  const ordinaryPrivacy = findForbiddenKeys(ordinaryContext).length === 0;
  const providerPrivacy = findForbiddenKeys(providerContext).length === 0;
  const providerStory = await deps.getProviderStoryValid();
  const skillFailures = await checkSkillsVisible(deps, compileManifest(CURATED_DEMO_MANIFEST, new Date()));
  const offerFailures = await checkOfferBoundary(deps);

  // NOTE: the demo-session read-only (403 write) check is NOT here — it requires an actual
  // /auth/demo-session token, which only exists after the demo is (re-)enabled. It is asserted by
  // the demo-session verification step (rotateStories.verifyDemoSession), not this data readback,
  // which authenticates as ordinary members and can run while the demo is temporarily disabled.
  const checks = {
    mariaMemberOnly, richFloor, reciprocalTopology, unrelatedDenied,
    runway, ordinaryPrivacy, providerPrivacy, providerStory,
    skillsVisible: skillFailures.length === 0,
    offerBoundary: offerFailures.length === 0,
  };
  const ready = Object.values(checks).every(Boolean);

  const report: DemoVerificationReport = {
    ready, checks, failedReads: [...skillFailures, ...offerFailures], forbiddenKeyPaths, runwayDays,
  };
  if (ready) {
    report.storyIds = await deps.getStoryIds();
  }
  return report;
}
