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

/**
 * Packages the Expo SDK pins that carry no expo-/@expo/ prefix, so
 * expoFamily() structurally cannot see them. `npx expo install --check` is the
 * real arbiter for these; this map is its committed shadow, frozen at the
 * versions Sprint 121 PR 4 deliberately chose for SDK 57.
 *
 * Scope is the packages with a RECORDED decision behind them, not every
 * SDK-managed package: the rest are covered by the lockfile assertion below
 * and by `expo install --check` in CI.
 *
 * Sprint 122 PR 3 proposes moving three of these (react 19.2.3 -> 19.2.8,
 * react-native-safe-area-context ~5.7.0 -> 5.8.0, react-native-maps 1.27.2 ->
 * 1.29.0). That is precisely why the map exists: changing any of them requires
 * editing this line with a written reason, and `npx expo install --check` must
 * still exit 0 afterwards.
 */
const SDK_PINNED: Record<string, string> = {
  react: '19.2.3',
  'react-dom': '19.2.3',
  'react-native': '0.86.0',
  'react-native-maps': '1.27.2',
  'react-native-safe-area-context': '~5.7.0',
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
      .filter(([, range]) => semver.validRange(range) !== null && semver.major(semver.minVersion(range)!) !== sdkMajor)
      .map(([name, range]) => `${name}@${range} (expected major ${sdkMajor})`);

    expect(misaligned).toEqual([]);
  });

  it('has no stale exemptions', () => {
    const stale = Object.keys(INDEPENDENTLY_VERSIONED).filter((name) => !(name in allDeps));
    expect(stale).toEqual([]);
  });

  it('SDK-pinned non-expo packages still match what SDK 57 expects', () => {
    const drifted = Object.entries(SDK_PINNED)
      .filter(([name]) => name in allDeps)
      .filter(([name, expected]) => allDeps[name] !== expected)
      .map(([name, expected]) => `${name}: manifest has ${allDeps[name]}, SDK 57 pin is ${expected}`);

    expect(drifted).toEqual([]);
  });

  it('every SDK-pinned package is still declared', () => {
    // A pin that silently disappears from the manifest is drift too.
    const missing = Object.keys(SDK_PINNED).filter((name) => !(name in allDeps));
    expect(missing).toEqual([]);
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
