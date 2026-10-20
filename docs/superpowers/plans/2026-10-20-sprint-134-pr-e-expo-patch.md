# Sprint 134 PR E — Expo SDK 57 Patch Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring `apps/mobile` back onto Expo's live SDK 57 map (#279) with a surgical in-place lockfile splice, and close the drift
workflow's silent-failure gap.

**Architecture:** The nine SDK-managed manifest ranges in `apps/mobile/package.json` move one patch each. `package-lock.json` gets
only the entries their closure changes, spliced onto the base lock. `.github/workflows/expo-sdk-drift.yml`'s reporting steps
fire on any failure, not only on a check that produced outputs.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*.

**Spec:** `docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md` → *PR E*.
**Branch:** `agent/claude/sprint-134-pr-e-expo-patch`, cut from `origin/master` **after PR A merges** (one merge at a time).
**Lane:** dependency work, earned by maintainer decision (2026-10-19); Claude holds the lane.
**Precedent:** Sprint 131 #268 and Sprint 129 PR B did the same shape (`apps/mobile/claude.md` *Recent changes*).

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| (scratchpad only) `splice-expo.js`, `diff-lock.js` | Re-resolve in a scratch copy, splice, and diff. **Not committed.** |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/mobile/package.json` | Nine `~57.0.x` ranges move one patch |
| `package-lock.json` | The workspace edges plus every node the closure changes, nothing else |
| `.github/workflows/expo-sdk-drift.yml` | `if:` conditions at `:154`, `:232`, `:262` + empty-payload fallback body |
| `apps/mobile/claude.md` | *Recent changes* entry |
| `package.json` | Version bump at merge time |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Re-derive the targets first.** Expo keeps publishing. The 2026-10-20 run gave: `expo` ~57.0.30, `@expo/metro-runtime` ~57.0.17,
   `expo-camera` ~57.0.6, `expo-constants` ~57.0.22, `expo-linking` ~57.0.13, `expo-location` ~57.0.21, `expo-notifications` ~57.0.23,
   `expo-router` ~57.0.28, `expo-splash-screen` ~57.0.10. `jest`/`@types/jest` are registered divergences
   (`security/expo-divergences.json`). Leave them.
2. **Never** `npm install --workspace`, `npm dedupe`, or a scratch lock regen (CLAUDE.md *Workspace dependencies*). The Windows
   re-resolve strips the 20 Linux-only `libc` fields and can drop override and nested nodes. Run it only in a **scratch copy**
   and splice the intended entries back.
3. **Splice rules:** keep the base lock's key order; sort map-valued fields (`dependencies`, `peerDependencies`, `optionalDependencies`,
   `engines`, `bin`) the way npm does. The registry returns them unsorted (#268's 418-line churn).
4. **Proof is three separate properties:** (a) order and completeness: a node-by-node diff vs a byte copy (0 key-order changes, only
   intended keys added/removed) plus every changed `version`/`resolved`/`integrity`/`dependencies` equal to `npm view <pkg>@<ver> --json`;
   (b) consistency and integrity: `npx -y npm@11.19.0 ci` exit 0; (c) tree validity: `npm ls --all` shows **no new** errors vs HEAD
   (`apps/mobile/claude.md` records four pre-existing ones; memory records three. Measure the baseline at HEAD yourself). A
   green local `npm ci` alone proves nothing; `npm ci` never writes the lock.
5. **`SDK_PINNED` does not change.** It shadows only non-expo pins (`tests/regression/sprint-122-expo-sdk-alignment.test.ts:103`).
6. **`decode-uri-component` stays 0.2.2.** BUG-041; no override.
7. **node-forge exemption is unaffected.** `@expo/cli@57.0.31` still declares `node-forge ^1.3.3`; the lock keeps 1.4.0. After the splice,
   `node scripts/audit-exemptions.js` must still match both exemptions; a new high/critical advisory in the closure blocks the PR.
8. **Workflow fix pattern exists next door** in the demo-health workflow (Sprint 129). Copy its condition shape; don't invent a new one.

---

## Task E1: Branch + re-derive targets and baselines

- [ ] `git fetch origin && git switch -c agent/claude/sprint-134-pr-e-expo-patch origin/master`
- [ ] `cd apps/mobile && EXPO_NO_TELEMETRY=1 npx expo install --check`. Record the exact list (exit 1 expected).
- [ ] Baselines at HEAD, saved to the scratchpad: `cp package-lock.json <scratch>/lock.base.json`;
  `npm ls --all 2>&1 | grep -E "invalid|missing|ERR" > <scratch>/ls.base.txt`; `node scripts/audit-exemptions.js > <scratch>/audit.base.txt`.

## Task E2: Manifest ranges

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] Set each of the re-derived packages to the `~` range `expo install --check` named. Nothing else in the manifest moves.

## Task E3: Re-resolve in a scratch copy

- [ ] Copy the repo's `package.json`, every workspace `package.json`, and `package-lock.json` into a scratch directory with the same
  layout. There, delete the lock entries for the nine packages and for each package whose range `expo@<target>` changed (2026-10-20:
  `@expo/cli`, `expo-asset`, `@expo/config`, `expo-constants`, `@expo/fingerprint`, `babel-preset-expo`, `expo-modules-core`,
  `@expo/metro-config`, `@expo/config-plugins`, `expo-modules-autolinking`, `@expo/local-build-cache-provider`). Then run
  `npm install --package-lock-only --ignore-scripts` (the escalation ladder in memory `feedback_npm_apps_workspace_half_resolution`).
- [ ] Diff scratch vs base, and list every added/removed/changed node. Expect the nine, the eleven, and their own moved transitives.
  **Investigate any node outside the expo/metro/babel family** before splicing it.

## Task E4: Splice onto the base lock

**Files:**
- Modify: `package-lock.json`

- [ ] With the scratchpad `splice-expo.js`, start from `lock.base.json` and, for each intended node, take `version`/`resolved`/`integrity`/
  dependency maps/`engines`/`bin` from the scratch lock. Keep every base field the scratch dropped (`libc`, override markers).
  Insert new keys at npm's sorted position and delete removed ones. Update the `apps/mobile` workspace edge entries.
- [ ] Verify ordering and parity (Note 4a): run `diff-lock.js` base→spliced and print added/removed/changed keys. For each changed node,
  compare it against `npm view <name>@<version> --json` (`dist.integrity`, `dist.tarball`, `dependencies`). Expected: 0 key-order changes,
  0 mismatches.

## Task E5: Prove the install

- [ ] `npx -y npm@11.19.0 ci` exit 0 (CI's npm). Capture the exit code separately; `| tail` masks it.
- [ ] `npm ls --all` vs `ls.base.txt`: no new errors.
- [ ] `cd apps/mobile && EXPO_NO_TELEMETRY=1 npx expo install --check` → exit 0 except for the registered jest divergences; then run the
  gate on that output as the workflow does (`scripts/expo-divergences.js`), and expect `ok: true`.
- [ ] `node scripts/audit-exemptions.js`: both exemptions still match; diff vs `audit.base.txt` for new advisories.
- [ ] `cd apps/mobile && npx tsc --noEmit && npm test`.

## Task E6: Drift workflow silent-failure gap (TDD)

**Files:**
- Modify: `.github/workflows/expo-sdk-drift.yml:154, :232, :262`
- Test: `tests/regression/sprint-122-expo-sdk-alignment.test.ts` already parses this workflow; mirror the assertions of
  `tests/regression/sprint-129-demo-health-workflow.test.ts`, which pins the fixed shape next door (root is correct: it gates a root
  workflow file).

- [ ] Test first. Three steps, three different conditions. Assert each by step **name**, not line:
  - **"File or update the drift issue"** (today `:153-154`) → `always() && (failure() || steps.check.outputs.issue != '0' ||
    steps.check.outputs.result == '')` (`demo-health.yml:243`). No separate `steps.check.outcome` term: `failure()` is already true
    when the check step failed or was skipped by an earlier failure (the spec states the same shape).
  - **"Close stale drift issues when the gate is green"** (today `:231-232`) → `always() && steps.check.outcome == 'success' &&
    steps.check.outputs.issue == '0'` (`demo-health.yml:225`), so it never closes the issue on a run that failed before the check.
  - **"Fail the run when drift is present"** (today `:261-262`) → **unchanged**, `steps.check.outputs.status != '0'`. Pin it in the test,
    so a nonzero gate status can never turn the run green.
  Read `demo-health.yml:144` too. Add a negative fixture with today's conditions for the first two steps, which must fail.
- [ ] Apply the shape. Add a generic fallback issue body for an empty `result` payload ("the drift check did not run to completion;
  see run <url>").
- [ ] `npm test --workspace=tests` green.

## Task E7: Docs

- [ ] `apps/mobile/claude.md` *Recent changes*: Sprint 134 PR E entry, in the #268 style (packages, transitive count, `SDK_PINNED` unchanged,
  divergences untouched, `npm ls` judged by "no new errors").
- [ ] No registry/CONTEXT change (no service touched). `npm run feedback:check`.

## Task E8: SDLC quality gates

- [ ] `/simplify`: one pass. The diff is a manifest, a lock and a workflow; expect little. Verification: noted in PR body.
- [ ] `/code-review` at **medium**, focused on the workflow conditions and lock-splice parity. Verification: no open correctness finding.
- [ ] `/security-review`: new advisories in the closure; workflow `issues: write` permission unchanged. Verification: written result.

## Task E9: Final verification + PR

- [ ] Root `npm test`; `npm test --workspace=tests`; revert landing-docs churn.
- [ ] Version bump re-derived from `origin/master`.
- [ ] Push and open the PR. CI's **Security Audit** and **Code Scanning** gates must be green. Then dispatch the drift workflow on the PR
  branch: `gh workflow run expo-sdk-drift.yml --ref agent/claude/sprint-134-pr-e-expo-patch`. It must pass, and the run link goes in the PR.

## Task E10: Merge + deploy (maintainer-authorized)

- [ ] Handoff update landed on the branch first. Ask "admin merge, yes/no?"
- [ ] After merge: watch CI/CD. The next scheduled drift run (07:15 UTC) must be green. Close #279 with the evidence (run links, the
  re-derived list).
