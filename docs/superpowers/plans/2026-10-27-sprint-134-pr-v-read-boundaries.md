# Sprint 134 PR V Read Boundaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make request owner writes opaque, centralize detail visibility and active membership, and page readable requests before list aggregation.

**Architecture:** Reuse `requestReadableSql` for detail and browse. Keep visibility separate from offer eligibility. Use one live membership helper with `(communityId, userId)` arguments. Filter and page request rows in a CTE before joining names and community aggregates.

**Tech Stack:** Express 5, TypeScript, PostgreSQL 15, Jest/Supertest.

**Spec:** [Sprint 134 PR V](../specs/2026-10-20-sprint-134-dated-obligations-design.md#pr-v--read-boundary-follow-ups-docsideasmd-2026-10-19), [IDEAS 2026-10-19](../../IDEAS.md#2026-10-19-request-service-read-boundary-follow-ups-sprint-133-pr-v-306).

## Global Constraints

- Base `origin/master` `47c9a323` (v11.101.0); first commit `1721dc5f` records #320 shipped.
- Dependency lane stays Claude's; only root version bump may change manifests/lockfile.
- No worktrees. One editor; push and clean tree at every stop. Stop at PR creation; Claude reviews.
- Real-SQL integration runs in CI on Windows. Compile imported service source under root tests' strict configuration before push.
- Review response, 2026-10-27: adopt the maintainer's recommended scope: retire `help_offers.is_public` from the offer privacy API and defer both the column drop and composite index. The database column stays inert. No schema changes or demo-host operation in PR V.
- Remove the prepared pair-index migration and pg_indexes integration assertion. Existing indexes remain (`infrastructure/postgres/init.sql:4981`, `:4987`). Revisit the pair only after EXPLAIN on representative data shows a need. CI's drift step precedes all integration tests (`.github/workflows/ci.yml:320`), so the unregenerated migration previously blocked the entire database suite, not just the index assertion.
- Every new query column must be checked against the generated schema; no manual init.sql edit.

## Verified Starting Points (baseline `47c9a323`, before implementation)

- Three request owner-write routes separately check existence and requester, leaking 403/404 (`services/request-service/src/routes/requests.ts:1970`, `:2056`, `:2113`). Other match/provider/admin routes have distinct authorization contracts and are outside this owner-write task.
- Detail combines SQL directed audience and a JavaScript read gate (`services/request-service/src/routes/requests.ts:1608`, `:1673`). The reusable predicate already admits owner, any-status responder, preferred provider and reachable viewers (`services/request-service/src/db/eligibility.ts:87`).
- Existing integration parity matrix exercises live audiences and the three intentional list exceptions (`tests/integration/sprint-133-pr-v-read-boundary.integration.test.ts:101`).
- Inventory membership delegates to getLiveRole with community first (`services/request-service/src/db/inventoryDb.ts:61`); provider membership queries directly with user first (`services/request-service/src/services/providerReachService.ts:74`).
- List aggregation currently precedes LIMIT/OFFSET (`services/request-service/src/utils/queryBuilder.ts:73`). Preserve the community filter's existing narrowed community-name/id aggregates.

## Review Focus

1. A departed responder retains historical read access but cannot offer without current reach: retain the real-SQL parity matrix and explicit lifecycle expectations.
2. Directed requests remain hidden from outsiders even with historical matches: retain the strict directed predicate in the single read boundary.
3. Foreign owner writes, including empty privacy bodies, answer exactly like absent ids and produce no writes/events: Task 1.
4. Community filters and admin notes do not duplicate page rows or discard rows after pagination: Task 3 adds multi-community, notes, pagination integration assertions.
5. Swapped UUID arguments, malformed ids and role-null active rows fail safely: Task 2 covers helper and provider route wiring.

### Task 1: Opaque owner writes and canonical detail SQL

**Files:** `services/request-service/src/routes/requests.ts`; new `services/request-service/tests/tdd/sprint-134-pr-v-read-boundaries.test.ts` (promote when green); existing `services/request-service/tests/regression/sprint-133-request-detail-visibility.test.ts`; existing root read-boundary integration suite.

**Interfaces:** consume `requestReadableSql(alias: string, viewerParam: string): string` and `getRequestReachability(requestId, userId)` unchanged. No new HTTP fields.

- [x] Write and run failing route tests: PUT/DELETE/privacy missing and foreign ids have identical 404 body; authenticated owner succeeds and forged body user_id grants nothing; unauthenticated remains 401. Inspect emitted SQL for bound id + owner on lookup and mutation; no event on denied/vanished row.
- [x] Detail test expects the exact `requestReadableSql('r', '$2')` fragment; no separate any-match/provider read projections. Empty SQL result returns the existing opaque 404. Reachability executes only for an open, unexpired non-owner without a live match, solely to determine `can_offer`.
- [x] Filter owner lookups and mutations by both id and JWT caller; handle zero mutation rows before publishing. Move detail WHERE onto the canonical fragment and delete the JavaScript read gate. Update old mocked tests to model the SQL boundary's returned rows; real SQL remains the authorization arbiter.
- [x] Add CI integration request-write matrix (all three routes, foreign vs missing, no side effects, owner positive controls) to the existing root suite. Execution remains pending CI.
- [x] Run focused tests, promote new suite to regression; compile service and root tests with a changed-path filter. Update request CONTEXT and registry descriptions with the final docs task.

### Task 2: One live active-membership helper

**Files:** `services/request-service/src/db/liveRole.ts`, `src/db/inventoryDb.ts`, `src/services/providerReachService.ts`, `src/routes/{requests,feed,providers,inventory}.ts`; provider unit tests and Task 1 suite.

**Interfaces:** produce `isActiveMember(communityId: unknown, userId: string | undefined): Promise<boolean>` in liveRole, delegating to getLiveRole. Remove both old definitions and import the canonical helper directly everywhere.

- [x] Write/run failing tests for provider route with distinct caller/community UUIDs, malformed community → 403/no SQL, active role-null row → member; update provider helper unit cases to community-first and canonical import.
- [x] Move the inventory definition to liveRole; delete provider copy; update every production/test importer and argument order. Do not re-export a duplicate API.
- [x] Run local provider, live-role, inventory and request boundary suites; existing real-SQL provider-reach and membership matrices remain pending CI.

### Task 3: Page requests before aggregates (index deferred)

**Files:** `services/request-service/src/utils/queryBuilder.ts`; Task 1 suite; existing root integration suite. Delete the previously prepared index migration; leave init.sql unchanged.

**Interfaces:** `buildRequestsQuery(filters: RequestsQueryFilters): RequestsQueryResult` unchanged, same result fields and parameter types.

- [x] Write/run failing query tests for a CTE with visibility, lifecycle and community filters plus pagination before aggregation; all bound parameters remain referenced. Preserve private list, spoofed requester, directed, active-match exclusion, notes and missing-viewer cases.
- [x] Put per-request filtering, ORDER BY and pagination into a candidate CTE; use community EXISTS there and narrow the final community join to the selected community. Aggregate only page candidates; keep final ordering.
- [x] Add real-SQL multi-community/page/admin-note checks and explicit expected audience identities (parity alone could make both paths wrongly agree). They remain unexecuted until CI.
- [x] Remove migration and index assertion; log measured index follow-up in IDEAS. Verify no migration/init.sql diff remains against origin/master.

### Task 3a: Retire the inert offer privacy flag from the API

**Files:** `services/request-service/src/routes/offers.ts`; new workspace `tests/tdd/sprint-134-pr-v-offer-privacy.test.ts` promoted to regression; existing root read-boundary integration suite; context/registry/guide.

**Interface:** `PUT /offers/:id/privacy` accepts only `offerer_visibility_consent`. A legacy `is_public`-only body returns the existing 400 no-settings response for an owner; foreign/absent offers still return identical 404 before body validation. Mixed input updates consent only. Response and event omit `is_public`. Existing offer read audience stays offerer or live community member. Column drop is a later schema PR.

- [x] Write/run failing real-route tests: flag-only request causes no UPDATE/event and returns 400; consent and mixed requests update only consent, omit flag from returned data/event, preserve foreign/absent 404. Use distinct owner/offer UUIDs and mock only DB/event transport.
- [x] Remove flag extraction, SET clause, RETURNING field and event field; retain consent behavior and ownership ordering. Run tests green, promote, and add corresponding CI-only real-SQL cases checking the inert column remains unchanged.
- [x] Remove the redundant preferred-provider mocked case; label responder projection assertions accurately. Historical audience authority remains the root SQL matrix. Fix stale gate comment. Retain the optional DELETE lookup simplification as out of scope for this follow-up.

### Task 4: Decision-dependent offer task, docs, gates and PR

- [x] Resolve the offer decision and append Task 3a before implementation.
- [x] Update request-service CONTEXT, registry API descriptions, IDEAS completion notes and the existing making-requests guide; regenerate landing service/guide pages from source. No new ADR number is needed for centralizing an existing boundary; existing offer read policy is unchanged.
- [x] Bump root version to 11.102.0 and both root lock entries only (re-derive before merge). Prove no other dependency diff.
- [x] Run service tsc, `npx tsc --noEmit -p tests/tsconfig.json` captured to a log and filtered for changed paths (must print nothing); real SQL remains CI-only. Run root tests without Turbo replay, full test graph, staged feedback check and gotcha check.
- [ ] Run simplify/correctness/security passes on the diff, resolve findings, mandatory pre-commit process review, update handoff, commit and push with live hooks. Revert only generator timestamp churn. Leave tree clean.
- [ ] Create PR from the full repository template with validation ledger, CI-only limitations, no-schema-change evidence and remaining human validation. Stop immediately after PR creation; Claude reviews.

## Human Validation (after later authorized deployment)

- As requester, edit/cancel/change privacy and confirm intended behavior; as another caller, foreign and absent ids give identical 404s.
- Browse and open community/sister/wide-scope requests; departed historical helper and preferred provider retain entitled reads, while an outsider cannot read community-only or directed requests.
- Confirm page contents/community notes and consent-only offer privacy behavior. Pair-index query-plan measurement and column drop are separate follow-ups; neither is part of deployment of PR V.
- Separately carry L2's reputation-log validation after the first 02:00 nightly run; deploy health does not prove it.

## Execution Ledger

- Pre-flight: Tasks 1 and 3 consume the unchanged requestReadableSql predicate; Task 2 moves only membership, not the read predicate. No shared interface conflict.
- Ruling: execute inline and have Claude review after PR creation, as the maintainer requested; no worktree and no pre-implementation approval pause for the already authorized scope.
- Historical checkpoint: offer decision and demo-host authorization were pending at `b801152d`. The review response selects API-only flag retirement and index deferral; no demo-host authorization is needed for the resulting PR.
- Task 1/2/3 local implementation: new route/query suite RED (14 expected failures after authentication fixture correction), then GREEN 17/17; focused provider/query run 49/49. New suite promoted from workspace tdd to regression. Existing request-detail mocks now represent SQL-admitted rows; the real audience matrices remain the arbiter.
- Gate adjustment: directedSurfaceScan initially rejected requestReadableSql; a new positive/negative alias/OR test failed first, then passed after recognizing the canonical helper. Re-pinned exactly six reviewed owner-write exception entries to the stronger id+owner SQL. Both gate/body-identity suites passed 12/12.
- Compiler: service tsc exit 0. Root strict tsc exit 2 from existing unrelated diagnostics; changed request-service and integration-path filter printed nothing. Real SQL was not run locally.
- Supporting review: read-only simplify/correctness/security and migration-validator passes found no source blocker. Removed a test-only any cast; tightened the pagination test to require the exact predicate before checking its position (indexOf(-1) must not false-pass). Docs/registry/guide regenerated from source; unrelated generator churn restored.
- Verification checkpoint over `1721dc5f`: full npm test exit 0, 27/27 tasks (24 cached; affected request/root test tasks fresh). Request-service 161 unit + 443 regression with 1 existing DB skip. Direct root test rerun exit 0: 101 unit + 952 regression. Earlier restricted/unconfigured invocations failed shell/network gates; configured reruns supersede them. Exact strict-compiler grep printed no changed-path diagnostics (grep exit 1); gotcha registry clean (13 entries). No real SQL or host operation executed.
- Final focused regression suite 17/17 after strengthening predicate presence. Staged feedback exit 0 (advisory schema reminder intentionally pending separate authorization); whitespace clean. Mandatory process review approved a clean WIP commit/push, not PR completion. User inputs remain pending; no offer policy assumed and no host operation run.

## Review Response (2026-10-27, supersedes the WIP scope)

| Finding quoted from review | Verdict/evidence | Resolution and proof |
|---|---|---|
| "the whole integration job fails, so **none** of PR V's database tests can run" | CONFIRMED: `.github/workflows/ci.yml:320` precedes integration execution | Removed migration/index assertion; `git diff origin/master -- infrastructure/postgres` is empty. Actual SQL execution remains pending CI. |
| "**The composite index: defer it.**" | Scope adopted; existing request-id index in init.sql | Deferred to IDEAS with EXPLAIN on representative data first; no speedup claim. |
| "**`help_offers.is_public`: retire it.**" | CONFIRMED active writer in `offers.ts` privacy route; reads ignore it | Task 3a planned first, then new tests failed 3/4 on old behavior. All four passed after removing flag input/SQL/response/event; consent remains. Column drop deferred. |
| "**A test that can't fail.**" | CONFIRMED admitted mock row proves no provider access | Removed redundant provider mock case; responder matrix now asserts admitted-viewer lifecycle projection, with dead anyMatch fixture removed. Authorization remains root CI matrix. |
| "**Stale comment.**" | CONFIRMED helper moved to liveRole | Fixed gate comment; gate implementation unchanged. |
| "**Optional simplification.**" (DELETE pre-SELECT) | CONFIRMED redundant but correct | Retained existing ownership lookup for this focused follow-up; no behavior change or correctness impact claimed. |
| "formal `/simplify`, `/code-review` and `/security-review` haven't run yet" | Supporting WIP review did not close named gates | Three separate read-only Codex delegated equivalent passes completed (native Claude slash runner unavailable): correctness and security clean; simplify findings ruled below. No GitHub review comments posted. |
| "13 scratch log files" | CONFIRMED by exact workspace-root enumeration | Removed exactly 13 files; new command logs use TEMP. |

- Simplify fix: removed dead anyMatch fixture/misleading status-matrix language and added literal viewer_relation/viewer_match assertions. Targeted suite re-run follows the test-only edit.
- Simplify minor (deferred): the consent-only privacy route retains its existing dynamic UPDATE builder; a fixed statement is optional cleanup. Current binding/behavior is covered; no opportunistic source refactor in this review response.
- Review ruling: pair-index performance and column drop remain deferred by adopted scope; no claim about their runtime benefit. Final handoff/generated-doc cleanup is verified by the parent before push. Existing unrelated offer-write concurrency is unchanged; no new effect was identified in the reviewed scope.
- Compiler after the final source edit: request-service tsc exit 0; exact root strict tsc/grep changed-path filter printed nothing (grep 1); unrelated root diagnostics remain. Gotcha registry clean (13 entries). No local database or demo-host operation ran.
- Final review-response worktree over `b801152d`: forced full graph exit 0, **27/27 tasks, 0 Turbo replay** (Jest cache retained). Request **161 unit + 446 regression, 1 existing DB skip**; root **101 unit + 952 regression**. Final projection/privacy targeted suites **22/22**. Staged feedback exit 0 with docs/registry reminders already satisfied, whitespace clean. Process reviewer found no blocker; its full-suite condition is satisfied.
