import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * BUG-049 gate. Two invariants:
 *   1. Every service that mounts a rate limiter sets `app.set('trust proxy', 1)`.
 *   2. The shared key generator never returns undefined.
 *
 * The service list is derived from services/registry.json and the services' own
 * source at run time — not from a hand-written list here — so a new service that
 * mounts a limiter without trusting the proxy cannot slip past this gate.
 *
 * Deliberate limits of this gate: it reads source, so it proves the call is
 * written, not that it executed. The behavioural proof that the key is per-IP
 * lives in packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts.
 */
const repoRoot = path.resolve(__dirname, '../..');
const registry = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'services/registry.json'), 'utf8'),
) as { services: Record<string, { path?: string }> };

/** Matches a limiter mount. `createRateLimiter(` does not match — capital R. */
const LIMITER_USE = /globalRateLimiter|rateLimiters\.\w+|(?<![\w.])rateLimit\(/;

const tsFilesUnder = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsFilesUnder(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });
};

/** Services from the registry whose source actually mounts a rate limiter. */
const limiterServices = (): { name: string; dir: string }[] =>
  Object.entries(registry.services)
    .map(([name, meta]) => ({
      name,
      dir: path.join(repoRoot, meta.path ?? `services/${name}`),
    }))
    .filter(({ dir }) =>
      tsFilesUnder(path.join(dir, 'src')).some((file) =>
        LIMITER_USE.test(fs.readFileSync(file, 'utf8')),
      ),
    );

/**
 * True only for a real `<expr>.set('trust proxy', 1)` call with a NUMERIC 1.
 *
 * A substring search would pass on a commented-out line, on
 * `app.set('trust proxy', true)`, and on the words inside an unrelated string,
 * so this walks the AST and checks the call shape and the literal.
 */
const setsTrustProxyToOne = (source: string, fileName: string): boolean => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'set' &&
      node.arguments.length === 2 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.arguments[0] as ts.StringLiteralLike).text === 'trust proxy' &&
      ts.isNumericLiteral(node.arguments[1]) &&
      (node.arguments[1] as ts.NumericLiteral).text === '1'
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};

describe('BUG-049: trusted proxy and rate limit keys', () => {
  it('discovers the limiter-mounting services from the registry', () => {
    const names = limiterServices().map((service) => service.name).sort();

    // Guards against the discovery itself silently returning nothing, which
    // would make every per-service case below vacuously pass.
    expect(names.length).toBeGreaterThanOrEqual(8);
    expect(names).toEqual(
      expect.arrayContaining([
        'auth-service',
        'cleanup-service',
        'community-service',
        'messaging-service',
        'notification-service',
        'reputation-service',
        'request-service',
        'social-graph-service',
      ]),
    );
  });

  it.each(limiterServices().map((service) => [service.name, service.dir] as const))(
    '%s sets trust proxy to exactly 1',
    (_name, dir) => {
      const files = tsFilesUnder(path.join(dir, 'src'));
      const hit = files.find((file) =>
        setsTrustProxyToOne(fs.readFileSync(file, 'utf8'), file),
      );
      expect(hit).toBeDefined();
    },
  );

  it('the shared key generator never returns undefined', () => {
    const file = path.join(repoRoot, 'packages/shared/middleware/rateLimit.ts');
    const source = fs.readFileSync(file, 'utf8');

    expect(source).toContain('ipKeyGenerator');
    // The exact shape of the old bug: `return undefined as any;`
    expect(source).not.toMatch(/return\s+undefined\b/);
  });
});
