# Belonging Graph System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one coherent belonging-graph system with a privacy-scoped ego explorer, full-community
and inter-community views, raised profile prominence, and no dead graph dependencies.

**Architecture:** `TrustGraphHEB` remains the only renderer. A canonical `GraphData` model and
`BelongingGraph` wrapper normalize/fetch all four modes; `/network` owns explorer-only state.
`social-graph-service` adds one read-only, shared-community-scoped recursive neighborhood endpoint.

**Tech Stack:** Node.js/Express/TypeScript, Next.js Pages Router, React 19, D3 7, PostgreSQL 15, Jest.

## Global Constraints

- Sprint branch: `feature/sprint-111-belonging-graph-system`.
- Version target: `v11.17.0 -> v11.18.0`.
- ADR-081 moves `Proposed -> Implemented` only after the feature is verified.
- No database migration, nginx change, deploy-script change, or backend redesign.
- `TrustGraphHEB` is the only graph renderer; D3 is the only graph dependency.
- Preserve `socialGraphService`, `socialGraphClient`, `useLazyGraphData`, and `useTrustPath`.
- `/network?mode=community&id=...` means the full community graph from
  `getFullCommunityGraph`, exactly like `TrustGraphTab`.
- Progressive expansion and the depth slider exist only in `/network?mode=ego`.
- Neighborhood visibility is deterministic: shared active community (or explicit shared community),
  active members only, inaccessible center `404`, maximum 80 nodes.
- Every neighborhood node returns `degrees_of_separation: 0 | 1 | 2 | 3`.
- Update the existing trust-graph guide/concept; do not create duplicate graph documentation.
- Update the existing cross-platform lock in place; never scratch-regenerate it on Windows.
- Run `/simplify` after every implementation task before its commit.
- Before every commit, invoke the project `pre-commit-check` skill; never bypass hooks.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `apps/frontend/src/components/graphs/types.ts` | Canonical graph types and mode union. |
| `apps/frontend/src/components/graphs/normalizeGraphData.ts` | Pure community-depth normalization and graph merge helpers. |
| `apps/frontend/src/components/BelongingGraph.tsx` | Fetch/normalize/render wrapper for all graph modes. |
| `apps/frontend/src/components/BelongingPulse.tsx` | Exact singular/plural connection/community summary. |
| `apps/frontend/src/components/BelongingSection.tsx` | Raised profile belonging section. |
| `apps/frontend/src/pages/network.tsx` | Full-page explorer and ego expansion state. |
| `services/social-graph-service/tests/tdd/sprint-111-neighborhood.test.ts` | Recursive depth/scope/cap contract. |
| `apps/frontend/tests/tdd/sprint-111-graph-foundation.test.tsx` | Canonical model and wrapper red tests. |
| `apps/frontend/tests/tdd/sprint-111-graph-interaction.test.tsx` | HEB focus, keyboard, tooltip, zoom red tests. |
| `apps/frontend/tests/tdd/sprint-111-network-expand.test.tsx` | Explorer query-state and FIFO expansion red tests. |
| `apps/frontend/tests/tdd/sprint-111-belonging-surfaces.test.tsx` | Dashboard/community/fission/profile migration red tests. |
| `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts` | Dead wrappers/dependencies and route guardrail. |

### Existing files to modify

| File | Change |
|---|---|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | Add recursive neighborhood query/types. |
| `services/social-graph-service/src/routes/trustGraph.ts` | Add validated `/neighborhood/:userId`. |
| `services/social-graph-service/CONTEXT.md` | Document endpoint, visibility, cap, and BFS depth. |
| `services/registry.json` | Register the endpoint. |
| `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` | Canonical types, communities mode, keyed transitions, focus, keyboard, zoom. |
| `apps/frontend/src/hooks/useLazyGraphData.ts` | Support explicit immediate loading without losing lazy card behavior. |
| `apps/frontend/src/lib/api.ts` | Add typed `getNeighborhood`. |
| `apps/frontend/src/components/dashboard/TrustNetworkWidget.tsx` | Use `BelongingGraph`. |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Use `BelongingGraph` and remove local types/fetch state. |
| `apps/frontend/src/components/community/tabs/FissionTab.tsx` | Use `BelongingGraph` with supplied data. |
| `apps/frontend/src/pages/profile.tsx` | Replace reused dashboard widget with `BelongingSection`. |
| `apps/frontend/package.json` | Remove dead graph dependencies only. |
| `package.json`, `package-lock.json` | Root release version and in-place dependency lock update. |
| `apps/frontend/CONTEXT.md` | Document the unified graph system and route semantics. |
| `docs/guides/trust-graph.md` | Explain explorer interactions and modes. |
| `docs/concepts/reading-the-trust-graph.md` | Explain the unified visual language. |
| `docs/adr/ADR-081-belonging-graph-system.md` | Mark Implemented and reconcile final semantics. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Track execution, verification, PR, and deploy. |

### Files to delete

| File | Reason |
|---|---|
| `apps/frontend/src/components/NetworkGraph.tsx` | Replaced by `BelongingGraph mode="ego"`. |
| `apps/frontend/src/components/TrustGraph.tsx` | Replaced by `BelongingGraph` with supplied/fetched data. |
| `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx` | Folded into HEB communities mode. |
| `apps/frontend/src/types/react-cytoscapejs.d.ts` | Dead shim for removed dependency. |

---

## ⚠️ Critical Implementation Notes

1. **Community explorer semantics are full-community.** Use
   `socialGraphService.getFullCommunityGraph(communityId)`. Do not call the neighborhood endpoint for
   the community baseline and do not show a depth slider there.
2. **Expansion is ego-only.** Community and communities modes are searchable/zoomable but node
   activation retains detail selection; only ego mode fetches/merges neighborhoods.
3. **Per-node BFS depth is contractual.** The center is `0`; every other returned node is its
   shortest depth `1..requestedDepth`.
4. **Privacy before traversal.** Resolve allowed shared active communities first. A center outside
   that set is `404`; never traverse arbitrary platform users.
5. **Use `trust_edges_live` read-only.** Never write to the view.
6. **Keep graph totals honest.** Profile copy is “connected to,” not “helped”; count unique nodes
   excluding the current user.
7. **Do not double-fetch.** `BelongingSection` gets node count from `BelongingGraph.onDataLoaded`.
8. **Preserve lazy cards.** Dashboard/profile card-like surfaces stay IntersectionObserver-backed;
   `/network` uses immediate loading.
9. **No destructive SVG redraw for explorer updates.** Use keyed joins/transitions. Cleanup may remove
   the renderer-owned root group on unmount, but not `svg.selectAll('*').remove()` on every update.
10. **Uniform people-node radius remains ADR-063.** Community `member_count` appears in detail text;
    it does not change node radius.
11. **Lockfile safety.** Use workspace-scoped uninstall against the existing lock; do not delete it.
12. **Generated landing docs are outputs.** Update markdown sources/generator inputs, run
    `npm --workspace apps/landing run generate-docs`, then force-add generated docs if ignored.

---

## Task 1: Create Branch And Capture Baseline

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Consumes: clean `master` at `ce62c609`, v11.17.0.
- Produces: owned sprint branch and baseline evidence for the PR body.

- [ ] Verify `master` is clean and current, then branch from `origin/master`.

```powershell
git status --short
git fetch origin
git checkout master
git pull --ff-only origin master
git checkout -b feature/sprint-111-belonging-graph-system origin/master
```

Expected: clean tree before applying the committed planning artifacts. If the artifacts are still
uncommitted in the shared tree, commit them before switching roles; never branch on another agent's WIP.

- [ ] Capture baseline focused tests and dependency state.

```powershell
npm --workspace apps/frontend run test:unit -- --runInBand
npm --workspace @karmyq/social-graph-service run test:unit -- --runInBand
npm ls cytoscape react-cytoscapejs react-force-graph-2d
Test-Path apps/frontend/src/pages/network.tsx
```

Expected: tests pass; dependency tree contains the three dead libraries; `Test-Path` is `False`.

- [ ] Update the handoff Active Session stanza to the Sprint 111 branch and implementing agent.

- [ ] Invoke `pre-commit-check`, then commit.

```powershell
git add .claude/handoff/CURRENT_HANDOFF.md
git commit -m "docs: start Sprint 111 belonging graph implementation"
```

---

## Task 2: Write Neighborhood Contract Tests First

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-111-neighborhood.test.ts`

**Interfaces:**
- Consumes: mocked `pool.query`.
- Produces: executable contract for `getTrustNeighborhood` and route validation.

- [ ] Write failing database-helper tests for:
  - center depth `0`;
  - shortest discovered node depth `1..3`;
  - allowed-community parameters in every recursive query;
  - active-member filtering;
  - duplicate-node/edge collapse;
  - 80-node cap and `truncated=true`.

Use this result shape:

```typescript
expect(result).toEqual({
  nodes: expect.arrayContaining([
    expect.objectContaining({ id: 'center', degrees_of_separation: 0 }),
    expect.objectContaining({ id: 'peer-1', degrees_of_separation: 1 }),
  ]),
  links: expect.any(Array),
  meta: { depth: 2, truncated: false },
})
```

- [ ] Write failing route tests by exporting pure helpers:

```typescript
expect(parseNeighborhoodDepth(undefined)).toBe(1)
expect(parseNeighborhoodDepth('3')).toBe(3)
expect(() => parseNeighborhoodDepth('0')).toThrow('depth must be between 1 and 3')
```

Also assert explicit-community scope requires caller and center membership, aggregate scope resolves
shared active communities, and inaccessible centers map to `404`.

- [ ] Run the red test.

```powershell
npm --workspace @karmyq/social-graph-service run test:tdd -- --runInBand sprint-111-neighborhood.test.ts
```

Expected: FAIL because `getTrustNeighborhood`/validation helpers do not exist.

- [ ] Invoke `/simplify` on the test design, invoke `pre-commit-check`, then commit the red test.

```powershell
git add services/social-graph-service/tests/tdd/sprint-111-neighborhood.test.ts
git commit -m "test: define privacy-scoped neighborhood contract"
```

---

## Task 3: Implement The Privacy-Scoped Neighborhood Endpoint

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`
- Modify: `services/social-graph-service/src/routes/trustGraph.ts`

**Interfaces:**
- Produces:

```typescript
export type NeighborhoodDepth = 1 | 2 | 3
export interface NeighborhoodNode extends TrustNode {
  degrees_of_separation: 0 | 1 | 2 | 3
}
export async function getTrustNeighborhood(
  centerUserId: string,
  allowedCommunityIds: string[],
  depth: NeighborhoodDepth,
  maxNodes?: number
): Promise<{ nodes: NeighborhoodNode[]; links: TrustLink[]; meta: { depth: NeighborhoodDepth; truncated: boolean } }>
```

- [ ] Add `resolveNeighborhoodScope(callingUserId, centerUserId, communityId?)` in
  `trustGraph.ts`. For explicit community, query both active memberships. For aggregate scope, query:

```sql
SELECT DISTINCT caller.community_id
FROM communities.members caller
JOIN communities.members center
  ON center.community_id = caller.community_id
WHERE caller.user_id = $1::uuid
  AND center.user_id = $2::uuid
  AND caller.status = 'active'
  AND center.status = 'active'
```

Return no scope as `null`; the route returns `404`.

- [ ] Add `parseNeighborhoodDepth` and UUID/required-user validation. Use the ADR-074 error shape:

```typescript
return res.status(400).json({
  success: false,
  message: 'depth must be between 1 and 3',
  error: 'INVALID_DEPTH',
})
```

- [ ] Implement the recursive CTE in `trustEdgeDb.ts`. The traversal must:
  - seed center at depth 0;
  - walk either endpoint of `trust_edges_live`;
  - constrain `community_id = ANY($2::uuid[])`;
  - join active memberships in the traversed edge's community;
  - stop at `$3`;
  - select the minimum depth per user;
  - fetch at most `maxNodes + 1` to derive truncation;
  - fetch only links whose endpoints are in the retained node set.

- [ ] Map numeric fields and mark only the authenticated caller as `isCurrentUser`.

- [ ] Register before generic parameter routes:

```typescript
router.get('/neighborhood/:userId', async (req, res) => {
  // auth already applied at app.use('/trust', ...)
})
```

- [ ] Run focused tests and type check.

```powershell
npm --workspace @karmyq/social-graph-service run test:tdd -- --runInBand sprint-111-neighborhood.test.ts
npx tsc --noEmit -p services/social-graph-service/tsconfig.json
```

Expected: PASS.

- [ ] Promote the green TDD test to regression, run `/simplify`, invoke `pre-commit-check`, commit.

```powershell
Move-Item services/social-graph-service/tests/tdd/sprint-111-neighborhood.test.ts services/social-graph-service/tests/regression/sprint-111-neighborhood.test.ts
git add services/social-graph-service/src services/social-graph-service/tests
git commit -m "feat: add scoped trust neighborhood endpoint"
```

---

## Task 4: Write Canonical Frontend Graph Foundation Tests First

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-111-graph-foundation.test.tsx`

**Interfaces:**
- Defines expected exports from `types.ts`, `normalizeGraphData.ts`, and `BelongingGraph.tsx`.

- [ ] Write red normalization assertions:

```typescript
expect(normalizeCommunityDepthGraph({
  nodes: [{ id: 'c1', name: 'One', member_count: 12, status: 'active', is_member: true }],
  links: [{ source: 'c1', target: 'c2', weight: 3, type: 'organic' }],
})).toEqual({
  nodes: [expect.objectContaining({
    id: 'c1', trust_score: 0, karma: 0, member_count: 12, status: 'active', is_member: true,
  })],
  links: [{ source: 'c1', target: 'c2', raw_weight: 3, effective_weight: 3, type: 'organic' }],
})
```

- [ ] Test `mergeGraphData` de-duplicates nodes by id, links by normalized endpoint/type key, preserves
  the minimum `degrees_of_separation`, and does not mutate inputs.

- [ ] Mock `socialGraphService` and `TrustGraphHEB`; assert:
  - ego calls `getTrustGraphAggregate`;
  - community calls `getFullCommunityGraph(communityId)`;
  - communities calls `getCommunityGraph` then normalizes;
  - supplied fission `graphData` causes no fetch;
  - `load="immediate"` does not wait for intersection;
  - `onDataLoaded` receives the canonical payload once.

- [ ] Run red.

```powershell
npm --workspace apps/frontend run test:tdd -- --runInBand sprint-111-graph-foundation.test.tsx
```

Expected: FAIL on missing modules.

- [ ] Run `/simplify`, invoke `pre-commit-check`, commit red tests.

---

## Task 5: Implement Canonical Types, Normalization, And Wrapper

**Files:**
- Create: `apps/frontend/src/components/graphs/types.ts`
- Create: `apps/frontend/src/components/graphs/normalizeGraphData.ts`
- Create: `apps/frontend/src/components/BelongingGraph.tsx`
- Modify: `apps/frontend/src/hooks/useLazyGraphData.ts`
- Modify: `apps/frontend/src/lib/api.ts`

**Interfaces:**
- Use the exact `BelongingMode`, `TrustNode`, `TrustLink`, and `GraphData` types from the approved spec.
- Add:

```typescript
getNeighborhood: (
  userId: string,
  options: { depth: 1 | 2 | 3; communityId?: string }
) => socialGraphApi.get(`/trust/neighborhood/${encodeURIComponent(userId)}`, {
  params: { depth: options.depth, communityId: options.communityId },
})
```

- [ ] Extend `useLazyGraphData(fetcher, { immediate?: boolean } = {})`; initialize observation from
  `immediate` and do not create an IntersectionObserver in immediate mode.

- [ ] Implement pure normalizers and merger. Link keys must retain parallel semantic link types:

```typescript
const linkKey = (link: TrustLink) =>
  `${[link.source, link.target].sort().join('::')}::${link.type ?? 'trust'}`
```

- [ ] Implement `BelongingGraph` with a stable `useCallback` fetcher, missing-community finite state,
  canonical loading/error copy, and dynamic client-only `TrustGraphHEB`.

- [ ] Run the focused test and frontend type check.

```powershell
npm --workspace apps/frontend run test:tdd -- --runInBand sprint-111-graph-foundation.test.tsx
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

- [ ] Promote the test, run `/simplify`, invoke `pre-commit-check`, commit.

---

## Task 6: Write HEB Interaction Tests First

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-111-graph-interaction.test.tsx`

**Interfaces:**
- Consumes canonical `GraphData`.
- Defines accessible/interaction contract for `TrustGraphHEB`.

- [ ] Mock `ResizeObserver` and render a three-node graph. Assert:
  - node groups expose `role="button"`, `tabindex="0"`, and full-name accessible labels;
  - `<title>` contains the complete node name;
  - mouseenter/focus fades unrelated nodes/paths and mouseleave/blur restores opacity;
  - Enter and Space call `onNodeActivate(id)`;
  - `enableZoom=false` attaches no zoom behavior and `true` does;
  - communities mode keeps uniform radius and exposes member count/status in detail.

- [ ] Add a regression assertion that updates do not call a blanket `selectAll('*').remove()`.

- [ ] Run red, simplify test design, invoke `pre-commit-check`, commit.

---

## Task 7: Extend The Single HEB Renderer

**Files:**
- Modify: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`

**Interfaces:**
- Consume canonical types.
- Extend mode to `BelongingMode`.
- Add props:

```typescript
focusedNodeId?: string
onNodeActivate?: (nodeId: string) => void
enableZoom?: boolean
```

- [ ] Replace local graph interfaces with imports from `./types`.

- [ ] Add communities semantics:
  - emerald ring for `is_member`;
  - organic solid slate and fission dashed violet edges;
  - member count/status/member flag in detail;
  - uniform node radius.

- [ ] Refactor drawing into stable renderer-owned layers (`edges`, `nodes`, `labels`) and keyed joins.
  Transition transform/path/opacity for 400ms on graph changes.

- [ ] Add adjacency maps once per render. Hover/focus/focusedNodeId retains connected topology and
  fades unrelated topology to `0.15`.

- [ ] Add keyboard activation and native titles. When `onNodeActivate` is absent, preserve current
  select/detail behavior.

- [ ] Add optional D3 zoom to the root graph group, with scale extent `[0.5, 4]`, and remove the zoom
  listener in effect cleanup.

- [ ] Run focused interaction/foundation tests and type check; promote green tests.

```powershell
npm --workspace apps/frontend run test:tdd -- --runInBand sprint-111-graph-interaction.test.tsx
npm --workspace apps/frontend run test:regression -- --runInBand sprint-111-graph-foundation.test.tsx
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

- [ ] Run `/simplify`, invoke `pre-commit-check`, commit.

---

## Task 8: Write Network Explorer Tests First

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-111-network-expand.test.tsx`

**Interfaces:**
- Defines `/network` query parsing, baseline fetches, search, and ego expansion state.

- [ ] Mock `next/router`, `Layout`, `BelongingGraph`, and API clients. Assert:
  - absent/invalid mode resolves to ego and normalizes URL;
  - ego baseline calls `getNeighborhood(user.id, { depth })`;
  - community mode calls `getFullCommunityGraph(id)`, shows picker, hides depth, and passes no expansion callback;
  - communities mode calls `getCommunityGraph`, hides depth, and passes no expansion callback;
  - search only matches loaded nodes and sets `focusedNodeId`;
  - expanding three nodes retains all three; the fourth evicts the first;
  - collapse recomputes from baseline plus remaining expansions;
  - failed expansion leaves current graph intact and shows a recoverable message;
  - malformed/missing localStorage user redirects to `/login`.

- [ ] Run red, simplify test design, invoke `pre-commit-check`, commit.

---

## Task 9: Build The Full-Page Network Explorer

**Files:**
- Create: `apps/frontend/src/pages/network.tsx`

**Interfaces:**
- Query: `mode=ego|community|communities`, `id=<communityId>`.
- Ego depth local state: `1 | 2 | 3`, default `1`.

- [ ] Implement guarded client auth bootstrap using the existing try/catch localStorage pattern.

- [ ] Load memberships once with `communityService.getMyCommunities(user.id)` for the picker.

- [ ] Implement mode baselines exactly:

```typescript
ego        -> socialGraphService.getNeighborhood(user.id, { depth })
community  -> socialGraphService.getFullCommunityGraph(selectedCommunityId)
communities-> socialGraphService.getCommunityGraph() + normalizeCommunityDepthGraph(...)
```

- [ ] Implement expansion map:

```typescript
type Expansion = { nodeId: string; data: GraphData }
const MAX_EXPANSIONS = 3
```

On ego activation, fetch depth 1 without `communityId`; update existing entry in place or append,
then `slice(-MAX_EXPANSIONS)`. Derive `mergedGraph` from baseline plus ordered expansions.

- [ ] Render warm full-page controls, exact finite states, loaded-node search suggestions, truncation
  notice, visible expansion chips with “Collapse {name}”, and `BelongingGraph` with `enableZoom`.

- [ ] Run explorer tests and frontend type check; promote green tests.

- [ ] Run `/simplify`, invoke `pre-commit-check`, commit.

---

## Task 10: Write Surface Migration And Profile Tests First

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-111-belonging-surfaces.test.tsx`
- Create: `apps/frontend/tests/regression/belonging-graph-consolidation.test.ts`

**Interfaces:**
- Defines caller migration and profile pulse behavior.

- [ ] Assert dashboard renders `BelongingGraph` in ego/communities modes and keeps `/network`.

- [ ] Assert `TrustGraphTab` renders community and ego modes with `communityId`; community mode must
  ultimately call `getFullCommunityGraph`, not neighborhood.

- [ ] Assert fission passes supplied graph data/group controls without fetching in the wrapper.

- [ ] Assert profile section:
  - heading “How you're woven into Karmyq”;
  - graph height `480`;
  - pulse excludes current user;
  - exact singular/plural copy;
  - membership failure falls back to graph-only copy rather than hiding the section;
  - explorer link is `/network?mode=ego`.

- [ ] Regression-test source/manifest invariants: old wrappers absent, `/network.tsx` exists, dead
  dependencies absent, `react-cytoscapejs.d.ts` absent.

- [ ] Run red, simplify, invoke `pre-commit-check`, commit.

---

## Task 11: Migrate All Callers, Raise Profile Altitude, Remove Dead Libraries

**Files:**
- Create: `apps/frontend/src/components/BelongingPulse.tsx`
- Create: `apps/frontend/src/components/BelongingSection.tsx`
- Modify: dashboard/community/fission/profile callers listed in File Map
- Modify: `apps/frontend/package.json`, `package-lock.json`
- Delete: the four retired files listed in File Map

**Interfaces:**
- `BelongingPulse({ peopleCount, communityCount? })`.
- `BelongingSection({ userId })`.

- [ ] Implement pluralization without `Intl.PluralRules`:

```typescript
const people = `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`
const communities = `${communityCount} ${communityCount === 1 ? 'community' : 'communities'}`
```

- [ ] `BelongingSection` stores loaded ego data via `onDataLoaded`, excludes `userId`, and fetches
  membership count once. On membership failure, render “You're connected to N people” only.

- [ ] Replace every caller found by:

```powershell
rg -n "NetworkGraph|CommunityDepthGraph|from '@/components/TrustGraph'|from '../NetworkGraph'" apps/frontend/src
```

Expected after migration: no output outside comments/tests scheduled for deletion.

- [ ] Remove dependencies in place:

```powershell
npm uninstall --workspace apps/frontend cytoscape react-cytoscapejs @types/cytoscape react-force-graph-2d
```

- [ ] Delete retired components/type shim with `apply_patch`, not shell deletion.

- [ ] Run focused tests, frontend unit/regression, type check, and dependency verification.

```powershell
npm --workspace apps/frontend run test:tdd -- --runInBand sprint-111-belonging-surfaces.test.tsx
npm --workspace apps/frontend run test:unit -- --runInBand
npm --workspace apps/frontend run test:regression -- --runInBand
npx tsc --noEmit -p apps/frontend/tsconfig.json
npm ls cytoscape react-cytoscapejs react-force-graph-2d
```

Expected `npm ls`: empty tree/nonzero “not found” is acceptable.

- [ ] Promote green tests, run `/simplify`, invoke `pre-commit-check`, commit.

---

## Task 12: User Guides, Concepts, ADR, And Generated Landing Docs

**Files:**
- Modify: `docs/guides/trust-graph.md`
- Modify: `docs/concepts/reading-the-trust-graph.md`
- Modify: `docs/adr/ADR-081-belonging-graph-system.md`
- Generated: `apps/landing/src/data/docs/**`

**Interfaces:**
- User-facing docs match shipped behavior exactly.

- [ ] Update the guide with:
  - dashboard/profile/full explorer entry points;
  - ego depth 1–3;
  - ego-only expansion/collapse and FIFO-three cap;
  - full-community semantics;
  - communities lineage semantics;
  - search, keyboard activation, zoom/pan, fading edges.

- [ ] Update the concept page: one renderer, uniform people nodes, four modes, current-user/member
  rings, link semantics, and why expansion is limited to the full-page ego explorer.

- [ ] Change ADR-081 status to `Implemented`; replace stale “community member_count sizes nodes” and
  broad expansion/depth claims with final behavior.

- [ ] Regenerate landing docs from source.

```powershell
npm --workspace apps/landing run generate-docs
rg -n '"status": "implemented"|ego-only|full community' apps/landing/src/data/docs/concepts/adr-081-belonging-graph-system.json apps/landing/src/data/docs/guides/trust-graph.json
```

- [ ] Force-add generated outputs if ignored, run `/simplify`, invoke `pre-commit-check`, commit.

```powershell
git add docs/guides/trust-graph.md docs/concepts/reading-the-trust-graph.md docs/adr/ADR-081-belonging-graph-system.md
git add -f apps/landing/src/data/docs
git commit -m "docs: publish belonging graph explorer guidance"
```

---

## Task 13: Context, Registry, Release Metadata, And Integration Truth

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/registry.json`
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

**Interfaces:**
- Registry and contexts become the source of truth for the new endpoint/surfaces.

- [ ] Document `GET /trust/neighborhood/:userId`, including params, shared-community visibility,
  active-member rule, depth field, cap, `404`, and response example.

- [ ] Add the exact endpoint object to `social-graph-service.apis.provides`.

- [ ] Document frontend mode semantics and retired wrappers/dependencies.

- [ ] Bump only root release metadata:

```json
"version": "11.18.0"
```

Update root package and root lock entries; keep `apps/frontend/package.json` at `1.0.0`.

- [ ] Run service governance and the direct cross-cutting drift test.

```powershell
npm run analyze:services
Push-Location tests
npx jest regression/doc-context-drift-gate.test.ts --runInBand
Pop-Location
```

- [ ] Update handoff implementation status, remaining gates, and smoke-test checklist.

- [ ] Run `/simplify`, invoke `pre-commit-check`, commit.

---

## Task 14: SDLC Quality Gates

**Files:**
- Modify: any files required to resolve real findings
- Modify: PR body Security dismissals section for justified false positives

- [ ] **Testing gate:** run changed-workspace suites without Turbo cache.

```powershell
npm --workspace @karmyq/social-graph-service test -- --runInBand
npm --workspace apps/frontend test -- --runInBand
npm --workspace apps/landing run build
```

- [ ] **Simplify gate:** invoke `/simplify` on the full branch diff.

Verification: no behavior change; duplicated fetch/type/merge logic removed.

- [ ] **Code-review gate:** invoke `/code-review` on `origin/master...HEAD`.

Verification: resolve all correctness findings; record accepted residual risks.

- [ ] **Security-review gate:** invoke `/security-review` on `origin/master...HEAD`.

Verification focus: neighborhood enumeration/privacy, SQL parameterization, query caps, URL/query
parsing, and user-controlled D3 labels. Record any dismissal with justification/link in PR body.

- [ ] Re-run focused suites after review fixes; invoke `pre-commit-check`; commit only if fixes exist.

---

## Task 15: Final Verification And Human Validation

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Run final automated gates.

```powershell
npx tsc --noEmit
npm test
npm run feedback:check
Push-Location tests
npx jest regression/doc-context-drift-gate.test.ts --runInBand
Pop-Location
git diff --check origin/master...HEAD
git status --short
```

- [ ] Run API smoke tests with a real token:
  - own ego depth 1 and depth 3;
  - explicit shared community;
  - inaccessible center returns 404;
  - invalid depth returns ADR-074 400;
  - response nodes contain `degrees_of_separation`;
  - node count never exceeds 80.

- [ ] Run DB read checks:

```sql
SELECT COUNT(*) FROM social_graph.trust_edges_live;
SELECT COUNT(*) FROM communities.members WHERE status = 'active';
```

Confirm no migration/schema mutation occurred.

- [ ] Run UI validation:
  1. dashboard People and Communities use one HEB language;
  2. `/network` no longer 404s;
  3. ego depth/search/zoom/expand/collapse/FIFO work;
  4. community mode shows the whole selected community and no depth/expand control;
  5. communities mode preserves organic/fission semantics;
  6. profile has raised section and honest pulse;
  7. community and fission surfaces still work;
  8. keyboard activation and tooltips work.

- [ ] Update handoff with exact test output and any residual risk. Invoke `pre-commit-check`, commit.

---

## Task 16: PR, Merge, And Deploy

**Files:**
- Modify: `.github` PR body only through GitHub

**Interfaces:**
- Produces: reviewed PR and deployed v11.18.0.

- [ ] Push the owned branch after all local gates pass.

```powershell
git push -u origin feature/sprint-111-belonging-graph-system
```

- [ ] Copy `.github/pull_request_template.md`, fill every section, and create the PR. Include:
  exact tests, API/privacy behavior, UI validation, lockfile changes, ADR/docs, risks, and security
  dismissals.

- [ ] Obtain cross-agent review from the agent that did not implement the branch. Resolve findings
  without self-merging.

- [ ] After Admin authorization, invoke the project `/deploy` skill. Merge through the authorized
  path, monitor GitHub Actions, verify all service health, and smoke-test the live `/network` page.

- [ ] Confirm ADR-081 landing status and live v11.18.0 content match `master`. Update the handoff in
  the same PR/authorized finishing flow; do not make a docs-only follow-up push to `master`.

---

## Success Definition

Sprint 111 is done when:

- all four graph modes render through `TrustGraphHEB` and canonical types;
- `/network` supports ego depth/search/zoom/bounded expansion and full-community browsing;
- neighborhood reads cannot enumerate users outside shared active-community visibility;
- profile belonging has headline altitude and honest connection/community copy;
- old wrappers and dead graph packages are gone;
- ADR, guides, contexts, registry, landing docs, and v11.18.0 metadata agree;
- testing, simplify, code review, security review, CI, deploy, and human API/DB/UI validation pass.
