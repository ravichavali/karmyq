import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { ROOT, allWorkspaces as scanWorkspaces } from './helpers/workspaces';

/**
 * Sprint 122 PR 4 — the jest toolchain must be declared, uniform and real.
 *
 * Three failure modes this PR hit, each now blocking:
 *
 *  1. HOIST-ONLY DEPENDENCIES. apps/landing, cleanup-service, geocoding-service
 *     and simulation-service all RAN jest without declaring it; they survived
 *     purely because some other workspace's declaration hoisted a copy to the
 *     root. Deleting the root `ts-jest` override de-hoisted ts-jest and broke
 *     cleanup-service and simulation-service outright. A bump in the workspaces
 *     that declare a package silently changes it for the workspaces that don't.
 *
 *     Covered for BOTH `jest` and `ts-jest`. Checking only `jest` would have
 *     left the actual failure unguarded: cleanup and simulation declared jest
 *     the whole time — it was ts-jest they were getting for free, via the root
 *     config's preset, which their own config files never mention.
 *
 *  2. SPLIT MAJORS. apps/frontend shipped `jest-environment-jsdom@^30` beside
 *     `jest@^29` on master. Nothing caught it because both were "present".
 *
 *  3. RENAMED CLI FLAGS. jest 30 replaced `--testPathPattern` with
 *     `--testPathPatterns`. Rather than blocklist that one flag, this gate asks
 *     the INSTALLED jest whether every flag we pass exists — so the next rename
 *     is caught too, without anyone having to remember to add it here.
 *
 * Note what this gate deliberately does NOT do: assert version NUMBERS. A gate
 * frozen to "jest is 30" is a second copy of package.json that has to be edited
 * in lockstep with the real one, and agreeing with a copy of yourself proves
 * nothing. Every assertion below is relative to what is actually installed.
 */

/** Workspaces that invoke jest. Explicit so a NEW one cannot slip in unprobed. */
const EXPECTED_JEST_WORKSPACES = [
  'apps/frontend',
  'apps/landing',
  'apps/mobile',
  'packages/shared',
  'services/auth-service',
  'services/cleanup-service',
  'services/community-service',
  'services/geocoding-service',
  'services/notification-service',
  'services/reputation-service',
  'services/request-service',
  'services/simulation-service',
  'services/social-graph-service',
  'tests',
];

/**
 * Workspaces whose resolved jest config compiles through ts-jest — including the
 * five that get it implicitly by spreading the root config's `preset`/`transform`
 * (cleanup, notification, reputation, request, simulation). Explicit for the same
 * reason as the jest roster: a new one must fail here rather than slip through.
 */
const EXPECTED_TS_JEST_WORKSPACES = [
  'apps/landing',
  'packages/shared',
  'services/auth-service',
  'services/cleanup-service',
  'services/community-service',
  'services/notification-service',
  'services/reputation-service',
  'services/request-service',
  'services/simulation-service',
  'services/social-graph-service',
  'tests',
];

/** Packages whose major must move in lockstep with jest's. */
const LOCKSTEP = ['@jest/globals', 'jest-environment-jsdom', 'jest-environment-node', 'babel-jest'];

type Pkg = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type Workspace = { ws: string; dir: string; pkg: Pkg };

/**
 * Every workspace, with its manifest. Memoized: the seven cases below each ask
 * the same question, and the tree cannot change mid-run.
 */
let cached: Workspace[] | undefined;
function allWorkspaces(): Workspace[] {
  cached ??= scanWorkspaces().map(({ ws, dir }) => ({
    ws,
    dir,
    pkg: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Pkg,
  }));
  return cached;
}

/** Every `jest ...` command in any script, split from `&&` chains. */
function jestCommands(pkg: Pkg): string[] {
  return Object.values(pkg.scripts || {})
    .flatMap((s) => s.split('&&'))
    .map((s) => s.trim())
    .filter((s) => /^(npx\s+)?jest(\s|$)/.test(s));
}

/** A workspace "uses jest" if it has a jest config or a script that runs jest. */
function usesJest({ dir, pkg }: Workspace): boolean {
  return existsSync(join(dir, 'jest.config.js')) || jestCommands(pkg).length > 0;
}

/**
 * Whether a workspace's RESOLVED jest config compiles through ts-jest.
 *
 * Resolved, not textual: five services name ts-jest nowhere in their own config
 * and inherit `preset: 'ts-jest'` plus the ts-jest transform by spreading the
 * root config. A grep of the workspace's own file would miss all five — which is
 * exactly the set that broke when the root ts-jest override was deleted.
 *
 * `apps/frontend` exports next/jest's async factory rather than an object. It is
 * excluded because next/jest compiles with SWC and can never route through
 * ts-jest; the roster assertion below is what stops that exclusion from silently
 * widening.
 */
function usesTsJest({ dir }: Workspace): boolean {
  const configPath = join(dir, 'jest.config.js');
  if (!existsSync(configPath)) return false;

  const config = require(configPath);
  if (typeof config === 'function') return false;

  return JSON.stringify([config.preset ?? null, config.transform ?? null]).includes('ts-jest');
}

const declared = (pkg: Pkg, name: string): string | undefined =>
  pkg.devDependencies?.[name] ?? pkg.dependencies?.[name];

/**
 * Major from a range like `^30.4.2` / `~29.1.0` / `30.4.2` / `>=8.20.1` / `30`.
 * Throws — loudly, naming the range — on anything with no number in it at all
 * (`*`, `latest`, `workspace:*`), because silently treating those as "fine" is
 * how a gate stops constraining anything.
 */
function majorOf(range: string): number {
  const m = range.match(/(\d+)/);
  if (!m) throw new Error(`cannot read a major from range: ${range}`);
  return Number(m[1]);
}

/** The version actually installed for `name`, resolved FROM `dir`. */
function installedFrom(dir: string, name: string): string {
  const p = require.resolve(`${name}/package.json`, { paths: [dir] });
  return JSON.parse(readFileSync(p, 'utf8')).version;
}

const jestWorkspaces = () => allWorkspaces().filter(usesJest);
const tsJestWorkspaces = () => allWorkspaces().filter(usesTsJest);

/** The jest major everything else is measured against. Read once, from the tree. */
const installedMajor = majorOf(installedFrom(ROOT, 'jest'));

describe('jest toolchain: declared, uniform, and real', () => {
  it('covers exactly the workspaces that invoke jest', () => {
    // Scans the repo rather than comparing the list against a copy of itself:
    // a NEW jest-using workspace must fail here, not only a removed one.
    expect(jestWorkspaces().map((w) => w.ws).sort()).toEqual([...EXPECTED_JEST_WORKSPACES].sort());
  });

  it('every workspace that runs jest also declares it', () => {
    // The hoist-only failure mode. Presence in node_modules is not a
    // declaration — it is someone else's declaration leaking through.
    const undeclared = jestWorkspaces()
      .filter((w) => !declared(w.pkg, 'jest'))
      .map((w) => w.ws);

    expect(undeclared).toEqual([]);
  });

  it('covers exactly the workspaces whose config compiles through ts-jest', () => {
    expect(tsJestWorkspaces().map((w) => w.ws).sort()).toEqual([...EXPECTED_TS_JEST_WORKSPACES].sort());
  });

  it('every workspace that compiles through ts-jest also declares it', () => {
    // The failure this PR actually hit: deleting the root `ts-jest` override
    // de-hoisted the package, and cleanup-service and simulation-service broke
    // outright because they used the root config's ts-jest preset while
    // declaring nothing. Checking `jest` alone would not have caught it —
    // both still declared jest.
    const undeclared = tsJestWorkspaces()
      .filter((w) => !declared(w.pkg, 'ts-jest'))
      .map((w) => w.ws);

    expect(undeclared).toEqual([]);
  });

  it('each ts-jest workspace RESOLVES the major it declares, from its own directory', () => {
    // Declaration and tree are separate properties. A workspace can declare
    // ts-jest correctly and still load a different copy — or declare nothing
    // and load a hoisted one, which is the accident this gate exists to end.
    const offenders = tsJestWorkspaces()
      .map((w) => ({
        ws: w.ws,
        declaredMajor: majorOf(declared(w.pkg, 'ts-jest') as string),
        resolved: installedFrom(w.dir, 'ts-jest'),
      }))
      .filter(({ declaredMajor, resolved }) => majorOf(resolved) !== declaredMajor)
      .map(({ ws, declaredMajor, resolved }) => `${ws}: declares ${declaredMajor}.x, resolves ${resolved}`);

    expect(offenders).toEqual([]);
  });

  it('every declared jest range is on the SAME major as the installed jest', () => {
    // Identity against what is installed — not "all the ranges match each
    // other", which a repo-wide wrong value would satisfy.
    const offenders = jestWorkspaces()
      .map((w) => ({ ws: w.ws, range: declared(w.pkg, 'jest') as string }))
      .filter(({ range }) => majorOf(range) !== installedMajor)
      .map(({ ws, range }) => `${ws}: declares ${range}, installed is ${installedMajor}.x`);

    expect(offenders).toEqual([]);
  });

  it('each workspace RESOLVES the same jest major it declares', () => {
    // The declaration and the tree are different properties: npm can nest a
    // second copy that satisfies a range while the workspace's own jest config
    // and CLI come from elsewhere. Resolve from each workspace to prove it.
    const offenders = jestWorkspaces()
      .map((w) => ({
        ws: w.ws,
        declaredMajor: majorOf(declared(w.pkg, 'jest') as string),
        resolved: installedFrom(w.dir, 'jest'),
      }))
      .filter(({ declaredMajor, resolved }) => majorOf(resolved) !== declaredMajor)
      .map(({ ws, declaredMajor, resolved }) => `${ws}: declares ${declaredMajor}.x, resolves ${resolved}`);

    expect(offenders).toEqual([]);
  });

  it('jest-family packages move in lockstep with jest', () => {
    // apps/frontend shipped jest-environment-jsdom@^30 with jest@^29 on master.
    const offenders = allWorkspaces()
      .flatMap((w) =>
        LOCKSTEP.map((name) => ({ ws: w.ws, name, range: declared(w.pkg, name) })).filter((x) => x.range),
      )
      .filter(({ range }) => majorOf(range as string) !== installedMajor)
      .map(({ ws, name, range }) => `${ws}: ${name}@${range} vs jest ${installedMajor}.x`);

    expect(offenders).toEqual([]);
  });

  it('@types/jest tracks the installed jest major', () => {
    // Split out from LOCKSTEP: @types/jest publishes its own majors and is the
    // one most likely to be forgotten, so name it in its own failure.
    const offenders = allWorkspaces()
      .map((w) => ({ ws: w.ws, range: declared(w.pkg, '@types/jest') }))
      .filter((x) => x.range && majorOf(x.range) !== installedMajor)
      .map(({ ws, range }) => `${ws}: @types/jest@${range} vs jest ${installedMajor}.x`);

    expect(offenders).toEqual([]);
  });

  it('every CLI flag in every jest script exists in the installed jest', () => {
    // Driven by jest's OWN option table, so a future rename fails here without
    // anyone updating a blocklist. This is what catches jest 30's
    // --testPathPattern -> --testPathPatterns.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { yargsOptions } = require('jest-cli');

    const known = new Set<string>();
    for (const [name, opt] of Object.entries<{ alias?: string | string[] }>(yargsOptions)) {
      known.add(name);
      const alias = opt.alias;
      for (const a of Array.isArray(alias) ? alias : alias ? [alias] : []) known.add(a);
    }

    const offenders: string[] = [];
    for (const { ws, pkg } of allWorkspaces()) {
      for (const cmd of jestCommands(pkg)) {
        for (const token of cmd.split(/\s+/)) {
          if (!token.startsWith('--')) continue;
          // `--flag=value` -> flag; `--no-coverage` -> coverage (yargs negation).
          const flag = token.slice(2).split('=')[0].replace(/^no-/, '');
          if (!known.has(flag)) offenders.push(`${ws}: "${cmd}" uses unknown flag --${flag}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
