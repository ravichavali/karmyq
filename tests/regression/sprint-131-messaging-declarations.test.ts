/**
 * Sprint 131 PR B: services/messaging-service declares every package it imports.
 *
 * Not BUG-034 (that report covers zero tests only). This is the "declare what you import" class
 * already fixed here for @karmyq/shared and redis (CONTEXT.md, Sprint 122 sections), scoped into PR B
 * by the Sprint 131 spec.
 *
 * It imported express, cors, dotenv, jsonwebtoken and pg while declaring none of them, alive only
 * because root declares them and npm hoists. A root bump (D1: dotenv 17) would silently change or
 * de-hoist what messaging runs. The import list is DERIVED from src on every run, so a new
 * undeclared import fails here without anyone maintaining a list.
 */
import { readdirSync, readFileSync } from 'fs';
import { builtinModules } from 'module';
import { join } from 'path';
import * as semver from 'semver';

const ROOT = join(__dirname, '..', '..');
const WS = 'services/messaging-service';
const pkg = JSON.parse(readFileSync(join(ROOT, WS, 'package.json'), 'utf8'));
const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

function importedPackages(): string[] {
  const names = new Set<string>();
  const specifier = /(?:\bfrom\s+|\bimport\s+|\brequire\(\s*|\bimport\(\s*)['"]([^'"]+)['"]/g;
  for (const file of sourceFiles(join(ROOT, WS, 'src'))) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(specifier)) {
      if (spec.startsWith('.') || spec.startsWith('node:')) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!builtinModules.includes(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/** Resolved version as npm would find it from the workspace: nested first, then hoisted. */
const resolved = (name: string): string | undefined =>
  lock.packages[`${WS}/node_modules/${name}`]?.version ?? lock.packages[`node_modules/${name}`]?.version;

describe('services/messaging-service declares what it imports (Sprint 131 PR B)', () => {
  it('the import scan is not vacuous', () => {
    expect(importedPackages()).toEqual(expect.arrayContaining(['@karmyq/shared', 'express', 'socket.io']));
  });

  it('every imported package is a production dependency', () => {
    // Production, not dev: the Dockerfile's runtime stage installs with --omit=dev.
    const missing = importedPackages().filter((name) => !pkg.dependencies?.[name]);
    expect(missing).toEqual([]);
  });

  it('a jest test script brings its own jest toolchain', () => {
    const usesJest = Object.values<string>(pkg.scripts ?? {}).some((s) => /^jest\b/.test(s));
    expect(usesJest).toBe(true);
    const missing = ['jest', 'ts-jest', '@types/jest'].filter((name) => !pkg.devDependencies?.[name]);
    expect(missing).toEqual([]);
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
