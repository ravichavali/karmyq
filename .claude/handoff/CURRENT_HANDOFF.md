# Sprint 15 — Fractal Community Model (Phase 1 Complete)

## Handoff Document for New Conversation

**Date**: 2026-03-04
**Current Version**: v9.2.0 (Sprint 15)
**Status**: Sprint 15 Phase 1 implemented. All code written and tested — NOT yet committed. Deployment of sprint 13–14 still pending (see below).

---

## What Was Completed This Session (Sprint 15)

### All new files (uncommitted, on master branch)

| File | Action | Description |
|------|--------|-------------|
| `docs/concepts/community-scale.md` | Created | Fractal community model concept doc |
| `docs/adr/ADR-018-community-splitting-mechanics.md` | Updated | Status → Accepted; Phase 1 schema + approach documented |
| `apps/landing/src/data/docs/concepts/adr-018-community-splitting-mechanics.json` | Updated | Status → accepted |
| `infrastructure/postgres/migrations/025-community-links.sql` | Created | `communities.community_links` table + indexes + trigger |
| `services/community-service/src/routes/links.ts` | Created | 4 CRUD endpoints for community links |
| `services/community-service/src/index.ts` | Updated | Registered `linksRouter` under `/communities` |
| `services/community-service/CONTEXT.md` | Updated | New schema + endpoints documented |
| `services/registry.json` | Updated | New endpoints + notes for community-service |
| `services/request-service/src/routes/requests.ts` | Updated | `GET /requests/curated` now supports `?includeSisterCommunities=true` |
| `services/request-service/CONTEXT.md` | Updated | New query param documented |
| `tests/tdd/community-links.test.ts` | Created | 18 TDD tests — all passing |
| `tests/tdd/feed-sister-communities.test.ts` | Created | 12 TDD tests — all passing |
| `apps/frontend/src/lib/api.ts` | Updated | `communityLinksService` API methods added |
| `apps/frontend/src/components/community/CommunityLinks.tsx` | Created | Admin UI for linking communities |

### Test Results
```
30 tests passing in tests/tdd/ (community-links + feed-sister-communities)
```

### Key Design Decisions Made

1. **Schema is `communities.` (plural)** — matches the existing Postgres schema name; handoff had `community.` (singular) which was wrong. All files use `communities.community_links`.

2. **Curated endpoint lives in request-service** (not feed-service) — the handoff assumed feed-service but the actual implementation has always been in `services/request-service/src/routes/requests.ts`. Extended in-place.

3. **Sister community requests score = feedScore × trust_carry_factor** — applied at scoring time, not query time, so sorting/filtering works correctly.

4. **Trust carry defaults by type**:
   - `sister` → 0.40
   - `split_origin` → 0.50
   - `parent_child` → 0.60

5. **Sister tier = `sister_community`** — ordered after `platform` (tier 3) in the `tierOrder` map.

---

## Pending: Commit + Deploy

### Step 1: Commit Sprint 15 work
Nothing has been committed yet. Run pre-commit check first:
```bash
npm run feedback:check
npm test
npm run test:tdd
```
Then commit:
```bash
git add \
  docs/concepts/community-scale.md \
  docs/adr/ADR-018-community-splitting-mechanics.md \
  apps/landing/src/data/docs/concepts/adr-018-community-splitting-mechanics.json \
  infrastructure/postgres/migrations/025-community-links.sql \
  services/community-service/src/routes/links.ts \
  services/community-service/src/index.ts \
  services/community-service/CONTEXT.md \
  services/registry.json \
  services/request-service/src/routes/requests.ts \
  services/request-service/CONTEXT.md \
  tests/tdd/community-links.test.ts \
  tests/tdd/feed-sister-communities.test.ts \
  apps/frontend/src/lib/api.ts \
  apps/frontend/src/components/community/CommunityLinks.tsx

git commit -m "feat(sprint-15): fractal community model Phase 1 (community links + sister feeds)"
```

### Step 2: Deploy to demo server
```bash
git push origin master
# GitHub Actions runs tests + deploys automatically
```

### Step 3: Run migrations on demo DB
```bash
# deploy.sh does NOT auto-run migrations — must run manually:
psql $DATABASE_URL -f infrastructure/postgres/migrations/024-prestige-badges.sql
psql $DATABASE_URL -f infrastructure/postgres/migrations/025-community-links.sql
```

---

## Sprint 16 Candidates

### High priority
1. **Karma vs Trust design session** — ADR-043 documents the three-score model but IDEAS.md notes a design session is needed. No code — just clarifying the product narrative.
2. **Phase 2 prestige badges**: `bridge` (cross-community match), `ambassador` (5+ matches across 2+ sister communities). Depends on migration 025 in prod.
3. **Wire CommunityLinks.tsx into admin page** — component exists at `apps/frontend/src/components/community/CommunityLinks.tsx`; needs to be imported in the community admin/settings page in `apps/frontend/src/app/(dashboard)/`.

### Medium priority
4. **ADR-017 Phase 2** — cohort layers as notification priority
5. **Provider templates** — refactor hardcoded arrays in simulation `data.ts` (tracked in `docs/IDEAS.md`)
6. **Community trust visibility** (ADR-040 open question)

---

## Quick Start for Next Session

1. Read this handoff
2. Verify: `npm run test:tdd` → 30 tests should pass
3. Commit Sprint 15: use the `git add` + `git commit` command above
4. Push + deploy: `git push origin master`
5. SSH to demo server, run migrations 024 + 025
6. Begin Sprint 16 with Karma vs Trust design session

---

## Key Files for Sprint 16

| Task | Files |
|------|-------|
| Wire CommunityLinks UI | `apps/frontend/src/app/(dashboard)/` — find community admin/settings page |
| Phase 2 badges | `services/reputation-service/src/services/badgeService.ts` |
| Community links API | `services/community-service/src/routes/links.ts` |
| Karma/Trust docs | `docs/adr/ADR-043-three-score-model.md`, `docs/IDEAS.md` |
