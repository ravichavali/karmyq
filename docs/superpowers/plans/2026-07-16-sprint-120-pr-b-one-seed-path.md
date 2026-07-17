# Sprint 120 PR B: One Seed Path (init.sql Regeneration) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Regenerate `infrastructure/postgres/init.sql` from the fully-migrated schema so every
fresh install (local docker-compose, CI, new envs) gets ONE converged seed path; record as ADR-087.

**Architecture:** A scripted, repeatable regeneration (`scripts/regenerate-init-sql.sh`) run via a
manual-dispatch GitHub Actions workflow (Docker is unavailable locally): scratch postgres →
current init.sql → full migration chain → `pg_dump --schema-only` → post-process → splice curated
seed section + `schema_migrations` backfill → artifact. `ci-apply-full-schema.sh` inverts from
convergence workaround to drift guard.

**Tech Stack:** PostgreSQL 15, bash, GitHub Actions.

**Version:** v11.30.0 → v11.31.0 · **Branch:** `feature/sprint-120-one-seed-path` (off
`origin/master`, after PR A merges)

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `scripts/regenerate-init-sql.sh` | The regeneration pipeline (dump, post-process, splice, backfill) |
| `.github/workflows/regenerate-init-sql.yml` | Manual-dispatch workflow: postgres service, run script, upload artifact |
| `docs/adr/ADR-087-one-seed-path-init-sql-regeneration.md` | The decision record |
| `apps/landing/src/data/docs/concepts/adr-087-one-seed-path-init-sql-regeneration.json` | Landing ADR JSON |
| `tests/regression/sprint-120-init-sql-drift-gate.test.ts` | Textual sentinels on init.sql (see Task 6) |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | REPLACED by generated output (fenced generated section + curated seed section + schema_migrations backfill) |
| `scripts/ci-apply-full-schema.sh` | Header comment rewritten to drift-guard role; keep sentinels + zero-genuinely-new gate |
| `docs/adr/README.md` | ADR-087 index entry |
| `apps/landing/src/data/docs/nav.json` | ADR-087 entry (grep-verify after regen) |
| `infrastructure/postgres/migrations/MIGRATION_STRATEGY.md` + `README.md` | Regeneration workflow documented |
| `docs/IDEAS.md` | 2026-07-08 init.sql entry → addressed note |
| `package.json` | v11.31.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Copied from the spec — items 6–9, 11 apply to this PR:

1. **Docker is unavailable locally** — the regen runs in a manual-dispatch GitHub Actions
   workflow (postgres service container), artifact downloaded and committed. Do NOT dump the
   demo DB: demo lacks PR #143's `uq_*_global` guard indexes (tracked-migration edits never
   reached it) — it is not a valid schema source.
2. **The regenerated init.sql MUST seed `public.schema_migrations`** (one row per migration file,
   generated at regen time) so a fresh install's `apply-migrations.sh` no-ops instead of
   replaying the chain onto a complete schema. This is the load-bearing detail of ADR-087.
3. **Preserve the curated seed data**: `pg_dump --schema-only` drops hand-written seed rows and
   comments — the script splices a clearly-fenced curated section back in. Reconcile RLS
   policies, ownership/GRANTs (roles must exist in a fresh container), extensions, and schema
   creation order.
4. **Acceptance**: CI integration green against the NEW init.sql AND `ci-apply-full-schema.sh`
   applies zero genuinely-new statements over it (all sentinels pass straight from the seed).
   The script is KEPT as the drift guard, not deleted.
5. **Standing mechanics**: branch off `origin/master` after PR A merges; admin-authorized squash
   merge (explicit, every time); grep-verify `nav.json` after landing regen; no docs-only master
   pushes; run cross-workspace regression suites directly (`cd tests && npx jest ...`) — the
   drift-gate test reads files outside `tests/`, exactly the Turbo-cache blind spot.
6. **`apply-migrations.sh` compatibility**: verify how it detects/records applied migrations and
   make the backfill rows match its format EXACTLY (filename key, checksum column if any). A
   mismatched backfill silently re-runs migrations — test this path in the workflow (fresh
   container: new init.sql, then `apply-migrations.sh` must report all 69 as already applied,
   including PR A's `20260716` migration).

---

## Task 1: Branch + ADR-087 (decision first)

- [ ] `git fetch origin && git checkout -b feature/sprint-120-one-seed-path origin/master`
- [ ] Write `docs/adr/ADR-087-one-seed-path-init-sql-regeneration.md` (Status: Accepted):
  decision = init.sql is generated from the migrated chain + seeds schema_migrations;
  ci-apply-full-schema.sh becomes the drift guard; regen is script-only, never hand-edit the
  generated section
- [ ] Index in `docs/adr/README.md`
- [ ] **Verification:** drift gate's ADR-index check passes locally:

```bash
cd tests && npx jest regression/doc-context-drift-gate --no-coverage
```

## Task 2: Study apply-migrations.sh tracking format

- [ ] Read `scripts/apply-migrations.sh`: how `public.schema_migrations` rows are keyed/recorded;
  how "already applied" is detected; note exact column shapes for the backfill
- [ ] Read current init.sql end-to-end: inventory hand-written seed rows, comments, RLS,
  GRANTs, extensions — the curated material Task 3 must preserve
- [ ] **Verification:** notes recorded in the PR description draft / handoff (backfill format +
  curated inventory)

## Task 3: Write `scripts/regenerate-init-sql.sh`

**Files:**
- Create: `scripts/regenerate-init-sql.sh`

- [ ] Pipeline: scratch DB → apply CURRENT init.sql → apply full chain with
  ci-apply-full-schema.sh's collision-tolerant semantics (reuse/source it, don't reimplement) →
  `pg_dump --schema-only --no-owner` → post-process (ownership/GRANT normalization, deterministic
  ordering, strip dump noise) → emit fenced GENERATED section + curated seed section (from a
  maintained `infrastructure/postgres/seed-data.sql` extracted in this task, or inline fence) +
  `schema_migrations` backfill INSERTs (Task 2 format)
- [ ] Idempotent + deterministic: running twice on the same chain produces byte-identical output
- [ ] **Verification:** `bash -n scripts/regenerate-init-sql.sh`; shellcheck if available

## Task 4: Workflow `.github/workflows/regenerate-init-sql.yml`

- [ ] `workflow_dispatch`; postgres:15 service; runs the script; **validates before uploading**:
  (a) boots a SECOND fresh postgres from the regenerated init.sql alone, (b) runs
  `apply-migrations.sh` against it — must report ALL migrations already applied, (c) runs
  `ci-apply-full-schema.sh` against it — zero genuinely-new statements, all sentinels pass;
  uploads `init.sql` artifact
- [ ] **Verification:** trigger the workflow on the branch (`gh workflow run`), download the
  artifact, all three validation steps green in the run log

## Task 5: Land the regenerated init.sql

- [ ] Commit the artifact as `infrastructure/postgres/init.sql`; diff-review against the old file
  (expect: missing migrations' objects appear; nothing curated lost)
- [ ] Rewrite `ci-apply-full-schema.sh`'s header comment to its drift-guard role (mechanism
  unchanged)
- [ ] **Verification:** full CI on the branch green — the integration job now seeds from the new
  init.sql; its zero-genuinely-new gate is the proof of convergence

## Task 6: Drift-gate regression test

**Files:**
- Create: `tests/regression/sprint-120-init-sql-drift-gate.test.ts`

- [ ] Textual sentinels on init.sql: contains `chk_help_requests_status`,
  `trust_decay_config`, `trust_edges.stability`-related DDL, a `uq_*_global` guard index,
  `path_trust_score DOUBLE PRECISION`, and a `schema_migrations` backfill section; contains the
  GENERATED fence header
- [ ] **Verification:**

```bash
cd tests && npx jest regression/sprint-120-init-sql-drift-gate --no-coverage
```

## Task 7: Docs — migration strategy, IDEAS, landing

- [ ] `MIGRATION_STRATEGY.md`/`README.md`: when and how to re-run the regen workflow (any time
  the chain grows; before any sprint that needs fresh-install parity)
- [ ] Landing ADR-087 JSON + nav.json entry; grep-verify nav.json after regen
- [ ] `docs/IDEAS.md` 2026-07-08 entry → addressed-by note
- [ ] **Verification:** `npm run feedback:check` clean; doc-context drift gate direct run green

## Task 8: Version bump + SDLC quality gates

- [ ] v11.31.0
- [ ] `/simplify` — final pass on the branch diff (script + workflow readability included)
- [ ] **Verification:** findings applied or dismissed with note
- [ ] `/code-review` — branch diff
- [ ] **Verification:** zero unresolved confirmed findings
- [ ] `/security-review` — branch diff (shell injection surface in the script, workflow perms)
- [ ] **Verification:** zero unresolved findings; dismissals justified

## Task 9: Final verification + Merge + Deploy

- [ ] `npm test` green; `pre-commit-check`; handoff updated
- [ ] Open PR; all checks green — the integration job against the new init.sql IS the headline
  check
- [ ] **PAUSE for explicit Admin merge authorization** — `gh pr merge --squash --admin`
- [ ] Monitor deploy. NOTE: demo does NOT re-seed from init.sql (existing DB); deploy impact is
  nil by design — verify health anyway (frontend/login/communities 200)
- [ ] ADR-087 status → Implemented rides PR C or the next sprint's first commit (no docs-only
  push)
