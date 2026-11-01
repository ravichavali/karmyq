# Sprint 135 — Request Status Guards (BUG-075 + BUG-078) — Handoff

**Date**: 2026-11-01
**Outcome**: in progress (planning)

> The handoff carries **state between sessions**. It is not a copy of the plan: it links the plan and names the next
> unchecked task. It is branch-local, so it can reserve nothing; see `CLAUDE.md` → *Parallel Development* for how
> contended resources are actually allocated. Git and PR state (`gh pr list`, `git log origin/master`) outrank anything
> written here. No parallel lanes are active.

**Previous**: Sprint 134 COMPLETE, closed by the maintainer on 2026-11-01 (archived:
[`archive/2026-11-01-sprint-134-dated-obligations-COMPLETE-v11.106.0.md`](archive/2026-11-01-sprint-134-dated-obligations-COMPLETE-v11.106.0.md)).
Last shipped: #325 `965cdf2d` (v11.106.0), CI/CD 40997981236 green 14/14; PR L2's nightly validation passed from the DB
on 2026-11-01.

**Sprint goal:** every request-status write in request-service is guarded, and the request's status is derived from its
matches and dibs, so a completed or cancelled ask can no longer be reopened, re-matched or overwritten.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-135-pr-request-status-guards` |
| **Base** | `origin/master` at `965cdf2d` (#325, v11.106.0; fetched 2026-11-01). First commits: the #325 post-merge record (`a5138acd`), BUG-082 (`f707340e`), then this sprint's planning. |
| **Active editor** | **Claude** (planning chat, 2026-11-01). |
| **Reviewer role** | Codex (non-author), relayed by the maintainer. |
| **Owned paths** | `services/request-service/**`, the root `tests/integration/` file this sprint adds, `docs/guides/`, `docs/BUGS.md`, this handoff, the spec and plan. |
| **Shared resources needed** | Version bump (re-derive from `origin/master` at merge). Merge slot. One read-only demo recount after deploy (its own authorization). Dependency lane: **Claude** (maintainer-designated); this PR changes no manifest or lockfile entry beyond the root version. No ADR number (one service). |
| **Merged branches safe to delete** (maintainer's call) | `agent/claude/sprint-134-pr-bug-077-badge-insert`: head `afbaed7a`, same tree as `965cdf2d` (`cc350727`). Older Sprint 134 branches: see the archived handoff's Ownership row. |

## Decisions (maintainer, 2026-11-01)

- **Scope: all ten request-status writers** in request-service: match accept, reject, complete (finalize and the repeat
  done mark), admin propose-match, dibs create, dibs accept, dibs decline and the test-only expire, provider-offer accept,
  `PUT /requests/:id` (status from the body) and `DELETE /requests/:id` (requester cancel). A gate test fails on any
  request-status write outside the reviewed list. cleanup-service's expiry jobs are already guarded and stay as they are.
- **Approach: guarded writes plus one shared reconcile.** Each writer changes its own row with a conditional `UPDATE`
  (BUG-074 style; 409 when the guard misses). One shared helper then derives the request status under the request row
  lock: `cancelled` stays `cancelled`; otherwise `matched` > `completed` > `dibs_pending` > `open`. Cancel's existing
  `CASE` becomes that helper. No ADR (one service); the rules go in CONTEXT.md and the guide.
- **Requester cancel while an exchange is in progress: refuse** with 409 `REQUEST_HAS_ACTIVE_EXCHANGE` (cancel the
  exchange first). A completed ask also answers 409. Proposals on an open ask are rejected, and their offers freed, when
  it is cancelled.
- **Demo rows: no repair.** After deploy, one read-only recount shows no new inconsistent rows appear under the
  simulation's traffic. Any repair is a separate authorized operation, or the curated reset (demo stories runway
  ~2026-12-18) clears them.

## Links

- **Spec**: (being written)
- **Plan**: (being written)
- **PR**: none yet

## Quick Start

1. Read this handoff, then confirm live state: `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. Planning is in progress in this chat; the next chat executes the plan once it is linked above.

## Open, not scheduled (carried from Sprint 134)

- **BUG-073** tabled (maintainer, 2026-10-26): community admin and platform admin become separate roles, as a future
  feature (`docs/IDEAS.md` 2026-10-26).
- **BUG-076** (pre-push TDD false pass), **BUG-080** (provider completion rate counts a status never written),
  **BUG-081** (trust-config readers return NUMERIC strings typed as `number`; latent), **BUG-082** (the per-query SQL
  log in five services floods the log; the reputation log loses the 02:00Z nightly by 03:30Z).
- **PR C** (scheduled exemption re-check evidence): the exemption registry on master is empty, so it may have no work
  left.
- **PR D's D8** is blocked on the host persona: `DEMO_UNRELATED_EMAIL` in the host's `.env.demo.rotation` names a
  pre-reset account; the guide wants Marcus Lee (`docs/guides/demo-data.md:253`). Fixing it is a host write, and each
  rerun is its own authorization.
- **Expo drift #316** awaits a maintainer decision (dependency lane: Claude).
- **Per-community health-quality weight**: needs an ADR number from the maintainer and a quality-signal decision.
- `deepmerge` alert #178 (dismissed `tolerable_risk`): re-check at the next Expo SDK move or by 2026-12-01.

## Standing rules

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` / `git log` after every
merge and at session end.
