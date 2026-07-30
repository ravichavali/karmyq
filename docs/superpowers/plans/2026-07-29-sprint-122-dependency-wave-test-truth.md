# Sprint 122: Dependency Wave + Test-Tier Truth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship express 4 → 5, make the test tier's cache keys honest, and disposition all 9 open
dependency PRs — 6 merged, 3 closed with rationale.

**Architecture:** Nothing new is built. Express 5 changes runtime semantics under 197 existing route
literals across 10 services; `turbo.json`'s `test` inputs change what the cache considers a
different run; two new blocking regression gates pin lint-config resolution and Expo SDK alignment.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 15, React Native + Expo SDK 57, PostgreSQL 15,
Bull queue, Turborepo.

**Design spec:** [`2026-07-29-sprint-122-dependency-wave-test-truth-design.md`](../specs/2026-07-29-sprint-122-dependency-wave-test-truth-design.md)

---

## Scope of THIS plan file

**Tasks 1–10 below are PR 1 (express 4 → 5, v11.36.0)** — the immediately executable work.

**PRs 2–6 get their own plan files**, authored at the start of their own chats, per CLAUDE.md's
multi-PR sprint cadence ("per-PR plan files and a fresh chat per PR"). Their scope, version, gate
level and critical notes are already fixed in the design spec's Plan of Record and repeated as
outlines at the end of this file — do **not** re-litigate scope when writing them.

---

## File Map (PR 1)

### New files to create
| File | Responsibility |
|------|---------------|
| `services/geocoding-service/tests/tdd/sprint-122-express5-runtime.test.js` | Runtime proof for the ONE service with no `tsc` coverage: body parsing works, async rejection reaches the error handler as an ADR-074 envelope |
| `tests/tdd/sprint-122-express5-contract.test.ts` | Cross-service contract: `express.json()` resolves body-parser **2.x**, async rejection → `{success:false,message,error}`, `req.query` is a getter |

### Existing files to modify
| File | Change |
|------|--------|
| `package.json` (root) | `express` `^4.18.2` → `^5.2.1`; `overrides.body-parser` `"1.20.6"` → range-scoped selector or removed; `version` → `11.36.0` |
| `package-lock.json` | Surgical in-place resolution of the express subtree |
| `packages/shared/package.json` | `@types/express` `^4.17.21` → `^5.0.6` |
| `packages/shared/middleware/{auth,dbContext,rateLimit,tenant,validate}.ts` | `@types/express` 5 signature fallout, if any |
| `services/*/package.json` (9 services) | `@types/express` `^4.17.21` → `^5.0.6` where declared |
| `services/geocoding-service/package.json` | `express` `^4.18.2` → `^5.2.1` (declares it directly) |
| `services/*/src/**/*.ts` | Only where express 5 type/semantic fallout is real — expect few or none |
| `CLAUDE.md` | Tech-stack drift: **"Next.js 14" → Next.js 15**; confirm the Express reference |
| `docs/ARCHITECTURE.md` | Express 5 baseline |
| `apps/landing/src/data/docs/architecture.json` | Regenerated from `docs/ARCHITECTURE.md` (`git add -f` — gitignored but tracked) |
| `packages/shared/CONTEXT.md` | `@types/express` 5 middleware signatures; note the `express-rate-limit` 7/8 split |
| `services/*/CONTEXT.md`, `services/registry.json` | Dependency deltas per changed service |
| `.claude/handoff/CURRENT_HANDOFF.md` | Progress, every task |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Copied verbatim from the spec. Notes 1, 3, 6, 7 and 11 are the ones that change what you type.

1. **⚠️ `overrides.body-parser: "1.20.6"` will break express 5.** express `5.2.1` depends on
   `body-parser ^2.2.1`, but the root override is **unscoped**, so it forces `1.20.6` tree-wide —
   into express 5's own tree. Express 5 calls body-parser 2's API. Convert the override to a
   range-scoped selector (the shape already used for `ws@8.0.0 - 8.20.0`, `form-data@4.0.0 - 4.0.5`,
   `sharp@<0.35.0`), or drop it once nothing resolves body-parser 1. **Prove it with
   `npm ls body-parser`** — express 5's tree must show 2.x. This is the single most likely way to
   ship an express 5 that builds green and drops every request body.
   **Safety net worth knowing:** `express.json()` is body-parser, and it is called in all 9 service
   entrypoints plus **46 test files** — so the existing regression suites *will* catch this if you
   miss it. Do not rely on that instead of the `npm ls` proof; rely on both.

2. **✅ Express 5's most common migration blocker is ABSENT here — verified, not assumed.** All
   **197 unique route path literals** across `services/`, `packages/` and `apps/frontend` contain
   **zero** `*`, `?`, `(` or `)`, so `path-to-regexp` 8's syntax break does not apply. Also **zero**
   occurrences repo-wide of: `req.query =` assignment, `req.param(`, `res.sendfile`, `app.del(`,
   `res.json(status, body)`, `req.host`, `res.redirect('back')`, `express.urlencoded`. The remaining
   risk is **runtime semantics**, not syntax.

3. **The express surface is not what Sprint 121's Critical Note 5 said.** Verified:
   - **`packages/shared` does NOT declare `express`.** It declares `@types/express ^4.17.21` (dev)
     and `express-rate-limit ^7.1.5` (prod). Its five middleware files
     (`packages/shared/middleware/{auth,dbContext,rateLimit,tenant,validate}.ts` — note: **outside
     `src/`**) import `Request`/`Response`/`NextFunction` as types only.
   - **Root `package.json` declares `express ^4.18.2` as a PRODUCTION dependency.** That is how all
     9 backends get it: their Dockerfiles copy the root manifest and run `npm install --omit=dev`.
   - **`services/geocoding-service/src` is plain JavaScript** (`geocodingApp.js`,
     `geocodingService.js`, `response.js`) and gets **no `tsc` coverage at all**. Its express 5
     behaviour must be proven by a runtime test. It is the one service where a green build says
     nothing.
   - **111 source files import from `'express'`**, overwhelmingly for types.

4. **`express-rate-limit` is split across majors and express 5 does not force the alignment.** Root
   `^8.2.2`, `packages/shared` `^7.1.5`. Verified peers: v8 wants `express: ">= 4.11"`, v7.1.5 wants
   `express: "4 || 5 || ^5.0.0-beta.1"` — **both accept express 5**. Note the split; do **not** fix
   it in this PR. (`packages/shared` also declares `zod ^3.22.4` against root's `^4.1.12` — same
   class, same answer: out of scope.)

5. **Express 5 semantic changes that matter here**, in the order they are likely to bite:
   `async` handler rejections are now forwarded to the error middleware automatically (so a handler
   that used to hang may now produce an error response — the **ADR-074 envelope
   `{ success:false, message, error }` must still be what comes out**); `res.status()` **throws
   `RangeError`** on an out-of-range code; `req.query` is a **getter**; `res.clearCookie` ignores
   `maxAge`/`expires`.

6. **`npm audit` baseline is `found 0 vulnerabilities`.** Advisories publish mid-flight — four times
   across Sprints 120–121. Signature: `Security Audit` **and** `sprint-75-security-gate` go red
   *together* on a diff that touches no dependencies. Check for a new advisory before debugging
   anything; remediate with a surgical in-place bump; **re-check immediately before merging**, not
   just when CI last ran.

7. **Standing mechanics:** surgical in-place lockfile bumps only — never `npm dedupe`, never a
   scratch regen on Windows, never a root **prod** dep added to force hoisting; run the
   **edge-vs-node** check before pushing and diff against `origin/master` so the ~26 deliberate
   `overrides` mismatches don't drown the real finding; branch off `origin/master`, never local
   master; **explicit admin authorization for the squash merge**; no docs-only master pushes; run
   cross-workspace suites **directly** (`cd tests && npx jest regression/<file>`) because Turbo
   caches stale cross-workspace passes — **that bug is not fixed until PR 2**; `npm test`
   regenerates landing docs, so revert timestamp/HEAD-sha churn before committing; grep-verify
   `nav.json` after any landing regen.

8. **A green pipeline is not the bar.** A merge fans out into three master runs — `Tests`, `CodeQL`,
   `CI/CD Pipeline` — and **only `CI/CD Pipeline` has a `Deploy to Demo` job**. Confirm that run
   reached `Deploy to Demo` = success with no rollback, **then** smoke-test the live site.

---

## Task 1: Confirm the branch and capture baselines

**Files:**
- Modify: none (measurement only)

- [ ] **`deps/sprint-122-pr1-express` already exists and carries the planning commit — check it out,
      do not re-cut it.** It was created from `deps/sprint-121-pr6-express`'s tip so that branch's two
      `docs(handoff)` commits are retained (they were **never** on master). Its code tree is identical
      to `origin/master` (`e187c5d6`); the only deltas are documentation. Confirm that before
      changing anything, so any later code diff is unambiguously yours.

```bash
git fetch origin
git checkout deps/sprint-122-pr1-express
git log --oneline -3
git diff --stat origin/master -- ':!*.md' ':!.claude'   # must be EMPTY
# deps/sprint-121-pr6-express is superseded and safe to delete once the above checks out:
git branch -D deps/sprint-121-pr6-express 2>/dev/null || true
git push origin --delete deps/sprint-121-pr6-express 2>/dev/null || true
```

- [ ] **Capture the baselines this PR will be judged against.** The bar is *no regression*, not
      green — several tiers are red on master by design.

```bash
npm audit --audit-level=moderate 2>&1 | tail -3          # expect: found 0 vulnerabilities
node -e "console.log(require('./node_modules/express/package.json').version)"   # 4.22.2
npx tsc --noEmit -p packages/shared 2>&1 | tail -3
cd tests && npx jest unit regression 2>&1 | tail -8 && cd ..   # expect 278/278
```

- [ ] **Baseline each affected service suite DIRECTLY, not through Turbo.** Turbo's cross-workspace
      cache is untrustworthy until PR 2 lands; a cached pass here would poison the comparison.

```bash
for s in auth-service community-service request-service reputation-service \
         notification-service messaging-service social-graph-service \
         cleanup-service geocoding-service; do
  echo "=== $s ==="; (cd services/$s && npx jest 2>&1 | tail -4)
done
```

- [ ] **Verification:** baselines recorded in the handoff before a single dependency line changes.

---

## Task 2: Write the express 5 regression tests FIRST (TDD)

**Files:**
- Create: `tests/tdd/sprint-122-express5-contract.test.ts`
- Create: `services/geocoding-service/tests/tdd/sprint-122-express5-runtime.test.js`

These must be **written and failing (or provably meaningful) before** express is bumped. They exist
because `tsc` cannot see any of it: note 1's body-parser trap, note 5's semantics, and note 3's
untyped geocoding service.

- [ ] **Cross-service contract test.** Assert on real behaviour, not stubs — no mocking the thing
      under test (standing testing rule).

```ts
// tests/tdd/sprint-122-express5-contract.test.ts
import express from 'express';
import request from 'supertest';

describe('Sprint 122 — express 5 runtime contract', () => {
  it('express.json() resolves body-parser 2.x, so POST bodies actually parse', async () => {
    const app = express();
    app.use(express.json());
    app.post('/echo', (req, res) => { res.json({ got: req.body }); });
    const res = await request(app).post('/echo').send({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ got: { a: 1 } });   // fails loudly if the override forced body-parser 1
    // and prove the version, not just the behaviour:
    expect(require('body-parser/package.json').version).toMatch(/^2\./);
  });

  it('a rejected async handler reaches the error middleware as an ADR-074 envelope', async () => {
    const app = express();
    app.get('/boom', async () => { throw new Error('nope'); });
    app.use((err: Error, _req: express.Request, res: express.Response, _n: express.NextFunction) => {
      res.status(500).json({ success: false, message: err.message, error: 'INTERNAL_ERROR' });
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'nope', error: 'INTERNAL_ERROR' });
  });

  it('req.query is a getter (express 5), and reading it still works', async () => {
    const app = express();
    app.get('/q', (req, res) => { res.json({ q: req.query }); });
    const res = await request(app).get('/q?x=1&y=2');
    expect(res.body.q).toEqual({ x: '1', y: '2' });
  });
});
```

- [ ] **Geocoding runtime test** — the only proof available for a plain-JS service. Mount the real
      `geocodingApp.js` and exercise `/health` plus one body-parsing POST route; assert the ADR-074
      envelope shape on an error path.

- [ ] **Verification:** run both directly and confirm they exercise real code. On express 4 the
      body-parser version assertion **must fail** (it is 1.x today) — that failure is the proof the
      test is wired to something real.

```bash
cd tests && npx jest tdd/sprint-122-express5-contract --no-coverage
cd services/geocoding-service && npx jest tests/tdd/sprint-122-express5-runtime
```

---

## Task 3: Fix the body-parser override, then bump express

**Files:**
- Modify: `package.json` (root), `services/geocoding-service/package.json`, `package-lock.json`

- [ ] **Fix `overrides.body-parser` FIRST, before touching express.** Doing it in this order means
      the failure mode (if any) is attributable. Establish *why* the override exists before changing
      it — `git log -S'"body-parser"' -- package.json` — then convert it to a range-scoped selector
      so it constrains only the vulnerable 1.x line and leaves express 5's `^2.2.1` alone.

```jsonc
// root package.json — overrides
"body-parser@<1.20.6": "1.20.6",   // was: "body-parser": "1.20.6"
```

- [ ] **Bump express and `@types/express`** in root, `packages/shared`, and every service that
      declares them. Targets from #34: `express ^5.2.1`, `@types/express ^5.0.6`.

- [ ] **Resolve the lockfile surgically** and prove no extra churn.

```bash
npm install --package-lock-only
git diff --stat package-lock.json
npm install --package-lock-only   # second run must be byte-identical
git diff --stat package-lock.json
```

- [ ] **Verification — the note-1 proof, which is the whole point of this task.**

```bash
npm ls body-parser              # express 5's tree must show 2.x; no 1.x under express
npm ls express                  # 5.2.x everywhere it resolves
npm audit --audit-level=moderate 2>&1 | tail -3   # still 0 vulnerabilities
cd tests && npx jest tdd/sprint-122-express5-contract   # body-parser assertion now PASSES
```

---

## Task 4: Type-check fallout across the 111 express importers

**Files:**
- Modify: `packages/shared/middleware/{auth,dbContext,rateLimit,tenant,validate}.ts` and any
  `services/*/src/**/*.ts` the compiler flags

- [ ] **Type-check every workspace that imports express**, and fix only what `@types/express` 5
      genuinely broke. `@types/express` 5 tightens `Request`/`Response` generics and retypes
      `req.query` — handler signatures that relied on the looser v4 types are where errors land.

```bash
npx tsc --noEmit -p packages/shared
for s in auth-service community-service request-service reputation-service \
         notification-service messaging-service social-graph-service cleanup-service; do
  echo "=== $s ==="; (cd services/$s && npx tsc --noEmit 2>&1 | tail -5)
done
```

- [ ] **Do not widen types to silence errors.** If a handler's request shape was wrong, fix the
      shape. `as any` in a middleware signature is a finding, not a fix.

- [ ] **Verification:** every TS workspace type-checks with **0 new errors** versus the Task 1
      baseline. `geocoding-service` is JS and reports nothing — that is expected, and is why Task 2
      exists.

---

## Task 5: Run every affected suite directly and prove no regression

**Files:**
- Modify: whatever the failures demand

- [ ] **Run all 9 service suites plus `packages/shared` and `tests` directly** (not via Turbo — see
      note 7) and diff against Task 1's baselines.

```bash
(cd packages/shared && npx jest 2>&1 | tail -5)
for s in auth-service community-service request-service reputation-service \
         notification-service messaging-service social-graph-service \
         cleanup-service geocoding-service; do
  echo "=== $s ==="; (cd services/$s && npx jest 2>&1 | tail -5)
done
cd tests && npx jest unit regression 2>&1 | tail -8
```

- [ ] **Treat these two failure shapes as noise, not as your diff** (both documented): a Windows
      Turbo timeout flake — confirm by running the package directly; and the `feed-dibs` privacy
      timestamp flake, whose digit regex false-fires on millisecond timestamps ~2/1000 runs. A lone
      CI red on that test means rerun, not debug.

- [ ] **Verification:** every suite matches or beats its baseline. Both Task 2 tests pass.

---

## Task 6: Docs — drift repairs and the feedback loop

**Files:**
- Modify: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `apps/landing/src/data/docs/architecture.json`,
  `packages/shared/CONTEXT.md`, `services/*/CONTEXT.md`, `services/registry.json`

- [ ] **Fix the CLAUDE.md tech-stack drift found during planning:** the § System Architecture line
      reads **"Next.js 14"** while both apps run `^15.5.21`. Correct it and confirm the Express
      reference still reads true after the 4 → 5 move.

- [ ] **Update `docs/ARCHITECTURE.md`** for the express 5 baseline, then regenerate the landing
      artifact and force-add it (`apps/landing/src/data/docs/` is gitignored but tracked).

```bash
npm run generate:docs 2>/dev/null || (cd apps/landing && npm run prebuild)
git add -f apps/landing/src/data/docs/architecture.json
git checkout -- apps/landing/src/data/docs/build.json   # pure timestamp/HEAD-sha churn
grep -c '"' apps/landing/src/data/docs/nav.json          # grep-verify nav.json did not revert
```

- [ ] **Update `packages/shared/CONTEXT.md`** — `@types/express` 5 middleware signatures, plus a
      note recording the pre-existing `express-rate-limit` 7/8 and `zod` 3/4 splits as known,
      deliberate, out-of-scope.

- [ ] **Update each changed service's `CONTEXT.md`** ("Recent Fixes") and `services/registry.json`
      dependency lists, then regenerate the graph.

```bash
npm run analyze:services
npm run feedback:check
```

- [ ] **Verification:** `npm run feedback:check` lists no outstanding CONTEXT/registry to-dos for
      this diff, and the doc-context drift gate passes when run directly.

```bash
cd tests && npx jest regression/doc-context-drift-gate.test.ts
```

---

## Task 7: Version bump, promote the TDD tests, integration coverage

**Files:**
- Modify: `package.json` (`version` → `11.36.0`), test tier placement

- [ ] **Set `version` to `11.36.0`.** Decided in the Plan of Record — do not leave it TBD. Sprint 121
      PR 3 shipped without a bump for exactly this reason and the fix had to ride the next PR.

- [ ] **Promote the Task 2 tests from `tdd/` to `regression/`.** They guard against a known upgrade
      regression, which is the repo's definition of a regression test. Note
      `scripts/promote-tdd-tests.js` only walks `services/` — the `tests/` workspace test must be
      moved by hand (that script bug is PR 2's work).

```bash
git mv tests/tdd/sprint-122-express5-contract.test.ts tests/regression/
git mv services/geocoding-service/tests/tdd/sprint-122-express5-runtime.test.js \
       services/geocoding-service/tests/regression/
```

- [ ] **Verification:** both promoted tests run in the blocking tier.

```bash
cd tests && npx jest regression/sprint-122-express5-contract
cd services/geocoding-service && npx jest tests/regression
```

---

## Task 8: SDLC quality gates — all four, calibrated to HIGH

**Files:**
- Modify: whatever the findings demand

This PR is a runtime major across all 10 services. Per the standing calibration it reviews at
**HIGH**. Run the gates **inline** (the S121 PR 3/PR 5 precedent), not via sub-agents.

- [ ] **`/simplify`** on the branch diff. One pass — the diff is mostly manifests. Apply the fixes;
      record every skip with its reason.

- [ ] **`/code-review` at HIGH.** Direct it at the three places a defect can hide invisibly:
      the body-parser override resolution, the untyped `geocoding-service`, and any handler whose
      error path changed shape now that async rejections auto-forward (ADR-074 envelope must
      survive). Resolve correctness findings before merge; justify dismissals in writing.

- [ ] **`/security-review`** on the branch diff. Express 5 changes request parsing and error
      propagation — check that no error path now leaks a stack trace or internal message through the
      envelope's `message` field, and audit every added lockfile `resolved` URL for
      `registry.npmjs.org` + integrity + `hasInstallScript: false` (ADR-061's `ignore-scripts=true`
      makes install scripts a real signal).

- [ ] **Testing gate** — Tasks 2, 5 and 7 are the testing gate; confirm it, don't re-run blindly.

- [ ] **Verification:** each gate's findings are listed in the handoff as fixed or dismissed-with-
      reason. An unaddressed correctness finding blocks the merge.

```bash
npx tsc --noEmit -p packages/shared && npm audit --audit-level=moderate 2>&1 | tail -3
```

---

## Task 9: Pre-push verification

**Files:**
- Modify: none

- [ ] **Run the blocking suites and the advisory checks.**

```bash
npm test                     # unit + regression, blocks push
npm run feedback:check       # advisory to-do list for the diff
npm run analyze:services     # dependencies changed, so this is required
```

- [ ] **Run the lockfile integrity checks that CI is the only other place to catch.** Only `npm ci`
      in CI catches half-resolution; do the local equivalents first.

```bash
npm ci --dry-run
npm ls express body-parser @types/express
# edge-vs-node: every declared range must be satisfied by the node it resolves to.
# Diff against origin/master so master's ~26 deliberate `overrides` mismatches don't drown a real finding.
```

- [ ] **Revert generated-doc churn** before committing — `npm test` regenerates landing docs.
      `build.json` timestamp/HEAD-sha changes are always reverted.

- [ ] **Invoke the `pre-commit-check` skill**, then commit and push, then open the PR filled from
      `.github/pull_request_template.md`.

- [ ] **Verification:** all 20-ish PR checks green, including `Security Audit`,
      `sprint-75-security-gate`, CodeQL and `pr-contract`. If `Security Audit` and
      `sprint-75-security-gate` go red **together**, look for a newly published advisory before
      debugging anything (note 6).

---

## Task 10: Merge + Deploy

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

Use the **`/deploy`** skill.

- [ ] **Re-check the security gates immediately before merging**, not just when CI last ran — the
      longer a PR waits for authorization, the likelier it needs another surgical bump.

- [ ] **Request EXPLICIT admin authorization**, then squash-merge. Never self-merge.

```bash
gh pr merge <N> --squash --admin   # ONLY after explicit authorization, each time
```

- [ ] **Watch the right run.** A merge fans out into `Tests`, `CodeQL` and `CI/CD Pipeline`;
      **only `CI/CD Pipeline` has a `Deploy to Demo` job.** Confirm it reached
      `Deploy to Demo` = success with **no rollback**.

- [ ] **Live smoke test — a green pipeline is not the bar.** Express 5 changes request parsing, so
      exercise real request/response paths, not just `/health`: log in on `karmyq.com`
      (`maria.reyes@…` / `password123`), load `/dashboard`, and confirm a **POST** round-trips (the
      body-parser proof, live) and that an error response carries the ADR-074 envelope. Check all 10
      `/health` endpoints. Note `curl -o /dev/null -w "%{http_code}"` returns `000` from this Windows
      host (a schannel TLS quirk, not an outage) — read the response body instead.

- [ ] **Update the handoff:** PR 1 shipped, demo at v11.36.0, deploy run ID, smoke-test evidence,
      and **PR 2 as the next work**. Then close #34 if the merge did not auto-close it.

- [ ] **Verification:** demo reports **v11.36.0**, all 10 services healthy, POST round-trip proven
      live, handoff updated.

---

# PRs 2–6 — scope outlines (each gets its own plan file and chat)

Scope, version and gate level are **already decided**. Write the plan file, don't re-open the scope.

## PR 2 — Test-tier truthfulness · v11.37.0 · `/code-review` HIGH · **ADR-088**

The only PR this sprint writing real logic. Order matters: fix the hasher, *then* look at what the
honest run reveals.

- `turbo.json` `test` task `inputs` → add **`$TURBO_DEFAULT$`**. Prove with `turbo run test --dry`
  that `@karmyq/mobile#test` and `@karmyq/tests#test` hash their real sources instead of one file.
- `scripts/promote-tdd-tests.js` — walk `APPS_DIR` (declared line 18, never used; only
  `SERVICES_DIR` at 63/65/73/75) so `apps/*/tests/tdd/` tests can promote instead of blocking
  pushes forever.
- `apps/mobile/jest.config.js` — remove `passWithNoTests: true` and its now-false comment.
- **New blocking gate:** lint print-config smoke test — `eslint --print-config <probe>` per linted
  workspace must exit 0 with a non-empty rule set. Raised in Sprint 121 PR 3's review and
  deliberately deferred. It separates "config is broken" from "code has lint findings" **without**
  requiring the ~677 outstanding findings to be cleaned up — which matters because lint is
  non-blocking everywhere in CI (`|| echo`), so a broken flat config today fails silently.
- **New blocking gate:** Expo SDK alignment — no `apps/mobile` dep declared `"*"`, every
  `expo-*`/`@expo/*` major equals `expo`'s major, lockfile satisfies manifest. This is the mechanism
  that would have prevented the drift Sprint 121 PR 4 had to clean up, and PR 3 of this sprint is
  about to move three packages away from their SDK pins — so this gate lands **before** it.
- **ADR-088** + `docs/adr/README.md` index + landing JSON + `nav.json` + a `docs/guides/` testing
  section. Also repair the carry-forward stale `adr-059-*.json` landing artifact here.
- **⚠️ Budget for discovery.** The first honest run will likely surface pre-existing failures. That
  is the point — but log them to `docs/BUGS.md` and fix only what this diff broke. Do not let PR 2
  become a bug-fixing sprint.
- Consider whether CI should now type-check `apps/mobile` (its `tsc` is 0 errors for the first
  time). The standing maintainer decision is "don't chase mobile green as a gate" — **ask, don't
  add unilaterally.**

## PR 3 — Consolidated safe groups (#179 + #178) · v11.38.0 · MEDIUM

- #179 production-deps, 17 updates; #178 dev-deps, 4 updates.
- **Blocked on three re-decisions** (spec notes 2 and 3): `overrides.react`/`react-dom` are pinned
  **exactly `19.2.3`** and #179 wants 19.2.8 — root override + root devDep + both apps move together
  or npm throws `EOVERRIDE`. `react-native-safe-area-context` was deliberately aligned **DOWN** to
  `~5.7.0`; `react-native-maps` was deliberately **held** at `1.27.2` because SDK 57 pins it.
  **`npx expo install --check` is the arbiter** — it must exit 0 afterwards.
- **`ts-jest`: re-test, don't reflexively exclude.** Root `overrides.ts-jest: "29.4.6"` contradicts
  #178's `^29.4.12`. The original blocker was TS2307 on the `@karmyq/shared/schemas/ui` subpath in
  request-service tests, caused by 29.4.11+ dropping tsconfig `moduleResolution: node16`
  inheritance. Sprint 121 closed #163 without an ignore rule precisely so this could be retried.
  If 29.4.12 fixed it, **take the ranges and delete the override**; only exclude if it persists.
- `overrides.postcss` `^8.5.18` → `^8.5.25` to match #178's declared ranges.
- Close #170 (eslint 10), #168 (typescript 7), #171 (@types/node 26) with written rationale and
  **no Dependabot ignore rule**; record them in `docs/IDEAS.md` as the Sprint 123 "platform floor"
  candidate, in dependency order: **runtime floor off `node:18-alpine` → @types/node 26 → TS 7 →
  ESLint 10.**

## PR 4 — jest 29 → 30 (#173) · v11.39.0 · HIGH

- 11 workspaces; the entire test tier is the blast radius.
- **ts-jest is NOT the blocker** — `ts-jest@29.4.6` already declares `jest: ^29.0.0 || ^30.0.0`.
  Real risks: `jest-environment-jsdom` must move to 30 in lockstep for `apps/frontend`, jest 30
  changes fake-timer and `testEnvironment` defaults, and `expect` type signatures shift.
- Lands **after** PR 2 on purpose: this is the PR whose entire safety argument is "the tests were
  green," so it needs honest cache keys.

## PR 5 — redis (node-redis) 4 → 6 (#169) · v11.40.0 · MEDIUM

- **Exactly one importer:** `services/messaging-service/src/config/redis.ts` (`createClient`).
- Bump the **root** prod declaration (`redis: ^4.6.11`) **and add the declaration to
  `messaging-service`**, which currently imports it without declaring it — a live violation of the
  standing rule.
- Two majors are being crossed (4 → 5 → 6): read the v5 **and** v6 migration notes.
  `createClient` options and the RESP3/type surface both changed.
- `ioredis` (`^5.11.1`, Bull's client) is a **different package** and is not in scope.
- Messaging is Socket.io presence/pubsub — smoke-test a live message round-trip, not just `/health`.

## PR 6 — zustand 4 → 5 (#172) · v11.41.0 · MEDIUM

- **Mobile only.** Declared solely in `apps/mobile/package.json`, imported by exactly one file:
  `apps/mobile/store/auth.ts`. The Sprint 121 roster's "frontend state" is **wrong**.
- `apps/mobile` is not deployed to the demo, making this the lowest-risk PR of the six.
- zustand 5 drops the default-export shim and changes `createWithEqualityFn`/`useStore` selector
  semantics — check the one store against the v5 migration guide.
- **Closes the sprint:** archive Sprint 121 with the corrected statement (*17 of 18; express carried
  to S122*), then archive Sprint 122, and confirm the open-PR count is genuinely 0.
