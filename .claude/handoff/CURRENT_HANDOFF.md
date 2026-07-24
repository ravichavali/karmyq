# Sprint 121 — Dependency Backlog Cleanup — PR 1 (postcss hotfix) IN FLIGHT

> **STATUS (2026-07-24, this session):** Sprint 120 is CLOSED and archived to
> `.claude/handoff/archive/2026-07-24-sprint-120-true-scores-one-seed-clarity-COMPLETE.md`.
> PR C ([#158](https://github.com/ravichavali/karmyq/pull/158), v11.32.0) merged as `caca85fb`
> but its master run failed the security gates before `Deploy to Demo`, so **v11.32.0's clarity
> fixes are merged but NOT live** — the PR 1 hotfix below is what deploys them.
>
> This sprint clears the entire open-PR backlog: **18 open PRs** triaged 2026-07-24 into six
> PRs of work. Maintainer scope decisions this session: (a) safe bumps land as ONE consolidated
> PR, not 12 individual merges — every master merge is a full deploy; (b) **all 7 breaking
> majors are IN SCOPE** (maintainer overrode the recommendation to defer them); (c) stale
> PR #106 closes — BUG-022/023 are already in `docs/BUGS.md`, fixed in Sprint 107.

## Quick Start

1. Read this handoff. The triage table below is the plan of record.
2. **PR 1 is on `hotfix/postcss-advisory-v11.32.1`**, cut from `origin/master` (`caca85fb`).
   Verify state with `git log --oneline -3` before continuing.
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
| **1** | postcss advisory hotfix + Sprint 120 close-out | #159 | v11.32.1 |
| **2** | consolidated safe deps | #157, #126, #85, #145, #144, #147, #118, #53 | v11.33.0 |
| **3** | lint toolchain majors | #40, #35, #36 | TBD |
| **4** | mobile/Expo majors | #37, #39 | TBD |
| **5** | tailwindcss 3 → 4 | #41 | TBD |
| **6** | express 4 → 5 | #34 | TBD |

**PR 1 (in flight).** `GHSA-r28c-9q8g-f849` — postcss ≤ 8.5.17 path traversal, high, 5 findings
via the single hoisted `node_modules/postcss` that both `next` and `@expo/metro-config` resolve.
Fix: root `overrides.postcss` `^8.5.10` → `^8.5.18`, matching devDep ranges in
`apps/frontend` + `apps/landing`, and a **surgical in-place lockfile bump** of exactly two nodes
(`postcss` 8.5.15 → 8.5.23; its new peer `nanoid` 3.3.12 → 3.3.16 — 8.5.23 requires `^3.3.16`).
Verified: `npm audit` = `found 0 vulnerabilities`; `sprint-75-security-gate` 3/3;
`npm install --package-lock-only` reproduces the hand edit byte-identically (zero churn).

**PR 2 contents.** #157 production-deps ×10 (ioredis 5.11.0→5.11.1, pg 8.21→8.22,
framer-motion/motion 12.40→12.42, react-native 0.85.3→**0.86.0**, react-native-maps 1.27→1.29,
reanimated 4.4→4.5.3, rn-screens 4.25→4.26, helmet 8.2→8.3, uuid 14.0.0→14.0.1) · #126 dev-deps
×9 **minus ts-jest** · #85 esbuild/tsx in `/scripts` · action bumps #145, #144, #147, #118, #53.

**PRs 3–6 are genuine migrations, not merges** — see Critical Notes 4–7.

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
8. **Advisories publish mid-flight.** Twice in Sprint 120 a fresh GHSA turned `Security Audit` +
   `sprint-75-security-gate` red on an unrelated diff between PR-green and merge. If both go red
   together on a diff that touches no deps, check for a newly published advisory before
   debugging. Re-run the gate after rescan; never bypass.
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

- **v11.32.0 is merged but undeployed** until PR 1 ships. Demo runs v11.31.0.
- **PR #106** (Sprint 106 docs) closes unmerged — superseded by 14 sprints, and a docs-only
  master merge would trigger a pointless deploy. BUG-022/023 verified present in `docs/BUGS.md`.
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
