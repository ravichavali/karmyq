# SPRINT 47 — Group Communities

## Handoff Document

**Date**: 2026-04-07
**Current Version**: v9.12.0 → v9.13.0 (Sprint 47 in progress)
**Status**: Spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-47-group-communities`
3. Open plan: `docs/superpowers/plans/2026-04-07-sprint-47-group-communities.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 47 Goal

Introduce **Group Communities** as a first-class community type. By end of sprint, a user can create a group community (sports team, fitness group, hobby club), schedule an activity with a date/time/location/participant cap, and other members can join or leave. Karma/trust is stubbed (event emitted, no processing). Simulation extended with group community templates and activity workflows.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 45 | Trust Configuration Externalization | ✅ Complete |
| Sprint 46 | Error Visibility + Committed Match State | ✅ Complete |
| **Sprint 47** | **Group Communities — Data Model + Activity Scheduling** | ⬜ Ready to execute |
| Sprint 48 | Onboarding — First-Run UX + Community Type Selection | Upcoming |
| Sprint 49 | Karma + Trust for Group Activities | Upcoming |

---

## Spec & Plan

- **Design spec**: `docs/superpowers/specs/2026-04-07-sprint-47-group-communities-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-04-07-sprint-47-group-communities.md`

---

## ⚠️ Critical Implementation Notes

1. **`community_type` defaults to `'mutual_aid'`** — all existing communities get this default via migration. No behavior change.
2. **Activity endpoints are member-scoped** — check `communities.members` for the calling user before any activity operation.
3. **`current_participants` is a denormalized counter** — increment/decrement inside the same transaction as participant insert/delete. Never recalculate from `COUNT(*)` on read.
4. **Admin-only activity creation** — check `role = 'admin'` in `communities.members`.
5. **Activities router mount order** — mount `/communities/:communityId/activities` BEFORE the generic `/communities/:id` route in `index.ts`.
6. **`scheduled_at` is TIMESTAMPTZ** — store UTC, display in browser local time. No server-side conversion.
7. **Karma this sprint = event emit only** — `publishEvent('activity_joined', {...})` is the complete karma implementation. No reputation DB writes.
8. **Simulation: check `community_type` before scheduling** — `schedule-activity-workflow` must call `GET /communities/:id` and verify `community_type === 'group'`.

---

## Task Summary (12 tasks)

| # | Task | Key files |
|---|------|-----------|
| 1 | Feature branch + DB migration | `migrations/20260407-group-communities.sql`, `init.sql` |
| 2 | Community service — expose community_type in GET/POST | `routes/communities.ts` |
| 3 | Community service — activities router | `routes/activities.ts`, `index.ts` |
| 4 | Frontend — community type toggle in creation modal | `CreateCommunityModal.tsx` |
| 5 | Frontend — Activities tab + components | `ActivitiesTab.tsx`, `ActivityCard.tsx`, `CreateActivityModal.tsx`, `communities/[id].tsx` |
| 6 | Simulation — GROUP_COMMUNITIES templates + API client | `realistic-data.ts`, `api-client.ts` |
| 7 | Simulation — schedule/join workflows + profile weights | `schedule-activity-workflow.ts`, `join-activity-workflow.ts`, `profiles/index.ts`, `simulator.ts` |
| 8 | ADR-050 + user guide + landing page docs | `ADR-050-group-communities.md`, `docs/concepts/group-communities.md`, `generate-docs.ts` |
| 9 | CONTEXT.md + registry.json | `community-service/CONTEXT.md`, `registry.json`, `simulation-service/CONTEXT.md` |
| 10 | TDD integration test | `tests/tdd/group-communities.test.ts` |
| 11 | Type check + pre-push verification | `tsc --noEmit`, `npm test`, `feedback:check` |
| 12 | Merge + Deploy + SSH migration | `git push`, GitHub Actions, `psql migration` |

---

## Sprint 46 — COMPLETE ✅

Commit: `b1760cb` — pushed to master, GitHub Actions deployed.

### What was built

**Error Visibility**
- `packages/shared/utils/logger.ts`: `error_type: 'user_error' | 'system_error'` discriminator + `X-Request-Id` response header
- `apps/frontend/src/pages/_app.tsx`: ErrorBoundary with `refId` state; renders reference string for 5xx
- `apps/frontend/src/lib/api.ts`: `errorInterceptor` captures `x-request-id` and attaches as `error.refId`
- `infrastructure/observability/grafana/provisioning/dashboards/json/error-visibility.json`: New Grafana dashboard (5 Loki panels)

**CommitmentsTab Fix**
- `apps/frontend/src/components/CommitmentsTab.tsx`: `handleAccept` removes accepted request from `myOpenRequests` state

**ADR + Docs**
- `docs/adr/ADR-049-error-visibility.md`: New ADR (next available number was 049)
- `docs/adr/ADR-015-observability-stack.md`: Status → Implemented
- `docs/concepts/observability.md`: New concept page

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/concepts/*.md` + `scripts/generate-docs.ts`. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly (gitignored/generated).
- **ADR numbering**: highest existing ADR is 049. Next is **050** (used for Group Communities).
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail) and `sprint-43-feed-ranking` (crashes). These are NOT regressions — do not attempt to fix them.
