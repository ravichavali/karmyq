# Sprint 10: Complete — Observability + Simulation Hardening

## Handoff Document for New Conversation

**Date**: 2026-03-04
**Current Version**: v9.1.0
**Status**: Sprint 10 fully complete. Simulation is running. Grafana is live. All known bugs fixed.

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

## Open Design Questions (Next Sprint Candidates)

1. **Provider completion_rate always 0** — match completion events not wired to reputation service for providers (Phase 2)
2. **Community trust visibility** — should provider trust scores be public or admin-only? (ADR-040 open)
3. **Collective trust score formula** — currently avg of member scores; dedicated formula in Phase 2
4. **Landing page framing** — `apps/landing/src/data/docs/concepts/platform-overview.json` uses absolutist anti-transactional language; needs nuanced reframe (dedicated session)
5. **"ephemeral acts, lasting impact" reframe** — across trust/karma docs (see `.claude/IDEAS.md`)
6. **Simulation state drift** — after deploy, simulation restarts but founders may re-join communities they're already in (409 conflicts). State isn't persisted across restarts. Consider: checkpoint state to DB, or accept the noise.
7. **Simulation auto-restart on deploy** — currently manually `pm2 restart karmyq-simulation` after each deploy. Could wire into `deploy.sh`.

---

## Quick Start for Next Session

1. Check this handoff
2. `cat simulation/.claude/README.md` if working on simulation
3. `cat services/request-service/.claude/README.md` if working on providers/collectives
4. Pick an item from Open Design Questions above

---

## Test Status
- All unit + regression tests passing (pre-push hook verified on every commit)
- Deployed: karmyq.com (commit 49b02bd) green
- Simulation running: pm2 `karmyq-simulation`
