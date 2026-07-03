/**
 * Sprint 117 — `verify:demo` CLI (read-only demo health).
 *
 * Authenticates as Maria (and an unrelated member for the denial check) and runs the curated-demo
 * verifier through ordinary APIs. It changes no database rows, env, processes, or files. Prints a
 * machine-readable report; exits non-zero when the demo is not ready.
 *
 * The API→deps mapping here is exercised against the deployed demo in Task 14; locally without a
 * reachable API it prints a clear unavailable result. Every read fails closed: an error on any
 * check marks that check false rather than throwing the whole verification away.
 *
 *   npm --workspace @karmyq/simulation-service run verify:demo
 */

import { ApiClient } from '../api-client';
import { floorFromRelationshipContext } from '../scenarios/mariaRelationshipStory';
import { demoSessionMatchesPublished, reciprocalContextsMatch } from '../fixtures/curatedDemo/demoVerificationLogic';
import {
  verifyCuratedDemo,
  type DemoVerificationDeps,
  type OrdinaryFloor,
} from '../fixtures/curatedDemo/verifier';

export interface VerifyEnv {
  baseUrl: string;
  mariaEmail: string;
  helperEmail: string;
  providerEmail: string;
  unrelatedEmail: string;
  password: string;
  storyIds: {
    ordinaryRequestId: string;
    ordinaryMatchId: string;
    providerRequestId: string;
    providerOfferId: string;
  };
}

/**
 * Read connection/persona env. Story IDs are OPTIONAL here: `verify:demo` requires them (and calls
 * {@link assertStoryIds}), but the reset/rotate flows create fresh stories and override the IDs, so
 * they must not force those flows to fail when the previous IDs are absent.
 */
export function readEnv(): VerifyEnv {
  const required = {
    baseUrl: process.env.API_BASE_URL,
    mariaEmail: process.env.DEMO_MARIA_EMAIL ?? process.env.DEMO_PERSONA_EMAIL,
    helperEmail: process.env.DEMO_HELPER_EMAIL,
    providerEmail: process.env.DEMO_PROVIDER_EMAIL,
    unrelatedEmail: process.env.DEMO_UNRELATED_EMAIL,
    password: process.env.DEMO_PERSONA_PASSWORD,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`verify:demo unavailable — missing env: ${missing.join(', ')}`);
  }
  return {
    baseUrl: required.baseUrl!,
    mariaEmail: required.mariaEmail!,
    helperEmail: required.helperEmail!,
    providerEmail: required.providerEmail!,
    unrelatedEmail: required.unrelatedEmail!,
    password: required.password!,
    storyIds: {
      ordinaryRequestId: process.env.DEMO_ORDINARY_REQUEST_ID ?? '',
      ordinaryMatchId: process.env.DEMO_ORDINARY_MATCH_ID ?? '',
      providerRequestId: process.env.DEMO_PROVIDER_REQUEST_ID ?? '',
      providerOfferId: process.env.DEMO_PROVIDER_OFFER_ID ?? '',
    },
  };
}

/** verify:demo needs configured story IDs to read back; the reset/rotate flows create their own. */
export function assertStoryIds(env: VerifyEnv): void {
  const missing = Object.entries(env.storyIds).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`verify:demo unavailable — missing story IDs: ${missing.join(', ')}`);
  }
}

const NO_PATH_FLOOR: OrdinaryFloor = { pathDegree: Number.POSITIVE_INFINITY, sharedConnections: 0, mariaOneHop: 0, helperOneHop: 0 };

function statusOf(error: unknown): number {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === 'number' ? status : 0;
}

/**
 * Verify the PUBLIC demo session end-to-end: POST /auth/demo-session must resolve a coherent
 * session whose `demo.stories` match the expected IDs, and that session token must be READ-ONLY
 * (a write attempt is rejected 403). Requires the demo to be enabled. Fails closed on any error.
 */
export async function verifyDemoSessionReadOnly(baseUrl: string, expected: VerifyEnv['storyIds']): Promise<boolean> {
  try {
    const session = await new ApiClient(baseUrl).createDemoSession();
    if (!demoSessionMatchesPublished(session, expected)) return false;
    const token = (session as { token?: string }).token;
    if (!token) return false;
    const probe = new ApiClient(baseUrl);
    probe.setToken(token);
    try {
      await probe.createRequest({ title: 'demo-write-probe', description: 'demo-write-probe', category: 'errand' });
      return false; // a demo-session write MUST NOT succeed
    } catch (error) {
      return statusOf(error) === 403;
    }
  } catch {
    return false;
  }
}

export async function buildDeps(env: VerifyEnv): Promise<DemoVerificationDeps> {
  const maria = new ApiClient(env.baseUrl);
  const mariaAuth = await maria.login(env.mariaEmail, env.password);
  const mariaId = mariaAuth.user?.id as string;

  // The helper reads the SAME ordinary match from their own side, so reciprocity is verified from
  // both orientations rather than by re-inspecting Maria's single response.
  const helper = new ApiClient(env.baseUrl);
  await helper.login(env.helperEmail, env.password);

  const unrelated = new ApiClient(env.baseUrl);
  await unrelated.login(env.unrelatedEmail, env.password);

  const context = await maria
    .getMatchRelationshipContext(env.storyIds.ordinaryRequestId, env.storyIds.ordinaryMatchId)
    .catch(() => null);
  const helperContext = await helper
    .getMatchRelationshipContext(env.storyIds.ordinaryRequestId, env.storyIds.ordinaryMatchId)
    .catch(() => null);
  // The requester (Maria) reads the PROVIDER REQUEST DETAIL for provider verification. The
  // /requests/:id/offers list endpoint is admin-only (403 for a plain member), so provider privacy
  // and the provider-story structural check use the request detail the requester can actually see.
  const providerRequest = await maria.getRequest(env.storyIds.providerRequestId).catch(() => null);
  // The ordinary request detail (for runway from created_at — the API does not expose expires_at).
  const ordinaryRequest = await maria.getRequest(env.storyIds.ordinaryRequestId).catch(() => null);
  const requestTtlDays = Number(process.env.DEMO_REQUEST_TTL_DAYS ?? '60');

  return {
    async getMariaMemberships() {
      const communities = await maria.getCommunities(mariaId).catch(() => []);
      return (Array.isArray(communities) ? communities : []).map((c: { id?: string; community_id?: string; role?: string }) => ({
        communityId: c.id ?? c.community_id ?? 'unknown',
        role: c.role ?? 'member',
      }));
    },
    async getOrdinaryFloor() {
      if (!context) return NO_PATH_FLOOR;
      const overlap = floorFromRelationshipContext(context);
      return {
        pathDegree: overlap.pathDegree ?? Number.POSITIVE_INFINITY,
        sharedConnections: overlap.sharedConnections,
        mariaOneHop: overlap.mariaOneHop,
        helperOneHop: overlap.helperOneHop,
      };
    },
    async getReciprocalTopology() {
      // Canonicalized reversed-orientation match of the node/path sets (see reciprocalContextsMatch).
      // A missing context on either side fails closed.
      if (!context || !helperContext) return false;
      return reciprocalContextsMatch(context, helperContext);
    },
    async getUnrelatedContextStatus() {
      try {
        await unrelated.getMatchRelationshipContext(env.storyIds.ordinaryRequestId, env.storyIds.ordinaryMatchId);
        return 200;
      } catch (error) {
        // Return the ACTUAL HTTP status. A transport error (status 0) is NOT a valid denial and
        // must fail the readiness check rather than masquerade as a 403.
        return statusOf(error);
      }
    },
    async getRunwayDays() {
      // The request detail does not expose expires_at, so derive runway from created_at and the
      // demo request TTL. A missing detail or an already-expired request has no runway.
      if (!ordinaryRequest?.created_at || ordinaryRequest.expired) return 0;
      const ageDays = Math.floor((Date.now() - new Date(ordinaryRequest.created_at).getTime()) / 86_400_000);
      return requestTtlDays - ageDays;
    },
    async getOrdinaryContext() {
      return (context ?? {}) as Record<string, unknown>;
    },
    async getProviderContext() {
      // Scan the provider REQUEST DETAIL the requester actually sees (privacy-clean) for forbidden
      // keys. Fail closed with a sentinel if it could not be read.
      if (!providerRequest) {
        return { trust_score: '__provider_request_unavailable__' } as Record<string, unknown>;
      }
      return providerRequest as Record<string, unknown>;
    },
    async getProviderStoryValid() {
      // The offers list endpoint is admin-only, so the requester-side structural check is: the
      // provider request exists, is a 'service' request, and a provider offer id is configured (the
      // offer's creation is already proven by createLiveStories returning its server-generated id).
      return Boolean(providerRequest) && providerRequest.request_type === 'service' && Boolean(env.storyIds.providerOfferId);
    },
    async getStoryIds() {
      return env.storyIds;
    },
  };
}

async function main(): Promise<void> {
  let env: VerifyEnv;
  try {
    env = readEnv();
    assertStoryIds(env);
  } catch (error) {
    console.log(JSON.stringify({ ready: false, unavailable: true, reason: error instanceof Error ? error.message : String(error) }, null, 2));
    return;
  }

  const deps = await buildDeps(env);
  const report = await verifyCuratedDemo(deps);
  // Also verify the public demo session is coherent and read-only (needs the demo enabled).
  const demoSessionReadOnly = await verifyDemoSessionReadOnly(env.baseUrl, env.storyIds);
  const overallReady = report.ready && demoSessionReadOnly;
  console.log(JSON.stringify({ ...report, demoSessionReadOnly, ready: overallReady }, null, 2));
  if (!overallReady) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(`[verify:demo] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
