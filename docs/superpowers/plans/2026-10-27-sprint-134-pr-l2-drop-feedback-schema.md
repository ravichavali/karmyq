# Sprint 134 PR L2 — Dead feedback data and BUG-070 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the unused interaction-feedback schema and repair the nightly community-health snapshot and current-state fallback before BUG-070's 2026-11-03 deadline.

**Architecture:** Share the reputation service's current-metrics reader and strength calculation between the snapshot writer and HTTP fallback. The confirmed maintainer decision uses quality weight w (default 0, clamped [0,1]) and `(1-w)*(2*activity+density)/3+w*quality`; default activity/density split the full score 2:1. No HTTP override or new rating source is introduced. The schema retirement remains in the existing migration; this weighting follow-up changes no migration/init.sql.

**Tech Stack:** TypeScript, Express 5, PostgreSQL 15, Jest, existing migration and landing-doc generators. No dependency changes.

**Spec:** [Sprint 134 design, PR L2](../specs/2026-10-20-sprint-134-dated-obligations-design.md#pr-l2--drop-the-dead-feedback-data-follows-l).

## Global Constraints

- Reuse `agent/claude/sprint-134-pr-l2-drop-feedback-schema`; base `dd585016`, bootstrap record `a00ead82`. Codex owns edits; Claude reviews after PR creation. No worktrees or merges.
- Maintainer includes BUG-070 in L2. Confirmed 2026-10-27: the tunable parameter is quality weight w in [0,1], default 0. Use `(1-w)*(2*activity+density)/3+w*quality`; w=0 splits activity/density 2:1 across the full score, while w=0.4 recovers the historical 40/40/20 mix. A quality signal source and persisted community weight are a separate planned PR requiring a maintainer-allocated ADR number.
- Preserve the feed's separate activity formula and existing role-count participant semantics; no new private-feedback aggregation. `feedback.feedback` and `trust_scores.average_feedback` remain live.
- One migration; regenerate `init.sql` using `scripts/regenerate-init-sql.sh`, never hand-edit. Apply `.claude/agents/migration-validator.md` before committing. A disposable demo-host operation requires separate maintainer authorization.
- Maintainer amendment (2026-10-27, before regeneration): isolate community failures in both nightly loops, matching `calculateAllCommunityTrustScores`. Widen snapshot density to NUMERIC(20,4), snapshot match/participant growth and cached trend percentage to NUMERIC(20,2), preserving existing scales. Real-SQL cases must store density ≥ 10 with zero cached members and growth ≥ 1000% while writing all other fixture snapshots.
- Maintainer feed amendment: cap density at 100. With quality weight zero, density12 and 50+ matches must produce100/Thriving; 25 matches/density0.5 yields50/Growing. Existing activity definitions stay. The repaired cron creates previously missing snapshots, so the card moves from its empty zero state to its computed value.
- New tests begin in the changed workspace's `tests/tdd/`. Promote passing local tests to regression. Root real-SQL integration tests run in CI only on this Windows host; “Integration Tests” is the arbiter.
- Only root version fields may change in package manifests; re-derive from origin/master before delivery and again at merge time (currently next version 11.101.0).
- Run own simplification, correctness, security passes; record findings/rulings in the PR. Mandatory pre-commit process review, unit + regression, feedback check, handoff and filled PR template.
- Restore landing build/architecture timestamp/ADR-010 CR-only churn LAST before staging. Force-add tracked generated docs. Stop after push and PR creation; no CI watching.

## Verified inventory and responsibilities

Inventory baseline: the untruncated scans below were verified on `a00ead82` before L2 implementation; their line references describe that baseline. They cover services, tests, packages, frontend/mobile, scripts, infrastructure outside historical migrations, and source docs. The confirmed weight follow-up supersedes the original score expectations; historical migration/bug/event-retirement records remain historical.

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
5. Quality weight zero uses the full 2:1 activity/density score, both surfaces reach100, weights outside[0,1] clamp, and w=0.4/quality50 yields50 (Tasks 1–2).

---

### Task 1: Repair and share reputation health metrics

**Files:** Create `services/reputation-service/src/services/communityHealthMetrics.ts`; modify `src/services/healthMetricsService.ts`, `src/routes/health.ts`, `src/services/milestoneDetector.ts`, `src/cron/healthMetricsCalculator.ts`, `CONTEXT.md`; create `tests/tdd/sprint-134-pr-l2-health.test.ts` and `tests/tdd/sprint-134-pr-l2-batch-isolation.test.ts` in reputation-service, then promote. Create the real-SQL test initially under reputation-service `tests/tdd/`, then relocate to `tests/integration/sprint-134-pr-l2-health.integration.test.ts` for CI discovery.

**Interfaces:**
- Produces `calculateNetworkStrength(totalMatches: number, uniqueParticipants: number, networkDensity: number, qualityScore = 0, qualityWeight = 0): number` (quality [0,100], weight clamped [0,1], two-decimal result). Feed `getCommunityHealthSummary(communityId, qualityScore = 0, qualityWeight = 0)` uses the same weighting with its existing activity definition.
- Produces `readCurrentCommunityMetrics(communityId: string): Promise<CurrentCommunityMetrics>`: completed matches, requester/helper counts, their existing sum as unique_participants, density and network_strength; no retired average fields.
- Existing `calculateCommunityHealthMetrics(communityId): Promise<void>` and `calculateAllCommunityMetrics()` keep their public signatures, event payload and daily schedule.

- [x] Write failing local tests for default weight (`10,4,0.5 → 50`), historical mix (`10,4,0.5,quality50,w0.4 → 50`), full100 at w=0, clamped weights, empty input and zero member denominator. Route/cache/snapshot projections assert removed fields absent and numeric SQL strings handled. The prior fixed-weight implementation failed these default-score expectations before the correction.
- [x] Run focused reputation Jest by path. Expected: missing new module / old response contract fails; retain red evidence.
- [x] Write real-SQL integration cases: seed C/D/empty cohorts and users; completed C-only and C+D requests, D-only completed and C proposed; assert exact C counts, finite empty fallback, unchanged denials, persisted snapshot/cache, second same-day upsert and 7-day growth. Drive the nightly calculation entry against real SQL and GET the running reputation service. No SQL mocks; unavailable infrastructure fails. Check every fixture column against init.sql. Do not run it locally. **Execution ruling:** the scheduler/startup paths now delegate to existing `manualCalculateHealthMetrics`; integration invokes that exact entry without importing node-cron into the root tests workspace (no dependency edits).
- [x] Implement reader using request_communities (community-scoped EXISTS prevents fanout), preserve requester/helper semantics, guard zero member denominator, and share strength calculation across snapshot/cache/fallback. Remove all quality milestone generation and average projections.
- [x] Run focused tests. Expected: all local cases green; integration explicitly unverified pending CI.
- [x] Update reputation CONTEXT's current schema, score contract, response examples and BUG-070 repair; retain history clearly as history.
- [x] Amendment: start batch-failure tests in reputation tests/tdd, observe health-source/trust/milestone failures stop later communities, then add per-community try/catch and verify later communities still write. Enumeration failure must still reject; log the failed community and original error. Focused suites 16/16 after the three continuation cases failed first.
- [x] Amendment: add DENSE (12 completed matches, current_members=0) and GROWTH (12 matches/24 role participants vs previous 1/1) to real-SQL nightly fixtures. Assert density 12.0000, match growth 1100.00%, participant growth 2300.00%, cache trend 1100.00%, and exact snapshots for every other community. CI-only execution remains explicit; authored/discovered, not run locally.

### Task 2: Remove downstream readers and schema

**Files:** Modify request-service `socialKarmaFeedComposer.ts`, its regression test, mixed Sprint 132 test and directed allowlist, request CONTEXT; delete dead `feedComposer.ts` and its dedicated test. Modify simulation tablePolicy + CONTEXT. Modify both E2E SQL seeds, root request-service-feed fixture and directed-audience integration test. Add `infrastructure/postgres/migrations/20261027-drop-interaction-feedback.sql`; regenerate `init.sql`.

**Interfaces:** Consumes Task 1's average-free snapshot. Feed `getCommunityHealthSummary` retains its existing output and `totalMatches * 2` activity score; default quality weight0 leaves the full2:1 activity/density score. The existing migration removes one table/seven columns and widens four numeric fields; the weighting follow-up changes no SQL schema.

- [x] L2 request tests began in `tests/tdd/sprint-134-pr-l2-feed.test.ts` and were promoted. Updated confirmed-weight cases: matches25/density0.5 →50/Growing; density12 with50/75 matches →100/Thriving; w0.4/quality50 →50; clamped weights. Empty snapshot stays zero and retired averages cannot influence it.
- [x] Remove averages from feed SQL/scoring. Update existing tests to average-free rows, the confirmed weighting and all score-label bands.
- [x] Feed amendment: density remains capped by `Math.min(100, networkDensity * 100)`. Confirmed zero-weight cases require100/Thriving at50/75 matches, superseding the original60/Strong expectations.
- [x] Delete dead FeedComposer and its dedicated tests; remove only its cases/imports in mixed tests and its allowlist entry. Keep all live directed-audience cases.
- [x] Remove simulation retired-table policy and update docs. Remove retired feedback inserts/quality milestones from seeds, retain featured stories independently, repair full seed community linkage and strip averages from snapshot/trust seeds. Repair the older integration seed too.
- [x] Write one guarded migration: DROP TABLE IF EXISTS requests.interaction_feedback; ALTER TABLE reputation.trust_scores DROP COLUMN IF EXISTS for four columns; ALTER TABLE reputation.community_health_metrics for three. Apply migration-validator checklist; expected no added FKs/creates/transaction wrapper, qualified safe drops only.
- [x] Amendment: widen the four existing numeric fields in the original migration, keeping scale 4/2. NUMERIC(20,4)/(20,2) accommodates the ratios/percentage growth from INTEGER snapshot counters. Static review and the explicitly authorized original generator/strict reapply/drift/fresh-restore repeat all passed. Migration/init.sql remain unchanged by the later weighting correction.
- [x] Obtain separate authorization for disposable PostgreSQL regeneration; run the existing script and copy its generated artifact back. Expected schema removes precisely the retired objects, preserves feedback.feedback, and migration ledger includes the new filename. Record unrun real-SQL integration separately.
- [x] Run request focused tests and TypeScript checks on reputation/request/simulation. Promote green TDD tests. Expected all pass. Re-run untruncated reader scan and classify every remaining hit.

### Task 3: Review, document, verify and open PR

**Files:** `services/registry.json`, `docs/adr/ADR-035-karma-allocation-trust-score-strategy.md`, `docs/BUGS.md`, source CONTEXTs, generated landing pages, root package version/lock root versions, plan checkboxes and `.claude/handoff/CURRENT_HANDOFF.md`.

**Interfaces:** Consumes the complete implementation diff. Produces a clean committed branch and one PR marked “open, awaiting cross-agent review + maintainer merge”.

- [x] Correct ADR-035's obsolete average claim while preserving status/history; document confirmed default-zero quality weight and full2:1 score. Mark BUG-070 fixed in L2 (not deployed); update registry endpoint description/notes.
- [x] Execute separate simplification, correctness and security passes over `git diff origin/master`; fix consequential findings with red→green tests, record rulings and deferred issues. Claude's independent review follows PR creation as explicitly requested by the maintainer.
- [x] Fetch and reconcile master/version and open PRs; change only three root version occurrences to the next version. Expected no dependency graph change.
- [x] Run `npm test`, affected service compilers, feedback check and process review. Initial delivery passed 27/27 (22 cached); the confirmed-weight follow-up passed a fresh 27/27 (20 cached), root regression 952/952, reputation 5+333 (3 TODOs), request 161+424 (1 existing DB skip). Both changed service compilers pass. The requested tests-project filter is empty: compiler exit2/filter1, exactly two target errors removed and70 unrelated existing diagnostics unchanged. Process reviewer verified tests/coverage/docs/feedback and requested these plan-status corrections. CI “Integration Tests” remains the SQL-behavior arbiter.
- [x] Update handoff: Active editor Codex until handback, plan + evidence + decisions, BUG-070, explicit next action for Claude review. Self-review plan coverage and mark completed steps with evidence.
- [x] Restore generated churn LAST; force-stage meaningful landing docs. Final source change committed as `7f0606d5` and pushed separately, with mandatory hooks and 27/27 pre-push tasks; no bypass flags.
- [x] Fill every PR-template section including Validation ledger (tested tree/commit, command, cache, outcome, limitation), own gate findings/rulings, CI-only integration and no demo deployment. [PR #320](https://github.com/ravichavali/karmyq/pull/320) opened; actual link/state recorded in the final handoff-only documentation checkpoint. Stop after delivery without watching CI or merging.

## Plan self-review

Spec coverage maps to Tasks 1–3. All five Review Focus cases have owning tests. Shared reader/score signatures connect Task 1's route and snapshot; Task 2 consumes only persisted columns, preserving the separate feed formula. The maintainer's explicit instruction to write then execute supplies execution authorization; no extra plan-approval pause or fresh reviewer is inserted before the requested post-open Claude review.

## Delivery audit

Initial implementation `7f0606d5` and documentation checkpoint `239c6c79` are committed/pushed; PR #320 is open. The subsequent maintainer-confirmed quality-weight correction changes implementation, tests and docs plus two strict-null comparisons; it changes no migration/init.sql. Its fresh full local gate passed 27/27 (20 cached), with targeted compiler output empty and70 unrelated existing diagnostics unchanged. Confirm the latest tested/pushed commit in the PR's Validation ledger. Schema regeneration/cleanup already passed under explicit authorization; SQL behavior remains CI-only. A separate planned per-community weight PR needs maintainer ADR allocation and a quality signal source.
