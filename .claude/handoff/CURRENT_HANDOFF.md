# Sprint 116 — Connected Help and Guided Entry: PLANNED, READY FOR PR A EXECUTION

> **STATUS (2026-06-29):** Sprint 115 is merged, deployed, and live-validated. Sprint 116 design was
> approved after live diagnosis showed the graph problem is primarily contextual placement, not merely
> simulation data. The approved spec and implementation plan are committed/planned on
> `agent/codex/sprint-116-relationship-shape`. No production implementation has started.

## Quick Start

1. Read this handoff and the approved spec.
2. Check out branch: `git switch agent/codex/sprint-116-relationship-shape`.
3. Open plan: `docs/superpowers/plans/2026-06-29-sprint-116-connected-help.md`.
4. Start at **PR A / Task 1** and run `/execute-plan` (uses
   `superpowers:subagent-driven-development`) or execute inline with `superpowers:executing-plans`.
5. Do not start PR B until PR A is merged; do not start PR C until PR B is merged.

## Sprint Goal

Show reciprocal, request-scoped relationship context to helpers, requesters, and providers at the
moment help is considered, then demonstrate it through a read-only Maria story while keeping Join the
Platform distinct from the Founding Circle.

## Approved Artifacts

- Design: `docs/superpowers/specs/2026-06-29-sprint-116-living-demo-design.md`
- Plan: `docs/superpowers/plans/2026-06-29-sprint-116-connected-help.md`
- Current branch: `agent/codex/sprint-116-relationship-shape`
- Design commits: `ea149c5e` (initial) and `1fb3f22e` (approved reciprocal/contextual revision)

## Cross-Agent Plan Review

Claude reviewed the spec/plan before execution. The review's five refinements are incorporated:

- Maria's ordinary story must be visibly rich (≤2-degree path, ≥3 shared one-hop people, ≥4 visible
  one-hop nodes per side); the provider story supplies contrast.
- The compact renderer has zero D3 imports: pure TypeScript geometry + React SVG.
- ADR-082 explicitly records the accepted ordinal disclosure (`growing` ≥2, `established` ≥4).
- Landing tests run directly without Turbo cache; generated `nav.json` is grep/diff verified; recurring
  frontend `js/request-forgery` findings are checked and documented rather than surprising the PR.
- `/auth/demo-session` is correctly classified under auth-service, and the configured persona must
  independently be active, non-admin, and `@test.karmyq.com`.

Claude recommends inline execution for PR A because Tasks 1–5 form a strict dependency chain.

## Why This Sprint Changed

Live read-only validation confirmed the S115 renderer is deployed. Maria's ego view shows 79 people
within one hop, so every non-caller node lands on one orbit and the result remains a starburst. Marin
Helping Hands shows roughly 70 members with only 13 relationship paths and remains an almost-empty
ring. S115 changed semantic correctness but retained a circular visual grammar. Data sparsity and
uniform relationship states amplify the issue; they do not explain the lack of visible narrative.

The product opportunity is therefore not another standalone Network-page redesign. Karmyq should
explain relationship when a visible request asks someone to trust enough to help. The approved lens is
mutual: a helper sees how they connect to the requester, and the requester sees the same topology when
reviewing that helper or provider.

## Delivery: Three Ordered PRs

### PR A — Reciprocal Relationship Context (v11.23.0)

- Strict privacy-safe contract and coarse `bond_depth`.
- Platform-wide reciprocal two-ego projection.
- Fail-closed internal social-graph route.
- Request/ordinary-match/provider-offer-scoped public authorization.
- Deterministic compact renderer and ADR-084.

### PR B — Helping Decision Surfaces (v11.24.0)

- Ordinary helper sees requester context before offering.
- Requester sees reciprocal context while reviewing an ordinary match.
- Provider sees requester context before submitting; requester sees provider role while reviewing.
- Deterministic, API-only Maria ordinary/provider story rehearsal.

### PR C — Guided Entry and Join the Platform (v11.25.0)

- Synthetic-only 30-minute read-only Maria sessions.
- Guided ordinary/provider offer comparison at `karmyq.com/demo`.
- karmyq.org desktop/mobile paths: Explore, Join the Platform, Founding Circle.
- Full live five-second validation and deploy evidence.

## Critical Implementation Notes

1. The lens is request/offer-scoped. Do not add a public route that accepts an arbitrary target user.
2. Relationship topology is reciprocal. Reversing participants may change orientation and role copy,
   but never the disclosed node/link/path sets.
3. Trust paths are platform-wide under ADR-077. Never label an exchange path as belonging to the
   request's source community.
4. Request reachability is the existing visibility boundary, including sister-community,
   trust-network, and platform scope. Do not replace it with a shared-membership check.
5. Named connections are visible to authenticated Karmyq members in this context; exact ordinary-
   member reputation, weights, counts, history text, and timestamps remain forbidden under ADR-082.
6. Request-service owns public context authorization and derives both IDs. Social-graph-service only
   receives them over the fail-closed internal boundary.
7. Preserve path nodes and shared connections before applying caps. Fill remaining slots with stable,
   non-evaluative ordering and disclose truncation.
8. `bond_depth` intentionally discloses an ordinal floor (`growing` ≥2, `established` ≥4); document
   that accepted trade-off while keeping exact count, timing, content, direction, and value private.
9. Thickness carries coarse repeated history only. Brightness carries no relationship meaning.
10. The compact lens uses pure TypeScript geometry and React SVG with zero D3 imports.
11. Providers use equal person nodes. Service type/collective are role decorations, never rank.
12. The relationship lens is non-blocking. Existing offer and acceptance actions must work through
    timeout, no-path, and service failure.
13. The ordinary Maria story must meet the rich-overlap floor (≤2-degree path, ≥3 shared one-hop
    connections, ≥4 visible one-hop nodes per side); do not validate two sparse pictures.
14. Rehearsal mutations use ordinary APIs, are dry-run by default, additive, resumable, and require
    explicit `--apply`; never seed trust edges or coordinates.
15. Demo write protection is server-side shared middleware. Hiding controls is defense in depth only.
16. Join the Platform is ordinary registration and must remain distinct from `/join`, the Founding
    Circle path, on desktop, mobile, home, and demo surfaces.
17. Update existing ADRs and docs rather than creating competing definitions of path scope,
    disclosure, provider identity, or request eligibility.

## Validation Contract

The sprint is not complete until a live viewer can answer within five seconds:

1. How are these two people connected?
2. Where does each person belong?
3. Which offerer is acting as a provider?

Validate direct, indirect, no-path, and cross-community cases. Force context-service failure and prove
offer/accept/decline actions still work. Validate the same topology from both participants' orientation.

## Carry-Forward / Out of Scope

- Standalone Network-page constellation/connected-island redesign is deferred to S117 and must use
  evidence from the contextual lens.
- Broad simulation topology optimization is not part of S116; only the two truthful Maria stories are
  rehearsed.
- No arbitrary member search or relationship browser.
- No open-web member topology; the authenticated read-only Maria session is still a Karmyq session.
- No ordinary-member numeric reputation, karma, trust weights, exchange counts, or history text.
- No provider node-size/status hierarchy.
- Cleanup-service replacement, broader forget/export, and mobile-native parity remain deferred.
- Recurring CodeQL `js/request-forgery` on `apps/frontend/src/lib/api.ts` is a known browser-baseURL
  false positive; dismiss only with written PR justification.

## Multi-Sprint Arc

- **S115 (done):** Earned Structure — deterministic ego orbit + direct community ring + neutral
  complete-data contract (v11.22.0).
- **S116 (planned):** Connected Help and Guided Entry — reciprocal request-scoped context, provider
  role, Maria story, and Join the Platform (v11.23.0 → v11.25.0).
- **S117 (upcoming):** Standalone Graph Narrative — decide the full Network page's role/layout from
  S116 perceptual evidence.

---

## Persistent Context

### Active Session (update on every role handoff)

- **Driving agent:** Codex (planning); implementation owner not yet assigned.
- **Phase:** Approved design + detailed plan complete. PR A implementation has not started.
- **Branch:** `agent/codex/sprint-116-relationship-shape` from merged S115 `origin/master`.
- **Working tree expectation:** clean after the plan/handoff commit.
- **Blockers:** none. Next action is PR A Task 1.
- **Authorization:** Contributor agents do not merge or deploy. Admin owns both decisions.

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
