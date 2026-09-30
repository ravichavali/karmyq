/**
 * Sprint 131 D9: security overrides published while the ioredis splice was in flight.
 * The live npm audit gate detects new advisories; these checks preserve the explicit
 * patched pins and the engine.io ws override across later lock edits.
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
    ['undici', '7.29.1'],
  ])('%s stays on a patched version in the manifest and lock', (name, floor) => {
    const override = ownVersion(pkg.overrides[name]);
    expect(semver.gte(override, floor)).toBe(true);
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(override);
  });

  it('keeps the engine.io ws override alongside its own version', () => {
    expect(semver.gte(pkg.overrides['engine.io'].ws, '8.21.0')).toBe(true);
  });
});
