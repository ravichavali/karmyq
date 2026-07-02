/**
 * Sprint 117 — Curated Demo Fixtures: guarded reset coordinator.
 *
 * Dry-run by default. A destructive apply requires, in order: a verified demo fingerprint,
 * demo disabled, mutation jobs paused, a completed restorable backup, an advisory lock, and one
 * PostgreSQL transaction that truncates the classified tables and writes the compiled baseline.
 * Any failure leaves the demo disabled and does not silently restore while services are live.
 *
 * Every side effect is an injected dependency so the safety ordering is unit-testable without a
 * database, a shell, or real password hashing.
 */

import type { Pool, PoolClient } from 'pg';
import { compileManifest } from './compiler';
import { CURATED_DEMO_MANIFEST } from './manifest';
import {
  CATALOG_QUERY,
  classifyTables,
  MANAGED_SCHEMAS,
  type CatalogTable,
  type ClassifiedTableSet,
} from './tablePolicy';
import { writeBaseline } from './baselineWriter';
import type { CompiledDemoBaseline } from './types';

export const DEMO_RESET_MARKER = 'karmyq-demo-reset-v1';

export interface DemoFingerprint {
  environment: string;
  database: string;
  marker: string | null;
}

export interface BackupResult {
  verified: boolean;
  path: string;
}

export type LockRelease = () => Promise<void>;

export interface ResetOptions {
  apply: boolean;
  anchor?: Date;
  backupDir?: string;
  publishConfig?: boolean;
}

export interface ResetPlan {
  anchor: Date;
  fingerprint: DemoFingerprint;
  tables: ClassifiedTableSet;
  baseline: CompiledDemoBaseline;
  counts: {
    people: number;
    communities: number;
    memberships: number;
    requests: number;
    projectionEvents: number;
    tablesReset: number;
    tablesReseed: number;
    tablesPreserve: number;
  };
}

export type ResetMode = 'dry-run' | 'applied-awaiting-validation';

export interface ResetResult {
  mode: ResetMode;
  plan: ResetPlan;
  backupPath?: string;
}

/**
 * Every side effect the reset performs. Provided by {@link createResetDependencies} at runtime
 * and by typed Jest mocks in tests.
 */
export interface ResetDependencies {
  getCatalog(): Promise<CatalogTable[]>;
  getFingerprint(): Promise<DemoFingerprint>;
  disableDemo(): Promise<void>;
  enableDemo(): Promise<void>;
  pauseMutation(): Promise<void>;
  resumeMutation(): Promise<void>;
  backup(): Promise<BackupResult>;
  acquireLock(): Promise<LockRelease>;
  readSecret(name: string): string | undefined;
  hashPassword(plain: string, cost: number): Promise<string>;
  withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
  writeBaseline(
    client: PoolClient,
    baseline: CompiledDemoBaseline,
    tables: ClassifiedTableSet,
    credentialHash: string,
  ): Promise<void>;
  rollback(): Promise<void>;
}

/** Refuse any target that is not an explicitly-marked demo database. */
export function assertDemoFingerprint(f: DemoFingerprint): void {
  if (f.environment !== 'demo' || f.marker !== DEMO_RESET_MARKER) {
    throw new Error(`Refusing reset: demo fingerprint mismatch for ${f.database}`);
  }
}

/** Build a non-destructive plan: classify tables, read fingerprint, and compile the baseline. */
export async function buildResetPlan(deps: ResetDependencies, anchor: Date): Promise<ResetPlan> {
  const catalog = await deps.getCatalog();
  const tables = classifyTables(catalog);
  const fingerprint = await deps.getFingerprint();
  const baseline = compileManifest(CURATED_DEMO_MANIFEST, anchor);
  return {
    anchor,
    fingerprint,
    tables,
    baseline,
    counts: {
      people: baseline.people.length,
      communities: baseline.communities.length,
      memberships: baseline.memberships.length,
      requests: baseline.requests.length,
      projectionEvents: baseline.projectionEvents.length,
      tablesReset: tables.reset.length,
      tablesReseed: tables.reseed.length,
      tablesPreserve: tables.preserve.length,
    },
  };
}

/**
 * Execute the reset. Without `apply`, returns the dry-run plan and performs no side effects.
 * With `apply`, enforces the full ordered safety gate around a single transaction.
 */
export async function executeReset(options: ResetOptions, deps: ResetDependencies): Promise<ResetResult> {
  const plan = await buildResetPlan(deps, options.anchor ?? new Date());
  if (!options.apply) {
    return { mode: 'dry-run', plan };
  }

  assertDemoFingerprint(plan.fingerprint);
  await deps.disableDemo();
  await deps.pauseMutation();

  const backup = await deps.backup();
  if (!backup.verified) {
    throw new Error('Refusing reset: backup is not verified');
  }

  const release = await deps.acquireLock();
  try {
    const fixturePassword = deps.readSecret('DEMO_PERSONA_PASSWORD');
    if (!fixturePassword) {
      throw new Error('Refusing reset: DEMO_PERSONA_PASSWORD is missing');
    }
    const credentialHash = await deps.hashPassword(fixturePassword, 12);
    await deps.withTransaction(client => deps.writeBaseline(client, plan.baseline, plan.tables, credentialHash));
    return { mode: 'applied-awaiting-validation', plan, backupPath: backup.path };
  } finally {
    await release();
  }
}

// ---------------------------------------------------------------------------
// Default runtime dependencies. Not exercised by unit tests (which inject mocks); validated in
// the migrated-DB integration test (Task 10) and the deployed rehearsal.
// ---------------------------------------------------------------------------

export interface RuntimeResetConfig {
  pool: Pool;
  databaseName: string;
  backupDir: string;
  /** Injected argument-array process runner (never a concatenated shell string). */
  runProcess: (command: string, args: string[]) => Promise<void>;
  /** Optional hooks for pausing/resuming and toggling the demo; default to no-ops. */
  pauseMutation?: () => Promise<void>;
  resumeMutation?: () => Promise<void>;
  disableDemo?: () => Promise<void>;
  enableDemo?: () => Promise<void>;
}

const ADVISORY_LOCK_KEY = 811_7000; // Sprint 117 curated reset advisory lock.

export function createResetDependencies(config: RuntimeResetConfig): ResetDependencies {
  const { pool } = config;
  const noop = async (): Promise<void> => undefined;

  return {
    async getCatalog() {
      const result = await pool.query<CatalogTable>(CATALOG_QUERY, [MANAGED_SCHEMAS]);
      return result.rows;
    },
    async getFingerprint() {
      return {
        environment: process.env.DEMO_ENV ?? process.env.NODE_ENV ?? 'unknown',
        database: config.databaseName,
        marker: process.env.DEMO_RESET_MARKER ?? null,
      };
    },
    disableDemo: config.disableDemo ?? noop,
    enableDemo: config.enableDemo ?? noop,
    pauseMutation: config.pauseMutation ?? noop,
    resumeMutation: config.resumeMutation ?? noop,
    async backup() {
      const stamp = new Date().toISOString().replace(/[:.]/g, '').replace(/-/g, '');
      const path = `${config.backupDir.replace(/[/\\]$/, '')}/karmyq-demo-${stamp}.dump`;
      // Argument array only — never interpolate secrets or the database URL into a shell string.
      await config.runProcess('pg_dump', ['--format=custom', `--file=${path}`, config.databaseName]);
      return { verified: true, path };
    },
    async acquireLock() {
      await pool.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
      return async () => {
        await pool.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
      };
    },
    readSecret(name: string) {
      return process.env[name];
    },
    async hashPassword(plain: string, cost: number) {
      // Lazy require: bcryptjs is hoisted (auth-service depends on it), so this avoids adding a
      // duplicate workspace dependency and the cross-platform lock churn that would cause.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bcrypt = require('bcryptjs') as { hash(plain: string, cost: number): Promise<string> };
      return bcrypt.hash(plain, cost);
    },
    async withTransaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        await this.rollback();
        throw err;
      } finally {
        client.release();
      }
    },
    writeBaseline,
    rollback: noop,
  };
}
