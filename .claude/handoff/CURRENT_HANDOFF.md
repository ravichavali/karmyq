# Sprint 15 Prep — Fractal Community Model

## Handoff Document for New Conversation

**Date**: 2026-03-04
**Current Version**: v9.1.0
**Status**: Sprints 13 & 14 complete and merged to master. Sprint 15 requires a design session before implementation.

---

## What Was Completed This Session (Sprints 13 & 14)

### Commits (on master, not yet pushed to origin)
- `2fad495` — chore(sprint-13): move IDEAS.md to docs/ + update capture skill
- `5933454` — feat(sprint-13): fix simulation state drift on restart
- `c660ad1` — docs(sprint-13): update CONTEXT.md and registry for new /my endpoints
- `6e5d4d7` — feat(sprint-14): prestige badges Phase 1 (ADR-016)

### Sprint 13 — Simulation Hardening

**13.0 — IDEAS.md moved**
- `git mv .claude/IDEAS.md docs/IDEAS.md`
- `/capture` skill updated — now references `docs/IDEAS.md` throughout
- **Going forward**: always use `docs/IDEAS.md`. `.claude/IDEAS.md` no longer exists.

**13.2 — Simulation restart resilience**
- `GET /requests/providers/my` added to `services/request-service/src/routes/providers.ts` (line 50) — returns auth'd user's own provider profiles
- `GET /requests/collectives/my` added to `services/request-service/src/routes/collectives.ts` — returns collectives user belongs to
- `getMyProviderProfiles()` + `getMyCollectives()` added to `simulation/api/client.ts`
- Worker in `simulation/scripts/run.ts` (line 99–116) rehydrates `communityIds`, `isProvider`, `providerProfileId`, `collectiveIds` from API after login — eliminates 409 conflicts on `pm2 restart`

**13.1, 13.3** — Already implemented in prior sprints. No changes needed.

### Sprint 14 — Prestige Badges Phase 1

**14.2 — Prestige Badges**
- Migration: `infrastructure/postgres/migrations/024-prestige-badges.sql` — `reputation.badges (id, user_id, community_id nullable, badge_type, earned_at)` with `unique(user_id, badge_type)`
- Service: `services/reputation-service/src/services/badgeService.ts` — `checkAndAwardBadges(responderId)`, `getUserBadges(userId)`
- Wired: `services/reputation-service/src/events/subscriber.ts` line 85 — called after `updateProviderCompletionRate` in `match_completed` handler
- API: `GET /reputation/users/:userId/badges` in `services/reputation-service/src/routes/reputation.ts`
- Tests: `tests/unit/reputation/prestige-badges.test.ts` — 11 tests, all passing
- ADR-016 status → Partially Implemented (Phase 1); `docs/adr/ADR-016-prestige-based-recognition.md` updated

**Badge types Phase 1**: `first_helper`, `milestone_10`, `milestone_50`, `milestone_100`, `connector` (10+ distinct people helped)

**14.1 — ADR-040** — Already marked Implemented in prior sprint. No change needed.

### Test Status
- **251 tests passing** (unit + regression) on merged master
- 2 pre-existing suite-level failures (import resolution in request-service — not our work)

---

## Deployment Note

master is **5 commits ahead of origin/master**. These commits have NOT been pushed or deployed:
- `d1f257c`, `2fad495`, `5933454`, `c660ad1`, `6e5d4d7`

To deploy: `git push origin master` → GitHub Actions deploys automatically.

**Before deploying**, run migration 024 on the demo DB:
```bash
# On karmyq.com server (or deploy.sh will need to handle it)
psql $DATABASE_URL -f infrastructure/postgres/migrations/024-prestige-badges.sql
```

---

## Sprint 15: Fractal Community Model

**Status**: Design session required before implementation.

### The Fractal Model
```
Level 0: Individual           (highest resolution)
Level 1: Community            (~150 people, Dunbar's number)
Level 2: Community cluster    (sister communities)
Level 3: Region               (city/district level)
Level 4: Network              (platform-wide, public signals only)
```

### Open Design Decisions

**1. Split mechanism** (needed before schema):
- **Option D (recommended Phase 1)**: Voluntary sub-community — subgroup forms named sub-community, both remain members of both
- Option B: Geography (needs PostGIS, cleaner UX)
- Option C: Social graph density (most intelligent, Phase 2)

**2. Sister feed defaults** (already settled — double opt-in):
- Community admin enables channel (`show_in_sister_feeds` flag on link)
- Member opts in per-post (`visible_to_sisters` flag on request)
- Renders as distinct section: "From your sister community: [name]"

### Schema (ready to implement after decisions)
```sql
CREATE TABLE community.community_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_a_id UUID NOT NULL REFERENCES community.communities(id),
  community_b_id UUID NOT NULL REFERENCES community.communities(id),
  link_type TEXT NOT NULL,  -- 'sister', 'parent_child', 'split_origin'
  trust_carry_factor NUMERIC(3,2) DEFAULT 0.40,
  show_in_sister_feeds BOOLEAN DEFAULT FALSE,
  created_by_admin_a UUID,
  created_by_admin_b UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (community_a_id, community_b_id)
);
```

### Sprint 15 Implementation Order (after design session)

1. `docs/concepts/community-scale.md` — fractal model in plain language (source for landing; run generate-docs after)
2. Update `docs/adr/ADR-018-community-splitting-mechanics.md` → fractal model
3. Migration `025-community-links.sql`
4. Community-service: `POST /communities/:id/links`, `GET /communities/:id/links`, `DELETE /communities/:id/links/:linkId` (admin only)
5. Feed-service: extend `/requests/curated` to include sister community requests
6. Frontend: sister community linking UI in community admin panel
7. Phase 2 badges: `bridge` (cross-community match), `ambassador` (5+ across 2+ sisters)

### Existing Infrastructure to Leverage
- `social_graph.social_distances` — trust path distances (ADR-038 carry already implemented)
- `requests.collective_community_links` — similar pattern to community_links
- `/requests/curated` — already has per-community filtering, extend with second query

---

## Backlog / Open Questions

1. **Collective trust score formula** — currently avg of member scores; dedicated formula Phase 2
2. **"Ephemeral acts, lasting impact" reframe** — language shift across trust/karma docs (`docs/IDEAS.md`)
3. **Simulation state persistence** — API rehydration (sprint 13) is a workaround; file-based persistence is Phase 2
4. **Phase 3 Roadmap** — Karmyq Rides vertical with PostGIS distance matching

---

## Quick Start for Next Session

1. Read this handoff
2. **Push sprint 13–14 work**: `git push origin master`
3. **Run migration on demo DB**: `024-prestige-badges.sql`
4. **Start sprint 15 design session**:
   - Read `services/community-service/.claude/README.md`
   - Read `services/feed-service/.claude/README.md`
   - Decide split mechanism (Option D recommended)
   - Write `docs/concepts/community-scale.md`
   - Then implement `025-community-links.sql` + community-service endpoints

---

## Key Files for Sprint 15

| Task | Files |
|------|-------|
| Concept doc | `docs/concepts/community-scale.md` (new) |
| ADR update | `docs/adr/ADR-018-community-splitting-mechanics.md` |
| Migration | `infrastructure/postgres/migrations/025-community-links.sql` |
| Community API | `services/community-service/src/routes/` |
| Feed extension | `services/feed-service/src/` |
| Frontend | `apps/frontend/src/` (community admin panel) |
