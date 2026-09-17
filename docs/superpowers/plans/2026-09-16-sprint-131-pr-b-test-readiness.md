# Sprint 131 PR B — Messaging Test Coverage + Docker Readiness (BUG-034, BUG-036) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** `services/messaging-service` runs a real, discovered, blocking test suite and declares every
package it imports; CI's "Test Docker Build" job waits for readiness with a bounded, tested retry
instead of `sleep 30`.

**Architecture:** Two independent halves in one PR. (1) **Readiness:** a small Node CLI,
`scripts/wait-for-http.js`, probes every URL each attempt with a per-request timeout and a fixed
pause between attempts, and exits 0 only when all URLs answer in the same attempt. Its behavior is
proven against real local HTTP servers with scripted outcomes; the workflow calls it, and a YAML
test pins the wiring. A Node script, not a bash `curl` loop, because the spec demands scripted-outcome
proof and this Windows box cannot run the bash loop. (2) **Messaging:** declare the five
undeclared runtime imports plus the Jest toolchain (ranges equal to what is already resolved: no
new packages, no upgrades), splice the lockfile's workspace node, add a local Jest config modeled on
notification-service's, characterize `getMessages`/`sendMessage` with the database module mocked,
promote the suite, and replace the two Sprint 122 gate exemptions that only held while messaging had
zero tests.

**Tech Stack:** Node 24 (`fetch`, `AbortSignal.timeout`), Jest 30.5.1 + ts-jest 29.4.12,
`yaml` 2.9.1 (declared by the `tests` workspace), `semver`, GitHub Actions, npm 11.19.0 lockfile v3.

**Spec:** [`docs/superpowers/specs/2026-09-15-sprint-131-maintenance-design.md`](../specs/2026-09-15-sprint-131-maintenance-design.md) → *PR B — test readiness (BUG-034, BUG-036)*

**Sprint plan:** [`docs/superpowers/plans/2026-09-15-sprint-131-maintenance.md`](2026-09-15-sprint-131-maintenance.md) → Tasks 5–7

---

## Global Constraints

Copied or derived from the spec's Critical Implementation Notes. Every task inherits these.

- **Branch:** `agent/codex/sprint-131-test-readiness`, cut 2026-09-16 from deployed `origin/master`
  `d35a3fadd0912ab0ef076eb16c6fd1f23df80acd` (v11.56.0). Its upstream was **unset** on purpose
  because it initially tracked `origin/master`. First push must be
  `git push --set-upstream origin agent/codex/sprint-131-test-readiness`.
- **Dependency lane:** held by **Claude** since 2026-09-16 (maintainer: "you own this lane now";
  executing a plan transfers the lane to the executor; reviewing does not). It was Codex's from 2026-09-15. It explicitly includes messaging's declarations. If
  someone other than the lane holder executes this plan, the execution itself transfers the lane,
  so record the transfer in the handoff before Task 3. A reviewer never holds it.
- **Surgical lock edits only:** splice `package-lock.json` in place, then prove it with strict
  `npx -y npm@11.19.0 ci`. Never `npm install --workspace`, `npm dedupe` or regenerate the lockfile.
  **B introduces no upgrades:** every new declaration uses the root manifest's existing range.
- **Red means an assertion failed in a discovered test.** A config error, import crash or zero-test
  exit is not red. Characterization tests that pass on first run must be proven able to fail by a
  temporary, reverted mutation.
- **Root regression commands run in the tests workspace:**
  `npm exec --workspace=tests -- jest --runTestsByPath regression/<file>.test.ts --runInBand`.
- **Promoter hazard:** root `npm test` runs `scripts/promote-tdd-tests.js` as `posttest`, which moves
  **every** green `.test.ts` under `services/*/tests/tdd/` and `apps/*/tests/tdd/` repo-wide. The
  messaging suite is `.test.ts`, so Task 4 moves it by hand **before** any root `npm test`.
  After every root run, inspect `git status` and move back any unrelated promotion.
- **Scope:** do not add tests or declarations to other services (notification-service also leans on
  root for `express`/`cors`; that's out of scope). Do not change messaging runtime code, endpoints,
  events or schema. No ADR (not architectural; single-service + CI).
- **Version:** derive from `origin/master` at merge time; nothing reserved. (`11.56.0` at time of writing.)
- **Merge is not yours.** Open the PR and stop. D1 cannot start until B is merged, deployed and
  health-verified.
- **Windows host:** Node for JSON/HTTP probes, never `curl`/`jq`; capture exit codes separately
  (`| tail` masks them). PowerShell `Move-Item` for moves of untracked files.

## Verified Facts (read 2026-09-16 on `d35a3fad`; re-check any that a later master may have moved)

| Fact | Evidence |
|---|---|
| Messaging imports `express`, `cors`, `dotenv`, `jsonwebtoken` | `services/messaging-service/src/index.ts:1,4,6,7` |
| Messaging imports `pg` | `services/messaging-service/src/database/db.ts:1` |
| Other imports (`helmet`, `redis`, `socket.io`, `@karmyq/shared`) already declared; `http`, `crypto` are builtins | `src/index.ts`, `src/config/redis.ts`, `src/socket/messageHandler.ts`, `package.json` |
| Root declares `cors ^2.8.5`, `dotenv ^16.3.1`, `express ^5.2.1`, `jsonwebtoken ^9.0.2`, `pg ^8.23.0` | root `package.json` `dependencies` |
| Lock resolves hoisted `cors 2.8.6`, `dotenv 16.6.1`, `express 5.2.1`, `jsonwebtoken 9.0.3`, `pg 8.23.0`, `jest 30.5.1`, `ts-jest 29.4.12`, `@types/jest 30.0.0`: all satisfy the ranges above, so **no new lock package nodes** | `package-lock.json` `packages["node_modules/*"]` |
| Lock workspace node `packages["services/messaging-service"]` mirrors today's manifest | `package-lock.json` |
| Lockfile and manifest use LF line endings | `grep -c $'\r'` = 0 for both |
| Messaging has no `test` script; `tests/{unit,regression,tdd,integration}/` hold only `.gitkeep` | `package.json`, `git ls-files` |
| `tsconfig.json` `include` is `src/**/*`, so `tsc`/Docker build never compile `tests/` | `services/messaging-service/tsconfig.json` |
| House Jest pattern: extend root config, four-tier `testMatch`, `setupFilesAfterEnv: []` | `services/notification-service/jest.config.js` |
| Root Jest config has `resetMocks: true`, `restoreMocks: true`, `clearMocks: true` | `jest.config.js:55-57` |
| `getMessages` checks participants, then selects `ORDER BY m.created_at DESC LIMIT $2 OFFSET $3` with `[conversationId, limit, offset]` and returns `rows.reverse()`; defaults `limit=50, offset=0` | `src/services/messageService.ts:143-177` |
| `sendMessage` runs participant check → `INSERT … 'sent'` → `UPDATE … last_message_at` → sender lookup, returns `{ ...inserted, sender }`; every function logs `Error in <fn>:` and rethrows | `src/services/messageService.ts:180-225` |
| **Gate that will go red:** `the messaging-service exemption is still justified` asserts messaging has **0** test files, and `every test task hashes at least one actual test file` exempts `karmyq-messaging-service#test` | `tests/regression/sprint-122-turbo-test-inputs.test.ts:43,87-91,99-106` |
| Tier-parity's generic "no jest invocation ⇒ no files" allowance and two comments naming messaging as the sole such workspace | `tests/regression/sprint-122-tier-parity.test.ts:163-168,197-198` |
| Docker job: `up -d` → `sleep 30` → one-shot `curl -f` on `:3001/health` and `:3000` → `if: failure()` logs | `.github/workflows/test.yml:122-135` |
| Compose publishes auth and frontend on `127.0.0.1` only | `infrastructure/docker/docker-compose.yml:96-97,338-339` |
| `docker-build` job has no `setup-node` step; other jobs in the file use `actions/setup-node@v7` with `node-version: '24'` | `.github/workflows/test.yml:49-51,91-93,108-139` |
| Workflow tests parse YAML with the declared `yaml` package, not `js-yaml` | `tests/regression/sprint-129-demo-health-workflow.test.ts:22-25` |
| Registry messaging entry has no npm-dependency or test fields: **no registry change needed** | `services/registry.json` `services["messaging-service"]` keys |
| `docs/guides/testing-guide.md` is not in `GUIDE_ORDER`, so it is not published to landing; messaging `CONTEXT.md` **is** (`apps/landing/src/data/docs/services/messaging-service.json`) | `scripts/generate-docs.ts:315` (`GUIDE_ORDER`), `:120` (service `CONTEXT.md` read) |
| Scoped gotchas for every path in this plan: none | `node scripts/gotcha-check.js --for …` |

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `scripts/wait-for-http.js` | Bounded multi-URL readiness wait (CLI + exported functions) | Create (Task 1) |
| `tests/regression/sprint-131-wait-for-http.test.ts` | Proves retry, same-attempt, per-request timeout, exhaustion, usage against real servers | Create (Task 1) |
| `.github/workflows/test.yml` | `docker-build` job: setup Node 24, call the wait script, keep failure logs | Modify (Task 2) |
| `tests/regression/sprint-131-ci-readiness-workflow.test.ts` | Pins the workflow wiring and its worst-case bound | Create (Task 2) |
| `tests/regression/sprint-131-messaging-declarations.test.ts` | Imports ⇒ declarations; lock mirrors manifest; ranges satisfied; no upgrade vs root | Create (Task 3) |
| `services/messaging-service/package.json` | Runtime declarations, Jest toolchain, test scripts | Modify (Tasks 3, 4) |
| `package-lock.json` | Workspace node only | Splice (Task 3) |
| `services/messaging-service/jest.config.js` | Local Jest config | Create (Task 3) |
| `services/messaging-service/tests/tdd/messageService.test.ts` → `tests/regression/` | Characterization of `getMessages`/`sendMessage` | Create, then move (Task 4) |
| `tests/regression/sprint-122-turbo-test-inputs.test.ts` | Replace zero-files exemption with "hashes its suite" | Modify (Task 4) |
| `tests/regression/sprint-122-tier-parity.test.ts` | Explicit messaging guarantee; fix stale comments | Modify (Task 5) |
| `docs/BUGS.md`, `services/messaging-service/CONTEXT.md`, `scripts/claude.md`, `docs/guides/testing-guide.md` | Close-out and docs loop | Modify (Task 6) |
| `package.json` (version), `.claude/handoff/CURRENT_HANDOFF.md` | Release | Modify (Task 7) |

Commands run at the repository root unless stated otherwise. Before **every commit**, run
`.claude/skills/pre-commit-check/SKILL.md` (process review, full tests, staged `feedback:check`).
Do not bypass hooks. Stage exact paths only. Record real dates and the real executor's attribution.

---

## Task 1: Bounded readiness script, proven against scripted HTTP outcomes

**Files:**
- Create: `tests/regression/sprint-131-wait-for-http.test.ts`
- Create: `scripts/wait-for-http.js`

**Interfaces:**
- Produces: CLI `node scripts/wait-for-http.js --attempts <int≥1> --interval-ms <int≥1> --timeout-ms <int≥1> <url> [url…]`.
  Exit `0` = every URL answered 2xx/3xx in the same attempt; `1` = attempts exhausted; `2` = invalid usage (no probe made).
  Output lines: `ready after <n> attempt(s): <urls>` (stdout), `attempt <n>/<N> not ready: <url> (<reason>); …` and
  `gave up after <N> attempts` (stderr). Reasons: `HTTP <status>`, `no response within <ms>ms`, or the network error code.
- Exports: `parseArgs(argv: string[]) → { attempts, intervalMs, timeoutMs, urls }` (throws on invalid usage),
  `waitForHttp(opts) → Promise<{ ok: boolean, attempts: number }>`.

- [ ] **Step 1: Read local context**

Read `tests/claude.md` and `scripts/claude.md`. Run
`node scripts/gotcha-check.js --for scripts/wait-for-http.js tests/regression/sprint-131-wait-for-http.test.ts`
(expected: none).

- [ ] **Step 2: Write the failing test**

Write with the Write tool (heredocs eat backslashes). Create `tests/regression/sprint-131-wait-for-http.test.ts`:

```ts
/**
 * Sprint 131 PR B (BUG-036): the readiness wait CI's "Test Docker Build" job relies on.
 *
 * `sleep 30` then a one-shot curl raced service startup on cold runners. The replacement must
 * (a) retry, (b) require every URL in the SAME attempt, (c) bound each request, not just the
 * attempt count, since a fixed attempt count with an unbounded request never times out, and
 * (d) give up with a non-zero exit. Each is proven here against real HTTP servers with scripted
 * outcomes, by running the real CLI. No regex over YAML stands in for behavior.
 */
import { spawn } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';

const SCRIPT = join(__dirname, '..', '..', 'scripts', 'wait-for-http.js');

type Handler = (req: IncomingMessage, res: ServerResponse, hit: number) => void;
type Scripted = { url: string; hits: () => number; close: () => Promise<void> };

const open: Scripted[] = [];

async function scripted(handler: Handler): Promise<Scripted> {
  let hits = 0;
  const server = createServer((req, res) => {
    hits += 1;
    handler(req, res, hits);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const s: Scripted = {
    url: `http://127.0.0.1:${port}/health`,
    hits: () => hits,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections(); // a hanging handler would otherwise hold close() open
        server.close(() => resolve());
      }),
  };
  open.push(s);
  return s;
}

const status =
  (code: number): Handler =>
  (_req, res) => {
    res.writeHead(code);
    res.end();
  };

afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => s.close()));
});

/**
 * Run the real CLI. Async spawn, never execFileSync: the scripted servers live in THIS process
 * and could not answer a single request while it blocked.
 */
function run(args: string[]): Promise<{ code: number | null; output: string; elapsedMs: number }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [SCRIPT, ...args]);
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ code, output, elapsedMs: Date.now() - started }));
  });
}

/**
 * Generous per-request timeout by default. CI runs this under Turbo's parallel load, where a
 * healthy 200 from an in-process server can arrive late. With a short timeout that 200 would
 * count as a failed attempt and break the exact hit counts below. Only the hang case passes a
 * short timeout, because timing out is what it tests.
 */
const bounds = (attempts: number, timeoutMs = 5000) => [
  '--attempts', String(attempts),
  '--interval-ms', '50',
  '--timeout-ms', String(timeoutMs),
];

describe('scripts/wait-for-http.js (BUG-036)', () => {
  it('exits 0 on the first attempt when every URL is ready', async () => {
    const auth = await scripted(status(200));
    const web = await scripted(status(200));

    const { code, output } = await run([...bounds(5), auth.url, web.url]);

    expect(code).toBe(0);
    expect(auth.hits()).toBe(1);
    expect(web.hits()).toBe(1);
    expect(output).toContain('ready after 1 attempt(s)');
  }, 20_000);

  it('keeps retrying until a slow service comes up', async () => {
    const auth = await scripted((req, res, hit) => status(hit < 3 ? 503 : 200)(req, res, hit));
    const web = await scripted(status(200));

    const { code, output } = await run([...bounds(5), auth.url, web.url]);

    expect(code).toBe(0);
    expect(auth.hits()).toBe(3);
    expect(web.hits()).toBe(3); // every URL is re-probed each attempt
    expect(output).toContain(`attempt 2/5 not ready: ${auth.url} (HTTP 503)`);
    expect(output).toContain('ready after 3 attempt(s)');
  }, 20_000);

  it('requires every URL to succeed in the same attempt, then gives up', async () => {
    const auth = await scripted(status(200));
    const web = await scripted(status(500));

    const { code, output } = await run([...bounds(4), auth.url, web.url]);

    expect(code).toBe(1);
    expect(auth.hits()).toBe(4);
    expect(web.hits()).toBe(4);
    expect(output).toContain(`${web.url} (HTTP 500)`);
    expect(output).not.toContain(`${auth.url} (`);
    expect(output).toContain('gave up after 4 attempts');
  }, 20_000);

  it('bounds a request that never answers', async () => {
    const hang = await scripted(() => {
      /* accept the request, never respond */
    });

    const { code, output, elapsedMs } = await run([...bounds(3, 300), hang.url]);

    expect(code).toBe(1);
    // At least one request really reached the server and got no answer. Not an exact count: under
    // load, an aborted request may never reach the server before its 300ms timeout.
    expect(hang.hits()).toBeGreaterThanOrEqual(1);
    expect(output).toContain('attempt 3/3 not ready');
    expect(output).toContain('no response within 300ms');
    expect(output).toContain('gave up after 3 attempts');
    // Timers never fire early, so 3 × 300ms timeouts + 2 × 50ms pauses is a hard FLOOR: the script
    // really waited. There is no ceiling assertion, since load makes any fixed ceiling flaky.
    // The proof it cannot hang forever is this test's own 20s Jest timeout.
    expect(elapsedMs).toBeGreaterThanOrEqual(1000);
  }, 20_000);

  it('treats a refused connection as not ready', async () => {
    const gone = await scripted(status(200));
    await gone.close(); // port is now closed
    open.splice(open.indexOf(gone), 1);

    // 1000ms: Linux refuses instantly; Windows loopback may retry SYNs for ~2s. That is enough to
    // reach a verdict either way without stretching this case to 2 × 5000ms under CI load.
    const { code, output } = await run([...bounds(2, 1000), gone.url]);

    // Reason text is platform-dependent (ECONNREFUSED on Linux; Windows loopback may time out
    // first), so assert the verdict, the URL and the give-up, not the reason.
    expect(code).toBe(1);
    expect(output).toContain(`attempt 1/2 not ready: ${gone.url} (`);
    expect(output).toContain('gave up after 2 attempts');
  }, 20_000);

  it('counts a redirect as ready, matching the curl -f it replaces', async () => {
    const web = await scripted((_req, res) => {
      res.writeHead(307, { Location: '/login' });
      res.end();
    });

    const { code } = await run([...bounds(2), web.url]);

    expect(code).toBe(0);
    expect(web.hits()).toBe(1); // not followed
  }, 20_000);

  it('rejects invalid usage with exit 2 before probing anything', async () => {
    const auth = await scripted(status(200));

    const zero = await run(['--attempts', '0', '--interval-ms', '50', '--timeout-ms', '300', auth.url]);
    const noUrl = await run(bounds(2));
    const missingBound = await run(['--attempts', '2', '--interval-ms', '50', auth.url]);

    expect([zero.code, noUrl.code, missingBound.code]).toEqual([2, 2, 2]);
    expect(zero.output).toContain('--attempts must be a positive integer');
    expect(noUrl.output).toContain('at least one URL is required');
    expect(missingBound.output).toContain('--timeout-ms is required');
    expect(auth.hits()).toBe(0);
  }, 20_000);
});
```

- [ ] **Step 3: Prove discovery**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-wait-for-http.test.ts --listTests --runInBand
```

Expected: exactly one path, ending `tests/regression/sprint-131-wait-for-http.test.ts`.

- [ ] **Step 4: Run it and confirm assertion-level red**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-wait-for-http.test.ts --runInBand
```

Expected: **7 failed / 0 passed.** The script does not exist, so `node` exits 1 with
`Cannot find module`. Every case fails on an assertion: exit code (`1 ≠ 0` or `1 ≠ 2`), hit counts
(`0 ≠ N`), or missing output text. Record the count. If the suite itself errors (TypeScript
diagnostics, spawn failure), fix the test, since that is not red.

- [ ] **Step 5: Write the implementation**

Create `scripts/wait-for-http.js`:

```js
#!/usr/bin/env node
'use strict';

/**
 * Bounded HTTP readiness wait (Sprint 131, BUG-036).
 *
 * Replaces CI's `sleep 30` + one-shot curl in "Test Docker Build". Each attempt probes every URL
 * concurrently, each request capped at --timeout-ms; the attempt succeeds only if ALL URLs answer
 * 2xx/3xx (the `curl -f` verdict, redirects not followed). Between failed attempts it pauses
 * --interval-ms. Worst case: attempts × timeout + (attempts − 1) × interval.
 *
 * Exit: 0 ready · 1 gave up · 2 invalid usage.
 * Proven by tests/regression/sprint-131-wait-for-http.test.ts against real servers.
 */

const USAGE =
  'usage: node scripts/wait-for-http.js --attempts <n> --interval-ms <ms> --timeout-ms <ms> <url> [url...]';

const FLAGS = { '--attempts': 'attempts', '--interval-ms': 'intervalMs', '--timeout-ms': 'timeoutMs' };

function parseArgs(argv) {
  const opts = { urls: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const key = FLAGS[arg];
    if (key) {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error(`${arg} must be a positive integer`);
      opts[key] = value;
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option ${arg}`);
    } else {
      opts.urls.push(arg);
    }
  }
  for (const [flag, key] of Object.entries(FLAGS)) {
    if (opts[key] === undefined) throw new Error(`${flag} is required`);
  }
  if (opts.urls.length === 0) throw new Error('at least one URL is required');
  return opts;
}

/** Resolves to null when ready, otherwise a short reason. Never throws. */
async function probe(url, timeoutMs) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    await res.body?.cancel();
    return res.status >= 200 && res.status < 400 ? null : `HTTP ${res.status}`;
  } catch (err) {
    if (err.name === 'TimeoutError') return `no response within ${timeoutMs}ms`;
    return err.cause?.code || err.message;
  }
}

async function waitForHttp({ urls, attempts, intervalMs, timeoutMs }) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const reasons = await Promise.all(urls.map((url) => probe(url, timeoutMs)));
    const failures = urls.map((url, i) => [url, reasons[i]]).filter(([, reason]) => reason);

    if (failures.length === 0) {
      console.log(`ready after ${attempt} attempt(s): ${urls.join(', ')}`);
      return { ok: true, attempts: attempt };
    }

    console.error(
      `attempt ${attempt}/${attempts} not ready: ${failures.map(([url, reason]) => `${url} (${reason})`).join('; ')}`,
    );
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.error(`gave up after ${attempts} attempts`);
  return { ok: false, attempts };
}

module.exports = { parseArgs, waitForHttp };

if (require.main === module) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(2);
  }
  waitForHttp(opts).then(
    ({ ok }) => {
      process.exitCode = ok ? 0 : 1;
    },
    (err) => {
      console.error(err);
      process.exitCode = 1;
    },
  );
}
```

- [ ] **Step 6: Run it green**

Same command as Step 4. Expected: **7 passed**, exit 0. Run it twice more, then once under the
load CI applies (`npm test -- --force`, which runs Turbo's parallel workspaces), and confirm it
stays 7/7. If a case flakes, report the measured values; do not add a short timeout to a
non-hang case or a ceiling on elapsed time. Keep the 1000ms floor: it proves the timeouts
really waited.

- [ ] **Step 7: Commit**

Run the pre-commit-check skill, then:

```bash
git add scripts/wait-for-http.js tests/regression/sprint-131-wait-for-http.test.ts
git commit -m "feat(ci): bounded HTTP readiness wait for the Docker build job (BUG-036)"
```

---

## Task 2: Wire the readiness wait into "Test Docker Build"

**Files:**
- Create: `tests/regression/sprint-131-ci-readiness-workflow.test.ts`
- Modify: `.github/workflows/test.yml:108-139` (`docker-build` job)

**Interfaces:**
- Consumes: the Task 1 CLI contract (flags, exit codes).

- [ ] **Step 1: Write the failing workflow test**

Create `tests/regression/sprint-131-ci-readiness-workflow.test.ts` (Write tool):

```ts
/**
 * Sprint 131 PR B (BUG-036): the WIRING of the readiness wait into "Test Docker Build".
 *
 * sprint-131-wait-for-http.test.ts proves the script's behavior. This file proves the job
 * actually uses it: after `up -d`, for BOTH auth health and the frontend, with every bound set,
 * under the Node major it is tested with, and that the failure-log step survives.
 *
 * HONEST LIMIT: this parses YAML; it cannot prove GitHub runs it. The PR's own "Test Docker Build"
 * run is that evidence (Task 7).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
// `yaml` is what the tests workspace DECLARES; js-yaml is only a root dependency.
import { parse as parseYaml } from 'yaml';

type Step = { name?: string; run?: string; if?: string; uses?: string; with?: Record<string, unknown> };

const WORKFLOW = join(__dirname, '..', '..', '.github', 'workflows', 'test.yml');
const steps: Step[] = parseYaml(readFileSync(WORKFLOW, 'utf8')).jobs['docker-build'].steps;

/** A step's executed command with shell line-continuations joined. */
const command = (s: Step) => (s.run ?? '').replace(/\\\n\s*/g, ' ');

const startIdx = steps.findIndex((s) => /docker compose .* up -d\b/.test(command(s)));
const waitIdx = steps.findIndex((s) => command(s).includes('scripts/wait-for-http.js'));

function bound(flag: string): number {
  const match = command(steps[waitIdx]).match(new RegExp(`${flag}\\s+(\\d+)`));
  expect(match).not.toBeNull();
  return Number(match![1]);
}

describe('Test Docker Build waits for readiness instead of guessing (BUG-036)', () => {
  it('starts the stack, then runs the bounded readiness wait', () => {
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(waitIdx).toBeGreaterThan(startIdx);
  });

  it('no step sleeps a fixed duration or probes with a one-shot curl', () => {
    const all = steps.map(command).join('\n');
    expect(all).not.toMatch(/\bsleep\s+\d+/);
    expect(all).not.toMatch(/\bcurl\b/);
  });

  it('waits for BOTH auth-service health and the frontend', () => {
    expect(waitIdx).toBeGreaterThanOrEqual(0);
    const cmd = command(steps[waitIdx]);
    // 127.0.0.1: compose publishes these ports on 127.0.0.1 only (docker-compose.yml).
    expect(cmd).toContain('http://127.0.0.1:3001/health');
    expect(cmd).toContain('http://127.0.0.1:3000');
  });

  it('sets every bound, and the worst case stays under five minutes', () => {
    expect(waitIdx).toBeGreaterThanOrEqual(0);
    const attempts = bound('--attempts');
    const intervalMs = bound('--interval-ms');
    const timeoutMs = bound('--timeout-ms');
    for (const n of [attempts, intervalMs, timeoutMs]) expect(n).toBeGreaterThan(0);
    // URLs are probed concurrently, so one attempt costs at most one timeout.
    expect(attempts * timeoutMs + (attempts - 1) * intervalMs).toBeLessThanOrEqual(300_000);
  });

  it('sets up Node 24 before the wait runs', () => {
    const setup = steps.findIndex((s) => (s.uses ?? '').startsWith('actions/setup-node@'));
    expect(setup).toBeGreaterThanOrEqual(0);
    expect(setup).toBeLessThan(waitIdx);
    expect(String(steps[setup].with?.['node-version'])).toBe('24');
  });

  it('still dumps compose logs after a failed wait', () => {
    const logs = steps.findIndex((s) => s.if === 'failure()' && /docker compose .* logs\b/.test(command(s)));
    expect(logs).toBeGreaterThan(waitIdx);
  });
});
```

- [ ] **Step 2: Prove discovery and red**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-ci-readiness-workflow.test.ts --listTests --runInBand
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-ci-readiness-workflow.test.ts --runInBand
```

Expected: one path; then **5 failed / 1 passed**. `still dumps compose logs` passes (`5 > -1`), which
is expected: it guards against losing that step. The other five fail on `waitIdx`/`setup` being
`-1`, or on the `sleep 30`/`curl` match. Record it.

- [ ] **Step 3: Edit the workflow**

In `.github/workflows/test.yml`, `docker-build` job: add a Node setup step after checkout, and
replace the `Wait for services` + `Check service health` steps (currently lines 125–131) with one
step. The resulting job:

```yaml
  docker-build:
    name: Test Docker Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v7

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '24'

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0

      - name: Build Docker images
        run: docker compose -f infrastructure/docker/docker-compose.yml build

      - name: Start services
        run: docker compose -f infrastructure/docker/docker-compose.yml up -d

      - name: Wait for auth-service and frontend
        # Bounded readiness (BUG-036), replacing `sleep 30` + one-shot curl. Both URLs must answer in
        # the same attempt. Worst case 30 × 5s + 29 × 5s ≈ 5 min. 127.0.0.1 because compose publishes
        # these ports there only. Behavior: tests/regression/sprint-131-wait-for-http.test.ts.
        run: >-
          node scripts/wait-for-http.js
          --attempts 30 --interval-ms 5000 --timeout-ms 5000
          http://127.0.0.1:3001/health http://127.0.0.1:3000

      - name: Show logs on failure
        if: failure()
        run: docker compose -f infrastructure/docker/docker-compose.yml logs

      - name: Stop services
        if: always()
        run: docker compose -f infrastructure/docker/docker-compose.yml down
```

No `cache: 'npm'` and no `npm ci`: the script uses only Node built-ins.

- [ ] **Step 4: Green, and nothing else in the workflow moved**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-ci-readiness-workflow.test.ts --runInBand
git diff --stat -- .github/workflows/test.yml
```

Expected: **6 passed**. The diff touches only the `docker-build` job. Also run any existing
workflow gate that reads `test.yml` (search first:
`grep -rln "workflows/test.yml" tests/regression`; none existed on 2026-09-16) and the runtime-floor gate:

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-runtime-floor-gate.test.ts --runInBand
```

- [ ] **Step 5: Commit**

Pre-commit-check skill, then:

```bash
git add .github/workflows/test.yml tests/regression/sprint-131-ci-readiness-workflow.test.ts
git commit -m "fix(ci): wait for readiness instead of sleep 30 in Test Docker Build (BUG-036)"
```

---

## Task 3: Messaging declares what it imports; Jest harness; surgical lock splice

**Files:**
- Create: `tests/regression/sprint-131-messaging-declarations.test.ts`
- Modify: `services/messaging-service/package.json`
- Splice: `package-lock.json` (`packages["services/messaging-service"]` only)
- Create: `services/messaging-service/jest.config.js`

**Interfaces:**
- Produces: messaging `devDependencies` include `jest`, `ts-jest`, `@types/jest`; script
  `test:tdd` = `jest --testPathPatterns=tests/tdd/ --passWithNoTests`; `jest.config.js` whose
  `testMatch` covers all four tiers. Task 4 relies on these.

- [ ] **Step 1: Confirm the lane and read context**

Confirm the handoff names you, the executor, as dependency-lane holder (Global Constraints). Read
`services/messaging-service/.claude/README.md` and `CONTEXT.md`, and
`services/notification-service/jest.config.js`. Re-verify the resolved versions in *Verified Facts*
against the current lock:

```bash
node -e "const P=require('./package-lock.json').packages;for(const n of ['cors','dotenv','express','jsonwebtoken','pg','jest','ts-jest','@types/jest'])console.log(n,P['node_modules/'+n]?.version)"
```

If any differs from the table, stop and re-derive ranges; do not guess.

- [ ] **Step 2: Write the failing declarations gate**

Create `tests/regression/sprint-131-messaging-declarations.test.ts` (Write tool):

```ts
/**
 * Sprint 131 PR B: services/messaging-service declares every package it imports.
 *
 * Not BUG-034 (that report covers zero tests only). This is the "declare what you import" class
 * already fixed here for @karmyq/shared and redis (CONTEXT.md, Sprint 122 sections), scoped into PR B
 * by the Sprint 131 spec.
 *
 * It imported express, cors, dotenv, jsonwebtoken and pg while declaring none of them, alive only
 * because root declares them and npm hoists. A root bump (D1: dotenv 17) would silently change or
 * de-hoist what messaging runs. The import list is DERIVED from src on every run, so a new
 * undeclared import fails here without anyone maintaining a list.
 */
import { readdirSync, readFileSync } from 'fs';
import { builtinModules } from 'module';
import { join } from 'path';
import * as semver from 'semver';

const ROOT = join(__dirname, '..', '..');
const WS = 'services/messaging-service';
const pkg = JSON.parse(readFileSync(join(ROOT, WS, 'package.json'), 'utf8'));
const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

function importedPackages(): string[] {
  const names = new Set<string>();
  const specifier = /(?:\bfrom\s+|\bimport\s+|\brequire\(\s*|\bimport\(\s*)['"]([^'"]+)['"]/g;
  for (const file of sourceFiles(join(ROOT, WS, 'src'))) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(specifier)) {
      if (spec.startsWith('.') || spec.startsWith('node:')) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!builtinModules.includes(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/** Resolved version as npm would find it from the workspace: nested first, then hoisted. */
const resolved = (name: string): string | undefined =>
  lock.packages[`${WS}/node_modules/${name}`]?.version ?? lock.packages[`node_modules/${name}`]?.version;

describe('services/messaging-service declares what it imports (Sprint 131 PR B)', () => {
  it('the import scan is not vacuous', () => {
    expect(importedPackages()).toEqual(expect.arrayContaining(['@karmyq/shared', 'express', 'socket.io']));
  });

  it('every imported package is a production dependency', () => {
    // Production, not dev: the Dockerfile's runtime stage installs with --omit=dev.
    const missing = importedPackages().filter((name) => !pkg.dependencies?.[name]);
    expect(missing).toEqual([]);
  });

  it('a jest test script brings its own jest toolchain', () => {
    const usesJest = Object.values<string>(pkg.scripts ?? {}).some((s) => /^jest\b/.test(s));
    expect(usesJest).toBe(true);
    const missing = ['jest', 'ts-jest', '@types/jest'].filter((name) => !pkg.devDependencies?.[name]);
    expect(missing).toEqual([]);
  });

  it('every declared range is satisfied by the version the lockfile resolves', () => {
    const declared = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const unsatisfied = Object.entries(declared)
      .filter(([name]) => name !== '@karmyq/shared') // workspace link, range "*"
      .filter(([name, range]) => !semver.satisfies(resolved(name) ?? '0.0.0', range))
      .map(([name, range]) => `${name}@${range} resolved ${resolved(name)}`);
    expect(unsatisfied).toEqual([]);
  });

  it('shares root ranges exactly, so this declaration upgrades nothing', () => {
    const drift = Object.entries<string>(pkg.dependencies)
      .filter(([name]) => rootPkg.dependencies?.[name])
      .filter(([name, range]) => range !== rootPkg.dependencies[name])
      .map(([name, range]) => `${name}: workspace ${range} vs root ${rootPkg.dependencies[name]}`);
    expect(drift).toEqual([]);
  });

  it("the lockfile's workspace node mirrors the manifest exactly", () => {
    const node = lock.packages[WS];
    expect(node.dependencies).toEqual(pkg.dependencies);
    expect(node.devDependencies).toEqual(pkg.devDependencies);
  });
});
```

- [ ] **Step 3: Discovery and first red**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-messaging-declarations.test.ts --listTests --runInBand
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-messaging-declarations.test.ts --runInBand
```

Expected: one path; **2 failed / 4 passed**. `every imported package is a production dependency`
fails with exactly `["cors", "dotenv", "express", "jsonwebtoken", "pg"]`. If the list differs,
read the new import site before continuing. `a jest test script…` fails on `usesJest`. The lock-mirror test
passes because manifest and lock still agree.

- [ ] **Step 4: Edit the manifest**

`services/messaging-service/package.json`: keys stay alphabetical (npm's own order), LF, two-space indent.

```json
{
  "name": "karmyq-messaging-service",
  "version": "1.0.0",
  "license": "AGPL-3.0-or-later",
  "description": "Real-time messaging service for Karmyq",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "test:tdd": "jest --testPathPatterns=tests/tdd/ --passWithNoTests"
  },
  "dependencies": {
    "@karmyq/shared": "*",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^5.2.1",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.23.0",
    "redis": "^6.2.1",
    "socket.io": "^4.6.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.6",
    "@types/jest": "^30.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^20.10.5",
    "@types/pg": "^8.23.1",
    "jest": "^30.5.1",
    "nodemon": "^3.0.2",
    "ts-jest": "^29.4.12",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

`test`, `test:unit` and `test:regression` are **not** added yet. A blocking `test:regression`
without `--passWithNoTests` would fail on the still-empty regression tier; Task 4 adds them with the suite.

Re-run the Step 3 test. Expected: **1 failed / 5 passed**. Only the lock-mirror test fails,
which is the red for the splice.

- [ ] **Step 5: Splice the lockfile's workspace node**

Write `C:\…\scratchpad\splice-messaging-lock.js` (scratchpad, not the repo) with the Write tool:

```js
const fs = require('fs');
const LOCK = 'package-lock.json';
const raw = fs.readFileSync(LOCK, 'utf8');
if (raw.includes('\r\n')) throw new Error('lockfile is CRLF; expected LF, so stop and investigate');
const lock = JSON.parse(raw);
const pkg = JSON.parse(fs.readFileSync('services/messaging-service/package.json', 'utf8'));
const node = lock.packages['services/messaging-service'];
node.dependencies = pkg.dependencies;
node.devDependencies = pkg.devDependencies;
fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
```

Run it from the repo root with `node <scratchpad path>`, then:

```bash
git diff --stat -- package-lock.json
git diff -- package-lock.json
```

Expected: **8 insertions, 0 deletions**, all inside `"services/messaging-service": {`: five
dependencies and three devDependencies. Any other hunk (whitespace, reordering, a trailing-newline
change) means the writer did not round-trip: `git checkout -- package-lock.json` and investigate.

- [ ] **Step 6: Prove it with strict install and a clean tree listing**

```bash
npx -y npm@11.19.0 ci
echo "ci exit=$?"
npx -y npm@11.19.0 ls --all --workspace=services/messaging-service > "$TEMP/messaging-ls.txt" 2>&1
echo "ls exit=$?"
grep -nE "invalid|missing|extraneous|UNMET" "$TEMP/messaging-ls.txt"
git status --short
```

Expected: both exits `0`; the grep prints nothing; `git status` shows only this task's files (strict
`ci` must not rewrite the lock). Re-run the declarations gate: **6 passed**.

- [ ] **Step 7: Add the local Jest config**

Create `services/messaging-service/jest.config.js`:

```js
// Jest configuration for Messaging Service (Sprint 131, BUG-034).
// Extends the root configuration, following services/notification-service/jest.config.js.

const rootConfig = require('../../jest.config');

module.exports = {
  ...rootConfig,
  rootDir: '.',
  displayName: 'messaging-service',

  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/regression/**/*.test.ts',
    '<rootDir>/tests/tdd/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/index.ts',
  ],

  // The root setup file resolves against the root rootDir; this service needs none.
  setupFilesAfterEnv: [],
};
```

Verify the config loads and finds nothing yet (not a pass claim, just that the harness is valid):

```bash
npm exec --workspace=services/messaging-service -- jest --showConfig > "$TEMP/messaging-jest-config.json"
echo "exit=$?"
npm run test:tdd --workspace=services/messaging-service
echo "exit=$?"
npm run type-check --workspace=services/messaging-service
echo "exit=$?"
```

Expected: all `0`; `test:tdd` reports no tests (allowed by `--passWithNoTests`); type-check unchanged.

- [ ] **Step 8: Commit**

Pre-commit-check skill (its full `npm test` must stay green: messaging has no `test` script yet,
so Turbo still skips it). Inspect `git status` for promoter/landing churn per Task 7 Step 2. Then:

```bash
git add tests/regression/sprint-131-messaging-declarations.test.ts services/messaging-service/package.json package-lock.json services/messaging-service/jest.config.js
git commit -m "fix(messaging): declare imported runtime packages; add jest harness for BUG-034"
```

---

## Task 4: Characterize `messageService`, promote it, make it blocking

**Files:**
- Create: `services/messaging-service/tests/tdd/messageService.test.ts` → moved to `tests/regression/messageService.test.ts`
- Modify: `services/messaging-service/package.json` (scripts)
- Modify: `tests/regression/sprint-122-turbo-test-inputs.test.ts:40-43,85-106`

**Interfaces:**
- Consumes: Task 3's `jest.config.js`, `test:tdd`, declared Jest toolchain.
- Produces: `karmyq-messaging-service#test` runs `tests/regression/messageService.test.ts` (6 tests).

- [ ] **Step 1: Write the characterization suite in `tdd/`**

Create `services/messaging-service/tests/tdd/messageService.test.ts` (Write tool):

```ts
/**
 * Sprint 131 PR B (BUG-034): the first tests messaging-service has ever had.
 *
 * Exercises the REAL messageService functions. Only the database module is replaced; its real
 * version constructs a pg Pool at import time. No Redis, no Socket.IO, no HTTP server.
 *
 * These characterize existing behavior, so they may pass on first run. Each authorization/ordering
 * assertion was proven able to fail by a temporary mutation (recorded in the PR B handoff).
 */
import { query } from '../../src/database/db';
import { getMessages, sendMessage } from '../../src/services/messageService';

jest.mock('../../src/database/db', () => ({ query: jest.fn() }));

const mockQuery = query as jest.MockedFunction<typeof query>;

const CONVERSATION = 'c0ffee00-0000-4000-8000-000000000001';
const MEMBER = 'a11ce000-0000-4000-8000-000000000002';
const OUTSIDER = '0b5e0000-0000-4000-8000-000000000003';
const NOT_PARTICIPANT = 'User is not a participant in this conversation';

const rows = (r: unknown[]) => ({ rows: r }) as any;
const PARTICIPANT_SQL = /FROM messaging\.conversation_participants\s+WHERE conversation_id = \$1 AND participant_id = \$2/;

let consoleError: jest.SpyInstance;

beforeEach(() => {
  // Root jest.config.js sets resetMocks + restoreMocks: implementations and spies are wiped before
  // every test, so all behavior is installed here or in the test, never at module scope.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('getMessages', () => {
  it('denies a non-participant before querying any messages', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));

    await expect(getMessages(CONVERSATION, OUTSIDER, 20, 40)).rejects.toThrow(NOT_PARTICIPANT);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(PARTICIPANT_SQL);
    expect(mockQuery.mock.calls[0][1]).toEqual([CONVERSATION, OUTSIDER]);
  });

  it('returns a participant the requested page in chronological order', async () => {
    const newest = { id: 'm3', created_at: '2026-09-16T10:03:00.000Z' };
    const middle = { id: 'm2', created_at: '2026-09-16T10:02:00.000Z' };
    const oldest = { id: 'm1', created_at: '2026-09-16T10:01:00.000Z' };
    mockQuery
      .mockResolvedValueOnce(rows([{ participant_id: MEMBER }]))
      .mockResolvedValueOnce(rows([newest, middle, oldest])); // SQL orders DESC

    const messages = await getMessages(CONVERSATION, MEMBER, 20, 40);

    expect(messages.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(sql).toMatch(/ORDER BY m\.created_at DESC\s+LIMIT \$2 OFFSET \$3/);
    expect(params).toEqual([CONVERSATION, 20, 40]);
  });

  it('defaults to the first page of 50', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ participant_id: MEMBER }])).mockResolvedValueOnce(rows([]));

    await expect(getMessages(CONVERSATION, MEMBER)).resolves.toEqual([]);

    expect(mockQuery.mock.calls[1][1]).toEqual([CONVERSATION, 50, 0]);
  });
});

describe('sendMessage', () => {
  it('denies a non-participant without inserting anything', async () => {
    mockQuery.mockResolvedValueOnce(rows([]));

    await expect(sendMessage(CONVERSATION, OUTSIDER, 'hello')).rejects.toThrow(NOT_PARTICIPANT);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual([CONVERSATION, OUTSIDER]);
    expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO messaging\.messages/.test(sql))).toBe(false);
  });

  it('checks, inserts, bumps the conversation, then attaches the sender', async () => {
    const inserted = {
      id: 'm4',
      conversation_id: CONVERSATION,
      sender_id: MEMBER,
      content: 'hello',
      status: 'sent',
      created_at: '2026-09-16T10:04:00.000Z',
    };
    const sender = { id: MEMBER, name: 'Maria Reyes', email: 'maria@example.test' };
    mockQuery
      .mockResolvedValueOnce(rows([{ participant_id: MEMBER }]))
      .mockResolvedValueOnce(rows([inserted]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([sender]));

    const message = await sendMessage(CONVERSATION, MEMBER, 'hello');

    expect(message).toEqual({ ...inserted, sender });
    const calls = mockQuery.mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[0][0]).toMatch(PARTICIPANT_SQL);
    expect(calls[0][1]).toEqual([CONVERSATION, MEMBER]);
    expect(calls[1][0]).toMatch(/INSERT INTO messaging\.messages \(conversation_id, sender_id, content, status\)\s+VALUES \(\$1, \$2, \$3, 'sent'\)/);
    expect(calls[1][1]).toEqual([CONVERSATION, MEMBER, 'hello']);
    expect(calls[2][0]).toMatch(/UPDATE messaging\.conversations\s+SET last_message_at = CURRENT_TIMESTAMP\s+WHERE id = \$1/);
    expect(calls[2][1]).toEqual([CONVERSATION]);
    expect(calls[3][0]).toMatch(/SELECT id, name, email FROM auth\.users WHERE id = \$1/);
    expect(calls[3][1]).toEqual([MEMBER]);
  });

  it('logs and rethrows a database failure', async () => {
    const failure = new Error('connection terminated');
    mockQuery.mockRejectedValueOnce(failure);

    await expect(sendMessage(CONVERSATION, MEMBER, 'hello')).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledWith('Error in sendMessage:', failure);
  });
});
```

- [ ] **Step 2: Discovery and an exact green count**

```bash
npm exec --workspace=services/messaging-service -- jest --runTestsByPath tests/tdd/messageService.test.ts --listTests --runInBand
npm exec --workspace=services/messaging-service -- jest --runTestsByPath tests/tdd/messageService.test.ts --runInBand --json --outputFile="$TEMP/messaging-tdd.json"
echo "exit=$?"
node -e "const r=require(process.env.TEMP+'/messaging-tdd.json');console.log({total:r.numTotalTests,passed:r.numPassedTests,failed:r.numFailedTests,pending:r.numPendingTests,suites:r.numTotalTestSuites})"
```

Expected: one path; exit 0; `{ total: 6, passed: 6, failed: 0, pending: 0, suites: 1 }`. A
TypeScript diagnostic or import failure is not green: fix the test.

- [ ] **Step 3: Prove each guard can fail (temporary mutations, one at a time)**

For each mutation: edit `services/messaging-service/src/services/messageService.ts`, re-run the
Step 2 JSON command, record `failed` and the failing test name, then restore with
`git checkout -- services/messaging-service/src/services/messageService.ts` and confirm
`git diff --quiet -- services/messaging-service/src` exits 0.

| # | Mutation | Must fail |
|---|---|---|
| M1 | `getMessages`: `participantCheck.rows.length === 0` → `participantCheck.rows.length === -1` | `denies a non-participant before querying any messages` |
| M2 | `getMessages`: `return result.rows.reverse();` → `return result.rows;` | `returns a participant the requested page in chronological order` |
| M3 | `sendMessage`: `participantCheck.rows.length === 0` → `participantCheck.rows.length === -1` | `denies a non-participant without inserting anything` |
| M4 | `sendMessage`: move the `UPDATE messaging.conversations` query below the sender lookup | `checks, inserts, bumps the conversation, then attaches the sender` |

A mutation that leaves 6/6 passing means the assertion is decorative. Strengthen the test, then
redo Step 2 and that mutation.

- [ ] **Step 4: Trip the Sprint 122 tripwire on purpose**

With the tdd file present:

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-turbo-test-inputs.test.ts --runInBand
```

Expected: **1 failed**: `the messaging-service exemption is still justified — it must have zero
test files` (`Expected: 0, Received: 1`). This is the gate working as designed; record it.

- [ ] **Step 5: Promote by hand, then add the blocking scripts**

Do **not** run root `npm test` first; the promoter would move it for you and hide whether the move was intended.

```powershell
if (Test-Path services/messaging-service/tests/regression/messageService.test.ts) { throw 'destination exists' }
Move-Item -LiteralPath services/messaging-service/tests/tdd/messageService.test.ts -Destination services/messaging-service/tests/regression/messageService.test.ts
```

In `services/messaging-service/package.json`, replace the `scripts` block with:

```json
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "test": "npm run test:unit && npm run test:regression",
    "test:unit": "jest --testPathPatterns=tests/unit/ --passWithNoTests",
    "test:regression": "jest --testPathPatterns=tests/regression/",
    "test:tdd": "jest --testPathPatterns=tests/tdd/ --passWithNoTests"
  },
```

`test:regression` has **no** `--passWithNoTests`: if the suite disappears, the blocking tier fails
instead of reporting green. `--testPathPatterns` (plural, anchored to `tests/<tier>/`), never a
positional pattern (`docs/guides/testing-guide.md`, the `comm-unit-y` trap). Scripts don't enter the
lock's workspace node, so no splice is needed; re-run the declarations gate to confirm (6 passed).

```bash
npm exec --workspace=services/messaging-service -- jest --runTestsByPath tests/regression/messageService.test.ts --listTests --runInBand
npm run test --workspace=services/messaging-service
echo "exit=$?"
```

Expected: the listing names `tests/regression/messageService.test.ts`; `npm run test` exit 0 with
`test:unit` reporting no tests and `test:regression` reporting **6 passed**.

- [ ] **Step 6: Replace the exemption in the turbo-inputs gate**

In `tests/regression/sprint-122-turbo-test-inputs.test.ts`:

1. Replace the comment above `MESSAGING_SERVICE_TEST_TASK` (lines 40–42) with:

```ts
// messaging-service was exempted from the "hashes a test file" rule while it had no tests
// (BUG-034). Sprint 131 PR B gave it a blocking suite, so the exemption is gone and this task id is
// now asserted positively below.
```

2. In `every test task hashes at least one actual test file`, delete the exemption: the
   comment and `if (t.taskId === MESSAGING_SERVICE_TEST_TASK) return false;` (lines 87–91), leaving:

```ts
    const blind = testTasks
      .filter((t) => !Object.keys(t.inputs || {}).some(isTestFile))
      .map((t) => t.taskId);
```

3. Replace the whole `the messaging-service exemption is still justified…` test (lines 99–106) with:

```ts
  it('messaging-service hashes its own jest config and blocking suite (BUG-034)', () => {
    expect(inputsOf(MESSAGING_SERVICE_TEST_TASK)).toEqual(
      expect.arrayContaining(['jest.config.js', 'tests/regression/messageService.test.ts']),
    );
  });
```

4. `countTestFiles` is now unused; delete it and drop `existsSync`/`readdirSync` from the `fs`
   import only if nothing else uses them (`existsSync` is still used by the jest-config test).

5. Measure, don't assume, the `// 15 workspaces declare a test task` comment:

```bash
npx turbo run test --dry=json > "$TEMP/turbo-dry.json"
node -e "const d=require(process.env.TEMP+'/turbo-dry.json');const t=d.tasks.filter(x=>x.taskId.endsWith('#test'));console.log(t.length, t.some(x=>x.taskId==='karmyq-messaging-service#test'))"
```

Update the number in the comment to the measured count (and keep `toBeGreaterThan(10)`).

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-turbo-test-inputs.test.ts --runInBand
```

Expected: all pass, including the new messaging case. Prove it can fail by temporarily renaming
`services/messaging-service/jest.config.js` to `jest.config.js.bak` → re-run → the new case fails on
the missing input → rename back → `git status --short` shows no `.bak`.

- [ ] **Step 7: Commit**

Pre-commit-check skill; after its root `npm test`, inspect `git status` (Task 7 Step 2 rules).
Messaging's tdd tier is now empty, so the promoter has nothing of ours to move. Then:

```bash
git add services/messaging-service/tests/regression/messageService.test.ts services/messaging-service/package.json tests/regression/sprint-122-turbo-test-inputs.test.ts
git status --short
git commit -m "test(messaging): blocking coverage for getMessages and sendMessage (BUG-034)"
```

`git status` must not show `services/messaging-service/tests/tdd/messageService.test.ts` (never
tracked; moved before staging).

---

## Task 5: Explicit tier-parity guarantee for messaging

**Files:**
- Modify: `tests/regression/sprint-122-tier-parity.test.ts:163-168,197-198` and add one case

- [ ] **Step 1: Add the explicit assertion**

Inside the `describe`, after the `it.each` block, add:

```ts
  it('services/messaging-service runs a non-empty, discovered blocking suite (BUG-034)', () => {
    // The generic cases above accept a workspace with no test script as long as it has no test
    // files. That allowance is right in general, and it is exactly how messaging-service sat at
    // zero tests unnoticed. This pins the Critical service to having real blocking coverage.
    const dir = join(ROOT, 'services', 'messaging-service');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

    const invocations = jestInvocations(pkg);
    expect(invocations.length).toBeGreaterThan(0);

    const regression = testFilesUnder(join(dir, 'tests', 'regression')).map(norm);
    expect(regression.length).toBeGreaterThan(0);

    const seen = new Set(invocations.flatMap((args) => listed(dir, args)).map(norm));
    expect(regression.filter((f) => !seen.has(f))).toEqual([]);
  }, 300_000);
```

- [ ] **Step 2: Correct the stale comments; keep the generic allowance**

Replace lines 164–166:

```ts
      // No jest invocation at all is acceptable ONLY with nothing to run. services/messaging-service
      // relied on this until Sprint 131 PR B (BUG-034); it is now pinned explicitly below.
```

Replace lines 197–198:

```ts
    // A workspace with zero test files is not "silent" and is not listed here; see the explicit
    // messaging-service case for how a Critical service is kept from sitting at zero.
```

The `if (invocations.length === 0)` branch and its assertion stay unchanged. The allowance is
generic, not a named exemption.

- [ ] **Step 3: Green, then prove the new case adds coverage**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-tier-parity.test.ts --runInBand
```

Expected: all pass (the case count is the previous count + 1; record it).

Then two temporary breakages, each restored and verified with `git status --short`:

1. Remove the `"test"` script from messaging's `package.json` → re-run → the new case fails on
   `invocations.length`. Restore with `git checkout -- services/messaging-service/package.json` (it
   is committed after Task 4).
2. `Move-Item` the regression suite back to `tests/tdd/` → re-run → the **new case fails** on
   `regression.length` while the generic `it.each` case for messaging **passes**, which proves the explicit
   assertion catches what the generic allowance cannot. Move it back; confirm `git status --short` is clean.

- [ ] **Step 4: Commit**

Pre-commit-check skill, then:

```bash
git add tests/regression/sprint-122-tier-parity.test.ts
git commit -m "test(gates): pin messaging-service to real blocking coverage (BUG-034)"
```

---

## Task 6: Documentation loop

**Files:**
- Modify: `docs/BUGS.md` (BUG-034 at line 560, BUG-036 at line 615)
- Modify: `services/messaging-service/CONTEXT.md`
- Modify: `scripts/claude.md` (entry-points table)
- Modify: `docs/guides/testing-guide.md`
- Regenerated: `apps/landing/src/data/docs/services/messaging-service.json` (keep substantive changes only)

- [ ] **Step 1: Close BUG-034 and BUG-036 with their exact boundaries**

Change the headers to `· fixed (Sprint 131 PR B, pending deploy)` and append to each entry.
Fill `<n>` values from the evidence you recorded, not from this plan.

BUG-034:

```markdown
**Fixed (Sprint 131 PR B).** `services/messaging-service` now has a local `jest.config.js`, tiered
`test` scripts (blocking `test:regression` has no `--passWithNoTests`) and
`tests/regression/messageService.test.ts`: 6 tests against the real `getMessages`/`sendMessage`
with only the database module mocked, each authorization/ordering guard proven by a reverted
mutation. The Jest toolchain (`jest`, `ts-jest`, `@types/jest`) is now declared by the workspace.
Sprint 122's zero-test exemptions were replaced by positive assertions (`sprint-122-turbo-test-inputs`,
`sprint-122-tier-parity`).

**Shipped alongside, not part of this report:** the same PR declares the five runtime packages
messaging imported without declaring (`cors`, `dotenv`, `express`, `jsonwebtoken`, `pg`, at root's
exact ranges, so nothing upgraded). That is the "declare what you import" class previously fixed
here for `@karmyq/shared` and `redis` (messaging `CONTEXT.md`, Sprint 122 sections), scoped into PR B
by the Sprint 131 spec. `tests/regression/sprint-131-messaging-declarations.test.ts` fails on any new
undeclared import.

**Not covered:** `getOrCreateConversation`, `getUserConversations`, `getConversation`,
`markMessagesAsRead`, the REST routes, the Socket.IO handler and Redis pub/sub. A live message
round-trip is still a manual post-deploy check.
```

BUG-036:

```markdown
**Fixed (Sprint 131 PR B).** `Test Docker Build` now runs `scripts/wait-for-http.js` after `up -d`:
up to 30 attempts, 5 s per-request timeout, 5 s between attempts (worst case ≈ 5 min), and both
`127.0.0.1:3001/health` and `127.0.0.1:3000` must succeed in the same attempt; compose logs still
print on failure. `tests/regression/sprint-131-wait-for-http.test.ts` proves retry, same-attempt,
per-request timeout, exhaustion and usage against real scripted servers;
`sprint-131-ci-readiness-workflow.test.ts` pins the wiring. Compose healthchecks /
`up --wait` were not added (optional in the original report).
```

- [ ] **Step 2: Messaging CONTEXT**

Append a dated section to `services/messaging-service/CONTEXT.md` (use the real execution date):

```markdown
## Sprint 131 PR B — first tests, declared imports (YYYY-MM-DD)

**Tests.** `npm test` = `test:unit && test:regression` via `jest.config.js` (extends root; four-tier
`testMatch`; `setupFilesAfterEnv: []`). `tests/regression/messageService.test.ts` covers
`getMessages` (participant denial before any message query; DESC page reversed to chronological;
`[conversationId, limit, offset]`, default 50/0) and `sendMessage` (denial without insert; check →
insert `'sent'` → `last_message_at` update → sender lookup; DB failure logged and rethrown). Only
`src/database/db` is mocked. Root Jest `resetMocks`/`restoreMocks` wipe mocks before every test,
so install behavior in `beforeEach` or the test.

**Untested:** the other four service functions, routes, `socket/messageHandler.ts`, Redis.

**Declarations.** Now declares `cors`, `dotenv`, `express`, `jsonwebtoken`, `pg` (root's exact ranges;
resolved versions unchanged) and `jest`/`ts-jest`/`@types/jest`.
`tests/regression/sprint-131-messaging-declarations.test.ts` fails on any undeclared import. Root
still declares these too, so a root-level major bump (e.g. dotenv 17) must bump this manifest in the
same PR.

No endpoint, payload, event or schema change.
```

Append ` *(Superseded by Sprint 131 PR B, below.)*` to the end of each of the two existing
"⚠️ **This service … zero test files**" paragraphs (Sprint 122 and Sprint 122 PR 5 sections). Do not
rewrite those historical sections.

- [ ] **Step 3: `scripts/claude.md` and the testing guide**

In `scripts/claude.md`'s entry-points table, add after the `image-size` row:

```markdown
| `Test Docker Build` job (`test.yml`) | `wait-for-http.js` | Bounded readiness wait: every URL must answer 2xx/3xx in the same attempt, each request capped by `--timeout-ms`, `--attempts` × pause `--interval-ms`; exit 0 ready / 1 gave up / 2 usage (BUG-036). `tests/regression/sprint-131-wait-for-http.test.ts` proves it against real scripted servers |
```

In `docs/guides/testing-guide.md`, add a section immediately before `## How a \`tdd/\` test graduates`:

```markdown
## Backend mocks are reset before every test

Root `jest.config.js` sets `clearMocks`, `resetMocks` and `restoreMocks`, and service configs
spread it. `resetMocks` strips the implementation from **every** mock before each test, including a
`jest.fn(impl)` created in a `jest.mock` factory or at module scope. So a module-scope
`mockResolvedValue` silently becomes `undefined` from the second test onward. Install behavior in
`beforeEach` or inside the test (`services/messaging-service/tests/regression/messageService.test.ts`
is a small example).

`apps/frontend` does **not** inherit this: its `next/jest` config clears nothing, so call counts
accumulate across tests unless a test resets them.
```

Before writing the frontend sentence, verify it: `grep -nE "clearMocks|resetMocks|restoreMocks" apps/frontend/jest.config.*`.
If the frontend config now sets any of them, drop or correct that paragraph.

- [ ] **Step 4: Regenerate, verify, commit**

```bash
git add docs/BUGS.md services/messaging-service/CONTEXT.md scripts/claude.md docs/guides/testing-guide.md
npm run feedback:check
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand
```

`feedback:check` reads the staged diff, so stage first. Regenerate landing docs via the landing
prebuild (root `npm test` does it). In `apps/landing/src/data/docs/`, keep the substantive
`services/messaging-service.json` change and revert only proven timestamp/HEAD-sha churn elsewhere.
Record in the commit body why `services/registry.json` and ADRs are unchanged: no endpoint, event,
schema or registry-tracked field changed; the registry entry has no npm-dependency or test field.

Pre-commit-check skill, then:

```bash
git add apps/landing/src/data/docs/services/messaging-service.json
git status --short
git commit -m "docs: close BUG-034 and BUG-036; messaging tests, readiness wait, mock-reset guide"
```

---

## Task 7: Quality gates, version, PR

**Files:**
- Modify: `package.json` (version)
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] **Step 1: SDLC gates on the branch diff**

This diff touches CI, a manifest and the lockfile, and changes two existing gates, so it is **risky**. Calibrate up:

```
/simplify
/code-review high
/security-review
```

Specific questions for `/security-review`: `wait-for-http.js` fetches URLs taken from argv. In CI,
those URLs are hard-coded workflow literals. If CodeQL raises `js/request-forgery` on it, surface it
to the maintainer as a false positive; never loop the dismissal API. The lock diff adds **no**
package nodes (declarations only). The workflow adds no permissions, secrets or third-party actions
(`actions/setup-node@v7` is already used by this file). Resolve or justify each finding in writing.

- [ ] **Step 2: Full blocking suite, forced, and inspect what it moved**

```bash
git status --short > "$TEMP/pre-test-status.txt"
npm test -- --concurrency=1 --force
echo "exit=$?"
git status --short
```

Expected: exit 0, with messaging's `test` task in the Turbo summary. Compare the tree with the snapshot:

1. **Promoter:** any file moved from some `tests/tdd/` into `regression/` that is not ours:
   move it back with `Move-Item -LiteralPath <dest> -Destination <original>` (only when the source is
   absent); `git restore` alone won't remove an untracked destination.
2. **Landing churn:** revert only proven timestamp/HEAD-sha metadata; keep substantive regenerated content.

Also run the frontend-independent type checks CI runs for this service:
`npm run type-check --workspace=services/messaging-service` (exit 0).

- [ ] **Step 3: Derive the version**

```bash
git fetch origin
git show origin/master:package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))"
```

Increment master's minor and write it to root `package.json` (`11.57.0` if master is still
`11.56.0`). If master moved, first merge `origin/master` into this branch (merge commit, not
rebase) and re-run Step 2.

- [ ] **Step 4: Handoff to real state**

Update `.claude/handoff/CURRENT_HANDOFF.md`: B ready to open (no invented PR number); dated
evidence: Task 1 red 7→green 7; Task 2 red 5/1→6; Task 3 red 2/4→1/5→6, lock diff 8 insertions,
strict `ci`/`ls` exits; Task 4 JSON counts, M1–M4 results, tripwire failure; Task 5 counts and both
breakage proofs; gate outcomes; full-suite result and any restored promotions. Next task: open B,
checks, maintainer authorization. D1 stays blocked until B deploys and is health-verified.

- [ ] **Step 5: Commit and push**

```bash
git add package.json .claude/handoff/CURRENT_HANDOFF.md
git status --short
git commit -m "chore: bump version for Sprint 131 PR B, update handoff"
git push --set-upstream origin agent/codex/sprint-131-test-readiness
```

The pre-push hook runs unit + regression. A push that finishes silently and instantly means no hook
ran; check `git config core.hooksPath`.

- [ ] **Step 6: Open the PR, verify CI actually exercised both halves, stop**

Fill every section of `.github/pull_request_template.md` (Lane: the executor's lane, currently claude); real executor attribution.
Once checks finish on the head, confirm from logs, not from green ticks:

```bash
gh pr checks <n>
gh run view <ci-run-id> --log | grep -n "karmyq-messaging-service:test" | head
gh run view <tests-run-id> --log | grep -nE "ready after [0-9]+ attempt|not ready|gave up"
```

Expected: the backend job log shows `karmyq-messaging-service:test` running `messageService.test.ts`
with 6 passing; the **Test Docker Build** job passed **on its first run** and logs
`ready after <n> attempt(s)`. Record both in the handoff (commit + push to this branch with the
pre-commit checks). Then **stop**: report PR number and check status; do not merge.

- [ ] **Step 7: After the maintainer merges — deploy and smoke**

Watch **Deploy to Demo** on the master run through its health verification (no rollback). Then, as
`maria.reyes@test.karmyq.com` (API login → localStorage, per the demo-access reference),
load `/messages` or any page that calls `GET /api/conversations` and confirm `200`. This build changes
messaging's manifest, not its resolved packages, so this is a regression smoke, not a feature test.
Record it dated in the handoff on the next PR's branch (no docs-only master push). Only then does D1 start.

---

## Self-Review

**Spec coverage.** *Messaging:* local Jest config modeled on notification with empty
`setupFilesAfterEnv` (Task 3 Step 7); test tools declared + lock spliced (Task 3 Steps 4–6); the five
runtime imports declared at baseline ranges, with the remaining imports audited by a live scan (Task 3
Steps 2–4); the real `messageService` with mocked DB, all four required cases plus defaults and
failure propagation, no Redis/Socket.IO (Task 4 Step 1); tier-parity's generic allowance preserved,
explicit messaging test-script + nonempty discovery assertions added, stale comments removed (Task 5;
Task 4 Step 6 for the turbo gate the spec did not name). *Docker:* `sleep 30` and immediate checks
replaced; both auth health and frontend required; failure logs preserved (Task 2); per-attempt HTTP
bound plus retry count/delay (Task 1 Step 5); retries and exhaustion proven with scripted HTTP
outcomes, not a YAML regex (Task 1 Step 2). *Notes 5, 6, 9, 11, 13* map to Global Constraints and
Tasks 3, 4, 7. *Docs (spec "User guide" B list):* messaging CONTEXT, registry (verified no change),
testing guide, BUG-034/036, workflow documentation via `scripts/claude.md` (Task 6).

**Bug attribution.** BUG-034's report covers only "zero tests, no `test` script". The runtime
declarations come from the spec's PR B scope, not the bug. They are labelled "Sprint 131 PR B"
in their test, commit and close-out, and never presented as fixing BUG-034 (Kimi review, 2026-09-16).

**CI-load robustness.** Task 1's cases that expect a server to answer use a 5000ms per-request timeout. The refused-connection
case uses 1000ms, since its verdict does not depend on timing. The hang case asserts a
time floor, not a ceiling, and at-least-one hit rather than an exact count. Short timeouts or ceilings
would flake under Turbo's parallel load in CI (added after review, 2026-09-16).

**Deviation from the sprint plan, stated:** the sprint plan suggested an inline `curl` loop. This
plan uses a Node script because the spec requires proof by scripted HTTP outcomes, which an inline
bash loop cannot get on this Windows host. The bounds are the sprint plan's own (30 × 5 s, 5 s
per request). The sprint plan's Task 6 also missed `sprint-122-turbo-test-inputs.test.ts`, which
fails the moment messaging has a test file; Task 4 handles it.

**Placeholder scan.** Every code step carries literal content. Values deliberately left to execution
are measured values: the Turbo task count (Task 4 Step 6), the dated evidence counts (Tasks 6–7), the
version (Task 7 Step 3), and PR/run ids. Each names the command that produces it.

**Type/name consistency.** Script path `scripts/wait-for-http.js`, flags `--attempts/--interval-ms/--timeout-ms`,
and output strings `ready after N attempt(s)`, `attempt n/N not ready: <url> (<reason>)`, `gave up after N attempts`
match between Task 1's test, its implementation, Task 2's workflow test and Task 7's log grep.
`MESSAGING_SERVICE_TEST_TASK = 'karmyq-messaging-service#test'` is the constant already in the gate. The suite
path `tests/regression/messageService.test.ts` is identical in Tasks 4–7. `jestInvocations`, `listed`,
`testFilesUnder`, `norm`, `ROOT`, `join`, `readFileSync` already exist or are imported in the tier-parity file.
