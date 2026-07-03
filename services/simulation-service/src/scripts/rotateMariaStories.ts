/**
 * Sprint 117 — `rotate:demo-stories` CLI (explicit finite-story replacement).
 *
 * Dry-run by default: reports the currently-configured stories and the rotation steps without
 * changing anything. With `--apply`, it creates fresh live stories, verifies them, publishes the
 * new config, restarts auth, re-verifies the demo session, and only then retires the old stories
 * (see `rotateStories`). It NEVER triggers a full reset. Story creation and the shell/API steps are
 * exercised against the deployed demo in Task 14; this CLI orchestrates the tested primitives.
 *
 *   npm --workspace @karmyq/simulation-service run rotate:demo-stories
 *   npm --workspace @karmyq/simulation-service run rotate:demo-stories -- --apply --publish-config
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, copyFile, writeFile, rename, chmod } from 'node:fs/promises';
import { ApiClient } from '../api-client';
import {
  publishDemoConfig,
  rotateStories,
  type ConfigFsDeps,
  type RotationDeps,
} from '../fixtures/curatedDemo/storyLifecycle';
import { verifyCuratedDemo, type VerifiedStoryIds } from '../fixtures/curatedDemo/verifier';
import { buildDeps, readEnv, verifyDemoSessionReadOnly } from './verifyDemoData';

const execFileAsync = promisify(execFile);

/** Run an operator-provided, host-specific command; fail closed if it is not configured. */
async function runRequiredCommand(name: string, raw: string | undefined): Promise<void> {
  if (!raw || raw.trim() === '') {
    throw new Error(`Refusing rotation: ${name} is not set — this host-specific step must be wired.`);
  }
  const [command, ...args] = raw.trim().split(/\s+/);
  await execFileAsync(command, args);
}

const nodeFsDeps: ConfigFsDeps = {
  readFile: path => readFile(path, 'utf8'),
  copyFile: (src, dst) => copyFile(src, dst),
  writeFile: (path, content) => writeFile(path, content, { mode: 0o600 }),
  rename: (src, dst) => rename(src, dst),
  chmod: (path, mode) => chmod(path, mode),
};

/** Create fresh live Maria stories through ordinary APIs; returns server-generated IDs. */
async function createLiveStories(env: ReturnType<typeof readEnv>): Promise<VerifiedStoryIds> {
  const helperEmail = process.env.DEMO_HELPER_EMAIL;
  const providerEmail = process.env.DEMO_PROVIDER_EMAIL;
  if (!helperEmail || !providerEmail) {
    throw new Error('Refusing rotation: DEMO_HELPER_EMAIL and DEMO_PROVIDER_EMAIL are required to create fresh stories');
  }

  const maria = new ApiClient(env.baseUrl);
  const mariaAuth = await maria.login(env.mariaEmail, env.password);
  const helper = new ApiClient(env.baseUrl);
  const helperAuth = await helper.login(helperEmail, env.password);
  const helperId = helperAuth.user?.id as string;
  const provider = new ApiClient(env.baseUrl);
  await provider.login(providerEmail, env.password);

  // A request MUST be posted to a community (request-service returns 400 otherwise). Use a community
  // Maria AND the helper both belong to, so the match + relationship floor resolve. Maria posts the
  // provider request to the same community but platform-visible, so the provider (in a different
  // community) can still see and offer on it.
  const mariaCommunities: Array<{ id?: string }> = mariaAuth.user?.communities ?? [];
  const helperCommunities: Array<{ id?: string }> = helperAuth.user?.communities ?? [];
  const sharedCommunityId = mariaCommunities.find(mc => helperCommunities.some(hc => hc.id === mc.id))?.id;
  if (!sharedCommunityId) {
    throw new Error('Refusing rotation: no community shared by Maria and the helper for the ordinary story');
  }

  const ordinaryRequest = await maria.createRequest({
    community_id: sharedCommunityId,
    title: 'Help moving a couch this weekend',
    description: 'Looking for a hand moving a couch to a new place.',
    request_type: 'generic',
    visibility_scope: 'platform',
  });
  // The helper offering help IS the match creation (POST /matches, proposed). Leave it PROPOSED —
  // the guided story is a live, pending decision Maria has not yet accepted. Do NOT accept it here
  // (that would close the story), and Maria (a plain member) must not call admin propose-match.
  const proposedMatch = await helper.offerHelp(ordinaryRequest.id, helperId);
  const ordinaryMatchId = proposedMatch?.id as string;

  const providerRequest = await maria.createRequest({
    community_id: sharedCommunityId,
    title: 'Provider quote: fix a leaking kitchen tap',
    description: 'Need a quote to fix a slow leak under the sink.',
    request_type: 'service',
    visibility_scope: 'platform',
    payload: { service_category: 'plumbing' },
  });
  const offer = await provider.submitProviderOffer(providerRequest.id, null, 'Available this weekend.');

  return {
    ordinaryRequestId: ordinaryRequest.id,
    ordinaryMatchId,
    providerRequestId: providerRequest.id,
    providerOfferId: offer?.id as string,
  };
}

export function buildRotationDeps(publishConfigEnabled: boolean): RotationDeps {
  const env = readEnv();
  let created: VerifiedStoryIds | undefined;

  return {
    async createStories() {
      created = await createLiveStories(env);
      return created;
    },
    async verify() {
      const deps = await buildDeps({ ...env, storyIds: created ?? env.storyIds });
      const report = await verifyCuratedDemo(deps);
      return { ready: report.ready, storyIds: report.storyIds };
    },
    async publishConfig() {
      if (!publishConfigEnabled || !created) return;
      const envPath = process.env.DEMO_ENV_FILE ?? '.env.demo';
      await publishDemoConfig(envPath, {
        DEMO_PERSONA_EMAIL: env.mariaEmail,
        DEMO_ORDINARY_REQUEST_ID: created.ordinaryRequestId,
        DEMO_ORDINARY_MATCH_ID: created.ordinaryMatchId,
        DEMO_PROVIDER_REQUEST_ID: created.providerRequestId,
        DEMO_PROVIDER_OFFER_ID: created.providerOfferId,
      }, nodeFsDeps);
    },
    async enableDemo() {
      // Re-enable public demo traffic (e.g. set DEMO_SESSION_ENABLED=true) so the demo-session
      // re-check can pass. Host-specific, so it MUST be wired; fail closed if not.
      await runRequiredCommand('DEMO_ENABLE_CMD', process.env.DEMO_ENABLE_CMD);
    },
    async restartAuth() {
      // auth-service is a Docker container on the demo host (NOT pm2), and it must be RECREATED to
      // re-read the republished .env.demo (new story IDs + enabled flag). The exact command is
      // host-specific (compose file paths), so it is operator-provided and fail-closed.
      await runRequiredCommand('DEMO_RESTART_AUTH_CMD', process.env.DEMO_RESTART_AUTH_CMD);
    },
    async verifyDemoSession() {
      // The published /auth/demo-session must resolve the new stories AND be read-only (write→403).
      return { ok: await verifyDemoSessionReadOnly(env.baseUrl, created ?? env.storyIds) };
    },
    async retireOld() {
      // Old stories expire naturally via the request TTL; nothing destructive is required here.
    },
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const publishConfigEnabled = argv.includes('--publish-config');
  const unknown = argv.filter(a => a !== '--apply' && a !== '--publish-config');
  if (unknown.length > 0) throw new Error(`Unknown flag(s): ${unknown.join(', ')}`);

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      steps: ['create', 'verify', 'backup-env', 'replace-env', 'restart-auth', 'verify-demo-session', 'retire-old'],
      note: 'Re-run with --apply --publish-config to rotate the finite live stories. This never triggers a full reset.',
    }, null, 2));
    return;
  }

  const result = await rotateStories(buildRotationDeps(publishConfigEnabled));
  console.log(JSON.stringify({ mode: 'applied', storyIds: result.storyIds }, null, 2));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(`[rotate:demo-stories] refused: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
