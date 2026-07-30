import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Enforces the invariant that `RouteParams` (packages/shared/middleware/auth.ts) relies on.
 *
 * Express 5 / path-to-regexp 8 type route params as `string | string[]` because a repeatable
 * segment (`:ids+`) or a wildcard (`*splat`) captures an array. Karmyq narrows params back to
 * `string` repo-wide, which is accurate ONLY while no route declares such a segment. This test
 * is what keeps that from silently becoming a lie: add a wildcard or repeatable route and it
 * fails, telling you to widen that handler's own generic instead of the shared type.
 */

const REPO_ROOT = join(__dirname, '..', '..');

const SCAN_ROOTS = [
  join(REPO_ROOT, 'services'),
  join(REPO_ROOT, 'packages', 'shared'),
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.turbo', 'tests']);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      found.push(...sourceFiles(full));
    } else if (/\.(ts|js)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

/** `router.get('/x/:id', ...)`, `app.post("/y", ...)`, `app.use('/z', ...)` — the literal only. */
const ROUTE_CALL =
  /\b(?:router|app|[A-Za-z_$][\w$]*Router)\s*\.\s*(?:get|post|put|patch|delete|options|head|all|use)\s*\(\s*(['"`])([^'"`]*)\1/g;

interface RouteLiteral {
  file: string;
  path: string;
}

function collectRoutes(): RouteLiteral[] {
  const routes: RouteLiteral[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of sourceFiles(root)) {
      const src = readFileSync(file, 'utf8');
      for (const match of src.matchAll(ROUTE_CALL)) {
        const path = match[2];
        // `app.use(express.json())`-style calls have no string literal, so they never match.
        // Only keep things that look like mount paths.
        if (!path.startsWith('/')) continue;
        routes.push({ file: relative(REPO_ROOT, file).split('\\').join('/'), path });
      }
    }
  }
  return routes;
}

describe('Sprint 122 — Express 5 route params stay single-valued', () => {
  const routes = collectRoutes();

  it('finds a substantial set of route literals (proves the scan is wired to real files)', () => {
    // Guards against the scan silently matching nothing and the assertions below passing
    // for the wrong reason. Recon counted 197 unique literals repo-wide; this scan covers
    // services/ + packages/shared, so require a floor well above zero but below that.
    expect(routes.length).toBeGreaterThan(100);
    expect(new Set(routes.map((r) => r.file)).size).toBeGreaterThan(10);
  });

  it('declares no wildcard route (`*` would make req.params.<name> a string[])', () => {
    const offenders = routes.filter((r) => r.path.includes('*'));
    expect(offenders.map((r) => `${r.file}: ${r.path}`)).toEqual([]);
  });

  it('declares no repeatable param (`:name+` would make req.params.name a string[])', () => {
    const offenders = routes.filter((r) => /:[A-Za-z_$][\w$]*\+/.test(r.path));
    expect(offenders.map((r) => `${r.file}: ${r.path}`)).toEqual([]);
  });

  it('declares no legacy path-to-regexp group syntax that express 5 rejects', () => {
    // `(`/`)` groups and a trailing `?` optional marker were removed in path-to-regexp 8;
    // they now throw at route-registration time rather than degrading quietly.
    const offenders = routes.filter((r) => /[()]/.test(r.path) || /:[A-Za-z_$][\w$]*\?/.test(r.path));
    expect(offenders.map((r) => `${r.file}: ${r.path}`)).toEqual([]);
  });
});
