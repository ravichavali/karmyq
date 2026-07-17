# Sprint 120 — True Scores, One Seed Path & Five-Second Clarity — PR A IMPLEMENTED, GATES IN PROGRESS

> **STATUS (2026-07-17, PR A execution):** Tasks 1–8 implemented on
> `feature/sprint-120-true-scores-polish` at v11.30.0. BUG-030 has a DOUBLE PRECISION migration,
> per-target batch isolation, and promoted regression coverage; all six graph-polish findings,
> ADR-086 close-out, service/registry/guide docs, and generated landing docs are in the working
> tree. Migration-validator reported no findings; focused social-graph and frontend suites,
> TypeScript, and the direct doc drift gate are green. Docker remains unavailable, so the live
> PostgreSQL migration exercise stays in CI. Tasks 9–10 are complete: final `npm test` passed
> 26/26 Turbo tasks (frontend 29 suites / 266 tests; social-graph 23 suites / 154 pass + 3 todo),
> both touched workspaces compile, feedback exits 0, and the process-reviewer passed the clean
> staged snapshot. Next: commit, open PR, then wait for explicit Admin merge authorization.
> Quality gates (2026-07-17): one full-diff simplify pass found no worthwhile reduction beyond the
> per-link visual Map already introduced; medium correctness review found and fixed two stale copy
> contracts (the Sprint 115 assertion and generated-doc source/nav); security review found no new
> auth, injection, secret, disclosure, or destructive-SQL surface. No findings remain open.

> **STATUS (2026-07-16, planning session):** Sprint 119 is fully SHIPPED — PR #150 merged by Admin
> 2026-07-16 14:47Z (squash `6cf8f2d`), CI/CD deployed. Sprint 120 planned this session
> (maintainer scope decisions recorded below): three PRs, each merges + deploys independently.
> **Cross-agent review processed 2026-07-16, RE-REVIEW folded in 2026-07-17:** PR A confirmed
> ready unchanged; PR B + PR C plans AND the design spec AMENDED in place (notes 6–9 deltas —
> real `--drift-check` mechanism, Task 4 opens a draft PR, drift-test/land reorder, state-based
> PR C audit). Re-read the plan files + spec; all review findings are folded in. Spec, plans,
> and handoff now agree.
> S119 close-out bookkeeping (ADR-086 → Implemented, S119 handoff → archive) rides PR A Task 1.
> S119's remaining live validation (Maria's ring, sparse no-bonds state, woven/dormant bridges,
> 375px; plus PR A leftovers: throwaway first-join from a community DETAIL page → /welcome,
> `/demo` tour survives refresh, topbar calm at md/lg/xl) can fold into PR C's audit pass —
> read-only, never mutate protected personas.

## Quick Start

1. Read this handoff
2. Check out branch: `git fetch origin && git checkout -b feature/sprint-120-true-scores-polish origin/master`
   (if the planning commit is already on this branch, just `git checkout feature/sprint-120-true-scores-polish`)
3. Open plan: `docs/superpowers/plans/2026-07-16-sprint-120-pr-a-true-scores-polish.md`
4. Run: `/execute-plan` with superpowers:executing-plans, working INLINE (see efficiency note 12
   — subagents only for genuinely large independent tasks)

PR B and PR C follow the same pattern with their own plan files, each branching off fresh
`origin/master` after the previous PR merges.

## Sprint Goal

Fix the source, not the symptom, three ways: BUG-030's trust-score cache column adopts the score's
real type (DOUBLE PRECISION + batch per-target isolation) with the six PR #150 polish findings
(PR A); init.sql becomes the generated product of the migration chain — one seed path everywhere,
ADR-087 (PR B); and a research-first five-second-test UX audit ships only maintainer-selected
clarity fixes (PR C).

## Multi-Sprint Arc

- S115 (ADR-083) position earned → S118 (ADR-085) ego edges lived → S119 (ADR-086) ring + hub
  scale answers: the graph-presentation arc is CLOSED. S120 is hardening + first impressions.
- Candidates for S121+: governance ratification quorum design question; sim pace / demo
  liveliness (IDEAS 2026-06-15); docs-token cleanup (CLAUDE.md/AGENTS.md); PR C's deferred
  structural findings.

## Approved Artifacts

- Design: `docs/superpowers/specs/2026-07-16-sprint-120-true-scores-one-seed-clarity-design.md`
- Plan PR A (11 tasks): `docs/superpowers/plans/2026-07-16-sprint-120-pr-a-true-scores-polish.md`
- Plan PR B (9 tasks): `docs/superpowers/plans/2026-07-16-sprint-120-pr-b-one-seed-path.md`
- Plan PR C (9 tasks): `docs/superpowers/plans/2026-07-16-sprint-120-pr-c-five-second-clarity.md`
- Branches: `feature/sprint-120-true-scores-polish` → `feature/sprint-120-one-seed-path` →
  `feature/sprint-120-five-second-clarity` (each off `origin/master` after the previous merges)
- Version: v11.29.0 → v11.30.0 (A) → v11.31.0 (B) → v11.32.0 (C) · ADR: **ADR-087** rides PR B
- Scope decisions (maintainer, this session): ALL FOUR candidates in scope (BUG-030 fix, six
  PR #150 polish findings, five-second-test UX pass, init.sql regeneration); BUG-030 fix shape =
  **DOUBLE PRECISION migration**, not rounding at write sites.

## Critical Implementation Notes (from the spec — read before implementing)

1. **BUG-030 = DOUBLE PRECISION migration** (decided), NOT rounding. Three raw write sites stay
   unrounded: `services/social-graph-service/src/routes/paths.ts:189` (single), `paths.ts:361`
   (batch), `services/pathComputation.ts:525` (precompute). Grep `path_trust_score` consumers for
   integer-type assumptions after.
2. **Batch isolation**: try/catch INSIDE the per-target loop; failure degrades to the existing
   "no connection" per-target shape (no new error shape), logged with target id. TDD: one target
   throws → 200 with other targets present. Feed-ranking guard: `degrees_of_separation` must not
   move.
3. **Migration hygiene**: date-named `20260716-path-trust-score-double-precision.sql`; run
   `migration-validator` before commit; add a column-type sentinel to
   `scripts/ci-apply-full-schema.sh`; update init.sql:85 minimally; NEVER edit
   `009_social_graph.sql` (tracked-migration edits never reach demo).
4. **Don't disturb shipped graph contracts while polishing**: ring rotation/anchor, decayTier
   bands, `new > caller > focused` precedence, fail-closed `active_recently`, truthful legend
   colors are pinned S115/S118/S119 contracts — pin with regression assertions BEFORE touching
   `graphVisualEncoding.ts`; run promoted S118/S119 suites directly after.
5. **One 30-day window** (ADR-082/S118): `isActiveRecently` alias delegates to
   `isFormedRecently` — no second constant.
6. **init.sql regen needs real postgres; Docker unavailable locally** → GitHub Actions workflow.
   AMENDED per review: `workflow_dispatch` can't run a workflow that isn't on master yet, so the
   workflow ALSO carries a path-filtered `pull_request` trigger for the initial in-PR run;
   dispatch covers post-merge regens. NEVER dump the demo DB (missing PR #143 `uq_*_global`
   guard indexes — not a valid schema source).
7. **Regenerated init.sql MUST seed `public.schema_migrations`** (match apply-migrations.sh's
   row format EXACTLY) or fresh installs replay the chain — the load-bearing detail of ADR-087.
   Workflow validates: fresh container from new init.sql → apply-migrations.sh reports ALL
   already applied (assert `schema_migrations` rows == sorted `migrations/*.sql` listing, zero
   missing/extra — never a hard-coded count) → `ci-apply-full-schema.sh --drift-check` shows an
   empty before/after schema diff. **AMENDED 2026-07-17 (re-review):** the current script CANNOT
   detect clean drift (fails only on unexpected ERROR lines + a fixed sentinel list; a
   genuinely-new object applies silently and passes) — add a real `--drift-check` mode
   (normalized `pg_dump --schema-only` before vs after the chain replay, fail on any diff). Task
   order fixed: drift-gate TEST is Task 5 (RED against old init.sql), landing the artifact +
   `--drift-check` mode + promote-to-regression is Task 6 (GREEN). Task 4 now PUSHES and opens a
   contract-compliant DRAFT PR before waiting on the `pull_request` workflow (its artifact can't
   be downloaded until the PR exists); Task 9 marks that same PR ready.
8. **Preserve curated seed data** through the regen (schema-only dump drops it) — DECIDED: seed
   rows live in a dedicated `infrastructure/postgres/seed-data.sql` the script splices in (not
   an inline fence); reconcile RLS, ownership/GRANTs, extensions, schema order.
   `ci-apply-full-schema.sh` is KEPT (repurposed to the drift guard).
9. **PR C is research-FIRST**: audit doc + maintainer fix selection (Task 4 checkpoint) BEFORE
   any implementation. AMENDED per review: (a) audit by STATE (unauthenticated / first-arrival
   if a read-only DB check finds one / sparse sim account picked by degree query / maria.reyes),
   each surface only in states where reachable — no blanket persona×surface cross-product;
   (b) at the Task 4 checkpoint the plan file itself is rewritten with concrete files/tests for
   the selected fixes before Tasks 5–7 execute. Audit read-only on demo; protected personas
   (maria.reyes / elena.torres / noah.williams / marcus.lee@test.karmyq.com) never mutated;
   maria.reyes = rich view; demo graph is sparse (avg ~4.6) — check DB degree before judging a
   graph surface. Screenshots stay in session scratchpad; audit doc stands alone textually.
10. **Standing mechanics**: each PR branches off `origin/master` after the previous merges;
    admin-authorized squash merge, EXPLICIT authorization every time; no docs-only master pushes;
    TDD in the changed workspace's `tests/tdd/`; cross-workspace suites run directly
    (`cd tests && npx jest ...`); grep-verify `nav.json` after every landing regen;
    `getMyCommunities` returns `{communities,count,total}`; JWT field is `communities`; jsdom/D3
    gotchas (`^d3$` → `d3/dist/d3.min.js`, stub ResizeObserver, seed `node.__zoom`).
11. **S119 bookkeeping**: handoff archive DONE at planning
    (`archive/2026-07-16-sprint-119-truthful-surfaces-fractal-story-COMPLETE.md`); ADR-086 →
    Implemented (ADR file + landing JSON) rides PR A Task 1. ADR-087 → Implemented + this
    handoff's archive ride the NEXT sprint's first commit.
12. **Token-efficiency decisions (maintainer, 2026-07-16 — standing, recorded in memory):**
    (a) all four SDLC gates remain mandatory, but EFFORT is calibrated to diff size — one
    `/simplify` pass per PR for small diffs (per-task only on substantial tasks); `/code-review`
    MEDIUM for small well-specified PRs, HIGH for risky/large ones (PR B stays HIGH);
    (b) execute small plan tasks INLINE, subagents only for genuinely large independent tasks;
    (c) fresh chat per PR, handoff stays pointers + deltas; (d) CLAUDE.md/AGENTS.md/MEMORY.md
    trimmed at planning (docs-token cleanup, was backlogged since S116) — keep them lean, mind
    the doc-context-drift gate when touching CLAUDE.md.

## Carry-Forward / Known State

- **BUG-030** (`docs/BUGS.md`): open, diagnosed — fixed by PR A. Demo repro:
  maria.reyes → Fatima Alhassan (1/149 pairs); batch route can 500 whole feed-ranking calls.
- **PLAUSIBLE pre-existing edge** (S119 PR A review): localStorage communities snapshot can route
  a stale-snapshot member to /welcome. Deferred; candidate for PR C audit attention.
- **Deferred S119 follow-ups**: computeInvitationPath disclosure-gate question, api.ts
  interceptor clearAuthSession adoption, cold-cache batch enrichment.
- **Demo state:** curated baseline (36 users, 6 communities, 14 trust edges) + two harmless S118
  throwaways (SE Portland Running Club). Protected story core per note 9.
- Docker unavailable locally; DB-backed assertions ride CI (full migrated schema via
  `scripts/ci-apply-full-schema.sh`; PR A's new migration needs its sentinel — in plan).
- Root Turbo on Windows can hit Jest temp-cache `EPERM`; rerun isolated with unique caches under
  `C:\tmp` — assertion failures are not cache races.
- Sprint 119 record: `.claude/handoff/archive/2026-07-09-sprint-118-invited-arrival-living-graph-COMPLETE.md`
  (S118) + PR A archive due in PR A Task 1 (S119).

## Persistent Context

### Multi-Agent PR Process

- Admin owns scope approval, merge authority, and deploy authorization.
- Claude owns merge-readiness recommendation and is the only agent that marks a sprint complete.
- Contributor agents never self-merge; one branch/PR per task and no direct commits to `master`.
- Copy and fill `.github/pull_request_template.md` when using `gh pr create`.
- The non-authoring agent performs cross-agent review when available.
- Do not independently resolve cross-agent conflicts; pause for reassignment.

### Architecture Gotchas

- Frontend uses the Pages Router (`apps/frontend/src/pages`).
- API interceptor unwraps envelopes: callers consume `res.data`, not `res.data.data`.
- JWT membership field is `communities`, not `communityMemberships`.
- Authorization uses live membership lookup; JWT membership is only a hint.
- Community schema is `communities.*`; auth schema is `auth.*`.
- Error contract is `{ success:false, message:string, error:string }` (ADR-074).
- `social_graph.trust_edges_live` is read-only.
- Request-service owns `/requests/feed`; there is no feed-service.
- `category` and `request_type` are not interchangeable.
- Trust-path topology is platform-wide; strength is community-scoped (ADR-077).
- Reputation/relationship outward contracts remain governed by ADR-082/084.
- Root `CLAUDE.md` is tracked as lowercase `claude.md` on Windows.

### Workflow Gotchas

- TDD tests start in each changed workspace's `tests/tdd/`, then promote when green.
- Run focused workspace suites directly; Turbo can hide or invent cache-related failures.
- Every implementation task runs `/simplify`; every sprint runs `/code-review` and `/security-review`.
- Invoke `pre-commit-check` before every commit.
- Unit + regression must pass before push.
- Run the direct doc-context drift test after generated landing-doc changes.
- Do not create worktrees; this is a shared, time-sliced checkout.
- Do not make a docs-only follow-up push to `master`; every master push triggers a deploy.

### Demo / Deploy Drift Watch

Confirm GitHub Actions deploy succeeded and live content matches `master` before judging the result.
Demo persona credentials come from server environment configuration; never commit passwords.
