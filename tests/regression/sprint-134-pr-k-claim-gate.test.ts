/**
 * Sprint 134 PR K (BUG-069, ADR-102): authorization re-derives the caller's role from
 * `communities.members`. The JWT `communities` claim is a login-time snapshot (and holds at most 15
 * communities, auth-service `JWT_COMMUNITIES_LIMIT`), so a gate that reads it keeps a demoted or
 * removed admin's powers until the token expires.
 *
 * This gate parses every tracked service source file and the shared middleware with the TypeScript
 * AST and holds three rules. Each has a negative fixture below proving it can fail, and the first run
 * of this file against the unfixed tree failed on every claim read the PR K inventory classified.
 *
 * 1. Claim reads: an access of `communities` / `communityMemberships` on a user object (`user`,
 *    `decoded`, or any `.user` property), by dot, bracket or destructuring, must be one of the
 *    reviewed hint-only reads in ALLOWLIST. Matching is by identity (file, enclosing scope, line
 *    text), both ways: every read has an entry and every entry still has its read.
 * 2. Every call to a live-role helper is awaited. An un-awaited call is a truthy Promise, which
 *    turns `if (!isLiveAdmin(...))` into a gate that admits everyone.
 * 3. No service reads the shared tenant middleware's claim-derived `communityRole`, or uses its
 *    `adminOnlyMiddleware` (which decides from that field). That keeps H5 below a dead hint.
 */
import * as ts from 'typescript';

import { read, tracked } from './helpers/workspaces';

type SourceFile = { path: string; text: string };

const CLAIM_FIELDS = new Set(['communities', 'communityMemberships']);
const USER_IDENTIFIERS = new Set(['user', 'decoded']);
const LIVE_ROLE_HELPERS = new Set([
  'getLiveRole',
  'isLiveAdmin',
  'isLiveAdminOfAnyCommunity',
  'hasLiveRoleInRequestCommunities',
  'isActiveAdmin',
  'isActiveMember',
]);
const TENANT_ROLE_NAMES = new Set(['communityRole', 'adminOnlyMiddleware']);

/** Hint-only claim reads (plan *Inventory* H1–H5). Nothing here decides access. */
const ALLOWLIST: Array<{ path: string; scope: string; line: string; reason: string }> = [
  {
    path: 'services/auth-service/src/routes/auth.ts',
    scope: "router.get '/verify'",
    line: 'communities: decoded.communities || [],',
    reason: 'H1: the issuer echoes the verified token back to its holder',
  },
  {
    path: 'services/request-service/src/routes/providers.ts',
    scope: "router.patch '/:providerId/availability'",
    line: 'const memberships = req.user!.communities ?? [];',
    reason: 'H2: provider_went_on_duty fan-out; the push carries only a count of open requests',
  },
  {
    path: 'services/request-service/src/routes/requests.ts',
    scope: 'handleCuratedFeed',
    line: 'const primaryCommunityId = communityId || (req as any).user?.communities?.[0]?.id;',
    reason: "H3: picks the default community for the caller's own effective trust params",
  },
  {
    path: 'services/simulation-service/src/scripts/rehearseMariaRelationshipStory.ts',
    scope: 'loginPersona',
    line: 'const communityIds = ((user.communities ?? []) as Array<{ id: string }>).map(c => c.id);',
    reason: 'H4: an API client reading its own login response',
  },
  {
    path: 'services/simulation-service/src/scripts/rotateMariaStories.ts',
    scope: 'createLiveStories',
    line: 'const mariaCommunities: Array<{ id?: string }> = mariaAuth.user?.communities ?? [];',
    reason: 'H4: an API client reading its own login response',
  },
  {
    path: 'services/simulation-service/src/scripts/rotateMariaStories.ts',
    scope: 'createLiveStories',
    line: 'const helperCommunities: Array<{ id?: string }> = helperAuth.user?.communities ?? [];',
    reason: 'H4: an API client reading its own login response',
  },
  {
    path: 'packages/shared/middleware/tenant.ts',
    scope: 'tenantMiddleware',
    line: 'const userCommunity = req.user.communities.find(c => c.id === communityId);',
    reason: 'H5: sets req.communityRole, which rule 3 proves no service reads',
  },
  {
    path: 'packages/shared/middleware/tenant.ts',
    scope: 'optionalTenantMiddleware',
    line: 'const userCommunity = req.user.communities.find(c => c.id === communityId);',
    reason: 'H5: sets req.communityRole, which rule 3 proves no service reads',
  },
];

// Tracked files only (the live arbiter); `**` needs :(glob) magic or git silently drops src/index.ts.
const loadSources = (): SourceFile[] =>
  tracked(':(glob)services/*/src/**/*.ts', ':(glob)packages/shared/middleware/**/*.ts')
    .filter((p) => !p.includes('/__tests__/'))
    .map((path) => ({ path, text: read(path) }));

/** Strip the wrappers that do not change which object is read: `x!`, `(x)`, `x as T`, `<T>x`. */
function unwrap(node: ts.Expression): ts.Expression {
  let n = node;
  while (ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) {
    n = n.expression;
  }
  return n;
}

const isUserObject = (node: ts.Expression): boolean => {
  const n = unwrap(node);
  return (ts.isIdentifier(n) && USER_IDENTIFIERS.has(n.text)) || (ts.isPropertyAccessExpression(n) && n.name.text === 'user');
};

/** Nearest named function, else nearest `router.<verb>('<path>')`-style call, else `<module>`. */
function scopeOf(node: ts.Node): string {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression)) {
      const [first] = n.arguments;
      if (first && ts.isStringLiteralLike(first)) return `${n.expression.expression.text}.${n.expression.name.text} '${first.text}'`;
    }
  }
  return '<module>';
}

const parentOf = (node: ts.Node): ts.Node | undefined => {
  let p = node.parent;
  while (p && ts.isParenthesizedExpression(p)) p = p.parent;
  return p;
};

/** `await helper(...)`, or an element of the array passed to an awaited `Promise.all(...)`. */
function isAwaited(call: ts.CallExpression): boolean {
  const parent = parentOf(call);
  if (parent && ts.isAwaitExpression(parent)) return true;
  if (!parent || !ts.isArrayLiteralExpression(parent)) return false;
  const all = parentOf(parent);
  return !!all && ts.isCallExpression(all) && all.arguments[0] === parent
    && ts.isPropertyAccessExpression(all.expression) && all.expression.getText() === 'Promise.all'
    && ts.isAwaitExpression(parentOf(all) ?? all);
}

function violations(files: SourceFile[]): string[] {
  const out: string[] = [];
  const used = new Set<number>();

  for (const file of files) {
    const sf = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const where = (node: ts.Node) => `${file.path}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
    const lineText = (node: ts.Node) => file.text.split(/\r?\n/)[sf.getLineAndCharacterOfPosition(node.getStart(sf)).line].trim();
    const isService = file.path.startsWith('services/');

    const claimRead = (node: ts.Node) => {
      const scope = scopeOf(node);
      const text = lineText(node);
      const index = ALLOWLIST.findIndex((e, i) => !used.has(i) && e.path === file.path && e.scope === scope && e.line === text);
      if (index >= 0) used.add(index);
      else out.push(`claim read ${where(node)} [${scope}] ${text}`);
    };

    const visit = (node: ts.Node) => {
      if (ts.isPropertyAccessExpression(node) && CLAIM_FIELDS.has(node.name.text) && isUserObject(node.expression)) claimRead(node);
      if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
        && CLAIM_FIELDS.has(node.argumentExpression.text) && isUserObject(node.expression)) claimRead(node);
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && isUserObject(node.initializer)) {
        for (const el of node.name.elements) {
          const key = el.propertyName ?? el.name;
          if ((ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && CLAIM_FIELDS.has(key.text)) claimRead(el);
        }
      }
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression);
        const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
        if (LIVE_ROLE_HELPERS.has(name) && !isAwaited(node)) out.push(`unawaited ${name}() ${where(node)}`);
      }
      if (isService && ts.isIdentifier(node) && TENANT_ROLE_NAMES.has(node.text)) out.push(`tenant claim role ${node.text} ${where(node)}`);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  ALLOWLIST.forEach((e, i) => {
    if (!used.has(i)) out.push(`stale allowlist entry ${e.path} [${e.scope}] ${e.line}`);
  });
  return out;
}

describe('Sprint 134 PR K: role gates read live membership, not the JWT claim (ADR-102)', () => {
  const live = loadSources();
  const base = violations(live);
  const added = (fixture: SourceFile) => violations([...live, fixture]).filter((v) => !base.includes(v));
  const fixture = (text: string): SourceFile => ({ path: 'services/request-service/src/routes/fixture.ts', text });

  it('the live source has no violations', () => {
    expect(base).toEqual([]);
  });

  it('scans enough to mean something', () => {
    const paths = live.map((f) => f.path);
    expect(paths.filter((p) => /^services\/[^/]+\/src\/index\.ts$/.test(p)).length).toBeGreaterThanOrEqual(9);
    expect(paths.length).toBeGreaterThanOrEqual(200);
    expect(paths).toContain('packages/shared/middleware/tenant.ts');
  });

  describe('negative fixtures: each rule can fail', () => {
    it('flags a dot read of the claim on req.user', () => {
      expect(added(fixture("router.put('/x', (req: any, res: any) => {\n  if (req.user!.communities.some((m: any) => m.role === 'admin')) res.end();\n});")))
        .toEqual(["claim read services/request-service/src/routes/fixture.ts:2 [router.put '/x'] if (req.user!.communities.some((m: any) => m.role === 'admin')) res.end();"]);
    });
    it('flags a bracket read through a cast and optional chain', () => {
      expect(added(fixture("export function f(req: any) {\n  return (req as any).user?.['communities'];\n}")))
        .toEqual(["claim read services/request-service/src/routes/fixture.ts:2 [f] return (req as any).user?.['communities'];"]);
    });
    it('flags a destructured claim', () => {
      expect(added(fixture('export function g(req: any) {\n  const { communities } = req.user;\n  return communities;\n}')))
        .toEqual(['claim read services/request-service/src/routes/fixture.ts:2 [g] const { communities } = req.user;']);
    });
    it('flags the legacy communityMemberships alias', () => {
      expect(added(fixture('export function h(user: any) {\n  return user.communityMemberships;\n}')))
        .toEqual(['claim read services/request-service/src/routes/fixture.ts:2 [h] return user.communityMemberships;']);
    });
    it('does not flag a destructured result of a function call (a DB-built list)', () => {
      expect(added(fixture('export async function j(b: any) {\n  const { communities } = await b();\n  return communities;\n}'))).toEqual([]);
    });
    it('flags an un-awaited live-role call', () => {
      expect(added(fixture('export async function k(c: string, u: string) {\n  if (!isLiveAdmin(c, u)) return false;\n  return true;\n}')))
        .toEqual(['unawaited isLiveAdmin() services/request-service/src/routes/fixture.ts:2']);
    });
    it('accepts an awaited, parenthesized live-role call', () => {
      expect(added(fixture('export async function m(c: string, u: string) {\n  return (await getLiveRole(c, u)) === "admin";\n}'))).toEqual([]);
    });
    it('accepts a live-role call inside an awaited Promise.all', () => {
      expect(added(fixture('export async function p(c: string, u: string) {\n  const [r] = await Promise.all([getLiveRole(c, u), q()]);\n  return r;\n}'))).toEqual([]);
    });
    it('flags a live-role call inside an un-awaited Promise.all', () => {
      expect(added(fixture('export function s(c: string, u: string) {\n  return Promise.all([isLiveAdmin(c, u)]).then(([a]) => a);\n}')))
        .toEqual(['unawaited isLiveAdmin() services/request-service/src/routes/fixture.ts:2']);
    });
    it('flags a service reading the tenant middleware role', () => {
      expect(added(fixture("export function n(req: any) {\n  return req.communityRole === 'admin';\n}")))
        .toEqual(['tenant claim role communityRole services/request-service/src/routes/fixture.ts:2']);
    });
    it('flags an allowlist entry whose read is gone', () => {
      const withoutVerify = live.map((f) => (f.path === 'services/auth-service/src/routes/auth.ts'
        ? { ...f, text: f.text.replace('communities: decoded.communities || [],', 'communities: [],') } : f));
      expect(violations(withoutVerify).filter((v) => !base.includes(v)))
        .toEqual(["stale allowlist entry services/auth-service/src/routes/auth.ts [router.get '/verify'] communities: decoded.communities || [],"]);
    });
  });
});
