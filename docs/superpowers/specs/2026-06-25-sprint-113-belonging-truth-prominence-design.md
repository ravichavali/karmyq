# Sprint 113: Belonging Truth & Prominence — Design Spec

**Date**: 2026-06-25
**Status**: Approved
**Version**: v11.19.0 → v11.20.0
**Sprint Branches**: `feature/sprint-113-belonging-truth` (PR A) → `feature/sprint-113-belonging-prominence` (PR B)

---

## Overview

Sprint 112 PR A (ADR-082) closed the reputation-disclosure boundary in the **API contract** — exact
personal reputation is self-only, and eight cross-agent review rounds confirmed no leak in any
outward response. But the post-deploy human spot-check on the demo found that the **UI / defense-in-depth
layer is not yet clean**: removing the numbers from the contract left frontend components reading
now-absent fields (`Math.round(undefined)` → `NaN`), the member's own profile may still render stale
or unreconciled reputation numbers, and the belonging/network maps have no zoom affordance. Until those
are fixed and a two-user validation passes, **BUG-024 is not confirmed fixed and ADR-082 is not
Implemented**.

This sprint does two things, in order. **PR A (Belonging Truth)** makes the ADR-082 boundary *true on
the screen*, not just in the JSON: it kills the `NaN` renders, reconciles the member's own
profile/community surfaces onto the single canonical self-summary, restores map zoom controls, and
gates on a two-user validation before promoting ADR-082 to Implemented. **PR B (Belonging Prominence)**
then elevates the member's belonging graph — adding *My Network* to primary navigation and a prominent
Home preview — and makes the **fractal metaphor legible** so *My Network* (the ego view) and the
community-connection graph (the level up) stop reading as duplicates.

### Core Principle: Prove the boundary is true before you make it prominent

You do not elevate a surface that still renders `NaN`, still leaks stale numbers, and still confuses two
zoom levels of the same structure. PR A earns the right to ship PR B by passing a two-user validation
that the boundary holds where a human actually looks.

---

## Multi-Sprint Arc

- **S110 (done):** Belonging Graph System research + ADR-081 Proposed (no deploy).
- **S111 (done):** Belonging Graph System implementation and ship (v11.18.0) — engine + explorer, modest entry points.
- **S112 PR A (done):** Reputation Disclosure Boundary / ADR-082 (v11.19.0) — API contract clean; post-deploy UI fallout filed as BUG-025/026/027.
- **S113 — this sprint:** Belonging Truth (PR A: close the UI fallout + reconcile + validate) → Belonging Prominence (PR B: My Network in nav + Home + fractal clarity). Target v11.20.0.
- **Later:** onboarding network moment; broader member forget/export; mobile-native parity.

---

## The Fractal Metaphor (the design fix behind PR B)

The IDEAS [2026-06-25] design note flagged that *My Network* and *Community* views "do almost the same
thing." They are **not** redundant — they are **adjacent zoom levels of one fractal structure**,
implemented imperfectly so the two member-graphs read as duplicates. The fix is to make all **three**
scales legible as a zoom continuum:

| Scale | View (graph `mode`) | Center | Nodes | Question it answers |
|-------|---------------------|--------|-------|---------------------|
| **1 · Ego** | **My Network** (`ego`) | *You* | You + your first-degree people | "Who am *I* connected to?" |
| **2 · Community** | **This Community** (`community`) | A community | Every member, clustered | "Who is in *this* community, and how do they connect?" |
| **3 · Across communities** | **Across Communities** (`communities`) | The platform | Communities-as-nodes (sister-links, splits) | "How does this community sit in the wider web of communities?" |

Today the community page surfaces #1 and #2 as two sub-tabs that look alike (both are member-node graphs
in the same community, [TrustGraphTab.tsx:38-64](../../../apps/frontend/src/components/community/tabs/TrustGraphTab.tsx)) → the
perceived overlap. Scale #3 (communities-as-nodes) **already exists** as the `communities` mode
([BelongingGraph.tsx:76](../../../apps/frontend/src/components/BelongingGraph.tsx)) but is not framed as the
level-up. PR B's job is to **make the three scales read as one zoom continuum**: *My Network* is
person-centric and travels with the member across communities; *This Community* is the group's member
topology; *Across Communities* is the community-of-communities. Labels, nav, and entry points should
signal which scale you are at, so no two read as the same thing.

---

## New Concepts

None. No new domain terms, no new parameters. This sprint reuses the ADR-082 canonical self-summary
(`SelfCommunityReputation`) and the S111 belonging-graph engine; it adds no schema and no
reputation math.

---

## Data Model

**No database migration.** No schema changes. PR A consumes the existing
`GET /reputation/me/community-summary` (ADR-082) self-summary; PR B reuses the existing belonging-graph
read endpoints. Reputation math, governance thresholds, vote weights, ranking, and background jobs
remain untouched.

---

## API Endpoints

**No new or modified endpoints.** Both PRs are frontend-and-docs work over contracts that already
shipped in S112 PR A:

| Method | Path | Used by | Note |
|--------|------|---------|------|
| GET | `/reputation/me/community-summary?community_id=` | PR A profile reconciliation | Already shipped (ADR-082); `reputationService.getMyCommunitySummary` in `api.ts:713`. |
| GET | belonging-graph read endpoints (S111) | PR B My Network surfaces | Already shipped; identity/structure only, no exact reputation (ADR-082 projection). |

If implementation reveals the profile genuinely needs a value the self-summary does not yet carry, that
is a **contract gap to escalate**, not a field to re-add to a cross-user endpoint — the boundary is
self-only by design.

---

## Frontend Changes

### PR A — Belonging Truth

| Component / file | Change |
|------------------|--------|
| `apps/frontend/src/components/GovernanceTab.tsx` (L66, L80, L145) | **BUG-025.** Stop rendering `Math.round(m.trust_score)` / `Math.round(m.karma)` / `Math.round(rh.trust_score)` / `avg_trust_score` — these fields are now omitted by ADR-082 → `NaN`. Render a coarse qualitative label or omit entirely; never compute from a possibly-absent numeric field. |
| All readers of `eligible_members` / `role_holders` / `maturity` reputation fields | **BUG-025 (find ALL instances).** Grep every consumer of the now-identity-only governance/stewardship payloads (e.g. `StewardRequestsAdmin.tsx`, `StewardshipTab.tsx`, any trust-card/nominee list) and apply the same omit-or-coarse rule. |
| `apps/frontend/src/pages/profile.tsx` (the `fetchKarmaData` path, L323-353) | **BUG-024/026.** The member's own community-scoped profile reputation currently reads **two** legacy sources — `reputationService.getMyKarma(communityId)` **and** `getTrustScore(user.id, communityId)` ([profile.tsx:328-330](../../../apps/frontend/src/pages/profile.tsx)) — which is the BUG-024 dual-source discrepancy (trust 120 vs 27/100; karma 40 vs 0). Route the member's own reputation through the single canonical `getMyCommunitySummary(communityId)` and delete the legacy reads. **`community/tabs/ProfileTab.tsx` is NOT the member profile** — it is the community overview/settings/providers surface; do not touch it for this. |
| Audit: `apps/frontend/src/components/LeftSidebar.tsx` + any `/reputation/karma` self-readers | **BUG-024/026 (scope honesty).** Audit other self-facing reputation readers. Either migrate active ones to `getMyCommunitySummary`, or **narrow the spec claim** so we only assert that the surfaces we actually migrated consume the summary — do not claim "Profile, Home, and My Network all consume it" unless they verifiably do. |
| `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` (L342-354) | **BUG-027 (single owner).** Zoom is currently explorer-only + wheel-only with no visible controls. The renderer is the **one** owner: mount visible **zoom-in / zoom-out / reset** controls here (calling `zoom.scaleBy` / a reset transform) and enable wheel + pinch on all modes — gated by the existing `enableZoom` prop. |
| `apps/frontend/src/components/BelongingGraph.tsx` (the single wrapper) | **BUG-027.** Every map surface already flows through `BelongingGraph` → `TrustGraphHEB`, and `enableZoom` is already threaded ([BelongingGraph.tsx:57,121](../../../apps/frontend/src/components/BelongingGraph.tsx)). Default `enableZoom` **on** here so all surfaces get controls without mounting anything in the three wrappers (avoids duplicate controls). |

### PR B — Belonging Prominence + Fractal Clarity

| Component / file | Change |
|------------------|--------|
| `apps/frontend/src/components/Layout.tsx` (desktop `kq-topnav` L127-145; hamburger L37-56) | Add **My Network** → `/network` to primary nav (desktop topnav + hamburger), with `active`-state handling like the existing links. Respect the chrome budget (see Critical Notes #6). |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` (Home render path, `!isCommunity`) | Add a **prominent My Network preview** in the Home feed. **Placement (corrected):** Home no longer contains a DecisionBand (BUG-015 moved it to Helping). The preview slot is **after the OfferedAwaiting + SuggestedAsHelper panels (L241-249) and before `FilterChipRow` (L251)** — above the request cards, below the in-flight/suggested panels. Home-only (`!isCommunity`). Links to `/network`. |
| `apps/frontend/src/pages/network.tsx`, `apps/frontend/src/components/BelongingSection.tsx` | Frame *My Network* explicitly as **Scale 1 · the ego view** (person-centric, you + first-degree, travels across communities). |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` (sub-tabs + headings) | Make the three scales legible: **My Network** (`ego`) = Scale 1; **This Community** (`community`) = Scale 2 (whole-community member topology, group scale); surface **Across Communities** (`communities` mode) = Scale 3 (communities-as-nodes, "how communities connect"). Re-label so the two member-graphs (1 & 2) no longer read as duplicates and Scale 3 is framed as the level-up. |

---

## User Guide & Doc Updates

Mandatory this sprint (every sprint ships doc updates):

- **`docs/adr/ADR-082-reputation-disclosure-boundary.md`** — add the defense-in-depth UI section (NaN-safe rendering, profile reconciliation on the canonical self-summary). Flip `Proposed/Accepted` → **Implemented** as PR B's first commit, gated on PR A's two-user validation (not in PR A — it merges before validation runs).
- **`docs/BUGS.md`** — mark BUG-024/025/026/027 fixed as PR B's first commit, **only after** two-user validation passes.
- **User guide** — update the belonging/network guide (`docs/guides/`) and the landing concept page(s) in `apps/landing/` to describe the **three-scale fractal** — *My Network* (ego) → *This Community* (member topology) → *Across Communities* (communities-as-nodes) — and the new nav/Home entry points. Wire any new page into `apps/landing/.../nav.json` (drift gate enforces wiring).
- **`apps/frontend/src/lib/onboarding/workflows.ts`** — update onboarding copy if the My Network nav/Home entry changes the authenticated workflow.
- **`services/reputation-service/CONTEXT.md`** — note the profile reconciliation now consumes only `getMyCommunitySummary`.

---

## Critical Implementation Notes

1. **No `NaN` on a possibly-absent field.** After ADR-082, governance/stewardship payloads are
   identity-only. Never `Math.round(x)` / `Number(x)` / `x.toFixed()` a reputation field that may now be
   `undefined`. Render a coarse qualitative label or omit the element — guard with an explicit presence
   check, not a `|| 0` (which would re-introduce a fake zero, the exact anti-pattern ADR-082 forbids).
2. **One canonical self-summary — but only claim what you migrate.** Route the member's own
   community-scoped reputation through `getMyCommunitySummary(communityId)`, never a second/legacy query
   (the BUG-024 discrepancy was `profile.tsx` calling `getMyKarma` **and** `getTrustScore`). Audit
   `LeftSidebar.tsx` and `/reputation/karma` self-readers; either migrate them or narrow the claim — do
   **not** assert "Profile, Home, and My Network all consume the summary" unless each verifiably does.
3. **Find ALL instances (BUG-025).** Grep the whole frontend for readers of the now-omitted governance
   reputation fields before touching anything — assume the same NaN pattern exists in more than one
   component (nominee lists, trust cards, stewardship admin).
4. **Don't re-add a removed field to fix the UI.** If profile needs a value the self-summary lacks, that
   is a contract gap to escalate — never patch it by reading a cross-user reputation field. The boundary
   is self-only by design (defense in depth: UI hiding complements the API, it does not weaken it).
5. **Zoom has ONE owner — the renderer.** Every surface flows through `BelongingGraph` → `TrustGraphHEB`,
   and `enableZoom` is already threaded. Mount the controls inside `TrustGraphHEB` and default
   `enableZoom` on in `BelongingGraph`; do **not** mount controls in the three wrappers (duplicate-control
   risk). Test representative modes. jsdom does not support `d3.zoom().transform`; seed `__zoom` directly
   and stub `ResizeObserver` in tests (see the Jest + D3 ESM memory).
6. **Chrome budget.** The topbar is already congested (BUG-016/017); adding *My Network* to `kq-topnav`
   competes for the reading-measure chrome. Verify it does not re-crowd the header at md widths — the
   Home preview is the primary prominence surface; the nav link is secondary. Compact gracefully on
   narrow viewports.
7. **Fractal legibility is the PR B deliverable, not a label tweak.** *My Network* = ego/person scale,
   travels across communities; community connections = group scale, lives in a community. The two must
   stop duplicating in nav, labels, and entry points.
8. **Two-user validation gates the truth claims.** Do not mark ADR-082 Implemented or BUG-024/026 fixed
   until a two-user check (e.g. Maria + a second member, non-zero sentinel values) confirms exact
   reputation is self-only AND profile vs community surfaces reconcile.
9. **No database migration. No reputation-math change.** Frontend + docs only over already-shipped
   contracts.
10. **All changed behavior needs tests first** (TDD) and the docs/context/registry feedback loop.

---

## Delivery Sequence

- **PR A (Belonging Truth)** ships the code fixes, merges, and **deploys first**. The two-user validation
  runs against the deployed PR A.
- **Status flips land in PR B, not PR A.** Because validation happens *after* PR A merges, you cannot add
  the ADR-082→Implemented + BUG-024/025/026/027 closure commits to an already-merged PR A (that would be a
  third PR). They are the **first commit of PR B**, gated on the validation passing.
- **PR B (Belonging Prominence)** branches from merged `origin/master` after PR A deploys; its first commit
  records the validated status closures, then it adds nav + Home preview + fractal clarity. It must not
  delay the truth fixes.
