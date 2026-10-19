# Between sprints — Sprint 133 closed, Sprint 134 planning next — Handoff

**Date**: 2026-10-19
**Outcome**: Sprint 133 COMPLETE (archived: [`archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md`](archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md)).
The exemption renewal + closeout PR [#309](https://github.com/ravichavali/karmyq/pull/309) (v11.92.0) carries this file,
so it was open when written; `gh pr view 309` is the live state. Once merged, record its SHA and deploy run on the next
branch and rewrite this line.

> Git and PR state (`gh pr list`, `git log origin/master`) outrank anything written here. No parallel lanes are active.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-133-exemption-renewal-3` (renewal `f36efd08` + Sprint 133 closeout docs) |
| **Base** | `agent/claude/sprint-133-pr-d-closeout` `8228ef43`, itself cut from `origin/master` `312f9d13` (v11.91.0) |
| **Active editor** | Claude |
| **Shared resources** | dependency lane: **Claude** (maintainer-designated); version 11.92.0 re-derived from `origin/master` at merge time |

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`. If #309 is merged, start Sprint 134
   planning on a fresh branch from `origin/master` with the `sprint-planning` skill.
2. If #309 is open: SDLC gates are recorded in its description; CI green → ask "admin merge, yes/no?" →
   `gh pr merge 309 --squash --admin` → watch CI/CD to DEPLOYMENT SUCCESSFUL + health. **Expect a master CodeQL
   re-raise** of the `js/request-forgery` FP class (#624 hit an unchanged line); then `gh run rerun <id> --failed`.
3. Record the merge SHA and deploy run on the Sprint 134 planning branch (no docs-only master push).

## Dated obligations

| Item | Due | Note |
|---|---|---|
| node-forge + braces ADR-059 exemptions | **2026-10-26** (gate fails **2026-10-25 17:00 PDT**) | Re-check: `node scripts/audit-exemptions.js` (a withdrawn or fixed advisory shows as a stale exemption), `npm view node-forge version` / `npm view braces version`, `gh api advisories/<GHSA> --jq '.vulnerabilities[].first_patched_version'`, and the Expo dependents' ranges (`npm view @expo/cli dependencies.node-forge`, `npm view micromatch dependencies.braces`). Remove if fixed; renewal needs explicit authorization. BUG-059 |
| **BUG-063** community export reads a nonexistent schema | **2026-10-24** | LOW, unassigned; fix or dated risk acceptance |
| **PR L**: ADR-101 legacy-handler removal + BUG-068 retirement | **2026-10-29** | Needs the read-only demo queue drain check first (`bull:karmyq-events:wait`/`:delayed` empty; per-consumer workers): **ask before touching the host**. BUG-068 touches simulation `api-client.ts:461`: expect a CodeQL line-shift re-raise |
| **BUG-069** admin writes trust the JWT claim (5 services) | **2026-10-30** | MEDIUM (proposed), unassigned |
| Demo stories | ~2026-12-18 | D11 reset reported a 60-day runway; `demo-health.yml` watches it |

## Sprint 134 candidates (for the planning chat)

1. **PR L** (above), dated.
2. **BUG-069**, dated; cross-service, so an ADR if it lands as a shared helper.
3. **BUG-063**, dated (small).
4. **PR V follow-ups**: `docs/IDEAS.md` "[2026-10-19] Request-service read-boundary follow-ups".
5. **Sprint 133 PR B follow-ups**: `docs/IDEAS.md` "[2026-10-13] Skill endorsements follow-ups".
6. **BUG-061 follow-ups and directed-notify `expires_at`**: `docs/IDEAS.md` 2026-10-08 entries.
7. **`verify:demo` env loading** (simplify review, 2026-10-19): `verifyDemoData.ts:67-70` reads story IDs only from
   `process.env`, so an operator must export them from `.env.demo` by hand (the D11 deviation). Load
   `DEMO_ENV_FILE ?? '.env.demo'` the way `rotateMariaStories.ts:120` names it.
8. **Exemption renewal treadmill** (review follow-ups; maintainer decision, no policy change implied): (a) a scheduled
   checker that walks `security/audit-exemptions.json` and produces the re-check evidence; (b) reach-scoped audit
   (`scripts/audit-exemptions.js:318-320` audits the whole lockfile, so a mobile-only finding blocks every service
   deploy); (b) changes ADR-059 policy and needs an amendment.
9. Optional, separately authorized: live endorse → withdraw round trip on the demo.

## Maintainer decisions owed

- **Expo SDK drift** (red daily since 2026-09-29, issue #279): patch-level drift inside SDK 57 (`expo` 57.0.25 → ~57.0.30
  and 8 `expo-*` packages). No advisory or feature need, so no bump has been started. Choose:
  (a) authorize a surgical 9-package patch bump; or (b) accept it deliberately. ADR-094's registry
  (`security/expo-divergences.json`) is the reviewed acceptance mechanism, but an entry pins Expo's exact `expoPins`
  (`scripts/expo-divergences.js:233`), so every new Expo patch re-reds the run; making patch-level drift advisory would
  be a workflow change. Also open: the workflow's silent-failure gap (`docs/IDEAS.md` 2026-09-13).
- **`verify:demo` story IDs**: fix the script (candidate 7), or, if declined, add §5 to the existing gotcha
  `docs/gotchas/demo-host-scripts-cwd-and-sourced-env.md` (it already covers sourced-env traps) rather than a new entry.

## Standing rules

Every demo-host operation, merge, exemption renewal and CodeQL dismissal needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR.
