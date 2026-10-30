# Sprint 134 BUG-077: Completion Side Effects Run, Once — Design Spec

**Date**: 2026-10-29
**Status**: Approved (maintainer answered all four design questions on 2026-10-29)
**Version**: v11.105.0 → v11.106.0 (**provisional**: re-derive from `origin/master` at merge time)
**Sprint Branch**: `agent/claude/sprint-134-pr-bug-077-badge-insert` (cut from `origin/master` `ae9f8957`)

---

## Overview

Every `match_completed` job in reputation-service fails. The handler awards karma, then calls
`checkAndAwardBadges(responder_id)` (`services/reputation-service/src/events/subscriber.ts:74`), whose insert is
`INSERT INTO reputation.badges (user_id, badge_type) VALUES ($1, $2) ON CONFLICT (user_id, badge_type) DO NOTHING`
(`services/reputation-service/src/services/badgeService.ts:86-88`). The live table has a column the insert does not
supply: `name character varying(255) NOT NULL` (`infrastructure/postgres/init.sql:2096`). That table comes from the
initial commit (`1dea32d1`, 2025-11-03: `name VARCHAR(255) NOT NULL`, `icon_url`, no `badge_type`). Migration 024
(Sprint 14) wrote `CREATE TABLE IF NOT EXISTS` (`infrastructure/postgres/migrations/024-prestige-badges.sql:12`), so its
own definition never ran; it only added `badge_type` and `community_id` and the unique key
(`init.sql:3640-3641`, `badges_user_id_badge_type_key UNIQUE (user_id, badge_type)`). The insert has never succeeded, so no
badge has ever been awarded, and because no badge row exists every helper qualifies for `first_helper` on every
completion.

The throw lands in the handler's main `try` (`subscriber.ts:54`). The outer catch logs "❌ Failed to award karma for
match" (misleading: karma already committed) and rethrows (`:131-134`), so Bull retries the job
(`attempts: 10`, exponential from 2 s: `services/request-service/src/events/completionEvents.ts:6-7`). Karma itself is
safe: the projector commits in its own transaction (`standingProjector.ts:270`, `withTransaction`) and is idempotent
(ADR-096). Everything after the badge call is skipped: the trust-evolution block (`subscriber.ts:76-130`) never runs.
`updateProviderCompletionRate` (`:71`) sits in the same `try`, one line earlier, with the same exposure.

Fixing the insert alone would not make trust evolution work. `evaluateUserEvolution` computes
`round2(clamp(currentValue + delta, min, max))` (`services/reputation-service/src/services/trustEvolutionService.ts:130-132`),
where `currentValue` comes from `NUMERIC(3,2)` columns (`init.sql:1005` `trust_depth_weight`, `:2278-2280`
`user_trust_configs`). The installed `pg` 8.23 / `pg-types` 2.2.0 registers no parser for NUMERIC (OID 1700), so the value
arrives as the string `"0.60"`; `"0.60" + 0.01` is `"0.600.01"`, `clamp` yields `NaN`, and the write is rejected (CHECK
`chk_utc_depth`, `init.sql:2285`; exact PostgreSQL error **UNVERIFIED**, the failure is not). The inner catch
(`subscriber.ts:122-125`) logs it, so it has never surfaced. The unit tests mock numbers
(`tests/unit/reputation/trustEvolutionService.test.ts:30`, `depth_weight: 0.60`), which is how it hid. This is
**BUG-079**, fixed here (maintainer decision 4). It reaches only members who switched evolution on: a member without a
`reputation.user_trust_configs` row is not eligible (`trustEvolutionService.ts:105`), which matches the opt-in the
concept page describes (`docs/concepts/trust-model-evolution.md:35-42`).

### Core Principle: Karma is the only part of a completion worth a retry

Karma is the record; it commits first and replays idempotently. Badges and the provider completion rate are derived
from history and recomputed in full on the helper's next completion, so a skipped run repairs itself. Trust evolution
is already isolated. A failure in any of the three logs with its own prefix and never fails the job, and a real-SQL
test that runs every one of them against `init.sql` is what keeps them working.

---

## Decisions (maintainer, 2026-10-29)

1. **The insert supplies a display name; no migration.** A typed `BADGE_NAMES: Record<BadgeType, string>` gives every
   Phase 1 type a name, so a type without one is a compile error. A migration would also need `init.sql` regenerated
   by `pg_dump` in Docker (`scripts/regenerate-init-sql.sh:50`; none on this box), or CI's drift check
   (`.github/workflows/ci.yml:317-321`) fails. It would also leave `name` permanently NULL beside the already-dead
   `icon_url`.
2. **Isolate badges and the provider completion rate**, each in its own try/catch with an accurate log prefix
   (`[badges]`, `[provider-trust]`), like the trust-evolution block. Only a karma projection failure fails the job.
3. **Going forward only.** No demo backfill. `checkAndAwardBadges` compares thresholds against the helper's whole
   history (`badgeService.ts:46-79`), so a helper's next completion awards every badge already earned, with
   `earned_at` = the award time, not when the threshold was crossed. No UI or notification shows badges, and the
   curated demo reset wipes the table (`services/simulation-service/src/fixtures/curatedDemo/tablePolicy.ts:105`,
   `'reputation.badges': 'reset'`).
4. **Fix BUG-079 here.** Coerce with `Number()` inside `evaluateUserEvolution` only, so `GET /reputation/trust-config`
   keeps its wire format.

Defaults taken without a question (no objection needed; each is conventional or already the code's own rule):

- **No badge notification.** None exists: no `badge_earned` event in `packages/shared/events/routes.ts`, no template in
  notification-service, no consumer. Adding one is a feature (ADR-101 routing), not this fix.
- **Truthful award report.** `checkAndAwardBadges` returns, and logs "🏅 Badge awarded" for, only inserts that wrote a
  row. Today it reports every attempted type, including ones the unique key absorbed. Refusal on `rowCount === 0`, as
  the request-service guards do (BUG-074 note 8: an `undefined` from an older mock passes through).
- **Provider completion rate is logged as BUG-080, not fixed.** It counts `status IN ('accepted', 'completed')`
  (`providerTrustService.ts:77`, `:125`), but accepting a match writes `'matched'`
  (`services/request-service/src/routes/matches.ts:360`), so the rate is 100% for any provider with a completed
  exchange. Wrong number, no failure; it needs its own definition.
- **Docs drift fixed in this PR**: the reputation `CONTEXT.md` badges DDL (`:216-224`, invents `badge_name`, omits
  `name`, `community_id`, `icon_url`), its stale "Implement Badge System" sample (`:1205-1264`: `badge_name`, a
  `badge_earned` event), `services/reputation-service/README.md:70-72` and `docs/ARCHITECTURE.md:444` (both say
  `awarded_at`; the column is `earned_at`).

---

## Evidence

### Who touches `reputation.badges` (verified with `git grep`)

| Kind | Site | Note |
|---|---|---|
| Writer | `badgeService.ts:86` | The only writer. |
| Reader | `routes/reputation.ts:262-285` (`GET /reputation/badges/:userId`, `SELECT *`) | Self-only. |
| Reader | `routes/reputation.ts:406-417` (`GET /reputation/users/:userId/badges`, via `getUserBadges`) | Self-only; selects `id, user_id, community_id, badge_type, earned_at` (`badgeService.ts:28`). |
| Client | `apps/mobile/services/api.ts:178-179` `getBadges` | Defined, never called. No web client. |
| Reset | `curatedDemo/tablePolicy.ts:105` | Wiped on a curated reset. |

The response of neither route changes: `name` was already in `SELECT *`'s column list, NULL never occurring because no
row existed.

### Demo log window (maintainer-authorized read, 2026-10-29; from `docs/BUGS.md` BUG-077)

`Processing match_completed event` 497, `Karma awarded for match` 497, `Failed to award karma for match` 498,
`violates not-null constraint` 498 (`23502`, column `name`, badge `first_helper`), `Badge awarded` 0. Each
"Processing" line is one attempt, retries included.

**Log rotation cause is UNVERIFIED.** BUGS.md attributes the ~2 h window (json-file, 3 × 10 MB) to these stack traces.
Every reputation query also logs its full SQL text (`services/reputation-service/src/database/db.ts:40`). The retries
multiply both, so the fix shrinks the volume, but whether the window then spans the 02:00Z nightly is something only the
post-deploy log read can say (human check 2).

### What a successful job looks like (Bull 4.16.5, `node_modules/bull`)

The reputation job is `completion-<match id>` on `karmyq-completion-reputation` (`completionEvents.ts:20-24`, `:28-31`),
kept for a day after success (`removeOnComplete: { age: 86400 }`, `:10`). Bull increments `attemptsMade` only when an
attempt fails (`lib/job.js:586`, `_saveAttempt`); `lib/commands/moveToFinished-9.lua` never touches it. A first-try
success therefore reads `state 'completed'`, `attemptsMade 0`, no `failedReason`, `stacktrace []`.

### What makes trust evolution observable

`evaluateUserEvolution` writes only when a signal fires and every gate passes (`trustEvolutionService.ts:91-111`): no
global opt-out row (default on, `trustEvolutionDb.ts:162-169`), `community_evolution_enabled` (default `true`,
`init.sql:1021`, but only if a `communities.community_configs` row exists; no trigger creates one), a
`user_trust_configs` row with `evolution_enabled` (created by `PUT /reputation/trust-config/:userId/:communityId`,
`routes/reputation.ts:468-484`), and no log entry for that parameter in 7 days. The repeat-pair signal fires when the
pair has 3 or more completed matches (`subscriber.ts:93`, `:107`). It nudges `depth_weight` by +0.01
(`trustEvolutionService.ts:56-58`) from the community default 0.60 (`init.sql:1005`) to 0.61, and logs it with
`trigger_event_id` = the match id (`:139-147`). Community evolution needs 3 contributing members
(`communityEvolutionService.ts:14`), so one evolving helper changes nothing at community level.

---

## Data Model

No schema change. No migration. `infrastructure/postgres/init.sql` is untouched.

---

## API Endpoints

No endpoint, request or response change. No event, queue or routing change.

### `checkAndAwardBadges` (`badgeService.ts`)

```ts
export const BADGE_NAMES: Record<BadgeType, string> = {
  first_helper: 'First help given',
  milestone_10: 'Helped 10 times',
  milestone_50: 'Helped 50 times',
  milestone_100: 'Helped 100 times',
  connector: 'Helped 10 different people',
};
// insert:
INSERT INTO reputation.badges (user_id, badge_type, name)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, badge_type) DO NOTHING
// params: [responderId, badge_type, BADGE_NAMES[badge_type]]; a rowCount of 0 is not reported as awarded.
```

### The `match_completed` handler (`subscriber.ts`)

Karma stays first and keeps its rethrow. `updateProviderCompletionRate` and `checkAndAwardBadges` each get a try/catch
inside the existing outer `try`, logging `[provider-trust] completion rate update failed, skipping:` /
`[badges] badge check failed, skipping:` with the match id and the error. The trust-evolution block is unchanged. The
outer catch is then reachable only from the projector, so its "Failed to award karma" message becomes accurate.

### `evaluateUserEvolution` (`trustEvolutionService.ts`)

`const currentValue = Number(effectiveParams[parameter]);` with a comment naming the cause. `getUserEffectiveParams` and
the `GET /reputation/trust-config` response keep returning what pg returns.

---

## Frontend Changes

None. No web or mobile code reads badges or the evolution nudge.

---

## User Guide & Doc Updates

- `docs/guides/understanding-karma-guide.md` *Trust Model Evolution* (`:78-84`): it says the model "evolves
  automatically". Say instead that it calibrates after completed exchanges once both your community and you have
  evolution on (the two switches in `docs/concepts/trust-model-evolution.md:35-42`). Name the repeat-help example
  (three completed exchanges with the same person nudges depth weight) and the 7-day cooldown. This behavior starts
  working with this PR. The same section says the global pause is "from the Trust Score page"; both the pause and the
  per-community toggles are in the profile page's "Trust Evolution Settings" (`apps/frontend/src/pages/profile.tsx:749-767`;
  `pages/reputation/trust.tsx:221` points there). Fix that too.
- `docs/adr/ADR-016-prestige-based-recognition.md`: an amendment (no number needed): Phase 1 badges were never written
  until this fix, why (024 vs the 2025 table), and that a helper's next completion catches up. Status line unchanged.
- Reputation `CONTEXT.md` (Recent Changes entry; badges DDL; the stale "Implement Badge System" sample replaced by a
  pointer to `badgeService.ts`), `README.md:70-72`, `docs/ARCHITECTURE.md:444`, `services/registry.json`
  (`services['reputation-service'].notes`).
- `docs/BUGS.md`: BUG-077 and BUG-079 fixed; BUG-080 logged at planning.
- `tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts:107-108`: its cleanup comment names
  BUG-077 as the reason jobs retry; reword it to a retried job in general.
- Landing: regenerate (ADR page and service pages change); commit the regenerated pages, revert timestamp/HEAD-sha churn.

---

## Out of Scope

- BUG-080 (provider completion rate), BUG-075, BUG-076, BUG-078.
- Making `getUserEffectiveParams`, `getUserTrustConfig` or `getCommunityTrustConfig` return numbers (changes the
  `GET /reputation/trust-config` wire format).
- Adding `name` to `GET /reputation/users/:userId/badges` (no client), a badge UI, a badge notification.
- Schema cleanup of `reputation.badges` (`icon_url`, nullable `badge_type`).
- The per-query SQL log line (`db.ts:40`).
- Any demo backfill or demo repair.

---

## Tests

| Proof | Test | Tier |
|---|---|---|
| Every insert supplies the name; exact names for all five types | `services/reputation-service/tests/tdd/sprint-134-bug-077-badge-insert.test.ts` | tdd → regression |
| A conflict is not reported as awarded | same | tdd → regression |
| A badge or provider failure does not fail the job; evolution still runs; a karma failure still fails it first | `.../tests/tdd/sprint-134-bug-077-handler-isolation.test.ts` | tdd → regression |
| Nudges compute on pg's string NUMERIC values | `.../tests/tdd/sprint-134-bug-079-evolution-numeric.test.ts` | tdd → regression |
| Real SQL: completion over HTTP → job completes on attempt 1, `first_helper` row with its name, one evolution log row (0.60 → 0.61) | `tests/integration/sprint-134-bug-077-completion-side-effects.integration.test.ts` | integration (CI-only here) |
| Real SQL: an injected badge failure leaves the job completed on attempt 1 and evolution still runs | same | integration |
| Real SQL: one check over 100 completions with 10 people writes all five types with names; a second writes nothing | same | integration |

The real-SQL file starts from the BUG-074 file's positive control
(`tests/integration/sprint-134-bug-074-match-status-guards.integration.test.ts:283-303`) and the Sprint 132 directed
file's queue handling (`tests/integration/sprint-132-directed-audience.integration.test.ts:16-17`, `:52-65`). It reads
the Bull job instead of polling for side effects, and stops at the first failed attempt so a red run prints the
`failedReason`.

### Human checks (maintainer, demo, after merge and deploy; each a demo-host read needing its own authorization)

Only what no test can prove:

1. **Demo schema parity.** CI runs `init.sql`; demo's `reputation.badges` grew by migration since 2025. After the
   deploy, the reputation log shows no `violates not-null constraint` and no `Failed to award karma for match` for new
   completions, and shows `🏅 Badge awarded` lines.
2. **PR L2's nightly log (still owed).** Read the reputation log covering the first 02:00Z run after the deploy. This
   also settles whether the window now holds a night (the UNVERIFIED rotation cause above).

Covered by tests, not by a human: the insert shape and names (badge-insert tdd + integration case 3); job success on
the first attempt (integration case 1); isolation (handler-isolation tdd + integration case 2); karma failure still
retried (handler-isolation tdd case 3 and `tests/regression/sprint-126-subscriber-boundary.test.ts:140-148`); evolution
arithmetic (evolution-numeric tdd + integration case 1).

---

## Critical Implementation Notes

1. **Read the schema, not the code.** `reputation.badges` is `id, user_id, name NOT NULL, description, icon_url,
   earned_at, badge_type, community_id` (`init.sql:2093-2102`). Migration 024's DDL is not the table.
2. **No migration and no `init.sql` edit.** The fix is in the insert. `init.sql` is generated; never hand-edit it.
3. **Names are pinned by tests:** `first_helper` 'First help given', `milestone_10` 'Helped 10 times', `milestone_50`
   'Helped 50 times', `milestone_100` 'Helped 100 times', `connector` 'Helped 10 different people'. `BADGE_NAMES` is a
   `Record<BadgeType, string>`, so a new type without a name fails `tsc`.
4. **Report only real inserts:** `if (result.rowCount === 0) continue;` before pushing to the returned list and
   logging. `rowCount === 0`, not `!rowCount`: the root `tests/unit/reputation/prestige-badges.test.ts:63` mocks inserts
   without `rowCount`, and those must still count.
5. **Karma keeps its rethrow and runs first.** Only the projector may fail the job. Never move badges or the provider
   update before karma, and never wrap karma in a catch that swallows.
6. **Each side effect gets its own try/catch** inside the existing outer `try`. Do not restructure or re-indent the
   trust-evolution block. Log prefix, the match id, then the error:
   `console.error('[badges] badge check failed, skipping:', match_id, err)`.
7. **BUG-079 is one coercion at the use site**: `Number(effectiveParams[parameter])` in `evaluateUserEvolution`. Do
   not change the DB helpers or `getUserEffectiveParams`; that changes `GET /reputation/trust-config`'s wire format.
8. **Mocks must return what pg returns.** The BUG-079 tdd file feeds NUMERIC values as strings (`'0.60'`, `'0.50'`).
   Root `jest.config.js` has `resetMocks: true`, which wipes a module-scope `jest.fn(impl)`; use plain functions in
   `jest.mock` factories, or set implementations in `beforeEach` (`sprint-126-subscriber-boundary.test.ts:19-20`).
9. **The real-SQL test is CI-only on this Windows box** (no local Docker). It must type-check
   (`npx tsc --noEmit -p tests/tsconfig.json`, no diagnostics naming the file). Missing infrastructure fails, never
   skips.
10. **Fixture facts, from `init.sql`:** no trigger creates `communities.community_configs`, so insert one row
    (defaults give `community_evolution_enabled true`, `trust_depth_weight 0.60`). Opt the helper in over HTTP with
    `PUT /reputation/trust-config/:userId/:communityId` `{ evolution_enabled: true }`. `help_requests.request_type` and
    `visibility_scope` are enums: in an `INSERT ... SELECT` leave them to their defaults (a text literal in a SELECT
    list will not assign to an enum). Cast status parameters (`$n::varchar`). `karma_records.community_id` has no ON
    DELETE CASCADE (`init.sql:6145`): delete karma before the community.
11. **Read the job, never sleep for it:** `getJob('completion-<match id>')` on `karmyq-completion-reputation`, poll its
    state until `completed` or `attemptsMade > 0`, then assert `{ state: 'completed', attemptsMade: 0, failedReason:
    null, stacktrace: [] }`. Close every Bull queue the test opens, remove the delayed `karmyq-community-evolution` job
    (`jobId` = the community id, `trustEvolutionService.ts:151-158`), and end the reputation-service pool the direct case
    imported (`sprint-126-standing-backfill.integration.test.ts:175-176`).
12. **The injected badge failure is scoped and always dropped:** a `BEFORE INSERT` trigger on `reputation.badges`
    raising only for that case's helper id, dropped in `finally` after the job is read (pattern:
    `sprint-132-directed-audience.integration.test.ts:234-253`).
13. **Tests first:** reputation-service `tests/tdd/` (red), then the code; promote with
    `node scripts/promote-tdd-tests.js` (`.npmrc` sets `ignore-scripts`, so `npm test` never runs it) and restore every
    unrelated file it sweeps (`services/reputation-service/tests/tdd/sprint-125-provider-reputation-auth.test.ts` is
    already there).
14. **No dependency or lockfile change** beyond the root version: `package.json` and the two root `"version"` lines in
    `package-lock.json`.
15. **No JWT claim reads, no new routes.** The claim gate (`tests/regression/sprint-134-pr-k-claim-gate.test.ts`) must
    stay green; this PR touches no route.
16. **Ask before** any merge ("admin merge, yes/no?"), any demo-host operation, any CodeQL dismissal. No ADR number is
    needed (ADR-016 amendment).
