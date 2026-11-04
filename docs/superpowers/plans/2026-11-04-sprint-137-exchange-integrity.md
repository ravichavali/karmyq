# Sprint 137 Exchange Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** close the four gaps the request-status guards leave (BUG-088, 089, 090 and 091) in one PR. An expired ask
releases what it held, an offer's status follows its exchanges, a provider offer is written under the request lock, and
a completed or cancelled ask can't be edited.

**Architecture:**
- cleanup-service's hourly `markExpiredData` gains `releaseExpiredHolds`. It runs one transaction per expired ask (the
  `expireDibs` pattern), then one guarded statement that frees stranded offers.
- In request-service, three routes move their check and write under the locks Sprints 135 and 136 built: `PUT
  /requests/:id` under `lockRequest`; `POST /providers/offers` under `lockRequestForCommitment`; and `POST /matches`'s
  offer hold, which also requires an unexpired offer.
- `PUT /offers/:id` refuses a body status, and a gate pins every help-offer status writer.
- Every offer release follows one rule: free an offer only while no other live or completed match holds it. Match
  reject and cancel share a `releaseOffer` helper, and `closeProposals` gets the same guard. Before this sprint, BUG-089
  let one offer back more than one match.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-11-04-sprint-137-exchange-integrity-design.md`](../specs/2026-11-04-sprint-137-exchange-integrity-design.md)

**Branch:** `agent/claude/sprint-137-planning`. Execution continues on it, and the one PR opens from it. It already
carries:
- the #328 post-merge record and the Sprint 136 archive;
- this spec, plan and handoff;
- the BUG-088/090 corrections and the BUG-091 entry.

**Version:** 11.109.0 → 11.110.0, **provisional**: re-derive from `origin/master`'s `package.json` at merge time.

**Rules (maintainer):**
- No demo-host operation, merge, ADR number or CodeQL dismissal without explicit per-operation authorization. No ADR is
  needed.
- Dependency lane: Claude. This sprint adds no dependency.
- Push, and leave the tree clean, at every stopping point. **Stop at PR creation.**

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-137-exchange-integrity.test.ts` | Mocked-SQL contract for A, B1, B2, C |
| `services/request-service/tests/tdd/sprint-137-offer-status-gate.test.ts` | B4: every help-offer status writer is reviewed; negative fixtures |
| `services/cleanup-service/tests/tdd/sprint-137-release-expired-holds.test.ts` | D: statement order per transaction, skip, isolation, counts |
| `tests/integration/sprint-137-exchange-integrity.integration.test.ts` | Real-SQL proofs and races for A–D and the shared-offer release rule (CI-only) |

### Existing files to modify
| File | Change |
|------|--------|
| `services/cleanup-service/src/jobs/expirationJob.ts` | `releaseExpiredHolds` (D1, D2); `markExpiredData` calls it after the four flags |
| `services/cleanup-service/tests/unit/expirationJob.test.ts` | New contract: four flags, then the release |
| `services/request-service/src/routes/requests.ts` | A: `PUT /:id` under `lockRequest`, `409 REQUEST_CLOSED`, `content_forgotten_at IS NULL` |
| `services/request-service/src/routes/offers.ts` | B1: body `status` → `400 STATUS_NOT_EDITABLE` |
| `services/request-service/src/db/helpOffersDb.ts` | B2: `findOwnOffer` also selects `expired` |
| `services/request-service/src/routes/matches.ts` | B2: fast path refuses an expired offer; the hold requires an unexpired offer. B5: reject and cancel call `releaseOffer` |
| `services/request-service/src/db/requestStatus.ts` | B5: new `releaseOffer`; `closeProposals`' offer `UPDATE` gains the shared-offer guard |
| `services/request-service/src/routes/providerOffers.ts` | C: lock → duplicate check → insert in one transaction; `409 REQUEST_NOT_OPEN` |
| `services/request-service/src/db/providerOffersDb.ts` | C: `createProviderOffer(q, …)` |
| `services/request-service/tests/helpers/directedSurfaceScan.ts` | B4: optional table pattern on `scanFile` / `scanServices` (default unchanged) |
| `services/request-service/tests/helpers/directedSurfaceAllowlist.json` | Re-pinned hashes: D1's two `help_requests` reads, A's `UPDATE` |
| `apps/frontend/src/lib/api.ts` | B3: `updateOffer`'s `status?` line → a comment line (same line count) |
| `docs/guides/{fulfilling-requests,making-requests,match-lifecycle,your-memory-and-relationships,using-service-providers}-guide.md`* | The spec's *User Guide & Doc Updates* |
| `services/request-service/CONTEXT.md`, `services/cleanup-service/CONTEXT.md` | Endpoints, job, Recent Fixes |
| `docs/BUGS.md` | BUG-088..091 → fixed |
| `package.json`, `package-lock.json` | The root version lines only |
| `.claude/handoff/CURRENT_HANDOFF.md` | Execution record |

\* `match-lifecycle.md` has no `-guide` suffix: `docs/guides/match-lifecycle.md`.

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Lock, then check, in separate statements** for the request lock (A, C, D1). A statement that waited on a row lock
   keeps its subqueries' snapshot from before the wait (`requestStatus.ts:38-44`). Take the lock in its own statement,
   and decide in the next one. **Offer releases are single guarded statements** (`releaseOffer`, `closeProposals`, D1's
   offer `UPDATE`, D2). B5 explains why that is exact: no runtime writer in `services/*/src` adds a hold to a
   `matched` offer, and B4 gates that.
2. **Lock order.**
   - D1 is request → offers → matches, the same as accept's `closeProposals`.
   - D2 takes only the offer rows it updates.
   - C is request-first and inserts one row.
   - A is the request lock only.

   Before writing D, re-read match cancel and complete. Confirm that each `UPDATE ... AND status = 'matched'` takes no
   lock on a proposed row, and that no `help_offers` writer holds an offer lock and then waits on the request lock
   (Sprint 136's test header lists them).
3. **Decide before the first write.** Each refusal returns before anything is written:
   - A refuses before its `UPDATE`;
   - C refuses at the lock and the duplicate check, before its insert;
   - the B2 hold's miss returns before the match insert.
4. **The scanner sees only `help_requests` literals** (`directedSurfaceScan.ts:30`). B4 adds a table parameter whose
   default keeps today's pattern. Prove that `sprint-132-directed-audience-gate` and `sprint-135-request-status-gate`
   find the same hits before and after.
5. **Re-pin directed-surface hashes with `surfaceHash`. Never hand-type one.** These need re-pinning:
   - D1's candidate `SELECT` and lock `SELECT`. These are new entries in
     `services/request-service/tests/helpers/directedSurfaceAllowlist.json`, with reason "Internal expiry mutation, no
     audience-facing output."
   - A's changed `UPDATE`.
   - Anything else the gate names with file:line.

   D2's statements do not name `help_requests` and need no entry.
6. **D writes no `help_requests` row.** No `updated_at` stamp, so the hard-delete clock (gotcha) and the request-status
   gate are untouched.
7. **The copied `closeProposals` SQL** (D1) is text for text the guarded statement in B5. It keeps three properties:
   - an offer is freed only while `matched`, so a withdrawn offer stays withdrawn;
   - no other match must still hold it (decision 10);
   - offers are updated first, so the subquery still sees the proposals.

   A comment in each copy names the other. The integration tests' withdrawn-offer and shared-offer cases prove the
   behaviour, not the text.
8. **SQL hygiene.**
   - Use literal statuses only.
   - `expired` is nullable, so write `IS TRUE` / `IS NOT TRUE` in request-service.
   - Check expiry with `clock_timestamp()` after a lock wait, never `NOW()`.
   - `expires_at` is `timestamp without time zone`. Compare it as Sprint 136 did (`requestStatus.ts:75`).
   - Test fixtures cast `$n::varchar`.
9. **Identity is `req.user!.userId`** (ADR-064). No route reads the JWT `communities` claim
   (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`).
10. **Real-SQL tests live in root `tests/integration/`** and run in CI only (no local PostgreSQL on the Windows box).
    - Prove waits with `pg_blocking_pids`, never a sleep. A waiter counts when the holder blocks it directly, or blocks
      a pid that blocks it (Sprint 136 note 14).
    - Root integration tests already import cleanup-service source directly (`sprint-136-request-followups`), so D's
      cases call `markExpiredData()`.
11. **Tests first** in `services/request-service/tests/tdd/` and `services/cleanup-service/tests/tdd/`. Run them red,
    then implement. Promote with a targeted `git mv`, not the promoter, which sweeps every green tdd file repo-wide.
    **Cleanup-service's `test` script is bare `jest`, and its config includes `tests/tdd`** (`package.json:12`,
    `jest.config.js:10`; BUG-092). So a red cleanup tdd file fails `npm test` and the pre-push hook. Run it red
    locally, and commit it only together with the implementation that turns it green. Request-service's `test` is
    `test:unit && test:regression`, so its red tdd files may be committed alone.
12. **`markExpiredData`'s unit test pins four calls** (`tests/unit/expirationJob.test.ts:19-33`). Update it to the new
    contract: the four flags, then the release. Do not weaken it.
13. **`npm test` regenerates landing docs.** Revert the timestamp and HEAD-sha churn before committing.
14. **No demo-host operation in this sprint.** The first deployed run changes demo data (D1's backlog, D2's stranded
    holds); say so in the PR body. A read-only count beforehand is optional and needs the maintainer's authorization.
15. **`feedback:check` reads `git diff --cached`.** Run it before committing; on a committed branch it is a false green.
16. **After the merge, read master's open code-scanning alerts and the merge-sha analysis.** B3 keeps `api.ts`'s line
    count, but diffs don't predict re-raises. Surface a re-raise to the maintainer; never loop the dismissal API.

---

## Task 1: Branch check, baselines, provisional version

**Files:**
- Modify: `package.json`, `package-lock.json` (the root `"version"` lines only)

- [ ] **Confirm live state.**

```bash
git fetch origin && gh pr list && git log --oneline origin/master -3
git status -sb   # agent/claude/sprint-137-planning, clean, tracking origin
gh run list --workflow expo-sdk-drift.yml --limit 3   # the first scheduled run after #328 (2026-11-05 07:15Z) is green
```

If `origin/master` moved past `f19ca413`, merge it into this branch with a merge commit, never a rebase.

- [ ] **Baselines** (exit codes captured separately, never through `| tail`):
  - `npm test --workspace=services/request-service` and `--workspace=services/cleanup-service`;
  - the two existing scanner gates, green. They are the parity proof for note 4.
    `sprint-132-directed-audience-gate` fails on a **lost** hit (an allowlisted hash with no matching statement) and
    on a **new** one (an unguarded statement). `sprint-135-request-status-gate` asserts the identity of every reviewed
    writer.

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath \
  tests/regression/sprint-132-directed-audience-gate.test.ts tests/regression/sprint-135-request-status-gate.test.ts; echo "exit=$?"
```

- [ ] **Version bump.** Set `package.json` `"version"` and the two root `"version"` fields in `package-lock.json` to
  `11.110.0`. Nothing else in the lock changes.

```bash
node -e "const a=require('./package.json').version,l=require('./package-lock.json');console.log(a,l.version,l.packages[''].version)"
# 11.110.0 11.110.0 11.110.0
git commit -am "chore: v11.110.0 (Sprint 137)"
```

## Task 2: Offer-status gate and scanner table parameter (B4, tests first)

**Files:**
- Modify: `services/request-service/tests/helpers/directedSurfaceScan.ts`
- Create: `services/request-service/tests/tdd/sprint-137-offer-status-gate.test.ts`

- [ ] **Scanner parameter.** Give `scanFile` and `scanServices` an optional last parameter, `table: RegExp =
  /\b(?:requests\.)?help_requests\b/i`, used in place of the literal at line 30. Use no `g` flag, because `.test` must
  not carry `lastIndex`. Callers that pass nothing behave byte-for-byte as before.

- [ ] **Prove the default unchanged.** Re-run Task 1's two gates; both must stay green. Run this **before** any `src/`
  change, so it isolates the scanner edit.

> **Rule for Tasks 4–8 (blocking tiers stay green at every commit).** Unit and regression tests block the push. So a task
> that changes `src/` makes these changes **in the same commit**:
> - it re-pins the directed-surface hashes it invalidates (note 5);
> - it updates every existing unit or regression test that pinned the old behaviour, and only where the new behaviour is
>   the spec's.
>
> Only **request-service's** new `tests/tdd/` files may be red between tasks: its `test` script is
> `test:unit && test:regression`, so the tdd tier there does not block. **Cleanup-service's does block.** Its `test` is
> bare `jest`, and `jest.config.js:10` adds `tests/tdd` (BUG-092). So Task 7's file is run red locally and committed
> only with Task 8, once it is green (Codex finding 3).

- [ ] **Write the gate,** modelled on `tests/regression/sprint-135-request-status-gate.test.ts`.
  - Scan with `/\b(?:requests\.)?help_offers\b/i`.
  - `UPDATE_SET` matches `UPDATE (requests.)?help_offers [alias] SET`.
  - Flag a `SET` that assigns `status` (`'status'`), or contains `${` (`'dynamic'`).
  - Build the `REVIEWED` list from the spec's B4 table. Give each entry a `label` substring that is distinct within its
    file and kind, and a `why`.
  - Two assertions: every live write is reviewed exactly once, and every reviewed entry exists exactly once (identity,
    not a count).
  - Negative fixtures:
    - a literal status write with and without an alias, on one line or many;
    - a dynamic `SET`;
    - a subquery's `status =` that must not count;
    - **two byte-identical release statements in one file** (Codex finding 2). With one reviewed entry for that file,
      the gate must fail, because the entry matches two statements.

    Each fixture must be flagged, or not, exactly as stated.
  - Identity is file + kind + label substring, so two identical statements in one file cannot both be reviewed.
    Today's identical pair is reject's and cancel's offer release (`matches.ts:493`, `:746`, byte-identical). B5
    replaces both with `releaseOffer`, so the reviewed list carries one `releaseOffer` entry and no `matches.ts`
    release entry.
- [ ] **B5's runtime invariant, gated** (Codex re-review). Add two assertions over the live `services/*/src` scan:
  - **One `matched` setter.** Among the reviewed `help_offers` status writes, exactly one assigns `status =
    'matched'`, and it is the `POST /matches` hold (`matches.ts`, label containing `AND status = 'active'`).
  - **One offer-backed insert.** Scan `requests.matches` literals (scanner table parameter
    `/\b(?:requests\.)?matches\b/i`). Exactly one insert is offer-backed: `POST /matches`'s in `matches.ts`. The rule
    **fails closed** (Codex review of `fcec0e28`):
    - **Anchor every occurrence.** Find each `INSERT INTO (requests.)?matches` in the literal, not just the first; a
      CTE can hold several inserts.
    - **Take the column list from the anchor.** Skip whitespace and an optional `AS <alias>` after the table name. The
      next character must be `(`; balance parentheses from that `(`. **Never** use the literal's first `(`: a leading
      CTE (`WITH x AS (…) INSERT …`) or a comment would supply the wrong one.
    - **An insert is offer-backed** when its column list names `offer_id`, when it has **no column list** (`VALUES` or
      `SELECT` straight after the table writes `offer_id` by position), or when the list contains `${` (built at run
      time).
    - A mention of `offer_id` after the list, in `VALUES`, a `SELECT` or `RETURNING`, does not count.

    All five inserts in `services/*/src` on 2026-11-04 name their columns, and only `matches.ts:247-248` names
    `offer_id`. So the strict rule flags nothing today.

  Negative fixtures (each must fail the second assertion, unless stated otherwise):
  - a second `SET status = 'matched'` writer fails the **first** assertion;
  - a second `INSERT INTO requests.matches (request_id, offer_id, …)`;
  - the same insert behind a CTE: `WITH x AS (SELECT 1) INSERT INTO requests.matches (request_id, offer_id) …`;
  - the same insert with an alias: `INSERT INTO requests.matches AS m (request_id, offer_id) …`;
  - an insert with no column list: `INSERT INTO requests.matches VALUES (…)` and `… SELECT …`;
  - an interpolated list: `INSERT INTO requests.matches (${cols}) …`;
  - one literal holding an offer-less insert and then an offer-backed one;
  - **does not fail:** an insert whose column list lacks `offer_id` but whose `RETURNING` names it.

  The scope is `services/*/src` on purpose. Seeds, `scripts/archive/` and test fixtures write at setup, never
  alongside a release (spec B5, *Writers outside the argument*).

- [ ] **Run it.** Before B5 and D exist, the identity cases are **red**:
  - the live `matches.ts` releases match no entry;
  - the `releaseOffer` entry and the two `expirationJob.ts` entries match nothing.

  Everything else is green, including the negative fixtures. Record which cases are red. This file sits in
  request-service's tdd tier, which its `test` script excludes, so committing it red blocks nothing.

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-137-offer-status-gate.test.ts --no-cache
```

- [ ] Commit: `test(B4): help-offer status writers are reviewed (red until D)`.

## Task 3: Request-service contract tests (A, B1, B2, C — red)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-137-exchange-integrity.test.ts`

Copy the mocking harness from `tests/regression/sprint-136-request-followups.test.ts`: the `mockTrace` of `pool` / `tx`
/ `commit` / `publish`, the `withTransaction` mock, the `x-test-user` auth mock, and the `findOwnOffer` /
`getRequestReachability` mocks. Read that file's header: its lock-order paragraph is the checklist for note 2.

- [ ] **A (`PUT /requests/:id`):**
  - the derived status `completed`, then `cancelled` → 409 `REQUEST_CLOSED`, with the exact message; no `UPDATE
    requests.help_requests` was issued; the lock statement ran inside `tx`;
  - `open`, then `matched` → 200; the `UPDATE` ran in `tx` after the lock, and its SQL contains `content_forgotten_at IS
    NULL`;
  - the `UPDATE` returns zero rows → 409 `REQUEST_CLOSED`;
  - a body `status` → still 400 `STATUS_NOT_EDITABLE`, before any `tx` statement;
  - not the requester → still 404, before any `tx` statement.
- [ ] **B1 (`PUT /offers/:id`):**
  - a body `status` from the owner → 400 `STATUS_NOT_EDITABLE`, and no `UPDATE requests.help_offers` was issued;
  - the same body from a non-owner → 404, not 400;
  - a title-only edit → 200, as before.
- [ ] **B2 (`POST /matches`):**
  - `findOwnOffer` returns `{ status: 'active', expired: true }` → 400 `OFFER_NOT_ACTIVE`, with no `tx` statement;
  - the hold SQL contains `expired IS NOT TRUE` and `expires_at > clock_timestamp()`;
  - a hold miss → 400 `OFFER_NOT_ACTIVE`, and no `INSERT INTO requests.matches` was issued.
- [ ] **B5 (release rule):**
  - in match reject and match cancel, the offer release is `releaseOffer`'s exact statement with `[offer_id]`, issued in
    `tx` **after** the match row's own `UPDATE`;
  - no inline `UPDATE requests.help_offers SET status = 'active' WHERE id = $1 AND status = 'matched'` remains;
  - `closeProposals`' offer `UPDATE` (driven through match accept) contains
    `AND NOT (m.request_id = $1 AND m.status = 'proposed')` and still runs before the matches `UPDATE`.
- [ ] **C (`POST /providers/offers`):**
  - `lockRequestForCommitment`'s statements run in `tx` before the duplicate check, and the duplicate check before the
    insert;
  - the lock derives `'expired'`, then `'matched'` → 409 `REQUEST_NOT_OPEN`, with no `INSERT INTO provider.offers` and
    no publish;
  - a duplicate under the lock → 409 `DUPLICATE_OFFER`, with no insert;
  - success → 201, and `publish` comes after `commit` in `mockTrace`.

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-137-exchange-integrity.test.ts --no-cache
```

Expected: A, B1, B2, B5 and C's new cases are red. A test file that cannot compile is not "red"; fix it until each case
fails on its assertion.

- [ ] Commit: `test: Sprint 137 request-service contract (red)`.

## Task 4: A — a completed or cancelled ask can't be edited (BUG-091)

**Files:**
- Modify: `services/request-service/src/routes/requests.ts` (the `router.put('/:id')` at ~1975)

- [ ] Keep the ownership pre-read (404) and the body-`status` refusal (400) first and unchanged. Then:

```ts
const REQUEST_CLOSED = {
  success: false, message: "A completed or cancelled request can't be edited", error: 'REQUEST_CLOSED',
} as const;

// BUG-091: a closed ask is not edited, so nothing is written over a forgotten ask's sentinel (memoryRetentionJob.ts).
const outcome = await withTransaction(async (q) => {
  const status = await lockRequest(q, id);
  if (status === null) return { missing: true as const };
  if (status === 'completed' || status === 'cancelled') return { closed: true as const };
  const result = await q(
    `UPDATE requests.help_requests
     SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND requester_id = $${paramCount + 1} AND content_forgotten_at IS NULL
     RETURNING *`,
    values
  );
  return result.rowCount === 0 ? { closed: true as const } : { row: result.rows[0] };
});
if ('missing' in outcome) return res.status(404).json({ success: false, message: 'Request not found' });
if ('closed' in outcome) return res.status(409).json(REQUEST_CLOSED);
```

  Confirm that `withTransaction` and `lockRequest` are already imported in `requests.ts` (the cancel route uses them).
  Keep the statement's `RETURNING *`: it is `sprint-135-request-status-gate`'s label for this writer.

- [ ] **Re-pin.** This `UPDATE` is allowlisted today. Two `requests.ts` entries share the label `${updates.join(', ')}`:
  this route's, and `PUT /:id/privacy`'s. Replace **only this route's hash**, using `surfaceHash` over the scanned SQL.
  Tell the two apart by which hash stops matching. Never hand-type a hash. `sprint-132-directed-audience-gate` is green
  afterwards.
- [ ] **Fallout.** Existing tests that drive `PUT /requests/:id` against a pool-only mock now need the `withTransaction`
  mock and the lock statements. Today those are `sprint-134-pr-v-read-boundaries.test.ts` and
  `sprint-135-request-status-writers.test.ts`; re-grep at execution.
- [ ] A's cases in Task 3's file are green, and the request-service unit and regression tiers are green.
- [ ] Commit: `fix(requests): a completed or cancelled ask can't be edited (BUG-091)`.

## Task 5: B — an offer's status follows its exchanges (BUG-089)

**Files:**
- Modify: `services/request-service/src/routes/offers.ts`, `services/request-service/src/db/helpOffersDb.ts`,
  `services/request-service/src/routes/matches.ts`, `apps/frontend/src/lib/api.ts`

- [ ] **B1.** In `router.put('/:id')`, after the `findOwnOffer` 404 and before building the update:

```ts
// BUG-089: an offer's status changes through its exchanges (matches.ts, requestStatus.ts), never an edit.
if (status !== undefined) {
  return res.status(400).json({
    success: false,
    message: "An offer's status changes through its exchanges, not an edit",
    error: 'STATUS_NOT_EDITABLE',
  });
}
```

  Delete the `if (status !== undefined) { updates.push(...status...) }` block. `status` is still destructured from the
  body, for the refusal.

- [ ] **B2.**
  - `findOwnOffer` selects `id, status, expired`. Update its doc comment: only the owner sees `status` and `expired`.
  - In `POST /matches`, the fast path becomes
    `if (offerCheck.rows[0].status !== 'active' || offerCheck.rows[0].expired === true) return res.status(400).json(OFFER_NOT_ACTIVE);`
  - The hold becomes:

```sql
UPDATE requests.help_offers SET status = 'matched'
 WHERE id = $1 AND offerer_id = $2 AND status = 'active'
   AND expired IS NOT TRUE AND (expires_at IS NULL OR expires_at > clock_timestamp())
```

  Extend the comment above the transaction: the hold also refuses an expired offer, and the sweep flags only `active`
  offers, so the clock arm covers a held offer that passes expiry.

- [ ] **B3.** In `apps/frontend/src/lib/api.ts`, replace `    status?: string;` inside `updateOffer`'s data type with
  `    // No status: an offer's status follows its exchanges (BUG-089).`. Do this as a one-line in-place change, then
  check:

```bash
git diff --numstat apps/frontend/src/lib/api.ts   # 1	1	apps/frontend/src/lib/api.ts
(cd apps/frontend && npx tsc --noEmit); echo "exit=$?"
```

- [ ] **B5.** In `src/db/requestStatus.ts`:
  - add `releaseOffer(q: TxQuery, offerId: string): Promise<void>`, which runs spec B5's first statement. Its doc
    comment states the rule, the invariant that makes one statement exact (only the hold sets `matched`, and only from
    `active`; among `services/*/src`, only `POST /matches` inserts an offer-backed match; B4 gates both), and that
    the caller must update its own match row
    first;
  - replace `closeProposals`' offer `UPDATE` with spec B5's second statement. Keep offers first, then matches. Extend
    the doc comment: a shared offer stays `matched` while another match holds it (BUG-089's rows).

  In `matches.ts`, reject (~:493) and cancel (~:746) call `await releaseOffer(q, match.offer_id)` inside their existing
  `if (match.offer_id)`, in place of the inline statement. Import `releaseOffer` alongside the existing
  `requestStatus` imports. Re-read both routes first: the match row's `UPDATE` must precede the call (reject ~:480,
  cancel ~:729).
- [ ] **Fallout.**
  - `sprint-136-request-followups.test.ts` asserts the old hold SQL. Update it to the new statement and keep its
    exactness.
  - Sprint 135's `sprint-135-request-status-writers.test.ts` and `sprint-135-request-status-helper.test.ts` (and any
    test that pins the inline release or `closeProposals`' text) update to the new statements, still exactly.
  - Mocks of `findOwnOffer` that return only `status` stay valid, because `expired` is then `undefined`, not `true`.
  - Grep for any test that writes an offer `status` through `PUT /offers/:id`.
- [ ] B1, B2 and B5's cases are green, and the request-service unit and regression tiers are green. Task 2's gate now
  finds the `releaseOffer` entry and no `matches.ts` release; only its two `expirationJob.ts` entries stay red until
  Task 8.
- [ ] Commit: `fix(offers): an offer's status follows its exchanges, an expired offer is not held, and a shared offer is
  released only by its last match (BUG-089)`.

## Task 6: C — a provider offer is written under the request lock (BUG-090)

**Files:**
- Modify: `services/request-service/src/db/providerOffersDb.ts`, `services/request-service/src/routes/providerOffers.ts`

- [ ] `createProviderOffer(q: TxQuery, providerUserId, providerId, requestId, price, note)`. The duplicate check and the
  insert both run on `q`, and the SQL text is unchanged. Import `TxQuery` from `./requestStatus`.
- [ ] In `POST /offers` (mounted at `/providers`), after `validateRequestForOffer`:

```ts
// BUG-090: re-check and insert under the request lock, as POST /matches does (BUG-084), so an ask that closed or
// expired since the fast path is refused. Request-first, like provider-offer accept (offersDb.ts acceptOffer).
const outcome = await withTransaction(async (q) => {
  if ((await lockRequestForCommitment(q, request_id)) !== 'open') return { notOpen: true as const };
  return { offer: await createProviderOffer(q, userId, providerId, request_id, price != null ? Number(price) : null, note ?? null) };
});
if ('notOpen' in outcome) {
  return res.status(409).json({ success: false, message: 'This request is no longer open', error: 'REQUEST_NOT_OPEN' });
}
const offer = outcome.offer;
```

  `DUPLICATE_OFFER` thrown inside the transaction rolls it back. `withTransaction` rethrows it, and the existing catch
  answers 409. The requester lookup and `offer_submitted` stay after the commit.

- [ ] **Fallout.** Grep the request-service tests for `POST /providers/offers` and `createProviderOffer`. Any test that
  drives the route against a pool-only mock now needs the `withTransaction` mock. A directed-surface entry for
  `providerOffers.ts` (the requester lookup) is unaffected unless its SQL text changed.
- [ ] C's cases are green, and the request-service unit and regression tiers are green.
- [ ] Commit: `fix(providers): a provider offer is written under the request lock (BUG-090)`.

## Task 7: D unit tests (red, run locally only; committed with Task 8)

**Files:**
- Create: `services/cleanup-service/tests/tdd/sprint-137-release-expired-holds.test.ts`

- [ ] Mock `../../src/database/db` with both `query` (candidate reads and the four flags) and a default export whose
  `connect()` returns a client with a recording `query` and `release`. Keep implementations in plain functions over
  variables each test sets. Root `resetMocks: true` wipes a module-scope `jest.fn(impl)`.
- [ ] **D1:**
  - for two candidate asks, each gets `BEGIN`, then the lock `SELECT ... FOR UPDATE` with `[id]`, then the
    `help_offers` free, then the `matches` reject, then `COMMIT`, then `release()`, in that order;
  - the free's SQL contains `o.status = 'matched'`, `status = 'proposed' AND offer_id IS NOT NULL` and the shared-offer
    guard `AND NOT (m.request_id = $1 AND m.status = 'proposed')`;
  - nothing in D1 issues an `UPDATE requests.help_requests`.
- [ ] **Skip:** the lock re-check returns zero rows → `ROLLBACK`, no `UPDATE`, `release()`, and the next candidate still
  runs.
- [ ] **Isolation:** the first ask's offer `UPDATE` throws → `ROLLBACK` and an `error` log naming the id; the second
  ask still commits.
- [ ] **D2:** after D1's loop, exactly one autocommit `UPDATE requests.help_offers` through `query` (not a client), with
  `o.status = 'matched'` and `NOT EXISTS ... IN ('proposed', 'matched', 'completed')`. It runs even when D1 had no
  candidates.
- [ ] **Counts:** `releaseExpiredHolds()` returns `{ asksReleased, proposalsClosed, strandedOffersFreed }`.
  `proposalsClosed` sums the committed transactions' row counts only; a skipped or failed transaction adds nothing.
  `strandedOffersFreed` is D2's `rowCount`. Assert exact values.
```bash
npm exec --workspace=services/cleanup-service -- jest --runTestsByPath tests/tdd/sprint-137-release-expired-holds.test.ts --no-cache
```

Expected: red, and every failure is an assertion. **Do not commit.** Cleanup-service's `test` runs this tier
(BUG-092), so a red commit fails `npm test` and the pre-push hook. Keep a byte copy in the scratchpad until Task 8
commits it. The blocking `tests/unit/expirationJob.test.ts` is also updated in Task 8.

## Task 8: D — the sweep releases what an expired ask held (BUG-088)

**Files:**
- Modify: `services/cleanup-service/src/jobs/expirationJob.ts`, `services/cleanup-service/tests/unit/expirationJob.test.ts`,
  `services/request-service/tests/helpers/directedSurfaceAllowlist.json`
- Commit with it: `services/cleanup-service/tests/tdd/sprint-137-release-expired-holds.test.ts` (Task 7)

- [ ] Re-read note 2's lock-order checklist against `matches.ts` (cancel ~:700-760, complete ~:560-600). Record the
  answer in the function's doc comment.
- [ ] Implement:

```ts
import pool, { query } from '../database/db';

/**
 * BUG-088 (Sprint 137): release what an expired ask held.
 * D1. Each flagged open ask with a proposal, in its own transaction: lock the ask, free each offer a proposal holds
 *     (only while 'matched', so a withdrawn offer stays withdrawn, and only when no other match still holds it, since
 *     BUG-089 let one offer back several), then reject the proposals. Text for text request-service's closeProposals
 *     (src/db/requestStatus.ts); keep the two in step. Writes no help_requests row, so the hard-delete clock and the
 *     derived status are unchanged (proposals don't count in the derivation).
 * D2. One statement frees every offer still 'matched' that no proposed, matched or completed match references (a past
 *     hard delete cascaded its proposal away). One statement is exact: only POST /matches's hold sets 'matched', and
 *     only from 'active', so no hold appears on a 'matched' offer while this runs (spec B5).
 * Lock order: D1 request → offers → matches, as accept's closeProposals; D2 only the offer rows it updates.
 */
export async function releaseExpiredHolds(): Promise<{ asksReleased: number; proposalsClosed: number; strandedOffersFreed: number }> {
  let asksReleased = 0, proposalsClosed = 0, strandedOffersFreed = 0;

  const asks = await query(
    `SELECT h.id FROM requests.help_requests h
      WHERE h.expired = TRUE AND h.status = 'open'
        AND EXISTS (SELECT 1 FROM requests.matches m WHERE m.request_id = h.id AND m.status = 'proposed')`
  );
  for (const { id } of asks.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT id FROM requests.help_requests WHERE id = $1 AND expired = TRUE AND status = 'open' FOR UPDATE`, [id]);
      if (locked.rowCount === 0) { await client.query('ROLLBACK'); continue; }
      // Spec B5's guarded closeProposals statement, text for text.
      await client.query(
        `UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP
          WHERE o.status = 'matched'
            AND o.id IN (SELECT offer_id FROM requests.matches
                          WHERE request_id = $1 AND status = 'proposed' AND offer_id IS NOT NULL)
            AND NOT EXISTS (SELECT 1 FROM requests.matches m
                             WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed')
                               AND NOT (m.request_id = $1 AND m.status = 'proposed'))`, [id]);
      const closed = await client.query(
        `UPDATE requests.matches SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
          WHERE request_id = $1 AND status = 'proposed'`, [id]);
      await client.query('COMMIT');
      asksReleased++;
      proposalsClosed += closed.rowCount ?? 0;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      logger.error('Failed to release an expired ask', { request_id: id, error });
    } finally {
      client.release();
    }
  }

  const stranded = await query(
    `UPDATE requests.help_offers o SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE o.status = 'matched'
        AND NOT EXISTS (SELECT 1 FROM requests.matches m
                         WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched', 'completed'))`
  );
  strandedOffersFreed = stranded.rowCount ?? 0;

  logger.info('Released expired holds', { asksReleased, proposalsClosed, strandedOffersFreed });
  return { asksReleased, proposalsClosed, strandedOffersFreed };
}
```

  `markExpiredData` calls `await releaseExpiredHolds();` after the notifications flag and before its final log line.
  Confirm cleanup-service's `db.ts` default export is the `Pool` (`expireDibs.ts` imports it that way).

- [ ] **Unit-test fallout:** update `tests/unit/expirationJob.test.ts` so `markExpiredData` issues the four flag
  `UPDATE`s in their current order and then runs the release. Assert the table order exactly, as today. Do not loosen
  `toHaveBeenCalledTimes` into "at least". The file's `db` mock gains the default export (`connect`).
- [ ] **Re-pin.** D1's candidate read and lock read name `help_requests`, so `sprint-132-directed-audience-gate` now
  names them. Add one `directedSurfaceAllowlist.json` entry for each, with its hash computed by `surfaceHash` over the
  scanned SQL, a `label`, and the reason "Internal expiry mutation, no audience-facing output." D2 needs no entry.
- [ ] Task 7's tests are green. Task 2's gate is now fully green, because both `expirationJob.ts` entries exist exactly
  once. The cleanup-service and request-service unit and regression tiers are green.
- [ ] `(cd services/cleanup-service && npx tsc --noEmit)`, then `npm run lint --workspace=services/cleanup-service`.
- [ ] Commit (with Task 7's test file): `fix(cleanup): the expiration sweep releases what an expired ask held
  (BUG-088)`.

## Task 9: Integration proofs (CI-only)

**Files:**
- Create: `tests/integration/sprint-137-exchange-integrity.integration.test.ts`

- [ ] Start from `tests/integration/sprint-136-request-followups.integration.test.ts`: its users, community, provider
  profile, `bearer()`, cleanup in `afterAll`, the direct import of cleanup-service source, and its `pg_blocking_pids`
  helper. The header lists every proof and says which "fails before" claims are reasoned, not run.
- [ ] Write the spec's *Tests → integration cases*: D1, the D1 race, shared offers, D2, B, C (including the cancel
  race), and A. Specifics:
  - **Shared offers (Codex finding 1):**
    - Insert the fixtures directly with SQL: one `matched` offer referenced by two matches on two asks. After B1, no
      route can build this state.
    - Prove each release path leaves the offer `matched` while the other reference is live: D1 (via
      `markExpiredData()`), match reject, match cancel, and `closeProposals` via match accept.
    - Then end the last reference and prove the offer is freed: by that path, or by D2 on the next sweep.
    - Run each of D1's three variants (the other reference `proposed`, `matched`, `completed`).
  - **D1 release and `updated_at`:** for an ask flagged before the run, read `updated_at` before and after. It must be
    equal.
  - Use fresh `randomUUID()` ids. Cast fixture statuses `$n::varchar`.
  - **No D2 race case.** The earlier draft's race simulated a runtime writer that re-holds a `matched` offer, and none
    exists in `services/*/src` (spec B5; B4 gates it). Its premise is covered by B's cases, where a non-`active` offer
    cannot be held.
- [ ] `npx tsc --noEmit -p tests` (or the workspace's type check) compiles the file. It runs in CI's Integration Tests
  job.
- [ ] Commit: `test(integration): Sprint 137 exchange-integrity proofs`.

## Task 10: Full-suite sweep and promotion

- [ ] Run each changed workspace's full suite: `services/request-service`, `services/cleanup-service`, `apps/frontend`,
  root `tests`. Tasks 4–8 handled their own fallout, so anything red here was missed. Fix a test **only when the new
  behaviour is the spec's**, never by weakening an assertion. `sprint-132-body-identity.test.ts` drives `PUT
  /offers/:id` with titles only, so it should be unaffected.
- [ ] Confirm `directedSurfaceAllowlist.json` holds no stale hash: the directed gate fails on an entry with no matching
  statement.
- [ ] **Promote by targeted `git mv`:** move the three tdd files to their workspace's `tests/regression/`. Do not run
  the promoter.
- [ ] Commit: `test: promote Sprint 137 tests to regression`.

## Task 11: Docs (guides, landing, CONTEXT, BUGS)

**Files:** listed in the spec's *User Guide & Doc Updates*.

- [ ] **Guides:** `fulfilling-requests-guide.md`, `making-requests-guide.md`, `match-lifecycle.md`,
  `your-memory-and-relationships-guide.md` and `using-service-providers-guide.md`, each as the spec says. Use plain
  language and no bug numbers in user-facing text.
- [ ] **Landing:** `npm run build --workspace=apps/landing`, or let `npm test` regenerate it. Revert the timestamp and
  HEAD-sha churn. No new page is expected; if one appears, `git add -f`.
- [ ] **`services/request-service/CONTEXT.md`:**
  - `PUT /requests/:id`;
  - new `PUT /offers/:id` and `DELETE /offers/:id` entries under §3.2;
  - `POST /matches`'s validation and *Write* paragraph (the expiry arms);
  - `POST /providers/offers` (the lock and `REQUEST_NOT_OPEN`);
  - Known Issues → Recent Fixes (§10.4) entries for BUG-088..091.
- [ ] **`services/cleanup-service/CONTEXT.md`:** the expiration job's `releaseExpiredHolds`: D1, D2, the counts it logs,
  and that it runs from the hourly cron and `POST /jobs/mark-expired`.
- [ ] **`docs/BUGS.md`:** BUG-088..091 → `fixed (Sprint 137, v11.110.0)`, each with its commit and covering tests.
  BUG-089 names the B4 gate and the B5 release rule. BUG-092 stays open.
- [ ] Check `apps/frontend/src/lib/onboarding/workflows.ts` for any text that tells a user to edit an offer's status or
  a completed request. Expected: none (no UI changes).
- [ ] Run `npm run feedback:check` **before** committing (note 15).
- [ ] Commit: `docs: Sprint 137 guides, CONTEXT, BUGS`.

## Task 12: SDLC quality gates

- [ ] **`/simplify`** on the branch diff (`origin/master...HEAD`), one pass for this PR. Likely candidates:
  - share `setClauses` / `statusWrites` between the two status gates;
  - share D1's and D2's per-row transaction loop.

  Apply real cleanups and list the skipped suggestions with reasons.
  Verify: the Task 10 suites are still green.
- [ ] **`/code-review high`** on the branch diff. This is a concurrency change in request-service and cleanup-service.
  Fix correctness findings, and log anything deferred as a BUG with a reason.
  Verify: a scoped re-review of the fixes is clean.
- [ ] **`/security-review`** on the branch diff. Check:
  - every refusal order is unchanged where the spec says so (404 before 400 on `PUT /offers/:id` and `PUT
    /requests/:id`);
  - `offerer_id` stays bound in the hold;
  - D2 cannot free an offer that a live or completed match holds, and no release frees a shared offer while another
    match holds it (B5);
  - no new route, dependency or claim read.

  Verify: no High or Medium finding is left unresolved.

## Task 13: Final verification

```bash
npm test; echo "exit=$?"                         # full; capture the exit code separately, never through | tail
npm test --workspace=tests                       # root gates read other workspaces' source
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts
(cd services/request-service && npx tsc --noEmit) && (cd services/cleanup-service && npx tsc --noEmit) && \
  (cd apps/frontend && npx tsc --noEmit)
git diff --numstat origin/master -- apps/frontend/src/lib/api.ts   # 1	1
git status --short                               # clean except reverted landing churn
```

## Task 14: Handoff, push, PR, stop

- [ ] **Update `CURRENT_HANDOFF.md`:** the execution record (task → commits → review), the proofs and the PR number.
  Make *Next unchecked task* the merge, which needs the maintainer's authorization.
- [ ] **Push, then open the PR** against `master`.
  - Title: `fix(requests): expired asks release their holds, offer status follows its exchanges, closed asks can't be
    edited (BUG-088..091, v11.110.0)`.
  - The body says what is bundled: the #328 post-merge record, the Sprint 136 archive, the spec, plan and handoff, the
    BUGS corrections, and A–D.
  - It states that **the first deployed sweep changes demo data** (D1's backlog of proposals on already-flagged asks,
    D2's stranded holds), with the counts in the cleanup-service log.
  - It lists the proofs: the mocked contracts, the offer-status gate with its negative fixtures, the scanner-default
    parity, the shared-offer fixtures, and the integration races.
  - It records the Codex plan review: three findings, all resolved, and the separate-offer-lock suggestion declined
    with its evidence (handoff → *Plan review*).
  - It ends with the attribution line.
- [ ] **Stop.** Do not watch CI or merge in this chat (memory: *Stop after PR creation*). End with the next-chat prompt.

## Task 15: Merge + deploy (the post-merge chat, maintainer-authorized)

- [ ] Merge only with the maintainer's explicit authorization, one merge at a time, after confirming no deploy is in
  flight. The deploy runs through CI/CD (`/deploy` skill for the checks).
- [ ] **Post-merge record** (rides in the next PR; no docs-only master push):
  - CI/CD run, deploy and health verify;
  - the first hourly `markExpiredData` after deploy: `Released expired holds` with its three counts. Reading the demo
    log is a demo-host read; ask first;
  - code-scanning: open alerts on master and the merge-sha analysis (note 16);
  - `deepmerge` #178: re-check by 2026-12-01.
