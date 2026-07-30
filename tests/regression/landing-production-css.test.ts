/**
 * Sprint 121 (v11.35.1) — production-CSS guards for the Tailwind v4 migration.
 *
 * WHY THIS EXISTS, and why it asserts on built CSS rather than on rendered pages:
 *
 * v11.35.0 shipped a landing site that declared `font-family: Fraunces` but never loaded the font.
 * `globals.css` had `@import 'tailwindcss'` ABOVE the Google Fonts `@import url(...)`. Tailwind v4
 * inlines the whole framework at its own @import, so the font import was no longer at the top of the
 * stylesheet — invalid CSS in that position — and the production optimizer dropped it silently.
 *
 * Every other check passed: the build succeeded, tests were green, and a computed-style diff against
 * production could not see it, because an unloaded font computes the *identical* `font-family`
 * string as a loaded one. Only the absence of the `@import` in the emitted bundle reveals it.
 * All 16 pre-migration stylesheets on the demo server carried the import; the v11.35.0 build did not.
 *
 * These tests read each app's built `.next/static/css` bundle when present. They SKIP (not fail) when the app
 * has not been built, so they stay useful locally without forcing a build, while still guarding CI —
 * `ci.yml`'s `build-landing` job builds the landing app before the suite runs.
 */
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * Built stylesheets for an app, from either the Next build dir or the static export.
 * `out/` is the artifact actually deployed to the demo server, so it is checked too.
 */
function builtStylesheets(app: string): string[] {
  const dirs = [
    path.join(REPO_ROOT, 'apps', app, '.next', 'static', 'css'),
    path.join(REPO_ROOT, 'apps', app, 'out', '_next', 'static', 'css'),
  ];
  return dirs
    .filter((d) => fs.existsSync(d))
    .flatMap((d) =>
      fs
        .readdirSync(d)
        .filter((f) => f.endsWith('.css'))
        .map((f) => path.join(d, f))
    );
}

/**
 * Where build output MUST exist, its absence is a failure rather than a skip — otherwise these
 * assertions pass vacuously, which is the same silent-nothing failure mode this file exists to
 * prevent.
 *
 * Keyed on an explicit opt-in, NOT on `CI`: GitHub Actions sets `CI=true` in *every* job, and the
 * general test job legitimately has no landing build. `ci.yml`'s `build-landing` job sets
 * `REQUIRE_LANDING_BUILD=1` after building, so strictness applies exactly where the artifact lives.
 * Everywhere else (the plain test job, local runs) the built-CSS checks skip while the source-order,
 * `@utility` and `@reference` checks below still run — those need no build.
 */
const REQUIRE_BUILD = !!process.env.REQUIRE_LANDING_BUILD;

/** Returns sheets, asserting presence under CI. Empty array means "skip" locally. */
function requireStylesheets(app: string): string[] {
  const sheets = builtStylesheets(app);
  if (REQUIRE_BUILD) {
    // Fail loudly rather than skip: a missing build here means the guard is not actually running.
    expect(sheets.length).toBeGreaterThan(0);
  }
  return sheets;
}

/** Every `@import` of the Google Fonts CSS API in a stylesheet, as match indices. */
function fontImportIndices(css: string): number[] {
  const re = /@import\s+(?:url\(\s*)?["']?https:\/\/fonts\.googleapis\.com/g;
  return Array.from(css.matchAll(re), (m) => m.index as number);
}

/** Index of the first actual style rule / layer block, i.e. the point after which @import is invalid. */
function firstRuleIndex(css: string): number {
  const candidates = [css.indexOf('@layer'), css.search(/[^\s]\s*\{/)].filter((i) => i >= 0);
  return candidates.length ? Math.min(...candidates) : css.length;
}

/**
 * Blank out comments while preserving byte offsets, so ordering assertions compare real code.
 * Necessary because globals.css documents this very constraint in a comment that quotes
 * `@import 'tailwindcss'` — matching inside the comment inverts the result.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

/** Asserts a stylesheet loads remote fonts before pulling Tailwind in. */
function expectFontImportBeforeTailwind(file: string): void {
  const css = stripComments(fs.readFileSync(file, 'utf8'));
  const fontImport = css.search(/@import\s+url\(["']?https:\/\/fonts\.googleapis\.com/);
  const tailwindImport = css.search(/@import\s+["']tailwindcss["']/);
  expect(fontImport).toBeGreaterThanOrEqual(0);
  expect(tailwindImport).toBeGreaterThanOrEqual(0);
  expect(fontImport).toBeLessThan(tailwindImport);
}

describe('landing production CSS (Tailwind v4)', () => {
  it('has build output to assert against (fails in CI, skips locally)', () => {
    const sheets = requireStylesheets('landing');
    if (!sheets.length) console.warn('apps/landing not built — production-CSS assertions skipped');
  });

  it('emits exactly one Google Fonts @import across the built CSS', () => {
    const sheets = requireStylesheets('landing');
    if (!sheets.length) return;
    // Count per physical stylesheet, then across the bundle. `.next` and `out` hold copies of the
    // same sheet, so dedupe by basename before summing.
    const byName = new Map<string, string>();
    for (const f of sheets) byName.set(path.basename(f), fs.readFileSync(f, 'utf8'));
    const total = Array.from(byName.values()).reduce((n, css) => n + fontImportIndices(css).length, 0);
    // Exactly one: zero is the v11.35.0 regression; more than one means a duplicated import.
    expect(total).toBe(1);
  });

  it('places the font @import before any rule, so browsers do not ignore it', () => {
    const sheets = requireStylesheets('landing');
    if (!sheets.length) return;
    let checked = 0;
    for (const file of sheets) {
      const css = fs.readFileSync(file, 'utf8');
      for (const idx of fontImportIndices(css)) {
        // An @import after the first rule is invalid CSS and silently dropped by the browser.
        expect(idx).toBeLessThan(firstRuleIndex(css));
        checked++;
      }
    }
    // Guard the guard: if nothing was inspected the assertion above proved nothing.
    expect(checked).toBeGreaterThan(0);
  });

  it('imports the families it declares — Fraunces and Inter', () => {
    const sheets = requireStylesheets('landing');
    if (!sheets.length) return;
    const all = Array.from(new Set(sheets.map((f) => fs.readFileSync(f, 'utf8')))).join('\n');
    const importLine = all.slice(all.search(/@import[^;]*fonts\.googleapis[^;]*/));
    expect(all).toMatch(/Fraunces/);
    // The declared family must actually appear in the import URL, not just in a font-family rule.
    expect(importLine).toMatch(/family=Fraunces/);
    expect(importLine).toMatch(/family=Inter/);
  });
});

describe('globals.css source ordering (both apps)', () => {
  it('landing imports remote fonts before Tailwind, or the optimizer drops the import', () => {
    expectFontImportBeforeTailwind(path.join(REPO_ROOT, 'apps/landing/src/app/globals.css'));
  });

  it('frontend imports remote fonts before Tailwind (same constraint)', () => {
    expectFontImportBeforeTailwind(path.join(REPO_ROOT, 'apps/frontend/src/styles/globals.css'));
  });
});

describe('Tailwind v4 @apply / @utility contract', () => {
  const frontendGlobals = path.join(REPO_ROOT, 'apps/frontend/src/styles/globals.css');
  const shell = path.join(REPO_ROOT, 'apps/frontend/src/styles/karmyq-shell.css');

  it('declares every class that another rule @applies as @utility, not @layer components', () => {
    const css = fs.readFileSync(frontendGlobals, 'utf8');
    // Names declared as custom utilities, e.g. `@utility btn-primary {`
    const utilities = new Set(Array.from(css.matchAll(/@utility\s+([a-zA-Z0-9_-]+)/g), (m) => m[1]));
    // Names declared as plain component classes inside @layer components
    const componentsBlock = css.slice(css.indexOf('@layer components'));
    const componentClasses = new Set(
      Array.from(componentsBlock.matchAll(/^\s*\.([a-zA-Z0-9_-]+)/gm), (m) => m[1])
    );
    // Every token @apply'd anywhere that is one of our own class names must be a @utility.
    const applied = Array.from(css.matchAll(/@apply\s+([^;]+);/g)).flatMap((m) =>
      m[1].split(/\s+/).filter(Boolean).map((t) => t.replace(/^[a-z-]+:/, ''))
    );
    const violations = applied.filter((t) => componentClasses.has(t) && !utilities.has(t));
    expect(violations).toEqual([]);
  });

  it('keeps the @reference in karmyq-shell.css, which is compiled standalone', () => {
    // Without it every @apply in this file resolves to nothing — silently, with no build error.
    const css = fs.readFileSync(shell, 'utf8');
    expect(css).toMatch(/@reference\s+["'][^"']*globals\.css["']/);
    expect(css).toMatch(/@apply/);
  });
});
