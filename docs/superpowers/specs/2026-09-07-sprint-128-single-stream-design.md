# Sprint 128: Reliable delivery, one stream — Design Spec

**Date:** 2026-09-07
**Status:** Scope approved by the maintainer in this planning session; detailed design ready for independent review.
**Current version:** v11.47.0 (`package.json:3`); derive each release bump from `origin/master` at merge time.
**First branch:** `agent/codex/sprint-128-planning` (planning artifacts and PR A implementation stay together).

## Overview

Make the development framework dependable in the setup the maintainer actually has today: one
Windows checkout, one active editing agent, and sequential work. The other laptop is not set up
(maintainer confirmation, September 7). Prepare the instructions for future parallel streams,
but do not count a two-machine trial as a Sprint 128 deliverable.

Ship three sequential PRs: reconcile the framework, repair urgent security/dependency maintenance,
and correct the standing-backfill operator preview. Each PR has its own plan, review and deploy
checkpoint. A fresh chat executes each PR; this chat produces planning artifacts only.

### Core principle

Make ownership and the next action explicit, and prove claimed behavior against its real source.

## Verified starting point

| Evidence | Implication |
|---|---|
| `git log origin/master` and `gh pr view 220`, read September 7: #220 merged at `a7dde43e` on September 6 | Sprint 127 implementation is merged; its old unmerged handoff was stale |
| [CI/CD run 34058385551](https://github.com/ravichavali/karmyq/actions/runs/34058385551) succeeded | Prior deploy pipeline passed; this session did not perform a new smoke test |
| `claude.md:352`, `:388`, `:435` | Cross-machine ownership still requires maintainer allocation; a branch-local router is not a lock |
| `.claude/skills/sprint-planning/SKILL.md:199`, `:208`, `:214` | Review cadence, test placement and handoff writing lag canonical rules |
| `.claude/skills/deploy/SKILL.md`, Steps 1–3; `.claude/skills/ship/SKILL.md`, Phase 3 | Local-master merge/direct-push recipes contradict the protected-PR workflow |
| `.claude/agents/process-reviewer.md`, Test suite step | Its output pipe hides the original exit code and supplies a questionable Turbo argument |
| `scripts/audit-exemptions.js:194`, `:280` | Missing audit findings become an empty map; parsed process-error JSON reaches the evaluator |
| `security/audit-exemptions.json:12`, `:22` | Both exemptions become invalid on September 15; target resolution by September 12 for review margin |
| [Expo issue #206](https://github.com/ravichavali/karmyq/issues/206), read September 7 | Eight Expo-family patch drifts were reported; remeasure before selecting versions |
| `standingBackfillService.ts:638`, `:695` under `services/reputation-service/src/services/` | Preview derives metrics from replayed matches and uses them for score/provider distributions |
| `services/reputation-service/src/services/karmaService.ts:22`; `src/database/trustMetricsDb.ts:24` in the same service | Live score refresh reads canonical karma, including the user's global community breadth |
| `services/request-service/src/services/providerReachService.ts:110` | Provider reach filters personal user/community standing, not provider-profile quality |

## Delivery sequence and ownership

| PR | Outcome | Branch | Primary ownership |
|---|---|---|---|
| A | Instructions work for one stream and describe a safe future second stream | Existing planning branch | `.claude/` workflow files, `AGENTS.md`, `claude.md`, `CONTRIBUTING.md`, learning concept, planning docs |
| B | Audit errors fail clearly; dated security decisions remain valid; SDK drift addressed | `agent/codex/sprint-128-security-maintenance` | Audit script/tests, security registries, Dependabot config, mobile dependency surface, relevant docs |
| C | Backfill preview agrees with the score writer and provider reach semantics | `agent/codex/sprint-128-standing-preview` | Reputation backfill implementation/tests/context, relevant docs |

Branches B and C are created from freshly fetched `origin/master` only after the prior PR lands
and its deploy/health checks finish. No worktrees, concurrent implementers, stacked branches or
second laptop setup. Codex may implement; Claude reviews artifacts it did not author, recommends
merge readiness, and executes a merge only after explicit maintainer authorization. A same-machine
role change requires a clean committed tree and an explicit transfer, without pushing another
agent's branch. Maintainer retains scope, dependency ownership, ADR allocation and data-operation
authority. The approved single stream owns the scheduled dependency work during PR B; revisit
allocation only if another active task is introduced. Planning approval is not an exemption-renewal
or merge decision.

If PR A threatens the security deadline, stop adding process polish and ask the maintainer to
reorder A/B. Do not bury the expiry behind an open-ended framework cleanup.

## PR A — framework refinements

Update existing playbooks; do not introduce a coordinator service, reservation file, dashboard,
or new automatic gate. The existing canonical rules remain the source of authority.

- Explicit single-stream mode: `CURRENT_HANDOFF.md` contains the active PR's actionable state.
- Future multi-stream mode: router plus one owned lane file per stream. A missing branch row in
  an active router requires reconciliation, not silently adopting another sprint's state.
- Every plan names outcome, branch/base, owner/reviewer role, write paths, shared surfaces,
  checks, merge/deploy boundary and next action. Global policy is linked instead of duplicated.
- Handoff records decisions and unresolved work, links GitHub for dynamic status, and timestamps
  any necessary snapshot. Do not embed its own final commit SHA or claim post-merge results
  before merging. Prepare a next-session live reconciliation step before merge; no follow-up
  master push solely to update the handoff.
- Bring sprint-planning, handoff/update-handoff, ship/deploy and the process-reviewer recipe into
  agreement with canonical PR-only merges, scoped TDD placement, calibrated reviews and exit-code
  preservation. Update AGENTS only where bootstrap guidance actually changes.
- Retain the four gates and independent review. For a small PR, one simplify pass on the PR is
  sufficient; riskier code warrants deeper review. Record concrete findings instead of repeating
  the same checks after no relevant change.
- Future activation checklist: second checkout/bootstrap verified on its actual host, maintainer
  names file-disjoint owners and dependency holder, allocates ADRs if needed, and confirms the
  serialized merge/deploy procedure. This checklist is reviewed here; execution is deferred.

Validate with walkthroughs: fresh single-stream chat, author-to-reviewer transfer, merged PR with
stale handoff, unmatched branch in router mode, and two hypothetical requests for one dependency
lane/ADR/merge slot. Documentation walkthroughs are evidence, not a claim of live concurrency.

## PR B — reliable maintenance

### Audit response contract

Treat an absent, malformed or error-bearing npm report as unavailable evidence. Validate the
response before exemption matching. Both empty and populated registries must fail on unavailable
evidence, with no clean verdict and no instruction to remove unmatched exemptions.

Preserve valid vulnerability responses from npm's nonzero finding exit. A valid zero-findings
report with an empty registry passes; a valid report with an actually unmatched exemption still
fails. Critical remains non-exemptible. Test parser, evaluator and subprocess entry behavior;
do not rely solely on a mocked successful audit call. Reuse the existing evaluator/CLI and
constant fixture allowlist, without adding arbitrary environment-selected file reads.

### Exemptions and dependency maintenance

Remeasure `image-size` using the existing upstream-check script. Prefer a compatible remediation
if available. Otherwise prepare exact renewed entries with measured rationale for maintainer
approval, then apply the approved decision before September 15 (first invalid day). Never invent
approval text, extend the 30-day cap, or widen the exemption identities.

Resolve current Expo SDK 57 drift from `node scripts/expo-divergences.js`, retaining documented
Jest divergences only while they still match. Issue #206 is a lead, not a current version oracle.
Prevent independent Dependabot version updates of SDK-managed packages using a config list whose
identity is mechanically verified against the existing `SDK_PINNED` set and installed mobile
Expo-family declarations, with documented independent-package exclusions. Do not suppress the
security audit or automatically merge queued dependency proposals. Parse YAML with an already
declared dependency in the changed workspace, or explicitly declare one surgically if needed.

Strict `npm ci`, resolved-version checks, the live Expo gate, mobile tests/type-check, audit
regressions and the full blocking suite must pass. No TypeScript/ESLint/Expo major migration or
blanket Dependabot cleanup is included. Large compatibility work discovered by triage gets a
separate proposal; expiry remediation remains the immediate priority.

## PR C — truthful standing preview

Preserve the production trust formula, provider policy/floors, canonical projection and apply
authorization boundary. Correct the preview's inputs and counting semantics. A score of 1 is not
a new floor: with default breadth weight 0.4, a member with no local history but one community of
canonical activity elsewhere has a breadth contribution rounding to 1. A member with no history
anywhere and no feedback has score 0. Pin both cases.

The preview must model canonical karma as it will exist after the proposed backfill: preserve
unaffected rows, account for planned inserts/replacements, and never double-count already
projected identities. Global breadth and local counterpart/repeat metrics must follow the actual
SQL semantics in `trustMetricsDb.ts`, rather than only the replay membership map. Use the existing
pure score/feedback functions. Freeze the evaluation time in tests and use the same configuration
and effective-parameter assumptions as live refresh; verify cache-related differences explicitly.

For `providerEligibility`, count eligible provider/community pairs consistently with the current
report contract and request-service reach filters (active profile/member, enabled community,
allowlist, personal standing). Document the counting unit so it cannot be confused with unique
providers across communities. The full cause of the historical 384-versus-499 discrepancy is
UNVERIFIED until a fixed dataset reproduces it; do not hardcode those historical totals or assume
it comes entirely from the score-bucket defect.

Prove preview/apply equivalence on a disposable database by running the real projector and score
refresh and comparing exact score buckets and provider-floor counts at 1/20/40/60. The existing
mocked `updateTrustScore` in the Sprint 126 backfill test cannot prove that equivalence. Include
multi-community history, no history, mixed legacy/canonical rows, preserved unrelated canonical
history, boundary timestamps, null/zero config overrides, negative scores and provider filters.
Preview must remain read-only, repeatable on a fixed dataset, and idempotent after apply.

Windows has no local Docker according to canonical host guidance. Use an explicitly authorized
disposable DB/container for integration; never point the fixture/apply test at demo data. If that
environment is unavailable, record integration as blocked and leave PR C unmerged. A demo backfill
is not required to deliver this fix.

## Data model, APIs and frontend

No schema migration, endpoint/event change, frontend screen change or trust-floor change is
planned. The CLI report retains its fields; correct and document their semantics. An interface
or policy change discovered during execution requires a revised design and review.

## User guide and documentation updates

- A: `CONTRIBUTING.md` workflow, `.claude/handoff/README.md`/`TEMPLATE.md`, workflow skills and
  `docs/concepts/how-karmyq-learns.md` explain portable knowledge and resumable work.
- B: `scripts/claude.md`, `docs/adr/ADR-059-dependency-security-gate.md`, `docs/BUGS.md` BUG-038,
  existing audit/Dependabot gotcha pairs, and `apps/mobile/claude.md` for changed dependency facts.
  Update the learning concept's verifiable-check example to distinguish unavailable evidence.
- C: reputation `CONTEXT.md` runbook/recent fixes, reputation registry notes,
  `docs/adr/ADR-096-canonical-completed-match-standing-projection.md` preview clarification and
  `docs/guides/understanding-trust.md` explain local versus cross-community contributions.
- Generate landing docs from those sources and inspect the result. Revert timestamp/HEAD-only
  churn; never author generated JSON. Existing concept/guide slugs are already in the generator
  (`scripts/generate-docs.ts:249`, `:334`, `:587`).
- Existing ADR clarifications suffice for the proposed fixes. No new ADR number is allocated.

## Critical implementation notes

1. One active stream on Windows; the second laptop is not set up. One editor at a time and a clean tree at role handoff.
2. A → B → C are sequential PRs, each based on refreshed `origin/master`; no worktrees or direct master pushes.
3. `CURRENT_HANDOFF.md` holds this stream's state. A future router is a pointer, never a lock or proof of ownership.
4. Security exemptions become invalid on September 15, 2026. Remeasure and obtain the exact renewal/remediation decision; do not assume approval.
5. Invalid audit evidence must fail before exemption matching for both empty and populated registries.
6. Preserve the trust formula and provider floors. Preview equivalence must exercise the real score writer, not a mocked return value.
7. New reputation tests begin in its `tests/tdd/` and promote when green; root cross-repo gates belong in `tests/regression/` because root TDD does not auto-promote.
8. Declare every imported dependency, edit manifests/lockfile surgically, and prove dependency changes with strict `npm ci`.
9. Every PR runs tests, simplify, independent code review and security review; maintainer authorization precedes merge, and deploy plus health verification precede the next merge.
10. Write source docs, remove generated timestamp/HEAD churn, and reconcile the handoff against live git/PR state before stopping.

## Success and deferred work

Success: all three PR outcomes are verified, expiry is handled in time, fresh-chat and reviewer
handoffs succeed, and the retrospective records actual friction. Record per PR: review rounds,
findings first caught in CI, stale-state corrections, ownership clarification requests and time
waiting on a decision/deploy (omit unavailable timings). Use these observations to choose at most
three next improvements; no new permanent telemetry system.

Deferred: actual second-machine setup/concurrency trial, provider floor selectivity, blocking-lint
policy, network import, new onboarding UX, framework-major dependency upgrades and demo data writes.
Claude alone marks the sprint complete after approved delivery and verification.
