/**
 * Sprint 141 (BUG-073, ADR-105): the curated demo reset classifies `auth.platform_admins` as `reset`.
 *
 * The reset reads the live catalog (CATALOG_QUERY) and refuses to run on any unclassified base table, so a new
 * table without a TABLE_POLICY entry fails only at reset time, on the demo host. This suite moves that failure
 * left: it derives the catalog from the generated schema (infrastructure/postgres/init.sql, the migration chain's
 * output) instead of a hand-written fixture list, and runs the real classifier over every base table the reset
 * would see.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { classifyTables, MANAGED_SCHEMAS, type CatalogTable } from '../../src/fixtures/curatedDemo/tablePolicy';

const INIT_SQL = join(__dirname, '..', '..', '..', '..', 'infrastructure', 'postgres', 'init.sql');

/** Every base table CATALOG_QUERY would return: the managed schemas, plus the public geocoding cache. */
function initSqlCatalog(): CatalogTable[] {
  const managed = new Set<string>(MANAGED_SCHEMAS);
  const tables: CatalogTable[] = [];
  for (const [, schema, table] of readFileSync(INIT_SQL, 'utf8').matchAll(/^CREATE (?:UNLOGGED )?TABLE (?:IF NOT EXISTS )?([a-z_]+)\.([a-z0-9_]+) \(/gm)) {
    if (managed.has(schema) || (schema === 'public' && table === 'geocoding_cache')) {
      tables.push({ schema, table, tableType: 'BASE TABLE' });
    }
  }
  return tables;
}

describe('Sprint 141: auth.platform_admins in the curated demo reset', () => {
  it('the classifier resets auth.platform_admins (a reset wipes every grant; the operator re-grants)', () => {
    expect(classifyTables([{ schema: 'auth', table: 'platform_admins', tableType: 'BASE TABLE' }]))
      .toEqual({ reset: ['auth.platform_admins'], reseed: [], preserve: [] });
  });

  it('the catalog derived from init.sql is non-trivial (the parser found the schema)', () => {
    const catalog = initSqlCatalog();
    expect(catalog.length).toBeGreaterThan(90);
    expect(catalog).toContainEqual({ schema: 'auth', table: 'users', tableType: 'BASE TABLE' });
  });

  it('classifies every base table init.sql creates, and auth.platform_admins is among the reset set', () => {
    const classified = classifyTables(initSqlCatalog());
    expect(classified.reset).toContain('auth.platform_admins');
    expect(classified.reset).toContain('auth.users');
  });
});
