/**
 * Sprint 117 — `reset:demo` CLI.
 *
 * Dry-run by default: prints the classified table plan, compiled fixture counts, reset anchor,
 * and demo fingerprint without touching the database. A destructive apply (`--apply`) runs the
 * full guarded reset through the coordinator, then — on success — creates and verifies the live
 * Maria stories, optionally publishes the demo config (`--publish-config`), re-enables the demo,
 * and resumes ambient mutation. Unknown flags fail closed.
 *
 *   npm --workspace @karmyq/simulation-service run reset:demo
 *   npm --workspace @karmyq/simulation-service run reset:demo -- --apply --publish-config
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import {
  createResetDependencies,
  executeReset,
  type ResetDependencies,
  type ResetOptions,
} from '../fixtures/curatedDemo/resetCoordinator';
import { rotateStories } from '../fixtures/curatedDemo/storyLifecycle';
import { buildRotationDeps } from './rotateMariaStories';

interface CliArgs {
  apply: boolean;
  anchor?: Date;
  backupDir: string;
  publishConfig: boolean;
}

const ALLOWED_FLAGS = new Set(['--apply', '--publish-config']);
const ALLOWED_VALUE_FLAGS = new Set(['--anchor', '--backup-dir']);

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { apply: false, backupDir: process.env.DEMO_BACKUP_DIR ?? '/tmp/karmyq-demo-backups', publishConfig: false };
  for (const token of argv) {
    const [flag, rawValue] = token.includes('=') ? token.split(/=(.*)/s) : [token, undefined];
    if (ALLOWED_FLAGS.has(flag)) {
      if (flag === '--apply') args.apply = true;
      if (flag === '--publish-config') args.publishConfig = true;
    } else if (ALLOWED_VALUE_FLAGS.has(flag)) {
      if (rawValue === undefined) throw new Error(`Flag ${flag} requires a value (use ${flag}=VALUE)`);
      if (flag === '--anchor') {
        const parsed = new Date(rawValue);
        if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --anchor date: ${rawValue}`);
        args.anchor = parsed;
      }
      if (flag === '--backup-dir') args.backupDir = rawValue;
    } else {
      throw new Error(`Unknown flag: ${flag}`);
    }
  }
  return args;
}

const execFileAsync = promisify(execFile);

async function runProcess(command: string, commandArgs: string[], options?: { env?: NodeJS.ProcessEnv }): Promise<void> {
  // Merge over (never replace) the ambient environment so PATH etc. survive.
  await execFileAsync(command, commandArgs, options?.env ? { env: { ...process.env, ...options.env } } : undefined);
}

// On the demo host the ambient simulator runs under PM2 (`karmyq-simulation`) while the cleanup
// worker is a Docker container (`karmyq-cleanup-service`) — two different process managers. Both are
// overridable via env for other environments.
const SIM_PM2_NAME = process.env.DEMO_SIM_PM2_NAME ?? 'karmyq-simulation';
const CLEANUP_CONTAINER = process.env.DEMO_CLEANUP_CONTAINER ?? 'karmyq-cleanup-service';

async function setMutation(running: boolean): Promise<void> {
  await runProcess('pm2', [running ? 'start' : 'stop', SIM_PM2_NAME]);
  await runProcess('docker', [running ? 'start' : 'stop', CLEANUP_CONTAINER]);
}

async function runConfiguredCommand(raw: string | undefined): Promise<boolean> {
  if (!raw || raw.trim() === '') return false;
  const [command, ...commandArgs] = raw.trim().split(/\s+/);
  await runProcess(command, commandArgs);
  return true;
}

type OperatorHooks = Pick<ResetDependencies, 'pauseMutation' | 'resumeMutation' | 'disableDemo' | 'enableDemo'>;

/** Real runtime hooks so the coordinator's safety gates are not no-ops. */
function operatorHooks(): OperatorHooks {
  return {
    pauseMutation: () => setMutation(false),
    resumeMutation: () => setMutation(true),
    async disableDemo() {
      // Disabling public demo traffic during the wipe is a REQUIRED gate — fail closed if the
      // operator has not wired the environment-specific command rather than proceeding uncovered.
      const ran = await runConfiguredCommand(process.env.DEMO_DISABLE_CMD);
      if (!ran) {
        throw new Error('Refusing reset: DEMO_DISABLE_CMD is not set — cannot gate public demo traffic during the wipe.');
      }
    },
    async enableDemo() {
      const ran = await runConfiguredCommand(process.env.DEMO_ENABLE_CMD);
      if (!ran) console.warn('[reset:demo] no DEMO_ENABLE_CMD set — re-enable demo traffic via your maintenance window.');
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — refusing to run the demo reset without a target database.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '') || 'unknown';
    const deps = createResetDependencies({
      pool,
      databaseName,
      databaseUrl,
      backupDir: args.backupDir,
      runProcess,
      ...operatorHooks(),
    });
    const options: ResetOptions = { apply: args.apply, anchor: args.anchor, backupDir: args.backupDir, publishConfig: args.publishConfig };
    const result = await executeReset(options, deps);

    console.log(JSON.stringify({
      mode: result.mode,
      anchor: result.plan.anchor.toISOString(),
      fingerprint: result.plan.fingerprint,
      counts: result.plan.counts,
      backupPath: result.backupPath ?? null,
    }, null, 2));

    console.log(`\n[reset:demo] mode=${result.mode}`);
    console.log(`  fixtures: ${result.plan.counts.people} people, ${result.plan.counts.communities} communities, ${result.plan.counts.requests} requests`);
    console.log(`  tables:   ${result.plan.counts.tablesReset} reset, ${result.plan.counts.tablesReseed} reseed, ${result.plan.counts.tablesPreserve} preserve`);

    if (result.mode === 'dry-run') {
      console.log('  (dry-run — no database, backup, lock, or transaction was performed. Add --apply to execute.)');
      return;
    }

    console.log(`  backup:   ${result.backupPath}`);
    // DB baseline is applied; now create + verify live stories through ordinary APIs. Rotation
    // publishes config only when --publish-config is set, and throws (leaving the demo disabled)
    // if the replacement stories do not verify.
    const rotation = await rotateStories(buildRotationDeps(args.publishConfig));
    await deps.enableDemo();
    await deps.resumeMutation();
    console.log(`  stories:  ${JSON.stringify(rotation.storyIds)}`);
    console.log(`  status:   applied, verified, ${args.publishConfig ? 'config published, ' : ''}demo re-enabled, mutation resumed.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[reset:demo] refused: ${message}`);
  process.exitCode = 1;
});
