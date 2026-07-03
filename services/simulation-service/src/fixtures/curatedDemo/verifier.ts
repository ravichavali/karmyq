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
  getDemoWriteStatus(): Promise<number>;
  getStoryIds(): Promise<VerifiedStoryIds>;
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
    demoWriteRejected: boolean;
  };
  forbiddenKeyPaths: string[];
  runwayDays: number;
  storyIds?: VerifiedStoryIds;
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

  const demoWriteStatus = await deps.getDemoWriteStatus();
  const demoWriteRejected = demoWriteStatus === 403;

  const checks = {
    mariaMemberOnly, richFloor, reciprocalTopology, unrelatedDenied,
    runway, ordinaryPrivacy, providerPrivacy, demoWriteRejected,
  };
  const ready = Object.values(checks).every(Boolean);

  const report: DemoVerificationReport = { ready, checks, forbiddenKeyPaths, runwayDays };
  if (ready) {
    report.storyIds = await deps.getStoryIds();
  }
  return report;
}
