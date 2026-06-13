# Sprint 97 Release Readiness Bug Log

**Date opened:** 2026-06-13
**Release target:** v11.6.0
**Primary tester:** `maria.reyes@test.karmyq.com` / `password123`
**Fallback tester:** `aisha.white6964@test.karmyq.com` / `password123`

## Release-Critical Flow Checklist

- [ ] Signup/login
- [ ] Join existing community
- [ ] Create community
- [ ] Dashboard membership bootstrap
- [ ] Create request
- [ ] Browse feed + Show more terminal state
- [ ] Dibs/matching
- [ ] Provider offers
- [ ] Community Home/People/Connected/Stewardship
- [ ] karmyq.org -> karmyq.com/docs handoff

## Findings

| ID | Severity | Area | Finding | Decision |
|---|---|---|---|---|
| BUG-097-001 | High | Dashboard | False no-community state before memberships finish loading. | Fix |
| BUG-097-002 | High | Community pulse | Recent helper names can include non-members of the displayed community. | Fix |
| BUG-097-003 | Medium | Feed | Widened feed lacks clear terminal copy. | Fix |

## Audit Findings (scripts/audit-demo-data.sql)

Run against the live demo DB (`karmyq-postgres`, db `karmyq_prod`) on 2026-06-13 via
`scripts/audit-demo-data.sql` (read-only). Follow-up verification queries (community-status
distribution, split/merged active-member counts) were run ad hoc; their results are inlined below.

### 1. Membership-count drift (current_members vs active member rows) — REAL, repair in Task 8

10 communities report a `current_members` higher than their active member rows. All are
S77 fission parents whose membership was capped at the 150 Dunbar limit (S87) without resyncing
`current_members`. The stored counter lies on the community page:

| Community | current_members | active rows |
|---|---|---|
| PDX Home Repair & Trades | 284 | 150 |
| Portland Tool Library & Share | 263 | 150 |
| Portland Tutors Network | 263 | 150 |
| PDX Service Providers Network | 241 | 150 |
| Southeast PDX Helpers | 236 | 150 |
| PDX Parents Co-op | 227 | 150 |
| Portland Mutual Aid Network | 214 | 150 |
| PDX Rides Collective | 204 | 150 |
| Northeast PDX Community Circle | 192 | 150 |
| Marin Mutual Aid | 161 | 150 |

**Decision:** Idempotent repair migration (Task 8) resyncs `current_members` to active member rows.

### 2. Pulse helpers who are not active members of the pulse community — REAL, fixed by BUG-097-002

186 distinct `(community, helper)` pairs in the trailing 7-day window name a helper who is **not**
an active member of the community whose pulse would render them (e.g. `Wei Zhao`, `David Park`,
`Leila Sato` appear across many communities they don't belong to). Pervasive, not the single
reported case. Fixed at the query layer in Task 5 (no data repair needed).

### 3. Open requests with no *active*-status linked community — FALSE ALARM, not a bug

The audit query flagged 730 open requests whose linked community is not `status='active'`. On
verification this is **not** a real visibility bug:

- `split`/`merged` communities still hold full active membership (150 active rows in most cases;
  `split` communities total 2,783 active member rows, `merged` 165).
- The request feed / browse queries in `services/request-service` do **not** filter requests by
  community status — visibility is via `request_communities` → the member's community, regardless of
  the community's `active|split|merged` lifecycle status.
- So those requests remain visible to the active members of the split/merged communities.

The `c.status='active'` predicate in audit query #3 is simply stricter than the application. Left in
the script as a lifecycle-hygiene signal, but **no fix and no data repair required for release.**

### 4. Rich tester ranking (top @test.karmyq.com accounts) — confirms primary tester

`maria.reyes@test.karmyq.com` is the best holistic rich-state tester: 15 active communities,
28 trust edges (weight 322), 33 connections, 19 requests, 420 responder matches, 704 requester-side
matches, 4 provider profiles, **provider available = true** (the only top-ranked account with
provider availability on). `raj.liu8683` sorts #1 purely on a 1,175 requester-match volume but has
no provider availability and far less trust, so `maria.reyes` remains the primary tester per plan.

## helpedThisWeek semantics decision

Adopted the **member-only** semantics (plan's preferred option): both `recentHelpers` and the
`helpedThisWeek` / `exchanges_completed_week` count are scoped to completed matches whose responder
is an active member of the pulse community. This guarantees the pulse can never say "N neighbours
helped each other this week" while naming zero qualifying member helpers — the count and the names
now derive from the same active-member subset. See Task 5.

## DB repair decision

One idempotent repair migration created for Finding 1 (membership-count drift):
`infrastructure/postgres/migrations/20260613-demo-data-quality-repair.sql` (data-only UPDATE, no
schema change — mirrors the proven `20260605-fusion-member-count-backfill.sql` recompute, re-applied
because the S87 150-member cap drifted the counter after that backfill ran). No repair for Findings
2 (code fix) or 3 (false alarm). Applied via the deploy migration path; re-verified by re-running
`scripts/audit-demo-data.sql` post-deploy (Task 14).

## Final Status (implementation)

| Item | Status |
|---|---|
| BUG-097-001 dashboard false zero-community state | Fixed + tested (`sprint-97-dashboard-community-load.test.tsx`) |
| BUG-097-002 pulse non-member helpers | Fixed + tested (`sprint-97-community-pulse.test.ts`); verified read-only on demo DB |
| BUG-097-003 feed terminal state | Fixed + tested (`sprint-97-feed-terminal-state.test.tsx`) |
| Finding 1 membership-count drift | Idempotent repair migration `20260613-demo-data-quality-repair.sql` (applies on deploy) |
| Finding 3 orphaned open requests | False alarm — no action |
| helpedThisWeek semantics | Member-only (count matches named helpers) |

Verification: frontend `tsc` clean; request-service `tsc` clean; frontend unit+regression 62 pass;
request-service unit+regression 152 pass; 3 new sprint-97 tests pass; landing build green; npm audit
0 vulnerabilities. The 6 failing frontend TDD suites (trust-model, useTrustQuestions, sprint-38/39/40,
sprint-85) are pre-existing (confirmed: sprint-85 fails identically on HEAD) and in the can-fail TDD
tier — not introduced by this sprint.

## Tester Account Evidence

`maria.reyes@test.karmyq.com`: 15 active communities, 28 trust edges, 33 connections, 19 created
requests, 420 responder matches, 704 requester-side matches, 4 provider profiles, provider
availability true. (Planning estimated 418 responder matches; the live audit returned 420 — the
figure used here.)
