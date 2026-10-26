/**
 * Sprint 131 D9: security overrides published while the ioredis splice was in flight.
 * The live npm audit gate detects new advisories; these checks preserve the explicit
 * patched pins and the engine.io ws override across later lock edits. Sprint 134 PR X
 * raised the undici floor and added the @expo/cli zod pin.
 */
import semver from 'semver';
import { read } from './helpers/workspaces';

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

/** An override is either a version string or a nested object whose own version is under ".". */
const ownVersion = (override: string | Record<string, string>): string =>
  typeof override === 'string' ? override : override['.'];

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
    // Every copy in the lock, not just the hoisted one: a nested vulnerable copy would otherwise pass.
    const copies = Object.entries(lock.packages as Record<string, { version: string }>)
      .filter(([path]) => path.endsWith(`node_modules/${name}`))
      .map(([path, node]) => [path, node.version]);
    expect(copies).toEqual([[`node_modules/${name}`, override]]);
  });

  it('keeps the engine.io ws override alongside its own version', () => {
    expect(semver.gte(pkg.overrides['engine.io'].ws, '8.21.0')).toBe(true);
  });
});
