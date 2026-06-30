# Sprint 116 — Connected Help and Guided Entry: PR A MERGED & DEPLOYED → PR B NEXT

> **STATUS (2026-06-30):** PR A is **merged and deployed**. [#128](https://github.com/ravichavali/karmyq/pull/128)
> squash-merged to `master` as `89ccf4d7` (admin override — branch protection requires a review the
> solo-dev repo can't self-satisfy; all CI was green), and the demo deploy completed successfully.
> Contract, projection, authorization, deterministic renderer, ADR-084, regression promotion, generated
> docs, and v11.23.0 shipped. Claude's four review findings were resolved (`476bd5ec`); a follow-up
> CodeQL scan then flagged two more, both fixed and squashed into the merge: the social-graph client
> URL now comes from a hard origin **allowlist** (replacing the `js/request-forgery` suppression) and
> `RelationshipContextUnavailableError` carries a `configuration|transport|upstream|contract` failure
> kind + cause. **PR B is now unblocked.** The `agent/codex/sprint-116-relationship-shape` branch is
> deleted; this handoff lives on the new `agent/codex/sprint-116-offer-context` branch.

## Quick Start

1. Confirm `origin/master` is at `89ccf4d7` (PR A) and the demo deploy is healthy
   (`gh run list --branch master`; live check with `maria.reyes@test.karmyq.com` / `password123`).
2. You are on `agent/codex/sprint-116-offer-context` (branched off the merged `origin/master`). Begin
   **PR B / Task 7** in `docs/superpowers/plans/2026-06-29-sprint-116-connected-help.md`.
3. PR B targets v11.24.0 — the helping-decision surfaces (helper sees requester context before
   offering; requester sees reciprocal context on an ordinary match; provider/requester reciprocal
   context on offers) plus the deterministic API-only Maria story rehearsal.
4. Do not start PR C until PR B is merged. PR C still owns the distinct **Join the Platform** path.
5. Cross-agent review: PR B's author is reviewed by the *other* agent before merge; Admin authorizes
   merge/deploy. The admin-override merge path applies again unless a second reviewer is available.

## Sprint Goal

Show reciprocal, request-scoped relationship context to helpers, requesters, and providers at the
moment help is considered, then demonstrate it through a read-only Maria story while keeping Join the
Platform distinct from the Founding Circle.

## Approved Artifacts

- Design: `docs/superpowers/specs/2026-06-29-sprint-116-living-demo-design.md`
- Plan: `docs/superpowers/plans/2026-06-29-sprint-116-connected-help.md`
- Current branch: `agent/codex/sprint-116-relationship-shape`
- Design commits: `ea149c5e` (initial) and `1fb3f22e` (approved reciprocal/contextual revision)
- PR A: [#128](https://github.com/ravichavali/karmyq/pull/128)
- PR A implementation commits: `ed3ba8d8`, `4e5cd8a1`, `d8dd5615`, `a2a2db52`, `4112fcf7`
- PR A release/docs commit: `89624290`
- PR A review-fix commit: `476bd5ec`

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

### PR A — Reciprocal Relationship Context (v11.23.0) ✅ MERGED & DEPLOYED

**Merged to `master` as `89ccf4d7` (#128) and deployed to demo on 2026-06-30.**

- Strict privacy-safe contract and coarse `bond_depth` complete.
- Platform-wide reciprocal two-ego projection complete.
- Fail-closed internal social-graph route complete and blocked at public Nginx prefixes.
- Request/ordinary-match/provider-offer-scoped public authorization complete.
- Deterministic compact renderer, ADR-084, v11.23.0, and regression promotion complete.
- Claude review follow-up complete: historical participants with no reconstructable current context
  receive truthful `204`; only the two request-authorized anchors may be memberless; context
  middleware runs only on the three exact GET routes; upstream failure kinds and causes survive for
  useful diagnostics while the public response remains safe.
- Review-fix validation: request-service unit 141/141 and regression 202/202; social-graph-service
  unit 12/12 and regression 76 passed / 3 todo; both TypeScript checks, disclosure 150/150, doc drift
  5/5, landing docs 21/21, service analysis, generated docs, and `git diff --check` pass.
- Live audit: 0 high / 0 critical; three moderate Expo/tar advisories below the blocking threshold.
- Post-review CodeQL follow-up (squashed into the merge, `b50f23e8` on the source branch): replaced the
  `js/request-forgery` suppression in `services/request-service/src/services/socialGraphContextClient.ts`
  with a fixed origin allowlist (only `social-graph-service:3010`, `social-graph-service-test:3010`,
  `localhost:3010` — all server-side env values verified to match), and added the
  `configuration|transport|upstream|contract` failure-kind taxonomy + `cause` to
  `RelationshipContextUnavailableError`. New regression `sprint-116-internal-origin.test.ts` asserts an
  unrecognized origin is rejected before any network call. Full CI (CodeQL, Code Scanning Gate,
  Security Audit, all backend/frontend/integration suites, pr-contract) was green at merge.
- Merge path: branch protection `REVIEW_REQUIRED` could not be self-satisfied on this solo-dev repo, so
  the merge used `gh pr merge --squash --admin --delete-branch` with explicit Admin authorization.
- Local limitation: Docker is unavailable, so compose interpolation received manual review only.

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
- **S116 (in progress):** PR A reciprocal request-scoped foundation merged & deployed (#128, v11.23.0);
  PR B helping surfaces (v11.24.0) and PR C Maria story + Join the Platform (v11.25.0) remain.
- **S117 (upcoming):** Standalone Graph Narrative — decide the full Network page's role/layout from
  S116 perceptual evidence.

---

## Persistent Context

### Active Session (update on every role handoff)

- **Driving agent:** open for PR B — Codex is the planned contributor; the other agent reviews.
- **Phase:** PR A merged (`89ccf4d7`, #128) and deployed to demo. PR B / Task 7 is ready to begin.
- **Branch:** `agent/codex/sprint-116-offer-context`, branched off the merged `origin/master`
  (`89ccf4d7`); the prior `agent/codex/sprint-116-relationship-shape` branch is deleted.
- **Working tree expectation:** clean after this handoff commit. `master` was left untouched (no
  docs-only push to master — it would trigger a second deploy).
- **Blockers:** none. PR B is unblocked; PR C stays blocked on PR B.
- **Authorization:** Contributor agents do not merge or deploy. Admin owns both decisions; the
  admin-override merge path applies while no second reviewer account exists.

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
