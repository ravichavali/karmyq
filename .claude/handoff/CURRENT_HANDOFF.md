# Sprint 146 planned — Expo SDK drift reconciliation (#329) + Deepmerge #178 close-out — Handoff

**Date**: 2026-11-24
**Outcome**: planned; Codex re-reviewed `93a7d4f6` on 2026-11-24: **FIX-FIRST** (RR1-RR4 below).
The workspace mirror fix is accepted; the minimatch proposal, graph proof and remaining stale
instructions need author revisions and non-author re-review before execution. Sprint 146 goal named by the maintainer 2026-11-24: **Expo
drift #329** — align the nine drifted SDK-57 pins in `apps/mobile` to Expo's live version map.
Two maintainer authorizations given with the goal: the Deepmerge #178 re-check rides along as a
docs task, and the version bump (→ v11.119.0). Merge/deploy, any ADR number and demo-data
operations remain unauthorized.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-146-planning`, cut from `origin/master` `95d5e8c1` (fetched 2026-11-24) |
| **Base** | `origin/master` `95d5e8c1` = Sprint 145, [PR #342](https://github.com/ravichavali/karmyq/pull/342), v11.118.0 |
| **Active editor** | Codex completed the re-review of `93a7d4f6`; only this review record changes. Next editor: Claude/planner for RR1-RR4; one editor at a time in the shared Windows checkout |
| **Reviewer role** | Codex re-reviewed `93a7d4f6`: FIX-FIRST; next revisions need non-author re-review before implementation |
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
4. **Before execution:** Claude/planner resolves RR1-RR4 below, then Codex re-reviews.
   Once cleared, invoke `superpowers:subagent-driven-development`
   directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command — superpowers removed it as a deprecated stub.
5. Checkpoint: after every group of at most 3 tasks, and before starting any long-running suite or
   subagent review, commit and update this handoff's task status (task, state, SHA, evidence) and
   say what you are waiting on. A mid-sprint pickup reads this handoff, never `git log`.

**Next action (Claude/planner):** read plan Task 3 Step 3 (line 252 at reviewed `93a7d4f6`)
and `package.json:70`; resolve RR1-RR4 and request Codex re-review. Execution Task 1 remains
pending. If master has moved past `95d5e8c1`, stop and
re-plan — the base changed.

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
Live `gh pr list --state open` returned empty; remote master remains `95d5e8c1`.

**Set aside:** pre-existing dependency/runtime problems and implementation/release readiness.
They are baseline context, not authorization for broader dependency work or deployment.

## Sprint 146 goal and arc

Align nine `expo-*/@expo/*` pins (live capture 2026-11-24: metro-runtime → ~57.0.19, expo →
~57.0.34, expo-constants → ~57.0.25, expo-image-picker → ~57.0.22, expo-linking → ~57.0.14,
expo-location → ~57.0.24, expo-notifications → ~57.0.26, expo-router → ~57.0.32,
expo-splash-screen → ~57.0.12) to Expo's live SDK-57 map, prove the drift gates green, close #329,
and land the Deepmerge #178 re-check as an ADR-059 docs reconciliation. Ship as v11.119.0.
Arc: S121/122 built the Expo SDK gates (ADR-088/094) → S136 mobile deps → **S146: first real
use of the drift machinery**.

Deepmerge #178 evidence (live, 2026-11-24, cited verbatim in the spec): GHSA-gcqx-w48m-w2h4
`withdrawn_at` 2026-11-16T18:55:38Z; PR #178 CLOSED; zero open code-scanning alerts on master.
The re-check obligation closes; documentation only.

## Critical implementation notes (verbatim from the spec — read before Task 2)

1. **Never trust a drift number older than the run that produced it.** Capture
   `npx expo install --check` (or `node scripts/expo-divergences.js`) output at execution time
   and bump to *those* values. The issue's numbers and the spec table are evidence, not
   instructions. If the live map differs, the live map wins; if it moved a `SDK_PINNED` package,
   that map entry changes too, with a written reason per its comment contract.
2. **Lockfile edits are surgical.** Never `npm install --workspace`, never `npm dedupe`, never a
   scratch regen. Edit the nine hoisted `package-lock.json` entries in place (version, resolved,
   integrity from `npm view <pkg>@<version> dist.tarball dist.integrity`), diff each entry's
   `dependencies`/`peerDependencies` between old and new and splice any change, then prove with a
   strict `npm ci`.
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
| 1 Branch state + live drift capture | pending | — |
| 2 Bump nine manifest ranges | pending | — |
| 3 Lockfile splice + npm ci proof | pending | — |
| 4 Drift gates green | pending | — |
| 5 Mobile tests + type-check + root regression | pending | — |
| 6 ADR-059 deepmerge reconciliation | pending | — |
| 7 Version v11.119.0 + mobile doc line | pending | — |
| 8 Handoff rewrite (this file) | pending | — |
| 9 SDLC quality gates | pending | — |
| 10 Final pre-commit-check | pending | — |
| 11 Merge + deploy (maintainer-authorized only) | pending | — |

## Blockers and decisions

- **Blocker**: resolve Codex re-review findings RR1-RR4 at `93a7d4f6`, then obtain non-author
  re-review; merge requires a fresh maintainer yes (Sprint 145's merge
  authorization does not carry over).
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
