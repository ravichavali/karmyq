# Sprint 128: Reliable delivery, one stream — Design Spec

**Date:** 2026-09-07
**Status:** Scope and implementation planning approved; review refinements incorporated. E1 and D1 authorized on 2026-09-07; implementation has not started.
**Current version:** v11.47.0 (`package.json:3`); derive each release bump from `origin/master` at merge time.
**First branch:** `agent/codex/sprint-128-planning` (planning artifacts and PR B implementation stay together).

## Overview

Make the development framework dependable in the setup the maintainer actually has today: one
Windows checkout, one active editing agent, and sequential work. The other laptop is not set up
(maintainer confirmation, September 7). Prepare the instructions for future parallel streams,
but do not count a two-machine trial as a Sprint 128 deliverable.

Ship three sequential PRs in **B → A → C** order: repair urgent security/dependency maintenance,
reconcile the framework, then correct the standing-backfill operator preview. Keep the existing
PR labels and filenames so review references remain stable. Each PR has its own plan, review and deploy
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
| `scripts/audit-exemptions.js:194`, `:281` | Missing audit findings become an empty map; parsed process-error JSON reaches the evaluator |
| `security/audit-exemptions.json:12`, `:22` | Both exemptions become invalid on September 15; target resolution by September 12 for review margin |
| [Expo issue #206](https://github.com/ravichavali/karmyq/issues/206), read September 7 | Eight Expo-family patch drifts were reported; remeasure before selecting versions |
| `standingBackfillService.ts:638`, `:695` under `services/reputation-service/src/services/` | Preview derives metrics from replayed matches and uses them for score/provider distributions |
| `services/reputation-service/src/services/karmaService.ts:22`; `src/database/trustMetricsDb.ts:24` in the same service | Live score refresh reads canonical karma, including the user's global community breadth |
| `services/request-service/src/services/providerReachService.ts:110` | Provider reach filters personal user/community standing, not provider-profile quality |

## Delivery sequence and ownership

| PR | Outcome | Branch | Primary ownership |
|---|---|---|---|
| B (first) | Audit errors fail clearly; dated security decisions remain valid; SDK drift addressed | Existing planning branch | Audit script/tests, security registries, Dependabot config, mobile dependency surface, relevant docs and planning artifacts |
| A (second) | Instructions work for one stream and describe a safe future second stream | `agent/codex/sprint-128-framework` | `.claude/` workflow files, doc drift gate, `AGENTS.md`, `claude.md`, `CONTRIBUTING.md`, learning concept |
| C | Backfill preview agrees with the score writer and provider reach semantics | `agent/codex/sprint-128-standing-preview` | Reputation backfill implementation/tests/context, relevant docs |

Branches A and C are created from freshly fetched `origin/master` only after the prior PR lands
and its deploy/health checks finish. No worktrees, concurrent implementers, stacked branches or
second laptop setup. Codex may implement; Claude reviews artifacts it did not author, recommends
merge readiness, and executes a merge only after explicit maintainer authorization. A same-machine
role change requires a clean committed tree and an explicit transfer, without pushing another
agent's branch. Maintainer retains scope, dependency ownership, ADR allocation and data-operation
authority. The approved single stream owns the scheduled dependency work during PR B; revisit
allocation only if another active task is introduced. Separate E1/D1 approvals are recorded below;
neither planning approval nor those operation decisions authorize a merge.

PR B has no dependency on PR A. Until the deploy skill is repaired, follow `claude.md`'s canonical
PR-only merge procedure and the handoff's Standing mechanics. Do not execute the obsolete local
master merge/push recipe. The security deadline takes precedence over framework polish.

## PR A — framework refinements

Update existing playbooks and add one assertion to the existing doc/context drift gate; do not
introduce a coordinator service, reservation file or dashboard. The canonical rules remain the
source of authority. The assertion scans workflow-skill command examples for literal pushes to
master, with an isolated negative fixture reproducing the current deploy recipe. It also covers
the ship skill's inline command example. Test the checker against the real discovered skill files;
do not assert that a general-purpose shell/authorization analyzer has been built.

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

Retain walkthroughs for facts that a static gate cannot prove: fresh single-stream chat, author-to-reviewer transfer, merged PR with
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
if available. Otherwise apply the exact approved E1 entries before September 15 (first invalid
day), after confirming the unchanged-evidence condition. Changed evidence requires a fresh
measured proposal. Never invent approval text, extend the 30-day cap, or widen the identities.

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

Build a reusable preview index once per projected dataset: `buildPreviewIndex(rows)` followed by
`computePreviewMetrics(index, userId, communityId, nowMs)` for each membership. Precompute global
breadth and local counterpart/repeat metrics; store sorted local canonical timestamps so the
recent-interaction boundary can be answered by binary search, without a full-row rescan per member.

The preview must model canonical karma as it will exist after the proposed backfill: preserve
unaffected rows, account for planned inserts/replacements, and never double-count already
projected identities. Global breadth and local counterpart/repeat metrics must follow the actual
SQL semantics in `trustMetricsDb.ts`, rather than only the replay membership map. Use the existing
pure score/feedback functions. Freeze the evaluation time in tests and use the same configuration
and effective-parameter assumptions as live refresh; verify cache-related differences explicitly.

For `providerEligibility`, retain the existing provider-profile/community pair unit, keyed by
`provider_id|community_id`: two profiles owned by one user in the same community count twice.
`PROVIDERS_QUERY` already applies the active profile/member, enabled community and allowlist
filters (`standingBackfillService.ts:236`). No filter change is expected or authorized by this
diagnosis. Fixed floors 1/20/40/60 are intentional what-if scenarios; the live reach query instead
uses the community's configured floor. Correct score inputs while preserving this report contract.
The full cause of the historical 384-versus-499 discrepancy is
UNVERIFIED until a fixed dataset reproduces it; do not hardcode those historical totals or assume
it comes entirely from the score-bucket defect.

Prove preview/apply equivalence on a disposable database by running the real projector and score
refresh and comparing exact score buckets and provider-floor counts at 1/20/40/60. The existing
mocked `updateTrustScore` in the Sprint 126 backfill test cannot prove that equivalence. Include
multi-community history, no history, mixed legacy/canonical rows, preserved unrelated canonical
history, boundary timestamps, null/zero config overrides, negative scores and provider filters.
Preview must remain read-only, repeatable on a fixed dataset, and idempotent after apply.

Windows has no local Docker. PR C Task 1 is a hard preflight gate before implementation: use
the recorded scoped operation authorization below, provision separate PostgreSQL 15 and Redis 7 containers
on the demo host, load repository-generated schema plus synthetic fixtures, establish SSH tunnels,
and run the existing integration baseline. The prior mechanism is documented in the Sprint 126
archive at lines 254–273; do not copy its obsolete `--forceExit` flag or assume old containers remain.
If provisioning/baseline fails, stop PR C before new implementation. A demo-data backfill is not required.

## Authorized implementation decisions

### E1 — resolved through remediation; renewal not applied

**Resolution, 2026-09-08:** the planned SDK update installs Expo 57.0.20 → `@expo/metro` 56.0.2
→ Metro 0.84.5. Read from installed manifests and `metro/src/Assets.js`: image-size is no longer
a dependency, and the asset code uses an internal parser. No other lockfile dependency points to
image-size; queue was referenced only by that orphan. PR B removes both orphaned lock entries and
the two now-unmatched exemptions. Live `runAudit`/`evaluateAudit` passes with zero high/critical
and an empty registry. This uses the already-authorized compatible-remediation alternative;
the conditional renewal below is historical and was not applied.

Read-only `node scripts/check-image-size-upstream.js --json` measurement at
`2026-09-07T23:56:52.195Z`: image-size latest 2.0.2; both GHSA advisories remain high, not withdrawn,
range `<= 2.0.2`, no first patched version. Metro latest 0.87.0 still declares `image-size ^1.0.2`.
Resolved mobile chain remains `expo@57.0.12 → @expo/metro@56.0.0 → metro@0.84.4 → image-size@1.2.1`.
The monitor returned `ok: true` (nothing newly actionable), not proof that the package is safe.

Preserve exact identities `image-size|GHSA-w3rx-r6r6-pgpr` and
`image-size|GHSA-5p2g-fcmc-qvqq`, severity high and owner `ravichavali`; set `created` to
`2026-09-07` and `expires` to `2026-10-07` (first invalid day, 30-day span). In each entry, replace
the rationale with the measurement above plus the existing measured mobile-only bundler reach
and default-export incompatibility rationale; retain the weekly monitor. Recheck
upstream/installed-tree evidence after SDK edits; if remediation becomes compatible, use it and
remove the now-unmatched entries instead.

**APPROVED — maintainer `ravichavali`, 2026-09-07, in the Sprint 128 plan-review session.**
This is the reviewed human decision `scripts/claude.md:18` requires; the `decision` field of both
entries cites it. The registry is still unchanged in this planning revision — PR B Task 4 applies
it, and no other task may.

The approval is **conditional on the evidence above being unchanged at apply time**. If the
September 7 measurement no longer holds — a patched version published, an advisory withdrawn or
re-scored, Metro's declared range moved, or the resolved mobile chain changed by PR B's own SDK
edits — this authorization lapses and PR B must return with a fresh measured proposal rather than
applying it. Verified against the validator before approval: the span is exactly `MAX_EXEMPTION_DAYS`
(30) so it passes `scripts/audit-exemptions.js:118`, `created` is not future-dated (`:109`), and
`expires` is read as the first invalid day (`:123-126`), so the live window ends 2026-10-06.
Anchoring `created` to the measurement date means a later merge shortens the usable window; that is
intended, and it is not grounds for re-dating the entries.

### D1 — isolated PR C database validation operation

**APPROVED — maintainer's latest confirmation, 2026-09-07, following the E1/D1 approval request.**
This supersedes the earlier handoff's pending D1 decision. The resource-name correction below
is an implementation detail to preserve the approved isolation scope, not an expanded operation.

Perform one bounded operation at PR C Task 1: create `s128-preview-pg` from the existing
`postgres:15-alpine` image and `s128-preview-redis` from existing `redis:7-alpine` on
`ubuntu@karmyq.com`; bind only host loopback ports 55438 and 63808, respectively. Use private
ephemeral credentials, database/user `karmyq_s128_preview`, independent temporary storage, and
a new task-labeled bridge `s128-preview-net` with only these two containers attached.
No demo volume or demo-network attachment. Limits: PG 768 MiB/1 CPU; Redis 128 MiB/0.25 CPU.
Load only the repo schema and synthetic fixtures; tunnel those two ports to Windows, run baseline
and PR C parity tests, then remove only these newly created resources and close the tunnels.

The original names collided with `scripts/deploy.sh:227` (container filter `karmyq-`) and `:228`
(network filter `karmyq`). The corrected names contain neither string; keep all Compose project
labels and existing app-network attachments off these resources. Before and after each baseline/
parity run, including failed runs, compare recorded container IDs, running state, start times,
restart counts and task labels, then check authenticated DB/Redis health. Lost continuity is an
environment failure; never accept it as parity evidence or mask a nonzero test exit status.

Read-only host check September 7: both images existed; the original proposed container names and
ports were unused; available memory was 21,722 MiB. Corrected name availability is UNVERIFIED.
This is a dated feasibility check, not a reservation. Check corrected names/ports, capacity and
deployment state before starting. Existing application containers, `karmyq-postgres`,
`karmyq-redis`, their networks/volumes, ports 5432/6379 and demo data are outside this operation.
Authorization covers provisioning, schema/fixture writes, baseline/parity tests and teardown of
these test resources only. No resource has been provisioned. Reuse this approval within its scope;
changed operation scope requires a separate decision. On failure/abandonment, perform the same
scoped cleanup and record any remaining resource IDs; no broad prune or demo-container restart.

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
2. B → A → C are sequential PRs, each based on refreshed `origin/master`; no worktrees or direct master pushes.
3. `CURRENT_HANDOFF.md` holds this stream's state. A future router is a pointer, never a lock or proof of ownership.
4. PR B resolves E1 through SDK-aligned removal of image-size and its two unmatched exemptions; verify the live audit passes with the empty registry. No renewal was applied.
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
