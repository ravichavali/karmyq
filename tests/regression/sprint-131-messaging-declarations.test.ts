/**
 * Sprint 131 PR B: services/messaging-service declares every package it imports.
 *
 * Not BUG-034 (that report covers zero tests only). This is the "declare what you import" class
 * already fixed here for @karmyq/shared and redis (CONTEXT.md, Sprint 122 sections), scoped into PR B
 * by the Sprint 131 spec.
 *
 * It imported express, cors, dotenv, jsonwebtoken and pg while declaring none of them, alive only
 * because root declares them and npm hoists. A root bump (D1: dotenv 17) would silently change or
 * de-hoist what messaging runs. The import list is DERIVED from tracked src on every run, so a new
 * undeclared import fails here without anyone maintaining a list. The jest toolchain declarations
 * are sprint-122-jest-toolchain-gate's job, not this file's.
 */
import { builtinModules } from 'module';
import * as semver from 'semver';

import { read, tracked } from './helpers/workspaces';

const WS = 'services/messaging-service';
const pkg = JSON.parse(read(`${WS}/package.json`));
const rootPkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

const SPECIFIER = /(?:\bfrom\s+|\bimport\s+|\brequire\(\s*|\bimport\(\s*)['"]([^'"]+)['"]/g;

function importedPackages(): string[] {
  const names = new Set<string>();
  for (const file of tracked(`${WS}/src/*.ts`, `${WS}/src/*.tsx`)) {
    for (const [, spec] of read(file).matchAll(SPECIFIER)) {
      if (spec.startsWith('.') || spec.startsWith('node:')) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!builtinModules.includes(name)) names.add(name);
    }
  }
  return [...names].sort();
}

const imported = importedPackages();

/** Resolved version as npm would find it from the workspace: nested first, then hoisted. */
const resolved = (name: string): string | undefined =>
  lock.packages[`${WS}/node_modules/${name}`]?.version ?? lock.packages[`node_modules/${name}`]?.version;

describe('services/messaging-service declares what it imports (Sprint 131 PR B)', () => {
  it('the import scan is not vacuous', () => {
    expect(imported).toEqual(expect.arrayContaining(['@karmyq/shared', 'express', 'socket.io']));
  });

  it('every imported package is a production dependency', () => {
    // Production, not dev: the Dockerfile's runtime stage installs with --omit=dev.
    expect(imported.filter((name) => !pkg.dependencies?.[name])).toEqual([]);
  });

  it('every declared range is satisfied by the version the lockfile resolves', () => {
    const declared = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const unsatisfied = Object.entries(declared)
      .filter(([name]) => name !== '@karmyq/shared') // workspace link, range "*"
      .filter(([name, range]) => !semver.satisfies(resolved(name) ?? '0.0.0', range))
      .map(([name, range]) => `${name}@${range} resolved ${resolved(name)}`);
    expect(unsatisfied).toEqual([]);
  });

  it('shares root ranges exactly, so this declaration upgrades nothing', () => {
    const drift = Object.entries<string>(pkg.dependencies)
      .filter(([name]) => rootPkg.dependencies?.[name])
      .filter(([name, range]) => range !== rootPkg.dependencies[name])
      .map(([name, range]) => `${name}: workspace ${range} vs root ${rootPkg.dependencies[name]}`);
    expect(drift).toEqual([]);
  });

  it("the lockfile's workspace node mirrors the manifest exactly", () => {
    const node = lock.packages[WS];
    expect(node.dependencies).toEqual(pkg.dependencies);
    expect(node.devDependencies).toEqual(pkg.devDependencies);
  });
});
