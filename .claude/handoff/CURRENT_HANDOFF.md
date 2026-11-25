# Sprint 146 in execution — Expo SDK drift reconciliation (#329) + Deepmerge #178 close-out — Handoff

**Date**: 2026-11-25
**Outcome**: **PR [#343](https://github.com/ravichavali/karmyq/pull/343) open, awaiting a Codex
branch review and the maintainer's merge decision.** It was opened 2026-11-25 at `73e93812`, and
CI runs on it. Plan Tasks 1-10 are done. In Task 11 the pre-PR `process-reviewer` returned FAIL
(B1: "#178" is Dependabot alert #178, not PR #178), and its findings are fixed in `73e93812`.
**CI on `379177af` was red** in Integration Tests, attempt 1 and the maintainer's rerun (both 726/727). The cause is
[BUG-110](../../docs/BUGS.md), a Sprint 145 test bug: `lastSlot()` counted only 200s, and a winning staff add answers
201. The maintainer asked for the bug to be logged and the test fixed (2026-11-25), so the fix rides on this PR.
**Merge and deploy are NOT authorized**; they need a fresh maintainer yes.

Sprint 146 goal, named by the maintainer 2026-11-24: **Expo drift #329**, which aligns the nine
drifted SDK-57 pins in `apps/mobile` to Expo's live version map. Two maintainer authorizations
came with the goal: the Deepmerge #178 re-check rides along as a docs task, and the version
bump (→ v11.119.0, now done). Merge/deploy, any ADR number, further dependency work and
demo-data operations remain unauthorized.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-146-planning`, cut from `origin/master` `95d5e8c1` (fetched 2026-11-24; re-checked 2026-11-25, unchanged) |
| **Base** | `origin/master` `95d5e8c1` = Sprint 145, [PR #342](https://github.com/ravichavali/karmyq/pull/342), v11.118.0 |
| **Active editor** | Claude (executor) ran Tasks 1-11 on 2026-11-24/25, one checkpoint commit per task. Next editor: the reviewer (Codex) for the branch review, then the maintainer for merge; one editor at a time in the shared Windows checkout |
| **Reviewer role** | Codex cleared the spec and plan at `6ee743ca` (planning only). The Task 9 gates and the pre-PR `process-reviewer` are done (see the Task 9 and Task 11 rows). A non-author (Codex) review of the branch is still owed before merge |
| **Owned paths** | The Sprint 145 post-merge record (rides with this PR), the Sprint 146 spec, plan and this handoff, `apps/mobile/package.json`, `package-lock.json`, root `package.json` version, `apps/mobile/claude.md`, `docs/adr/ADR-059-dependency-security-gate.md`, the ADR-059 line of `docs/adr/README.md`, `apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json`, and the zod-case comment in `tests/regression/sprint-131-d9-security-overrides.test.ts` (from `/code-review` F2). Bundled 2026-11-25 (maintainer): the BUG-110 entry in `docs/BUGS.md` and `lastSlot()` plus the staff-add case in `tests/integration/sprint-145-admission-integrity.integration.test.ts` |
| **Shared resources needed** | Version bump AUTHORIZED and done (v11.119.0, re-derived from `origin/master` at 11.118.0). Merge slot, any ADR number, further dependency work and demo-data operations each need their own maintainer yes |

## Links

- **Sprint 145 shipped record**: [archive/2026-11-24-sprint-145-admission-integrity-SHIPPED-v11.118.0.md](archive/2026-11-24-sprint-145-admission-integrity-SHIPPED-v11.118.0.md)
- **Sprint 146 spec**: [docs/superpowers/specs/2026-11-24-sprint-146-expo-drift-design.md](../../docs/superpowers/specs/2026-11-24-sprint-146-expo-drift-design.md)
- **Sprint 146 plan**: [docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md](../../docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md)
- **PR**: [#343](https://github.com/ravichavali/karmyq/pull/343) (opened 2026-11-25 at `73e93812`; its `## Validation` ledger holds the final same-HEAD evidence)

## Quick Start

1. Read this handoff, then confirm live state before trusting it: `git status --short`,
   `git branch --show-current`, `git fetch origin`, `git log --oneline origin/master -1` (must
   still be `95d5e8c1`; if it moved, stop and re-plan, because the base changed), `gh pr list`.
2. Reuse the existing task branch `agent/claude/sprint-146-planning`. Never branch off a stale
   local master; unpushed local-master commits leak in via the squash-merge.
3. Open the plan: `docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md`.
4. Continue execution with `superpowers:subagent-driven-development` (or
   `superpowers:executing-plans`), invoked directly. There is no `/execute-plan` slash command;
   superpowers removed it as a deprecated stub.
5. Checkpoint: after every group of at most 3 tasks, and before any long-running suite or
   subagent review, commit and update this handoff's task status (task, state, SHA, evidence)
   and say what you are waiting on. A mid-sprint pickup reads this handoff, never `git log`.

**Next step**: confirm the CI/CD run on PR #343's current head is green, especially Integration Tests
(the BUG-110 fix can only be proven there; this box has no PostgreSQL). If Integration Tests is still red, its
assertion now prints both responses; read them before changing anything. Then a **Codex non-author review of
PR #343**, read-only, at that head (re-derive with `gh pr view 343 --json headRefOid,statusCheckRollup`). Then
the maintainer decides on merge.
On a yes, use the `deploy` skill (merge → CI/CD → health). After merge, confirm the next daily
`expo-sdk-drift.yml` run is green and #329 is closed (Task 11's remaining verification).

## Sprint 146 goal and arc

Align nine `expo-*/@expo/*` pins (live capture 2026-11-24: metro-runtime → ~57.0.19, expo →
~57.0.34, expo-constants → ~57.0.25, expo-image-picker → ~57.0.22, expo-linking → ~57.0.14,
expo-location → ~57.0.24, expo-notifications → ~57.0.26, expo-router → ~57.0.32,
expo-splash-screen → ~57.0.12) to Expo's live SDK-57 map, prove the drift gates green, close #329,
and land the Deepmerge #178 re-check as an ADR-059 docs reconciliation. Ship as v11.119.0.
Arc: S121/122 built the Expo SDK gates (ADR-088/094) → prior SDK alignments and S136 mobile
deps → **S146: further drift reconciliation using the existing machinery**. #329 closes via the
PR's closing keyword at merge.

## Critical implementation notes (verbatim from the spec)

1. **Never trust a drift number older than the run that produced it.** Capture
   `npx expo install --check` (or `node scripts/expo-divergences.js`) output at execution time
   and bump to *those* values. The issue's numbers and the spec table are evidence, not
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
6. **Deepmerge work is documentation only.** No dependency edit, no upgrade, no registry entry.
7. **No new tests are added.** The sprint-122 alignment test, sprint-124 divergence-gate
   regression test and the daily drift workflow are the red→green proof. If the live map
   surprises us, tests-first applies to any gate edit.

**Self-audit.** At planning, one fresh-context reviewer subagent ran the Step-5b checklist: 4
findings, 1 BLOCKER fixed (raw `expo install --check` exit 1 with the two jest rows is the steady
state, not exit 0), 2 NITs fixed, 1 NIT rejected with evidence. **Self-audit at `edb6cc48`: 2
findings fixed.** Twelve live citations this handoff carries were re-checked against the files
and all 12 hold (`package.json:70`; the sprint-131-d9 every-copy floor; `sprint-122…:103-115`;
the `cmd.exe` wrap; the two registered divergences; the ADR-059 deepmerge close-out, then at `:524-531` and now at `:532-541`; `invitations.ts:12-94`;
`generate-docs` ADR publishing; `.npmrc` `ignore-scripts`; root `jest.config.js` testMatch;
`instantiateMetro.js:295`; lock 11.119.0 / 1845 nodes). The two fixes: the old Task 3 row
ended "Steps 6-8 … pending" after recording them done (removed in this rewrite), and the
next-chat block listed a "process review" that plan Task 9 does not name (fixed in
`edb6cc48`). Plan Task 9's stale nested-minimatch expectation was later given an erratum line
under that task (`4ce53806`), and the spec has an erratum for the #178 identity (Task 11).

## Task status

| Task | State | Commit / evidence |
|---|---|---|
| 1 Branch state + live drift capture | **done** 2026-11-24 | Evidence only, at `ca97d62c` (record `7dccfd53`). Live gate exit 1: exactly the nine planned BLOCKING rows and the two registered jest rows; no `SDK_PINNED` drift. Baselines below |
| 2 Bump nine manifest ranges | **done** 2026-11-24, red by design | `2ce2c83e`. `apps/mobile/package.json` 9+/9−, only the nine. Red run: sprint-122 exit 1, **1 of 16** fails ("the lockfile satisfies every apps/mobile declaration"), naming exactly the nine `lock has <old>, manifest wants <new>` |
| 3 Lockfile splice + strict proof | **done** 2026-11-24, green | `0ae053d1` (record `557c4183`). Override-aware closure probe exit 0: 31 moves equal to the plan table, plus one `OVERRIDE >=11.0.1 satisfied by 11.0.3 — no move` line. Reverse-break scan CLEAN. Diff proof: **changed 32, added 0, removed 0**, every integrity/tarball equals `npm view`, key order kept, workspace-node parity OK, minimatch untouched. `npx -y npm@11.19.0 ci` from uppercase `C:\` exit 0 with the lock unchanged. `npm ls --package-lock-only` root problems **9 → 9**, total problem lines **45 → 45**. All 31 installed at their targets. sprint-122 **16/16**. `npm audit --audit-level=high` exit 0 (0 vulnerabilities) |
| 4 Drift gates green | **done** 2026-11-24 | Evidence only, at `557c4183` (record `03e398fe`). Raw `npx expo install --check` (from `apps/mobile`) exit 1 with exactly the two jest rows, the designed ADR-094 state. `node scripts/expo-divergences.js` **exit 0**: two REGISTERED DIVERGENCE lines plus `✅ Expo divergence gate clean (2 registered divergence(s)).`. sprint-124 **31/31** |
| 5 Mobile tests + type check + root regression | **done** 2026-11-25 | Evidence only, at `03e398fe` (record `69fe86a6`). Mobile `tsc --noEmit` exit 0; mobile jest 2 suites / 5 tests. `npm test -- --force`: exit 0, **27/27 Turbo tasks, 0 cached**, 11m13s; root `@karmyq/tests` 50 suites / 1098 tests + 10 / 101, sprint-122 and sprint-124 PASS in that run. The landing generator churn it leaves was reverted |
| 6 ADR-059 deepmerge reconciliation | **done** 2026-11-25 | `68e806ec` + `24236a8a` (record `cb51b1fc`). Live re-check 2026-11-25T15:24Z: advisory withdrawn 2026-11-16T18:55:38Z (CVE-2026-93753), deepmerge 4.3.1 latest = locked. ⚠️ **Corrected in Task 11 (process review B1):** "#178" is **Dependabot alert #178** (deepmerge, dismissed `tolerable_risk` 2026-10-28), not PR #178 (an unrelated 2026-07-30 dev-deps bump). `gh api …/dependabot/alerts/178` returns HTTP 410, "Alert number 178 has been withdrawn", and there are 0 open Dependabot alerts (2026-11-25). The ADR, landing page and spec erratum are fixed. Commit `68e806ec`'s message still says PR #178. `ADR-059…:532-541` (was 524-531): original sentence kept, dated close-out appended. `docs/adr/README.md` ADR-059 line gains the Sprint 146 note. Landing: the ADR-059 page delta is `content` only, matching the source exactly; unrelated churn reverted. Doc drift gate 41/41 |
| 7 Version v11.119.0 + mobile doc line | **done** 2026-11-25 | `8d50a0b2` (+ `edb6cc48`). Version 11.119.0 in `package.json` and both lock entries (4 lock lines, version-only against the splice). `apps/mobile/claude.md` Sprint 146 bullet: pins, closure, override lesson, BUG-041 still stands (expo-router 57.0.32 keeps `query-string ^7.1.3`), `@expo/cli` 57.0.35 still defaults tsconfig paths on, plus the `edgesOut` correction (and a pointer in the S134 bullet). Branch landing set = the five expected files. 3 suites / 69 tests |
| 8 Handoff rewrite | **done** 2026-11-25 | This rewrite (a handoff cannot record its own SHA). Self-audit line above |
| 9 SDLC quality gates | **done** 2026-11-25 | **`/simplify`** at `3b10d021`: run inline (four angles, no source code in the diff). 1 fixed in `cfa22949` (the mobile bullet restated derivable pins); 2 altitude findings skipped as outside the diff and listed under Open candidates. **`/code-review` medium** at `cfa22949`: 5 findings, all verified. **F1** (Important, CONFIRMED): `@expo/cli` 57.0.35 lists `zod` only as a devDependency, so the `package.json:108-110` scoped override is inert. Maintainer decision 2026-11-25: keep it as a guard and document it. **F2** (Important, PARTIAL): the sprint-131-d9 zod comment was false, but the case still enforces one locked copy at the pin; comment corrected, assertions unchanged, mutation-proved able to fail. **F3** (nit, CONFIRMED): `ADR-059` Sprint 146 zod note added after line 475; landing page regenerated (`content` only). **F4** (nit, CONFIRMED): mobile bullet notes the dropped zod. **F5** (nit, CONFIRMED): plan erratum under Task 9. After the fixes, d9 + sprint-122 + sprint-124 + the doc drift gate pass, 4 suites / 100 tests. **`/code-review` re-run** on `cfa22949...a3ba68c1`: 4 nits, all CONFIRMED and fixed. Say "no runtime `zod`", because 57.0.35 keeps `zod ^3.25.76` as a devDependency; the registry shows 57.0.32/58.1.15 runtime and 57.0.35/58.1.21 dev-only. A bump that brings a runtime `zod ^3` back must re-run the Sprint 134 consumer check. The d9 comment now matches its assertions. **`/security-review`** at `4c2b0223`: **no findings**. Run inline, since the diff has no executable code; the only code-like file is the comment-only d9 test edit. Supply-chain check on the lock vs `origin/master`: changed 33 (31 moves + `apps/mobile` + root version), added 0, removed 0. All 31 package nodes come from `registry.npmjs.org` with sha512 integrity equal to `npm view`. No `hasInstallScript`/`bin`/`os`/`cpu` changes. None of the 29 override-governed packages moved. All 266 dependency edges of the moved nodes resolve to existing lock nodes. `npm audit --audit-level=high` exit 0, 0 vulnerabilities; `.npmrc` `ignore-scripts=true` |
| 10 Final verification | **done** 2026-11-25 | Evidence only, at `acd22556`. Run 1, with Turbo's cache forced off: `npm test` exited 0, and the script failed closed only on the landing churn, restored from its snapshot. Run 2: `pre-commit-check` exit 0 with a clean tree. See Verification references |
| 11 Merge + deploy | **PR #343 open**; merge **maintainer-authorized only** | **`process-reviewer`** at `a27740c0`: FAIL. All findings were verified and fixed in the Task 11 fix commit. **B1** (blocking, CONFIRMED): the obligation is Dependabot alert #178 (dismissed `tolerable_risk` 2026-10-28), which now returns HTTP 410 "withdrawn", with 0 open Dependabot alerts. PR #178 is unrelated. ADR-059 close-out rewritten, landing page regenerated (`content` = source), spec erratum added. **S1**: runtime `zod` was dropped in 57.0.33 / 58.1.18 (registry), not 57.0.35 / 58.1.21; ADR note and d9 comment fixed. **S2**: PR ledger cache labels and same-HEAD evidence corrected (handoff files feed the doc drift gate). **S3**: stale handoff rows fixed. **N1-N3**: ledger wording, README "no override or registry change", PR body notes the Sprint 144 CONTEXT flip. **N4**: no change; the tripwire is already a candidate. It also ran `pre-commit-check` at `a27740c0`: exit 0. **Then, at `73e93812`:** `pre-commit-check` passed on the second run; the first failed only on the usual churn, restored. The push ran the pre-push hook: unit + regression 27/27, root regression 50 suites / 1098 tests. The report-only TDD tier was red in 4 workspaces, all `ECONNREFUSED :5432`/`:3001`, the box's lack of a DB and running services. **PR [#343](https://github.com/ravichavali/karmyq/pull/343) opened** (closes #329). **CI on `379177af`:** CI/CD run [45680564241](https://github.com/ravichavali/karmyq/actions/runs/45680564241) failed in Integration Tests on attempt 1 and on the maintainer's rerun, the same case both times: "invitation versus staff add", 726/727. Every other check passed. The run on `73e93812` ([45679554686](https://github.com/ravichavali/karmyq/actions/runs/45679554686)) passed 14/14 with identical code. Root cause **BUG-110** (test only): `lastSlot()` required one 200, staff add answers 201 (`members.ts:288`), so each staff win failed. Fix bundled (maintainer, 2026-11-25): per-contender success status and one `toEqual` over both outcomes, so a failure prints both responses. A synthetic check of the committed lines passed 11/11 pairs (old line fails on a staff win). The edited file compiles under ts-jest; it cannot run here (no PostgreSQL). Remaining: CI green on the fix head, Codex review, maintainer merge yes, deploy, then confirm the drift workflow and that #329 closed |

### Execution evidence carried forward

- **HEAD baselines (Task 1, at `ca97d62c`)**: 1845 lock nodes; `npm ls --all
  --package-lock-only --json` exit 1 `ELSPROBLEMS` with 9 root problems: invalid minimatch@11.0.3,
  color-string@2.1.4, ms@2.0.0, picomatch@2.3.2, @emnapi/core@1.10.0, @emnapi/runtime@1.10.0,
  @emnapi/wasi-threads@1.2.1, @emnapi/runtime@1.11.2 (under sharp-wasm32); missing
  @react-native/metro-config@* (react-native-worklets@0.10.1). 45 total problem lines. Green
  pre-change baseline: sprint-122 + sprint-124 + sprint-131-d9 = 3 suites / 59 tests.
- **The 22 transitive moves (Task 3)** equal the plan table exactly. The largest is
  `@expo/cli` 57.0.32 → 57.0.35; the rest are patch moves in `@expo/*`, `expo-*`,
  `babel-preset-expo` and `agent-cli-detector`.
- **Landing set vs `origin/master`** (Task 7): `adr-059` (Sprint 146) plus the four Sprint 145
  pages from `013d4923` (`adr-062`, `adr-106`, `community-service`, `social-graph-service`).
- Raw outputs, check scripts and the execution ledger are git-ignored, on this Windows box only:
  `.superpowers/sdd/2026-11-24-sprint-146-expo-drift/` (ledger `progress.md`) and `.tmp/sprint-146/`.
  This section is the copy that travels.

### Execution rulings (from the ledger; listed for the reviewers)

- **Task 1**: accepted the 8 planning/review commits after `013d4923` (they touch only the
  handoff, plan and spec). The gate-shape check was made mechanical and mutation-proved.
- **Task 2**: committed the intentionally red state as a checkpoint (the squash merge removes it).
- **Task 3**: the probe, splice and diff scripts call `npm-cli.js` through node with no shell,
  because cmd.exe rewrites `^`, `>`, `<`, `|` in range arguments. The plan's Step 4 manifest
  bump was not repeated (done in Task 2). The splice was committed before `npm ci` per the
  checkpoint rule, against PR-268's "do not commit" (ci passed). The `npm ls` compare
  normalizes drive-letter case.
- **Task 4**: the raw arbiter was compared by hand; the committed gate was checked mechanically.
- **Task 5**: ran `npm test -- --force` rather than bare `npm test`. The ledger verified the saved
  full run rather than re-running 11 minutes at an unchanged HEAD; Task 10 re-runs at the final HEAD.
- **Task 6**: appended a dated close-out rather than rewriting the Sprint 134 amendment sentence.
  That ruling cited "PR #178 closed unmerged" while noting its generic dev-deps title. The mismatch
  was the signal, and the process review (Task 11, B1) resolved it: the obligation is Dependabot
  alert #178, now withdrawn (HTTP 410).
  Added the `docs/adr/README.md` index note (not in the plan file map; CLAUDE.md Discipline 6).
- **Task 7**: the mobile bullet carries more than the plan's one line: the override lesson, two
  re-verified facts, and the `edgesOut` correction assigned to this task.

### Planning review history (condensed; full text in this file at `ca97d62c`)

| Round | Reviewed | Verdict | Findings | Resolved in |
|---|---|---|---|---|
| Codex 1 | `1e1248c1` | FIX-FIRST | R1 closure beyond the nine; R2 workspace-node mirror; R3 root jest config finds no regression tests; R4 ADR-059 landing page must be regenerated | `93a7d4f6` |
| Codex 2 | `93a7d4f6` | FIX-FIRST | RR1 the probe ignored overrides (minimatch nest rejected); RR2 crashing `npm ls` is no proof, so compare `--package-lock-only` problems; RR3 one bare jest command left; RR4 contradictory acceptance criteria, counts re-derived | `c2373694` |
| Codex 3 | `c2373694` | FIX-FIRST | R3-1 the landing check must expect the five-file branch set | `6ee743ca` |
| Codex 4 | `6ee743ca` | **PASS** | none; planning review cleared | — |

## Blockers and decisions

- **Blockers**: CI must be green on the BUG-110 fix head before merge (Integration Tests is a
  blocking job, and image builds wait on it). Planning review is cleared; Tasks 1-10 are done and
  the Task 9 gates are resolved. A non-author branch review is owed before merge. Merge requires a
  fresh maintainer yes (Sprint 145's merge authorization does not carry over).
- **Decision (2026-11-25, maintainer)**: log BUG-110 and fix the test on this PR ("we need both"),
  since it blocks this PR's CI. Scope: the BUG-110 entry and the Sprint 145 integration test's
  `lastSlot()` and staff-add case only. No service code changes.
- **Decision (2026-11-24, Sprint 146 planning)**: goal = Expo drift #329; the #178 re-check rides
  along as docs only; version bump to v11.119.0 authorized. BUG-109 (invitation-generation
  membership check) is the natural next sprint's candidate; BUG-107 stays deferred.
- **Decision (2026-11-25, Task 6)**: the Deepmerge #178 re-check is **closed**. The advisory was
  withdrawn, so there is no upgrade, registry entry or exemption. It no longer appears among the
  open candidates.
- **Decision (2026-11-25, Task 9, maintainer)**: keep the now-inert `"@expo/cli": { "zod": "4.6.6" }`
  override (`package.json:108-110`) as a guard for any `@expo/cli` that declares a runtime `zod ^3`, and
  document it (ADR-059 Sprint 146 note, the sprint-131-d9 comment, the mobile bullet). No dependency
  change this sprint. Retiring it is an open candidate.
- **Decision (Sprint 145, 2026-11-23)**: D1 an active invitee gets a no-write 200; D2 an
  invitation promotes a pending applicant; D3 any live active member may admit someone to a
  private community. Shipped; do not re-debate.

## Open candidates (carried forward)

- **[BUG-109](../../docs/BUGS.md) (security, untriaged).** Invitation generation mints codes for
  any community without a live-membership check and inflates `total_invitations_sent`
  (`services/social-graph-service/src/routes/invitations.ts:12-94`; the Sprint 145 acceptance
  side already refuses outsider-minted codes). Natural follow-up on the same surface.
- **[BUG-107](../../docs/BUGS.md).** Staff direct-add consent gap; deferred.
- **Last-slot winner order (new, BUG-110 follow-up).** The Sprint 145 last-slot races leave the
  winner to whichever trigger update runs first, so a green run proves only the branch that ran.
  The staff-add case's staff-win branch first runs after the BUG-110 fix. Making each case run
  both winner orders would prove both branches every run.
- **Sprint 145 review candidates (not filed).** Guessable 4-hex invitation-code suffix; a refused
  acceptance lands on discovery without saying why; deferred minors (shared social-graph test
  builders, integration `as()` helper, `MEMBERSHIP_CHANGED` wording, untrimmed code lookup,
  `liveRole.ts` `db` doc placement).
- **Inert `@expo/cli` zod pin (new, Sprint 146).** `@expo/cli` 57.0.35 lists `zod` only as a
  devDependency (58.1.21 too; 57.0.32 and 58.1.15 had a runtime `zod ^3.25.76`), so the scoped
  override applies to nothing in this lock. Retiring it means removing the override, rewriting the
  sprint-131-d9 zod case and adding an ADR-059 note, and it needs a dependency-lane yes. Two
  re-checks: any bump that brings a runtime `zod ^3` back needs the Sprint 134 consumer check,
  and adding `expo-mcp` means checking its `zod`. A d9 tripwire (fail if the lock's `@expo/cli`
  gains a `zod` dependency) is an option.
- **Committed drift-splice tool (new, /simplify altitude).** Every Expo drift sprint (S131,
  S134, S146) re-types the closure, reverse-scan, splice and diff scripts from plan text. A
  committed, tested `scripts/` tool would end the transcription and the Windows shell-quoting bug.
- **`edgesOut` cwd gotcha (new, /simplify altitude).** Plain `npm ls --all` crashes from a
  lowercase `c:\` cwd and completes from `C:\`. It belongs in `docs/gotchas/` with a machine
  check (the `learned` skill), not only in the mobile sprint bullet.
- **Landing generator churn (new, pre-existing cause).** Every regeneration rewrites
  `architecture.json` (timestamp), `build.json` (sha, date, and `adrCount`, where the tracked
  file says 99 and the generator counts 104) and `adr-010` (CRLF → LF). Executors revert it each
  time; a one-off refresh or a generator fix would end the churn.
- **Gotcha candidate (not filed).** Bare supertest request is a thenable without `.finally`;
  needs a `docs/gotchas/` entry with a machine check.
- **Pre-existing doc defect.** `tests/claude.md` says the TDD promoter "runs as root
  `posttest`", but `.npmrc` `ignore-scripts=true` stops npm from running it.
- **Stale status headers (pre-existing).** `docs/BUGS.md` BUG-034, BUG-036, BUG-037 still say
  "pending deploy"; check each against its deploy before changing it.
- **CI image matrix.** `ci.yml` builds seven service images but not social-graph-service;
  deploys unaffected (`scripts/deploy.sh` builds all on the server).
- **Parked `origin/lane/lanes-provenance`.** Design, PR-1 plan and lane file exist only on that
  branch; its old ADR-098 number is taken on master, so any ADR needs a fresh maintainer allocation.
- **Branches.** `agent/claude/sprint-145-planning` (merged) still exists on the remote; deleting
  it is the maintainer's call.
- **Carry-forward.** Governance rotation, revocation, delegation and opposition; close and
  expiry notifications; legacy member-handler error envelopes; mobile revival debt (BUG-041
  blocks shipping the app); the demo platform-admin grant and smoke (separate authorization);
  Sprint 144 review minors.

## Verification references

- **Sprint 146 final verification (local, not yet CI), at `acd22556`.** Run 1:
  `TURBO_FORCE=true bash scripts/pre-commit-check.sh`. `npm test` exited 0 with no cached result
  replayed (2026-11-25T17:08-17:18Z), and the script failed closed only on the usual landing
  generator churn, restored from its pre-npm snapshot. Run 2: `bash scripts/pre-commit-check.sh`
  exit 0 (17:19-17:23Z), tree clean, nothing untracked. The root `@karmyq/tests#test` is
  `cache: false`, so run 2 re-ran root unit + regression; other workspaces may have replayed.
  `process-reviewer` also ran `pre-commit-check` at `a27740c0`: exit 0. The Task 11 fixes moved
  HEAD again. `.claude/handoff/*.md` is a `doc-context-drift-gate` input, so the final same-HEAD
  evidence is in the PR's `## Validation` ledger, not here. Earlier: the full root suite at
  `03e398fe` (`npm test -- --force`, 27/27, 0 cached).
- **Sprint 146 live evidence**: master `95d5e8c1` and no open PRs (observed 2026-11-25); drift gate
  green after the splice (Task 4); deepmerge advisory withdrawn (2026-11-16), Dependabot alert
  #178 returns HTTP 410 "withdrawn", 0 open Dependabot alerts (observed 2026-11-25).
- **Sprint 145**: PR #342 merged 2026-11-24T19:42:37Z as squash `95d5e8c1`; CI/CD 45473083712
  success 14/14 with deploy; nine services healthy (observed 2026-11-24).

⚠️ **GitHub status goes stale.** Re-derive PR and deploy state before trusting anything here.
