# Sprint 142 — governance ratification quorum implementation — Handoff

**Date**: 2026-11-13
**Outcome**: in progress. Sprint 141 (PR #337, BUG-073, ADR-105, v11.114.0) is **shipped and verified**; its record
is [archived](archive/2026-11-12-sprint-141-platform-admin-COMPLETE-v11.114.0.md). The maintainer selected
**governance ratification quorum** for Sprint 142 on 2026-11-12. The maintainer approved the written design,
including the builder-review proposals. Claude's seven follow-up findings are verified and incorporated.
Implementation and the fresh review's Important fix are finished. **Ship cycle (2026-11-13, Claude):** the
restored-quorum fix was reviewed with no new findings; the maintainer allocated **v11.115.0** and authorized one
admin merge of PR #338 once the ADR-060 gate is green. The gate is blocked only by CodeQL #633–#638 (test file),
which await the maintainer's dismissal. Read PR/CI state live rather than inferring it here.

> State between sessions only. Branch-local, so it reserves nothing; see `.claude/handoff/README.md` →
> *Parallel development rules* for how contended resources are allocated.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-142-planning` |
| **Base** | `origin/master` at `898f23ba` (fetched 2026-11-13; no open PRs observed) |
| **Active editor** | Claude (reviewer/orchestrator, ship cycle, 2026-11-13). Codex authored the implementation (lane `codex`) |
| **Reviewer role** | A non-author. Reviewers read the diff and do not co-edit |
| **Owned paths** | Governance DB/policy/routes + scoped tests in community-service; GovernanceTab/onboarding/tests; simulation reset table policy/context/test; migration/generated schema; scoped guides/ADR-055/generated landing docs; registry and this handoff. Sprint 141 records remain bundled from `bc53d728` |
| **Shared resources needed** | Maintainer authorized real-DB tests via SSH on karmyq.com (isolated disposable DB/container). **Allocated 2026-11-13:** release version v11.115.0 and one admin merge + deploy slot for PR #338, conditional on a green ADR-060 gate. Demo application mutations, platform-admin grant/200 smoke, new ADR numbers and dependency lane remain unallocated |

## Links

- **Sprint 141 archive** (post-merge verification + the final Sprint 141 handoff, verbatim):
  [archive/2026-11-12-sprint-141-platform-admin-COMPLETE-v11.114.0.md](archive/2026-11-12-sprint-141-platform-admin-COMPLETE-v11.114.0.md)
- **ADR-105** (Implemented): [docs/adr/ADR-105-platform-admin-role.md](../../docs/adr/ADR-105-platform-admin-role.md)
- **PR**: resolve the branch's product PR with `gh pr list --state all --head agent/claude/sprint-142-planning`.
  Its Validation ledger is authoritative for final SHA/command/cache evidence. PR creation is this execution
  session's final action; no CI outcome or merge readiness is claimed here.
- **Approved spec**: [2026-11-12-sprint-142-governance-quorum-design.md](../../docs/superpowers/specs/2026-11-12-sprint-142-governance-quorum-design.md)
- **Implementation plan**: [2026-11-12-sprint-142-governance-quorum.md](../../docs/superpowers/plans/2026-11-12-sprint-142-governance-quorum.md)

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`. If master moved past `898f23ba`, merge
   `origin/master` into this branch with a merge commit (never rebase).
2. **This branch's first commit is Sprint 141's post-merge record (`bc53d728`, already pushed).** It must never
   reach master on its own (no docs-only master push); it rides with the next product PR. Reuse this task branch.
3. Orchestrator: read PR #338's live checks. Review, version allocation and merge authorization are done
   (see *Ship cycle* below). Implementation is finished; no new execution workspace is needed.

**Next unchecked task for the orchestrator**: once the maintainer has dismissed CodeQL #633–#638 and the ADR-060
gate is green on the version-bump commit, mark #338 ready and admin-merge it (authorized once, 2026-11-13). Then
verify the master CI/CD run (job count + conclusion), Deploy to Demo, health, and open master CodeQL alerts on the
merge SHA. Post-merge records ride the next product branch. Contributor never self-merges. Platform grant and
granted-account 200 smoke remain a separate, unauthorized operation.

## Ship cycle — 2026-11-13 (Claude, non-author orchestrator)

- **Restored-quorum fix (`932cc19d`) reviewed, no new findings.** `addRatification` already finalizes on a
  duplicate `ON CONFLICT DO NOTHING` ballot by recounting under the nomination lock. The new read-only
  `ready_to_finalize` count in `getGovernanceState` uses the same live-tally predicate as the POST (ballot ∩
  frozen roster ∩ active member of the path community), so the Finalize button cannot appear when the POST
  would refuse. No new disclosure: count and required were already public. A 422 at finalize (nominee
  inactive or trust-ineligible) leaves the nomination pending with Finalize still shown. That is the accepted
  stall behavior (no expiry or withdrawal).
- **PR CI on `932cc19d`** (CI/CD run 43513192874 + Tests/PR Contract/Regenerate init.sql runs): unit +
  regression, frontend, lint/type, security audit, landing build, Docker build, init.sql regen and Integration
  Tests all passed. Integration ran 31 suites / 546 tests; the Sprint 142 file passed 32/32 and logged
  `karmyq_test rolsuper=true rolbypassrls=true`. Build Images/Deploy skipped (PR event).
- **ADR-060 gate blocked by 6 high CodeQL alerts, all in
  `tests/integration/sprint-142-governance-quorum.integration.test.ts`:** #633–#637 `js/sql-injection` (lines
  62/71/125/136/159). The SQL is the checked-in migration and `init.sql`, read from fixed `__dirname` paths.
  #638 `js/missing-rate-limiting` (line 429): a supertest-only Express harness that is never served.
  Precedent dismissals: #588–#591 (false positive), #619–#623 (used in tests). The maintainer dismisses; agents
  never loop the dismissal API.
- **Version bump commit:** `package.json` + the two root `package-lock.json` fields, 11.114.0 → 11.115.0
  (re-derived from `origin/master` `898f23ba`). The spec header was updated.
- **Gotchas added (maintainer-approved):** `docs/gotchas/migration-appliers-disagree-on-transaction-wrapping`
  and `docs/gotchas/database-roles-bypass-rls-so-rls-is-not-an-isolation-proof`; `gotcha-check` clean (15).

**Implementation and evidence (2026-11-13):** review amendments `dfdfefba`; policy `f85924b1`; migration/schema
`28e14995`; route contracts `7caa4210`; creation `35bf5ff1`; voting `2d5d32df`; getter/routes `3db3bc4e`;
UI `e2c8a6f1`; source/generated guides + ADR amendment `58a91072`; regression/context `0c746ef9`; own
simplify/security/lint fixes `f162c1e6`. Detailed red→green evidence lives in these commit messages; final
post-review verification is recorded in the final verification commit message and PR Validation ledger.

The full Sprint 142 integration suite passed **30/30**, uncached, during Task 9 (see `0c746ef9` and its
preceding test evidence). This predates the later UUID and restored-quorum cases; use final PR evidence for
the complete post-review suite. It covers both valid
communities, protocol replay/cutoff, real JWT routes, live membership/counts, reactivation, role preservation,
concurrent votes/departures, and invalid config/metadata. Actual role: karmyq_prod, rolsuper=true,
rolbypassrls=true; explicit community predicates supply isolation, not RLS. The DB/container was disposable
on karmyq.com through SSH; no live application DB/reset/platform grant was changed.

Both canonical appliers passed: tracked wrapper applied exactly the new migration to a separate baseline DB;
CI applier replay reported zero schema drift. Exact migration transfer/regeneration/artifact download was
explicitly approved after automatic approval review initially rejected SCP; the approved operation succeeded.
Six green Sprint 142 test files were promoted individually to regression. Direct uncached checks passed:
community 48, frontend 13, reset/catalog 5. Prior workspace pairs passed community 9 unit/282 regression and
frontend 62 unit/595 regression. These older counts are historical; final all-workspace evidence belongs in
the verification commit message and the PR, rather than a count that goes stale in this handoff.

Task 9 committed `0c746ef9`; its completion check repeated 30/30 real-DB tests uncached. Task 10's own simplify/
security passes refined conditionals/formatting, restored unrelated registry encoding, and fixed a reproduced
uppercase-UUID mismatch (new real-DB case red→green). React lint caught render-ref/effect-state problems;
the UI now keys a panel by community+viewer and handles state in async callbacks.

**Fresh non-author review (`898f23ba..f162c1e6`):** no Critical findings or additional security vulnerability.
One Important was confirmed with real-DB and component RED tests: staff reactivation could restore quorum
with all voters already ratified, leaving no UI action. Fixed with coarse `ready_to_finalize` and an explicit
Finalize decision action using the existing idempotent POST. GET stays read-only, ballots stay unique and
final eligibility checks still run. Focused fix tests passed; final complete-suite results belong in PR Validation.

**Deferred Minor:** `not_in_electorate` UI copy says a member joined later, but a previously inactive member
reactivated after opening can also receive it. Eligibility enforcement is correct; wording refinement is deferred
under the inline execution review policy. Suggested copy: “You were not an active member when this nomination opened.”

**Review rulings:** BUG-102 self-join remains out of scope (500 still exists); automatic rotation/revocation,
delegation/expiry/withdrawal remain deferred (pending nominations can stall); persona-heavy demo quorum
limitations remain accepted (simulation stays off); release/platform/deploy operations remain authorization-gated
(draft PR is not shipping authority). Disposable DB isolation and the two extra regression suites were retained.

## Non-author review response — 2026-11-13

Findings quoted from the maintainer's relayed Claude review. Source evidence and decisions follow; the
implementation/runtime proof is summarized above and will be pinned to final commits in the PR ledger.

1. > The migration must work under both appliers. apply-migrations.sh wraps the file in BEGIN/COMMIT; ci-apply-full-schema.sh strips it and autocommits, so a top-level LOCK TABLE fails CI and init.sql regen. No BEGIN/COMMIT in the file; the lock, the legacy close and the guards are atomic under both (e.g. one DO block); replaying over init.sql changes no schema.

   **CONFIRMED:** `scripts/apply-migrations.sh:83-90`, `scripts/ci-apply-full-schema.sh:90-105`,
   `scripts/regenerate-init-sql.sh:155-163`. Spec and Task 2 require one atomic DO block, no top-level
   transaction wrapper/lock, both-applier proof and schema-identical replay.

2. > CI applies the full chain before integration tests, so the guards already exist. Name the fixture: drop guards + insert legacy rows + run migration + ROLLBACK in one transaction for the replay test; a committed drop with verified restore (integration runs serially, maxWorkers 1) or a scratch DB for the two-connection cutoff test.

   **CONFIRMED:** `.github/workflows/ci.yml:317-326`, `tests/jest.integration.config.js:51`. Named rollback
   fixture added to spec/Task 2; independently committing cutoff fixture uses a task-owned scratch DB with
   verified guard restoration, never live application guard removal.

3. > Add 'communities.governance_nomination_voters': 'reset' to services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts (gate: sprint-141-table-policy-covers-init-sql.test.ts).

   **CONFIRMED:** `services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts:80-81` lists the two
   existing governance tables; the catalog-derived gate is actually in that service's `tests/regression/`
   (`sprint-141-table-policy-covers-init-sql.test.ts:47-51`). Task 2 now includes classification and gate proof.

4. > CI and services connect as the postgres image superuser, so RLS is bypassed. Do not use RLS as the isolation proof; test the explicit community_id predicates; record rolsuper/rolbypassrls in the evidence.

   **CONFIRMED configuration, live flags still to be measured:** `tests/docker-compose.test.yml:16,56`,
   `.github/workflows/ci.yml:339`, `services/community-service/src/database/db.ts:10-15`. Spec/Tasks 2/9 now
   require role flags and explicit foreign-community predicate tests; enabled RLS is not credited as proof.

5. > Lock order: add ORDER BY user_id to the last-admin guards (members.ts:407-409, 514-516) or map 40P01 to a retryable error. Creation locks only nominator + nominee (FOR NO KEY UPDATE). Name Task 5's exact lock set.

   **CONFIRMED:** both last-admin queries lack ordering at the cited lines. Chosen bounded fix: rollback
   and map 40P01 to retryable 503 GOVERNANCE_RETRY. Creation locks only nominator/nominee; voting locks
   the nomination then nominee + all snapshot membership rows, including inactive voters, ordered by user_id
   FOR NO KEY UPDATE. Spec/Tasks 4/5 name the sets and required overlap tests.

6. > Rejoin exists only as an admin PUT status 'active'. A self-join of an inactive row 500s (pre-existing; log it via /bug). Test the admin path; the guide must not promise self-service rejoin.

   **PARTIAL (staff-role detail):** `members.ts:348-369` also admits status-only moderator updates.
   `members.ts:106-133` checks active/pending but then INSERTs an inactive membership, conflicting with
   `init.sql:3210` uniqueness; its catch at `members.ts:203-204` returns internal error. Captured as BUG-102,
   reported/source-traced, not live-reproduced. Spec/Tasks 5/8 use the real staff PUT; self-join fix stays out of scope.

7. > Task 7: hide same/lower-role nominations using role_holders; GET exposes a coarse can-nominate flag for communities too small to nominate in.

   **CONFIRMED:** current UI offers both roles at `apps/frontend/src/components/GovernanceTab.tsx:150-157`;
   old GET has no such flag (`governanceDb.ts:110-115`). Spec and Tasks 6/7 now define can_nominate and
   role_holders-based choices, with both UI and server refusal tests.

**Maintainer answers (2026-11-13):** (a) “Demo db... you can ssh on karmyq.com to run it.” Use disposable
database/container isolation on that authorized host; SSH/Docker availability verified read-only this session.
No tests may drop guards or create irreversible fixture changes in the live application DB. (b) “I Accept this”:
persona-heavy demo communities may not reach quorum. Simulation nomination/ratification stays disabled.
CI starts on PR creation, not feature pushes (`.github/workflows/ci.yml:3-7`); local real-DB proof precedes PR.

## Blockers and decisions

- **Decision (2026-11-12):** the maintainer chose governance ratification quorum as the Sprint 142 topic.
  Current behavior was read from `services/community-service/src/routes/governance.ts:80-98` (active-member
  ratification, nominee excluded) and `services/community-service/src/database/governanceDb.ts:119-137`
  (fixed quorum stored at nomination creation; default 3 at line 26). The role-holder-only wording in
  `docs/concepts/governance.md:11` disagrees with the route and needs reconciliation in the planned product PR.
- **Decision (2026-11-12):** the maintainer chose equal votes for active members with quorum scaling by community
  size over trust-qualified voters or trust-weighted votes. Simulation governance actions remain disabled; their
  activation needs a separate decision (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:67-70`).
- **Confirmed scope (2026-11-12):** `max(3, ceil(E / 5))`, where E is active members other than the nominee at
  nomination creation; fixed voter roster; only still-active voters count; atomic role grant; UI/docs updates;
  existing pending nominations close and require resubmission. No release version or other shared resource was
  allocated.
- **Builder check resolved and design approved (2026-11-12):** the spec adds database protocol guards to fence the old writer during
  migration/rollback (`scripts/deploy.sh:150-155,225`), plus monotonic role elevation so a later moderator
  nomination cannot demote an admin (`services/community-service/src/database/governanceDb.ts:167-170`). These
  were Codex proposals that the maintainer subsequently approved with the written design. Same/lower-role
  nominations are refused; no new role-removal or expiry mechanism is added.
- **Implementation choices approved with the design:** fewer than three voters besides nominee refuses creation;
  original voters may rejoin; R never shrinks; nominee is rechecked for active membership and existing private
  trust eligibility at grant; stale closed vote retries refuse; existing ADR-055 is amended, no new number.
- **Pending authorization — the demo platform-admin grant (ADR-105 §6).** Rollout is fail-closed: until the grant,
  nobody on the demo can edit request-type schemas or trust questions, or run the provider-trust backfill.
  - The maintainer chooses the account, never a simulation persona with shared credentials.
  - It runs as DB user `karmyq_prod`, with explicit per-operation authorization, and is repeated after every curated
    demo reset.
  - Then finish the smoke test: the granted account gets 200 on `GET /api/admin/schemas`, and
    `GET /api/users/me/platform-role` returns `platformAdmin: true` for it. The refusal half already passed live
    (archive, *Smoke test*).
- **Decision (2026-11-12):** ADR-105 moved to Implemented at the verified deploy, as its own status line said. The
  owed grant is an operational step and does not hold the status back.
- **Decision (2026-11-12):** the BUG-076/080/081/082/092/097/098/099/100 status lines were corrected in this record,
  because both deploys were verified (#332 run 42914254213 and #334 run 43103530588, 14/14 jobs each). They had still
  said "on branch / not yet deployed".

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
11. Restored quorum must stay actionable: active prior voters may finalize through the idempotent POST without adding a ballot; GET remains read-only.

## Deferred minors (from Sprint 141's gates; detail in the PR #337 body)

- A second `GET /users/me/platform-role` from `CommunityConfigEditor` on the Profile tab, including in read-only
  mode.
- The 401 bodies in `requirePlatformAdmin` and the trust-question gate lack an ADR-074 `error` code. That is the
  pre-existing shape (`verifyToken`, `483ae889`), moved there. Observed live on 2026-11-12.
- If the platform-admin lookup throws, the trust-question router gate's error now reaches the app-level handler. It
  is still a logged 500, but without the route-tagged message.
- `requirePlatformAdmin` / `requireAnyCommunityAdmin` could share a factory.
- No test pins `platformRoleService.get` to `/users/me/platform-role`. A wrong path would fail closed.
- ADR-102:47 and ADR-032:415 still use the pre-Sprint-141 names. They are dated records.

## Carried follow-ups (out of scope unless a plan names them)

- **From Sprint 141:**
  - `tests/e2e/admin/schema-management.spec.ts` (not in CI) needs a platform-admin fixture.
  - `apps/frontend/tests/tdd/SchemaManagerNav.test.tsx` still asserts that a creator sees the link. It tests an
    inline stub and is a spec-deferred suite; retiring it needs maintainer approval (Sprint 140 PR B material).
  - Two IDEAS entries (2026-11-12): community-owned custom request types; folding the founding-circle reviewer
    allowlist into `auth.platform_admins`.
- **CodeQL on `api.ts`, new datapoint (2026-11-12):** the master merge-SHA analysis raised #632 on line 851, which
  #337 did not touch, while the PR-ref analysis showed only #631. Read open master alerts after every merge; don't
  predict them from the diff.
- **ADR-103 is still Proposed.** It needs the maintainer-run deploy-time demo check
  (`docs/adr/ADR-103-authenticated-listings-and-simulation-containment.md:85-87`), then a flip on a product branch.
- **The landing docs test dirties the tree on a Turbo cache miss.** It needs an output-dir option in
  `scripts/generate-docs.ts`.
  - On this box `architecture.json`'s `dependencyGraph` field also churns. It mirrors the untracked, locally
    generated `services/dependency-graph.md`; restore that field.
  - Observed 2026-11-12: the committed `apps/landing/src/data/docs/build.json` is frozen at `a8e78603`
    (2026-10-15, `adrCount` 99; the generator now says 103), because every record restores it as churn. Whether the
    deployed landing site shows those values is UNVERIFIED.
- No relocation pointer gate for the root `claude.md` `→ *Heading*` pointers.
- The landing **prebuild** claim is UNVERIFIED (`apps/claude.md:46,49,53`, `scripts/claude.md:54`, the
  landing-docs gotcha). It never runs under `ignore-scripts`.
- The migration-validator schema list is stale (`.claude/agents/migration-validator.md:12-24`).
- BUG-101 (dead Edit/Write hook handlers), `docs/BUGS.md`.
- #335 item 6, the remaining half: session/service deduplication of the context reminder.
- Sprint 140 PR B: unplanned and decision-gated (required-CI integration execution, the per-suite WIP ledger,
  including `admin-schemas-api`).
- Expo SDK drift: #329 open; re-check deepmerge alert #178 at the next Expo SDK move or by **2026-12-01**.
- Later product candidates: the governance ratification quorum, the exchange back-out control (IDEAS 2026-10-29), and
  the mobile revival.
- **Git Bash trap:** a `node` argument starting with `//` is rewritten by MSYS path conversion, and so is
  `git show <rev>:<path>`. Export `MSYS_NO_PATHCONV=1`, or put replacements in a script file.

## Verification references

- **Bootstrap observed 2026-11-12:** fetch succeeded; `origin/master` remains `898f23ba`; `gh pr list` returned no
  open PRs. No merge/rebase was needed. `bc53d728` was pushed to `origin/agent/claude/sprint-142-planning`
  with normal hooks: required test graph 27/27 successful, 24 cached; root tests 10/101 unit and 49/1074 regression.
  Pre-push run summary: `.turbo/runs/3M1l4WXrRyBNi34dgykmAxvtY9Z.json`. Integration skipped because no DB was
  available. WIP/TDD report returned 1 in four workspaces; it is nonblocking and was not represented as passing.
  These checks preceded the new planning artifacts and do not verify the proposed feature.
- Sprint 141 deploy: master CI/CD run [43318586338](https://github.com/ravichavali/karmyq/actions/runs/43318586338)
  attempt 2, `success`, 14/14 jobs including Deploy to Demo (observed 2026-11-12). Smoke-test detail is in the
  archive.
- Security state observed 2026-11-12, after the #631/#632 dismissals: 0 open code-scanning alerts on master.
- This branch's records are docs only (BUGS.md status lines, ADR-105 status, index, two generated landing JSON files,
  handoff). Before committing them, `npm test --workspace=tests` (the root gates, including the doc/context drift
  gate) ran on the working tree on 2026-11-12; see the commit message for its result.

⚠️ GitHub status goes stale. Re-derive PR and deploy state before trusting anything above.
