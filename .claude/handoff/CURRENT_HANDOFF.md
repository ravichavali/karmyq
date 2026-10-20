# Between sprints — Sprint 133 closed, Sprint 134 planning next — Handoff

**Date**: 2026-10-19
**Outcome**: Sprint 133 COMPLETE (archived: [`archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md`](archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md)).
**#309 SHIPPED and LIVE (2026-10-19):** the maintainer authorized the admin merge ("admin merge approved") after an external
review (no blocking findings; its P3 fixed in `9497d63c`). Merged as `1746cdf2` (v11.92.0).
[CI/CD 39366367275](https://github.com/ravichavali/karmyq/actions/runs/39366367275) passed on attempt 1: Code Scanning Gate
green (**no CodeQL re-raise** this time), Security Audit green, all 9 services healthy, no rollback. The exemptions now
expire 2026-10-26 on master.

> Git and PR state (`gh pr list`, `git log origin/master`) outrank anything written here. No parallel lanes are active.

---

## Ownership and base

| Field | Value |
|---|---|
| **Branch** | `agent/claude/sprint-134-planning` (cut from `origin/master` `1746cdf2`, v11.92.0); carries this handoff, no PR yet |
| **Active editor** | Claude |
| **Shared resources** | dependency lane: **Claude** (maintainer-designated); each PR re-derives its version from `origin/master` at merge time |

## Quick Start

1. `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. Plan Sprint 134 on `agent/claude/sprint-134-planning` with the `sprint-planning` skill, starting from the candidates and
   dated obligations below. PR L and BUG-063 are dated and come first unless the maintainer reorders.
3. **Expect a master CodeQL re-raise** of the `js/request-forgery` FP class on any merge that shifts `api.ts` /
   `api-client.ts` lines (PR L touches `api-client.ts:461`); ask before dismissing, then `gh run rerun <id> --failed`.

## Dated obligations

| Item | Due | Note |
|---|---|---|
| node-forge + braces ADR-059 exemptions | **2026-10-26** (gate fails **2026-10-25 17:00 PDT**) | Re-check: `node scripts/audit-exemptions.js` (it audits the lockfile, so an exemption shows as stale only when its advisory no longer matches the locked version, e.g. withdrawn or after an upgrade; a published upstream fix alone does not trip it, hence the upstream checks that follow), `npm view node-forge version` / `npm view braces version`, `gh api advisories/<GHSA> --jq '.vulnerabilities[].first_patched_version'`, and the Expo dependents' ranges (`npm view @expo/cli dependencies.node-forge`, `npm view micromatch dependencies.braces`). Remove if fixed; renewal needs explicit authorization. BUG-059 |
| **BUG-063** community export reads a nonexistent schema | **2026-10-24** | LOW. **Maintainer 2026-10-19: fix it in Sprint 134.** If the fix can't merge by 2026-10-24, propose a dated risk acceptance |
| **PR L**: ADR-101 legacy-handler removal + BUG-068 retirement | **2026-10-29** | Precondition: the read-only demo queue drain check (see *Queue drain check* below). **Maintainer authorized it 2026-10-19**, but the auto-mode classifier refused the SSH read ("Production Reads"), so it has **not run**. BUG-068 touches simulation `api-client.ts:461`: expect a CodeQL line-shift re-raise |
| **BUG-069** admin writes trust the JWT claim (5 services) | **2026-10-30** | MEDIUM (proposed), unassigned |
| Demo stories | ~2026-12-18 | D11 reset reported a 60-day runway; `demo-health.yml` watches it |

## Sprint 134 scope

**Committed by the maintainer (2026-10-19):**
1. **BUG-063** (dated 2026-10-24): fix it.
2. **PR L** (dated 2026-10-29): ADR-101 legacy-handler removal + BUG-068 retirement, after the drain check.
3. **Expo SDK drift: patch it.** A surgical, in-place lockfile bump of the 9 SDK 57 patches named in issue #279
   (`expo` 57.0.25 → ~57.0.30, `@expo/metro-runtime`, `expo-camera`, `expo-constants`, `expo-linking`, `expo-location`,
   `expo-notifications`, `expo-router`, `expo-splash-screen`). This is dependency work earned by a maintainer decision;
   Claude holds the lane. Re-derive the targets from a fresh `npx expo install --check` at plan time (Expo keeps
   publishing). Prove it with strict `npm ci`, `npm ls --all`, mobile tests, `tsc --noEmit` and a green dispatched
   `Expo SDK drift` run; then close #279. Consider fixing the workflow's silent-failure gap (`docs/IDEAS.md` 2026-09-13)
   in the same PR.
4. **`verify:demo` reads `.env.demo` itself.** `verifyDemoData.ts:67-70` reads story IDs only from `process.env`, so an
   operator must export them by hand (the D11 deviation). Load `DEMO_ENV_FILE ?? '.env.demo'` (the path
   `rotateMariaStories.ts:120` already uses) without overriding values already set in the environment. No gotcha entry.

**Candidates (the maintainer picks):**
5. **BUG-069** (dated 2026-10-30); cross-service, so an ADR if it lands as a shared helper.
6. **PR V follow-ups**: `docs/IDEAS.md` "[2026-10-19] Request-service read-boundary follow-ups".
7. **Sprint 133 PR B follow-ups**: `docs/IDEAS.md` "[2026-10-13] Skill endorsements follow-ups".
8. **BUG-061 follow-ups and directed-notify `expires_at`**: `docs/IDEAS.md` 2026-10-08 entries.
9. **Exemption renewal treadmill** (review follow-ups; no policy change implied): (a) a scheduled checker that walks
   `security/audit-exemptions.json` and produces the re-check evidence; (b) reach-scoped audit
   (`scripts/audit-exemptions.js:318-320` audits the whole lockfile, so a mobile-only finding blocks every service
   deploy); (b) changes ADR-059 policy and needs an amendment.
10. Optional, separately authorized: live endorse → withdraw round trip on the demo.

## Queue drain check (PR L precondition, read-only)

The maintainer authorized it on 2026-10-19 for the Sprint 134 planning / PR L lane. It has **not run**: the auto-mode
classifier refused Claude's SSH read. The maintainer runs it themselves, or grants the permission, before PR L is
planned in detail. **Pass criteria:** the legacy `bull:karmyq-events` queue's `wait`, `active`, `delayed` and `paused`
are all 0, and each `karmyq-events-<consumer>` queue is served only by its own consumer's container.

## Standing rules

Every demo-host operation, merge, exemption renewal and CodeQL dismissal needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR.
