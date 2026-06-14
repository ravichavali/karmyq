# Sprint 98 - Trust Truth Audit + Functional Repairs - IMPLEMENTED, pending PR/deploy (v11.7.0)

> **STATUS (2026-06-14):** All 6 named bugs fixed on `feature/sprint-98-trust-truth-audit`,
> committed, tests green, version bumped 11.6.0 → 11.7.0. Pending: open PR → review → merge → deploy
> → post-deploy validation (Task 18 checklist below). The trust-truth repair migration
> (`20260614-trust-truth-repair.sql`) applies on deploy.
>
> **Execution summary (Tasks 1–16 done):**
> - **BUG-098-002** (UUID-cast 500): shared `resolveCommunityContext` + platform sentinel UUID;
>   `/paths`,`/paths/batch`,`/trust-card` no longer send `'platform'` to a UUID column; malformed
>   `X-Community-ID` → 400; responses carry `scope`. **ADR-077** records the platform-wide-topology
>   decision (forced by `help_requests` having no `community_id`).
> - **BUG-098-003** (graph membership): ego + aggregate graphs filter neighbors via `active_neighbors`
>   CTE; full graph already did.
> - **BUG-098-004** (relationship labels): dibs candidate selection requires `cm.status='active'`;
>   provider `shared_communities` already active-filtered; live data was clean (audit checks 4,5 = 0).
> - **BUG-098-001** (frontend context): `useTrustPath`/RequestCard thread `communityId`; localStorage
>   parse guarded.
> - **BUG-098-005** (feed state): "You're caught up" only after widening, never with "Show more".
> - **BUG-098-006** (legacy): unused `getNetwork()` wrapper removed, `/network` marked legacy;
>   343 orphaned exchange connections cleaned by idempotent migration.
> - Audit: `scripts/audit-trust-truth.sql` run on demo; findings in
>   `docs/bugs/sprint-98-trust-truth-audit.md`. Gates: inline code+security review, `npm audit`
>   clean, 29 new TDD tests pass, SG/RS suites + all tsc green.
>
> **This handoff edit is intentionally not pushed standalone** - a docs-only push to `master`
> triggers a redundant full redeploy. It should ride with the Sprint 98 implementation PR.

**Branch:** `feature/sprint-98-trust-truth-audit` (create from `master`).

**Spec:** `docs/superpowers/specs/2026-06-14-sprint-98-trust-truth-audit-design.md`

**Plan:** `docs/superpowers/plans/2026-06-14-sprint-98-trust-truth-audit.md`

---

## Quick Start

1. Read this handoff.
2. Check out branch: `git checkout -b feature/sprint-98-trust-truth-audit`.
3. Open plan: `docs/superpowers/plans/2026-06-14-sprint-98-trust-truth-audit.md`.
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development).

---

## Sprint Goal

Make Karmyq's trust paths, graphs, relationship labels, and normal trust-dependent flows accurate
from DB truth through API responses to the frontend.

---

## Scope

Trust and relationship correctness:

- Live/demo trust data audit and idempotent repair scripts if needed.
- Dashboard "Your Trust Network" people graph.
- Dashboard "Your Trust Network" communities graph.
- Community "How we're connected" Community and My Network subtabs.
- Trust path badges on feed request cards, offers, provider pages, and trust cards.
- Dibs candidate reason copy and relationship context.
- Request/feed relationship scoring inputs where visible copy depends on social proximity.
- Provider directory shared-community labels.
- Legacy `/network` and `socialGraphService.getNetwork()` usage audit.
- Dashboard feed caught-up/show-more state coherence.

Explicitly deferred:

- Broad graph redesign for beauty alone.
- New social features like introductions or endorsements.
- Founding-circle review/notify surface.
- Service consolidation phase 2.
- Mobile parity unless a shared API bug demands it.

---

## Named Bugs / Acceptance Items

### BUG-098-001 - Trust path community context can drift from the visible surface

`useTrustPath()` currently calls `socialGraphService.getTrustPath(targetUserId)` without a
community header. The social-graph route then falls back to `req.user.currentCommunityId` or
`platform`, while the UI may be rendering a specific community, provider page, feed scope, or offer.

Acceptance: every visible trust path fetch either passes the active community context or
intentionally asks for a platform-wide path and labels it as such.

### BUG-098-002 - Missing path community context can 500 before semantics are even reached

`/paths/:targetUserId` and `/paths/batch` fall back to the literal string `platform` when neither
`X-Community-ID` nor `req.user.currentCommunityId` exists. The cache query then compares that value
to `auth.social_distances.community_id`, a UUID column, which can throw a UUID cast error and return
500 before path semantics are reached. Separately, once a valid community ID exists,
`computeShortestPath(source, target, communityId)` builds its adjacency from all completed matches,
but later uses `communityId` for edge scoring and cache keying.

Acceptance: missing community context never produces a UUID cast 500. Then choose and document path
semantics. Preferred: exchange paths are community-scoped when a real community ID is supplied, with
labeled platform fallback only when no community context exists.

### BUG-098-003 - Graph APIs and UI claims may disagree about active membership

Community full graphs read active members for nodes, while ego and aggregate graph queries derive
neighbors from trust edges and may not prove active membership on every endpoint.

Acceptance: audit proves whether graph nodes and edges are active members of the relevant community
context. If drift exists, graph endpoints filter or label it correctly.

### BUG-098-004 - Relationship labels use multiple sources of truth

Provider shared-community labels, dibs reasons, trust badges, trust-card paths, feed scoring, and
graph widgets can all describe "connection" differently.

Acceptance: create a concise relationship semantics table and update code/docs so visible labels
use the correct term: direct exchange connection, indirect exchange path, fellow community member,
invitation connection, shared provider/community context.

### BUG-098-005 - Dashboard caught-up state conflicts with "Show more open requests"

Dashboard Home can show "You're caught up" while also showing "Show more open requests."

Acceptance: the feed chooses one coherent state. If lower-ranked open asks can be revealed, show
"Show more open requests" without saying the user is fully caught up. If the user is genuinely
caught up, do not show the affordance. After expansion, show one finite terminal state.

### BUG-098-006 - Legacy relationship endpoints may still be reachable but no longer authoritative

`/network` and `socialGraphService.getNetwork()` still exist even though current dashboard graph
surfaces use `/trust/graph`.

Acceptance: audit all references. Either confirm/document the endpoint as legacy, or retire unused
frontend methods/routes in a safe follow-up.

---

## Critical Implementation Notes

1. **Audit first.** Do not fix individual trust surfaces before running the DB/API/UI trust audit.
   The likely problem is semantic drift across layers, not one component typo.
2. **Find the root cause before fixing.** Use systematic debugging for each confirmed issue:
   reproduce, trace source data, compare working surfaces, then write the failing test.
3. **Community context is the main suspect.** Every path/badge/graph fix must answer whether the
   relationship is community-scoped or platform-wide and label it accordingly.
4. **Do not make client-side filters hide server truth.** If an API returns misleading relationship
   data, fix the API or explicitly document the historical/platform meaning.
5. **Use decayed trust consistently.** Graph node/edge trust metrics should read from
   `social_graph.trust_edges_live` unless a test proves a different metric is intentional.
6. **Active membership matters.** Any UI phrase that says "in this community" or "fellow member"
   must be backed by active `communities.members` rows.
7. **Cache invalidation matters.** `auth.social_distances` can preserve old path meaning. Include
   cache rows in the audit and clear/recompute only with an idempotent script if needed.
8. **Provider labels are not exchange trust.** Shared provider/community labels should not imply a
   completed help exchange unless the exchange path exists.
9. **Dashboard feed state must be coherent.** "You're caught up" and "Show more open requests"
   should not appear together as competing terminal states.
10. **Robust tests are required.** Prefer DB-backed tests for path and graph invariants. Mock only
   browser rendering and external services.
11. **Live demo validation is required.** Use `maria.reyes@test.karmyq.com` / `password123` as the
   rich tester unless the audit finds a better account.
12. **Version bump:** root `package.json` and `package-lock.json` move `11.6.0` -> `11.7.0`.

---

## Tester Accounts

Primary rich-state tester:

```text
maria.reyes@test.karmyq.com / password123
```

Sprint 97 evidence:

- 15 active communities.
- 28 trust edges.
- 33 connections.
- 19 created requests.
- 418 responder matches.
- 704 requester-side matches.
- 4 provider profiles.
- Provider availability true.

Fallback simpler member tester:

```text
aisha.white6964@test.karmyq.com / password123
```

Previously confirmed as a plain member of Berkeley Community Care
(`ff54a7d5-fe01-45ad-b816-ecf4d3e9ee23`).

---

## Post-Deploy Validation Required

The plan ends with a human checklist:

1. API trust path smoke with `Authorization` and `X-Community-ID`; path type and scope must match
   the semantics table.
2. Graph membership smoke for `/api/trust/graph/:communityId`; nodes/links must match active
   membership rules documented in the bug log.
3. UI flow check as `maria.reyes@test.karmyq.com`: dashboard trust network, community How we're
   connected, feed badges, provider labels, and dibs surfaces must not imply unproven exchange
   trust.
4. Dashboard feed check: "You're caught up" and "Show more open requests" must not appear together.
5. Re-run `scripts/audit-trust-truth.sql` on demo DB; no release-blocking trust truth drift remains
   unless explicitly deferred with rationale.

---

## Multi-Sprint Arc

- **S92 (done):** Matching & Dibs Repair (v11.1.0).
- **S93 (done):** Provider<->Community link-up + carry-forward fixes (v11.2.0, PR #80).
- **S94 (done):** Error Contract Cleanup / ADR-074 (v11.3.0, PR #82).
- **S95 (done):** karmyq.org Multi-Route Relaunch (v11.4.0, PR #83).
- **S96 (done):** Founding-circle backend intake (v11.5.0, PR #84).
- **S97 (done):** Release Readiness Data Quality + Functional Bug Bash (v11.6.0, PR #86).
- **S98 (planned):** Trust Truth Audit + Functional Repairs (v11.7.0).
- **S99+ (deferred):** Relationship UX polish or founding-circle notify/review surface.
- **Deferred:** Service Consolidation Phase 2 - geocoding -> client-side, 10->9 (ADR-071).
- **Deferred to post-rollout:** mobile parity.

---

## Persistent Context

### Multi-agent PR process - live on master

- `.github/pull_request_template.md` = the cross-agent PR contract.
- Master branch protection requires CI checks, 1 approving review, and Admin merge authority.
- Agents do not self-merge or push directly to `master`.
- Every task = one branch = one PR.
- When using `gh pr create`, manually copy `.github/pull_request_template.md` into the PR body.
- Cross-agent review protocol: the agent that did not author a plan/PR reviews it when two models
  are available.

### Architecture Gotchas

- **Landing page docs:** `apps/landing/src/data/docs/` is gitignored - `git add -f` when generated
  docs must be committed. Generated by `scripts/generate-docs.ts`; edit sources, never generated JSON.
- **ADR numbering:** ADR-076 shipped in S96; next free ADR = 077.
- **JWT field** is `communities`, not `communityMemberships`.
- **Schema is `communities.communities`** (plural schema name); auth tables are `auth.*`.
- **API response unwrap:** `createApiClient` interceptor already unwraps the envelope - use
  `res.data`, not `res.data.data`.
- **Error contract (ADR-074):** `{ success:false, message:string, error:string }`; use shared
  `sendError`/`sendValidationError`.
- **CORS on auth-service** is driven by `ALLOWED_ORIGINS` env (comma-separated origins).
- **trust_edges_live is a VIEW:** never INSERT/UPDATE it.
- **`git add` on CLAUDE.md:** tracked as lowercase `claude.md`.
- **Solo dev - no worktrees:** work directly on feature branches.
- **CI security gates:** dependency audit (ADR-059) + CodeQL (ADR-060) run on push.
- **request-forgery FP on `apps/frontend/src/lib/api.ts`** is a known recurring false positive.
- **request-service serves the feed** now (`/requests/feed`); there is no feed-service.

### Workflow Gotchas

- Every sprint runs testing, `/simplify`, `/code-review`, and `/security-review`.
- Every sprint updates docs; do not treat docs as optional.
- No docs-only push to `master`; every master push triggers a full deploy.
- nginx.conf changes take effect on the next deploy (deploy.sh copies + reloads).

### Deploy Drift Watch

`karmyq.org` live content has drifted from `master` before. Confirm the latest deploy succeeded and
live content matches `master` before judging by live content.
