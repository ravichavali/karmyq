# ADR-094: Generalized Exemption Registries

**Date**: 2026-08-11
**Status**: Implemented
**Deciders**: Ravi Chavali (maintainer)
**Related**: [ADR-059](ADR-059-dependency-security-gate.md) ·
[ADR-088](ADR-088-test-tier-truthfulness.md) · BUG-035 · Sprint 124

## Context

A gate that has no honest way to record a reviewed exception eventually becomes noise. The
dependency-audit gate first exposed this problem when a high-severity `image-size` advisory had no
published fix. ADR-059 added a narrow, seven-day exemption registry without weakening the standing
high-severity threshold.

The Expo SDK drift workflow had the complementary failure. Sprint 122 deliberately moved the
monorepo, including `apps/mobile`, to Jest 30, while Expo SDK 57's live compatibility map continued
to pin `jest ~29.7.0` and `@types/jest 29.5.14`. The workflow treated every non-zero
`expo install --check` result as new drift, so those two reviewed differences made it permanently
red and hid real Expo package updates in expected noise (BUG-035).

The two cases share registry mechanics but not policy. An unresolved security advisory needs a
short calendar deadline. A deliberate toolchain difference is meaningful for one Expo SDK
generation and must be reconsidered when that generation changes. Making both use the same expiry
rule would either weaken the security SLA or impose arbitrary weekly churn on a stable SDK
decision.

## Decision

Karmyq uses one spec-driven validator core at `scripts/lib/exemption-registry.js` for the mechanics
common to exemption registries:

- the registry and entries have the required object/array shapes;
- required fields are non-empty strings;
- entry identities are unique;
- `created` is a real `YYYY-MM-DD` UTC date; and
- each consumer supplies its own field validators and expiry policy.

The core knows nothing about audit severities, GHSA identifiers, Expo versions, or expiry lengths.
Those rules remain with the consumer so sharing code cannot silently make the policies equivalent.

### Audit exemptions: calendar expiry

`scripts/audit-exemptions.js` supplies the ADR-059 rules for
`security/audit-exemptions.json`: exact package plus GHSA identity, `high` severity only, and an
`expires` date no more than seven days after `created`. The seven-day cap remains the audit-specific
high-severity SLA. **Critical findings are never exemptible.** Expired, malformed, duplicate,
partially matched, and no-longer-matched entries fail the gate.

### Expo divergences: SDK-major expiry

`scripts/expo-divergences.js` supplies the rules for `security/expo-divergences.json`. Each entry
names one exact package and records the declared range, Expo's expected range, the Expo SDK major,
the rationale, decision, owner, and creation date. The SDK major is derived from the live
`apps/mobile` manifest. A registration expires when that declared major changes, forcing every
divergence to be re-argued for the new SDK generation. A registration also fails when its declared
range changes, Expo's live pin changes, or the package no longer appears in Expo's drift output.

The Jest pair is recorded as two entries, not a wildcard. `apps/mobile` does not declare
`jest-expo`, and its Jest configuration uses the Node test environment rather than Expo's preset.
Expo's Jest 29 pin exists to keep that preset aligned; it does not bind this project's mobile test
setup. `@types/jest` follows the deliberate Jest 30 choice but remains separately registered so a
change to either package is independently visible.

### Fail-closed, complete-output gate

Expo's live `npx expo install --check` remains the arbiter. The gate parses the complete known
drift envelope: header, every drift row, compatibility guidance, final footer, and process exit
status. When Expo exits non-zero or emits recognized drift rows, missing framing, malformed or
trailing output, or an unrecognized future format fails closed. An unexpected exit status,
termination by signal, malformed JSON, an unregistered drift, or stale registry data also fails.
Headerless output paired with Expo exit status 0 remains a clean result; the gate trusts Expo's
successful verdict when there is no recognized drift to subtract.

The workflow calls the shipped consumer module with the shipped registry. Regression tests call
that same exported module and spec behavior with constructed registries and fixtures, so they prove
the policy without claiming to use the workflow's live registry data. The shared core removes
duplicated mechanics; it does not create a second source of truth for either gate.

## Consequences

### Positive

- A reviewed exception can make a gate green without hiding unrelated new findings.
- The audit and Expo registries share shape, date, and duplicate validation while preserving their
  different risk policies.
- Stale entries are blocking maintenance signals: convergence removes an exception instead of
  leaving dead allowlist data behind.
- The Expo workflow can again distinguish the deliberate Jest pair from genuine SDK drift.

### Negative

- Human-readable Expo CLI output is an integration boundary. A legitimate upstream formatting
  change will turn the workflow red until the parser and its captured fixture are reviewed.
- SDK-major expiry is intentionally coarser than calendar expiry. **It cannot fire while
  `apps/mobile` remains on SDK 57**, so the Jest divergences may remain registered indefinitely on
  that SDK. This is the accepted long-lived-on-the-same-SDK trade-off; live declared and expected
  ranges plus stale-entry detection still catch convergence or changed facts in the meantime.
- Every registry consumer must define and test its own policy. Adding a third registry is not just
  adding JSON; it requires an explicit identity, field validation, expiry horizon, and live arbiter.

## Alternatives Considered

### One universal calendar expiry

Apply ADR-059's seven-day window to every registry. **Rejected:** weekly renewal is appropriate for
an unresolved high-severity advisory, not for a toolchain decision whose natural review boundary is
an SDK upgrade. Repetitive renewals would train maintainers to approve without re-evaluating.

### SDK-generation expiry for audit findings

Keep audit exemptions until a dependency ecosystem milestone. **Rejected:** it would discard the
existing one-week vulnerability SLA and could make a high-severity exemption effectively permanent.

### Accept `expo install --check`'s exit status directly

This was BUG-035. **Rejected:** it made a deliberate, safe difference permanently red and caused
real patch drift to blend into the same failure.

### Parse only recognized package rows

Ignore unfamiliar lines and subtract registered packages. **Rejected:** a changed Expo output
format could yield zero parsed rows and a false-green gate. Complete framing and status agreement
are part of the verdict.

### Downgrade the whole monorepo to Jest 29

Follow Expo's pin even though the mobile app does not use Expo's Jest preset. **Rejected:** it would
restore test-toolchain divergence across workspaces to satisfy a compatibility constraint that does
not apply to this setup.

## Implementation Notes

- Shared core: `scripts/lib/exemption-registry.js`
- Audit policy and evaluator: `scripts/audit-exemptions.js`
- Expo policy and complete-output evaluator: `scripts/expo-divergences.js`
- Registries: `security/audit-exemptions.json`, `security/expo-divergences.json`
- Workflow: `.github/workflows/expo-sdk-drift.yml`
- Behaviour proofs: `tests/regression/sprint-123-audit-exemption-gate.test.ts`,
  `tests/regression/sprint-124-registry-core-parity.test.ts`, and
  `tests/regression/sprint-124-expo-divergence-gate.test.ts`
