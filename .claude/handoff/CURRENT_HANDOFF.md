# Sprint 13 & 14 — Ready to Execute

## Handoff Document for New Conversation

**Date**: 2026-03-04
**Current Version**: v9.1.0
**Status**: Sprint 11 & 12 complete and deployed. Sprint 13 & 14 planned below.

---

## What Was Completed Last Session (Sprints 11 & 12)

### Code
- `services/reputation-service/src/events/subscriber.ts` — `updateProviderCompletionRate()` wired to `match_completed`
- `tests/unit/reputation/provider-completion-rate.test.ts` — 5 unit tests
- `simulation/workflows/data.ts` — 15 provider templates, `pickProvider()` exported
- `simulation/workflows/index.ts` — `registerAsProvider()` uses `pickProvider()`

### Docs
- `docs/adr/ADR-043-three-score-model.md` — Karma / Personal Trust / Provider Trust are independent
- `docs/concepts/trust-and-karma.md` — new concept page (three-score explainer)
- `docs/concepts/platform-overview.md`, `what-is-karma.md`, `neighborhood-service-layer.md` — two-layer reframe
- `scripts/generate-docs.ts` — `trust-and-karma` added to nav/order

### Karma Docs Bug Fixed (end of session)
**The "karma transfers" framing in the docs was wrong.** The actual implementation (karmaService.ts) mints karma fresh for BOTH parties on match completion — neither the helper nor the requester loses karma. Both earn it (helper ~60%, requester ~40% of pool).

Fixed in:
- `docs/concepts/what-is-karma.md` — "How Karma Flows" section rewritten; removed "Spending karma" section
- `docs/concepts/platform-overview.md` — step 4 corrected: "both parties earn karma"
- `docs/concepts/trust-and-karma.md` — was already correct ("both the helper and the requester earn karma")
- Landing JSONs regenerated via `npx tsx scripts/generate-docs.ts`

**These karma docs fixes are NOT yet committed.** Commit them before starting Sprint 13.

---

## Uncommitted Changes — Commit First

```bash
cd c:/Users/ravic/development/karmyq

# Commit karma docs fix
git add docs/concepts/what-is-karma.md docs/concepts/platform-overview.md
# (landing JSONs are auto-tracked)
git commit -m "fix(docs): correct karma model — both parties earn karma, not a transfer

Karma is minted fresh on match completion. Helper earns ~60%, requester
earns ~40%. Neither party loses karma. Removed misleading 'Spending karma'
framing from what-is-karma.md and fixed platform-overview step 4."

git push origin master
```

---

## Sprint 13: Simulation Hardening

**Theme**: Make the simulation survive restarts without 409 conflicts.

### 13.1 — Verify `pricing_notes` accepted by request-service
- File: `services/request-service/src/routes/providers.ts`
- Simulation now passes `pricing_notes` from provider templates — verify it's stored in the DB and returned in GET
- If missing from INSERT: add it, update `services/request-service/CONTEXT.md`
- Complexity: low (check + possible 1-line fix)

### 13.2 — Fix simulation state drift (restart resilience)
- **Problem**: On `pm2 restart`, founder personas re-run `createCommunity`/`joinCommunity` → 409 conflicts
- **Fix**: After persona init in `simulation/scripts/run.ts`, call API to rehydrate state BEFORE entering the workflow loop
  - Call `getMyCommunities()` → populate `state.communityIds`
  - Call `getMyProviderProfile()` → populate `state.isProvider`, `state.providerProfileId`
  - Call `getMyCollectives()` → populate `state.collectiveIds`
- Files: `simulation/scripts/run.ts`, `simulation/api/client.ts` (add missing GET endpoints if needed)
- Complexity: medium

### 13.3 — Wire simulation auto-restart into deploy.sh
- File: `scripts/deploy.sh`
- After `npm run health:check` passes, add: `pm2 restart karmyq-simulation || true`
- Complexity: low (1 line)

---

## Sprint 14: Provider Trust Closure + Prestige Badges

**Theme**: Close ADR-040 and ship the first prestige recognition feature.

### 14.1 — Close ADR-040: Provider trust visibility (docs only)
- Provider trust scores are already public (visible via `GET /requests/providers` without auth — confirmed in migration 022)
- ADR-040 status is "Accepted" but never marked Implemented
- Update `docs/adr/ADR-040-community-trust-score.md` status → Implemented, add confirmation note
- Update `docs/adr/README.md` entry

### 14.2 — Prestige Badges: Phase 1
- **Migration**: `infrastructure/postgres/migrations/024-prestige-badges.sql`
  - Table: `reputation.badges (id, user_id, community_id nullable, badge_type, earned_at)`
  - Badge types: `first_helper`, `milestone_10`, `milestone_50`, `milestone_100`, `connector`
- **Backend**: Extend `match_completed` handler in `services/reputation-service/src/events/subscriber.ts`
  - After karma is awarded, check and insert badge rows where criteria are met
  - `connector` badge: awarded when `distinct_people_count >= 10` (already computed in `trustMetricsDb`)
- **API**: `GET /reputation/users/:id/badges` → new route in `services/reputation-service/src/routes/`
- **Frontend**: Badge icons on profile page in `apps/frontend/`
- **Tests**: `tests/unit/reputation/prestige-badges.test.ts`
- Complexity: medium-high

---

## Key Files for Sprint 13

| Task | Files |
|------|-------|
| 13.1 | `services/request-service/src/routes/providers.ts` |
| 13.2 | `simulation/scripts/run.ts`, `simulation/api/client.ts`, `simulation/personas/types.ts` |
| 13.3 | `scripts/deploy.sh` |

## Key Files for Sprint 14

| Task | Files |
|------|-------|
| 14.1 | `docs/adr/ADR-040-community-trust-score.md`, `docs/adr/README.md` |
| 14.2 | `infrastructure/postgres/migrations/024-prestige-badges.sql`, `services/reputation-service/src/events/subscriber.ts`, `services/reputation-service/src/routes/`, `tests/unit/reputation/`, `apps/frontend/` |

---

## Quick Start for Next Session

1. Read this handoff
2. Commit the karma docs fix (exact command above)
3. Read `services/request-service/.claude/README.md`
4. Start with 13.1: check `services/request-service/src/routes/providers.ts` for `pricing_notes`

---

## Remaining Open Questions (Backlog — Sprint 15+)

1. **Collective trust score formula** — currently avg of member scores; dedicated formula Phase 2
2. **"Ephemeral acts, lasting impact" reframe** — language shift across trust/karma docs (see `.claude/IDEAS.md`)
3. **Simulation state persistence** — state not persisted across restarts (13.2 is a workaround via API rehydration)
4. **Phase 3 Roadmap** — Karmyq Rides vertical with PostGIS distance matching (not started)

---

## Test Status
- All unit + regression tests passing
- Deployed: karmyq.com (commit 5a6d207) green
- Simulation running: pm2 `karmyq-simulation`
