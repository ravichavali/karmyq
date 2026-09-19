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
const IMPORTS_DOTENV = /from ['"]dotenv['"]|require\(['"]dotenv['"]\)/;

/** Files that import dotenv, with their source. */
function dotenvFiles(): Array<{ file: string; source: string }> {
  return tracked(...SOURCE_GLOBS)
    .filter((f) => !GENERATED.test(f))
    .map((file) => ({ file, source: read(file) }))
    .filter(({ source }) => IMPORTS_DOTENV.test(source));
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

  // Import declarations are top-level statements; a `require` binding is a top-level variable
  // statement. Neither needs a recursive walk.
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteralLike(stmt.moduleSpecifier) && stmt.moduleSpecifier.text === 'dotenv') {
      const clause = stmt.importClause;
      if (clause?.name) moduleNames.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) moduleNames.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if ((el.propertyName ?? el.name).text === 'config') configNames.add(el.name.text);
        }
      }
      continue;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!decl.initializer || !isDotenvRequire(decl.initializer)) continue;
        if (ts.isIdentifier(decl.name)) moduleNames.add(decl.name.text);
        if (ts.isObjectBindingPattern(decl.name)) {
          for (const el of decl.name.elements) {
            if ((el.propertyName ?? el.name).getText(sf) === 'config' && ts.isIdentifier(el.name)) {
              configNames.add(el.name.text);
            }
          }
        }
      }
    }
  }

  const out: ConfigCall[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isDotted =
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'config' &&
        ts.isIdentifier(callee.expression) &&
        moduleNames.has(callee.expression.text);
      const isBare = ts.isIdentifier(callee) && configNames.has(callee.text);

      if (isDotted || isBare) {
        const arg = node.arguments[0];
        const quietProp =
          arg && ts.isObjectLiteralExpression(arg)
            ? arg.properties.find((p) => {
                const n = p.name;
                return !!n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) && n.text === 'quiet';
              })
            : undefined;
        // The KEY is not enough: `{ quiet: false }` would satisfy a presence check while printing
        // exactly the line this gate exists to stop.
        const hasQuiet =
          !!quietProp &&
          ts.isPropertyAssignment(quietProp) &&
          quietProp.initializer.kind !== ts.SyntaxKind.FalseKeyword;

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
    // resolved in each file, which a file-list check does not.
    const services = calls
      .map((c) => c.file)
      .filter((f) => f.startsWith('services/'))
      .sort();
    expect(services).toEqual([
      'services/auth-service/src/index.ts',
      'services/cleanup-service/src/index.ts',
      'services/community-service/src/index.ts',
      'services/messaging-service/src/index.ts',
      'services/notification-service/src/index.ts',
      'services/reputation-service/src/index.ts',
      'services/request-service/src/index.ts',
      'services/simulation-service/src/index.ts',
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
    // a `config` that is not dotenv's must not be picked up
    expect(detect("import { config } from 'elsewhere';\nconfig();")).toEqual([]);
  });

  it('treats quiet: false as not quiet, because the key alone proves nothing', () => {
    const detect = (src: string) => configCalls('x.ts', src).map((c) => c.hasQuiet);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config({ quiet: false });")).toEqual([false]);
    // a spread or a variable cannot be proven quiet, so it is conservatively not quiet
    expect(detect("import dotenv from 'dotenv';\ndotenv.config(opts);")).toEqual([false]);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config({ ...opts });")).toEqual([false]);
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
