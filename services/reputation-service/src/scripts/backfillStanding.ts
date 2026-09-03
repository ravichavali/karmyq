/**
 * Sprint 126 standing repair operator command.
 *
 * Dry-run is the default and mutation requires the exact `--apply` flag. Argument validation
 * completes before any service call so a typo cannot connect to, much less change, a database.
 */

import {
  analyzeStandingBackfill,
  applyStandingBackfill,
  type StandingBackfillApplyOptions,
  type StandingBackfillReport,
} from '../services/standingBackfillService';

export interface StandingBackfillCliArgs {
  apply: boolean;
  batchSize: number;
}

interface StandingBackfillCliDependencies {
  analyze: () => Promise<StandingBackfillReport>;
  apply: (options: StandingBackfillApplyOptions) => Promise<StandingBackfillReport>;
  log: (message: string) => void;
  error: (message: string) => void;
}

const DEFAULT_DEPENDENCIES: StandingBackfillCliDependencies = {
  analyze: analyzeStandingBackfill,
  apply: applyStandingBackfill,
  log: console.log,
  error: console.error,
};

export function parseStandingBackfillArgs(argv: readonly string[]): StandingBackfillCliArgs {
  let apply = false;
  let batchSize = 100;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') {
      apply = true;
      continue;
    }
    // Both `--batch-size N` and `--batch-size=N` are accepted. The repo's other operator CLI
    // (simulation-service resetDemoData) requires the `=` form, and two operator commands with
    // mutually incompatible value syntax is a trap for whoever runs this once, under pressure.
    if (token === '--batch-size' || token.startsWith('--batch-size=')) {
      const inline = token.startsWith('--batch-size=');
      const value = inline ? token.slice('--batch-size='.length) : argv[index + 1];
      if (value == null || value === '' || value.startsWith('--')) {
        throw new Error('--batch-size requires a value');
      }
      const parsed = Number(value);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error('--batch-size must be a positive integer');
      }
      batchSize = parsed;
      if (!inline) index += 1;
      continue;
    }
    throw new Error(`Unknown flag: ${token}`);
  }

  return { apply, batchSize };
}

export async function runStandingBackfillCli(
  argv: readonly string[],
  dependencies: StandingBackfillCliDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  let args: StandingBackfillCliArgs;
  try {
    args = parseStandingBackfillArgs(argv);
  } catch (error) {
    dependencies.error(`[standing-backfill] refused: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  dependencies.log(`[standing-backfill] mode=${args.apply ? 'apply' : 'dry-run'} batchSize=${args.batchSize}`);
  try {
    const report = args.apply
      ? await dependencies.apply({
        batchSize: args.batchSize,
        onProgress(progress) {
          dependencies.log(
            `[standing-backfill] progress batches=${progress.completedBatches} matches=${progress.completedMatches} lastCommittedMatchId=${progress.lastCommittedMatchId}`,
          );
        },
      })
      : await dependencies.analyze();

    dependencies.log(JSON.stringify(report, null, 2));

    // Absence of anomalies is not the same as "done". A match completed by the live simulator while
    // the run was in progress is perfectly valid, but it arrived after the batch list was taken, so
    // rows can remain outstanding with an otherwise clean report. Exiting 0 there would tell the
    // operator the backfill finished when it has not — and the demo simulator completes matches
    // continuously, so this is the expected case, not a rare one. Re-running is the remedy.
    if (args.apply && !report.converged) {
      dependencies.error(
        `[standing-backfill] applied, but NOT converged: ${report.predicted.karmaRows} karma and ` +
          `${report.predicted.activityRows} activity rows still outstanding (most likely matches ` +
          `completed during the run). Re-run to finish.`,
      );
      return 1;
    }

    if (!args.apply) {
      dependencies.log(
        `Apply exactly (source checkout):  npm --workspace karmyq-reputation-service run backfill:standing -- --apply --batch-size ${args.batchSize}`,
      );
      // The deployed image contains only dist/ and installs with --omit=dev, so it has no ts-node
      // and no src/. Printing only the ts-node form would hand an operator a command that cannot
      // run where they are most likely to run it.
      dependencies.log(
        `Apply exactly (deployed container): npm run backfill:standing:dist -- --apply --batch-size ${args.batchSize}`,
      );
    }
    return 0;
  } catch (error) {
    dependencies.error(`[standing-backfill] failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Release the connections the service modules open lazily, so the CLI exits.
 *
 * Without this the process prints its report and then hangs: the pg pool holds idle clients, and
 * `effectiveParamsCache` creates an ioredis client that reconnects forever and keeps the event loop
 * alive. After a multi-hour apply that looks exactly like a crash mid-write.
 */
async function shutdown(): Promise<void> {
  try {
    const pool = (await import('../database/db')).default;
    await pool.end();
  } catch {
    /* already closed */
  }
  try {
    const { disconnectEffectiveParamsCache } = await import('../services/effectiveParamsCache');
    await disconnectEffectiveParamsCache();
  } catch {
    /* no redis client was ever created */
  }
}

if (require.main === module) {
  runStandingBackfillCli(process.argv.slice(2))
    .then(async (exitCode) => {
      process.exitCode = exitCode;
      await shutdown();
    })
    .catch(async (error) => {
      console.error(`[standing-backfill] fatal: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      await shutdown();
    });
}
