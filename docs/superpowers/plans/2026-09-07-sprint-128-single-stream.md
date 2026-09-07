# Sprint 128: Reliable delivery, one stream — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` sequentially in a fresh chat per PR.
> Do not launch parallel implementation agents. Checkboxes live in the per-PR plans below.

**Goal:** Refine the development framework and deliver urgent maintenance plus truthful operator previews on one machine.
**Architecture:** Three independently reviewable PRs land in order. Existing scripts, policy and service boundaries remain in place.
**Tech stack:** Node.js 24, TypeScript/Jest, npm workspaces, PostgreSQL 15; Markdown for framework changes.
**Spec:** `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`.
**Status:** Planned; implementation has not started. No release bump or ADR number allocated.

## Execution order

| Order | Plan | Branch | Exit condition |
|---|---|---|---|
| A | [Framework](2026-09-07-sprint-128-a-framework.md) | `agent/codex/sprint-128-planning` | Instructions reconciled, walkthroughs reviewed, PR merged/deployed with authorization |
| B | [Security maintenance](2026-09-07-sprint-128-b-security-maintenance.md) | `agent/codex/sprint-128-security-maintenance` | BUG-038 fixed, dated decision resolved, SDK maintenance validated |
| C | [Standing preview](2026-09-07-sprint-128-c-standing-preview.md) | `agent/codex/sprint-128-standing-preview` | Preview/live-writer equivalence proven and report semantics documented |

The current planning artifacts ship with PR A, not as a separate master push. Create B/C from
`origin/master` only after prior deployment verification. Read both the spec and the selected
PR plan. Single stream is explicitly authorized by the maintainer; record that stream as the
dependency holder during PR B. Specific exception decisions still require measured proposals.

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

## File map and shared surfaces

Per-PR plans give exact paths. `CURRENT_HANDOFF.md`, root version fields, source docs and the ADR
index are sequential shared surfaces, not concurrently owned files. No PR edits another agent's
uncommitted work. No new service, route, migration or shared-package export is planned.

## Sprint validation and closeout

- [ ] All per-PR task checkboxes and independent reviews have evidence; missing integration is a blocker, not a pass.
- [ ] Before September 15, verify the audit succeeds against real evidence and any approved exemptions are valid.
- [ ] Resume PR B and C from their handoffs in fresh chats; record any clarification needed.
- [ ] Verify report counts against real SQL on a disposable database and inspect the rendered trust guide.
- [ ] Read CI/deployment results for the merged commits and perform applicable health checks.
- [ ] Record review rounds, late findings, stale-state corrections and waiting in the handoff; recommend at most three process changes.
- [ ] Preserve second-machine activation checklist for a later sprint; do not report a concurrency trial as completed.
- [ ] Claude validates sprint completion; maintainer authorizes merges/deployments separately.
