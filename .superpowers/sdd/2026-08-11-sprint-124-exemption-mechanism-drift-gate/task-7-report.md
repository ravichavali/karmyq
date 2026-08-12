# Sprint 124 Task 7 — Expo divergence registry and fail-closed gate

## Status

Complete. The rejection-first Task 6 contract is GREEN, the shipped registry validates against
the live mobile manifest, and the shared registry core remains schema-driven.

## TDD evidence

RED was established before production code existed:

```text
cd tests
npx jest regression/sprint-124-expo-divergence-gate --no-coverage

FAIL regression/sprint-124-expo-divergence-gate.test.ts
Cannot find module '../../scripts/expo-divergences'
Test Suites: 1 failed, 1 total
Exit code: 1
```

After the minimal implementation and again after simplification/formatting:

```text
cd tests
npx jest regression/sprint-124-expo-divergence-gate --no-coverage

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
Exit code: 0
```

## Behavior delivered

- Parses all ten rows in the committed pre-bump Expo output, including scoped package names and
  exact installed/expected versions.
- Applies a two-entry registry for the deliberate `jest` and `@types/jest` divergences only.
- Binds the registry to the SDK major derived at run time from `apps/mobile/package.json`; there
  is no maintained SDK constant or calendar expiry.
- Uses `scripts/lib/exemption-registry.js` through an Expo-supplied schema and expiry callback;
  no audit-specific rule was added to the shared core.
- Re-verifies every registry `declared` range against the live mobile manifest and every
  `expoPins` value against parsed arbiter output.
- Returns `{ ok, errors, blocking, cleared, stale }` and fails closed on malformed or unrecognized
  output, malformed/expired/duplicate registry entries, unregistered drift, mismatched live
  values, and registrations that no longer match a current drift.
- Restricts `KARMYQ_EXPO_REGISTRY` to the constant `wrong-sdk` fixture key. Unknown and
  path-shaped values never become filesystem paths.
- Supports `--registry-only` for schema, SDK-expiry, and live-declaration validation without an
  Expo/network invocation.

## Verification commands and output

```text
node scripts/expo-divergences.js --registry-only
✅ Expo divergence registry valid for SDK 57.
Exit code: 0
```

```text
cd tests
npx jest regression/sprint-124-registry-core-parity --no-coverage

Test Suites: 1 passed, 1 total
Tests:       38 passed, 38 total
Exit code: 0
```

```text
node --check scripts/expo-divergences.js
npx prettier --check scripts/expo-divergences.js security/expo-divergences.json

All matched files use Prettier code style!
Exit code: 0
```

An extra, out-of-scope audit-regression run passed 29/32 tests; its three live-report cases could
not contact npm's audit endpoint in the sandbox. Escalation was rejected because it would transmit
dependency metadata. Task 3 already established audit parity, Task 7 changes no audit file, and
the Task 7 brief does not require this network-dependent suite.

## Files

- `scripts/expo-divergences.js` — executable parser, evaluator, registry validation, constant-key
  fixture selector, and Expo check runner.
- `security/expo-divergences.json` — the exact Jest divergence pair and re-verified rationale.
- `.superpowers/sdd/2026-08-11-sprint-124-exemption-mechanism-drift-gate/task-7-report.md` — this
  execution record.

The pre-existing untracked Copilot files under `.github/` were preserved and excluded.

## Simplification and self-review

- Ran Prettier and removed a duplicate mobile-manifest read from the registry-only path so schema
  validation and the success message use one live snapshot.
- Confirmed cleared entries retain registry order, while unregistered drift retains arbiter order.
- Confirmed invalid registry shape returns before subtraction, preventing unsafe reads and
  cascading output.
- Confirmed a non-zero Expo result with zero parsed rows can never become a clean result.
- Confirmed the only environment-selected registry path comes from a constant allowlist value.
- Confirmed the process-reviewer reported no Task 7 findings.

## Concerns

None within Task 7. The blocked optional audit run is an environment limitation documented above,
not a failure in this diff.
