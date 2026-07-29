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

function builtStylesheets(app: string): string[] {
  const dir = path.join(REPO_ROOT, 'apps', app, '.next', 'static', 'css');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => path.join(dir, f));
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
  const sheets = builtStylesheets('landing');

  it('emits at least one stylesheet when the app has been built', () => {
    if (!sheets.length) {
      console.warn('apps/landing not built — skipping production-CSS assertions');
      return;
    }
    expect(sheets.length).toBeGreaterThan(0);
  });

  it('keeps the Google Fonts @import in the built CSS (v11.35.0 regression)', () => {
    if (!sheets.length) return;
    const withFontImport = sheets.filter((f) =>
      /@import\s+(url\()?["']?https:\/\/fonts\.googleapis\.com/.test(fs.readFileSync(f, 'utf8'))
    );
    expect(withFontImport.length).toBeGreaterThan(0);
  });

  it('places the font @import before any rule, so browsers do not ignore it', () => {
    if (!sheets.length) return;
    for (const file of sheets) {
      const css = fs.readFileSync(file, 'utf8');
      const importIndex = css.search(/@import\s+(url\()?["']?https:\/\/fonts\.googleapis\.com/);
      if (importIndex < 0) continue;
      // An @import after the first rule is invalid CSS and silently dropped by the browser.
      expect(importIndex).toBeLessThan(firstRuleIndex(css));
    }
  });

  it('declares the Fraunces family it imports (declaration and load stay in sync)', () => {
    if (!sheets.length) return;
    const all = sheets.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    expect(all).toMatch(/Fraunces/);
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
