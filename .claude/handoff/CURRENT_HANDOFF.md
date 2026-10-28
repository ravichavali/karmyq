# Sprint 134 — Dated Obligations and Boundary Hardening — Handoff

**Date**: 2026-10-28
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
**Historical Expo drift closure (2026-10-22):** scheduled run 39782668093 on master (`eea83267`, 12:57Z) green, the first with the PR E fix. This predates new issue **#316**, still open; see *Dated obligations*.
**New critical, 2026-10-22 15:52Z:** `next` GHSA-2464-fhr4-w9xw (unauthenticated RCE, image optimizer) + GHSA-p3m5-59mp-jv5r
(high DoS), `16.0.0–16.4.0`, published after #313's deploy. **PR N #314 SHIPPED** 2026-10-22: admin-merged `0321c415`
(v11.97.0) on the maintainer's authorization after Codex review. CI/CD 39853173679 green: 14/14 jobs, the deploy built
`Next.js 16.4.2` for frontend and landing, "DEPLOYMENT SUCCESSFUL", all 9 services healthy, the failure step skipped (no
rollback), 0 open CodeQL alerts on master (checked 21:25Z). **Exemption re-check 2026-10-22 21:25Z:** unchanged (0 unexempted,
19 exempt, no upstream fix); renewal deferred to a 10-24 (UTC) chat so it does not shorten the window. No renewal PR was cut
on 10-24, so the exemptions lapsed at 2026-10-26 00:00Z; **Security PR X** was the renewal.
**Security PR X #317 SHIPPED** 2026-10-26: merged `e15622bc` (v11.98.0) by the maintainer at 22:08Z after Codex review (braces
exemption removed, node-forge renewed to 2026-11-02, body-parser/undici/zod/qs highs fixed, audit validator fixed). CI/CD
40410093954 green: 14/14 jobs, the deploy built `Next.js 16.4.2`, "DEPLOYMENT SUCCESSFUL", all 9 services healthy, the failure
step skipped (no rollback), 0 open CodeQL alerts on master after the deploy. See *PR X state*.
**PR L #315 SHIPPED** 2026-10-26: admin-squash-merged `ff3f394e` (v11.99.0) at 23:05:13Z on the maintainer's explicit
authorization. CI/CD 40417261628 green: 14/14 jobs, "All critical services healthy", "DEPLOYMENT SUCCESSFUL", all 9 services
healthy, "Notify on failure" skipped (no rollback). **No CodeQL re-raise** (0 open alerts on master). The maintainer's
post-deploy queue check **PASSED**: no worker and no jobs on either retired queue. See *PR L state*.
**PR K #319 SHIPPED** 2026-10-27: merged `dd585016` (v11.100.0) by the maintainer at 02:55:40Z after CI (real SQL 101/101) and
Codex review #2 (no findings). CI/CD 40441255956 green: 14/14 jobs, "All critical services healthy", "DEPLOYMENT SUCCESSFUL",
all 9 services healthy, "Notify on failure" skipped (no rollback). **No CodeQL re-raise** (0 open alerts on master; the
merge-sha analyses raised nothing new, highest alert still #627). ADR-102 flipped to Implemented. BUG-069 closed inside its
10-30 date. Human validation pending (*PR K state*). See *PR K state*.
**PR L2 [#320](https://github.com/ravichavali/karmyq/pull/320) SHIPPED**: merged `47c9a323` (v11.101.0) at
2026-10-27 20:37:13Z. [CI/CD 40579675258](https://github.com/ravichavali/karmyq/actions/runs/40579675258)
passed 14/14 jobs, including deploy and health check; "Notify on failure" skipped (no rollback).
0 open CodeQL alerts on master at this post-merge check. **BUG-070 fixed and deployed inside its 2026-11-03 date.**
Human validation pending: reputation logs after the first 02:00 nightly run (*PR L2 state*).
**PR V [#321](https://github.com/ravichavali/karmyq/pull/321) SHIPPED** as `645d28fd` (v11.102.0) at
**2026-10-28 04:14:22Z** on the maintainer's explicit admin-merge authorization. Deploy run
[40631196261](https://github.com/ravichavali/karmyq/actions/runs/40631196261) passed **14/14 jobs**;
all **9 services healthy**, failure notification skipped (no rollback), **0 open CodeQL alerts on
master**. Merge-commit analyses completed without errors/warnings. Human checks remain pending.
See *PR V state*.
**Security follow-up [#322](https://github.com/ravichavali/karmyq/pull/322) SHIPPED** as `4ee38e82` (v11.103.0), merged by
the maintainer at **2026-10-28 18:56:43Z** after Codex review (no blocking findings). [CI/CD 40749793316](https://github.com/ravichavali/karmyq/actions/runs/40749793316)
passed **14/14** including Deploy to Demo. The node-forge deadline is met: the exemption registry on master is empty, 0 open
code-scanning alerts, 0 open Dependabot alerts. deepmerge #178 dismissed `tolerable_risk` (maintainer option a). See
*Security follow-up state → Post-merge*.
**Now:** **PR B (vouch from a completed exchange) is OPEN, awaiting Codex review / maintainer merge**, [#323](https://github.com/ravichavali/karmyq/pull/323), on
`agent/claude/sprint-134-pr-b-vouch-from-request` (base `origin/master` `4ee38e82`, unchanged at open), v11.104.0 re-derived
at PR open. All four gates ran; the real-SQL integration matrix is **CI-only** (not run on this Windows box). See *PR B state*.
**BUG-073 tabled (maintainer, 2026-10-26):** community admin and platform admin
become separate roles, as a new feature in a future sprint (`docs/IDEAS.md` 2026-10-26); the 10-29 deadline no longer applies.
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
3. PR V and the security follow-up (#322) are shipped; deploy/health are verified in *PR V state* and
   *Security follow-up state → Post-merge*. **PR B is open** (*PR B state*), awaiting Codex review and the maintainer's
   merge. The next chat starts with `gh pr checks <n>`: the CI integration job is the first real-SQL run of
   `tests/integration/sprint-134-pr-b-viewer-partners.integration.test.ts` and the arbiter of the `rated_by_me` RLS
   question. After merge: deploy/health check, CodeQL master re-check **including the `/language:actions` "Unknown
   Error" carried from `4ee38e82`**, the post-merge record, and the PR B human validation list. PR V human validation
   and PR L2's nightly reputation-log validation are separate open checks. BUG-074 is the next small PR candidate.
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
| **Current branch** | `agent/claude/sprint-134-pr-b-vouch-from-request`, from `origin/master` `4ee38e82` (#322, v11.103.0). First commit: the #322 post-merge record. The old `agent/codex/sprint-134-pr-b-endorsement-followups` is **safe to delete** (maintainer's call): its two docs commits `4b0c6386`/`56357e50` are patch-identical (`git patch-id --stable`) to `ac08fbf4`/`0685c058`, both ancestors of #322's head `1ecf1a05`, whose tree equals master's `4ee38e82` tree. (`git cherry` shows them as missing only because #322 was squash-merged.) |
| **Active editor** | **Claude** authored PR B (executed 2026-10-28); **Codex reviews** the open PR. No concurrent edits on this branch: review findings come back through the maintainer to the next Claude chat. |
| **Shared resources** | dependency lane: **Claude** (maintainer-designated); nothing dependency-dated is open after #322 except Expo drift #316 (awaiting a maintainer decision) and BUG-041's re-check by 2026-11-14. PR B is product work and edits no manifest or lockfile beyond the root version. Push branch and leave tree clean at every stopping point. Each PR re-derives its version from `origin/master` at merge time. |

## PR B plan (Claude, planning chat 2026-10-28)

**Goal:** a participant who opens a completed ask, usually from the completion notification, sees each partner from
that exchange and can rate it and vouch for the partner's skills right there. Partner status and vouch eligibility
come only from the server.

**Why:** both participants get `match_completed` ("Match Completed — Leave a Rating", CTA "Rate Helper") linking to
`/requests/:id`. That page shows only "This ask is completed." and has no rating or vouch control. `viewer_match` is
`proposed`/`matched` only (`services/request-service/src/routes/requests.ts:1643`, re-verified at `4ee38e82`; the
statement is on `requestReadableSql`, line 1647).

**Maintainer decisions (2026-10-28):**
- **Placement:** request page only, for both participants: the requester sees every completed helper; a helper sees
  only the requester. No dashboard placement; **no dismiss or snooze**.
- **Endpoint:** extend `GET /requests/:id` with `viewer_partners` (scalar subquery inside the guarded statement; `[]`
  for everyone else). No separate participants-only endpoint.
- **Rating:** on the same panel (reuse `RatingPrompt` + `submitExchangeRating`; server adds `rated_by_me` and
  `rating_community_id`).
- **Notification:** no new event or queue. Fix the existing `match_completed` copy ("Exchange completed" / "Rate &
  vouch") in the template **and** `apps/frontend/src/components/NotificationItem.tsx:90`. The "you were vouched for"
  notification stays a later dedicated-queue item (BUG-060).
- **ADR:** an ADR-100 amendment, so no number is needed. **BUG-074** (cancel route has no status guard) is logged and
  goes to a separate PR.
- Defaults accepted without objection: one block per partner, newest first; vouch attribution unchanged (ADR-100 most
  recent completed match).

**Shape:** 13 tasks, no migration, no dependency change.
- Request-service TDD (exact SQL fragments).
- Root real-SQL matrix (CI-only), including the reputation rating round trip and auth `can_endorse`/`POST
  /endorsements` agreement.
- `viewer_partners` implementation.
- Frontend TDD per the UI coverage table; `MemberSkills endorsableOnly`; `CompletedExchangePanel` + page wiring.
- Notification copy.
- Docs: profile, match-lifecycle, fulfilling-requests and managing-commitments guides; the `skill-endorsements`
  concept; onboarding; the ADR-100 amendment; IDEAS.
- CONTEXT + registry; the four gates; final verification; PR and stop.

The spec carries the layout audit, the reference products (Airbnb, Upwork, Couchsurfing, TaskRabbit, LinkedIn) and
the layout decision.

**Critical implementation notes (verbatim from the plan header, a superset of the spec's):**

1. **Partner status is per exchange, not per read.** The partner subquery filters `pm.status = 'completed'` AND
   `matchParticipantSql('r', 'pm', '$2')` (`services/request-service/src/db/directedAudience.ts:20`). Partner is
   `CASE WHEN r.requester_id = $2 THEN pm.responder_id ELSE r.requester_id END`. Never derive it from
   `requestReadableSql`. That grants reads to historical helpers and the preferred provider, who are **not** partners.
2. **Keep it inside the existing guarded statement.** Add `viewer_partners` as a scalar subquery in the SELECT list of
   the detail query (`requests.ts:1615-1650`), so it needs no GROUP BY change: it references only grouped `r.id` and
   `r.requester_id`. It reads `requests.matches`, `auth.users`, `feedback.feedback` and `requests.request_communities`,
   not `requests.help_requests`, so the directed-surface scanner sees no new read. Run its gate:
   `services/request-service/tests/regression/sprint-132-directed-audience-gate.test.ts`.
3. **`$2` stays uuid-only.** Every new use of `$2` compares it with a uuid column. A text cast or a `$2 IS NULL` test
   can raise "inconsistent types deduced for parameter $2" (the L2 CI failure). A NULL viewer already yields no rows
   through `=`.
4. **`rated_by_me` mirrors the dashboard's rate decision** (`requests.ts:1053-1056`). `feedback.feedback` has RLS
   ENABLEd without FORCE and a `community_isolation` policy (init.sql:6691, 6697), as `requests.matches` does. Both run
   behind the same `dbContextMiddleware` (`services/request-service/src/index.ts:128-135`). CI's real-SQL test is the
   arbiter. The demo role's RLS bypass is **UNVERIFIED** (it would need a demo-host read).
5. **No client eligibility.** The vouch row filters only on `can_endorse`/`endorsed_by_me` from
   `GET /auth/skills/users/:userId` (`services/auth-service/src/routes/skills.ts:14-40`). That route uses the same
   `completedPairSql` + `skillVisibleToSql` as `POST /endorsements` (`skills.ts:96-107`). A 404, an error or no
   endorsable skill renders nothing.
6. **Vouch attribution is unchanged (ADR-100):** the most recent completed match of the pair, possibly another request.
   Do not add a `match_id` input to `POST /endorsements`.
7. **The rating write is unchanged.** `POST /reputation/feedback` validates participant, counterparty, completed status
   and community (`services/reputation-service/src/routes/reputation.ts:347-370`). The panel sends `{ match_id,
   to_user_id: partner.user_id, community_id: rating_community_id, rating }` via `submitExchangeRating`
   (`apps/frontend/src/utils/completion.ts`), which is best-effort. A null `rating_community_id` hides the prompt.
8. **Ratings stay private (ADR-036).** Expose only whether the viewer rated.
9. **Several completed matches exist (BUG-074)**, possibly the same partner twice. Rate per match; vouch once per
   distinct partner (the newest entry). Do not fix BUG-074 here.
10. **The existing page tests mock `@/lib/api` with `requestService` only**
    (`apps/frontend/tests/tdd/sprint-101-request-detail-action.test.tsx:23-33`, plus the sprint-116/132 regression page
    tests). The panel must not render, and must not call `skillsService`/`reputationService`, when `viewer_partners`
    is absent or empty.
11. **Frontend Jest clears nothing between tests**: `mockReset` in `beforeEach` (`sprint-133-vouch.test.tsx:19-21`).
    The API client already unwraps the envelope (`res.data`).
12. **No JWT claim reads** (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`). Use `req.user.userId` only.
13. **Real SQL is CI-only here.** CI's integration job starts auth, reputation, request and the rest
    (`.github/workflows/ci.yml:306`). Follow `tests/integration/sprint-133-request-detail-visibility.integration.test.ts`
    and `tests/integration/sprint-133-endorsement-trust.integration.test.ts`. Use explicit `::varchar` casts on
    parameters compared with `requests.matches.status` (L2 lesson). Check every fixture column against `init.sql`
    (`requests.provider_profiles` needs `user_id`, `service_type`, `display_name`: init.sql:2570-2580).
14. **Version** re-derived at merge; root version occurrences only; no dependency change.
15. **`npm test` regenerates `apps/landing/src/data/docs/`**: revert timestamp and HEAD-sha churn before committing.
16. **The TDD promoter sweeps every green `tdd/` file repo-wide**: restore unrelated promotions to keep the PR scoped.
    Run a single Jest file with `--runTestsByPath` or `--testPathPatterns` (plural, Jest 30).
17. **Ask before**: any merge ("admin merge, yes/no?"), any demo-host operation, any CodeQL dismissal. PR B needs no
    ADR number (ADR-100 amendment). It should not touch `apps/frontend/src/lib/api.ts`. If it does, expect the
    `js/request-forgery` re-raise after merge.

**Carry-forward relevant to PR B:**
- BUG-074 (open, separate PR).
- The CodeQL `/language:actions` "Unknown Error" on `4ee38e82`: re-check it on PR B's merge sha.
- PR V's human checks (departed helper and preferred provider keep reads) are the read side of note 1.

## PR B state (Claude executor, 2026-10-28)

**Status: OPEN, awaiting Codex review / maintainer merge** ([#323](https://github.com/ravichavali/karmyq/pull/323)). Branch
`agent/claude/sprint-134-pr-b-vouch-from-request`, base `origin/master` `4ee38e82` (master had not moved at PR open, so no
merge-in was needed). Version **11.104.0**, re-derived from `origin/master` (11.103.0) at PR open; re-check at merge.
Executed inline with `superpowers:executing-plans`, all 13 tasks in plan order.

**Commits** (after the planning commits `b8fdbea9`, `d354ac77`, `f19f653b`): `87287c49` version → `0d69a39d` request
contract test (red) → `dc64b3a1` real-SQL integration test → `2f3a718e` `viewer_partners` → `b2b6010b` frontend tests (red)
→ `13599801` MemberSkills `endorsableOnly` → `c5b0bedd` panel + page → `47b44408` notification copy → `83228881` guides,
concept, onboarding, ADR-100 amendment → `6e9190f2` CONTEXT + registry → `6bfd785c` test promotion → `9ec22174` `/simplify`
→ `61b77daf` code-review fixes → `1b0a1dcc` landing regen.

**What the PR does:** `GET /requests/:id` returns `viewer_partners` (per completed match where the viewer is a participant;
`[]` for everyone else; scalar subquery inside the `requestReadableSql`-guarded statement; `completed_at` sent as a UTC
instant). The request page renders `CompletedExchangePanel` (rating via `RatingPrompt align="start"` +
`submitExchangeRating`, vouch via `MemberSkills endorsableOnly`, once per distinct partner). `submitExchangeRating` now
resolves `true` when the rating is on record (saved, or 409 already rated); DecisionBand/CommitmentsTab ignore it as before.
`match_completed` copy: "Exchange completed" / "Rate & vouch" in the template and `NotificationItem`. No migration, event,
queue or dependency change; `api.ts` untouched; lockfile changes are the 3 root version lines only.

**Test evidence** (TDD order held: tests red for the right reason before each implementation):
- `services/request-service/tests/regression/sprint-134-pr-b-viewer-partners.test.ts` (6, mocked SQL contract + wire
  shape): red 3/5 before `viewer_partners` existed (the 2 pass-through cases were green by the row spread, by design); the
  `completed_at` zone case red then green in the code-review fix.
- `apps/frontend/tests/regression/sprint-134-pr-b-completed-exchange.test.tsx` (20, the CLAUDE.md UI coverage table): red
  14/16 before the panel (the 2 "hidden" cases green by construction); the CTA case red then green; the 3 code-review cases
  (failed write, 409, in-flight double click) red 2/3 then green.
- `services/notification-service/tests/regression/notificationTemplates.test.ts` +2: red then green.
- `tests/integration/sprint-134-pr-b-viewer-partners.integration.test.ts`: **NOT RUN locally (no PostgreSQL on this Windows
  box); CI's integration job is its first run.** Exposure matrix (R → [B, A]; A, B → [R]; rejected helper, preferred
  provider, member → []; other-community → 404), the panel's exact rating payload through `POST /reputation/feedback`
  flipping only the rater's `rated_by_me`, `can_endorse`/`POST /endorsements` agreement both ways, exact `completed_at` instants.
  `tsc` on the tests project shows no diagnostics for it.
- `npm test` on `1b0a1dcc`: Turbo 27/27 (20 cached, 7 executed): request-service unit 161 + regression 452 (1 existing DB skip), notification 112, frontend unit 62 + regression 425, root unit 101 + regression 955; `npm test --workspace=tests` after the review fixes: unit 101/101, regression 955/955.
- Promoter: `.npmrc` `ignore-scripts=true` suppresses npm's `posttest`, so `npm test` never runs
  `scripts/promote-tdd-tests.js`; it was run by hand. It promoted 6 files; the 5 unrelated ones were restored to `tdd/`. It
  globs only `*.test.ts`, so the frontend `.tsx` test was moved to `regression/` by hand.
- Pre-existing, not this PR: `apps/frontend/tests/tdd/sprint-39-provider-ux`, `sprint-40-admin-connectors`,
  `sprint-85-unified-feed` fail 16/26 identically with every PR B change removed (WIP tdd tier, report-only).

**Gate dispositions:**
- **`/simplify`** (4 reviewers): fixed: one `isVouchable` helper (reuse + simplification), a single `endorsableOnly` guard
  (default-mode lines unchanged), `isNewestFor`. Skipped: per-row `rating_community_id` (wire shape is the spec's; ≤20
  index probes), `$2 IS NOT NULL` (forbidden by plan note 3), the double sort (the outer `ORDER BY` guarantees order),
  `useMemo`, folding `can_endorse` into `viewer_partners` (cross-service dependency). Altitude: the server's `ctaLabel` is
  never persisted, so the client switch is the only label users see, and `join_request` already disagrees; logged to
  `docs/IDEAS.md` 2026-10-28 (needs a migration).
- **`/code-review` medium → high** (medium found items in the projection, so escalated per the maintainer). 18 findings,
  13 distinct. **Fixed** (`61b77daf`, each red→green): "Thanks" shown on a failed rating write; a second POST while saving;
  zone-less `completed_at`. **False positive / by design**, with evidence: null `rating_community_id` is unreachable via
  app paths (`requests.ts:1796-1808`, `inventoryDb.ts:282`); Skip is per view (spec, maintainer); inner join on
  `auth.users` cannot drop a partner (FKs have no ON DELETE, `init.sql:6334, 6355`); `endorsableOnly` cannot hide a toggle
  error (a failed toggle leaves the list non-empty); panel on a BUG-074-reopened ask (those matches did complete; BUG-074 is
  its own PR). **PARTIAL:** `rated_by_me` under RLS: `dbContext` sets the community transaction-locally, so it never
  reaches route queries, and `requests.matches` has the same policy and is read on every detail call, so a role without
  RLS bypass would already break the app. Still **UNVERIFIED on demo**; CI real SQL + the human check below decide it.
  **Deferred minors:** the rating rule is duplicated with the dashboard `rate` decision; `isNewestFor` O(n²) (n ≤ 20); the
  vouch heading stays when every chip reads "Withdraw vouch".
- **`/security-review`:** no findings (partner exposure per exchange, unchanged server-validated writes, React-text
  rendering, bound parameters, viewer-only `rated_by_me`, no JWT claim reads).
- **process-reviewer:** PASS, no blocking issues. It noted that `services/notification-service/.claude/README.md` had not been read; it was then read (generic template, and its loops cover endpoints, dependencies, schema and events, none of which the copy change touches). The IDEAS note no longer says "provisional".

**Executor rulings** (full list in the PR body): the Task 2 fragment test slices the SELECT segment between
`AS viewer_match_status` and `AS viewer_partners`; a 6th fragment pins `pf.from_user_id = $2` (ADR-036); integration teardown
adds `trust_edges` and `reputation.trust_scores` (no ON DELETE CASCADE on `community_id`); `RatingPrompt` gained
`align`; the panel draws the spec's rule (`border-t`); docs: ADR-100 amendment appended with no status suffix and no
README index change; one extra sentence in the fulfilling guide's detail-page paragraph; stale `requester_email` dropped
from the CONTEXT example; `apps/frontend/.claude/API_CHANGES.md` does not exist (that loop step has no target).

**Human validation (maintainer, karmyq.com after deploy):**
1. As a requester, open a completed ask from the "Exchange completed" notification. The helper is shown. Rate once:
   "Thanks — ratings stay private." appears, and **after a reload the prompt does not return** (this is the demo-side
   `rated_by_me`/RLS check). Vouch for a skill and see the count.
2. As that ask's helper: only the requester is shown, never another helper.
3. As a community member who can read the ask: no panel.
4. A newly completed exchange's notification reads "Exchange completed" with the CTA "Rate & vouch".

**Carry-forward:** BUG-074 (separate PR); `docs/IDEAS.md` 2026-10-28 CTA-label follow-up; the CodeQL `/language:actions`
"Unknown Error" re-check on PR B's merge sha.

## Security lane transfer — 2026-10-28

**Assignment:** the maintainer gives Claude the next implementation lane and Codex the review.
One combined security PR, rather than separate dependency merges. No dependency work has started
in this checkout. Claude may switch only after Codex's handoff is pushed and `git status` is clean.

**First action:** fetch and reconcile master/open PRs, then cut
`agent/claude/sprint-134-security-followups` from `origin/master`. Preserve the doc-only commits
on `origin/agent/codex/sprint-134-pr-b-endorsement-followups` (starting with `4b0c6386`, PR V's
post-merge record) by cherry-picking that branch's doc-only commits not already in master, in order.
Inspect the range first; pause on cross-agent conflicts. This carries the release record and this
allocation onto the security branch without a docs-only push to master. Claude then owns this
handoff on its branch; do not start concurrent PR B edits in the shared tree.

**Approved implementation scope:**
- Move locked `node-forge` 1.4.0 to **1.4.2**. On 2026-10-28 the npm registry confirms 1.4.2
  exists, and the locked `@expo/cli` and `@expo/code-signing-certificates` both accept `^1.3.3`.
  The maintainer reports the 1.4.1 changelog fixes the signature forgery; that is a hypothesis
  until audit of the updated lock proves GHSA-86w9-cpqp-85rv is cleared. GitHub's advisory still
  reports `<= 1.4.0` with `first_patched_version: null` at this check.
- **Remove the node-forge exemption once that audit proof passes.** Removing an obsolete
  exemption is included in this scope; no separate sign-off or weekly renewal is planned.
  If the advisory remains, report the blocker; do not silently renew or dismiss it.
- Patch `ip-address` to **10.7.4 or later compatible fixed version**, and `fast-uri` to **4.2.3**.
  Prefer surgical lock edits; inspect #318's +3/−81 lock diff rather than adopting its removals
  without explanation. #318 remains a queued proposal; do not merge it as an additional deploy.
- Write up **deepmerge alert #178** for a maintainer decision by approximately **2026-11-11**:
  reported low severity, no fix, Expo/Jest tooling reach. Verify that reach and advisory state;
  preparing the decision is in scope, accepting risk or dismissing the alert is not pre-approved.
  Do not add a low finding to the high/critical exemption registry.

Deadline: **Sunday 2026-11-01 16:00 PST = Monday 2026-11-02 00:00 UTC** (DST ends that morning).
Use surgical manifest/lock splices, registry metadata/integrity and node-by-node diff checks,
strict `npm ci`, audit and the required local/CI gates. No scratch lock regeneration,
`npm install --workspace`, or unrelated dependency churn. Recheck the version against master.
Expo drift #316 still awaits its separate maintainer decision. Stop at PR creation for Codex
review; merging requires separate maintainer authorization. No demo-host operation is authorized.

**Product queue after security:** PR B makes vouching easier. Its plan must cover completed
matches (possibly several), expose partners only to the two participants of each exchange, and
offer a vouch prompt only for skills visible to that viewer and eligible at the endpoint. Request
read permission alone (including historical helper/preferred-provider access) does not establish
completed-partner status. The current detail projection only returns proposed/matched matches
(`services/request-service/src/routes/requests.ts:1633`); verify this again when planning.
Trust-history replay accuracy remains separate; actual measured drift would change priority.

## Security follow-up state (Claude, 2026-10-28)

**Post-merge (2026-10-28, recorded on the PR B branch; each fact re-read live): SHIPPED.**
- #322 merged by the maintainer as **`4ee38e82`** (v11.103.0) at **18:56:43Z**, after Codex review (no blocking findings).
  The merge tree equals branch head `1ecf1a05`'s tree.
- [CI/CD 40749793316](https://github.com/ravichavali/karmyq/actions/runs/40749793316) on `4ee38e82`: **14/14 jobs success**,
  including Security Audit, Code Scanning Gate, Integration Tests, 7 image builds and **Deploy to Demo**.
- **#318** (Dependabot fast-uri) auto-closed at **18:59:10Z**.
- **0 open code-scanning alerts** on `refs/heads/master`; **0 open Dependabot alerts**. `security/audit-exemptions.json` on
  master has `"exemptions": []`, so the 2026-11-01 16:00 PST node-forge deadline is met.
- **deepmerge #178 dismissed** `tolerable_risk` at **19:24:33Z** (maintainer chose option a). Re-check at the next Expo SDK
  move or **2026-12-01**, whichever comes first.
- **CodeQL quirk (open check):** of the two analyses for `4ee38e82`, JS/TS `2047995087` completed clean (467 raw results,
  no error), but Actions `2047990760` (`/language:actions`) carries `error: "Unknown Error"`. Its job (run 40749793642, job
  123033129566) succeeded and logs "Successfully uploaded results" (18:57:44Z) and "Analysis upload status is complete."
  (18:57:52Z), so the fault is GitHub-side. The earlier session found default-setup runs cannot be re-run; not retried here.
  It should clear on the next master push. **Re-check the Actions analysis for the PR B merge sha after it merges.**

Branch `agent/claude/sprint-134-security-followups` from `origin/master` `645d28fd`, **v11.103.0** (re-derived from
master's 11.102.0; re-check at merge time). Executed inline against *Approved implementation scope* above; the record is
the ADR-059 amendment "node-forge fixed upstream, exemption removed".

**What changed.** `security/audit-exemptions.json`: node-forge entry **deleted** (registry empty). Lock splice by a guarded
script (each old node had to equal its old registry `dist`; old and new manifests had to agree on dependencies, engines,
license, funding, bin, os/cpu/libc; no install scripts; key order unchanged; the guard was shown refusing a tampered
lock): `node-forge` 1.4.0 → **1.4.2**, `ip-address` 10.7.2 → **10.7.4** (first patched; 10.7.5 adds only a Teredo flag fix
plus test/dev-dependency changes), `fast-uri` 4.2.1 → **4.2.3**. Lock diff is exactly 11 lines (2 root version + 3×3
node fields); no `libc` field touched. Overrides: `node-forge >=1.4.2`, `ip-address >=10.7.4`, `fast-uri >=4.2.3` (bare
floors kept; selector conversion is IDEAS 2026-10-26; raising them loosens no dependent: `^1.3.3`, `^10.2.0`, and ajv's
`^3.0.1` was already overridden). `sprint-131-d9-security-overrides.test.ts`: new floor rows (floor and every locked
copy ≥ patched), red on the old floors, red again on the raised floors over the old lock, green after the splice.

**Proof.** Gate (`node scripts/audit-exemptions.js`, `--package-lock-only`): new lock + empty registry → 0 high/critical,
exit 0; **old lock + empty registry → BLOCKING node-forge GHSA-86w9-cpqp-85rv, exit 1** (the lock clears it, not the
deletion; and since the endpoint answered with that finding in the same session, the empty registry rests on valid
evidence, per the `adr-059-cannot-tell-no-answer-from-no-advisories` gotcha). Full audit: 18 findings (1 high, 5 moderate, 12 low) → 14 (0 high, 3 moderate, 11 low); what remains is
deepmerge (low) and decode-uri-component (BUG-041). Strict `npx -y npm@11.19.0 ci` exit 0, lock sha unchanged; `npm ls
--all` invalid/missing/UNMET multiset identical to the baseline (175 lines) and identical stderr; installed 1.4.2 /
10.7.4 / 4.2.3, all `overridden`. node-forge run, not read: a DigestInfo with an extra DigestAlgorithm element verifies
on 1.4.0 and is rejected on 1.4.2 (canonical accepted on both); vendor advisory GHSA-2g46-22mc-6gwp (CVE-2026-85393)
names 1.4.1 patched for the same defect; `@expo/code-signing-certificates` 0.0.6 keygen / PEM / self-signed validate /
sign+verify / CSR → dev cert all pass on 1.4.2, foreign issuer rejected. ip-address: `ipKeyGenerator`'s exact calls give
identical keys on 10.7.2 and 10.7.4 for 12 samples; the trigger (repeated `%` before a newline) is quadratic on 10.7.2
(244 ms at 20 kB) and flat on 10.7.4, but `node:net` `isIPv6` rejects it before `Address6`, so it was not reachable via
`packages/shared/middleware/rateLimit.ts:130` or cleanup-service's default key.

**Gates.** Commits: `3355b9ff` (change), `b1e7f503` (`/simplify`), `fdad5786` (`/code-review` fixes). `npm test`
27/27, 0 Turbo cached (tests workspace 101 unit + 955 regression) on the `3355b9ff` content; tests workspace re-run green
on `fdad5786`; drift + license gates 68/68. Process-reviewer: PASS (its ADR-index and SHA advisories applied).
`/simplify` (4 agents): shared `lockedCopies()` in the test, ADR proof moved to the PR body, IDEAS 2026-10-28
follow-ups; skipped a module-scope index (~3 ms). `/code-review` medium (8): fixed the floor rows' unclear failure on a
renamed key (injected: now `Expected path: ["node-forge"]`), the ADR's "loosens no range" (fast-uri already overrode
`ajv`'s `^3` since #156) and this file's deadline wording (merge + deploy, not PR open). Ruled, not changed:
fast-uri cross-major and unbounded floors are pre-existing and tracked (IDEAS 2026-10-26/10-28); the two test tables
stay separate (exact pins assert one hoisted copy equal to the pin); the moderate rows pin deliberate decisions, and the
general mechanism needs an ADR-059 amendment; sprint-123's per-exemption loops are vacuous over the empty registry by
design (as 2026-09-09 → 10-01), and the gate still fails closed on unavailable evidence. `/security-review`: **no
findings**. It re-verified registry URL/integrity/tarball SHA-512 for all three nodes, publishers (node-forge by its
long-standing maintainer, no provenance, as for every earlier release; the other two with provenance), no install
scripts, no new runtime `child_process`/`net`/`fs`/`eval` in the package diffs, a 4-node lock diff, empty-registry
fail-closed (unreachable registry → `INVALID_AUDIT`) and master's lock blocked.

**Codex review (2026-10-28, at `4697cc50`): no blocking findings.** Codex checked: 21 CI checks passed with the PR deploy skipped as
expected; 103 focused tests passed (`--no-cache`; sprint-131 overrides, sprint-128 audit contract, sprint-123 exemption gate,
sprint-75 security gate); the live gate showed 0 high/critical with no exemptions; master's old lock in a temp dir with an
empty registry was **blocked** on GHSA-86w9-cpqp-85rv; registry URL/integrity/dependencies/engines matched for all three
nodes; the lock diff covers only those nodes plus the root version; and on 1.4.2 a canonical signature verifies, an extra
DigestAlgorithm element is rejected, and Expo keygen, certificate validation and sign+verify pass. It judged the broad
floors and the fast-uri major mismatch as pre-existing and documented. Merge state was `BLOCKED` only on required approval.
Codex asked the maintainer "Admin merge, yes/no?" (standing rule: `--admin` needs explicit authorization each time; the
classifier may refuse Claude's merge, in which case the maintainer runs it). After the merge, the next chat does the
deploy check, a CodeQL master re-check, #318 closure and the post-merge record. deepmerge #178 is untouched.

**#318 (Dependabot fast-uri) not used:** besides the bump it deletes 26 `libc` fields from `sharp`/`@img` platform
binaries (the musl selection the Alpine images need). It should auto-close once master carries 4.2.3; if not, close it
with a pointer to this PR.

**deepmerge #178 — decision for the maintainer (target ~2026-11-11). DECIDED 2026-10-28: option (a), dismissed
`tolerable_risk` at 19:24:33Z (see *Post-merge* above). The write-up below is the pre-decision record:**
GHSA-gcqx-w48m-w2h4, low, `>= 4.2.0 <= 4.3.1`, no patched version; 4.3.1 is the latest release (no newer line exists).
Advisory published 2026-09-18, updated 2026-10-27 21:35Z; the alert opened on PR V's master push. Defect:
`mergeObject()` lets a malicious *source* object poison the returned object's prototype. Reach, verified with `npm ls
deepmerge --all`: one copy, 4.3.1, via `apps/mobile` → `expo` 57.0.31 → `@expo/config` 57.0.10 (merges developer-authored
app config and plugin props, `build/Config.js:415,453`) and `tests` → `jest-cli` → `jest-config` (dev). No repo source
imports it; no service depends on either chain. Untrusted input does not reach either merge (UNVERIFIED by bundle
inspection that `@expo/config` stays out of the device bundle; it is Node-side tooling). Options:
- **(a) Recommended: dismiss as `tolerable_risk`** with a comment and a re-check date, the alert #150 / BUG-041
  precedent. Suggested re-check: the next Expo SDK move or 2026-12-01, whichever comes first.
- (b) Leave it open until upstream ships a fix. Honest but lets the two-week SLA lapse with no action available.
- (c) Replace or patch deepmerge (override to a fork). Not recommended: it changes Expo's and Jest's config merging
  for a low with no untrusted input.
ADR-059's gate reads only high and critical, so no registry entry is needed under any option.

**Rulings for the maintainer:** none beyond the deepmerge choice. `decode-uri-component` GHSA-vcc3-ghjq-m6fr stays
BUG-041 (dismissed #150; re-check by 2026-11-14): 0.5.1 (2026-10-23) is still ESM-only (`"type": "module"`, no `require`
export), so the blocker is unchanged.

## Spec and plans

- Spec: [`docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md`](../../docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md)
- PR B spec: [`docs/superpowers/specs/2026-10-28-sprint-134-pr-b-vouch-from-request-design.md`](../../docs/superpowers/specs/2026-10-28-sprint-134-pr-b-vouch-from-request-design.md)
- PR B plan: [`docs/superpowers/plans/2026-10-28-sprint-134-pr-b-vouch-from-request.md`](../../docs/superpowers/plans/2026-10-28-sprint-134-pr-b-vouch-from-request.md)

## PR sequence

| # | PR | Scope | Due | Plan | Status |
|---|---|---|---|---|---|
| 0 | **F** | follow-redirects 1.16.0 → 1.16.1 (GHSA-q3jh-wrc6-jgq8 + GHSA-8r9p-f939-6h3c, high, published 2026-10-20); one-node splice; v11.93.0 | high SLA 10-27 | spec *PR F* | **SHIPPED** `63a6cd26` (#310), CI/CD 39516935342 green |
| 1 | **A** | BUG-063: repair every export query against the live schema | **2026-10-24** (target merge 10-22) | [`plans/2026-10-20-sprint-134-pr-a-bug-063-export.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-a-bug-063-export.md) | **SHIPPED** `bf524296` (#311, v11.94.0), CI/CD 39666220132 green. Human validation (Task A12) pending: maintainer downloads all three exports on karmyq.com. See *PR A state* below |
| 2 | **E** | Expo SDK 57 patch (#279) + drift-workflow silent-failure fix | — | [`plans/2026-10-20-sprint-134-pr-e-expo-patch.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-e-expo-patch.md) | **SHIPPED** `eea83267` (#312, v11.95.0), CI/CD 39711848936 attempt 2 green. See *PR E state* |
| 3 | **D** | `verify:demo` loads `DEMO_ENV_FILE`, else the repo-root `.env.demo` | — | [`plans/2026-10-20-sprint-134-pr-d-verify-demo-env.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-d-verify-demo-env.md) | **SHIPPED** `866857ed` (#313, v11.96.0), CI/CD 39797190307 green. Human validation (Task D8) pending; see *PR D state* |
| — | **N** | `next` 16.3.8 → 16.4.2 (GHSA-2464-fhr4-w9xw critical RCE + GHSA-p3m5-59mp-jv5r high, published 2026-10-22 15:52Z); 10-node splice; v11.97.0 | critical: blocks every PR now | *PR N state* below | **SHIPPED** `0321c415` (#314, v11.97.0), CI/CD 39853173679 green |
| — | **X** | **Security PR (overdue, blocks every push and CI):** remove the braces exemption (advisory withdrawn 2026-10-23); renew node-forge; fix the new highs in body-parser, undici and zod; make the audit validator accept npm's inconsistent severities. See *Security PR X findings* | exemptions **expired 2026-10-26 00:00Z** (10-25 17:00 PDT) | *Security PR X findings* below | **SHIPPED** `e15622bc` (#317, v11.98.0), CI/CD 40410093954 green |
| 4 | **L** | ADR-101 legacy handlers + BUG-068 code (no migration) | **2026-10-29** | [`plans/2026-10-20-sprint-134-pr-l-legacy-handlers.md`](../../docs/superpowers/plans/2026-10-20-sprint-134-pr-l-legacy-handlers.md) | **SHIPPED** `ff3f394e` (#315, v11.99.0), CI/CD 40417261628 green; post-deploy queue check PASS. See *PR L state* |
| 5 | **L2** | Migration: drop `interaction_feedback` + 7 dead average columns; update readers, numeric widths and nightly isolation; **BUG-070** | BUG-070 **2026-11-03** | [plan](../../docs/superpowers/plans/2026-10-27-sprint-134-pr-l2-drop-feedback-schema.md) | **SHIPPED** #320 `47c9a323` (v11.101.0), CI/CD 40579675258 green; nightly human validation pending. |
| 6 | **K** | BUG-069: admin writes re-derive live role (**ADR-102**, allocated 2026-10-20) + BUG-071 (found by K's inventory) | **2026-10-30** | [`plans/2026-10-22-sprint-134-pr-k-live-admin-role.md`](../../docs/superpowers/plans/2026-10-22-sprint-134-pr-k-live-admin-role.md) | **SHIPPED** `dd585016` (#319, v11.100.0), CI/CD 40441255956 green; real SQL 101/101. Human validation pending; see *PR K state* |
| 7 | **V** | PR V read-boundary follow-ups (`docs/IDEAS.md` 2026-10-19) | — | [plan](../../docs/superpowers/plans/2026-10-27-sprint-134-pr-v-read-boundaries.md) | **SHIPPED** #321 `645d28fd` (v11.102.0), CI/CD 40631196261 green 14/14; 9 healthy; 0 open master CodeQL alerts. Human checks pending. |
| — | **Security follow-up** | node-forge 1.4.2 + exemption removed; ip-address 10.7.4; fast-uri 4.2.3; deepmerge decision write-up | **2026-11-01 16:00 PST** | *Security follow-up state* | **SHIPPED** `4ee38e82` (#322, v11.103.0), merged 18:56:43Z; CI/CD 40749793316 green 14/14 incl. deploy; 0 open code-scanning / Dependabot alerts; deadline met. |
| 8 | **B** | Vouch from a completed exchange (`docs/IDEAS.md` 2026-10-13 "Vouch from the request page") | — | [plan](../../docs/superpowers/plans/2026-10-28-sprint-134-pr-b-vouch-from-request.md) | **OPEN, awaiting Codex review / maintainer merge** ([#323](https://github.com/ravichavali/karmyq/pull/323), v11.104.0) on `agent/claude/sprint-134-pr-b-vouch-from-request`; gates done; integration matrix CI-only. See *PR B state*. |
| 9 | **C** | Scheduled exemption re-check evidence (treadmill a) | — | write at PR start | — |
| — | **Per-community health-quality weight (planned PR)** | Persist the weight in `communities.community_configs`; choose a quality signal source; requires an ADR number allocated by the maintainer | Not scheduled | Write after ADR allocation + signal decision | Separate planned PR, not part of L2 |

B and C are the likeliest to spill into Sprint 135, which is expected. One merge at a time; wait for deploy + health before the next.

## PR V state (Codex, 2026-10-27)

**Post-merge, 2026-10-28 UTC:** #321 merged as **`645d28fd` (v11.102.0)** at **04:14:22Z**.
The maintainer independently checked `a3686009`, accepted the existing Codex gate-equivalent
passes plus the independent reviews, and explicitly approved an admin merge. Executed once as an
admin squash with `--match-head-commit a3686009ce78b8ba96cc0a2b901cf38edd47c9ec`.
All checks were green at that head; PR deployment was skipped. Master was `47c9a323` / 11.101.0,
and its prior deploy had completed successfully.

**Deploy verified:** [CI/CD 40631196261](https://github.com/ravichavali/karmyq/actions/runs/40631196261)
completed successfully on `645d28fd`: **14/14 jobs**, "DEPLOYMENT SUCCESSFUL" at
**2026-10-28 04:31:37Z**; the final health check passed at **04:31:53Z** for auth, community,
request, reputation, notification, messaging, cleanup, geocoding and social-graph. Failure
notification skipped (no rollback). Post-deploy public GET `https://karmyq.com/` returned
**200, text/html**. This is automated deployment/health proof, not completion of the human checks.

**Master CodeQL verified after deploy:** **0 open alerts** on `refs/heads/master`. Both analyses
for merge SHA `645d28fd3218be463bf8f77ffe76dc8277d80b6b` completed with no error or warning:
JS/TS analysis **2042197326** (467 raw results) and Actions analysis **2042193650** (0 raw results).
Raw analysis results are separate from the open-alert query. No alerts were dismissed.

**Human validation remains pending after automated health verification:**
- Requester edit/cancel/privacy succeeds; foreign/missing IDs yield the same 404.
- Departed helper and preferred provider retain reads; outsiders cannot read community-only or
  directed asks. Check demo page contents, scoped community notes and offer consent behavior.
- L2: inspect reputation logs after the first 02:00 nightly run. Deploy health does not prove it.

**Next branch (superseded 2026-10-28; see *Security follow-up state*):** `agent/codex/sprint-134-pr-b-endorsement-followups` from `origin/master` `645d28fd`.
The first commit is this post-merge record (handoff + PR V plan), with no runtime/dependency/version/schema change. No B
implementation, ADR allocation or future version reservation is made. Claude retains the dependency
lane and its PR due before **2026-11-01 16:00 PST (2026-11-02 00:00 UTC)**. #318 is a queued
proposal (fast-uri, due 11-06); the maintainer now assigns its fix to Claude's combined security
PR above. #321's authorization does not authorize any further admin merge.

The sections below are the **pre-merge implementation/validation history**. Current release state
is the post-merge record above; the PR's Validation ledger links the green 291-case SQL run.

Branch `agent/codex/sprint-134-pr-v-read-boundaries`, from `origin/master` `47c9a323`.
First commit `1721dc5f` is the #320 post-merge record. Root version **11.102.0** is provisional;
manifest/lock edits are only its three root version occurrences. Dependency lane stays Claude's,
with a dependency PR due before **2026-11-01 16:00 PST (2026-11-02 00:00 UTC)** (timezone corrected
2026-10-28). No merge/deploy requested or performed at that implementation checkpoint.

Plan: [2026-10-27-sprint-134-pr-v-read-boundaries.md](../../docs/superpowers/plans/2026-10-27-sprint-134-pr-v-read-boundaries.md).
Implemented: identical foreign/absent 404 on request update/cancel/privacy (including guarded
mutations and no events on vanished row), detail on requestReadableSql, one liveRole membership
helper with community-first arguments, paged candidate CTE before aggregation. Existing directed
inventory scan recognizes the canonical read helper, with alias/OR negative fixtures; six reviewed
owner-write hashes were re-pinned to stronger id+JWT-owner SQL. Context/registry/guide and landing
source-generated docs updated. Supporting simplify/correctness/security and migration review found
no source blocker; the review's missing-predicate assertion gap was fixed with an exact-fragment check.
The external PR review found no source defects; Claude retains merge-readiness authority.

**Scope resolved by the maintainer's checkpoint review (2026-10-27):** defer the pair index pending
EXPLAIN on representative data; remove its migration and index assertion. Retire `help_offers.is_public`
from `PUT /offers/:id/privacy` input/response/event; keep consent behavior and the inert column until
a later schema PR. Flag-only owner body returns 400; mixed input updates consent only; foreign/absent
remains 404 before validation. **No infrastructure diff against origin/master and no demo-host step.**
Both deferred schema items are in IDEAS. No host operation or dependency edit beyond version occurred.

**CI correction:** `.github/workflows/ci.yml:320` runs the migrated-schema drift proof before any
integration test. The checkpoint's new migration with old init.sql would block **every database
case**, not just the index assertion. Removing the migration restores a schema-consistent CI input;
it did not itself establish a SQL pass. The first PR CI then passed schema drift and executed the
SQL suites (evidence below). Local tests prove wiring/projections; durable allowlist reasons name
the real-SQL coverage file rather than carrying a temporary CI status. Mocked detail tests no longer
claim preferred-provider or historical-responder audience proof; the real-SQL matrix exercises it.

**Validation checkpoint (implementation working tree over `1721dc5f`):** new workspace tdd suite failed before implementation, passed 17/17 and
was promoted to regression. Focused provider/query tests passed 49/49; focused detail/retention/new
suite passed 40 with 1 pre-existing DB skip; scanner/body-identity passed 12/12. Service tsc passed.
Root strict compiler changed request-service/integration-path filter printed nothing; unrelated
root diagnostics remain. Added real-SQL owner-write, multi-community page/notes and offer privacy assertions
to the existing root matrix: **CI-only, not run locally**. Full `npm test` passed **27/27 tasks**
(24 cached; request-service and root tests fresh). Request-service: **161 unit + 443 regression,
1 existing DB skip**. Direct root tests with Git Bash/Unix utilities on PATH passed **101 unit +
952 regression** (no Turbo replay). Earlier unconfigured/restricted invocations failed shell/network
gates; the configured reruns supersede them. Exact strict compiler/grep command printed no matching
diagnostics (grep exit 1); gotcha registry clean. Final focused suite (including the strengthened
predicate-presence assertion) passed **17/17**. Staged feedback exited 0 with advisory reminders:
context/registry/guide updates were present; the then-pending schema is now explicitly deferred;
dependency graph is unchanged. Whitespace clean. Mandatory process review approved
a clean WIP commit/push, explicitly **not completed-PR or merge readiness**. The checkpoint records
the two unanswered inputs so Claude can take the shared tree without uncommitted WIP.
Those results predate the final review response and are not final validation of its offer changes.
New offer privacy tests failed 3/4 before implementation, then passed; targeted run with detail
tests passed 23/23 before removal of the redundant provider projection test; the final targeted
run passed **22/22**. Final review-response working tree over `b801152d`: `npx turbo run test --force`
exited 0, **27/27 tasks, 0 Turbo-cached** (Jest cache retained); request-service **161 unit + 446
regression, 1 existing DB skip**; root tests **101 unit + 952 regression**. Service tsc exit 0;
strict changed-path filter empty (grep 1), gotcha13 clean, staged feedback exit 0 (advisory docs
already updated), whitespace clean. Three separately delegated Codex equivalents of the named
simplify/code-review/security-review gates completed: correctness/security clean; simplify's
dead fixture/misleading test claims fixed. Native Claude slash runner was not invoked. Optional
DELETE lookup and single-field UPDATE-builder cleanups are deferred. Exactly 13 root scratch logs
removed; new logs are in TEMP. No source blocker from mandatory process review; full-suite
condition then satisfied. Real SQL was pending at that pre-PR checkpoint; the first CI observation
and fixture-only correction are recorded below. No merge readiness is inferred from local tests.

**Committed-head recheck, `83c2713e`:** direct `npm test --workspace=services/request-service`
passed **161 unit + 446 regression, 1 existing DB skip**; direct `npm test --workspace=tests` passed
**101 unit + 952 regression**. No Turbo replay for either; Jest cache retained. Service run emitted
a worker-teardown warning despite exit 0. Service tsc exit 0, exact root strict changed-path grep
empty (grep 1), infrastructure diff against `origin/master` empty (exit 0). Latest master is still
`47c9a323` / 11.101.0 at that check; PR V's 11.102.0 remains provisional at merge time. Initial PR
head `4ee149a2` added only handoff/plan metadata after `83c2713e`. The later fixture-only follow-up
does not change runtime code. The PR's Validation ledger carries commands/cache/limitations.

**Initial integration run, `4ee149a2`:** [CI/CD 40606348153](https://github.com/ravichavali/karmyq/actions/runs/40606348153/job/122547850473)
passed schema drift (no changes after replay), then **289/291 tests passed, 2 failed** (17/19 suites).
Both failures were tests: the root identity test still expected403 for foreign cancellation; the
pagination fixture made outsider X an OTHER member and shared the newest asks with OTHER. Root
expectation now requires404, and pagination's second community/note/aggregate expectation use FAR,
where X is not a member. The earlier CTE/admin-note/multi-community/sister assertions, audience
matrix, all owner writes and offer privacy cases passed against PostgreSQL. A green CI run of the
fixture correction is required; see the live PR Validation ledger rather than assuming its result.
No runtime source/version/schema changes in this follow-up. Stable coverage wording and the
claim-gate comment are corrected; generated service docs follow CONTEXT.

**Fixture follow-up local validation (worktree over `4ee149a2`):** `npm test` exit 0, **27/27 tasks**
(22 Turbo-cached; request/root test tasks executed). Strict root compiler changed-path filter is
empty (grep 1), gotcha13 clean, staged feedback exit 0 and whitespace clean. Focused process and
fixture correctness review found no blocker. No production source/version/schema diff relative
to `4ee149a2`. Real-SQL symptom proof for the corrected assertions is the follow-up CI result in
the PR Validation ledger; no local DB execution is claimed.

**Record validation:** local `npm test` passed **27/27 tasks** (26 Turbo-cached; root tests executed,
101 unit + 952 regression) on the record worktree over `645d28fd`; Jest cache retained. Final
post-deploy edits only add verified release metadata. Staged feedback/whitespace/process review
close before committing; normal pre-push hooks verify the pushed record. There is no master push.

**Next action (done 2026-10-28; see *Security follow-up state*):** transfer the clean, pushed tree to Claude for the combined security PR; Codex
reviews. Follow *Security lane transfer* above. PR B planning follows security in a fresh chat.
Keep human checks open. The merge slot is free after successful health verification; no further
merge is authorized by #321's approval.

## PR L2 state (Codex author/executor, 2026-10-27)

**Post-merge: SHIPPED.** #320 merged `47c9a323` (v11.101.0) at **2026-10-27 20:37:13Z**.
[CI/CD 40579675258](https://github.com/ravichavali/karmyq/actions/runs/40579675258) passed **14/14 jobs**;
deploy and health check passed, "Notify on failure" skipped (no rollback), **0 open CodeQL alerts on master**.
BUG-070 is fixed and deployed before **2026-11-03**. **Remaining human validation:** inspect reputation
logs after the first **02:00 nightly run** for community trust recalculation, milestone batch and the
feed's transition from empty scores to computed scores. Do not mark that validation complete from deploy health alone.
The review/CI notes below describe the pre-merge history, not current PR state.

**Pre-merge history:** Initial implementation `7f0606d5` and documentation checkpoint `239c6c79` were
pushed. The maintainer's confirmed quality-weight follow-up supersedes their score expectations and
changes code, tests, docs and two strict-null checks, with no migration/init.sql change. See the PR's
[Validation ledger](https://github.com/ravichavali/karmyq/pull/320#validation) for the latest tested
commit, commands, cache and limitations; earlier 27/27 results predate this weighting correction.
**Historical review checkpoint:** Claude was to confirm the asymmetric-weight test amendment and
latest CI before recommending a merge. That checkpoint is superseded by the shipped record above.
CI had passed at implementation head `cd81ea3b` before the later test amendment.

**Review test amendment (2026-10-27):** CONFIRMED: the existing w=0.4 examples used activity,
density and quality all equal to 50, so they did not distinguish weighting formulas. Both suites
now also assert unequal activity 50, density 100 and quality 80 at w=0.4 produce 72; the feed label
is Strong. Existing rows remain. New cases started in each workspace's tests/tdd, failed with a
temporary ignored-weight mutation (66.67 reputation / 66.7 feed), then passed against the restored
production bytes and were folded into the existing regression suites. Only tests and this handoff
change; production code, migration and init.sql remain unchanged. See the PR Validation ledger for
the exact tested/pushed head and cache details. Latest CI and review confirmation were pending at
that checkpoint. The post-deploy first 02:00 run still needs human validation, as recorded above.

**CI follow-up (maintainer reported failure, 2026-10-27):** head `4db4fa6f` passed local unit/regression
but [Integration Tests failed](https://github.com/ravichavali/karmyq/actions/runs/40565448245/job/122407295038):
18 suites / 274 cases passed; all nine L2 cases stopped in their shared setup with
`inconsistent types deduced for parameter $3`. The status INSERT/comparison parameter in
`tests/integration/sprint-134-pr-l2-health.integration.test.ts:34` now has explicit `varchar` casts,
matching `requests.matches.status` in `infrastructure/postgres/init.sql:2487`. No production code,
migration or schema changes. This corrects fixture setup; cron/fallback assertions did not execute
on that CI head. The correction was pushed as `cd81ea3b`.

**CI verified after the maintainer reported completion (2026-10-27):** all checks passed at
`cd81ea3b` (deploy skipped for the PR). [Integration Tests](https://github.com/ravichavali/karmyq/actions/runs/40567960729/job/122415775045)
passed 19/19 suites and 283/283 cases, including all nine L2 cases, then 2/2 curated-reset cases.
This proves the repaired fixture, fallback, nightly snapshot/cache, density 12, growth above 1000%,
all six community snapshots and same-day upsert against real PostgreSQL. Schema regeneration,
security audit, code scanning, unit/regression, frontend, landing and Docker checks also passed.
This follow-up changes only this handoff; the PR Validation ledger identifies the tested code head
and later documentation checkpoint. Independent Claude reviews and maintainer merge were pending
at that checkpoint; the shipped record above supersedes it.

Plan: `docs/superpowers/plans/2026-10-27-sprint-134-pr-l2-drop-feedback-schema.md`.
BUG-070 was included, due **2026-11-03**, and is now deployed. Root version **11.101.0** shipped.
Post-merge live check: only Dependabot #318 open; dependency lane stays Claude's.

**Confirmed maintainer decision (2026-10-27):** the tunable parameter is the named quality weight w,
clamped to [0,1], default 0. Both surfaces compute `(1-w)*(2*activity+density)/3+w*quality`.
At w=0, activity/density split the full weight 2:1 and can reach 100; w=0.4 recovers the historical
40/40/20 mix. Existing activity definitions, participant-count semantics and density cap of 100 stay.
Feed density 12 with 50/75 matches returns 100 / Thriving; 25 matches/density 0.5 returns 50 / Growing.
Reputation (10,4,0.5) returns 50; real-SQL C=20.00, D=42.22, DENSE=40.00. This supersedes the earlier
default-zero quality-score interpretation and 60-point ceiling; the decision is no longer open.
There is no HTTP override, persisted weight or newly selected quality signal in L2. The same push
fixes strict-null rowCount comparisons in healthMetricsService/milestoneDetector. The requested
tests-project compiler filter is empty; the two reported errors are removed, with 70 unchanged
unrelated existing diagnostics remaining. Migration/init.sql are unchanged by this follow-up.

**Separate planned PR — per-community health-quality weight:** persist w in
`communities.community_configs`, with its own design/plan and quality signal source. The maintainer
must allocate the ADR number before that work starts. No ADR number or implementation is self-assigned.

**Authorized schema operation PASSED:** original generator, strict L2 migration reapply twice,
full-chain drift check, fresh restore and byte-identical regeneration. One migration drops the
retired table/seven columns and widens four fields (NUMERIC(20,4)/(20,2)). No hand edit to init.sql.
Generated artifact SHA256: `9334956d0477ffeb3b50f60f0af5aaf1e6194f6db9e19193a87a31fca4ce13e4`.
The separate scratch PostgreSQL 15 container/directory were removed; no live DB/volumes were used.

Validation and own simplification/correctness/security findings/rulings are in the PR's **Validation**
and **Quality gates** sections. Local pre-commit and pre-push results must be reconciled there against
the actual final commit. Tests started in workspace tests/tdd and are promoted to regression.
**CI Integration Tests is the real-SQL health-cron/fallback arbiter** on this Windows box; all nine
cases passed at `cd81ea3b` in the linked CI run, and were not run locally. E2E seeds were
schema-inspected, not executed by the L2 suite.
At that checkpoint Claude's independent review was pending; the author's own passes do not replace it.

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

## PR N state (2026-10-22, #314)

Found by this chat's exemption re-check: `audit-exemptions` exit 1, `BLOCKING (critical): next`. GHSA-2464-fhr4-w9xw (critical,
unauthenticated RCE in the Image Optimization API with SVG) and GHSA-p3m5-59mp-jv5r (high, Server Actions DoS), both
`>=16.0.0 <=16.4.0`, first patched 16.4.1, published 15:50–15:53Z 2026-10-22 (after #313's deploy). No 16.3.x backport.
**Not reachable on the demo** (traced in `/code-review`): the RCE is the `sharp`/libvips bug on glibc (workaround `sharp >= 0.35.5`;
the lock has had 0.35.5 via the `sharp@<0.35.5` override since #299) and the frontend image is `node:24-alpine`; the DoS needs App
Router + a Server Action, and neither app has one (no `'use server'`; frontend is Pages Router, landing is App Router as a static
export, so it has no server runtime; corrected after Codex review of #314). The bump is still required: the gate audits presence
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

**Codex review (2026-10-22, at `0efa187d`): no blocking findings; ready for maintainer merge.** It verified all 10 nodes against
npm's hashes and dependency metadata (no unrelated nodes), 585 local tests, and green head CI (run 39835152925: security,
integration, app builds, Docker). Its one P3 (the ADR said both apps use the Pages Router; landing is App Router as a static
export) is fixed in the ADR, the regenerated page, this file and the PR body; the conclusion is unchanged.

**Post-merge (2026-10-22, recorded on the PR L branch):** admin-merged `0321c415` (v11.97.0). CI/CD 39853173679: 14/14 jobs
green; the Deploy to Demo log shows `▲ Next.js 16.4.2 (webpack)` for both app builds, "All critical services healthy",
"DEPLOYMENT SUCCESSFUL", and the health step lists all 9 services healthy; "Notify on failure" skipped (no rollback). 0 open
code-scanning alerts on master. No browser smoke was run (the build log is the evidence the maintainer asked for).

## PR L state (2026-10-22; SHIPPED 2026-10-26)

Executed inline (`superpowers:executing-plans`) on `agent/claude/sprint-134-pr-l-legacy-handlers` from `origin/master` `0321c415`,
**v11.99.0** (re-bumped 2026-10-26 from `origin/master` 11.98.0, which #317 took). **SHIPPED as #315 `ff3f394e`** (steps 4–6
below).
**Codex review at `9c57a866` (2026-10-22): no blocking findings.** CI green, including all three changed integration suites (174
tests passed; 60/60 notification jobs delivered, zero failed attempts; run 39863929755). Codex agreed with deleting the GET route and
with accepting the simulation mix shift without retuning.
**Admin merge APPROVED by the maintainer (2026-10-22 23:10Z), to run only after the renewal.** The maintainer chose "after the
renewal" over "now". Sequence for that chat:
1. Confirm the renewal PR merged and its deploy and health verify finished.
2. Update this branch from `origin/master` with a merge commit (no rebase). Resolve the handoff conflict: both PRs carry the #314
   record.
3. Re-bump to the next free version and re-run the gates (`npm test`, `npm test --workspace=tests`, `tsc` on the touched workspaces).
4. Ask the maintainer to run the read-only check on both retired queues, right before the merge (Codex recommendation).
5. Run `gh pr merge 315 --squash --admin` once. If the classifier refuses it, hand over the command.
6. After the deploy, run the same queue check again.

**Steps 1–3 done (2026-10-26, after #317):**
1. #317 merged `e15622bc` 22:08:24Z; CI/CD 40410093954 green, deploy and health verify finished (all 9 healthy, no rollback), 0
   open CodeQL alerts on master (*PR X state*, post-merge).
2. Merge commit `6439cb50` (parents `2748420e` + `e15622bc`, no rebase). Conflicts only in this handoff (master's side taken;
   every line only PR L had was superseded by it) and `docs/IDEAS.md` (both sides appended; kept both in date order).
   `package.json`/`package-lock.json` auto-merged byte-identical to master. Proof the merge left PR L untouched: for all 56 other
   files, the `+`/`-` lines of `git diff origin/master HEAD` equal those of PR L's original `git diff 0321c415 2748420e`.
3. Re-bump `879b51f3`: 11.98.0 → **11.99.0** (`package.json` + the lock's two root entries; the only places PR L wrote it).
   Gates on `879b51f3`, against an installed tree already on #317's versions (body-parser 2.4.0, undici 7.30.1, zod 4.6.6, qs
   6.16.1, no nested `@expo/cli` zod): `turbo run test --force` **27/27, 0 cached**, exit 0. That covers the `tests` workspace
   (101 unit + 935 regression), request (161 + 405, 1 pre-existing DB skip), notification 110, reputation 5 + 290,
   social-graph 12 + 173 and simulation 205. `tsc --noEmit` clean ×6 (shared, notification, reputation, social-graph, request,
   simulation). Landing-docs churn reverted. `/simplify`, `/code-review` and `/security-review` were not re-run: PR L's
   diff is byte-identical to the reviewed one.

**Steps 4–6 done (2026-10-26).** Facts verified in the merging chat; the merge, run, analysis and alert state were re-checked
live in PR K's chat the same evening (`gh pr view 315`, `gh run view 40417261628`, the code-scanning API):
4. Pre-merge queue check: run by the maintainer on the demo host; the numbers were not kept.
5. **Admin-squash-merged as `ff3f394e` (v11.99.0) at 2026-10-26 23:05:13Z**, on the maintainer's explicit authorization.
   CI/CD 40417261628 green, 14/14 jobs. Deploy job: "All critical services healthy", "DEPLOYMENT SUCCESSFUL", the health
   step lists all 9 services healthy, "Notify on failure" skipped (no rollback). **CodeQL:** the master analysis for `ff3f394e`
   exists (`javascript-typescript`, 467 results; 468 at `e15622bc`); 0 open alerts on `refs/heads/master`. **No re-raise:**
   all 18 `services/simulation-service/src/api-client.ts` alerts kept their numbers and dismissals, including
   #539/#554/#555/#556/#561 on the lines PR L moved up 11 (same line text). The expected re-raise did not happen, for the same
   reason as #313: the flagged line text did not change.
6. **Post-deploy queue check (maintainer, demo host): PASS.** On both `karmyq-events` and `karmyq-events-reputation`,
   `wait`/`active`/`paused`/`delayed` are all 0 and every key's `TYPE` is `none`. No worker on either (Bull client names
   `bull:a2FybXlxLWV2ZW50cw==` and `bull:a2FybXlxLWV2ZW50cy1yZXB1dGF0aW9u`). Positive control: the same grep found
   `karmyq-events-notification`'s worker at 172.18.0.18 (`karmyq-notification-service`), so the empty result is real.

**Still open from PR L (not done):** delete the inert `bull:karmyq-events:*` and `bull:karmyq-events-reputation:*` keys
(`docs/IDEAS.md` 2026-10-22). It is a separate demo data operation: it needs its own authorization and a dry-run key listing first.

**What changed.** The three subscribers no longer open `karmyq-events`; `match_completed` arrives only on each completion queue.
`startConsumerQueue` loses `legacyQueue`. `interaction_feedback_submitted` is retired, so `EVENT_CONSUMERS` is `['notification']`
and reputation starts no consumer queue (decision 1, recorded as an ADR-101 amendment). request-service `routes/feedback.ts`
(POST **and** GET `/matches/:id/feedback`) is deleted with its mount and three allowlist entries; the simulation's
`submitFeedback` action goes too. The BUG-060 integration file keeps only its mechanism half; the PR Q test narrows to
notification (decision 2) and asserts no worker on `karmyq-events` or `karmyq-events-reputation`. The event gate now fails on
any hard-coded `karmyq-events*` literal in code (TypeScript-parsed), a consumer queue opened outside its own service, and
registrations (merged across files) that differ from the service's routes. No migration (L2 drops the data).

**L1 inventory found what the File Map missed:** notification's `export default eventQueue`; three notification tests indexing
`karmyq-events`; the `directedSurfaceAllowlist.json` entries; `sprint-132-match-participant-scope` and the
`sprint-132-security-authz` integration probe of the GET route; the simulation workflow, weights, type and comment pool;
`claude.md` and `ARCHITECTURE.md` naming the reputation queue; `sprint-131-dotenv-quiet` pinning request-service `index.ts:36`
(now 35).

**Rulings for the maintainer:**
- **GET `/matches/:id/feedback` is deleted too** (the spec's API table named only POST). It read only the table the failing POST
  never wrote, and no client called it.
- **The simulation mix shifts.** With `submitFeedback` gone, each affected profile's other actions fire ×1.063–×1.115 as often
  (the sim runs on the demo under PM2). No weight was retuned; the removed action never wrote anything.
- **The simulation now never rates** (it never did successfully). Rating via the live `POST /reputation/feedback` is an idea
  (`docs/IDEAS.md` 2026-10-22), not done.
- The demo-data guide and trust concept no longer say ratings are helpfulness/responsiveness/clarity: the live rating is a
  private 1–5 (ADR-036).
- `scripts/generate-service-context.js` output was **not** applied: it rewrites hand-curated `.claude/README.md` text in all 10
  services, none of it caused by this PR.
- The drain check predates the removal. The ADR's *After deploy* check covers the window; re-running the read-only drain
  check right before merging is the maintainer's option.

**Gates.** `npm test` 27/27 on `89c336c0`; after the TDD promotion commit `2d6fdaba`: `tests` workspace 101 unit + 931
regression, request 406 regression (1 pre-existing DB skip), social-graph 173 regression. `tsc --noEmit` clean in shared,
notification, reputation, social-graph, request and simulation. `/simplify` (4 agents) applied; `/code-review` high: 8 findings,
6 fixed with fixtures that failed first, 2 ruled (sim mix, drain window); `/security-review`: no findings. Integration tests are
CI-only on this box. Follow-ups logged in `docs/IDEAS.md` 2026-10-22: typed consumer factory, dotenv-gate line pins, worker-set
equality, demo Redis key cleanup.

**After merge (L10): DONE** (steps 5–6 above). The deploy verified healthy; no CodeQL re-raise; the read-only demo check
passed. PR L2 follows PR K.

## PR K state (2026-10-26; SHIPPED 2026-10-27)

**SHIPPED 2026-10-27:** merged `dd585016` (v11.100.0) by the maintainer at 02:55:40Z. CI/CD 40441255956 green: 14/14 jobs, the
deploy log shows "All critical services healthy", "DEPLOYMENT SUCCESSFUL" and all 9 services healthy, "Notify on failure"
skipped (no rollback). CodeQL: 0 open alerts on master; the merge-sha analyses (javascript-typescript 02:57:50Z, actions
02:56:21Z) raised no new alert (highest still #627, dismissed 10-22). ADR-102 → Implemented on the L2 branch.

**#319 opened 2026-10-26.** Code finished at `5d7fe9bb` (2026-10-25); its first push was blocked
only by the lapsed ADR-059 exemptions, which #317 fixed. Branch `agent/claude/sprint-134-pr-k-live-admin-role` from
`origin/master` `0321c415`, **v11.100.0** (re-derived 2026-10-26 from `origin/master` `ff3f394e` 11.99.0, which #315 took).
Executed inline (`superpowers:executing-plans`) from
[`plans/2026-10-22-sprint-134-pr-k-live-admin-role.md`](../../docs/superpowers/plans/2026-10-22-sprint-134-pr-k-live-admin-role.md).

**Inventory (untruncated):** 136 `\.communities` hits = 90 SQL table refs + 19 other objects + 27 claim reads: 21 fixed
(12 gate sites, 31 routes, 4 services), 6 hint-only allowlisted, plus 2 inert reads in `packages/shared/middleware/tenant.ts`.
**Fits one PR well before 10-30**, so no dated risk acceptance or split (the condition the maintainer set did not trigger).

**What changed.** One `liveRole` module per service (request `db/`, community `utils/`, reputation `utils/`, social-graph
`database/`): `getLiveRole`/`isLiveAdmin`/`isLiveAdminOfAnyCommunity` (+ request's `hasLiveRoleInRequestCommunities`),
`(communityId, userId)`, UUID guard, NULL role = `'member'`. Every claim gate uses it; the dead `user.role` branches and the
`communityMemberships` alias are gone. ADR-102 (+ README index, `ADR_GROUPS`, ADR-010 amendment), ARCHITECTURE.md's
`requireRole` example, CLAUDE.md *Authentication*, 4 CONTEXT.md files, the admin guide.
- **BUG-071 fixed** (found by the inventory): the requester-offer routes were refused for anyone who administers nothing,
  because a prefix-wide admin chain ran first. The admin chain now covers exactly `adminActionsRouter`'s own routes,
  using `app.all(adminChainPaths(...))`. `adminChainPaths` reads the router and throws at startup on a layer it cannot cover.
  The mount order is unchanged.
- **BUG-072 fixed** (found by `/code-review`): split assignments/execute checked the path community's admin, then acted on any split.
- **BUG-073 logged, OPEN, proposed HIGH** (found by `/code-review`; maintainer decision): "admin of any community" (`/admin/schemas`,
  trust questions, provider-trust backfill) admits anyone who creates a community. `auth.users` has no platform role, so a
  fix needs a design decision. ADR-102 records the scope as inherited, not endorsed. **Maintainer, 2026-10-26: tabled** as a
  future-sprint feature that separates platform admin from community admin; the 10-29 deadline no longer applies.
- Gate `tests/regression/sprint-134-pr-k-claim-gate.test.ts` (17): claim reads (incl. aliases and decoded tokens) vs a
  two-way identity allowlist; un-awaited live-role calls (helper names derived, it found `requireAdmin`); tenant `communityRole`.
  It failed first on the unfixed tree with exactly the 22 inventory reads.
- Real SQL (CI-only here): `tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts`. It covers 31 routes ×
  {demoted, removed, live admin with an empty claim}, plus the admin-elsewhere, malformed-id, BUG-071 and BUG-072 cases.

**Rulings for the maintainer:** admin-only **reads** in reputation fixed too; "any community" scope kept (now BUG-073);
moderators still refused by `requireAdmin` on admin actions (dropping it would expose a 404/403 request-existence oracle);
only the duplicates in touched files collapsed (inline copies logged); shared tenant middleware untouched but proven inert;
event fan-out/feed default stay hint-only; unmatched `/requests/*` paths now 404 for everyone (were 401/403 for non-admins).
Follow-ups in `docs/IDEAS.md` 2026-10-22 (PR K).

**Gates (on `b5808f25` + the version bump):** root `npm test` 27/27; tests workspace 101 + 942; request 161 + 450, community
9 + 242, reputation 5 + 315, social-graph 12 + 183; `tsc --noEmit` clean ×4. `/simplify` (4 agents, applied: root-cause
BUG-071, derived gate names, dead `isActiveAdmin` deleted); `/code-review` high (9: BUG-072 fixed, derived chain, alias
reads, churn reverted; 5 ruled) then medium re-run (fail-closed `adminChainPaths`, mount order restored; rest ruled);
`/security-review`: no findings. Ledger: `.superpowers/sdd/2026-10-22-sprint-134-pr-k-live-admin-role/progress.md` (local).

**Codex review (2026-10-26, at `9d22380a`): no blocking findings**; 139 focused regression tests passed; real SQL unverified until CI (see *Security PR X findings*).

**CI on `4f04b4f6` (2026-10-27 00:06Z): all checks green**, Deploy to Demo skipped (PR event). **Real SQL verified:** Integration Tests run
40423497262 (job 121924948091, `refs/pull/319/merge` = head + `ff3f394e`, Postgres container healthy) passed PR K's suite
**101/101, 0 skipped**: 31 demoted + 31 removed + 31 live-admin-with-empty-claim, plus 8 (inventory count, positive controls
with side effects, 2 BUG-072, admin elsewhere, 2 malformed ids, BUG-071). Full integration run 275/275 across 18 suites.
Counted from the log by Claude, independently of the review.

**Codex review #2 (2026-10-26, at `4f04b4f6`, after the master merge): no findings.** It reproduced the merge proof (45/53, the
same 8 exceptions), the 101-case count, the conflict resolutions (both sides kept, K before L), BUG-068..073 once each in order,
and the version (master 11.99.0 → 11.100.0, three manifest occurrences). Regenerating the docs gave byte-identical pages for
reputation, request and social-graph; `architecture` differs only in its embedded dependency-graph timestamp (the churn
reverted in step 3 below). The claim gate and the dotenv gate passed locally, 27/27. It found nothing in L or X that adds a
claim-based authorization decision. Claude re-checked the integration count and the merge proof (above): both match.

**Updated from master after #315 (2026-10-26):**
1. Merge commit `396e31cc` (parents `10129fb2` + `ff3f394e`, no rebase). Conflicts:
   - `services/reputation-service/CONTEXT.md`, `services/request-service/CONTEXT.md` and `docs/IDEAS.md`: kept both sides,
     PR K's 2026-10-22 entry above/before PR L's, in date order.
   - `package.json`/`package-lock.json`: master's side (PR K changed only the version there).
   - This handoff: master's side. Every line only PR K's copy had was superseded by it.
   - Four generated landing pages (`architecture`, `services/{reputation,request,social-graph}-service`): regenerated from
     the merged sources. The generator's output matched every auto-merged landing file.
   - Auto-merged: `services/request-service/src/index.ts` (PR L removed the feedback import and mount, in hunks separate
     from PR K's admin-chain mount; the dotenv gate's `index.ts:35` pin still holds), `docs/BUGS.md` (BUG-068..073 in order,
     no collision), `services/social-graph-service/CONTEXT.md`.

   **Proof the merge left PR K unchanged:** per file, the `+`/`-` lines of `git diff origin/master` (merged tree) equal those
   of PR K's original `git diff 0321c415 10129fb2` for 45 of 53 files, which is every code, test and source-doc file. The 8 that
   differ do so by design: the handoff and the two version files; `docs/IDEAS.md`, where both sides added the same `---`
   separator and git kept one, now on master's side (all PR K content lines present); and the four generated pages above,
   which embed whole documents on one line.
2. Re-bump `76ef8e8f`: 11.99.0 → **11.100.0** (`package.json` + the lock's two root entries).
3. Gates on `76ef8e8f` (installed tree = the lock, 1609 nodes checked, 0 mismatches): cold `npx turbo run test --force`
   **27/27, 0 cached**, exit 0. That includes the `tests` workspace (101 unit + 952 regression), request (161 + 448, 1
   pre-existing skip), community (9 + 244), reputation (5 + 312, 3 todo) and social-graph (12 + 184, 3 todo). `tsc --noEmit`
   clean in request, community, reputation and social-graph. Landing-docs churn reverted (`build.json`, the dependency-graph
   stamp in `architecture.json`, CRLF in `adr-010`). **`/simplify`, `/code-review` and `/security-review` were not re-run:**
   the merge changed nothing in PR K's code (proof above).

**Post-merge done** (2026-10-27, see the top of this section). PR L2 shipped and PR V merged;
see *PR V state* for deploy/health proof. Next product work is PR B, scoped in a fresh chat.
BUG-073 is tabled (maintainer, 2026-10-26) as a future-sprint platform-admin feature; it is not PR L2's scope.
**Human validation (after deploy):** demote a test admin to member in a second browser, then that admin's **Update tags**
→ refused; a requester who administers nothing accepts a provider offer → accepted.

## PR X state (2026-10-26)

Branch `agent/claude/sprint-134-pr-x-security` from `origin/master` `0321c415`, **v11.98.0** (re-derived from `origin/master`
11.97.0; #315 and PR K also claim 11.98.0 and re-bump when they merge after it). Executed inline. Every item in *Security PR X
findings* below is addressed. The record is in the ADR-059 amendment "Security PR X".

**What changed.** `security/audit-exemptions.json`: braces deleted; node-forge renewed 2026-10-26 → **2026-11-02** (re-check:
1.4.0 latest, GHSA `<= 1.4.0`, no patch, not withdrawn; `@expo/cli` 58.1.15 / code-signing 0.0.7 need `^1.4.0`; prod reach
only `apps/mobile` → `expo` → `@expo/cli`). Lock splice (guarded scratchpad script; each old field had to equal the old
registry manifest): `body-parser` 2.3.0 → 2.4.0, its nested `content-type` 2.0.0 → 2.1.0 (2.4.0 needs `^2.1.0`), `undici`
7.30.0 → 7.30.1, root `zod` 4.6.5 → 4.6.6, nested `@expo/cli/node_modules/zod` 3.25.76 **removed**, and (after `/code-review`)
`qs` 6.16.0 → 6.16.1. Manifests: root and
`packages/shared` `zod ^4.6.6`; overrides `"undici": "7.30.1"` (it was an **exact** 7.30.0 pin, which the findings had not
listed) and `"@expo/cli": { "zod": "4.6.6" }`; after `/code-review`: `"qs": ">=6.16.1"` (was `>=6.16.0`, which overrode `body-parser`
2.4.0's own `^6.16.1` down), `"body-parser@<1.20.9": "1.20.9"` (was `<1.20.6` → 1.20.6, a version the same advisory covers;
no 1.x node exists) and the dead `"undici@7.0.0 - 7.28.0"` selector deleted (D9 follow-up (d)). `scripts/audit-exemptions.js` `validAuditReport`: a string `via` must name an
entry but is no longer ranked against its dependent; advisory objects still are.
**Why the validator failed:** the PATH `npm` on this box is **10.8.2** (pre-push hook and local gate); CI's is 11.19.0. Only 10.8.2
emits `expo-server-sdk` moderate via `undici` high; 11.19.0 omits the dependent. Traced in arborist (`audit-report.js:177-183`,
`vuln.js:166-171`): a dependent is ranked by the meta-advisories that apply to its own version and range.

**Proof** (re-run after the review fixes). Node diff vs a byte copy: 7 nodes changed (incl. root), 1 removed, 0 added, 0 key-order
changes. **npm 11.19.0's own
re-resolve** of the same edits (scratch copy of all 15 workspace manifests; `install --package-lock-only`, then
`update body-parser`, `update undici`, and after the review `update qs`) produced the same packages node for node (only the root version and the `^` on zod
differ; the reference pinned exact). Registry parity 25/25 fields (checker shown failing on injected defects). Strict
`npx -y npm@11.19.0 ci` exit 0 (lock untouched). `npm ls --all`: identical stderr error set (3 invalid + 1 missing) and an
identical 175-line invalid/missing/UNMET multiset. `npm ls` shows `zod@4.6.6 overridden` on the `@expo/cli` edge (settles the
UNVERIFIED note). Gate: exit 0, 0 unexempted, 4 findings under the node-forge exemption, on **both** the npm 10.8.2 and 11.19.0
reports. `@expo/cli` on zod 4: a differential run of its real consumers (`DevToolsPlugin` constructor, `PluginSchema`,
`DevToolsPluginOutputSchema`, `DevToolsPluginCliExtensionResults.parseOutputText`, `createMCPDevToolsExtensionSchema`) on 22
valid/invalid cases gave identical outcomes under zod 3.25.76 and 4.6.6 (schemas confirmed built by each copy). Mobile `tsc`
clean, jest 2/2. Validator: test-first (red on the old rule), then consolidated by `/simplify` to 55 tests, of which exactly the two new
valid-shape rows go red on the old rule; deleting the advisory-rank check turns the two negative fixtures red.
`sprint-131-d9-security-overrides`: undici floor 7.30.1 and a zod row (the `@expo/cli` pin must equal the lock's single zod
copy); red on "root 4.6.7 + nested 4.6.6" and on "pin 4.6.5".

**Gates.** `npm test` 27/27 **cold** (jest cache cleared, `--force`, 0 cached) on `6ac124a0`; `tests` workspace 101 + 929 after
the re-review fix; `tsc --noEmit` clean ×10 (shared + 9 TS services). `/simplify` (4 agents, applied): dead `isRecord` guard
dropped, one dependent-below-via fixture, CLI case folded into the existing `it.each`, ADR override wording. `/code-review` high
(8): `qs` floor, `body-parser` 1.x target, dead `undici` selector, pin-lockstep test fixed; handoff reconciled; MCP path and
the remaining advisory-rank check ruled (below). Medium re-run (7): ADR table now lists the advisory's `< 1.20.9` range; an
above-ranked-dependent test added (red when the evaluator drops sub-high advisories and skips the entry); the rest repeat
ruled or logged items. `/security-review`: no findings (registry `resolved`/`integrity` parity for all five moved packages, no
install scripts, `body-parser` 2.3.0 → 2.4.0 `lib/` diff keeps the `qs.parse` options, crafted reports all fail closed).

**Rulings for the maintainer:**
- **`qs` 6.16.0 → 6.16.1 (added after `/code-review`, beyond the findings table).** `body-parser` 2.4.0 declares `qs ^6.16.1`;
  the bare `"qs": ">=6.16.0"` override had loosened that edge (`npm explain qs`: overridden, was `^6.16.1`). 6.16.1 has no
  advisory but bounds `parse` on request-reachable input. One node, identical dependencies; npm's own re-resolve moves only
  `qs`. Converting the bare floors to selectors is a follow-up (`docs/IDEAS.md` 2026-10-26).
- **zod 4.6.6, not 4.6.7** (published 2026-10-12): the maintainer's target is the first patched version; `^4.6.6` admits 4.6.7.
- **The Sprint 128 fixture "high hidden under low parent" was wrong**: the child is its own high entry and is evaluated. It now
  asserts that the child blocks, and clears only by its own exemption.
- **No new BUG number** for the validator defect: PR K's branch holds BUG-071..073 unmerged, so a master-based number would
  collide. The ADR-059 amendment and the gotcha carry it.
- **Ruled, not fixed:** the `@expo/cli` MCP `registerTool` path is not exercised under zod 4. It needs `EXPO_UNSTABLE_MCP_SERVER`
  and the `expo-mcp` package (`@expo/cli` `MCP.js:43-50`); this repo has neither. Adding `expo-mcp` means re-checking it.
  The validator still ranks advisory objects against their own package, but that mirrors npm's construction (`vuln.js`:
  `via` is `this.advisories`, severity is their max), unlike the removed rule; deciding per advisory is the logged follow-up.
- Not changed: the moderates below (logged in `docs/IDEAS.md` 2026-10-26).

**Out of scope, found here:** moderates `fast-uri` (4 GHSAs, published 2026-10-23, SLA **2026-11-06**) and `ip-address`
(GHSA-rxp7-6hxx-x8q5, published 2026-10-22, SLA **2026-11-05**); see *Dated obligations*. Expo drift is back: issue **#316**
(open; scheduled run 2026-10-26 14:14Z; `expo-notifications` 57.0.23 → ~57.0.24, published 2026-10-22; no advisory, so it
awaits a maintainer decision). `npx expo install --check` exits 1 for exactly that plus the registered jest pair.

**Codex review (2026-10-26, at `f1114580`): no blocking findings; ready for maintainer merge.** It verified CI (20 checks
green, the PR deploy skipped as expected), 100 focused regression tests locally (`--no-cache`), the live gate (0 unexempted;
the 4 node-forge findings exempt), registry URL/integrity/dependencies/engines for all five moved packages (no install scripts),
and `@expo/cli`'s real schema consumers under zod 4.6.6. It recommends **keeping all three scope additions** (`qs` 6.16.1, the
1.x `body-parser` target, the dead `undici` selector removal) and accepts the MCP path as a documented limitation while
`expo-mcp` is absent. Read-only; no merge. Re-checked live afterwards: `gh pr checks 317` 20 pass + Deploy skipped;
`mergeStateStatus` BLOCKED (branch protection: needs the maintainer's merge).

**Post-merge (2026-10-26, recorded on #315's branch): SHIPPED.** The maintainer merged #317 as `e15622bc` (v11.98.0) at
22:08:24Z. CI/CD 40410093954 green: 14/14 jobs (lint/type, unit + regression, Security Audit, Code Scanning Gate, integration,
landing, 7 image builds, deploy). Deploy job: `Next.js 16.4.2` built for frontend and landing, "All critical services healthy",
"DEPLOYMENT SUCCESSFUL", then the workflow health check showed all 9 services healthy (auth, community, request, reputation,
notification, messaging, cleanup, geocoding, social-graph). "Notify on failure" skipped (no rollback). **CodeQL:** 0 open alerts
on `refs/heads/master` after the deploy (no re-raise; #317 touched neither `api.ts` nor `api-client.ts`). Then #315's sequence
(*PR L state*).

## Security PR X findings (verified 2026-10-26; addressed in PR X)

Reported by Codex's read-only review of PR K at `9d22380a` (2026-10-26). Each line below was re-checked the same day against
the live arbiters: `gh api advisories/<GHSA>`, `npm view`, `npm audit --json` (exit 1: 0 critical, 7 high, 6 moderate) and
`package-lock.json`. Nothing had changed when this table was written; every row is addressed in PR X (*PR X state*). Dependency work earned by advisories; the lane holder is **Claude**
(maintainer-designated; confirm before starting, CLAUDE.md *dependency lane*).

| Item | Live evidence | Action |
|---|---|---|
| **braces** GHSA-vfj7-8cjw-p6xm | `withdrawn_at: 2026-10-23T12:53:02Z`; absent from today's `npm audit` | **Remove** the exemption (the gate's "still matches a LIVE advisory" test fails on it) |
| **node-forge** GHSA-86w9-cpqp-85rv (high) | still live, `<= 1.4.0`, `first_patched_version` null; latest 1.4.0; lock `node_modules/node-forge@1.4.0` (via `@expo/cli` → `@expo/code-signing-certificates`) | **Renew** (7-day cap). **Maintainer, 2026-10-26: the 2026-10-20 authorization still stands** |
| **body-parser** GHSA-27r3-jxmh-p828 (high, published 2026-10-23) | `>= 2.0.0, < 2.4.0` (and `< 1.20.9`); lock `body-parser@2.3.0` (Express 5) | Bump to **2.4.0** (in-place splice) |
| **undici** GHSA-xjj6-f33q-929c (high) + GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472 (moderate) | `>=7.18.0 <7.30.1`; lock `undici@7.30.0` (via `expo-server-sdk`) | Bump to **7.30.1** or later in-range |
| **zod** GHSA-mrhx-c7xc-m3w5 (high, published 2026-10-01; **not** reported by the 10-22 re-checks, which showed 0 unexempted; when npm's audit feed picked it up is UNVERIFIED). The bug: `$ZodArray` collects one issue per failing element with no cap, so an unbounded array exhausts memory | `< 4.6.6`; lock has **two** copies: root `zod@4.6.5` (declared `^4.6.5` by root and `packages/shared`) and `node_modules/@expo/cli/node_modules/zod@3.25.76`. `@expo/cli` 57.0.32 **and the latest, 58.1.15,** both declare `^3.25.76`, so upstream has not moved | **Maintainer, 2026-10-26: take everything to 4.6.6.** Root: ranges `^4.6.6` + lock splice. Nested: a scoped override `"@expo/cli": { "zod": "4.6.6" }` + lock splice (or drop the nested node so it resolves the root copy). **Feasibility checked 2026-10-26 (static):** `@expo/cli` requires `zod` in exactly two dev-server modules (`build/src/start/server/DevToolsPlugin.schema.js`, `createMCPDevToolsExtensionSchema.js`). They use `z.object/string/enum/array/union/literal/boolean/number`, `.min/.optional/.describe/.strict/.readonly`, `.safeParse` and `.error.issues`, all present in zod 4. The MCP `registerTool` path needs an MCP server that is not installed here (no `@modelcontextprotocol/*` or `expo-mcp` in the lock). **Prove in the PR:** require both modules under 4.6.6 and `safeParse` a valid and an invalid plugin manifest; `npx expo install --check` in `apps/mobile`; mobile `tsc` + jest; `npm ls --all` (the override should read "overridden", not "invalid"; UNVERIFIED) |
| **Audit report rejected** | `node scripts/audit-exemptions.js` → "Audit evidence unavailable or invalid". `validAuditReport` (`scripts/audit-exemptions.js:159-160`) requires a string `via` to point at a vulnerability of equal or lower severity; npm reports `expo-server-sdk` **moderate** with `via: ["undici"]` and `undici` **high** | Fix the validator (the inconsistency is npm's, so the rule must tolerate it without hiding a high), with a negative fixture. Fixing undici may clear today's instance, but not the rule |

Notes: npm's `fixAvailable` for zod/node-forge points at `expo@54.0.38` (a downgrade) — ignore it. Prove the lock edit as
spec note 5 says (node diff, `npm view` parity, `npx -y npm@11.19.0 ci` from `C:\`, `npm ls --all` vs baseline). Cut the branch
fresh from `origin/master`; it takes the next merge slot ahead of #315 and PR K.

**Codex review of PR K (`9d22380a`, 2026-10-26):** no blocking findings introduced by PR K. 139 focused regression tests
passed locally. Real-SQL integration is unverified until CI. Codex supports BUG-073 as **HIGH** with a separate
platform-admin decision; BUG-073 is inherited and does not block PR K. The review stayed read-only; no push, gate bypass or
exemption change.

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
| ~~`next` GHSA-2464-fhr4-w9xw (critical) + GHSA-p3m5-59mp-jv5r (high)~~ | ~~now~~ | **DONE**: #314 `0321c415` (v11.97.0), live 2026-10-22 21:14Z (CI/CD 39853173679) |
| ~~**node-forge ADR-059 exemption**~~ | ~~2026-11-02 00:00 UTC (2026-11-01 16:00 PST)~~ | **DONE**: #322 `4ee38e82` (v11.103.0), merged 2026-10-28 18:56:43Z, deployed by CI/CD 40749793316 (14/14). Lock 1.4.0 → 1.4.2; exemption registry on master empty; deadline met. braces is gone (advisory withdrawn; BUG-059 closed). |
| ~~`ip-address` GHSA-rxp7-6hxx-x8q5 (moderate)~~ | ~~2026-11-05~~ | **DONE**: #322 (10.7.2 → 10.7.4, floor `>=10.7.4`), deployed 2026-10-28; 0 open Dependabot alerts. |
| ~~`fast-uri` GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr (moderate) + 2 low~~ | ~~2026-11-06~~ | **DONE**: #322 (4.2.1 → 4.2.3, floor `>=4.2.3`), deployed 2026-10-28. Dependabot **#318** (not used: it deletes 26 `libc` fields) auto-closed 18:59:10Z. |
| `deepmerge` alert **#178** (low) | re-check at the next Expo SDK move or **2026-12-01** | **DISMISSED** `tolerable_risk` 2026-10-28 19:24:33Z (maintainer option a). Reach: Expo config tooling + Jest only, no fix exists (4.3.1 latest). Gate blocks high/critical only, so no exemption entry. |
| `decode-uri-component` BUG-041 (alert #150, dismissed) | re-check by **2026-11-14** | 0.5.1 still ESM-only; blocker unchanged (*Security follow-up state*). |
| CodeQL `/language:actions` "Unknown Error" on `4ee38e82` | next master push | GitHub-side (job log shows a complete upload). Re-check the Actions analysis for the PR B merge sha. |
| **BUG-074** (`DELETE /matches/:id` cancels completed/rejected matches and reopens the request) | not scheduled | Logged 2026-10-28 during PR B planning; separate PR (maintainer). Severity not yet assessed; it changes completion/karma semantics, so plan it first. |
| ~~node-forge + braces ADR-059 exemptions~~ → **Security PR X** | ~~EXPIRED 2026-10-26 00:00Z~~ | **DONE**: #317 `e15622bc` (v11.98.0), live 2026-10-26 22:25Z (CI/CD 40410093954). The lapse blocked pushes and CI Security Audit from 10-26 00:00Z until the merge. body-parser/undici/zod highs fixed inside their SLA (body-parser due 10-30). BUG-059 closed |
| ~~**PR L** (BUG-068)~~ | ~~2026-10-29~~ | **DONE**: #315 `ff3f394e` (v11.99.0), merged 2026-10-26 23:05:13Z (CI/CD 40417261628); post-deploy queue check PASS. The demo key cleanup is a separate, unscheduled operation (*PR L state*) |
| ~~**BUG-069**~~ | ~~2026-10-30~~ | **DONE**: #319 `dd585016` (v11.100.0), merged 2026-10-27 02:55:40Z (CI/CD 40441255956). **ADR-102** Implemented. No risk acceptance or split was needed |
| BUG-073 (any community creator passes the "admin of any community" gates) | ~~2026-10-29~~ → **tabled** | Logged 2026-10-22 by PR K's `/code-review`, still **open**. **Maintainer, 2026-10-26:** separate community admin from platform admin, as a new feature in a future sprint (`docs/IDEAS.md` 2026-10-26 *architecture*). No target sprint or review date set |
| ~~**BUG-070** (BUG-063 class in reputation health + dead `FeedComposer`)~~ | ~~2026-11-03~~ | **DONE**: #320 `47c9a323` (v11.101.0), merged 2026-10-27 20:37:13Z; CI/CD 40579675258 deploy + health green. First 02:00 nightly human validation pending. |
| **Expo drift #316** (`expo-notifications` 57.0.23 vs ~57.0.24) | Daily workflow failing; no advisory date | **OPEN**, awaiting maintainer decision; dependency lane Claude's. The 10-22 "Expo drift closed" record predates this issue. |
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
