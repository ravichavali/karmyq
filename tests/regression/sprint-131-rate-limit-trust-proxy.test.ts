import * as path from 'path';
import * as ts from 'typescript';
import { ROOT, read, tracked, allServicePaths } from './helpers/workspaces';

/**
 * BUG-049 / ADR-098 gate.
 *
 * The invariant is about TOPOLOGY, not about rate limiting: a service must trust exactly one proxy
 * hop **if and only if** nginx proxies it. Both directions matter, and the second one is not
 * theoretical — an earlier draft of this gate asserted "every service that mounts a limiter sets
 * trust proxy", and that rule put `trust proxy` on cleanup-service, which nginx does not proxy.
 * There `req.ip` had been the unforgeable socket address; trusting a hop
 * that does not exist made it a client-supplied header, and cleanup's adminRateLimiter is mounted
 * ahead of adminAuthMiddleware. A symptom-shaped rule produced a security regression, so the rule
 * now derives from the thing that actually decides the answer. (cleanup is not unreachable — it
 * publishes 127.0.0.1:3008 and sits on the Docker network — it simply has no proxy in front, so
 * there is no hop to trust.)
 *
 * Two live arbiters, both read at run time:
 *   - `infrastructure/nginx/nginx.conf` upstreams — who is proxied.
 *   - `services/registry.json` — which services exist, and on which port.
 *
 * Both `.ts` and `.js` are scanned. The first draft was `.ts`-only and silently missed
 * geocoding-service, which mounts two limiters in `src/geocodingApp.js`. A language-shaped hole in
 * a discovery gate is indistinguishable from a pass.
 *
 * Deliberate limit: this reads source, so it proves the call is written, not that it executed. The
 * behavioural proof that keys are per-IP is in
 * packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts.
 */

const NGINX_CONF = read('infrastructure/nginx/nginx.conf');

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

/** Ports nginx has an upstream for — the live arbiter of "is this service proxied". */
const PROXIED_PORTS: ReadonlySet<number> = new Set(
  [...NGINX_CONF.matchAll(/upstream\s+\w+\s*\{[^}]*?server\s+127\.0\.0\.1:(\d+)/g)].map((m) =>
    Number(m[1]),
  ),
);

type Service = { name: string; proxied: boolean; files: string[] };

const SERVICES: Service[] = (() => {
  const registry = JSON.parse(read('services/registry.json')) as {
    services: Record<string, { path: string; port?: number | null }>;
  };
  return allServicePaths().map((dir) => {
    const name = path.basename(dir);
    const port = registry.services[name]?.port;
    return {
      name,
      proxied: typeof port === 'number' && PROXIED_PORTS.has(port),
      files: [...SOURCES.keys()].filter((rel) => rel.startsWith(`${dir}/src/`)),
    };
  });
})();

/**
 * True only for a real `<expr>.set('trust proxy', <numeric literal>)` call, returning the literal.
 *
 * A substring search would match a commented-out line and the words inside an unrelated string, so
 * this walks the AST. Returning the value (rather than a boolean) is what lets the test distinguish
 * `1` from `true` and report which it found.
 */
const trustProxyValue = (source: string, fileName: string): string | undefined => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let value: string | undefined;
  const visit = (node: ts.Node): void => {
    if (value !== undefined) return;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'set' &&
      node.arguments.length === 2 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === 'trust proxy'
    ) {
      value = node.arguments[1].getText(sourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return value;
};

/** The `trust proxy` value a service sets, across all of its source files. */
const serviceTrustProxy = (service: Service): string | undefined => {
  // Narrowing to files containing the literal cannot hide a match: an AST hit implies the string is
  // present. It is a superset filter, not a second parser.
  for (const rel of service.files) {
    const source = SOURCES.get(rel) as string;
    if (!source.includes('trust proxy')) continue;
    const value = trustProxyValue(source, path.join(ROOT, rel));
    if (value !== undefined) return value;
  }
  return undefined;
};

const proxied = SERVICES.filter((s) => s.proxied);
const notProxied = SERVICES.filter((s) => !s.proxied);

/** The host file we cannot read from here; assumed to set `$proxy_add_x_forwarded_for` (§3). */
const INCLUDE_PROXY_PARAMS = /^include\s+\S*proxy_params$/i;
/** nginx directive names are lowercase, but an HTTP header name is case-insensitive. */
const SET_HEADER = /^proxy_set_header\s+(\S+)\s+(.*)$/i;

/**
 * Values that leave `X-Forwarded-For` trustworthy under `trust proxy = 1`.
 *
 * `$proxy_add_x_forwarded_for` appends `$remote_addr` last, and `$remote_addr` alone replaces the
 * header outright — both end with an address nginx observed. `$http_x_forwarded_for` forwards
 * whatever the client sent, which is the spoofable case, and an empty value strips the header so
 * `req.ip` collapses back to the gateway.
 */
const SAFE_XFF_VALUES = new Set(['$proxy_add_x_forwarded_for', '$remote_addr']);

const unquote = (value: string): string => value.replace(/^(["'])([\s\S]*)\1$/, '$2');

/**
 * Whether a location block forwards a client IP the client cannot dictate.
 *
 * Directives are split on `;`, nginx's actual terminator — **not** on newlines. An earlier version
 * split by line and matched `X-Forwarded-For` case-sensitively, which was wrong in both directions:
 * a lowercase override alongside an intact `proxy_params` include slipped through (false negative),
 * and a perfectly valid directive wrapped across two lines was rejected (false positive).
 */
const forwardsTrustworthyClientIp = (body: string): boolean => {
  const withoutComments = body
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, ''))
    .join('\n');

  const parts = withoutComments.split(';');
  // Anything after the final `;` is an unterminated directive. Unreadable input must invalidate,
  // never be skipped — skipping it is how a parser-fronted check quietly stops checking.
  if ((parts.pop() ?? '').trim() !== '') return false;

  const directives = parts.map((d) => d.replace(/\s+/g, ' ').trim()).filter(Boolean);

  let safeExplicit = false;
  for (const directive of directives) {
    const match = directive.match(SET_HEADER);
    if (!match || match[1].toLowerCase() !== 'x-forwarded-for') continue;
    // An unsafe explicit override disqualifies the block even if proxy_params is also included:
    // nginx applies the location-level directive.
    if (!SAFE_XFF_VALUES.has(unquote(match[2].trim()))) return false;
    safeExplicit = true;
  }

  return safeExplicit || directives.some((d) => INCLUDE_PROXY_PARAMS.test(d));
};

describe('ADR-098: trusted proxy hop matches the nginx topology', () => {
  it('derives the proxied set from nginx upstreams and the registry', () => {
    // Guards against either arbiter silently yielding nothing, which would make every case below
    // vacuously pass.
    expect(SOURCES.size).toBeGreaterThan(100);
    expect(PROXIED_PORTS.size).toBeGreaterThanOrEqual(8);
    expect(proxied.map((s) => s.name).sort()).toEqual([
      'auth-service',
      'community-service',
      'geocoding-service',
      'messaging-service',
      'notification-service',
      'reputation-service',
      'request-service',
      'social-graph-service',
    ]);
    expect(notProxied.map((s) => s.name).sort()).toEqual(['cleanup-service', 'simulation-service']);
  });

  it.each(proxied.map((s) => [s.name, s] as const))(
    '%s is proxied, so it trusts exactly one hop',
    (_name, service) => {
      expect(serviceTrustProxy(service)).toBe('1');
    },
  );

  it.each(notProxied.map((s) => [s.name, s] as const))(
    '%s is NOT proxied, so it must not trust any hop',
    (_name, service) => {
      // Trusting a non-existent hop makes req.ip a client-supplied header. See the header comment.
      expect(serviceTrustProxy(service)).toBeUndefined();
    },
  );

  it('every proxied nginx location forwards a trustworthy client IP', () => {
    // Per-IP keying rests entirely on X-Forwarded-For reaching the app with a value the client
    // cannot dictate. An earlier version of this check only searched the raw block text for the
    // words, which passed on a COMMENTED-OUT include, on `$http_x_forwarded_for` (the client's own
    // header, forwarded verbatim — spoofable under `trust proxy = 1`) and on `""`. It detected
    // absence but not brokenness. It now strips comments and validates the value.
    const locations = [...NGINX_CONF.matchAll(/location[^{]*\{([^}]*)\}/g)]
      .map((m) => m[1])
      .filter((body) => /proxy_pass\s+http:\/\/\w+_service/.test(body));

    expect(locations.length).toBeGreaterThanOrEqual(20);

    const offenders = locations.filter((body) => !forwardsTrustworthyClientIp(body));
    expect(offenders).toEqual([]);
  });

  it('the shared key generator never returns undefined', () => {
    const source = read('packages/shared/middleware/rateLimit.ts');

    expect(source).toContain('ipKeyGenerator');
    // The exact shape of the old bug: `return undefined as any;`
    expect(source).not.toMatch(/return\s+undefined\b/);
  });
});
