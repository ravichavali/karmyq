/**
 * Sprint 131 D9: security overrides published while the ioredis splice was in flight.
 * The live npm audit gate detects new advisories; these checks preserve the explicit
 * patched pins and the engine.io ws override across later lock edits.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import semver from 'semver';

const root = resolve(__dirname, '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));

describe('D9 security override pins', () => {
  it.each([
    ['brace-expansion', '5.0.12'],
    ['engine.io', '6.6.10'],
    ['undici', '7.29.1'],
  ])('%s stays on a patched version in the manifest and lock', (name, floor) => {
    const override = name === 'engine.io' ? pkg.overrides[name]?.['.'] : pkg.overrides[name];
    const locked = lock.packages[`node_modules/${name}`]?.version;
    expect(semver.valid(override)).not.toBeNull();
    expect(semver.gte(override, floor)).toBe(true);
    expect(locked).toBe(override);
  });

  it('keeps the engine.io ws override alongside its own version', () => {
    expect(pkg.overrides['engine.io'].ws).toBe('8.21.0');
  });
});
