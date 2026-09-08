# Sprint 128: Reliable delivery, one stream — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` sequentially in a fresh chat per PR.
> Do not launch parallel implementation agents. Checkboxes live in the per-PR plans below.

**Goal:** Refine the development framework and deliver urgent maintenance plus truthful operator previews on one machine.
**Architecture:** Three independently reviewable PRs land in order. Existing scripts, policy and service boundaries remain in place.
**Tech stack:** Node.js 24, TypeScript/Jest, npm workspaces, PostgreSQL 15; Markdown for framework changes.
**Spec:** `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`.
**Status:** Implementation plan approved and ready for PR B; implementation has not started. E1 and D1 authorized by the maintainer on 2026-09-07. No release bump or ADR number allocated.

## Execution order

| Order | Plan | Branch | Exit condition |
|---|---|---|---|
| B (first) | [Security maintenance](2026-09-07-sprint-128-b-security-maintenance.md) | `agent/codex/sprint-128-planning` | BUG-038 fixed, dated decision resolved, SDK maintenance validated |
| A (second) | [Framework](2026-09-07-sprint-128-a-framework.md) | `agent/codex/sprint-128-framework` | Instructions reconciled, negative-fixture drift assertion green, walkthroughs reviewed, PR merged/deployed with authorization |
| C | [Standing preview](2026-09-07-sprint-128-c-standing-preview.md) | `agent/codex/sprint-128-standing-preview` | Preview/live-writer equivalence proven and report semantics documented |

The current planning artifacts ship with PR B, not as a separate master push. Create A/C from
`origin/master` only after prior deployment verification. Read both the spec and the selected
PR plan. Single stream is explicitly authorized by the maintainer; record that stream as the
dependency holder during PR B. E1 and D1 are recorded in the spec; use those approvals within
their conditions. Merge authority and any broader operation remain separate.

## Start the next implementation chat

Read `claude.md`, the current handoff, the spec and the PR B plan, then use
`superpowers:executing-plans` from **PR B Task 1** on the existing branch. Do not recreate the
branch or execute A/C concurrently. Suggested opening instruction:

> Execute Sprint 128 PR B using its implementation plan. Work sequentially on
> `agent/codex/sprint-128-planning`. E1 is approved under the spec's unchanged-evidence condition;
> D1 is approved for PR C's isolated synthetic test operation. Record measured results and the
> next unchecked task in the handoff. Prepare a reviewed PR for maintainer merge authorization.

| PR | Implementation checkpoints | Required evidence before requesting merge |
|---|---|---|
| B | Baseline → failing audit-contract tests → validator fix → conditional E1/SDK alignment → docs | Unavailable evidence fails for both registries; valid audit reports retain policy; strict `npm ci`, mobile type-check, audit/SDK gates and full tests pass |
| A | Branch after B deploy → failing workflow drift assertion → corrected skills/templates → walkthroughs/docs | Historical direct-master recipe fails; repaired real files pass; fresh-start and reviewer handoffs work; full tests pass |
| C | Branch after A deploy → D1 provision/target checks/baseline → failing preview tests → indexed metrics → real-writer parity/docs | Environment identity survives each run; preview writes nothing; exact score buckets and profile/community counts match stored results; integration and full tests pass |

Each per-PR plan includes exact files, checkboxes, test commands, documentation changes and all
four SDLC gates. Record red/green evidence with the task; run pre-commit-check before commits.
After each authorized merge, verify its deployment and health before the next PR starts.

## Critical implementation notes

1. One active stream on Windows; the second laptop is not set up. One editor at a time and a clean tree at role handoff.
2. B → A → C are sequential PRs, each based on refreshed `origin/master`; no worktrees or direct master pushes.
3. `CURRENT_HANDOFF.md` holds this stream's state. A future router is a pointer, never a lock or proof of ownership.
4. Current security exemptions become invalid September 15, 2026. E1 renewal is approved through October 6 only under the spec's unchanged-evidence condition; remeasure before applying in PR B Task 4.
5. Invalid audit evidence must fail before exemption matching for both empty and populated registries.
6. Preserve the trust formula and provider floors. Preview equivalence must exercise the real score writer, not a mocked return value.
7. New reputation tests begin in its `tests/tdd/` and promote when green; root cross-repo gates belong in `tests/regression/` because root TDD does not auto-promote.
8. Declare every imported dependency, edit manifests/lockfile surgically, and prove dependency changes with strict `npm ci`.
9. Every PR runs tests, simplify, independent code review and security review; maintainer authorization precedes merge, and deploy plus health verification precede the next merge.
10. Write source docs, remove generated timestamp/HEAD churn, and reconcile the handoff against live git/PR state before stopping.

## File map and shared surfaces

Per-PR plans give exact paths. `CURRENT_HANDOFF.md`, root version fields, source docs and the ADR
index are sequential shared surfaces, not concurrently owned files. No PR edits another agent's
uncommitted work. No new service, route, migration or shared-package export is planned.

## Sprint validation and closeout

- [ ] All per-PR task checkboxes and independent reviews have evidence; missing integration is a blocker, not a pass.
- [ ] Before September 15, verify the audit succeeds against real evidence and any approved exemptions are valid.
- [ ] Resume PR A and C from their handoffs in fresh chats after security PR B; record any clarification needed.
- [x] Spec decision **E1** (exact exemption renewal) approved 2026-09-07, conditional on unchanged evidence; PR B Task 4 applies it.
- [x] Spec decision **D1** approved by the maintainer's latest confirmation on 2026-09-07. Implementation uses `s128-preview-pg`, `s128-preview-redis` and `s128-preview-net` to avoid the deploy cleanup selectors; compare container identity/restart state before and after each run.
- [ ] Execute D1 provisioning, target verification and the existing integration baseline in PR C Task 1 before starting preview implementation. Authorization is recorded; provisioning and parity are not yet performed.
- [ ] Verify report counts against real SQL on a disposable database and inspect the rendered trust guide.
- [ ] Read CI/deployment results for the merged commits and perform applicable health checks.
- [ ] Record review rounds, late findings, stale-state corrections and waiting in the handoff; recommend at most three process changes.
- [ ] Preserve second-machine activation checklist for a later sprint; do not report a concurrency trial as completed.
- [ ] Claude validates sprint completion; maintainer authorizes merges/deployments separately.
