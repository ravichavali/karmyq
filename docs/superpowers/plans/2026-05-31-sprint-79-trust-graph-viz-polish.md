# Trust Graph Viz Polish + Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify all trust-graph relationship views onto one clustered, structure-revealing HEB style with uniform node sizing, make the trust metric consistently decayed platform-wide, and add an inter-community depth view (communities as nodes, fission lineage differentiated from organic ties) — shipping v10.7.0.

**Architecture:** Backend changes are query-only (swap `raw_weight` node aggregates for decayed `current_weight`, add one read endpoint over existing tables). Frontend retires the radial (Cytoscape) and force-directed (react-force-graph) ego views in favor of the existing D3 HEB component extended with an `ego` mode + uniform sizing, and adds a new communities-as-nodes depth graph.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue, D3.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/social-graph-service/tests/tdd/sprint-79-trust-metric-and-depth.test.ts` | TDD: decayed node metric across all graph fns + `/trust/communities` shape (organic + fission edges) |
| `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx` | Inter-community depth view: communities as nodes, organic vs fission edges |
| `docs/guides/trust-graph.md` | User guide: reading every trust-graph view + visual conventions |
| `docs/adr/ADR-063-canonical-trust-metric-and-unified-graph.md` | ADR: decayed canonical metric + uniform-size unified visualization |
| `apps/landing/src/data/docs/concepts/adr-063-canonical-trust-metric-and-unified-graph.json` | Landing ADR-063 |
| `apps/landing/src/data/docs/concepts/reading-the-trust-graph.json` | Landing concept page |

### Existing files to modify
| File | Change |
|------|--------|
| `services/social-graph-service/src/database/trustEdgeDb.ts` | `getTrustGraph`, `getTrustGraphAggregate`, `getTrustGraphAggregateForCenter`: node `trust_score` → `SUM(current_weight)` from `trust_edges_live`. Add `getCommunityDepthGraph(userId)`. |
| `services/social-graph-service/src/routes/trustGraph.ts` | Add `GET /trust/communities` (must precede `/:communityId`-style matchers as needed). |
| `services/social-graph-service/CONTEXT.md` | Document the metric change + new endpoint. |
| `apps/frontend/src/components/graphs/TrustGraphHEB.tsx` | Add `'ego'` mode; make `nodeRadius` uniform across all modes (only current user enlarged + ringed). |
| `apps/frontend/src/components/TrustGraph.tsx` | `ego` mode → `TrustGraphHEB` (was `TrustGraphRadial`). |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | "My Network" sub-tab renders HEB ego mode. |
| `apps/frontend/src/components/NetworkGraph.tsx` | Replace force-directed impl with static clustered HEB fed by aggregate; drop expansion. |
| `apps/frontend/src/components/graphs/TrustGraphRadial.tsx` | **Delete** (after dispatcher change). |
| `apps/frontend/src/lib/api.ts` | Add `socialGraphService.getCommunityGraph()`. |
| `apps/frontend/src/pages/profile.tsx` (+ dashboard host) | People/Communities view toggle over the network section. |
| `apps/landing/src/data/docs/services/social-graph-service.json` | New endpoint + metric note. |
| `apps/landing/src/data/docs/nav.json` | ADR-063 + concept page entries. |
| `services/registry.json` | `social-graph` provides `GET /trust/communities`. |
| `package.json` (root) | Version 10.6.2 → 10.7.0. |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Metric fix is decayed, everywhere.** Swap node `trust_score` from `SUM(te2.raw_weight)` on `trust_edges` to `SUM(tel.current_weight)` on `trust_edges_live` in `getTrustGraph`, `getTrustGraphAggregate`, `getTrustGraphAggregateForCenter`. `getFullCommunityGraph` already does this — match it. Only the **node** aggregate is wrong; edges already use `current_weight`.
2. **Uniform sizing is global** (confirmed) — Community + Split too, not just ego. `nodeRadius` → constant; current user `+N` and white-ringed. Community/Split "land well" today; verify they still read well with uniform dots before merge.
3. **HEB ego mode ≈ community mode visually.** Reuse the community palette (`#818cf8` within-cluster, slate cross-cluster, `#fb923c` your edges, emerald current-user + white ring). Don't invent a new palette.
4. **Dashboard "Your Network" loses expansion.** Remove `handleExpandNode`, `expandedNodes`, `mergeGraphData`, center-expansion wiring. Keep the IntersectionObserver lazy-load. Static first-degree aggregate, click → detail panel.
5. **No schema changes.** Fission edges from `split_proposals` (`status='executed'`: parent `community_id` → `child_community_a_id`/`child_community_b_id`); organic from `community_trust_edges`.
6. **`community_trust_edges` may be sparse** — few organic edges is expected. Fission edges are the denser signal.
7. **`community_trust_normalized` CHECK**: `community_id_a::text < community_id_b::text` — organic pairs are undirected; fission edges are directed (parent→child). Keep them separate, tag `type`.
8. **trust_edges_live is a VIEW** — read-only.
9. **JWT field is `communities`**, never `communityMemberships`.
10. **Schema is `communities.communities`** / `communities.split_proposals` (plural).
11. **Landing docs gitignored** — `git add -f`. Run `generate-docs` from `apps/landing/`; nav.json reverts — grep-verify + re-apply.
12. **Version 10.6.2 → 10.7.0** — update the `v10-polish` version-invariant test if it pins the number.
13. **`react-cytoscapejs` removal is conditional** — grep for other importers before dropping the dep.

---

## Task 1: Feature branch + version bump

**Files:**
- Modify: `package.json` (root)

- [ ] Create branch `feature/sprint-79-trust-graph-viz-polish` off master.
- [ ] Bump root `package.json` version `10.6.2` → `10.7.0`.
- [ ] Grep for a `v10-polish` version-invariant test that pins the number; update it to `10.7.0` if present.

- [ ] **Verification**

```bash
git rev-parse --abbrev-ref HEAD   # feature/sprint-79-trust-graph-viz-polish
node -e "console.log(require('./package.json').version)"   # 10.7.0
```

---

## Task 2: TDD tests first (metric + depth endpoint)

**Files:**
- Create: `services/social-graph-service/tests/tdd/sprint-79-trust-metric-and-depth.test.ts`

- [ ] **Write failing tests** (TDD — before implementation):
  - For `getTrustGraph`, `getTrustGraphAggregate`, `getTrustGraphAggregateForCenter`: assert node `trust_score` equals the **decayed** sum (`SUM(current_weight)` from `trust_edges_live`), NOT the raw sum. Construct an edge whose `current_weight < raw_weight` (decayed) and assert the node score matches the decayed value exactly.
  - For `getCommunityDepthGraph(userId)`: assert nodes = the user's active communities with `{ id, name, member_count, status }`; assert organic edges appear from `community_trust_edges` with `type:'organic'`; assert fission edges appear from an executed `split_proposals` row as two directed parent→child links with `type:'fission'`.
  - Assert the metric invariant numerically (exact decayed value), not just "is a number" — per the robust-testing standard.

- [ ] **Verification** (expected RED)

```bash
cd services/social-graph-service && npm run test:tdd -- sprint-79 2>&1 | tail -20
```

---

## Task 3: Backend — decayed node metric (Phase 2)

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`

- [ ] In `getTrustGraph` nodesQuery, replace the `trust_score` subquery:

```sql
COALESCE((
  SELECT SUM(tel.current_weight) FROM social_graph.trust_edges_live tel
  WHERE (tel.user_id_a = u.id OR tel.user_id_b = u.id) AND tel.community_id = $1
), 0) AS trust_score
```

- [ ] Apply the same decayed swap in `getTrustGraphAggregate` and `getTrustGraphAggregateForCenter` (use the respective community-set predicate: `tel.community_id IN (...)`).
- [ ] Confirm `getFullCommunityGraph` is unchanged (already decayed).

- [ ] **Verification** — the three metric tests from Task 2 go GREEN

```bash
cd services/social-graph-service && npm run test:tdd -- sprint-79 2>&1 | tail -20
```

---

## Task 4: Backend — community depth graph fn + endpoint (Phase 3)

**Files:**
- Modify: `services/social-graph-service/src/database/trustEdgeDb.ts`, `services/social-graph-service/src/routes/trustGraph.ts`

- [ ] Add `getCommunityDepthGraph(callingUserId)`:
  - **Nodes**: the user's active communities (`communities.members` status='active') joined to `communities.communities` → `{ id, name, member_count: current_members, status }`. Include communities reachable by an inter-community edge to one of those, if cheap; otherwise scope to the user's communities (document the choice).
  - **Organic links**: from `social_graph.community_trust_edges` where both endpoints are in the node set → `{ source: community_id_a, target: community_id_b, weight, type:'organic' }`.
  - **Fission links**: from `communities.split_proposals` where `status='executed'` and parent ∈ node set → two links `{ source: community_id (parent), target: child_community_a_id, weight: 1, type:'fission' }` and `…child_community_b_id`. Skip child ids that are null or not in the node set.
- [ ] Add route `GET /trust/communities` returning `{ success, data: { nodes, links } }`. Place it so Express doesn't match it as `/:communityId` (declare alongside `/graph` literals; `/communities` is a distinct literal path so ordering is safe, but add a comment).

- [ ] **Verification** — the depth tests from Task 2 go GREEN

```bash
cd services/social-graph-service && npm run test:tdd -- sprint-79 2>&1 | tail -20
```

---

## Task 5: HEB ego mode + global uniform sizing (Phase 1 core)

**Files:**
- Modify: `apps/frontend/src/components/graphs/TrustGraphHEB.tsx`

- [ ] Make `nodeRadius` uniform across **all** modes: a single constant (e.g. `5`), current user `+3` and white-ringed (current-user ring already exists). Remove the `trust_score / maxScore` term from `nodeRadius`. `maxScore` may now be unused for sizing — keep only if used elsewhere (detail panel), else remove.
- [ ] Add `'ego'` to the `mode` union. For `mode === 'ego'`, use the community-mode visual rules: `detectClusters` for cluster assignment, cluster color (`#818cf8` / slate), amber (`#fb923c`) for current-user edges, emerald current-user node + white ring. Empty-state copy: "You don't have any trust connections yet."
- [ ] Update the legend block to render the ego legend (You / your connections / within-cluster / cross-cluster) for `mode === 'ego'`.

- [ ] **Verification**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | tail -5
```

---

## Task 6: Route ego views through HEB; retire radial (Phase 1)

**Files:**
- Modify: `apps/frontend/src/components/TrustGraph.tsx`, `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
- Delete: `apps/frontend/src/components/graphs/TrustGraphRadial.tsx`

- [ ] In `TrustGraph.tsx`, route `mode === 'ego'` to `TrustGraphHEB` (mode='ego'); remove the dynamic `TrustGraphRadial` import. Keep the `onNodeClick`/`height` props flowing to HEB where applicable.
- [ ] Ensure `TrustGraphTab.tsx` ("My Network") passes `mode="ego"` and renders correctly.
- [ ] Delete `TrustGraphRadial.tsx`. Grep for any remaining importer of `react-cytoscapejs`/`cytoscape`; if none, remove those deps from `apps/frontend/package.json`.

- [ ] **Verification**

```bash
cd apps/frontend && grep -rn "TrustGraphRadial\|react-cytoscapejs" src && echo "STILL REFERENCED" || echo "clean"
cd apps/frontend && npx tsc --noEmit 2>&1 | tail -5
```

---

## Task 7: Dashboard "Your Network" → static clustered HEB (Phase 1)

**Files:**
- Modify: `apps/frontend/src/components/NetworkGraph.tsx`

- [ ] Replace the react-force-graph rendering with `TrustGraphHEB` (mode='ego') fed by `socialGraphService.getTrustGraphAggregate()`.
- [ ] Remove progressive expansion: `handleExpandNode`, `expandedNodes`, `expandingNodeId`, `mergeGraphData`, and the `getTrustGraphAggregate(center)` call. Keep the IntersectionObserver lazy first-load and the empty/loading states.
- [ ] Node click → detail panel (HEB already provides this); drop the force-graph-specific selection logic.
- [ ] If nothing else imports `react-force-graph-2d`, remove the dep from `apps/frontend/package.json`.

- [ ] **Verification**

```bash
cd apps/frontend && grep -rn "react-force-graph" src && echo "STILL REFERENCED (ok if intended)" || echo "clean"
cd apps/frontend && npx tsc --noEmit 2>&1 | tail -5
```

---

## Task 8: Community depth view component + toggle + api client (Phase 3)

**Files:**
- Create: `apps/frontend/src/components/graphs/CommunityDepthGraph.tsx`
- Modify: `apps/frontend/src/lib/api.ts`, `apps/frontend/src/pages/profile.tsx` (dashboard network host)

- [ ] Add `socialGraphService.getCommunityGraph()` → `GET /trust/communities` (use `res.data`, the interceptor already unwraps the envelope).
- [ ] Build `CommunityDepthGraph.tsx`: communities as nodes, organic edges solid (weight → width/opacity), fission edges dashed + differentiated color (e.g. violet). Current user's communities emphasized; node click → detail panel (name, members, status). Reuse D3 patterns from HEB; clustering optional (few nodes). Empty state when the user has < 2 communities or no edges.
- [ ] Add a **People / Communities** toggle over the dashboard network section; People → `NetworkGraph`, Communities → `CommunityDepthGraph`.

- [ ] **Verification**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | tail -5
```

---

## Task 9: User guide + landing docs + ADR-063 (mandatory)

**Files:**
- Create: `docs/guides/trust-graph.md`, `docs/adr/ADR-063-canonical-trust-metric-and-unified-graph.md`, `apps/landing/src/data/docs/concepts/adr-063-canonical-trust-metric-and-unified-graph.json`, `apps/landing/src/data/docs/concepts/reading-the-trust-graph.json`
- Modify: `docs/adr/README.md`, `apps/landing/src/data/docs/services/social-graph-service.json`, `apps/landing/src/data/docs/nav.json`

- [ ] Write `docs/guides/trust-graph.md`: how to read Community, Split, My Network, Your Network, and the new Communities (depth) view; the uniform-sizing convention; decayed metric; organic vs fission edges.
- [ ] Write ADR-063 (status `Implemented`): canonical decayed trust metric + uniform-size unified visualization; add to `docs/adr/README.md` index.
- [ ] Create the landing ADR-063 JSON + concept page JSON; update `social-graph-service.json` (new endpoint + metric note); add nav.json entries.
- [ ] Run `generate-docs` from `apps/landing/`; grep-verify nav.json kept both entries; re-apply if reverted.

- [ ] **Verification**

```bash
cd apps/landing && npm run generate-docs >/dev/null 2>&1; grep -c "reading-the-trust-graph\|adr-063" src/data/docs/nav.json
```

---

## Task 10: CONTEXT.md + registry.json + onboarding copy

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`, `services/registry.json`, `apps/frontend/src/lib/onboarding/workflows.ts`

- [ ] CONTEXT.md: document the decayed node metric (now canonical) + `GET /trust/communities` in "API Endpoints".
- [ ] registry.json: add `GET /trust/communities` to social-graph `apis.provides`.
- [ ] Update any onboarding workflow copy referencing the old radial/force network views.
- [ ] Run `npm run analyze:services` if dependencies changed (they shouldn't).

- [ ] **Verification**

```bash
npm run feedback:check 2>&1 | tail -15
```

---

## Task 11: SDLC quality gates

- [ ] **`/simplify`** on the full branch diff (reuse, altitude, dead code — esp. removed `maxScore`/expansion helpers). Apply fixes.

```bash
git diff master...HEAD --stat
```

- [ ] **`/code-review`** on the branch diff; resolve correctness/logic findings (SQL predicate correctness on the depth fn, edge dedup, null child ids).

- [ ] **`/security-review`** on the branch diff; the new endpoint reads only the caller's communities — verify no IDOR (a user can't enumerate communities they aren't in) and parameterized queries throughout. Resolve real findings; justify dismissals.

- [ ] **Migration-validator** — N/A (no migration this sprint); note it.

---

## Task 12: Final type check + pre-push verification

- [ ] **Verification** (all must pass)

```bash
npx tsc --noEmit                       # root / changed services clean
npm test                               # unit + regression green
cd services/social-graph-service && npm run test:tdd -- sprint-79 2>&1 | tail -10   # sprint TDD green
npm run feedback:check                 # docs complete
npm audit --package-lock-only --audit-level=high   # clean (ADR-059 gate)
```

- [ ] **Manual validation** (per sprint-validation standard):
  - API smoke: `GET /trust/graph` and `GET /trust/communities` return decayed scores + edge `type` tags.
  - DB check: a node's `trust_score` matches `SUM(current_weight)` for its live edges.
  - UI check: My Network + Your Network render as clustered HEB with uniform dots; Communities toggle shows organic (solid) + fission (dashed) edges.

---

## Task 13: Merge + Deploy

- [ ] Use the `/deploy` skill: merge `feature/sprint-79-trust-graph-viz-polish` → master, push, monitor GitHub Actions to green.
- [ ] No migration scripts this sprint (no schema change) — no SSH data step required.
- [ ] Verify demo health post-deploy; spot-check the trust-graph views on karmyq.com.
- [ ] Update the handoff: Sprint 79 complete (v10.7.0); note any deferred polish.
