# Sprint 114 - Belonging Graph Consolidation Phase 1: EXECUTION IN PROGRESS

> **STATUS (2026-06-26):** S114 execution is underway on
> `feature/sprint-114-belonging-graph-consolidation`. Tasks 1-12 are committed. Claude (non-authoring
> agent) cross-agent reviewed + committed Task 8 (`07b5a965`), executed Tasks 9-12 (`2426c8bd`,
> `4921376d`, `c0d36c6d`, gate fixes `7cfc9a15`). Full root `npm test` green after Task 12
> (26/26 Turbo tasks; frontend regression 11 suites / 81 tests).
>
> **Branch:** `feature/sprint-114-belonging-graph-consolidation`.
>
> **Working tree:** clean except this handoff. Next up is Task 13 — open the PR, request cross-agent
> review, and **stop for Admin authorization** before merge/deploy (contributor agents never self-merge).
>
> **Spec:** `docs/superpowers/specs/2026-06-26-belonging-graph-consolidation-design.md`
>
> **Plan:** `docs/superpowers/plans/2026-06-26-sprint-114-belonging-graph-consolidation.md`
>
> **Plan review fixes applied:** regression tests stay green at every task commit; intentionally-red
> renderer checks live in `tests/tdd/` until promotion; `react-force-graph-2d` uses a global Jest
> mapper/mock; `TrustNetworkWidget` is treated as dead-code deletion; visual parity must be ported from
> the current renderers; and `BelongingGraphRenderer` has an explicit prop-parity checklist.

---

## Quick Start

1. Read this handoff.
2. Confirm branch: `git branch --show-current` should be `feature/sprint-114-belonging-graph-consolidation`.
3. Tasks 8-12 are committed (`07b5a965`, `2426c8bd`, `4921376d`, `c0d36c6d`, `7cfc9a15`). No action needed.
4. Task 13: push the branch, open the PR (fill the template — include the gate verification lines and
   the `enableZoomInteraction` follow-up below), request Codex cross-agent review, then **stop for
   Admin authorization** before `gh pr merge --squash`. Real deploy is the post-merge master CI/CD
   `Deploy to Demo` job, not the PR-level skipped check.

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
4. `react-force-graph-2d` is ESM and must be mapped to a global Jest mock before renderer tests import
   it. Do not rely on per-file mocks.
5. `BelongingGraph` remains the only fetch/normalization wrapper. `GraphCanvas` must not call
   `socialGraphService`.
6. Zoom has one owner. `GraphZoomControls` calls the `react-force-graph-2d` ref (`zoom`, `centerAt`,
   `zoomToFit`); do not also wire D3 zoom or wrapper-level controls.
7. Keep Phase 1 chrome. Removing scale framing and tabbed modes is Phase 3.
8. Fission view must remain admin-operable: proposed-group colors, isolated-member dashed ring, and
   move-group action still work.
9. Dependency must be pinned, and `npm audit --audit-level=high` must pass or be resolved before merge.

## Open Items Carried In

- **S113 post-deploy spot-check still owed:** live demo login `maria.reyes@test.karmyq.com` /
  `password123`; verify My Network nav, Scale 1/2/3 distinctness, egocentric hub, zoom in every map,
  depth readout, and no `NaN`.
- **Fission-lineage conflation bug:** parent-child lineage currently also gets an organic edge and renders
  as overlapping straight lines. Root-caused; scheduled for Phase 3 distinct directed lineage channel.
- **Deploy-verification gotcha:** PR-level `Deploy to Demo` shows `skipping`; the real deploy is the
  post-merge master CI/CD Pipeline `Deploy to Demo` job.

## Active Session

- **Driving agent:** Codex (Sprint 114 implementation).
- **Phase:** Phase 1 execution through Task 8 implementation.
- **Completed commits:**
  - `1a4c666d` `test: set S114 graph renderer dependency guardrails`
  - `54dd586e` `feat: add belonging graph canvas model helpers`
  - `6de63102` `feat: add react force graph canvas boundary`
  - `4e0f23a8` `feat: add belonging graph renderer chrome`
  - `d90466f2` `feat: route belonging graph through canvas renderer`
  - `d5f3821d` `feat: preserve belonging graph mode parity`
  - `dee06d47` `test: define S114 graph surface consolidation`
  - `07b5a965` `feat: consolidate belonging graph surfaces` (Task 8; Claude cross-agent reviewed + committed)
  - `2426c8bd` `refactor: retire old D3 graph renderers` (Task 9; Claude executed)
  - `4921376d` `docs: record S114 graph renderer decision` (Task 10; ADR-083 + guide/concept + landing)
  - `c0d36c6d` `test: promote S114 graph regression coverage` (Task 11; CONTEXT + registry wording + TDD→regression)
  - `7cfc9a15` `fix: resolve S114 quality-gate findings` (Task 12; XSS escape + reheat-loop fix + simplify)
- **Task 8 committed:** community `My Network` sub-tab removed, Home `MyNetworkPreview`
  import/render removed, `MyNetworkPreview.tsx` deleted, orphaned `TrustNetworkWidget.tsx` deleted.
- **Task 9 committed:** deleted `TrustGraphHEB.tsx`, `CommunityHubGraph.tsx`, and the now-orphaned
  `graphZoom.ts`; promoted old-renderer deletion guardrails into
  `tests/regression/belonging-graph-consolidation.test.ts`; deleted the spent TDD guardrail file; and
  refreshed stale doc comments that named the retired renderers. tsc + 5 graph suites (52 tests) green.
- **Task 10 committed:** ADR-083 markdown + README index + `ADR_GROUPS` slug; trust-graph guide and
  reading-the-trust-graph concept updated for the canvas renderer + three-home consolidation; landing
  JSON regenerated via `npm run generate-docs` and force-tracked (`git add -f`, the dir is gitignored).
  Doc-context drift gate green (run directly, not via Turbo).
- **Task 11 committed:** `apps/frontend/CONTEXT.md` S114 renderer section added; `/trust/graph/:communityId/full`
  registry description de-HEB'd (wording only, no API change); the two S114 TDD suites promoted into
  `tests/regression/` (17 tests). `npm run generate-docs` regenerated landing `services.json` to match.
  `analyze:services` produced no dependency-graph change.
- **Task 12 committed (`7cfc9a15`):** SDLC gates run on the full branch diff.
  - `npm audit --audit-level=high` → exit 0 (only 3 pre-existing moderate `expo` vulns, below gate).
  - `/security-review` → **HIGH stored-XSS fixed:** `react-force-graph` renders a string `nodeLabel`
    into its hover tooltip via `innerHTML` (force-graph → float-tooltip `.html()`); user-controlled
    `node.name` is now `escapeHtmlLabel`-escaped + regression test added. ADR-082 disclosure boundary
    re-confirmed (no reputation numbers in node detail/canvas).
  - `/code-review` → **fixed** the `configureForces`/`onEngineStop` `d3ReheatSimulation` reheat loop
    (perpetual animation). **Open follow-up (PR body):** `enableZoomInteraction={(e)=>e.type!=='wheel'}`
    in `GraphCanvas.tsx` — `react-force-graph`'s `enableZoomInteraction` is a *boolean*, so a function
    is always truthy → mouse-wheel may still zoom (guide promises wheel scrolls the page). Low-risk UX
    papercut; left as-is to avoid regressing pan/pinch — verify on the demo, fix in a follow-up if real.
  - `/simplify` → dead `enableZoom` prop removed; `fissionGroupLabel` triple-cast collapsed; `linkOpacity`
    test-surface documented.
- **Latest full root gate:** passed after Task 12 (`npm test`, 26/26 Turbo tasks; frontend regression
  11 suites / 81 tests ran fresh).
- **Next action:** Task 13 — push branch, open PR, cross-agent review, stop for Admin merge authorization.
- **Blockers:** none (Admin authorization required before merge/deploy).

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
