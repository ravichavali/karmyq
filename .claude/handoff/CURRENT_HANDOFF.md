# Sprint 114 - Belonging Graph Consolidation Phase 1: PLAN READY

> **STATUS (2026-06-26):** S113 is done and deployed as v11.20.0. S114 has an approved design spec and
> a Phase 1 implementation plan. Execution has **not** started.
>
> **Branch:** `feature/sprint-114-belonging-graph-consolidation` (local planning branch). The working
> tree should be clean at handoff.
>
> **Spec:** `docs/superpowers/specs/2026-06-26-belonging-graph-consolidation-design.md`
>
> **Plan:** `docs/superpowers/plans/2026-06-26-sprint-114-belonging-graph-consolidation.md`

---

## Quick Start

1. Read this handoff.
2. Confirm branch: `git branch --show-current` should be `feature/sprint-114-belonging-graph-consolidation`.
3. Open the plan: `docs/superpowers/plans/2026-06-26-sprint-114-belonging-graph-consolidation.md`.
4. Execute task-by-task using `superpowers:subagent-driven-development` (recommended) or
   `superpowers:executing-plans`.
5. Before every commit, run the project `pre-commit-check` skill.

## Sprint Goal

Adopt `react-force-graph-2d@1.29.1` and consolidate the belonging graph to profile, community, and
`/network` at v11.20.0 informational and behavioral parity.

## Phase 1 Scope

- Adopt `react-force-graph-2d` behind a thin `GraphCanvas` boundary.
- Keep `BelongingGraph` as the only fetch/normalization wrapper over canonical `GraphData`.
- Preserve Phase 1 parity: zoom controls, pan/pinch, hover/focus, node detail, legends, empty/sparse
  states, depth readout, fission split view, Scale 1/2/3 explorer text.
- Retire exactly three redundant surfaces:
  - dashboard `TrustNetworkWidget`
  - Home `MyNetworkPreview`
  - community `My Network` sub-tab
- Add ADR-083 for the renderer decision and update user/landing docs.
- Target version: v11.21.0.

## Out of Scope

- No `GET /trust/explain/:targetUserId`.
- No click-to-recenter traversal, breadcrumb, or URL-synced focus.
- No hero prominence reorder.
- No removal of Scale 1/2/3 text or tabbed explorer modes.
- No distinct directed fission-lineage channel.
- No DB migration, backend API change, or reputation math change.

## Critical Implementation Notes

1. Preserve `GraphData` and normalization exactly. Do not change backend payloads or expose reputation
   numbers to make the canvas easier to draw.
2. `react-force-graph-2d` mutates node objects (`x`, `y`, `vx`, `vy`, `fx`, `fy`). Clone graph data before
   passing it to the renderer.
3. Canvas is not DOM-queryable. Tests assert boundary props, style/config helpers, callbacks, and DOM
   chrome, not `<circle>` or `<path>` nodes.
4. `BelongingGraph` remains the only fetch/normalization wrapper. `GraphCanvas` must not call
   `socialGraphService`.
5. Zoom has one owner. `GraphZoomControls` calls the `react-force-graph-2d` ref (`zoom`, `centerAt`,
   `zoomToFit`); do not also wire D3 zoom or wrapper-level controls.
6. Keep Phase 1 chrome. Removing scale framing and tabbed modes is Phase 3.
7. Fission view must remain admin-operable: proposed-group colors, isolated-member dashed ring, and
   move-group action still work.
8. Dependency must be pinned, and `npm audit --audit-level=high` must pass or be resolved before merge.

## Open Items Carried In

- **S113 post-deploy spot-check still owed:** live demo login `maria.reyes@test.karmyq.com` /
  `password123`; verify My Network nav, Scale 1/2/3 distinctness, egocentric hub, zoom in every map,
  depth readout, and no `NaN`.
- **Fission-lineage conflation bug:** parent-child lineage currently also gets an organic edge and renders
  as overlapping straight lines. Root-caused; scheduled for Phase 3 distinct directed lineage channel.
- **Deploy-verification gotcha:** PR-level `Deploy to Demo` shows `skipping`; the real deploy is the
  post-merge master CI/CD Pipeline `Deploy to Demo` job.

## Active Session

- **Driving agent:** Codex (Sprint 114 planning).
- **Phase:** Phase 1 plan written; execution not started.
- **Files changed in planning:** S114 implementation plan and this handoff.
- **Next action:** Start Task 1 in the plan: dependency pin, version bump, and S111 guardrail inversion.
- **Blockers:** none.

## Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- `apps/frontend/src/components/BelongingGraph.tsx` is the fetch/normalization wrapper.
- Canonical graph types live in `apps/frontend/src/components/graphs/types.ts`.
- Normalizers live in `apps/frontend/src/components/graphs/normalizeGraphData.ts`.
- Current renderers before S114 execution: `TrustGraphHEB.tsx` and `CommunityHubGraph.tsx`.
- API interceptor unwraps envelopes: callers usually read `res.data`, not `res.data.data`.
- `getMyCommunities` returns `{ communities, count, total }`, not a bare array.
- JWT membership field is `communities`, not `communityMemberships`.
- `trust_edges_live` is read-only.
- Request-service owns `/requests/feed`; there is no feed-service.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

## Workflow Gotchas

- Claude and Codex share one physical working tree. One agent edits at a time; commit or stash before
  handing off.
- No git worktrees.
- Branch off `origin/master`, not local `master`, for fresh branches.
- TDD tests start in the changed workspace's `tests/tdd/`, then promote to `regression/` when green.
- Root Turbo tests may cache cross-workspace failures; run focused frontend/doc suites directly.
- Run `/simplify` after each implementation task and again on the full diff.
- Run `/code-review` and `/security-review` before merge.
- Unit + regression tests must pass before push.
- Run the direct doc-context drift test after landing-doc changes:
  `cd tests; npx jest regression/doc-context-drift-gate.test.ts --runInBand`.
- Do not make docs-only pushes to `master`; every master push triggers a deploy.
