# ADR-088: Test-Tier Truthfulness

**Status**: Proposed
**Date**: 2026-07-30
**Sprint**: 122
**Version**: 11.37.0
**Deciders**: Development Team
**Related**: ADR-029 (TDD Test Framework, amended by this ADR — not superseded), ADR-014 (Testing
Strategy), Sprint 122 PR 2 plan and spec

## Context

A green test result is only useful if it is evidence that the current code was actually
exercised. Four independent mechanisms in the repository let a green result be produced without
that evidence, all measured 2026-07-30 on this branch before repair:

1. **Turbo cache keys did not include test files.** `turbo.json` declared the `test` task's
   `inputs` as `test/**` (singular), but every workspace stores its suites under `tests/`
   (plural). The glob matched nothing that mattered: no `#test` task in the monorepo hashed a
   single test file, jest config, or setup file as part of its cache key. `karmyq-auth-service#test`
   hashed 15 inputs — `package.json` plus 14 `src/**` files, zero tests. Three tasks hashed
   exactly one file (`package.json`), meaning any test change was cache-invisible:
   `@karmyq/mobile#test`, `@karmyq/tests#test`, `geocoding-service#test`. A developer could edit or
   delete a test, and Turbo would replay a cached "pass" from before the edit.
2. **The TDD promoter never walked half the repo.** `scripts/promote-tdd-tests.js` declared an
   `APPS_DIR` constant and never used it — only `SERVICES_DIR` was walked. Root `package.json` runs
   the promoter as `posttest`, so this ran on every green root test invocation without ever
   reaching `apps/`. `apps/landing/tests/tdd/sprint-99-network-visualization.test.ts` had been
   passing and stranded in the WIP tier for that reason: nothing in the promotion path could ever
   see it.
3. **`apps/mobile` claimed an excuse that had gone stale.** Its jest config set
   `passWithNoTests: true` under the comment "until we write mobile tests," while
   `apps/mobile/tests/regression/notification-handler.test.ts` already existed and passed 2/2. The
   flag was silently tolerating a state that no longer existed — a future deletion or rename of
   that file would have gone unnoticed by the tier that is supposed to catch exactly that.
4. **Lint configuration failures are swallowed by design.** CI runs lint as
   `npm run lint --if-present || echo "..."`, so any flat ESLint config that throws on load — a bad
   import, a syntax error, a broken plugin — yields a green job instead of a failure. Four
   workspaces ship an `eslint.config.js` (frontend, landing, mobile, cleanup-service); as measured,
   all four currently resolve (frontend 112 rules, landing 112, mobile 442, cleanup-service 89),
   but nothing in CI would have caught it if one of them stopped loading.

Each defect has the same shape: a tier or gate that looks green for a reason unrelated to the code
under test. None of the four is a test failure — each is a mechanism whose *success signal* had
come unglued from the thing it claims to certify.

## Decision

**A green test result must be evidence that the current code was tested.**

Operationally, this PR establishes and enforces four properties:

- **Cache keys include the package's own files.** `turbo.json`'s `test` task now declares
  `inputs: ["$TURBO_DEFAULT$"]` instead of the `test/**` glob. Measured input counts before → after:
  `karmyq-auth-service#test` 15→38, `@karmyq/mobile#test` 1→50, `geocoding-service#test` 1→13,
  `@karmyq/tests#test` 1→138, `karmyq-frontend#test` (apps/frontend) 225→377,
  `karmyq-landing#test` 32→202. Every `#test` task's cache key now depends on the test files, jest
  config, and setup files it actually runs.
- **Every tier's jest invocation must list exactly the test files present on disk.** A new
  regression gate asserts, per workspace, that the resolved `test` script's tier invocations cover
  the files that exist under that workspace's test directories — tier-agnostic, because the repo
  has two legitimate layouts (tiered `test:unit`/`test:regression`/`test:tdd` scripts in most
  workspaces, and bare `jest` — which runs every tier in one pass — in `cleanup-service`,
  `simulation-service`, `apps/landing`, and `apps/mobile`).
- **Every workspace that can hold `tests/tdd/` is walked by the promoter.** `promote-tdd-tests.js`
  now walks `APPS_DIR` as well as `SERVICES_DIR`. After the fix, 5 tests promoted from `tdd/` to
  `regression/` on this branch: 4 in `apps/frontend`, 1 in `apps/landing` (the previously-stranded
  sprint-99 test).
- **`apps/mobile` no longer claims an excuse it doesn't have**, and any configuration whose failure
  mode is silent gets a blocking gate proven non-vacuous at authoring time — new regression tests
  in `tests/regression/` for the turbo cache-key shape, the per-workspace tier-coverage assertion,
  and the four flat ESLint configs' loadability, plus a blocking **unit**-tier test at
  `tests/unit/promote-tdd-targets.test.ts` for the promoter's directory coverage (the unit tier
  blocks a push exactly as regression does — it just isn't the same directory).

## Why not bulk-delete `--passWithNoTests`

`--passWithNoTests` appears in 8 services plus `apps/frontend` and `tests`, generated in bulk by
`scripts/add-tdd-scripts.js`, and it is explicitly justified in **ADR-029** ("Empty directories
initially… Requires `--passWithNoTests`"). Deleting it repo-wide would fight an Accepted ADR to
close a hazard the flag does not actually cause: the flag only changes jest's behavior when a tier
has zero matching files, which is a legitimate, common state (a service with no `unit/` tests yet
is not lying about anything). The real hazard measured in this sprint was different in kind — a
tier that **has** files on disk whose jest invocation matches **none** of them (the `apps/mobile`
case in Context item 3, and the general case the new coverage gate checks for). Removing
`--passWithNoTests` would not have caught that; asserting coverage does.

For that reason, **ADR-088 amends ADR-029** rather than superseding it: ADR-029's three-tier
structure, promotion model, and pre-push blocking behavior stand unchanged. This ADR adds the
missing invariant ADR-029 didn't state — that a tier's script must actually cover the tier's
files — and fixes the two places (Turbo's cache key, the promoter's directory walk) where that
invariant silently failed to hold.

## `SDK_PINNED` as the committed shadow of `expo install --check`

A related truthfulness gap surfaced in the same audit and is fixed in this PR: the Expo alignment
gate's `expoFamily()` predicate matches only `expo`, `expo-*`, and `@expo/*` packages. That
predicate structurally excludes `react`, `react-native`, `react-native-maps`, and
`react-native-safe-area-context` — exactly the packages Sprint 122 PR 3 proposes moving off their
pinned versions. A gate that cannot see the packages about to change is another green-for-the-wrong-
reason mechanism. `SDK_PINNED` is a committed map that freezes those four packages at the versions
Sprint 121 PR 4 chose (the SDK's own compatibility matrix — what `npx expo install --check` would
assert live), so changing any of their versions now requires editing the map with a written reason,
making the re-decision explicit and reviewable instead of silently passing through a predicate gap.

## Consequences

### Positive Consequences

- A passing `#test` task, a passing tier invocation, a promoted TDD test, and a green lint job are
  all now evidence about the current code, not stale or structurally-blind signals.
- Four new blocking gates in `tests/regression/`, each proven non-vacuous by deliberate injection
  at authoring time (verified independently for each: the old `test/**` glob restored and shown to
  produce blind tasks; a broken tier script restored and shown to leave files uncovered; a missing
  `eslint.config.js` scan restored and shown to miss a new config; an off-pin Expo dependency shown
  to trip `SDK_PINNED`).
- `apps/landing`'s previously-stranded sprint-99 test is now in `regression/`, where a subsequent
  regression on it will actually block a push.

### Negative Consequences

- **`$TURBO_DEFAULT$` widens the cache key.** A README-only edit inside a package now misses that
  package's test cache, where before it would have hit. This is accepted deliberately: a false
  cache miss costs one extra test run; a false cache hit risks shipping a regression behind a
  cached "pass" that predates the change. The asymmetry favors the miss.
- **The TDD promoter is fixed but still `.ts`-only.** `findTestFiles()` in
  `scripts/promote-tdd-tests.js` matches only `*.test.ts`. `apps/frontend/tests/tdd/` holds 72
  `.test.tsx` files against 2 `.test.ts` files, so roughly 97% of that directory remains invisible
  to the promoter even after the directory-walk fix — the walk now *reaches* `apps/frontend`, but
  the file filter still can't see most of what's there. Measured: 67 of 74 frontend `tdd/` suites
  currently pass (442 tests) and would promote today if the filter were extended to `.tsx`.
  **Maintainer decision (2026-07-30): not extended in this PR.** Extending the filter would move
  ~442 tests into the blocking regression tier in a single change, which is a much larger and
  separately-reviewable decision than fixing the directory walk. Logged as
  [`docs/BUGS.md` BUG-033](../BUGS.md), not silently deferred.
- **`services/messaging-service` — a Critical service — has zero test files and declares no `test`
  script.** No tier-coverage assertion can bite on a workspace with nothing to compare against, so
  this PR's coverage gate is silent about messaging-service by construction, not by exemption. A
  "every Critical service has tests" gate is a natural follow-up but cannot land as a blocking gate
  yet, because it would land red on day one; it becomes addable once messaging-service has any
  tests at all. Logged as [`docs/BUGS.md` BUG-034](../BUGS.md).

### Neutral Consequences

- Workspaces using bare `jest` (which runs every tier in one pass — `cleanup-service`,
  `simulation-service`, `apps/landing`, `apps/mobile`) and workspaces using tiered
  `test:unit`/`test:regression`/`test:tdd` scripts are both legitimate layouts under the new
  coverage invariant; the gate is tier-agnostic and treats both as first-class.

## Alternatives Considered

### Alternative 1: Delete `--passWithNoTests` everywhere

- Would make every empty tier a hard failure, including the many legitimately-empty tiers ADR-029
  already accounted for.
- Rejected: fights an Accepted ADR to solve a hazard the flag does not cause; the actual hazard
  (files present, none matched) needs a coverage assertion, not flag removal.

### Alternative 2: Extend the TDD promoter to match `.test.tsx` in this PR

- Would immediately promote 67 of 74 `apps/frontend` `tdd/` suites (442 tests) into the blocking
  regression tier.
- Rejected for this PR: the resulting blocking-tier size increase is a separate, larger decision
  that deserves its own review rather than riding in as a side effect of fixing the directory walk.
  Logged as a follow-up.

### Alternative 3: Add a blocking "every Critical service has tests" gate now

- Would immediately fail on `services/messaging-service`, which has zero test files today.
- Rejected: a blocking gate cannot land red. This becomes addable once messaging-service has any
  test files to assert coverage over.

### Alternative 4: Widen `expoFamily()` instead of adding `SDK_PINNED`

- Broadening the predicate to catch `react`/`react-native`/`react-native-maps`/
  `react-native-safe-area-context` would require hardcoding non-`expo`-namespaced package names
  into a family matcher, which is fragile as the pinned set changes.
- Rejected in favor of an explicit, committed map (`SDK_PINNED`) that names exactly the packages
  and versions Sprint 121 PR 4 pinned, making future changes an explicit, reviewable edit rather
  than a predicate-matching exercise.

## Implementation Notes

- Files affected: `turbo.json`; `scripts/promote-tdd-tests.js`; `apps/mobile/jest.config.js`; four
  new gates under `tests/regression/` — `sprint-122-turbo-test-inputs.test.ts`,
  `sprint-122-tier-parity.test.ts`, `sprint-122-lint-config-gate.test.ts`, and
  `sprint-122-expo-sdk-alignment.test.ts` (with its new `SDK_PINNED` map) — plus one new gate at
  `tests/unit/promote-tdd-targets.test.ts` for the promoter's directory coverage.
- All four repaired mechanisms and their gates were verified non-vacuous by injecting the original
  defect and confirming the gate goes red, then restoring the file to a byte-identical state.
- Follow-ups logged in `docs/BUGS.md`: **BUG-033** (the `.tsx` gap in the TDD promoter's file
  filter) and **BUG-034** (`services/messaging-service` has zero test coverage; the future "every
  Critical service has tests" gate is pending its coverage).

## References

- [ADR-029: TDD Test Framework](ADR-029-tdd-test-framework.md) — amended by this ADR, not superseded
- [ADR-014: Testing Strategy (Integration + E2E + Unit)](ADR-014-testing-strategy.md)
- Sprint 122 PR 2 plan and spec (`.superpowers/sdd/2026-07-30-sprint-122-pr2-test-tier-truthfulness/`)
- [`scripts/promote-tdd-tests.js`](../../scripts/promote-tdd-tests.js)
- [`turbo.json`](../../turbo.json)
- [`docs/guides/testing-guide.md`](../guides/testing-guide.md)
