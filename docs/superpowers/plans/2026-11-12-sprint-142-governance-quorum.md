# Governance Ratification Quorum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended by the general template) or superpowers:executing-plans to implement this plan task-by-task.
> For this shared working tree, prefer `superpowers:executing-plans` with one editor and a non-author final review.
> Steps use checkbox syntax. Execute in the next chat, not the planning chat.

**Goal:** Require equal-vote ratification by 20% of a nomination's original active electorate, rounded up with a minimum of three, with live membership and atomic role elevation.

**Architecture:** Community-service stores an immutable voter roster and quorum on each new nomination. Database protocol guards fence legacy writers; transactional nomination/vote handlers enforce current membership, nominee eligibility and monotonic role elevation. The existing web tab renders server-owned policy and eligibility.

**Tech Stack:** Canonical stack in `CLAUDE.md` → System Architecture; no dependency changes.

**Spec:** `docs/superpowers/specs/2026-11-12-sprint-142-governance-quorum-design.md` (maintainer approved 2026-11-12).

**Non-author review revision, 2026-11-13:** Findings verified against source; results and quotations are in
CURRENT_HANDOFF.md. Maintainer answer (a) authorizes SSH to karmyq.com for real-DB tests: use an isolated
disposable database/container there for Tasks 2/4/5, with a scratch DB for independently committing cutoff
connections. No guard drops or destructive fixtures in the demo application DB. Answer (b) accepts unreachable
quorum in persona-heavy demo communities. Both pre-Task-2 answers are present. CI runs on the product PR,
not a feature-branch push (`.github/workflows/ci.yml:3-7`).

## Global constraints

- Reuse `agent/claude/sprint-142-planning`; no worktrees, rebase, force push or direct master push.
- `R = max(3, ceil(E / 5))`; E excludes the nominee and is captured once. Never reduce R for departures or cap it to E.
- Snapshot voter IDs; count ballots only from snapshot voters who are currently active. Nomination adds no vote.
- This plan grants no merge/deploy slot, release version, dependency lane, new ADR number or demo operation. Use an amendment to existing ADR-055.
- Preserve the bundled Sprint 141 records from `bc53d728`. They ride with the product PR.
- New workspace tests start in `tests/tdd/`, run red before implementation, then move only this sprint's green files to regression. Read `tests/claude.md` first. Root cross-workspace integration belongs in `tests/integration/`.
- Intermediate commits use focused tests and normal git hooks. `/pre-commit-check` appears once, in Task 11. Run process-reviewer once before opening the product PR.

## Review focus

1. Joining after nomination must not buy a vote; a rejoining original voter is eligible again (Tasks 5, 9).
2. Simultaneous final votes and competing admin/moderator nominations must neither lose votes nor demote an admin (Tasks 5, 9).
3. Binary rollback after migration must reject legacy creation and voting, including duplicate vote retries (Tasks 2, 9).
4. A stale tab, out-of-order community response or rejected vote must not show a successful action in the wrong community (Task 7).
5. Historical metadata, malformed UUIDs and unexpected settings must not become a smaller quorum or leak personal metrics (Tasks 1, 6, 9).

## File map

New paths below are proposed deliverables, not claims that the files already exist. Search before creating and run gotcha discovery for the final paths.

| New file | Responsibility |
|---|---|
| `services/community-service/src/database/governancePolicy.ts` | Pure quorum/role rules, typed errors and policy metadata |
| `services/community-service/tests/tdd/sprint-142-governance-policy.test.ts` | Exact numeric/role invariants; later promote |
| `services/community-service/tests/tdd/sprint-142-governance-migration.test.ts` | Migration declarations/guards; later promote; real proof in root integration |
| `services/community-service/tests/tdd/sprint-142-governance-routes.test.ts` | Real router dispatch, identity and envelopes; later promote |
| `apps/frontend/tests/tdd/sprint-142-governance-quorum.test.tsx` | Real component behavior and action wiring; later promote |
| `tests/integration/sprint-142-governance-quorum.integration.test.ts` | Shipped DB functions, migration replay, real SQL/concurrency |
| `infrastructure/postgres/migrations/20261112-governance-quorum.sql` | Snapshot schema, transition and legacy-writer guards |

| Existing file | Change |
|---|---|
| `services/community-service/src/database/governanceDb.ts` | Transactional creation/voting, viewer-aware reads, typed DTOs |
| `services/community-service/src/routes/governance.ts` | Delegate to scoped DB operations; stable validation/errors |
| `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts` | Classify the new snapshot-voter table as reset; simulation governance remains disabled |
| `services/community-service/tests/regression/sprint-112-governance-export-privacy.test.ts` | Adapt getter signature/fixtures without weakening privacy assertions |
| `apps/frontend/src/components/GovernanceTab.tsx` | Typed policy/progress, eligible actions, inline errors and request lifecycle |
| `apps/frontend/tests/regression/sprint-113-governance-no-nan.test.tsx` | Update fixture to new policy while retaining disclosure assertions |
| `docs/concepts/governance.md`, `docs/guides/admin-community-guide.md` | Explain actual voting flow and transition |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Stewardship guidance |
| `docs/adr/ADR-055-trust-governance-architecture.md`, `docs/adr/README.md` | Dated amendment; no new number |
| `services/community-service/CONTEXT.md`, `services/registry.json` | Contracts and behavior |
| `infrastructure/postgres/init.sql` | Regenerated schema artifact |
| `apps/landing/src/data/docs/` | Only generated pages/indexes affected by source docs |
| `.claude/handoff/CURRENT_HANDOFF.md` | Rolling task, verification and authorization state |

Read `CLAUDE.md`, community-service `.claude/README.md` + `CONTEXT.md`, `apps/frontend/claude.md`, `infrastructure/claude.md`, `apps/claude.md`, `tests/claude.md` and relevant gotchas before editing their scopes. Global rules win over stale local examples about schema generation, dependency hoisting or response unwrapping.

## Critical implementation notes

1. `R = max(3, ceil(E / 5))`; E excludes the nominee and is captured once. Never reduce R for departures or cap it to E.
2. Snapshot voter IDs; count ballots only from snapshot voters who are currently active. Nomination adds no vote.
3. Lock the nomination and relevant membership rows before finalization; recheck active nominee and existing private trust eligibility inside the transaction.
4. Legacy pending nominations close once; preserve resolved history and ballots. Rerunning migration must preserve new policy nominations.
5. Keep ADR-082 identity/coarse eligibility disclosure. Trust metrics and the full voter roster never leave the API.
6. Root integration config discovers `tests/integration/*.integration.test.ts`; service-local integration tests alone do not supply CI coverage.
7. Keep simulation governance actions disabled. No demo grant/check, merge, deploy, version bump, dependency lane or new ADR number is authorized.
8. `init.sql` and landing JSON are generated artifacts. Regenerate from source and remove unrelated churn; no hand edits.
9. Database protocol guards fence the legacy writer before containers restart; binary rollback leaves governance writes closed. Preserve history and unrelated membership operations.
10. Ratification only elevates roles; same/lower-role nominations fail. Lock nominee membership for update before granting, with deterministic ordering across all membership locks.

## Task 1: Pin the policy with failing tests, then implement the pure rules

**Files:** Create policy module + policy TDD file from the map.

**Interfaces:** Produce `GOVERNANCE_QUORUM_POLICY = { version: 1, percentage: 20, minimum: 3 } as const`; `requiredRatifications(electorateSize: number): number`; `canElevateRole(currentRole: string, targetRole: 'admin' | 'moderator'): boolean`; `GovernanceError extends Error` with readonly `status: number`, `code: string`. No SQL or HTTP dependency in this module.

- [ ] Verify branch/clean tree, fetch origin, read live PRs and merge newer master only if needed. Reuse branch; pause for cross-agent conflicts rather than resolving another agent's work.
- [ ] Write tests importing the proposed module. Assert `[0,1,2,3,10,15,16,50,149] → [3,3,3,3,3,3,4,10,30]`; negative, fractional, NaN and infinite E throw `RangeError`. Assert member→moderator/admin and moderator→admin true; admin→moderator/admin, moderator→moderator and unknown roles false.
- [ ] Run red: `npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-142-governance-policy.test.ts --runInBand --no-cache`. Expect missing module/export.
- [ ] Implement signatures and exact formula; minimum-three refusal belongs in the DB writer, not in this arithmetic helper.
- [ ] Run the same command green. Commit the focused change with normal hooks.

## Task 2: Add schema and a fail-closed legacy-writer fence

**Files:** Create migration + migration TDD file; begin root integration file; regenerate `init.sql` after migration proof.

**Interfaces:** Produce `quorum_policy_version`, `electorate_size`, `governance_nomination_voters(nomination_id,user_id)`, named partial pending uniqueness, and guards requiring transaction-local `app.governance_policy_version = '1'` on nomination/ballot inserts and transition to ratified. Version-1 inserts require metadata; historical resolved rows can retain NULL metadata.

- [ ] Write failing schema assertions and the named `legacy replay rolls back guard removal` fixture: BEGIN; drop installed named guards; insert legacy pending/resolved rows and ballots; run migration; assert only legacy pending withdrawn, resolved_at set, ballots/history retained and version-1 pending preserved; ROLLBACK in finally restores the original guards/data. CI already installed the guards before tests (`ci.yml:317-326`). Test duplicate pending tuple raises the named constraint. Read migration 009 and actual schema before fixture SQL.
- [ ] Run focused migration tests red before adding migration. Root real-DB tests require a disposable authorized DB; no test writes to `karmyq_prod`.
- [ ] Implement one atomic DO block containing schema changes, LOCK TABLE, legacy close and guard functions/triggers. No top-level BEGIN/COMMIT or LOCK TABLE in the file: apply-migrations.sh:83-90 wraps it, while ci-apply-full-schema.sh:90-105 autocommits after stripping file wrappers. Keep definitions rerunnable, including schema-identical replay over regenerated init.sql. Guard INSERT even with ON CONFLICT DO NOTHING. No trigger on generic membership updates.
- [ ] Prove the exact old creation/vote SQL sequence is rejected without marker after migration and simulated binary rollback; neither role nor ballot changes survive. The two-connection `legacy transaction finishes before cutoff` fixture runs in a scratch DB on the authorized demo host: commit guard removal only there, hold an old transaction open while migration waits on the second connection, then prove cutoff. In finally reapply and verify all guards before deleting the task-owned scratch DB/container. Never drop live application guards. Integration maxWorkers is 1 (`tests/jest.integration.config.js:51`); isolation still comes from the scratch DB.
- [ ] Query `pg_roles` for current_user/rolsuper/rolbypassrls and record them. CI/test services use the postgres image initialization superuser (`tests/docker-compose.test.yml:16,56`), so RLS is bypassed: prove isolation using explicit community_id predicates and foreign-community tests. Preserve same-client DB context; do not claim RLS supplied denial. Regenerate init using the canonical workflow/script and prove zero schema drift after replay.
- [ ] Add `'communities.governance_nomination_voters': 'reset'` to `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts`. Run `npm exec --workspace=services/simulation-service -- jest --runTestsByPath tests/regression/sprint-141-table-policy-covers-init-sql.test.ts --runInBand --no-cache` after regeneration; prove an unclassified table would still fail. Add accurate simulation CONTEXT/registry documentation for the reset classification, without enabling actions.
- [ ] Green proof: `npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-142-governance-migration.test.ts --runInBand --no-cache` and root integration command from Task 9. Run migration-validator before the schema commit. Commit with focused evidence; no claim of DB success without a real run.

## Task 3: Define route contracts with failing tests

**Files:** Create service route TDD file; extend root integration fixture.

**Interfaces:** DB functions in Tasks 4–6 accept server-derived caller/community IDs. HTTP request bodies remain `{ nominated_user_id, role }` and empty ratify body. Clients never supply electorate, quorum, policy version or effective caller ID.

- [ ] Mount the real router with controlled authentication and DB-operation boundaries. Pin path community and JWT userId forwarding; own/foreign `communityId`, missing identity, malformed UUID/role, active/non-active membership and stable ADR-074 error shape. Test injected body quorum/electorate/userId cannot influence operation inputs.
- [ ] Pin 201 creation metadata, 200 vote metadata, 403 voter denial, 404 foreign/missing nomination, 409 duplicate/closed/same-or-lower role, 422 small electorate/nominee ineligibility. Self-ratification stays 422 with `GOVERNANCE_SELF_RATIFICATION`. No personal score in any denial.
- [ ] Run red: `npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-142-governance-routes.test.ts --runInBand --no-cache`. Expected contract failures, not a DB connection error. Commit red tests as intermediate TDD work if needed; do not push until blocking tiers pass.

## Task 4: Create nominations from one fixed electorate

**Files:** Modify `governanceDb.ts`; use policy module and root integration tests.

**Interfaces:** Export `createNomination(input: { communityId: string; nominatorId: string; nominatedUserId: string; role: 'admin' | 'moderator' }): Promise<{ id: string; quorum_policy_version: 1; electorate_size: number; required_ratifications: number }>`.

- [ ] Before code, add red real-DB cases for inactive/nonmember nominator and nominee, nominee trust denial, too-small electorate, excluded nominee, no automatic ballot, duplicate creation, same/lower-role denial and injected client values.
- [ ] On a checked-out pool client: BEGIN, transaction-local identity/community context and marker, community existence; lock only nominator + nominee rows ORDER BY user_id FOR NO KEY UPDATE and check active status, private nominee trust and role elevation. Capture roster once without locking all voters; persist exactly those IDs/metadata; compute R with Task 1. Roll back E<3 with `GOVERNANCE_ELECTORATE_TOO_SMALL`. Map 40P01 to rollback plus 503 `GOVERNANCE_RETRY`.
- [ ] Handle named unique-constraint violations as `GOVERNANCE_DUPLICATE_NOMINATION`; rollback and release the client on every failure. Never expose SQL text or trust amounts in public errors.
- [ ] Run the creation integration group green, plus policy test. Commit focused creation implementation.

## Task 5: Serialize votes, live tallies and role elevation

**Files:** Modify `governanceDb.ts`; extend root integration tests before code.

**Interfaces:** Export `addRatification(input: { communityId: string; nominationId: string; ratifierId: string }): Promise<{ ratified: boolean; ratification_count: number; required_ratifications: number }>`.

- [ ] Write red cases: duplicate vote idempotent while pending; nominee cannot vote; later join cannot vote; original departure stops counting; original voter reactivated via the real staff PUT status active regains eligibility; new member without snapshot row still refused. R is unchanged. Do not test a fictional self-service rejoin path; its existing 500 is separately logged, outside scope.
- [ ] Write two-connection tests: simultaneous votes around R; concurrent duplicate same-voter requests; member departure vs final vote; nominee removal vs final vote; admin and moderator nominations finalizing together. Assert actual ballots/status/role, not just HTTP success. Use explicit barriers and bounded waits, not sleeps to assume overlap.
- [ ] Implement BEGIN/context/marker, path-scoped nomination FOR UPDATE, pending/version rechecks; exact membership lock set is the nominee plus every snapshot voter row in that community, active or inactive, ORDER BY user_id FOR NO KEY UPDATE. No SHARE→UPDATE upgrade. Check caller snapshot/active membership, unique ballot insert, recount only active snapshot ballots, recheck nominee and atomically grant/close. Closed retries are 409. Roll back on every failed finalization. Existing last-admin guards lock multiple admins without ORDER BY (`members.ts:407-409,514-516`); map 40P01 to 503 `GOVERNANCE_RETRY`, and test a last-admin mutation/final-vote overlap yields valid serialization or retryable refusal without partial changes.
- [ ] Prove no role mutation or current ballot survives a failed nominee eligibility check, stale status or injected DB error. A previous accepted ballot remains. Completed grants are not retroactively revoked when someone later leaves.
- [ ] Run voting/concurrency integration groups green, no mocks of shipped SQL. Commit focused vote implementation.

## Task 6: Project viewer-aware state and wire the HTTP boundary

**Files:** Modify DB getter, real router and Sprint 112 privacy regression.

**Interfaces:** Export `getGovernanceState(communityId: string, viewerId: string): Promise<GovernanceState>` and exported DTO types from `governanceDb.ts`. Preserve existing identity/coarse eligibility/maturity/role-holder fields. Top-level `can_nominate: boolean` is false when fewer than three other active members exist. Settings add `quorum_policy`; nominations add `electorate_size`, `quorum_policy_version`, `viewer: { can_ratify: boolean; reason: 'eligible' | 'nominee' | 'already_ratified' | 'not_in_electorate' }`. Retain `required_ratifications`; count and ratifiers both use the live tally predicate.

- [ ] Write red GET tests proving active caller authorization, consistent count/ratifier list, viewer-specific eligibility, no full voter roster and no personal trust/karma values. Test empty nominations, historical nullable metadata and malformed settings. Bad new-policy metadata must fail closed, never default to a lower quorum.
- [ ] Search every consumer of settings.quorum_size and all DB function call sites. The checked baseline includes `governance.ts` and the Sprint 112 regression for DB functions; frontend GovernanceTab consumes the numeric setting. Update real consumers; retain an explicitly legacy settings field only if necessary for a verified consumer. Do not change simulation weights.
- [ ] Wire routes to Tasks 4–5 with server-derived identity. Validate UUIDs, role and authentication early; map typed denials to ADR-074; log unexpected errors server-side with a route tag and return generic 500 `INTERNAL_ERROR`.
- [ ] Update privacy fixture to call the getter with viewer ID; retain its `assertNoForbiddenReputationKeys` and schema assertions. Test all touched denial status/code pairs, including `GOVERNANCE_ROLE_ALREADY_HELD`.
- [ ] Green: service route TDD suite + `npm test --workspace=services/community-service`; root route integration cases. Commit the read/API implementation.

## Task 7: Show policy, progress and actionable eligibility in the existing tab

**Files:** Modify GovernanceTab and Sprint 113 fixture; create frontend TDD file.

**Interfaces:** Consume Task 6 DTO shape through existing `communityService` methods in `apps/frontend/src/lib/api.ts:352-362`. Response interceptor already unwraps one envelope; component consumes `res.data`. Keep a local frontend interface matching the DTO; no shared-package or API-client refactor required.

- [ ] Write tests mounting the real component with production-shaped res.data. Assert policy/E/R, no voting for nominee/already-ratified/late joiner, working eligible vote. Assert no nomination controls when can_nominate=false and minimum-three explanation. Use role_holders: admin has no target role; moderator can be nominated only for admin; member for either. Assert actual existing API argument signatures and refusal-refresh handling.
- [ ] Test loading/fetch failure, inline creation/vote refusal, repeat clicks while a request is pending, refresh after success and stale-community responses. Change community while requests are unresolved; neither old state nor success/error may overwrite the new view. Preserve identity-only content and no-NaN assertions.
- [ ] Run red: `npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-142-governance-quorum.test.tsx --runInBand --no-cache`.
- [ ] Implement in the existing layout: policy copy, per-nomination E/R, typed viewer state, busy buttons, accessible inline errors and guarded request lifecycle. Preserve graceful error retry and coarse eligibility.
- [ ] Run new suite green and `npm test --workspace=apps/frontend`; adapt the Sprint 113 fixture only to the new contract. Commit focused UI work.

## Task 8: Explain the policy and transition in source docs

**Files:** Concept, admin guide, onboarding, ADR-055 + index, generated landing files in map.

- [ ] Add Stewardship → Decisions guidance in `docs/guides/admin-community-guide.md`: voters, 20%/min3, fixed roster, live tally, staff reactivation through PUT status active, size limit and legacy resubmission. Do not promise self-service rejoin. Explain the accepted persona-heavy-demo quorum limitation; simulation governance remains disabled.
- [ ] Update governance concept with examples E=10→3, E=50→10 and E=149→30. Remove inaccurate role-holder-only wording; separate implemented behavior from aspirations about rotation/delegation. Do not assert automatic role rotation works without tracing its writer.
- [ ] Amend existing ADR-055 with this dated decision and bounded rollout/rollback behavior. Reconcile its index status from source (baseline index says Accepted while ADR says Implemented); do not allocate a new ADR number. Add concise stewardship onboarding copy.
- [ ] Run `npm run generate-docs --workspace=apps/landing`. Inspect semantic differences; keep affected source-derived JSON and restore only unrelated build metadata, architecture dependencyGraph and ADR-010 line-ending churn. Existing ADR slug is already grouped (`scripts/generate-docs.ts:482`); verify before changing nav source arrays.
- [ ] Verify source/generated parity with landing tests and doc drift gate in Task 11. Commit docs with normal hooks.

## Task 9: Finish real integration proof, context and enforced regression placement

**Files:** CONTEXT, registry, root integration, sprint TDD→regression paths, generated init artifact.

- [ ] Document new nomination/vote/read fields, refusal codes, policy guards, live-count rules and small-community limit in community CONTEXT and the three registry governance entries (`services/registry.json:265-277`). Keep version/dependency manifests unchanged pending authorization.
- [ ] Finish root integration cases from Tasks 2, 4–6; import the shipped DB functions using their configured real pool and service router, not copied production SQL. Keep fixtures isolated in two communities with exact expected identities/counts and cleanup. Include scoped DB context on fixture/test transactions.
- [ ] Run `npm exec --workspace=tests -- jest --config jest.integration.config.js --runTestsByPath integration/sprint-142-governance-quorum.integration.test.ts --runInBand --no-cache` using an SSH tunnel to the authorized demo-host disposable DB. Record current_user/rolsuper/rolbypassrls, explicit-predicate isolation proof, migration state, SHA, exit and limitations. Feature-branch pushes do not run CI; repeat in product-PR CI. Do not count a skip/passWithNoTests as DB proof.
- [ ] Promote only the four new service/frontend test files after green focused runs; grep for stale TDD-path references and run promoted files directly without cache. Leave unrelated WIP suites alone, including Sprint 67's deferred suite. Verify `.github/workflows/ci.yml` still discovers the root integration file without adding a second service-local runner.
- [ ] Re-run migration from clean and populated state, prove generated init convergence via the existing schema pipeline, and record destructive transition counts for later authorized deploy review. No live demo query or mutation is implied here.
- [ ] Commit integration/context/regression completion. Record test evidence against the exact tested revision; do not mark the sprint shipped.

## Task 10: Review the complete product diff

**Files:** Full branch diff and any justified corrections; no new scope.

- [ ] **Testing:** Confirm focused red→green evidence and complete unit+regression evidence; distinguish cached tests, real DB runs and WIP reports. Verification: no uncovered accepted policy rule in the spec-to-test matrix; real integration passed.
- [ ] **`/simplify`:** One calibrated full-PR pass. Verification: simplify findings resolved or justified in the PR ledger.
- [ ] **`/code-review`:** Non-author review of authorization, locking, protocol fence, migration replay and UI race handling. Verification: correctness findings fixed; focused tests rerun after code fixes.
- [ ] **`/security-review`:** Review live membership, foreign-community access, request identity, trust disclosure and rollback. Verification: real findings fixed; dismissals carry a written justification. CI dependency audit/CodeQL still gate the PR.
- [ ] Run process-reviewer once on the full branch before PR creation; preserve its findings and the exact evidence it assessed. No per-task process-reviewer or repeated full verification without a new reason.

## Task 11: Final verification, feature-branch push and product PR

**Files:** Final handoff, staged product diff, PR body from template.

- [ ] Obtain maintainer allocation before any release version change; otherwise explicitly leave version unallocated and record that it is a merge-readiness blocker. Fetch/inspect master and open PRs again. Merge a changed master, never rebase; pause on cross-agent conflicts.
- [ ] Type-check changed workspaces: `npm run type-check --workspace=services/community-service` and `npm exec --workspace=apps/frontend -- tsc --noEmit`. Run unit+regression as part of the final check below; no broad test repeat without new changes/failure.
- [ ] Update handoff with next unchecked task, spec/plan/product PR, blockers, review results and commit-specific evidence. Stage exactly intended files, including promoted tests and generated artifacts.
- [ ] Invoke **`/pre-commit-check` once**: `bash scripts/pre-commit-check.sh`. It runs the full tests and requires tree/index stability. If docs tests regenerate artifacts, use its printed snapshot recovery, preserving pre-staged work, then retry once per the skill. Retain normal pre-commit feedback and pre-push hooks; never bypass them.
- [ ] On success, commit, then push only this feature branch with normal hooks. Record the hook's actual test graph, WIP status, cache, DB limitations and SHA in the PR ledger. Do not claim the pre-commit parent SHA tested the later commit.
- [ ] Open one product PR, copying every section of `.github/pull_request_template.md`; Lane is `codex` if Codex implements. Explain bundled Sprint 141 post-merge records. Record security dismissals as None unless actually authorized/performed, and all remaining authorization blockers.
- [ ] Reconcile handoff against live PR state before the final push that precedes PR creation; use the known URL if branch PR exists. Stop this execution chat at PR creation; no CI watch, merge ask, deploy or post-merge ops in that chat. Next actor reads live PR state first.

## Task 12: Maintainer/authorized orchestrator follow-on — merge and deploy

This is a later session, not automatic continuation after Task 11. It exists because this product must deploy; it conveys no authorization.

- [ ] Read live PR checks, full Actions run conclusion/job count, master/deploy state and handoff. Obtain the maintainer's merge/deploy slot and release-version allocation. Only authorized Claude/orchestrator executes a merge; contributor agents never self-merge.
- [ ] Use the `deploy`/`ship` skills as applicable after authorization. Confirm the pending-nomination transition and fail-closed rollback behavior are approved for this particular deployment; use DB user `karmyq_prod` for any separately authorized demo data operation. Never re-enable the simulation governance weights as part of this release.
- [ ] After merge, verify deploy/health and master CodeQL alerts. Any demo write or granting smoke test needs its own authorization; do not create live nominations/votes casually. Prefer automated disposable-DB proof plus authorized read-only policy rendering checks.
- [ ] The platform-admin grant and its granted-account 200 smoke check remain separate and unauthorized until the maintainer picks the account and authorizes the operation. Version bump, ADR numbers and dependency ownership cannot be inferred from this plan.
- [ ] Update/archive handoff on the next authorized feature branch; no docs-only master push. Only the orchestrator marks the sprint complete after verified deployment.

## Planning self-review

Spec coverage: schema/rollout → Task 2; policy → Task 1; creation → Task 4; voting/concurrency → Task 5; API/disclosure → Tasks 3/6; UI → Task 7; source/generated docs → Task 8; root integration + context → Task 9; all four gates → Task 10; final verification/PR → Task 11; authorization-bound deploy → Task 12.

The critical notes above match the approved spec. Public function signatures are defined where produced and consumed by later tasks; Task 6 must update the existing Sprint 112 direct caller. No task enables simulation governance, allocates a shared resource, or treats planning approval as deploy authorization.
