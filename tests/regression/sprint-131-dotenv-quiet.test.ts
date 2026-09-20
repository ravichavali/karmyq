/**
 * Sprint 131 D1: every dotenv `config()` call is quiet.
 *
 * dotenv 17 flipped the default. In 16.6.1 `config()` computed
 * `quiet = 'quiet' in options ? options.quiet : true` — silent unless you asked for logs. In 17.4.2
 * it is `quiet = parseBoolean(DOTENV_CONFIG_QUIET || options?.quiet)`, so with no options it is
 * FALSY and every call prints:
 *
 *   ◇ injected env (1) from .env // tip: ⌘ enable debugging { debug: true }
 *
 * The tip is drawn at random from an 8-entry array that includes third-party promo URLs. It also
 * logs when there is NO .env at all (`injected env (0) from .env`), which is exactly the deployed
 * container's state — the Dockerfiles copy no .env and compose injects `environment:` directly. So
 * without this every backend logs a non-deterministic line that claims to have read a file that is
 * not there. Measured against both installed versions, not read from a changelog.
 *
 * Call sites are discovered from tracked source rather than hardcoded, so a NEW service that calls
 * `config()` without `quiet` fails here instead of quietly polluting deploy logs. That discovery
 * already earned its keep: it caught two calls in `tests/setup.ts` a hand-written list had missed.
 *
 * Known limits, asserted rather than assumed where possible:
 * - `import 'dotenv/config'` performs the call inside dotenv and takes no options, so it cannot be
 *   quieted at the call site (only via `DOTENV_CONFIG_QUIET`). No tracked file uses it, and a test
 *   below pins that, so adopting the form is a deliberate decision rather than a silent regression.
 * - A specifier built at runtime (`require(name)`) is invisible; only static forms are resolved.
 */
import * as ts from 'typescript';

import { read, tracked } from './helpers/workspaces';

type ConfigCall = { line: number; hasQuiet: boolean; text: string };

/**
 * Parsing a `.tsx` file as plain TS can find NOTHING and say nothing about it: TypeScript's error
 * recovery swallows the JSX and the statements after it never become nodes, so the file silently
 * contributes zero calls while the suite stays green (measured: 0 calls, 4 parse diagnostics, no
 * throw). The scan claims to cover `.tsx`, so it has to actually parse it as TSX.
 */
const SCRIPT_KIND: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
};

const SOURCE_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'];
const GENERATED = /(^|\/)(dist|\.next|build)\//;
/**
 * Deliberately just the word. A "precise" prefilter is a second, weaker parser sitting in front of
 * the real one, and it silently skipped valid imports: `from\n'dotenv'` (newline after `from`) and
 * `require( 'dotenv' )` (spaces inside the call) both failed a shape-matching regex, so such a file
 * was never parsed and its noisy `config()` passed. Matching the bare word over-selects by a few
 * files and lets the AST — the only thing that actually knows — decide.
 */
const MENTIONS_DOTENV = /dotenv/;

/** Files that mention dotenv at all, with their source. The AST decides what really imports it. */
function dotenvFiles(): Array<{ file: string; source: string }> {
  return tracked(...SOURCE_GLOBS)
    .filter((f) => !GENERATED.test(f))
    .map((file) => ({ file, source: read(file) }))
    .filter(({ source }) => MENTIONS_DOTENV.test(source));
}

/** `parseDiagnostics` is real but internal — it is not on the public SourceFile type. */
type ParsedSourceFile = ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] };

/**
 * Every dotenv config() call in one file, with whether it is quiet.
 *
 * Resolves which local identifiers are actually bound to dotenv — default import, namespace import,
 * destructured `config`, and the CommonJS `require('dotenv')` forms — so a `config()` imported from
 * somewhere else is never counted.
 */
function configCalls(file: string, source: string): ConfigCall[] {
  const kind = SCRIPT_KIND[file.slice(file.lastIndexOf('.'))] ?? ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind) as ParsedSourceFile;

  // A file this scan cannot parse must go RED, not contribute zero calls. Error recovery is silent,
  // so without this the coverage claim degrades to "whatever happened to parse".
  const diagnostics = sf.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const first = ts.flattenDiagnosticMessageText(diagnostics[0].messageText, ' ');
    throw new Error(`${file}: ${diagnostics.length} parse error(s), first: ${first}`);
  }

  // Local names bound to dotenv's `config`, and to the dotenv module object.
  const configNames = new Set<string>();
  const moduleNames = new Set<string>();

  const isDotenvRequire = (node: ts.Node): boolean =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require' &&
    !!node.arguments[0] &&
    ts.isStringLiteralLike(node.arguments[0]) &&
    (node.arguments[0] as ts.StringLiteralLike).text === 'dotenv';

  // Deliberately a RECURSIVE walk, not a pass over sf.statements. Scanning only top-level
  // statements looks tidier and silently drops a `require('dotenv')` bound inside a block or an
  // IIFE — the file is still discovered, resolves to zero calls, and passes vacuously.
  const collectBindings = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text === 'dotenv') {
      const clause = node.importClause;
      if (clause?.name) moduleNames.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) moduleNames.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if ((el.propertyName ?? el.name).text === 'config') configNames.add(el.name.text);
        }
      }
    } else if (
      // `import dotenv = require('dotenv')`
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression) &&
      node.moduleReference.expression.text === 'dotenv'
    ) {
      moduleNames.add(node.name.text);
    } else if (ts.isVariableDeclaration(node) && node.initializer && isDotenvRequire(node.initializer)) {
      if (ts.isIdentifier(node.name)) moduleNames.add(node.name.text);
      if (ts.isObjectBindingPattern(node.name)) {
        for (const el of node.name.elements) {
          if ((el.propertyName ?? el.name).getText(sf) === 'config' && ts.isIdentifier(el.name)) {
            configNames.add(el.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(sf);

  const out: ConfigCall[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isDotted =
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'config' &&
        // a bound name (`dotenv.config()`) or the require call itself (`require('dotenv').config()`)
        ((ts.isIdentifier(callee.expression) && moduleNames.has(callee.expression.text)) ||
          isDotenvRequire(callee.expression));
      const isBare = ts.isIdentifier(callee) && configNames.has(callee.text);

      if (isDotted || isBare) {
        const arg = node.arguments[0];
        // Evaluate the object literal IN ORDER, because JS last-one-wins. Taking the first `quiet`
        // lets a later override sneak through: `{ quiet: true, ...{ quiet: false } }` is genuinely
        // noisy (verified against 17.4.2) and would otherwise pass.
        //
        // Only the literal `true` counts. The key alone proves nothing, and neither does "not
        // false": dotenv runs the value through parseBoolean, so `0`, `undefined`, `null` and the
        // STRING `'false'` are all falsy and all still print. A spread could contribute any `quiet`,
        // so it resets the state to unproven — which correctly keeps `{ ...base, quiet: true }`
        // passing while rejecting `{ quiet: true, ...base }`.
        let proven = false;
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const prop of arg.properties) {
            // A spread can contribute any `quiet`, so it resets the proof.
            if (ts.isSpreadAssignment(prop)) {
              proven = false;
              continue;
            }
            const n = prop.name;

            // A computed key whose value we cannot read might BE `quiet`:
            // `{ quiet: true, ['qui' + 'et']: false }` overrides at runtime and genuinely logs
            // (verified against 17.4.2). Unresolvable keys invalidate the proof, like a spread.
            // A statically-known computed key (`['quiet']`) is treated as the plain name.
            let keyText: string | undefined;
            if (n && ts.isComputedPropertyName(n)) {
              if (ts.isStringLiteralLike(n.expression)) {
                keyText = n.expression.text;
              } else {
                proven = false;
                continue;
              }
            } else if (n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n))) {
              keyText = n.text;
            }

            if (keyText !== 'quiet') continue;
            // Shorthand (`{ quiet }`), a method, or a getter is not a provable `true` either.
            proven = ts.isPropertyAssignment(prop) && prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
          }
        }
        const hasQuiet = proven;

        out.push({
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          hasQuiet,
          text: node.getText(sf).replace(/\s+/g, ' '),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const files = dotenvFiles();
const calls = files.flatMap(({ file, source }) => configCalls(file, source).map((c) => ({ file, ...c })));

describe('dotenv config() is quiet (Sprint 131 D1)', () => {
  it('resolves a call in every service that imports dotenv, so the scan is not vacuous', () => {
    // Derived from `calls`, not from the file list: this proves the binding resolution actually
    // resolved, which a file-list check does not. Pins EVERY site, not just services/ — a call
    // under tests/ that stopped resolving would otherwise vanish unnoticed.
    expect(calls.map((c) => `${c.file}:${c.line}`).sort()).toEqual([
      'services/auth-service/src/index.ts:18',
      'services/cleanup-service/src/index.ts:24',
      'services/community-service/src/index.ts:34',
      'services/messaging-service/src/index.ts:15',
      'services/notification-service/src/index.ts:21',
      'services/reputation-service/src/index.ts:26',
      'services/request-service/src/index.ts:35',
      'services/simulation-service/src/index.ts:16',
      'tests/e2e/playwright.config.ts:4',
      'tests/e2e/tests/fixtures/auth.ts:4',
      'tests/integration/setup.ts:32',
      'tests/load/load-test.ts:18',
      'tests/setup.ts:12',
      'tests/setup.ts:13',
    ]);

    // The complement matters as much as the list: these two genuinely do not import dotenv, so a
    // mis-scoped scan cannot hide behind a shrinking expectation.
    const importers = new Set(files.map((f) => f.file.split('/')[1]));
    expect(importers.has('social-graph-service')).toBe(false);
    expect(importers.has('geocoding-service')).toBe(false);
  });

  it('detects every binding form, and ignores a config() that is not dotenv', () => {
    const detect = (src: string, file = 'x.ts') => configCalls(file, src).map((c) => c.hasQuiet);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config();")).toEqual([false]);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config({ quiet: true });")).toEqual([true]);
    expect(detect("import * as dotenv from 'dotenv';\ndotenv.config({ path: 'x' });")).toEqual([false]);
    expect(detect("import { config } from 'dotenv';\nconfig({ path: 'x', quiet: true });")).toEqual([true]);
    // CommonJS, which the discovery regex admits and so must be resolvable
    expect(detect("const dotenv = require('dotenv');\ndotenv.config();")).toEqual([false]);
    expect(detect("const { config } = require('dotenv');\nconfig({ quiet: true });")).toEqual([true]);
    expect(detect("import dotenv = require('dotenv');\ndotenv.config();")).toEqual([false]);
    // the require call used directly, with no binding at all
    expect(detect("require('dotenv').config();")).toEqual([false]);
    // bound inside a block rather than at the top level
    expect(detect("function boot(){ const d = require('dotenv'); d.config(); }")).toEqual([false]);
    // a `config` that is not dotenv's must not be picked up
    expect(detect("import { config } from 'elsewhere';\nconfig();")).toEqual([]);
  });

  it('discovers awkwardly-spelled imports, because the prefilter must not act as a second parser', () => {
    // Regression: a shape-matching prefilter skipped both of these, so the file was never parsed
    // and its noisy config() passed. Discovery is tested here, not just configCalls().
    const awkward = [
      "import dotenv from\n'dotenv';\ndotenv.config();",
      "const d = require( 'dotenv' );\nd.config();",
      "import  *  as  dotenv  from  'dotenv'\ndotenv.config()",
    ];
    for (const source of awkward) {
      expect([source, MENTIONS_DOTENV.test(source)]).toEqual([source, true]);
      // and once discovered, the AST must actually resolve the call as not-quiet
      expect([source, configCalls('x.ts', source).map((c) => c.hasQuiet)]).toEqual([source, [false]]);
    }
    // a file merely naming dotenv contributes nothing, so over-selecting is safe
    expect(configCalls('x.ts', '// we use dotenv here\nconst x = 1;')).toEqual([]);
  });

  it('respects property order, so a later spread cannot be overridden away', () => {
    const detect = (src: string) => configCalls('x.ts', src).map((c) => c.hasQuiet);
    const imp = "import dotenv from 'dotenv';\n";
    // genuinely noisy (verified against 17.4.2) — last one wins
    expect(detect(imp + 'dotenv.config({ quiet: true, ...{ quiet: false } });')).toEqual([false]);
    expect(detect(imp + 'dotenv.config({ quiet: true, ...base });')).toEqual([false]);
    expect(detect(imp + 'dotenv.config({ quiet: true, quiet: false });')).toEqual([false]);
    // a spread BEFORE an explicit quiet: true is fine — the literal wins
    expect(detect(imp + 'dotenv.config({ ...base, quiet: true });')).toEqual([true]);
  });

  it('treats an unresolvable computed key as invalidating, because it might be quiet', () => {
    const detect = (src: string) => configCalls('x.ts', src).map((c) => c.hasQuiet);
    const imp = "import dotenv from 'dotenv';\n";
    // genuinely noisy (verified against 17.4.2): the computed key overwrites quiet at runtime
    expect(detect(imp + "dotenv.config({ quiet: true, ['qui' + 'et']: false });")).toEqual([false]);
    expect(detect(imp + 'dotenv.config({ quiet: true, [key]: false });')).toEqual([false]);
    // a statically-known computed key is readable, so it is treated as the plain name
    expect(detect(imp + "dotenv.config({ ['quiet']: true });")).toEqual([true]);
    expect(detect(imp + "dotenv.config({ quiet: true, ['other']: false });")).toEqual([true]);
    // an explicit quiet: true AFTER the unresolvable key restores the proof
    expect(detect(imp + 'dotenv.config({ [key]: false, quiet: true });')).toEqual([true]);
    // shorthand and non-assignment forms cannot be proven true
    expect(detect(imp + 'dotenv.config({ quiet });')).toEqual([false]);
  });

  it('accepts only the literal true, because dotenv runs the value through parseBoolean', () => {
    const detect = (src: string) => configCalls('x.ts', src).map((c) => c.hasQuiet);
    // Every one of these is falsy to dotenv and still prints (verified against dotenv 17.4.2).
    for (const value of ['false', '0', 'undefined', 'null', "'false'"]) {
      expect(detect(`import dotenv from 'dotenv';\ndotenv.config({ quiet: ${value} });`)).toEqual([false]);
    }
    // a spread or a variable cannot be proven quiet, so it is conservatively not quiet
    expect(detect("import dotenv from 'dotenv';\ndotenv.config(opts);")).toEqual([false]);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config({ ...opts });")).toEqual([false]);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config({ quiet: true });")).toEqual([true]);
  });

  it('parses .tsx as TSX, so a call after JSX is not silently lost', () => {
    // Regression: parsed as ScriptKind.TS this found 0 calls and produced 4 parse diagnostics with
    // no throw — the file would have contributed nothing and the gate stayed green.
    const tsx =
      "import dotenv from 'dotenv';\n" +
      'function C() { const a = <div className="x">hi</div>; dotenv.config(); return a; }';
    expect(configCalls('x.tsx', tsx).map((c) => c.hasQuiet)).toEqual([false]);
  });

  it('fails loudly on a file it cannot parse, rather than scanning nothing', () => {
    expect(() => configCalls('broken.ts', 'function ( { unclosed')).toThrow(/parse error/);
  });

  it("no tracked file uses import 'dotenv/config', which cannot be quieted at the call site", () => {
    const sideEffect = tracked(...SOURCE_GLOBS)
      .filter((f) => !GENERATED.test(f))
      // This file names the form in its docstring and in this test's own title.
      .filter((f) => f !== 'tests/regression/sprint-131-dotenv-quiet.test.ts')
      .filter((f) => /['"]dotenv\/config['"]/.test(read(f)));
    expect(sideEffect).toEqual([]);
  });

  it('every dotenv config() call is quiet', () => {
    const noisy = calls.filter((c) => !c.hasQuiet).map((c) => `${c.file}:${c.line} ${c.text}`);
    expect(noisy).toEqual([]);
  });
});
