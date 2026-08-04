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
 * Scope is now every SDK-managed package expoFamily() cannot see, not only
 * those with a recorded decision behind them — the earlier five had a
 * decision on record; the six added in Sprint 122 PR 2 (reanimated, worklets,
 * screens, gesture-handler, react-native-web, the picker) did not, but were
 * just as invisible to the predicate. `reanimated` and `worklets` are the
 * fastest-moving of the eleven and the most likely next bump.
 *
 * Sprint 122 PR 3 proposed moving three of these (react 19.2.3 -> 19.2.8,
 * react-native-safe-area-context ~5.7.0 -> 5.8.0, react-native-maps 1.27.2 ->
 * 1.29.0). That is precisely why the map exists: changing any of them requires
 * editing this line with a written reason, and `npx expo install --check` must
 * still exit 0 afterwards.
 *
 * ⚠️ THIS MAP IS A SHADOW OF A LIVE SOURCE, AND SHADOWS GO STALE.
 *
 * The real arbiter is Expo's version map at
 * api.expo.dev/v2/sdks/57.0.0/native-modules, and Expo revises it *within* an
 * SDK generation. It is therefore NOT enough for this map to agree with
 * apps/mobile — that only proves two local files match each other, which is
 * exactly the assertion-weaker-than-it-claims failure this suite exists to
 * prevent.
 *
 * Proven, not hypothetical (PR 3, 2026-08-03): these values were read from the
 * map, and within hours it moved `react-native-gesture-handler` from ~2.32.0
 * to ~3.1.0. Every test here still passed 8/8 while `expo install --check`
 * exited 1. Caught in maintainer review, not by CI.
 *
 * Note `node_modules/expo/bundledNativeModules.json` is NOT a usable
 * substitute: expo 57.0.9 ships ~2.32.0 there, so it lagged the API too.
 *
 * **`npx expo install --check` must exit 0 before a green run of this file
 * means anything.** That is enforced by `.github/workflows/expo-sdk-drift.yml`,
 * which runs the real arbiter on a daily schedule and files an issue when the
 * live map moves. It is deliberately NOT a pull_request check — drift is a
 * fix-within-a-day problem, and making it blocking would couple every merge to
 * api.expo.dev being reachable. So this file can still go green for up to a day
 * after Expo moves; the scheduled job is what closes that window.
 *
 * Where Dependabot proposed something else, the map won:
 *
 *   react / react-dom               proposed 19.2.8, SDK says 19.2.3
 *   react-native-maps               proposed 1.29.0, SDK says 1.27.2
 *   react-native-safe-area-context  proposed 5.8.0,  SDK says ~5.7.0
 *   react-native-reanimated         proposed 4.5.3,  SDK says 4.5.1
 *   react-native-worklets           proposed 0.11.3, SDK says 0.10.1
 */
/**
 * The Expo SDK generation this file is written for. SDK_PINNED below is that
 * generation's frozen matrix, so the two move together or not at all.
 */
const SDK_MAJOR = 57;

const SDK_PINNED: Record<string, string> = {
  react: '19.2.3',
  'react-dom': '19.2.3',
  'react-native': '0.86.2',
  'react-native-maps': '1.27.2',
  'react-native-safe-area-context': '~5.7.0',
  'react-native-reanimated': '4.5.1',
  'react-native-worklets': '0.10.1',
  'react-native-screens': '~4.26.0',
  'react-native-gesture-handler': '~3.1.0',
  'react-native-web': '~0.21.0',
  '@react-native-picker/picker': '2.11.4',
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

  it('is pinned to the SDK generation SDK_PINNED was written for', () => {
    // SDK_PINNED below is a frozen SDK-57 matrix. A floor like `>= 57` would let
    // the whole expo family move to 58 while react-native and friends stayed on
    // their 57 pins, and BOTH assertions would still pass — a mixed-generation
    // false green, which is exactly what this gate exists to prevent (verified
    // by simulation, 2026-07-31). The two halves must name the same generation,
    // so an SDK migration has to edit this constant and SDK_PINNED together,
    // with `npx expo install --check` exiting 0 afterwards.
    expect(semver.major(semver.minVersion(allDeps.expo)!)).toBe(SDK_MAJOR);
  });

  it('every expo-family package shares the SDK major', () => {
    const sdkMajor = semver.major(semver.minVersion(allDeps.expo)!);
    expect(sdkMajor).toBe(SDK_MAJOR);

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
