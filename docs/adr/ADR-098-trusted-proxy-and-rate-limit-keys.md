# ADR-098: Trusted Proxy Hop and Rate Limit Key Derivation

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** ravichavali
**Supersedes:** none
**Related:** [ADR-074](ADR-074-api-response-contract.md), [ADR-097](ADR-097-ecosystem-knowledge-registry.md)

## Context

`packages/shared/middleware/rateLimit.ts` is the one rate limiter every HTTP service uses. Its
`keyGenerator` returned `user:<userId>` for authenticated requests and `undefined` for everyone
else, with a comment stating that `undefined` selected express-rate-limit's "default IP-based key
generation".

No such fallback exists. In both 7.5.1 and 8.7.0 the library does `const key = await
config.keyGenerator(...)` and passes the result straight to `store.increment(key)`. An `undefined`
key is simply a key named `undefined`, shared by every caller that produces it. This was found
during Sprint 131 D3 and filed as BUG-049.

Three facts discovered while fixing it turned out to matter more than the original report.

**The `user:<userId>` branch was unreachable.** Across all 1022 tracked JS/TS files there are 62
limiter references in eight services. At *every* mount site the limiter is positioned ahead of
`authMiddleware`, and `app.use(globalRateLimiter)` is app-level, so `req.user` was never set when
the key was computed. There is no counterexample in the repository. Every request, authenticated
or not, keyed to `undefined`.

**So the exposure was site-wide throttling, not just a login lockout.** `rateLimiters.standard` is
a module-level singleton; request-service mounts it on roughly twelve route groups
(`src/index.ts:76-181`), all sharing one 60-per-minute bucket across the entire user base. Turning
rate limiting on without fixing this would have throttled the whole demo. That is the likeliest
reason `RATE_LIMIT_DISABLED=true` was set on the demo host in the first place — the flag masked a
defect rather than merely relaxing a limit.

**Keying by IP is only meaningful if `req.ip` is the client.** No service set `trust proxy`, so
`req.ip` was the Docker gateway address for every proxied request. The original report concluded
that nginx also needed a forwarded-for header. It does not: every `location` block in
`infrastructure/nginx/nginx.conf` ends with `include /etc/nginx/proxy_params;`, a host file outside
this repository. Read read-only on the demo host on 2026-09-22, it sets `X-Real-IP` and
`X-Forwarded-For $proxy_add_x_forwarded_for`, and `nginx -T` confirms it is included in all 25
proxying location blocks. The repository file looked incomplete only because the relevant lines
live in an included file that is not tracked here.

## Decision

Derive rate limit keys from the client IP when the request is anonymous, and trust exactly one
proxy hop in every service that mounts a limiter.

### 1. The key generator falls back to `ipKeyGenerator`, never `undefined`

```ts
keyGenerator: (req: Request) => {
  const userId = (req as any).user?.userId;
  if (userId) {
    return `user:${userId}`;
  }
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown');
},
```

`ipKeyGenerator` is express-rate-limit's own exported helper. It returns IPv4 unchanged and narrows
IPv6 to a `/56`, so a host cannot escape its bucket by rotating addresses inside its own prefix.
`req.socket.remoteAddress` is a fail-closed fallback: if neither address is available the caller
shares the `unknown` bucket rather than escaping limiting altogether.

The `user:<userId>` branch is kept even though it is currently unreachable. It is correct wherever
a limiter is mounted after `authMiddleware`, and deleting it would discard the behaviour the
presets document. Its unreachability is recorded in `packages/shared/CONTEXT.md` and
`docs/IDEAS.md` rather than silently tolerated.

### 2. Every limiter-mounting service sets `trust proxy` to exactly `1`

```ts
app.set('trust proxy', 1);
```

Applied to the eight services whose source mounts a limiter: auth, cleanup, community, messaging,
notification, reputation, request, social-graph. geocoding-service mounts none and is excluded.

**Why `1` and not `true`.** `true` trusts the entire chain, so Express takes the leftmost
`X-Forwarded-For` entry — which the client controls. That would let any caller spoof `req.ip` and
escape its bucket at will, turning a correctness fix into a security regression.

**Why `1` and not `'loopback'`.** nginx runs on the host, not in a container (it is absent from
`docker-compose.prod.yml`), and proxies to `127.0.0.1:300X` published ports. From inside the
container the peer is the Docker gateway, e.g. `172.18.0.1`. `'loopback'` would not match it, and
the header would be ignored.

**Why one hop is spoof-proof here.** `karmyq.com` resolves to a single A record with no CNAME, so
nothing fronts nginx. `$proxy_add_x_forwarded_for` *appends* the real client to whatever the client
sent, so the trustworthy value is always last. Probed against the installed express 5.2.1 and
proxy-addr 2.0.7:

| `X-Forwarded-For` sent by the client | resulting `req.ip` |
|---|---|
| *(none)* | socket address |
| `203.0.113.9` | `203.0.113.9` |
| `9.9.9.9, 203.0.113.9` | `203.0.113.9` |
| `1.1.1.1, 2.2.2.2, 9.9.9.9, 203.0.113.9` | `203.0.113.9` |

A forged chain of any length cannot move `req.ip` off the client nginx observed.

**This value is topology-bound.** If anything is ever placed in front of nginx — a CDN, a load
balancer, Cloudflare — the hop count changes and `1` becomes wrong in the spoofable direction.
`docs/ARCHITECTURE.md` lists a CDN as a future consideration, so this is a live risk, not a
hypothetical. Any such change must revisit this ADR.

### 3. No nginx change

`infrastructure/nginx/nginx.conf` is already correct via `proxy_params`. Adding duplicate
`proxy_set_header` lines would be redundant at best, and at worst would shadow the host file with a
copy that drifts from it.

### 4. Both halves are gated

`tests/regression/sprint-131-rate-limit-trust-proxy.test.ts` derives the service list from
`services/registry.json` and the services' own source at run time, then asserts the `trust proxy`
call by TypeScript AST — the call shape and a numeric `1`, so a commented-out line, `true`, or the
words inside a string all fail. Deriving the list rather than hard-coding it means a future service
that mounts a limiter without trusting the proxy is caught automatically.

Each assertion was proven able to fail by injection, reverted after each: `true` in auth-service,
the line commented out in request-service, `return undefined` restored in the shared middleware, and
an emptied registry — which fails the discovery assertion rather than vacuously passing zero
per-service cases.

Per-IP behaviour itself is proven behaviourally in
`packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts`: two client IPs get two
buckets, a spoofed `X-Forwarded-For` prefix cannot escape, IPv6 keys by `/56`, and the authenticated
branch keys by user independent of IP.

## Consequences

**Rate limiting becomes safe to enable.** It is not enabled by this decision. The demo still runs
`RATE_LIMIT_DISABLED=true`, sourced from `~/karmyq/.env.demo` where an archived seed script appended
a second assignment that overrides the first. Flipping it is a demo operation requiring its own
authorization, and until it happens login has no brute-force limit.

**Limits are per-IP, not per-user, everywhere.** Callers behind one NAT share a bucket; one user on
two networks gets two. This is a real behavioural difference from what `RateLimitPresets` documents,
and it is the honest description of what the system does today. Making per-user keying live requires
moving limiters after `authMiddleware` in seven services, which would also stop them protecting
those routes against anonymous floods. Deferred to its own design pass, recorded in `docs/IDEAS.md`
[2026-09-22].

**`trust proxy` is now load-bearing.** A service that mounts a limiter without it silently collapses
to one bucket again. The gate exists precisely because that failure is invisible at runtime until
someone is wrongly throttled.

**Local development is unaffected.** With no proxy and no `X-Forwarded-For`, `req.ip` is the socket
address, which is the correct per-client key in that topology.
