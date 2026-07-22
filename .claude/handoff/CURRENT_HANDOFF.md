# Sprint 120 — True Scores, One Seed Path & Five-Second Clarity — PR B CI-GREEN; 3 PLAN GAPS + CODE-REVIEW BEFORE MERGE

> **STATUS (2026-07-21, this session):** The dependency-security blocker is RESOLVED and PR B's
> artifact work is UNBLOCKED, committed, and CI-green. Sequence of events:
> 1. **Security hotfix shipped separately** (the one-task/one-PR path the prior handoff called for):
>    PR [#156](https://github.com/ravichavali/karmyq/pull/156) — `security: dependency vulnerability
>    remediation hotfix (v11.30.1)` — **MERGED** (`791255f8`) and deployed. Default-branch vulns
>    dropped 8 (high/mod) → 1 (low). Axios `^1.18.1`, surgical overrides (tar/brace-expansion/
>    body-parser/shell-quote/js-yaml/fast-uri), Next.js stays 15.5 with `sharp@0.35.3` leaf override;
>    frontend images moved node:18→20-alpine (engine floor >=20.9.0), backends stay 18. Audit gate = 0.
> 2. **PR B WIP restored from stash** onto `feature/sprint-120-one-seed-path`: drift gate PROMOTED
>    `tdd/ → regression/`, `init.sql` regenerated artifact landed, landing ADR-087 docs + handoff.
>    Committed `cef3fa1d`; then merged `origin/master` in (`ea38a3f9`) to pick up the security fix.
> 3. **CI caught a real failure**, now fixed (`c4fedbbe`): the ADR-031 contract test
>    (`services/request-service/tests/regression/community-membership-feed.test.ts`) hard-coded
>    UNQUALIFIED DDL strings, but the ADR-087 generator emits SCHEMA-QUALIFIED
>    (`public.visibility_scope_enum`). Enum/columns/ordering were all present & correct — only the
>    string form differed. Fix: qualification-tolerant regex (`/CREATE TYPE (?:public\.)?…/`) +
>    `.search()` for the ordering check. Preserves contract intent; do NOT revert to `toContain`.
> **PR [#153](https://github.com/ravichavali/karmyq/pull/153) is now fully CI-GREEN (all 21 checks),
> MERGEABLE, blocked only on REVIEW_REQUIRED.** `/security-review` ran on the branch = CLEAN (tooling
> only: workflow uses `pull_request` not `pull_request_target`, read-only perms, no untrusted
> interpolation; scripts escape SQL identifiers/literals + consume only repo/env inputs).
>
> **⚠️ NEXT SESSION — close 3 plan gaps + the mandated HIGH review, then merge (Task 8/9):**
> 1. **Bump version `11.30.1 → v11.31.0`** in `package.json` (Task 8; currently still 11.30.1,
>    inherited from the security merge).
> 2. **Run `/simplify`** on THIS branch diff (Task 8 — the one PR-B pass; the earlier simplify ran on
>    the security branch, NOT this one). Scope: `scripts/regenerate-init-sql.sh`,
>    `scripts/ci-apply-full-schema.sh`, the workflow. Skip the 8k-line generated `init.sql`.
> 3. **Run `/code-review` at HIGH effort** (Task 8 — plan MANDATES high for this seed-path rewrite).
> 4. Minor doc-loop: add an "addressed-by ADR-087 / PR #153" note to the `docs/IDEAS.md`
>    `[2026-07-08] infra` entry (line ~393). (Task 7's MIGRATION_STRATEGY/README "how to re-run" is
>    already covered inside ADR-087's Decision section — treat as satisfied.)
> Then Task 9: `npm test` + `pre-commit-check`, `gh pr ready` is moot (already non-draft), **PAUSE for
> explicit Admin merge authorization** (`gh pr merge --squash --admin`), monitor deploy (demo does
> NOT re-seed from init.sql — existing DB, deploy impact is fresh-install/CI paths only), ADR-087 →
> Implemented rides PR C / next sprint's first commit (no docs-only master push).
>
> **Housekeeping:** `git stash@{0}` (`sprint-120-pr153-artifact-wip`) is still intact as a backup —
> it is FULLY captured in commits `cef3fa1d`/`c4fedbbe`; **drop it after PR #153 merges**
> (`git stash drop stash@{0}`). Two ancient v9.x stashes (`stash@{1}` S36, `stash@{2}` S34) are stale
> cruft — clear when convenient.


> **STATUS (2026-07-17, PR A shipped):** PR
> [#152](https://github.com/ravichavali/karmyq/pull/152) is **MERGED** (admin-override squash
> `31fdcd54`, 2026-07-17 19:58Z) and **DEPLOYED** to karmyq.com at v11.30.0. The CI/CD pipeline
> (run `29609505205`) went fully green including **Deploy to Demo = success with no rollback** —
> `deploy.sh` applies migrations idempotently and rolls back on failure, so the DOUBLE PRECISION
> migration landed and server-side health verification passed. Post-deploy smoke test: frontend
> root serves the live Karmyq landing; social-graph API responds with the correct ADR-074 error
> contract. **One follow-up for the maintainer:** the authenticated BUG-030 repro (as
> `maria.reyes` → Fatima Alhassan single path + a `/paths/batch` sweep; expect 200s, fractional
> score cached, `degrees` unchanged) still wants a manual pass — it needs demo login creds / SSH,
> which the auto-mode classifier gates. Deploy evidence is otherwise strong.
> **PR B is active on `feature/sprint-120-one-seed-path`, branched from fresh `origin/master`;
> ADR-087 begins Accepted and becomes Implemented only after PR B deploys.**
> Quality gates (2026-07-17, folded into the merged PR): one full-diff simplify pass found no
> worthwhile reduction beyond the per-link visual Map already introduced; medium correctness
> review found and fixed two stale copy contracts (the Sprint 115 assertion and generated-doc
> source/nav); security review found no new auth, injection, secret, disclosure, or
> destructive-SQL surface. No findings remain open.

> **PR B execution (2026-07-17):** Task 1 is committed as `b685c062`; ADR-087 is Accepted and
> the direct ADR-index gate passed. Task 2 inventory: `public.schema_migrations` is keyed by the
> bare SQL filename in `migration_name VARCHAR(255) PRIMARY KEY`, with
> `applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; the generated backfill must contain the sorted
> `migrations/*.sql` names exactly. Curated rows are the three
> `communities.config_templates` starter templates and four global
> `social_graph.interaction_weights` rows. The generated path must also preserve/reconcile the
> `uuid-ossp` extension, dumped RLS policies, development-role/grant behavior, and schema ordering.
> Task 3 is implemented: the sourceable normalizer + regeneration pipeline passes Git Bash syntax,
> its ledger helper emits all 65 sorted migrations, and curated rows now live in dedicated
> `seed-data.sql` (`shellcheck` unavailable locally). Draft PR #153 is open. Initial regeneration
> run `29613483083` passed Linux shellcheck, double-run byte determinism, fresh generated-DB boot,
> and exact 65-row ledger parity; it failed only on the deliberately absent drift-success marker,
> so no artifact uploaded. Task 5 is RED as intended (five stale-init sentinels fail; the shipped
> global-index and DOUBLE PRECISION sentinels pass). Task 6's source-shared `--drift-check` mode and
> CI integration invocation are committed. Regeneration run `29875351593` is fully green: Linux
> shellcheck, double-run determinism, fresh generated-DB boot, exact 65-row ledger parity, strict
> empty before/after drift diff, and artifact upload all passed. Verified artifact SHA-256
> `64BB19A73ACF2E379785ABD7CBAD2506D3C5D1E9ED7BD01BE6F1EF23011DBCC8` is installed locally as
> `infrastructure/postgres/init.sql`; curated seed SQL is byte-preserved, and the promoted
> regression drift gate passes 7/7. The artifact commit is staged but BLOCKED by newly disclosed
> registry advisories: full `npm test` now fails only the ADR-059 audit gate (7 high + 1 critical),
> and PR #153 independently shows Security Audit + Backend Services failures while regeneration,
> auth, frontend, lint, CodeQL, and Docker build pass. Mandatory process review says DO NOT COMMIT.
> Admin must choose a separate dependency-security PR (preferred by the one-task/one-PR contract)
> or explicitly expand PR B scope before artifact work can continue.

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

## Quick Start (PR B — finishing gaps, then merge)

PR B Tasks 1–7 are DONE and CI-green on `feature/sprint-120-one-seed-path` (PR #153). Only Task 8
gaps + Task 9 remain. Plan: `docs/superpowers/plans/2026-07-16-sprint-120-pr-b-one-seed-path.md`.

1. Read this handoff (top status block has the full sequence + the exact fix already applied).
2. `git checkout feature/sprint-120-one-seed-path` (already 0 behind `origin/master`; security fix
   #156 merged in). Working tree should be clean.
3. **Close Task 8 gaps:** bump `package.json` `11.30.1 → 11.31.0`; `/simplify` on the branch diff
   (scripts + workflow only, skip generated `init.sql`); `/code-review` at **HIGH** effort (plan
   mandate). `/security-review` already ran = clean.
4. **Task 7 minor:** add "addressed-by ADR-087 / PR #153" note to `docs/IDEAS.md` `[2026-07-08]`
   entry (~line 393). MIGRATION_STRATEGY/README re-run docs already live in ADR-087 Decision §.
5. **Task 9:** commit gaps, `npm test` + `pre-commit-check` green, push (updates #153), then **PAUSE
   for explicit Admin merge authorization** (`gh pr merge --squash --admin`). Monitor deploy (demo
   does NOT re-seed init.sql). ADR-087 → Implemented rides PR C / next sprint (no docs-only push).
6. **After merge:** `git stash drop stash@{0}` (WIP fully captured in commits); optionally clear the
   two ancient v9.x stashes.

Do NOT revert the ADR-031 contract-test regex fix to `toContain` — the generator emits qualified DDL.

PR C follows with its own plan file, branching off fresh `origin/master` after PR B merges.

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

- **BUG-030** (`docs/BUGS.md`): FIXED by PR A (DOUBLE PRECISION migration + per-target batch
  isolation), merged `31fdcd54` and deployed 2026-07-17. Live-repro confirmation still pending a
  maintainer pass (maria.reyes → Fatima Alhassan single + `/paths/batch` sweep).
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
