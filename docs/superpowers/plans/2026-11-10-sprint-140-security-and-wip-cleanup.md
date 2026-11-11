# Sprint 140 PR A Security and Focused WIP Repair — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task.
> Checkboxes never grant separately restricted authorization.

**Goal:** Ship node-forge 1.4.3, BUG-100/099/098, simulation governance containment and eleven clear unit/UI WIP repairs in PR A without making twenty infrastructure/legacy suites disappear.

**Architecture:** Surgical dependency splice; authenticated membership identity; null-aware status SQL with stable bind positions; focused response-consumer fixes; direct unit/UI repairs. New bug integration tests join the existing root CI tier. PR B is separately planned after CI and rewrite/retire decisions.

**Tech Stack:** canonical stack in `CLAUDE.md` → *System Architecture*; do not copy version floors.

**Spec:** [Sprint 140 design](../specs/2026-11-10-sprint-140-security-and-wip-cleanup-design.md), including the exact 11/20 partition and CI constraints.

**Branch/base:** `agent/claude/sprint-140-planning`; planning base `origin/master` `8aabc50c`, v11.112.0. Provisional PR A v11.113.0; re-derive at merge. PR B uses a fresh branch from future master.

**Approval boundary:** maintainer confirmed Claude's node-forge lane, chose **split with admin-schemas-api in B**, and chose **zero nomination/ratification simulation weights**. Commit the revised planning docs before execution. Tasks 1–12 stop after PR A creation. Task 13 is later PR B planning; Task 14 is unauthorized merge/deploy.

## Global constraints

- One editor; no worktrees, rebase, force-push, direct master push or edits on another branch.
- Dependency authorization covers only node-forge 1.4.3 and its strict proof. Do not merge/close/push #333.
- No merge, deploy, demo-host operation, dismissal or ADR number without separate explicit authorization.
- #329 stays open; re-check #178 at the next Expo SDK move or by 2026-12-01.
- PR A changes no CI workflow and moves no suite into service/root integration. Only the two new bug integration suites go into already-executed root integration.
- `sprint-117-demo-reset.integration.test.ts` stays at `tests/tdd/`; CI invokes that exact path last (`.github/workflows/ci.yml:342-349`).
- No deletion, skip, weakened assertion or unrun-tier relocation. Obsolete retirement requires separate written maintainer approval with replacement coverage.
- Promote exact green files using `git mv` only. Never invoke `node scripts/promote-tdd-tests.js` directly.
- PR A's final root TDD remains nonzero on Windows because twenty PR-B suites stay. Required checks are green; warnings must match that known set with no new failure.

## File map

### New files

| File | Responsibility |
|---|---|
| `services/community-service/tests/tdd/sprint-140-my-communities-identity.test.ts` | JWT identity/legacy query/no-DB denial; `git mv` to regression when green |
| `services/simulation-service/tests/tdd/sprint-140-governance-actions-disabled.test.ts` | All zero weights and selector exclusion; `git mv` to regression |
| `services/request-service/tests/tdd/sprint-140-offer-status-all.test.ts` | Stable SQL/params/default/all/audience/expiry; `git mv` to regression |
| `apps/frontend/tests/tdd/sprint-140-offers-all-filter.test.tsx` | All option/params/mixed statuses; explicit `git mv` |
| `apps/frontend/tests/tdd/sprint-140-trust-question-responses.test.tsx` | Admin page/hook one unwrap; explicit `git mv` |
| `apps/frontend/tests/tdd/sprint-140-preferences-responses.test.tsx` | Preferences/interests load/add state; explicit `git mv` |
| `apps/frontend/tests/tdd/sprint-140-messaging-responses.test.tsx` | MessagingContext/InlineChat/FloatingChat payloads; split only for harness clarity |
| `tests/integration/sprint-140-community-membership-identity.integration.test.ts` | Real two-user privacy/authentication in existing root CI tier |
| `tests/integration/sprint-140-offer-status-all.integration.test.ts` | Real mixed-status/default/audience/expiry in existing root CI tier |
| `docs/adr/` ADR with maintainer-allocated number and filename | Required cross-service PR-A decision record; Proposed until deployed |

### Existing files

| File | Change |
|---|---|
| `package.json`, `package-lock.json` | Override + one node-forge entry; later three root version fields only |
| `tests/regression/sprint-131-d9-security-overrides.test.ts` | 1.4.3 floor/comment |
| `services/community-service/src/routes/communities.ts` | Authenticated id, ignore query id |
| `services/simulation-service/src/profiles/index.ts` | Every nominate/ratify weight 0; workflows/routes unchanged |
| `services/request-service/src/routes/offers.ts` | Null-aware `$1`, stable `$2`/optional params |
| `apps/frontend/src/pages/offers/index.tsx` | `value="all"` |
| Confirmed BUG-098 consumers in admin/preferences/MessagingContext/InlineChat/FloatingChat | One unwrap only |
| `apps/frontend/tests/tdd/useTrustQuestions.test.ts` | Correct intercepted mock; production hook unchanged |
| `apps/frontend/src/pages/invite/[code].tsx`, `src/lib/api.ts:144`, `src/hooks/useMessaging.ts` | Raw-client controls; no change |
| Eight frontend suites named in spec | Focused repair then exact `git mv` to frontend regression |
| `services/request-service/tests/tdd/sprint-125-provider-reach-gate.test.ts` | Two membership bind-order expectations; then `git mv` |
| `tests/tdd/sprint-36-commitment-depth.test.ts`, `preferredProviderNotification.test.ts` | Current pure-function/template contracts; explicit `git mv` to root regression |
| Twenty PR-B suites listed in spec | No relocation/deletion in PR A |
| Affected CONTEXT, `services/registry.json`, `docs/BUGS.md`, named guides, simulation/demo docs | Actual behavior and honest 11/20 status |
| `docs/adr/README.md` | Index the required maintainer-numbered cross-service ADR |
| `apps/landing/src/data/docs/**` | Regenerated substantive output only |
| `.claude/handoff/CURRENT_HANDOFF.md` | Tested PR-A state and PR-B gate |

## Review focus

1. Lock regeneration can remove platform metadata: Task 2 requires strict install and tree/diff comparison.
2. BUG-100 otherwise activates simulation governance after pm2 restart: Task 3 proves zero-weight containment.
3. BUG-099 can renumber viewer/optional binds or weaken audience/expiry: Tasks 4/9 pin exact SQL and real rows.
4. BUG-098 tests can mock the wrong boundary: Task 5 preserves three raw-client controls.
5. A green claim can hide unrun tests: Tasks 6–9 touch only eleven unit/UI suites and existing root integration; twenty remain visibly deferred.
6. Broad promotion can sweep unrelated tests: all promotions are exact `git mv`; snapshot/reconcile after full runs.

## Full-run snapshot policy

- [ ] Before `npm test`, snapshot current service/app TDD paths/bytes and landing output without reading secrets.
- [ ] Immediately inspect `git status --short`, even on failure.
- [ ] Retain only intended Sprint 140 moves; restore unrelated auto-promotions from the byte snapshot, never HEAD over uncommitted edits.
- [ ] Root TDD never auto-promotes; use `git mv` for the two repaired root suites. Frontend `.tsx` is always explicit.
- [ ] Keep substantive landing changes; restore only timestamp/HEAD noise. Recheck staged paths and `git diff --check` before commits.

## Task 1: Preflight and scoped baseline

**Files:** No runtime edits; execution ledger lives in handoff/PR draft.

- [ ] Confirm the revised planning commit exists and tree is clean. Read `CLAUDE.md`, handoff, spec/plan, affected workspace guidance and gotchas via `node scripts/gotcha-check.js --for <owned paths>`.
- [ ] Run `uname -s`; Windows Git Bash has no local Docker. Use `node -e` for JSON/HTTP probes.
- [ ] `git fetch origin`; confirm branch, `gh pr list`, #329, open alerts and master log. Reinspect #333 if changed. If master/lane state moved, stop for serialization; never rebase.
- [ ] Read community/request/frontend/simulation/notification/root test docs before editing. Social-graph and the twenty PR-B paths are read-only in PR A.
- [ ] Capture `npm ls --all` and exit code in a temporary untracked location. Snapshot TDD/landing; run `npm test`, `npm test --workspace=tests`, then `npm run test:tdd`. Reconcile promotions and compare against 31/148 baseline.
- [ ] Record the eleven PR-A and twenty PR-B suites. Do not attempt service integration moves or CI edits.

```bash
npm ls --all
npm test
npm test --workspace=tests
npm run test:tdd
```

## Task 2: Security-first node-forge splice

**Files:** Root manifests and existing security-floor regression only.

- [ ] Raise the regression floor/comment to 1.4.3 and run it red against unchanged manifest/lock.
- [ ] Edit only override `>=1.4.3` and the single lock entry's version/resolved/integrity. Exclude #333's **26** unrelated `libc` removals; no lock regen/dedupe/workspace install.
- [ ] Run floor regression green; inspect every parsed locked copy.
- [ ] Run strict `npx -y npm@11.19.0 ci`, then `npm ls node-forge --all` and full `npm ls --all`. Compare full baseline: only node-forge 1.4.2 → 1.4.3.
- [ ] Run normal and low-severity audits; require no local node-forge advisory. Do not claim GitHub closure before default-branch merge.
- [ ] Require only intended manifest/lock delta at this stage; pre-commit-check and make first implementation commit under normal authorization.

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-d9-security-overrides.test.ts --runInBand --no-cache
npx -y npm@11.19.0 ci
npm ls node-forge --all
npm ls --all
npm run audit
npx -y npm@11.19.0 audit --audit-level=low
```

## Task 3: BUG-100 plus simulation containment

**Files:** Community route, simulation profiles, two new TDD suites, new root integration suite, community/simulation CONTEXT.

**Interfaces:** Authenticated id only; legacy query ignored; missing identity denied before DB. No simulation nomination/ratification action is selectable.

- [ ] Write community route tests with distinct caller/foreign ids. Omitted/own/foreign query all bind caller id; missing identity denies without `query`; active filters/order/envelope remain.
- [ ] Write simulation tests before edits: enumerate `ALL_PROFILES` and require every `nominateMember`/`ratifyNomination` weight 0. Exercise real `selectWorkflow` across controlled random choices and prove neither disabled action can be returned; retain unrelated selection behavior.
- [ ] Add root integration with two users/disjoint memberships, inactive/pending controls, real JWT HTTP omitted/own/foreign calls and unauthenticated denial.
- [ ] Run both TDD suites red for intended assertions, then replace query trust with:

```ts
const userId = (req as any).user?.userId;
if (!userId) {
  return sendUnauthorized(res, 'Authentication required', { requestId: (req as any).id });
}
// Existing membership SQL; params: [userId]
```

- [ ] Ignore `req.query.user_id`; remove its required validation. Keep `communityService.getMyCommunities(userId)` callers compatible; no mismatch 403.
- [ ] Set all current weights exactly as follows, leaving averages/workflows unchanged:

```ts
nominateMember: { weight: 0, avgPerSession: 0.05 },
ratifyNomination: { weight: 0, avgPerSession: 0.1 },
// SOCIAL_USER:
ratifyNomination: { weight: 0, avgPerSession: 0.05 },
```

- [ ] Run community/simulation targeted and existing suites green. Use exact `git mv` for both new suites. Document why zero weights are required after the route fix; integration runs in Task 9. Pre-commit-check and commit.

## Task 4: BUG-099 with stable SQL numbering

**Files:** Offers route/page, two new TDD suites, root integration, request/frontend CONTEXT.

- [ ] Write SQL-capture tests for omitted/active/matched/withdrawn/all and all+community/type/limit/offset. Require `$1` status, `$2` viewer, optional numbering beginning `$3`; complete audience/expiry grouping remains.
- [ ] Write page test selecting All, requiring `status:'all'`, returning intercepted `{data:{offers:[active,matched,withdrawn],count,total}}` and proving mixed render. Preserve existing loading/error/race/expiry coverage.
- [ ] Run red, then implement:

```ts
const { community_id, status = 'active', type, limit = 50, offset = 0 } = req.query;
const viewerId = (req as any).user?.userId ?? null;
const statusParam = status === 'all' ? null : status;
const params: any[] = [statusParam, viewerId];
let paramCount = 3;
```

```sql
WHERE ($1::text IS NULL OR o.status = $1)
  AND <existing offerReadableSql('o', '$2')>
  AND <existing Sprint 139 owner/status/expiry OR>
```

- [ ] Change only the All option to `value="all"`. Unknown statuses keep equality behavior; omitted remains active. Do not touch Sprint 125, whose bind assertions concern another route.
- [ ] Add real root integration for active+matched+withdrawn, default-active control, owner/non-owner expiry and outsider/former/pending exclusion. Task 9 executes it.
- [ ] Run new/existing offer and frontend suites green; exact `git mv` promotions; CONTEXT, pre-commit-check, commit.

## Task 5: BUG-098 focused consumer repairs

**Files:** Confirmed six consumer surfaces, three new frontend TDD suites, existing hook mock, frontend CONTEXT. Interceptor and three raw-client controls unchanged.

- [ ] Trace each wrapper/client/backend payload. Mock intercepted shapes: `{data:{questions}}`, `{data:{preferences}}`, `{data:{interests}}`, `{data:{isNew,id,...}}`, direct messaging arrays/objects.
- [ ] Write red tests proving rendered questions, preferences/interests and add-interest state, conversation/messages/created conversation and unread total. Repair `useTrustQuestions` mock only; hook already correct.
- [ ] Add controls for raw-Axios invite `.data.data`, raw refresh fallback and raw-fetch `useMessaging` `data.data.messages`; all remain valid.
- [ ] Apply exact reads from spec D. Preferences must not require `response.data.success` after unwrapping; use resolved payload and existing error handling.
- [ ] Search remaining occurrences; change only a newly traced defect with its own test. No global gate/typed wrappers.
- [ ] Run targeted/existing messaging/preferences/trust/invite suites green; exact `git mv` for new TSX suites; CONTEXT/pre-commit-check/commit. Coordinate Task 6's hook repair without duplication.

## Task 6: Repair eight frontend WIP suites

**Files:** Only the eight spec-listed frontend suites and implicated source/mocks; frontend CONTEXT.

- [ ] Diagnose each from actual failure and current source: `sprint-40-admin-connectors`, `useTrustQuestions`, `sprint-39-provider-ux`, `sprint-85-unified-feed`, `sprint-38-trust-profile`, `sprint-89-community-page-ia`, `sprint-102-community-memory-copy`, `trust-model`.
- [ ] Distinguish stale mocks/moved imports/DOM queries from real regressions. Fix the side contradicted by intended behavior; never copy current broken output into expectations.
- [ ] Keep Task 5's response shapes and existing offer/feed behavior consistent. Preserve every previously passing case.
- [ ] Run each directly, then all eight together. After green, `git mv` each exact file into `apps/frontend/tests/regression/`; do not run the promoter.
- [ ] Run frontend unit/regression and TDD. Require these eight green in blocking regression and absent from TDD; other PR-B failures are not in frontend.

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath <current-eight-suite-paths> --runInBand --no-cache
npm run test:unit --workspace=apps/frontend
npm run test:regression --workspace=apps/frontend
```

## Task 7: Repair only request Sprint 125

**Files:** `services/request-service/tests/tdd/sprint-125-provider-reach-gate.test.ts`; request CONTEXT. Other eight request failures remain PR B.

- [ ] Confirm only the two observed failures at `:104` and `:268`. Both current membership queries bind `[COMMUNITY, VIEWER]`; update those two expected arrays from `[VIEWER, COMMUNITY]`.
- [ ] Preserve all auth/live-membership, three reach conditions, route ordering, limit/offset and response assertions. Keep the real-DB companion `tests/integration/sprint-125-provider-reach-gate.integration.test.ts` unchanged.
- [ ] Run the suite directly green, then `git mv` the exact file to request regression. Run request unit/regression/TDD; require this suite blocking and no new request failure. Do not touch/move `admin-schemas-api` or other PR-B suites.

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/regression/sprint-125-provider-reach-gate.test.ts --runInBand --no-cache
npm run test:unit --workspace=services/request-service
npm run test:regression --workspace=services/request-service
```

## Task 8: Repair two root pure-unit suites

**Files:** Root `sprint-36-commitment-depth` and `preferredProviderNotification`; root/frontend/notification CONTEXT as applicable. Other six root failures remain PR B.

- [ ] Sprint 36: replace stale `updated_at` fixtures with `created_at`; preserve proposed→matched→completed and generic item ids. Current same-tier contract is `created_at` ascending (`commitmentSort.ts:7-14`), so rename/fix that expectation rather than weakening types.
- [ ] Preferred provider: confirm current high-priority delivery policy at `notificationTemplates.ts:217-226`; update stale channels to `{in_app:true,push:true,email:false}` if that policy stands. Preserve title/body/actionUrl and other assertions. If evidence shows push enablement accidental, fix production instead and record the contract decision.
- [ ] Run both directly green; use exact `git mv` into `tests/regression/` (root TDD never auto-promotes). Run root required tests directly after renames to bust stale Turbo assumptions.
- [ ] Leave Sprint 117 at its exact TDD path and leave all live-service/simulation-seeded suites untouched.

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-36-commitment-depth.test.ts regression/preferredProviderNotification.test.ts --runInBand --no-cache
npm test --workspace=tests
```

## Task 9: Execute only the two new root integration suites

**Files:** New BUG-100/BUG-099 root integration suites; no CI config or old-suite moves.

- [ ] On configured disposable infrastructure/CI, run both through root `jest.integration.config.js`. Require real HTTP/JWT/DB results for identity, all/default, audience and expiry/eligibility controls.
- [ ] Use self-contained factories/fixtures and owned teardown; close pools/clients. No simulation-seeded login assumptions, demo access or shared Redis flush.
- [ ] Where pre-fix integration red was not captured, use temporary source mutation on disposable infrastructure to prove detection; never claim unrun reasoning as observed.
- [ ] Verify the two files are discovered by the existing CI command. No service-tier command is part of PR A acceptance.
- [ ] Verify Sprint 117's dedicated exact-path CI step still points at an unchanged existing file. Do not run it locally without DB or move it into the main glob.

```bash
npm exec --workspace=tests -- jest --config jest.integration.config.js --runTestsByPath integration/sprint-140-community-membership-identity.integration.test.ts integration/sprint-140-offer-status-all.integration.test.ts --runInBand
```

Windows without infrastructure: mark CI-only, never a local pass. Required CI integration must be green before merge readiness.

## Task 10: Docs, ADR, bug ledger and exact promotions

**Files:** Guides/CONTEXT/registry/BUGS/onboarding/simulation docs/generated landing/root version fields listed in spec, plus the maintainer-numbered cross-service ADR and `docs/adr/README.md`.

- [ ] Obtain separate maintainer allocation of the ADR number before creating it; pause this step if allocation is not granted. Never self-assign or omit the ADR required for PR A's community/request/simulation changes.
- [ ] Write the cross-service ADR with Proposed status and index it in `docs/adr/README.md`. Cover authenticated membership identity, explicit all-status visibility and disabled simulation governance actions; do not mark it Implemented before deploy.
- [ ] Document membership privacy, explicit All/default Active, restored preferences, and zero simulation nominate/ratify weights pending quorum review. Production governance routes remain available.
- [ ] Testing docs state actual CI coverage: only root integration is required; no service-tier moves occurred; Sprint 117 remains exact-path/last. Record eleven repaired and twenty deferred, not “WIP green.”
- [ ] Update all affected CONTEXT and only actual registry endpoint descriptions. Mark three bugs fixed on branch after proof; no deployed/alert-closed claims.
- [ ] Audit all new/eleven repaired tests: every green one is in blocking regression via exact `git mv`; two new integration suites remain root integration. No direct promoter invocation or unrelated moves.
- [ ] Regenerate landing docs, retain substantive output/remove metadata noise. Run feedback/doc gates on staged diff.
- [ ] Bump three root version fields to provisional v11.113.0 only if master unchanged; otherwise re-derive. No extra lock resolution changes. Pre-commit-check/commit.

```bash
npm run generate-docs --workspace=apps/landing
npm run feedback:check
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts regression/sprint-122-tier-parity.test.ts --runInBand --no-cache
git diff --check
```

## Task 11: Pre-push SDLC gates on PR A

**Files:** Whole diff against origin/master; evidence in PR/handoff.

- [ ] **Testing:** Map every locally executable acceptance row to executed proof; eleven suites green/blocking, twenty PR-B failures still visible, no lost assertions/unrun moves, final TDD warning set exact. Mark the two new root integration suites CI-only/pending until the PR exists; defer their executed-in-CI proof to the post-PR follow-up.
- [ ] **/simplify:** Calibrated whole-PR pass; focus on response reads, null-status SQL and test duplication; no broad refactor.
- [ ] **/code-review:** High effort for auth identity, dependency integrity, SQL visibility, frontend state and test truth. Independent reviewer when available/authorized; resolve High/Medium findings.
- [ ] **/security-review:** JWT-vs-query identity, foreign disclosure, all-status audience/expiry, lock provenance, raw-client controls, and disabled simulation actions. No dismissal/exemption changes.
- [ ] Re-run affected checks after every finding; record verdicts/evidence and unresolved limits honestly.

## Task 12: Final verification, handoff and PR A — stop here

**Files:** Changed workspaces, handoff, filled PR template.

- [ ] Reconcile fetch/PR/alerts/master; re-derive version and serialize if master moved. No rebase.
- [ ] Type-check community, request, frontend, simulation and notification plus any other changed source workspace. Run required root/workspace unit+regression directly after renames.
- [ ] Run final `npm run test:tdd`; expect the twenty named PR-B suites on the unchanged Windows host. It must not show the eleven repaired suites or any new/unclassified failure. Do not require or claim local exit 0.
- [ ] Verify final dependency proof/audits and lock diff: intended node-forge entry + three version fields only, no `libc` churn. Keep integration CI evidence explicitly pending before the first push; no merge recommendation while required evidence is missing.
- [ ] Check `git diff --check`, `git status`, exact promotions, generated docs and no scratch/log files. CI run conclusions and created job counts are post-push checks, not pre-push prerequisites.
- [ ] Update handoff, run pre-commit-check/process-reviewer, commit/push with normal authorization and real hooks. Never bypass hooks.
- [ ] Open **one PR A** with every template section filled. Explain split from twenty unready infrastructure/legacy suites to protect the Nov 24 SLA, #333 non-merge, simulation zero-weight decision, test/audit evidence, CI-only integration status and #329/#178 obligations.
- [ ] Stop immediately after PR A creation. No merge/deploy/host operation; next chat reviews PR A, verifies both new integration suites actually executed in CI, and checks required job counts/conclusions before any merge-readiness recommendation.

```bash
npm exec --workspace=services/community-service -- tsc --noEmit
npm exec --workspace=services/request-service -- tsc --noEmit
npm exec --workspace=services/simulation-service -- tsc --noEmit
npm exec --workspace=services/notification-service -- tsc --noEmit
npm exec --workspace=apps/frontend -- tsc --noEmit
npm test
npm test --workspace=tests
npm run test:tdd
npm run audit
npx -y npm@11.19.0 audit --audit-level=low
npm run feedback:check
git diff --check
git status --short
```

Follow snapshot policy for full runs and re-run affected checks after corrections.

## Task 13: PR B decision gate — later planning chat, no implementation yet

**Files:** Future PR-B spec/plan/handoff on a fresh branch from then-current origin/master.

- [ ] After PR A, enumerate the exact twenty suites from the spec and obtain two maintainer-approved artifacts before source moves: required-CI service-tier design and per-suite repair/rewrite/retire ledger.
- [ ] If service `tests/integration` tiers are used, add actual required CI execution with correct env/discovery/blocking semantics; do not rely on their package scripts or auth-only nonblocking `test.yml`.
- [ ] Rewrite legacy live-service tests with self-contained fixtures/current routes before required root integration. No unchanged moves of simulation-seeded `sprint-42-dibs`, `rateCards` or `preSelectProvider`; `/community/my` does not exist.
- [ ] Decide `admin-schemas-api` rewrite versus approved retirement against existing service integration/root live-role/E2E coverage. It is not a ready unit suite.
- [ ] Keep Sprint 117 at its exact TDD path, last in CI. Local Windows TDD may remain nonzero on missing DB; CI is blocking proof.
- [ ] Any obsolete retirement needs separate written maintainer approval and replacement coverage. PR A grants none.

## Task 14: Merge and deploy — NOT AUTHORIZED, separate future chat

- [ ] Only after explicit merge authorization and green gates: follow ship/deploy skills, serialize slot, re-derive version and validate every run conclusion/job count.
- [ ] After patched master, re-query #181–#184 and record actual state; never dismiss as a substitute. Do not merge #333.
- [ ] Demo reads/writes/smoke operations need separate per-operation authorization. Deployment restarts simulation; verify zero weights are in the deployed artifact before claiming governance containment.
- [ ] Reconcile/archive handoff only after verified merge/deploy. Keep #329 open; re-check #178 by 2026-12-01. PR B remains separately planned.

## Planning review ledger

- Original facts and three bug designs were independently reviewed and confirmed against source/live test output.
- **Confirmed blockers corrected:** service integration tiers are not required CI; Sprint 117 is exact-path/last/destructive; unchanged legacy root moves would fail CI and gate deploy.
- **Confirmed behavior correction:** BUG-100 activates currently dead simulation governance; maintainer chose zero weights for now.
- **Policy correction:** retirement is possible only with separate written approval and replacement coverage; no blanket “never delete” deadlock.
- **Promotion correction:** exact `git mv` only; direct broad promoter is forbidden. Its actual sweep covers `.test.ts`, not `.tsx`.
- **Design improvement:** BUG-099 retains `$1`/`$2` via null status rather than dropping/renumbering parameters.
- **Minor corrections:** third raw-fetch lookalike `useMessaging`; handoff branch/product records restored; #333 removes 26 `libc` entries.
- **Review partition correction:** admin-schemas-api is an uninitialized API/DB scaffold, so maintainer chose PR A=11 clear unit/UI suites and PR B=20 infrastructure/legacy suites.
- No production/test implementation has occurred. Planning validation does not prove any bug/alert fixed.
