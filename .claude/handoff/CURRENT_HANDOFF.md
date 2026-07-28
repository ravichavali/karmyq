# Sprint 121 — Dependency Backlog Cleanup — PRs 1–3 SHIPPED, PR 4 IN FLIGHT

> **STATUS (2026-07-24, updated 2026-07-28):** **PR 3 ([#164](https://github.com/ravichavali/karmyq/pull/164))
> merged as `e7bc6cc5` and deployed 2026-07-28** — master run `30383717067`, `Deploy to Demo` =
> success, `🎉 Demo Deployment Successful` with service health verification, **no rollback**.
> Superseded PRs **#40, #35 and #36 are closed** (#36 with a note that it landed at 10.0.0, not
> its proposed 57.0.0). **PR 4 is the current work.**
>
> **⚠️ PR 3 shipped WITHOUT a version bump — `master` still reads `11.33.0`.** The Plan of Record
> left PR 3's version "TBD" and it was never set, so the demo reports v11.33.0 while running PR 3's
> code. **Do not fix this with a version-only push to `master`** — that triggers a second full
> deploy. **Fold the bump into PR 4** (suggest `11.34.0`, since PR 4 carries breaking majors).
>
> PR 2 ([#162](https://github.com/ravichavali/karmyq/pull/162), v11.33.0) merged as `d7ddd146` and
> deployed 2026-07-28 — master run `30325538212`, `✅ All services healthy`, no rollback, 15m53s.
> **The R-1…R-8 visual smoke test is DONE — all 8 PASS on live karmyq.com at v11.33.0
> (2026-07-28).** Sprint 120 PR C's deploy-verification debt is fully closed; per-check evidence
> and the working demo credentials are in Carry-Forward below.
>
> Sprint 120 is **development-complete and merged**,
> archived to
> `.claude/handoff/archive/2026-07-24-sprint-120-true-scores-one-seed-clarity-COMPLETE.md`.
> That archive's "COMPLETE" means *all scoped work merged to `master`* — it deliberately does
> **not** claim the work is live. PR C ([#158](https://github.com/ravichavali/karmyq/pull/158),
> v11.32.0) merged as `caca85fb` but its master run failed the security gates before
> `Deploy to Demo`; **PR 1 (#160, v11.32.1) shipped that deploy on 2026-07-27**, so v11.32.0's
> clarity fixes are now live. (The R-1…R-8 debt this paragraph used to carry was **discharged on
> 2026-07-28** — see the top of this block and Carry-Forward; do not re-open it.)
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
2. **PRs 1, 2 and 3 are shipped and live** (`ffe5f756` v11.32.1, `d7ddd146` v11.33.0,
   `e7bc6cc5` — version bump missed, see the warning above).
3. **PR 4 (mobile/Expo majors + the Expo SDK upgrade) is the current work.** Branch
   **`deps/sprint-121-pr4-mobile-expo` already exists**, cut from fresh `origin/master`
   (`e7bc6cc5`) — check it out, do not re-cut it. See Critical Note 7 for the full scope; it is
   the largest PR of the sprint and **needs an SDK-target decision before code changes start**.
4. PRs 5 and 6 each branch off **fresh `origin/master`** after the previous one merges.
4. Every merge needs **EXPLICIT admin authorization** (`gh pr merge --squash --admin`), every
   time. Never self-merge.
5. **Before pushing any multi-workspace bump, run the edge-vs-node lockfile check** (see the
   `apps/landing` note below). Local `npm audit` + `npm ci --dry-run` + full test/build runs all
   pass on a half-resolved tree; only `npm ci` in CI catches it.

## Open PR roster after PR 3 (4 open)

| PR | Disposition |
|---|---|
| #37, #39 | **PR 4 — mobile/Expo majors + Expo SDK upgrade. CURRENT WORK.** |
| #41 | PR 5 — tailwindcss 3 → 4 |
| #34 | PR 6 — express 4 → 5 |

**Dependabot has NOT re-raised the four `apps/mobile` react-native bumps** that #157 took with it
when it auto-closed on PR 2's merge (checked 2026-07-28, one open-PR list later). **PR 4 must
apply them by hand** — or, more likely, let the chosen Expo SDK dictate them, since the SDK pins
the react-native line. The hand-targets recorded at triage were react-native 0.86.2,
react-native-maps 1.29.0, reanimated ~4.5.3, react-native-screens ~4.26.2.

<details>
<summary>Historical roster after PR 2 (8 open) — all now resolved</summary>

## Open PR roster after PR 2 (8 open)

| PR | Disposition |
|---|---|
| ~~**#163** ts-jest 29.4.6 → 29.4.12~~ | **CLOSED 2026-07-27** — the bump PR 2 deliberately excluded. Root `overrides` pins 29.4.6 because 29.4.11+ drops tsconfig `moduleResolution: node16` inheritance → TS2307 in request-service tests. Closed with that rationale on the PR; **no Dependabot ignore rule set**, so a fixed ts-jest can still be raised later. See Critical Note 2. |
| ~~#40, #35, #36~~ | **ALL CLOSED 2026-07-28** — superseded by #164 (`e7bc6cc5`), an ESLint 8 → 9 flat-config migration rather than three bumps; see Critical Note 6. |
| #37, #39 | PR 4 — mobile/Expo majors (**+ Expo SDK upgrade**, see Critical Note 7) |
| #41 | PR 5 — tailwindcss 3 → 4 |
| #34 | PR 6 — express 4 → 5 |

**#157 auto-closed on PR 2's merge, taking its four unmerged `apps/mobile` react-native bumps with
it.** Dependabot will re-raise them on its next run; fold that new PR into PR 4 when it appears. If
it hasn't appeared by the time PR 4 starts, apply the bumps by hand — the targets are react-native
0.86.2, react-native-maps 1.29.0, reanimated ~4.5.3, react-native-screens ~4.26.2.

</details>

## Sprint Goal

Take the open-PR count from 18 to 0: ship the security hotfix that unblocks the v11.32.0 deploy,
land the safe dependency backlog in one consolidated PR, then work the seven breaking majors as
individually-scoped migrations.

## Plan of Record — 6 PRs

| PR | Scope | Supersedes | Version |
|---|---|---|---|
| **1** | postcss advisory hotfix + Sprint 120 close-out | #159 | v11.32.1 — **SHIPPED** |
| **2** | consolidated safe deps | #157 (**minus mobile**), **#161**, #85, **#55**, #145, #144, #147, #118, #53 | v11.33.0 — **SHIPPED & DEPLOYED** (`d7ddd146`) |
| **3** | lint toolchain majors → became an **ESLint 8 → 9 flat-config migration** | #40, #35, #36 (**all closed**) | **SHIPPED & DEPLOYED** (`e7bc6cc5`) — ⚠️ **no version bump; master still reads 11.33.0** |
| **4** | mobile/Expo majors **+ Expo SDK upgrade** | #37, #39, **#157's 4 react-native bumps** (never re-raised — apply by hand or via the SDK) | TBD — **carry PR 3's missed bump here** |
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
6. **PR 3 / lint majors — scoped 2026-07-27 as a full ESLint 8 → 9 flat-config migration.**
   The note's open questions are now answered from the registry, not assumed:
   - **`eslint-config-next@16.2.9` declares `peerDependencies.eslint: ">=9.0.0"`.** It cannot be
     taken on ESLint 8. It also bundles `@next/eslint-plugin-next@16.2.9` while we run Next
     `^15.5.21`, and **Next 16 removes `next lint`** — which is literally the `lint` script in
     both `apps/frontend` and `apps/landing` (Next 15 already prints the deprecation).
     **Maintainer decision: take it, and do the ESLint 9 migration with it** (the alternative was
     holding #35 for a future Next 16 sprint).
   - **`eslint-config-expo@8.0.1` ships no flat config** — no `flat.js` in the tarball; 10.0.0
     and 57.0.0 both have one. So #36 is **forced** by the ESLint 9 move, not optional.
   - **#36 retargets to `10.0.0`, NOT Dependabot's `57.0.0`.** Expo switched to SDK-aligned
     versioning at 55; publish dates map it exactly: 8.0.1 (2024-10-22) ↔ SDK 52.0.0
     (2024-11-10) · 9.2.0 ↔ SDK 53 · **10.0.0 (2025-08-13) ↔ SDK 54.0.0 (2025-09-10) — our SDK**
     · 55/56/57.0.0 ↔ SDK 55/56/57. Taking 57.0.0 would put SDK-57 lint tooling on an SDK-54 app.
     **PR 4 moves it again to match whatever SDK it lands on.**
   - **`@typescript-eslint` 6→8.62.1**: plugin + parser in lockstep (peer
     `@typescript-eslint/parser: ^8.62.1`); peer `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0` and
     `typescript: >=4.8.4 <6.1.0` both satisfied. **`apps/mobile` declares `eslint: ^8.0.0` and
     must be raised** — it is below the `^8.57.0` peer floor.
   - **Target ESLint `9.39.5`, not 10.8.0.** 10.x is `latest` and 9.x is `maintenance`, but
     `eslint-config-expo@10.0.0` (Aug 2025) predates ESLint 10 by a year; 9 is what all three
     config packages are proven against.
   - **All four configs are legacy `.eslintrc`** (`apps/frontend/.eslintrc.json`,
     `apps/landing/.eslintrc.json`, `apps/mobile/.eslintrc.js`,
     `services/cleanup-service/.eslintrc.js`) and all must convert to flat `eslint.config.*`.
   - **Lint is non-blocking in CI everywhere** (`|| echo` on every invocation in `ci.yml` and
     `test.yml`), so CI cannot validate this PR. **Verify by running each linter directly.**
     **Follow-up worth doing (raised in review of PR 3, not done in it):** add a *blocking*
     regression test that runs `eslint --print-config <probe file>` per linted workspace and
     asserts it exits 0 with a non-empty resolved rule set. Because CI swallows lint failures,
     a **broken** flat config today fails silently and indistinguishably from the existing lint
     debt; a print-config smoke test separates "config is broken" from "code has lint findings"
     without requiring the ~677 outstanding findings to be cleaned up first. Deliberately kept
     out of PR 3 to hold the migration diff reviewable.
     Pre-migration baselines captured to diff against — the bar is *no regression*, not green:
     `cleanup-service` **0** · `apps/frontend` **525 (456 err / 69 warn)** — 410 of them
     `@typescript-eslint/no-explicit-any` · `apps/landing` **1 warn** · `apps/mobile`
     **23 (12 err / 11 warn)**. Frontend/landing baselines are `next lint` scoping; a bare
     `eslint .` sweeps `.next/` output and reports 707/3344 instead, so **the flat config must
     reproduce `next lint`'s ignores** or the delta is meaningless.

   **PR 3 execution results (2026-07-27).** What landed and what it cost:
   - **A high-severity advisory reappeared and had to be fixed structurally.** ESLint 9
     **de-hoisted out of the root** into all four workspaces (root `node_modules/eslint`
     disappeared entirely), and in that layout `minimatch` resolved to 3.1.5 and
     `brace-expansion` to 1.1.16 inside each workspace — re-opening `GHSA-mh99-v99m-4gvg` with
     **6 high findings** that ADR-059 blocks on. At HEAD this was invisible because
     `eslint@8.57.1` sat at the root, where `overrides.minimatch >=9.0.5` rewrote its
     `minimatch ^3.1.2` edge to 10.2.5. **State this observation carefully:** npm documents
     `overrides` as applying throughout the dependency tree, so "overrides don't reach workspace
     subtrees" is *not* a rule to rely on — what was actually observed here is that this
     particular re-resolution placed unoverridden copies under each workspace, stably across two
     consecutive installs. Treat the mechanism as unexplained and **keep `npm audit` as the
     backstop**; restored hoisting is the mitigation that worked, not a durable invariant.
     **The obvious in-place remedy is genuinely unavailable:** forcing `brace-expansion@5.0.8`
     into minimatch 3 breaks it — 5.x's CJS export is an object
     `{EXPANSION_MAX, EXPANSION_MAX_LENGTH, expand}` while minimatch 3 calls the module itself —
     and there is **no patched 1.x**, the advisory being `<=5.0.7` across every major.
     **Correction, recorded because the first pass got this wrong:** ESLint 10.8.0 (npm's own
     suggested fix, and it does drop `@eslint/eslintrc` and minimatch 3) was initially rejected
     on the grounds that its engines `^20.19.0 || ^22.13.0 || >=24` clash with Node 18. **That
     reasoning does not hold.** CI runs **Node 24.x** (`ci.yml` `NODE_VERSION`), and the only
     Node 18 in play is the `node:18-alpine` *Docker builder stage*, which merely runs
     `npm install` and never executes ESLint; with no `engine-strict` in `.npmrc` that is an
     `EBADENGINE` warning, not a build failure. **Staying on ESLint 9 still stands, on other
     grounds:** `eslint-config-expo@10.0.0` (Aug 2025) predates ESLint 10 by a year and is
     unproven against it, 9.x is a supported maintenance line, and 9 is what was scoped and
     approved. **If a future sprint revisits this, ESLint 10 is the cleaner target** — it removes
     the eslintrc/minimatch-3 chain at the source and would make the root-hoist fix below
     unnecessary.
     **Fix: declare `eslint` in the ROOT devDependencies**, which restores the root hoist and
     puts the toolchain back under the override block. `npm audit` → `found 0 vulnerabilities`.
     This does **not** violate Critical Note 1's ban on root deps for hoisting — that ban is
     about *prod* deps bloating images; all 9 backend Dockerfiles run `npm install --omit=dev`.
     **Standing lesson: never assume an override is still applied — re-run `npm audit` after any
     bump that changes where a package lands in the tree.** A package moving from the root into
     workspace subtrees is the specific shape that bit here, and no local check other than
     `npm audit` caught it.
   - **Lint deltas — nothing lost anywhere, all additions explained.** `cleanup-service` 0 → 0 ·
     `apps/landing` 1 → 1 (identical) · `apps/mobile` 23 → **24** · `apps/frontend` 525 → **653**.
     Frontend's +128 is **+126 `react-hooks/*`** (`set-state-in-effect` 67, `immutability` 33,
     `static-components` 21, `preserve-manual-memoization` 4, `purity` 1) because
     eslint-config-next 16 bundles **eslint-plugin-react-hooks 7** where 15.5.10 bundled 5 — these
     are React-Compiler-era rules flagging pre-existing code, **and `apps/mobile` already ran
     them at baseline**, so accepting them is the consistent choice. Plus 2 extra
     `@typescript-eslint/no-unused-vars` that ts-eslint 8 catches and 6 did not. Mobile's +1 is
     `import/no-named-as-default-member` on `axios.create` (a known-noisy rule on axios's dual
     default/named export; the usage is idiomatic). **Lint is non-blocking in CI, so none of this
     gates anything** — a frontend `react-hooks` cleanup is worth its own task.
   - **Three flat-config traps, all load-bearing:** (a) `eslint-plugin-react-hooks@7`'s top-level
     `configs.recommended` is **still the legacy eslintrc shape** (plugins as an array) and
     ESLint 9 rejects it — use `configs.flat.recommended`; (b) eslint-config-expo registers its
     own bundled react-hooks 5.x, and ESLint 9 refuses two instances of one plugin name
     (`Cannot redefine plugin`), so `apps/mobile/eslint.config.js` strips expo's registration
     and its `react-hooks/*` rules before re-adding the declared v7; (c) **ESLint 9 turns on
     `reportUnusedDisableDirectives` by default**, which surfaced two dead
     `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments in
     `hooks/useExpoNotifications.ts` (removed).
   - **`--ext` is removed in flat config** — `cleanup-service`'s `lint` script became
     `eslint src`. Both Next apps moved from `next lint` to `eslint src` (bare `eslint` would
     sweep build output). **`apps/landing` has no `eslint.ignoreDuringBuilds`**, so its
     `next build` lints — verified the production build still succeeds on flat config.
     `apps/frontend` does set `ignoreDuringBuilds: true`.
   - **Verified:** `npm audit` 0 vulnerabilities · edge-vs-node check **263 edges / 16
     workspaces / 0 mismatches** (no half-resolution) · `npm ci --dry-run` clean ·
     `apps/landing` production build succeeds · affected suites green when run directly.
   - **The root `npm test` (turbo) is RED on this Windows box and it is contention, not this
     diff. Do not chase it; verify per workspace instead.** Two consecutive full runs failed
     with **different** sets: run 1 `community-service` 3 failed/122, `reputation-service`
     clean; run 2 `community-service` 8 failed/122 **and** `reputation-service` 2 failed/146.
     Run directly, both are green — `community-service` **122/122 in 7.6s vs 162.8s under
     turbo** (21× slowdown), `reputation-service` unit 5/5 + regression 132 passed/146
     (11 skipped, 3 todo), both `EXIT=0`. Neither service is touched by this diff (its only
     source changes are two `apps/mobile` files), so a real regression there is not plausible.
     This is the documented Windows turbo timeout-flake class. **CI, which runs these on Linux
     runners without the same contention, is the arbiter.**
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

   **PR 4 TARGET DECIDED 2026-07-28: Expo SDK 57, and PR 4 carries the version bump to
   `11.34.0`** (covering PR 3's missed bump too — see the status block). The SDK pins the whole
   native-module set, so these are consequences of that choice, not separate decisions.
   `expo` `~54.0.0` → `~57.0.0` · `react-native` `0.85.3` → `0.86.0` ·
   `react-native-gesture-handler` `~2.22.0` → **`~2.32.0`** · `@expo/vector-icons` `~14.0.4` →
   `^15.0.2` · `react-native-reanimated` `~4.4.0` → `4.5.0` · `react-native-screens` `~4.25.2` →
   `~4.26.0` · `@expo/metro-runtime` **`~4.0.1` → `~57.0.7`** (the stalest entry by far) ·
   `react-native-maps` **stays `1.27.2`** and `react-native-web` **stays `~0.21.0`** — SDK 57
   pins exactly what we already declare. `eslint-config-expo` **10.0.0 → 57.0.0**, which is the
   version Dependabot's #36 originally proposed; PR 3 parked it at 10.0.0 deliberately.

   **⚠️ #37 must NOT be merged as filed.** It proposes `react-native-gesture-handler` 3.0.2, but
   **no Expo SDK from 54 to 57 bundles a 3.x** — SDK 57 wants `~2.32.0`. Retarget it to the SDK's
   version and close #37 with that rationale (same class of error as #36's 57.0.0-on-SDK-54).
   **#39 is correct as filed** — every SDK ≥54 wants `@expo/vector-icons` ^15.x.

   **Watch `react-native-safe-area-context`: we declare `5.8.0` but SDK 57 pins `~5.7.0`** — we
   are *ahead*, so aligning is a downgrade. Decide deliberately rather than letting
   `expo install --fix` silently roll it back.

   **The manifest was already incoherent before this PR** and that is why the state was confusing:
   `expo ~54.0.0` sat alongside `react-native 0.85.3` and `react-native-maps 1.27.2`, which are
   **SDK 56's** pins, not SDK 54's (0.81.5 / 1.20.1). Landing on 57 makes it internally consistent
   for the first time.

   **PR 4 now also owns the Expo SDK upgrade itself** (maintainer raised it during PR 3 scoping,
   2026-07-27). It lands here rather than in PR 3 for three reasons: PR 4 already owns the mobile
   surface, so the tree gets one resolution fight instead of two; an SDK bump *is* this note's
   predicted "Expo-SDK-aligned upgrade of the whole mobile set"; and PR 3 is unblocked without it
   (`eslint-config-expo@10.0.0` gives flat config on SDK 54 today). **The manifest needs a
   cleanup pass that is not lint work:** 12 `expo-*` packages are declared as bare `*`
   (`expo-camera`, `expo-constants`, `expo-device`, `expo-font`, `expo-image-picker`,
   `expo-linking`, `expo-location`, `expo-notifications`, `expo-router`, `expo-secure-store`,
   `expo-splash-screen`, `expo-status-bar`) and `@expo/metro-runtime` is pinned `~4.0.1`
   (SDK-52 era) against `expo ~54.0.0`. Current SDK line: 54.0.36 · 55.0.28 · 56.0.17 · 57.0.8.
   When the SDK moves, **`eslint-config-expo` moves with it** (57.0.0 for SDK 57) — PR 3
   deliberately parks it at the SDK-54-aligned 10.0.0.
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

- **Demo runs v11.33.0** as of PR 2's deploy (2026-07-28, run `30325538212`). **Every PR in this
  sprint ends with the same two-step verification, not with a green PR:** confirm the master CI/CD
  run reached **`Deploy to Demo` = success with no rollback**, then smoke-test the live site. PR C's
  merge run is the standing counterexample — 20 green checks and no deploy.
- **R-1…R-8 visual pass: DONE 2026-07-28 on live karmyq.com at v11.33.0 — all 8 PASS.** No longer
  owed; the debt opened in Sprint 120 PR C is closed. Evidence per check:
  - **R-1** (UTF-8 JWT decode) — 102 em dashes render correctly across the dashboard, **zero**
    mojibake sequences. Proven positive, not just absent: the live JWT's community names contain
    U+2014 and a naive `atob` of that same payload demonstrably differs from the UTF-8-safe decode.
  - **R-2** — dashboard community `<select>` measures 320px on a 1440px viewport (22%).
  - **R-3** — logged-out root offers "See how it works" → `/demo`; the signed-in root correctly
    does **not** (both halves of the spec).
  - **R-4** — `/login` and `/register` both carry the wordmark + seed glyph linking `/`, the
    tagline, and brand-green actions.
  - **R-5** — at 375×812 the create action is a **full-width docked bar** ("+Ask for help",
    x=16 w=328) seated directly above the fixed bottom nav (y=748), not a corner FAB. At maximum
    scroll the last card clears it by 146px and **zero** interactive elements are overlapped —
    the exact S120 failure mode (FAB clipping "Explore →") is gone. Desktop keeps a labelled FAB.
  - **R-6** — exactly **one** overlay at each onboarding step (1→2→3) and **zero** after dismiss;
    the feed tour appears only on a later visit, never stacked on the welcome modal.
  - **R-7** — all three branches: degree 0 (`priya.sharma`) gets the CTA + a guiding empty state;
    degree 1 (`fatima.alhassan`) keeps the graph **and** shows the CTA; degree ≥2 (`maria.reyes` 4,
    `takeshi.osei6315` 2) correctly gets no nag.
  - **R-8** — active `/network` mode pill is `bg-primary` `rgb(45,110,40)` with white text, not
    indigo; dashboard filter chips match.
- **Credentials that actually work (2026-07-28).** The S89 account in memory
  (`aisha.white6964@…`) **401s — it did not survive the S117 curated reset.** Live: `maria.reyes@`
  (degree 4), `takeshi.osei6315@` (2), `fatima.alhassan@` (1), `priya.sharma@` (0), all
  `password123`. Find more by degree with `social_graph.trust_edges_live` — its columns are
  `user_id_a`/`user_id_b`, **not** `from_user_id`/`to_user_id`.
- **BUG-031 is still live and slightly worse: 33× 404** on
  `/api/reputation/community-trust/{id}` when loading `/communities` (was 32). Still console-only
  noise, still unfixed, still out of R-1…R-8 scope.
- `curl -o /dev/null -w "%{http_code}"` returns `000` against karmyq.com from this Windows host (a
  schannel TLS-renegotiation quirk, not an outage) — check the response body instead.
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
