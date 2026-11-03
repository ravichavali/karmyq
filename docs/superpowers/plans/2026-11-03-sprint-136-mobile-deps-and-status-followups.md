# Sprint 136 Mobile Dependency Fixes and Request-Status Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** clear Dependabot #180/#179 by removing babel-plugin-module-resolver from `apps/mobile`, end Expo drift #316,
and fix BUG-083..087. All of it ships in one PR whose first commits are the dependency fixes.

**Architecture:** Metro's built-in tsconfig-paths resolver (on by default in the installed `@expo/cli`) replaces the
Babel alias plugin, and jest gets a `moduleNameMapper`. In request-service, a sibling of `lockRequest` reports an
open-but-expired ask as `'expired'` for the writers that start a commitment, and `POST /matches` moves under the request
lock. cleanup-service's retention ages a completed ask from its completion. reputation-service's crons honour a test-stack
off switch.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-11-03-sprint-136-mobile-deps-and-status-followups-design.md`](../specs/2026-11-03-sprint-136-mobile-deps-and-status-followups-design.md)

**Branch:** `agent/claude/sprint-136-planning`. Execution continues on it, and the one PR opens from it. It carries:
- the #327 post-merge record and the Sprint 135 archive;
- this spec, plan and handoff.

**Version:** 11.108.0 → 11.109.0, **provisional**: re-derive from `origin/master`'s `package.json` at merge time.

**Rules (maintainer):**
- Dependency lane: **Claude** (maintainer-designated). Never execute downloaded code. Behavioral checks run on the
  lock-verified install only.
- No demo-host operation, merge or CodeQL dismissal without explicit per-operation authorization. No ADR (none is
  needed).
- Push, and leave the tree clean, at every stopping point. **Stop at PR creation.**
- **SLA:** #180 (medium) is due **~2026-11-13**. If the PR is not mergeable by **2026-11-09**, take the fallback in Task 16
  and open the dependency commits as their own PR.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/mobile/tests/tdd/sprint-136-alias-resolution.test.ts` | jest resolves `@/` imports, through the mapper and not the Babel plugin |
| `apps/mobile/tests/types/update-request.typecheck.ts` | Compile-time: `updateRequest`'s body rejects `status` (`@ts-expect-error`; CI's mobile `tsc` runs it) |
| `apps/frontend/src/lib/update-request.typecheck.ts` | The same assertion for the frontend client (gate status proven in Task 11) |
| `services/reputation-service/src/cron/scheduledJobs.ts` | `scheduledJobsDisabled()`: the `SCHEDULED_JOBS_DISABLED === 'true'` check |
| `services/reputation-service/tests/tdd/sprint-136-scheduled-jobs-flag.test.ts` | Both `init*` functions schedule nothing when the flag is `"true"`, and schedule when it is absent or anything else |
| `tests/regression/sprint-136-test-stack-crons-gate.test.ts` | Every service in `tests/docker-compose.test.yml` with a `cron.schedule(` in `src/` sets the flag, and each cron file reads it; negative fixtures |
| `services/request-service/tests/tdd/sprint-136-request-followups.test.ts` | Mocked-SQL contract: `lockRequestForCommitment`; the four writers and POST /matches call it; POST /matches order (lock → dupe → guarded offer → insert), refusals before the first write |
| `services/cleanup-service/tests/tdd/sprint-136-retention-clock.test.ts` | The completed branch's SQL ages from `MAX(m.completed_at)` with the `updated_at` fallback (shape only; the real proof is the integration case) |
| `tests/integration/sprint-136-request-followups.integration.test.ts` | Real SQL: expired refusals (5 writers), the POST /matches race, the offer guard, the retention clock |

### Existing files to modify
| File | Change |
|------|--------|
| `package.json` | version 11.109.0; drop the scoped `babel-plugin-module-resolver` override |
| `package-lock.json` | root `"version"` ×2; drop the plugin's subtree (reachability-computed); `apps/mobile` node: drop the devDep, `expo-notifications` range; splice `node_modules/expo-notifications` 57.0.24 |
| `apps/mobile/package.json` | drop `babel-plugin-module-resolver`; `expo-notifications` `~57.0.24` |
| `apps/mobile/babel.config.js` | `presets: ["babel-preset-expo"]` only |
| `apps/mobile/jest.config.js` | `moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" }` |
| `apps/mobile/services/api.ts`, `apps/frontend/src/lib/api.ts` | the `status?: string;` line in `updateRequest` → one comment line (same line count) |
| `services/reputation-service/src/cron/trustScoreRefresh.ts`, `healthMetricsCalculator.ts` | return before scheduling when disabled |
| `tests/docker-compose.test.yml` | `SCHEDULED_JOBS_DISABLED: "true"` on `reputation-service-test` |
| `services/request-service/src/db/requestStatus.ts` | private `lockAndDerive`; `past_expiry` column; `lockRequestForCommitment`; `CommitmentStatus` |
| `services/request-service/src/routes/adminActions.ts`, `matches.ts`, `dibs.ts`, `src/db/offersDb.ts` | the four commitment writers call `lockRequestForCommitment` |
| `services/request-service/src/routes/matches.ts` | POST /matches: one transaction under the lock; guarded offer; `OFFER_NOT_ACTIVE` |
| `services/request-service/tests/helpers/directedSurfaceAllowlist.json` | re-pin the derive `SELECT` and the retention `UPDATE` (via `surfaceHash`) |
| `services/cleanup-service/src/jobs/memoryRetentionJob.ts` | the completed branch's age clock |
| Docs | guides ×4, `services/{request,cleanup,reputation}-service/CONTEXT.md`, `apps/mobile/claude.md`, `tests/claude.md`, `docs/IDEAS.md` (dated correction), `docs/BUGS.md`, landing regen |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Never execute downloaded code.** Every behavioral check runs on the lock-verified install (`npm ci`). `npm view`
   (registry metadata) is fine. No `npm pack` tarball is unpacked and run, and no scratch install is executed
   (dependency briefs, 2026-11-02).
2. **Lock edits are in-place splices.** No `npm install --workspace`, no `npm dedupe`, no scratch regen. Prove each with
   strict `npx -y npm@11.19.0 ci` (exit 0), `npm ls --all` problem-line parity against the pre-change baseline, and a
   node-level diff naming exactly the nodes removed or changed. Run `npm ci` from an uppercase `C:\` cwd on Windows
   (`apps/mobile/claude.md`, Sprint 134 PR E).
3. **Compute the orphan set by reachability, not from the spec's list.** After removing the edge, walk from the root and
   every workspace over `dependencies`, `optionalDependencies` and `peerDependencies`, resolving like npm (nearest
   `node_modules` up the path). Remove exactly the unreached nodes, and print the list.
4. **Prove A on the artifact.** Compare the export's module set before and after, which must be identical, as in
   planning. Run a negative control too: with `"experiments": { "tsconfigPaths": false }` in `app.json` and no plugin,
   the export must fail to resolve an `@/` import. Then restore `app.json` from a byte copy. Use `--clear` on every
   export after a Babel change, and `EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1`.
5. **The jest alias test must go red without the mapper.** Order: write it while the plugin is present (green), remove
   the plugin (red), add `moduleNameMapper` (green). Commit before any experiment that mutates a tracked file (memory:
   *Commit before mutation restores*).
6. **Lock order** (Sprint 135 note 5): POST /matches is request-first and touches only a new `proposed` match and an
   `active` offer. Before writing E, read every `help_offers` writer listed in E, and confirm none holds an offer lock and
   then waits on the request lock.
7. **Decide before the first write** (Sprint 135 note 6). In POST /matches, the guarded offer `UPDATE` is the first
   write. Its miss returns a refusal before anything is written.
8. **Keep the derivation `CASE` byte-identical.** BUG-085 adds a column to the derive `SELECT`, not an arm to the
   `CASE`. `reconcileRequestStatus` does not change.
9. **`clock_timestamp()` in `past_expiry`.** Use `r.expired IS TRUE` (the column is nullable). `expires_at` is
   `timestamp without time zone`, compared like the existing `r.expires_at > NOW()`.
10. **Re-pin hashes with `surfaceHash`** for the derive `SELECT` (`requestStatus.ts`) and the retention `UPDATE`
    (`memoryRetentionJob.ts`). Never hand-type a hash. The gate prints file:line.
11. **`SCHEDULED_JOBS_DISABLED` fails open to "jobs on".** Only `"true"` disables. A missing or misspelled value must
    never turn a production cron off.
12. **Literal statuses only** in SQL (Sprint 135 note 9), and test fixtures cast `$n::varchar`.
13. **Identity is `req.user!.userId`** (ADR-064). No JWT `communities` claim is read
    (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`).
14. **Real-SQL tests live in root `tests/integration/`** and are CI-only on Windows (no local Docker). Races prove the
    wait with `pg_blocking_pids` over `pg_locks`, never a sleep. Root integration tests already import service source
    directly (`sprint-126-standing-schema`, `sprint-133-endorsement-trust`), so F's case imports
    `forgetExchangeContent`.
15. **Tests first** in each changed workspace's `tests/tdd/` (apps/mobile, reputation-service, request-service,
    cleanup-service), red, then the implementation. Promote with targeted `git mv`, not the promoter, which sweeps every
    green tdd file repo-wide.
16. **`npm test` regenerates landing docs.** Revert the timestamp/HEAD-sha churn before committing.
17. **api.ts line count stays the same** (G). After the merge, read master's open code-scanning alerts and the merge-sha
    analysis. A re-raise is surfaced to the maintainer for dismissal, never looped through the API.

---

## Task 1: Branch check, baselines, provisional version

**Files:**
- Modify: `package.json`, `package-lock.json` (the two root `"version"` lines only)

- [ ] **Confirm live state.**

```bash
git fetch origin && gh pr list && git log --oneline origin/master -3
git status -sb   # agent/claude/sprint-136-planning, clean, tracking origin
```

If `origin/master` moved past `b9682c34`, merge it into this branch with a merge commit, never a rebase.

- [ ] **Record baselines in the scratchpad** (never in the repo). Each one is compared again in Tasks 3 and 4:
  - `npm ls --all > <scratch>/ls.base.txt 2>&1` (exit code captured separately; it is non-zero today);
  - `npm audit --json > <scratch>/audit.base.json`;
  - `cp package-lock.json <scratch>/lock.base.json`;
  - `npm run lint --workspace=apps/mobile > <scratch>/lint.base.txt 2>&1`;
  - mobile `npx tsc --noEmit -p apps/mobile` (exit 0 on 2026-11-03);
  - the mobile jest suite;
  - the baseline export:

```bash
cd apps/mobile && EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 CI=1 \
  npx expo export --platform android --output-dir "<scratch>/export-base" --source-maps --no-minify
```

  - the planning comparator (`compare-maps.js`: read the `.map`'s `sources`, normalize `\` → `/`, compare as sets).
    Recreate it in the scratchpad; it is ~30 lines.

- [ ] **Version bump.** Set `package.json` `"version"` and the two root `"version"` fields in `package-lock.json` to
  `11.109.0`. Nothing else in the lock changes in this commit.

```bash
node -e "const a=require('./package.json').version,l=require('./package-lock.json');console.log(a,l.version,l.packages[''].version)"
# 11.109.0 11.109.0 11.109.0
git commit -am "chore: v11.109.0 (Sprint 136)"
```

## Task 2: Mobile alias resolution without Babel (A, part 1)

**Files:**
- Create: `apps/mobile/tests/tdd/sprint-136-alias-resolution.test.ts`
- Modify: `apps/mobile/babel.config.js`, `apps/mobile/jest.config.js`

- [ ] **Write the alias test while the plugin is still present. It must pass now.** Pick a project module that imports
  nothing native, so jest's `node` environment can load it. Read the candidates first: `config/api.ts`,
  `utils/storage.ts`. If every candidate pulls in a native module, `jest.mock` that one native dependency, as
  `tests/regression/notification-handler.test.ts` does, and say so in the test's header. Import it twice, once through
  `@/` and once relatively, and assert both resolve to the **same module object** (identity, not just "defined"):

```ts
/**
 * Sprint 136 (#180/#179): the Babel alias plugin is gone. Metro resolves `@/` from tsconfig `paths`
 * (@expo/cli instantiateMetro.js:291), and jest from jest.config.js `moduleNameMapper`. This proves the jest half.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const viaAlias = require("@/config/api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const viaPath = require("../../config/api");

describe("Sprint 136: @/ resolves in jest without babel-plugin-module-resolver", () => {
  it("loads the same module through the alias as through the relative path", () => {
    expect(viaAlias).toBe(viaPath);
  });
});
```

```bash
cd apps/mobile && npx jest tests/tdd/sprint-136-alias-resolution.test.ts --no-cache   # PASS (the plugin is present)
git add apps/mobile/tests/tdd/sprint-136-alias-resolution.test.ts && git commit -m "test(mobile): @/ alias resolution in jest (Sprint 136)"
```

- [ ] **Remove the plugin from Babel. The test must now fail.**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
```

```bash
cd apps/mobile && npx jest tests/tdd/sprint-136-alias-resolution.test.ts --no-cache   # FAIL: Cannot find module '@/config/api'
```

  If it still passes, something other than the plugin resolves `@/` in jest. Stop and find it before going on.

- [ ] **Add the mapper. The test passes again.**

```js
module.exports = withWorkerCap({
  testEnvironment: "node",
  setupFilesAfterEnv: [],
  // Sprint 136: the alias used to come from babel-plugin-module-resolver. Metro reads tsconfig `paths` itself; jest
  // does not, so it maps `@/` here (tsconfig.json `@/*` → `./*`).
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: [ /* unchanged */ ],
});
```

```bash
cd apps/mobile && npx jest --no-cache   # all mobile suites PASS
```

## Task 3: Remove the plugin from the manifests and the lock, then prove it (A, part 2)

**Files:**
- Modify: `apps/mobile/package.json`, `package.json` (`overrides`), `package-lock.json`

- [ ] **Manifests.** Drop `"babel-plugin-module-resolver": "^5.0.2"` from `apps/mobile/package.json`
  `devDependencies`. Drop the scoped `"babel-plugin-module-resolver": { ... }` object from root `overrides`. Keep
  `"minimatch": ">=11.0.1"` and `"glob": ">=14.0.2"`.

- [ ] **Lock splice.**
  1. Delete `packages["apps/mobile"].devDependencies["babel-plugin-module-resolver"]`.
  2. Run a scratchpad reachability walker over the lock, written per note 3:
     - start from `packages[""]` and every workspace node;
     - follow `dependencies`, `optionalDependencies` and `peerDependencies`; skip an unresolved peer only when
       `peerDependenciesMeta[name].optional`;
     - resolve each name like npm: `<from>/node_modules/<name>`, then each ancestor's `node_modules`, then the root;
     - follow `link: true` nodes to their `resolved` path.
  3. **Prove the walker before trusting it.**
     - It reports **zero** orphans on `lock.base.json`.
     - Run it again on a copy with one known edge removed (for example a single leaf's only dependent edge). It must
       report that leaf. Two instances, not one (memory: *Gates that assert weaker than they claim*).
  4. Run it on the edited lock and delete exactly the nodes it reports. Compare the list with the spec's 15-node
     inventory, and explain any difference before deleting.
  5. Check whether the lock holds `overrides` anywhere (`grep -n '"overrides"' package-lock.json`); edit only if it
     does.

- [ ] **Node-level diff** against `lock.base.json`: removed = exactly the walker's list; changed = root `version` ×2
  (Task 1) and the `apps/mobile` node. Nothing else. Key order is preserved.

- [ ] **Proofs** (record each result for the PR body):

```bash
cd /c/Users/ravic/development/karmyq   # uppercase C: per note 2
npx -y npm@11.19.0 ci; echo "ci_exit=$?"                     # 0
npm ls --all > <scratch>/ls.after.txt 2>&1; echo "ls_exit=$?"
# Parity: no new problem lines. Every removed problem line names a removed node or the deleted scoped override.
npm audit --json > <scratch>/audit.after.json                # no glob 9.x / minimatch 10.x finding remains
node -e "const l=require('./package-lock.json').packages;for(const[k,v]of Object.entries(l))if(/(^|\/)(glob|minimatch)$/.test(k))console.log(k,v.version)"
# expect exactly: node_modules/glob 14.0.3, node_modules/minimatch 11.0.3 (and nothing under babel-plugin-module-resolver)
node scripts/audit-exemptions.js                              # exit 0, 0 high/critical
cd apps/mobile && npx jest --no-cache && npx tsc --noEmit; echo "tsc_exit=$?"
npm run lint --workspace=apps/mobile > <scratch>/lint.after.txt 2>&1   # same problem count as lint.base.txt
```

- [ ] **The artifact proof** (note 4):
  - export with `--clear` to `<scratch>/export-after`, then run `node compare-maps.js export-base export-after`. Expect
    identical module sets (planning measured 1,406 modules and 22 project files).
  - **Negative control:** byte-copy `app.json`, add `"experiments": { "typedRoutes": true, "tsconfigPaths": false }`,
    and export with `--clear`. It must **fail** with an unresolved `@/...` import. Restore from the byte copy, then
    `git diff --exit-code -- apps/mobile/app.json`.

```bash
git add apps/mobile/babel.config.js apps/mobile/jest.config.js apps/mobile/package.json package.json package-lock.json
git commit -m "fix(security): remove babel-plugin-module-resolver; Metro reads tsconfig paths (Dependabot #180, #179)"
```

  The commit body lists the removed nodes, the proofs, and the walker's two self-checks.

## Task 4: expo-notifications 57.0.24 (B, Expo drift #316)

**Files:**
- Modify: `apps/mobile/package.json`, `package-lock.json`

- [ ] **Re-read the registry facts** (metadata only). Confirm `sdk-57` is still `57.0.24`, and that the `dependencies`
  and `peerDependencies` still equal the installed 57.0.23's. If either moved, stop and re-plan this task.

```bash
npm view expo-notifications@57.0.24 version dist.integrity dist.tarball dependencies peerDependencies engines license --json
npm view expo-notifications dist-tags.sdk-57
```

- [ ] **Splice.**
  - `apps/mobile/package.json` and the lock's `packages["apps/mobile"].dependencies`: `"expo-notifications":
    "~57.0.24"`.
  - `packages["node_modules/expo-notifications"]`: `version` 57.0.24, `resolved` (the `dist.tarball` URL) and
    `integrity` (`dist.integrity`). Every other field must equal what `npm view` reports. Check each one and change
    none.
- [ ] **Proofs:** run the node-level diff (one node plus the `apps/mobile` range), then the commands below.

```bash
npx -y npm@11.19.0 ci; echo "ci_exit=$?"                                  # 0
node -e "console.log(require('./node_modules/expo-notifications/package.json').version)"   # 57.0.24
node scripts/expo-divergences.js; echo "gate_exit=$?"   # 0: only the two REGISTERED DIVERGENCE lines, no BLOCKING
cd apps/mobile && npx jest --no-cache && npx tsc --noEmit
cd ../.. && npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-expo-sdk-alignment.test.ts regression/sprint-124-expo-divergence-gate.test.ts
```

  `node scripts/expo-divergences.js` reads Expo's live map from api.expo.dev. That is data, not code. If the network is
  unavailable, say so; do not mark this proof done.

- [ ] Commit: `fix(mobile): expo-notifications 57.0.24, Expo's SDK 57 map (Expo drift #316)`.

**Commits 1–4 (version, alias test, A, B) are the cherry-pickable dependency set** for the Task 16 fallback. Push now.

```bash
git push   # pre-push hook runs the suite; a silent, instant push means no hook ran: investigate
```

## Task 5: BUG-087 tests (red)

**Files:**
- Create: `services/reputation-service/tests/tdd/sprint-136-scheduled-jobs-flag.test.ts`
- Create: `tests/regression/sprint-136-test-stack-crons-gate.test.ts`

- [ ] **Unit test.** Mock `node-cron` (`jest.mock('node-cron', ...)`) and read
  `tests/regression/sprint-131-node-cron-v4.test.ts` for how this workspace already mocks it. Mind the root
  `resetMocks: true` (memory: *Jest mock config asymmetry*): set mock implementations in `beforeEach`.
  - `SCHEDULED_JOBS_DISABLED="true"`: `initTrustScoreRefresh()` and `initHealthMetricsCalculator()` call
    `cron.schedule` **0** times. With `RUN_METRICS_ON_STARTUP="true"` also set, the startup calculation does not run
    either (spy on what it calls).
  - Absent, `"false"`, `"TRUE"` and `"1"`: each schedules exactly once, with `'30 3 * * *'` and `'0 2 * * *'`
    respectively (exact expressions).
  - Restore `process.env` after each case.
- [ ] **Root gate** (`tests/regression/`, since it spans workspaces). Use `yaml` (declared by the tests workspace,
  2.9.1) to parse `tests/docker-compose.test.yml`. For each service whose `build.dockerfile` names
  `services/<name>/Dockerfile`:
  - list every `services/<name>/src/**/*.ts` file containing `cron.schedule(`;
  - if any exist, assert the compose service's `environment.SCHEDULED_JOBS_DISABLED === "true"`;
  - assert each such file imports `scheduledJobsDisabled` and calls it.
  - Export the evaluation as a pure function over `{ compose, files }`. Its **negative fixtures** must fail on: a
    compose service with a cron file and no flag; the flag set to `"false"`; and a cron file that never calls
    `scheduledJobsDisabled`.
  - Add one live **positive** assertion: the real repo yields exactly one service with cron files
    (`reputation-service`), with exactly two files.

```bash
cd services/reputation-service && npx jest tests/tdd/sprint-136-scheduled-jobs-flag.test.ts --no-cache   # FAIL (no flag yet)
cd ../.. && npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-136-test-stack-crons-gate.test.ts   # FAIL on the live repo; fixtures behave
```

## Task 6: BUG-087 implementation

**Files:**
- Create: `services/reputation-service/src/cron/scheduledJobs.ts`
- Modify: `services/reputation-service/src/cron/trustScoreRefresh.ts`, `healthMetricsCalculator.ts`,
  `tests/docker-compose.test.yml`

- [ ] **The flag** (match the cron files' `console.log` style):

```ts
/**
 * BUG-087: the CI test stack (tests/docker-compose.test.yml) sets SCHEDULED_JOBS_DISABLED="true", so no wall-clock job
 * fires in the middle of a test. Only the exact string "true" disables; absent or anything else leaves the jobs on, so a
 * missing variable can never turn a production cron off.
 */
export function scheduledJobsDisabled(): boolean {
  return process.env.SCHEDULED_JOBS_DISABLED === 'true';
}
```

- [ ] **Each `init*` returns first when disabled.** This covers the `RUN_METRICS_ON_STARTUP` branch too:

```ts
export function initTrustScoreRefresh(): void {
  if (scheduledJobsDisabled()) {
    console.log('⏸️  Canonical trust-score refresh not scheduled (SCHEDULED_JOBS_DISABLED=true)');
    return;
  }
  cron.schedule('30 3 * * *', async () => { /* unchanged */ });
  ...
}
```

- [ ] **Compose:** under `reputation-service-test.environment`, after `RATE_LIMIT_DISABLED: "true"`, add
  `SCHEDULED_JOBS_DISABLED: "true"`.

```bash
cd services/reputation-service && npx jest tests/tdd/sprint-136-scheduled-jobs-flag.test.ts --no-cache && npx tsc --noEmit
cd ../.. && npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-136-test-stack-crons-gate.test.ts   # PASS
git commit -m "fix(reputation): crons honour SCHEDULED_JOBS_DISABLED; the CI test stack sets it (BUG-087)"
```

## Task 7: BUG-085 + BUG-084 tests (red)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-136-request-followups.test.ts`
- Create: `tests/integration/sprint-136-request-followups.integration.test.ts`

- [ ] **Read first:**
  - `services/request-service/.claude/README.md` and `CONTEXT.md`;
  - `tests/regression/sprint-135-request-status-helper.test.ts` and `sprint-135-request-status-writers.test.ts`
    (the mocked-SQL pattern to mirror);
  - `tests/integration/sprint-135-request-status-guards.integration.test.ts` (seeding, real JWT, `pg_blocking_pids`
    races, the completion-queue wait before teardown).
- [ ] **Read the six `help_offers` writers** listed in spec E (note 6), and record in the test file's header that none
  takes an offer lock before the request lock. If one does, stop and re-plan E.
- [ ] **Mocked-SQL contract** (exact SQL, order, params):
  - `lockRequestForCommitment` issues `LOCK_REQUEST`, then the derive `SELECT`.
    - Its `CASE` text is **byte-identical** to `reconcileRequestStatus`'s `CASE` (extract both from source and compare).
    - It selects `past_expiry` with `r.expired IS TRUE OR (r.expires_at IS NOT NULL AND r.expires_at <=
      clock_timestamp())`.
    - It returns `'expired'` for (`open`, true) and `'open'` for (`open`, false). For each of `matched`, `completed`,
      `dibs_pending` and `cancelled`, it returns that status unchanged, past expiry or not (that is two instances per
      status). It returns `null` for no row.
  - `lockRequest` still returns the derived status and ignores `past_expiry`.
  - Admin propose-match, match accept, dibs create and provider-offer accept call `lockRequestForCommitment`, and on
    `'expired'` answer 409 `REQUEST_NOT_OPEN` **before any write**. Reject, dibs accept and the requester cancel still
    call `lockRequest`.
  - POST /matches:
    - one transaction, in this order: lock → duplicate `SELECT` on the transaction client → (if `offer_id`) the guarded
      `UPDATE requests.help_offers SET status = 'matched' WHERE id = $1 AND offerer_id = $2 AND status = 'active'` →
      `INSERT`;
    - `'expired'` / non-open → 409 `REQUEST_NOT_OPEN` with zero writes;
    - a duplicate hit → 409 `ALREADY_OFFERED` with zero writes;
    - a guard miss → 400 `OFFER_NOT_ACTIVE` with no `INSERT`;
    - `match_created` published only after the commit;
    - the fast-path pre-reads keep today's responses (the 400 `REQUEST_NOT_OPEN` on a closed or flag-expired ask).
- [ ] **Real-SQL integration** (CI-only on Windows; missing infrastructure is a failure, never a skip):
  - **Expired refusals.** For each of the five writers, two expired asks: one with `expired = TRUE`, and one with
    `expired = FALSE` and `expires_at` in the past (the second arm). Each answers 409 `REQUEST_NOT_OPEN` and writes
    nothing: compare the ask's matches, dibs and offers rows before and after.
    - Positive control: the same writer succeeds on an unexpired twin.
    - Requester cancel and match reject on an expired ask still succeed.
  - **POST /matches race.**
    1. A second client opens a transaction and locks the ask (or runs the requester-cancel SQL up to its commit).
    2. The HTTP `POST /matches` waits on that lock: `pg_blocking_pids` names the holder.
    3. The holder commits the cancel.
    4. POST answers 409 `REQUEST_NOT_OPEN`; no `proposed` match exists for that responder, and the offer is still
       `active`.
    - It must fail against `b9682c34`'s POST /matches, which strands the proposal. State that in the header.
  - **Offer guard race.** Two concurrent `POST /matches` by the same helper with the same `offer_id` on two different
    open asks. Exactly one succeeds, the other answers 400 `OFFER_NOT_ACTIVE`, and the offer is held by exactly one
    proposal.

```bash
cd services/request-service && npx jest tests/tdd/sprint-136-request-followups.test.ts --no-cache   # FAIL (red)
# Commit the red integration file; it runs in CI only.
```

## Task 8: BUG-085 implementation

**Files:**
- Modify: `services/request-service/src/db/requestStatus.ts`, `src/routes/adminActions.ts`, `src/routes/matches.ts`
  (accept), `src/routes/dibs.ts` (create), `src/db/offersDb.ts`, `tests/helpers/directedSurfaceAllowlist.json`

- [ ] **`requestStatus.ts`:**

```ts
export type CommitmentStatus = RequestStatus | 'expired';

/** The lock, then the derived status and whether the ask is past its expiry (BUG-085), in one statement after it. */
async function lockAndDerive(q: TxQuery, requestId: string): Promise<{ status: RequestStatus; pastExpiry: boolean } | null> {
  await q(LOCK_REQUEST, [requestId]);
  const result = await q(
    `SELECT CASE
       ... byte-identical to today ...
       ELSE 'open' END AS status,
       (r.expired IS TRUE OR (r.expires_at IS NOT NULL AND r.expires_at <= clock_timestamp())) AS past_expiry
     FROM requests.help_requests r WHERE r.id = $1`,
    [requestId]
  );
  const row = result.rows[0];
  return row ? { status: row.status, pastExpiry: row.past_expiry === true } : null;
}

export async function lockRequest(q: TxQuery, requestId: string): Promise<RequestStatus | null> {
  return (await lockAndDerive(q, requestId))?.status ?? null;
}

/**
 * lockRequest for the writers that start a commitment (propose, accept, dibs, provider-offer accept, POST /matches):
 * an open ask past its expiry reads 'expired', so each refuses it as not open, as POST /matches always has (BUG-085).
 * Cancel, reject and dibs accept keep lockRequest: an expired ask can still be closed.
 */
export async function lockRequestForCommitment(q: TxQuery, requestId: string): Promise<CommitmentStatus | null> {
  const locked = await lockAndDerive(q, requestId);
  if (!locked) return null;
  return locked.status === 'open' && locked.pastExpiry ? 'expired' : locked.status;
}
```

  Update the module's header comment: it names the commitment variant and the expiry rule.

- [ ] **The four callers** change only the function name at `adminActions.ts:138`, `matches.ts:351`, `dibs.ts:233` and
  `offersDb.ts:52`. Their existing branches already send every non-`'open'` result to the not-open refusal. Confirm that
  each message still reads well for an expired ask; change no message unless it would mislead.
- [ ] **Re-pin** the derive `SELECT`'s directed-surface entry. Run the gate, take the file:line it prints, compute the
  hash with `surfaceHash`, and replace exactly that entry (note 10).

```bash
cd services/request-service && npx jest tests/tdd/sprint-136-request-followups.test.ts --no-cache -t "lockRequestForCommitment|commitment writers"
npx jest tests/regression --no-cache && npx tsc --noEmit
```

## Task 9: BUG-084 implementation (POST /matches)

**Files:**
- Modify: `services/request-service/src/routes/matches.ts` (the `router.post('/', ...)` at `:146`)

- [ ] Keep every fast-path read and response as it is. Replace the pool `INSERT` (`:232-238`) and the unguarded offer
  `UPDATE` (`:247-250`) with:

```ts
// BUG-084: the proposal is written under the request lock, so an ask that closed (or expired) since the reads above is
// refused, the duplicate check is exact, and the offer is held only while it is still active. Every refusal comes before
// the first write: the guarded offer UPDATE is that write, and its miss returns before anything is written.
const outcome = await withTransaction(async (q) => {
  if ((await lockRequestForCommitment(q, request_id)) !== 'open') return { conflict: 'not_open' as const };
  const dupe = await q(`SELECT 1 FROM requests.matches ... unchanged ...`, [request_id, responder_id]);
  if (dupe.rowCount > 0) return { conflict: 'already_offered' as const };
  if (offer_id) {
    const held = await q(
      `UPDATE requests.help_offers SET status = 'matched' WHERE id = $1 AND offerer_id = $2 AND status = 'active'`,
      [offer_id, responder_id]
    );
    if (held.rowCount === 0) return { conflict: 'offer_not_active' as const };
  }
  const inserted = await q(`INSERT INTO requests.matches ... unchanged ... RETURNING *`, [request_id, offer_id ?? null, responder_id]);
  return { match: inserted.rows[0] };
});
```

  Map the conflicts:
  - `not_open` → 409 `{ success: false, message: 'Request is not open', error: 'REQUEST_NOT_OPEN' }`;
  - `already_offered` → today's 409 body;
  - `offer_not_active` → 400 `{ success: false, message: 'Offer is not active', error: 'OFFER_NOT_ACTIVE' }`. Add the
    same `error` to the fast path's 400.

  Remove the "best-effort" wording from the duplicate check's comment. Publish `match_created` after the transaction,
  from `outcome.match`.
- [ ] Grep for orphans: the old pool `query` import may still have other users in the file. Keep it only if it does.

```bash
cd services/request-service && npx jest tests/tdd/sprint-136-request-followups.test.ts --no-cache   # PASS
npx jest tests/regression --no-cache && npx tsc --noEmit
git commit -m "fix(requests): expired asks take no new commitment; POST /matches runs under the request lock (BUG-085, BUG-084)"
```

## Task 10: BUG-083 (retention clock)

**Files:**
- Create: `services/cleanup-service/tests/tdd/sprint-136-retention-clock.test.ts`
- Modify: `services/cleanup-service/src/jobs/memoryRetentionJob.ts`,
  `tests/integration/sprint-136-request-followups.integration.test.ts`,
  `services/request-service/tests/helpers/directedSurfaceAllowlist.json`

- [ ] **Read** `services/cleanup-service/.claude/README.md`, `CONTEXT.md` and
  `tests/unit/memoryRetentionJob.test.ts` (how the job's SQL is asserted today).
- [ ] **Red, shape only:** the completed branch's SQL ages from `COALESCE((SELECT MAX(m.completed_at) FROM
  requests.matches m WHERE m.request_id = h.id AND m.status = 'completed'), h.updated_at)`, and no longer from
  `h.updated_at` alone. A mocked test cannot prove SQL semantics (memory: *Mocks hid the mechanism*), so the proof is
  the real-SQL case below.
- [ ] **Real-SQL cases** (in the Sprint 136 integration file; import `forgetExchangeContent` from
  `../../services/cleanup-service/src/jobs/memoryRetentionJob`). Global window W (read it, don't assume 180):
  1. Created and last updated W+30 days ago, with a match completed 1 day ago: **not** forgotten. This case fails
     against `b9682c34`.
  2. Created W+30 days ago, with a match completed W+5 days ago: forgotten, and its messages cascade.
  3. A completed ask whose completed match has `completed_at IS NULL`, last updated W+5 days ago: forgotten (the
     fallback).
  4. A completed ask with two completed matches, at W+5 days ago and 1 day ago: not forgotten (MAX, not MIN).
  - Clean up only the rows this file seeded.
- [ ] **Implement** in the `forgotten_requests` `UPDATE` only. Leave `req_window`, the expired/unmatched branch and the
  cascade unchanged. Add a comment naming BUG-083 and why the fallback exists.
- [ ] **Re-pin** that `UPDATE`'s directed-surface entry (note 10).

```bash
cd services/cleanup-service && npx jest tests/tdd/sprint-136-retention-clock.test.ts --no-cache && npx jest tests/unit tests/regression --no-cache && npx tsc --noEmit
cd ../request-service && npx jest tests/regression/sprint-132-directed-audience-gate.test.ts tests/regression/sprint-135-request-status-gate.test.ts --no-cache
git commit -m "fix(cleanup): completed-request retention ages from the completion, not the last edit (BUG-083)"
```

## Task 11: BUG-086 (client signatures)

**Files:**
- Modify: `apps/frontend/src/lib/api.ts:583`, `apps/mobile/services/api.ts:95`
- Create: `apps/mobile/tests/types/update-request.typecheck.ts`, `apps/frontend/src/lib/update-request.typecheck.ts`

- [ ] **Type fixtures first (red):**

```ts
/**
 * Sprint 136 (BUG-086): the server derives a request's status and PUT /requests/:id refuses one (400
 * STATUS_NOT_EDITABLE), so the client must not offer the field. Compile-time only: if `status` comes back, the
 * directive below is unused and tsc fails with TS2578.
 */
import type { api } from "../../services/api";

type UpdateRequestBody = Parameters<typeof api.updateRequest>[1];

// @ts-expect-error status is not editable
export const withStatus: UpdateRequestBody = { user_id: "u", status: "completed" };
```

  The frontend copy uses `import type { requestService } from "./api"` and `typeof requestService.updateRequest`
  (verified 2026-11-03: mobile's `updateRequest` sits on `export const api`, the frontend's on
  `export const requestService`). Run `npx tsc --noEmit -p apps/mobile`: it **fails** with TS2578, because `status` is
  still declared.
- [ ] **Implement:** in each file, replace the `status?: string;` line with exactly one comment line, so the line count
  and every later line number stay the same (note 17):
  `// No status: the server derives it (Sprint 135), and PUT answers 400 STATUS_NOT_EDITABLE.`
  Check that `git diff --numstat` shows 1/1 for each file.
- [ ] **Prove which gates run each fixture.**
  - Mobile: `npx tsc --noEmit -p apps/mobile` passes; with `status?: string;` restored it fails. Restore from a
    committed state (commit first). CI runs this (`ci.yml:75`).
  - Frontend: run `npx tsc --noEmit -p apps/frontend` both ways. Then establish whether `next build` (CI's landing and
    Docker builds) fails on the restored `status`: run `npm run build --workspace=apps/frontend` once with the
    injection. Record honestly in the PR body whether the frontend fixture is a CI gate or local-only.

```bash
git commit -m "fix(clients): updateRequest no longer declares status (BUG-086)"
```

## Task 12: Existing-test fallout and promotion

- [ ] Run each changed workspace's full suite: `apps/mobile`, `services/reputation-service`,
  `services/request-service`, `services/cleanup-service` and root `tests`. Fix any test that pinned old behavior **only
  when the new behavior is the spec's**, never by weakening an assertion. Grep for tests that:
  - assert the unguarded offer `UPDATE`'s exact SQL, or a pool `INSERT` in POST /matches;
  - assert `lockRequest` at the four call sites;
  - pin the old retention SQL.
- [ ] **Promote by targeted `git mv`:** move the four tdd files to their workspace's `tests/regression/`. Leave the type
  fixture in `apps/mobile/tests/types/`, since tsc reads it there. Do not run the promoter, which sweeps unrelated
  files.
- [ ] Commit: `test: promote Sprint 136 tests to regression`.

## Task 13: Docs (guides, landing, CONTEXT, local context, BUGS)

**Files:** listed in the spec's *User Guide & Doc Updates*.

- [ ] **Guides:**
  - `making-requests-guide.md`: an expired ask takes no new offers, dibs or accepted proposals; cancel it or post a new
    one.
  - `fulfilling-requests-guide.md` and `dibs-request.md`: the same rule from the helper's side.
  - `your-memory-and-relationships-guide.md`: the window runs from completion.
- [ ] **Landing:** `npm run build --workspace=apps/landing`, or let `npm test` regenerate it. Revert the timestamp and
  HEAD-sha churn. No new page is expected; if one appears, `git add -f`.
- [ ] **`services/request-service/CONTEXT.md`:** `lockRequestForCommitment` and the expiry rule; POST /matches under
  the lock; `OFFER_NOT_ACTIVE`. Add Known Issues → Recent Fixes entries for BUG-084 and BUG-085.
- [ ] **`services/cleanup-service/CONTEXT.md`:** the retention clock (BUG-083).
- [ ] **`services/reputation-service/CONTEXT.md`:** `SCHEDULED_JOBS_DISABLED` (BUG-087), and that production leaves it
  unset.
- [ ] **`apps/mobile/claude.md` *Recent changes*:** Sprint 136 (aliases, jest mapper, `expo-notifications`). Mobile
  `tsc` is green and gated.
- [ ] **`docs/IDEAS.md`:** append a dated correction under the 2026-10-29 mobile entry: type-check is green and runs in
  CI (`ci.yml:75`) as of 2026-11-03.
- [ ] **`tests/claude.md` *Integration environment*:** the stack runs no wall-clock crons (`SCHEDULED_JOBS_DISABLED`,
  enforced by `sprint-136-test-stack-crons-gate`).
- [ ] **`docs/BUGS.md`:** BUG-083..087 → `fixed`, each with the commit and the covering test.
- [ ] Run `npm run feedback:check`. It reads `git diff --cached`, so run it before committing; on a committed branch it
  is a false green (memory).
- [ ] Commit: `docs: Sprint 136 guides, CONTEXT, local context, BUGS`.

## Task 14: SDLC quality gates

- [ ] **`/simplify`** on the branch diff (`origin/master...HEAD`), one pass for this PR. Apply real cleanups and list the
  skipped suggestions with reasons.
  Verify: the suites in Task 12 are still green.
- [ ] **`/code-review high`** on the branch diff. This is a risky PR: lockfile removal, concurrency in request-service,
  retention SQL. Fix correctness findings; log anything deferred as a BUG with a reason.
  Verify: a scoped re-review of the fixes is clean.
- [ ] **`/security-review`** on the branch diff. Check:
  - the authorization order on POST /matches is unchanged (401 → 400 → 404 → 400 → 400 own-request → 403 → 409);
  - `offerer_id` is bound in the guarded write;
  - the flag fails open to jobs-on;
  - no new dependency is added.
  Verify: no High or Medium finding is left unresolved.

## Task 15: Final verification

```bash
npm test; echo "exit=$?"                         # full; capture the exit code separately, never through | tail
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts regression/sprint-136-test-stack-crons-gate.test.ts
npm test --workspace=tests                       # root gates read other workspaces' source
(cd apps/mobile && npx tsc --noEmit) && (cd services/request-service && npx tsc --noEmit) && \
  (cd services/cleanup-service && npx tsc --noEmit) && (cd services/reputation-service && npx tsc --noEmit)
npx -y npm@11.19.0 ci; echo "ci_exit=$?"
git status --short                               # clean except reverted landing churn
```

## Task 16: Handoff, push, PR, stop

- [ ] **Update `CURRENT_HANDOFF.md`:** the execution record (task → commits → review), the proofs and the PR number.
  Make *Next unchecked task* the merge, which needs the maintainer's authorization.
- [ ] **Push, then open the PR** against `master`.
  - Title: `fix: remove babel-plugin-module-resolver, expo-notifications 57.0.24, request-status follow-ups (Dependabot
    #180/#179, #316, BUG-083..087, v11.109.0)`.
  - The body says what is bundled: the #327 post-merge record, the Sprint 135 archive, the spec, plan and handoff, A,
    B, C–G. It states the #180 SLA (~11-13) and the fallback.
  - It lists the proofs: the lock diff, the module-set equality, the negative control, the audit delta, the drift gate,
    and which type fixture CI gates.
  - It ends with the attribution line.
- [ ] **Stop.** Do not watch CI or merge in this chat (memory: *Stop after PR creation*). End with the next-chat prompt.
- [ ] **Fallback (if the PR is not mergeable by 2026-11-09):**
  1. `git switch -c agent/claude/sprint-136-pr-mobile-deps origin/master`.
  2. Cherry-pick the alias-test, A and B commits, and give the branch its own version bump.
  3. Re-run Task 3's and Task 4's proofs and the four gates on that diff.
  4. Open it as its own PR and record the split in both PR bodies and the handoff.

## Task 17: Merge + deploy (the post-merge chat, maintainer-authorized)

- [ ] Merge only with the maintainer's explicit authorization, one merge at a time, after confirming no deploy is in
  flight. The deploy runs through CI/CD (`/deploy` skill for the checks).
- [ ] **Post-merge record** (rides in the next PR; no docs-only master push):
  - CI/CD run, deploy and health verify;
  - **Dependabot:** #180 state, and whether #179 changed (record what GitHub shows);
  - **code-scanning:** open alerts on master and the merge-sha analysis, for any `api.ts` re-raise (surface it, don't
    dismiss);
  - the next scheduled **Expo drift** run is green, and #316 auto-closes;
  - the next CI **Integration Tests** run logs reputation's "not scheduled" lines.
