import * as path from 'path';
import * as ts from 'typescript';
import { ROOT, read, tracked, allServicePaths } from './helpers/workspaces';

/**
 * BUG-049 gate (ADR-098). Two invariants:
 *   1. Every service that mounts a rate limiter sets `app.set('trust proxy', 1)`.
 *   2. The shared key generator never returns undefined.
 *
 * The service list is derived from services/registry.json and the services' own tracked source at
 * run time — never hand-listed here — so a new limiter-mounting service cannot slip past.
 *
 * **Both `.ts` and `.js` are scanned.** The first draft of this gate was `.ts`-only and silently
 * missed geocoding-service, which mounts two limiters in `src/geocodingApp.js` and is proxied by
 * nginx. A language-shaped hole in a discovery gate is indistinguishable from a pass.
 *
 * Deliberate limit: this reads source, so it proves the call is written, not that it executed. The
 * behavioural proof that keys are per-IP is in
 * packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts.
 */

/** Matches a limiter mount. `createRateLimiter(` does not match — capital R. */
const LIMITER_USE = /globalRateLimiter|rateLimiters\.|rateLimit\(/;

/**
 * Every tracked service source file, read once.
 *
 * `services/*\/src/*.ts` and not `.../src/**\/*.ts`: git pathspec `*` crosses `/`, and the `**`
 * form silently drops every `src/index.ts` — which is exactly where `trust proxy` is set. That
 * spelling would have made this gate pass while checking nothing.
 */
const SOURCES: ReadonlyMap<string, string> = new Map(
  tracked('services/*/src/*.ts', 'services/*/src/*.js').map((rel) => [rel, read(rel)]),
);

/** Services from the registry whose own source mounts a rate limiter. */
const LIMITER_SERVICES: { name: string; dir: string; files: string[] }[] = allServicePaths()
  .map((dir) => ({
    name: path.basename(dir),
    dir,
    files: [...SOURCES.keys()].filter((rel) => rel.startsWith(`${dir}/src/`)),
  }))
  .filter(({ files }) => files.some((rel) => LIMITER_USE.test(SOURCES.get(rel) as string)));

/**
 * True only for a real `<expr>.set('trust proxy', 1)` call with a NUMERIC 1.
 *
 * A substring search would pass on a commented-out line, on `app.set('trust proxy', true)`, and on
 * the words inside an unrelated string, so this walks the AST and checks the call shape.
 */
const setsTrustProxyToOne = (source: string, fileName: string): boolean => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'set' &&
      node.arguments.length === 2 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === 'trust proxy' &&
      ts.isNumericLiteral(node.arguments[1]) &&
      node.arguments[1].text === '1'
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};

describe('BUG-049: trusted proxy and rate limit keys', () => {
  it('discovers the limiter-mounting services from the registry and tracked source', () => {
    // Guards against the discovery itself returning nothing, which would make every per-service
    // case below vacuously pass. The file scan must be non-empty too, for the same reason.
    expect(SOURCES.size).toBeGreaterThan(100);
    expect(LIMITER_SERVICES.map((s) => s.name).sort()).toEqual([
      'auth-service',
      'cleanup-service',
      'community-service',
      'geocoding-service',
      'messaging-service',
      'notification-service',
      'reputation-service',
      'request-service',
      'social-graph-service',
    ]);
  });

  it.each(LIMITER_SERVICES.map((s) => [s.name, s.files] as const))(
    '%s sets trust proxy to exactly 1',
    (_name, files) => {
      // Narrowing to files that contain the literal cannot hide a match: an AST hit implies the
      // string is present. It is a superset filter, not a second parser.
      const candidates = files.filter((rel) => (SOURCES.get(rel) as string).includes('trust proxy'));
      const hit = candidates.find((rel) =>
        setsTrustProxyToOne(SOURCES.get(rel) as string, path.join(ROOT, rel)),
      );
      expect(hit).toBeDefined();
    },
  );

  it('the shared key generator never returns undefined', () => {
    const source = read('packages/shared/middleware/rateLimit.ts');

    expect(source).toContain('ipKeyGenerator');
    // The exact shape of the old bug: `return undefined as any;`
    expect(source).not.toMatch(/return\s+undefined\b/);
  });
});
