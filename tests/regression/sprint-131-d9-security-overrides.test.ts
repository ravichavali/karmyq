/**
 * Sprint 131 D9: security overrides published while the ioredis splice was in flight.
 * The live npm audit gate detects new advisories; these checks preserve the explicit
 * patched pins and the engine.io ws override across later lock edits. Sprint 134 PR X
 * raised the undici floor and added the @expo/cli zod pin; the Sprint 134 security
 * follow-up raised the node-forge, ip-address and fast-uri floors.
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
    expect(semver.gte(semver.minVersion(pkg.overrides[name])!, patched)).toBe(true);
    const copies = lockedCopies(name);
    expect(copies).not.toEqual([]);
    expect(copies.filter(([, version]) => semver.lt(version, patched))).toEqual([]);
  });

  it('keeps the engine.io ws override alongside its own version', () => {
    expect(semver.gte(pkg.overrides['engine.io'].ws, '8.21.0')).toBe(true);
  });
});
