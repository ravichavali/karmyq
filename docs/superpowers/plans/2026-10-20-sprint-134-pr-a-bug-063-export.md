# Sprint 134 PR A — BUG-063 Community Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all three community export routes work against the live schema, proven by a real-SQL test, merged by 2026-10-24.

**Architecture:** One file, `services/community-service/src/routes/export.ts`, is rewritten query by query against
`infrastructure/postgres/init.sql`. A real-SQL integration test drives the running community-service, and a schema-truth unit gate
stops a nonexistent `schema.table` from coming back.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** `docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md` → *PR A*.
**Branch:** `agent/claude/sprint-134-pr-a-bug-063-export`, cut from `origin/master` after PR F merges.
**Deadline:** BUG-063 is due **2026-10-24 (Saturday)**. Target: PR open 10-21, merge 10-22.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/community-service/tests/tdd/sprint-134-export-schema-truth.test.ts` | Unit gate: every `schema.table` and qualified column in `export.ts` exists in `init.sql` (negative fixture included) |
| `tests/integration/sprint-134-community-export.integration.test.ts` | Real-SQL: admin 200 with every section, member/non-member/removed-admin 403, exact activity counts, date filter 200 |

### Existing files to modify
| File | Change |
|------|--------|
| `services/community-service/src/routes/export.ts` | Every query repaired (spec table) |
| `services/community-service/tests/regression/sprint-112-governance-export-privacy.test.ts` | Mock regexes `:71`, `:75` → live names; activity mock shape |
| `services/community-service/CONTEXT.md` | Known Issues → Recent Fixes (BUG-063); export section contents |
| `services/community-service/.claude/README.md` | "Database Schema: community" → `communities` |
| `docs/guides/admin-community-guide.md` | New "Exporting community data" section |
| `docs/BUGS.md` | BUG-063 → fixed (version, sha after merge) |
| `package.json` | Version bump, re-derived from `origin/master` at merge time |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Read the schema, not the code.** Check every table/column against `infrastructure/postgres/init.sql` (`communities.members` `:1282`,
   `communities.norms` `:1320`, `communities.norm_approvals` `:1309`, `communities.settings` `:1335`, `requests.help_requests` `:2422`,
   `requests.matches` `:2551`, `requests.request_communities` `:2705`, `reputation.trust_scores` `:2256`, `reputation.karma_records` `:2186`).
2. **The community schema is `communities` and membership is `members`.** `help_requests` has no `community_id`; link via
   `requests.request_communities`. Keep `NOT r.is_directed` with its `/* not-directed */` marker (privacy-gate scans read it).
3. **Qualify every column in joined queries.** `auth.users` has `created_at`; the current unqualified `dateClause` is ambiguous.
4. **Keep the ADR-082 rule** (`export.ts:216-236`, `:353-355`): no member-level karma, trust score, or reputation ordering.
   Dropping the `trust_scores` join from the activity report is consistent with it.
5. **Admin gate semantics do not change**: live `communities.members` row, `role = 'admin'`, `status = 'active'`. That is already
   CLAUDE.md-compliant (live lookup, not the JWT claim).
6. **No FORCE RLS** on these tables (`init.sql` has 0 occurrences); existing routes (`activities.ts:18`) query `communities.members`
   through the same `pool`, so RLS does not block the fix.
7. **Integration tests need Postgres + live services; this box has neither.** CI's integration job is the arbiter. A demo-host
   disposable DB needs per-operation authorization. Do not claim the integration test passes until CI shows it.
8. **The mocked regression test encoded the bug.** Updating its regexes is required, not optional, but it is not the proof.

---

## Task A0: Dated fallback (only if needed)

- [ ] **If PR A has not merged by end of 2026-10-23 (PDT), stop and propose this risk acceptance to the maintainer verbatim; do not
  record it as accepted until they sign it:**

> **BUG-063 risk acceptance (proposed, 2026-10-23).** The community data export (`GET /communities/:id/export`, `/export/members`,
> `/export/activity`) stays broken past its 2026-10-24 SLA. It fails closed: every call returns 500 before reading member data, so
> no data is exposed and no access is widened. Impact: admins cannot export. Fix: PR A (#<n>), new deadline **2026-10-31**.
> Signed: ________ (maintainer), date ________.

## Task A1: Branch + failing schema-truth gate (TDD)

**Files:**
- Create: `services/community-service/tests/tdd/sprint-134-export-schema-truth.test.ts`

- [ ] **PR F must have merged first** (it unblocks the ADR-059 gate and carries the planning docs). Then
  `git fetch origin && git switch -c agent/claude/sprint-134-pr-a-bug-063-export origin/master`.
- [ ] Write the gate. It reads `export.ts` and `init.sql` as text. For every `FROM|JOIN <schema>.<table>` in `export.ts`, it asserts
  that `CREATE TABLE <schema>.<table> (` exists in `init.sql`. For every `alias.column` whose alias is bound in the same query
  (`FROM communities.members m` → `m`), it asserts the column appears in that table's `CREATE TABLE` body. Include a negative fixture
  that runs the same checker on a string naming `community.memberships` and `m.created_at`, and expects both reported. Without
  it the gate is unproven (memory: gates that assert weaker than they claim).
- [ ] Run it and confirm it **fails** on today's `export.ts`, listing the spec's table of defects:

```bash
cd services/community-service && npx jest tests/tdd/sprint-134-export-schema-truth.test.ts
```

## Task A2: Failing real-SQL integration test

**Files:**
- Create: `tests/integration/sprint-134-community-export.integration.test.ts`

- [ ] Follow `tests/integration/sprint-133-pr-v-read-boundary.integration.test.ts`: `createPool`, `ServiceUrls.COMMUNITY`
  (`tests/fixtures/index.ts:15`), `jwt.sign` with `process.env.JWT_SECRET || 'dev-secret-key'`, `randomUUID` fixtures,
  and a health check in `beforeAll` that fails rather than skips.
- [ ] Fixture: community C. A = active admin; M = active member; X = non-member; F = former admin (`role='admin', status='left'`)
  **whose JWT claim still says admin of C**. Two non-directed asks by M linked to C via `request_communities`, one directed ask (must
  not appear). One completed match where A responded to M's ask, one proposed match. One norm with two `norm_approvals`. A
  `communities.settings` row. Fewer than five karma participants, so `community_reputation_summary` must be **absent**.
- [ ] Assertions (exact values, not presence):
  - `GET /communities/C/export` as A → 200; `data.members` ids = {A, M, F} (the full roster, all statuses);
    `data.requests` ids = M's two non-directed asks only; `data.matches` = both matches; `data.norms[0].approval_count === 2`;
    `data.settings` has exactly the live column keys; no `community_reputation_summary` key.
  - The same with `?date_start=2000-01-01` → 200 (proves the qualification fix).
  - As M, X and F → 403 each (F proves the gate reads the row, not the claim).
  - `GET /export/members` as A → 200 CSV whose header is `Name,Email,Role,Status,Joined Date`; `?format=json` row count 3.
  - `GET /export/activity?format=json` as A → 200. Set the matched ask's `status='completed'` in the fixture, so the
    expected rows are exact: M `Helps Given 0, Helps Received 1, Requests Created 2, Requests Completed 1`;
    A `Helps Given 1, Helps Received 0, Requests Created 0, Requests Completed 0`; F absent (status `left`). Counts come back
    from Postgres as strings (`COUNT(*)` is bigint); cast to `::int` in SQL so the JSON carries numbers, and assert numbers.
  - `afterAll` deletes every fixture row in FK order.
- [ ] It cannot run locally (Note 7). Type-check it: `cd tests && npx tsc --noEmit -p .`

## Task A3: Repair the admin gate and community read

**Files:**
- Modify: `services/community-service/src/routes/export.ts:67-84, 286-289, 341-344`

- [ ] `community.memberships` → `communities.members` in all three admin checks; `community.communities` → `communities.communities`.
  The column list at `:81` is valid as-is.

## Task A4: Repair members, requests and matches sections

**Files:**
- Modify: `services/community-service/src/routes/export.ts:98-175, 298-309`

- [ ] Make `dateClause` take a qualified column: build it as a function `dateClauseFor(column: string)` and call it per query
  (`m.joined_at`, `r.created_at`, `m.created_at` for matches, `n.created_at`, `k.created_at`). Delete the `.replace(/created_at/g, ...)`
  at `:171`.
- [ ] Members: `FROM communities.members m`, drop `m.created_at` from the select list, and order by `m.joined_at`.
- [ ] Requests and matches: replace `r.community_id = $1` with
  `EXISTS (SELECT 1 FROM requests.request_communities rc WHERE rc.request_id = r.id AND rc.community_id = $1)`, keeping
  `/* not-directed */ NOT r.is_directed`.
- [ ] `/export/members` (`:305`): `communities.members`.

## Task A5: Repair norms, settings and the karma aggregate

**Files:**
- Modify: `services/community-service/src/routes/export.ts:177-228`

- [ ] Norms: `FROM communities.norms n`; replace `n.approval_count` with
  `(SELECT COUNT(*) FROM communities.norm_approvals a WHERE a.norm_id = n.id)::int AS approval_count`.
- [ ] Settings: `FROM communities.settings`; select `request_ttl_days, offer_ttl_days, message_ttl_days, notification_ttl_days,
  reputation_half_life_months, activity_types, updated_at`.
- [ ] Karma: alias `reputation.karma_records k` is already there; use `dateClauseFor('k.created_at')`.

## Task A6: Repair the activity report

**Files:**
- Modify: `services/community-service/src/routes/export.ts:353-372`

- [ ] Replace the `trust_scores` join and the two nonexistent counters with four correlated counts, each restricted to non-directed
  asks linked to `$1` through `request_communities`:
  `Helps Given` (completed matches, responder = member), `Helps Received` (completed matches on the member's own asks),
  `Requests Created` (member's asks), `Requests Completed` (member's asks with `status = 'completed'`). Keep `ORDER BY u.name ASC`
  (alphabetical, no reputation ordering, ADR-082). Update the ADR-082 comment at `:353-355` to name the four columns.
- [ ] `FROM communities.members m … WHERE m.community_id = $1 AND m.status = 'active'`.

## Task A7: Update the mocked regression test; gates go green

**Files:**
- Modify: `services/community-service/tests/regression/sprint-112-governance-export-privacy.test.ts`

- [ ] Update the SQL regexes (`:71`, `:75` and any other `community\.` match) to the live names, and the activity mock rows to the four
  new column names. Its ADR-082 assertions (no karma/trust leakage) must still hold. Do **not** weaken them.
- [ ] Run:

```bash
cd services/community-service && npx jest tests/tdd/sprint-134-export-schema-truth.test.ts tests/regression/sprint-112-governance-export-privacy.test.ts && npx tsc --noEmit
```

Expected: both green; the schema-truth gate reports 0 unknown tables/columns, and its negative fixture still fails as designed.

## Task A8: Docs

**Files:**
- Modify: `docs/guides/admin-community-guide.md`, `services/community-service/CONTEXT.md`, `services/community-service/.claude/README.md`,
  `docs/BUGS.md`

- [ ] Guide: new "Exporting community data" section. Cover who can export (active admins), the three downloads, what each contains,
  the four activity columns with their definitions, and that reputation is shown only as a community aggregate with five or more
  contributors (ADR-082).
- [ ] CONTEXT.md: Recent Fixes entry (BUG-063: wrong schema plus 8 nonexistent columns; the mock that hid it); export section
  contents. `.claude/README.md`: schema `communities`.
- [ ] `docs/BUGS.md` BUG-063: status `fixed (Sprint 134 PR A)`, with the full defect list (it named one of nine).
- [ ] Regenerate the landing docs if the guide is published (`scripts/generate-docs.ts:327` lists it); revert timestamp churn.

## Task A9: Registry / feedback check

- [ ] No endpoint, schema or event changes, so `services/registry.json` does not change. Confirm with `npm run feedback:check`. It is
  false-green on a committed branch (memory), so read it against `git diff origin/master...` by hand.

## Task A10: SDLC quality gates

- [ ] `/simplify` on the PR diff (one pass; small diff). Verification: findings applied or dismissed with a reason in the PR body.
- [ ] `/code-review` at **medium** on the branch diff. Verification: no open correctness finding.
- [ ] `/security-review` on the branch diff. Focus: the admin gate, member email exposure (admin-only, Sprint 133 PR S), and that
  no reputation field crept back in. Verification: findings resolved or justified in writing.

## Task A11: Final verification + PR

- [ ] `npm test` (root) green; `npm test --workspace=tests` (~1 min, root gates read other workspaces); `npx tsc --noEmit` in
  community-service; revert `apps/landing/src/data/docs/` churn. The TDD promoter may move the new `tdd/` test to `regression/`.
  Keep that, and restore any unrelated promoted file.
- [ ] Bump the version from `origin/master`'s `package.json` (expected v11.93.0 if A merges first).
- [ ] Push and open the PR (PR contract headers per `pr-contract.yml`). Confirm the **integration job** ran the new test and it passed;
  quote the job's line in the PR. If CI integration does not run it, say so. Do not claim it.

## Task A12: Merge + deploy (maintainer-authorized)

- [ ] Land the handoff update on this branch **before** asking for merge.
- [ ] Ask: "admin merge, yes/no?" Never self-approve, never auto-merge.
- [ ] After merge: watch CI/CD (`gh run watch`); on a CodeQL re-raise, ask before dismissing.
- [ ] **Human validation** (maintainer): as a community admin on karmyq.com, download all three exports from the steward page
  (`StewardRequestsAdmin.tsx:101`), and confirm a non-admin gets 403. Any demo-host read by Claude needs separate authorization.
- [ ] Record the merge sha and version in `docs/BUGS.md` and the handoff.
