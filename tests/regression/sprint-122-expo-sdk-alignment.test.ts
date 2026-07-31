import { readFileSync } from 'fs';
import { join } from 'path';
import semver from 'semver';

/**
 * Sprint 122 PR 2 — Expo SDK alignment (ADR-088).
 *
 * S121 PR 4 spent a sprint reconciling apps/mobile against Expo SDK 57 by
 * hand. Nothing detected the drift that made that necessary, and Sprint 122
 * PR 3 is about to propose moving react-native-maps, safe-area-context and
 * react away from their SDK pins. This gate makes the alignment an assertion
 * rather than a review habit.
 */
const ROOT = join(__dirname, '..', '..');

const mobilePkg = JSON.parse(readFileSync(join(ROOT, 'apps', 'mobile', 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));

const allDeps: Record<string, string> = {
  ...(mobilePkg.dependencies || {}),
  ...(mobilePkg.devDependencies || {}),
};

/**
 * Packages in the expo family that are versioned independently of the SDK.
 * Each entry needs a reason. An entry that no longer appears in the manifest
 * is itself a failure — stale exemptions are how gates rot.
 */
const INDEPENDENTLY_VERSIONED: Record<string, string> = {
  '@expo/vector-icons': 'Icon set, versioned on its own line (15.x under SDK 57), not with the SDK.',
};

const expoFamily = (name: string) =>
  name === 'expo' || name.startsWith('expo-') || name.startsWith('@expo/');

/** Resolve what npm actually installed for an apps/mobile dependency. */
function installedVersion(name: string): string {
  const nested = lock.packages[`apps/mobile/node_modules/${name}`];
  const hoisted = lock.packages[`node_modules/${name}`];
  const entry = nested || hoisted;
  if (!entry) throw new Error(`${name} is declared by apps/mobile but absent from package-lock.json`);
  return entry.version;
}

describe('apps/mobile stays aligned to its Expo SDK', () => {
  it('declares expo with a concrete range', () => {
    expect(typeof allDeps.expo).toBe('string');
    expect(allDeps.expo).not.toBe('*');
  });

  it('declares no dependency as "*"', () => {
    const wildcards = Object.entries(allDeps)
      .filter(([, range]) => range === '*' || range === 'latest' || range === '')
      .map(([name, range]) => `${name}@${range}`);
    expect(wildcards).toEqual([]);
  });

  it('every expo-family package shares the SDK major', () => {
    const sdkMajor = semver.major(semver.minVersion(allDeps.expo)!);
    expect(sdkMajor).toBeGreaterThanOrEqual(57);

    const misaligned = Object.entries(allDeps)
      .filter(([name]) => expoFamily(name) && !(name in INDEPENDENTLY_VERSIONED))
      .filter(([, range]) => semver.major(semver.minVersion(range)!) !== sdkMajor)
      .map(([name, range]) => `${name}@${range} (expected major ${sdkMajor})`);

    expect(misaligned).toEqual([]);
  });

  it('has no stale exemptions', () => {
    const stale = Object.keys(INDEPENDENTLY_VERSIONED).filter((name) => !(name in allDeps));
    expect(stale).toEqual([]);
  });

  it('the lockfile satisfies every apps/mobile declaration', () => {
    const violations = Object.entries(allDeps)
      .filter(([name, range]) => {
        if (!semver.validRange(range)) return false; // workspace:/file: protocols
        return !semver.satisfies(installedVersion(name), range);
      })
      .map(([name, range]) => `${name}: lock has ${installedVersion(name)}, manifest wants ${range}`);

    expect(violations).toEqual([]);
  });
});
