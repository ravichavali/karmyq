# Sprint 115 — Belonging Graph Earned Structure: IMPLEMENTED (all 9 tasks), gates green, awaiting PR review/merge

> **STATUS (2026-06-28):** Sprint 115 is **fully implemented on branch
> `agent/codex/sprint-115-belonging-presentation`** (all 9 plan tasks). Codex did Tasks 1–3; Claude
> picked up and completed Tasks 4–9. **Awaiting: open PR → cross-agent review → Admin merge → deploy →
> human validation.** Contributor agents do not self-merge or deploy.
>
> **Commits (origin/master..HEAD):** `72cd9d4f` T1 neutral full-community selection · `818f44c6`/`9f06d95f`
> T2 shared encoding + community geometry · `ed79c2eb`/`e03f1198` T3 CommunityRingGraph · `0bbfbfe2` T4
> egoOrbitModel · `a9268d8b` T5 EgoOrbitGraph (+ promoted suites) · `80807a41` T6 contextual dispatch +
> profile/network/community integration · `15ff866d` T7 HEB fission-only + migrated regressions +
> structural-truth fixtures · `27564948` T8 ADR-083 + docs rewrite + CONTEXT/registry + **v11.22.0** ·
> `f783548d` T9 review-findings fix.
>
> **What shipped:** one wrapper (`BelongingGraph`) + canonical model + shared `graphVisualEncoding`,
> dispatching to purpose-built deterministic renderers — `EgoOrbitGraph` (BFS orbits, stable across
> expand/collapse), `CommunityRingGraph` (one ring + direct chords, incomplete `N of M`), unchanged
> `CommunityHubGraph` (communities) and `TrustGraphHEB` (now **fission-only**, `mode: 'fission'`). The
> full-community endpoint now selects neutrally (name+ID, never trust score), unions the caller, and
> returns `meta: { totalActiveMembers, truncated }`. ADR-083 records the decision (partially supersedes
> ADR-063/081); guide + concept rewritten off the cluster/bundle model.
>
> **Gates (all green unless noted):** frontend `tsc` clean; social-graph `tsc` clean; frontend
> unit+regression **191/191**; social-graph regression **54 pass** (3 todo); doc-context drift gate
> **5/5**; `npm run build` **12/12**; `npm audit --audit-level=high` passes (1 **moderate** node-tar
> advisory GHSA-vmf3-w455-68vh — below the high blocking threshold; within the 2-week SLA, fixable via
> `npm audit fix` in a separate dep PR). `analyze:services` produced no diff (only an endpoint
> *description* changed). **Pre-existing, NOT introduced here:** `npm run lint` fails on
> `src/utils/admin-auth.ts:69,81` (`no-explicit-any`) — that file is byte-identical to `origin/master`
> and `next build` tolerates it; out of Sprint 115 scope.
>
> **SDLC review (done by Claude as implementer):** `/code-review` found one real bug — the profile's
> single-replaceable expansion could show the **wrong** node when two click-fetches resolved out of order
> (no stale-response guard, unlike `/network`'s `modeRef`); **fixed** in `f783548d` with a
> `pendingExpandRef` guard + RED→GREEN regression test. `/security-review` **clean** (full-community SQL
> is parameterized; live-membership auth gate unchanged; ADR-082 redact→project pipeline holds — `meta`
> is two integers; no unsafe DOM/SVG/URL sinks). `/simplify` extracted the duplicated `relationshipSummary`
> into `graphVisualEncoding`.
>
> **REMAINING — human validation (post-merge, needs running app / live demo; Admin authorizes deploy):**
> 1. **150-member density** (plan T9 Step 3): load deterministic sparse + high-edge 150-member fixtures in
>    a dev harness / the renderer regression fixture (do NOT commit a production route); record initial
>    model/render + focus-update durations and confirm focus reuses every path string and does NOT
>    re-invoke the pure model; no crash/NaN/Infinity/duplicate-zoom; desktop + mobile, `prefers-reduced-motion`
>    off and on.
> 2. **Real surfaces** (plan T9 Step 4) with a rich (`maria.reyes`) and a sparse demo account: profile,
>    community Trust Graph, `/network` — stable reload coordinates; one replaceable profile expansion with
>    retry retaining the old graph; three FIFO explorer expansions + collapse; community focus without
>    layout movement; complete vs truncated copy; full keyboard reach + visible focus + titles; no person
>    reputation/cluster/endorsement claim; unchanged Across-Communities + fission admin.
>
> **Cross-agent review:** Codex authored the plan + Tasks 1–3; Claude implemented Tasks 4–9. Per the
> cross-agent protocol, **Codex should review this branch/PR** before Admin merge.
>
> **Locked product decisions (delivered):** deterministic BFS orbits; one community ring with direct softly
> curved chords; constant at-rest width; qualitative intensity; amber caller / teal focused edges; no
> inferred clusters, bundles, health score, or reputation display.
>
> **Deferred intentionally (future sprints):** Sprint 116 named connection corridor + offer context;
> public profiles until an API-enforced visibility contract exists; temporal fission/fusion lineage; a
> separate landing CTA sprint making “Try the live demo” (`karmyq.com`) the primary header/home action.
> Do not mix those into Sprint 115.

## Historical Sprint 113 handoff

> **STATUS (2026-06-26):** Sprint 113 **PR B (Belonging Prominence + Fractal Clarity) is IMPLEMENTED on
> branch `feature/sprint-113-belonging-prominence`** (6 commits off merged `origin/master` `81322165`),
> all plan Tasks 8–12 complete through the SDLC gates. **Awaiting: open PR → cross-agent review → Admin
> merge → deploy.** (Contributor agents never self-merge — stopping here for Admin authorization.)
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

---

## Historical Quick Start — Sprint 113 PR B

1. Read this handoff (esp. the STATUS block above — PR A shipped + two-user validation PASSED).
2. Open the implementation plan (PR B = Tasks 8–12):
   `docs/superpowers/plans/2026-06-25-sprint-113-belonging-truth-prominence.md`. Note Task 9 was amended
   (Egocentric hub for the communities view) and a PR-B priority-0 bug line was added — see the
   "Live-demo feedback" section below.
3. **Branch PR B** `feature/sprint-113-belonging-prominence` from **merged `origin/master`** (which is at
   the PR A squash commit `81322165` + deployed). `git fetch origin && git checkout -b
   feature/sprint-113-belonging-prominence origin/master`.

### Historical working-tree state at the Sprint 113 handoff

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

### Historical Sprint 113 PR B first steps

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
- **Sprint 116:** named person-to-person connection corridor and offer integration. Rank shortest paths
  first, then choose the strongest complete equal-hop corridor; name mutuals and say “clearest connection,”
  never recommendation or transferred trust.
- **Landing CTA follow-up (separate PR/sprint):** header/home primary “Try the live demo” → `karmyq.com`;
  Founding Circle becomes normal/secondary navigation; How It Works closes on demo, Research remains
  Founding Circle, and the home ending offers both.
- **Later:** public profiles only after API-enforced visibility; temporal fission/fusion only after durable
  event/history design.

## Multi-Sprint Arc

- **S110 (done):** Belonging Graph research + ADR-081 Proposed.
- **S111 (done):** Belonging Graph implementation (v11.18.0).
- **S112 PR A (done):** Reputation Disclosure Boundary / ADR-082 (v11.19.0).
- **S113 (done):** Belonging Truth + Prominence (v11.20.0).
- **S114 (reverted):** force-directed belonging renderer (released/reverted before a tag).
- **S115 (planned/approved):** Earned Structure ego orbit + direct community ring + neutral complete-data
  contract (target v11.22.0).
- **S116 (next):** Named Connection Corridor + offer context.
- **Later:** onboarding network moment; broader member forget/export; mobile parity.

---

## Persistent Context

### Active Session (update on every role handoff)

- **Driving agent:** Codex (Sprint 115 design + implementation planning complete).
- **Phase:** APPROVED DESIGN / PLAN READY. Branch `agent/codex/sprint-115-belonging-presentation`.
  `origin/master` is the base; local-only stale handoff commits on local `master` were deliberately not
  included. The plan has nine independently testable tasks and starts with the neutral full-community API
  correction before visual work.
- **Verification:** `npm run feedback:check` passes; root `npm test` passes all 26 Turbo tasks. Known
  pre-existing warnings only: Jest open handles, obsolete Next `swcMinify`, and landing `<img>` lint.
- **Key grounded findings:**
  - ADR-082 outward person links expose four relationship states, while canonical client `decayTier` also
    admits defensive `swept`; visual encoding tests all five plus unknown.
  - `mergeGraphData` preserves response-supplied degrees, but ego geometry must ignore them and run BFS
    from `currentUserId` after every merge.
  - Sprint 111/113 regressions directly mount HEB for ego/community; migrate their shared contracts to
    `EgoOrbitGraph`/`CommunityRingGraph`, retain HEB fission assertions, and update the consolidation guard.
  - Full-community selection is currently hidden-trust-ranked (`top 149 UNION caller`) with no completeness
    metadata; Task 1 fixes this without widening the ADR-082 disclosure boundary.
- **Blockers:** none. Next agent must select inline vs explicitly authorized subagent-driven execution,
  read the execution skill, and begin Task 1. Contributor agents never self-merge.

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
