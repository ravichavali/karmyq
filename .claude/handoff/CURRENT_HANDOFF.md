# Sprint 129 — not yet planned — Handoff

**Date**: 2026-09-11
**Outcome**: Sprint 128 is COMPLETE and deployed. Sprint 129 has no spec, plan or branch yet.

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | none yet — branch from freshly fetched `origin/master` |
| **Base** | `origin/master` at `55a536fc`, version **v11.50.0** |
| **Active editor** | unassigned |
| **Shared resources needed** | none held. No ADR allocated. No demo/DB operation authorized. |

## Quick Start

1. Confirm live state before trusting this file: `git fetch origin`, `gh pr list`,
   `git log --oneline origin/master -3`.
2. Sprint 128 is done — there is nothing to resume. Start with the `sprint-planning` skill.
3. Read *Known next work* below before choosing scope; one item is already past its SLA.

**Next unchecked task**: plan Sprint 129 — produce spec, plan and an updated handoff.

## Sprint 128 shipped — all three PRs

| PR | Outcome | Squash | Version |
|---|---|---|---|
| B | Fail-closed audits and dependency security remediation | `095fc856` | v11.48.0 |
| A | Workflow playbooks match the merge discipline, and a gate for it | `bcb7617e` | v11.49.0 |
| C | Standing preview agrees with the score writer | `55a536fc` | **v11.50.0** |

PR C detail is archived at
`.claude/handoff/archive/2026-09-11-sprint-128-standing-preview-SHIPPED-v11.50.0.md`, including the
reproduction, the review rounds and the D1 operation record.

## Known next work — read before scoping

### 1. Security backlog, and one item is PAST SLA

Four open Dependabot alerts, measured 2026-09-11:

| Sev | Package | Age | Fix | PR |
|---|---|---|---|---|
| **HIGH** | `@faker-js/faker` — `helpers.fake` → arbitrary code execution | **9 days, SLA ≤ 1 week BREACHED** | 10.5.0 | [#216](https://github.com/ravichavali/karmyq/pull/216) |
| medium | `qs` (two alerts) | 8 days | 6.16.0 | [#217](https://github.com/ravichavali/karmyq/pull/217) |
| medium | `decode-uri-component` | 10 days | 0.5.0 | **none exists** |

Three things that change how this should be scoped:

- The high sits in `scripts/package-lock.json` — tooling, not a shipped service image — so real
  exposure is low, but the repo's own SLA is breached and #216 is the fix.
- `@faker-js/faker` 8.4.1 → 10.5.0 is a **two-major** jump. Do not merge on sight.
- `decode-uri-component` is **transitive** via `query-string`, which is why Dependabot has no PR for
  it. It needs an override or a `query-string` bump, and it has been open longest.

⚠️ **CI's Security Audit check passes despite the open high.** Do not read green CI as covering
this; the ADR-059 gate is not what will catch it. Schedule it deliberately.

### 2. Deferred from PR C — the architectural follow-through

- **One definition instead of two.** `feedbackDb.ts` already splits `calculateWeightedAvgFeedback`
  (pure) from `getWeightedAvgFeedback` (fetch), and both the live writer and the dry run call the
  pure half. `getTrustMetrics` has the same shape and could be split the same way, collapsing
  `standingPreview.ts` to a thin adapter and leaving ONE definition of the trust metrics instead of
  a SQL copy and a TypeScript copy. It edits the live writer, so it needs its own PR and its own
  regression coverage first.
- **A single `projectApply(snapshot, replayed)`** owning "what the karma table looks like after
  apply", with `compareStoredProjection` deriving `predictedKarma` from it. Two in-memory models of
  post-apply state exist today; unifying them touches the convergence signal the demo backfill
  relies on.
- **The reason-set derivation runs one way.** `standingPreview.ts` builds its filter from
  `COMPLETED_MATCH_REASONS`, but the writer's SQL hardcodes the literals, so renaming the constant
  would move the projector and the preview and silently leave the SQL matching a dead string.
  Recorded in `docs/gotchas/trust-metric-sql-has-a-typescript-twin.md`; interpolating the constants
  into the SQL is the real fix.

### 3. Open, not caused by Sprint 128

- **BUG-039** — `POST /api/auth/demo-session` returns 503 `DEMO_UNAVAILABLE` on deployed
  karmyq.com, so the guided Maria demo cannot start. ADR-084 collapses every failure into one
  opaque 503 by design, so this needs server logs.
- **Scheduled "Expo SDK drift" workflow failing on master** — run `34597690602`, 2026-09-11. A cron
  monitor added by PR B, not a deploy or a gate. Cause not yet diagnosed.
- **`enforce_admins: false`** on `master`. Six required checks and one required approval are all
  admin-bypassable, yet the review requirement is also what stalls every sprint's end: the PR author
  and the authenticated account are the same, so the required approval can never be self-provided.
  **This has shaped the end of two consecutive sprints.** Deciding it — a real second reviewer, or
  an explicit override path — would remove a recurring stall. One API call either way.
- **`apps/landing/src/data/docs/` is only PARTIALLY git-tracked.** `apps/landing/.gitignore:2`
  ignores the directory, but ~160 files were committed before that and remain tracked; ADRs 095+ are
  not. `CLAUDE.md` calls it "git-tracked" without qualification, which is misleading. Its
  `build.json` and `architecture.json` regenerate with fresh timestamps on **every** run, so both
  are per-run churn and must be reverted before committing.

## Process notes worth carrying

- **An agent cannot merge a PR here.** GitHub forbids self-approval, and the local permission
  classifier refuses `gh pr merge` in both `--admin` and plain form. Plan sprints to end at
  "PR green and ready", not "merged", and do not leave shared test resources provisioned waiting
  for a deploy that cannot happen.
- **`gh run list` on master is drowned by Dependabot** and will hide the deploy pipeline entirely.
  Filter by `--workflow=ci.yml`, and verify the `Deploy to Demo` **job**, not just the run.
- **Git hooks are LIVE on this clone** — pre-commit and pre-push both run, and a push costs a full
  suite run. A silent, instant push still means no hook ran; treat that as the alarm.
- **Score buckets are a reporting format, not an oracle.** A wrong trust metric moves a score by
  about one point and stays inside the same bucket. Compare metrics, not buckets. This is recorded
  in `docs/gotchas/trust-metric-sql-has-a-typescript-twin.md` with the injection evidence.

⚠️ Every GitHub status above is a dated observation. Re-derive with `gh pr list`, `gh run list`
and `git log origin/master` before trusting any of it.
