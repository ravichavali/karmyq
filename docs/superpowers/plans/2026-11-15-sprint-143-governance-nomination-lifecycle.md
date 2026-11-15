# Governance Nomination Lifecycle and Member Rejoin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. In this shared working tree, prefer
> `superpowers:executing-plans` with one editor, followed by a non-author final review. Steps use checkbox
> syntax. Execute in the next chat, not the planning chat.

**Goal:** Close pending nominations by nominator withdrawal, nominee decline or 30-day expiry, and let members
who left rejoin without a 500 and without regaining their old role.

**Architecture:** Community-service gains withdraw/decline endpoints and lazy expiry. Expiry is enforced in the
transaction and backstopped by the Sprint 142 DB guard. Every governance write keeps the nomination → membership
lock order. The member routes split self-leave (`left`, self-rejoinable) from staff removal (`inactive`,
staff-only), and the web app gains a Leave control and governance close actions.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. No dependency changes.

**Spec:** [`docs/superpowers/specs/2026-11-15-sprint-143-governance-nomination-lifecycle-design.md`](../specs/2026-11-15-sprint-143-governance-nomination-lifecycle-design.md)
(maintainer approved 2026-11-15, decisions 1–8).

---

## Global constraints

- Reuse `agent/claude/sprint-143-planning`. No worktrees, rebase, force push or direct master push. If master
  moved, merge `origin/master` with a merge commit.
- Commit `3e63ca9f` (Sprint 142 post-merge record) rides with this product PR. Say so in the PR body.
- **Allocated:** SSH to karmyq.com for a **disposable** Postgres container only (decision 7). **Not
  allocated:**
  - the release version and the merge/deploy slot;
  - new ADR numbers (use an ADR-055 amendment) and the dependency lane;
  - every demo data operation, including reads of demo membership or counter state;
  - the demo platform-admin grant and its 200 smoke check.
- New workspace tests start in that workspace's `tests/tdd/`, run red before implementation, and are promoted
  **individually** (never a promoter sweep; see `tests/claude.md`). Real-DB proof lives in root
  `tests/integration/`, which CI runs.
- Intermediate commits use focused tests and the normal git hooks. `/pre-commit-check` runs once, in Task 13.
  process-reviewer runs once, in Task 12.
- Read `CLAUDE.md`, community-service `.claude/README.md` + `CONTEXT.md`, `apps/frontend/claude.md`,
  `apps/claude.md`, `infrastructure/claude.md` and `tests/claude.md` before editing in their scopes. Also run
  `node scripts/gotcha-check.js --for <paths>` for every new file path before creating it.

## Review focus

1. Lock order: nothing may take a membership lock and then a nomination lock (Tasks 4 and 6).
2. A removed member must not be able to rejoin by converting `inactive` → `left` (Task 6).
3. An expired close must commit even though the request returns 409 (Task 4).
4. `can_ratify` must mirror the POST exactly; a stale or ineligible screen must never show a working Finalize
   (Tasks 5 and 7).
5. The migration must not stamp historical rows, must replay with zero drift, and must stay compatible with the
   v11.115.0 writer (Task 1).

## File map

New paths are proposed deliverables. Search before creating, and run gotcha discovery on the final paths.

| New file | Responsibility |
|---|---|
| `infrastructure/postgres/migrations/20261115-governance-nomination-lifecycle.sql` | `expires_at`, statuses, expiry guard, member status comment |
| `services/community-service/src/utils/memberLifecycle.ts` | Pure membership rules: existing-row classification, departure status, self-departure eligibility |
| `services/community-service/tests/tdd/sprint-143-governance-lifecycle-migration.test.ts` | Static migration shape and order |
| `services/community-service/tests/tdd/sprint-143-governance-lifecycle-policy.test.ts` | Pure viewer mirror table, close statuses, membership classification |
| `services/community-service/tests/tdd/sprint-143-governance-lifecycle-routes.test.ts` | Real router dispatch, validation, identity and envelopes for withdraw/decline |
| `apps/frontend/tests/tdd/sprint-143-governance-lifecycle.test.tsx` | GovernanceTab close actions, expiry, ineligible notice, copy |
| `apps/frontend/tests/tdd/sprint-143-community-leave.test.tsx` | Leave control: gating, confirmation, payload, token, errors |
| `tests/integration/sprint-143-governance-lifecycle.integration.test.ts` | Real-DB proof: migration, lifecycle, expiry, races, BUG-102 |

| Existing file | Change |
|---|---|
| `services/community-service/src/database/governancePolicy.ts` | `deriveViewerState`, `closeStatusFor`, lifecycle types |
| `services/community-service/src/database/governanceDb.ts` | `closeNomination`; expiry in ratify/create; GET projection |
| `services/community-service/src/routes/governance.ts` | Withdraw/decline routes |
| `services/community-service/src/routes/members.ts` | Join rejoin/staff-only/23505; DELETE departure status, guard, counter, token |
| `services/community-service/tests/regression/sprint-93-members-delete-jwt.test.ts` and other member regressions that drive DELETE/join | Adapt to the new transaction shape without weakening any assertion |
| `services/community-service/tests/regression/sprint-112-governance-export-privacy.test.ts` | Adapt fixtures to the new GET fields; keep the privacy assertions |
| `apps/frontend/src/components/GovernanceTab.tsx` | Types, close actions, expiry, ineligible notice, copy fix |
| `apps/frontend/src/lib/api.ts` | `withdrawNomination`, `declineNomination` |
| `apps/frontend/src/components/community/CommunityHero.tsx`, `apps/frontend/src/pages/communities/[id].tsx` | Leave control and handler; shared token persistence |
| `apps/frontend/tests/regression/sprint-113-governance-no-nan.test.tsx`, `apps/frontend/tests/regression/sprint-142-governance-quorum.test.tsx` | Fixture updates in place (verify the paths first) |
| `infrastructure/postgres/init.sql` | Regenerated, never edited |
| `docs/concepts/governance.md`, `docs/guides/admin-community-guide.md`, `docs/guides/finding-communities-guide.md` | Lifecycle, leave/rejoin |
| `apps/frontend/src/lib/onboarding/workflows.ts` | One stewardship sentence |
| `docs/adr/ADR-055-trust-governance-architecture.md`, `docs/adr/README.md` | Sprint 143 amendment; no new number |
| `services/community-service/CONTEXT.md`, `services/registry.json` | Contracts |
| `docs/BUGS.md` | BUG-102 fixed; BUG-103 note |
| `tests/fixtures/reputation-disclosure-inventory.json` | GET governance sample, only if it carries nominations |
| `apps/landing/src/data/docs/` | Regenerated pages only |
| `.claude/handoff/CURRENT_HANDOFF.md` | Rolling state |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Lock order is nomination → membership everywhere.** Creation must close an expired slot *before* its
   membership locks. Members routes never lock nominations.
2. **Expiry uses the DB clock.** Use `expires_at <= now()` in SQL inside the transaction, never JS time. Write
   `resolved_at = expires_at` for an expired close.
3. **An expired close must commit before the 409.** `governanceTransaction` rolls back on any throw, so return a
   result and refuse after `COMMIT`.
4. **Migration order matters.** Run `ADD COLUMN` (no default), then `SET DEFAULT`, then backfill v1 rows, then
   the CHECKs. Adding the column *with* a volatile default stamps every historical row with now()+30d.
5. **One `DO` block.** No top-level `BEGIN`/`COMMIT`/`LOCK`; rerunnable with zero drift. `CREATE OR REPLACE` the
   guard function with the Sprint 142 body plus the expiry checks. Never drop the guards in the live DB.
6. **A self-DELETE of a non-active row must be refused.** Otherwise a removed member can convert `inactive` →
   `left` and rejoin.
7. **Rejoin always resets the role to `member`.** It never restores a stored role. Only the staff PUT
   reactivates `inactive` rows.
8. **Decrement `current_members` only for a row that was `active`.** Increment it only on an active rejoin, in
   the same transaction. Other drift is BUG-103.
9. **`can_ratify` must mirror the POST exactly**, including the `count + 1 ≥ R` ineligible case.
   `nominee_eligible` is a coarse boolean; no score or threshold leaves the API (ADR-082).
10. **Isolation comes from explicit predicates.** Use `community_id` predicates on every read and write and
    test them with a foreign community. CI's DB role bypasses RLS
    (`docs/gotchas/database-roles-bypass-rls-so-rls-is-not-an-isolation-proof.md`).
11. **Real-DB runs use a disposable container only.** They run on karmyq.com over SSH (decision 7) or in CI.
    Nothing touches the demo application DB. No platform grant, demo data operation, merge, deploy, version
    bump, dependency edit or new ADR number is authorized.
12. **`init.sql` and landing JSON are generated.** Regenerate them from source and revert unrelated churn.

---

## Task 1: Prepare the branch and pin the migration

**Files:**
- Create: `services/community-service/tests/tdd/sprint-143-governance-lifecycle-migration.test.ts`
- Create: `infrastructure/postgres/migrations/20261115-governance-nomination-lifecycle.sql`
- Modify: `infrastructure/postgres/init.sql` (regenerated)

- [ ] **Orient.** Run `git status -sb`, `git fetch origin`, `gh pr list` and `git log --oneline origin/master -3`.
  If master moved past `1692a560`, merge `origin/master` (merge commit). Read the local contexts listed under
  Global constraints. Run `node scripts/gotcha-check.js --for infrastructure/postgres/migrations/
  services/community-service/src/ apps/frontend/src/components/ tests/integration/`.
- [ ] **Confirm the migration filename.** `ls infrastructure/postgres/migrations/*.sql | sort | tail -3`. The
  new name must sort after `20261112-governance-quorum.sql` and be unused.
- [ ] **Write the shape test.** It reads the migration text and asserts:
  - there is exactly one `DO $migration$` block, with no top-level `BEGIN;`, `COMMIT;` or `LOCK TABLE`;
  - inside the block, `ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ` precedes
    `SET DEFAULT (now() + interval '30 days')`, which precedes the backfill
    `WHERE quorum_policy_version = 1 AND expires_at IS NULL`, which precedes the expiry CHECK;
  - the status CHECK lists exactly the six statuses;
  - the guard function still contains every Sprint 142 check (marker, metadata) plus the two expiry raises;
  - the members status `COMMENT` names `left` and `inactive`.
- [ ] **Run red:**

```bash
npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-143-governance-lifecycle-migration.test.ts --runInBand --no-cache
```

  Expect a missing-file failure.
- [ ] **Write the migration** per the spec's *Data model*. Copy the Sprint 142 guard body from
  `20261112-governance-quorum.sql:36-57` verbatim and extend it. Do not re-type its checks from memory.
- [ ] **Run the same command green.**
- [ ] **Run `migration-validator` on the new file.** Note that its schema list is stale
  (`.claude/agents/migration-validator.md:12-24`), so judge schema-ownership findings against
  `infrastructure/claude.md`.
- [ ] **Regenerate `init.sql`.** No Docker on this box, so choose one route:
  - **A — workflow.** `regenerate-init-sql.yml` on the pushed branch, per the memory note
    `reference_init_sql_regen_via_workflow`. Precondition: the branch's `init.sql` is byte-identical to
    `origin/master`'s (`git hash-object` on both). Before pushing, run
    `npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-120-init-sql-drift-gate.test.ts`. If the
    pre-push gate would block the migration-only push, use route B rather than bypassing hooks.
  - **B — authorized disposable container.** On karmyq.com, run `scripts/regenerate-init-sql.sh` against a
    throwaway `postgres:15` container (`REGEN_PG_CONTAINER`), then copy the artifact back byte-for-byte.
  - Either way, the diff must contain only this migration's objects plus its `schema_migrations` ledger row.
- [ ] **Verify:**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-120-init-sql-drift-gate.test.ts
```

  Must pass. Commit the migration, `init.sql` and the shape test.

## Task 2: Pure lifecycle and membership rules

**Files:**
- Create: `services/community-service/tests/tdd/sprint-143-governance-lifecycle-policy.test.ts`
- Create: `services/community-service/src/utils/memberLifecycle.ts`
- Modify: `services/community-service/src/database/governancePolicy.ts`

**Interfaces:**
- `deriveViewerState(input: { isNominee: boolean; inElectorate: boolean; hasVoted: boolean; count: number; required: number; nomineeEligible: boolean }): { can_ratify: boolean; reason: 'eligible' | 'nominee' | 'already_ratified' | 'not_in_electorate' | 'ready_to_finalize' | 'nominee_ineligible' }`
- `closeStatusFor(action: 'withdraw' | 'decline'): 'withdrawn' | 'declined'`
- `classifyExistingMembership(status: string | undefined): 'new' | 'already_active' | 'already_pending' | 'rejoin' | 'staff_only'`
- `departureStatus(isSelfRemove: boolean): 'left' | 'inactive'`
- `canSelfDepart(status: string): boolean` (true only for `active` and `pending`)

- [ ] **Write the tests.** Assert every row of the spec's viewer table, including `count + 1 ≥ R` vs.
  `count + 1 < R` with an ineligible nominee. For classification:
  - `undefined → new`, `active`, `pending`, `left → rejoin`;
  - `inactive`, `invited`, `''` and an arbitrary string → `staff_only` (fail closed).
- [ ] **Run red:**

```bash
npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-143-governance-lifecycle-policy.test.ts --runInBand --no-cache
```

- [ ] **Implement the pure functions.** No SQL and no HTTP in these modules.
- [ ] **Run the same command green**, then commit.

## Task 3: Route contracts for withdraw and decline

**Files:**
- Create: `services/community-service/tests/tdd/sprint-143-governance-lifecycle-routes.test.ts`
- Modify: `services/community-service/src/routes/governance.ts`

- [ ] **Read the pattern first.** Read `services/community-service/tests/regression/sprint-142-governance-routes.test.ts` and
  follow its dispatch pattern (real router, real middleware, DB boundary as that suite does it).
- [ ] **Write the tests:**
  - `POST …/governance/withdraw/:nominationId` and `…/decline/:nominationId` exist;
  - a malformed nomination UUID → 400 `INVALID_REQUEST` before any DB call;
  - identity comes only from the JWT `userId` (a body `user_id` is ignored);
  - `GovernanceError`s map to ADR-074 envelopes, including 409 `GOVERNANCE_NOMINATION_EXPIRED`;
  - unexpected errors → logged 500 `INTERNAL_ERROR` with no SQL in the body.
- [ ] **Run red:**

```bash
npm exec --workspace=services/community-service -- jest --runTestsByPath tests/tdd/sprint-143-governance-lifecycle-routes.test.ts --runInBand --no-cache
```

- [ ] **Add the two routes**, using the existing `handle` and UUID validation (`governance.ts:7-30`). Call
  `closeNomination` (Task 4); declare its signature now and implement it in Task 4.
- [ ] **Run the same command green**, then commit.

## Task 4: Withdraw, decline and lazy expiry in the DB layer

**Files:**
- Modify: `services/community-service/src/database/governanceDb.ts`
- Create: `tests/integration/sprint-143-governance-lifecycle.integration.test.ts` (governance cases first)

**Interface:** `closeNomination(input: { communityId: string; nominationId: string; callerId: string; action: 'withdraw' | 'decline' }): Promise<{ id: string; status: 'withdrawn' | 'declined' }>`

- [ ] **Bring up the disposable DB** (decision 7). Before anything else, verify read-only on karmyq.com that
  Docker is available. Then:
  - start a throwaway `postgres:15` container bound to `127.0.0.1` on an unused port;
  - load this branch's `init.sql`, then replay the migration chain with `scripts/ci-apply-full-schema.sh`;
  - open an SSH `-L` tunnel and set `DATABASE_URL` to the tunnel;
  - tear the container down at the end of the task.
  These commands are a sketch: re-derive them on the host first and record the exact ones in the commit
  message (**UNVERIFIED** here). Never point anything at the demo application DB.
- [ ] **Write the integration cases first:**
  - nominator-only withdraw and nominee-only decline;
  - refused for an admin who is neither party, for an inactive caller, and for a foreign community (404, row
    unchanged);
  - ballots are preserved, retries return 409 `GOVERNANCE_NOMINATION_CLOSED`, and a self-nomination can use
    either endpoint;
  - set `expires_at` into the past by direct `UPDATE`, which the guard allows, since it fires only on a status
    change. Then ratify, withdraw and decline each return 409 `GOVERNANCE_NOMINATION_EXPIRED`, and in a **fresh
    connection** the row is `expired` with `resolved_at = expires_at`;
  - creation for the same nominee and role succeeds and the old row is `expired`;
  - with the marker set, a raw ballot insert and a raw `UPDATE … status='ratified'` on an expired row both fail
    with `GOVERNANCE_NOMINATION_EXPIRED`.
- [ ] **Run red** with `npm run test:integration` against the tunnel (needs `DATABASE_URL`).
- [ ] **Implement:**
  - `closeNomination` per the spec's lock sequence;
  - in ratify, the expired branch after the nomination lock;
  - in creation, the slot reclaim **before** the membership locks;
  - commit-then-refuse: `work` returns a result and the caller throws after `governanceTransaction` resolves.
- [ ] **Add the two-connection races**, following the patterns of Sprint 142 integration cases 361-430:
  - decline vs. final ratification: exactly one of {declined, ratified}, and no role grant after a decline;
  - withdraw vs. ratification;
  - creation reclaiming a slot vs. ratification on that same expired row: no deadlock, or else the explicit 503
    with no partial write.
- [ ] **Verify** the Sprint 143 governance cases and the **whole** Sprint 142 integration file green on the
  disposable DB. Commit.

## Task 5: GET projection — expiry, nominee eligibility and the viewer mirror

**Files:**
- Modify: `services/community-service/src/database/governanceDb.ts`
- Modify: `tests/integration/sprint-143-governance-lifecycle.integration.test.ts`
- Modify: `services/community-service/tests/regression/sprint-112-governance-export-privacy.test.ts` (only if its fixtures need the new fields)

- [ ] **Write the integration cases first:**
  - GET hides expired pending rows and returns `expires_at` exactly `created_at + 30 days`;
  - `nominee_eligible` is false for an inactive nominee, a below-threshold nominee, and a nominee who already
    holds the role;
  - each viewer-table row maps to the right `reason` and `can_ratify`, and **for each `can_ratify: false` case the
    POST is in fact refused**. The `count + 1 < R` ineligible case records a ballot;
  - `can_withdraw` is true only for the nominator and `can_decline` only for the nominee;
  - the response still has no forbidden reputation key (`Disclosure.assertNoForbiddenReputationKeys`) and no
    roster.
- [ ] **Run red** on the disposable DB.
- [ ] **Implement.**
  - Add `AND n.expires_at > now()` to the pending query (`governanceDb.ts:99`).
  - Compute `nominee_eligible` per nomination by reusing the threshold SQL from `checkNomineeTrust` as a boolean.
    Never return the sum.
  - Replace the inline reason logic (`governanceDb.ts:116-122`) with `deriveViewerState`.
  - Extend the `GovernanceNomination` DTO.
- [ ] **Run green**, plus `npm exec --workspace=services/community-service -- jest --runTestsByPath tests/regression/sprint-112-governance-export-privacy.test.ts`. Commit.

## Task 6: Member departure and rejoin (BUG-102)

**Files:**
- Modify: `services/community-service/src/routes/members.ts`
- Modify: `tests/integration/sprint-143-governance-lifecycle.integration.test.ts`
- Modify: `services/community-service/tests/regression/sprint-93-members-delete-jwt.test.ts` and any other member regression whose mock sequence changes

- [ ] **Grep every caller of join and DELETE** (Bug Fixing rule 2): frontend, mobile, simulation (`services/simulation-service/src/workflows/join-community-workflow.ts:86`, `api-client.ts:352`), and tests. Record the expected behavior change for each, for example that simulation personas whose curated rows are `left` can now rejoin.
- [ ] **Write the integration cases first.** Drive the real `membersRouter` through supertest with shared JWT auth,
  as the Sprint 142 suite does (`tests/integration/sprint-142-governance-quorum.integration.test.ts:483-505`):
  - self-DELETE of an active row → `left`, counter −1, `data.token` present and decodes without the community;
  - self-DELETE of a pending row → `left`, counter unchanged;
  - self-DELETE of an `inactive` row → 409, row still `inactive`;
  - admin DELETE of a pending applicant → `inactive`, counter unchanged;
  - admin DELETE of a `left` row → `inactive`;
  - a sole admin's self-leave → 400 (unchanged);
  - join after `left` into a public community → `active`, role `member` (seed the stored role as `admin`), counter
    +1, token; into a private community → `pending`, counter unchanged;
  - join after `inactive` → 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF`;
  - two concurrent rejoins → one 200 and one 409; two concurrent first joins → one 200 and one 409, never 500;
  - a rejoined original voter's ballot counts again on a pending nomination;
  - log the DB role flags (`current_user`, `rolsuper`, `rolbypassrls`).
- [ ] **Run red** on the disposable DB.
- [ ] **Implement DELETE.** One transaction:
  - row `FOR UPDATE` with the prior status → `canSelfDepart` guard for self;
  - the existing last-admin guard;
  - write `departureStatus(isSelfRemove)`;
  - decrement only if the prior status was `active`.
  Reissue the token for a self-leave from active.
- [ ] **Implement join.**
  - Branch on `classifyExistingMembership`.
  - Rejoin is a conditional `UPDATE … WHERE status = 'left' RETURNING *`, with the counter increment in the same
    transaction; zero rows → re-read and 409.
  - Map 23505 on `members_community_id_user_id_key` → 409 `CONFLICT`.
  - Extract the claim-query + `jwt.sign` block (`members.ts:162-187`) into one helper used by join, rejoin and
    self-leave.
- [ ] **Run green**, plus the community-service unit and regression suites
  (`npm test --workspace=services/community-service`). Adapt mocked regressions to the new transaction shape
  without deleting any assertion. Commit.

## Task 7: GovernanceTab close actions and expiry

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-143-governance-lifecycle.test.tsx`
- Modify: `apps/frontend/src/components/GovernanceTab.tsx`, `apps/frontend/src/lib/api.ts`
- Modify: the Sprint 113 and Sprint 142 frontend governance tests' fixtures (verify their paths with `ls apps/frontend/tests/*/ | grep governance`)

- [ ] **Write the tests.** Mount the real `GovernanceTab` with interceptor-shaped responses (`res.data` is the
  payload; `apps/frontend/claude.md` → envelope unwrap) and assert:
  - **Withdraw nomination** renders only when `can_withdraw` and **Decline** only when `can_decline`;
  - each needs a confirm step, then calls `withdrawNomination`/`declineNomination` with the exact
    `(communityId, nominationId)`, then refetches;
  - cancel calls nothing;
  - a 409 message renders in the alert and the tab refreshes;
  - "Closes {date}" renders from `expires_at`;
  - the ineligible notice renders when `nominee_eligible` is false, and no Finalize button shows for
    `nominee_ineligible`;
  - the new `not_in_electorate` copy.
- [ ] **Run red:**

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-143-governance-lifecycle.test.tsx --no-cache
```

- [ ] **Implement in place**, using the existing `perform` and the inline confirm pattern, with no new layout.
  Add the two API functions next to `ratifyNomination` (`api.ts:361-362`).
- [ ] **Run green**, update the Sprint 113 and Sprint 142 fixtures in place, and run
  `npm test --workspace=apps/frontend`. Commit.

## Task 8: Web Leave community control

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-143-community-leave.test.tsx`
- Modify: `apps/frontend/src/components/community/CommunityHero.tsx`, `apps/frontend/src/pages/communities/[id].tsx`
- Modify (only if it already holds session helpers): `apps/frontend/src/lib/session.ts`

- [ ] **Look for an existing token-persistence helper first.** Check `[id].tsx:101-117` and the communities index
  join (`pages/communities/index.tsx:344`). If both duplicate it, extract one helper (update, don't create).
- [ ] **Write the tests:**
  - Leave is shown for an active member and hidden for a non-member, a pending member and a logged-out viewer;
  - confirm → `communityService.leaveCommunity(communityId, currentUser.id)`; cancel → no call;
  - on success, a returned `data.token` is persisted the same way join does and the community refetches;
  - the 400 last-admin message is shown;
  - a removed member's Join shows the 409 `MEMBERSHIP_RESTORE_REQUIRES_STAFF` message.
- [ ] **Run red:**

```bash
npm exec --workspace=apps/frontend -- jest --runTestsByPath tests/tdd/sprint-143-community-leave.test.tsx --no-cache
```

- [ ] **Implement:** an `onLeave` prop on `CommunityHero` and `handleLeaveCommunity` in the page. Use the existing
  styles and message path, with no redesign.
- [ ] **Run green** and `npm test --workspace=apps/frontend`. Commit.

## Task 9: Complete the real-DB proof

**Files:**
- Modify: `tests/integration/sprint-143-governance-lifecycle.integration.test.ts`

- [ ] **Add the migration replay cases** (one `BEGIN … ROLLBACK` client, as Sprint 142's legacy-replay case
  does):
  - seed v1 pending, v1 resolved and legacy rows with `expires_at` NULL, then re-run the migration text;
  - only v1 rows get `created_at + 30 days`, and resolved/legacy rows keep NULL;
  - a Sprint 142-shaped v1 insert (no `expires_at`) receives the default;
  - a v1 row with `expires_at` NULL is rejected by the CHECK;
  - an unknown status is rejected;
  - a second replay changes nothing.
- [ ] **Run the whole root integration tier uncached** on the disposable DB:
  `npm run test:integration` (Sprint 142 + Sprint 143 + everything else it discovers). Record the counts, the
  role flags and the exact commands in the commit message.
- [ ] **Tear down** the container and tunnel. Verify on the host that no Sprint 143 container remains. Commit.

## Task 10: User guides, landing docs and the ADR-055 amendment

**Files:**
- Modify: `docs/concepts/governance.md` (lines 25, 50), `docs/guides/admin-community-guide.md` (around 70 and 80-103), `docs/guides/finding-communities-guide.md`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts:75`
- Modify: `docs/adr/ADR-055-trust-governance-architecture.md`, `docs/adr/README.md`
- Modify: `apps/landing/src/data/docs/` (regenerated)

- [ ] **Read each section before editing it**, then write the spec's *User guide & doc updates* content. Describe
  shipped behavior only: no rotation, revocation or notifications.
- [ ] **Add the ADR-055 amendment** (dated 2026-11-15, Sprint 143): the lifecycle, lazy plus DB-enforced expiry,
  lock order, and the rejoin rule as it affects electorates. Update the index line. No new ADR number, and no
  `ADR_GROUPS` change for an existing slug.
- [ ] **Regenerate the landing docs:** `npm run generate-docs --workspace=apps/landing`. Revert the build
  timestamp, HEAD-sha, `dependencyGraph` and ADR-010 churn (`apps/claude.md`; memory
  `feedback_npm_test_regenerates_landing_docs`). Use `git add -f` for tracked generated pages.
- [ ] **Verify:**

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts
```

  Must pass. Commit.

## Task 11: CONTEXT, registry, bug log and test promotion

**Files:**
- Modify: `services/community-service/CONTEXT.md`, `services/registry.json`, `docs/BUGS.md`
- Modify (only if needed): `tests/fixtures/reputation-disclosure-inventory.json`
- Move: each Sprint 143 `tests/tdd/` file to the same workspace's `tests/regression/`

- [ ] **Update CONTEXT.md:**
  - a Recent Changes entry;
  - schema additions;
  - the new endpoint docs;
  - the join and DELETE docs (replace the stale `members.ts:43` / `:260` references with handler names).
- [ ] **Update `registry.json`:**
  - the withdraw and decline endpoints;
  - updated descriptions for GET, nominate, ratify, join and DELETE.
- [ ] **Update the bug log.** Mark BUG-102 fixed (PR reference added at PR time). Add a note to BUG-103 naming
  which statements were corrected.
- [ ] **Check the disclosure inventory.** If the GET governance `sample_response` carries nominations, add the new
  fields and keep it key-clean:

```bash
npm exec --workspace=tests -- jest --runTestsByPath regression/reputation-disclosure-gate.test.ts
```

- [ ] **Promote each green Sprint 143 tdd file individually** with `git mv` (never the promoter script; memory
  `feedback_tdd_promoter_sweeps_unrelated`). Re-run each promoted file by path, uncached.
- [ ] **Run the advisory checks:** `npm run feedback:check` (advisory; it reads only staged changes) and
  `npm run analyze:services` only if dependencies changed (they should not). Commit.

## Task 12: SDLC quality gates (mandatory)

**Files:** the full branch diff and any justified corrections. No new scope.

- [ ] **Testing.** Map every spec acceptance bullet to a named test. Confirm that red→green evidence exists per
  task and that the whole root integration tier passed (Task 9). Verification: the matrix has no uncovered
  bullet.
- [ ] **`/simplify`.** One calibrated pass on the PR diff. Verification: findings resolved or justified in the PR
  ledger.
- [ ] **`/code-review`** at **high** effort (the diff touches locking, authorization and migration). Focus on the
  *Review focus* list. Verification: correctness findings fixed, with focused tests re-run after each fix.
- [ ] **`/security-review`.** Focus on:
  - the removed-member rejoin path;
  - foreign-community access;
  - JWT-only identity;
  - the token reissue on leave;
  - coarse eligibility disclosure;
  - rollback behavior.
  Verification: real findings fixed; dismissals carry a written justification. CI's dependency audit and CodeQL
  still gate the PR. New route lines may raise the documented `js/missing-rate-limiting` false positive (memory
  `feedback_codeql_rate_limiting_mount_middleware_fp`); surface it for dismissal.
- [ ] **process-reviewer**, once on the full branch diff before the PR. Record its findings and the evidence it
  assessed.
- [ ] **Re-run root gates after review fixes:** `npm test --workspace=tests` (memory
  `feedback_rerun_root_gates_after_review_fixes`).

## Task 13: Final verification, push and product PR

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`
- The PR body, from `.github/pull_request_template.md`

- [ ] **Re-check live state.** Fetch and inspect master and the open PRs. If master changed, merge it (never
  rebase). The version stays **unallocated** unless the maintainer allocates it; record that as a
  merge-readiness blocker.
- [ ] **Type-check:**

```bash
npm run type-check --workspace=services/community-service
npm exec --workspace=apps/frontend -- tsc --noEmit
```

- [ ] **Update the handoff.** Record the next unchecked task, the PR, review results, commit-specific evidence
  and the remaining authorizations. Stage exactly the intended files.
- [ ] **Run `/pre-commit-check` once** (`bash scripts/pre-commit-check.sh`). If docs tests regenerate artifacts,
  follow its printed snapshot recovery and retry once.
- [ ] **Commit and push the feature branch** with normal hooks. A silent, instant push means no hook ran: treat
  that as a red flag. Record the hook's SHA, cache state and limitations in the PR Validation ledger.
- [ ] **Open one product PR** with every template section (CI checks the contract headers,
  `.github/workflows/pr-contract.yml`). The body must also:
  - state that it bundles the Sprint 142 post-merge record `3e63ca9f`;
  - name the scope expansions: the Leave control, the BUG-103 statement corrections and the DB expiry guard;
  - list the unauthorized items.
- [ ] **Reconcile the handoff** with live PR state, push, and **stop** (memory `feedback_stop_after_pr_creation`):
  no CI watch, merge ask or deploy in this chat. End with the next-chat prompt.

## Task 14: Merge and deploy — maintainer-authorized follow-on only

- [ ] **Only with the maintainer's explicit allocation** of the version, the merge slot and (if needed) an admin
  merge: run the `ship`/`deploy` skill. That covers the CI/CD deploy, health verification, CodeQL master alerts
  read after the merge, and the post-merge record on the next branch.
- [ ] **The post-deploy smoke test** may use only authorized checks. The platform-admin grant and its 200 smoke
  check remain separately unauthorized.
