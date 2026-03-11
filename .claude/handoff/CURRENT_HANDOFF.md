# Sprint 23 — Next Sprint (TBD)

## Handoff Document for New Conversation

**Date**: 2026-03-11
**Current Version**: v9.1.0 (Sprint 22 deployed ✅ — pending migration on demo server)
**Status**: Sprint 22 complete and merged to master. Sprint 23 not yet planned.

---

## ⚡ Quick Start

Sprint 22 is merged. Before pushing to deploy:

**1. Apply the migration on the demo server** (REQUIRED before deploy):
```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < infrastructure/postgres/migrations/20260311-network-cohesion-metrics.sql
```

**2. Then deploy:**
```bash
git push origin master  # GitHub Actions handles deployment
```

**3. Plan Sprint 23** — no plan exists yet. Brainstorm next sprint goals.

---

## ✅ What Was Completed This Session (Sprint 22)

### Sprint 22 — Community Trust Stats Dashboard + Network Cohesion Score

All 7 tracks delivered and merged to master (`63362af`):

**Track 1 (frontend): ADR-040 Trust Breakdown in Stats Tab**
- `apps/frontend/src/pages/communities/[id].tsx` — added `communityTrust` state + `fetchCommunityTrust()`
- Color-coded trust score bar (green/teal/orange/brown)
- 3 sub-scores: Member Quality (40pts), Bonding (30pts), Bridging (30pts)
- Trend indicator: ↑/↓ delta from `previous_score`

**Track 2 (frontend): Member Trust Scores in Members Tab**
- Batch-fetches trust scores for all active members via `Promise.allSettled`
- Badge: `★ {score}` (green ≥75, amber ≥50, gray <50) or `—` for null

**Track 3 (migration + backend): Trust Score Trend**
- Migration: `previous_score`, `previous_calculated_at` columns
- Cron: saves previous score before each daily recalculation

**Track 4 (backend + frontend): Network Cohesion Score**
- New endpoint: `GET /reputation/network-metrics/:communityId`
- `services/reputation-service/src/services/networkCohesionService.ts` — 4 graph metrics:
  - Reciprocity, Density (90-day window), Watts-Strogatz Clustering, Avg Path Length
  - Composite score 0-100, labels: Fragile/Emerging/Developing/Cohesive/Highly Cohesive
- Daily cron stores results in `reputation.community_trust_scores`
- Frontend panel in stats tab with all 4 sub-metrics + plain-language labels
- **ADR-045** (`docs/adr/ADR-045-network-cohesion-score.md`)

**Track 5 (docs): Landing Page**
- `docs/concepts/network-cohesion.md` — 3-tier content (plain/measured/technical)
- `scripts/generate-docs.ts` — added to `howItWorks` and `ADR_GROUPS`

**Track 6 (tests)**
- `apps/frontend/tests/tdd/CommunityStatsTab.test.tsx` — 8 tests passing
- `services/reputation-service/tests/unit/networkCohesion.test.ts` — 5 tests passing

### Key Files Changed in Sprint 22

| Area | File |
|------|------|
| DB migration | `infrastructure/postgres/migrations/20260311-network-cohesion-metrics.sql` |
| init.sql (synced) | `infrastructure/postgres/init.sql` |
| Network cohesion service | `services/reputation-service/src/services/networkCohesionService.ts` |
| Community trust DB types | `services/reputation-service/src/database/communityTrustDb.ts` |
| Cron updated | `services/reputation-service/src/services/communityTrustService.ts` |
| New endpoint | `services/reputation-service/src/routes/health.ts` |
| Community page | `apps/frontend/src/pages/communities/[id].tsx` |
| API client | `apps/frontend/src/lib/api.ts` |
| ADR | `docs/adr/ADR-045-network-cohesion-score.md` |
| Registry | `services/registry.json` |

---

## 🎯 Sprint 23 — Not Yet Planned

No plan exists. Start next session by brainstorming Sprint 23 goals.

Possible areas to explore:
- Surfacing network cohesion data in community discovery (not just admin stats)
- Notification system improvements
- Mobile app work
- Simulation improvements (more realistic request/match patterns)

---

## Persistent Context (carry forward always)

- **Migration runner**: `deploy.sh` does NOT auto-run migrations. Apply manually: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < migration.sql`
- **Landing page docs**: Edit source markdown in `docs/concepts/` and `docs/adr/`. `scripts/generate-docs.ts` has hardcoded nav arrays (`whyKarmyq`, `howItWorks`, `ADR_GROUPS`, `GUIDE_ORDER`) — new pages must be added there.
- **Community page is the admin page** — `/communities/[id]/admin` redirects to `/communities/[id]`. Admin tabs are role-gated.
- **init.sql must stay in sync with migrations** — add new columns/tables to both.
- **Trust score is 0-100 integer** — stored as integer, display as-is, do not multiply by 100.
- **Tests/ excluded from main tsconfig** — `apps/frontend/tsconfig.json` excludes `tests/**`. Test type-checking handled by ts-jest.
- **LSP diagnostics are false positives** — VSCode shows parse errors that aren't real. `npx tsc --noEmit` is the source of truth.
- **Provider service types** — Valid API types: `ride`, `tradesperson`, `tutor`, `other`. Never use `skill`, `errand`, `care`.
- **Simulation community name** — `create-collective-workflow` looks up by exact name `'PDX Service Providers Network'`.
- **Sim email domain** — `@test.karmyq.com`. Wipe: `DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com'`.
- **No bulk user creation scripts** — simulation grows organically. Do NOT re-create `create-simulated-users.js`.
- **JWT communities cap** — auth service caps communities in JWT at 15 (`JWT_COMMUNITIES_LIMIT`). Full membership always checked via DB.
- **Auto-generated files gitignored** — `services/dependency-graph.md`, `impact-analysis.md`, `version-drift.md` are generated by pre-commit hook and ignored by git.
- **No worktrees** — solo developer workflow. Work directly on a feature branch (`git checkout -b feature/sprint-NN`). Worktrees cause npm install overhead and jest path bugs.
- **Network cohesion 90-day window** — both active member count (N) and edge data are filtered to 90 days to keep density ≤ 1.
