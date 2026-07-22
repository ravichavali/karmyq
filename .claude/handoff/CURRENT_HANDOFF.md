# Sprint 120 — True Scores, One Seed Path & Five-Second Clarity — PR C IN REVIEW (PR #158)

> **STATUS (2026-07-22, PR C session — CURRENT):** **Tasks 1–8 are DONE and PR
> [#158](https://github.com/ravichavali/karmyq/pull/158) — `Sprint 120 PR C: Five-Second Clarity
> (v11.32.0)` — is OPEN, CI fully green (20 checks; `Deploy to Demo` skipped until master), state
> `MERGEABLE` / `BLOCKED` on review.** Cross-agent review by Codex returned **request-changes: no
> critical defects, two important gaps**, both now addressed on the branch:
> 1. **R-5 first fix was wrong, now correct.** The first attempt (short label + `pb-44`) did NOT stop
>    the overlap — `pb-44` only lets the LAST card scroll clear; a fixed corner FAB still rests on
>    whatever card is in its band at scroll 0. Browser-verified on the live build at 375×812: the FAB
>    `[288–336]` intersects the "Explore →" link `[259–323]`, and ANY right-corner FAB (left edge
>    ≥303) clips right-aligned card actions that end at x≈323 — a floating corner button cannot reach
>    zero-overlap on a 375px column. **Correct fix (reviewer's option A, non-overlay placement):**
>    `SpeedDialFab` now renders a **docked opaque full-width bar** on `< md` (`.kq-create-bar`,
>    `bottom-16` above a deterministic `h-16` `.bottom-nav` — prototyped live, sits flush, reads as
>    chrome content scrolls behind) and keeps the **floating labelled FAB on `md+`** (no bottom nav,
>    room to spare). `.kq-fab-safe-bottom` (`pb-44`) keeps the last card reachable above both bars.
>    jsdom has no layout engine, so tests pin the layout/class contract
>    (`create-bar-mobile` / `create-fab-desktop`) and the geometry is browser-verified.
> 2. **Canonical docs were stale** — this handoff, the audit doc's status line, `BUG-032`'s status,
>    and `apps/frontend/CONTEXT.md` all now reflect shipped state.
>
> Also from the review: `lib/jwt.ts` now decodes with **`TextDecoder('utf-8', { fatal: true })`** (a
> non-fatal decode could smuggle U+FFFD into a payload that still parses); the onboarding test now
> asserts the **real invariant** (WelcomeModal and OnboardingOverlay never coexist — verified to fail
> when the suppression is reverted) instead of only hook arguments; and the base64url test proves
> **both** `-` and `_` substitutions on a payload that provably needs each.
>
> **Quality gates:** `/simplify` applied, `/security-review` clean (no HIGH/MEDIUM), `/code-review`
> was delegated to Codex (this review). Suite: **24 tests** in
> `apps/frontend/tests/regression/sprint-120-five-second-fixes.test.tsx` (frontend 352/352 overall).
> **NEXT:** push the review fixes, confirm CI, then **PAUSE for explicit admin merge authorization**
> (`gh pr merge --squash --admin`), monitor deploy, smoke-test demo, then sprint close-out: this
> handoff → COMPLETE and archived to
> `.claude/handoff/archive/2026-07-22-sprint-120-...-COMPLETE.md`.

> **STATUS (2026-07-22, PR C session — earlier, superseded by the block above):** Branch
> `feature/sprint-120-five-second-clarity` is cut from
> fresh `origin/master` (`3623dc89`). **Task 1 DONE:** the deferred bookkeeping rides this first
> commit — **ADR-087 → Implemented** (ADR md + `docs/adr/README.md` index + regenerated landing
> `concepts.json`; the per-ADR `concepts/*.json` files are gitignored/generated at build) — this
> handoff is re-synced from the merged PR B branch, and the audit scaffold exists at
> `docs/superpowers/research/2026-07-16-sprint-120-five-second-audit.md` with the surface × state
> applicability matrix (17 surfaces × 4 states). Generated timestamp/HEAD-sha churn
> (`architecture.json`, `build.json`) and the out-of-scope `adr-059` content drift were reverted,
> as in PR B. **NEXT: Task 2** — the read-only Playwright five-second audit on demo. Its blocker is
> credentials: S1/S2/S3 states need demo sim login + a read-only psql degree query over SSH.
> Sprint close (handoff archive to
> `.claude/handoff/archive/2026-07-22-sprint-120-...-COMPLETE.md`) still rides the END of PR C.
>
> **Tasks 2–4 DONE (same session).** Audit lives at
> `docs/superpowers/research/2026-07-16-sprint-120-five-second-audit.md`: 10 findings, a 4-product
> reference comparison, a 12-row ranked table. States resolved by read-only psql — **S1
> first-arrival is NOT auditable (0 users without a membership; no account manufactured)**, S2 =
> `takeshi.osei6315@test.karmyq.com` (degree 1), S3 = `maria.reyes@test.karmyq.com` (degree 4 —
> note the designated "rich" persona is below the demo's own median; max degree is 62). Seven
> surfaces went unaudited (request detail, create-request wizard, community detail, profile,
> notifications, messaging, md→lg topbar) — maintainer chose to proceed anyway; carried forward.
> **Task 4 CHECKPOINT PASSED — maintainer selected R-1…R-8** (UTF-8-safe JWT decode; constrain the
> dashboard community `<select>`; link `/demo` from the app root; brand login/register; label the
> create action; stop stacked onboarding overlays; sparse-`/network` CTA; green active mode pill).
> Deferred to IDEAS: R-9/R-10/R-12. Logged as bugs, not fixed inline: **BUG-031** (32× 404
> `community-trust` console noise on `/communities`) and **BUG-032** (the JWT `atob` mojibake that
> R-1 fixes; BUG-032 is now marked fixed). Plan Tasks 5–7 were rewritten in place with concrete files/tests. **Task 5 followed**
> (TDD tests in `apps/frontend/tests/tdd/sprint-120-five-second-fixes.test.tsx`, RED first; since promoted to `tests/regression/`).

> **STATUS (2026-07-22, this session): PR B is SHIPPED.** PR
> [#153](https://github.com/ravichavali/karmyq/pull/153) — `Sprint 120: generate init.sql from one
> seed path` — was admin-override squash-merged (`3623dc89`, 2026-07-22 04:21Z) at **v11.31.0** and
> **DEPLOYED** to karmyq.com. CI/CD run `29890827056` went fully green including **Deploy to Demo =
> success with no rollback** (SSH + ARM64 build + `deploy.sh` + server-side health check all passed,
> ~7 min). Post-deploy smoke test: frontend root serves live Karmyq HTML; social-graph API returns
> the correct ADR-074 error contract. Demo did NOT re-seed from init.sql (existing DB), as expected —
> the generated init.sql only affects fresh-install/CI paths.
>
> This session closed the Task 8/9 gaps on top of the already-green PR B artifact work and merged:
> - **Version bump `11.30.1 → 11.31.0`** + **Task 7 doc-loop** (ADR-087/PR#153 note on the
>   `docs/IDEAS.md` `[2026-07-08] infra` entry) — commit `d4b30e50`.
> - **`/simplify`** (branch diff, scripts+workflow) = clean, no worthwhile reduction. The 3
>   migration-enum idioms across YAML+shell are a false-positive reuse flag (different needs).
> - **`/code-review` HIGH** = no correctness defects. Verified `apply_migration`'s transaction-wrapper
>   detection against **all 65 migration files**: comment-only ROLLBACKs (009/011/013) are correctly
>   stripped because the check runs on comment-stripped `exec_lines`; the real `ROLLBACK;` in
>   `20260530-community-dedup.sql` is correctly preserved. Drift-check before/after, `'`-escaping, and
>   the ADR-031 qualified-DDL regex all sound.
> - **`/security-review`** = clean (prior session, tooling-only surface).
> - Caught & reverted 3 landing JSONs that `npm test`'s landing `prebuild` auto-regenerated
>   (`architecture.json`/`build.json` = pure timestamp+HEAD-sha churn; `adr-059.json` = real content
>   drift from #156's ADR edit) — all auto-regenerate at deploy, out of PR B scope, and CI does NOT
>   gate committed-JSON-vs-source (`docs-generation.test.ts` validates structure only). Kept PR focused.
> - **Do NOT** revert the ADR-031 contract-test regex to `toContain` — the generator emits qualified DDL.
>
> **⚠️ RIDES PR C's FIRST COMMIT (no docs-only master push):** (1) **ADR-087 → Implemented** in
> `docs/adr/ADR-087-*.md` AND its landing JSON (`apps/landing/src/data/docs/concepts/adr-087-*.json`);
> (2) **archive THIS handoff** to `.claude/handoff/archive/2026-07-22-sprint-120-...-COMPLETE.md` once
> the whole sprint (through PR C) ships. NOTE: origin/master's committed handoff is now one step stale
> vs the accurate copy committed on the merged `feature/sprint-120-one-seed-path` branch — PR C should
> re-sync from here.
>
> **Housekeeping (deferred — auto-mode classifier blocked git stash/fetch this session):**
> `git stash@{0}` (`sprint-120-pr153-artifact-wip`) is FULLY captured in the merged commits — safe to
> `git stash drop stash@{0}` now that #153 merged. Two ancient v9.x stashes (`stash@{1}` S36,
> `stash@{2}` S34) are stale cruft — clear when convenient. Local master fetch/ff also pending.


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

## Quick Start (PR C — five-second clarity, research-FIRST)

PR A + PR B are SHIPPED. PR C is the last leg of Sprint 120. Plan:
`docs/superpowers/plans/2026-07-16-sprint-120-pr-c-five-second-clarity.md`. Design spec:
`docs/superpowers/specs/2026-07-16-sprint-120-true-scores-one-seed-clarity-design.md`.

1. Read this handoff (top block = PR B shipped + what rides PR C's first commit) + the PR C plan.
2. **Branch off fresh `origin/master`:** `git fetch origin && git checkout -b
   feature/sprint-120-five-second-clarity origin/master`. Target version **v11.32.0**.
3. **First commit carries the deferred bookkeeping** (no docs-only master push): ADR-087 →
   Implemented (ADR md + landing JSON); re-sync THIS handoff onto the new branch (origin/master's
   copy is one step stale — take the accurate copy from the merged `feature/sprint-120-one-seed-path`).
4. **PR C is research-FIRST (spec note 9):** audit doc + maintainer fix selection at the Task 4
   checkpoint BEFORE any implementation. Audit BY STATE (unauth / first-arrival if a read-only DB
   check finds one / sparse sim account by degree query / maria.reyes), each surface only where
   reachable. Read-only on demo; NEVER mutate protected personas
   (maria.reyes/elena.torres/noah.williams/marcus.lee@test.karmyq.com). At the checkpoint, rewrite
   the plan file itself with concrete files/tests for the selected fixes before Tasks 5–7 execute.
5. Fold in S119's remaining live validation + PR A leftovers (see the 2026-07-16 planning block
   below) during PR C's audit pass.

Do NOT revert the ADR-031 contract-test regex fix to `toContain` — the generator emits qualified DDL.

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
