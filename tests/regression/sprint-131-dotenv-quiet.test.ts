/**
 * Sprint 131 D1: every dotenv `config()` call passes `quiet`.
 *
 * dotenv 17 flipped the default. In 16.6.1 `config()` computed
 * `quiet = 'quiet' in options ? options.quiet : true` — silent unless you asked for logs. In 17.4.2
 * it is `quiet = parseBoolean(DOTENV_CONFIG_QUIET || options?.quiet)`, so with no options it is
 * FALSY and every call prints:
 *
 *   ◇ injected env (1) from .env // tip: ⌘ enable debugging { debug: true }
 *
 * The tip is drawn at random from an 8-entry array that includes third-party promo URLs, so without
 * this every backend container logs a non-deterministic marketing line on each boot. Measured
 * empirically against both versions, not read from a changelog.
 *
 * The call sites are discovered from tracked source, so a NEW service that calls `config()` without
 * `quiet` fails here rather than quietly polluting deploy logs. That discovery already earned its
 * keep: it caught two calls in `tests/setup.ts` that a hand-written list had missed.
 */
import * as ts from 'typescript';

import { read, tracked } from './helpers/workspaces';

/** Files that import dotenv, with their source. */
function dotenvFiles(): Array<{ file: string; source: string }> {
  return tracked('*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs')
    .filter((f) => !/(^|\/)(dist|\.next|build)\//.test(f))
    .map((file) => ({ file, source: read(file) }))
    .filter(({ source }) => /from ['"]dotenv['"]|require\(['"]dotenv['"]\)/.test(source));
}

/**
 * Every dotenv config() call in one file, with whether it passes a `quiet` property.
 * Handles both `dotenv.config(...)` and a destructured `config(...)` imported from dotenv.
 */
function configCalls(file: string, source: string): Array<{ line: number; hasQuiet: boolean; text: string }> {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // Local names bound to dotenv's `config` via `import { config } from 'dotenv'`.
  const destructured = new Set<string>();
  // Local names bound to the dotenv namespace or default export.
  const namespaces = new Set<string>();

  const collectImports = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'dotenv'
    ) {
      const clause = node.importClause;
      if (clause?.name) namespaces.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if ((el.propertyName ?? el.name).text === 'config') destructured.add(el.name.text);
        }
      }
    }
    ts.forEachChild(node, collectImports);
  };
  collectImports(sf);

  const out: Array<{ line: number; hasQuiet: boolean; text: string }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isDotted =
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'config' &&
        ts.isIdentifier(callee.expression) &&
        namespaces.has(callee.expression.text);
      const isBare = ts.isIdentifier(callee) && destructured.has(callee.text);

      if (isDotted || isBare) {
        const arg = node.arguments[0];
        const hasQuiet =
          !!arg &&
          ts.isObjectLiteralExpression(arg) &&
          arg.properties.some((p) => {
            const n = p.name;
            return !!n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) && n.text === 'quiet';
          });
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
  it('finds the dotenv callers, so the scan is not vacuous', () => {
    // Identity, not a count: a service dropping or gaining dotenv changes this list visibly.
    const services = files
      .map((f) => f.file)
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
    expect(calls.length).toBeGreaterThanOrEqual(services.length);
  });

  it('detects both call forms, and ignores a non-dotenv config()', () => {
    const detect = (src: string) => configCalls('x.ts', src).map((c) => c.hasQuiet);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config();")).toEqual([false]);
    expect(detect("import dotenv from 'dotenv';\ndotenv.config({ quiet: true });")).toEqual([true]);
    expect(detect("import * as dotenv from 'dotenv';\ndotenv.config({ path: 'x' });")).toEqual([false]);
    expect(detect("import { config } from 'dotenv';\nconfig({ path: 'x', quiet: true });")).toEqual([true]);
    // a `config` that is not dotenv's must not be picked up
    expect(detect("import { config } from 'elsewhere';\nconfig();")).toEqual([]);
  });

  it('every dotenv config() call passes quiet', () => {
    const noisy = calls.filter((c) => !c.hasQuiet).map((c) => `${c.file}:${c.line} ${c.text}`);
    expect(noisy).toEqual([]);
  });
});
