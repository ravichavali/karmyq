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
    if (token === '--batch-size') {
      const value = argv[index + 1];
      if (value == null || value.startsWith('--')) {
        throw new Error('--batch-size requires a value');
      }
      const parsed = Number(value);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error('--batch-size must be a positive integer');
      }
      batchSize = parsed;
      index += 1;
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
    if (!args.apply) {
      dependencies.log(
        `Apply exactly: npm --workspace karmyq-reputation-service run backfill:standing -- --apply --batch-size ${args.batchSize}`,
      );
    }
    return 0;
  } catch (error) {
    dependencies.error(`[standing-backfill] failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module) {
  runStandingBackfillCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
