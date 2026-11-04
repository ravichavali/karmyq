# Sprint 136: Mobile Dependency Fixes and Request-Status Follow-ups — Design Spec

**Date**: 2026-11-03
**Status**: Approved (maintainer, 2026-11-03)
**Version**: v11.108.0 → v11.109.0 (provisional; re-derive from `origin/master` at merge)
**Sprint Branch**: `agent/claude/sprint-136-planning` (planning and execution; one PR)

---

## Overview

Sprint 135 left two kinds of work behind. Dependabot #180 (minimatch GHSA-g3hv-75wg-m249, medium) is still open on
master. It is due by **~2026-11-13**. The vulnerable copies are a dev-only subtree under `babel-plugin-module-resolver`,
which the mobile app uses only to resolve its `@/` import aliases. #179 (glob GHSA-3g3m-2fjr-6pw4) was auto-dismissed
but never fixed; it sits in the same subtree. The daily Expo drift job (#316) also fails every day on one patch version.
Separately, Sprint 135's final review and its CI run logged five defects: four in the request lifecycle (BUG-083..086)
and one flaky integration test (BUG-087).

This sprint removes the Babel plugin, since the installed Expo CLI already resolves the same aliases from
`tsconfig.json`. It moves `expo-notifications` one patch to Expo's SDK 57 map and fixes the five bugs. The dependency
commits come first, so they can move to their own PR if the rest of the work slips (*PR shape*).

### Core Principle: Remove the Redundant, Prove the Equivalent

Every change here either removes something that is already done elsewhere (the Babel alias plugin, the cron that the
test stack never needed, a client field the server refuses) or closes a window that a lock can close. Each removal is
proven by comparing behavior before and after on the real artifact, not on a description of it. Examples are the bundled
module set and the real-SQL race.

---

## Multi-Sprint Arc

### Sprint 135 — Request Status Guards (complete, v11.108.0)
Every request-status writer is guarded, and the status is derived from matches and dibs (#327, `b9682c34`).

### Sprint 136 — this sprint
Clears the Sprint 135 residuals: the module-resolver subtree (#180/#179), Expo drift #316 and BUG-083..087.

### Next (not scheduled)
The mobile sprint the maintainer called for on 2026-10-29 (`docs/IDEAS.md`, *Mobile needs a sprint of its own*): the
`query-string@7` / `decode-uri-component` break (BUG-041), stale match statuses, the missing build pipeline. This sprint
does not start it. It touches only the mobile files the dependency fixes and BUG-086 need.

---

## Decisions (maintainer, 2026-11-03)

1. **One sprint, one PR, dependency commits first.** The PR's first commits are the plugin removal and the
   `expo-notifications` bump; BUG-087 and BUG-083..086 follow. Target merge ~2026-11-07. **Fallback:** if the PR is not
   mergeable by **2026-11-09**, the two dependency commits move to their own PR, cut from `origin/master`, so the
   ~11-13 SLA holds.
2. **#180/#179: replace babel-plugin-module-resolver** (decided 2026-11-03 in the Sprint 135 post-merge chat). Nothing is
   dismissed.
3. **BUG-085: refuse, as `POST /matches` already does.** The four writers that start a commitment refuse an expired ask
   with the existing 409 `REQUEST_NOT_OPEN`. The status vocabulary does not change.
4. **BUG-083: retention ages a completed ask from its newest match completion,** falling back to `updated_at`. This is a
   change to cleanup-service only, with no migration. Sprint 135's status-only reconcile stays.
5. **No ADR.** No item is architectural; the rules go in CONTEXT.md and the guides. No ADR number is needed.

---

## A. Replace babel-plugin-module-resolver (#180, #179)

**What it does today.** `apps/mobile/babel.config.js:5-21` adds `module-resolver` with `root: ["./"]` and seven aliases
(`@` → `./`, plus `@/components`, `@/hooks`, `@/services`, `@/store`, `@/types`, `@/utils`). Babel runs for Metro and
for the mobile jest suite, since `apps/mobile/jest.config.js` uses no preset and babel-jest reads `babel.config.js`.

**What replaces it (verified against the installed packages, 2026-11-03):**
- `node_modules/@expo/cli` **57.0.32**,
  `build/src/start/server/metro/instantiateMetro.js:291`:
  `isTsconfigPathsEnabled: exp.experiments?.tsconfigPaths ?? true`. `apps/mobile/app.json` sets no `tsconfigPaths`, so
  the resolver is on. The same function serves `expo start` and `expo export`.
- `withMetroMultiPlatform.js:410` inserts `createTypescriptResolver(...)` into Metro's resolver chain when the flag is on.
- `createTypescriptResolver.js:58-90,213-258` reads `compilerOptions.paths` / `baseUrl` from `tsconfig.json`, following
  `extends`. It skips relative specifiers and any import from inside `node_modules`, and matches the longest prefix
  first.
- `apps/mobile/tsconfig.json` already maps `@/*` → `./*`. That covers all seven Babel aliases, whose targets are
  identical. It also maps `@/shared/*` → `../../packages/shared/*`, which Babel never had; no file imports `@/shared`
  (grep, 2026-11-03).
- Babel's `root: ["./"]` also allowed bare imports such as `config/api`. None exist (grep for
  `from '(config|services|store|utils|hooks|components|types)/'`: 0 hits).

**Proof already run in planning (2026-11-03, Windows box, installed lock-verified CLI, nothing downloaded):** an
Android export (`npx expo export --platform android --source-maps --no-minify`) with the plugin, then one with
`babel.config.js` reduced to `presets: ["babel-preset-expo"]` and `--clear`. Both source maps list **1,406 modules,
identical sets**. That includes all 22 project files the app reaches, among them every `@/` target (`config/api.ts`,
`services/api.ts`, `store/auth.ts`, `utils/storage.ts`, `hooks/useExpoNotifications.ts`, `hooks/useMessaging.ts`,
`components/InlineChat.tsx`, `components/QuickCreate.tsx`). `babel.config.js` was restored from a byte copy, and the tree
was clean afterwards.

**Jest loses the alias.** babel-jest no longer rewrites `@/`, so `apps/mobile/jest.config.js` gains
`moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" }`. Today's only mobile test
(`tests/regression/notification-handler.test.ts`) uses a relative `require`, so nothing breaks now. A new test that
imports through `@/` proves that the mapper, and not the plugin, does the work.

**Manifest and lock (dev-only; dependency lane: Claude):**
- `apps/mobile/package.json` drops `"babel-plugin-module-resolver": "^5.0.2"` from `devDependencies`. The lock's
  `apps/mobile` workspace node drops the same entry.
- Root `package.json` `overrides` drops the scoped `"babel-plugin-module-resolver": { "glob": { ".": "^9.3.3",
  "minimatch": "10.2.5" } }`, added by #327 (`99815d73`). The global `"minimatch": ">=11.0.1"` and `"glob": ">=14.0.2"`
  stay.
- Lock nodes that lose their only dependent. **The executor recomputes the set by reachability** (note 3). A walker run
  per note 3 on 2026-11-03, after the plan review, gives exactly these:
  - `babel-plugin-module-resolver` 5.0.3;
  - its nested `glob` 9.3.5, `lru-cache` 10.4.3, `minimatch` 10.2.5, `minipass` 4.2.8, `path-scurry` 1.11.1 and
    `path-scurry/node_modules/minipass` 7.1.3;
  - `find-babel-config` 2.1.2, `reselect` 4.1.8 and `pkg-up` 3.1.0;
  - `fs.realpath` 1.0.0, whose only dependent is the nested `glob` 9.3.5 (the first inventory missed it);
  - `pkg-up`'s nested `find-up`, `locate-path`, `p-limit`, `p-locate` and `path-exists`.

  That is 16 nodes. Every one is `dev: true`, and `find-babel-config`, `pkg-up`, `reselect` and `fs.realpath` have no
  other dependent. `resolve` and `json5` keep other dependents.
- **Three orphans already exist** in the unchanged lock: nested nodes whose parent node is not in the lock, so nothing
  resolves to them. They are `apps/frontend/node_modules/eslint-config-next/node_modules/globals` 16.4.0, the same path
  under `apps/landing`, and `apps/mobile/node_modules/@expo/cli/node_modules/ws` 8.21.1 (`eslint-config-next` and
  `@expo/cli` are hoisted to the root). They predate this sprint, which leaves them alone.
- No node is added and no version moves. So this is a pure removal: an in-place splice, proven by strict
  `npx -y npm@11.19.0 ci` and `npm ls --all` parity.

**Expected effect:** the lock no longer holds glob 9.3.5 or minimatch 10.2.5 anywhere. #180 should close as fixed on the
merge push. How GitHub then labels the auto-dismissed #179 is **UNVERIFIED**. The fix is the version leaving the lock,
not the label.

## B. Expo drift #316: expo-notifications 57.0.23 → 57.0.24

- **Verified live:** drift run 41660226241 (2026-11-03) prints `BLOCKING: expo-notifications@57.0.23 (Expo expects
  ~57.0.24)`. jest and `@types/jest` print as `REGISTERED DIVERGENCE` (`security/expo-divergences.json`, ADR-094), so the
  gate clears them. **The jest pair is not a downgrade and does not change.** Its registry entries stay valid, because
  `declared` still equals the manifest.
- `expo-notifications@57.0.24`: published 2026-10-22T13:31:41Z, and Expo's `sdk-57` dist-tag
  (`npm view`, 2026-11-03). Its `dependencies` and `peerDependencies` are identical to 57.0.23's. Every dependency is
  already satisfied by an existing lock node: `@expo/image-utils` 0.11.6, `abort-controller` 3.0.0, `badgin` 1.2.3,
  `expo-application` 57.0.3, `expo-constants` 57.0.22.
- Change: `apps/mobile/package.json` `~57.0.23` → `~57.0.24`, and the lock's `apps/mobile` node to match. Splice
  `node_modules/expo-notifications` `version`, `resolved` and `integrity`, re-reading `integrity` from `npm view` at
  execution time. One node changes.
- `SDK_PINNED` (`tests/regression/sprint-122-expo-sdk-alignment.test.ts`) does not list `expo-notifications`, so it does
  not change, as in Sprints 129, 131 and 134 PR E.
- #316 closes itself: the workflow's *Close stale drift issues* step runs on the first green scheduled run after the
  merge.

## C. BUG-087: no wall-clock crons in the CI test stack

- In the six services of `tests/docker-compose.test.yml` (auth, community, request, reputation, notification,
  social-graph), the only wall-clock schedules are reputation-service's:
  - `initHealthMetricsCalculator` (`src/cron/healthMetricsCalculator.ts:13`, `'0 2 * * *'`, plus its
    `RUN_METRICS_ON_STARTUP` branch);
  - `initTrustScoreRefresh` (`src/cron/trustScoreRefresh.ts:59`, `'30 3 * * *'`).
  Both are called from `src/index.ts` in `start()`.
- Two `setInterval`s run in the stack, and both stay on:
  - request-service's 5 s directed-notification flush (`src/events/directedNotifications.ts:54`), which is part of the
    event path;
  - notification-service's SSE heartbeat (`src/routes/notifications.ts:71`).
- **Design.** A `SCHEDULED_JOBS_DISABLED` env flag, named and shaped after the stack's existing
  `RATE_LIMIT_DISABLED: "true"`.
  - Only the exact string `"true"` disables. Absent or any other value keeps the jobs on, so production cannot lose a cron
    to a missing variable.
  - Both `init*` functions check it first. When disabled, each logs one line saying it is off and why, and schedules
    nothing: no `cron.schedule`, no startup run.
  - `tests/docker-compose.test.yml` sets `SCHEDULED_JOBS_DISABLED: "true"` on `reputation-service-test`.
- **Gate.** A root regression test parses `tests/docker-compose.test.yml`. For every service in it whose `src/` contains
  `cron.schedule(`, it asserts three things:
  - the compose service sets `SCHEDULED_JOBS_DISABLED: "true"`;
  - every source file that calls `cron.schedule(` reads the flag;
  - each `init*` function in those files returns before scheduling when the flag is set.
  A unit test proves the third point by mocking `node-cron`. Negative fixtures prove the gate fails on a compose service
  without the flag, and on a cron file that skips it.
- Callers that run the work directly (`refreshAllTrustScores`, `manualCalculateHealthMetrics`) are unaffected. No test
  depends on a cron firing, since they fire only at 02:00 and 03:30. The tests that need the work import it and call it:
  - `tests/integration/sprint-134-pr-l2-health.integration.test.ts`;
  - reputation-service's `sprint-126-trust-score-refresh` and `sprint-134-pr-l2-batch-isolation` regressions.
  `sprint-131-node-cron-v4` exercises the `init*` functions, so check it in Task 12 (grep, 2026-11-03).

## D. BUG-085: an expired ask takes no new commitment

- **Today:** `expirationJob.ts:18-23` sets `expired = TRUE` (and `updated_at`) only where `status = 'open'`. The status
  stays `open`. `POST /matches` refuses `reachability.expired === true` (`matches.ts:168`). `lockRequest`
  (`src/db/requestStatus.ts`) never reads `expired`. So four writers that start a commitment proceed on an expired ask:
  - admin propose-match (`adminActions.ts:138`);
  - match accept (`matches.ts:351`);
  - dibs create (`dibs.ts:233`);
  - provider-offer accept (`offersDb.ts:52`).
- **Schema** (`infrastructure/postgres/init.sql`): `expired boolean DEFAULT false` (nullable) and `expires_at timestamp
  without time zone` (nullable).
- **Rule.** An ask is past expiry when `r.expired IS TRUE OR (r.expires_at IS NOT NULL AND r.expires_at <=
  clock_timestamp())`.
  - The second arm covers the hour before the sweep runs. The feed already hides such asks (`inventoryDb.ts:264,298`,
    `r.expires_at > NOW()`).
  - `clock_timestamp()`, not `NOW()`, because the statement runs after a lock wait (Sprint 135 note 7).
- **Design** (in `requestStatus.ts`):
  - A private `lockAndDerive(q, id)` takes the lock (the unchanged `LOCK_REQUEST` literal). It then runs the derive
    `SELECT` with **the same `CASE` as today, unchanged**, plus one column `... AS past_expiry`. It returns
    `{ status, pastExpiry }` or `null`.
  - `lockRequest(q, id)` keeps its signature and returns `status`. Reject (`matches.ts:466`), dibs accept (`dibs.ts:340`)
    and the requester cancel (`requests.ts:2083`) keep calling it, so cancelling or rejecting on an expired ask still
    works.
  - A new export, `lockRequestForCommitment(q, id): Promise<CommitmentStatus | null>`, where
    `type CommitmentStatus = RequestStatus | 'expired'`. It returns `'expired'` when the derived status is `'open'` and
    `pastExpiry` is true; otherwise the derived status.
  - The four commitment writers, and `POST /matches` (E), call it. Each already maps any non-`'open'` result to its
    409 `REQUEST_NOT_OPEN` branch (match accept: `'matched'` → `ALREADY_MATCHED`, everything else → not open), so no
    caller gains a branch.
  - **Response codes** (verified 2026-11-03, after the plan review):
    - The four writers have no expiry fast path, so both expiry arms reach the lock and get the existing 409
      `REQUEST_NOT_OPEN`.
    - `POST /matches` keeps its fast path (E). Its reachability read sees only the `expired` flag
      (`eligibility.ts:93`). A flagged ask therefore still gets the fast path's **400** `REQUEST_NOT_OPEN`
      (`matches.ts:168-173`). Only an unflagged ask past `expires_at` reaches the lock, which answers **409**.
- **Unchanged:**
  - `reconcileRequestStatus` and the stored status (an expired ask stays `open` in the column);
  - dibs accept, which has its own invitation expiry (`expires_at > clock_timestamp()`) and acts on an ask the sweep
    never marks, since it marks only `status = 'open'`;
  - completion and cancellation of an exchange already in progress.
- **Gates:** the Sprint 135 status gate is unaffected, since it pins writes and this is a read. The directed-surface
  allowlist entry for the derive `SELECT` re-pins: compute it with `surfaceHash`, never by hand.

## E. BUG-084: POST /matches runs under the request lock

- **Today** (`services/request-service/src/routes/matches.ts`):
  - reachability is read before any transaction (`:158`);
  - the duplicate check is "best-effort against a racing double-submit" (`:197-209`);
  - the offer's status is checked (`:212-229`), then the match is inserted on the pool (`:232-238`);
  - the offer is set `matched` with no guard (`:247-250`).
  A cancel, dibs accept or match accept that commits between the read and the insert has already run `closeProposals`,
  so the new proposal stays `proposed` and holds the offer.
- **Design.** The pre-reads stay as the fast path, with the same responses, including the 400 `REQUEST_NOT_OPEN` for a
  closed or flag-expired ask. Then one `withTransaction`:
  1. `lockRequestForCommitment(q, request_id)`; anything but `'open'` → 409 `REQUEST_NOT_OPEN`.
  2. The duplicate check on `q`. Under the request lock it is exact, not best-effort: every proposal on this request
     serializes. A hit → 409 `ALREADY_OFFERED`, the same body as today.
  3. If `offer_id`: `UPDATE requests.help_offers SET status = 'matched' WHERE id = $1 AND offerer_id = $2 AND status =
     'active'`. No row → 400 `Offer is not active`, the same message as the fast path. Both places gain
     `error: 'OFFER_NOT_ACTIVE'` (ADR-074; additive).
  4. The `INSERT ... 'proposed' RETURNING *` on `q`.
  - Every refusal is decided before the first write. Step 3 is the first write, and its miss returns before anything is
    written (Sprint 135 note 6).
  - No `reconcileRequestStatus`: a proposed match does not change the derived status.
  - `match_created` publishes after the commit, as today.
- **Lock order.** This is a request-first writer touching a new `proposed` match and an `active` offer, which fits
  Sprint 135's table (request-first writers touch only proposed matches). The other `help_offers` writers are:
  - `requestStatus.ts:95` `closeProposals` (request-first);
  - `matches.ts:484` and `:737` (guarded frees);
  - `offers.ts:220`, `:262` and `:334`.
  **UNVERIFIED in planning:** that none of these holds an offer row lock and then waits on the request lock. The
  executor reads each one before writing E.

## F. BUG-083: retention ages a completed ask from its completion

- **Today:** `services/cleanup-service/src/jobs/memoryRetentionJob.ts:93-130`. The completed branch forgets
  `WHERE ... h.updated_at < NOW() - make_interval(days => rw.window_days::int)`. Completion never stamps
  `help_requests.updated_at`. So an ask created more than a window ago (default `completed_request_window_days` 180,
  `20260607-designed-to-forget.sql:18`) is anonymized on the run right after it completes.
- **Design:** the `forgotten_requests` `UPDATE` ages from
  `COALESCE((SELECT MAX(m.completed_at) FROM requests.matches m WHERE m.request_id = h.id AND m.status = 'completed'),
  h.updated_at)`.
  - The match finalize stamps `completed_at` once (`matches.ts:611`; the repeat done mark no longer re-stamps it,
    `:568-570`).
  - Both columns are `timestamp without time zone`.
  - The fallback keeps today's behavior for a completed ask with no stamped completion.
  - `req_window`, the expired/unmatched branch and the message cascade do not change.
- **Gates:** the directed-surface allowlist entry for that `UPDATE` (`memoryRetentionJob.ts`, "Internal content
  erasure") re-pins via `surfaceHash`. The Sprint 135 status gate lists `memoryRetentionJob.ts` as a reviewed dynamic
  `SET` builder, and its `SET` list does not change.
- **No repair.** Content already forgotten early is overwritten and cannot be restored.

## G. BUG-086: clients stop declaring `status` on updateRequest

- `apps/frontend/src/lib/api.ts:583` and `apps/mobile/services/api.ts:95` declare `status?: string`.
  `PUT /requests/:id` answers 400 `STATUS_NOT_EDITABLE` (`requests.ts:2003`). Neither client calls `updateRequest`
  (grep, 2026-11-03).
- **Design:** in both files, the `status?: string;` line becomes a one-line comment:
  `// No status: the server derives it (Sprint 135), and PUT answers 400 STATUS_NOT_EDITABLE.`
  The line count stays the same. `apps/frontend/src/lib/api.ts` carries **57 dismissed `js/request-forgery` alerts**
  between lines 202 and 1080 (code-scanning API, 2026-11-03), and keeping later lines in place is cheap insurance. CodeQL
  re-raises are still not predictable from a diff (memory: *CodeQL re-raises*), so the post-merge record reads the open
  alerts on master.
- **Type assertions:**
  - `apps/mobile/tests/types/update-request.typecheck.ts` assigns `{ user_id, status }` to
    `Parameters<typeof api.updateRequest>[1]` under `// @ts-expect-error`. `apps/mobile/tsconfig.json` includes
    `**/*.ts`, and CI type-checks the workspace (`ci.yml:75`); mobile `tsc --noEmit` exits 0 on master (2026-11-03). If
    `status` comes back, TS2578 (unused directive) fails CI.
  - The frontend gets the same fixture under `apps/frontend/src/lib/`. Frontend `tsconfig.json` includes `**/*.ts` and
    excludes only `tests/**`. CI has no frontend `type-check` step (`ci.yml:71-75`). **UNVERIFIED:** whether `next build`
    type-checks an unimported file. The executor proves by injection which command fails, and the PR says plainly
    whether the frontend fixture is a CI gate.

---

## Data Model

No schema change and no migration.

## API Endpoints

| Method | Path | Change |
|---|---|---|
| POST | `/matches` (`matches.ts:146`) | Runs under the request lock. A race with a close, or an ask past `expires_at` that the sweep has not flagged yet, answers 409 `REQUEST_NOT_OPEN`. A flagged ask keeps the fast path's 400. The duplicate check is exact. The offer is held only while `active` (400 `OFFER_NOT_ACTIVE`). |
| POST | `/requests/:id/propose-match` (admin; `adminActions.ts:95`, mounted at `/requests`, `index.ts:159`) | An ask past expiry → 409 `REQUEST_NOT_OPEN` |
| PUT | `/matches/:id/accept` (`matches.ts:281`; the requester accepts a proposal) | Same |
| POST | `/requests/:id/dibs` (`dibs.ts:126`, mounted at `/requests`, `index.ts:143`) | Same |
| PUT | `/requests/offers/:id/accept` (provider-offer accept; `requesterOffers.ts:30` → `acceptOffer`, `offersDb.ts:36`) | Same (its existing not-open response) |

Route paths verified against the routers on 2026-11-03. No event changes.

## Frontend Changes

`apps/frontend/src/lib/api.ts`: the `updateRequest` type drops `status` (G). No UI change, so the onboarding workflows
do not change.

## User Guide & Doc Updates

- `docs/guides/making-requests-guide.md`: once an ask expires it takes no new offers, dibs or accepted proposals.
  Cancel it, or make a new one.
- `docs/guides/fulfilling-requests-guide.md` and `docs/guides/dibs-request.md`: the same rule, from the helper's side.
- `docs/guides/your-memory-and-relationships-guide.md`: a completed exchange's text is forgotten a window after it
  **completed**, not after the ask was last edited.
- `apps/mobile/claude.md` *Recent changes*:
  - the alias now resolves through Metro's tsconfig paths, and jest through `moduleNameMapper`;
  - `expo-notifications` 57.0.24;
  - mobile `tsc` is green and gated (`ci.yml:75`), which corrects the stale "type-check is red" line in
    `docs/IDEAS.md` 2026-10-29. Append a dated correction there; IDEAS is append-only.
- `services/request-service/CONTEXT.md`: the expiry rule, `lockRequestForCommitment`, and POST /matches under the lock.
- `services/cleanup-service/CONTEXT.md`: the retention clock.
- `services/reputation-service/CONTEXT.md`: `SCHEDULED_JOBS_DISABLED`.
- `tests/claude.md` *Integration environment*: the stack runs no wall-clock crons.
- `docs/BUGS.md`: BUG-083..087 → fixed, with Recent Fixes.
- Landing: regenerate (the guides change), revert the timestamp/HEAD-sha churn, and `git add -f` any new generated page.
  None is expected.
- `services/registry.json`: no change. There is no endpoint or event change, and a service entry has no env-var field
  (its keys are `port`, `status`, `owner`, `path`, `dependencies`, `apis`, `database_schemas`, `health_check`,
  `criticality`, `events`, `notes`; verified 2026-11-03).

---

## PR shape

One PR from `agent/claude/sprint-136-planning`. Commit order:
1. Version 11.109.0, plus the planning docs already on the branch.
2. **A** (plugin removal), then **B** (`expo-notifications`). Each is self-contained and can be cherry-picked: its own
   manifest, lock, tests and proofs.
3. C, then D and E (request-service), F (cleanup-service), G (clients).
4. Docs, gates, the handoff.

**Fallback (by 2026-11-09):** if the PR is not mergeable, cut `agent/claude/sprint-136-pr-mobile-deps` from
`origin/master`. Cherry-pick A and B onto it with their own version bump, and open it on its own. The rest stays on this
branch, which merges `origin/master` in afterwards (a merge commit, never a rebase).

---

## Critical Implementation Notes

1. **Never execute downloaded code.** Every behavioral check runs on the lock-verified install (`npm ci`). `npm view`
   (registry metadata) is fine. No `npm pack` tarball is unpacked and run, and no scratch install is executed
   (dependency briefs, 2026-11-02).
2. **Lock edits are in-place splices.** No `npm install --workspace`, no `npm dedupe`, no scratch regen. Prove each with
   strict `npx -y npm@11.19.0 ci` (exit 0), `npm ls --all` problem-line parity against the pre-change baseline, and a
   node-level diff naming exactly the nodes removed or changed. Run `npm ci` from an uppercase `C:\` cwd on Windows
   (`apps/mobile/claude.md`, Sprint 134 PR E).
3. **Compute the orphan set by reachability, not from the spec's list.** Walk from the root, every workspace and every
   workspace's link node over `dependencies`, `optionalDependencies` and `peerDependencies`. Add `devDependencies` on the
   root and workspace nodes only: npm installs no other package's dev dependencies, and no other lock node lists any
   (0 of 1,861). Resolve like npm (nearest `node_modules` up the path), and follow `link: true` nodes to their `resolved`
   path. Without the dev edges the unchanged lock shows 765 orphans, the plugin among them (Codex plan review). With
   them it shows exactly the three pre-existing orphans named in spec A. Remove exactly the nodes orphaned after the edit
   and not before, and print the list.
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
8. **Keep the derivation `CASE` byte-identical to today's `lockRequest`** (`requestStatus.ts:39-44`). BUG-085 adds a
   column to the derive `SELECT`, not an arm to the `CASE`. `reconcileRequestStatus` does not change. The two `CASE`s
   differ by design, so tests compare arms, not whole `CASE`s. The lock's starts with `WHEN r.status = 'cancelled' THEN
   'cancelled'`. Reconcile has no such arm: its `WHERE ... r.status <> 'cancelled'` keeps a cancelled ask cancelled.
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
    wait with `pg_blocking_pids` over `pg_locks`, never a sleep. When two calls wait on one row, the second can queue
    behind the first on PostgreSQL's tuple lock, and `pg_blocking_pids` then names the first waiter, not the holder.
    So a waiter counts when the holder blocks it directly, or blocks a pid that blocks it. Root integration tests already
    import service source directly (`sprint-126-standing-schema`, `sprint-133-endorsement-trust`), so F's case imports
    `forgetExchangeContent`.
15. **Tests first** in each changed workspace's `tests/tdd/` (apps/mobile, reputation-service, request-service,
    cleanup-service), red, then the implementation. Promote with targeted `git mv`, not the promoter, which sweeps every
    green tdd file repo-wide.
16. **`npm test` regenerates landing docs.** Revert the timestamp/HEAD-sha churn before committing.
17. **api.ts line count stays the same** (G). After the merge, read master's open code-scanning alerts and the merge-sha
    analysis. A re-raise is surfaced to the maintainer for dismissal, never looped through the API.

## Out of scope

- The mobile sprint's debt (BUG-041 / `query-string@7`, stale mobile match statuses, `cancelMatch`, the build pipeline).
- BUG-073, 076, 080, 081, 082; per-community health-quality weight; `deepmerge` #178 (re-check by 2026-12-01).
- Repairing demo rows (Sprint 135 decision 4 stands).
