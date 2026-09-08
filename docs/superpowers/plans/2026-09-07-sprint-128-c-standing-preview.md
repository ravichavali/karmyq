# Sprint 128 PR C: Truthful standing preview — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` sequentially. Prove the reproduction before choosing a fix.

**Goal:** Make the backfill preview agree with actual trust-score refresh and provider reach semantics.
**Architecture:** Derive preview metrics from the projected canonical karma state, retaining the existing pure score and feedback functions. Verify against the real DB writer.
**Tech stack:** TypeScript, Jest, PostgreSQL; existing reputation service and operator CLI.
**Spec:** `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`, PR C.
**Branch:** `agent/codex/sprint-128-standing-preview`, created after PR A deploy verification; C is third.
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

## Task 1: Provision isolated test dependencies and pass the baseline — hard entry gate

> ⛔ **BLOCKED: D1 was not approved on 2026-09-07.** Plan review found that the resource names
> below all contain `karmyq-`, and `scripts/deploy.sh:227` runs
> `docker ps -aq --filter "name=karmyq-" | xargs -r docker rm -f` — a substring match. Any deploy
> landing mid-run force-removes these containers, and the parity suite reports that as connection
> errors indistinguishable from a real preview-versus-writer mismatch. **Do not provision under
> these names.** Re-request D1 with all three resources renamed off the `karmyq-` prefix
> (`s128-preview-pg`, `s128-preview-redis`, `s128-preview-net`) plus a post-run assertion that the
> containers still exist, so a mid-run removal reports as an environment failure rather than a test
> result. `deploy.sh:225` and `:326` were checked and do not reach these resources.

**Files:** File map plus service `.claude/README.md`, `CONTEXT.md`, `tests/claude.md`, scoped gotchas.

- [ ] Confirm PR A deployed and checkout is clean; fetch and create this branch from `origin/master`.
- [ ] Read the existing integration fixture before any baseline run: its `beforeAll` calls
  `seedWorld` and `wipe` deletes fixture rows; it has no strong target guard
  (`tests/integration/sprint-126-standing-backfill.integration.test.ts:21`, `:155`). Read
  `infrastructure/claude.md` and the generated schema header before provisioning/loading schema.
- [ ] **Do not start Task 2/3 until this task passes.** Resolve spec decision D1 for the named
  provisioning/schema/fixture/test/teardown operation. Reuse an explicit recorded approval for
  that exact scope; if absent, request it before writing to the shared server.
- [ ] Recheck the September 7 read-only findings: PostgreSQL/Redis images exist, names
  `karmyq-s128-preview-pg`, `karmyq-s128-preview-redis` and network `karmyq-s128-preview-net` are
  unused, loopback ports 55438/63808 are free, and capacity/deploy state permits the bounded run.
  Abort on collisions; never remove/reuse an existing resource to make the recipe work.
- [ ] Follow this named mechanism, adapted from the verified Sprint 126 archive at lines 254–273:
  create a dedicated Docker bridge network with label `karmyq.task=sprint128-preview`; create only
  the two containers below on it, without attaching any existing network/volume or loading a demo dump.
  All data stays on temporary container storage. Generate credentials privately for this operation;
  do not use demo credentials, echo connection URLs, or commit passwords.

| Resource | Configuration |
|---|---|
| `karmyq-s128-preview-pg` | Existing `postgres:15-alpine`; label `karmyq.task=sprint128-preview`; host `127.0.0.1:55438` → 5432; user/database `karmyq_s128_preview`; 768 MiB RAM, 1 CPU; tmpfs at `/var/lib/postgresql/data` limited to 512 MiB |
| `karmyq-s128-preview-redis` | Existing `redis:7-alpine`; same task label; host `127.0.0.1:63808` → 6379; 128 MiB RAM, 0.25 CPU; private password; persistence disabled; temporary `/data` storage |
| `karmyq-s128-preview-net` | New task-labeled bridge used only by these test containers |

- [ ] Wait for container health using `pg_isready`/authenticated Redis ping. Stream the current
  repository's `infrastructure/postgres/init.sql` into `docker exec -i karmyq-s128-preview-pg psql
  -v ON_ERROR_STOP=1 -U karmyq_s128_preview -d karmyq_s128_preview`; never copy the live DB or
  run the full-stack demo compose file. Verify the source checksum and fail on schema-load errors.
- [ ] Open a foreground SSH tunnel, or a hidden background process with recorded PID, using the
  exact forwards below (on Windows, `Start-Process` must use `-WindowStyle Hidden`):

```text
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:55438:127.0.0.1:55438 -L 127.0.0.1:63808:127.0.0.1:63808 ubuntu@karmyq.com
```

- [ ] Set `DATABASE_URL` and `REDIS_URL` only in the test process, using the generated test
  credentials and the two forwarded loopback ports. Verify parsed host/port/database values before
  importing/running the integration suite. Query `current_database()` and `current_user` and
  compare both to `karmyq_s128_preview`; verify the corresponding Docker container IDs/task labels
  and port mappings. Do not rely on the suite's fallback URL or `.env.test` to choose a safe target.
- [ ] Run the unmodified baseline from `tests/` with both DB and Redis explicitly configured:

```powershell
npx jest --config jest.integration.config.js --runInBand --runTestsByPath integration/sprint-126-standing-backfill.integration.test.ts
```

- [ ] Require exit 0 without `--forceExit`, healthy dependencies and clean connection teardown.
  Record the selected container IDs/schema checksum and baseline result. An unavailable or red
  environment blocks PR C implementation here, not after the code is written.
- [ ] Read the live score writer and its DB helpers end-to-end, including cache behavior; compare
  its inputs to `calculateDistributions`. Record the exact divergent inputs, not just output totals.
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
export interface PreviewIndex {
  readonly byPair: ReadonlyMap<string, {
    readonly canonicalTimestamps: readonly number[]; // sorted ascending, multiplicity retained
    readonly repeatPairs: number;
    readonly distinctPeople: number;
  }>;
  readonly communitiesByUser: ReadonlyMap<string, number>;
}
export function buildPreviewIndex(rows: readonly PreviewKarmaRow[]): PreviewIndex;
export function computePreviewMetrics(
  index: PreviewIndex, userId: string, communityId: string, nowMs: number,
): PreviewMetrics;
```

- [ ] Add this first red test against the proposed helper:

```typescript
import { buildPreviewIndex, computePreviewMetrics } from '../../src/services/standingPreview';
it('retains global breadth for a membership with no local history', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  const rows = [
    { user_id: 'u', community_id: 'c1', reason: 'Provided help', related_entity_id: 'm1', created_at: new Date(now) },
    { user_id: 'v', community_id: 'c1', reason: 'Received help', related_entity_id: 'm1', created_at: new Date(now) },
  ];
  const index = buildPreviewIndex(rows);
  expect(computePreviewMetrics(index, 'u', 'c2', now)).toEqual({
    recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 1,
  });
  expect(computePreviewMetrics(index, 'idle', 'c2', now)).toEqual({
    recentInteractions: 0, repeatPairs: 0, distinctPeople: 0, distinctCommunities: 0,
  });
});
```

- [ ] Add cases for canonical reason filtering, 365-day inclusive boundary, null match identity,
  multiple community rows for one match, two matches with one counterparty, globally unrelated
  canonical history and no mutation of input rows. Test many membership lookups from the same
  index, varying `nowMs` at the 365-day boundary. Build through a `Proxy.revocable` view of the
  input, revoke it after construction, then perform lookups to prove the index is materialized
  rather than retaining/rescanning the input array.
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
  counterpart row to the local community when SQL does not. `buildPreviewIndex` materializes global
  community counts, user/community metrics, match participant sets and sorted local timestamps.
  Build it exactly once after constructing each projected dataset, before iterating memberships.
  `computePreviewMetrics` uses map lookups plus lower-bound binary search for recent row count;
  it must not receive raw rows, rebuild indexes, or repeat counterpart joins per membership.
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

- [ ] Preserve `providerEligibility` keys 1/20/40/60 and its intentional fixed-floor what-if meaning.
  Live reach uses the configured community floor. `PROVIDERS_QUERY:236–247` already matches the
  four non-score reach filters; expect no filter change. Any proposed filter change needs a separate
  reproduced defect and review, not this score-input diagnosis.
- [ ] Document the unit as provider-profile/community pairs keyed by `provider_id|community_id`.
  Add a fixture where one user has two profiles in one community: both count. Exercise active/inactive profile/member,
  disabled/missing config, empty/restricted service list, missing score, multi-community providers,
  and scores exactly equal to each threshold. Compare against actual request reach SQL semantics.
- [ ] Extend the existing disposable-DB integration fixture to call real `analyzeStandingBackfill`,
  real `applyStandingBackfill` and real `updateTrustScore`. Do not stub the formula, metrics query
  or writer. Use the isolated real Redis from Task 1 with controlled cold/warm cache states and
  equal effective parameters; a stale cache discrepancy must be documented, not hidden.
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

- [ ] Verification: integration executes (not skipped) and matches real storage. Task 1 already
  established the environment; if it subsequently fails, pause dependent work, retain failure
  evidence and use only the approved named-resource recovery/teardown scope. PR C remains unmerged.

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
- [ ] Tear down the D1 resources after testing: verify names, recorded IDs and
  `karmyq.task=sprint128-preview` labels before removing only the two created containers and their
  dedicated network; close only the recorded SSH tunnel process and remove private test credentials.
  Repeat read-only application-container/health checks to confirm the shared host remains healthy.
  No broad Docker prune, compose down, volume deletion or demo-container restart.
- [ ] Record per-PR review rounds, late CI findings, handoff corrections and ownership/decision waiting
  from actual observations. Recommend at most three improvements and retain the future activation checklist.
- [ ] Verification: all three PR outcomes have evidence, remaining ideas are deferred explicitly,
  and Claude can assess sprint completion. Do not mark a two-machine trial completed.
