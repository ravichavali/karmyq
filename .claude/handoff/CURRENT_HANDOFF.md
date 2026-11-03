# Sprint 136 — Mobile Dependency Fixes + Request-Status Follow-ups — Handoff

**Date**: 2026-11-03
**Outcome so far**: **PLANNED, and the plan review is addressed. Ready to execute.** The maintainer confirmed the scope
on 2026-11-03 (*Decisions*), and the spec and plan are written. Codex's plan review returned four findings. All four
were verified against the repo and fixed in the spec and plan (*Plan review*). No code has changed.

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Previous**: Sprint 135 COMPLETE (merged `b9682c34`, v11.108.0; deploy green; demo recount passed 2026-11-03).
Archived: [`archive/2026-11-03-sprint-135-request-status-guards-COMPLETE-v11.108.0.md`](archive/2026-11-03-sprint-135-request-status-guards-COMPLETE-v11.108.0.md)
(it holds the #327 post-merge record and the recount).

**Sprint goal:** clear Dependabot #180/#179 by removing babel-plugin-module-resolver from `apps/mobile`, end Expo drift
#316, and fix BUG-083..087, in one PR whose first commits are the dependency fixes.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-136-planning`, cut from `origin/master` `b9682c34` on 2026-11-03 and pushed (tracks `origin/agent/claude/sprint-136-planning`). **Execution continues on it, and the one PR opens from it.** No PR yet. |
| **Base** | `origin/master` at `b9682c34` (#327, v11.108.0; fetched 2026-11-03; no open PRs). The version bump is re-derived from `origin/master` at merge. |
| **Active editor** | Claude (the planning chat, then the plan-review response, both 2026-11-03). The next chat is the executor. |
| **Reviewer role** | Codex (non-author), relayed by the maintainer. |
| **Owned paths** | `apps/mobile/{babel.config.js,jest.config.js,package.json,services/api.ts,tests/**,claude.md}`, root `package.json` (version + the one override) and `package-lock.json`, `services/reputation-service/src/cron/**`, `services/request-service/src/{db/requestStatus.ts,db/offersDb.ts,routes/matches.ts,routes/adminActions.ts,routes/dibs.ts}` + its tests and allowlist, `services/cleanup-service/src/jobs/memoryRetentionJob.ts` + its tests, `apps/frontend/src/lib/api.ts` (one line) + one type fixture, `tests/docker-compose.test.yml`, the new root regression and integration files, `docs/guides/` (4 guides), three service CONTEXT.md files, `tests/claude.md`, `docs/BUGS.md`, `docs/IDEAS.md` (one dated correction), this handoff, the spec and plan. |
| **Shared resources needed** | Version bump (re-derive at merge). Merge slot. **Dependency lane: Claude** (maintainer-designated). This PR removes the module-resolver subtree and splices one node (`expo-notifications`). **No ADR number** (none needed; decision 5). No demo-host operation. |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-135-pr-request-status-guards` (head `7bfc65ac` = tree of `b9682c34`), `agent/claude/sprint-135-planning` (head `5a3589ef`, squash-merged as `20d930ce`), `agent/claude/sprint-134-pr-bug-077-badge-insert` (`afbaed7a`). |

## Decisions (maintainer, 2026-11-03)

1. **One sprint, one PR, dependency commits first.** Commits 1–4 (version, alias test, plugin removal, `expo-notifications`)
   are the dependency set. BUG-087 and BUG-083..086 follow. Target merge ~2026-11-07. **Fallback:** if the PR is not
   mergeable by **2026-11-09**, the dependency commits move to their own PR off `origin/master` (plan Task 16), so the
   #180 SLA (~2026-11-13) holds.
2. **#180/#179: replace babel-plugin-module-resolver** (decided in the Sprint 135 post-merge chat). Nothing is dismissed.
3. **BUG-085: refuse, as POST /matches already does.** Admin propose-match, match accept, dibs create, provider-offer
   accept and POST /matches refuse an ask past expiry with `REQUEST_NOT_OPEN`. The status vocabulary does not change.
   Cancel, reject and dibs accept still work on an expired ask.
   - The response is the existing 409, with one exception: POST /matches keeps its fast path's 400 for an ask the sweep
     has flagged (`matches.ts:168-173`). An unflagged ask past `expires_at` reaches its lock and gets 409.
   - This corrects the code only, not the decision (plan review, finding 2).
4. **BUG-083: retention ages a completed ask from its newest match completion** (`MAX(matches.completed_at)`), falling
   back to `updated_at`. cleanup-service only; no migration. Sprint 135's status-only reconcile stays.
5. **No ADR.** Nothing here is architectural. Rules go in CONTEXT.md and the guides.
6. **Recorded readings, confirmed in planning:**
   - The **jest pair in #316 is a registered ADR-094 divergence, not a downgrade.** Drift run 41660226241 printed
     `REGISTERED DIVERGENCE` for both and `BLOCKING` only for `expo-notifications`.
   - **BUG-084's fix direction** (POST /matches under `lockRequest`, refuse unless open) is taken as written in BUGS.md.
     It gains an exact duplicate check and a guarded offer write.

## Plan review (Codex, non-author, relayed 2026-11-03)

Codex did a read-only review and asked for revision before execution. Each finding was verified against the repo
before any change:

| # | Finding | Verdict | Evidence | Fix (spec + plan) |
|---|---|---|---|---|
| 1 | The lock walker omits `devDependencies` | CONFIRMED | The walker with the planned edges reports 765 orphans on the unchanged lock, plugin included. Adding root/workspace dev edges and workspace link roots leaves 3. | Note 3 and plan Task 3: add dev edges on root/workspace nodes and link roots, and delete only orphans that are new against the baseline. |
| 2 | The expiry tests want 409 where POST /matches answers 400 | CONFIRMED (POST /matches with `expired = TRUE` only) | `matches.ts:168-173` returns 400. Reachability reads only the flag (`eligibility.ts:93`). The other four writers have no expiry fast path. | Spec D lists the response code per writer. Plan Task 7: 400 for the flagged ask on POST /matches, 409 everywhere else. Decision 3 here is clarified. |
| 3 | The whole-`CASE` equality cannot pass | CONFIRMED | `requestStatus.ts:40` has a cancelled arm that `:63-67` lacks. A check on today's source returns false for whole-`CASE` equality and true arm by arm; an injected arm makes the arm check false. | Note 8 and plan Task 7 compare arms, plus the exact cancelled arm. |
| 4 | The offer-race test has no barrier | CONFIRMED | `findOwnOffer` is a plain `SELECT` (`helpOffersDb.ts:8`). Two calls that run one after the other pass the old write via the fast path. | Plan Task 7 holds the offer row `FOR UPDATE`, waits for two blocked backends, then releases. Note 14 counts waiters one hop deep. |

Found while verifying, beyond the four:
- **The removal set is 16 nodes, not 15.** `fs.realpath`'s only dependent is the nested glob 9.3.5.
- **The baseline lock is not orphan-free.** It has three nested orphans whose parent nodes are missing (spec A). They
  are out of scope and not logged as a BUG; logging them is the maintainer's call.
- **The second waiter on a row may name the first waiter, not the holder**, in `pg_blocking_pids` (note 14). That is
  why the barrier counts waiters one hop deep.

Not run: the review-response skill's "re-run the gate that found it", since the gate is Codex. A re-review of the
revision is optional and the maintainer's call. The scratchpad walker and the `CASE` check are throwaway, and the
executor writes its own walker per Task 3.

## Links

- **Spec**: [`docs/superpowers/specs/2026-11-03-sprint-136-mobile-deps-and-status-followups-design.md`](../../docs/superpowers/specs/2026-11-03-sprint-136-mobile-deps-and-status-followups-design.md)
- **Plan**: [`docs/superpowers/plans/2026-11-03-sprint-136-mobile-deps-and-status-followups.md`](../../docs/superpowers/plans/2026-11-03-sprint-136-mobile-deps-and-status-followups.md) (17 tasks; Task 17 is the post-merge chat)
- **PR**: none yet.

## Quick Start

1. Read this handoff, then confirm live state before trusting it:
   `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`. On 2026-11-03, master was `b9682c34` and no
   PRs were open. If master moved, merge it into this branch (a merge commit, never a rebase).
2. Reuse this branch: `git switch agent/claude/sprint-136-planning`, then `git pull`. Do not cut a new branch, since the
   one PR carries the planning commits.
3. Open the plan: `docs/superpowers/plans/2026-11-03-sprint-136-mobile-deps-and-status-followups.md`.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no
   `/execute-plan` slash command; superpowers removed it as a deprecated stub.
5. Executing the plan hands the executor the **dependency lane** (memory: *Execute-plan transfers the lane*). The
   dependency briefs **forbid executing downloaded code**: behavioral checks run on the lock-verified install.
6. **Push after Task 4** (the dependency set), and watch the date: the fallback trigger is **2026-11-09**.

**Next unchecked task**: plan **Task 1** (branch check, baselines, provisional version 11.109.0).

## Dated obligations

- **Dependabot #180** `minimatch` GHSA-g3hv-75wg-m249 (medium, `development` scope). Open on master since #327.
  - **SLA ~2026-11-13** (published 2026-10-30 ~23:09Z; medium ≤ 2 weeks).
  - **#179** `glob` GHSA-3g3m-2fjr-6pw4 was auto-dismissed at 05:02:36Z on #327's merge push. It is not fixed:
    `dismissed_by` and `fixed_at` are null.
  - Both live only in `node_modules/babel-plugin-module-resolver/node_modules/{glob 9.3.5, minimatch 10.2.5}` (dev).
  - Plan Tasks 2–3 remove them. Fallback trigger: **2026-11-09**.
- **`deepmerge` #178** (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by **2026-12-01**.

## Critical implementation notes (from the spec, verbatim)

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

## Verification references (planning, 2026-11-03)

- **Metro replaces the plugin** (read from `node_modules`, not a changelog). `@expo/cli` 57.0.32:
  - `instantiateMetro.js:291` `isTsconfigPathsEnabled: exp.experiments?.tsconfigPaths ?? true`;
  - `withMetroMultiPlatform.js:410` installs `createTypescriptResolver`;
  - `createTypescriptResolver.js` reads tsconfig `paths`, skipping relative and `node_modules` origins.
  `apps/mobile/tsconfig.json` `@/*` → `./*` covers all seven Babel aliases. No `@/shared` import and no bare
  root-relative import exist.
- **Planning experiment:** an Android export with the plugin, and one without it (`babel.config.js` presets only,
  `--clear`). Both give **1,406 modules, identical sets, 22 project files**, including every `@/` target. Run on the
  installed CLI; `babel.config.js` was restored byte-for-byte and the tree was clean. A baseline export takes ~103 s on
  this box.
- **Lock subtree to remove.** The executor recomputes it by reachability. A walker run per note 3 on 2026-11-03 gives
  16 dev-only nodes:
  - the plugin;
  - 6 nested nodes (glob 9.3.5, lru-cache, minimatch 10.2.5, minipass ×2, path-scurry);
  - `find-babel-config`, `reselect`;
  - `fs.realpath` (only dependent: the nested glob 9.3.5; the first inventory missed it);
  - `pkg-up` + its 5 nested nodes.
  Plus the scoped root override `babel-plugin-module-resolver: { glob: {...} }`. The unchanged lock already holds three
  orphans, which stay (spec A).
- **`expo-notifications` 57.0.24:** `sdk-57` dist-tag, published 2026-10-22, deps and peers identical to 57.0.23, all
  satisfied by existing lock nodes. It is a one-node splice. `SDK_PINNED` does not list it.
- **BUG-087:** the only wall-clock crons in the six CI-stack services are reputation's `'0 2 * * *'` and
  `'30 3 * * *'`. The stack's existing `RATE_LIMIT_DISABLED: "true"` is the naming pattern for the new flag.
- **Mobile `tsc --noEmit` exits 0** on master (2026-11-03), and CI type-checks it (`ci.yml:75`). The 2026-10-29 IDEAS
  line saying it is red is stale (plan Task 13 appends the correction).
- **Routes verified:**
  - POST `/matches` (`matches.ts:146`), PUT `/matches/:id/accept` (`:281`);
  - POST `/requests/:id/propose-match` (`adminActions.ts:95`);
  - POST `/requests/:id/dibs` (`dibs.ts:126`);
  - PUT `/requests/offers/:id/accept` (`requesterOffers.ts:30` → `offersDb.ts:36`).
- **UNVERIFIED (the executor checks):**
  - the lock order of the six `help_offers` writers (spec E);
  - whether `next build` type-checks an unimported frontend file (spec G);
  - how GitHub labels #179 after the subtree leaves the lock;
  - two PostgreSQL lock behaviors behind the offer-race barrier, reasoned from row-lock modes but not run (there is no
    local PostgreSQL):
    - the second waiter queues behind the first on the tuple lock. The counting rule in note 14 holds either way.
    - at `b9682c34`, both calls wait at the match `INSERT`'s foreign-key check. The test's "fails against
      `b9682c34`" claim rests on it.

## Open, not scheduled (carried from Sprint 135)

- **BUG-073** tabled (maintainer, 2026-10-26): community admin and platform admin become separate roles, as a future
  feature (`docs/IDEAS.md` 2026-10-26).
- **BUG-076** (pre-push TDD false pass), **BUG-080** (provider completion rate counts a status never written),
  **BUG-081** (trust-config readers return NUMERIC strings typed as `number`; latent), **BUG-082** (the per-query SQL
  log in five services floods the log; the reputation log loses the 02:00Z nightly by 03:30Z).
- **The mobile sprint** (maintainer, 2026-10-29; `docs/IDEAS.md`): BUG-041 `query-string@7` / `decode-uri-component`,
  stale mobile match statuses, the unused `cancelMatch`, no build pipeline. Do not ship the app before it.
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona: `DEMO_UNRELATED_EMAIL` in the host's `.env.demo.rotation` names a
  pre-reset account; the guide wants Marcus Lee (`docs/guides/demo-data.md:253`). Fixing it is a host write, and each
  rerun is its own authorization.
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- **Sprint 135 recount note:** the 2 `matched` rows of 2026-10-29 are no longer `matched`; why was not traced (BUG-075).

## Standing rules

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` / `git log` after every
merge and at session end.
