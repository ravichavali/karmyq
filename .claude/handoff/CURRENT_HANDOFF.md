# Sprint 134 — Dated Obligations and Boundary Hardening — Handoff

**Date**: 2026-10-22
**Status**: IN PROGRESS. **PR F #310 SHIPPED** 2026-10-20: merged `63a6cd26` (v11.93.0) by the maintainer (the classifier refused
Claude's `--admin` merge), deployed by CI/CD 39516935342 (all 15 jobs green, all 9 services healthy, no rollback, no CodeQL re-raise).
**PR A #311 SHIPPED** 2026-10-21: admin-merged `bf524296` (v11.94.0) on the maintainer's authorization after Codex review;
CI/CD 39666220132 green (all 14 jobs, deploy + health, no rollback, no CodeQL re-raise).
**PR E #312 SHIPPED** 2026-10-22: admin-merged `eea83267` (v11.95.0) on the maintainer's authorization after Codex review.
CI/CD 39711848936 attempt 1 failed only because npm's bulk advisory endpoint hung (4 audit tests timed out at 120 s; deploy
skipped, no rollback); attempt 2 (re-run `--failed` at 03:20Z once the endpoint answered) green: 14/14 jobs, all 9 services
healthy, no rollback, 0 open CodeQL alerts. **Exemption re-check done 2026-10-22** (no upstream fix; renewal needed).
**PR D #313 SHIPPED** 2026-10-22: admin-merged `866857ed` (v11.96.0) on the maintainer's authorization. CI/CD 39797190307 green
(14/14 jobs, all 9 services healthy, no rollback). **No CodeQL re-raise:** #625/#626/#627 kept their numbers, their latest instance
is on `refs/heads/master` and still dismissed (the lines did not shift between PR head and merge); 0 open alerts on master.
**Expo drift closed:** scheduled run 39782668093 on master (`eea83267`, 12:57Z 2026-10-22) green, the first with the PR E fix; no open drift issue.
**New critical, 2026-10-22 15:52Z:** `next` GHSA-2464-fhr4-w9xw (unauthenticated RCE, image optimizer) + GHSA-p3m5-59mp-jv5r
(high DoS), `16.0.0–16.4.0`, published after #313's deploy. Critical is never exemptible, so **every PR's Security Audit fails
until it merges.** **Now:** PR N (next 16.3.8 → 16.4.2) **open, awaiting maintainer merge** on
`agent/claude/sprint-134-pr-n-next-critical`; **then** the renewal PR on ~10-24 (fresh from `origin/master`), **then** PR L.
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
3. Open that PR's plan (table below). **PR L's drain-check gate PASSED (2026-10-20)**; both of its open decisions are settled
   (maintainer 2026-10-20); its chat re-runs the Task L1 inventory first. PRs L2/K/V/B/C have no plan yet: write it first in that PR's chat from the spec section (`sprint-planning`/
   `superpowers:writing-plans`), then execute.
4. Invoke `superpowers:subagent-driven-development` directly (or `superpowers:executing-plans`). There is no `/execute-plan`
   slash command; superpowers removed it as a deprecated stub.
5. One fresh chat per PR (CLAUDE.md *Chat cadence*). Update this file at every PR open/merge.
6. **Stopping point = PR creation (maintainer, 2026-10-22, standing).** Run all gates, push this handoff on the PR branch marking
   the PR "open, awaiting maintainer merge", open the PR, report the link, and **stop**. Don't watch CI, ask for a merge, or do
   post-merge work in that chat. The next chat starts with `gh pr checks <n>` / `git log origin/master` and handles any CI red,
   the merged PR's deploy check, CodeQL master re-raises and the post-merge record.

## Ownership and base

| Field | Value |
|---|---|
| **Current branch** | `agent/claude/sprint-134-pr-n-next-critical` (from `origin/master` `866857ed`) carries PR N: **open (v11.97.0), awaiting maintainer merge**. Do not reuse it. The exemption renewal goes on a **fresh** branch cut from `origin/master` after PR N merges and its deploy + health verify finish (on ~10-24; merge before 10-25 17:00 PDT). PR L follows the renewal (its merge must not take the slot the renewal needs). The PR D branch merged as #313, the PR E branch as #312 and the PR A branch as #311; all can be deleted. The planning branch `agent/claude/sprint-134-planning` merged as #310 and can be deleted. Every later PR is cut from `origin/master` after the previous one merges |
| **Active editor** | Claude |
| **Shared resources** | dependency lane: **Claude** (maintainer-designated); each PR re-derives its version from `origin/master` at merge time |

## Spec and plans

- Spec: [`docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md`](../../docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md)

## PR sequence

| # | PR | Scope | Due | Plan | Status |
|---|---|---|---|---|---|
| 0 | **F** | follow-redirects 1.16.0 → 1.16.1 (GHSA-q3jh-wrc6-jgq8 + GHSA-8r9p-f939-6h3c, high, published 2026-10-20); one-node splice; v11.93.0 | high SLA 10-27 | spec *PR F* | **SHIPPED** `63a6cd26` (#310), CI/CD 39516935342 green |
| 1 | **A** | BUG-063: repair every export query against the live schema | **2026-10-24** (target merge 10-22) | [`plans/2026-10-20-sprint-134-pr-a-bug-063-export.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-a-bug-063-export.md) | **SHIPPED** `bf524296` (#311, v11.94.0), CI/CD 39666220132 green. Human validation (Task A12) pending: maintainer downloads all three exports on karmyq.com. See *PR A state* below |
| 2 | **E** | Expo SDK 57 patch (#279) + drift-workflow silent-failure fix | — | [`plans/2026-10-20-sprint-134-pr-e-expo-patch.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-e-expo-patch.md) | **SHIPPED** `eea83267` (#312, v11.95.0), CI/CD 39711848936 attempt 2 green. See *PR E state* |
| 3 | **D** | `verify:demo` loads `DEMO_ENV_FILE`, else the repo-root `.env.demo` | — | [`plans/2026-10-20-sprint-134-pr-d-verify-demo-env.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-d-verify-demo-env.md) | **SHIPPED** `866857ed` (#313, v11.96.0), CI/CD 39797190307 green. Human validation (Task D8) pending; see *PR D state* |
| — | **N** | `next` 16.3.8 → 16.4.2 (GHSA-2464-fhr4-w9xw critical RCE + GHSA-p3m5-59mp-jv5r high, published 2026-10-22 15:52Z); 10-node splice; v11.97.0 | critical: blocks every PR now | *PR N state* below | **PR OPEN** (v11.97.0), awaiting maintainer merge |
| — | **X** | Exemption **renewal** (re-checked 2026-10-22 twice: no upstream fix, renewal needed) | gate fails **10-25 17:00 PDT** | *Dated obligations* below | **On ~10-24**, cut fresh from `origin/master` after N merges and deploys; created 10-24 → expires 10-31 |
| 4 | **L** | ADR-101 legacy handlers + BUG-068 code (no migration) | **2026-10-29** | [`plans/2026-10-20-sprint-134-pr-l-legacy-handlers.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-l-legacy-handlers.md) | drain check **PASSED** 2026-10-20; decisions settled; ready. Deferred 2026-10-22 by the `next` critical (PR N). Its chat can start before 10-24 on a branch cut after N merges, but **it merges only after the renewal** (the renewal owns the next slot before 10-25 17:00 PDT); re-run Task L1 first |
| 5 | **L2** | Migration: drop `interaction_feedback` + 7 dead average columns; update readers (incl. the reputation health route); **BUG-070** | BUG-070 **2026-11-03** | write at PR start | — |
| 6 | **K** | BUG-069: admin writes re-derive live role (**ADR-102**, allocated 2026-10-20) | **2026-10-30** | write at PR start | — |
| 7 | **V** | PR V read-boundary follow-ups (`docs/IDEAS.md` 2026-10-19) | — | write at PR start | — |
| 8 | **B** | PR B endorsement follow-ups (`docs/IDEAS.md` 2026-10-13) | — | write at PR start | — |
| 9 | **C** | Scheduled exemption re-check evidence (treadmill a) | — | write at PR start | — |

B and C are the likeliest to spill into Sprint 135, which is expected. One merge at a time; wait for deploy + health before the next.

## PR A state (2026-10-21)

Branch `agent/claude/sprint-134-pr-a-bug-063-export`, executed inline (`superpowers:executing-plans`). All 12 export queries
match `init.sql`; gates `services/community-service/tests/regression/sprint-134-export-{schema-truth,date-filter}.test.ts`;
real-SQL `tests/integration/sprint-134-community-export.integration.test.ts` (CI-only). **CI green on `b8bf6d25`** (run
39655079036: export suite 11/11, integration 175/175, every check). Community-service 9 unit + 197 regression; pre-push 27/27.

**Review history:** first gate pass + Opus final review (2026-10-20); second gate pass at the maintainer's request (2026-10-21):
`/simplify` → shared `sendError` (403/404/500 now carry `FORBIDDEN`/`NOT_FOUND`/`INTERNAL_ERROR`); `/code-review` → NULL-safe
date predicate, CSV formula-injection neutralisation, gate fails on any unreadable `.query(`, year 0000 → 400;
`/security-review` → no findings. **Codex review of `b8bf6d25`: no blocking findings**; its P3 (the extractor skipped a
template starting on the line after `pool.query(`) is fixed with a negative fixture and a real injection proof.

**Deviations the maintainer should see (rulings):**
- **Reputation summary is now all-time**, ignoring `date_start`/`date_end` (spec said only "qualified"). `/code-review` showed
  two overlapping windows could be subtracted to isolate one member's karma, defeating ADR-082's 5-contributor rule. No UI
  sends dates.
- Date params must be `YYYY-MM-DD` (400 `INVALID_DATE_RANGE`); `date_end` includes its whole day.
- The two reviewed `directedSurfaceAllowlist.json` exceptions for export.ts are **deleted**: the date filter is now `AND (...)`,
  so the Sprint 132 scanner proves the guard statically.
- `services/registry.json` `database_schemas` `community` → `communities` (source of the generated `.claude/README.md` line).
- Activity "Requests Created" for the fixture is 3 (plan said 2; the C∧D ask added by the external review counts).

**Policy questions (shipped as-is; the maintainer merged on Codex's recommendation to keep both, 2026-10-21):**
- All-time reputation summary (above). Codex recommends keeping it; repeated snapshots over time remain a broader limit.
- The full export and `/export/members` list members who have **left**, with email (BUG-062-consistent; spec: "full roster,
  all statuses"). Codex recommends keeping it for this bugfix and treating retention as a separate policy decision.

**Deferred minors:** the schema-truth gate blanks `"quoted"` identifiers; the guide quotes the 403 message but CSV downloads
show "Failed to export data"; CSV formula neutralisation does not cover a `;`-splitting locale or a leading space (security
review, ~3/10). Follow-up: when BUG-070 (PR L2) needs it, lift `parseSchema`/`checkQueries` into a shared test helper.

## PR E state (2026-10-21)

Executed inline (`superpowers:executing-plans`). **Targets re-derived 2026-10-21** (three moved since planning): `expo` ~57.0.31,
`expo-location` ~57.0.22, `expo-router` ~57.0.29; the other six as planned. Lock: 29 package nodes + the `apps/mobile` edge spliced
from a scratch re-resolve (incl. `@expo/cli` 57.0.32 and `xcode` 3.0.1 → 4.0.0, a major move required by `@expo/config-plugins@57.0.11`).
The re-resolve also dropped 15 nested nodes whose requirers still need them; they were kept. Proof: 0 added/removed keys, 0 key-order
changes, `npm view` parity 29/29 (checker shown to fail on injected defects), `npx -y npm@11.19.0 ci` exit 0, `npm ls --all` error
multiset identical to baseline, `audit-exemptions` 0 unexempted (19 exempt, was 20: `@expo/metro-file-map@57.0.4` dropped `micromatch`),
divergence gate `ok: true` (jest pair only), mobile tsc + jest green. `@expo/cli@57.0.32` still declares `node-forge ^1.3.3`.

**Workflow:** file step `always() && (failure() || issue != '0' || status != '0' || result == '')`; close step needs
`outcome == 'success' && status == '0' && issue == '0'`; fail step unchanged; `GH_REPO` + shielded renderer + fallback body.
Gate `tests/regression/sprint-134-expo-drift-workflow.test.ts` (23); model shared at `tests/regression/helpers/workflowConditions.ts`
(now applies GitHub's implicit `success()` and refuses a foreign step id). Gates: `/simplify` (4 agents, applied), `/code-review`
medium (status terms added after it found a reachable status=1/issue=0 state), `/security-review` no findings.

**Rulings for the maintainer:** `always()` kept over `!cancelled()` (a job timeout reports as cancelled); redundant `result == ''`
kept for demo-health parity; Windows `npm ci` must run from an uppercase `C:\` cwd (lowercase writes junctions that crash `npm ls`).
**Follow-ups (docs/IDEAS.md 2026-09-13):** repo-wide gate over all issue-filing steps; a close step that fails on green is still silent.
**Codex review (2026-10-21, at `762a478d`): no blocking findings; ready for maintainer merge.** It verified the lockfile splice,
the workflow failure handling, green CI (20/20) and the drift dispatch; locally 68 regression tests, 2 mobile tests and mobile
`tsc` passed. Its minor note (the PR Validation section named `62ebfbf0` as head) was fixed in the PR body. It confirmed that a
close step failing on green is a logged follow-up, not a blocker. Its review stayed read-only because of WIP in the shared tree.
**Post-merge (2026-10-22):** merged `eea83267`; deployed by CI/CD 39711848936 attempt 2 (see Status). #279 was closed by the
branch dispatch (run 39708884381) before merge; the merge landed before any scheduled master run, so no new drift issue was
filed. **Confirmed (closed):** the first scheduled drift run on master with the fix, 39782668093 (`eea83267`, started 12:57Z
2026-10-22), is green; no open drift issue (maintainer confirmed; re-verified 2026-10-22 18:30Z).

## PR D state (2026-10-22)

Executed inline (`superpowers:executing-plans`) on `agent/claude/sprint-134-pr-d-verify-demo-env`, v11.96.0 (re-derived from
`origin/master` `eea83267`). `src/scripts/demoEnvFile.ts`: `resolveDemoEnvPath` + `loadDemoEnvFile`; `verify:demo` `main()` applies
the story keys before `readEnv()`; `rotate:demo-stories` publishes to the same path and hands it, absolute, to the host commands.
Tests: `services/simulation-service/tests/tdd/sprint-134-demo-env-file.test.ts` (17, real temp files). Gates: `/simplify` (4 agents,
test helpers applied), `/code-review` medium (10 findings: 6 fixed, 2 ruled, 2 resolved by the fix), `/security-review` no findings.

**Rulings for the maintainer (deviations from spec/plan):**
- **Anchor = the repo root, not `INIT_CWD`.** `scripts/demo/*.sh` already anchor a relative/unset `DEMO_ENV_FILE` to the repo
  root; `INIT_CWD` can differ (and nested npm runs inherit it), which would let rotate publish to one file while
  `restart-auth.sh` sources another. The spec's goal (find the repo-root file) holds on every invocation.
- **Only `DEMO_CONFIG_KEYS` are applied** (via `dotenv.parse`, not `config()`): `.env.demo` is the compose env and carries
  `JWT_SECRET`, `POSTGRES_PASSWORD`, `INTERNAL_SECRET`. So the sprint-131 dotenv gate is unchanged (no new `config()` call).
- The report adds `envFileShadowed`: exported story keys whose value differs from the file (names only), the stale-export
  failure mode the guide warns about. `||` not `??`: an empty `DEMO_ENV_FILE` means the default (matches `:-` in the scripts).
- Not fixed (ruled): rotate does not load the file (spec keeps reset/rotate unaffected); the loader's `verify:demo` error
  prefix (only verify calls it).

**CI:** #313 20/20 green. CodeQL #625 (`js/command-line-injection`, a re-raise of the dismissed #567 after a line shift) and #626/#627
(`js/path-injection`, operator `DEMO_ENV_FILE`) were dismissed as false positives on the maintainer's authorization (2026-10-22).
A re-raise on master was expected after the merge but **did not happen** (checked 2026-10-22 18:30Z): the same alert numbers moved to
`refs/heads/master` and stayed dismissed, because the flagged lines were unchanged between PR head and squash; 0 open alerts.
Codex review at `abe876a6`: no blocking implementation findings; its one finding (this table's stale *Current branch* row) is fixed.
**Post-merge (2026-10-22):** admin-merged `866857ed` (v11.96.0); CI/CD 39797190307 green, 14/14 jobs, Deploy to Demo: all 9 services
healthy, no rollback.

**Human validation (Task D8, maintainer, demo host; ask before running):** source `.env.demo.rotation`, export no story IDs,
run `npm --workspace @karmyq/simulation-service run verify:demo` from the repo root → `envFile: <repo>/.env.demo`,
`envFileShadowed: []`, `ready: true`. Repeat from `services/simulation-service/` with `DEMO_ENV_FILE` unset → same file.
Export one ID to a wrong value → the report fails and lists it under `envFileShadowed`.

## PR N state (2026-10-22)

Found by this chat's exemption re-check: `audit-exemptions` exit 1, `BLOCKING (critical): next`. GHSA-2464-fhr4-w9xw (critical,
unauthenticated RCE in the Image Optimization API with SVG) and GHSA-p3m5-59mp-jv5r (high, Server Actions DoS), both
`>=16.0.0 <=16.4.0`, first patched 16.4.1, published 15:50–15:53Z 2026-10-22 (after #313's deploy). No 16.3.x backport.
**Not reachable on the demo** (traced in `/code-review`): the RCE is the `sharp`/libvips bug on glibc (workaround `sharp >= 0.35.5`;
the lock has had 0.35.5 via the `sharp@<0.35.5` override since #299) and the frontend image is `node:24-alpine`; the DoS needs App
Router + a Server Action, and both apps are Pages Router with no `'use server'`. The bump is still required: the gate audits presence
and critical is never exemptible. `next` is now `sharp`'s only dependent and declares `^0.35.5` itself, so the override is
redundant for it (kept: harmless, guards any re-resolve; removal is an optional follow-up). Dependency work earned by a security advisory; Claude
holds the lane. **This took the chat instead of PR L**: a critical fails every PR's Security Audit, so neither PR L nor the
renewal could go green without it.

Branch `agent/claude/sprint-134-pr-n-next-critical` from `origin/master` `866857ed`, v11.97.0. In-place splice (scratchpad script,
guarded: each lock field had to equal the old registry manifest first): `next`, `@next/env` and the 8 `@next/swc-*` binaries
16.3.8 → 16.4.2 (latest; 16.4.1 has the same dependency shape); `next`'s `sharp` edge `^0.35.5` (already satisfied by the
`sharp@<0.35.5` override at 0.35.5); `apps/frontend` + `apps/landing` `^16.4.2`. `eslint-config-next` stays 16.3.5 (out of range).
**Proof:** node diff vs a byte copy: 10 nodes + 2 edges changed, 0 added/removed, 0 key-order changes, `libc` untouched; registry
parity 10/10 (independent check); strict `npx -y npm@11.19.0 ci` exit 0 from `C:\`; `npm ls --all` = baseline (3 invalid + 1
missing); `audit-exemptions` 0 unexempted (19 exempt); both apps `next build --webpack` green on `Next.js 16.4.2`; standalone
server boots and serves `/login` + `/` with the `public, max-age=300, must-revalidate` contract; frontend 62 unit + 405 regression,
landing 65. ADR-059 amended (Sprint 134, 2026-10-22). The `dependency-guard` hook's 60-line warning (88 lines) is accounted for: 44
lines per side, which is 42 intended field lines plus the 2 root version lines.

**Gates:** `npm test` 27/27 tasks; `tests` workspace re-run after the doc edits 101 + 925 green. `/simplify` (4 agents): reuse,
efficiency, altitude clean; simplification trimmed the ADR amendment to the precedent's shape (proof moved to the PR body).
`/code-review` medium (6 findings): the exposure claim was wrong and is corrected (not reachable, above); timestamp churn reverted;
the exemption cell rewritten; the handoff's "open" is true at push; the `sharp` override is kept (optional follow-up); and
`guides/demo-data.json` + `services/simulation-service.json` are **kept**: they are PR D's guide/CONTEXT text, which #313 shipped
without regenerating (disclosed in the PR body). `/security-review`: no findings (integrity + `resolved` parity 10/10, no host change).

**Post-merge check (next chat):** the deploy's health verify; karmyq.com `window.next.version` should read 16.4.2 (ask before any
browser smoke on the demo).

## Maintainer decisions (2026-10-19 / 2026-10-20)

- Committed scope: BUG-063, PR L, the Expo patch, `verify:demo` env (2026-10-19). Candidates **all chosen**: BUG-069, PR V follow-ups,
  PR B follow-ups, exemption checker (a) (2026-10-20). Treadmill item (b) (reach-scoped audit) is **not** in scope.
- **BUG-063: repair every section** (not just the schema name). The bug is wider than filed: nine defect classes (spec table).
- **BUG-068 data: drop it, in a separate PR L2** after the code-only PR L. The drop covers the `requests.interaction_feedback` table,
  4 `trust_scores` columns and 3 `community_health_metrics` columns; readers include the feed composer and milestone detector.
- **2026-10-20 (after #310):** BUG-070 **belongs in L2** (confirmed). Exemptions: **renew node-forge and braces if no upstream
  fix is available** (standing authorization for this re-check; still remove any whose fix has shipped). ADR: **ADR-102 is allocated
  to PR K (BUG-069)** ("whatever is the next ADR"; highest on master is ADR-101, no open PR claims 102).
- **PR L decisions (2026-10-20):** remove `reputation` from `EVENT_CONSUMERS` and its consumer-queue startup, recorded as an
  **ADR-101 amendment** (no new number); narrow the PR Q integration test's delivery probe to notification.
- **Drain check: PASSED** (maintainer ran it 2026-10-20; numbers below). PR L is unblocked.
- **follow-redirects advisories (2026-10-20): fix now, on the planning branch, as PR F.** They were found when the planning push's
  pre-push hook failed on a docs-only diff. Proof in the spec's *PR F* section.
- PR E includes the `expo-sdk-drift.yml` silent-failure fix (`docs/IDEAS.md` 2026-09-13), as the previous handoff suggested.
  The maintainer may veto.

## #310 review (2026-10-20)

Final head `05adfd10`: 20/20 checks green; earlier CI green at `47561a61` (run 39497569765, incl. Integration Tests, Security Audit, Code Scanning Gate). An external read-only
review found no correctness issue in the dependency fix. Gates on #310: `/simplify` clean (no source code; lock splice is the
right depth, no override needed, no other lockfile holds follow-redirects); `/code-review` (medium) found the code clean and 8
findings in the planning docs, all verified and fixed (BUG-070 logged; PR D now resolves `.env.demo` against `INIT_CWD`; PR E
workflow conditions per step; PR L health.ts reads moved to L2; PR A RLS note corrected). The external review's PR A fixture
(second community + denial on all three routes) and v11.94.0 items are applied. `/security-review`: see the PR body.

## Dated obligations

| Item | Due | Note |
|---|---|---|
| ~~follow-redirects GHSA-q3jh-wrc6-jgq8 + GHSA-8r9p-f939-6h3c (high)~~ | ~~2026-10-27~~ | **DONE**: #310 `63a6cd26`, live 2026-10-21 00:00Z. Dependabot never raised alerts for them (the lock moved within hours); open alerts are only #168 node-forge and #169 braces (exempted) |
| ~~BUG-063~~ | ~~2026-10-24~~ | **DONE**: #311 `bf524296` (v11.94.0), live 2026-10-21; no risk acceptance needed |
| **`next` GHSA-2464-fhr4-w9xw (critical) + GHSA-p3m5-59mp-jv5r (high)** | now (blocks every PR) | **PR N open** (v11.97.0), 16.3.8 → 16.4.2; see *PR N state* |
| node-forge + braces ADR-059 exemptions | **2026-10-26** (gate fails **2026-10-25 17:00 PDT**) | **No upstream fix → renew (pre-authorized, maintainer 2026-10-20).** Last re-check 2026-10-22 18:30Z (unchanged from 04:10Z): `audit-exemptions` 0 unexempted besides the `next` critical (19 exempt); GHSA-86w9-cpqp-85rv node-forge `<= 1.4.0`, latest 1.4.0, `first_patched_version` empty; GHSA-vfj7-8cjw-p6xm braces `<= 3.0.3`, latest 3.0.3, empty; `@expo/cli@sdk-57` 57.0.32 `node-forge ^1.3.3` (SDK 58's `^1.4.0` is still vulnerable, so no SDK move helps); `micromatch@4.0.8` `braces ^3.0.3`. **Renewal PR on 2026-10-24 (UTC)**, cut fresh from `origin/master` **after PR N merges and deploys**; created 10-24 → expires 10-31 (7-day cap); it takes the merge slot before 10-25 17:00 PDT (PR L merges after it). Re-run first: `node scripts/audit-exemptions.js` (audits the lockfile, so a published fix alone does not trip it), `npm view node-forge version`, `npm view braces version`, `gh api advisories/<GHSA> --jq '.vulnerabilities[].first_patched_version'`, `npm view @expo/cli@sdk-57 dependencies.node-forge`, `npm view micromatch dependencies.braces`. Remove any exemption whose fix has shipped and is reachable. BUG-059 |
| **PR L** (BUG-068) | **2026-10-29** | Unblocked: drain check passed 2026-10-20 (below) |
| **BUG-069** | **2026-10-30** | PR K. **ADR-102** (allocated 2026-10-20). If the inventory shows it cannot merge in time, propose a dated risk acceptance and split by service |
| **BUG-070** (BUG-063 class in reputation health + dead `FeedComposer`) | **2026-11-03** | Logged 2026-10-20 (LOW, proposed); **in PR L2** (maintainer confirmed 2026-10-20) |
| Demo stories | ~2026-12-18 | `demo-health.yml` watches the runway |

## Queue drain check (PR L precondition, read-only)

The auto-mode classifier refuses Claude's SSH read, so the maintainer ran it (commands: PR L plan Task L0). **Pass:** legacy `bull:karmyq-events` `wait`,
`active`, `delayed` and `paused` all 0, and each `karmyq-events-<consumer>` queue is served only by its own consumer's container.

**Result (run by the maintainer on the demo host, 2026-10-20, after #310 deployed): PASS.**
- Legacy `bull:karmyq-events`: `wait` 0, `active` 0, `paused` 0, `delayed` 0.
- `CLIENT LIST` workers (names decoded from base64; IPs mapped with `docker inspect`): `karmyq-events-notification` → 1 worker,
  notification-service (172.18.0.16); `karmyq-events-reputation` → 1 worker, reputation-service (172.18.0.9). Every dedicated queue is
  likewise served only by its owner: `karmyq-completion-dispatch` request (.2); `karmyq-completion-{notification,reputation,social-graph}`
  their own services (.16, .9, .3); `karmyq-directed-notifications` notification (.16); `karmyq-skill-endorsement-social-graph`
  social-graph (.3); `karmyq-community-evolution` reputation (.9).
- Legacy `karmyq-events` still has one worker each from notification (.16), social-graph (.3) and reputation (.9). Expected: those
  are the legacy handlers PR L removes.
- Nothing publishes to `karmyq-events` since the PR Q deploy (ADR-101), so the result holds until PR L ships; PR L10 re-checks after deploy.

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
- Scheduled `Expo SDK drift` run 39424368063 on master is **red by design**: it detected the #279 drift (9 packages). PR E fixes it (#312 open 2026-10-21).
- `npm ls --all` baseline (measured 2026-10-20 at HEAD): 3 invalid (color-string, ms, picomatch) + 1 missing
  (`@react-native/metro-config`, required by react-native-worklets). Those are the "four" `apps/mobile/claude.md` records; memory
  counts only the invalids. Judge any splice by "no new errors".

## Standing rules

Every demo-host operation, merge, exemption renewal, CodeQL dismissal and ADR number needs explicit per-operation authorization.
Never push docs-only to master; fold docs into the next PR. Reconcile this handoff against `gh pr list` / `git log` after every
merge and at session end.
