# Sprint 66: Trust Graph Visualization + Governance ADR — Design Spec

**Date**: 2026-05-25
**Status**: Approved
**Version**: v9.50.0 → v9.60.0
**Sprint Branch**: `feature/sprint-66-trust-graph-visualization`

---

## Overview

Sprint 65 built the `social_graph.trust_edges` table and backfilled 670 edges from historical matches. The data exists — users just can't see it yet. Sprint 66 makes the trust graph visible for the first time by adding a "Trust Graph" tab to every community page, rendering a live force-directed graph of member relationships using `react-force-graph-2d` (already installed).

This sprint also produces ADR-055: the architectural specification for trust-based governance. The ADR captures the design decisions (founder group, non-permanent roles, trust-gated eligibility, rotation triggers) that Sprint 67 will implement. Writing the ADR now means Sprint 67 starts with a ratified spec rather than blank-slate design.

The minimum deliverable: any active community member opens their community, clicks "Trust Graph", and sees nodes (members), edges (trust bonds), edge thickness (effective_weight), and node size (trust score). Clicking a node highlights its connections and shows a detail panel.

### Core Principle: Trust Visible, Not Just Counted

The platform has accumulated trust data for months. Visualization is the bridge from infrastructure to human understanding — making abstract graph weights tangible and social.

---

## Multi-Sprint Arc

### Sprint 65 — Trust Graph Foundation (complete ✅)
`social_graph.trust_edges`, `interaction_weights`, `community_trust_edges`, Bull queue subscriber, `GET /trust/graph/:communityId`, ADR-054.

### Sprint 66 — Trust Graph Visualization + Governance ADR (this sprint)
`TrustGraph.tsx` component, "trust" tab on community page, ADR-055 (governance architecture — doc only).

### Sprint 67 — Governance Implementation (upcoming)
Implement ADR-055: founder group initialization, role eligibility thresholds, trust-gated authority.

### Sprint 68 — Data Half-life + Demo Cleanup (upcoming)
Apply decay to `effective_weight` at read time. Demo data cleanup.

---

## New Concepts

**TrustGraph tab**: A new tab on the community detail page, visible to all active members, rendering the community's trust edge graph via force-directed layout.

**effective_weight (visualization)**: Computed server-side in Sprint 65. Edge thickness in the graph = `Math.max(1, effective_weight / 5)`. Higher = stronger recent relationship.

**node trust score**: Stored in `GraphNode.trust_score`. Node size = `Math.max(5, trust_score / 10)`. Larger = more trusted member.

---

## Data Model

No schema changes this sprint. The `social_graph.trust_edges` table from Sprint 65 is the sole data source.

**API response shape** (from `GET /trust/graph/:communityId`):
```typescript
{
  nodes: Array<{
    id: string;           // user_id
    name: string;         // display name
    trust_score: number;  // drives node size
    karma: number;        // shown in detail panel
  }>;
  edges: Array<{
    source: string;               // user_id_a
    target: string;               // user_id_b
    raw_weight: number;
    effective_weight: number;     // drives link thickness
    match_completed_count: number;
    endorsement_count: number;
    karma_given_count: number;
    event_count: number;
    last_interaction_at: string;
  }>;
}
```

---

## API Endpoints

No new endpoints. Sprint 65 endpoint is consumed:

| Method | Path | Auth | Used by |
|--------|------|------|---------|
| GET | `/api/social/trust/graph/:communityId` | JWT (active member) | `TrustGraph.tsx` |

New frontend API client method added to `socialGraphService` in `apps/frontend/src/lib/api.ts`:
```typescript
getTrustGraph: (communityId: string) =>
  socialGraphApi.get(`/trust/graph/${communityId}`),
```

---

## Frontend Changes

### New: `apps/frontend/src/components/TrustGraph.tsx`
Force-directed graph component using `react-force-graph-2d`. Follows the `NetworkGraph.tsx` pattern (dynamic import for SSR safety).

**Props**: `{ communityId: string; currentUserId: string }`

**Visual encoding**:
- Node size: `nodeVal = (n) => Math.max(5, n.trust_score / 10)`
- Node color: current user = emerald `#10b981`, others = indigo `#6366f1`
- Edge thickness: `linkWidth = (l) => Math.max(1, l.effective_weight / 5)`
- Edge color: indigo at varying opacity (`rgba(99,102,241,0.4)` default; selected connections brighten to `rgba(99,102,241,0.9)`)

**Interaction**:
- Click node → `selectedNodeId` set; `linkVisibility` filters to edges connected to that node; unconnected nodes dim to slate `#94a3b8`
- Click same node or empty canvas → deselect
- Detail panel below graph: selected node's name, trust score, karma, and interaction breakdown (matches / endorsements / karma given / events)

**Empty state**: If `edges.length === 0`, render a centered message: "No trust connections yet — complete help exchanges to build the graph."

**Loading state**: Spinner while data fetches.

### New: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
Thin wrapper around `TrustGraph`. Fetches graph data from `socialGraphService.getTrustGraph(communityId)` on mount. Passes data + `currentUserId` down to `TrustGraph`. Owns loading/error states at the tab level.

### Modified: `apps/frontend/src/pages/communities/[id].tsx`
1. Add `'trust'` to the `ValidTab` union type
2. Add `'trust'` to the `VALID_TABS` array
3. Add "Trust" tab button in the nav — visible to all `isMember` (not admin-gated)
4. Add `{activeTab === 'trust' && <TrustGraphTab communityId={communityId!} currentUserId={currentUser?.id ?? ''} />}` render block
5. No new data fetching needed — `TrustGraphTab` handles its own

---

## User Guide & Doc Updates

Every sprint ships docs. This sprint ships two doc artifacts:

1. **New user guide**: `apps/landing/src/data/docs/guides/trust-graph.json`
   Slug: `trust-graph` | Title: "Understanding Your Community's Trust Graph"
   Explains what the graph shows, how to read node size and edge thickness, how to interact with it.
   Nav section: "User Guides"

2. **New ADR**: `apps/landing/src/data/docs/concepts/adr-055-trust-governance-architecture.json`
   Slug: `adr-055-trust-governance-architecture` | ADR-055
   Full ADR content describing the trust-based governance architecture.
   Nav section: "Architecture Decisions"

3. **nav.json updates**:
   - Add trust-graph guide to "User Guides" section
   - Add ADR-055 to "Architecture Decisions" section

4. **generate-docs.ts**: Add `'adr-055-trust-governance-architecture'` to hardcoded ADR slug list

5. **social-graph-service CONTEXT.md**: Update "Consumers" to note frontend `TrustGraph.tsx`

---

## ADR-055: Trust-Based Governance Architecture

### Problem
Communities in karmyq currently have static admin/moderator roles assigned at creation and never rotated. As trust data matures (via `trust_edges`), there is an opportunity to ground governance authority in measured trust rather than legacy assignment. Static roles create oligarchic lock-in.

### Decision
Governance roles are trust-gated and non-permanent. The architecture:

**Founder Group**
- 5–6 members initialized at community creation time
- Selected by the community creator; handles admin/mod/governance bootstrapping
- Founders have full governance rights until the community's trust graph matures

**Role Eligibility**
- Roles are not permanently held — they reflect current trust
- Eligibility threshold: trust score ≥ `governance.eligibility_threshold` (community-configurable, default 50)
- Ratification: any eligible member can be nominated; a quorum of current role-holders ratifies
- A member's role becomes "eligible for reassignment" when their trust score drops below threshold

**Trust-Gated Authority**
- New communities: constrained governance rights (invite-only membership decisions, no config changes)
- Trust-mature communities (avg trust score ≥ threshold across founders): full governance rights unlock
- This prevents governance capture by communities that haven't built real trust yet

**Anti-Oligarchy**
- Non-permanent roles: anyone can rotate out when trust drops
- No founding privilege: original founders have no special protection after maturity
- Rotation is triggered by trust score drop, not time-based decay

**Governance Templates**
- Questionnaire matching (from `CommunityTrustQuestionnaire`) suggests governance models from similar communities
- Templates: "small-collective" (3-member quorum), "council" (5-member), "open-delegation" (trust-weighted voting)

### Consequences
Sprint 67 implements this spec. The `community_settings` table gets `governance.eligibility_threshold`, `governance.quorum_size`, `governance.template`. No schema changes needed this sprint — ADR-055 is a doc-only artifact.

---

## Critical Implementation Notes

1. **`react-force-graph-2d` is already installed** (`^1.29.1` in `apps/frontend/package.json`). Do NOT add it again. Follow `NetworkGraph.tsx` exactly — `const { default: FG } = await import('react-force-graph-2d')` inside a `useCallback`.

2. **SSR will crash without dynamic import**. Next.js 14 runs components server-side. `react-force-graph-2d` accesses `window` — it must be imported dynamically inside a `useEffect`/`useCallback`, never at the module level.

3. **Tab visibility**: "trust" tab shows to all `isMember` (active members), same level as "overview" and "people". Not admin-gated. Sprint 67 (governance) needs all members to see who has high trust.

4. **`ValidTab` type AND `VALID_TABS` array** in `[id].tsx` must both be updated — the URL-sync logic reads from `VALID_TABS`. Missing either breaks tab routing.

5. **`linkWidth` is a function**, not a number: `linkWidth={(link: any) => Math.max(1, link.effective_weight / 5)}`.

6. **nav.json revert bug**: After editing `apps/landing/src/data/docs/nav.json`, verify with `grep "adr-055" apps/landing/src/data/docs/nav.json` before committing. If missing, re-apply the edit.

7. **Landing page docs in .gitignore**: Always `git add -f apps/landing/src/data/docs/` after changes.

8. **ADR-055 is a doc-only artifact this sprint** — write the ADR and publish it to the landing site. Sprint 67 adds the implementation code.

9. **Empty graph state**: If `edges.length === 0`, show a helpful empty state — not a blank canvas.

10. **TrustGraphTab handles its own data fetching**. Do not add trust graph state to `useCommunityData` hook. Keep the hook focused on existing concerns.
