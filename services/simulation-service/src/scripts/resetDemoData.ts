/**
 * Sprint 117 — `reset:demo` CLI.
 *
 * Dry-run by default: prints the classified table plan, compiled fixture counts, reset anchor,
 * and demo fingerprint without touching the database. A destructive apply (`--apply`) runs the
 * full guarded reset through the coordinator. Unknown flags fail closed.
 *
 *   npm --workspace @karmyq/simulation-service run reset:demo
 *   npm --workspace @karmyq/simulation-service run reset:demo -- --apply --backup-dir=C:\tmp\backups
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import {
  createResetDependencies,
  executeReset,
  type ResetOptions,
} from '../fixtures/curatedDemo/resetCoordinator';

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

async function runProcess(command: string, commandArgs: string[]): Promise<void> {
  await execFileAsync(command, commandArgs);
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
    const deps = createResetDependencies({ pool, databaseName, backupDir: args.backupDir, runProcess });
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
    } else {
      console.log(`  backup:   ${result.backupPath}`);
      console.log('  status:   applied, awaiting API validation before demo re-enable.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[reset:demo] refused: ${message}`);
  process.exitCode = 1;
});
