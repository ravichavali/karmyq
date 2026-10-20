# Sprint 134 — Dated Obligations and Boundary Hardening — Handoff

**Date**: 2026-10-20
**Status**: PLANNED. Spec + per-PR plans committed on `agent/claude/sprint-134-planning`, which is also **PR F, #310** (follow-redirects
advisory fix, v11.93.0), opened 2026-10-20 and **awaiting the maintainer's merge decision**. After F merges, **the next chat executes PR A**.
**Previous**: Sprint 133 COMPLETE (archived: [`archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md`](archive/2026-10-19-sprint-133-skills-depth-COMPLETE-v11.92.0.md));
#309 merged `1746cdf2` (v11.92.0), CI/CD 39366367275 green.

> Git and PR state (`gh pr list`, `git log origin/master`) outrank anything written here. No parallel lanes are active.

**Sprint goal:** clear the dated obligations (BUG-063 by 10-24, PR L by 10-29, BUG-069 by 10-30, the exemption re-check before
10-25 17:00 PDT), patch the Expo drift and the `verify:demo` env gap, then work down the Sprint 133 follow-up tail.

---

## Quick Start

1. Read this handoff, then `git fetch origin`, `gh pr list`, `git log --oneline origin/master -3`.
2. Find the next PR in *PR sequence* whose status is not SHIPPED. Reuse its branch if it exists; otherwise
   `git switch -c agent/claude/sprint-134-pr-<letter>-<slug> origin/master`. Never branch off a stale local master.
3. Open that PR's plan (table below). **PR L's plan is PROVISIONAL**: execute only its Task L0 until the maintainer reports the
   drain check. PRs L2/K/V/B/C have no plan yet: write it first in that PR's chat from the spec section (`sprint-planning`/
   `superpowers:writing-plans`), then execute.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no `/execute-plan`
   slash command; superpowers removed it as a deprecated stub.
5. One fresh chat per PR (CLAUDE.md *Chat cadence*). Update this file at every PR open/merge.

## Ownership and base

| Field | Value |
|---|---|
| **Planning branch** | `agent/claude/sprint-134-planning` (from `origin/master` `1746cdf2`, v11.92.0) = **PR F**. The planning docs reach master with F (no docs-only master push). Every later PR is cut from `origin/master` after the previous one merges |
| **Active editor** | Claude |
| **Shared resources** | dependency lane: **Claude** (maintainer-designated); each PR re-derives its version from `origin/master` at merge time |

## Spec and plans

- Spec: [`docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md`](../../docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md)

## PR sequence

| # | PR | Scope | Due | Plan | Status |
|---|---|---|---|---|---|
| 0 | **F** | follow-redirects 1.16.0 → 1.16.1 (GHSA-q3jh-wrc6-jgq8 + GHSA-8r9p-f939-6h3c, high, published 2026-10-20); one-node splice; v11.93.0 | high SLA 10-27; **blocks every push/deploy until merged** | spec *PR F* | **#310** open; CI green at `47561a61`; gates recorded (see *#310 review*); awaiting "admin merge, yes/no?" |
| 1 | **A** | BUG-063: repair every export query against the live schema | **2026-10-24** (target merge 10-22) | [`plans/2026-10-20-sprint-134-pr-a-bug-063-export.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-a-bug-063-export.md) | NEXT after F |
| 2 | **E** | Expo SDK 57 patch (#279) + drift-workflow silent-failure fix | — | [`plans/2026-10-20-sprint-134-pr-e-expo-patch.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-e-expo-patch.md) | planned |
| — | **X** | Exemption re-check; renewal PR **only on explicit yes** | gate fails **10-25 17:00 PDT** | *Dated obligations* below | due ~10-23 |
| 3 | **D** | `verify:demo` loads `DEMO_ENV_FILE ?? '.env.demo'` | — | [`plans/2026-10-20-sprint-134-pr-d-verify-demo-env.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-d-verify-demo-env.md) | planned |
| 4 | **L** | ADR-101 legacy handlers + BUG-068 code (no migration) | **2026-10-29** | [`plans/2026-10-20-sprint-134-pr-l-legacy-handlers.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-l-legacy-handlers.md) | **PROVISIONAL: blocked on drain check** |
| 5 | **L2** | Migration: drop `interaction_feedback` + 7 dead average columns; update readers (incl. the reputation health route); **BUG-070** | BUG-070 **2026-11-03** | write at PR start | — |
| 6 | **K** | BUG-069: admin writes re-derive live role (ADR; **number from the maintainer**) | **2026-10-30** | write at PR start | — |
| 7 | **V** | PR V read-boundary follow-ups (`docs/IDEAS.md` 2026-10-19) | — | write at PR start | — |
| 8 | **B** | PR B endorsement follow-ups (`docs/IDEAS.md` 2026-10-13) | — | write at PR start | — |
| 9 | **C** | Scheduled exemption re-check evidence (treadmill a) | — | write at PR start | — |

B and C are the likeliest to spill into Sprint 135, which is expected. One merge at a time; wait for deploy + health before the next.

## Maintainer decisions (2026-10-19 / 2026-10-20)

- Committed scope: BUG-063, PR L, the Expo patch, `verify:demo` env (2026-10-19). Candidates **all chosen**: BUG-069, PR V follow-ups,
  PR B follow-ups, exemption checker (a) (2026-10-20). Treadmill item (b) (reach-scoped audit) is **not** in scope.
- **BUG-063: repair every section** (not just the schema name). The bug is wider than filed: nine defect classes (spec table).
- **BUG-068 data: drop it, in a separate PR L2** after the code-only PR L. The drop covers the `requests.interaction_feedback` table,
  4 `trust_scores` columns and 3 `community_health_metrics` columns; readers include the feed composer and milestone detector.
- **Drain check: not run** as of 2026-10-20. PR L's plan stays provisional until the maintainer reports it.
- **follow-redirects advisories (2026-10-20): fix now, on the planning branch, as PR F.** They were found when the planning push's
  pre-push hook failed on a docs-only diff. Proof in the spec's *PR F* section.
- PR E includes the `expo-sdk-drift.yml` silent-failure fix (`docs/IDEAS.md` 2026-09-13), as the previous handoff suggested.
  The maintainer may veto.

## #310 review (2026-10-20)

CI green at `47561a61` (run 39497569765, incl. Integration Tests, Security Audit, Code Scanning Gate). An external read-only
review found no correctness issue in the dependency fix. Gates on #310: `/simplify` clean (no source code; lock splice is the
right depth, no override needed, no other lockfile holds follow-redirects); `/code-review` (medium) found the code clean and 8
findings in the planning docs, all verified and fixed (BUG-070 logged; PR D now resolves `.env.demo` against `INIT_CWD`; PR E
workflow conditions per step; PR L health.ts reads moved to L2; PR A RLS note corrected). The external review's PR A fixture
(second community + denial on all three routes) and v11.94.0 items are applied. `/security-review`: see the PR body.

## Dated obligations

| Item | Due | Note |
|---|---|---|
| **follow-redirects** GHSA-q3jh-wrc6-jgq8 + GHSA-8r9p-f939-6h3c (high) | **2026-10-27** (≤ 1 week) | PR F; until it merges, the ADR-059 gate fails every PR and master deploy |
| **BUG-063** | **2026-10-24** | PR A. If not merged by end of 10-23, PR A plan Task A0 has a ready dated risk acceptance (new date 10-31) for the maintainer to sign |
| node-forge + braces ADR-059 exemptions | **2026-10-26** (gate fails **2026-10-25 17:00 PDT**) | Re-check ~10-23, after PR E if it has merged: `node scripts/audit-exemptions.js` (it audits the lockfile, so a published upstream fix alone does not trip it), `npm view node-forge version` / `npm view braces version`, `gh api advisories/<GHSA> --jq '.vulnerabilities[].first_patched_version'`, `npm view @expo/cli dependencies.node-forge`, `npm view micromatch dependencies.braces`. `@expo/cli@57.0.31` still declares `node-forge ^1.3.3` (2026-10-20). Remove if fixed; **renewal needs explicit authorization**. BUG-059 |
| **PR L** (BUG-068) | **2026-10-29** | Blocked on the drain check below |
| **BUG-069** | **2026-10-30** | PR K. ADR number allocated by the maintainer. If the inventory shows it cannot merge in time, propose a dated risk acceptance and split by service |
| **BUG-070** (BUG-063 class in reputation health + dead `FeedComposer`) | **2026-11-03** | Logged 2026-10-20 (LOW, proposed); folded into PR L2 pending maintainer confirmation |
| Demo stories | ~2026-12-18 | `demo-health.yml` watches the runway |

## Queue drain check (PR L precondition, read-only)

Authorized by the maintainer 2026-10-19 for the PR L lane, but the auto-mode classifier refused Claude's SSH read; **not run**. The
maintainer runs it (paste-ready commands: PR L plan Task L0) or grants the read. **Pass:** legacy `bull:karmyq-events` `wait`,
`active`, `delayed` and `paused` all 0, and each `karmyq-events-<consumer>` queue is served only by its own consumer's container.

## Critical implementation notes (from the spec, verbatim)

1. **Read the schema, not the code.** Every table/column in a changed query is checked against `infrastructure/postgres/init.sql`
   before the query is written. BUG-063 and BUG-068 both shipped because a mock encoded the wrong name.
2. **The community schema is `communities` (plural) and the membership table is `members`.** A request's communities are in
   `requests.request_communities`; `help_requests` has no `community_id`.
3. **Qualify every column in a joined query.** `auth.users.created_at` makes an unqualified `created_at` ambiguous.
4. **Real-SQL integration tests need Postgres + live services.** This Windows box has none (CLAUDE.md *Host environments*).
   CI's integration job is the arbiter; a demo-host disposable container needs per-operation authorization.
5. **Lockfile work is a splice, never a regen.** Windows re-resolve strips `libc` fields and drops override/nested nodes.
   Prove with node-by-node diff + `npm view` parity (order and completeness), `npx -y npm@11.19.0 ci` (consistency and integrity),
   and `npm ls --all` (3 pre-existing invalids: color-string, ms, picomatch). A green local `npm ci` alone proves nothing.
6. **`dotenv` 17 must be called with `quiet: true`** (gotcha), and with `override: false` so the environment wins.
7. **No demo-host operation without explicit per-operation authorization** (the drain check, any dry-run, any smoke that
   reads Redis). The classifier may refuse even an authorized read; then hand the command to the maintainer.
8. **Ask before:** any ADR number, any merge ("admin merge, yes/no?"), any exemption renewal, any CodeQL dismissal.
9. **Expect the CodeQL `js/request-forgery` re-raise** on master after any merge that shifts `apps/frontend/src/lib/api.ts`
   or `services/simulation-service/src/api-client.ts` lines (PR L). Ask before dismissing, then `gh run rerun <id> --failed`.
10. **Re-derive the version at merge time** from `origin/master`'s `package.json`, never at branch time.
11. **`npm test` regenerates `apps/landing/src/data/docs/`** with timestamp/HEAD-sha churn; revert it before committing.
12. **New sprint tests start in the changed workspace's `tests/tdd/`**; real-SQL tests that drive live services go in root
    `tests/integration/` (the Sprint 133 pattern). The TDD promoter sweeps every green `tdd/` file repo-wide; restore unrelated ones.

## Known state at planning time (2026-10-20)

- Master `1746cdf2` v11.92.0, deployed green; no open PRs.
- Scheduled `Expo SDK drift` run 39424368063 on master is **red by design**: it detected the #279 drift (9 packages). PR E fixes it.
- `npm ls --all` baseline (measured 2026-10-20 at HEAD): 3 invalid (color-string, ms, picomatch) + 1 missing
  (`@react-native/metro-config`, required by react-native-worklets). Those are the "four" `apps/mobile/claude.md` records; memory
  counts only the invalids. Judge any splice by "no new errors".

## Standing rules

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` / `git log` after every
merge and at session end.
