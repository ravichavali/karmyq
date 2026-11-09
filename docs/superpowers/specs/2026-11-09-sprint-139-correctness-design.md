# Sprint 139: Offer Visibility, Trust Values and Test Truth — Design Spec

**Date:** 2026-11-09

**Status:** Review corrections incorporated; decisions 1 and 7 and full design approval pending

**Version:** v11.111.0 → v11.112.0, provisional; re-derive from origin/master at merge time

**Sprint Branch:** `agent/claude/sprint-139-planning`

## Overview

Bundle six recorded bugs into one PR: BUG-097 (offer expiry visibility), BUG-076 (false-green TDD reporting),
BUG-092 (WIP tests blocking two services), BUG-080 (provider completion denominator), BUG-081 (numeric trust
values returned as strings), and BUG-082 (routine SQL output crowding out useful logs). These are corrections
to existing features, not a new product surface.

The maintainer selected options 4 and 5 from the handoff, covering all six bugs. For BUG-080, the maintainer
explicitly chose **completed / (completed + cancelled), excluding ongoing matches**. The detailed choices
below are planner recommendations for review, not additional decisions attributed to the maintainer.

### Core Principle: Represent the outcome honestly

Visibility should reflect the viewer's relationship to an offer; trust values and test messages should mean
what their types and labels promise.

## Decisions required before Task 1 (maintainer review)

1. **Offers page and expiry display:** source tracing confirms the list page assigns `response.data.data`
   (`apps/frontend/src/pages/offers/index.tsx:43`–44), but the interceptor unwraps the envelope
   (`apps/frontend/src/lib/api.ts:81`–91) and the actual payload is `{ offers, count, total }`
   (`services/request-service/src/routes/offers.ts:69`–73). The page would need `response.data.offers`;
   its later `.length` is not safe after the current assignment. This was traced from source, not observed
   in a browser. The list also omits expiry fields, so an expired active owner offer would still display
   Active. **Recommendation: bundle the page repair, additive `expired` / `expires_at` fields, expiry-aware
   card labels and data-on-mount tests.** Alternative: defer/log the page defect and remove guide claims about
   visible offer-list behavior. The no-shape-change/no-frontend constraints below are not silently relaxed:
   resolve this decision and update both documents before execution. No new bug ID is allocated in planning.
7. **Completion refresh:** the approved denominator does not approve refresh timing. Completion-only refresh
   permits a provider who cancels and never completes again to keep a favourable stale rate indefinitely.
   Either explicitly accept that limitation for this sprint or choose and specify a refresh policy with its
   tests and scope before Task 1. **Recommendation: settle the refresh policy rather than imply current
   cancellation reliability.** Do not add consumers, cron work or synchronous cross-service calls by inference.

Questions have been presented to the maintainer; neither answer nor full design approval is assumed.

## Verified baseline

Fetched origin and queried `gh pr list` on 2026-11-09: origin/master is `74c5a8e5` (#331), no PRs are open.
This branch starts execution from the Sprint 138 post-merge documentation commit `377efa5a` plus this
planning commit. This is a dated observation, not a reservation of a merge slot or another machine's files.

| Existing behavior | Evidence, read before planning |
|---|---|
| Every offer status is filtered by expiry | `services/request-service/src/routes/offers.ts:39`–42; audience SQL at :18 |
| Hook tests the exit of `tail`, not npm | `scripts/git-hooks/pre-push:88`; source installation is `scripts/install-hooks.sh:138`–177 |
| Root TDD script names an undefined Turbo task | `package.json:20`; task map `turbo.json:6`–35 |
| Cleanup and simulation default tests include WIP | `services/cleanup-service/package.json:12`, `jest.config.js:8`; `services/simulation-service/package.json:16`, `jest.config.js:5` |
| Both provider recalculation paths count accepted + completed | `services/reputation-service/src/services/providerTrustService.ts:65`–99 and :113–151 |
| Provider metric refresh is completion-driven or explicit backfill | `services/reputation-service/src/events/subscriber.ts:74`–79; `src/routes/providerReviews.ts:126`–142 |
| Community depth/breadth and user overrides pass through raw NUMERIC values | `services/reputation-service/src/database/trustConfigDb.ts:50`–51; `src/database/trustEvolutionDb.ts:25`–36 |
| Redis returns unchecked JSON for four hours | `services/reputation-service/src/services/effectiveParamsCache.ts:11`, :49–70 |
| Five db wrappers log every successful query unconditionally | auth/community/request `src/database/db.ts:26`, notification :19, reputation :40 |
| Existing shared logger defaults to info and supports debug | `packages/shared/utils/logger.ts:39`–54; cleanup already uses debug in `src/database/db.ts:20` |
| Unit/regression coverage gate tolerates extra WIP tests | `tests/regression/sprint-122-tier-parity.test.ts:10`–26; this sprint adds a focused exclusion proof |

The fixture manifest still contains a legacy `accepted` match (`services/simulation-service/src/fixtures/curatedDemo/manifest.ts:266`);
the compiler copies `matchStatus` into the compiled match (`compiler.ts:210`–215). Do not count it as a terminal
outcome or repair demo data as part of this sprint.

## Scope and non-goals

One branch, one bundled PR. No dependency additions, upgrades, override changes or lockfile resolution;
script-only manifest edits and the three root version fields are permitted by the plan. No schema changes,
new queue/consumer, new endpoint, frontend/mobile feature, background backfill, or demo-host operation.
Do not work on #329 or dismiss alerts. Re-check #178 at the next Expo SDK move or by **2026-12-01**.

The mobile sprint, exchange-cancellation UI, communication-channel discussion, Sprint 138's F3/F4/F8/F9,
and unrelated cleanup remain unscheduled. Do not add a global PostgreSQL NUMERIC type parser.

## A. BUG-097 — visible history without reopening expired offers

Retain `o.status = $1`, parameterized filtering, sorting, pagination and `offerReadableSql` unchanged.
Replace only the unconditional expiry conjunction with:

```sql
AND (
  o.status <> 'active'
  OR o.offerer_id = $2
  OR (o.expired IS NOT TRUE AND (o.expires_at IS NULL OR o.expires_at > NOW()))
)
```

This is the planner's proposed interpretation of the bug's two symptoms:

| Viewer / requested status | Flagged or elapsed expiry | Expected list result |
|---|---|---|
| Owner / active (including default) | Either | Included while row exists |
| Other current community member / active | Either | Excluded |
| Other current community member / active | Neither; expiry NULL is allowed | Included |
| Owner or current member / matched or other requested non-active status | Either | Included if status matches |
| Unrelated, former or pending member who is not owner | Any | Excluded for every status |

The outer audience predicate is mandatory: the non-active branch must never bypass it. Visibility is
not eligibility. All existing expiry checks on creating/accepting/holding a match remain; an expired
offer visible to its owner cannot be used for a new commitment. No new owner-list flag is needed.
Do not change single-offer status labeling (parked F3), response shape or retention.

## B. BUG-076 and BUG-092 — truthful, nonblocking WIP reporting

Add the `test:tdd` task to Turbo with `cache: false`, `dependsOn: ["build"]`, and `outputs: []`, like the
existing test task. Shared logger subpaths resolve to `packages/shared/dist` (`packages/shared/package.json:14`–17);
reputation's Jest mapper covers only the bare shared import (`services/reputation-service/jest.config.js:36`).
A clean checkout must build the required runtime outputs before WIP tests. Do not depend on blocking test tasks.
Use root `test:tdd = turbo run test:tdd --continue=always` so a failed workspace does not suppress reports
from the rest. The installed Turbo CLI's `run --help` was checked in this planning chat and lists `always`.
Individual workspace failures must still make the root command nonzero.

In the source hook, create a unique log with `mktemp` under the OS temporary directory, run
`npm run test:tdd > "$tdd_log" 2>&1` in an `if` block, and preserve npm's exit status independently of display.
Print only the last 20 log lines plus the full log's path and actual exit code. Keep that file for inspection;
do not delete it on hook exit. Do not pipe npm into tail or change shell-wide error semantics. Log creation
failure reports a warning and skips WIP reporting, never a success. Failure to print the tail cannot turn a
failed TDD run into a pass. A success message requires npm exit 0. A failed command, missing task/build or
test failure prints a warning but does not block a push whose required unit/regression checks passed.
An earlier required-check failure still blocks the push. Use no fixed log filename or repo-local log.

Give cleanup and simulation these scripts:

```json
{
  "test": "npm run test:unit && npm run test:regression",
  "test:unit": "jest --testPathPatterns=tests/unit/ --passWithNoTests",
  "test:regression": "jest --testPathPatterns=tests/regression/ --passWithNoTests",
  "test:tdd": "jest --testPathPatterns=tests/tdd/ --passWithNoTests"
}
```

Their Jest configs explicitly discover unit, regression and tdd files; default script selection excludes
tdd and integration. Cleanup's inherited root patterns currently include integration: remove the spread
of those patterns. An explicit integration configuration/command stays separate. Before narrowing simulation's
default selection, move its existing passing `tests/tdd/sprint-134-demo-env-file.test.ts` to regression and
prove all 17 tests still block a default test run. Do not sweep unrelated workspaces' WIP into this sprint.

Root `package.json:17` registers the repo-wide promoter as `posttest`; `scripts/promote-tdd-tests.js:99`–115
can move every passing service/app WIP file. This checkout currently reports `npm config get ignore-scripts`
as true, so whether the lifecycle fires depends on the invocation/environment. Never rely on that setting
as containment. Before each full `npm test` (including pre-commit-check), snapshot WIP locations/bytes and
landing output; afterward inspect `git status`, retain only intended sprint promotions and restore unrelated
moves and generated metadata churn from that snapshot. Do not restore from HEAD over uncommitted test edits.
The simulation protection test's deliberate promotion is retained. Sprint 139 tests may promote as soon as
they pass; the final promotion task verifies they all became blocking, and explicitly moves any remaining
green files when the lifecycle did not run. It is not a promise to delay promotion until Task 11.

Test the real hook in an isolated temporary Git repository using the existing pre-push runner fixture
approach, with local fake npm/node commands that control only subprocess outcomes. Separately ask real
Turbo and Jest for task/test discovery, and execute synthetic failing/successful tiers in temporary copies.
No test may push this checkout or contact a remote host.

## C. BUG-080 — terminal-outcome completion rate

For each responder user, across their match history, calculate:

```
denominator = count(status IN ('completed', 'cancelled'))
numerator   = count(status = 'completed')
rate        = denominator > 0 ? round(numerator / denominator * 100, 2) : 0
```

Ignore proposed, matched, rejected, declined, legacy accepted and unknown statuses. Count cancelled rows
regardless of which participant cancelled; the current data does not encode fault, so this is an outcome
ratio rather than a blame score. Keep the current responder-wide scope: all active provider profiles
owned by that responder receive the same history-derived rate. Do not introduce service-type filtering.

Introduce one internal helper in `providerTrustService.ts`,
`readProviderCompletionRate(userId: string): Promise<number>`, shared by the completion update and full
backfill paths. Rename misleading local `accepted` counts to `terminal_matches`. Keep existing public
exports, the 60/30/10 overall score formula, response-rate behavior and review semantics.

Examples: no terminal matches → 0; one completed and any number of ongoing → 100; two completed and
one cancelled → 66.67; only cancelled → 0. A fixture with 5-star reviews, response rate 0 and rate 66.67
must persist trust score 80 through the real implementation, not a test-only duplicate formula.

**Proposed refresh contract — requires decision 7:** metric updates still happen on the responder's next completion or the existing
admin backfill endpoint. Reviews recompute the score using the stored metric. Cancellation alone does
not trigger a refresh, and deploy does not rewrite existing scores. This limitation has not been accepted by
the maintainer; settle decision 7 before implementation and revise this contract if needed. Backfill execution
against the demo requires separate explicit authorization; do not invoke it during this sprint's execution.

## D. BUG-081 — numeric values at the database and cache boundaries

Normalize `getCommunityTrustConfig` depth/breadth weights to numbers, using existing defaults for NULL
and preserving zero. Normalize `getUserTrustConfig` depth/breadth weights to numbers or NULL (NULL
means inherit), and cross-community prior to a number. Preserve booleans, identity fields and the
no-row result. Also normalize the sibling `getCommunityEvolutionConfig` cross-community prior, which
has the same raw-row defect (`trustEvolutionDb.ts:110`); preserve its existing missing-row defaults.

Use null checks before conversion; do not turn NULL into zero or truthy-fallback a legitimate community zero.
Zero is a community-weight case only. User depth/breadth overrides permit 0.10–0.90 or NULL, and user prior
permits 0.05–0.95 (`infrastructure/postgres/init.sql:2275`–2286); never insert zero user overrides in integration
fixtures. Use legal nonzero user overrides and NULL inheritance instead.
Leave the existing BUG-079 use-site defense in place. The database constraints govern valid values;
this change does not introduce new range policy or evolution defaults.

`getCachedEffectiveParams` must normalize old string-valued cache hits on read, so there is no four-hour
mixed-format deployment window. Add an internal `normalizeCachedEffectiveParams(value: unknown)`
returning the exact three numeric fields or NULL. Accept finite number values; accept string values only
when they match `^-?\d+(\.\d+)?$` and convert to a finite number. Do not trim strings into acceptance:
reject whitespace-padded values, exponent notation, hex, leading plus, `.6` and `1.`. For example, `'0.60'`
is valid, while `'0x1A'`, `' 1e2 '`, `'1e2'` and `' 0.60 '` are invalid. Reject absent/NULL fields,
arrays, booleans, blank strings, malformed JSON and nonfinite values.
Invalid entries follow the existing DB fallback and replacement path. Valid legacy entries may be
returned normalized without rewriting Redis; their TTL is unchanged. Cache outage remains nonfatal.
No key migration, cache flush or host command.

### Modified API behavior

| Method / path | Change | Authorization / response envelope |
|---|---|---|
| GET `/offers` | Viewer/status-specific expiry behavior above | Existing owner/current-member audience, same fields |
| GET `/reputation/trust-config/:userId/:communityId` | Numeric user overrides and effective parameters; nullable overrides remain NULL | Existing self + live membership, same envelope |
| GET `/reputation/users/:userId/effective-params?communityId=` | Three numeric values on cold and warm/legacy cache paths | Existing self + live membership, same envelope |
| GET `/reputation/communities/:communityId/trust-evolution` | Sibling cross-community prior is numeric | Existing route access remains unchanged |
| Existing provider-score reads / backfill | Correct rate after existing refresh triggers | Existing route authorization remains unchanged |

Inspect the full route and every caller before coding; this table specifies behavior, not permission to
weaken disclosure guards. Existing consumers multiply these values (`docs/BUGS.md:2251`–2257); the wire
type correction must be documented even when their displayed value is unchanged.

## E. BUG-082 — routine SQL diagnostics at debug level

In auth, community, request, reputation and notification `src/database/db.ts`, instantiate the existing
`createLogger('<service-name>')` from `@karmyq/shared/utils/logger` and change the routine success output
to `logger.debug('Executed query', { text, duration, rows })`. Keep the existing SQL text, elapsed timing
and row count; never add query parameter values. Default info emits no routine query line; LOG_LEVEL=debug
opts in. Keep database connection, startup, failure and rollback logs; preserve rejected-error identity.
Reputation's AsyncLocalStorage executor and all transaction boundaries remain unchanged. Use `debug`, not
the existing `logger.query()`: that helper truncates SQL at 100 characters, emits two records when given a
duration and omits row count unless supplied separately (`packages/shared/utils/logger.ts:194`–200).

Cleanup already follows this level policy; no runtime change there for logging. No shared logger change,
new environment variable, logging framework, transport, Docker rotation or dependency declaration is needed.
Each of the five services already imports the same logger from its entry point (verified in `src/index.ts`).

This is a cross-service policy correction, documented by an amendment to existing ADR-015. The trust
metric decision amends ADR-042; tier behavior clarifies ADR-029/088. No new ADR number is allocated.

## Data Model and Frontend Changes

No DDL or migration. Existing `reputation.provider_trust_scores` values change only when existing refresh
entry points run. No frontend/mobile source or onboarding workflow changes; existing HTTP clients retain
their response shapes and authorization. No generated SQL or generated docs are authored by hand.

## User Guide & Doc Updates

- `docs/guides/fulfilling-requests-guide.md`: correct “expired standing offer leaves your list”; distinguish
  owner visibility, ongoing commitments and refusal of new holds.
- `docs/guides/using-service-providers-guide.md`: Reviews and Trust explains terminal-outcome denominator,
  zero history, non-fault cancellation treatment and refresh lag without implying response-rate tracking.
- `docs/guides/testing-guide.md`: cleanup/simulation are tiered; TDD reports use real exit status and do
  not block; remove their obsolete bare-Jest endorsement. Preserve other workspaces' descriptions.
- `docs/concepts/observability.md`: debug query logging and unchanged operational errors; derive service
  count from the registry rather than preserving its stale “11 services” wording.
- `docs/adr/ADR-015-observability-stack.md`, `ADR-042-provider-trust-score.md`, `ADR-029-tdd-test-framework.md`,
  `ADR-088-test-tier-truthfulness.md`: dated amendments, keeping existing decision history.
- `scripts/git-hooks/README.md` and `scripts/claude.md`: source/installed hook path, explicit hook install
  after edits, actual TDD reporting; correct the adjacent obsolete automatic-install statements.
- CONTEXT notes in auth, community, notification, request, reputation, cleanup and simulation; registry
  descriptions for offers and trust numeric/metric contracts. No invented event or dependency edges.
- `docs/BUGS.md`: mark the six bugs fixed only during execution after proofs exist, not in this planning chat.
- Regenerate landing docs from source; no new page/navigation group is required for these existing pages.
  Revert only timestamp/HEAD metadata noise, keeping substantive regenerated changes.

## Acceptance and tests

| Area | Required evidence |
|---|---|
| Offers | Real SQL/HTTP audience + status + expiry matrix, including owner's expired active offers, current-member expired matched offers, former/pending/outsider denial, and NULL/future/equal/past expiry; same expired visible offer still rejected by hold path |
| TDD hook | Real installed hook with pass, failing WIP, missing-task/build and failing required tier; bounded tail plus retained unique log and true exit status; required failures remain blocking |
| TDD selection | Both services' real Jest discovery includes every blocking file, excludes WIP/integration by default, and explicit TDD discovers WIP; synthetic red WIP does not fail default test, red blocking file does |
| Turbo | Real dry-run includes build prerequisites; temporary clean-output run resolves shared imports; later WIP tasks still run after a task/build failure with aggregate nonzero |
| Completion | Real SQL status mixture and public completion/backfill entry points agree; responder isolation, multiple profiles, inactive exclusion, zero denominator, 2/3 rounding and resulting score 80 |
| Numeric | Direct readers (pg-like string rows), NULL/no-row and community-only zero behavior, legal user-override fixtures, strict decimal legacy/malformed cache, Redis outages and unchanged route denials |
| Logging | Each changed wrapper with a mocked pg executor but real logger: quiet at default/info, structured debug record, same SQL/params/result and same thrown error; reputation transaction query uses the transaction client |

New service tests start in that service's `tests/tdd/`, run red before source edits, and move individually
to regression after green (automatically when lifecycle scripts run, otherwise explicitly). Repo-wide hook/tier gates go directly in `tests/regression/` under the exception
in `tests/claude.md:31`–36. Real DB cases go in root integration; no infrastructure is a failure, never
a skip. On this Windows host real DB validation is CI-only unless separately authorized infrastructure
is supplied. Do not use the demo to fill that gap.

## Critical Implementation Notes

1. Reuse `agent/claude/sprint-139-planning`; one editor, no worktrees, rebase, force-push or master push.
2. Planning/review chats change documents only. Resolve review decisions 1 and 7 and obtain full design approval before implementation in the next chat.
3. Preserve offer audience outside the expiry OR; owner visibility never grants permission to hold an expired offer.
4. Completion rate is completed / (completed + cancelled), rounded to two decimals; ongoing and legacy accepted rows are excluded. The proposed completion-only refresh still needs decision 7; no demo backfill is authorized.
5. Normalize DB/cache numbers with strict decimal-string validation; preserve NULL inheritance and community zero, use legal user overrides, and retain disclosure guards.
6. Fix the source pre-push hook, then reinstall it. Capture true TDD exit status in a unique retained temp log; show its last 20 lines and path. WIP failures never block required-green pushes.
7. Register uncached Turbo TDD execution with build prerequisites; prove clean-output imports, discovery and failure propagation against real tools.
8. SQL success logging moves to existing debug loggers in all five affected services; transactions, errors and parameters are unchanged. Amend existing ADRs; allocate no new number.
9. New service tests begin in their own tdd tier; root invariant gates are the exception. Preserve simulation's 17-test protection suite in regression; reconcile promoter moves and landing churn after every full test run.
10. No dependency work, merges, dismissals or demo-host operations without separate explicit authorization. #329 stays open; #178 is due by 2026-12-01.
11. Regenerate landing docs from source and remove only generated metadata noise. Re-derive the version from origin/master at merge time.
12. Execution runs testing, /simplify, /code-review and /security-review, updates the handoff, pushes one PR and stops at PR creation.
