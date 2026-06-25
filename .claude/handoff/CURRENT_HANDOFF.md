# Sprint 113 — Belonging Truth & Prominence: PR A in review

> **STATUS (2026-06-25):** Sprint 113 **PR A (Belonging Truth) is IMPLEMENTED + COMMITTED + PUSHED** on
> `feature/sprint-113-belonging-truth` (commit `0c308642`) and **opened as PR #121** against `master`.
> Plan Tasks 1–6 done: BUG-025 NaN-safe governance, BUG-024/026 profile reconciliation onto the
> canonical self-summary, BUG-027 single-owner map zoom; the three SDLC gates (`/simplify`,
> `/code-review`, `/security-review`) ran on the diff (code-review caught + fixed a real wheel-scroll
> hijack from default-on zoom; security-review found nothing). Verification: frontend regression+unit
> 115/115 green, new TDD suites green, tsc clean, doc-context drift gate green.
>
> **GATED REMAINDER (human / cross-agent — NOT yet done):**
> 1. **Cross-agent review** of PR #121 — Claude authored it, so **Codex reviews** (cross-agent protocol).
> 2. **Admin merge** PR #121 → `master` (triggers the deploy).
> 3. **`/deploy`** — confirm GitHub Actions deploy success + live content matches master.
> 4. **Two-user validation** (Maria + a 2nd member, non-zero sentinels): exact reputation is self-only on
>    every surface AND profile reconciles with the community view; no `NaN`; zoom works on each map.
>    Record PASS/FAIL.
>
> **THEN PR B** branches from merged `origin/master`. PR B's FIRST commit records the validated status
> closures (ADR-082 → Implemented + BUG-024/025/026/027 fixed) — they could NOT go in the already-merged
> PR A. If validation FAILS, stop and re-open PR A instead.
>
> <details><summary>Original pre-execution status (reference)</summary>
>
> Sprint 112 PR A (ADR-082 Reputation Disclosure Boundary) is MERGED + DEPLOYED as v11.19.0 (PR #120,
> commit `bd35619f`). API contract clean (8 cross-agent rounds, no leak). Post-deploy human spot-check
> found the UI/defense-in-depth layer NOT clean → BUG-025/026/027 filed. Sprint 113 spec + plan written
> and approved; ready to execute as two ordered PRs.
> </details>

---

## Quick Start

1. Read this handoff.
2. Review the design spec:
   `docs/superpowers/specs/2026-06-25-sprint-113-belonging-truth-prominence-design.md`.
3. Open the implementation plan:
   `docs/superpowers/plans/2026-06-25-sprint-113-belonging-truth-prominence.md`.
4. Execute **PR A** on `feature/sprint-113-belonging-truth` — **the branch already exists** (created
   during planning off commit `143366ea`, which carries the spec/plan/handoff; local `master` was reset
   to `origin/master`, so it is NOT diverged). Confirm you're on it (Task 1), then run `/execute-plan`
   (uses superpowers:subagent-driven-development).
5. Branch **PR B** (`feature/sprint-113-belonging-prominence`) from merged `origin/master` only after
   PR A deploys AND the two-user validation passes. PR B's **first commit** records the validated status
   closures (ADR-082 → Implemented + BUG-024/025/026/027 fixed) — they cannot go in the already-merged PR A.

## Sprint Goal

Make the ADR-082 reputation boundary *true on the screen* (kill NaN renders, reconcile the member's own
profile/community surfaces onto one canonical self-summary, restore map zoom) and validate it — then
elevate My Network into primary nav + a prominent Home preview, with the ego-vs-community-connection
fractal made legible.

## Why this sprint (the framing decided in planning)

PR A (ADR-082) closed the boundary in the **API contract**, but the post-deploy spot-check showed the
**UI layer** still renders `NaN`, may still leak stale profile numbers, and the maps have no zoom. **You
don't make a surface prominent before you've proven it's true.** So S113 = fix the fallout + validate
(PR A), THEN ship prominence (PR B).

## The fractal metaphor (the real fix for the My-Network-vs-Community overlap)

The views are **not** redundant — they are **adjacent zoom levels of one structure**, implemented
imperfectly so the two member-graphs read as duplicates. PR B makes all **three** scales legible:
- **Scale 1 · My Network** (`ego` mode) — *you* at center, you + first-degree (travels with you).
- **Scale 2 · This Community** (`community` mode) — whole-community member topology (group scale). This is
  what the "Community" sub-tab actually shows today — NOT communities-as-nodes.
- **Scale 3 · Across Communities** (`communities` mode, already exists at `BelongingGraph.tsx:76`) —
  communities-as-nodes, "how communities connect" (the level-up). Currently not framed as such.

Today the community page surfaces #1 and #2 as look-alike sub-tabs → the perceived overlap. PR B's job is
to make the three read as one zoom continuum in nav, labels, and entry points.

## Approved Scope (two ordered PRs)

**PR A — Belonging Truth (lands + deploys + validates first):**
1. **BUG-025** — kill "trust NaN · NaN karma" in governance/stewardship (`GovernanceTab.tsx:66/80/145`
   does `Math.round(undefined)` on now-omitted ADR-082 fields). Grep ALL readers; omit-or-coarse, no `|| 0`.
2. **BUG-024/026** — `profile.tsx` `fetchKarmaData` (L323-353) reads ONLY `getMyCommunitySummary` (not
   the two legacy `getMyKarma` + `getTrustScore` calls behind the discrepancy). NOT `ProfileTab.tsx`
   (that's the community settings surface). Audit `LeftSidebar.tsx` + `/reputation/karma` self-readers.
3. **BUG-027** — zoom controls with **one owner**: mount inside `TrustGraphHEB` + default `enableZoom` on
   in `BelongingGraph`; do NOT mount in the 3 wrappers (every surface already routes through the wrapper).
4. PR A merges + deploys, then **two-user validation** runs. (Status closures land in PR B — see below.)

**PR B — Belonging Prominence + Fractal Clarity:**
5. **First:** if validation PASSED, flip **ADR-082 → Implemented** + mark BUG-024/025/026/027 fixed (can't
   go in the already-merged PR A).
6. My Network → primary nav + prominent Home preview in `UnifiedFeed.tsx` (`!isCommunity`), slot **after
   offered/suggested panels (L249), before filter chips (L251)** — Home has NO DecisionBand (BUG-015).
7. Make the **three-scale fractal** legible: My Network (ego) / This Community (member topology) / Across
   Communities (communities-as-nodes).

## Decisions Locked During Planning (2026-06-25)

- **Sprint number:** 113 (PR A already shipped as v11.19.0; fresh number for the next work).
- **Delivery:** two ordered PRs; PR A must pass two-user validation before PR B branches.
- **BUG-025 (NaN):** folded into PR A as the first task (not a pre-sprint hotfix — demo is QA, not prod).
- **My Network vs Community:** resolved as **three explicit zoom levels** (user-chosen) — My Network
  (ego) → This Community (member topology) → Across Communities (communities-as-nodes). The user's original
  "community connection graph" = the existing `communities` mode (Scale 3), distinct from the member-topology
  "Community" sub-tab people see today.
- **Plan review (2026-06-25, 5 blockers fixed):** (1) fractal corrected to three scales (the `community`
  sub-tab is member topology, not communities-as-nodes — that's the separate `communities` mode);
  (2) ADR/BUG status closures moved to PR B's first commit (can't add to a merged PR A);
  (3) Task 3 targets `profile.tsx` not `ProfileTab.tsx`, + audit `LeftSidebar`/`/reputation/karma`;
  (4) zoom has one owner (`TrustGraphHEB` + `BelongingGraph.enableZoom`), not 4 mount sites;
  (5) Home preview slot is in `UnifiedFeed.tsx` after offered/suggested, before filters — Home has no
  DecisionBand. Also reset the diverged local `master` back to `origin/master`.
- **No DB migration, no reputation-math change.** Frontend + docs only over already-shipped contracts.
- **Target version:** v11.20.0.

## Critical Implementation Notes

1. No `NaN` on a possibly-absent field — presence-guard, never `Math.round(undefined)` and never `|| 0`.
2. One canonical self-summary, but claim only what you migrate: route the member's own reputation through
   `getMyCommunitySummary`; audit `LeftSidebar`/`/reputation/karma` and migrate-or-narrow.
3. BUG-025: grep ALL frontend readers of now-identity-only governance payloads before editing.
4. Never re-add a removed field to fix the UI — a missing profile value is a contract gap to escalate.
5. Zoom has ONE owner: controls in `TrustGraphHEB`, `enableZoom` default-on in `BelongingGraph`; NOT the
   wrappers. Seed `__zoom` + stub `ResizeObserver` in tests.
6. Chrome budget: My Network nav link must not re-crowd the topbar (BUG-016/017); Home preview is the
   primary prominence surface, nav link secondary.
7. Fractal legibility is the PR B deliverable, not a label tweak — three explicit scales, and Scale 3
   (communities-as-nodes) already exists as the `communities` mode.
8. Two-user validation (non-zero sentinels) gates the ADR-082-Implemented + BUG-024/026-fixed claims.
9. No DB migration; no reputation math change.
10. Tests first (TDD); docs/context/registry feedback loop on every change.

## Carry-Forward / Out Of Scope

- Cleanup-service replacement remains deferred (load-bearing scheduled-job plumbing).
- Broader member forget/export remains open.
- Onboarding network moment remains a later UX sprint.
- Mobile-native parity is not in S113.
- **Non-blocking follow-up (from S112):** repair the quarantined reputation
  `karmaService.test.ts` `awardKarmaForCompletedMatch` suite (`describe.skip`'d; drifted while the tier
  was dormant) — re-trace the query order and restore the mock sequence.
- **Open cleanup (from S112):** dismiss `js/request-forgery` FP alerts #545 + #546 (api.ts:707/714) in
  the GitHub Security UI (the API dismissal was harness-blocked).
- Recurring CodeQL `js/request-forgery` on `apps/frontend/src/lib/api.ts` is a known browser-baseURL
  false positive; dismiss only with written PR justification.
- Remaining moderate dependency alerts are the Expo `tar` chain; keep the exact override.

## Multi-Sprint Arc

- **S110 (done):** Belonging Graph research + ADR-081 Proposed.
- **S111 (done):** Belonging Graph implementation (v11.18.0).
- **S112 PR A (done):** Reputation Disclosure Boundary / ADR-082 (v11.19.0).
- **S113 (ready):** Belonging Truth (PR A) → Belonging Prominence (PR B). Target v11.20.0.
- **Later:** onboarding network moment; broader member forget/export; mobile parity.

---

## Persistent Context

### Active Session (update on every role handoff)

- **Driving agent:** Claude (Sprint 113 planning — spec + plan + handoff written + cross-reviewed; 5 plan
  blockers fixed; ready to execute).
- **Phase:** PLANNING COMPLETE (post-review). Branch `feature/sprint-113-belonging-truth` exists at the
  planning commit `143366ea`; local `master` = `origin/master` (not diverged). Next action: execute PR A
  from the plan. PR A = BUG-025 NaN fix → BUG-024/026 profile reconciliation → BUG-027 zoom (one owner) →
  docs → SDLC gates → merge + deploy → two-user validation. PR B then opens with the status closures as
  its first commit, then nav + Home preview + three-scale fractal.
- **Key grounded findings from planning (verified against current code):**
  - BUG-025 root cause: `GovernanceTab.tsx:66` (`avg_trust_score`), `:80` (`Math.round(rh.trust_score)`),
    `:145` (`Math.round(m.trust_score) · Math.round(m.karma) karma`) — ADR-082 made eligible_members/
    role_holders identity-only → `Math.round(undefined)` = NaN. Grep other readers (`StewardRequestsAdmin.tsx`,
    `StewardshipTab.tsx`, nominee/trust-card lists).
  - BUG-024/026: the discrepancy source is `profile.tsx` `fetchKarmaData` (L323-353) calling TWO legacy
    reads — `reputationService.getMyKarma(communityId)` + `getTrustScore(user.id, communityId)`
    (L328-330). Replace with the canonical `getMyCommunitySummary` (already at `api.ts:713` →
    `GET /reputation/me/community-summary`). `ProfileTab.tsx` is the community settings surface, unrelated.
    Audit `LeftSidebar.tsx` + `/reputation/karma` self-readers too.
  - BUG-027: `TrustGraphHEB.tsx:342-354` — zoom is wired but explorer-only (`svg.on('.zoom', null)` strips
    it elsewhere), wheel-only, no buttons. ONE owner: mount `GraphZoomControls` in `TrustGraphHEB`, default
    `enableZoom` on in `BelongingGraph` (prop already threaded at L57/121). Every surface
    (dashboard `TrustNetworkWidget`, community `TrustGraphTab`) routes through `BelongingGraph` — do not
    mount controls in the wrappers (duplicate risk).
  - PR B: `/network` page already exists (`apps/frontend/src/pages/network.tsx`); nav lives in `Layout.tsx`
    (desktop `kq-topnav` L127-145; hamburger L37-56). Home feed is `Feed/UnifiedFeed.tsx` (NOT a
    DecisionBand — preview slot is L249→L251). Three scales: `ego`/`community`/`communities` modes all
    exist in `BelongingGraph` (L65-79).
- **Blockers:** none. Contributor agents never self-merge; STOP for Admin merge/deploy authorization.

> Claude and Codex share one physical working tree. One agent edits at a time. The active agent must
> commit or stash before handing over. Never edit or commit on top of another agent's uncommitted WIP.

### Multi-Agent PR Process

- Admin owns scope approval, merge authority, and deploy authorization.
- Claude owns merge-readiness recommendation; contributor agents never self-merge.
- One branch/PR per task; no direct commits to `master`.
- Copy and fill `.github/pull_request_template.md` when using `gh pr create`.
- The non-authoring agent performs cross-agent review when available.
- Do not resolve cross-agent conflicts independently; pause for reassignment.

### Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- D3 HEB renderer: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`.
- API interceptor already unwraps envelopes: callers use `res.data`, not `res.data.data`.
- JWT membership field is `communities`, not `communityMemberships`.
- Community schema is `communities.*`; auth schema is `auth.*`.
- Error contract is `{ success:false, message:string, error:string }` (ADR-074).
- `trust_edges_live` is read-only.
- Request-service owns `/requests/feed`; there is no feed-service.
- Category and `request_type` are not interchangeable.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

### Workflow Gotchas

- TDD tests start in each changed workspace's `tests/tdd/`, then promote when green.
- Root Turbo tests may cache/skip cross-workspace coverage; run focused workspace suites directly.
- Every implementation task runs `/simplify`; every sprint also runs `/code-review` and
  `/security-review`.
- Invoke `pre-commit-check` before every commit.
- Unit + regression tests must pass before push.
- Run the direct doc-context drift test after generated landing-doc changes.
- `next/router` is globally mocked in `jest.setup`; fix the global mock, not N per-file mocks.
- Do not create worktrees; this is a shared, time-sliced checkout.
- Do not make a docs-only follow-up push to `master`; every master push triggers a deploy.

### Demo / Deploy Drift Watch

`karmyq.org` and the demo have drifted from `master` before. Confirm the GitHub Actions deploy
succeeded and live content matches `master` before judging the result. Demo tester:
`maria.reyes@test.karmyq.com` / `password123`.
