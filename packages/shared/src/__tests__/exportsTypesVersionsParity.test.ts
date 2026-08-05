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
 * Every `exports` subpath has a `typesVersions` entry pointing at the SAME
 * declaration file, and vice versa. A new subpath added to `exports` alone
 * compiles fine for the app (Node reads `exports`) and fails only in a
 * consumer's ts-jest run — a slow, confusing failure this gate turns into an
 * immediate one.
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

  it('maps exactly the exports subpaths, each to the exports entry\'s own types file', () => {
    const expected: Record<string, string[]> = {};
    for (const [subpath, entry] of Object.entries(exp)) {
      // '.' is the package root, covered by top-level `types`, not typesVersions.
      if (subpath === '.') continue;
      expected[strip(subpath)] = [strip(entry.types)];
    }

    // Whole-map equality: catches a missing subpath, an extra one, AND a
    // subpath pointed at the wrong declaration file.
    expect(typesVersions['*']).toEqual(expected);
  });

  it('the root export is covered by the top-level "types" field', () => {
    expect(strip(pkg.types)).toBe(strip(exp['.'].types));
  });

  it('every declaration file the maps point at exists on disk', () => {
    // packages/shared#test dependsOn packages/shared#build (turbo.json), so
    // dist/ is guaranteed here. A missing file means the build layout moved
    // and both maps are now lying.
    const missing = Object.values(typesVersions['*'])
      .flat()
      .concat(strip(exp['.'].types))
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
