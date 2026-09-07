# Sprint 128 PR C: Truthful standing preview — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` sequentially. Prove the reproduction before choosing a fix.

**Goal:** Make the backfill preview agree with actual trust-score refresh and provider reach semantics.
**Architecture:** Derive preview metrics from the projected canonical karma state, retaining the existing pure score and feedback functions. Verify against the real DB writer.
**Tech stack:** TypeScript, Jest, PostgreSQL; existing reputation service and operator CLI.
**Spec:** `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`, PR C.
**Branch:** `agent/codex/sprint-128-standing-preview`, created after PR B deploy verification.
**Global constraints:** All ten Critical implementation notes in the sprint index apply verbatim.

## File map

Modify `services/reputation-service/src/services/standingBackfillService.ts`,
`services/reputation-service/tests/regression/sprint-126-standing-backfill.test.ts`,
`tests/integration/sprint-126-standing-backfill.integration.test.ts`,
`services/reputation-service/CONTEXT.md`, `services/registry.json` (reputation notes),
`docs/adr/ADR-096-canonical-completed-match-standing-projection.md`,
`docs/guides/understanding-trust.md`, `.claude/handoff/CURRENT_HANDOFF.md`.
Create `services/reputation-service/src/services/standingPreview.ts` for a pure preview metric
helper and `services/reputation-service/tests/tdd/sprint-128-standing-preview.test.ts`, promoted
to the same filename under `tests/regression/` when green.
Read-only arbiters: reputation `karmaService.ts`, `trustMetricsDb.ts`, `feedbackDb.ts`,
`trustConfigDb.ts`, `effectiveParamsCache.ts`, and request `providerReachService.ts`.
No request-service edits, public API change, migration, new dependency or provider-floor change.

## Task 1: Establish context and reproduce on fixed facts

**Files:** File map plus service `.claude/README.md`, `CONTEXT.md`, `tests/claude.md`, scoped gotchas.

- [ ] Confirm PR B deployed and checkout is clean; fetch and create this branch from `origin/master`.
- [ ] Read the live score writer and its DB helpers end-to-end, including cache behavior; compare
  its inputs to `calculateDistributions`. Record the exact divergent inputs, not just output totals.
- [ ] Read the existing integration fixture and its disposable-DB protections before running it.
  Confirm the database target explicitly; no demo data writes are authorized by the sprint plan.
- [ ] Reproduce a member active in C1/C2, with canonical activity only in C1 and no feedback:
  global breadth is one in both communities; C2's default score is 1. A separate globally idle
  member scores 0. No arbitrary score floor is introduced.
- [ ] Reproduce provider eligibility using the same fixed dataset and counting unit; identify
  whether each difference comes from score inputs, profile/community deduplication or filters.
  The historical 384/499 counts are context, not a fixture oracle.
- [ ] Verification: record failing preview-versus-writer cases before code changes. If the desired
  fix requires changing production policy, revise scope with the maintainer rather than tuning scores.

## Task 2: Add failing pure metric and preview tests

**Files:** New service TDD test, existing Sprint 126 regression (reuse fixture conventions, not its mocked writer as proof).

**Proposed helper interface** in `standingPreview.ts`:

```typescript
export interface PreviewKarmaRow {
  user_id: string;
  community_id: string;
  reason: string;
  related_entity_id: string | null;
  created_at: Date | string;
}
export interface PreviewMetrics {
  recentInteractions: number;
  repeatPairs: number;
  distinctPeople: number;
  distinctCommunities: number;
}
export function computePreviewMetrics(
  rows: readonly PreviewKarmaRow[], userId: string, communityId: string, nowMs: number,
): PreviewMetrics;
```

- [ ] Add this first red test against the proposed helper:

```typescript
import { computePreviewMetrics } from '../../src/services/standingPreview';
it('retains global breadth for a membership with no local history', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  const rows = [
    { user_id: 'u', community_id: 'c1', reason: 'Provided help', related_entity_id: 'm1', created_at: new Date(now) },
    { user_id: 'v', community_id: 'c1', reason: 'Received help', related_entity_id: 'm1', created_at: new Date(now) },
  ];
  expect(computePreviewMetrics(rows, 'u', 'c2', now)).toEqual({
    recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 1,
  });
  expect(computePreviewMetrics(rows, 'idle', 'c2', now)).toEqual({
    recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 0,
  });
});
```

- [ ] Add cases for canonical reason filtering, 365-day inclusive boundary, null match identity,
  multiple community rows for one match, two matches with one counterparty, globally unrelated
  canonical history and no mutation of input rows.
- [ ] Add full `analyzeStandingBackfill` fixture tests for 0-versus-1 score buckets, mixed legacy /
  canonical records, existing projections, numeric-string/zero overrides and negative scores.
  Assert query calls remain SELECT-only and no projector/updateTrustScore invocation during preview.
- [ ] Run from reputation workspace: `npx jest tests/tdd/sprint-128-standing-preview.test.ts --runInBand`.
  Verification: missing helper and old preview mismatch are the failures, not an unrelated config error.

## Task 3: Correct the projected canonical state and preview metrics

**Files:** New `standingPreview.ts`, existing backfill service.

- [ ] Implement helper with SQL-equivalent semantics from `trustMetricsDb.ts`: global distinct
  canonical communities; local recent canonical row count; counterpart join on non-null match id,
  different user and canonical reasons; repeat count by distinct match IDs. Do not restrict the
  counterpart row to the local community when SQL does not. Avoid an all-rows nested scan per
  membership: build reusable indexes for user/community and match participants if the baseline
  dataset makes the direct implementation expensive, while preserving the declared test interface.
- [ ] Construct the post-apply karma view from snapshot plus replay. Mirror
  `normalizeUnattributableLegacy`, deletion of attributable legacy rows and planned canonical
  inserts. Preserve unaffected canonical rows and distinguish canonical identity from DB row id:

```text
Start from snapshot rows that apply would retain.
Normalize only the legacy rows apply normalizes, including collision handling.
For each replayed match, remove its attributable legacy rows.
Overlay expected canonical rows by user/community/reason/related entity identity.
Keep conflicting projections blocked by the existing anomaly checks.
Compute metrics for every active membership using the resulting canonical rows.
```

- [ ] Preserve the global-breadth input even when no local pair exists. Feed metrics to existing
  `computeTrustScore` and `calculateWeightedAvgFeedback`; resolve null versus zero weights exactly.
- [ ] Use one analysis timestamp internally. Document that a live changing DB/time cannot promise
  identical future counts; equivalence is at the same dataset/time/config, with cache behavior
  explicitly controlled in tests. Do not add production cache writes to the dry-run.
- [ ] Verification: new TDD tests and existing Sprint 126 regressions pass; expected values changed
  only where the real SQL semantics justify them. Formula and live writer remain unchanged.

## Task 4: Prove provider filters and preview/apply equivalence

**Files:** Service TDD test, backfill distributions, existing root standing integration test.

- [ ] Preserve `providerEligibility` keys 1/20/40/60 and document the unit as provider/community
  pairs, deduplicated by provider id plus community id. Exercise active/inactive profile/member,
  disabled/missing config, empty/restricted service list, missing score, multi-community providers,
  and scores exactly equal to each threshold. Compare against actual request reach SQL semantics.
- [ ] Extend the existing disposable-DB integration fixture to call real `analyzeStandingBackfill`,
  real `applyStandingBackfill` and real `updateTrustScore`. Do not stub the formula, metrics query
  or writer. Mock external Redis only to a consistent cache-miss behavior for the baseline, then
  test equal effective parameters separately; a stale cache discrepancy must be documented, not hidden.
- [ ] Freeze JavaScript time (preserving real network timers) and keep the fixture DB quiescent.
  Query all resulting trust scores; compute the six buckets independently from stored values and
  compare exact equality with the preflight report. Query eligible profile/community pairs for
  each floor and compare exact counts. Assert the 0-versus-1 golden member rows individually.
- [ ] Snapshot relevant tables before and after preview to prove no writes; run apply and preview
  again to prove no duplicate projection and unchanged distributions at fixed time.
- [ ] Run from `tests/` on the explicitly authorized disposable DB:

```powershell
npx jest --config jest.integration.config.js --runInBand --runTestsByPath integration/sprint-126-standing-backfill.integration.test.ts
```

- [ ] Verification: integration executes (not skipped) and matches real storage. If no safe DB
  environment is available, leave this task blocked and PR C unmerged; continue docs/review work.

## Task 5: Promote tests and update operator/user documentation

**Files:** Service test tiers, CONTEXT, registry notes, ADR-096 and trust guide from map.

- [ ] Promote passing service TDD tests into regression and verify they execute in the blocking
  tier. New integration assertions remain in the existing root integration test because they span
  schema/service boundaries. Run directly after moving to avoid stale Turbo results.
- [ ] Correct the runbook statement that every no-local-history membership must score 0. Explain
  global activity/feedback contributions, report timing/config assumptions and provider counting unit.
- [ ] Add a Recent Fixes entry and reputation registry note for the operator report correction.
  Clarify ADR-096 preview semantics without inventing a new architectural decision or ADR number.
- [ ] Update the existing trust guide's explanation of local and cross-community evidence; regenerate
  landing docs and inspect the page. Keep operational counts and personal scores out of public docs.
- [ ] Verification: `node scripts/gotcha-check.js`, direct doc gate and root standing-projection
  equivalence regression pass; no stale references to the moved TDD path remain in execution commands.

## Task 6: All SDLC gates

**Files:** Full PR C diff and evidence.

- [ ] **Testing:** service unit/regression, actual disposable DB integration and full `npm test`; verify exact counts and real suite execution.
- [ ] **`/simplify`:** one PR pass; verify canonical overlay/metric derivation is readable and reuses existing pure math.
- [ ] **`/code-review`:** independent high-effort review of SQL/input parity, legacy normalization, multi-community counting and time/cache assumptions; resolve findings.
- [ ] **`/security-review`:** verify dry-run performs no mutation, query input remains parameterized, output adds no private row-level disclosure and apply authorization is unchanged.
- [ ] Verification: record all dispositions and data-parity evidence; an integration skip is not a passed gate.

## Task 7: Final type-check and PR preparation

**Files:** Source/docs/tests, handoff, release fields and full PR template.

- [ ] Run reputation `npx tsc --noEmit`; confirm the direct regression and root `npm test` results
  from Task 6, repeating only if subsequent edits invalidate them. Run staged `npm run feedback:check`;
  inspect context/registry updates manually as well.
- [ ] Search for orphaned test-path references, remove generated metadata-only churn and run `git diff --check`.
- [ ] Pre-commit-check before commit; derive release bump at merge time. Push normally and open PR C
  with all template sections, real integration evidence and the explicit no-demo-data-operation scope.
- [ ] Verification: CI gates green, independent review complete, tree clean and exact next action in handoff.

## Task 8: Authorized deployment and sprint retrospective

**Files:** GitHub state, handoff and sprint index checklist.

- [ ] Claude recommends readiness and requests explicit maintainer merge authorization; follow the corrected deploy skill.
- [ ] Wait for deployment/health verification and inspect the rendered trust guide. Confirm compiled
  CLI report behavior on the disposable fixture if using deployed build artifacts; do not apply to demo.
- [ ] Record per-PR review rounds, late CI findings, handoff corrections and ownership/decision waiting
  from actual observations. Recommend at most three improvements and retain the future activation checklist.
- [ ] Verification: all three PR outcomes have evidence, remaining ideas are deferred explicitly,
  and Claude can assess sprint completion. Do not mark a two-machine trial completed.
