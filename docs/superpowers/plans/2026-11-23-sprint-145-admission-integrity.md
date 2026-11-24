# Sprint 145: Admission Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **Subagent models:** implementers and per-task reviewers run on `sonnet` (`haiku` for a
> one-file mechanical task); only the final whole-branch review runs on `opus`. Pass the
> model on every dispatch; SDD's fix-loop escalation still applies.

**Tags:** `no-deploy`

**Goal:** Fix BUG-106 and BUG-108 so invitation acceptance and duplicate-create joins enforce live
membership state and atomic capacity, with truthful responses and no partial invitation effects.

**Architecture:** Keep the operations in their owning services, with no schema or shared-package change.
Social-graph gains one focused acceptance transaction module; community-service keeps its existing transaction
wrapper and reuses its membership classifier/capacity helper in the duplicate-create branch.

**Tech Stack:** The canonical stack in [CLAUDE.md](../../../CLAUDE.md), System Architecture.

**Spec:** [Approved design](../specs/2026-11-23-sprint-145-admission-integrity-design.md).
D1–D3 and the revised design were explicitly approved by the maintainer on 2026-11-23.

## Global constraints

- Reuse `agent/claude/sprint-145-planning`; planning started at `cd8b973a`, based on master `71773476`.
  No worktrees, rebase, force-push or direct master push. Implementation belongs in the next chat.
- No version, merge, deploy, demo database access, remote disposable test infrastructure, dependency/lockfile
  change, new ADR allocation or repository setting is authorized. PR CI's isolated test database is the available
  DB proof path; do not provision remote infrastructure or connect tests to demo data.
- D1: active invitee gets a no-write 200, unconsumed code, `already_member: true`, `accepted_at: null`.
  D2: an invitation promotes pending to active ordinary member with capacity validation.
  D3: any live active member can admit someone to a private community without admin approval, subject to
  capacity and blocked-state checks. D2's old admin notification can become stale; no notification cleanup.
- BUG-107 direct-add consent and BUG-109 generation authorization/stat inflation stay open and outside implementation.
- No counter assignments, recounts, migrations, generated init.sql edits, new events or shared admission abstraction.
- Tests start in the changed workspace's `tests/tdd/`, then this sprint's green files are explicitly moved to
  `tests/regression/`. Root cross-service DB proof goes directly in `tests/integration/*.integration.test.ts`.
  `.npmrc:4` sets `ignore-scripts=true`: npm does not run posttest promotion or landing prebuild generation.
  Do not run the promoter over unrelated WIP files.
- Keep intermediate commits and normal hooks. Update the handoff with task/state/SHA/evidence after at most
  three tasks and before any long suite or subagent review; record what is being awaited.
- The execution PR must copy every section of [.github/pull_request_template.md](../../../.github/pull_request_template.md)
  and list bundled `docs(process)` commits **30b1823e** and **cd8b973a**, their purpose, and why they ride with this PR.

## Review focus

| Failure mode | Owning tests |
|---|---|
| Null/array/numeric/blank code or missing identity becomes SQL/500 instead of validation/401 | Task 1 route cases; Task 3 early-refusal adapter |
| NULL stored status is confused with no membership; differently cased UUID identity misses self/bound checks | Task 1 helper and real-DB fixtures |
| A lost INSERT race reports success for a pending/blocked winner, or writes invitation attribution after refusal | Tasks 1/4 conditional-write cases and DB interleavings |
| Rollback failure returns a damaged social client; post-commit token refresh invents membership | Tasks 1/2 client cleanup; Tasks 4/5 missing refreshed-membership case |
| Real same-inviter repeat admission collides with historical invitation uniqueness and hides the recovery route | Tasks 1/4 DB history cases; Task 8 joining guide |

## File map

New paths below were searched before planning; existing paths were read from source. New helper/test names are
planned interfaces, not claims that these files already exist. Do not add a second transaction abstraction.

| Create | Responsibility |
|---|---|
| `services/social-graph-service/src/services/invitationAcceptance.ts` | One checked-out-client acceptance operation, typed outcomes/errors and cleanup |
| `services/social-graph-service/tests/tdd/invitationAcceptance.test.ts` | Client/SQL boundary tests for the real acceptance module; later promote |
| `services/social-graph-service/tests/tdd/sprint-145-invitation-routes.test.ts` | Real router validation/envelope/rollback adapter cases; later promote |
| `services/social-graph-service/tests/tdd/sprint-145-live-role-client.test.ts` | Default pool and explicit transaction-client use; later promote |
| `services/community-service/tests/tdd/sprint-145-duplicate-create.test.ts` | Real router membership matrix, token outcomes and transaction boundary; later promote |
| `apps/frontend/tests/tdd/sprint-145-admission-feedback.test.tsx` | Existing pages' acceptance/create success/refusal plus one defensive D1 case; later promote |
| `tests/integration/sprint-145-admission-integrity.integration.test.ts` | In-process real JWT routes, real SQL/triggers, exact rollback/history/count and forced races |

| Modify | Change |
|---|---|
| `services/social-graph-service/src/database/liveRole.ts` | Optional Queryable client, pool default |
| `services/social-graph-service/src/routes/invitations.ts` | Replace accept handler only with the transaction operation and ADR-074 errors |
| `services/community-service/src/routes/communities.ts` | Existing identity-match admission transaction and truthful refreshed token/role handling |
| `services/community-service/tests/regression/sprint-144-capacity.test.ts` | Adapt SQL fixtures to live locked reads; retain capacity/count assertions |
| `apps/frontend/src/pages/invite/[code].tsx` | Minimal defensive no-bond branch after session refresh |
| `docs/guides/joining-karmyq-guide.md`, `docs/guides/finding-communities-guide.md`, `docs/guides/admin-community-guide.md` | Admission outcomes, same-inviter limitation and private authority/trade-off |
| `docs/concepts/community-identity.md`, `docs/adr/ADR-062-community-identity-idempotent-creation.md` | Lifecycle-aware duplicate-create contract; preserve historical evidence |
| Both affected services' `CONTEXT.md`, `apps/frontend/CONTEXT.md`, `services/registry.json`, `docs/BUGS.md` | Exact contracts and fix status; BUG-107/109 remain open |
| `apps/landing/src/data/docs/` | Generated guide/concept/ADR/service output only, from source; discard unrelated generation churn |
| `.claude/handoff/CURRENT_HANDOFF.md` | Task checkpoints, evidence, constraints and next reviewer prompt |

Read the two service `.claude/README.md` + `CONTEXT.md` files, `apps/frontend/claude.md`,
`apps/claude.md` and `tests/claude.md` before their tasks. Re-run `node scripts/gotcha-check.js --for <owned paths>`.
Do not modify ordinary join/staff handlers, the community transaction wrapper, notification-service or validation
envelope handling. No planned fixture change is permission to weaken an old invariant.

## Critical implementation notes (read before Task 2)

1. One transaction client owns actual invitation consumption, membership, counter effect, attribution and inviter
   stats; failed admission consumes nothing. Failed rollback destroys the new social-graph transaction's client
   only; community-service's existing wrapper remains unchanged with its documented cleanup limitation.
2. Lock invitation, then inviter FOR SHARE and invitee FOR UPDATE in global user_id order, then let the trigger
   lock the community. Use the existing Queryable/client injection pattern. Never pre-lock a community.
3. Approved D1–D3: active invitees get a no-write 200 with an unconsumed code; pending invitees become
   active ordinary members after capacity validation; any active private member can admit anyone without admin
   approval (subject to capacity and blocked-state refusals). Duplicate-create still refuses pending; both paths
   refuse inactive/NULL/unknown and reset left rejoins to ordinary member.
4. A conflict no-op must be followed by a locked state read. A missing row is not a NULL-status row. Never infer
   active membership from row existence or fall back to an invented role/token claim.
5. Live inviter authority is an in-scope security fix; read it inside the locked acceptance transaction using the
   stored community and verified caller. BUG-109 tracks unguarded generation separately. Self-acceptance already
   has a DB guard (now map to 400); bound-invitee refusal is defensive fixture-only coverage.
6. Capacity checks follow real active admissions on the same client. The database owns current_members; no deltas,
   counter assignments, recounts, schema changes, generated init.sql edits or new dependency are needed.
7. Preserve private duplicate-create pointers, including a mid-request change (rollback tentative admission
   first), active member roles, used-code status and post-commit token refresh. D1 adds already_member: true and
   accepted_at: null; the invite caller must not manufacture an invitation bond for that no-write outcome.
8. Prove SQL, rollback and interleavings against the real CI database; mocks alone do not prove them. Include
   compatible shared inviter locks in barriers and unconditionally clean up failed barriers. Put new acceptance
   coverage in gated tiers, not the unselected old root/service integration files.
9. BUG-107 and generation BUG-109 stay out of scope. Validation uses bare Axios, so its nested envelope is correct.
   Do not claim live UI smoke or deployment from API tests, source inspection or historical Sprint 144 evidence.
10. Version, merge, deploy, demo data and remote test infrastructure remain unauthorized; planning produces docs
    only, with execution in the next chat after design/plan readiness.
11. Repeat invitations from the same inviter/community can hit the existing unique triplet on a left or pending
    invitee. Keep 409 INVITATION_CONFLICT with the alternate-path message, joining-guide explanation and real-history
    state-matrix/rollback proof. No schema change or deletion of accepted history.
12. D2/D3 let an ordinary member admit an applicant while staff review, leaving a prior join-request notification
    stale. This is an explicit policy cost, not a notification cleanup task. The D1 frontend guard is defensive
    and gets one minimal test because registration itself creates no membership.

## Task 1: Write red invitation boundary and DB scenarios

**Files:** Create the three social-graph TDD files and the root integration file in the file map.

**Interfaces:** Tests initially drive the existing invitation router and real `getLiveRole`.
The new service module's test consumes the interface defined in Task 2; a missing-module failure is expected
for that new interface, but is not evidence that an existing bug was reproduced.

- [ ] **Write the existing-router regression cases before implementation.** Use a fake pool/client for unit
  boundaries, without mocking the router or eventual acceptance logic. Supply both legacy pool.query and
  client.query so the old handler can run and fail on behavior assertions.
  Assert D1 has no INSERT/UPDATE calls and null acceptance time; pending becomes active member; inactive/NULL/
  unknown refuse without mutations; a count above the cap refuses with COMMUNITY_FULL. Pin exact error bodies,
  committed timestamp, unchanged active role/joined_at and new/left/pending role reset. Preserve successful
  acceptance for public/private newcomers and active admin/moderator/member inviters.
- [ ] **Write live-role client tests.** Call the existing helper using `Reflect.apply` with an explicit client,
  avoiding a baseline compile-only third-argument error. Assert the explicit client's query is used and the pool
  is untouched; pair it with the default-pool success and foreign/inactive membership null cases.
- [ ] **Write helper cleanup tests before Task 2.** Include connect failure, normal commit/release, typed
  rollback, unexpected query failure, and rollback failure destroying the client with `release(rollbackError)`.
  Assert no success log before commit and no invitation-accepted log for D1.
- [ ] **Create the real-DB harness and invitation cases.** Follow the in-process route/JWT pattern in
  `tests/integration/sprint-144-staff-write-integrity.integration.test.ts:125`; import real routers and both
  real pools, mock only external event delivery. Use unique test users/communities/codes, explicit community
  predicates, role-flag evidence, FK-aware cleanup, pool shutdown and barriers with unconditional finally cleanup.
  Cases cover the full approved state matrix, self 400, synthetic bound-invitee 403, live inviter removal,
  missing/inactive community, same-code contenders, same-user different-code contenders and last-slot contention.
- [ ] **Add real repeat-history cases.** Admit via A's first code, self-leave, then try A's fresh code; repeat
  after re-applying to private as pending. Expect 409 INVITATION_CONFLICT with the spec's exact alternate-path
  message, no new consumption, preserved old accepted row, and exact rollback of membership/count/attribution/
  stats. Pair with success via B's code and public self-rejoin. A real user-attribution statement failure after
  invitation update also proves the accepted-stats trigger rolls back; never use a successful SQL mock as DB proof.
- [ ] **Verify meaningful red and checkpoint.**

  ```bash
  npm exec --workspace=services/social-graph-service -- jest --runTestsByPath tests/tdd/sprint-145-invitation-routes.test.ts tests/tdd/sprint-145-live-role-client.test.ts --runInBand --no-cache
  ```

  Expect assertion failures on the old behavior (D1 writes, pending no-op, missing client/liveness/capacity
  checks), not harness/import errors. Record exact cases red. The helper's not-yet-created import is a separate
  new-interface red. No authorized DB is available locally: record DB red as unrun/CI-owed, not passed.
  Commit these WIP TDD tests with normal hooks; do not create an early PR or bypass a gate.

## Task 2: Implement transaction-client authority and acceptance operation

**Files:** Modify `services/social-graph-service/src/database/liveRole.ts`; create
`services/social-graph-service/src/services/invitationAcceptance.ts`.

**Interfaces:**
- `getLiveRole(communityId: unknown, userId: string | undefined, db: Queryable = pool): Promise<LiveRole>`,
  where `type Queryable = Pick<PoolClient, 'query'>`, following `src/database/trustEdgeDb.ts:107`.
- Export `acceptInvitation(input: { userId: string; invitationCode: string }): Promise<InvitationAcceptance>`.
- Export `InvitationAcceptance = { inviter_id: string; community_id: string; accepted_at: Date }`
  `| { inviter_id: string; community_id: string; accepted_at: null; already_member: true }`.
- Export `InvitationAcceptanceError extends Error` with readonly `status: number`, `code: string` and
  constructor `(status: number, code: string, message: string)`. Routes map this error; other errors stay opaque.

- [ ] **Implement the approved transaction sequence.** One checked-out social client; invitation FOR UPDATE;
  ordered canonical inviter FOR SHARE and invitee FOR UPDATE; live inviter check using that client; classify
  missing versus NULL; conditional missing/left/pending admission; same-client post-write status/capacity read;
  then consume/update attribution and commit. No shared-package or other-service imports.
- [ ] **Implement D1 and conflicts.** Active membership returns the no-write union arm after code/identity/
  community/authority validation. A lost insert reads/classifies its winner without assuming active; if no safe
  outcome is established, return retryable conflict and roll back. Use conditional RETURNING for rejoin/promotion.
  Map only the known invitation-triplet uniqueness violation to 409 with the exact recovery message in the spec.
  Preserve history and reset role/request message/timestamp only for actual admission.
- [ ] **Implement failure/resource semantics.** Use the DB-returned acceptance timestamp. Counter/stats writes
  remain trigger-owned. Roll back every actual admission refusal; destroy the social client on rollback failure.
  Map deadlock/serialization to 503 ADMISSION_RETRY without automatic retries. Keep known public capacity copy;
  inspect server logging in Task 3 so opaque errors still have operator evidence.
- [ ] **Verify helper and client tests green, then commit.**

  ```bash
  npm exec --workspace=services/social-graph-service -- jest --runTestsByPath tests/tdd/invitationAcceptance.test.ts tests/tdd/sprint-145-live-role-client.test.ts --runInBand --no-cache
  ```

  Expect PASS; router tests may remain red until Task 3. SQL boundary mocks prove wiring only; root DB tests
  remain CI-owed. Record limitations instead of claiming concurrency proof.

## Task 3: Wire the accept endpoint and exact error contract

**Files:** Modify `services/social-graph-service/src/routes/invitations.ts`; use Task 1's route tests.

**Interfaces:** Consume Task 2's `acceptInvitation`, union result and `InvitationAcceptanceError`.
Keep the public route and successful payload field names; do not change generate/validate/history/stats routes.

- [ ] **Replace only acceptance's separate pool statements.** Validate authenticated identity (401) and
  nonempty string code (400 VALIDATION_ERROR, before SQL); call the operation and return its ADR-074 envelope.
  Self-acceptance is 400, consumed code remains 400 with its existing used-code message, bound invite is 403,
  blocked/unknown membership is 409 restoration, missing entity 404, inactive/full 400 and transaction retry 503.
- [ ] **Make unexpected errors opaque and logged.** Test a real operation throwing a query error at the DB
  boundary; response is INTERNAL_ERROR without raw SQL/message, server logger receives route plus error.
  Pair every refusal case with an eligible successful case so a blanket deny cannot pass.
- [ ] **Verify and checkpoint Task 1–3 before any long suite/review.**

  ```bash
  npm exec --workspace=services/social-graph-service -- jest --runTestsByPath tests/tdd/invitationAcceptance.test.ts tests/tdd/sprint-145-invitation-routes.test.ts tests/tdd/sprint-145-live-role-client.test.ts --runInBand --no-cache
  ```

  Expect all focused tests PASS. Commit implementation and update handoff task/state/SHA/red-green evidence;
  record DB proof as awaiting CI. No remote test host access.

## Task 4: Write red duplicate-create and cross-path race cases

**Files:** Create `services/community-service/tests/tdd/sprint-145-duplicate-create.test.ts`;
extend `tests/integration/sprint-145-admission-integrity.integration.test.ts`.

**Interfaces:** Drive POST /communities through the real router and identity key; reuse the existing normal
join/staff routes in DB contenders without changing them. Use the spec's public/private state matrix.

- [ ] **Write route cases.** Missing/left admit as member; existing active preserves staff role/join time and
  succeeds at full/overfull count; pending refuses 409 CONFLICT; inactive/NULL/unknown refuse restoration.
  Assert conditional writes, same-client post-check, rollback on over-capacity and no token on refusal.
  A current private match is a no-write pointer for every stored membership state.
- [ ] **Write token/policy race cases.** A community turning private returns the pointer, including active
  no-op; tentative insert/rejoin is rolled back before reading its returned count. Inactive change refuses.
  If post-commit refreshed communities omit the caller's community, expect 409 MEMBERSHIP_CHANGED, no token,
  no invented member role and no joined success. Pair with a genuine active staff token/role success.
- [ ] **Extend real-DB races.** Two invitation newcomers with the same inviter must both pass compatible
  authority locks before the last-slot barrier is released. Also invitation versus normal join, staff add,
  staff approval and duplicate-create; two duplicate creates; left rejoins; pending invitation versus staff
  approval/rejection; inviter departure, invitee block and public-to-private/archive interleavings.
  Assert exact winner identities, final membership roles/states, consumed code IDs, stored count == actual
  active rows, and loser side effects. Different inviters are not a workaround for exclusive authority locks.
- [ ] **Verify baseline failures and commit tests.**

  ```bash
  npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-145-duplicate-create.test.ts --runInBand --no-cache
  ```

  Expect failures on pending/inactive false success and missing rejoin, not harness errors. Existing/new
  success baselines remain green. Record DB interleavings as unrun until isolated CI executes them.

## Task 5: Make duplicate-create admission and response truthful

**Files:** Modify `services/community-service/src/routes/communities.ts` and
`services/community-service/tests/regression/sprint-144-capacity.test.ts`.

**Interfaces:** Existing `classifyExistingMembership(status)`, `withTransaction(q => ...)`,
`assertWithinCapacity(q, communityId)`, `readMemberCount(q, communityId)`, `buildRefreshedToken(...)`.
No new exported community-service API or general join abstraction.

- [ ] **Implement Task 4's matrix in the existing identity-match branch.** Lock/read membership on the
  transaction client, re-read community state/access, then classify. Preserve initial private pointer
  behavior. Missing inserts and left rejoins count as admissions; active is idempotent with no membership
  UPDATE. Lost inserts must read/classify the winner. Pending, blocked and unknown never return joined success.
- [ ] **Preserve capacity and rollback semantics.** Post-check real active writes with the existing helper.
  An access flip to private returns a typed private outcome that rolls tentative writes back, then reads
  fresh pointer metadata outside that transaction. Do not return transient pre-rollback counts.
  Community-service's failed-rollback cleanup is unchanged; do not claim the social destroy guarantee here.
- [ ] **Refresh truthful membership after commit.** Remove the invented role fallback; require the actual
  refreshed active membership before returning joined/token. Retain the actual role of active staff.
  Map known state/capacity/retry errors with ADR-074, leaving unrelated create/new-community behavior intact.
  Adapt S144 SQL mocks to the new locked reads without weakening stored-count or rollback assertions.
- [ ] **Verify green and commit.**

  ```bash
  npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-145-duplicate-create.test.ts tests/regression/sprint-144-capacity.test.ts tests/regression/sprint-143-governance-lifecycle-policy.test.ts --runInBand --no-cache
  ```

  Expect PASS. No new event publication, direct counter write, shared export or transaction-wrapper refactor.

## Task 6: Write frontend contract tests before the defensive guard

**Files:** Create `apps/frontend/tests/tdd/sprint-145-admission-feedback.test.tsx`.

**Interfaces:** Actual invite/create pages, existing mocked service clients/session helpers and router.
Validation mock is raw Axios `{ data: { data: info } }`; acceptance mock is unwrapped `{ data: result }`.

- [ ] **Write one defensive D1 case.** Register succeeds; acceptance returns already_member:true and null
  accepted_at; login refresh succeeds. Expect the existing-community destination and no new invitation
  arrival context. Do not model two live browser tabs or add a logged-in acceptance screen.
- [ ] **Pin real caller contracts.** Actual acceptance still refreshes/login-stores the session and creates
  invite arrival; capacity/restoration/conflict failures preserve registration and route to discovery without
  login/arrival. The create wizard renders a 409 server message without storing a new token/navigation, and
  real active duplicate-create success still stores its supplied token and navigates to its community.
  Mock only expensive configuration/questionnaire children, not the pages or their submit handlers.
- [ ] **Verify D1 red and baseline cases green, then checkpoint Tasks 4–6.**

  ```bash
  npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-145-admission-feedback.test.tsx --runInBand --no-cache
  ```

  Commit tests and update task/state/SHA/evidence in the handoff before further long work.

## Task 7: Add only the defensive no-bond branch

**Files:** Modify `apps/frontend/src/pages/invite/[code].tsx`.

**Interfaces:** Read `acceptResponse.data.already_member` after acceptance; keep session refresh on success.

- [ ] **Handle D1 after the existing successful re-login/session update.** If already_member is true, navigate
  to that response's existing community and return before beginArrival. Actual acceptance and all failure
  behavior stay as Task 6 asserts. Leave bare-Axios validation and its nested envelope unchanged.
- [ ] **Verify green and commit.**

  ```bash
  npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-145-admission-feedback.test.tsx tests/regression/sprint-118-invited-arrival.test.tsx --runInBand --no-cache
  ```

  Expect PASS; no new screen, client instance, dependency or onboarding workflow.

## Task 8: Update user guides, identity ADR and generated landing docs

**Files:** Modify the five guide/concept/ADR sources in the file map and generated landing output.

**Interfaces:** The approved design's user-facing contracts and exact INVITATION_CONFLICT recovery message.

- [ ] **Author source docs.** Joining guide: capacity/live-inviter/blocked refusal, account preservation,
  private member admission, pending promotion and stale staff notification; explain real repeat-history
  409 and alternate inviter/public self-rejoin. Finding guide: state-aware duplicate-create and role reset.
  Admin guide: remove invitation's capacity exception, retain fusion and BUG-107 exceptions, explain D2/D3.
  Identity concept and ADR-062: lifecycle/capacity-aware idempotent public creation, no invented role.
  Preserve the ADR's historical migration/data evidence and allocate no new ADR.
- [ ] **Generate explicitly; npm prebuild is disabled.**

  ```bash
  npm run generate-docs --workspace=apps/landing
  npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --runInBand --no-cache
  ```

  Existing source slugs are already registered (`scripts/generate-docs.ts:320`, `:507`, `:600`);
  change no navigation unless generation reveals a real source omission. Keep only relevant generated
  content; restore unrelated timestamps/HEAD/line-ending churn from a saved index snapshot, never blanket HEAD.
  Force-add only intended ignored generated files, verify source/output agreement, then commit.

## Task 9: Close the documentation loop, promote only green tests, and assemble DB evidence

**Files:** Both service CONTEXT files, frontend CONTEXT, registry, BUGS, the new test paths and handoff.

**Interfaces:** Existing test tiers and root integration runner; the implementation from Tasks 2/3/5/7.

- [ ] **Update exact contracts.** Service docs/registry describe transaction scope, D1/D2/D3, error codes,
  triplet recovery, counter ownership and current private pointer/token behavior. Frontend context records
  only the defensive D1 handling. BUG-106/108 become fixed, pending deploy, when implementation is verified;
  BUG-107/109 remain open. Regenerate affected service landing docs from source once contexts are final.
- [ ] **Run each new TDD file green, then explicitly git-move only those five new service/frontend test files**
  to their corresponding regression directories (three social, one community, one frontend). Do not use npm
  posttest or the repository-wide promoter. Search for stale test-path references and update them.
  The root DB file stays in integration and is never moved to service integration.
- [ ] **Verify the promoted files directly without Turbo cache.**

  ```bash
  npm exec --workspace=services/social-graph-service -- jest --runTestsByPath tests/regression/invitationAcceptance.test.ts tests/regression/sprint-145-invitation-routes.test.ts tests/regression/sprint-145-live-role-client.test.ts --runInBand --no-cache
  npm exec --workspace=services/community-service -- jest --runTestsByPath tests/regression/sprint-145-duplicate-create.test.ts tests/regression/sprint-144-capacity.test.ts --runInBand --no-cache
  npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/regression/sprint-145-admission-feedback.test.tsx tests/regression/sprint-118-invited-arrival.test.tsx --runInBand --no-cache
  ```

- [ ] **Before any authorized DB run, checkpoint and verify an isolated test DATABASE_URL.** No demo read or
  remote provisioning is authorized. If there is no separately authorized isolated DB, defer this command to
  PR CI and explicitly record unrun local cases:

  ```bash
  npm exec --workspace=tests -- jest --config jest.integration.config.js --runTestsByPath integration/sprint-145-admission-integrity.integration.test.ts integration/sprint-144-staff-write-integrity.integration.test.ts integration/sprint-143-governance-lifecycle.integration.test.ts --runInBand --no-cache
  ```

  Expected CI outcome: all selected suites PASS, role flags recorded, exact state/count/history assertions and
  barriers exercised. Failed-barrier test must prove cleanup and settled requests, not just happy-path races.
  No gate may be marked green from test-file presence or mocks. Commit and checkpoint Tasks 7–9 with limits.

## Task 10: Run the whole-branch SDLC gates

**Files:** Full diff against origin/master, including bundled process/post-merge records; fix findings only in scope.

**Interfaces:** Approved spec, this plan, actual tests/evidence, review-response and process-reviewer procedures.

- [ ] **/simplify:** one calibrated pass on the branch diff. Verification: record findings fixed/dismissed and
  inspect the final diff for redundant admission logic, premature abstractions and weakened tests.
- [ ] **/security-review:** inspect live inviter authority, JWT/body identity, private admission, opaque/logged
  errors, transaction atomicity and scope boundaries. Verification: record the reviewed SHA, findings and
  evidence; BUG-109 is a documented residual, not falsely reported fixed.
- [ ] **Process review:** invoke the actual process-reviewer once for the whole branch, not per task.
  Verification: all required documentation/test/PR-contract checks are satisfied or recorded blockers; audit
  both bundled docs(process) commits, not just product changes. Resolve its findings before the final review.
- [ ] **/code-review:** final independent whole-branch review on Opus under the header's execution-model rule.
  Verification: resolve correctness findings and re-run affected tests; include DB evidence/CI-owed limits,
  same-inviter user recovery and authority/staff races. No self-approval or merge. Checkpoint before each review
  dispatch and record task/state/SHA/what is awaited. Fix-loop escalation follows SDD.

## Task 11: Final verification, handoff and reviewable PR — stop before release

**Files:** Final index, handoff, PR body copied from the repository template.

**Interfaces:** Same-clean-HEAD evidence ledger; final pre-commit script; normal pre-push hooks.

- [ ] **Type-check affected workspaces and run the feedback check.**

  ```bash
  npm exec --workspace=services/social-graph-service -- tsc --noEmit
  npm exec --workspace=services/community-service -- tsc --noEmit
  npm exec --workspace=apps/frontend -- tsc --noEmit
  npm run feedback:check
  ```

  Expect exit 0. Verify no untracked/unstaged accidental generated output remains. Commit the checkpoint before
  the long suite/review and update handoff task/state/evidence, preserving all authorization boundaries.
- [ ] **Prepare the handoff and complete template before opening the PR.** List implemented tasks and next
  reviewer action, actual red/green evidence, integration CI still owed, BUG-107/109 and repeat-invitation/
  stale-notification limits. Summary/bundled work must explicitly name:
  `30b1823e docs(process): apply /insights triage to agent rules and skills` and
  `cd8b973a docs(process): route plan subagent models`, explaining why they ride with Sprint 145 rather than
  causing a separate docs-only deploy. Include the Sprint 144 post-merge record as bundled documentation too.
  Fill every template section; use the executing agent's actual Lane, not the branch name as an identity.
- [ ] **Stage the final handoff and intended changes, then invoke /pre-commit-check once at final verification.**

  ```bash
  bash scripts/pre-commit-check.sh
  ```

  Follow its restore-from-snapshot/rerun instructions for generated churn; never bypass hooks or a red gate.
  Record actual tested HEAD/index, exit status, cache state and limits in the commit body/PR Validation ledger.
  Exit 0 means commit those verified contents immediately; do not edit the handoff after that pass before the
  commit. A cached pass is not DB proof. Later changes require fresh evidence, not a same-HEAD reuse claim.
- [ ] **Commit, push with normal hooks and open exactly one task PR.** Preserve actual new evidence when
  hooks run; do not use no-verify/SKIP_PREPUSH. Unit/regression must pass before push. Record the PR link in
  the handoff and surface it as the artifact; reconcile gh pr list/git state. If that newly known PR URL needs
  a bookkeeping handoff commit, keep it on this same PR, list the change after the tested product commit, and
  let normal pre-push hooks run fresh required checks rather than reusing the parent-SHA evidence. Stop with
  a next-reviewer prompt. Integration/CodeQL/contract/security CI must be checked by that reviewer before any
  future merge decision; no CI watcher, version bump, merge, deployment or demo smoke in this no-deploy plan.

## Planning self-audit and execution handoff

Before marking this plan ready, run writing-plans self-review and sprint-planning Step 5b: re-open cited lines,
verify npm lifecycle/test discovery, test-file creation before implementation, interfaces, red cases and scope.
Because the plan includes the security gates, use one fresh-context Step 5b reviewer on the session model;
this planning audit is distinct from the execution subagent model routing above. Record its audited checkpoint
SHA and resolved findings in the handoff. Cross-agent plan review still follows.

All Task 1–11 checkboxes start unchecked. No product task is completed by approval of this plan.
Next chat: review the approved spec and this plan, then use the selected execution skill on the existing branch.
