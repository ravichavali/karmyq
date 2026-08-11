# Sprint 124: Exemption Mechanism & The Drift Gate — Design Spec

**Date**: 2026-08-11
**Status**: Approved
**Version**: v11.43.0 → v11.44.0
**Sprint Branch**: `feature/sprint-124-exemption-mechanism`
**ADR**: ADR-094 (next free number — 093 is the highest at authoring time)

---

## Overview

Sprint 123 shipped a time-boxed audit-exemption mechanism to solve a specific problem: `npm audit`
is binary, and an advisory with no published fix blocks every PR forever. The answer was a registry
that gives up exactly one advisory, for at most seven days, in writing. It works, and it is about
to bite on schedule — **both `image-size` exemptions expire 2026-08-17**, six days from now.

That mechanism was written with a second consumer in mind. `scripts/audit-exemptions.js:29-30`
states that the schema validator is "deliberately separable (`validateRegistry`) so BUG-035 can
reuse it for the Expo drift workflow without importing any audit-specific logic." **That claim is
false as written**, and this sprint is where it gets tested rather than repeated. Meanwhile
BUG-035's `Expo SDK drift` workflow has been red every day since 2026-08-06, refiles issue #196 on
every run, and has buried five genuine Expo patch releases under noise nobody reads anymore.

Sprint 124 resolves the deadline with measured evidence, makes the reuse claim true by extracting a
genuinely schema-driven validator, and uses it to give the drift workflow the one thing it lacks:
a way to record a deliberate divergence so that real drift can still go red.

### Core Principle: A gate that can never pass is exactly as useless as one that can never fail

The CodeQL gate (ADR-060) failed open. The git hooks were inert. The Expo drift gate fails
*always*. All three produce the same outcome — a signal nobody acts on — and the third is the one
that feels most virtuous while doing it. A check earns its red only if green is reachable honestly.

---

## Multi-Sprint Arc

This sprint sits in the **security-gate truthfulness** thread, not the manifesto arc.

### Sprint 122 epilogue (#195) — complete
ADR-060's code-scanning gate polled `refs/pull/N/merge` while CodeQL publishes to `/head`, so it
fail-opened on every PR. Fixed; the gate now actually gates.

### Sprint 123 (#198) — complete
AGPL-3.0-or-later published (ADR-092), git hooks repaired (`core.hooksPath` resolution), and the
ADR-059 time-boxed exemption mechanism introduced.

### Sprint 124 — this sprint
Generalize that mechanism, prove the generalization, and apply it to the third broken gate.

### Sprint 125 — upcoming (unchanged)
Manifesto arc step 2 — the provider question (ADR-041 enforcement). See
`docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`. The
`redisClient.publish` verification is also targeted here.

---

## New Concepts

### Exemption registry (generalized)
A committed JSON file recording deliberate, time-bounded departures from what a gate would
otherwise demand. Two instances after this sprint:

| Registry | Records | Expires by | Max life |
|---|---|---|---|
| `security/audit-exemptions.json` | An unfixable high-severity advisory | Calendar date | **7 days** (ADR-059 high-severity SLA) |
| `security/expo-divergences.json` | A deliberate departure from Expo's live SDK map | **SDK generation** | Until `apps/mobile` leaves that SDK major |

### Why the two horizons differ — and why that is not an inconsistency
An audit exemption records **waiting for someone else**: upstream has not shipped a fix yet. The
clock is short because the waiting is supposed to be uncomfortable, and because a fix could land
any day.

An Expo divergence records **a decision we made**: this project does not use Expo's jest preset, so
Expo's jest pin does not bind it. There is no upstream event to wait for. A 7-day clock on a
standing decision produces weekly reflex-renewal, which is precisely the failure mode the expiry
exists to prevent — the ritual survives and the review dies.

The divergence's natural boundary is the SDK generation. Expo revises its map *within* a
generation, but the reasoning behind "we don't use their preset" holds for as long as `apps/mobile`
is on SDK 57 and must be re-argued when it moves to 58.

### Arbiter-derived expiry
The divergence registry's expiry is **not a hand-written date**. It is derived at run time from
`apps/mobile/package.json`'s declared `expo` range. An entry tagged `"sdk": "57"` is live only
while that range resolves to major 57; the moment the manifest moves to SDK 58, every SDK-57
divergence is expired and the gate fails until each is re-argued or deleted.

This follows Discipline 5 directly: the expiry is read from the arbiter, not from a shadow copy a
human maintains. A hand-written `expires: 2027-01-01` would have been a second shadow of the same
kind the `SDK_PINNED` map already is.

> **Accepted trade-off, stated plainly.** An SDK-generation expiry cannot fire while `apps/mobile`
> stays on SDK 57. If the project sat on SDK 57 for two years, a divergence recorded today would go
> unreviewed for two years. This is accepted because Expo ships a major SDK roughly every four
> months, so the review cadence lands near quarterly in practice — but it is a real weakness of the
> chosen mechanism and it belongs in ADR-094's Consequences, not hidden in a comment.

---

## The three findings that shaped this design

All read from source at `b5d4cb79`.

### F1 — `validateRegistry()` cannot be reused as written

`scripts/audit-exemptions.js:29-30` claims it is audit-independent. It is not. Three audit-specific
rules are baked into the function body:

| Rule | Line | Why it blocks reuse |
|---|---|---|
| `advisory` must match `/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/` | `:104` | An Expo divergence has no advisory id |
| `severity` must be exactly `'high'` | `:107` | An Expo divergence has no severity |
| `REQUIRED_FIELDS` includes `advisory`, `severity`, `expires` | `:43-52` | All three are audit concepts |

This is the **assert-weaker-than-claimed** pattern: separability was asserted by comment and never
demonstrated by a second consumer. The sprint's central deliverable is converting that comment into
a proof.

### F2 — Not everything BUG-035 reports is a divergence

The 2026-08-06 drift run flagged jest and `@types/jest` — a genuine deliberate choice. But five
Expo patch releases published 08-06/08-07 are **unapplied updates**, not decisions:

| Package | Declared (verified `apps/mobile/package.json`, 2026-08-11) | Expo's map (per BUG-035) |
|---|---|---|
| `expo` | `~57.0.10` | `~57.0.11` |
| `expo-image-picker` | `~57.0.7` | `~57.0.8` |
| `expo-location` | `~57.0.7` | `~57.0.8` |
| `expo-notifications` | `~57.0.8` | `~57.0.9` |
| `expo-router` | `~57.0.10` | `~57.0.11` |

These get **applied**, not exempted. Exempting a patch bump you simply have not done yet is how a
registry rots into a to-do list nobody reads.

⚠️ **That right-hand column is five days old and Expo revises its map within a generation.** It is
a starting hypothesis, not the target. The implementation reads the live arbiter and bumps to
whatever it says on the day.

### F3 — The jest divergence itself looks safe, and that reasoning must be recorded

`jest-expo` is not declared in `apps/mobile/package.json`, and `apps/mobile/jest.config.js` uses no
Expo preset — just `testEnvironment: "node"`. Expo pins jest to keep *its own preset* in sync with
the SDK; a project not using that preset is not bound by the pin. This is the rationale the
divergence entry must carry, and it must be **re-verified during implementation**, not copied
forward from BUG-035 on trust.

---

## The image-size decision (Task 1)

**Option 1 from the handoff is already eliminated.** `npm view image-size version` returns
**2.0.2** (checked 2026-08-11). The advisory range is `<=2.0.2`, so every published version is
still affected and there is nothing to upgrade to.

Task 1 measures the remaining two options and records the measurement as the decision's rationale.

**Resolved reach (verified in `package-lock.json`, 2026-08-11):** a single hoisted
`node_modules/image-size@1.2.1`, reached through `node_modules/metro@0.84.4` ←
`node_modules/@expo/metro@56.0.0` ← `apps/mobile`'s `expo ~57.0.10`.

### What "remove the need" would actually require — and the trap in it

The only consumer is metro, a dev-time bundler that ships in no deployed image. Removing the reach
means removing `apps/mobile` from the root lockfile's resolution — giving it its own lockfile, or
dropping it from the root `workspaces` globs (`["apps/*", ...]`).

> ⚠️ **Name this honestly when evaluating it.** The audit gate runs `npm audit
> --package-lock-only` at the repo root (`scripts/audit-exemptions.js:293`). Moving `apps/mobile`
> out of the root lockfile does not make the vulnerable code go away — **it makes the gate stop
> looking at it.** That is gate-avoidance wearing the costume of a fix, and it is a worse outcome
> than an honest renewal, because it removes `apps/mobile` from audit coverage permanently and
> silently, for every future advisory.
>
> It is only a legitimate fix if the maintainer decides on the merits that `apps/mobile` should be
> a separately-resolved workspace for its own reasons. Do not let the deadline make that decision.

### Decision rule for Task 1

| Finding | Action |
|---|---|
| `npm view image-size version` > 2.0.2 | **Delete both entries.** The gate already fails on an exemption matching nothing |
| Still ≤ 2.0.2, and no independently-justified reason to split `apps/mobile` | **Renew** with fresh `created`/`expires` and a rationale stating what was re-measured and what it showed |
| Still ≤ 2.0.2, and the maintainer independently decides to split the workspace | Remove the reach — but as its own decision, with its own written justification |

**The renewal rationale must state what changed since 2026-08-10.** "Still no fix" is a
re-measurement and is a legitimate rationale — *if it says what was measured and on what date*.
Renewing by copying the previous text forward is the reflex the expiry exists to catch.

**The 7-day cap does not move.** Nothing in this sprint may widen `MAX_EXEMPTION_DAYS`, add an
SDK-style expiry to the audit registry, or make `critical` exemptible. The two registries share a
validator core; they do not share their rules.

---

## Data Model

**No database changes.** No migration, no schema touch, no service change.

### `security/expo-divergences.json` (new)

```jsonc
{
  "$comment": "BUG-035 / ADR-094. Deliberate departures from Expo's live SDK version map for apps/mobile. Read by scripts/expo-divergences.js, which .github/workflows/expo-sdk-drift.yml and tests/regression/sprint-124-expo-divergence-gate.test.ts both call. Rules: exact package name (no wildcards), every field required, and `sdk` must match the SDK major apps/mobile currently declares. The gate FAILS on a malformed entry, an entry tagged for a different SDK generation, and an entry matching no current drift — a divergence that no longer diverges means the pin converged and it must be deleted.",
  "divergences": [
    {
      "package": "jest",
      "declared": "^30.4.2",
      "expoPins": "~29.7.0",
      "sdk": "57",
      "rationale": "Expo pins jest to keep jest-expo's preset in sync with the SDK. apps/mobile declares no jest-expo and apps/mobile/jest.config.js uses no Expo preset (testEnvironment: 'node' only), so the pin does not bind this project. Moved to jest 30 by Sprint 122 PR 4 (c3d623b2) for tier parity with the rest of the monorepo.",
      "decision": "Sprint 124, ADR-094; divergence introduced by Sprint 122 PR 4 (c3d623b2)",
      "owner": "ravichavali",
      "created": "2026-08-11"
    },
    {
      "package": "@types/jest",
      "declared": "^30.0.0",
      "expoPins": "29.5.14",
      "sdk": "57",
      "rationale": "Types for the jest above. Listed separately on purpose: divergences match an exact package name, never a wildcard, so an unrelated Expo pin moving would still block the gate.",
      "decision": "Sprint 124, ADR-094; divergence introduced by Sprint 122 PR 4 (c3d623b2)",
      "owner": "ravichavali",
      "created": "2026-08-11"
    }
  ]
}
```

> **`declared` and `expoPins` are recorded for review value, and both are re-verified at run time.**
> `declared` is checked against `apps/mobile/package.json` and `expoPins` against the arbiter's
> output. A divergence whose recorded numbers no longer match reality is stale config and fails the
> gate — the same rule that makes a stale audit exemption fail. **A field the gate never reads is a
> field that silently goes wrong.**

### `scripts/lib/exemption-registry.js` — the generic core (new)

```js
/**
 * @param {unknown} registry  Parsed JSON.
 * @param {RegistrySpec} spec What this registry's entries must look like.
 * @param {Date} now
 * @returns {string[]} human-readable errors; empty means valid.
 */
function validateRegistry(registry, spec, now = new Date()) { /* ... */ }
```

`RegistrySpec`:

| Field | Purpose |
|---|---|
| `collection` | Array property name (`'exemptions'` / `'divergences'`) |
| `requiredFields` | Non-empty-string fields |
| `identity(entry)` | Duplicate-detection key |
| `fieldValidators` | `{ field: (value, at) => string[] }` — GHSA / severity for audit; `sdk` shape for expo |
| `checkExpiry(entry, ctx)` | `string[]`; `ctx` carries `{ now, today, parseUtcDate }` |

**Invariants that stay in the core** (identical for both registries): registry is an object; the
collection is an array; each entry is an object; required fields present and non-empty; the
bail-on-first-error-per-entry rule that suppresses cascading noise
(`audit-exemptions.js:102`); duplicate detection; `created` parses as a real UTC date, rejecting
roll-overs like `2026-02-31` (`:63-64`).

**What each registry supplies:** audit → GHSA + `severity === 'high'` validators, and a date-window
expiry enforcing `expires > created`, span ≤ 7 days, and `expires >= today`. Expo → an `sdk`
validator and an SDK-generation expiry comparing `entry.sdk` against the live manifest.

---

## API Endpoints

**None.** No service is touched this sprint.

---

## Frontend Changes

**None**, other than generated landing-doc content for ADR-094.

---

## Gate Behaviour: before and after

| Situation | Today | After Sprint 124 |
|---|---|---|
| jest diverges from Expo's pin | ❌ red forever, files #196 daily | ✅ green — recorded divergence |
| A real, unrecorded drift appears | ❌ red (correct, but indistinguishable from the noise) | ❌ red, and it is the *only* thing red |
| `apps/mobile` moves to SDK 58 | n/a | ❌ red until every SDK-57 divergence is re-argued |
| A divergence converges (Expo adopts jest 30) | n/a | ❌ red — stale entry must be deleted |
| Registry malformed / unparseable | n/a | ❌ red, fail-closed |

The middle rows are the point. **Gates must be proven to reject, not merely to pass.**

---

## User Guide & Doc Updates

| Doc | Change |
|---|---|
| `docs/adr/ADR-094-generalized-exemption-registries.md` | **New.** The decision: one validator core, two registries, two expiry horizons, and why they differ. Records the SDK-generation trade-off in Consequences |
| `docs/adr/README.md` | Index ADR-094 |
| `docs/adr/ADR-092-*.md`, `ADR-093-*.md` | `Accepted` → `Implemented` (carried debt — both shipped in #198; must ride this PR, never a docs-only master push) |
| `docs/adr/ADR-059-dependency-security-gate.md` | Amend: the validator now lives in `scripts/lib/`; the 7-day cap is unchanged and audit-specific |
| `docs/BUGS.md` | BUG-035 `open` → `fixed (Sprint 124, v11.44.0)`, with the mechanism described |
| `scripts/claude.md` | Document `scripts/lib/` and `expo-divergences.js` in the entry-point table (local context — mandatory) |
| `scripts/generate-docs.ts` | Add `adr-094-generalized-exemption-registries` to the nav ordering list (`:438-463`) |
| `apps/landing/.../nav.json` | **Generated — do not hand-edit.** Falls out of the line above; grep-verify after regenerating |
| `apps/landing/src/data/docs/concepts/` | Concept page: "Time-boxed exemptions" — why a gate needs a way to say *yes, deliberately*, in the project's own voice |
| `CLAUDE.md` | No change expected — no service count, version, or global pattern moves |

---

## Critical Implementation Notes

1. **The audit gate's 36 tests are the behaviour-preservation proof and must pass UNCHANGED.**
   `tests/regression/sprint-123-audit-exemption-gate.test.ts` (377 lines) is not to be edited to
   accommodate the refactor. If a test needs editing, the refactor changed behaviour — fix the
   refactor. This includes **exact error-message strings**: several assertions match on message
   text, so the generic core must emit byte-identical messages for the audit spec.

2. **`scripts/audit-exemptions.js` must keep exporting `validateRegistry`.**
   `tests/regression/sprint-75-security-gate.test.ts:60` does `require('../../scripts/audit-exemptions')`,
   and `.github/workflows/ci.yml:99` runs the script by path. Both callers stay valid — re-export a
   spec-bound wrapper with the original one-argument signature. Changing either caller is a
   separate decision, not refactor collateral.

3. **`npx expo install --check` output is the arbiter — and parsing it is the fragile part.**
   Capture real output into a committed fixture and unit-test the parser against it. A parser that
   silently matches nothing turns the gate fail-open, which is the exact defect ADR-060 shipped.
   The parser must **fail closed on unrecognized output**: zero parsed lines from a non-zero exit
   is "I could not tell", never "clean" (`audit-exemptions.js:206-208` is the pattern to copy).

4. **Apply the five Expo patch bumps; do not exempt them.** And re-read the live map on the day —
   BUG-035's list was captured 2026-08-06 and Expo revised its map twice during a single Sprint 122
   review.

5. **Lockfile: `npm install --package-lock-only` will report "up to date" and leave the nested node
   stale.** Delete the affected packages' entries from `package-lock.json`, re-resolve, and
   **assert the resolved version** afterwards. Surgical in-place edits only — never `npm dedupe`,
   never `npm install --workspace`, never a scratch regen on Windows. The dependency-guard hook
   blocks the first two.

6. **Do not touch `MAX_EXEMPTION_DAYS`.** The 7-day cap is the ADR-059 high-severity SLA and is
   audit-specific. The new horizon belongs to the Expo spec only. Sharing a validator core is not
   sharing rules.

7. **"Remove the need" for image-size is gate-avoidance unless independently justified.** See the
   Task 1 decision rule above. Moving `apps/mobile` out of the root lockfile stops the gate looking
   at it; it does not remove the vulnerability.

8. **`nav.json` is GENERATED.** Edit the ordering list in `scripts/generate-docs.ts:438-463`. This
   is why it has "silently reverted" on past sprints. Grep-verify after regenerating.

9. **`npm test` dirties `apps/landing/src/data/docs/`** via the landing prebuild. Revert
   timestamp/HEAD-sha churn before committing; keep the genuine ADR-094 content.

10. **Windows environment.** `jq` is absent and `curl` returns spurious `000` — use `node -e` with
    `fetch` for any HTTP probe. `npm test` under Turbo is red on this box with
    `Exceeded timeout of 5000 ms` on long suites; confirm a suspect workspace by running it
    directly (`cd tests && npx jest regression/<file>`) before believing it. Never `| tail` a test
    run — it masks the exit code.

11. **The drift workflow runs on a schedule, not on PRs** (`expo-sdk-drift.yml:17-21`), deliberately
    — so `api.expo.dev` reachability never blocks a merge. Keep it that way. Verify the fix with
    `workflow_dispatch`, and expect the real confirmation to be the next 07:15 UTC run.

12. **Issue #196 should be closed by the sprint, not left to rot.** Once the workflow can go green,
    close it referencing the PR. A permanently-open issue from a permanently-red gate is the same
    ignored-signal problem in a different UI.

---

## Definition of Done

- [ ] Both `image-size` exemptions resolved — renewed with a fresh measured rationale, or deleted —
      and the audit gate green with `expires` in the future
- [ ] `scripts/lib/exemption-registry.js` exists; both registries consume it
- [ ] `sprint-123-audit-exemption-gate.test.ts` passes **unedited** (36 tests)
- [ ] `security/expo-divergences.json` records jest + `@types/jest` with verified rationale
- [ ] The five Expo patch releases applied, lockfile re-resolved, resolved versions asserted
- [ ] `npx expo install --check` exits 0, or exits non-zero only on registered divergences
- [ ] New gate proven to **reject**: stale entry, wrong-SDK entry, missing field, unregistered
      drift, malformed JSON — each with a RED test
- [ ] ADR-094 written and indexed; ADR-092/093 flipped to Implemented; ADR-059 amended
- [ ] BUG-035 marked fixed; issue #196 closed
- [ ] Landing concept page + ADR-094 page live in nav
- [ ] `/simplify`, `/code-review`, `/security-review` run on the diff; findings resolved or
      justified in writing
