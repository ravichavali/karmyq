# Sprint 146: Expo SDK Drift Reconciliation — Design Spec

**Date**: 2026-11-24
**Status**: Approved
**Version**: v11.118.0 → v11.119.0
**Sprint Branch**: `agent/claude/sprint-146-planning`

---

## Overview

The daily Expo SDK drift gate (`.github/workflows/expo-sdk-drift.yml`) has been failing since
2026-11-05 and auto-commenting on [issue #329](https://github.com/ravichavali/karmyq/issues/329).
Nine `expo-*/@expo/*` packages in `apps/mobile/package.json` lag Expo's **live** SDK-57 version
map by one to three patch levels. These are all patch bumps within SDK 57 — Expo revises the map
within a generation as it ships fixes to its managed packages — so the fix is alignment, not
migration: move each declared range to the version Expo currently asserts, re-resolve the
lockfile surgically, and prove the existing gates green.

This sprint also closes a security-housekeeping obligation: the Deepmerge Dependabot PR #178
re-check due 2026-12-01. That re-check is now complete (see "Deepmerge #178 re-check" below) and
its only remaining work is documentation reconciliation in ADR-059.

### Core Principle: The live map is the only arbiter; the committed files are its shadow.

`npx expo install --check` decides. `tests/regression/sprint-122-expo-sdk-alignment.test.ts`
(`SDK_PINNED`), `scripts/expo-divergences.js`, and `security/expo-divergences.json` are committed
shadows of a source that churns — the sprint-122 test header documents the map moving twice during
a single review and once reverting. The fix chases the map at execution time; nothing here trusts
a number older than the run that produced it.

---

## Multi-Sprint Arc — Expo SDK maintenance

- **Sprint 121/122 (complete)** — hand-aligned apps/mobile to SDK 57, then built the enforcing
  gates (ADR-088 alignment test, ADR-094 divergence registry, daily drift workflow).
- **Sprint 136 (complete)** — mobile dependency wave and status follow-ups; confirmed the map
  (not Dependabot) decides SDK-managed pins.
- **Sprint 146 (this sprint)** — the largest alignment since the gates were built (S131 #268
  moved six packages/13 nodes; a 2026-10-21 re-derivation moved twenty) and the first whose
  closure is shaped by a **security override** (minimatch stays put via `>=11.0.1`): align the
  nine drifted pins plus their full transitive closure, close #329, and close out the Deepmerge
  #178 re-check obligation in ADR-059.

---

## Data Model

None. No SQL, no migrations, no demo-data operations.

## API Endpoints

None. No service surface changes; `services/registry.json` needs no update (no endpoint, event
or behavior change).

## Frontend Changes

None for `apps/frontend` and `apps/landing`. `apps/mobile` changes only its dependency
manifest/lockfile — no source, config or screen changes.

---

## The drift (captured live 2026-11-24, `node scripts/expo-divergences.js`, exit 1)

| Package | Declared now | Expo expects (live map) |
|---|---|---|
| @expo/metro-runtime | ~57.0.17 | ~57.0.19 |
| expo | ~57.0.31 | ~57.0.34 |
| expo-constants | ~57.0.22 | ~57.0.25 |
| expo-image-picker | ~57.0.20 | ~57.0.22 |
| expo-linking | ~57.0.13 | ~57.0.14 |
| expo-location | ~57.0.22 | ~57.0.24 |
| expo-notifications | ~57.0.24 | ~57.0.26 |
| expo-router | ~57.0.29 | ~57.0.32 |
| expo-splash-screen | ~57.0.10 | ~57.0.12 |

All nine resolve to **hoisted** lock entries (`node_modules/<pkg>`; verified against
`package-lock.json` — none are nested under `apps/mobile/node_modules/`). All nine are
expo-prefixed, so the sprint-122 gate sees them through `expoFamily()`; **no `SDK_PINNED` edit is
expected** because no non-expo-prefixed SDK pin (react, react-native, reanimated, worklets,
screens, gesture-handler, safe-area-context, maps, web, picker) appears in the live drift.
Re-verify both facts at execution — the map moves.

### The lockfile closure (verified by override-aware probe at planning, live map 2026-11-24)

The nine target manifests force **22 additional hoisted lock nodes** to move with them (each is a
requirement of a published manifest the new versions declare — e.g. `expo@57.0.34` requires
`@expo/cli ^57.0.35`, lock has 57.0.32). The full table is plan Task 3 Step 1; the probe
recomputes it at execution and the map's word wins over this document.

The probe must apply the root `overrides` (`package.json:70` et al.): a dependency whose
installed version satisfies the override range needs no move even when its raw declared range
fails. That resolves the one apparent conflict — `@expo/fingerprint@0.20.17` declares
`minimatch ^10.2.6`, but the root override sets `minimatch >=11.0.1` and the hoisted 11.0.3
satisfies it (exactly what npm's Arborist OverrideSet computes). **No minimatch node moves and no
nested copy is added** — which also keeps `tests/regression/sprint-131-d9-security-overrides.test.ts`
green, since it floors every locked minimatch copy at 11.0.1 and rejects below-floor copies,
nested included. Expected end state: 31 moved nodes + the `apps/mobile` workspace mirror,
**1845 → 1845 nodes, 0 added, 0 removed**; the workspace node's `dependencies` map mirrors the
manifest ranges and is updated in the same splice (verified: `package-lock.json`
`packages["apps/mobile"].dependencies` repeats all nine ranges).

The two registered divergences (`jest ^30.5.1` → Expo `~29.7.0`; `@types/jest ^30.0.0` → Expo
`29.5.14`, both ADR-094) still match the live map and stay registered. The divergence gate fails
on a *stale* entry, so they must not be removed.

## Deepmerge #178 re-check (live, 2026-11-24)

The re-check is already done; this sprint lands its documentation:

- `gh api advisories/GHSA-gcqx-w48m-w2h4`: **withdrawn_at 2026-11-16T18:55:38Z**, summary now
  prefixed "Withdrawn Advisory: deepmerge mergeObject() allows prototype poisoning of returned
  objects" (CVE-2026-93753).
- PR [#178](https://github.com/ravichavali/karmyq/pull/178): state **CLOSED** (was "HTTP 410"
  in the handoff).
- Open code-scanning alerts on master: **0** (`gh api repos/.../code-scanning/alerts`).

Conclusion: no upgrade is or was needed — `deepmerge` 4.3.1 remains latest and below the ADR-059
gate floor, which was and is the correct posture. The 2026-12-01 re-check obligation closes as
"withdrawn by GitHub 2026-11-16; re-checked 2026-11-24; no open alert; no registry entry."

---

## User Guide & Doc Updates

Mandatory doc updates this sprint:

1. **`docs/adr/ADR-059-dependency-security-gate.md`** (~line 524): amend the deepmerge paragraph —
   record the advisory withdrawal (2026-11-16), the completed re-check (2026-11-24, this sprint),
   PR #178 closed, zero open code-scanning alerts, and that the "low with no fix" reasoning is
   moot because the advisory no longer exists. No new registry entry.
2. **`apps/mobile/claude.md`** — add a Recent-changes line: the nine SDK-managed pins aligned to
   the live SDK-57 map (v11.119.0), gate green.
3. **`.claude/handoff/CURRENT_HANDOFF.md`** — rewritten for the executing conversation; the
   Deepmerge #178 item leaves the open-candidates list.
4. **`docs/BUGS.md`** — no entry: #329 is a tracking issue, not a bug record; nothing new is filed.
5. **Landing docs** (`apps/landing/src/data/docs/`) — the ADR-059 page MUST be regenerated:
   `scripts/generate-docs.ts` publishes the ADR to
   `apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json`, and
   `.npmrc` `ignore-scripts=true` disables `prebuild`, so neither CI (`npm run build` only) nor
   `scripts/deploy.sh` regenerates it — the committed JSON is what ships. Run
   `npm run generate-docs --workspace=karmyq-landing`, commit the ADR-059 content delta, and
   revert any unrelated generated churn. No other landing page has a content delta.
6. **Root version** — `package.json` and `package-lock.json` (`version` + `packages[""].version`)
   → v11.119.0, the same four-line lock diff pattern Sprint 145 used.

---

## Critical Implementation Notes

1. **Never trust a drift number older than the run that produced it.** Capture
   `npx expo install --check` (or `node scripts/expo-divergences.js`) output at execution time
   and bump to *those* values. The issue's numbers and the table above are evidence, not
   instructions. If the live map differs, the live map wins; if it moved a `SDK_PINNED` package,
   that map entry changes too, with a written reason per its comment contract.
2. **Lockfile edits are surgical, and the splice unit is the closure, not the nine — computed
   with root overrides applied.** Never `npm install --workspace`, never `npm dedupe`, never a
   scratch regen. Run the override-aware closure probe (Sprint 131 PR-268 technique plus a check
   of the root `package.json` `overrides`) to compute every hoisted node the new manifests force
   to move — 22 transitive moves at planning time, 31 nodes total. Then run a reverse-break
   scan: any hoisted node that serves another requirer must NOT move. At planning time the probe
   resolves minimatch via its override (`package.json:70` sets `>=11.0.1`; hoisted 11.0.3
   satisfies it), so there is no minimatch move and NO nest — `tests/regression/sprint-131-d9-security-overrides.test.ts`
   floors every locked copy at the patched version and rejects below-floor copies, nested
   included. Update the `apps/mobile` workspace node's mirrored `dependencies` in the same
   splice. Every changed node is registry-verified (version, resolved, integrity, field set);
   the expected end state is 31 moved nodes + the workspace mirror, 1845 → 1845 nodes, proven by
   strict pinned-npm `npm ci` and a before/after comparison of
   `npm ls --all --package-lock-only --json` root problems (9 at HEAD; none new afterwards).
3. **Do not touch the registered divergences.** `security/expo-divergences.json` stays as-is;
   removing a still-matching entry fails the gate, and widening one to hide drift is forbidden
   (ADR-094).
4. **The gate must report exactly two cleared divergences and zero blocking drift.** Any other
   shape (a stale entry, an unparsed row, exit status other than 0/1) is a gate failure, not a
   partial success.
5. **Windows host.** `scripts/expo-divergences.js` already wraps `npx` in `cmd.exe` on win32;
   use the script rather than hand-running npx for the authoritative result. Use `node -e` for
   lockfile inspection; `jq` is absent in Git Bash.
6. **Deepmerge work is documentation only.** No dependency edit, no upgrade, no registry entry;
   the live re-check evidence (withdrawn advisory, closed PR, zero open alerts) is cited in
   ADR-059 verbatim.
7. **No new tests are added.** The enforcement already exists — the sprint-122 alignment test,
   the sprint-124 divergence-gate regression test, and the daily drift workflow are the red→green
   proof. This sprint makes them green; it does not extend them. If the live map surprises us
   (e.g. a `SDK_PINNED` move), tests-first applies to any gate edit.
