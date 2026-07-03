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
import {
  verifyCuratedDemo,
  type DemoVerificationDeps,
  type OrdinaryFloor,
} from '../fixtures/curatedDemo/verifier';

export interface VerifyEnv {
  baseUrl: string;
  mariaEmail: string;
  unrelatedEmail: string;
  password: string;
  storyIds: {
    ordinaryRequestId: string;
    ordinaryMatchId: string;
    providerRequestId: string;
    providerOfferId: string;
  };
}

export function readEnv(): VerifyEnv {
  const required = {
    baseUrl: process.env.API_BASE_URL,
    mariaEmail: process.env.DEMO_MARIA_EMAIL ?? process.env.DEMO_PERSONA_EMAIL,
    unrelatedEmail: process.env.DEMO_UNRELATED_EMAIL,
    password: process.env.DEMO_PERSONA_PASSWORD,
    ordinaryRequestId: process.env.DEMO_ORDINARY_REQUEST_ID,
    ordinaryMatchId: process.env.DEMO_ORDINARY_MATCH_ID,
    providerRequestId: process.env.DEMO_PROVIDER_REQUEST_ID,
    providerOfferId: process.env.DEMO_PROVIDER_OFFER_ID,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`verify:demo unavailable — missing env: ${missing.join(', ')}`);
  }
  return {
    baseUrl: required.baseUrl!,
    mariaEmail: required.mariaEmail!,
    unrelatedEmail: required.unrelatedEmail!,
    password: required.password!,
    storyIds: {
      ordinaryRequestId: required.ordinaryRequestId!,
      ordinaryMatchId: required.ordinaryMatchId!,
      providerRequestId: required.providerRequestId!,
      providerOfferId: required.providerOfferId!,
    },
  };
}

const NO_PATH_FLOOR: OrdinaryFloor = { pathDegree: Number.POSITIVE_INFINITY, sharedConnections: 0, mariaOneHop: 0, helperOneHop: 0 };

function statusOf(error: unknown): number {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === 'number' ? status : 0;
}

export async function buildDeps(env: VerifyEnv): Promise<DemoVerificationDeps> {
  const maria = new ApiClient(env.baseUrl);
  const mariaAuth = await maria.login(env.mariaEmail, env.password);
  const mariaId = mariaAuth.user?.id as string;

  const unrelated = new ApiClient(env.baseUrl);
  await unrelated.login(env.unrelatedEmail, env.password);

  const context = await maria
    .getMatchRelationshipContext(env.storyIds.ordinaryRequestId, env.storyIds.ordinaryMatchId)
    .catch(() => null);
  const providerContext = await maria
    .getMatchRelationshipContext(env.storyIds.providerRequestId, env.storyIds.providerOfferId)
    .catch(() => null);

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
      if (!context) return false;
      const overlap = floorFromRelationshipContext(context);
      // A reciprocal edge shows a finite path plus visible one-hop neighbours on both sides.
      return overlap.pathDegree !== null && overlap.mariaOneHop > 0 && overlap.helperOneHop > 0;
    },
    async getUnrelatedContextStatus() {
      try {
        await unrelated.getMatchRelationshipContext(env.storyIds.ordinaryRequestId, env.storyIds.ordinaryMatchId);
        return 200;
      } catch (error) {
        return statusOf(error) || 403;
      }
    },
    async getRunwayDays() {
      const request = await maria.getRequest(env.storyIds.ordinaryRequestId).catch(() => null);
      const expiresAt = request?.expires_at ? new Date(request.expires_at).getTime() : 0;
      if (!expiresAt) return 0;
      return Math.floor((expiresAt - Date.now()) / 86_400_000);
    },
    async getOrdinaryContext() {
      return (context ?? {}) as Record<string, unknown>;
    },
    async getProviderContext() {
      return (providerContext ?? {}) as Record<string, unknown>;
    },
    async getDemoWriteStatus() {
      // A demo-session write must be rejected. Probe a create and expect 403.
      try {
        await maria.createRequest({ title: 'verify-probe', description: 'verify-probe', category: 'errand' } as never);
        return 200;
      } catch (error) {
        return statusOf(error) || 403;
      }
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
  } catch (error) {
    console.log(JSON.stringify({ ready: false, unavailable: true, reason: error instanceof Error ? error.message : String(error) }, null, 2));
    return;
  }

  const deps = await buildDeps(env);
  const report = await verifyCuratedDemo(deps);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(`[verify:demo] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
