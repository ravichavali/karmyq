# Sprint 121 — Dependency Backlog Cleanup — PR 1 SHIPPED, PR 2 IN FLIGHT

> **STATUS (2026-07-24, updated 2026-07-27):** Sprint 120 is **development-complete and merged**,
> archived to
> `.claude/handoff/archive/2026-07-24-sprint-120-true-scores-one-seed-clarity-COMPLETE.md`.
> That archive's "COMPLETE" means *all scoped work merged to `master`* — it deliberately does
> **not** claim the work is live. PR C ([#158](https://github.com/ravichavali/karmyq/pull/158),
> v11.32.0) merged as `caca85fb` but its master run failed the security gates before
> `Deploy to Demo`; **PR 1 (#160, v11.32.1) shipped that deploy on 2026-07-27**, so v11.32.0's
> clarity fixes are now live. **The R-1…R-8 visual smoke test on karmyq.com is still OWED** —
> it needs demo login credentials and was never run.
>
> This sprint clears the entire open-PR backlog: **18 open PRs** triaged 2026-07-24 into **six
> PRs of work, one closed unmerged (#106), and one closed as superseded on PR 1's merge (#159)** —
> see the Plan of Record table, which accounts for all 18 by number. Maintainer scope decisions:
> (a) safe bumps land as ONE consolidated PR, not 12 individual merges — every master merge is a
> full deploy; (b) **all 7 breaking majors are IN SCOPE** (maintainer overrode the recommendation
> to defer them); (c) stale PR #106 closes — BUG-022/023 are already in `docs/BUGS.md`, fixed in
> Sprint 107.

## Quick Start

1. Read this handoff. The triage table below is the plan of record.
2. **PR 1 merged as `ffe5f756` (v11.32.1) and deployed.** PR 2 is on
   `deps/sprint-121-pr2-safe-deps`, cut from `origin/master` (`ffe5f756`). Verify state with
   `git log --oneline -3` before continuing.
3. Each subsequent PR branches off **fresh `origin/master`** after the previous one merges.
4. Every merge needs **EXPLICIT admin authorization** (`gh pr merge --squash --admin`), every
   time. Never self-merge.

## Sprint Goal

Take the open-PR count from 18 to 0: ship the security hotfix that unblocks the v11.32.0 deploy,
land the safe dependency backlog in one consolidated PR, then work the seven breaking majors as
individually-scoped migrations.

## Plan of Record — 6 PRs

| PR | Scope | Supersedes | Version |
|---|---|---|---|
| **1** | postcss advisory hotfix + Sprint 120 close-out | #159 | v11.32.1 — **SHIPPED** |
| **2** | consolidated safe deps | #157 (**minus mobile**), **#161**, #85, **#55**, #145, #144, #147, #118, #53 | v11.33.0 — **[#162](https://github.com/ravichavali/karmyq/pull/162), 21/21 green, awaiting merge authorization** |
| **3** | lint toolchain majors | #40, #35, #36 | TBD |
| **4** | mobile/Expo majors | #37, #39, **#157's 4 react-native bumps** | TBD |
| **5** | tailwindcss 3 → 4 | #41 | TBD |
| **6** | express 4 → 5 | #34 | TBD |
| — | closed unmerged | #106 (stale docs) — **CLOSED 2026-07-24** | — |

**Accounting (all 18 open PRs at triage):** 1 superseded by PR 1 (#159) + 9 in PR 2 (#157, #126,
#85, #55, #145, #144, #147, #118, #53) + 3 in PR 3 (#40, #35, #36) + 2 in PR 4 (#37, #39) +
1 in PR 5 (#41) + 1 in PR 6 (#34) + 1 closed unmerged (#106) = **18**. No PR is unassigned.

**Roster change (2026-07-27):** Dependabot closed **#126** and reopened the same dev-deps group as
**#161** (9 updates → 8) 30 seconds later. #161 takes #126's slot in PR 2; the count is unchanged.
This is the mid-sprint-arrival case Critical Note 8 warns about, in its benign form.

**Closure status:** **#106** (2026-07-24), **#159** (superseded by PR 1's merge) and **#126**
(replaced by #161) are closed. The nine PR 2 supersessions close after PR 2 merges — not before,
so the bumps are actually on `master` before their Dependabot PRs are dismissed.

**PR 1 — SHIPPED 2026-07-27.** Merged as `ffe5f756` (PR
[#160](https://github.com/ravichavali/karmyq/pull/160), v11.32.1); master run `30296156360`
reached **`Deploy to Demo` = success with no rollback** (16m43s), so v11.32.0's clarity fixes are
live. `karmyq.com` root and `/demo` both return 200. **The R-1…R-8 visual smoke test is still
OWED** — it needs demo login credentials. Two advisories cleared, detail below.

`GHSA-r28c-9q8g-f849` — postcss ≤ 8.5.17 path traversal, high, 5 findings
via the single hoisted `node_modules/postcss` that both `next` and `@expo/metro-config` resolve.
Fix: root `overrides.postcss` `^8.5.10` → `^8.5.18`, matching devDep ranges in
`apps/frontend` + `apps/landing`, and a **surgical in-place lockfile bump** of exactly two nodes
(`postcss` 8.5.15 → 8.5.23; plus its newly required **dependency** `nanoid` 3.3.12 → 3.3.16 —
8.5.23 declares `nanoid ^3.3.16` under `dependencies`, not as a peer).
**Second advisory folded in (2026-07-27):** `GHSA-mh99-v99m-4gvg` — brace-expansion DoS via
unbounded expansion, high, 1 finding — published while #160 sat awaiting merge authorization and
turned the same two gates red again on an unchanged dependency diff. Same surgical treatment:
the exact override `brace-expansion` `5.0.7` → `5.0.8` and the one hoisted lockfile node bumped
in place. `balanced-match@4.0.4` already satisfies 5.0.8's `^4.0.2`, so no second node moved —
4 changed lines total.

Verified (after both advisories): `npm audit` = `found 0 vulnerabilities`;
`sprint-75-security-gate` 3/3 run directly; `npm install --package-lock-only` reproduces the
hand edits byte-identically (zero churn); installed tree confirmed at `postcss 8.5.23`,
`nanoid 3.3.16`, `brace-expansion 5.0.8`.
**PR 2 contents** (declared-range deltas read off the live Dependabot branches, not the triage
notes): #157 production-deps (ioredis ^5.3.2→^5.11.1, pg ^8.11.3→^8.22.0, framer-motion + motion
12.40.0→12.42.2, react-native 0.85.3→**0.86.2**, react-native-maps 1.27.2→1.29.0, reanimated
~4.4.0→~4.5.3, rn-screens ~4.25.2→~4.26.2, helmet ^8.1.0→^8.3.0 in 7 services, uuid
^14.0.0→^14.0.1) · **#161** dev-deps **minus ts-jest** (autoprefixer ^10.0.1→^10.5.4, prettier
^3.1.0→^3.9.6, tsx ^4.7.0/^4.21.0→^4.23.1, turbo ^2.9.14→^2.10.7, @faker-js/faker ^10.1.0→^10.5.0,
@playwright/test ^1.40.0→^1.62.0) · #85 tsx ^4.7.0→^4.22.4 in the **separate `/scripts` lockfile**
(root `overrides.esbuild` does not reach that subtree) · **#55 supertest ^6.3.3→^7.2.2 +
@types/supertest ^6.0.2→^7.2.0** in auth, community, social-graph and `tests` · action bumps #145,
#144, #147, #118, #53.

**ts-jest is excluded twice over**: root `overrides.ts-jest` already pins the installed node at
`29.4.6`, so accepting #161's `^29.4.12` ranges would leave every manifest declaring a range the
override contradicts. Leave the ranges alone (Critical Note 2).

**#157's four `apps/mobile` bumps moved to PR 4** (react-native 0.85.3→0.86.2, react-native-maps
1.27.2→1.29.0, reanimated ~4.4.0→~4.5.3, react-native-screens ~4.25.2→~4.26.2). Reason, verified
not assumed: **npm will not resolve them.** After editing the ranges, `npm install
--package-lock-only` leaves `apps/mobile/node_modules/react-native` at 0.85.3 while the
`apps/mobile` edge reads 0.86.2 — the manifest would claim a version the lockfile never installs.
`npm update --package-lock-only --workspace apps/mobile` changes nothing, and `npm ci --dry-run`
does *not* error on the mismatch, so CI would go green on a tree that never upgraded. **This is
not a Windows artifact**: Dependabot's own #157 lockfile has the identical half-resolution — it
only hoists `react-native-screens` out of `expo-router` and adds no 0.86.x nodes at all. PR 4
already owns mobile, and #37 (gesture-handler 2→3) is part of the same upgrade anyway, so the
whole mobile surface gets one resolution attempt and one verification pass instead of two.

**Undeclared-dependency fallout — the real work in this PR.** De-hoisting is the mechanism to
watch. Bumping `supertest` in the 4 workspaces that declared it removed the hoisted
`node_modules/supertest@6.3.4` that 4 *other* workspaces had been importing without declaring:
`geocoding-service` (the one that failed CI), `reputation-service`, `request-service` and
`packages/shared`. Fixed at the layer — `supertest`/`@types/supertest` are now declared where they
are imported — not by pinning to preserve the hoist. Same cross-check was run for the other
de-hoisted packages (`helmet` 9 importers = 9 declarers, `autoprefixer` 2 = 2,
`@playwright/test`/`@faker-js/faker` in `tests` only): no other gaps. Rule promoted to CLAUDE.md
Global Patterns + AGENTS.md standing rules.

**`apps/landing` hit the SAME half-resolution and CI is what caught it.** The manifest edit moved
`framer-motion`/`motion` to 12.42.2, only the hoisted `motion-dom` transitive followed, and the
nested `apps/landing/node_modules/*` nodes stayed at 12.40.0 — so `npm ci` failed the first push
with `Missing: framer-motion@12.42.2 from lock file` while every local check (audit, per-package
spot checks, `npm ci --dry-run`, full test + build runs) was green. **`npm install --workspace
apps/landing framer-motion@12.42.2` does not fix it — it reports "up to date" and rewrites the
manifest's exact pins DOWN to `^12.40.0`.** The fix was the surgical in-place lockfile edit
(Critical Note 1): both nested nodes plus the two workspace edges, `resolved`/`integrity` from the
registry, `motion-dom` range → `^12.42.2`.
**Standing lesson — verify edges against nodes before pushing any multi-workspace bump.** Walk
every declared range up the `node_modules` chain and assert the node it lands on satisfies it, and
diff the result against `origin/master` so the ~26 deliberate `overrides` mismatches (minimatch,
postcss, uuid, ws, sharp, js-yaml, fast-uri, @xmldom/xmldom) don't drown the real finding. On this
diff that check reported *exactly* master's 26 and nothing more.

**Expect ~570 lines of lockfile churn and don't try to shrink it.** `helmet`, `autoprefixer`,
`@playwright/test` and `@faker-js/faker` end up de-hoisted into per-workspace `node_modules`
even though every consumer agrees on the range — npm's minimal-change resolver deletes the
hoisted node and writes copies. It is stable (two consecutive `--package-lock-only` runs are
byte-identical), a real `npm install` reproduces it exactly, and the 9 backend Dockerfiles copy
their own service manifest, so nested placement still installs. Do **not** reach for `npm dedupe`
to tidy it (Critical Note 1).

**#55 is a MAJOR, deliberately placed in PR 2** rather than with the other majors. Rationale: it
is a devDependency used only by backend test suites, so its entire blast radius is the test
tier — a break fails loudly and immediately in the gate rather than reaching runtime or UI. It is
the one major whose verification is fully automated. Condition of inclusion: the backend suites
must be run **directly** (`cd tests && npx jest`, plus each affected service workspace), not via
a Turbo run that could serve a cached pass. If supertest 7 needs source changes to test helpers,
pull it OUT of PR 2 into its own PR rather than growing the consolidated diff.

**PRs 3–6 are genuine migrations, not merges** — see Critical Notes 4–7.

**Disposition is now complete: 18 open PRs → 6 PRs of work + 1 closed unmerged + 1 closing on
PR 1's merge** (#106 stale docs, **already closed** 2026-07-24; #159 superseded by PR 1, **still
open** until that merge lands). Every open PR is accounted for; if a new Dependabot PR arrives
mid-sprint, add it to this table before starting work.

## Critical Implementation Notes

1. **Surgical lockfile bumps only** (now established three times — `next` twice, `postcss` once).
   Bump the affected nodes IN PLACE, then prove it with `npm install --package-lock-only` +
   `git diff` = no additional churn. **NEVER** whole-tree `npm dedupe` (re-resolves ~71 unrelated
   transitives CI doesn't build), **NEVER** a root prod dep to force hoisting (9 backend
   Dockerfiles copy the root manifest and `npm install --omit=dev` — a root `next` pins
   next/swc/sharp ~289MB into every backend image, and `sharp@0.35.3` needs Node ≥20.9 while
   backends run Node 18), **NEVER** a scratch lockfile regen on Windows.
2. **`ts-jest` stays pinned at 29.4.6** — hold it back out of PR 2. 29.4.11+ stops merging the
   project tsconfig's `moduleResolution: node16` into the root jest inline tsconfig → TS2307 on
   the `@karmyq/shared/schemas/ui` subpath in request-service tests.
3. **`uuid` is fine to bump in PR 2.** The root override pins the hoisted node at `^11.1.1`
   (bull's `require('uuid')` needs CJS; uuid@14 is ESM-only). #157 only moves the
   `packages/shared` + `cleanup-service` copies, which are already on 14 by direct declaration.
4. **PR 5 / tailwindcss 4** is a config rewrite, not a bump: v4 is CSS-first, so both
   `apps/frontend/tailwind.config.js` and `apps/landing/tailwind.config.ts` are
   deleted/reexpressed. Highest visual-regression risk in the sprint — every surface. Verify
   against the S115/S118/S119 graph-presentation contracts and the S120 R-1…R-8 clarity fixes.
5. **PR 6 / express 5** touches root, `packages/shared` (imported by all 10 services), and
   `geocoding-service`. Breaking: routing, error handling, `req.query` getter. #34 is already
   `CONFLICTING` — rebuild from scratch off master rather than rebasing that branch.
6. **PR 3 / lint majors:** `@typescript-eslint/eslint-plugin` 6→8 needs the parser bumped in
   lockstep. `eslint-config-next` 16 targets Next 16 while we run `^15.5.21` — confirm the skew
   is tolerable or hold that one. `eslint-config-expo` 8.0.1→57.0.0 is a versioning-scheme jump
   tied to the Expo SDK.
7. **PR 4 / mobile:** `apps/mobile` type-check is already red on master (FlatList/refreshControl
   overloads) and mobile lint is non-blocking in CI — don't chase mobile green as a gate, but
   don't regress it either. Mobile uses **Expo Router**, not `@react-navigation`.
   **Now also carries #157's four react-native bumps** (moved out of PR 2 — see "PR 2 contents").
   Budget for a real resolution fight: neither `npm install --package-lock-only` nor
   `npm update --workspace apps/mobile` will place the 0.86.x nodes, and Dependabot can't either.
   Expect to need `npm install --workspace apps/mobile <pkg>@<version>` with explicit specs, or an
   Expo-SDK-aligned upgrade of the whole mobile set at once. **Verify the resolved tree, not the
   manifest** — `apps/mobile/node_modules/react-native/package.json` must actually read 0.86.x
   before the PR is real, because `npm ci` will not catch the mismatch for you.
8. **Advisories publish mid-flight — expect this, it is not a defect in your diff.** Four
   occurrences across Sprints 120–121, each on a diff that had not changed:
   - **2026-07-21, during PR B execution** — a batch of registry disclosures (7 high + 1
     critical) blocked PR B's artifact commit. Remediated as its own hotfix, PR
     [#156](https://github.com/ravichavali/karmyq/pull/156) (v11.30.1).
   - **2026-07-23, during PR C's review** — `GHSA-m99w-x7hq-7vfj` (`next` 12.0.0–15.5.20,
     8 highs). Folded into PR C by maintainer decision; took three attempts before the surgical
     in-place bump was the accepted shape.
   - **2026-07-24, between PR C going green and its merge landing** —
     `GHSA-r28c-9q8g-f849` (postcss ≤ 8.5.17, 5 highs). Stopped PR C's own deploy; remediated by
     PR [#160](https://github.com/ravichavali/karmyq/pull/160) (v11.32.1).
   - **2026-07-27, while #160 awaited merge authorization** — `GHSA-mh99-v99m-4gvg`
     (brace-expansion ≤ 5.0.7, 1 high). Folded into #160.

   **Signature:** `Security Audit` and `sprint-75-security-gate` go red *together* on a diff that
   touches no dependencies. Check for a newly published advisory before debugging anything. The
   remedy is always the same surgical bump; never bypass the gate. **Corollary: the longer a PR
   waits for merge authorization, the more likely it needs another bump before it can land** —
   re-check the gate immediately before merging, not just when CI last ran.
9. **Standing mechanics**: branch off `origin/master` (never local master); admin-authorized
   squash merge with EXPLICIT authorization each time; no docs-only master pushes (fold docs
   into the PR); TDD in the changed workspace's `tests/tdd/`; run cross-workspace suites
   directly (`cd tests && npx jest regression/<file>`) — Turbo caches stale cross-workspace
   passes; grep-verify `nav.json` after any landing regen; `npm test` regenerates landing docs,
   so revert timestamp/HEAD-sha churn before committing.
10. **Gate effort is calibrated to diff size** (standing since S120): one `/simplify` per PR;
    `/code-review` medium for small well-specified PRs, high for risky/large ones (PRs 5 and 6
    are HIGH). All four gates run every sprint regardless.

## Carry-Forward / Known State

- **Demo runs v11.32.1** as of PR 1's deploy (2026-07-27). **Every PR in this sprint ends with the
  same two-step verification, not with a green PR:** confirm the master CI/CD run reached
  **`Deploy to Demo` = success with no rollback**, then smoke-test the live site. PR C's merge run
  is the standing counterexample — 20 green checks and no deploy. **The R-1…R-8 pass owed from
  Sprint 120 PR C is still unrun** and should ride PR 2's deploy if credentials are available.
- **PR #106** (Sprint 106 docs) was **closed unmerged 2026-07-24** — superseded by 14 sprints,
  and a docs-only master merge would trigger a pointless deploy. BUG-022/023 verified present in
  `docs/BUGS.md` (lines 323, 336, both `fixed (Sprint 107)`) before closing; nothing was lost.
- **BUG-031** — 32× 404 `community-trust` console noise on `/communities`. Logged, not fixed.
- **BUG-030** live-repro confirmation still pending a maintainer pass (maria.reyes → Fatima
  Alhassan single + `/paths/batch` sweep). Deploy evidence is otherwise strong.
- **S120 deferred findings** R-9/R-10/R-12 are in `docs/IDEAS.md`. Seven surfaces went unaudited
  in the five-second pass (request detail, create-request wizard, community detail, profile,
  notifications, messaging, md→lg topbar) — carried forward.
- **PLAUSIBLE pre-existing edge**: localStorage communities snapshot can route a stale-snapshot
  member to `/welcome`. Still deferred.
- **Deferred S119 follow-ups**: computeInvitationPath disclosure-gate question, api.ts
  interceptor clearAuthSession adoption, cold-cache batch enrichment.
- **Untracked in the working tree** (not from this sprint, not mine to commit):
  `.github/copilot-instructions.md`, `.github/instructions/`.
- **Housekeeping**: `git stash@{0}` (`sprint-120-pr153-artifact-wip`) is fully captured in merged
  commits — safe to drop. Two ancient v9.x stashes (`stash@{1}` S36, `stash@{2}` S34) are cruft.
- Docker unavailable locally; DB-backed assertions ride CI.
- Root Turbo on Windows can hit Jest temp-cache `EPERM`; rerun isolated with unique caches under
  `C:\tmp` — assertion failures are not cache races.

## Persistent Context

### Multi-Agent PR Process

- Admin owns scope approval, merge authority, and deploy authorization.
- Claude owns merge-readiness recommendation and is the only agent that marks a sprint complete.
- Contributor agents never self-merge; one branch/PR per task and no direct commits to `master`.
- Copy and fill `.github/pull_request_template.md` when using `gh pr create`.
- The non-authoring agent performs cross-agent review when available.
- Do not independently resolve cross-agent conflicts; pause for reassignment.

### Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- API interceptor unwraps envelopes: callers consume `res.data`, not `res.data.data`.
- JWT membership field is `communities`, not `communityMemberships`.
- Authorization uses live membership lookup; JWT membership is only a hint.
- Community schema is `communities.*`; auth schema is `auth.*`.
- Error contract is `{ success:false, message:string, error:string }` (ADR-074).
- `social_graph.trust_edges_live` is read-only.
- Request-service owns `/requests/feed`; there is no feed-service.
- `category` and `request_type` are not interchangeable.
- Trust-path topology is platform-wide; strength is community-scoped (ADR-077).
- Reputation/relationship outward contracts remain governed by ADR-082/084.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

### Workflow Gotchas

- TDD tests start in each changed workspace's `tests/tdd/`, then promote when green.
- Run focused workspace suites directly; Turbo can hide or invent cache-related failures.
- Every implementation task runs `/simplify`; every sprint runs `/code-review` and `/security-review`.
- Invoke `pre-commit-check` before every commit.
- Unit + regression must pass before push.
- Run the direct doc-context drift test after generated landing-doc changes.
- Do not create worktrees; this is a shared, time-sliced checkout.
- Do not make a docs-only follow-up push to `master`; every master push triggers a deploy.

### Demo / Deploy Drift Watch

Confirm GitHub Actions deploy succeeded and live content matches `master` before judging the result.
Demo persona credentials come from server environment configuration; never commit passwords.
