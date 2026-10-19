# Between sprints — Sprint 133 closed, Sprint 134 planning next — Handoff

**Date**: 2026-10-19
**Outcome**: Sprint 133 COMPLETE (archived: [`archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md`](archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md)).
The exemption renewal + closeout PR (v11.92.0) is open; it needs explicit merge authorization.

> Git and PR state (`gh pr list`, `git log origin/master`) outrank anything written here. No parallel lanes are active.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-133-exemption-renewal-3` (renewal `f36efd08` + Sprint 133 closeout docs) |
| **Base** | `agent/claude/sprint-133-pr-d-closeout` `8228ef43`, itself cut from `origin/master` `312f9d13` (v11.91.0) |
| **Active editor** | Claude |
| **Shared resources** | dependency lane: **Claude** (maintainer-designated); version bump 11.92.0 re-derived from `origin/master` at merge time; merge slot needs "admin merge, yes/no?" |

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`. If the renewal PR is merged, start Sprint 134
   planning on a fresh branch from `origin/master` with the `sprint-planning` skill.
2. If it is still open: CI green → ask "admin merge, yes/no?" → `gh pr merge <n> --squash --admin` → watch CI/CD to
   DEPLOYMENT SUCCESSFUL + health. **Expect a master CodeQL re-raise** of the `js/request-forgery` FP class
   (`api-client.ts`/`api.ts`; #624 hit an unchanged line). Ask before dismissing anything; then `gh run rerun <id> --failed`.
3. Record the merge SHA and deploy run here, on the Sprint 134 planning branch (no docs-only master push).

## Dated obligations

| Item | Due | Note |
|---|---|---|
| node-forge + braces ADR-059 exemptions | **2026-10-26** (gate fails **2026-10-25 17:00 PDT**) | Re-check upstream the #307 way; remove if fixed, else renewal needs explicit authorization. BUG-059 |
| **BUG-063** community export reads a nonexistent schema | **2026-10-24** | LOW, unassigned; fix or dated risk acceptance |
| **PR L**: ADR-101 legacy-handler removal + BUG-068 retirement | **2026-10-29** | Needs the read-only demo queue drain check first (`bull:karmyq-events:wait`/`:delayed` empty; per-consumer workers): **ask before touching the host**. BUG-068 touches simulation `api-client.ts:461`, so expect a CodeQL line-shift re-raise |
| **BUG-069** admin writes trust the JWT claim (5 services) | **2026-10-30** | MEDIUM (proposed), unassigned |
| Demo stories | ~2026-12-18 | D11 reset reported a 60-day runway; `demo-health.yml` watches it |

## Sprint 134 candidates (for the planning chat)

1. **PR L** (above), dated.
2. **BUG-069**, dated; cross-service, so an ADR if it lands as a shared helper.
3. **BUG-063**, dated (small).
4. **PR V follow-ups** (#306): request owner-write 403/404 oracle; move the detail route onto `requestReadableSql`;
   one `isActiveMember` (two helpers, opposite argument order); list-query performance (CTE +
   `matches(request_id, responder_id)` index, needs a migration); retire or honor `help_offers.is_public`.
5. **IDEAS, Sprint 133 PR B follow-ups** (`docs/IDEAS.md` "[2026-10-13] Skill endorsements follow-ups"): idempotent
   `match_completed` edge reconcile; endorsement notification (dedicated queue); endorsement-weighted matching
   (`packages/shared`); fission copying `endorsement_count`; vouch from the request page; `karma_awarded` has no publisher.
6. **IDEAS 2026-10-08**: caller-identity-from-body route gate; one live-membership helper per service; `requireCallerId`;
   directed-notify `expires_at` check.
7. Optional, separately authorized: live endorse → withdraw round trip on the demo.

## Maintainer decisions owed

- **Expo SDK drift** (red daily since 2026-09-29, issue #279): patch-level drift inside SDK 57 (`expo` 57.0.25 → ~57.0.30
  and 8 `expo-*` packages). No advisory or feature need, so under the 2026-09-30 policy no bump has been started. Choose:
  (a) authorize a surgical 9-package patch bump, or (b) accept it deliberately, e.g. make patch-level drift advisory in
  `.github/workflows/expo-sdk-drift.yml`. Also open: the workflow's silent-failure gap (`docs/IDEAS.md` 2026-09-13).
- **Gotcha offer:** a `docs/gotchas/` entry for "`verify:demo` reads story IDs from the process env, not `.env.demo`"
  (export them first: `set -a; eval "$(grep -E '^DEMO_(ORDINARY_REQUEST|ORDINARY_MATCH|PROVIDER_REQUEST|PROVIDER_OFFER)_ID=' .env.demo)"; set +a`).
  Write it with the `learned` skill if accepted.

## Standing rules

Every demo-host operation, merge, exemption renewal and CodeQL dismissal needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR.
