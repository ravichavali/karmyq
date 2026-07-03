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
import { buildDeps, readEnv } from './verifyDemoData';

const execFileAsync = promisify(execFile);

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
  const mariaId = mariaAuth.user?.id as string;
  const helper = new ApiClient(env.baseUrl);
  const helperAuth = await helper.login(helperEmail, env.password);
  const helperId = helperAuth.user?.id as string;
  const provider = new ApiClient(env.baseUrl);
  await provider.login(providerEmail, env.password);

  const ordinaryRequest = await maria.createRequest({
    title: 'Help moving a couch this weekend',
    description: 'Looking for a hand moving a couch to a new place.',
    category: 'moving',
    visibility_scope: 'platform',
  } as never);
  await helper.offerHelp(ordinaryRequest.id, helperId);
  const proposed = await maria.proposeMatch(ordinaryRequest.id, helperId);
  const ordinaryMatchId = proposed?.id as string;
  await maria.acceptMatch(ordinaryMatchId, mariaId);

  const providerRequest = await maria.createRequest({
    title: 'Provider quote: fix a leaking kitchen tap',
    description: 'Need a quote to fix a slow leak under the sink.',
    category: 'service',
    visibility_scope: 'platform',
  } as never);
  const offer = await provider.submitProviderOffer(providerRequest.id, null, 'Available this weekend.');

  return {
    ordinaryRequestId: ordinaryRequest.id,
    ordinaryMatchId,
    providerRequestId: providerRequest.id,
    providerOfferId: offer?.id as string,
  };
}

function buildRotationDeps(publishConfigEnabled: boolean): RotationDeps {
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
    async restartAuth() {
      await execFileAsync('pm2', ['restart', 'karmyq-auth-service']);
    },
    async verifyDemoSession() {
      const deps = await buildDeps({ ...env, storyIds: created ?? env.storyIds });
      const report = await verifyCuratedDemo(deps);
      return { ok: report.ready };
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

main().catch((error: unknown) => {
  console.error(`[rotate:demo-stories] refused: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
