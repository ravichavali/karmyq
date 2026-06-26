# Sprint 114 — Belonging Graph Consolidation: SPEC APPROVED, ready to plan Phase 1

> **STATUS (2026-06-26):** S113 is **DONE + DEPLOYED** (v11.20.0 — see the block below). The next
> initiative, **Belonging Graph Consolidation**, has an **approved design spec** (Claude brainstorm +
> Codex cross-review): `docs/superpowers/specs/2026-06-26-belonging-graph-consolidation-design.md`.
>
> **Make the belonging graph the platform centerpiece** — one canonical, traversable graph; profile +
> community as its two homes; `/network` as the deep explorer; retire the dashboard widget / Home card /
> community My-Network sub-tab. **3 phases:** Phase 1 (S114) = adopt `react-force-graph-2d` + consolidate
> at informational/behavioral parity + **ADR-083** (reverses S111's single-D3 decision; test strategy
> shifts DOM→canvas/state); Phase 2 (S115) = `GET /trust/explain/:targetUserId` trust-explanation view +
> hover panel + click-to-recenter traversal + hero prominence; Phase 3 (S116) = distinct directed
> fission-lineage channel + remove the Scale-1/2/3 text & tabbed modes + polish.
>
> **Branch state:** `master` = `origin/master` = `01af3f97` (clean). Branch
> `feature/sprint-114-belonging-graph-consolidation` (LOCAL, unpushed) carries the spec (`c954fbde`) +
> this handoff (`19263570`). Per "one chat per sprint", the **next chat** runs the `sprint-planning` /
> `writing-plans` skill to turn the spec into the Phase 1 implementation plan, then executes.
>
> **Open items carried in:**
> - **Post-deploy spot-check of v11.20.0 still owed** on the live demo (login `maria.reyes@test.karmyq.com`
>   / `password123`, 130 connections): My Network in nav + Home; three scales read distinct; egocentric
>   hub renders (centre-anchored, labelled, sized by membership); zoom on every map; depth readout; no NaN.
> - **Fission-lineage conflation bug** (parent→child lineage renders as organic): root-caused — the
>   backend emits BOTH an organic edge and a fission edge for a parent/child pair, and the S113 hub draws
>   them as overlapping straight lines so organic visually wins. The fix is Phase 3 (distinct directed
>   lineage channel). Documented in the spec.
> - **Deploy-verification gotcha (reference):** the PR-level "Deploy to Demo" check shows **`skipping`**
>   (deploy is gated to `push: master`, so it never runs on a PR); the **real** deploy is the
>   `Deploy to Demo` job inside the post-merge **master CI/CD Pipeline** run. Check the master run, not the
>   PR check, to confirm a deploy.
>
> ---

# Sprint 113 — Belonging Truth & Prominence: PR B MERGED + DEPLOYED ✅ (v11.20.0)

> **STATUS (2026-06-26):** Sprint 113 **PR B (Belonging Prominence + Fractal Clarity) is MERGED + DEPLOYED
> to the demo** — squash commit `01af3f97` (PR #122), **v11.20.0**. CI/CD Pipeline run `28240119997` =
> **success**, **Deploy to Demo = success** (6m38s, no rollback). Admin squash-merge (`--admin`, user-
> authorized via /deploy) bypassed the required-review gate; all CI gates were green except the
> non-blocking `@karmyq/mobile#lint` step. Codex cross-agent review: no blocking findings. Demo serving a
> fresh build (buildId `1782480275578`).
>
> **→ Sprint 113 COMPLETE** (PR A v11.19.0 + PR B v11.20.0 both deployed). Multi-sprint belonging arc
> (S110 research → S111 graph → S112 ADR-082 contract → S113 truth+prominence) is closed.
>
> **Post-deploy human spot-check still owed (do on the live demo, login `maria.reyes@test.karmyq.com` /
> `password123`):** My Network reachable from the top nav + a Home preview card; the three scales (My
> Network / This Community / Across Communities) read as distinct zoom levels; Scale 3 renders the
> egocentric hub (your communities centre-anchored, connected radiating, labelled, sized by membership);
> zoom +/−/reset works on every map; the depth readout shows "Showing N people within D hops"; no NaN.
> (`maria.reyes` has 130 connections — the rich view for exercising depth.)
>
> **This handoff update is committed to local master but NOT pushed** (no docs-only push to master — it
> would trigger a 2nd deploy → transient demo 502s). Fold it into the next sprint's first PR, or push only
> if a fresh deploy is acceptable.
>
> <details><summary>Pre-deploy PR B status (reference)</summary>
>
> Sprint 113 **PR B was IMPLEMENTED on branch `feature/sprint-113-belonging-prominence`** (Tasks 8–12
> complete through the SDLC gates) before the user authorized the admin-merge + deploy.
>
> **PR B delivered (Tasks 8–12):**
> - **Task 8a** (commit `b4570f31`): ADR-082 → Implemented (md + landing JSON), BUG-024/025/026/027 →
>   fixed in docs/BUGS.md (validated PASS evidence), + the `/network?mode=community` crash fix + test.
> - **Task 8b** (`aa2259e6`): My Network → primary nav (kq-topnav xl:flex + hamburger) + prominent Home
>   preview card in UnifiedFeed (`!isCommunity`, after offered/suggested, before filter chips). TDD.
> - **Task 9** (`68d6f1fc`): three-scale fractal legibility (Scale 1 My Network / Scale 2 This Community /
>   Scale 3 Across Communities) in the explorer + community Trust Graph sub-tabs; **Scale 3 rebuilt as the
>   egocentric hub** (`CommunityHubGraph.tsx` — your communities centre-anchored, connected radiate on a
>   labelled ring, node size = membership, organic/fission edges); depth "Showing N people within D hops"
>   readout + ego sparse state. TrustGraphHEB delegates communities mode out; dead radial branches removed.
> - **Task 10** (`f818708f`): trust-graph guide + reading-the-trust-graph concept reframed; onboarding
>   step added; **v11.20.0**; landing JSON regenerated; drift gate green.
> - **Task 11** (`a0d14afe` + `9d137233`): /simplify (extracted shared `graphZoom.ts` + `useGraphContainerWidth`
>   to de-fork the BUG-027 single-owner zoom across both renderers; small cleanups), /code-review (fixed:
>   depth readout counted expansion nodes → now counts the depth baseline; restored hub hover/focus
>   highlight honoring `focusedNodeId` so the communities search works), /security-review (no findings —
>   client-side presentational only).
>
> **Verification (2026-06-26):** frontend `tsc --noEmit` clean; frontend unit+regression **125/125 green**;
> sprint-113 tdd **9/9 green**; doc-context drift gate **5/5 green**.
>
> **Known follow-up (out of PR-B scope, noted in commit `a0d14afe`):** `getMyCommunities` is unwrapped at
> ~9 call sites with divergent fallbacks — normalize once in `api.ts` in a later PR.
>
> <details><summary>PR A status (DONE — merged, deployed, validated PASS)</summary>
>
> Sprint 113 **PR A (Belonging Truth) is MERGED + DEPLOYED to the demo** — squash
> commit `81322165` (PR #121). CI/CD Pipeline run `28192795236` = success, **Deploy to Demo = success**.
> The CodeQL gate first false-blocked the deploy on a pre-existing FP (`#547 js/remote-property-injection`
> at `requests.ts:848` — `sourceTier` is a server enum, not user input; **dismissed as false positive**),
> then the re-run deployed clean.
>
> Delivered + LIVE in PR A: BUG-025 NaN-safe governance, BUG-024/026 profile reconciliation onto the
> canonical self-summary, BUG-027 single-owner map zoom (controls in TrustGraphHEB, wheel/dblclick excluded
> so embedded graphs don't hijack page scroll). 3 regression suites: governance-no-nan,
> profile-reconciliation, graph-zoom. (Codex cross-agent review: 3 rounds, all fixed.)
>
> **TWO-USER VALIDATION: ✅ PASS (2026-06-25, Playwright against the LIVE demo).**
> - **BUG-024/026 profile reconciliation:** each user sees their OWN distinct reconciled numbers from the
>   canonical self-summary — Maria Reyes = Current Karma 27 / Reputation Score 20; Aisha White = 0 / 27
>   (27/0 is the exact ADR-082 example that used to render inconsistently — now coherent). Canonical labels
>   **Current Karma** + **Reputation Score** present on both; old "Karma Points"/"Trust Score" gone. No `NaN`.
> - **BUG-025 governance NaN:** role holder rendered "Maria Elena Reyes · admin" with NO trailing "trust
>   NaN" (the exact site the user reported); no `NaN` anywhere; no other member's trust/karma shown
>   (self-only holds — governance carries identity + role + coarse eligibility only).
> - **BUG-027 zoom:** in/out/reset controls present on the graph; clicking zoom-in drove it scale 1 → 1.2,
>   reset returned to 1 (live `__zoom` confirmed).
> - Known non-blockers seen: pre-existing profile skills double-unwrap console error (`Cannot destructure
>   'skills'`), and the `/network?mode=community` crash (fix queued for PR B, not yet deployed).
>
> **→ GREEN-LIT FOR PR B.** Branch `feature/sprint-113-belonging-prominence` from merged `origin/master`;
> first commit flips **ADR-082 → Implemented** + marks BUG-024/025/026/027 fixed, then carries the queued
> PR-B work (below + the live-demo findings section).
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
> </details>
> </details>

---

## Quick Start — PR B (PR A is DONE: merged, deployed, validated ✅)

1. Read this handoff (esp. the STATUS block above — PR A shipped + two-user validation PASSED).
2. Open the implementation plan (PR B = Tasks 8–12):
   `docs/superpowers/plans/2026-06-25-sprint-113-belonging-truth-prominence.md`. Note Task 9 was amended
   (Egocentric hub for the communities view) and a PR-B priority-0 bug line was added — see the
   "Live-demo feedback" section below.
3. **Branch PR B** `feature/sprint-113-belonging-prominence` from **merged `origin/master`** (which is at
   the PR A squash commit `81322165` + deployed). `git fetch origin && git checkout -b
   feature/sprint-113-belonging-prominence origin/master`.

### ⚠️ Working-tree state at this handoff (uncommitted — carry into PR B, do NOT redo or lose)

`git status` shows these uncommitted changes on disk, all destined for PR B (they travel onto the new
branch when you `git checkout -b` since they're working-tree):

- **`apps/frontend/src/pages/network.tsx`** + **`apps/frontend/tests/regression/sprint-113-network-community-picker.test.tsx`**
  — the `/network?mode=community` **crash fix (already written + RED→GREEN, do NOT redo)**. Fix: extract
  the array from `getMyCommunities` (`res.data?.communities ?? res.data?.data ?? res.data`, `Array.isArray`
  guard). **Commit these in PR B.**
- **`docs/superpowers/plans/2026-06-25-...-prominence.md`** — Task 9 amended (Egocentric hub) + the
  priority-0 crash/depth bug line. Already saved.
- **`.claude/handoff/CURRENT_HANDOFF.md`** — this file (PR B status). Keep on disk (it's the carrier);
  fold into PR B's branch.
- **NOT yours — leave alone:** `claude.md` (pre-existing global-rules edit) and `.claude/skills/ship/`
  (pre-existing new skill). They predate this sprint; do not stage them into PR B.

### PR B first steps (in order)

4. **First commit:** flip **ADR-082 → Implemented** (`docs/adr/ADR-082-...md` status line + landing JSON)
   and mark **BUG-024/025/026/027 fixed** in `docs/BUGS.md` (validation PASSED — see STATUS). Bundle the
   already-done network crash fix + test here too (it's the smallest, lands the crash fix fast).
5. Then execute plan Tasks 8–12: depth-legibility readout + sparse state, **Egocentric hub** communities
   view, My Network → primary nav + Home preview, docs, version → v11.20.0, SDLC gates, deploy.

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

## Live-demo feedback (2026-06-25, on the deployed S112 build) → PR B inputs

Found while the user spot-checked `karmyq.com/network` (note: PR A not yet deployed; these are
pre-existing in the explorer and land in PR B):

1. **`/network?mode=community` crashed** ("Something went wrong") — **ROOT-CAUSED + FIXED (test green),
   queued for PR B.** Console stack was `h.map is not a function`. Cause: `network.tsx` set
   `memberships` from `res.data` of `getMyCommunities`, but that payload is `{ communities: [...], count,
   total }` (an OBJECT, not an array) — `res.data ?? []` kept the object, so the community picker's
   `memberships.map` threw. The picker only renders in `mode === 'community'`, which is exactly why ego /
   communities modes didn't crash. **Fix applied (uncommitted, rides with PR B):** extract the array
   defensively (`res.data?.communities ?? res.data?.data ?? res.data`, guard `Array.isArray`). Regression
   test: `apps/frontend/tests/regression/sprint-113-network-community-picker.test.tsx` (RED→GREEN). Note a
   *separate* pre-existing profile bug seen in the same console: `Cannot destructure 'skills' of
   'e.data.data'` — a double-unwrap on the profile skills fetch; not fixed here.
2. **`/network?mode=ego` depth slider "shows no change for Maria" — DIAGNOSED (2026-06-25, demo DB): NOT
   a depth bug.** Replicated the endpoint's exact recursive query against the live DB: for
   `maria.ahmed2290` it returns 2 → 3 → 8 nodes at depth 1 → 2 → 3 (depth genuinely expands). Root cause is
   **seed-graph sparsity under the privacy scope**: after the active-membership scoping (only traverse
   communities you're an active member of, only to neighbors active in that edge's community), the median
   member has ~3–5 in-scope connections; avg in-scope direct degree = **4.59**, and 26/300 sampled members
   have **0**. Per-"Maria" in-scope degree ranges 0–130 (maria.reyes = 130, maria.ahmed2290 = 1, four
   Marias = 0). So 2→8 nodes is visually imperceptible on a big canvas → feels inert. The pruning is
   privacy-correct (e.g. ahmed2290's 2nd edge is in a community she left, rightly dropped).
   **PR B fix = legibility, not depth logic:** add a "Showing N people within {depth} hops" readout so
   depth changes are legible even when tiny, + a real sparse/empty state. (To see it work today, log in as
   `maria.reyes@test.karmyq.com` / `password123` — 130 connections.) Optional: seed denser demo trust data.
3. **Communities (`mode=communities`) presentation is busy/unclear.** Today it's a hierarchical-edge-bundling
   radial — pretty but dense. **DECISION (user, 2026-06-25): rebuild Scale 3 as an "Egocentric hub"** — your
   communities anchored together in the center; connected communities radiate outward, always labeled, node
   size = membership, edge style = organic vs fission. Legibility over prettiness. This replaces the radial
   bundle for the `communities` mode in PR B's Task 9 (Scale 3).

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

- **Driving agent:** Claude (Sprint 113 PR B execution — Tasks 8–12 implemented through the SDLC gates).
- **Phase:** PR B IMPLEMENTED, awaiting Admin merge/deploy. Branch `feature/sprint-113-belonging-prominence`
  = 6 commits off merged `origin/master` `81322165`. All Tasks 8–12 done; /simplify + /code-review +
  /security-review run (findings fixed/none). Verified green (tsc + 125/125 frontend + 9/9 tdd + drift
  gate). **Next action: open PR (fill template) → cross-agent review → Admin merge → `/deploy` → post-deploy
  human check on the demo (My Network in nav + Home; three scales read as distinct; zoom on every map; no
  NaN).** Contributor agents never self-merge.
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
