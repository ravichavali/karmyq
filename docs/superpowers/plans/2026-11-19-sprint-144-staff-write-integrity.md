# Staff Membership Write Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. In this shared working tree, prefer
> `superpowers:executing-plans` with one editor, followed by a non-author final review. Steps use checkbox
> syntax. Execute in the next chat, not the planning chat.

**Goal:** Make every staff membership write authorized per transition and make `communities.current_members`
impossible to drift, while shipping the Next.js 16.4.6 security patch inside its SLA.

**Architecture:** A PostgreSQL trigger on `communities.members` becomes the only writer of `current_members`
(ADR-106). A converging recount repairs stored drift, and every hand-written `±1` write in community-service and
social-graph-service is removed. Community-service's staff PUT executes a pure transition table, canonicalizes
request UUIDs at parse, and enforces capacity atomically with a post-write re-check in the same transaction. The
web app moves Reject onto the PUT and gives pending applicants **Cancel request**.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. One dependency change (`next`,
security-only, Task 1).

**Spec:** [`docs/superpowers/specs/2026-11-19-sprint-144-staff-write-integrity-design.md`](../specs/2026-11-19-sprint-144-staff-write-integrity-design.md)
(maintainer approved 2026-11-19, decisions 1–6; planning defaults D1–D8).

---

## Global constraints

- Reuse `agent/claude/sprint-144-planning` (cut from `origin/master` `a2746057`). No worktrees, rebase, force push
  or direct master push. If master moved, merge `origin/master` with a merge commit. Its first push needs
  `git push -u origin agent/claude/sprint-144-planning`. The local branch has no upstream; the planning chat
  removed the accidental `origin/master` tracking.
- The planning commit carries the Sprint 143 post-merge record. It rides with this product PR and must never go to
  master alone; say so in the PR body.
- **Allocated (2026-11-19):**
  - dependency work for Dependabot #185/#186 (`next` → 16.4.6) as the PR's first commit;
  - ADR-106;
  - the one demo write that the recount migration performs at deploy.
- **Not allocated:**
  - the release version (provisional v11.117.0) and the merge/deploy slot;
  - any demo data read or other demo write;
  - a disposable PostgreSQL container on the demo host (ask in Task 1);
  - the demo platform-admin grant;
  - merge and deploy, which each need separate explicit authorization.
- New workspace tests start in that workspace's `tests/tdd/`, run red before implementation, and are promoted
  **individually** with `git mv` (never a promoter sweep; `tests/claude.md`). Real-DB proof lives in root
  `tests/integration/`, which CI runs. A rule meant to block goes straight into root `tests/regression/`.
- Run new or changed Jest files with `--no-cache` at least once
  (`feedback_local_green_cannot_prove_ci_green`). Run root gates with
  `npm exec --workspace=tests -- jest --runTestsByPath <file>`; a root `npx jest tests/regression/...` finds zero
  tests.
- Intermediate commits use focused tests and the normal git hooks. `/pre-commit-check` runs once, in Task 13.
  process-reviewer runs once, in Task 12.
- Read before editing in their scopes:
  - `CLAUDE.md`;
  - community-service `.claude/README.md` and `CONTEXT.md`;
  - social-graph-service `.claude/README.md` and `CONTEXT.md`;
  - `apps/frontend/claude.md`, `apps/claude.md`, `infrastructure/claude.md` and `tests/claude.md`.

  Also run `node scripts/gotcha-check.js --for <paths>`. On 2026-11-19 three gotchas matched: RLS bypass,
  dotenv quiet, and migration transaction wrapping.
- Edit scripts go in a FILE written with the Write tool, using split/join plus a match-count guard. Never use a
  heredoc for them (`feedback_heredoc_eats_backslashes`).

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20261119-community-member-count-trigger.sql` | `communities.sync_current_members()`, the two triggers, the converging recount, and the column comment (ADR-106) |
| `services/community-service/src/utils/uuid.ts` | The single `UUID_RE` and `canonicalUuid(value): string \| null` |
| `services/community-service/src/utils/staffTransitions.ts` | Pure `planStaffChange(callerRole, target, body)`: the spec's transition table |
| `services/community-service/src/database/memberCapacity.ts` | `assertWithinCapacity(q, communityId)` and `CommunityFullError` |
| `services/community-service/tests/tdd/sprint-144-uuid.test.ts` | `canonicalUuid` cases |
| `services/community-service/tests/tdd/sprint-144-staff-transitions.test.ts` | Every row of the transition table |
| `services/community-service/tests/tdd/sprint-144-staff-put-route.test.ts` | Mocked-route contract: validation, 403/404/409 codes, no raw error detail, plan executed in one transaction |
| `services/community-service/tests/tdd/sprint-144-capacity.test.ts` | Post-check throws/rolls back; admit routes map to 400 `COMMUNITY_FULL` |
| `tests/integration/sprint-144-staff-write-integrity.integration.test.ts` | Real-DB proof: trigger deltas, recount idempotence and replay, capacity race, PUT transitions, BUG-104 uppercase, invitation no double count |
| `tests/regression/sprint-144-no-member-count-deltas.test.ts` | Root static gate: no `current_members` delta writes in `services/*/src`, `apps/*/src`, `packages/*/src`; a negative fixture proves it can fail |
| `apps/frontend/tests/tdd/sprint-144-staff-member-actions.test.tsx` | Reject → PUT payload; Cancel request shown/hidden/wired/error path |
| `docs/adr/ADR-106-database-owned-member-count.md` | The decision record |

### Existing files to modify

| File | Change |
|------|--------|
| `package-lock.json`, `apps/frontend/package.json`, `apps/landing/package.json` | Task 1: 10-node `next` splice; ranges `^16.4.6` |
| `infrastructure/postgres/init.sql` | Regenerated by workflow artifact only |
| `services/community-service/src/routes/members.ts` | PUT rewrite; DELETE/POST canonical UUIDs; delete `±1` writes; capacity post-checks; ADR-074 errors on POST/PUT |
| `services/community-service/src/routes/communities.ts` | Create inserts `current_members = 0` and returns the post-trigger count; duplicate-create join drops `+1` and gains the post-check |
| `services/community-service/src/routes/governance.ts`, `src/database/governanceDb.ts`, `src/utils/liveRole.ts` | Import the shared UUID helper; canonicalize the nominee id |
| `services/social-graph-service/src/routes/invitations.ts` | Delete the manual `+1` (`:162-167`) |
| `infrastructure/postgres/seed-e2e.sql` | Seed `current_members` `0` (`:85`, `:114` blocks) |
| `services/community-service/tests/regression/sprint-77-idempotent-create.test.ts`, `sprint-93-members-delete-jwt.test.ts`, `sprint-132-body-identity.test.ts`, `sprint-133-member-email-admin-only.test.ts` | Only where they assert the removed mechanism; header note gives the reason |
| `tests/integration/sprint-143-governance-lifecycle.integration.test.ts`, `social-graph.test.ts`, `sprint-142-governance-quorum.integration.test.ts`, `sprint-134-pr-l2-health.integration.test.ts` | Fixture arithmetic under the trigger (inventory first) |
| `apps/frontend/src/components/community/tabs/ActiveTab.tsx` | Reject via PUT `{status:'inactive'}`; drop `admin_user_id` |
| `apps/frontend/src/components/community/CommunityHero.tsx` | Optional `onCancelRequest`; button in the pending badge |
| `apps/frontend/src/pages/communities/[id].tsx` | `handleCancelRequest` |
| `apps/frontend/src/lib/api.ts` | `updateMember` data type `{ role?: string; status?: string }` |
| `docs/guides/admin-community-guide.md`, `docs/guides/finding-communities-guide.md` | Spec *User Guide & Doc Updates* |
| `docs/adr/README.md`, `scripts/generate-docs.ts` | ADR-106 index and `ADR_GROUPS` entry |
| `services/community-service/CONTEXT.md`, `services/social-graph-service/CONTEXT.md`, `services/registry.json` | Contract docs |
| `docs/BUGS.md` | BUG-103/104/105 → fixed; BUG-106 stays open |
| `apps/landing/src/data/docs/**` | Regenerated only |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Copied verbatim from the spec.

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

**Plan-level clarification of note 11.** A draft PR opened mid-execution is CI plumbing, not "PR creation" in the
sense of `feedback_stop_after_pr_creation`. The chat continues through Task 13. Mark the PR ready for review only
at the end of Task 13.

---

## Task 1: Branch state, real-DB access question, and the Next.js splice (first commit)

**Files:**
- Modify: `package-lock.json`, `apps/frontend/package.json`, `apps/landing/package.json`
- Create (scratchpad only): the splice script and evidence files

- [ ] **Re-derive live state**

```bash
git status -sb && git fetch origin && git log --oneline origin/master -3
gh pr list --state open && gh api 'repos/ravichavali/karmyq/dependabot/alerts?state=open' --jq '.[] | "\(.number) \(.security_advisory.severity) \(.dependency.package.name)"'
```

Expected: branch `agent/claude/sprint-144-planning` at the planning commit on top of `a2746057`. Open alerts are
#185/#186 (`next`), unless a new advisory landed; if one did, stop and report. If `origin/master` moved, merge it
with a merge commit.

- [ ] **Ask the maintainer once:** "May I use a disposable PostgreSQL container on the demo host over SSH for
  Sprint 144's integration iteration (no demo data access)? If not, PR CI is the real-DB arbiter (note 11)."
  Record the answer in the handoff.

- [ ] **Re-check registry metadata (read-only).** `npm view next@16.4.6 dependencies dist.integrity dist.tarball`,
  and the same for `@next/env@16.4.6` and each of the 8 `@next/swc-*@16.4.6`. Confirm 16.4.6 is still `latest`
  on the 16.4 line and that no advisory covers it (`npm audit` after the splice is the arbiter). If `latest`
  moved within 16.4.x, take the newest 16.4.x and record why.

- [ ] **Splice.** Write `scratchpad/next-splice.js` with the Write tool. For each of the 10 root nodes it replaces
  `version`/`resolved`/`integrity`. Each replacement is guarded by an exact-one-match check against the current
  16.4.2 values, and the script leaves every other field (`libc`, `cpu`, `os`, `optional`, `engines`) untouched.
  It also updates `packages["apps/frontend"].dependencies.next` and `packages["apps/landing"].dependencies.next`
  to `^16.4.6`. Edit the two `package.json` lines to `"next": "^16.4.6"`.

- [ ] **Prove it**

```bash
git diff --stat   # exactly 3 files
node -e "const l=require('./package-lock.json');for(const[k,v]of Object.entries(l.packages)){if(/node_modules\/(next|@next\/(env|swc-[^/]+))$/.test(k))console.log(k,v.version,v.libc||'')}"   # 10 nodes @16.4.6, 4 libc
git diff package-lock.json | grep -c '^-.*"libc"'   # 0
npx npm@11.19.0 ci                                   # strict install, exit 0
npx npm@11.19.0 ls --all > scratchpad/ls-after.txt 2>&1; echo "exit=$?"   # compare the problem list with master's (scratchpad/ls-before.txt taken first)
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-122-lint-config-gate.test.ts --no-cache
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-131-workspace-declarations.test.ts --no-cache
```

Also run the ADR-059 audit gate the way CI does: `node scripts/audit-exemptions.js` (`.github/workflows/ci.yml:98-99`).
Expect 0 high/critical, with GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8 absent from `npm audit --json`.

- [ ] **Commit** `fix(deps): next 16.4.6 for GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8 (Dependabot #185, #186)`.
  Record the evidence (commands, exit codes, `npm ls` comparison) in the ledger,
  `.superpowers/sdd/2026-11-19-sprint-144-staff-write-integrity/progress.md`.

---

## Task 2: Inventories (no product code)

**Files:**
- Modify: the ledger only

- [ ] **Counter-writer inventory.** Use the live arbiter, without truncation
  (`feedback_inventory_scans_must_not_be_truncated`):

```bash
grep -rnE "current_members" --include=*.ts --include=*.tsx --include=*.js --include=*.sql services apps packages scripts infrastructure/postgres/seed* infrastructure/postgres/seed-e2e.sql tests \
  | grep -v node_modules | grep -v /dist/ > scratchpad/counter-sites.txt; wc -l scratchpad/counter-sites.txt
```

Classify every line as **read**, **delta write** (must go), **converging recompute** (stays, D7), **fixture seed**
(note 2), or **mocked SQL in a test** (note 3). The spec's writer table is the expected result. Any extra delta
writer joins this sprint's scope.

- [ ] **Fixture arithmetic inventory.** For every `tests/integration/*.ts` that inserts `communities.communities`
  and then active `communities.members` rows, record whether it asserts an absolute count. List the ones that need
  a change.

- [ ] **UUID comparison inventory.** Enumerate JS equality between a request-supplied id and a DB/JWT id across
  `services/community-service/src` (`===`, `!==`, `.find(`, `.some(`, `.includes(`). Classify each fail-open or
  fail-closed. The spec's table is the expected result. A new fail-open site joins scope.

- [ ] **Commit** `docs: Sprint 144 inventories` (ledger only).

---

## Task 3: Canonical UUID helper (TDD)

**Files:**
- Create: `services/community-service/src/utils/uuid.ts`, `services/community-service/tests/tdd/sprint-144-uuid.test.ts`
- Modify: `src/utils/liveRole.ts`, `src/routes/governance.ts`, `src/database/governanceDb.ts` (nominee id), `src/routes/members.ts` (DELETE + POST parse only)

- [ ] **Write the test first** (red). Cases:
  - a lowercase UUID returns itself;
  - an uppercase or mixed-case UUID returns lowercase;
  - leading or trailing whitespace returns `null` (no trimming: a path id with spaces is malformed);
  - `''`, `undefined`, non-string, 35/37-char and non-hex input return `null`;
  - `UUID_RE` is the one exported regex.

```ts
// src/utils/uuid.ts (shape)
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function canonicalUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value.toLowerCase() : null;
}
```

```bash
npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-144-uuid.test.ts --no-cache   # red, then green
```

- [ ] **Adopt it.** `liveRole.ts:14` and `governance.ts:7-8` import `UUID_RE`/`canonicalUuid` and drop their local
  regexes. Governance canonicalizes the nominee id before it reaches `governanceDb.ts:241`. Members DELETE
  canonicalizes `:communityId`, `:userId` and the JWT caller, returning 400 `VALIDATION_ERROR` on malformed input.
  Staff POST canonicalizes body `user_id`. The PUT gets the same treatment in Task 7.
- [ ] Add DELETE cases to `sprint-144-staff-put-route.test.ts` (create it now if needed): an uppercase self-id is
  self-leave, an uppercase target is found, and a malformed id is 400 with no SQL issued.
- [ ] Run the community-service unit + regression tiers (`npm run test --workspace=services/community-service`)
  and `npm run type-check --workspace=services/community-service`. **Commit**
  `fix(community): canonicalize request UUIDs at parse (BUG-104 groundwork)`.

---

## Task 4: Pure staff transition table (TDD)

**Files:**
- Create: `services/community-service/src/utils/staffTransitions.ts`, `services/community-service/tests/tdd/sprint-144-staff-transitions.test.ts`

- [ ] **Write the test first** (red). One case per row of the spec's table, for both an admin and a moderator
  caller where the row allows either. Also cover:
  - body validation (D1): both keys, neither key, an unknown key, `admin_user_id` ignored, non-string values;
  - role values outside `{member, moderator, admin}`;
  - `left` → anything gives `MEMBER_MUST_REJOIN` (D3);
  - every same-state request gives `INVALID_MEMBERSHIP_TRANSITION` (D4);
  - a moderator deactivating or reactivating anyone gives a forbidden refusal (BUG-105);
  - a moderator approving a pending row with a stored `admin` role still writes `role='member'` (D2);
  - a role change on a non-active target is refused;
  - the last-admin flag is required for an admin demotion or deactivation.

  Assert exact operation objects, not truthiness (`feedback_testing_standard`).

```ts
// shape — names may change in review, semantics may not
type CallerRole = 'admin' | 'moderator' | 'member' | null;
type Target = { status: string; role: string; isSoleActiveAdmin: boolean };
type Plan =
  | { kind: 'write'; set: { status?: 'active' | 'inactive'; role?: 'member' | 'moderator' | 'admin' }; admits: boolean }
  | { kind: 'refuse'; http: 400 | 403 | 409; code: 'VALIDATION_ERROR' | 'FORBIDDEN' | 'LAST_ADMIN'
      | 'INVALID_MEMBERSHIP_TRANSITION' | 'MEMBER_MUST_REJOIN'; message: string };
export function planStaffChange(caller: CallerRole, target: Target, body: unknown): Plan;
```

- [ ] Implement until green with `--no-cache`. **Commit** `feat(community): staff membership transition table`.

---

## Task 5: Migration — trigger, recount, init.sql (real-DB test first)

**Files:**
- Create: `infrastructure/postgres/migrations/20261119-community-member-count-trigger.sql`,
  `tests/integration/sprint-144-staff-write-integrity.integration.test.ts`
- Modify: `infrastructure/postgres/init.sql` (artifact copy only)

- [ ] **Write the integration test's trigger section first.** Model its DB setup on
  `tests/integration/sprint-143-governance-lifecycle.integration.test.ts`. Record the
  `rolsuper`/`rolbypassrls` flags and use explicit community predicates (note 9). Cases:
  - INSERT active → +1; INSERT pending → 0;
  - UPDATE pending→active +1, active→inactive −1, active→left −1, inactive→active +1;
  - a role-only UPDATE fires nothing (assert the community row's `xmin` unchanged, or the count);
  - an UPDATE that rewrites the same status fires nothing;
  - moving `community_id` gives −1 on the old community and +1 on the new;
  - DELETE active → −1; a NULL status counts as inactive;
  - community deletion with members does not error.
- [ ] **Recount section:**
  - seed deliberately drifted counts (high, low, zero-member communities);
  - apply the migration file text; the counts equal active rows;
  - apply it a second time; zero rows change and the counts are identical;
  - assert the column comment exists.
- [ ] **Write the migration** from the spec's *Data Model* SQL. Run the `migration-validator` agent on it and
  resolve its findings. Confirm it has no top-level `BEGIN`/`COMMIT`/`LOCK` (gotcha).
- [ ] **Real-DB run.** With the Task 1 container, if granted, run
  `npm run test:integration --workspace=tests -- --runTestsByPath integration/sprint-144-staff-write-integrity.integration.test.ts`.
  Also run `scripts/apply-migrations.sh` (exactly one migration applied) and
  `scripts/ci-apply-full-schema.sh --drift-check` (zero drift) against isolated databases, the Sprint 142
  evidence pattern in the gotcha. Without a container, defer to Task 6's draft PR CI.
- [ ] **Regenerate init.sql** per `reference_init_sql_regen_via_workflow`. First check that
  `git hash-object infrastructure/postgres/init.sql` equals `git rev-parse origin/master:infrastructure/postgres/init.sql`.
  Then commit and push the migration, run `gh workflow run regenerate-init-sql.yml --ref agent/claude/sprint-144-planning`,
  watch it, download into a fresh empty directory, and diff. Expect only the function, the 2 triggers, the
  comment and the ledger row. Byte-copy the artifact and prove `git hash-object` equality.
- [ ] **Commits:** `feat: database-owned community member count (ADR-106)` (migration + test), then
  `chore: regenerate schema for member count trigger`.

---

## Task 6: Remove hand-written counter writes; atomic capacity; fixtures; the delta gate

**Files:**
- Create: `services/community-service/src/database/memberCapacity.ts`,
  `services/community-service/tests/tdd/sprint-144-capacity.test.ts`,
  `tests/regression/sprint-144-no-member-count-deltas.test.ts`
- Modify: `members.ts` (join, staff POST, DELETE), `communities.ts` (create, duplicate-create join),
  `services/social-graph-service/src/routes/invitations.ts`, `infrastructure/postgres/seed-e2e.sql`, the Task 2
  fixture list, and the note-3 regressions

- [ ] **Gate first** (red on today's tree). The root regression gate walks `services/*/src`, `apps/*/src` and
  `packages/*/src` (`.ts`, `.tsx`, `.js`). It fails on any SQL text matching
  `current_members\s*=\s*current_members\s*[-+]` or `current_members\s*[-+]=`. It allows reads and converging
  `= (SELECT count(*)` recomputes. A negative fixture (an in-memory string run through the same matcher) proves it
  fails, and a positive fixture proves the recompute is allowed. Run it: red, listing exactly the spec's 5 delta
  writers (`members.ts` join/staff-add/DELETE, `communities.ts` duplicate-create join, `invitations.ts`). Assert
  that identity list, not a count (`feedback_gates_assert_weaker_than_claimed`). `communities.ts:460`'s in-memory
  response adjustment is JavaScript, not SQL, and must not match.
- [ ] **Capacity test first** (red). `assertWithinCapacity` throws `CommunityFullError` when `current > max`, and
  passes at `current == max`. Mocked-route tests: join (public), staff POST, the duplicate-create join and (in
  Task 7) the PUT approve/reactivate each map the throw to 400 `COMMUNITY_FULL`, issue the post-check **after**
  the member write, and run both inside the same `withTransaction` client.
- [ ] **Implement.**
  - Delete every delta write.
  - Wrap staff POST in `withTransaction`, with the post-check and ADR-074 errors (D5).
  - Join: post-check for active admission only.
  - Create: `VALUES (..., 0, ...)`, insert the creator, then re-read `current_members` for the response.
  - Duplicate-create join: one transaction, post-check, response count re-read or `+1` in memory only when inserted.
  - social-graph: delete the `+1` statement only (D8; BUG-106 stays).
  - Seed: `seed-e2e.sql` counts → `0`.
- [ ] **Fixtures and regressions:** apply the Task 2 list (note 2) and note 3, each with its header reason. Confirm
  `sprint-78-fission-execute` and `sprint-86-fusion-member-count` are untouched and green.
- [ ] **Real-DB race cases** in the integration file:
  - a community at `max_members - 1` gets two concurrent public joins → exactly one 200 and one 400
    `COMMUNITY_FULL`, final count = `max_members`;
  - a full community: staff POST is refused and leaves no member row;
  - the invitation accept (`social-graph.test.ts` flow) increments exactly +1;
  - community create → count 1;
  - duplicate-create join → +1 once.

  Drive the routes through supertest against the real app or an in-process app, as Sprint 143's file does. Do
  not mock `withTransaction`.
- [ ] **Run:** community-service and social-graph-service unit + regression; the root gate with `--no-cache`;
  `npm test --workspace=tests`; type-check both services.
- [ ] **Commit** `fix: derive member count in the database and enforce capacity atomically (BUG-103)`.
- [ ] **Without a container (note 11):** push, then
  `gh pr create --draft --base master --title "feat: Sprint 144 staff membership write integrity (ADR-106)"` with
  a placeholder body that follows `.github/pull_request_template.md` (read it first). Then read the Integration
  Tests job's own conclusion and suite count. `gh pr checks` alone is not evidence
  (`feedback_checks_list_hides_uncreated_jobs`). Fix forward until the Sprint 144 integration file and every
  pre-existing suite pass.

---

## Task 7: Staff PUT rewrite (BUG-104, BUG-105, validation)

**Files:**
- Modify: `services/community-service/src/routes/members.ts` (PUT handler)
- Test: `services/community-service/tests/tdd/sprint-144-staff-put-route.test.ts`, the integration file

- [ ] **Route tests first** (red, mocked). Cases:
  - a malformed id is 400 before any SQL;
  - body validation is 400;
  - a non-staff caller is 403 `FORBIDDEN`;
  - a missing target is 404 `NOT_FOUND`;
  - a moderator deactivate is 403;
  - a moderator approve writes `status='active', role='member'`;
  - a reactivate by an admin writes `role='member'`;
  - a sole-admin demotion is 400 `LAST_ADMIN`;
  - a full community on approve is 400 `COMMUNITY_FULL`, with the post-check after the UPDATE;
  - an unexpected DB error is 500 `INTERNAL_ERROR` with no `error.message` and no SQL text in the body;
  - all SQL from lock to write runs on the one transaction client;
  - the caller-role read happens inside the transaction (note 6).
- [ ] **Implement.** Inside one `withTransaction`:
  1. canonical ids;
  2. lock target + active admins (`members.ts:371-376` statement);
  3. read the caller's live role on the same client;
  4. `planStaffChange`;
  5. refuse, or `UPDATE … SET <plan.set> WHERE community_id=$ AND user_id=$ RETURNING *`;
  6. if `plan.admits`, run `assertWithinCapacity`.

  Map refusals with the ADR-074 helpers.
- [ ] **Real-DB cases:**
  - an uppercase-UUID demotion of the sole admin is 400 and the role is unchanged (BUG-104);
  - a moderator reactivating an inactive stored admin is 403, and the row stays inactive (BUG-105);
  - an admin reactivation returns role `member`, and the count goes +1;
  - approve/reject by a moderator;
  - a concurrent approve of two pending rows with one free slot → one 200, one 400;
  - a moderator demoted mid-request cannot write (lock/live-role ordering).
- [ ] Run the community-service tiers, type-check and the integration file (container or PR CI). **Commit**
  `fix(community): staff membership PUT as an authorized transition table (BUG-104, BUG-105)`.

---

## Task 8: Web — Reject via PUT, Cancel request

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-144-staff-member-actions.test.tsx`
- Modify: `ActiveTab.tsx`, `CommunityHero.tsx`, `pages/communities/[id].tsx`, `lib/api.ts`

- [ ] **Tests first** (red), meeting `apps/frontend/claude.md`'s minimum coverage:
  - Reject calls `updateMember(communityId, userId, { status: 'inactive' })`, and `removeMember` is not called;
  - Approve's payload is exactly `{ status: 'active' }`;
  - the role change payload is exactly `{ role }`;
  - Cancel request renders only when `isPending` with a handler; it is hidden for members, visitors, and pending
    without a handler;
  - confirm → `leaveCommunity(communityId, currentUser.id)` → refetch;
  - declining the confirm makes no call;
  - an API error shows its `message`, with a fallback text.

  Reuse the global `next/router` mock. Mirror `apps/frontend/tests/regression/sprint-143-community-leave.test.tsx`
  for page setup.
- [ ] **Implement:** narrow `updateMember`'s type; drop `admin_user_id` from both callers; add the hero button
  (match the Leave button's styling; disabled while `joiningCommunity`); add `handleCancelRequest` in `[id].tsx`.
- [ ] `npm run test --workspace=apps/frontend`, the new file with `--no-cache`, and
  `npm exec --workspace=apps/frontend -- tsc --noEmit`. **Commit**
  `feat(frontend): moderators reject via staff PUT; applicants can cancel a join request`.

---

## Task 9: Grep-all and end-to-end trace (Bug Fixing steps 2–3)

**Files:** ledger only, unless a new site is found

- [ ] Re-run the Task 2 inventories on the new tree. Expect zero delta writers. Every request-supplied id is
  canonicalized before JS comparison.
- [ ] Mobile: check `apps/mobile` for `updateMember`/`removeMember`/reject/approve callers and `current_members`
  writes. Mobile's separate leave route remains known revival debt. Record anything found; fix it here only if it
  is a staff write that the new PUT contract breaks.
- [ ] Simulation: confirm `services/simulation-service` never writes `current_members`. Its reads
  (`join-community-workflow.ts:61`, `vote-on-governance-workflow.ts:30`) now see true counts.
- [ ] Record the trace (source → route → trigger → API response → hero) in the ledger, then **commit** the ledger.

---

## Task 10: User guides, landing docs, ADR-106

**Files:**
- Create: `docs/adr/ADR-106-database-owned-member-count.md`
- Modify: `docs/guides/admin-community-guide.md`, `docs/guides/finding-communities-guide.md`, `docs/adr/README.md`,
  `scripts/generate-docs.ts` (`ADR_GROUPS` → `— Community & Scale —`), `apps/landing/src/data/docs/**`
  (regenerated)

- [ ] **ADR-106**, Status **Accepted** (→ Implemented after deploy). It records:
  - context: three repairs, five writers in two services, approval never counted, the false "DB constraint" claim;
  - the decision: trigger semantics, recount, capacity post-check;
  - alternatives rejected: per-writer app fixes; capacity inside the trigger, which would change fusion;
    a CHECK constraint;
  - consequences: fixture arithmetic, `SECURITY DEFINER` deliberately not used (note 9), BUG-106 out of scope;
  - the rule "never write deltas".
- [ ] **Guides** per the spec's *User Guide & Doc Updates*. Read `docs/concepts/governance.md` and
  `apps/frontend/src/lib/onboarding/workflows.ts`, and record whether either changes.
- [ ] Regenerate landing docs (`npm run generate-docs --workspace=apps/landing`, or `npx tsx scripts/generate-docs.ts`).
  `git add -f` the new ADR page. Revert timestamp/HEAD-sha/adr-010 churn
  (`feedback_npm_test_regenerates_landing_docs`). Run
  `npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts --no-cache`.
- [ ] **Commit** `docs: Sprint 144 guides and ADR-106`.

---

## Task 11: CONTEXT.md, registry, BUGS, test promotion

**Files:**
- Modify: `services/community-service/CONTEXT.md`, `services/social-graph-service/CONTEXT.md`,
  `services/registry.json`, `docs/BUGS.md`, `infrastructure/claude.md` (migration count, if re-counted)
- Move: each green `tests/tdd/sprint-144-*` file → that workspace's `tests/regression/`

- [ ] community-service CONTEXT:
  - PUT section: the transition table, codes and moderator powers (replace the Sprint 25 line, `:840`);
  - DELETE/join/staff-add sections: the trigger and the post-check;
  - replace the false "database constraint" text (`:1554-1567`) and the stale last-admin sample (`:1569-1590`);
  - a Recent Changes entry citing ADR-106, the migration, and BUG-103/104/105.
- [ ] social-graph CONTEXT: invitation accept no longer writes the counter; BUG-106 pointer.
  `services/registry.json`: the PUT member description.
- [ ] BUGS: BUG-103/104/105 → `fixed (Sprint 144, pending deploy)`, each with a Resolution paragraph. BUG-106 stays
  `open`.
- [ ] Promote each green Sprint 144 tdd file individually (`git mv`), never with the promoter. Run each workspace's
  regression tier.
- [ ] `npm run feedback:check` (advisory; it reads `git diff --cached`, so stage first —
  `feedback_feedback_check_false_green_on_committed_branch`). **Commit**
  `docs: Sprint 144 contracts, registry, bug log; promote tests`.

---

## Task 12: SDLC quality gates (mandatory)

- [ ] **`/simplify`** on the branch diff (one pass). Apply or justify each finding.
  Verify: the ledger lists every finding and its disposition.
- [ ] **`/code-review` at high effort** on the branch diff. The diff is risky: authorization, a trigger
  migration, and concurrency. Focus areas:
  - the transition table vs the spec;
  - lock order;
  - the post-check placement;
  - migration rerunnability;
  - fixture honesty;
  - the splice's untouched fields.

  Verify: correctness findings are fixed, with red→green proof, or dismissed in writing.
- [ ] **`/security-review`** on the branch diff. Focus areas:
  - moderator/admin powers and the live-role read;
  - UUID canonicalization;
  - no raw error detail;
  - the trigger's privilege context (note 9);
  - the dependency splice.

  Verify: real findings are fixed and dismissals are justified in the ledger.
- [ ] **process-reviewer** agent on the full branch diff, run once: test meaningfulness, CONTEXT/docs accuracy,
  validation evidence. Verify: findings resolved.
- [ ] After review fixes, re-run the root gates `npm test --workspace=tests`
  (`feedback_rerun_root_gates_after_review_fixes`) and the affected workspace tiers. **Commit** the review fixes.

---

## Task 13: Final verification, PR, handoff

- [ ] Run `npm run type-check --workspace=services/community-service`, the social-graph-service type-check
  (`npx tsc --noEmit` in that workspace), and `npm exec --workspace=apps/frontend -- tsc --noEmit`.
- [ ] **`/pre-commit-check`** once (`bash scripts/pre-commit-check.sh`). Keep the normal pre-commit and pre-push
  hooks. A silent, instant push is a red flag.
- [ ] `npm run analyze:services` only if dependencies changed: the `next` bump is in apps, so check whether the
  analyzer covers apps and record the answer.
- [ ] Push. Update the PR body per `.github/pull_request_template.md`. It must include:
  - the bundled Sprint 143 post-merge record and the `next` security commit (why bundled: SLA 2026-12-01);
  - the BUG list and ADR-106;
  - the Validation ledger with SHA, command, exit status, cache state and limitations per row;
  - *Security dismissals* (none yet).

  Mark the PR ready (or create it if Task 6 did not).
- [ ] Read the head's real CI job conclusions: Integration Tests suite/test counts, Code Scanning Gate, and
  `regenerate-init-sql` byte comparison. List any CodeQL annotations for the maintainer to dismiss in the UI
  (`api.ts` request-forgery → `false positive`; test migration-reads → `used in tests`). Never dismiss them
  yourself.
- [ ] Rewrite `CURRENT_HANDOFF.md` (PR number, head SHA, evidence, remaining authorizations: version, merge slot,
  merge, deploy). Commit and push it **before** asking for merge authorization (`feedback_handoff_stranded_by_merge`).
  End the chat with the next-chat prompt (`feedback_stop_after_pr_creation`).

---

## Task 14: Merge + Deploy (separate chat or explicit authorization)

- [ ] On explicit maintainer authorization only:
  - the maintainer allocates the version, and the `chore(release): v11.117.0 for Sprint 144` bump is re-derived
    from `origin/master`;
  - merge per the `ship`/`deploy` skills (`--admin` needs its own explicit yes;
    `feedback_merge_blocked_by_permission_classifier`).
- [ ] Watch CI/CD on the merge SHA. Verify the run conclusion, the job count, and **Deploy to Demo = success**.
  The deploy log must show `20261119-community-member-count-trigger.sql` applied by `scripts/apply-migrations.sh`.
  That is the one authorized demo write.
- [ ] Smoke via the public API only (`reference_demo_smoke_test_paths`: `POST /api/auth/login` 200). Any demo DB
  read (for example `scripts/audit-demo-data.sql` query 1 to show zero drift) needs a separate authorization.
- [ ] After deploy: read the open master code-scanning alerts and the merge-SHA analyses
  (`feedback_codeql_dismissals_die_on_line_shift`). Confirm Dependabot #185/#186 show `fixed`. #339 should
  auto-close; if not, closing it is the maintainer's call.
- [ ] Post-merge record on the NEXT branch (no docs-only master push):
  - ADR-106 → Implemented;
  - BUG-103/104/105 → fixed and deployed;
  - archive this handoff.
