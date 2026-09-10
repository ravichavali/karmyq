# Sprint 128 PR C — Standing preview parity — Handoff

**Date**: 2026-09-10
**Outcome**: not started — PR A and PR B are shipped; PR C is next

> Single stream. `CURRENT_HANDOFF.md` **is** the state, not a router — there is no second machine.
> This file is branch-local and reserves nothing; contended resources are allocated by the
> maintainer (`CLAUDE.md` → *Parallel Development*).

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-128-c-standing-preview` (created, carries only this handoff) |
| **Base** | `origin/master` at `bcb7617e` (fetched 2026-09-10), version **v11.49.0** |
| **Active editor** | unassigned — next session takes it |
| **Reviewer role** | non-author; the maintainer has been reviewing each round |
| **Owned paths** | reputation service + its `tests/tdd/`; root `tests/regression/` for cross-repo gates |
| **Shared resources needed** | **D1 demo/DB operation is pre-approved** (see below). No ADR allocated — ask the maintainer if one is needed. Version bump is re-derived from `origin/master` **at merge time** |

## Links

- **Spec**: `docs/superpowers/specs/2026-09-07-sprint-128-single-stream-design.md`
- **Plan**: `docs/superpowers/plans/2026-09-07-sprint-128-c-standing-preview.md`
- **PR**: not yet opened

## Quick Start

1. Read this handoff, then confirm live state before trusting it:
   `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. **Reuse this branch** — it exists and is based on refreshed `origin/master`.
3. Open the plan above.
4. **Task 1 is a hard entry gate**: provision isolated PG/Redis and take the baseline before any
   preview implementation. Do not start Task 2 until it passes.

**Next unchecked task**: Task 1 — isolated `s128-preview-pg` / `s128-preview-redis` /
`s128-preview-net` provisioning plus baseline capture.

## What shipped before this

**Sprint 128 PR B — [#221](https://github.com/ravichavali/karmyq/pull/221)**, squash `095fc856`,
**v11.48.0**. Fail-closed audits and dependency security remediation. Deployed and verified.

**Sprint 128 PR A — [#232](https://github.com/ravichavali/karmyq/pull/232)**, squash `bcb7617e`,
**v11.49.0**, merged 2026-09-10T17:52:26Z. Deployed: CI/CD
[run 34510864842](https://github.com/ravichavali/karmyq/actions/runs/34510864842), all 14 jobs
success **including `Deploy to Demo`**. Smoke-tested live on 2026-09-10 — landing `200`;
`POST /api/auth/login` and `GET /api/requests/feed` both return `401` in the ADR-074 error shape
(not `502`), so every service is up.

⚠️ **PR A was merged with `gh pr merge --squash --admin`** under explicit maintainer authorization,
bypassing the required approving review. All 20 checks were green on the merged head `cefb183a`
first, verified by `headSha`; master was unchanged and no deploy was in flight. Recorded here
because the override is exactly the `enforce_admins: false` gap PR A documents but cannot close.

What PR A changed: the four playbooks that told agents to push `master` directly
(`deploy`/`ship` skills, `docs/GITHUB_ACTIONS_SETUP.md` twice) are corrected, and
`tests/regression/doc-context-drift-gate.test.ts` grew 13 → 41 tests enforcing it. `TEMPLATE.md` is
a handoff again rather than a duplicated plan; `update-handoff` is canonical with a lane-routing
procedure; `process-reviewer` no longer pipes `npm test` through `tail`, which had been reporting
failing suites as passes.

## Blockers and decisions

- **D1 is APPROVED** (maintainer, 2026-09-07) for PR C's isolated synthetic test operation. Use
  `s128-preview-pg`, `s128-preview-redis`, `s128-preview-net` — the earlier names collided with
  `scripts/deploy.sh:227` (container filter `karmyq-`) and `:228` (network filter `karmyq`).
  No Compose project labels, no demo volumes, no existing app-network attachments. Before and
  after **every** run, even a failed one, compare container IDs / start times / restart counts and
  require healthy DB+Redis; a lost or restarted dependency is an environment failure, not parity
  evidence. Preserve Jest's own exit status. Clean up only recorded task resources; record any
  cleanup failure. Scope expansion needs its own decision.
- **Preview parity must exercise the real score writer** on a disposable DB — not a mocked return.
  Preserve the trust formula and provider floors. The full provider discrepancy remains
  **UNVERIFIED** until reproduced.
- **New tests start in the reputation service's `tests/tdd/`** and promote when green. Root
  `tests/tdd/` never auto-promotes, so repo-wide invariants go straight in `tests/regression/`.

## Open, not caused by this sprint

- **BUG-039** — `POST /api/auth/demo-session` returns 503 `DEMO_UNAVAILABLE` on deployed
  karmyq.com, so the guided Maria demo cannot start. Reproduced live 2026-09-09. Needs server logs;
  ADR-084 collapses every failure into one opaque 503 by design.
- **4 vulnerabilities on the default branch** (1 high, 3 moderate), reported by GitHub during the
  PR A pushes. The high is inside the repo's own ≤ 1 week SLA.
- **`enforce_admins: false`** on `master` — maintainer-confirmed with authenticated access. Six
  required checks and one required approval are all admin-bypassable. One API call to close.
- **One unidentified pre-push transient.** A push attempt failed the hook in the regression tier,
  but the captured log was truncated to npm wrapper noise, so the failing test could not be named.
  Three direct reruns passed. If it recurs, capture the hook's full output before concluding.

## Verification references

- `npm test -- --concurrency=2` on `bcb7617e`'s content → exit 0, 26/26 Turbo tasks, root unit
  **101/101**, root regression **739/739** across 29 suites.
- Drift gate direct → **41/41**. `npm ci --dry-run` after the version bump → exit 0, no churn.
- Deploy verified via the run link above **and** a live smoke test, not by the merge alone.

⚠️ GitHub status above is a dated observation. Re-derive with `gh pr view` and
`git log origin/master` before trusting it.

## Lesson carried forward

`CURRENT_HANDOFF.md` is itself scanned by the drift gate now, so **every handoff edit invalidates a
prior test result** — finish the handoff *before* the verification run, not after. Shipping a
commit whose stated test result predated its own final edit is how PR A briefly carried a false
green.

Related: reach for the live arbiter, and do not truncate it. `gh run list --limit 8` was entirely
consumed by Dependabot runs and hid the deploy pipeline completely, which briefly looked like a
failed deploy.
