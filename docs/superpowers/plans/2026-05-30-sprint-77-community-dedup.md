# Community De-duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop the simulation from minting duplicate communities (idempotent `POST /communities` + fix the dead workflow cap), repair the existing 707→~23 duplicated demo DB with an FK/RLS-aware de-dup migration, and remove `@karmyq.test` e2e accounts from the sim actor pool — shipping v10.6.0.

**Architecture:** A new community-identity key `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,''))))` makes creation idempotent (join-if-exists) and is enforced by a partial unique index; a one-time data migration re-parents all `community_id` foreign keys onto the oldest (canonical) row per identity group before deleting the now-empty duplicates.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260530-community-dedup.sql` | One-time FK-discovery-driven re-parent + delete dupes + create partial unique identity index. Supports dry-run via a guard flag/section. |
| `services/community-service/tests/tdd/sprint-77-idempotent-create.test.ts` | TDD: creating an existing community by name+location joins it (returns `existing: true`, no new row); distinct name or location creates new. |
| `services/community-service/tests/unit/communities-identity.test.ts` | Unit: identity-key normalization + canonical-pick (oldest) helper. |
| `docs/adr/ADR-062-community-identity-idempotent-creation.md` | ADR for identity key, idempotent create, unique index, dedup repair strategy. |
| `apps/landing/src/data/docs/concepts/adr-062-community-identity.json` | Landing JSON for ADR-062. |
| `apps/landing/src/data/docs/concepts/community-identity.json` | Concept page: one active community per name+location. |

### Existing files to modify
| File | Change |
|------|--------|
| `services/community-service/src/routes/communities.ts` | `POST /` → look up by identity key; if found, idempotent-join + return `existing:true` (200); else create + `existing:false` (201). Extract identity-key + canonical helpers. |
| `services/simulation-service/src/workflows/create-community-workflow.ts` | Fix the unreachable cap (`limit:11` vs `>=15`); make coherent now that create is idempotent. |
| `services/simulation-service/src/<actor/session loader>` | Exclude `email LIKE '%@karmyq.test'` from the actor pool (locate in Task 5). |
| `services/community-service/CONTEXT.md` | `POST /communities` idempotency; dedup migration + unique index; cap-bug in Recent Fixes. |
| `services/community-service/.../services/registry.json` (root `services/registry.json`) | Update `POST /communities` description if listed. |
| `apps/landing/src/data/docs/services/community-service.json` | Idempotency note + `existing` flag on `POST /communities`. |
| `apps/landing/src/data/docs/nav.json` | Add ADR-062 + community-identity concept entries. |
| `docs/adr/README.md` | Index ADR-062. |
| `package.json` (root) | Version 10.5.0 → 10.6.0. |
| `tests/.../v10-polish` version invariant | Bump expected version if pinned (see note #10). |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Re-parent BEFORE delete.** Nearly every `community_id` FK is `ON DELETE CASCADE`; deleting a dupe before re-parenting cascades away its members/requests/trust edges. Order: build canonical map → re-parent children → recount → delete empty dupes → create unique index.
2. **Migration is FK-discovery-driven**, not a hard-coded table list. Enumerate FK tables referencing `communities.communities(id)` from `pg_constraint`, re-parent each generically with `ON CONFLICT DO NOTHING` where a unique constraint involves `community_id`.
3. **Dry-run first.** Report identity-group count, before/after community count, rows re-parented per table, dup rows skipped. Expect ~707 → ~23. Then run for real in a transaction.
4. **Partial unique index on `status='active'`** — create it only AFTER the dedup DELETE (fails on existing dupes otherwise). Archived/split/fused names must remain re-creatable.
5. **Sim cap bug**: `discoverCommunities({limit:11})` then `>= 15` is unreachable dead code — fix it (Fix-Forward), don't leave it.
6. **`@karmyq.test` filter** goes in actor/session selection, not a workflow.
7. **JWT field is `communities`** (`user.communities ?? []`), never `communityMemberships`.
8. **Schema is `communities.communities`** (plural) — ignore stale `community.*` comments.
9. **Migration runs on the demo server** against `karmyq_prod` — one-time manual dry-run → verify → real run during deploy. `git push` ships only the code.
10. **Version 10.5.0 → 10.6.0**; update the `v10-polish` version invariant test if it pins the number (it broke on the 10.5.0 bump before — commit `d8342be`).

---

## Task 1: Feature branch + identity helpers (TDD first)

**Files:**
- Create: `services/community-service/tests/unit/communities-identity.test.ts`
- Modify: `services/community-service/src/routes/communities.ts` (or a new `src/utils/identity.ts`)

- [ ] Create branch `git checkout -b feature/sprint-77-community-dedup`
- [ ] **Write unit tests FIRST** for an `identityKey(name, location)` helper (lowercases, trims, coalesces null location to `''`) and a `pickCanonical(rows)` helper (returns lowest `created_at`, tie-break lowest `id`).
- [ ] Implement the helpers until tests pass.

```bash
cd services/community-service && npm run test:unit -- communities-identity
```

---

## Task 2: Idempotent `POST /communities` (TDD)

**Files:**
- Create: `services/community-service/tests/tdd/sprint-77-idempotent-create.test.ts`
- Modify: `services/community-service/src/routes/communities.ts`

- [ ] **Write the TDD test FIRST:** posting a name+location that already exists (active) returns `200` with `data.existing === true` and inserts **no** new community row; the caller is upserted as a member. Posting a new name, or same name + different location, creates (`201`, `existing:false`).
- [ ] Implement: before the INSERT (after validation, ~line 385), `SELECT` an active community by identity key. If found:
  - upsert `communities.members (community_id, user_id)` `ON CONFLICT DO NOTHING`; bump `current_members` only if inserted;
  - for `private` matches, skip auto-join and set an approval-required message (defensive);
  - return existing community with `existing: true`, status `200`.
  - If not found, fall through to the existing create path; return `existing: false`, `201`.

```bash
cd services/community-service && npm run test:tdd -- sprint-77-idempotent-create
```

- [ ] Run `/simplify` on the route diff.

---

## Task 3: Fix the simulation create-community cap

**Files:**
- Modify: `services/simulation-service/src/workflows/create-community-workflow.ts`

- [ ] Replace the unreachable cap (`discoverCommunities({limit:11})` + `existing.length >= 15`) with a coherent check — request enough rows (or a count) and pick one cap value. Note in a comment that idempotent create now makes runaway duplication impossible regardless; the cap is just to bound churn.
- [ ] Verify the workflow still type-checks: `cd services/simulation-service && npx tsc --noEmit`.
- [ ] Run `/simplify` on the diff.

---

## Task 4: De-dup data migration (dry-run capable)

**Files:**
- Create: `infrastructure/postgres/migrations/20260530-community-dedup.sql`

- [ ] Write the migration as a single transaction-wrapped script:
  1. Build a temp `canonical_map(dup_id, canonical_id)` from `communities.communities` grouped by identity key, canonical = lowest `created_at` (tie lowest `id`), `status='active'`.
  2. **FK discovery**: query `pg_constraint`/`information_schema` for every table+column with an FK to `communities.communities(id)`. For each, generate an `UPDATE … SET <col> = canonical_id FROM canonical_map WHERE <col> = dup_id` — using `ON CONFLICT DO NOTHING` semantics (delete-conflicting-then-update, or insert-pattern) for tables whose unique constraint involves the column. Do this with a PL/pgSQL `DO` block iterating the discovered list, or an explicit ordered list generated from the discovery query.
  3. For 1:1 tables (`community_configs`, `community_trust_scores`): keep canonical's row, delete dup rows.
  4. Recompute `current_members` on canonical rows.
  5. `DELETE FROM communities.communities WHERE id IN (SELECT dup_id FROM canonical_map)`.
  6. `CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_identity_active …` (partial on `status='active'`).
- [ ] Add a dry-run mode: guard the mutations behind a `\set dryrun` psql var or a leading `BEGIN; … ROLLBACK;` variant, and emit `RAISE NOTICE` counts (groups, before/after, per-table re-parent counts, skipped-on-conflict).
- [ ] **Validate with the migration-validator agent** (cross-schema FK, `IF NOT EXISTS` guards, schema ownership) before considering it done.

```bash
# Local dry-run against a dockerized DB if available; otherwise validated structurally + run on demo in Task 11
cat infrastructure/postgres/migrations/20260530-community-dedup.sql
```

- [ ] Run `/simplify` on the migration.

---

## Task 5: Filter `@karmyq.test` from the sim actor pool

**Files:**
- Modify: simulation-service actor/session loader (locate via grep for where users are fetched for the pool)

- [ ] Grep the simulation service for where actor accounts are loaded (e.g. a `SELECT … FROM auth.users` or an API call building the session pool).
- [ ] Exclude `email LIKE '%@karmyq.test'` so the 5 e2e fixture accounts never receive sim workflows.
- [ ] Add/extend a unit test asserting the pool excludes `@karmyq.test` addresses.

```bash
cd services/simulation-service && npm run test:unit
```

- [ ] Run `/simplify` on the diff.

---

## Task 6: ADR-062 + concept page + landing docs

**Files:**
- Create: `docs/adr/ADR-062-community-identity-idempotent-creation.md`
- Modify: `docs/adr/README.md`
- Create: `apps/landing/src/data/docs/concepts/adr-062-community-identity.json`, `apps/landing/src/data/docs/concepts/community-identity.json`
- Modify: `apps/landing/src/data/docs/nav.json`, `apps/landing/src/data/docs/services/community-service.json`

- [ ] Write ADR-062 (identity key, idempotent create, partial unique index, re-parent-then-delete repair strategy, status `Implemented`). Index it in `docs/adr/README.md`.
- [ ] Create the landing ADR JSON + concept JSON; add both to nav.json ("Architecture Decisions" + "Concepts").
- [ ] Update `community-service.json` `POST /communities` description (idempotent; `existing` flag).
- [ ] Run generate-docs from `apps/landing/` and **grep-verify nav.json kept the new entries** (nav.json revert bug); re-apply if reverted. `git add -f` the landing docs (gitignored).

```bash
cd apps/landing && npm run generate-docs
grep -E "adr-062|community-identity" apps/landing/src/data/docs/nav.json
```

---

## Task 7: CONTEXT.md + registry + service docs

**Files:**
- Modify: `services/community-service/CONTEXT.md`, `services/registry.json`, simulation-service `.claude/README.md`/`CONTEXT.md`

- [ ] community-service CONTEXT.md: `POST /communities` idempotency under "API Endpoints"; dedup migration + unique index under "Database Schema"; cap-bug + idempotency under "Recent Fixes".
- [ ] `services/registry.json`: update `POST /communities` description if listed.
- [ ] simulation-service docs: note the `@karmyq.test` actor filter + corrected cap.

```bash
npm run feedback:check
```

---

## Task 8: SDLC quality gates

- [ ] **Testing**: `npm test` (unit + regression) green; `npm run test:tdd` reports the new test passing.
- [ ] **`/simplify`** — final pass over the whole branch diff (per-task simplify already done).
- [ ] **`/code-review`** on the branch diff — resolve correctness findings (esp. migration re-parent ordering, conflict handling, the idempotent-join membership-count bump).
- [ ] **`/security-review`** on the branch diff — resolve real findings (SQL built from `pg_constraint` discovery must use identifiers safely; no untrusted input in the migration). Justify dismissals in writing.

```bash
npm test && npm run test:tdd
```

---

## Task 9: Final type check + pre-push verification

- [ ] `npx tsc --noEmit` in changed services (community-service, simulation-service).
- [ ] Bump root `package.json` 10.5.0 → 10.6.0; update the `v10-polish` version invariant test if pinned.
- [ ] `npm test` && `npm run feedback:check` && `npm audit --package-lock-only --audit-level=high` all green.

```bash
npm test && npm run feedback:check && npm audit --package-lock-only --audit-level=high
```

---

## Task 10: Merge + Deploy (code) — use the `/deploy` skill

- [ ] Merge `feature/sprint-77-community-dedup` → master, push, monitor GitHub Actions to green.
- [ ] Confirm community-service + simulation-service redeploy on karmyq.com and `/health` is green.

---

## Task 11: Run the data repair on the demo DB (manual, deliberate)

> This is the one-time 707→~23 repair. The code deploy (Task 10) only stops *new* duplicates; this fixes the existing ones.

- [ ] SSH to karmyq.com. Take a DB snapshot/dump of `karmyq_prod` first (rollback safety).
- [ ] Run the migration in **dry-run** mode; verify the NOTICE counts (~707 communities → ~23 groups; per-table re-parent counts look sane; no unexpected zero-row tables).
- [ ] Run the migration **for real** inside the transaction.
- [ ] **Verify**: `SELECT COUNT(*), COUNT(DISTINCT (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,''))))) FROM communities.communities WHERE status='active';` → counts converge (~23/23). Spot-check that "PDX Service Providers Network" is now a single row with consolidated members + requests. Confirm the unique index exists.
- [ ] Browse the demo UI: communities now show consolidated membership/activity, not empty shells.
- [ ] Update the handoff: Sprint 77 complete + deployed + DB repaired.
