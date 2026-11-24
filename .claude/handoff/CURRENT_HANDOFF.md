# Sprint 146 planned — Expo SDK drift reconciliation (#329) + Deepmerge #178 close-out — Handoff

**Date**: 2026-11-24
**Outcome**: planned, awaiting non-author review and execution. Sprint 146 goal named by the
maintainer 2026-11-24: **Expo drift #329** — align the nine drifted SDK-57 pins in `apps/mobile`
to Expo's live version map. Two maintainer authorizations given with the goal: the Deepmerge #178
re-check rides along as a docs task, and the version bump (→ v11.119.0). Merge/deploy, any ADR
number and demo-data operations remain unauthorized.

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-146-planning`, cut from `origin/master` `95d5e8c1` (fetched 2026-11-24) |
| **Base** | `origin/master` `95d5e8c1` = Sprint 145, [PR #342](https://github.com/ravichavali/karmyq/pull/342), v11.118.0 |
| **Active editor** | Claude (planner, 2026-11-24). The executor takes over; one editor at a time in the shared Windows checkout |
| **Reviewer role** | A non-author (Codex) reviews this sprint's spec and plan before implementation |
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
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`).
   There is no `/execute-plan` slash command — superpowers removed it as a deprecated stub.
5. Checkpoint: after every group of at most 3 tasks, and before starting any long-running suite or
   subagent review, commit and update this handoff's task status (task, state, SHA, evidence) and
   say what you are waiting on. A mid-sprint pickup reads this handoff, never `git log`.

**Next unchecked task**: Task 1 (branch state + live drift capture). If master has moved past
`95d5e8c1`, stop and re-plan — the base changed.

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

- **Blocker**: none for execution; merge requires a fresh maintainer yes (Sprint 145's merge
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
