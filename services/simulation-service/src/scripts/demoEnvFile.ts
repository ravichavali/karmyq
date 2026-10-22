/**
 * Sprint 134 PR D — the demo env file that `verify:demo` reads and `rotate:demo-stories` writes.
 *
 * The path is `DEMO_ENV_FILE ?? '.env.demo'`, and a relative path resolves against npm's `INIT_CWD`
 * (where npm was invoked), not `cwd`: under `npm --workspace @karmyq/simulation-service run …`, `cwd`
 * is the workspace directory and would silently miss the repo-root `.env.demo`. Both CLIs resolve it
 * here so they always read and write the same file.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';

export function resolveDemoEnvPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): { path: string; explicit: boolean } {
  // `||`, not `??`: an exported-but-empty variable means unset, not "the base directory itself".
  const explicit = Boolean(env.DEMO_ENV_FILE);
  return { path: resolve(env.INIT_CWD || cwd, env.DEMO_ENV_FILE || '.env.demo'), explicit };
}

/**
 * Apply the demo env file to `env` without overriding: variables already set win. A missing default
 * file is not an error (the caller falls back to the environment); a missing explicit
 * `DEMO_ENV_FILE` is. Returns the path and the keys the file holds, never their values.
 */
export function loadDemoEnvFile(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): { loadedFrom: string | null; lookedFor: string; keys: string[] } {
  const { path, explicit } = resolveDemoEnvPath(env, cwd);
  if (!existsSync(path)) {
    if (explicit) throw new Error(`verify:demo unavailable — DEMO_ENV_FILE not found: ${path}`);
    return { loadedFrom: null, lookedFor: path, keys: [] };
  }
  const result = dotenv.config({ path, override: false, quiet: true, processEnv: env });
  if (result.error) throw new Error(`verify:demo unavailable — cannot read ${path}: ${result.error.message}`);
  return { loadedFrom: path, lookedFor: path, keys: Object.keys(result.parsed ?? {}) };
}
