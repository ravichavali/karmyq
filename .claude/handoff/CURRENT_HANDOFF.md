# Sprint 146 planned — Expo SDK drift reconciliation (#329) + Deepmerge #178 close-out — Handoff

**Date**: 2026-11-24
**Outcome**: planned; Codex re-reviewed `6ee743ca` on 2026-11-24: **PASS — planning review
cleared**, R3-1 resolved, no new findings in this revision. **Execution: Tasks 1-4 complete
and green.** Task 1 (evidence only, at `ca97d62c`): live drift matches the plan exactly. Task 2
(`2ce2c83e`): nine manifest ranges bumped, red by design. Task 3 (`0ae053d1`): 31-node closure
splice, strict pinned-npm `npm ci` exit 0, no new graph problems, sprint-122 16/16 green.
Task 4 (evidence only): the committed drift gate exits 0 with only the two registered jest
divergences. Task 5 (evidence only): the mobile type check and tests pass, and the full root
`npm test -- --force` is 27/27 green. Task 6: ADR-059 records the withdrawn deepmerge advisory
and the closed #178 re-check, and its landing page is regenerated. Task 7 (version v11.119.0 +
mobile doc line) is next. Nothing is pushed yet.
Prior review records below are historical; the final verdict supersedes their blocker lists.
Sprint 146 goal named by the
maintainer 2026-11-24: **Expo drift #329** — align the nine drifted SDK-57 pins in `apps/mobile`
to Expo's live version map. Two maintainer authorizations given with the goal: the Deepmerge #178
re-check rides along as a docs task, and the version bump (→ v11.119.0). Merge/deploy, any ADR
number and demo-data operations remain unauthorized.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-146-planning`, cut from `origin/master` `95d5e8c1` (fetched 2026-11-24) |
| **Base** | `origin/master` `95d5e8c1` = Sprint 145, [PR #342](https://github.com/ravichavali/karmyq/pull/342), v11.118.0 |
| **Active editor** | Claude (executor) ran Tasks 1-6 on 2026-11-24/25 and committed each checkpoint. Next editor: the executor for Task 7 when the maintainer says go; one editor at a time in the shared Windows checkout |
| **Reviewer role** | Codex re-reviewed spec/plan at `6ee743ca`: PASS, R1-R4/RR1-RR4/R3-1 resolved; implementation still requires its own verification and reviews |
| **Owned paths** | The Sprint 145 post-merge record (rides with this PR) plus the Sprint 146 spec, plan, this handoff, `docs/adr/ADR-059-dependency-security-gate.md`, `apps/mobile/package.json`, `package-lock.json`, root `package.json` version, `apps/mobile/claude.md` |
| **Shared resources needed** | Version bump AUTHORIZED (v11.119.0). Merge slot, any ADR number, further dependency work and demo-data operations each need their own maintainer yes |

## Links

- **Sprint 145 shipped record**: [archive/2026-11-24-sprint-145-admission-integrity-SHIPPED-v11.118.0.md](archive/2026-11-24-sprint-145-admission-integrity-SHIPPED-v11.118.0.md)
- **Sprint 146 spec**: [docs/superpowers/specs/2026-11-24-sprint-146-expo-drift-design.md](../../docs/superpowers/specs/2026-11-24-sprint-146-expo-drift-design.md)
- **Sprint 146 plan**: [docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md](../../docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md)

## Quick Start

1. Read this handoff
2. Reuse the existing task branch (`agent/claude/sprint-146-planning`); it already holds the
   Sprint 145 post-merge record and this sprint's spec + plan. Never branch off a stale local
   master — unpushed local-master commits leak in via the squash-merge.
3. Open plan: `docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md`
4. **Planning review cleared at `6ee743ca`.** When starting execution, invoke
   `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command — superpowers removed it as a deprecated stub.
5. Checkpoint: after every group of at most 3 tasks, and before starting any long-running suite or
   subagent review, commit and update this handoff's task status (task, state, SHA, evidence) and
   say what you are waiting on. A mid-sprint pickup reads this handoff, never `git log`.

**Next chat (executor):** read this handoff, run `git status --short` and
`git branch --show-current`, re-run `git fetch origin && git log --oneline origin/master -1`
(must still be `95d5e8c1`), then start plan Task 7: bump the version to v11.119.0, re-derived
from `origin/master` (a four-line lock diff), and add the `apps/mobile/claude.md` Recent-changes
line. Task 7's landing check expects the five-file branch set recorded in the Task 6 row. When Task 7
edits `apps/mobile/claude.md`, also correct the S134 line about the `edgesOut` crash: Task 3
showed the trigger is the cwd of `npm ls` itself (see the Task 3 row). Reuse
`agent/claude/sprint-146-planning`. Nothing is pushed; the branch tip is green from Task 3 on.
If master has moved past `95d5e8c1`, stop and re-plan, because the base changed. Merge/deploy
still require a fresh maintainer yes.

## Codex non-author review — 2026-11-24

Reviewed the spec and plan at `1e1248c1`; verdict **FIX-FIRST**. No implementation, spec or plan
edits, push, PR creation, merge or deployment in this review. This handoff records the findings.

| ID | Priority | Finding and required revision |
|---|---|---|
| R1 | P1 | Plan Task 3 (`docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md:138`) forbids any lock entry beyond the nine, repeated in Task 9. Published target manifests require at least **15 additional package versions** absent from those nine. For example, `expo@57.0.34` requires `@expo/cli ^57.0.35` while `package-lock.json:2825` locks 57.0.32. Expand the surgical splice to the recursively required dependency closure, document each change, preserve unrelated nodes, and retain strict install proof; compare `npm ls --all` errors against a baseline. |
| R2 | P2 | Task 3 also omits `packages["apps/mobile"].dependencies` (`package-lock.json:166`), which duplicates all nine manifest ranges. Explicitly update those ranges with the manifest and verify parity; changing only `node_modules/<pkg>` leaves stale lock metadata. |
| R3 | P2 | Task 2's command (`plan:118`), repeated at lines 154/188, selects root `jest.config.js:11`, whose testMatch excludes regression files. Reproduced exit 1, **No tests found**; this cannot serve as the required red run. Use `npx jest --config tests/jest.config.js --runTestsByPath tests/regression/<file>.test.ts --runInBand` from the repo root, or run from `tests/`. |
| R4 | P2 | Spec's landing-doc exemption (`docs/superpowers/specs/2026-11-24-sprint-146-expo-drift-design.md:117`) and plan Task 7 (`plan:247`) contradict the ADR-059 amendment. `scripts/generate-docs.ts:207` publishes that ADR to `apps/landing/src/data/docs/concepts/adr-059-dependency-security-gate.json`. `.npmrc` disables automatic prebuild; CI (`.github/workflows/ci.yml:249`) and deploy (`scripts/deploy.sh:177`) invoke only build. Explicitly regenerate from source and include the ADR page's content delta, excluding unrelated generated churn. |

Additional corrections: Task 10's shell script does not run a type check
(`scripts/pre-commit-check.sh`); name the explicit command or narrow the claim. Task 5's consecutive
`cd apps/mobile` commands do not work in one persistent shell; use workspace commands or explicit
working directories. The "first use" history claim conflicts with prior alignments documented in
`apps/mobile/claude.md` (S128/S129/S131/S134).

**Fresh evidence at reviewed HEAD `1e1248c1`:**

- `node scripts/expo-divergences.js`: exit 1, exactly the nine stated BLOCKING rows and two jest
  registered divergences (network-enabled run; restricted-network run failed with EACCES).
- Corrected explicit-config command, both sprint-122 and sprint-124 files, `--runInBand --no-cache`:
  exit 0, **2 suites / 47 tests**. Full `npm test`, install and mobile build were not run for this review.
- Read the nine target manifests from `registry.npmjs.org` as data only; the 15-node minimum counts
  additional immediate requirements, not their recursive closure. No downloaded package code executed.
- Live advisory: `withdrawn_at` 2026-11-16T18:55:38Z; deepmerge latest 4.3.1; PR #178 closed and
  unmerged; `gh api` with `state=open&ref=refs/heads/master` returned zero code-scanning alerts.
- `gh pr list --state open`: empty. `git ls-remote origin refs/heads/master`: `95d5e8c1`.

**Set aside:** pre-existing BUG-041/mobile runtime debt, unrelated Sprint 145 bundled records,
and merge/deploy readiness; this review assesses planning, not implementation or release approval.

### Author response — 2026-11-24 (Claude, review-response procedure)

Each finding was verified against the repo before fixing. All four CONFIRMED. Fixes are in the
spec and plan at the revision commit (see `git log`); no code, manifest or lock change was made.

| ID | Verdict | Evidence | Fix |
|---|---|---|---|
| R1 | CONFIRMED | Closure probe (PR-268 technique) run live: the nine targets force **23 transitive hoisted moves**; reverse scan shows the hoisted `minimatch@11.0.3` serves `glob ^11.0.2` and cannot move | Task 3 rewritten: closure probe + reverse-break scan + splice; 31 hoisted moves + ONE nested add (`@expo/fingerprint/node_modules/minimatch@10.2.6`); node count 1845 → 1846; strict pinned-npm `ci` + `npm ls` baseline comparison |
| R2 | CONFIRMED | `package-lock.json` `packages["apps/mobile"].dependencies` repeats all nine ranges (verified by `node -e` read) | Task 3 Step 4/5: splice mirrors the workspace node; explicit parity check `workspace-node parity OK` |
| R3 | CONFIRMED | Reproduced: bare `npx jest tests/regression/...` from root → "No tests found" (root `jest.config.js` testMatch excludes regression) | All focused commands now `npx jest --config tests/jest.config.js --runTestsByPath <file> --runInBand` from root; verified green at planning: 2 suites / 47 tests |
| R4 | CONFIRMED | `scripts/generate-docs.ts` publishes ADR-059 to `apps/landing/.../adr-059-dependency-security-gate.json`; `.npmrc ignore-scripts=true` disables `prebuild`; `ci.yml:249` and `scripts/deploy.sh:177` build only | Task 6: explicit `npm run generate-docs --workspace=karmyq-landing`, commit the ADR-059 content delta, revert unrelated churn |

Smaller corrections also applied: Task 10 no longer claims pre-commit-check type-checks (it
doesn't; no TS changes this sprint so none needed); Task 5 uses `--workspace=` flags instead of
persistent-`cd` chains; the spec's "first use of the drift machinery" history claim corrected
(S131 #268 and a 2026-10-21 twenty-node re-derivation preceded this sprint).

One deviation from R1's literal text, with justification: the review suggested expanding the
splice to "the recursively required dependency closure … preserve unrelated entries". The closure
probe proves that requirement is met by **31 hoisted moves + 1 nested add**, not by moving the
hoisted minimatch (which would break `glob`). The nested add is the resolution npm itself would
write, and it also repairs a pre-existing invalid (`@expo/fingerprint` declaring `minimatch
^10.2.2` against the hoisted 11.0.3). Baseline note: `npm ls --all` at HEAD crashes with
`Cannot read properties of null (reading 'edgesOut')` under both npm 10.8.2 and npm@11.19.0 —
pre-existing; the Task 1/3 proof compares error sets, it does not require a clean `npm ls`.

New evidence this pass: closure probe exit 0 with the 23-move table (recorded in plan Task 3);
reverse scan CLEAN for the 31 hoisted moves; corrected jest command 2/47 green; lock node count
1845; drift gate re-confirmed 9 BLOCKING + 2 registered.

### Codex re-review of `93a7d4f6` — 2026-11-24

Verdict **FIX-FIRST**. Original R2 is fixed; original R3/R4 are only partially fixed. The raw
closure calculation behind the R1 response ignores effective overrides and cannot justify its
minimatch nest. Spec/plan/implementation unchanged by the reviewer; only this handoff records
the result. File/line references below refer to reviewed `93a7d4f6`.

| ID | Priority | Finding and required revision |
|---|---|---|
| RR1 | P1 | Plan Task 3 Step 3 (`docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md:252`) adds minimatch 10.2.6 despite root `package.json:70` requiring `>=11.0.1`. The reused PR-268 probe never reads overrides. npm's installed Arborist `OverrideSet` resolves fingerprint's raw `^10.2.6` edge to effective `>=11.0.1`, already satisfied by hoisted 11.0.3. `tests/regression/sprint-131-d9-security-overrides.test.ts:53` and `:60` reject EVERY locked minimatch below 11.0.1, including nested copies. Recompute the closure with applicable root/parent overrides; remove the unsupported nest and re-derive counts/tables. Do not weaken the security gate to accommodate this probe result. |
| RR2 | P2 | Task 3 Step 6 (`plan:316`) accepts the same `edgesOut` crash as proof of no new graph errors. A traversal crash provides no invalid/missing/peer problem inventory. Use a graph check that completes and compare its actual problems with a baseline; retain strict install proof separately. A read-only fallback works at this HEAD: `npm ls --all --package-lock-only --json` returns `ELSPROBLEMS` with nine actual root `problems` entries, rather than crashing. Compare that set before/after, with explicit override-aware checks where needed; no clean baseline is required. |
| RR3 | P2 | Task 4 (`plan:371`) STILL uses bare `npx jest tests/regression/sprint-124-expo-divergence-gate.test.ts --runInBand`. Reproduced exit 1, No tests found. Apply the explicit-config fix to this command as well. |
| RR4 | P2 | Unreconciled acceptance criteria remain: Task 6 requires an ADR-059 landing delta but Task 7 (`plan:449`) forbids any; Task 9 (`plan:487`) still limits every changed lock entry to the nine. The handoff's copied critical note 2 also retains the old nine-only splice, rather than the revised spec's closure note. Remove these contradictions across spec/plan/handoff. The reused PR-268 diff script counts added nodes as `changed` too: the proposed 31 moves + workspace mirror + nested add would print changed 33 / added 1, not the asserted changed 32. Re-derive expectations after RR1. |

**Fresh verification at `93a7d4f6`:** explicit-config Jest command for sprint-122, sprint-124
and sprint-131-d9 security overrides, `--runInBand --no-cache`: exit 0, **3 suites / 59 tests**.
The gate's exact below-floor predicate rejects the proposed nested node in a cloned in-memory
lock; the repository lock was never modified. Published fingerprint 0.20.17 and minimatch
10.2.6 manifests were read as data only. `npm ls --all --package-lock-only --json` completed
with exit 1 / `ELSPROBLEMS` and nine root problems. No install or full suite run in this review.

### Author response, round 2 — 2026-11-24 (Claude, review-response procedure)

All four findings verified against the repo before fixing; all four CONFIRMED. Fixes in the
spec/plan/handoff at the round-2 revision commit; no code, manifest or lock change.

| ID | Verdict | Evidence | Fix |
|---|---|---|---|
| RR1 | CONFIRMED | Root `package.json:70` overrides `minimatch >=11.0.1`; `tests/regression/sprint-131-d9-security-overrides.test.ts:60-75` floors every locked copy (nested included) at 11.0.1; the round-1 probe never read overrides | Probe gains the override rule; re-run proves `minimatch` resolves via override (`OVERRIDE >=11.0.1 satisfied by 11.0.3 — no move`). Nest removed entirely; 31 hoisted moves, 0 adds, 1845 → 1845 |
| RR2 | CONFIRMED | Plain `npm ls --all` crashes (`edgesOut`) at HEAD under npm 10.8.2 AND npm@11.19.0 — a repeated crash is no proof; `npm ls --all --package-lock-only --json` completes: exit 1 with **9 root problems** (reproduced and inventoried 2026-11-24) | Task 1 baseline = the `--package-lock-only` problem inventory (9 named root problems); Task 3 Step 6 compares root problems before/after (none new = pass); strict `npm ci` proof retained separately; the edgesOut crash demoted to context |
| RR3 | CONFIRMED | Plan Task 4 line 371 still bare `npx jest tests/regression/sprint-124...`; reproduced "No tests found" | Fixed to the explicit `--config tests/jest.config.js --runTestsByPath` form (verified shape in Tasks 2/3) |
| RR4 | CONFIRMED | Task 7 forbade the landing delta Task 6 requires; Task 9's security bullet still said "one of the nine"; handoff critical note 2 was still the original nine-only text (never synced in round 1 — the reviewer is right); the PR-268 diff script counts added keys in `changed` too | Task 7 now verifies the landing delta is exactly the ADR-059 page; Task 9 reworded to the 31 closure nodes + workspace mirror + override-floor check; handoff note 2 synced; counts re-derived: changed 32 (31 moves + workspace node), added 0, removed 0 |

New evidence this pass: override-aware probe exit 0, `MOVES=` with 31 entries, exactly one
`OVERRIDE ... — no move` line (minimatch); reverse scan CLEAN across the 31 moves; 9-root-problem
baseline captured; 3 focused suites green at planning (2/47 for sprint-122/124, per round 1).

One process note: round 1's author response claimed the nest was "what npm itself would
resolve" — that was verified only against raw manifests, not the override set, which is exactly
the gap RR1 caught. The plan now applies the same override rule npm's Arborist uses.
Live `gh pr list --state open` returned empty; remote master remains `95d5e8c1`.

**Set aside:** pre-existing dependency/runtime problems and implementation/release readiness.
They are baseline context, not authorization for broader dependency work or deployment.

### Codex re-review of `c2373694` — 2026-11-24

RR1-RR4 are resolved. Verdict **FIX-FIRST** on one remaining acceptance-criteria defect:

| ID | Priority | Finding and required revision |
|---|---|---|
| R3-1 | P2 | Task 7 (`docs/superpowers/plans/2026-11-24-sprint-146-expo-drift.md:486`) requires `git diff --stat origin/master -- apps/landing` to name exactly ADR-059. The branch already intentionally includes four Sprint 145 generated-page updates from `013d4923`: concepts ADR-062 and ADR-106, plus services community-service and social-graph-service. Reproduced with `git diff --name-only origin/master...HEAD -- apps/landing` and verified provenance using `git show 013d4923 --stat -- apps/landing`. The proposed final whole-branch diff must therefore contain those four plus ADR-059. Preserve their existing content; compare the Sprint 146 increment with the pre-execution snapshot, or assert the complete five-file branch set. Do not revert the bundled Sprint 145 updates to satisfy a one-file assertion. |

**Fresh verification at reviewed HEAD `c2373694`:**

- Independently fetched the 31 target manifests as data and checked every required/optional
  dependency against the proposed versions using installed npm Arborist `OverrideSet` rules:
  **31 planned moves, zero unsatisfied dependencies, one override exception** (fingerprint's
  raw minimatch `^10.2.6` resolves to effective `>=11.0.1`, satisfied by 11.0.3).
- Explicit-config Jest run, sprint-122 alignment + sprint-124 divergences + sprint-131-d9
  security floors, `--runInBand --no-cache`: **exit 0, 3 suites / 59 tests**.
- `npm ls --all --package-lock-only --json`: exit 1 / `ELSPROBLEMS`, nine root problems,
  completed inventory. No installation or full-suite run during this planning review.
- Live PR list empty; remote master still `95d5e8c1`; no implementation or push.

Spec and plan left unchanged by the reviewer. Pre-existing runtime/dependency problems and
implementation/release readiness remain outside this planning review. The historical review
records above remain evidence of prior revisions; this verdict supersedes their blocker lists.

### Author response, round 3 — 2026-11-24 (Claude, review-response procedure)

R3-1 verified CONFIRMED against the repo: `git log --oneline origin/master..HEAD -- apps/landing`
names `013d4923`, and the live branch diff carries exactly the four Sprint 145 generated pages
(`adr-062`, `adr-106`, `community-service`, `social-graph-service`). Fix applied:

- Plan Task 7's verification now asserts the complete five-file branch set — the four Sprint 145
  files (provenance `013d4923`, preserved, not churn) plus exactly one Sprint 146 addition
  (ADR-059 from Task 6).
- Plan Task 6's verification reworded so "only ADR-059" means the only NEW landing change.
- Spec landing item 5 updated with the same five-file expectation.

No other findings this round. New evidence: the five-file table reproduces the live
`git diff --name-only origin/master -- apps/landing` output (four files today; ADR-059 joins
after Task 6).

### Final Codex planning re-review of `6ee743ca` — 2026-11-24

**PASS.** R3-1 is resolved in plan Tasks 6/7 and spec landing item 5. The final branch landing
diff correctly expects the four Sprint 145 pages already present from `013d4923`, preserved,
plus ADR-059 after Task 6. No new findings in the revision diff. All prior planning-review
findings are resolved; this clears planning review only, not implementation or release gates.

Fresh checks: revision diff inspected, `git diff --check 1726d719..6ee743ca` exit 0; the live
branch landing diff still names the four expected existing pages. GitHub has no open PRs and
remote master remains `95d5e8c1`. The last independent dependency/test evidence remains the
review of `c2373694` above (31 manifests, zero unsatisfied dependencies, one override exception;
3 suites / 59 tests; nine root graph problems). Subsequent revisions change only spec, plan
and handoff text; those suites were not rerun in this final text review. No installation,
implementation, push, merge or deployment in this review; only the required handoff updated.

Pre-existing mobile/dependency debt and implementation/release readiness remain outside this
planning review. Execution Task 1 is next when the maintainer starts execution.

## Sprint 146 goal and arc

Align nine `expo-*/@expo/*` pins (live capture 2026-11-24: metro-runtime → ~57.0.19, expo →
~57.0.34, expo-constants → ~57.0.25, expo-image-picker → ~57.0.22, expo-linking → ~57.0.14,
expo-location → ~57.0.24, expo-notifications → ~57.0.26, expo-router → ~57.0.32,
expo-splash-screen → ~57.0.12) to Expo's live SDK-57 map, prove the drift gates green, close #329,
and land the Deepmerge #178 re-check as an ADR-059 docs reconciliation. Ship as v11.119.0.
Arc: S121/122 built the Expo SDK gates (ADR-088/094) → prior SDK alignments and S136 mobile
deps → **S146: further drift reconciliation using the existing machinery**.

Deepmerge #178 evidence (live, 2026-11-24, cited verbatim in the spec): GHSA-gcqx-w48m-w2h4
`withdrawn_at` 2026-11-16T18:55:38Z; PR #178 CLOSED; zero open code-scanning alerts on master.
The re-check obligation closes; documentation only.

## Critical implementation notes (verbatim from the spec — read before Task 2)

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

Self-audit: one fresh-context reviewer subagent ran the Step-5b checklist at planning. 4 findings:
1 BLOCKER fixed (plan Task 4 wrongly demanded raw `expo install --check` exit 0 — with the two
ADR-094 jest divergences registered, the arbiter's steady state is exit 1 with exactly the two
jest rows; the sprint-124 regression test encodes that as the passing input); 2 NITs fixed
(stale Task cross-reference; Windows uppercase-`C:\` `npm ci` gotcha added); 1 NIT rejected with
evidence (the "four-line lock diff" claim verified against `95d5e8c1 --stat`: 4 diff lines, two
version entries). Re-run the citation checks at execution and record
"self-audit at `<sha>`: N findings fixed" here.

## Task status (update as execution proceeds)

| Task | State | SHA / evidence |
|---|---|---|
| 1 Branch state + live drift capture | **done** 2026-11-24 | Evidence only, at `ca97d62c`; no repo file changed except this handoff. See the Task 1 evidence block below |
| 2 Bump nine manifest ranges | **done** 2026-11-24 (red by design) | Commit `2ce2c83e`. `apps/mobile/package.json`: exactly nine `dependencies` lines changed (9+/9−), to the Task 1 values; nothing else touched. **Red case observed**: explicit-config sprint-122 run, exit 1, **1 of 16 tests fails**, "the lockfile satisfies every apps/mobile declaration", naming exactly the nine as `lock has <old>, manifest wants <new>` (e.g. `expo: lock has 57.0.31, manifest wants ~57.0.34`); the other 15 pass. Lock untouched until Task 3 |
| 3 Lockfile splice + npm ci proof | **done** 2026-11-24, green | Splice commit `0ae053d1`. **Steps 6-8**: `npx -y npm@11.19.0 ci` from `C:\Users\ravic\development\karmyq` (uppercase) exit 0, "found 0 vulnerabilities", lock sha unchanged (`cefb6751…`); `npm ls --all --package-lock-only --json` root problems **9 → 9**, total problem lines **45 → 45**, none new, none resolved (drive-letter case normalized); all 31 moved packages installed at their target versions; sprint-122 **16/16 pass**; `npm audit --audit-level=high` exit 0, 0 vulnerabilities; the sprint-122 + sprint-124 + sprint-131-d9 suites pass, 3 suites / 59 tests with `--no-cache`. Context: plain `npm ls --all` still crashes (`edgesOut`) from a lowercase `c:\` cwd, but completes from an uppercase `C:\` cwd (5 installed-tree problems, all among the 9 baseline ones). So the trigger is the `npm ls` cwd, not the install cwd that `apps/mobile/claude.md`'s S134 line names; Task 7 corrects that line. npm calls in the scripts ran npm-cli.js via node with no shell, because cmd.exe rewrites `^`/`>` in ranges. **Steps 1-5**, done 2026-11-24: Override-aware closure probe exit 0: 31 entries (9 targets + 22 transitive), each equal to the plan table, plus exactly one `OVERRIDE >=11.0.1 satisfied by 11.0.3 — no move` line (fingerprint's minimatch `^10.2.6`). Reverse-break scan CLEAN. Splice: 31 `a -> b` lines, no field adds/drops, nodes 1845 → 1845. Diff proof: **changed 32** (31 moves + `apps/mobile`), added 0, removed 0; every integrity/tarball equals `npm view`; key order preserved; workspace-node parity OK; the single minimatch node (11.0.3) unchanged. Steps 6-8 (strict `npm ci`, `npm ls` root-problem compare, sprint-122 green, `npm audit`) pending. If `npm ci` fails: restore `.tmp/sprint-146/package-lock.before.json` (= `2ce2c83e`'s lock) in a fix-forward commit and diagnose |
| 4 Drift gates green | **done** 2026-11-24 | Evidence only, at `557c4183`, no file changed. **Raw arbiter** (`npx expo install --check` from `apps/mobile`): exit 1 with exactly the two jest rows (`@types/jest@30.0.0` → 29.5.14, `jest@30.5.1` → ~29.7.0). That is the designed ADR-094 steady state. **Committed gate** (`node scripts/expo-divergences.js`): **exit 0**, exactly two `REGISTERED DIVERGENCE` lines (jest, @types/jest), then `✅ Expo divergence gate clean (2 registered divergence(s)).`, with no BLOCKING row. The gate-shape check was mutation-proved. **sprint-124 regression**: 31/31 pass, unchanged |
| 5 Mobile tests + type-check + root regression | **done** 2026-11-25 | Evidence only, at `03e398fe`, no file changed. `npm run type-check --workspace=@karmyq/mobile` exit 0. `npm test --workspace=@karmyq/mobile`: 2 suites / 5 tests pass. **Full root suite** `npm test -- --force` (Turbo cache bypassed): exit 0, **27/27 tasks successful, 0 cached**, 11m13s. Root `@karmyq/tests`: 50 suites / 1098 tests and 10 / 101, with sprint-122 and sprint-124 PASS in that run. No FAIL line in any workspace; only Jest's pre-existing "worker failed to exit gracefully" warnings. Cache note: `npm test` regenerated 3 landing files (architecture.json timestamp, build.json sha/date/adrCount, adr-010 CRLF→LF); all were generator churn and are reverted. The tracked `build.json` is already stale at `adrCount: 99` vs the generator's 104, so Task 6's regeneration must again keep only the ADR-059 page |
| 6 ADR-059 deepmerge reconciliation | **done** 2026-11-25 | Docs only. **Live re-check, 2026-11-25T15:24Z**: GHSA-gcqx-w48m-w2h4 `withdrawn_at` 2026-11-16T18:55:38Z (low, CVE-2026-93753, summary "Withdrawn Advisory: …"); PR #178 CLOSED 2026-07-30, never merged; **0** open code-scanning alerts on master; npm deepmerge latest 4.3.1, and the lock holds 4.3.1. `docs/adr/ADR-059-dependency-security-gate.md:524-531`: the original sentence is kept, with a dated "Re-check closed (Sprint 146, 2026-11-24)" close-out appended (7+/1−). No registry, exemption or dependency change; `expo-divergences.js --registry-only` exit 0. **Landing**: `npm run generate-docs --workspace=karmyq-landing`; the ADR-059 page delta is the `content` field only, exactly the source edit, LF. The same generator churn as Task 5 (architecture.json, build.json, adr-010) was reverted. The branch landing set vs `origin/master` is the expected five files: the four Sprint 145 pages, unchanged, plus ADR-059 as the only new one. Doc/context drift gate 41/41 |
| 7 Version v11.119.0 + mobile doc line | pending | — |
| 8 Handoff rewrite (this file) | pending | — |
| 9 SDLC quality gates | pending | — |
| 10 Final pre-commit-check | pending | — |
| 11 Merge + deploy (maintainer-authorized only) | pending | — |

### Task 1 evidence (captured 2026-11-24 at `ca97d62c`)

- **Base**: `git ls-remote origin refs/heads/master` = `95d5e8c1` = merge-base; no open PRs.
  The branch carries `013d4923` (Sprint 145 record) plus 8 planning/review commits;
  `git diff --name-only 013d4923..HEAD` names only this handoff, the plan and the spec.
- **Live gate** (`node scripts/expo-divergences.js`, node v24.11.1 / npm 10.8.2): **exit 1**,
  exactly two `REGISTERED DIVERGENCE` rows (jest ^30.5.1 vs ~29.7.0; @types/jest ^30.0.0 vs
  29.5.14) and exactly nine `BLOCKING` rows, installed → live pin:
  @expo/metro-runtime 57.0.17 → ~57.0.19 · expo 57.0.31 → ~57.0.34 · expo-constants 57.0.22 →
  ~57.0.25 · expo-image-picker 57.0.20 → ~57.0.22 · expo-linking 57.0.13 → ~57.0.14 ·
  expo-location 57.0.22 → ~57.0.24 · expo-notifications 57.0.24 → ~57.0.26 · expo-router
  57.0.29 → ~57.0.32 · expo-splash-screen 57.0.10 → ~57.0.12. These are identical to the plan
  list and the spec table, so **Task 2 bumps to exactly these values**.
- **No `SDK_PINNED` package drifted.** All nine are expo-prefixed, and none of the 11
  `SDK_PINNED` names (`tests/regression/sprint-122-expo-sdk-alignment.test.ts:103-115`)
  appears in the output.
- **Lock baselines**: 1845 `packages` nodes (lockfileVersion 3, version 11.118.0).
  `npm ls --all --package-lock-only --json`: exit 1, `ELSPROBLEMS`, **9 root problems** (exactly
  the nine the plan names: invalid minimatch@11.0.3, color-string@2.1.4, ms@2.0.0,
  picomatch@2.3.2, @emnapi/core@1.10.0, @emnapi/runtime@1.10.0, @emnapi/wasi-threads@1.2.1,
  @emnapi/runtime@1.11.2 under sharp-wasm32; missing @react-native/metro-config@* required by
  react-native-worklets@0.10.1), and **45 total problem lines** across the tree. Task 3 Step 6
  compares against both counts.
- **sha256 at HEAD**: `package-lock.json` 5751f9f3…; `apps/mobile/package.json` 69b3a75e…;
  `package.json` e88b5bda….
- **Landing pre-execution snapshot**: `git diff --name-only origin/master -- apps/landing` names
  the four Sprint 145 pages (adr-062, adr-106, community-service, social-graph-service).
  ADR-059 joins it after Task 6.
- **Green pre-change baseline**: the sprint-122, sprint-124 and sprint-131-d9 suites,
  explicit-config `--runInBand --no-cache`: **3 suites / 59 tests pass**. Task 2's red run is
  measured against this.
- The gate-shape check script was mutation-proved: one wrong pin makes it exit 1 with a
  mismatch. The raw outputs and ledger are in git-ignored
  `.superpowers/sdd/2026-11-24-sprint-146-expo-drift/` and exist on this Windows box only; this
  block is the copy that travels.

## Blockers and decisions

- **Planning-review blockers**: none; Codex cleared spec/plan at `6ee743ca`. Tasks 1-3 are done
  and the branch tip is green; nothing is pushed. Merge requires a fresh maintainer yes (Sprint
  145's merge authorization does not carry over).
- **Decision (Sprint 145, 2026-11-23)**: D1 an active invitee gets a no-write 200; D2 an
  invitation promotes a pending applicant; D3 any live active member may admit someone to a
  private community. Shipped — do not re-debate.
- **Decision (2026-11-24, Sprint 146 planning)**: goal = Expo drift #329; #178 re-check rides
  along as docs-only; version bump to v11.119.0 authorized. BUG-109 (invitation-generation
  membership check) remains the natural next sprint's candidate; BUG-107 stays deferred.

## Open candidates (carried forward)

- **[BUG-109](../../docs/BUGS.md) (security, untriaged).** Invitation generation mints codes for
  any community without a live-membership check and inflates `total_invitations_sent`
  (`services/social-graph-service/src/routes/invitations.ts:12-94`; the Sprint 145 acceptance
  side already refuses outsider-minted codes). Natural follow-up on the same surface.
- **[BUG-107](../../docs/BUGS.md).** Staff direct-add consent gap; deferred.
- **Sprint 145 review candidates (not filed).** Guessable 4-hex invitation-code suffix; a refused
  acceptance lands on discovery without saying why; deferred minors (shared social-graph test
  builders, integration `as()` helper, `MEMBERSHIP_CHANGED` wording, untrimmed code lookup,
  `liveRole.ts` `db` doc placement).
- **Gotcha candidate (not filed).** Bare supertest request is a thenable without `.finally`;
  needs a `docs/gotchas/` entry with a machine check.
- **Pre-existing doc defect.** `tests/claude.md` says the TDD promoter "runs as root
  `posttest`", but `.npmrc` `ignore-scripts=true` stops npm from running it.
- **Stale status headers (pre-existing).** `docs/BUGS.md` BUG-034, BUG-036, BUG-037 still say
  "pending deploy"; check each against its deploy before changing it.
- **CI image matrix.** `ci.yml` builds seven service images but not social-graph-service;
  deploys unaffected (`scripts/deploy.sh` builds all on the server).
- **Parked `origin/lane/lanes-provenance`.** Design, PR-1 plan and lane file exist only on that
  branch; its old ADR-098 number is taken on master — any ADR needs a fresh maintainer allocation.
- **Branches.** `agent/claude/sprint-145-planning` (merged) still exists on the remote; deleting
  it is the maintainer's call.
- **Carry-forward.** Governance rotation, revocation, delegation and opposition; close and
  expiry notifications; legacy member-handler error envelopes; mobile revival debt; the demo
  platform-admin grant and smoke (separate authorization); Sprint 144 review minors.

## Verification references

- Sprint 145: PR #342 merged 2026-11-24T19:42:37Z as squash `95d5e8c1`; CI/CD 45473083712 success
  14/14 with deploy; nine services healthy (observed 2026-11-24).
- Sprint 146 planning: master `95d5e8c1`, no open PRs, drift gate live capture 2026-11-24 (exit 1,
  nine BLOCKING rows, two registered divergences); deepmerge advisory withdrawn 2026-11-16,
  PR #178 CLOSED, zero open code-scanning alerts (observed 2026-11-24).

⚠️ **GitHub status goes stale.** Re-derive PR and deploy state before trusting anything here.
