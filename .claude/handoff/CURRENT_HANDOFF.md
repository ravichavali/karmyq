# Sprint 112 — Belonging & Reputation Truth: Planning

> **STATUS (2026-06-24):** Sprint 111 shipped to `master` as v11.18.0 through PRs #114, #117,
> and #119. Sprint 112's written spec is maintainer-approved with three review locks incorporated.
> The implementation plan is complete and ready to execute as two ordered PRs.

---

## Quick Start

1. Read this handoff.
2. Review the design spec:
   `docs/superpowers/specs/2026-06-24-sprint-112-belonging-reputation-truth-design.md`.
3. Open the implementation plan after it is written:
   `docs/superpowers/plans/2026-06-24-sprint-112-belonging-reputation-truth.md`.
4. Execute PR A first on `feature/sprint-112-reputation-disclosure-boundary`; branch PR B from
   merged `origin/master` only after PR A deploy validation.

## Sprint Goal

Make belonging prominent without making people into public scores: establish a platform-wide,
API-enforced reputation disclosure boundary, reconcile the member's own community-scoped metrics,
and elevate My Network in navigation and Home.

## Approved Artifacts

- Design spec (approved):
  `docs/superpowers/specs/2026-06-24-sprint-112-belonging-reputation-truth-design.md`
- Implementation plan:
  `docs/superpowers/plans/2026-06-24-sprint-112-belonging-reputation-truth.md`
- Decision record to create during implementation: ADR-082, Reputation Disclosure Boundary.
- Backlog sources: BUG-024 in `docs/BUGS.md` and the 2026-06-24 UX entry in `docs/IDEAS.md`.

## Approved Scope

1. Exact ordinary-member reputation metrics are self-only across the platform.
2. Other members receive authorized identity/structure and coarse explanations, not exact values.
3. Public provider ratings and anonymous community aggregates are explicit typed exceptions.
4. Add one canonical community-scoped self summary consumed by Profile, Home, and My Network.
5. Governance computes exact eligibility internally but returns only eligibility + coarse reason.
6. Remove metric leakage from graphs, trust cards/paths, invitations, leaderboards, and community
   exports; enforce the boundary with strict shared DTO schemas and cross-user tests.
7. Add a disclosure inventory + CI regression gate.
8. Add My Network to primary navigation and a prominent Home preview below actionable decisions.
9. No database migration and no reputation-math rewrite.
10. Deliver as two ordered PRs: privacy boundary + CI gate first; My Network prominence second.

## Decisions Locked During Brainstorming

### Reputation disclosure rule

Exact personal reputation is self-only. Other ordinary members may see authorized structure and a
coarse explanation. Provider ratings and anonymous community aggregates are the only approved public
numeric exceptions. There is no admin browsing exception.

### Governance explanation

Governance shows “Eligible for stewardship” and the reason “Eligibility threshold met through
established community relationships.” It does not return member trust or karma values.

### Belonging prominence

Add My Network to authenticated navigation and a prominent Home preview. Keep onboarding expansion
for a later sprint. On Home, pending decisions and urgent help actions remain above the graph preview.

### Enforcement depth

Use query minimization, explicit server projection, strict shared DTO schemas, cross-user sentinel
tests, and a CI disclosure inventory. Protected fields are omitted, not zeroed.

### Sensitive-root classifications

Community trust/network metrics are membership-gated `community_aggregate` exceptions with
five-member suppression. Every `:userId` trust/evolution configuration endpoint is self-only.
Community evolution policy/history/toggle endpoints are internal community-admin surfaces and must
not include member parameters.

Community health/milestones and decay policy are aggregate/policy contracts. Retire public
`GET /trust/edge` with an ADR-074 `410` while preserving the internal DB helper. Relationship-memory
responses keep qualitative decay state but remove exact `currentWeight`.

### Compatibility denials

Cross-user reputation/config reads return ADR-074-shaped `404 REPUTATION_NOT_FOUND`. The retired
leaderboard returns ADR-074-shaped `410 REPUTATION_LEADERBOARD_RETIRED`. Audit all repository callers
before retiring the endpoint or helper.

### Delivery sequence

PR A ships the disclosure boundary independently. PR B adds navigation, Home preview, and frontend
prominence only after PR A contracts are available; it must not delay the privacy fix.

## Critical Implementation Notes

1. The boundary is API-first; UI hiding is defense in depth.
2. Protected DTOs omit forbidden fields entirely. Do not represent redaction with zeroes.
3. Profile, Home, and My Network consume one canonical self summary.
4. Reputation math, governance thresholds, vote weights, ranking, and background jobs remain intact.
5. Graph relationship state is qualitative in outward contracts; exact edge weights remain internal.
6. Governance and community exports receive no admin exception for another member's metrics.
7. Provider ratings and anonymous community aggregates remain explicit typed exceptions.
8. Cross-user tests use non-zero sentinel values and inspect the actual response shape.
9. Trust paths, trust cards, invitations, leaderboards, and exports are in scope—not only graphs.
10. My Network is prominent on Home but remains below pending decisions and urgent help actions.
11. No database migration.
12. All changed behavior needs tests first and docs/context/registry feedback-loop updates.

## Carry-Forward / Out Of Scope

- Cleanup-service replacement remains deferred; it is load-bearing scheduled-job plumbing.
- Broader member forget/export implementation remains open; S112 only removes cross-user reputation
  disclosure from community/stewardship exports.
- Demo responder-Home/simulation liveliness remains a later-sprint candidate.
- Mobile-native parity is not part of Sprint 112.
- The onboarding graph moment remains a later UX sprint.
- Recurring CodeQL `js/request-forgery` on `apps/frontend/src/lib/api.ts` is a known browser-baseURL
  false positive; dismiss only with written PR justification if it reappears.
- Remaining moderate dependency alerts are the Expo `tar` chain; keep the exact override.

## Multi-Sprint Arc

- **S109 (done):** Geocoding Cache Hardening & Dependency Hygiene (v11.17.0).
- **S110 (done):** Belonging Graph System research + ADR-081 Proposed (no deploy/version bump).
- **S111 (done):** Belonging Graph System implementation and ship (v11.18.0).
- **S112 (planning):** Belonging & Reputation Truth (target v11.19.0).
- **Later:** onboarding network moment and broader member forget/export work.

---

## Persistent Context

### Active Session (update on every role handoff)

- **Driving agent:** Codex (Sprint 112 planning)
- **Phase:** Planning complete. Approved spec + executable two-PR plan are ready.
- **Branch + files in flight:** `feature/sprint-112-reputation-disclosure-boundary`; planning
  artifacts are committed as the first PR A commit. The working tree is clean.
- **Blockers:** none. Execute PR A first; do not begin PR B until PR A is merged, deployed, and
  validated.

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
- Do not create worktrees; this is a shared, time-sliced checkout.
- Do not make a docs-only follow-up push to `master`; every master push triggers a deploy.

### Demo / Deploy Drift Watch

`karmyq.org` and the demo have drifted from `master` before. Confirm the GitHub Actions deploy
succeeded and live content matches `master` before judging the result. Demo tester:
`maria.reyes@test.karmyq.com` / `password123`.
