# Between sprints — Sprint 145 shipped (v11.118.0); Sprint 146 not yet planned — Handoff

**Date**: 2026-11-24
**Outcome**: shipped. Sprint 145 (admission integrity, BUG-106 and BUG-108) is merged and deployed. This branch
carries its post-merge record, which rides with the next product PR (never a docs-only master push).

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-146-planning`, cut from `origin/master` `95d5e8c1` (fetched 2026-11-24) |
| **Base** | `origin/master` `95d5e8c1` = Sprint 145, [PR #342](https://github.com/ravichavali/karmyq/pull/342), v11.118.0 |
| **Active editor** | Claude (post-merge record, 2026-11-24). The next sprint's planner takes over; one editor at a time in the shared Windows checkout |
| **Reviewer role** | A non-author (Codex) reviews the next sprint's spec and plan |
| **Owned paths** | The Sprint 145 post-merge record: this handoff, its archive, `docs/BUGS.md` BUG-106/108, the ADR-062 and ADR-106 status text, both services' `CONTEXT.md` status lines, and the regenerated landing pages. The next sprint adds its own paths |
| **Shared resources needed** | None allocated. The next sprint's version, merge slot, any ADR number, dependency work and demo-data operations each need their own maintainer yes |

## Links

- **Shipped record**: [archive/2026-11-24-sprint-145-admission-integrity-SHIPPED-v11.118.0.md](archive/2026-11-24-sprint-145-admission-integrity-SHIPPED-v11.118.0.md)
- **Spec / plan for the next sprint**: none yet

## Quick Start

1. Read [CLAUDE.md](../../CLAUDE.md), then confirm live state: `git fetch origin`, `gh pr list`,
   `git log --oneline origin/master -3`. Master should be `95d5e8c1` unless something merged since.
2. Reuse this branch (`git switch agent/claude/sprint-146-planning`). If master moved, update it with a merge commit,
   never a rebase.
3. Plan Sprint 146 with the `sprint-planning` skill once the maintainer names the goal. The open candidates are
   below. The spec, plan and handoff go on this branch with the post-merge record.

**Next unchecked task**: the maintainer picks the Sprint 146 goal. Nothing is executable until then.

## Blockers and decisions

- **Blocker**: no Sprint 146 goal yet; the maintainer decides.
- **Decision (Sprint 145, 2026-11-23)**: D1 an active invitee gets a no-write 200; D2 an invitation promotes a pending
  applicant (accepting the stale staff notification); D3 any live active member may admit someone to a private
  community, subject to capacity and block checks. Do not re-debate these; they shipped.
- **Decision (2026-11-24)**: the release was approved ("Approved — merge PR #342 and deploy"), and the admin-override
  merge got its own "Yes, admin merge". Neither carries over to the next PR.

## Open candidates (carried forward)

- **Deepmerge #178 re-check by 2026-12-01.** #178 returns HTTP 410 (withdrawn), and
  [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) was withdrawn on 2026-11-16. Reconcile
  the old obligation; no upgrade is authorized.
- **[BUG-109](../../docs/BUGS.md) (security, untriaged).** Invitation generation mints codes for any community
  without a live-membership check and inflates `total_invitations_sent`. Sprint 145's acceptance-side live-inviter
  gate stops outsider-minted codes from admitting anyone; generation is unchanged. This is the natural follow-up on
  the same surface.
- **[BUG-107](../../docs/BUGS.md).** Staff direct-add consent gap; deferred.
- **Sprint 145 review candidates (not filed).**
  - Invitation codes carry a 4-hex suffix per inviter-year (`init.sql:189-213`), so they are guessable within an
    inviter's year. This is pre-existing, and the live-inviter check narrows it.
  - A refused acceptance lands on discovery without saying why.
  - Deferred minors: shared social-graph test builders, an integration `as()` helper, the `MEMBERSHIP_CHANGED`
    wording, the untrimmed code lookup after a blank check, and the `liveRole.ts` `db` doc placement.
- **Gotcha candidate (not filed).** A bare supertest request is a thenable without `.finally`: `req.finally(...)`
  throws before sending, leaks a listening server, and Jest never exits. A `docs/gotchas/` entry needs a machine
  check, for example a static scan of `tests/integration` for `.finally(` on a request chain.
- **Pre-existing doc defect.** `tests/claude.md` says the TDD promoter "runs as root `posttest`", but `.npmrc`
  `ignore-scripts=true` stops npm from running it.
- **Stale status headers (pre-existing, not touched here).** `docs/BUGS.md` BUG-034, BUG-036 and BUG-037 still say
  "pending deploy". Check each against its deploy before changing it.
- **CI image matrix.** `.github/workflows/ci.yml:387-394` builds seven service images but not social-graph-service.
  `scripts/deploy.sh` builds every compose service on the server and health-checks social-graph (`:208`, `:279`), so
  deploys are unaffected; CI just never builds that image before merge.
- **[Expo drift #329](https://github.com/ravichavali/karmyq/issues/329).** The daily run fails on nine patch
  mismatches. No advisory is established, so the maintainer must justify and allocate any dependency work.
- **Parked `origin/lane/lanes-provenance`.** Its design, PR-1 plan and lane file exist only on that branch. Schedule
  it or land a reconciled spec. Its old ADR-098 number is taken on master, so any ADR needs a fresh allocation.
- **Branches.** GitHub auto-delete of merged head branches is OFF. `agent/claude/sprint-145-planning` (merged) still
  exists on the remote; deleting it is the maintainer's call.
- **Carry-forward.** Governance rotation, revocation, delegation and opposition; close and expiry notifications;
  legacy member-handler error envelopes; mobile revival debt; the demo platform-admin grant and smoke (separate
  authorization); Sprint 144 review minors.

## Verification references

- PR #342 merged 2026-11-24T19:42:37Z as squash `95d5e8c1` (observed 2026-11-24).
- [CI/CD 45473083712](https://github.com/ravichavali/karmyq/actions/runs/45473083712): success, 14/14 jobs, Deploy
  to Demo included; all nine services healthy; no migration applied (observed 2026-11-24).
- Open CodeQL alerts on master: 0 (observed 2026-11-24).
- External probe 2026-11-24: `GET /` → 200; wrong-password `POST /api/auth/login` → 401 ADR-074 envelope.
- Full evidence: the shipped archive linked above.

⚠️ **GitHub status goes stale.** Re-derive PR and deploy state before trusting anything here.
