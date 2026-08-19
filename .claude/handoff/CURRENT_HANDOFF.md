# Sprint 126 — Honest Standing Backfill (ready to execute)

> ## State as of 2026-08-19
>
> **Sprint 125 shipped**: PR #209, squash **`f1197a17`**, version **v11.45.0**, deployed and
> smoke-tested on demo. `master` and `origin/master` are both at `f1197a17`. Archived at
> [`archive/2026-08-19-sprint-125-provider-standing-SHIPPED-v11.45.0.md`](archive/2026-08-19-sprint-125-provider-standing-SHIPPED-v11.45.0.md).
>
> **Sprint 126 is approved and ready to execute.** Branch
> `feature/sprint-126-standing-backfill` was cut from `origin/master` at `f1197a17`. The design
> passed two written review rounds; its implementation plan incorporates the writer audit,
> collision-safe legacy reprojection, cap-3 synthetic coverage, and one deterministic
> `(completed_at, match_id)` replay key.

## Quick Start

1. Read this handoff and the approved design spec.
2. Check out the existing branch: `git checkout feature/sprint-126-standing-backfill`
3. Open plan: `docs/superpowers/plans/2026-08-19-sprint-126-standing-backfill.md`
4. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

## Sprint goal

Make zero-standing semantics consistent, then project the demo's stored completed-match history
through one canonical, transactional, idempotent production standing path so the existing provider
surface shows rich, credible data without invented scores or retroactive feedback.

**Design spec**: [`docs/superpowers/specs/2026-08-19-sprint-126-standing-backfill-design.md`](../../docs/superpowers/specs/2026-08-19-sprint-126-standing-backfill-design.md)

**Implementation plan**: [`docs/superpowers/plans/2026-08-19-sprint-126-standing-backfill.md`](../../docs/superpowers/plans/2026-08-19-sprint-126-standing-backfill.md)

## Execution checkpoint

1. Start at Task 1: schema foundation plus fusion/fission writer safety.
2. Use TDD and commit each independently reviewable task.
3. Run the migration validator before committing migration/generated-schema changes.
4. Do not run demo `--apply` during implementation. Deployment, backup, and separate data-operation
   authorization are distinct gates in Task 14.

## ⚠️ Working-tree ownership

`docs/IDEAS.md` contains a pre-existing user edit about importing networks. It is unrelated to
Sprint 126 and must remain untouched and unstaged throughout execution.

---

## Approved scope

- Foundation: `trust_scores.score DEFAULT 0 NOT NULL` and one canonical reason/milestone contract.
- One transaction-safe, retry-safe completed-match standing projector shared by live events,
  curated fixture projection, and the historical operator CLI.
- Dry-run-first `backfill:standing` CLI; `--apply` remains a separately authorized demo data op.
- Reproject all stored completed matches oldest-first using their real completion timestamps, then
  evaluate every active user-community membership.
- No fabricated feedback, no score-distribution tuning, and no unrelated rough-edge cleanup.
- Human realism check: PDX provider layer at a meaningful non-zero floor, initially 20 subject to
  the observed source-derived distribution.

---

## ⚠️ Critical Implementation Notes

1. **One projector, not equivalent-looking copies.** Live events, curated reset data, and historical
   backfill must share canonical reason and milestone policy. An equivalence claim needs a test that
   can fail.
2. **Foundation before backfill.** Change `trust_scores.score` to `DEFAULT 0 NOT NULL`; reproject
   attributable legacy rows from completed-match facts rather than renaming them in place.
3. **Historical time is data.** Use `matches.completed_at`; stamping replayed rows with `NOW()` makes
   decay and recent-activity output falsely rich.
4. **Idempotency lives in PostgreSQL.** Per-match transactions and unique projection identities are
   required; a CLI checkpoint file or `SELECT`-then-insert check is insufficient.
5. **Oldest first.** First-help and milestone outcomes depend on chronological history. Sort by
   completion timestamp and match ID. Define one `asOf = (completed_at, match_id)` key. Historical
   community priority may read only canonical history lexicographically strictly before `asOf`;
   milestone rank may count canonical helper history through `asOf`. Current/future replay writes
   must change neither result.
6. **No fabricated feedback.** Demo currently has no feedback rows. Keep quality neutral; Sprint 127
   may create future ratings only through ordinary authenticated workflows.
7. **Backfill only standing side effects.** Do not replay badges, provider metrics, notifications,
   trust evolution, or other subscriber work merely because a match is historical.
8. **Dry-run is the default and must be provably read-only.** `--apply` is a separately authorized
   demo data operation after deployment and backup.
9. **Every active membership is evaluated.** A zero is a meaningful result for no history, not a
   missing batch.
10. **Do not tune scores to look attractive.** Report the distribution produced by stored facts.
    Human validation checks credibility against histories, not a target bell curve.
11. **Generated files stay generated.** Regenerate `init.sql` and landing docs from their sources;
    revert unrelated timestamp/HEAD churn.
12. **Demo facts are a dated snapshot.** Re-run preflight immediately before apply because the live
    simulator can add matches after this spec's 2026-08-19 audit.
13. **Audit every writer before adding uniqueness.** Fusion and fission karma copies must use
    `ON CONFLICT DO NOTHING`, with shared-match regression coverage, before the indexes land.
14. **Every projector predicate is as-of.** Community selection, milestone eligibility, and any
    future write decision must be a function only of stored history as of the match plus the match
    itself—never current table state. `updateTrustScore` is the deliberate exception because its
    cache is supposed to reflect the present.

---

## Carried items (nothing here is urgent)

### From the arc
- **Sprint 126 — honest demo-data backfill through production math** (the planned next step).
- **Sprint 127 — live simulation across all users.**

### ⏰ Dated obligation
- **`image-size` exemptions expire 2026-09-15.** Both GHSAs, renewed under the amended ADR-059
  (cap raised 7 → 30 days on maintainer decision, 2026-08-17). The weekly
  `.github/workflows/image-size-advisory-watch.yml` re-measures upstream and will file an issue
  when the horizon comes within 7 days, so this should surface itself around **2026-09-08**.
  **If that workflow is ever deleted or left failing, `MAX_EXEMPTION_DAYS` must go back to 7 in the
  same change** — the raised cap is defensible only because the monitor exists.

### Known rough edges (surfaced in Sprint 125, deliberately not fixed)
- **CodeQL dismissals do not survive line shifts.** Any edit to `apps/frontend/src/lib/api.ts`
  re-raises the documented `js/request-forgery` FP as *new* alert ids, which fails the ADR-060 gate
  on master and **skips the deploy** (this happened on #209 — merge landed, deploy didn't run until
  the new ids were dismissed and the pipeline re-run). 68 dismissals of this rule and counting. The
  durable fix is a query-level suppression, scoped as its own change.
- **`init.sql` regeneration is pg_dump-version-sensitive.** `normalize_schema_dump` canonicalizes
  CHECK-constraint cast placement for exactly 2 constraints and not the other 12, so regenerating
  on a different PostgreSQL 15 patch release produces cosmetic diff noise. Cannot break CI (both
  sides of every drift comparison use the same pg_dump). Not logged as a bug — maintainer's call.
- **~10 verbatim copies of `SERVICE_TYPE_LABELS`** remain across the frontend. Sprint 125 added the
  canonical `PROVIDER_SERVICE_TYPE_LABELS` to `packages/shared` and converted its own two files;
  the rest is a separate cleanup.
- **`isActiveMember` has inline duplicates** at `request-service/src/routes/offers.ts:105` and
  `requests.ts:1847`, plus per-service copies in social-graph and community services. The two
  in-service ones are a cheap follow-up; cross-service needs `packages/shared`.
- **BUG-036 still open**: `.github/workflows/test.yml` uses a fixed `sleep 30` before the Docker
  health probe, racing cold image pulls.

---

## Demo environment state (changed by Sprint 125's smoke test)

**`PDX Service Providers Network` (`6fcbcefb-cd67-40f5-a6c6-542525140d5b`) now has
`provider_services_enabled = true`** — set deliberately, with maintainer authorization, so the new
provider layer is actually visible on demo. It surfaces 444 eligible providers.

To revert: `UPDATE communities.community_configs SET provider_services_enabled = false WHERE
community_id = '6fcbcefb-cd67-40f5-a6c6-542525140d5b';` (prior state was `enabled=f, floor=0,
allowlist=empty`).

⚠️ **`reputation.trust_scores` has 0 rows on demo** while there are ~2000 provider profiles. With
the default floor of 0 every provider surfaces; **any floor above 0 will show an empty layer**.
That is fail-closed working correctly, not a bug — check the floor before debugging.

---

## Machine notes (this dev box)

- **Run the suite as `npx turbo run test --concurrency=2`.** Default concurrency exhausts the
  machine's 8 GB and aborts with SIGABRT (exit 134) — a *different* set of suites fails each run and
  every one passes in isolation. Do not chase those failures.
- **No local Docker.** No Docker Desktop, Podman, or WSL distro. Anything needing PostgreSQL
  (integration tests, `init.sql` regeneration) runs on the demo server in a **disposable** container
  reached over an SSH tunnel — never `karmyq-postgres`, never the `~/karmyq` deploy checkout. The
  recipe is in the archived Sprint 125 handoff.
- **Provider routes are at `/api/providers`, not `/api/requests/providers`.** The wrong path also
  401s anonymously, so an anonymous-only smoke test on it is a false pass.
- `| tail` masks exit codes — it hid a real `npm test` failure during Sprint 125. Capture the exit
  code separately.

---

## Standing mechanics

- Branch from `origin/master`; never direct-push to master and never force-push.
- Every merge needs explicit maintainer authorization; `--admin` override needs its own each time.
- No docs-only master pushes — every master push is a full deploy.
- Dependency edits are surgical: no workspace install, dedupe, or lockfile scratch regeneration.
- All four SDLC gates every sprint: testing, `/simplify`, `/code-review`, `/security-review`,
  calibrated to diff size.
- Landing docs regenerate on `npm test`; revert `build.json` / `architecture.json` timestamp and
  HEAD-sha churn before committing.
