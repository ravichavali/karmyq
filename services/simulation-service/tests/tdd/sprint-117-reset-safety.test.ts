import type { PoolClient } from 'pg';
import {
  classifyTables,
  type CatalogTable,
} from '../../src/fixtures/curatedDemo/tablePolicy';
import {
  buildResetPlan,
  executeReset,
  type DemoFingerprint,
  type ResetDependencies,
} from '../../src/fixtures/curatedDemo/resetCoordinator';

function federationCatalogFixture(): CatalogTable[] {
  return [
    { schema: 'federation', table: 'local_instance', tableType: 'BASE TABLE' },
    { schema: 'federation', table: 'instances', tableType: 'BASE TABLE' },
    { schema: 'federation', table: 'federated_users', tableType: 'BASE TABLE' },
    { schema: 'federation', table: 'inbox', tableType: 'BASE TABLE' },
    { schema: 'federation', table: 'outbox', tableType: 'BASE TABLE' },
  ];
}

interface FakeResetOptions {
  fingerprint?: DemoFingerprint;
  transactionError?: Error;
}

function fakeResetDeps(opts: FakeResetOptions = {}): jest.Mocked<ResetDependencies> {
  const fingerprint: DemoFingerprint = opts.fingerprint ?? {
    environment: 'demo',
    database: 'karmyq_demo',
    marker: 'karmyq-demo-reset-v1',
  };
  const rollback = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  const client = { query: jest.fn() } as unknown as PoolClient;

  const deps: jest.Mocked<ResetDependencies> = {
    getCatalog: jest.fn<Promise<CatalogTable[]>, []>().mockResolvedValue(federationCatalogFixture()),
    getFingerprint: jest.fn<Promise<DemoFingerprint>, []>().mockResolvedValue(fingerprint),
    disableDemo: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    enableDemo: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    pauseMutation: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    resumeMutation: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    backup: jest.fn().mockResolvedValue({ verified: true, path: 'C:\\tmp\\karmyq-demo.dump' }),
    acquireLock: jest.fn().mockResolvedValue(jest.fn<Promise<void>, []>().mockResolvedValue(undefined)),
    readSecret: jest.fn().mockReturnValue('fixture-password'),
    hashPassword: jest.fn<Promise<string>, [string, number]>().mockResolvedValue('$2a$12$hashed'),
    writeBaseline: jest.fn<Promise<void>, never[]>().mockResolvedValue(undefined),
    rollback,
    withTransaction: jest.fn(async (fn: (c: PoolClient) => Promise<unknown>) => {
      if (opts.transactionError) {
        await rollback();
        throw opts.transactionError;
      }
      return fn(client);
    }),
  } as unknown as jest.Mocked<ResetDependencies>;

  return deps;
}

describe('Sprint 117 reset safety', () => {
  it('classifies federation base tables and preserves only local instance identity', () => {
    const result = classifyTables(federationCatalogFixture());
    expect(result.preserve).toContain('federation.local_instance');
    expect(result.reset).toContain('federation.federated_users');
    expect(result.reset).toContain('federation.inbox');
  });

  it('excludes views from classification and truncate statements', () => {
    const result = classifyTables([
      { schema: 'social_graph', table: 'trust_edges', tableType: 'BASE TABLE' },
      { schema: 'social_graph', table: 'trust_edges_live', tableType: 'VIEW' },
    ]);
    expect(result.reset).toContain('social_graph.trust_edges');
    expect([...result.reset, ...result.reseed, ...result.preserve]).not.toContain('social_graph.trust_edges_live');
  });

  it('fails when a managed application table is unclassified', () => {
    expect(() => classifyTables([{ schema: 'requests', table: 'new_table', tableType: 'BASE TABLE' }]))
      .toThrow(/unclassified table requests\.new_table/i);
  });

  it('is dry-run by default and never calls backup, lock, or transaction', async () => {
    const deps = fakeResetDeps();
    const result = await executeReset({ apply: false }, deps);
    expect(result.mode).toBe('dry-run');
    expect(deps.backup).not.toHaveBeenCalled();
    expect(deps.withTransaction).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'production'])('rejects %s fingerprints before backup', async environment => {
    const deps = fakeResetDeps({ fingerprint: { environment, database: 'karmyq_prod', marker: null } });
    await expect(executeReset({ apply: true }, deps)).rejects.toThrow(/demo fingerprint/i);
    expect(deps.backup).not.toHaveBeenCalled();
  });

  it('requires backup, advisory lock, paused jobs, and one rolled-back transaction', async () => {
    const deps = fakeResetDeps({ transactionError: new Error('seed failed') });
    await expect(executeReset({ apply: true }, deps)).rejects.toThrow('seed failed');
    expect(deps.pauseMutation.mock.invocationCallOrder[0]).toBeLessThan(deps.backup.mock.invocationCallOrder[0]);
    expect(deps.backup.mock.invocationCallOrder[0]).toBeLessThan(deps.acquireLock.mock.invocationCallOrder[0]);
    expect(deps.rollback).toHaveBeenCalledTimes(1);
    expect(deps.enableDemo).not.toHaveBeenCalled();
  });

  it('surfaces a fingerprint and classified tables in the dry-run plan', async () => {
    const deps = fakeResetDeps();
    const plan = await buildResetPlan(deps, new Date('2026-07-02T12:00:00.000Z'));
    expect(plan.fingerprint.environment).toBe('demo');
    expect(plan.tables.preserve).toContain('federation.local_instance');
    expect(plan.baseline.people.length).toBeGreaterThanOrEqual(30);
  });
});
