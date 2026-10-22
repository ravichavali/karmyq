/**
 * Sprint 134 PR D — the demo env file that `verify:demo` reads and `rotate:demo-stories` writes.
 *
 * The path is `DEMO_ENV_FILE`, else `.env.demo`; an unset or empty value means the default. A relative
 * path resolves against the repo root, as `scripts/demo/*.sh` resolve it, never against `cwd` (under
 * `npm --workspace …`, `cwd` is this workspace) or `INIT_CWD` (wherever npm happened to be invoked).
 * Both CLIs resolve it here so they always read and write the same file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { DEMO_CONFIG_KEYS } from '../fixtures/curatedDemo/configPublisher';

/** This file is in services/simulation-service/{src,dist}/scripts. */
const REPO_ROOT = resolve(__dirname, '../../../..');

export function resolveDemoEnvPath(
  env: NodeJS.ProcessEnv = process.env,
  root: string = REPO_ROOT,
): { path: string; explicit: boolean } {
  const explicit = Boolean(env.DEMO_ENV_FILE);
  return { path: resolve(root, env.DEMO_ENV_FILE || '.env.demo'), explicit };
}

/**
 * Apply the published story keys (`DEMO_CONFIG_KEYS`) from the demo env file to `env`. The rest of
 * the file is compose config and secrets, and is never applied. Variables already set win; those
 * whose value differs from the file are named in `shadowed`. A missing default file is not an error
 * (the caller falls back to the environment); a missing explicit `DEMO_ENV_FILE` is. Returns paths
 * and key names, never values.
 */
export function loadDemoEnvFile(
  env: NodeJS.ProcessEnv = process.env,
  root: string = REPO_ROOT,
): { loadedFrom: string | null; lookedFor: string; keys: string[]; shadowed: string[] } {
  const { path, explicit } = resolveDemoEnvPath(env, root);
  if (!existsSync(path)) {
    if (explicit) throw new Error(`verify:demo unavailable — DEMO_ENV_FILE not found: ${path}`);
    return { loadedFrom: null, lookedFor: path, keys: [], shadowed: [] };
  }
  let parsed: Record<string, string>;
  try {
    parsed = parse(readFileSync(path));
  } catch (error) {
    throw new Error(`verify:demo unavailable — cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const keys = DEMO_CONFIG_KEYS.filter(key => parsed[key] !== undefined);
  const shadowed: string[] = [];
  for (const key of keys) {
    if (env[key] === undefined) env[key] = parsed[key];
    else if (env[key] !== parsed[key]) shadowed.push(key);
  }
  return { loadedFrom: path, lookedFor: path, keys, shadowed };
}
