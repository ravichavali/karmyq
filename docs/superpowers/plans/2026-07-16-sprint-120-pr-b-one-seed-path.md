# Sprint 120 PR B: One Seed Path (init.sql Regeneration) — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; work inline except where a task is
> genuinely large and independent (maintainer token-efficiency decision, 2026-07-16).
> Gate calibration for this PR: `/code-review` stays at HIGH effort — the regen script rewrites
> the seed path for every fresh install and warrants it; one `/simplify` pass on the branch diff.

**Goal:** Regenerate `infrastructure/postgres/init.sql` from the fully-migrated schema so every
fresh install (local docker-compose, CI, new envs) gets ONE converged seed path; record as ADR-087.

**Architecture:** A scripted, repeatable regeneration (`scripts/regenerate-init-sql.sh`) run via a
GitHub Actions workflow — `pull_request` path-filtered for the initial in-PR run,
`workflow_dispatch` for post-merge regens (Docker is unavailable locally): scratch postgres →
current init.sql → full migration chain → `pg_dump --schema-only` → post-process → splice curated
seed section + `schema_migrations` backfill → artifact. `ci-apply-full-schema.sh` inverts from
convergence workaround to drift guard via a NEW before/after schema-dump comparison mode (see
critical note 4 — its current error-allowlist mechanism cannot detect cleanly-applied drift).

**Tech Stack:** PostgreSQL 15, bash, GitHub Actions.

**Version:** v11.30.0 → v11.31.0 · **Branch:** `feature/sprint-120-one-seed-path` (off
`origin/master`, after PR A merges)

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `scripts/regenerate-init-sql.sh` | The regeneration pipeline (dump, post-process, splice, backfill) |
| `infrastructure/postgres/seed-data.sql` | Curated seed rows extracted from init.sql — the single reviewable home the regen script splices back in |
| `.github/workflows/regenerate-init-sql.yml` | Regen workflow: `pull_request` (path-filtered, for the initial in-PR run) + `workflow_dispatch` (post-merge regens); postgres service, run script, upload artifact |
| `docs/adr/ADR-087-one-seed-path-init-sql-regeneration.md` | The decision record |
| `apps/landing/src/data/docs/concepts/adr-087-one-seed-path-init-sql-regeneration.json` | Landing ADR JSON |
| `tests/tdd/sprint-120-init-sql-drift-gate.test.ts` | Textual sentinels on init.sql (authored RED in Task 5); promoted to `tests/regression/` when green in Task 6 |

### Existing files to modify
| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | REPLACED by generated output (fenced generated section + curated seed section + schema_migrations backfill) |
| `scripts/ci-apply-full-schema.sh` | NEW drift-check mode: normalized `pg_dump --schema-only` before vs after replaying the chain, fail on any diff (the real gate — see note 4); header rewritten to drift-guard role; sentinels kept as belt-and-suspenders |
| `docs/adr/README.md` | ADR-087 index entry |
| `apps/landing/src/data/docs/nav.json` | ADR-087 entry (grep-verify after regen) |
| `infrastructure/postgres/migrations/MIGRATION_STRATEGY.md` + `README.md` | Regeneration workflow documented |
| `docs/IDEAS.md` | 2026-07-08 init.sql entry → addressed note |
| `package.json` | v11.31.0 |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

Copied from the spec — items 6–9, 11 apply to this PR:

1. **Docker is unavailable locally** — the regen runs in a GitHub Actions workflow (postgres
   service container; `pull_request`-triggered for the initial in-PR run per note 7,
   `workflow_dispatch` post-merge), artifact downloaded and committed. Do NOT dump the
   demo DB: demo lacks PR #143's `uq_*_global` guard indexes (tracked-migration edits never
   reached it) — it is not a valid schema source.
2. **The regenerated init.sql MUST seed `public.schema_migrations`** (one row per migration file,
   generated at regen time) so a fresh install's `apply-migrations.sh` no-ops instead of
   replaying the chain onto a complete schema. This is the load-bearing detail of ADR-087.
3. **Preserve the curated seed data**: `pg_dump --schema-only` drops hand-written seed rows and
   comments — the script splices a clearly-fenced curated section back in. Reconcile RLS
   policies, ownership/GRANTs (roles must exist in a fresh container), extensions, and schema
   creation order.
4. **The drift guard needs a NEW mechanism — the current script canNOT detect clean drift.**
   `ci-apply-full-schema.sh` today replays the chain with `ON_ERROR_STOP=0` and fails only on
   (a) an ERROR line outside its redundancy allowlist or (b) a fixed sentinel query. A migration
   that adds a genuinely-NEW object over a converged init.sql applies with NO error at all —
   nothing flags it, the job passes, and drift goes undetected. "Zero genuinely-new statements"
   is therefore not an observable the script produces. Add a real drift check: normalized
   `pg_dump --schema-only` of the init.sql-only DB BEFORE replaying the chain, another AFTER, and
   **fail on any diff** (normalize away dump ordering/noise the same way the regen post-process
   does). Implement it as a `--drift-check` mode of `ci-apply-full-schema.sh` (keep the existing
   collision-tolerant apply + sentinels as belt-and-suspenders). **Acceptance for PR B**: CI
   integration green against the NEW init.sql AND the drift-check diff is empty (schema identical
   before/after the chain replays). The script is KEPT and repurposed, not deleted.
5. **Standing mechanics**: branch off `origin/master` after PR A merges; admin-authorized squash
   merge (explicit, every time); grep-verify `nav.json` after landing regen; no docs-only master
   pushes; run cross-workspace regression suites directly (`cd tests && npx jest ...`) — the
   drift-gate test reads files outside `tests/`, exactly the Turbo-cache blind spot.
6. **`apply-migrations.sh` compatibility**: verify how it detects/records applied migrations and
   make the backfill rows match its format EXACTLY (filename key, checksum column if any). A
   mismatched backfill silently re-runs migrations — test this path in the workflow (fresh
   container: new init.sql, then `apply-migrations.sh` must report EVERY file in
   `infrastructure/postgres/migrations/*.sql` as already applied — assert by comparing
   `schema_migrations` rows against the sorted file listing (zero missing, zero extra), never a
   hard-coded count; the chain includes PR A's `20260716-path-trust-score-double-precision.sql`
   and keeps growing).
7. **Workflow first-run constraint**: `workflow_dispatch` only works for workflows that already
   exist on the DEFAULT branch — the initial run can NOT be dispatched from this feature branch.
   The workflow therefore also carries a `pull_request` trigger path-filtered to
   `.github/workflows/regenerate-init-sql.yml` + `scripts/regenerate-init-sql.sh`, so the initial
   regen runs automatically inside this PR. `workflow_dispatch` covers post-merge regens.

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
- Create: `infrastructure/postgres/seed-data.sql`

- [ ] Extract the curated seed rows (Task 2 inventory) into
  `infrastructure/postgres/seed-data.sql` — the maintained, independently reviewable source the
  script splices back in (decision resolved 2026-07-16: dedicated file, not an inline fence)
- [ ] Pipeline: scratch DB → apply CURRENT init.sql → apply full chain with
  ci-apply-full-schema.sh's collision-tolerant semantics (reuse/source it, don't reimplement) →
  `pg_dump --schema-only --no-owner` → post-process (ownership/GRANT normalization, deterministic
  ordering, strip dump noise) → emit fenced GENERATED section + curated seed section (spliced
  from `infrastructure/postgres/seed-data.sql`) + `schema_migrations` backfill INSERTs (Task 2
  format)
- [ ] Idempotent + deterministic: running twice on the same chain produces byte-identical output
- [ ] **Verification:** `bash -n scripts/regenerate-init-sql.sh`; shellcheck if available

## Task 4: Workflow `.github/workflows/regenerate-init-sql.yml`

- [ ] Triggers: `pull_request` path-filtered to this workflow file +
  `scripts/regenerate-init-sql.sh` (initial in-PR run — see critical note 7: dispatch is
  impossible before the file reaches master) AND `workflow_dispatch` (post-merge regens);
  postgres:15 service; runs the script; **validates before uploading**:
  (a) boots a SECOND fresh postgres from the regenerated init.sql alone, (b) runs
  `apply-migrations.sh` against it — `schema_migrations` rows must match the sorted
  `migrations/*.sql` file listing exactly (zero missing, zero extra; no hard-coded count),
  (c) runs `ci-apply-full-schema.sh --drift-check` against it — the before/after schema-dump
  diff is empty (note 4); uploads `init.sql` artifact
- [ ] **Push the branch and open a contract-compliant DRAFT PR now** (fill
  `.github/pull_request_template.md`) — the `pull_request` trigger cannot fire, and its artifact
  cannot be downloaded, until the PR exists. Task 9 marks this same PR ready and merges it.
- [ ] **Verification:** the `pull_request`-triggered run on the draft PR is green (all three
  validation steps in the run log); download the `init.sql` artifact from that run

## Task 5: Drift-gate test (RED first, before the artifact lands)

**Files:**
- Create: `tests/tdd/sprint-120-init-sql-drift-gate.test.ts` (TDD tier first, per repo policy;
  promoted to `tests/regression/` in Task 6 once the new init.sql makes it green)

- [ ] Write the test against the CURRENT (old) init.sql — it must be RED now: sentinels like the
  GENERATED fence header and the `schema_migrations` backfill section don't exist in the stale
  file yet
- [ ] Textual sentinels on init.sql: contains `chk_help_requests_status`,
  `trust_decay_config`, `trust_edges.stability`-related DDL, a `uq_*_global` guard index,
  `path_trust_score DOUBLE PRECISION`, and a `schema_migrations` backfill section; contains the
  GENERATED fence header
- [ ] **Verification (RED):**

```bash
cd tests && npx jest tdd/sprint-120-init-sql-drift-gate --no-coverage   # fails against old init.sql
```

## Task 6: Land the regenerated init.sql (turn the test GREEN)

- [ ] Commit the Task 4 artifact as `infrastructure/postgres/init.sql`; diff-review against the
  old file (expect: missing migrations' objects appear; nothing curated lost)
- [ ] Add the `--drift-check` mode to `ci-apply-full-schema.sh` (note 4: normalized before/after
  `pg_dump --schema-only`, fail on any diff) and rewrite its header comment to the drift-guard
  role
- [ ] Promote the now-green drift test to `tests/regression/sprint-120-init-sql-drift-gate.test.ts`
- [ ] **Verification:** full CI on the branch green — the integration job seeds from the new
  init.sql; the `--drift-check` empty diff is the proof of convergence:

```bash
cd tests && npx jest regression/sprint-120-init-sql-drift-gate --no-coverage   # now GREEN
```

## Task 7: Docs — migration strategy, IDEAS, landing

- [ ] `MIGRATION_STRATEGY.md`/`README.md`: when and how to re-run the regen workflow (any time
  the chain grows; before any sprint that needs fresh-install parity)
- [ ] Landing ADR-087 JSON + nav.json entry; grep-verify nav.json after regen
- [ ] `docs/IDEAS.md` 2026-07-08 entry → addressed-by note
- [ ] **Verification:** `npm run feedback:check` clean; doc-context drift gate direct run green

## Task 8: Version bump + SDLC quality gates

- [ ] v11.31.0
- [ ] `/simplify` — the ONE pass for this PR, on the branch diff (script + workflow readability
  included)
- [ ] **Verification:** findings applied or dismissed with note
- [ ] `/code-review` at HIGH effort — branch diff (seed-path rewrite warrants it)
- [ ] **Verification:** zero unresolved confirmed findings
- [ ] `/security-review` — branch diff (shell injection surface in the script, workflow perms)
- [ ] **Verification:** zero unresolved findings; dismissals justified

## Task 9: Final verification + Merge + Deploy

- [ ] `npm test` green; `pre-commit-check`; handoff updated
- [ ] Mark the Task 4 draft PR ready for review (`gh pr ready`); all checks green — the
  integration job against the new init.sql IS the headline check
- [ ] **PAUSE for explicit Admin merge authorization** — `gh pr merge --squash --admin`
- [ ] Monitor deploy. NOTE: demo does NOT re-seed from init.sql (existing DB); deploy impact is
  nil by design — verify health anyway (frontend/login/communities 200)
- [ ] ADR-087 status → Implemented rides PR C or the next sprint's first commit (no docs-only
  push)
