# Sprint 144 — Staff membership write integrity — Handoff

**Date**: 2026-11-19
**Outcome**: **PLANNED — review rounds 1–2 integrated; awaiting Codex re-review round 3 (delta only).** The
maintainer approved decisions 1–6 in the planning chat. Codex's round 1 returned 11 findings (`e6713ca5`) and
round 2 returned 8 (`ba798c27`). Claude verified every finding against the repo, and the maintainer decided 7–11
on the open points. Spec, plan, the
Sprint 143 post-merge record and the bug-log updates are committed on this branch. No product code has been
written yet.

> State between sessions only. This branch-local file reserves no contended resource; see
> `.claude/handoff/README.md` → *Parallel development rules*.

## Ownership and live base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-144-planning` (reused as the execution branch) |
| **Base** | `origin/master` `a2746057` (Sprint 143 #340, v11.116.0), fetched 2026-11-19 |
| **Upstream** | none yet; first push is `git push -u origin agent/claude/sprint-144-planning` |
| **Open PRs observed** | Dependabot #339 (`next` → 16.4.6). Not used: it nests `next` under `apps/*`, strips 26 `libc` lines, and fails the lint-config gate |
| **Spec** | `docs/superpowers/specs/2026-11-19-sprint-144-staff-write-integrity-design.md` |
| **Plan** | `docs/superpowers/plans/2026-11-19-sprint-144-staff-write-integrity.md` (14 tasks) |
| **Ledger** | `.superpowers/sdd/2026-11-19-sprint-144-staff-write-integrity/progress.md` (create in Task 1) |
| **Release** | provisional v11.117.0; the maintainer allocates the version and merge slot at merge time |

Never rebase this branch.

## Quick Start

0. **Plan review gate.** Until the *Plan review log* below shows the latest round integrated, the next step is not
   execution:
   - **Codex** reviews the spec + plan read-only and returns numbered findings in chat.
   - **Claude** (the author) verifies each finding against the repo with the `review-response` skill, integrates
     them, commits `docs: Sprint 144 plan review round N — …`, and updates the log.
   - A re-review covers only that round's delta.

   Once the log says the plan is ready for Task 1, continue at step 1.
1. Read this handoff.
2. Reuse the existing task branch: `git switch agent/claude/sprint-144-planning`, then `git fetch origin`. If
   `origin/master` moved past `a2746057`, merge it with a merge commit (never rebase). Do not create a
   `feature/...` branch. Never branch off a stale local master; unpushed local-master commits leak in via the
   squash-merge.
3. Open the plan: `docs/superpowers/plans/2026-11-19-sprint-144-staff-write-integrity.md`.
4. Invoke `superpowers:executing-plans` (shared working tree, one editor) or
   `superpowers:subagent-driven-development`. There is no `/execute-plan` slash command; superpowers removed it.
5. Task 1 starts the authorized disposable PostgreSQL container (decision 9), then makes the Next.js splice the
   **first commit**. **SLA: merged by 2026-12-01.**

## Plan review log

| Round | Reviewer | Reviewed head | Status |
|---|---|---|---|
| 1 | Codex (read-only) | `e6713ca5` (spec + plan) | **integrated**. 11 findings (2 BLOCKING, 7 SHOULD-FIX, 2 NIT), all verified (10 confirmed, F3 partial); see *Round 1 dispositions* |
| 2 | Codex (read-only) | `ba798c27`, delta vs `6559e7c8` | **integrated**. 8 findings (1 BLOCKING, 6 SHOULD-FIX, 1 NIT), all confirmed; see *Round 2 dispositions* |
| 3 | Codex (read-only) | the round-2 integration commit, delta vs `ba798c27` | **pending** |

### Round 1 dispositions (2026-11-19)

| # | Finding | Verdict | Resolution |
|---|---|---|---|
| F1 | Splice leaves `next`'s exact `@next/env` + 8 SWC references at 16.4.2 | CONFIRMED (`package-lock.json:18665`, `:18679`) | Note 1 + Task 1 update those 9 references; 16.4.6 metadata read (`optionalDependencies`, `peerDependencies`, `engines`) |
| F2 | Old writers double-count between migration and restart | CONFIRMED, worse: a failed build at `deploy.sh:208-219` leaves old code serving with the trigger | **Decision 7: column guard** |
| F3 | Staff DELETE (`left → inactive`) + reactivation forces a departed member back | PARTIAL: Sprint 143 keeps the DELETE block on purpose (S143 spec `:172-173`) | **Decision 8: reactivate lifts the block** (`inactive → left`) |
| F4 | Reciprocal community moves can deadlock | CONFIRMED but theoretical: no writer moves `community_id` | Sync trigger raises on `community_id` change; one community row per firing |
| F5 | Note 3 misidentifies regression changes | CONFIRMED (S93 `:91`, S132 `:48-51` (corrected in round 2), S133 `:62` is a GET fixture; S92 also synthetic) | Note 3 split into (a) UUID fixtures, (b) transaction mocks, (c) counter mocks |
| F6 | Delta gate regex misses alias/order/wrapper forms | CONFIRMED | Gate flags any self-referential assignment; negative fixture per form |
| F7 | Count equality cannot prove a trigger did not write | CONFIRMED | Note 14: `xmin` evidence |
| F8 | No-container path skips the migration's red phase | CONFIRMED | **Decision 9: disposable container**; Tasks 5–7 run real-DB cases red first |
| F9 | Draft-PR "plumbing" note is an unapproved exception | CONFIRMED | Removed; the PR opens only at the end of Task 13 (decision 9) |
| F10 | Archived recomputes unclassified; one counts all statuses | CONFIRMED (`generate-realistic-data.ts:430`) | Classified as excluded deprecated tooling; the guard ignores both |
| F11 | Nominee already lowercased; other raw comparisons missed | CONFIRMED (`governanceDb.ts:227-229`, corrected in round 2; `links.ts:56`, `fusions.ts:113`, `splits.ts:79`) | Inventory corrected; governance is consolidation only; the others are fail-closed or DB-checked |

### Round 2 dispositions (2026-11-19)

| # | Finding | Verdict | Resolution |
|---|---|---|---|
| R1 | Staff direct-add makes a user active without consent, contradicting decision 8's wording | CONFIRMED (`members.ts:254-260`; `addMember` at `api.ts:233` unused; used by `tests/fixtures/index.ts:309`, `:402` and the S132 tests) | **Decision 10: documented exception**; guarantee reworded to returning members; **BUG-107** logged |
| R2 | `left → left` matches both `MEMBER_MUST_REJOIN` and D4 | CONFIRMED | D3 precedes D4: any request against a `left` row is `MEMBER_MUST_REJOIN` |
| R3 | S142 tests and two docs still restore by staff PUT `active` | CONFIRMED (S142 test `:325`, `:342`; `governance.md:21`; guide `:100-102`) | Task 7 rewrites both S142 cases to lift + self-rejoin; Task 10 updates both docs |
| R4 | The fixture rule would erase the S134 L2 health test's deliberate corruption | CONFIRMED (`:53-55`, `:175-181`) | Note 2 exception: a scoped flag helper keeps the scenario and its exact assertions |
| R5 | "Every new case must fail" is impossible for baseline cases | CONFIRMED | Note 11: red for changed behavior only; baselines expected-green; the static gate proves neutralized-statement removal |
| R6 | A bare PostgreSQL container cannot run the services/Redis suites | CONFIRMED (e.g. `event-driven-flow.integration.test.ts:46`, `:54`; `sprint-133-endorsement-trust.integration.test.ts:162`) | **Decision 11:** in-process DB suites locally; full suite in PR CI, read by the next chat |
| R7 | Task 13 still reads CI and pushes after creating the PR | CONFIRMED (`feedback_stop_after_pr_creation`) | Handoff pushed first; PR creation is the last action; CI reading moved to Task 14 (next chat) |
| R8 | Wrong citations; "exactly one" community row | CONFIRMED | `governanceDb.ts:227-229`; S132 `:48-51` and its `withTransaction` mock (`:32`) so (a) only; UPDATE inventory adds `members.ts:133-136`, `:384-390`; "at most one" |

## Sprint goal

Make every staff membership write authorized per transition and make `communities.current_members` impossible to
drift, while shipping the Next.js 16.4.6 security patch inside its SLA.

## Arc

- Sprint 142: proportional ratification (v11.115.0, deployed 2026-11-15).
- Sprint 143: nomination lifecycle + member rejoin (#340 `a2746057`, v11.116.0, deployed 2026-11-19). It logged
  BUG-103/104/105 for the staff PUT.
- **Sprint 144 (this):** staff-write integrity + DB-owned member count (ADR-106) + Cancel request + `next` 16.4.6.
- Later, needing a maintainer decision:
  - BUG-106 (invitation capacity / silent no-op);
  - role rotation and revocation;
  - a DB CHECK on member role/status;
  - applicant notifications on approve/reject.

## Maintainer decisions (2026-11-19)

1. Scope: staff-write integrity (BUG-103, BUG-104, BUG-105, PUT validation) + web **Cancel request**.
2. Next.js #185/#186: dependency work authorized, bundled as the **first commit**, in-place splice; merge by
   2026-12-01; #339 not used.
3. Stored drift: a recount migration. That is the one authorized demo write, applied by the normal deploy migration
   path. No demo reads.
4. Moderators: approve/reject only (`pending → active`, `pending → inactive`); everything else is admin-only.
5. A DB trigger owns `current_members`; hand `±1` writes are removed; capacity is checked atomically in the app by
   a post-write re-check; fission/fusion are unchanged.
6. **ADR-106 allocated:** "Database-owned community member count".
7. **Column guard** (round 1, F2): a `BEFORE INSERT OR UPDATE OF current_members` trigger on
   `communities.communities` ignores every write not made by the sync trigger or the recount function, so old
   containers, a failed build and rollbacks cannot double-count.
8. **Reactivate lifts the block** (round 1, F3): an admin PUT `inactive → left`; the person rejoins themselves.
   Staff never return someone who left or was removed/rejected; direct-add and fission/fusion are the documented
   exceptions (decision 10).
9. **Disposable PostgreSQL container** on the demo host over SSH, with no demo data, for real-DB red→green (round 1,
   F8/F9). There is no draft-PR exception; the PR opens at the end.
10. **Staff direct-add is a documented exception** (round 2, R1): it keeps activating a user directly (admin-only,
    API-only), and decision 8's guarantee covers returning members. The consent gap is BUG-107.
11. **Verification scope** (round 2, R6): the container runs the in-process DB suites; the services/Redis suites run
    in PR CI and the next chat reads them. No isolated full test stack is authorized.

Planning defaults D1–D8 are in the spec's *Planning defaults* section, and review may challenge them:
- one change per request;
- staff actions never leave a staff role on a returning row;
- `left` belongs to the member (staff write it only to lift a block);
- retries are 409;
- the ADR-074 envelope;
- no event changes;
- the fission/fusion recompute stays (now a guarded no-op);
- BUG-106 stays open.

## ⚠️ Critical Implementation Notes (verbatim from the spec)

1. **First commit = the Next.js splice, nothing else.** Root lock nodes `node_modules/next`, `node_modules/@next/env`
   and the 8 `node_modules/@next/swc-*` go 16.4.2 → **16.4.6**: `version`, `resolved` and `integrity`, from
   registry metadata. The `node_modules/next` node's own exact references change too (Codex F1):
   `dependencies["@next/env"]` (`package-lock.json:18665`) and the eight `optionalDependencies` `@next/swc-*`
   (from `:18679`) go `16.4.2` → `16.4.6`.

   Registry metadata read 2026-11-19: 16.4.6 is `latest`. Its `dependencies` equal 16.4.2's except `@next/env`.
   Its `optionalDependencies` are the eight SWC packages at 16.4.6 plus an unchanged `sharp ^0.35.5`. Its
   `peerDependencies` and `engines` (`node >=20.9.0`) equal the lock node's.

   Keep every `libc` field (4 swc nodes carry one). Declared ranges go `^16.4.2` → `^16.4.6` in
   `apps/frontend/package.json:24`, `apps/landing/package.json:18` and those workspaces' `packages[...]` entries in
   the lock. `postcss` stays governed by the root override `"postcss": "^8.5.25"`, so no nested postcss node is
   added. `next` stays at the root because `eslint-config-next` requires its bundled parser from there (#339's
   failure).

   Prove the splice with strict `npx npm@11.19.0 ci`, an `npm ls --all` problem list identical to master's
   (BUG-047's `picomatch` line is pre-existing), the ADR-059 audit gate at 0 high/critical with #185/#186's GHSAs
   gone, and `tests/regression/sprint-122-lint-config-gate.test.ts` green. Never execute a downloaded tarball.
   Never use `npm install --workspace`, `npm dedupe` or a lock regen. Use a script file with match-count guards
   for the splice.
2. **The counter is no longer settable, so fixtures must create rows.** Under the column guard, a community INSERT
   stores `0` and any `UPDATE … current_members` outside the sync path is ignored. A test that "sets" a count, or
   needs a full community, must create the active rows or lower `max_members`. Inventory every such site before
   implementing. Known sites:
   - `tests/integration/sprint-143-governance-lifecycle.integration.test.ts:48`, which also sets counts at
     `:652`, `:666` and `:689`;
   - `tests/integration/social-graph.test.ts:152-188`;
   - `tests/integration/sprint-142-governance-quorum.integration.test.ts`;
   - `tests/integration/sprint-134-pr-l2-health.integration.test.ts`;
   - `infrastructure/postgres/seed-e2e.sql:85`, `:114`;
   - the `tests/fixtures/` seeds.

   Fix each fixture to state the truth. Never weaken an assertion to make it pass.

   **One controlled-corruption exception (Codex round 2, R4).** `tests/integration/sprint-134-pr-l2-health.integration.test.ts`
   deliberately stores wrong cached counts (`:53-55`) to prove that health metrics read live rows, not the cache
   (`:175-181` asserts a cached `0` for a community whose live data yields 24 participants). Keep that scenario. Write the corrupt values inside
   a helper that sets `karmyq.member_count_sync` to `'on'` for that one statement and restores it, the same way the
   recount tests seed drift. Keep the exact assertions, and recount or clean up afterwards.
3. **Existing regressions change for three separate reasons; inventory each separately (Codex F5).**
   - **(a) UUID fixtures.** `sprint-93-members-delete-jwt` (`/comm-1/members/victim`, `:91`),
     `sprint-132-body-identity` (`'admin-user'`, `'attacker-user'`, `:48-51`), `sprint-92-last-admin-guard`, and any
     other route test Task 2 finds, use non-UUID ids that the new validation rejects. Replace them with valid UUIDs
     and keep every exact authorization, bound-identity and no-write assertion. Never change an expected 403 into
     a 400.
   - **(b) Transaction wrapping.** Staff add and the duplicate-create join now run inside `withTransaction`. Tests
     that mock only `query` (`sprint-77-idempotent-create`, and any other Task 2 finds) must also mock the
     transaction client, as `sprint-92` and `sprint-93` already do. `sprint-132-body-identity` already mocks
     `withTransaction` (`:32`), so it needs (a) only.
   - **(c) Counter mocks.** `sprint-77`'s `UPDATE … current_members` mock (`:75`) becomes dead; delete it.
     `sprint-133-member-email-admin-only`'s `current_members: 3` (`:62`) is a GET fixture and is unrelated; no
     change. `sprint-78-fission-execute` and `sprint-86-fusion-member-count` assert the recompute that stays (D7),
     and must stay unchanged and green.

   Each changed regression file states its reason in its header.
4. **Capacity is checked after the write, never only before.** `assertWithinCapacity` runs inside the same
   `withTransaction`, after the member write, and throws to roll back. A returned sentinel would commit
   (`db.ts:51-53`). The admitting paths are join-to-active, staff add, PUT approve and the duplicate-create join;
   lifting a block admits nobody. The real-DB race test must show two concurrent admissions into a community with
   one free slot produce exactly one 200 and one 400 `COMMUNITY_FULL`, and a final count of `max_members`.
5. **Lock order is member row(s) → that one community row.** Membership rows never move between communities (the
   sync trigger raises on a `community_id` change), so each firing locks at most one community row (Codex F4;
   round 2, R8). Do
   not add a `SELECT … FOR UPDATE` on the community row before member locks: that inverts join/DELETE's order and
   can deadlock with the trigger. Governance keeps nomination → memberships (Sprint 143). Its role-only update does
   not fire the trigger.
6. **The PUT locks and reads in one transaction.** It locks the target plus active admins in the existing
   user-ID-ordered statement (`members.ts:371-376`), reads the caller's live role and the target's stored
   status/role, plans the change with `planStaffChange`, then writes. The caller's role is read inside the
   transaction (ADR-102). Today's pre-transaction read (`members.ts:310-314`) allows a demoted moderator to race
   a write.
7. **Canonicalize at parse, compare canonical.** The member routes run every request-supplied id they compare in
   JS through `canonicalUuid`. A malformed id is 400 before SQL. JWT ids are compared as issued. Do not fix BUG-104
   by casting inside SQL alone: the JS comparison is the bypass. Governance already lowercases
   (`governanceDb.ts:227-229`); importing the shared regex there is consolidation.
8. **The migration must hold on both appliers.**
   - No top-level `BEGIN`/`COMMIT`/`LOCK`.
   - Rerunnable, with a zero-drift normalized dump.
   - `lock_timeout` set locally so a busy table fails the migration (deploy rolls back, `deploy.sh:157-162`)
     instead of stalling it.
   - Run the `migration-validator` agent before committing it.
   - Regenerate `init.sql` through `gh workflow run regenerate-init-sql.yml --ref agent/claude/sprint-144-planning`
     (no local Docker), and commit the artifact only while the branch's pre-migration `init.sql` equals master's.
   - A fresh boot from the regenerated `init.sql` must show correct counts for its spliced seed data.
9. **RLS is not the isolation proof.** CI and the default service DB role bypass RLS (gotcha
   `database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`). The triggers run as the invoking role, the
   same exposure as today's application `UPDATE`. Do not add `SECURITY DEFINER` without an ADR-106 note explaining
   why.
10. **Recount authorization is exactly one write.** Deploying the migration is the authorized demo write. Do not
    read or measure demo drift before or after without separate authorization. `scripts/audit-demo-data.sql`
    query 1 is the measurement to hand the maintainer if they want one. Any later repair uses
    `communities.recount_current_members()`, never a direct `UPDATE`, which the guard ignores.
11. **Real-DB evidence comes from a disposable container (decisions 9, 11).** Use a disposable PostgreSQL container
    on the demo host over an SSH tunnel, with no demo database access, as Sprint 143 did. Load the branch's schema
    (`init.sql`, then the migration chain).
    - **Red first for changed behavior only (Codex round 2, R5).** Each real-DB case that tests new behavior must
      fail before its implementation and pass after. Baseline cases that already hold, such as the `xmin`
      no-write checks or the invitation `+1` after the guard exists, are recorded as expected-green both times.
      The static gate's red result is what proves the removal of already-neutralized arithmetic.
    - **Scope.** The container runs the in-process database suites only. The services/Redis suites run in PR CI,
      which the next chat reads (decision 11).
    - Remove the container, scratch and tunnel afterwards, and record the role flags.
    - If the permission classifier blocks the SSH command, try once and hand the setup command to the maintainer;
      do not reroute.
    - The PR opens only at the end of execution, as the chat's last action; there is no draft-PR exception.
12. **Do not reopen settled decisions.** Decisions 1–11 are the maintainer's: scope, the Next.js bundling, the
    recount, moderator powers, trigger ownership, ADR-106, the column guard, lift-the-block reactivation, the
    disposable container, the direct-add exception and the verification scope. Planning defaults D1–D8 may be
    challenged in review.
13. **Flag discipline.** The sync and recount functions set `karmyq.member_count_sync` to `'on'` only around their
    own `UPDATE`, and restore the prior value before returning. Leaving it on would let a later application delta
    in the same transaction through the guard. A real-DB test proves that an application `UPDATE … current_members
    + 1` issued after a member INSERT in the same transaction is ignored.
14. **Prove "the trigger did not write" with the row version, not the count (Codex F7).** A role-only update and
    a same-status update must leave the community row's `xmin` unchanged. Count equality proves nothing: an
    accidental active→active firing would do −1 then +1 and still take the community row lock.

## Authorizations

- **Allocated (2026-11-19):**
  - dependency work for #185/#186 (`next` 16.4.6, first commit);
  - ADR-106;
  - the single recount write at deploy, through the migration;
  - a disposable PostgreSQL container on the demo host over SSH, with no demo database access, for the in-process
    DB suites (decisions 9, 11).
- **Not allocated:**
  - the release version (v11.117.0 is provisional) and the merge slot;
  - merge, and deploy, each needing its own explicit yes;
  - any demo DB read or other demo write;
  - a draft-PR exception to the stop-after-PR-creation rule;
  - an isolated full test stack (services + Redis) on the demo host;
  - the demo platform-admin grant and its 200 smoke check (ADR-105, still fail-closed);
  - CodeQL alert dismissals, which the maintainer performs in the UI.

## Planning-chat evidence (2026-11-19, read live)

- #340 merged 2026-11-19T17:54:43Z as `a2746057`; its tree equals the reviewed head `86808f53`. CI/CD
  `44582208442` passed with 14 jobs, including Deploy to Demo; 0 open code-scanning alerts on master; both
  `a2746057` analyses have no error. The full post-merge record is in
  `archive/2026-11-19-sprint-143-governance-lifecycle-COMPLETE-v11.116.0.md`.
- Open Dependabot: #185 GHSA-mfr8-8qww-v76h and #186 GHSA-vc7v-qv4w-wrv8 (MEDIUM, `next >=16.2/16.3 <=16.4.4`,
  patched 16.4.5). The lock holds `next` 16.4.2 (10 root nodes, 4 with `libc`).
- #339's backend job fails `tests/regression/sprint-122-lint-config-gate.test.ts` on
  `Cannot find module 'next/dist/compiled/babel/eslint-parser'` (job 135767472679).
- Counter writers: 5 delta writers, 2 converging recomputes, and the seed/fixture sites listed in note 2.
  Approval (`ActiveTab.tsx:53-61` → PUT) never counts. There are no CHECK constraints on `members.role`/`status`
  or on the counter.
- `user_joined_community`/`user_left_community` are in `UNCONSUMED_EVENTS` (`packages/shared/events/routes.ts:50`).
- Status lines updated in the planning commit:
  - ADR-055 amendment line;
  - BUG-102 → fixed and deployed;
  - BUG-103/104/105 → planned;
  - **BUG-106 logged**;
  - community-service CONTEXT Sprint 143 entry header.

## Carried follow-ups (from Sprint 143, still open)

- Rotation, revocation, delegation, opposition votes and close/expiry notifications are unplanned.
- Mobile's separate `POST /communities/:id/leave` remains revival debt.
- Other legacy member-handler error envelopes outside the routes this sprint rewrites are pre-existing debt.
- The demo platform-admin grant and smoke check are pending a separate authorization.
- Dependency lane: Claude (maintainer-designated). `deepmerge` #178 re-check is due by 2026-12-01 or at the next
  Expo SDK move.

⚠️ GitHub status goes stale. Re-derive PR, CI and deploy state before acting on this handoff.
