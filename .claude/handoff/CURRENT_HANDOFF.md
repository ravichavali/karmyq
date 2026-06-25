# Sprint 113 — Belonging Truth & Prominence: Ready to Execute

> **STATUS (2026-06-25):** Sprint 112 PR A (ADR-082 Reputation Disclosure Boundary) is MERGED +
> DEPLOYED as v11.19.0 (PR #120, commit `bd35619f`). The API contract is clean (8 cross-agent review
> rounds, no leak). The post-deploy human spot-check found the UI/defense-in-depth layer is NOT clean →
> BUG-025/026/027 filed. Sprint 113 spec + plan are written and approved; ready to execute as two
> ordered PRs.

---

## Quick Start

1. Read this handoff.
2. Review the design spec:
   `docs/superpowers/specs/2026-06-25-sprint-113-belonging-truth-prominence-design.md`.
3. Open the implementation plan:
   `docs/superpowers/plans/2026-06-25-sprint-113-belonging-truth-prominence.md`.
4. Execute **PR A** first on `feature/sprint-113-belonging-truth` (branch off `origin/master`).
   Run: `/execute-plan` (uses superpowers:subagent-driven-development).
5. Branch **PR B** (`feature/sprint-113-belonging-prominence`) from merged `origin/master` only after
   PR A deploys AND the two-user validation passes.

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

The two views are **not** redundant — they are **two zoom levels of the same structure**, implemented
imperfectly:
- **My Network** = the **ego view** — *you* at the center, your people + communities (travels with you).
- **"How we're connected"** = the **level up** — communities-as-nodes (sister-links, splits); the
  community (group) scale.

PR B's job is to make this distinction legible in nav, labels, and entry points so they stop duplicating.

## Approved Scope (two ordered PRs)

**PR A — Belonging Truth (lands + deploys + validates first):**
1. **BUG-025** — kill "trust NaN · NaN karma" in governance/stewardship (`GovernanceTab.tsx:66/80/145`
   does `Math.round(undefined)` on now-omitted ADR-082 fields). Grep ALL readers; omit-or-coarse, no `|| 0`.
2. **BUG-024/026** — profile reputation reads ONLY `getMyCommunitySummary(communityId)` so profile and
   community surfaces reconcile; remove the legacy second source behind the original discrepancy.
3. **BUG-027** — shared zoom in/out/reset + wheel/pinch on ALL map surfaces (`TrustGraphHEB.tsx` zoom is
   currently explorer-only + wheel-only + no buttons).
4. **Two-user validation**, then flip **ADR-082 → Implemented** + mark BUG-024/025/026/027 fixed.

**PR B — Belonging Prominence + Fractal Clarity:**
5. My Network → primary nav + prominent Home preview (BELOW pending decisions + urgent help — locked rule).
6. Make the ego (My Network) vs community-connection ("How we're connected") fractal legible.

## Decisions Locked During Planning (2026-06-25)

- **Sprint number:** 113 (PR A already shipped as v11.19.0; fresh number for the next work).
- **Delivery:** two ordered PRs; PR A must pass two-user validation before PR B branches.
- **BUG-025 (NaN):** folded into PR A as the first task (not a pre-sprint hotfix — demo is QA, not prod).
- **My Network vs Community:** resolved via the fractal metaphor (ego scale vs community/group scale),
  per the user: "My Network as ego view and how communities are connected as community connection graph…
  established the fractal metaphor (imperfectly)."
- **No DB migration, no reputation-math change.** Frontend + docs only over already-shipped contracts.
- **Target version:** v11.20.0.

## Critical Implementation Notes

1. No `NaN` on a possibly-absent field — presence-guard, never `Math.round(undefined)` and never `|| 0`.
2. One canonical self-summary: profile/Home/My Network read only `getMyCommunitySummary`.
3. BUG-025: grep ALL frontend readers of now-identity-only governance payloads before editing.
4. Never re-add a removed field to fix the UI — a missing profile value is a contract gap to escalate.
5. Shared `GraphZoomControls` for every surface; seed `__zoom` + stub `ResizeObserver` in tests.
6. Chrome budget: My Network nav link must not re-crowd the topbar (BUG-016/017); Home preview is the
   primary prominence surface, nav link secondary.
7. Fractal legibility is the PR B deliverable, not a label tweak.
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

- **Driving agent:** Claude (Sprint 113 planning — spec + plan + handoff written, ready to execute).
- **Phase:** PLANNING COMPLETE. Next action: execute PR A (`feature/sprint-113-belonging-truth`) from
  the plan. PR A = BUG-025 NaN fix → BUG-024/026 profile reconciliation → BUG-027 zoom → docs → SDLC
  gates → deploy → two-user validation → mark ADR-082 Implemented + bugs fixed. Then PR B.
- **Key grounded findings from planning (verified against current code):**
  - BUG-025 root cause: `GovernanceTab.tsx:66` (`avg_trust_score`), `:80` (`Math.round(rh.trust_score)`),
    `:145` (`Math.round(m.trust_score) · Math.round(m.karma) karma`) — ADR-082 made eligible_members/
    role_holders identity-only → `Math.round(undefined)` = NaN. Grep other readers (`StewardRequestsAdmin.tsx`,
    `StewardshipTab.tsx`, nominee/trust-card lists).
  - BUG-024/026: canonical self-summary already exists — `reputationService.getMyCommunitySummary` at
    `apps/frontend/src/lib/api.ts:713` → `GET /reputation/me/community-summary` (ADR-082). Profile must
    consume only this.
  - BUG-027: `TrustGraphHEB.tsx:342-354` — zoom is wired but explorer-only (`svg.on('.zoom', null)` strips
    it elsewhere), wheel-only, no visible buttons. Need shared `GraphZoomControls` + enable on all modes/
    surfaces (BelongingGraph, dashboard TrustNetworkWidget, community TrustGraphTab).
  - PR B: `/network` page already exists (`apps/frontend/src/pages/network.tsx`); nav lives in
    `Layout.tsx` (desktop `kq-topnav` L127-145 = Communities + Service Providers; hamburger L37-56). Home
    is `dashboard.tsx`.
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
