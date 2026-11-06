# Sprint 138 Reusable Standing Offers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A standing help offer is reusable: completing an exchange frees its offer, offers stuck behind past
completions are freed by the next sweep, a freed offer past its expiry is flagged at once, expired offers leave the
`/offers` list, and offer releases are indexed (BUG-093, 094, 095, 096).

**Architecture:**
- One release rule changes in its four copies: the hold set drops `completed` and every free flags expiry. The copies
  are `releaseOffer` and `closeProposals` in request-service, and D1 and D2 in cleanup-service.
- `PUT /matches/:id/complete` calls the existing `releaseOffer` when the exchange finishes, `GET /offers` gains an expiry
  filter, and one migration adds a partial index on `requests.matches(offer_id)`.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** [`docs/superpowers/specs/2026-11-06-sprint-138-reusable-standing-offers-design.md`](../specs/2026-11-06-sprint-138-reusable-standing-offers-design.md)

**Branch:** `agent/claude/sprint-138-planning`. Execution continues on it, and the one PR opens from it. It already
carries the Sprint 137 archive and #330 post-merge record, this spec, plan and handoff, and the BUG-096 entry.

**Version:** 11.110.0 → 11.111.0, **provisional**: re-derive from `origin/master`'s `package.json` at merge time.

**Rules (maintainer):**
- No demo-host operation, merge, ADR number, dismissal or dependency work without explicit per-operation authorization.
  No ADR is needed. #329 stays open.
- Push, and leave the tree clean, at every stopping point. **Stop at PR creation.**

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `services/request-service/tests/tdd/sprint-138-reusable-offers.test.ts` | Mocked-SQL contract: completion frees the offer; the new release SQL; `GET /offers` expiry filter |
| `infrastructure/postgres/migrations/20261106-matches-offer-id-index.sql` | BUG-095 partial index |
| `tests/integration/sprint-138-reusable-offers.integration.test.ts` | Real-SQL proofs (CI-only) |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/db/requestStatus.ts` | `releaseOffer`, `closeProposals`: hold set `('proposed', 'matched')`; SET flags expiry; doc comments |
| `services/cleanup-service/src/jobs/expirationJob.ts` | D1 (text for text `closeProposals`), D2 (`releaseOffer` minus scope); doc comment |
| `services/request-service/src/routes/matches.ts` | `PUT /:id/complete`: `releaseOffer` after `reconcileRequestStatus` when finished |
| `services/request-service/src/routes/offers.ts` | `GET /`: expiry filter |
| `tests/regression/sprint-137-release-sql-parity.test.ts` | New hold set; SET-clause parity check; flipped reference guard |
| `tests/regression/sprint-120-init-sql-drift-gate.test.ts` | Asserts `idx_matches_offer_id` |
| `infrastructure/postgres/init.sql` | **Regenerated** (never hand-edited) |
| Exact-contract fallout (spec *Tests*) | Hold-set/SET literals in cleanup and request regression tests; the offer-status gate's `why` text |
| `tests/integration/sprint-137-exchange-integrity.integration.test.ts` | Flip the `completed` variants to the new rule |
| `docs/guides/fulfilling-requests-guide.md`, `docs/guides/match-lifecycle.md` | Spec *User Guide & Doc Updates* |
| `services/request-service/CONTEXT.md`, `services/cleanup-service/CONTEXT.md`, `docs/BUGS.md` | Endpoints, job, Recent Fixes; BUG-093..096 fixed |
| `apps/landing/src/data/docs/**` | Regenerated |
| `package.json`, `package-lock.json` | The three root version fields only |
| `.claude/handoff/CURRENT_HANDOFF.md` | Execution record |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **One release rule, four copies, one commit.** `releaseOffer`, `closeProposals` (request-service
   `src/db/requestStatus.ts`), D1 and D2 (cleanup-service `src/jobs/expirationJob.ts`) change together, in the same
   commit as `tests/regression/sprint-137-release-sql-parity.test.ts`. The parity gate fails on any commit where they
   differ. D1 stays text for text `closeProposals`; D2 stays `releaseOffer` minus `o.id = $1 AND`.
2. **Keep every Sprint 137 guard.** Each release stays one guarded statement: `o.status = 'matched'`, the `NOT EXISTS`
   hold set, the same-request exclusion in `closeProposals`/D1, and the distinct scalar CTID version predicate (I1).
   Never add `FOR UPDATE` or persist a CTID.
3. **Completion lock order is match → request → offer**, the same as cancel (`matches.ts` cancel, ~:700-760, and the
   lock-order note in `expirationJob.ts`'s doc comment). Call `releaseOffer` after `reconcileRequestStatus`, inside the
   transaction, only when the exchange just finished. Re-read cancel and confirm no `help_offers` writer holds an offer
   lock and then waits on the request lock.
4. **Decide before the first write** stays true: completion's refusals (404, 409 `MATCH_NOT_COMPLETABLE`, the
   idempotent answer) return before any release.
5. **The expiry expression** is `o.expired IS TRUE OR (o.expires_at IS NOT NULL AND o.expires_at <= clock_timestamp())`
   in the releases (after lock waits), and `o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW())`
   in the `GET /offers` read. `expired` is nullable: `IS TRUE`/`IS NOT TRUE`.
6. **No new status writer.** The offer-status gate (`sprint-137-offer-status-gate.test.ts`) keeps its writer labels; only
   `releaseOffer`'s `why` text changes. Prove the gate still passes, and that it fails on an injected extra writer.
7. **Exact-contract fallout lands with its source.** Tests that pin the hold-set literal or the SET clause (the list in
   *Tests*) change in the same commit as the statements. Grep `'proposed', 'matched', 'completed'` and
   `SET status = 'active', updated_at` across `services/*/src`, `services/*/tests` and `tests/` before and after.
8. **The directed-surface allowlist is unaffected** (no `help_requests` literal changes); `sprint-132-directed-audience-gate`
   and `sprint-135-request-status-gate` must stay green with no hash change.
9. **Migration:** `IF NOT EXISTS`, partial, plain `CREATE INDEX` (decision P4). Review it with the
   `migration-validator` agent. Regenerate `init.sql` with `REGEN_PG_CONTAINER` (Mac checkout, or an authorized
   disposable demo-host container); never hand-edit it. The drift gate asserts the index.
10. **Real-SQL proofs are CI-only** (no PostgreSQL on the Windows box). Prove waits with `pg_blocking_pids`, never a
    sleep. Use fresh `randomUUID()` ids and `$n::varchar` status casts. Sprint 137's integration `completed` variants
    flip to the new rule in this sprint, with the reason in a comment.
11. **Tests first.** Request-service red tests go in `services/request-service/tests/tdd/` and may be committed red
    (its `test` is unit + regression). Cleanup-service's `test` runs its tdd tier (BUG-092), so its changes are edits
    to the existing regression test, committed with the implementation. Promote with a targeted `git mv`, never the
    promoter.
12. **`npm test` regenerates landing docs**; revert timestamp/HEAD-sha churn. **`feedback:check` reads
    `git diff --cached`**: run it staged.
13. **Identity is `req.user!.userId`** (ADR-064); no route reads the JWT `communities` claim.
14. **The first deployed sweep changes demo data** (decision 3). Say so in the PR body. A read-only count beforehand,
    and reading the first `Released expired holds` line afterwards, are demo-host reads: each needs authorization.

---

## Task 1: Branch check, baselines, provisional version

**Files:**
- Modify: `package.json`, `package-lock.json` (root version fields only)

- [ ] `git fetch origin`; `git status --short --branch` is clean on `agent/claude/sprint-138-planning`;
  `git log --oneline origin/master -1` is `17e453f8` (if master moved, merge it in with a merge commit, never rebase).
- [ ] Baselines, each with its exit code captured (never through `| tail`):

```bash
npm test --workspace=services/request-service; echo "exit=$?"
npm test --workspace=services/cleanup-service; echo "exit=$?"
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-137-release-sql-parity.test.ts --no-cache; echo "exit=$?"
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/regression/sprint-137-offer-status-gate.test.ts tests/regression/sprint-132-directed-audience-gate.test.ts tests/regression/sprint-135-request-status-gate.test.ts --no-cache; echo "exit=$?"
```

- [ ] Bump the three root version fields to `11.111.0` (`package.json` `version`; `package-lock.json` `version` and
  `packages[""].version`). Prove nothing else in the lock moved: `git diff --stat package-lock.json` shows 2 lines.
- [ ] Commit: `chore: v11.111.0 (Sprint 138)`.

## Task 2: Request-service contract tests (red)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-138-reusable-offers.test.ts`

- [ ] Follow `services/request-service/tests/regression/sprint-137-exchange-integrity.test.ts`'s harness: mock only the
  SQL, auth, ownership and transport boundaries; record every statement in order. Root jest `resetMocks: true` wipes a
  module-scope `jest.fn(impl)`, so set behaviour in `beforeEach`.
- [ ] **A (completion):**
  - the final done mark runs, inside one `withTransaction` and in this order: the done-mark UPDATE, the
    `status = 'completed'` UPDATE, the request lock, the reconcile UPDATE, then the `releaseOffer` UPDATE with
    `[offer_id]`;
  - a first done mark (only one side done) issues no `UPDATE requests.help_offers`;
  - a match with `offer_id = null` issues none;
  - `match_completed` is published after the commit, as today;
  - the refusals (404, 409 `MATCH_NOT_COMPLETABLE`, the idempotent already-completed answer) issue no
    `UPDATE requests.help_offers`.
- [ ] **The release SQL (A, B):** `releaseOffer`'s and `closeProposals`' offer UPDATEs contain
  `m.status IN ('proposed', 'matched')`, do not contain `'completed'` in the hold set, and their SET clause is exactly
  `SET status = 'active', expired = (o.expired IS TRUE OR (o.expires_at IS NOT NULL AND o.expires_at <= clock_timestamp())), updated_at = CURRENT_TIMESTAMP`
  (compare on whitespace-normalized text). Write the expected literals independently, from the spec, not imported
  from production.
- [ ] **C (`GET /offers`):** the list SQL contains both `o.expired IS NOT TRUE` and
  `(o.expires_at IS NULL OR o.expires_at > NOW())`, still contains the `offerReadableSql` boundary, and keeps
  `[status, viewerId, …]` as its leading params. A `status=withdrawn` request carries the same filter.
- [ ] Run red:

```bash
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/tdd/sprint-138-reusable-offers.test.ts --no-cache; echo "exit=$?"
```

  Expected: red, every failure an assertion (no compile errors), and the controls (refusal paths, event timing) green.
  Request-service's `test` is unit + regression, so this red tdd file may be committed.
- [ ] Commit: `test: Sprint 138 request-service contract (red)`.

## Task 3: One release rule — hold set and expiry flag in all four statements (BUG-093 rule, BUG-094)

**Files:**
- Modify: `services/request-service/src/db/requestStatus.ts`, `services/cleanup-service/src/jobs/expirationJob.ts`,
  `tests/regression/sprint-137-release-sql-parity.test.ts`, and the exact-contract fallout (note 7)

- [ ] `releaseOffer` becomes:

```ts
export async function releaseOffer(q: TxQuery, offerId: string): Promise<void> {
  await q(
    `UPDATE requests.help_offers o SET status = 'active', expired = (o.expired IS TRUE OR (o.expires_at IS NOT NULL AND o.expires_at <= clock_timestamp())), updated_at = CURRENT_TIMESTAMP
     WHERE o.id = $1 AND o.status = 'matched'
       AND NOT EXISTS (SELECT 1 FROM requests.matches m
                        WHERE m.offer_id = o.id AND m.status IN ('proposed', 'matched'))
       AND o.ctid = (SELECT visible_offer.ctid FROM requests.help_offers visible_offer WHERE visible_offer.id = o.id)`,
    [offerId]
  );
}
```

- [ ] `closeProposals`' offer UPDATE gets the same SET clause and the hold set `IN ('proposed', 'matched')`, keeping
  `AND NOT (m.request_id = $1 AND m.status = 'proposed')` and the CTID predicate. Its match UPDATE is unchanged.
- [ ] D1's offer UPDATE is the new `closeProposals` statement text for text. D2 is the new `releaseOffer` with only
  `o.id = $1 AND ` removed. Both keep their cross-reference comments.
- [ ] Update every doc comment that says "proposed, matched or completed" (`requestStatus.ts`, `expirationJob.ts`) to the
  new rule, citing BUG-093.
- [ ] **Parity gate** (`tests/regression/sprint-137-release-sql-parity.test.ts`):
  - the reference guard asserts the hold set is `m.status IN ('proposed', 'matched')` and contains no `'completed'`;
  - the hold-set drift negative case re-adds `'completed'` to one side and must be reported;
  - `HOLD_TAIL` becomes `'proposed', 'matched'))`; count its occurrences per file first (it must stay exactly one per
    file, or anchor more tightly);
  - **new check:** the SET clause (statement text up to ` WHERE `) is identical in all four statements, with a negative
    case that drifts `closeProposals`' SET and is reported. D2's whole-statement check already covers D2.
- [ ] **Fallout** (note 7): update every pinned literal the spec lists, after re-grepping. Then:

```bash
npm test --workspace=services/request-service; echo "exit=$?"
npm test --workspace=services/cleanup-service; echo "exit=$?"
npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-137-release-sql-parity.test.ts --no-cache; echo "exit=$?"
npm exec --workspace=services/request-service -- jest --runTestsByPath tests/regression/sprint-137-offer-status-gate.test.ts tests/regression/sprint-132-directed-audience-gate.test.ts tests/regression/sprint-135-request-status-gate.test.ts --no-cache; echo "exit=$?"
```

  All exit 0. The directed and request-status gates need no hash change.
- [ ] Task 2's release-SQL cases are green. Its completion and `GET /offers` cases stay red until Tasks 4–5.
- [ ] `(cd services/request-service && npx tsc --noEmit)`; `(cd services/cleanup-service && npx tsc --noEmit)`;
  `npm run lint --workspace=services/cleanup-service`.
- [ ] Commit: `fix(offers): a completed exchange no longer holds its offer, and a freed offer past expiry is flagged (BUG-093, BUG-094)`.

## Task 4: Completing an exchange frees its offer (BUG-093)

**Files:**
- Modify: `services/request-service/src/routes/matches.ts`

- [ ] Re-read note 3's lock-order check against cancel. In `PUT /:id/complete`, inside the transaction's `if (finished)`
  block, after `reconcileRequestStatus(q, match.request_id)`:

```ts
// BUG-093 (Sprint 138): a standing offer is reusable. The match is completed and no longer holds its offer, so free
// it unless another proposed or matched exchange still does. Match → request → offer, the same order as cancel.
if (match.offer_id) await releaseOffer(q, match.offer_id);
```

  Import `releaseOffer` from `../db/requestStatus` if it isn't already imported.
- [ ] **Fallout:** the request-service tests that drive `/complete` (grep, 2026-11-06):
  `tests/regression/two-phase-completion.test.ts`, `sprint-83-match-action-auth.test.ts`,
  `sprint-134-bug-074-match-status-guards.test.ts`, `sprint-135-request-status-writers.test.ts`,
  `sprint-137-exchange-integrity.test.ts`. Where one records statements, add the expected `releaseOffer` statement
  after the final mark's reconcile. Never loosen an exact count. Re-grep before editing.
- [ ] Task 2's completion cases are green; request-service unit + regression green; typecheck clean.
- [ ] Commit: `feat(matches): completing an exchange frees its standing offer (BUG-093)`.

## Task 5: `GET /offers` hides expired offers (BUG-096)

**Files:**
- Modify: `services/request-service/src/routes/offers.ts`

- [ ] In `GET /`, after `AND ${offerReadableSql('o', '$2')}`, add:

```sql
        AND o.expired IS NOT TRUE
        AND (o.expires_at IS NULL OR o.expires_at > NOW())
```

  Params, filters, ordering, paging and the response are unchanged. `GET /:id` is unchanged.
- [ ] **Fallout:** the request-service tests that read the offers list SQL (grep, 2026-11-06):
  `tests/regression/sprint-133-pr-v-read-boundary.test.ts`, `sprint-133-request-detail-visibility.test.ts`. Update exact
  literals only where they pin this statement; re-grep before editing.
  The directed-surface gate needs no change (the statement names no `help_requests`).
- [ ] Task 2 is fully green; request-service unit + regression green.
- [ ] Commit: `fix(offers): the offers list hides expired offers (BUG-096)`.

## Task 6: Index the offer-release lookup (BUG-095)

**Files:**
- Create: `infrastructure/postgres/migrations/20261106-matches-offer-id-index.sql`
- Modify: `infrastructure/postgres/init.sql` (regenerated), `tests/regression/sprint-120-init-sql-drift-gate.test.ts`

- [ ] Write the migration exactly as the spec's section D gives it.
- [ ] Review it with the `migration-validator` agent (`.claude/agents/migration-validator.md`). Resolve findings.
- [ ] **Regenerate `init.sql`** (`scripts/regenerate-init-sql.sh` needs `REGEN_PG_CONTAINER`, a dedicated PostgreSQL
  15 container, `:108-137`). On the Windows box there is no Docker, so either:
  - run it on the Mac checkout (pull this branch, run, review, commit, push), or
  - **ask the maintainer to authorize** a disposable PostgreSQL 15 container on the demo host, run the script there,
    and copy `init.sql.generated` back — the Sprint 134 L2 precedent
    (`docs/superpowers/plans/2026-10-27-sprint-134-pr-l2-drop-feedback-schema.md:78`). Remove the container afterwards.

  Review the generated diff: it adds exactly the index (and the migration-ledger row the script records) and nothing
  else. Then promote `init.sql.generated` to `init.sql`.
- [ ] Add a drift-gate case to `sprint-120-init-sql-drift-gate.test.ts` asserting `init.sql` contains the index name
  and its `WHERE (offer_id IS NOT NULL)` predicate, matching the generated text exactly.
- [ ] `npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-120-init-sql-drift-gate.test.ts --no-cache`.
- [ ] Commit: `fix(db): index matches.offer_id for the offer-release guards (BUG-095)`.

## Task 7: Integration proofs (CI-only)

**Files:**
- Create: `tests/integration/sprint-138-reusable-offers.integration.test.ts`
- Modify: `tests/integration/sprint-137-exchange-integrity.integration.test.ts`

- [ ] Start from the Sprint 137 integration file: its users, community, `bearer()`, `call`, fixtures, `afterAll`
  cleanup in FK order, and the direct import of cleanup-service source. Read `tests/claude.md`.
- [ ] Write the spec's integration cases (*Tests*, the new file's row). Specifics:
  - completion goes through both real HTTP done marks (`PUT /matches/:id/complete` as requester and as helper);
  - reuse: the freed offer backs a new `POST /matches` on a second ask, that exchange completes, and the offer is
    freed again (one offer, two completed matches);
  - history: insert a `matched` offer whose only reference is a `completed` match directly with SQL (no route can build
    it now), then `markExpiredData()` frees it;
  - expiry flag: for completion, reject and D2, an offer whose `expires_at` is in the past is freed with
    `expired = TRUE` by the same statement (read it back right after the call, before any hourly job);
  - `GET /offers` hides an offer with `expired = TRUE`, hides an unflagged offer whose `expires_at` has passed, and
    lists an unexpired one;
  - the index: `SELECT indexdef FROM pg_indexes WHERE schemaname = 'requests' AND indexname = 'idx_matches_offer_id'`
    contains `(offer_id)` and `WHERE (offer_id IS NOT NULL)`.
- [ ] **Flip Sprint 137's `completed` variants** (the shared-offer `it.each(['proposed', 'matched', 'completed'])` at
  ~:500, and any D2 case with a completed reference): a completed reference no longer holds, so those variants now
  expect the offer freed. Leave a one-line comment naming BUG-093 / Sprint 138.
- [ ] Type-check the two files in isolation (extend `tests/tsconfig.json` with a scratch `files` list), exit 0;
  `tsc -p tests` keeps only its pre-existing errors.
- [ ] Commit: `test(integration): Sprint 138 reusable-offer proofs`.

## Task 8: Full-suite sweep and promotion

- [ ] Run each changed workspace's full suite: `services/request-service`, `services/cleanup-service`, root `tests`
  (and `apps/frontend` only if a frontend file changed; none is planned). Fix a test only where the new behaviour is
  the spec's, never by weakening an assertion.
- [ ] **Promote by targeted `git mv`:** `services/request-service/tests/tdd/sprint-138-reusable-offers.test.ts` →
  `services/request-service/tests/regression/`. Do not run the promoter.
- [ ] Commit: `test: promote Sprint 138 tests to regression`.

## Task 9: Docs (guides, landing, CONTEXT, BUGS)

**Files:** listed in the spec's *User Guide & Doc Updates*.

- [ ] **Guides:** `fulfilling-requests-guide.md` (lines ~39, ~61, ~63) and `match-lifecycle.md` (~51, ~63), as the spec
  says. Plain language; no bug numbers or internal names in user-facing text.
- [ ] **Landing:** `npm run generate-docs --workspace=apps/landing`. Stage regenerated pages for changed sources with
  `git add -f`; revert timestamp/HEAD-sha/adr-010 churn. No new page expected.
- [ ] **`services/request-service/CONTEXT.md`:** `PUT /matches/:id/complete`, `GET /offers`, the release rule, Recent
  Fixes for BUG-093..096. **Put each endpoint description on one line**: the landing generator takes only the first
  non-empty line (`scripts/generate-docs.ts:63-76`).
- [ ] **`services/cleanup-service/CONTEXT.md`:** D1/D2 hold set, expiry flag on free, D2's first run frees history.
- [ ] **`docs/BUGS.md`:** BUG-093..096 → `fixed (Sprint 138, v11.111.0)`, each with its commit and covering tests.
- [ ] Check `apps/frontend/src/lib/onboarding/workflows.ts` for text saying an offer is used once (expected: none).
- [ ] `npm run feedback:check` with the docs staged.
- [ ] Commit: `docs: Sprint 138 guides, CONTEXT, BUGS`.

## Task 10: SDLC quality gates

- [ ] **`/simplify`** on the branch diff (`origin/master...HEAD`), one pass. Apply real cleanups; list skipped
  suggestions with reasons. Verify: Task 8's suites still green.
- [ ] **`/code-review high`** on the branch diff (the release rule and completion path are concurrency-adjacent). Fix
  correctness findings; log anything deferred as a BUG with a reason. Verify: a scoped re-review of the fixes is clean.
- [ ] **`/security-review`** on the branch diff. Check:
  - completion's refusal order and idempotent answer are unchanged, and only a participant's final mark frees;
  - `releaseOffer` still frees only `matched` offers no live exchange uses (a withdrawn offer stays withdrawn);
  - `GET /offers` keeps `offerReadableSql`, and its filter adds no parameter from the request;
  - no new route, dependency or claim read.

  Verify: no High or Medium finding left unresolved.

## Task 11: Final verification

```bash
npm test; echo "exit=$?"                         # full; capture the exit code separately, never through | tail
npm test --workspace=tests                       # root gates read other workspaces' source
npm exec --workspace=tests -- jest --runTestsByPath regression/doc-context-drift-gate.test.ts regression/sprint-137-release-sql-parity.test.ts regression/sprint-120-init-sql-drift-gate.test.ts
(cd services/request-service && npx tsc --noEmit) && (cd services/cleanup-service && npx tsc --noEmit)
git status --short                               # clean except reverted landing churn
```

## Task 12: Handoff, push, PR, stop

- [ ] **Update `CURRENT_HANDOFF.md`:** the execution record (task → commits → review), the proofs, and *Next unchecked
  task* = the merge, which needs the maintainer's authorization.
- [ ] **Push, then open the PR** against `master`.
  - Title: `feat(offers): standing offers are reusable after an exchange completes; expired offers leave the list (BUG-093..096, v11.111.0)`.
  - The body bundles the Sprint 137 archive and #330 post-merge record, this spec, plan and handoff, the BUG-096 entry,
    and A–D. It uses `.github/pull_request_template.md`'s required sections.
  - It states that **the first deployed sweep frees history** (count in the cleanup log's `strandedOffersFreed`;
    reading it is a demo-host read), and that freed offers past their expiry then follow the 7-day delete clock, with
    their completed matches keeping `offer_id = NULL`.
  - It ends with the attribution line.
- [ ] **Stop.** Do not watch CI or merge in this chat. End with the next-chat prompt.

## Task 13: Merge + deploy (the post-merge chat, maintainer-authorized)

- [ ] Merge only with the maintainer's explicit authorization, one merge at a time, after confirming no deploy is in
  flight. CI/CD deploys it; `scripts/deploy.sh` applies the migration (`scripts/apply-migrations.sh`).
- [ ] **Post-merge record** (rides in the next PR; no docs-only master push): CI/CD + health; the migration applied
  (`[OK] 20261106-matches-offer-id-index.sql` in the deploy log); code scanning on master and the merge-sha analysis;
  the first hourly `Released expired holds` line (a demo-host read: ask first); #178 by 2026-12-01.
