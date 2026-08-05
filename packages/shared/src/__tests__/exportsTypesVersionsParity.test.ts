import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 122 PR 4 — `typesVersions` must mirror `exports`, exactly.
 *
 * WHY THIS EXISTS
 *
 * ts-jest forces `moduleResolution: node10` whenever it forces
 * `module: commonjs` — in every 29.x, 29.4.6 included. node10 predates
 * `exports` maps and does not read them, so on the CommonJS path TypeScript
 * cannot type ANY `@karmyq/shared/<subpath>` import from an `exports` entry
 * alone. `typesVersions` is the pre-`exports` mechanism node10 *does* honour,
 * so it is what makes those imports resolve for consumers' tests.
 *
 * This affects TYPE resolution only. Node's own resolver still uses `exports`
 * at runtime, which is why `require.resolve` worked the whole time the type
 * checker was failing — an asymmetry that made the original diagnosis
 * (Sprint 122 PR 3) blame ts-jest's inline-`tsconfig` handling instead. That
 * diagnosis was wrong; see docs/IDEAS.md.
 *
 * THE INVARIANT
 *
 * Every `exports` subpath has a `typesVersions` entry pointing at the SOURCE
 * file its declaration is built from, and vice versa. A new subpath added to
 * `exports` alone compiles fine for the app (Node reads `exports`) and fails
 * only in a consumer's ts-jest run — a slow, confusing failure this gate turns
 * into an immediate one.
 *
 * `typesVersions` points at SOURCE, not `dist`, so that type resolution never
 * depends on whether shared has been built. Pointing it at `dist` broke CI's
 * `Lint & Type Check` job, which type-checks consumers without building shared;
 * see the "WITHOUT needing a build" case below.
 *
 * Deliberately an EQUALITY of the whole map, not a per-key containment check:
 * containment would let `typesVersions` point a subpath at the wrong `.d.ts`
 * and still pass.
 */
const PKG_DIR = join(__dirname, '..', '..');

type Exports = Record<string, { types: string; default: string }>;

type Manifest = {
  types: string;
  exports: Exports;
  typesVersions: Record<string, Record<string, string[]>>;
};

const strip = (p: string) => p.replace(/^\.\//, '');

describe('@karmyq/shared: typesVersions mirrors exports', () => {
  const pkg: Manifest = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'));
  const { exports: exp, typesVersions } = pkg;

  it('has both maps, keyed the way node10 resolution expects', () => {
    // `typesVersions` is keyed by a TypeScript VERSION range; '*' means "all".
    // A typo here (e.g. '>=4.0') silently disables the whole map, so assert the
    // key set rather than just reading typesVersions['*'].
    expect(Object.keys(typesVersions)).toEqual(['*']);
    expect(Object.keys(exp).length).toBeGreaterThan(1);
  });

  /** `./dist/src/matching/types.d.ts` -> `src/matching/types.ts`. */
  const sourceOf = (typesPath: string) =>
    strip(typesPath).replace(/^dist\//, '').replace(/\.d\.ts$/, '.ts');

  it('maps exactly the exports subpaths, each to the SOURCE its types file is built from', () => {
    // Compared as sorted entry PAIRS, not by building an object with computed
    // property names. `expected[subpath] = ...` is a write whose key comes from
    // parsed JSON, which CodeQL correctly flags as js/remote-property-injection
    // (high) — a subpath literally named `__proto__` would pollute the object
    // rather than be recorded, and the comparison would silently weaken.
    // Pairs carry the same whole-map equality with no prototype surface at all.
    //
    // Worth not rationalising away as "it's only a test": PR 2 waved past a
    // CodeQL js/command-line-injection finding on the same reasoning and it was
    // a real defect.
    const expected = Object.entries(exp)
      // '.' is the package root, covered by top-level `types`, not typesVersions.
      .filter(([subpath]) => subpath !== '.')
      .map(([subpath, entry]) => [strip(subpath), [sourceOf(entry.types)]] as const)
      .sort(([a], [b]) => a.localeCompare(b));

    const actual = Object.entries(typesVersions['*']).sort(([a], [b]) => a.localeCompare(b));

    // Catches a missing subpath, an extra one, AND a subpath pointed at the
    // wrong file.
    expect(actual).toEqual(expected);
  });

  it('the root export is covered by the top-level "types" field', () => {
    expect(strip(pkg.types)).toBe(strip(exp['.'].types));
  });

  it('every source file typesVersions points at exists — WITHOUT needing a build', () => {
    // This is the assertion that matters most, and it is deliberately about
    // SOURCE rather than `dist`.
    //
    // typesVersions originally pointed at `dist/**/*.d.ts`. That passed here
    // (packages/shared#test dependsOn packages/shared#build, so dist always
    // exists in this suite) while breaking CI's `Lint & Type Check` job, which
    // runs `tsc --noEmit` on consumers WITHOUT building shared first. Consumers
    // on `moduleResolution: node` had always resolved these subpaths straight
    // to shared's source; typesVersions silently redirected them at dist and
    // they got TS2307.
    //
    // Pointing at source removes the build dependency from TYPE resolution
    // entirely, so a consumer type-checks identically built or not. Note this
    // suite could never have caught that on its own — the property is about
    // what other workspaces see, and this gate's own build guarantee hid it.
    const missing = Object.values(typesVersions['*'])
      .flat()
      .filter((rel) => !existsSync(join(PKG_DIR, rel)));

    expect(missing).toEqual([]);
  });

  it('every declaration file the exports map names exists on disk', () => {
    // Build-dependent, and legitimately so: `exports` drives RUNTIME resolution
    // and runtime genuinely needs dist. Guaranteed here by test-dependsOn-build.
    const missing = Object.values(exp)
      .map((e) => strip(e.types))
      .filter((rel) => !existsSync(join(PKG_DIR, rel)));

    expect(missing).toEqual([]);
  });

  it('every runtime entry point exists too', () => {
    const missing = Object.values(exp)
      .map((e) => strip(e.default))
      .filter((rel) => !existsSync(join(PKG_DIR, rel)));

    expect(missing).toEqual([]);
  });
});
