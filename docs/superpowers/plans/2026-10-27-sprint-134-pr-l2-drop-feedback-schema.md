# Sprint 134 PR L2 — Dead feedback data and BUG-070 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the unused interaction-feedback schema and repair the nightly community-health snapshot and current-state fallback before BUG-070's 2026-11-03 deadline.

**Architecture:** Share the reputation service's current-metrics reader and strength calculation between the snapshot writer and HTTP fallback. Retain the existing score weights and accept an optional normalized quality score (default zero); no HTTP parameter or new rating source is introduced. Remove every runtime reader before dropping the table and seven columns in one guarded migration.

**Tech Stack:** TypeScript, Express 5, PostgreSQL 15, Jest, existing migration and landing-doc generators. No dependency changes.

**Spec:** [Sprint 134 design, PR L2](../specs/2026-10-20-sprint-134-dated-obligations-design.md#pr-l2--drop-the-dead-feedback-data-follows-l).

## Global Constraints

- Reuse `agent/claude/sprint-134-pr-l2-drop-feedback-schema`; base `dd585016`, bootstrap record `a00ead82`. Codex owns edits; Claude reviews after PR creation. No worktrees or merges.
- Maintainer includes BUG-070 in L2. Interpretation of “quality as a parameter”: optional internal quality score in [0,100], default 0; preserve 40% activity / 40% quality / 20% density. Record any clarification in the execution ledger.
- Preserve the feed's separate activity formula and existing role-count participant semantics; no new private-feedback aggregation. `feedback.feedback` and `trust_scores.average_feedback` remain live.
- One migration; regenerate `init.sql` using `scripts/regenerate-init-sql.sh`, never hand-edit. Apply `.claude/agents/migration-validator.md` before committing. A disposable demo-host operation requires separate maintainer authorization.
- Maintainer amendment (2026-10-27, before regeneration): isolate community failures in both nightly loops, matching `calculateAllCommunityTrustScores`. Widen snapshot density to NUMERIC(20,4), snapshot match/participant growth and cached trend percentage to NUMERIC(20,2), preserving existing scales. Real-SQL cases must store density ≥ 10 with zero cached members and growth ≥ 1000% while writing all other fixture snapshots.
- Maintainer feed amendment: cap the density contribution at 100 like reputation's calculation. With quality zero, density12 and 50+ matches must produce strength60/Strong, not280. The repaired cron creates previously missing snapshots, so the card can move from its empty zero state to its computed value.
- New tests begin in the changed workspace's `tests/tdd/`. Promote passing local tests to regression. Root real-SQL integration tests run in CI only on this Windows host; “Integration Tests” is the arbiter.
- Only root version fields may change in package manifests; re-derive from origin/master before delivery and again at merge time (currently next version 11.101.0).
- Run own simplification, correctness, security passes; record findings/rulings in the PR. Mandatory pre-commit process review, unit + regression, feedback check, handoff and filled PR template.
- Restore landing build/architecture timestamp/ADR-010 CR-only churn LAST before staging. Force-add tracked generated docs. Stop after push and PR creation; no CI watching.

## Verified inventory and responsibilities

Untruncated `rg` scans on the current branch cover services, tests, packages, frontend/mobile, scripts, infrastructure outside historical migrations, and source docs. Every matching runtime site is accounted for below; historical migration/bug/event-retirement records remain historical.

- Reputation: `src/services/healthMetricsService.ts:14` and `src/routes/health.ts:164` select nonexistent `help_requests.community_id`; both also aggregate the retired feedback table. The writer upserts the averages and separately computes the cached strength. `milestoneDetector.ts:38` reads averages and emits quality milestones.
- Request: `src/services/feed/socialKarmaFeedComposer.ts:24` reads averages (existing mock tests inject nonzero ratings although live data was zero). `src/services/feed/feedComposer.ts` has no production importer, but **does have test importers** in `feedComposer.test.ts`, `sprint-132-review-actions.test.ts`, and root `sprint-132-directed-audience.integration.test.ts`; its directed-surface allowlist entry must also go.
- Simulation: `src/fixtures/curatedDemo/tablePolicy.ts:91` classifies the retired table. Update its CONTEXT with the classification removal.
- Fixtures: both `tests/e2e/seed-social-karma-v2*.sql` write the retired table/columns. The full seed also inserts nonexistent `help_requests.community_id`; replace that with a request_communities insert. `tests/integration/request-service-feed.test.ts:80` seeds averages (this legacy filename is not selected by the current integration config's `*.integration.test.ts` pattern).
- Schema checked directly in `init.sql`: help_requests owns `id, requester_id`; matches owns `request_id, responder_id, status`; request_communities owns `request_id, community_id` with unique_request_community. Snapshot/cache columns and `communities.communities.current_members` exist. SQL changes below use only those columns.
- Source docs: reputation/request CONTEXT schema and response examples; ADR-035 line 82 names retired averages; BUGS BUG-070 line 1902. Landing pages are generator output.

## Review Focus

1. A request linked to both C and D counts once in each; D-only and noncompleted matches do not enter C (Task 1 real SQL).
2. No snapshot, empty community, and zero cached member count return finite zero metrics (Task 1).
3. PostgreSQL NUMERIC strings and repeat same-day snapshots preserve exact score, growth and upsert behavior (Task 1).
4. Former/nonmembers and undersized cohorts remain denied before fallback reads; no private-rating substitution (Task 1 real SQL plus existing disclosure tests).
5. Optional quality zero and explicit nonzero quality produce bounded, consistent scores; deleting averages must not raise the feed score (Tasks 1–2).

---

### Task 1: Repair and share reputation health metrics

**Files:** Create `services/reputation-service/src/services/communityHealthMetrics.ts`; modify `src/services/healthMetricsService.ts`, `src/routes/health.ts`, `src/services/milestoneDetector.ts`, `src/cron/healthMetricsCalculator.ts`, `CONTEXT.md`; create `tests/tdd/sprint-134-pr-l2-health.test.ts` and `tests/tdd/sprint-134-pr-l2-batch-isolation.test.ts` in reputation-service, then promote. Create the real-SQL test initially under reputation-service `tests/tdd/`, then relocate to `tests/integration/sprint-134-pr-l2-health.integration.test.ts` for CI discovery.

**Interfaces:**
- Produces `calculateNetworkStrength(totalMatches: number, uniqueParticipants: number, networkDensity: number, qualityScore = 0): number` (normalized quality [0,100], two-decimal result).
- Produces `readCurrentCommunityMetrics(communityId: string): Promise<CurrentCommunityMetrics>`: completed matches, requester/helper counts, their existing sum as unique_participants, density and network_strength; no retired average fields.
- Existing `calculateCommunityHealthMetrics(communityId): Promise<void>` and `calculateAllCommunityMetrics()` keep their public signatures, event payload and daily schedule.

- [x] Write failing local tests for default quality (`10,4,0.5 → 30`), explicit quality (`10,4,0.5,50 → 50`), empty input, score bounds and zero member denominator. Exercise real router snapshot and fallback projections with external DB/access checks doubled; assert removed fields absent and numeric SQL strings handled.
- [x] Run focused reputation Jest by path. Expected: missing new module / old response contract fails; retain red evidence.
- [x] Write real-SQL integration cases: seed C/D/empty cohorts and users; completed C-only and C+D requests, D-only completed and C proposed; assert exact C counts, finite empty fallback, unchanged denials, persisted snapshot/cache, second same-day upsert and 7-day growth. Drive the nightly calculation entry against real SQL and GET the running reputation service. No SQL mocks; unavailable infrastructure fails. Check every fixture column against init.sql. Do not run it locally. **Execution ruling:** the scheduler/startup paths now delegate to existing `manualCalculateHealthMetrics`; integration invokes that exact entry without importing node-cron into the root tests workspace (no dependency edits).
- [x] Implement reader using request_communities (community-scoped EXISTS prevents fanout), preserve requester/helper semantics, guard zero member denominator, and share strength calculation across snapshot/cache/fallback. Remove all quality milestone generation and average projections.
- [x] Run focused tests. Expected: all local cases green; integration explicitly unverified pending CI.
- [x] Update reputation CONTEXT's current schema, score contract, response examples and BUG-070 repair; retain history clearly as history.
- [x] Amendment: start batch-failure tests in reputation tests/tdd, observe health-source/trust/milestone failures stop later communities, then add per-community try/catch and verify later communities still write. Enumeration failure must still reject; log the failed community and original error. Focused suites 16/16 after the three continuation cases failed first.
- [x] Amendment: add DENSE (12 completed matches, current_members=0) and GROWTH (12 matches/24 role participants vs previous 1/1) to real-SQL nightly fixtures. Assert density 12.0000, match growth 1100.00%, participant growth 2300.00%, cache trend 1100.00%, and exact snapshots for every other community. CI-only execution remains explicit; authored/discovered, not run locally.

### Task 2: Remove downstream readers and schema

**Files:** Modify request-service `socialKarmaFeedComposer.ts`, its regression test, mixed Sprint 132 test and directed allowlist, request CONTEXT; delete dead `feedComposer.ts` and its dedicated test. Modify simulation tablePolicy + CONTEXT. Modify both E2E SQL seeds, root request-service-feed fixture and directed-audience integration test. Add `infrastructure/postgres/migrations/20261027-drop-interaction-feedback.sql`; regenerate `init.sql`.

**Interfaces:** Consumes Task 1's average-free snapshot. Feed `getCommunityHealthSummary` retains its existing output and `totalMatches * 2` activity score, with quality zero. Migration removes exactly one table and seven columns and widens four numeric fields; no CASCADE, no live private-rating data change.

- [x] Add new request tests in `tests/tdd/sprint-134-pr-l2-feed.test.ts`: matches 25, density .5 → strength 30, label Developing; empty snapshot → zero; averages cannot influence result. Run and observe old synthetic rating handling fail.
- [x] Remove averages from feed SQL and scoring. Update existing mocked tests to realistic average-free rows and exact values; retain score-label boundary coverage reachable with quality zero.
- [x] Feed amendment: add density `12.0000` cases with 50/75 completed matches to the existing L2 regression; observe 280 vs60 RED, then clamp `densityScore = Math.min(100, networkDensity * 100)` and verify 60/Strong.
- [x] Delete dead FeedComposer and its dedicated tests; remove only its cases/imports in mixed tests and its allowlist entry. Keep all live directed-audience cases.
- [x] Remove simulation retired-table policy and update docs. Remove retired feedback inserts/quality milestones from seeds, retain featured stories independently, repair full seed community linkage and strip averages from snapshot/trust seeds. Repair the older integration seed too.
- [x] Write one guarded migration: DROP TABLE IF EXISTS requests.interaction_feedback; ALTER TABLE reputation.trust_scores DROP COLUMN IF EXISTS for four columns; ALTER TABLE reputation.community_health_metrics for three. Apply migration-validator checklist; expected no added FKs/creates/transaction wrapper, qualified safe drops only.
- [x] Amendment: widen the four existing numeric fields in this same migration, keeping scale 4/2. NUMERIC(20,4)/(20,2) exceeds the maximum ratios/percentage growth derivable from the existing INTEGER snapshot counters. Update schema/behavior docs, registry, and re-apply migration review. Static review passed; actual schema generation/application still pending authorization.
- [x] Obtain separate authorization for disposable PostgreSQL regeneration; run the existing script and copy its generated artifact back. Expected schema removes precisely the retired objects, preserves feedback.feedback, and migration ledger includes the new filename. Record unrun real-SQL integration separately.
- [x] Run request focused tests and TypeScript checks on reputation/request/simulation. Promote green TDD tests. Expected all pass. Re-run untruncated reader scan and classify every remaining hit.

### Task 3: Review, document, verify and open PR

**Files:** `services/registry.json`, `docs/adr/ADR-035-karma-allocation-trust-score-strategy.md`, `docs/BUGS.md`, source CONTEXTs, generated landing pages, root package version/lock root versions, plan checkboxes and `.claude/handoff/CURRENT_HANDOFF.md`.

**Interfaces:** Consumes the complete implementation diff. Produces a clean committed branch and one PR marked “open, awaiting cross-agent review + maintainer merge”.

- [x] Correct ADR-035's obsolete average claim while preserving its status/history; document default-zero quality. Mark BUG-070 fixed in L2 (not deployed); update registry endpoint description/notes.
- [x] Execute separate simplification, correctness and security passes over `git diff origin/master`; fix consequential findings with red→green tests, record rulings and deferred issues. Claude's independent review follows PR creation as explicitly requested by the maintainer.
- [x] Fetch and reconcile master/version and open PRs; change only three root version occurrences to the next version. Expected no dependency graph change.
- [x] Run `npm test` with correct Git utilities on PATH, affected TypeScript checks, `npm run feedback:check` on staged changes, and process-reviewer checklist before the commit. Final authorized suite exit 0: 27/27 tasks (22 cached), root regression 952/952; affected compilers clean. Process reviewer checked docs/coverage/feedback, reconciled the final log and returned PASS. CI “Integration Tests” must establish real-SQL correctness; no local claim substitutes for it.
- [x] Update handoff: Active editor Codex until handback, plan + evidence + decisions, BUG-070, explicit next action for Claude review. Self-review plan coverage and mark completed steps with evidence.
- [ ] Restore generated churn LAST; force-stage meaningful landing docs. Inspect final staged diff, run required pre-commit checks, commit, then push as a separate command (never `commit; push`). Expected clean tree, no bypass flags.
- [ ] Fill every PR-template section including Validation ledger (tested tree/commit, command, cache, outcome, limitation), own gate findings/rulings, CI-only integration and no demo deployment. Open PR, link it in handoff if needed in a final checked commit/push, report link, then stop without watching CI or merging.

## Plan self-review

Spec coverage maps to Tasks 1–3. All five Review Focus cases have owning tests. Shared reader/score signatures connect Task 1's route and snapshot; Task 2 consumes only persisted columns, preserving the separate feed formula. The maintainer's explicit instruction to write then execute supplies execution authorization; no extra plan-approval pause or fresh reviewer is inserted before the requested post-open Claude review.

## Delivery audit

The final commit/push/PR steps occur after this plan is committed. Confirm their completion from the PR and its Validation ledger; do not repeat implementation because these delivery checkboxes were recorded before those actions. Schema regeneration and scratch cleanup passed under explicit maintainer authorization.
