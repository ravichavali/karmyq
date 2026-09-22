# BUG-049 — Rate limiter key generation and trusted proxy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared rate limiter key each anonymous caller by their real client IP instead of putting every anonymous caller in one global bucket, so rate limiting can be switched back on without throttling the whole demo.

**Architecture:** Two layers change, not three. `packages/shared/middleware/rateLimit.ts` stops returning `undefined` from `keyGenerator` and returns `ipKeyGenerator(req.ip)` instead; every service that mounts a rate limiter sets `app.set('trust proxy', 1)` so `req.ip` is the client nginx forwarded rather than the Docker gateway. The nginx layer needs **no** change — see *Correction 3* below. A new repo-wide regression gate derives the service list from `services/registry.json` and asserts the trust-proxy setting by TypeScript AST, so a future service cannot silently regress.

**Tech Stack:** TypeScript, Express 5.2.1, express-rate-limit 8.7.0 (`ipKeyGenerator`), proxy-addr 2.0.7, Jest 30 + ts-jest, supertest 7.

**Spec:** `docs/BUGS.md` BUG-049 (lines 1205–1233), **as corrected by the Verified findings section below**. There is no separate design doc; this plan carries the corrections, and Task 5 writes them back into `docs/BUGS.md`.

---

## Global Constraints

- **Dependency lane:** held by Claude. This plan adds **no** dependency and touches **no** manifest except the root `version` bump. If that changes, stop and re-read CLAUDE.md *Workspace dependencies*.
- **ADR required, number NOT self-assigned.** This changes 8 services, so CLAUDE.md's "cross-service change (3+ services) → ADR" applies. **Ask the maintainer to allocate the ADR number before writing the file.** Do not derive it from `docs/adr/`.
- **Do not change `RATE_LIMIT_DISABLED` on the demo host in this PR.** Re-enabling it is a separate demo operation needing its own per-operation authorization, after this ships.
- **Do not change nginx.** `infrastructure/nginx/nginx.conf` is already correct (Correction 3).
- **Version** comes from `origin/master` at merge time, not branch time. At time of writing master is `e5f7d8e1` = 11.63.0.
- **Branch:** `agent/claude/sprint-131-bug-049-rate-limit-key`, cut from `origin/master` at `e5f7d8e1`.
- **Windows box:** no local Docker; use `node -e` for HTTP/JSON probes, not `curl`/`jq`. Run root regression tests as `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`.

---

## Verified findings (read before Task 1)

Each of these was read out of the source or proven by probe on 2026-09-22. They correct `docs/BUGS.md` BUG-049, which was written from a narrower look.

**Correction 1 — the bug is not auth-only.** BUGS.md:1217 says "The only consumer is auth-service." A scan of all 1022 tracked JS/TS files found 62 references; `globalRateLimiter` is mounted app-level in **seven** services: `auth`, `community`, `messaging`, `notification`, `reputation`, `request`, `social-graph`. `cleanup-service` additionally builds its own limiter with a direct `rateLimit()` call at `services/cleanup-service/src/index.ts:83`.

**Correction 2 — the `user:${userId}` branch is unreachable repo-wide, and the real blast radius is bigger than a login lockout.** At *every* mount site the limiter is positioned before `authMiddleware` in the chain (e.g. `services/reputation-service/src/index.ts:69-75`, `services/request-service/src/index.ts:123-129`). `app.use(globalRateLimiter)` is app-level, so it can never see `req.user`. There is no counterexample in the repo. Because `rateLimiters.standard` is a module-level singleton, request-service's ~12 route groups (`src/index.ts:76-181`) currently share **one** 60-per-minute bucket across the entire user base. Switching rate limiting back on without this fix would throttle the whole site, not merely risk a 15-minute `/auth/*` lockout.

**Correction 3 — nginx is already correct; no nginx change is needed.** BUGS.md:1227 says "`infrastructure/nginx/nginx.conf` sets no `X-Forwarded-For`." That is true of the file, but every `location` block ends with `include /etc/nginx/proxy_params;` and that file is not in the repo. Read-only on the demo host on 2026-09-22 (maintainer-authorized):

```
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

`nginx -T` shows it included in all 25 proxying location blocks. nginx runs on the host (it is absent from `infrastructure/docker/docker-compose.prod.yml`) and proxies to `127.0.0.1:300X` published container ports.

**Correction 4 — `trust proxy` must be `1`, and that value is spoof-proof here.** `karmyq.com` resolves to a single A record `132.226.89.171` with no CNAME, so nothing fronts nginx. `$proxy_add_x_forwarded_for` **appends** the real client to whatever the client sent, so the real IP is always last. Probed against the installed express 5.2.1 / proxy-addr 2.0.7 with `trust proxy = 1`:

| `X-Forwarded-For` sent by client | resulting `req.ip` |
|---|---|
| *(none)* | socket address |
| `203.0.113.9` | `203.0.113.9` |
| `9.9.9.9, 203.0.113.9` | `203.0.113.9` |
| `1.1.1.1, 2.2.2.2, 9.9.9.9, 203.0.113.9` | `203.0.113.9` |

A spoofed chain of any length cannot move `req.ip` off the real client. Note `'loopback'` would be **wrong**: from inside the container the peer is the Docker gateway (e.g. `172.18.0.1`), not loopback.

**Correction 5 — `ipKeyGenerator` is a real runtime export, not types-only.** `require('express-rate-limit')` exports `DAY, HOUR, MINUTE, MemoryStore, SECOND, default, ipKeyGenerator, rateLimit`. Behavior: `203.0.113.9` → `203.0.113.9`; `2001:db8:1234:5678:9abc:def0:1234:5678` → `2001:db8:1234:5600::/56`; a non-IP string passes through unchanged rather than throwing.

**Out of scope, deliberately.** Moving the limiters to sit *after* `authMiddleware` (which is what would make per-user keying live) is a behavior change across 7 services and would weaken anonymous-flood protection at those routes. Task 5 logs it to `docs/IDEAS.md` instead.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/middleware/rateLimit.ts` | The one key generator every service shares. Only the `keyGenerator` body and the import line change. | Modify (lines 1, 113–122) |
| `packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts` | Behavioral proof: separate IPs get separate buckets; a spoofed XFF cannot escape; IPv6 keys by /56; the authenticated branch still keys by user. | Create |
| `services/{auth,community,messaging,notification,reputation,request,social-graph,cleanup}-service/src/index.ts` | Each sets `trust proxy` so `req.ip` is the forwarded client. One line each. | Modify (8 files) |
| `tests/regression/sprint-131-rate-limit-trust-proxy.test.ts` | Repo-wide gate: every limiter-mounting service in `services/registry.json` sets `trust proxy` to `1`, asserted by AST; the shared key generator has no `undefined` path. | Create |
| `docs/BUGS.md` | BUG-049 → fixed, with Corrections 1–3 written back. | Modify (lines 1205–1233) |
| `packages/shared/CONTEXT.md` | Line 266 currently describes the unfixed state. | Modify |
| `docs/adr/ADR-{NNN}-trusted-proxy-and-rate-limit-keys.md` + `docs/adr/README.md` | Cross-service decision record. **Number allocated by the maintainer.** | Create |
| `docs/IDEAS.md` | Log the deferred per-user-keying/mount-order follow-up. | Append |
| `.claude/handoff/CURRENT_HANDOFF.md` | Reconcile: BUG-050 shipped, BUG-049 state, D4 next. | Modify |
| `package.json` | Version bump at merge time. | Modify |

---

### Task 1: Fix the shared key generator

**Files:**
- Create: `packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts`
- Modify: `packages/shared/middleware/rateLimit.ts:1` and `:113-122`

**Interfaces:**
- Consumes: `createRateLimiter(config)` from `packages/shared/middleware/rateLimit.ts` (unchanged signature).
- Produces: `createRateLimiter` now returns a limiter whose key is `user:<userId>` when `req.user.userId` is set, and `ipKeyGenerator(req.ip)` otherwise. No other module's API changes.

**Why this test file location:** `packages/shared` does not use the `tdd/`/`regression/` tier layout. Its jest config sets `roots: ['<rootDir>/src']` and `testMatch: ['**/__tests__/**/*.test.ts']`, so a test outside `src/**/__tests__/` is never discovered. `sprint-116-demo-session-guard.test.ts` is the naming precedent.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../../middleware/rateLimit';

/**
 * BUG-049: `keyGenerator` returned `undefined` for anonymous requests, and
 * express-rate-limit has no fallback for an undefined key — so every anonymous
 * caller counted against ONE shared bucket. These tests pin per-IP keying.
 *
 * `trust proxy` is set to 1 here to mirror the demo topology: one nginx hop,
 * appending the real client IP last in X-Forwarded-For.
 */
const buildAnonymousApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(createRateLimiter({ windowMs: 60_000, max: 1, message: 'Slow down' }));
  app.get('/limited', (_req, res) => {
    res.json({ success: true });
  });
  return app;
};

describe('shared rate limiter key generation (BUG-049)', () => {
  it('gives two different client IPs two separate buckets', async () => {
    const app = buildAnonymousApp();

    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(200);
    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(429);

    // The second client has spent nothing; it must still get its own first hit.
    await request(app).get('/limited').set('X-Forwarded-For', '198.51.100.4').expect(200);
  });

  it('ignores a client-supplied X-Forwarded-For prefix, so a spoofer cannot escape its own bucket', async () => {
    const app = buildAnonymousApp();

    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(200);
    // nginx appends the real client LAST; anything the client forged sits to its left.
    await request(app)
      .get('/limited')
      .set('X-Forwarded-For', '9.9.9.9, 203.0.113.9')
      .expect(429);
  });

  it('keys an IPv6 client by its /56 subnet', async () => {
    const app = buildAnonymousApp();

    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8:1234:5600::1').expect(200);
    // Same /56 — a host must not escape its bucket by rotating within its own prefix.
    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8:1234:5622::2').expect(429);
    // Different /56 — a separate bucket.
    await request(app).get('/limited').set('X-Forwarded-For', '2001:db8:9999:0000::1').expect(200);
  });

  it('keys an authenticated request by user id, independent of IP', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use((req, _res, next) => {
      (req as unknown as { user: { userId: string } }).user = { userId: 'user-1' };
      next();
    });
    app.use(createRateLimiter({ windowMs: 60_000, max: 1, message: 'Slow down' }));
    app.get('/limited', (_req, res) => {
      res.json({ success: true });
    });

    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.9').expect(200);
    // Same user, different IP — still one bucket.
    await request(app).get('/limited').set('X-Forwarded-For', '198.51.100.4').expect(429);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `npm exec --workspace=packages/shared -- jest src/middleware/__tests__/sprint-131-rate-limit-key.test.ts --runInBand`

Expected: **3 of 4 fail.**
- "two different client IPs" fails on the third request: `expected 200, got 429` — the second IP is already exhausted because both shared the `undefined` key.
- "IPv6 client by its /56" fails the same way on the third request.
- "ignores a client-supplied X-Forwarded-For prefix" — check carefully. It may *pass* before the fix for the wrong reason (all keys are `undefined`, so of course the second request is limited). Note that in the commit message; it becomes a real assertion only after Step 3.
- "keys an authenticated request by user id" passes before and after — it pins the branch that already worked.

If instead the whole file errors with "Cannot find module", the import depth is wrong: the file is at `src/middleware/__tests__/`, and `rateLimit.ts` is at `packages/shared/middleware/`, so `'../../../middleware/rateLimit'` is correct.

- [ ] **Step 3: Fix the key generator**

In `packages/shared/middleware/rateLimit.ts`, change the import on line 1:

```ts
import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';
```

and replace the `keyGenerator` (lines 113–122) with:

```ts
    // Use the user ID when the request is authenticated, otherwise the client IP.
    //
    // BUG-049: this used to return `undefined` for anonymous requests, on the
    // assumption that express-rate-limit would fall back to its IP-based default.
    // It does not — it calls `store.increment(undefined)`, so every anonymous
    // caller shared ONE bucket. `ipKeyGenerator` is the library's own helper; it
    // returns IPv4 unchanged and narrows IPv6 to a /56 so a single host cannot
    // rotate addresses inside its own prefix.
    //
    // `req.ip` is only the real client when the service sets `trust proxy`
    // (see ADR-{NNN}); `req.socket.remoteAddress` is the fail-closed fallback.
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.userId;
      if (userId) {
        return `user:${userId}`;
      }
      return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    },
```

Note on the `user:` branch: it is currently unreachable at every mount site in the repo (Correction 2). It is kept because it is correct wherever a limiter is mounted after `authMiddleware`, and the presets document per-user limits. Do not delete it in this PR.

- [ ] **Step 4: Run the tests and confirm all four pass**

Run: `npm exec --workspace=packages/shared -- jest src/middleware/__tests__/sprint-131-rate-limit-key.test.ts --runInBand`
Expected: **4 passed.**

- [ ] **Step 5: Confirm the pre-existing limiter test still passes**

`errorContract.test.ts:91-105` sends two requests from the same (loopback) source and expects 200 then 429. That still holds after the fix, because both requests now share one *IP* key rather than one `undefined` key. Prove it rather than assume it:

Run: `npm exec --workspace=packages/shared -- jest src/middleware/__tests__/errorContract.test.ts --runInBand`
Expected: PASS, including "rate limiter returns RATE_LIMIT_EXCEEDED with top-level retry metadata".

- [ ] **Step 6: Type-check and commit**

```bash
npm run type-check --workspace=packages/shared
git add packages/shared/middleware/rateLimit.ts packages/shared/src/middleware/__tests__/sprint-131-rate-limit-key.test.ts
git commit -m "fix(shared): key anonymous rate limits by client IP, not one shared bucket (BUG-049)"
```

---

### Task 2: Set `trust proxy` in every limiter-mounting service

**Files:**
- Modify, one line each: `services/auth-service/src/index.ts`, `services/community-service/src/index.ts`, `services/messaging-service/src/index.ts`, `services/notification-service/src/index.ts`, `services/reputation-service/src/index.ts`, `services/request-service/src/index.ts`, `services/social-graph-service/src/index.ts`, `services/cleanup-service/src/index.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at compile time; the two tasks are independent until Task 3 asserts both.
- Produces: `req.ip` becomes the nginx-forwarded client IP in all 8 services. Task 3's gate asserts the exact call shape `app.set('trust proxy', 1)`.

**Why 1 and not `'loopback'` or `true`:** Correction 4. `true` trusts the whole chain and would let a client spoof `req.ip` outright. `'loopback'` does not match the Docker gateway the container actually sees.

- [ ] **Step 1: Confirm the service list is exactly these 8**

Run:

```bash
node -e "
const fs=require('fs');
const {execFileSync}=require('child_process');
const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n')
  .filter(f=>/^services\/[^/]+\/src\/.*\.ts\$/.test(f));
const hit=new Set();
for (const f of files) {
  const s=fs.readFileSync(f,'utf8');
  if (/globalRateLimiter|rateLimiters\.\w+|rateLimit\(/.test(s)) hit.add(f.split('/')[1]);
}
console.log([...hit].sort().join('\n'));
"
```

Expected exactly: `auth-service`, `cleanup-service`, `community-service`, `messaging-service`, `notification-service`, `reputation-service`, `request-service`, `social-graph-service`.

If `geocoding-service` appears, it mounts a limiter too and must be added here and to Task 3's expectations. (It declares `express-rate-limit` but the 2026-09-22 scan found no mount site in it.)

- [ ] **Step 2: Add the line to each of the 8 files**

In each file, insert immediately after the `const app = express();` line and **before** the first `app.use(...)`:

```ts
// One proxy hop: nginx on the demo host appends the real client IP last in
// X-Forwarded-For (`$proxy_add_x_forwarded_for` via /etc/nginx/proxy_params).
// Without this, `req.ip` is the Docker gateway and every caller shares a rate
// limit bucket. Must stay `1` — `true` would let clients spoof their IP. ADR-{NNN}.
app.set('trust proxy', 1);
```

Use the same comment in all 8 so the gate's failure message points somewhere consistent.

- [ ] **Step 3: Verify placement mechanically, not by eye**

Run:

```bash
node -e "
const fs=require('fs');
for (const s of ['auth','cleanup','community','messaging','notification','reputation','request','social-graph']) {
  const f='services/'+s+'-service/src/index.ts';
  const lines=fs.readFileSync(f,'utf8').split('\n');
  const set=lines.findIndex(l=>/app\.set\('trust proxy', 1\)/.test(l));
  const use=lines.findIndex(l=>/^app\.use\(/.test(l));
  console.log(s.padEnd(14), 'trust@'+(set+1), 'firstUse@'+(use+1),
    (set>-1 && set<use) ? 'OK' : 'WRONG ORDER OR MISSING');
}
"
```

Expected: `OK` on all 8 rows. A limiter that runs before `trust proxy` is set would read the wrong `req.ip`.

- [ ] **Step 4: Type-check every changed service**

```bash
for s in auth cleanup community messaging notification reputation request social-graph; do
  echo "== $s"; npm run type-check --workspace=services/$s-service || echo "FAILED $s";
done
```

Expected: exit 0 for all 8, no `FAILED` line. Note that `| tail` masks exit codes — do not pipe this.

- [ ] **Step 5: Commit**

```bash
git add services/*/src/index.ts
git commit -m "fix(services): trust one proxy hop so rate limits key on the real client IP (BUG-049)"
```

---

### Task 3: Repo-wide regression gate

**Files:**
- Create: `tests/regression/sprint-131-rate-limit-trust-proxy.test.ts`

**Interfaces:**
- Consumes: `services/registry.json` as the live arbiter of which services exist; the 8 files Task 2 changed; the fixed `keyGenerator` from Task 1.
- Produces: a blocking regression test. Nothing imports it.

**Design note — assert what the gate admits, not what it was meant to reject.** A substring search for `trust proxy` would pass on a commented-out line, on `app.set('trust proxy', true)`, and on the word inside a string. Parse with the TypeScript AST and assert the call shape and the numeric literal `1`, matching the precedent set by the declarations gate.

- [ ] **Step 1: Write the gate**

Create `tests/regression/sprint-131-rate-limit-trust-proxy.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * BUG-049 gate. Two invariants:
 *   1. Every service that mounts a rate limiter sets `app.set('trust proxy', 1)`.
 *   2. The shared key generator never returns undefined.
 *
 * The service list is derived from services/registry.json at run time — not from
 * a hand-written list here — so a new service cannot be missed by this gate.
 */
const repoRoot = path.resolve(__dirname, '../..');
const registry = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'services/registry.json'), 'utf8'),
);

const LIMITER_USE = /globalRateLimiter|rateLimiters\.\w+|(?<![\w.])rateLimit\(/;

const tsFilesUnder = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return tsFilesUnder(full);
    return e.isFile() && full.endsWith('.ts') ? [full] : [];
  });
};

/** Services from the registry whose source actually mounts a rate limiter. */
const limiterServices = (): { name: string; dir: string }[] =>
  Object.entries(registry.services as Record<string, { path?: string }>)
    .map(([name, meta]) => ({ name, dir: path.join(repoRoot, meta.path ?? `services/${name}`) }))
    .filter(({ dir }) =>
      tsFilesUnder(path.join(dir, 'src')).some((f) =>
        LIMITER_USE.test(fs.readFileSync(f, 'utf8')),
      ),
    );

/** True only for a real `<expr>.set('trust proxy', 1)` call with a numeric 1. */
const setsTrustProxyToOne = (source: string, fileName: string): boolean => {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
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
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
};

describe('BUG-049: trusted proxy and rate limit keys', () => {
  it('finds the limiter-mounting services from the registry', () => {
    const names = limiterServices().map((s) => s.name).sort();
    // Guards against the discovery itself silently returning nothing.
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

  it.each(limiterServices().map((s) => [s.name, s.dir]))(
    '%s sets trust proxy to exactly 1',
    (_name, dir) => {
      const files = tsFilesUnder(path.join(dir as string, 'src'));
      const hit = files.find((f) =>
        setsTrustProxyToOne(fs.readFileSync(f, 'utf8'), f),
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
```

- [ ] **Step 2: Run the gate and confirm it passes**

Run: `npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-rate-limit-trust-proxy.test.ts --runInBand`

Expected: **10 passed** (1 discovery + 8 per-service + 1 key generator). If it reports "No tests found", you ran it from the repo root instead of the `tests` workspace — see the Global Constraints.

- [ ] **Step 3: Prove every assertion can actually fail**

Run these four injections one at a time, confirm the gate goes **red on that specific assertion**, then `git checkout --` the file. A gate not proven able to fail is not a gate.

1. Change `app.set('trust proxy', 1)` to `app.set('trust proxy', true)` in `services/auth-service/src/index.ts` → "auth-service sets trust proxy to exactly 1" fails.
2. Comment out that line entirely in `services/request-service/src/index.ts` → "request-service sets trust proxy to exactly 1" fails.
3. In `packages/shared/middleware/rateLimit.ts`, restore `return undefined as any;` in place of the `ipKeyGenerator` call → "never returns undefined" fails.
4. In the gate, temporarily point `registry.services` at `{}` → the discovery test fails on `toBeGreaterThanOrEqual(8)` rather than vacuously passing 0 per-service cases.

Record the exact failing test name for each in the commit message.

- [ ] **Step 4: Commit**

```bash
git add tests/regression/sprint-131-rate-limit-trust-proxy.test.ts
git commit -m "test(regression): gate trust proxy and rate limit key generation (BUG-049)"
```

---

### Task 4: Full suite and SDLC gates

**Files:** none changed unless a gate finds something.

- [ ] **Step 1: Run the full suite at reduced concurrency**

Run: `npm test -- --concurrency=2`

Expected: exit 0, all Turbo tasks successful. The handoff records that default concurrency times out on this Windows box (suites at 158–402 s); `--concurrency=2` was 27/27 green. Do not pipe through `| tail` — it masks the exit code.

- [ ] **Step 2: Inspect the tree for churn the suite introduced**

Run: `git status --short`

`apps/landing/src/data/docs/` is git-tracked and regenerated by the landing prebuild with timestamp/HEAD-sha churn; revert that. The root `posttest` promoter can also move unrelated TDD files repo-wide — restore any that are not this PR's.

- [ ] **Step 3: Scoped gotcha check**

Run: `node scripts/gotcha-check.js --for packages/shared/middleware/rateLimit.ts services/auth-service/src/index.ts infrastructure/nginx/nginx.conf`

Read every gotcha it names before continuing.

- [ ] **Step 4: Run the three gates on the branch diff**

`/simplify` (one pass — the diff is small), `/code-review high` (this is security-relevant, so high rather than medium), `/security-review`. Resolve each finding or dismiss it with written justification.

For `/security-review`, state the spoofing argument explicitly and point at Correction 4's probe table as the evidence, so the reviewer checks the claim rather than the intent.

- [ ] **Step 5: Commit any gate fixes**

```bash
git add -A
git commit -m "fix: address /simplify, /code-review and /security-review findings (BUG-049)"
```

---

### Task 5: Documentation, ADR and handoff

**Files:**
- Modify: `docs/BUGS.md:1205-1233`, `packages/shared/CONTEXT.md:266`, `.claude/handoff/CURRENT_HANDOFF.md`, `package.json`
- Create: `docs/adr/ADR-{NNN}-trusted-proxy-and-rate-limit-keys.md`; index it in `docs/adr/README.md`
- Append: `docs/IDEAS.md`

- [ ] **Step 1: Get the ADR number from the maintainer**

Ask for it. Do not derive it from `docs/adr/` — CLAUDE.md makes ADR numbers maintainer-allocated because two lanes reading the same list get the same answer, and the drift gate now fails on duplicates. Substitute it everywhere this plan writes `ADR-{NNN}`, including the two source comments from Tasks 1 and 2.

- [ ] **Step 2: Write the ADR**

Content: the decision is *trust exactly one proxy hop and key anonymous rate limits by client IP*. Cover the topology (host nginx → `127.0.0.1:300X` published ports, nothing in front of nginx), why `1` and not `true`/`'loopback'`, the `$proxy_add_x_forwarded_for` append order that makes it spoof-proof, and the deliberate exclusion of mount-order changes. Status: Proposed → flip to Implemented when deployed. Cite the probe table from Correction 4.

- [ ] **Step 3: Rewrite the BUG-049 entry**

Mark it fixed with the PR number and merge commit, and correct the three wrong claims — the "only consumer is auth-service" line, the missing note that the `user:` branch was unreachable everywhere (with the site-wide throttling consequence), and the "nginx sets no X-Forwarded-For" line, which is true of the repo file but false in effect because of `proxy_params`. Keep the original probe evidence; it was right about the mechanism.

- [ ] **Step 4: Update `packages/shared/CONTEXT.md`**

Line 266 currently describes the fix as outstanding and points at `docs/BUGS.md`. Replace it with the shipped behavior: per-user key when authenticated, `ipKeyGenerator(req.ip)` otherwise, requires `trust proxy` in the consuming service, gated by `tests/regression/sprint-131-rate-limit-trust-proxy.test.ts`.

- [ ] **Step 5: Log the deferred follow-up in `docs/IDEAS.md`**

Append (append-only file; do not reorder):

> **[2026-09-22] Rate limiters run before `authMiddleware` everywhere, so per-user keying is unreachable.** BUG-049 fixed the key itself; the `user:<id>` branch in `packages/shared/middleware/rateLimit.ts` is still dead at every mount site because the limiter is always positioned ahead of `authMiddleware`. Making it live means moving limiters after auth in 7 services, which would also weaken anonymous-flood protection on those routes — so it needs its own design pass, not a follow-up commit.

- [ ] **Step 6: Bump the version**

Read `origin/master`'s `package.json` version **at merge time** and bump the minor. At time of writing that is 11.63.0 → 11.64.0. Leave the lockfile's stale root `version` alone; PR B and B2 set that precedent.

- [ ] **Step 7: Update the handoff**

Reconcile end-to-end against real state (`gh pr list`, `git log`, current branch): BUG-050 shipped as v11.63.0; BUG-049 state and PR number; D4 still open with its branch re-cut from the new master; the `RATE_LIMIT_DISABLED=true` warning updated to say the fix has landed and re-enabling is now a separate authorized demo operation.

- [ ] **Step 8: Verify the docs loop and commit**

```bash
npm run feedback:check
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand
git add -A
git commit -m "docs: record BUG-049 fix, ADR-{NNN}, and handoff reconciliation"
```

The drift gate is the one that catches an unindexed ADR and a duplicate ADR number. `feedback:check` reads `git diff --cached`, so it is clean on an already-committed branch — run it before committing, not after.

---

### Task 6: Push, PR, and merge

- [ ] **Step 1: Push and confirm the hook actually ran**

```bash
git push -u origin agent/claude/sprint-131-bug-049-rate-limit-key
```

A push that finishes silently and instantly means **no hook ran** — that is a red flag, not a fast machine. Expect the suite to run (~2 minutes).

- [ ] **Step 2: Open the PR**

Body: the corrected mechanism, the probe table, the two layers changed and why nginx was not, the gate and its four injection proofs, and the explicit note that `RATE_LIMIT_DISABLED=true` remains set on the demo and is a separate authorized operation.

- [ ] **Step 3: Confirm checks from job logs, not ticks**

Read the actual job output. Expect ~20 checks passing with Deploy to Demo skipped on the PR.

- [ ] **Step 4: Stop and request merge authorization**

Do not self-merge. Confirm no master deploy is in flight first (`gh pr list` plus the latest CI/CD run's status), then ask. After merge: watch Deploy to Demo, smoke `POST /api/auth/login` plus two authenticated reads with Node fetch, and update the handoff.

- [ ] **Step 5: Flag the follow-up demo operation**

After the deploy is healthy, tell the maintainer that re-enabling rate limiting is now unblocked, and that it means editing `~/karmyq/.env.demo` line 58 (`RATE_LIMIT_DISABLED=true`, appended by an archived seed script; `deploy.sh` does `set -a; source .env.demo`, so the later line wins over line 31's `false`). That is a demo operation needing its own authorization. Recommend verifying `RateLimit-*` response headers appear afterwards.
