# Sprint 134: Dated Obligations and Boundary Hardening — Design Spec

**Date**: 2026-10-20
**Status**: Approved (maintainer scope 2026-10-19; candidate choices and BUG-063/BUG-068 decisions 2026-10-20)
**Version**: v11.92.0 → one minor bump per PR, each re-derived from `origin/master` at merge time
**Sprint Branch**: one branch per PR, `agent/claude/sprint-134-pr-<letter>-<slug>`, each cut from `origin/master`. PR F is the
exception: it is the planning branch itself, so the planning docs reach master with it (no docs-only master push)
**Planning branch**: `agent/claude/sprint-134-planning` (this spec, the per-PR plans, the handoff)

---

## Overview

Sprint 134 is mostly obligations with a date on them. A community admin cannot export their community's data at all,
because every query in the export router names tables and columns that do not exist (BUG-063, due 2026-10-24). The
ADR-101 per-consumer queues shipped with legacy handlers that were meant to live one release; they are still there,
next to a dead feedback route that 500s on every call (BUG-068, due 2026-10-29). The mobile app has drifted nine patch
releases behind Expo's SDK 57 map (#279), and the `verify:demo` CLI makes an operator export four story IDs by hand
even though `.env.demo` already holds them.

After the dated work, the sprint closes the admin-write half of the JWT-claim problem (BUG-069, due 2026-10-30), pays
down the read-boundary and endorsement follow-ups Sprint 133 logged, and adds a scheduled checker that produces the
weekly exemption re-check evidence instead of a human assembling it by hand.

This is a long multi-PR sprint. Per CLAUDE.md, each PR gets its own plan file and its own execution chat. Plans exist
now for PRs A, E and D. PR L's plan is **provisional**: it cannot be finalized until the maintainer reports the demo
queue drain check. Plans for L2, K, V, B and C are written at the start of each PR's chat, from the scope fixed here.

### Core Principle: The live schema and the live registry are the arbiters

Every defect in this sprint's dated half passed a test that compared code against a mock or a hand-written shadow:
BUG-063's regression test regex-matches the wrong table name, and BUG-068's feedback tests mock the query that fails.
Every fix here is proven against the real arbiter: a real-SQL integration test, `npx expo install --check`, strict
`npm ci` under CI's npm, or a live `npm view`.

---

## Multi-Sprint Arc

### Sprint 133 — Skills depth, read boundary, per-consumer queues (complete, v11.92.0)
### Sprint 134 — Dated obligations and boundary hardening (this sprint)
### Sprint 135 — Whatever of the PR V / PR B follow-up tail does not fit here (upcoming)

**Capacity note.** All four optional candidates were chosen. The order below is by deadline, then risk. PRs B and C
sit at the tail and are the most likely to spill into Sprint 135. That is expected, not a failure. CLAUDE.md's
"maintenance ~1/5" guidance is outweighed here by dated security obligations, and PR B is the sprint's product work.

---

## PR Sequence

| # | PR | Scope | Due | Plan |
|---|---|---|---|---|
| 0 | **F** | follow-redirects 1.16.0 → 1.16.1 (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c, both high, published 2026-10-20 ~17:55Z); one-node lock splice; carries the planning docs | high SLA 2026-10-27, but it **blocks every push and deploy now** | done on the planning branch (see *PR F*) |
| 1 | **A** | BUG-063: repair every community export query against the live schema | **2026-10-24** (target merge 10-22) | `plans/2026-10-20-sprint-134-pr-a-bug-063-export.md` |
| 2 | **E** | Expo SDK 57 patch: surgical lock splice, plus the drift workflow's silent-failure gap | none (issue #279) | `plans/2026-10-20-sprint-134-pr-e-expo-patch.md` |
| — | **X** | Exemption re-check of node-forge + braces; a renewal PR **only on the maintainer's explicit yes** | gate fails **2026-10-25 17:00 PDT** | handoff *Dated obligations* (the #304/#307/#309 pattern) |
| 3 | **D** | `verify:demo` loads `DEMO_ENV_FILE ?? '.env.demo'` without overriding the environment | none | `plans/2026-10-20-sprint-134-pr-d-verify-demo-env.md` |
| 4 | **L** | ADR-101 legacy-handler removal + BUG-068 code retirement (**no migration**) | **2026-10-29** | `plans/2026-10-20-sprint-134-pr-l-legacy-handlers.md` (**PROVISIONAL**) |
| 5 | **L2** | Migration: drop `requests.interaction_feedback` and the seven dead feedback-average columns, and update every reader | none (follows L) | written at PR start |
| 6 | **K** | BUG-069: admin/moderator writes re-derive the role from live membership | **2026-10-30** | written at PR start |
| 7 | **V** | Sprint 133 PR V read-boundary follow-ups | none | written at PR start |
| 8 | **B** | Sprint 133 PR B skill-endorsement follow-ups | none | written at PR start |
| 9 | **C** | Scheduled exemption re-check evidence (treadmill item a) | none | written at PR start |

One merge at a time (CLAUDE.md *Parallel Development*). PR X can interleave anywhere; it is a short PR on its own branch.
A and E come before X so that X re-checks against the post-Expo lockfile. `@expo/cli@57.0.31` still declares
`node-forge ^1.3.3` (`npm view`, 2026-10-20), so PR E does not retire the node-forge exemption.

---

## PR F — follow-redirects advisories (found during planning, 2026-10-20)

The planning branch's pre-push hook failed on a docs-only diff: `sprint-75-security-gate` and `sprint-123-audit-exemption-gate`
both reported `follow-redirects` GHSA-q3jh-wrc6-jgq8 and GHSA-8r9p-f939-6h3c (high; range `>=1.16.0 <1.16.1`; fixed in 1.16.1;
published 2026-10-20 17:53Z and 17:58Z). The lock has one node, `node_modules/follow-redirects@1.16.0`, reached only via root
`axios@1.20.0`, whose declared range `^1.16.0` admits 1.16.1, so no manifest changes. Maintainer (2026-10-20): fix it now on the
planning branch. Splice: `version`/`resolved`/`integrity` only (every other lock field is identical between 1.16.0 and 1.16.1 per
`npm view`), plus the v11.93.0 bump. Proof: node-level diff (2 changed nodes, 1879 keys, order identical);
`npx -y npm@11.19.0 ci` exit 0 with 1.16.1 on disk; `npm ls --all` errors identical to the pre-change baseline (3 invalid + 1
missing); `node scripts/audit-exemptions.js` 0 unexempted. It ships first because the ADR-059 gate blocks every other PR until it does.

## PR A — BUG-063: community export (due 2026-10-24)

**Problem (verified against `infrastructure/postgres/init.sql`, 2026-10-20).** `services/community-service/src/routes/export.ts`
is broken in more places than BUG-063 names. All three routes 500 for everyone, admins included:

| Site | Wrong | Live schema |
|---|---|---|
| `:68`, `:287`, `:342` admin checks; `:127`, `:305`, `:367` member reads | `community.memberships` | `communities.members` |
| `:82` | `community.communities` | `communities.communities` |
| `:189` | `community.norms` | `communities.norms` |
| `:210` | `community.settings` | `communities.settings` |
| `:126` | `m.created_at` | `members` has no `created_at` (has `joined_at`) |
| `:150`, `:171`, `:362`, `:365` | `r.community_id` | `help_requests` has no `community_id`; link via `requests.request_communities` |
| `:185` | `n.approval_count` | no such column; count `communities.norm_approvals` (`norm_id`, `approved_by`) |
| `:203-208` | `match_ttl_days`, `session_ttl_days`, `karma_decay_enabled`, `karma_half_life_months` | live columns: `request_ttl_days`, `offer_ttl_days`, `message_ttl_days`, `notification_ttl_days`, `reputation_half_life_months`, `activity_types`, `updated_at` |
| `:359-360` | `t.helps_given`, `t.helps_received` | `reputation.trust_scores` has neither |
| `:104,:109` `dateClause` | unqualified `created_at` | ambiguous once `auth.users` (which has `created_at`) is joined; qualify per table |

**Maintainer decision (2026-10-20): repair every section.** No section is dropped and the response shape stays the same,
except where a field had no live column:

- **members**: `communities.members`, no `m.created_at`; the date filter applies to `m.joined_at`.
- **requests / matches**: membership via `EXISTS (SELECT 1 FROM requests.request_communities rc WHERE rc.request_id = r.id
  AND rc.community_id = $1)`, keeping `NOT r.is_directed`. Date filters are qualified (`r.created_at`, `m.created_at`).
- **norms**: `approval_count` = `(SELECT COUNT(*) FROM communities.norm_approvals a WHERE a.norm_id = n.id)::int`.
- **settings**: select the live columns listed above, which replace the four that never existed.
- **karma aggregate**: unchanged (it was already correct). Its date filter is qualified (`k.created_at`).
- **activity report**: four distinct counts, all limited to the community's non-directed asks:
  `Helps Given` = completed matches the member responded to; `Helps Received` = completed matches on the member's own
  asks; `Requests Created` = the member's asks; `Requests Completed` = the member's asks with `status = 'completed'`.
  This replaces the nonexistent `trust_scores` counters and the old `Requests Completed`, which counted the same thing
  as Helps Given. The `trust_scores` join goes. The ADR-082 rule stands: no karma, trust score or reputation ordering.
- **admin gate**: unchanged semantics. It is already a live `communities.members` lookup (CLAUDE.md *Authentication*);
  admin only, active only. A non-admin member or non-member gets 403.

**Tests.** The mocked regression test `services/community-service/tests/regression/sprint-112-governance-export-privacy.test.ts`
encodes the wrong table names (`:71`, `:75` regex `community\.memberships`). It is updated to the live names, and a new
real-SQL integration test, `tests/integration/sprint-134-community-export.integration.test.ts`, proves end to end:
admin export 200 with every section populated, a member 403, a non-member 403, a removed former admin 403; members/CSV
and activity routes 200 for the admin; the activity counts exact for a seeded fixture; a date-filtered export returns
200, which proves the ambiguity is fixed. A schema-truth unit gate asserts every `schema.table` the router names exists in
`init.sql`.

**Fallback.** If PR A cannot merge by end of 2026-10-23, Task A0 of its plan holds a ready-to-sign dated risk acceptance
(export stays broken, fails closed, leaks nothing; new deadline 2026-10-31).

## PR E — Expo SDK 57 patch drift (#279)

**Targets (fresh `npx expo install --check`, 2026-10-20; re-derive at execution):** `expo` ~57.0.25 → ~57.0.30,
`@expo/metro-runtime` ~57.0.16 → ~57.0.17, `expo-camera` ~57.0.5 → ~57.0.6, `expo-constants` ~57.0.19 → ~57.0.22,
`expo-linking` ~57.0.11 → ~57.0.13, `expo-location` ~57.0.20 → ~57.0.21, `expo-notifications` ~57.0.21 → ~57.0.23,
`expo-router` ~57.0.23 → ~57.0.28, `expo-splash-screen` ~57.0.9 → ~57.0.10. The `jest` / `@types/jest` lines are
registered ADR-094 divergences and do not move.

**Closure.** `expo@57.0.30` moves eleven direct-dependency ranges (`@expo/cli` ^57.0.27 → ^57.0.31, `expo-modules-core`,
`babel-preset-expo`, `expo-asset`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/fingerprint`,
`expo-modules-autolinking`, `@expo/local-build-cache-provider`, `expo-constants`), so the splice is wider than nine
nodes. Method: Windows re-resolve in a scratch copy, splice only the changed entries onto the base lock (key order kept,
map fields sorted), prove with node-by-node diff + `npm view` parity, `npx -y npm@11.19.0 ci`, `npm ls --all` (baseline
3 pre-existing invalids), mobile tests, `tsc --noEmit`, `expo install --check` exit 0, and a green dispatched
`Expo SDK drift` run. Never `npm install --workspace`, `npm dedupe` or a scratch regen. Then close #279.

**Workflow fix (same PR, `docs/IDEAS.md` 2026-09-13).** `.github/workflows/expo-sdk-drift.yml` gates its reporting
steps on `steps.check.outputs.*` (`:154`, `:232`, `:262`). A failure in checkout/setup-node/`npm ci` skips all three, so
the run goes red with no issue filed. Apply the demo-health pattern: `always() && (failure() || steps.check.outcome !=
'success' || steps.check.outputs.issue != '0' || steps.check.outputs.result == '')`, plus a generic fallback issue body
when the payload is empty.

## PR D — `verify:demo` reads `.env.demo` itself

`services/simulation-service/src/scripts/verifyDemoData.ts` `readEnv()` (`:45-70`) reads everything from
`process.env`, so an operator must export the story IDs by hand (the Sprint 133 D11 deviation). The CLI `main()`
(`:233`) loads `DEMO_ENV_FILE ?? '.env.demo'` (the path `rotateMariaStories.ts:120` already writes) via `dotenv`
(declared, `^17.4.2`) with `override: false` and `quiet: true` (gotcha `docs/gotchas/dotenv-config-must-pass-quiet.md`).
Variables already in the environment win.

- Loading happens in `main()`, not `readEnv()`: the reset/rotate flows also call `readEnv()` and must stay unaffected.
- A **missing default** `.env.demo` is not an error; the CLI falls back to the environment, as today. A **missing
  explicit** `DEMO_ENV_FILE` is an error: the operator named a file that is not there.
- The report names which file was loaded, never its values.
- No gotcha entry (maintainer, 2026-10-19).

## PR L — ADR-101 legacy handlers + BUG-068 code retirement (due 2026-10-29; PROVISIONAL)

**Gate.** The read-only demo queue drain check (handoff *Queue drain check*) must pass first: the legacy
`bull:karmyq-events` `wait`/`active`/`delayed`/`paused` all 0, and each `karmyq-events-<consumer>` queue is served only
by its own consumer's container. **Not run as of 2026-10-20.** The maintainer runs it or grants the read. If it is not
clean, PR L becomes a drain step plus a dated risk acceptance.

**Scope (code only; maintainer 2026-10-20: no migration in L).**
- Remove the legacy `karmyq-events` registrations: `services/notification-service/src/events/subscriber.ts:10`,
  `services/reputation-service/src/events/subscriber.ts:33`, `services/social-graph-service/src/events/subscriber.ts:11`
  (the Sprint 132 `match_completed` legacy handler). Drop `LEGACY_SUBSCRIBERS` from
  `tests/regression/sprint-133-pr-q-event-routes.test.ts:11`, so any `karmyq-events` reference fails the gate. Retire
  the live half of `tests/integration/sprint-133-bug-060-shared-queue.integration.test.ts` (`:46-…`).
- Retire BUG-068: the request-service route `services/request-service/src/routes/feedback.ts` (publisher at `:148`), the
  `interaction_feedback_submitted` route-table entry (`packages/shared/events/routes.ts:28`), the reputation handler
  (`subscriber.ts:150`), the simulation call (`services/simulation-service/src/api-client.ts:505`; it was `:461`), the
  reputation health route's reads of the `trust_scores` averages (`routes/health.ts:39-41,77-78`), and the
  `services/registry.json` entries (`:633`, `:727`).
- **Consequence to decide in the final plan:** `interaction_feedback_submitted` is reputation's **only** routed event
  (`packages/shared/src/events/__tests__/routes.test.ts:21`). After L, `EVENT_CONSUMERS`
  (`packages/shared/events/routes.ts:7`) would list `reputation` with nothing routed to it. Recommendation: remove
  `reputation` from `EVENT_CONSUMERS` and reputation's consumer-queue startup, and re-point the PR Q integration test's
  reputation-delivery probe (`tests/integration/sprint-133-pr-q-per-consumer-queues.integration.test.ts:63-69`) or
  narrow it to notification. Recorded as an **ADR-101 amendment**, not a new ADR number.
- Expect a master CodeQL `js/request-forgery` re-raise from the `api-client.ts` line shift. Ask before dismissing.

## PR L2 — Drop the dead feedback data (follows L)

Maintainer 2026-10-20: drop, in its own PR after L. One migration drops `requests.interaction_feedback`
(`migrations/006_social_karma_v2_schema.sql:38`) and the seven dead average columns: `reputation.trust_scores`
`avg_helpfulness`, `avg_responsiveness`, `avg_clarity`, `total_feedback_received`, and
`reputation.community_health_metrics` `avg_helpfulness`, `avg_responsiveness`, `avg_clarity`. Every reader is updated
(inventory 2026-10-20, re-run untruncated at PR start): `reputation-service` `services/healthMetricsService.ts` (`:42-54`
aggregate, `:100-115` upsert), `services/milestoneDetector.ts` (`:41-92`), `routes/health.ts`; `request-service`
`services/feed/socialKarmaFeedComposer.ts` (`:31-59`, feed ranking; values have always been 0, so ranking does not
change); `simulation-service` `fixtures/curatedDemo/tablePolicy.ts:91`; the e2e seeds `tests/e2e/seed-social-karma-v2*.sql`;
and their tests. `init.sql` is regenerated with `scripts/regenerate-init-sql.sh`; the `migration-validator` agent runs before
commit. A dry-run against a disposable copy is a demo-host operation and needs its own authorization.

## PR K — BUG-069: admin writes trust the JWT claim (due 2026-10-30)

First, classify every hit of `grep -rn "\.communities" services/*/src` (untruncated; a hint-only read stays). Then one
live-role helper per service, used by every write gate. Each fixed site gets a real-SQL test where the token claims `admin`
but the row says `member` or `left`, expecting 403. Known sites: request-service `middleware/adminAuth.ts:106`,
`routes/adminActions.ts:11`, `routes/collectives.ts:447,485`. Unclassified files: community-service `communities.ts`,
`fusions.ts`, `splits.ts`, `trust-questions.ts`; reputation-service `providerReviews.ts`, `reputation.ts`; social-graph-service
`database/trustEdgeDb.ts`, `routes/trustDecayConfig.ts`. The fix spans 4 services, so CLAUDE.md requires an ADR. **The
maintainer allocates the number.** If the inventory shows the change cannot merge by 2026-10-30, PR K opens with a dated
risk-acceptance proposal and splits by service. The `docs/IDEAS.md` 2026-10-08 "one live-membership helper per service"
item is folded in here.

## PR V — Read-boundary follow-ups (`docs/IDEAS.md` 2026-10-19)

Owner-write routes answer "absent" and "not yours" identically (404), as PR V did for offers. `GET /requests/:id`
moves onto `requestReadableSql` (`services/request-service/src/routes/requests.ts:1674`). One `isActiveMember` (two exist,
with opposite argument order). The list-query CTE + `matches(request_id, responder_id)` index (migration). The
`help_offers.is_public` retire-or-honor question goes to the maintainer at PR start.

## PR B — Skill-endorsement follow-ups (`docs/IDEAS.md` 2026-10-13)

Product work, scoped at PR start with the maintainer: idempotent `match_completed` trust-edge counts (reconcile from
`requests.matches`); the endorsement notification (a `skill_endorsement_changed` consumer in notification-service needs its
own dedicated queue, per BUG-060); fission's `endorsement_count` copy; `karma_awarded` with a handler and route but no
publisher; vouch-from-request-page; endorsement-weighted matching (touches `packages/shared`). The legacy-handler item in
that entry is PR L.

## PR C — Exemption re-check evidence (treadmill item a)

A scheduled workflow that walks `security/audit-exemptions.json` and, for each entry, records the evidence a renewal
needs: latest `npm view <pkg> version`, the GHSA's `first_patched_version` and withdrawn state, and the dependents' declared
ranges. It opens or updates one issue with that evidence ahead of the expiry. It **produces evidence only**: it never
edits the registry, renews or opens a PR, and it changes no ADR-059 policy. Item (b), reach-scoped audit, is out of
scope (it needs an ADR-059 amendment).

---

## Data Model

- PR A, D, E, K, C: none.
- PR L: none (maintainer: no migration in L).
- PR L2: one migration, `infrastructure/postgres/migrations/2026MMDD-drop-interaction-feedback.sql`, dropping
  `requests.interaction_feedback` and the seven columns above; `init.sql` regenerated.
- PR V: possibly one index migration on `requests.matches(request_id, responder_id)`.

## API Endpoints

| PR | Method | Path | Change |
|---|---|---|---|
| A | GET | `/communities/:communityId/export` | 500 → works; settings section reports live columns; activity counts redefined |
| A | GET | `/communities/:communityId/export/members` | 500 → works |
| A | GET | `/communities/:communityId/export/activity` | 500 → works; four distinct counts |
| L | POST | `/matches/:matchId/feedback` (request-service) | **removed** (dead, BUG-068) |
| L | GET | reputation community-health | stops reporting the always-0 feedback averages |
| K | various admin writes | — | stale-claim admin → 403 |

## Frontend Changes

None required. `apps/frontend/src/components/community/StewardRequestsAdmin.tsx:101` and `apps/frontend/src/lib/api.ts:295-318`
already call all three export routes. PR A's human validation downloads each format from the steward page.

## User Guide & Doc Updates

- **PR A**: a new "Exporting community data" section in `docs/guides/admin-community-guide.md` (the published one,
  `scripts/generate-docs.ts:327`; no guide mentions the export today) states what the export contains, with the
  activity-report column definitions above and the ADR-082 reputation exclusion. community-service `CONTEXT.md` Known Issues
  → Recent Fixes. Correct `services/community-service/.claude/README.md`'s stale "Database Schema: community" to `communities`.
- **PR E**: `apps/mobile/claude.md` if it names SDK patch versions; close #279 with the evidence.
- **PR D**: the operator section of `docs/guides/demo-data.md` (`verify:demo` no longer needs exported story IDs).
- **PR L**: ADR-101 amendment (legacy handlers removed; reputation's consumer status); notification/reputation/
  social-graph/request-service `CONTEXT.md`; `services/registry.json` events; `docs/BUGS.md` BUG-068 → fixed.
- **PR L2**: reputation and request-service `CONTEXT.md` schema notes; ADR-035's landing concept text if it names the averages.
- **PR K**: the new ADR (number allocated by the maintainer), added to `docs/adr/README.md` and `ADR_GROUPS` in
  `scripts/generate-docs.ts`; each touched service's `CONTEXT.md`.
- Every PR: `docs/BUGS.md` status lines; `npm run feedback:check`; revert the landing-docs timestamp churn that `npm test` produces.

## Critical Implementation Notes

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
