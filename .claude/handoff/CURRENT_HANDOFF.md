# Sprint 144 — Staff membership write integrity — Handoff

**Date**: 2026-11-19
**Outcome**: **PLANNED, ready to execute.** The maintainer approved the spec's decisions 1–6 in the planning chat.
Spec, plan, the Sprint 143 post-merge record and the bug-log updates are committed on this branch. No product code
has been written yet.

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

1. Read this handoff.
2. Reuse the existing task branch: `git switch agent/claude/sprint-144-planning`, then `git fetch origin`. If
   `origin/master` moved past `a2746057`, merge it with a merge commit (never rebase). Do not create a
   `feature/...` branch. Never branch off a stale local master; unpushed local-master commits leak in via the
   squash-merge.
3. Open the plan: `docs/superpowers/plans/2026-11-19-sprint-144-staff-write-integrity.md`.
4. Invoke `superpowers:executing-plans` (shared working tree, one editor) or
   `superpowers:subagent-driven-development`. There is no `/execute-plan` slash command; superpowers removed it.
5. Task 1 starts by asking the maintainer one question (disposable PostgreSQL container for integration
   iteration) and then makes the Next.js splice the **first commit**. **SLA: merged by 2026-12-01.**

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

Planning defaults D1–D8 are in the spec's *Planning defaults* section, and review may challenge them:
- one change per request;
- admission resets the role;
- `left` belongs to the member;
- retries are 409;
- the ADR-074 envelope;
- no event changes;
- the fission/fusion recompute stays;
- BUG-106 stays open.

## ⚠️ Critical Implementation Notes (verbatim from the spec)

1. **First commit = the Next.js splice, nothing else.** Root lock nodes `node_modules/next`, `node_modules/@next/env`
   and the 8 `node_modules/@next/swc-*` go 16.4.2 → **16.4.6**: `version`, `resolved` and `integrity` only, from
   registry metadata. 16.4.6 is `latest` on 2026-11-19, and its dependency map equals 16.4.2's except `@next/env`.
   Keep every `libc` field (4 swc nodes carry one). Declared ranges go `^16.4.2` → `^16.4.6` in
   `apps/frontend/package.json:24`, `apps/landing/package.json:18` and those workspaces' `packages[...]` entries in
   the lock. `postcss` stays governed by the root override `"postcss": "^8.5.25"`, so no nested postcss node is
   added. Prove the splice with strict `npx npm@11.19.0 ci`, an `npm ls --all` problem list identical to master's
   (BUG-047's `picomatch` line is pre-existing), the ADR-059 audit gate at 0 high/critical with #185/#186's GHSAs
   gone, and `tests/regression/sprint-122-lint-config-gate.test.ts` green. Never execute a downloaded tarball.
   Never use `npm install --workspace`, `npm dedupe` or a lock regen. Use a script file with match-count guards
   for the splice.
2. **The trigger changes every fixture's arithmetic.** Any test or seed that inserts a community with a non-zero
   `current_members` and then inserts active member rows now gets the sum. Inventory every such site before
   implementing. Known sites:
   - `tests/integration/sprint-143-governance-lifecycle.integration.test.ts:48`, which also sets counts at
     `:652`, `:666` and `:689`;
   - `tests/integration/social-graph.test.ts:152-188`;
   - `tests/integration/sprint-142-governance-quorum.integration.test.ts`;
   - `tests/integration/sprint-134-pr-l2-health.integration.test.ts`;
   - `infrastructure/postgres/seed-e2e.sql:85`, `:114`.

   Fix each fixture to state the truth: seed `0` and let the trigger count, or assert deltas. Never weaken an
   assertion to make it pass.
3. **Mocked-SQL regressions assert the old mechanism.** `sprint-77-idempotent-create`, `sprint-93-members-delete-jwt`,
   `sprint-132-body-identity` and `sprint-133-member-email-admin-only` (community-service `tests/regression/`) mock
   `UPDATE … current_members` or assume a creation count of `1`. Changing a regression test needs a written reason
   in its header ("counter moved to the DB trigger, ADR-106; real-DB proof in
   `tests/integration/sprint-144-staff-write-integrity.integration.test.ts`"). `sprint-78-fission-execute` and
   `sprint-86-fusion-member-count` assert the converging recompute, which stays (D7). They must stay unchanged and
   green.
4. **Capacity is checked after the write, never only before.** `assertWithinCapacity` runs inside the same
   `withTransaction`, after the member write, and throws to roll back. A returned sentinel would commit
   (`db.ts:51-53`). The real-DB race test must show two concurrent admissions into a community with one free slot
   produce exactly one 200 and one 400 `COMMUNITY_FULL`, and a final count of `max_members`.
5. **Lock order is member row(s) → community row**, everywhere. Do not add a `SELECT … FOR UPDATE` on the community
   row before member locks: that inverts join/DELETE's order and can deadlock with the trigger. Governance keeps
   nomination → memberships (Sprint 143). Its role-only update does not fire the trigger.
6. **The PUT locks and reads in one transaction.** It locks the target plus active admins in the existing
   user-ID-ordered statement (`members.ts:371-376`), reads the caller's live role and the target's stored
   status/role, plans the change with `planStaffChange`, then writes. The caller's role is read inside the
   transaction (ADR-102). Today's pre-transaction read (`members.ts:310-314`) allows a demoted moderator to race
   a write.
7. **Canonicalize at parse, compare canonical.** Reuse `canonicalUuid` for every request-supplied id compared in
   JS. A malformed id is 400 before SQL. Do not fix BUG-104 by casting inside SQL alone: the JS comparison is the
   bypass.
8. **The migration must hold on both appliers.** No top-level `BEGIN`/`COMMIT`/`LOCK`. It must be rerunnable with a
   zero-drift normalized dump. Run the `migration-validator` agent before committing it. Regenerate `init.sql`
   through `gh workflow run regenerate-init-sql.yml --ref agent/claude/sprint-144-planning` (no local Docker) and
   commit the artifact only while the branch's pre-migration `init.sql` equals master's.
9. **RLS is not the isolation proof.** CI and the default service DB role bypass RLS (gotcha
   `database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`). The trigger's `UPDATE` runs as the invoking
   role, the same exposure as today's application `UPDATE`. Do not add `SECURITY DEFINER` without an ADR-106 note
   explaining why.
10. **Recount authorization is exactly one write.** Deploying the migration is the authorized demo write. Do not
    read or measure demo drift before or after without separate authorization. `scripts/audit-demo-data.sql`
    query 1 is the measurement to hand the maintainer if they want one.
11. **Real-DB proof runs in CI.** CI runs `tests/integration` only on PRs and master pushes
    (`.github/workflows/ci.yml:3-7`). A disposable PostgreSQL container on the demo host is **not** allocated.
    Ask the maintainer at Task 1 if local iteration is wanted; otherwise open the PR as a draft once the migration
    and trigger tests exist, and treat CI as the real-DB arbiter.
12. **Do not reopen settled decisions.** Moderator powers, trigger ownership, the recount, ADR-106 and the bundling
    of the Next.js fix are maintainer decisions (1–6). Planning defaults D1–D8 may be challenged in review.

## Authorizations

- **Allocated (2026-11-19):**
  - dependency work for #185/#186 (`next` 16.4.6, first commit);
  - ADR-106;
  - the single recount write at deploy, through the migration.
- **Not allocated:**
  - the release version (v11.117.0 is provisional) and the merge slot;
  - merge, and deploy, each needing its own explicit yes;
  - any demo DB read or other demo write;
  - a disposable PostgreSQL container on the demo host (ask in Task 1);
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
