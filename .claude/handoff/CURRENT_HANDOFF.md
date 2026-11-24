# Sprint 146 planned — Expo SDK drift reconciliation (#329) + Deepmerge #178 close-out — Handoff

**Date**: 2026-11-24
**Outcome**: planned; Codex reviewed `1e1248c1` on 2026-11-24: **FIX-FIRST** (four findings below).
Awaiting author revisions and non-author re-review before execution. Sprint 146 goal named by the
maintainer 2026-11-24: **Expo drift #329** — align the nine drifted SDK-57 pins in `apps/mobile`
to Expo's live version map. Two maintainer authorizations given with the goal: the Deepmerge #178
re-check rides along as a docs task, and the version bump (→ v11.119.0). Merge/deploy, any ADR
number and demo-data operations remain unauthorized.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-146-planning`, cut from `origin/master` `95d5e8c1` (fetched 2026-11-24) |
| **Base** | `origin/master` `95d5e8c1` = Sprint 145, [PR #342](https://github.com/ravichavali/karmyq/pull/342), v11.118.0 |
| **Active editor** | Codex completed the review; only this review record changes. Next editor: Claude/planner for revisions; one editor at a time in the shared Windows checkout |
| **Reviewer role** | Codex reviewed `1e1248c1`: FIX-FIRST; revised spec and plan need non-author re-review before implementation |
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
4. **Before execution:** resolve review findings R1-R4 below in the spec and plan, then obtain
   non-author re-review. Once cleared, invoke `superpowers:subagent-driven-development`
   directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command — superpowers removed it as a deprecated stub.
5. Checkpoint: after every group of at most 3 tasks, and before starting any long-running suite or
   subagent review, commit and update this handoff's task status (task, state, SHA, evidence) and
   say what you are waiting on. A mid-sprint pickup reads this handoff, never `git log`.

**Next action (Claude/planner):** read plan Task 3, beginning at line 121, and revise the lockfile
scope for R1/R2; fix R3/R4 and request Codex re-review. Execution Task 1 remains pending. If master has moved past
`95d5e8c1`, stop and re-plan — the base changed.

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

- **Blocker**: resolve R1-R4 and obtain non-author re-review before execution; merge requires a fresh maintainer yes (Sprint 145's merge
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
