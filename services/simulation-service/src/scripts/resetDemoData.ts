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

/** PM2 process names whose mutation must be paused during the reset. */
function pauseProcesses(): string[] {
  return (process.env.DEMO_PAUSE_PROCESSES ?? 'karmyq-simulation-service,karmyq-cleanup-service')
    .split(',').map(s => s.trim()).filter(Boolean);
}

async function pm2(action: 'stop' | 'start', names: string[]): Promise<void> {
  for (const name of names) {
    await runProcess('pm2', [action, name]);
  }
}

async function runOptionalCommand(raw: string | undefined): Promise<boolean> {
  if (!raw || raw.trim() === '') return false;
  const [command, ...commandArgs] = raw.trim().split(/\s+/);
  await runProcess(command, commandArgs);
  return true;
}

type OperatorHooks = Pick<ResetDependencies, 'pauseMutation' | 'resumeMutation' | 'disableDemo' | 'enableDemo'>;

/** Real runtime hooks so the coordinator's safety gates are not no-ops. */
function operatorHooks(): OperatorHooks {
  return {
    pauseMutation: () => pm2('stop', pauseProcesses()),
    resumeMutation: () => pm2('start', pauseProcesses()),
    async disableDemo() {
      const ran = await runOptionalCommand(process.env.DEMO_DISABLE_CMD);
      if (!ran) console.warn('[reset:demo] no DEMO_DISABLE_CMD set — relying on the operator\'s planned maintenance window to gate demo traffic.');
    },
    async enableDemo() {
      const ran = await runOptionalCommand(process.env.DEMO_ENABLE_CMD);
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
