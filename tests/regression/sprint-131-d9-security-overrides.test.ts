/**
 * Sprint 131 D9: security overrides published while the ioredis splice was in flight.
 * The live npm audit gate detects new advisories; these checks preserve the explicit
 * patched pins and the engine.io ws override across later lock edits. Sprint 134 PR X
 * raised the undici floor and added the @expo/cli zod pin; the Sprint 134 security
 * follow-up raised the node-forge, ip-address and fast-uri floors. Sprint 134 BUG-074's PR
 * pinned decode-uri-component 0.5.1 (GHSA-qr28-fpjm-wq7f, high). Sprint 135 raised the minimatch
 * floor to 11.0.1 (GHSA-g3hv-75wg-m249) and added a glob 14.0.2 floor (GHSA-3g3m-2fjr-6pw4), with
 * one exempt subtree: babel-plugin-module-resolver stays on glob 9 + minimatch 10 (see below).
 */
import semver from 'semver';
import { read } from './helpers/workspaces';

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

/** An override is either a version string or a nested object whose own version is under ".". */
const ownVersion = (override: string | Record<string, string>): string =>
  typeof override === 'string' ? override : override['.'];

/** Every copy in the lock as [path, version], not just the hoisted one: a nested vulnerable copy would otherwise pass. */
const lockedCopies = (name: string): [string, string][] =>
  Object.entries(lock.packages as Record<string, { version: string }>)
    .filter(([path]) => path.endsWith(`node_modules/${name}`))
    .map(([path, node]) => [path, node.version]);

describe('D9 security override pins', () => {
  it.each([
    ['brace-expansion', '5.0.12'],
    ['engine.io', '6.6.10'],
    ['undici', '7.30.1'],
    // 0.5.1 is the only patched release and is ESM-only: query-string@7 (expo-router) require()s it and gets
    // { default } instead of a function. Accepted until the mobile sprint; see docs/IDEAS.md 2026-10-29.
    ['decode-uri-component', '0.5.1'],
    // @expo/cli declares zod ^3; its exact pin must track the root's zod, or npm nests a second copy.
    ['zod', '4.6.6', ['@expo/cli', 'zod']],
  ])('%s stays on a patched version in the manifest and lock', (name, floor, overridePath = [name]) => {
    const override = ownVersion(overridePath.reduce((o, key) => o[key], pkg.overrides));
    expect(semver.gte(override, floor)).toBe(true);
    expect(lockedCopies(name)).toEqual([[`node_modules/${name}`, override]]);
  });

  // A ">=" override lets npm resolve anything at or above it, so both the floor and every locked copy must be
  // patched. The audit gate blocks only high and critical, so it would not catch a moderate (ip-address,
  // fast-uri) sliding back; node-forge is 1.4.2, not the advisory's 1.4.1, for 1.4.2's pem.decode fix.
  it.each([
    ['node-forge', '1.4.2'],
    ['ip-address', '10.7.4'],
    ['fast-uri', '4.2.3'],
  ])('%s floor override and every locked copy stay on a patched version', (name, patched) => {
    // A renamed key (say, a "<name>@<x" selector) must fail here, not as a TypeError from semver.
    expect(pkg.overrides).toHaveProperty([name]);
    expect(semver.gte(semver.minVersion(ownVersion(pkg.overrides[name]))!, patched)).toBe(true);
    const copies = lockedCopies(name);
    expect(copies).not.toEqual([]);
    expect(copies.filter(([, version]) => semver.lt(version, patched))).toEqual([]);
  });

  // glob and minimatch have one subtree that cannot move. babel-plugin-module-resolver 5.0.3, its latest release,
  // declares glob ^9.3.3, and its lib/normalizeOptions.js calls _glob.default.hasMagic() and _glob.default.sync():
  // only glob 9's CommonJS build has a `default` export (10, 13 and 14 have none). glob 9 in turn reads minimatch's
  // pattern parts as RegExps; minimatch 11 hands it Matcher objects, and glob 9's sync() then silently returns []
  // for every magic pattern. So a scoped override holds that subtree on glob 9 + minimatch 10.2.5. It is dev-only
  // (apps/mobile's Babel config, root "./", no magic), and these two copies are the ONLY vulnerable ones allowed.
  const moduleResolverSubtree = 'node_modules/babel-plugin-module-resolver/node_modules';
  it.each([
    ['glob', '14.0.2', [`${moduleResolverSubtree}/glob`]],
    ['minimatch', '11.0.1', [`${moduleResolverSubtree}/minimatch`]],
  ])('%s floor override is patched and so is every locked copy outside the module-resolver subtree', (name, patched, exempt) => {
    expect(pkg.overrides).toHaveProperty([name]);
    expect(semver.gte(semver.minVersion(ownVersion(pkg.overrides[name]))!, patched)).toBe(true);
    const copies = lockedCopies(name);
    // The hoisted copy must exist, or the exact-list check below could pass with nothing patched at all.
    expect(copies.filter(([path]) => !exempt.includes(path))).not.toEqual([]);
    expect(copies.filter(([, version]) => semver.lt(version, patched)).map(([path]) => path)).toEqual(exempt);
  });

  it('holds only the module-resolver subtree back, on glob 9 and minimatch 10.2.5', () => {
    expect(pkg.overrides['babel-plugin-module-resolver']).toEqual({ glob: { '.': '^9.3.3', minimatch: '10.2.5' } });
  });

  it('keeps the engine.io ws override alongside its own version', () => {
    expect(semver.gte(pkg.overrides['engine.io'].ws, '8.21.0')).toBe(true);
  });
});
