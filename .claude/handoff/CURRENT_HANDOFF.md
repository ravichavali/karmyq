# Sprint 11 & 12 — Complete

## Handoff Document for New Conversation

**Date**: 2026-03-04
**Current Version**: v9.1.0
**Status**: Sprint 11 & 12 fully implemented. Uncommitted — commit and deploy before starting Sprint 13.

---

## What Was Completed This Session

### Sprint 11 Workstream 1.1 — Provider completion_rate wired (reputation-service)

- **File changed**: `services/reputation-service/src/events/subscriber.ts`
- Added `updateProviderCompletionRate(responder_id)` called after `awardKarmaForCompletedMatch` in the `match_completed` handler
- Function is exported for testability
- Logic: query `requests.provider_profiles WHERE user_id = responder_id AND is_active = TRUE` (cross-schema, no FK — plain UUID join)
- For each profile: count `completed_matches / accepted_matches` from `requests.matches`, upsert `reputation.provider_trust_scores` with new `completion_rate` and recalculated `trust_score` (formula: 60% avg_stars + 30% completion_rate + 10% response_rate)
- **Tests**: `tests/unit/reputation/provider-completion-rate.test.ts` — 5 tests, all passing

### Sprint 11 Workstream 1.2 — Three-score model documented

- **New ADR**: `docs/adr/ADR-043-three-score-model.md` — canonical statement that Karma / Personal Trust / Provider Trust are intentionally independent and do not feed into each other
- **New landing concept**: `apps/landing/src/data/docs/concepts/trust-and-karma.json` — plain-English three-score explainer with comparison table
- **New landing ADR**: `apps/landing/src/data/docs/concepts/adr-043-three-score-model.json`
- **nav.json updated** (two entries): "Trust and Karma: Three Scores Explained" added to "How It Works"; "Three-Score Model" ADR added to "Architecture Decisions" after ADR-042

### Sprint 11 Workstream 1.3 — Simulation provider templates refactored

- **`simulation/workflows/data.ts`**: Added `ProviderTemplate` interface, 15 provider templates (5 per type: `RIDE_PROVIDERS`, `SERVICE_PROVIDERS`, `BORROW_PROVIDERS`), exported `pickProvider()` function mirroring `pickRequest()` pattern
- **`simulation/workflows/index.ts`**: Removed inline `PROVIDER_DISPLAY_NAMES`, `PROVIDER_BIOS`, `PROVIDER_SERVICE_TYPES` constants; `registerAsProvider()` now calls `pickProvider()` and passes all template fields including `pricing_notes` and `location_notes` to `client.registerAsProvider()`

### Sprint 12 — Landing page reframe (3 concept pages)

- **`platform-overview.json`**: Title unchanged. Description and content reframed: "Mutual Aid, Not a Marketplace" → "Mutual Aid Communities + Professional Services"; "The Problem with Marketplaces" → "Why Marketplaces Alone Don't Work for Mutual Aid"; karma description clarified as community-scoped; added "Two Layers, One Neighborhood" closing section
- **`what-is-karma.json`**: Added "What About Professional Services?" section after "Why Not Just Use Money?" — acknowledges Layer 2, links to `neighborhood-service-layer` and `trust-and-karma`
- **`neighborhood-service-layer.json`**: Two-layer comparison table moved to opening (before "The Rickshaw Stand"); added `Ratings privacy` row explaining why Layer 1 is private and Layer 2 is public; "coordination infrastructure" reframed to "directory where neighbors offer services directly"

---

## Before Anything Else: Commit and Deploy

Sprint 11 & 12 changes are **not yet committed**. Changed files:

```
services/reputation-service/src/events/subscriber.ts
tests/unit/reputation/provider-completion-rate.test.ts
docs/adr/ADR-043-three-score-model.md
apps/landing/src/data/docs/concepts/trust-and-karma.json
apps/landing/src/data/docs/concepts/adr-043-three-score-model.json
apps/landing/src/data/docs/concepts/platform-overview.json
apps/landing/src/data/docs/concepts/what-is-karma.json
apps/landing/src/data/docs/concepts/neighborhood-service-layer.json
apps/landing/src/data/docs/nav.json
simulation/workflows/data.ts
simulation/workflows/index.ts
```

```bash
# Verify tests still pass
cd tests && npm test

# Commit
git add services/reputation-service/src/events/subscriber.ts \
  tests/unit/reputation/provider-completion-rate.test.ts \
  docs/adr/ADR-043-three-score-model.md \
  apps/landing/src/data/docs/concepts/trust-and-karma.json \
  apps/landing/src/data/docs/concepts/adr-043-three-score-model.json \
  apps/landing/src/data/docs/concepts/platform-overview.json \
  apps/landing/src/data/docs/concepts/what-is-karma.json \
  apps/landing/src/data/docs/concepts/neighborhood-service-layer.json \
  apps/landing/src/data/docs/nav.json \
  simulation/workflows/data.ts \
  simulation/workflows/index.ts

git commit -m "feat(sprint-11-12): wire provider completion_rate, three-score ADR, provider templates, landing reframe"

# Deploy
git push origin master
```

---

## Current State Checks

```bash
# On demo server (ssh ubuntu@karmyq.com)
pm2 status
npm run health:check
curl -s http://localhost:3003/providers | head -30
open https://karmyq.com/grafana/  # admin / admin
```

---

## Remaining Open Questions (Backlog — Sprint 13+)

1. **Community trust visibility** — should provider trust scores be public or admin-only? (ADR-040 open)
2. **Collective trust score formula** — currently avg of member scores; dedicated formula deferred to Phase 2
3. **"ephemeral acts, lasting impact" reframe** — across trust/karma docs (see `.claude/IDEAS.md`)
4. **Simulation state drift** — after deploy, founders may re-join communities (409 conflicts). State not persisted across restarts.
5. **Simulation auto-restart on deploy** — currently manual `pm2 restart karmyq-simulation`. Could wire into `deploy.sh`.
6. **`pricing_notes` field on `registerAsProvider` API** — `simulation/workflows/index.ts` now passes `pricing_notes` from templates; verify `request-service` provider registration endpoint accepts this field (it may be ignored silently — check `services/request-service/src/routes/providers.ts`)

---

## Quick Start for Next Session

1. Read this handoff
2. Commit and deploy (see "Before Anything Else" above)
3. Then: pick a backlog item from open questions above, or start Sprint 13 planning
