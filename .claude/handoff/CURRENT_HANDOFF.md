# Sprint 11 & 12 Plan — Ready to Execute

## Handoff Document for New Conversation

**Date**: 2026-03-04
**Current Version**: v9.1.0
**Status**: Sprint 10 complete. Sprint 11 & 12 planned and ready to execute. Full plan in `.claude/plans/snappy-wandering-bachman.md`.

---

## What Was Completed This Sprint

### Sprint 10 Workstream A — Provider/Collective Backend + Frontend (commit 0a196fa, fixed e41151f)
- Migration 023: `provider_collectives`, `provider_collective_members`, `collective_community_links`
  - IMPORTANT: `collective_community_links.community_id` is plain UUID (no FK to `community.communities`)
  - Cross-schema FKs fail on demo server — always use plain UUIDs for cross-schema references
- request-service: 9 collective endpoints at `/requests/collectives`
- community-service: provider config fields (`provider_services_enabled`, `provider_min_personal_trust_score`, `provider_services_list`)
- Frontend: 7 provider components, 5 provider pages, "Service Providers" nav link, Providers admin tab

### Sprint 10 Workstream B — Simulation (commits 78f742d, 99ab183, 49b02bd)

The simulation is a fully standalone package at `simulation/` (NOT `services/simulation-service/`). It uses worker_threads, one per persona, running against the real API.

**Bugs fixed this session:**
1. `api/client.ts` — provider/collective paths missing `/requests` prefix (404 on all calls)
2. `scripts/run.ts` — invitee `communityIds` hardcoded to `[]` after `acceptInvite()`; fixed with `getMyCommunities()` call
3. `workflows/index.ts` — `registerAsProvider` had spurious `communityIds.length === 0` guard; removed
4. `scripts/run.ts` — TypeScript strict mode rejected `ActionWeights` as `Record<string,number>`; fixed with explicit casts

**Current simulation state (as of 2026-03-04):**
- 5 founder personas active with steady load profile
- SIM_TICK_INTERVAL_MS=120000 (2 min ticks), SIM_CONCURRENCY=5
- All 11 workflows functional: `browseRequests`, `createRequest`, `offerHelp`, `acceptOffer`, `completeMatch`, `sendMessage`, `generateInvite`, `joinCommunity`, `createCommunity`, `registerAsProvider`, `joinCollective`
- Provider registration now succeeds for James (activeHelper persona, high `registerAsProvider` weight)

### Sprint 10 Workstream C — Docs (commit 0a196fa)
- `docs/guides/using-service-providers-guide.md` — source guide
- `apps/landing/src/data/docs/guides/using-service-providers.json` — landing page
- `services/request-service/CONTEXT.md` — 14 endpoint headings added

### Observability (commits c139ef0, 499052c, 517ded5, 57830bb, others)
- Grafana accessible at `https://karmyq.com/grafana/`
- 3 dashboards: Infrastructure, Service Overview, Simulation Overview
- cAdvisor + node_exporter in docker-compose, scraped by Prometheus
- **Critical**: cgroup v2 on kernel 6.14 (Oracle Cloud ARM64) — cadvisor v0.47 cannot expose `name` labels for Docker containers. All container panels use `id=~".+docker-.+scope"` filter + `label_replace` to extract 12-char hashes. **Never revert to `name=~"karmyq-.*"` queries — they will never match.**

---

## Current State Checks

```bash
# On demo server (ssh ubuntu@karmyq.com)

# Simulation health
pm2 status
pm2 logs karmyq-simulation --lines 20

# Verify providers are being created
curl -s http://localhost:3003/providers | python3 -m json.tool | head -30

# Grafana
open https://karmyq.com/grafana/  # admin / admin

# All services
npm run health:check
```

---

## Next: Sprint 11 & 12 (Planned — Ready to Execute)

Full plan: `.claude/plans/snappy-wandering-bachman.md`

### Sprint 11: Provider Reputation + Trust Model Clarity

**1.1 Wire provider completion_rate** (code — medium complexity)
- File: `services/reputation-service/src/events/subscriber.ts`
- In `match_completed` handler: after awarding karma, cross-schema query `requests.provider_profiles WHERE user_id = responder_id`
- If provider found: calculate `completion_rate = completed_matches / accepted_matches`, UPDATE `reputation.provider_trust_scores`, re-run `recalculateProviderTrustScore()`
- Add tests in `tests/unit/reputation/`

**1.2 Document the three-score model** (ADR + landing concept page)
- New: `docs/adr/ADR-043-three-score-model.md` — Karma (Layer 1 currency) / Personal Trust (relational) / Provider Trust (commercial reliability) are intentionally separate, don't feed into each other
- New: `apps/landing/src/data/docs/concepts/trust-and-karma.json` — plain-English three-score explainer with comparison table
- Update: `apps/landing/src/data/docs/nav.json` — add to Concepts

**1.3 Simulation provider templates refactor** (code — low risk)
- Move `PROVIDER_DISPLAY_NAMES` + `PROVIDER_BIOS` from `simulation/workflows/index.ts` into `simulation/workflows/data.ts`
- Create `PROVIDER_TEMPLATES` interface + `pickProvider()` — mirrors existing `pickRequest()` pattern
- Expand to ~15 templates (5 per service type: ride/service/borrow) with all fields: `service_type`, `display_name`, `bio`, `pricing_notes`, `location_notes`

---

### Sprint 12: Landing Page Reframe

**2.1** `apps/landing/src/data/docs/concepts/platform-overview.json`
- "Mutual Aid, Not a Marketplace" → "Mutual Aid Communities + Professional Services"
- "The Problem with Marketplaces" → "Why Marketplaces Alone Don't Work for Mutual Aid"
- "Karma replaces money" → "Karma is the unit of exchange within communities — services are arranged separately"
- Add 2-sentence "Two Layers" closing section

**2.2** `apps/landing/src/data/docs/concepts/what-is-karma.json`
- Add paragraph after "Why Not Just Use Money?" acknowledging Layer 2 (provider services)
- Link to `neighborhood-service-layer` and `trust-and-karma`

**2.3** `apps/landing/src/data/docs/concepts/neighborhood-service-layer.json`
- Move two-layer comparison table to opening section
- Reframe "coordination infrastructure, not a marketplace" → "directory where neighbors offer services directly"
- Add explanation of why Layer 1 ratings are private but Layer 2 ratings are public

---

## Remaining Open Questions (Backlog)

1. **Community trust visibility** — should provider trust scores be public or admin-only? (ADR-040 open)
2. **Collective trust score formula** — currently avg of member scores; dedicated formula in Phase 2
3. **"ephemeral acts, lasting impact" reframe** — across trust/karma docs (see `.claude/IDEAS.md`)
4. **Simulation state drift** — after deploy, founders may re-join communities (409 conflicts). State not persisted across restarts.
5. **Simulation auto-restart on deploy** — currently manual `pm2 restart karmyq-simulation`. Could wire into `deploy.sh`.

---

## Quick Start for Next Session

1. Read this handoff
2. Read full sprint plan: `.claude/plans/snappy-wandering-bachman.md`
3. Start with Sprint 11, Workstream 1.1 (`services/reputation-service/src/events/subscriber.ts`)
4. `cat services/reputation-service/.claude/README.md` before editing

---

## Test Status
- All unit + regression tests passing (pre-push hook verified on every commit)
- Deployed: karmyq.com (commit 49b02bd) green
- Simulation running: pm2 `karmyq-simulation`
