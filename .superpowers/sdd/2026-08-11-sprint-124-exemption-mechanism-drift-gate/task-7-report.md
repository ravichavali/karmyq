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

## Fix round 1 — complete Expo output and process-status validation

Resolved the Critical review finding that recognized registered rows could hide a partially
unrecognized drift block or an abnormal Expo process result.

### Root cause and behavior change

The original parser extracted matching rows from anywhere in the output and silently skipped every
other line. `evaluate()` rejected a non-zero result only when zero rows parsed, and
`runExpoCheck()` changed a signal-terminated spawn's `null` status into ordinary drift status `1`
while discarding the signal. A manual reproduction returned `ok: true` for all three reported
inputs: a malformed `expo-camera` row after both registered Jest rows, exit status `2` with both
registered rows, and a `SIGTERM` result with those rows.

The parser now requires one exact Expo drift header, the compatibility guidance line, the final
`Found outdated dependencies` footer, and a recognized package row for every line inside that
block. Evaluation accepts only status `0` for no drift or documented status `1` for a complete
drift block, rejects all signals and unexpected/null statuses, and rejects a drift block paired
with status `0`. The spawn adapter preserves both raw `status` and `signal`.

### TDD RED

Added regression cases before changing production code for a partially changed row, missing
header/footer framing, exit status `2`, and `SIGTERM` termination.

```text
cd tests
npx jest regression/sprint-124-expo-divergence-gate --no-coverage

Test Suites: 1 failed, 1 total
Tests:       5 failed, 22 passed, 27 total
Exit code: 1
```

All five failures were the intended `Expected: false, Received: true` result against the original
gate.

### GREEN verification

```text
cd tests
npx jest regression/sprint-124-expo-divergence-gate --no-coverage

Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
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
node scripts/expo-divergences.js --registry-only
✅ Expo divergence registry valid for SDK 57.
Exit code: 0
```

Supporting self-review probes confirmed that status `0` with a drift block and `null` status
without a signal also return `ok: false`. The registry contents and constant-key fixture selector
are unchanged, and the pre-existing Copilot files remain untouched.

### Process-review follow-up

The first fix-round process review caught two remaining proof gaps: nonblank content after the
nominal final footer was ignored, and the signal regression injected directly into `evaluate()`
without proving that `runExpoCheck()` preserved the spawn result. Both are now covered.

The trailing-content test restored RED for the exact residual false green:

```text
cd tests
npx jest regression/sprint-124-expo-divergence-gate --no-coverage

Test Suites: 1 failed, 1 total
Tests:       1 failed, 28 passed, 29 total
Exit code: 1
```

The parser now rejects every nonblank line after the final footer. The adapter regression isolates
the real `runExpoCheck()` module with a simulated signal-terminated spawn, asserts the raw
`{ status: null, signal: 'SIGTERM' }` result, and passes that result through fail-closed evaluation.

Final verification after both corrections:

```text
cd tests
npx jest regression/sprint-124-expo-divergence-gate --no-coverage

Test Suites: 1 passed, 1 total
Tests:       29 passed, 29 total
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
node scripts/expo-divergences.js --registry-only
✅ Expo divergence registry valid for SDK 57.
Exit code: 0
```
