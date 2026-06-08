# Sprint 91: Service Consolidation (Phase 1) — Fold feed-service into request-service — Design Spec

**Date**: 2026-06-07
**Status**: Approved
**Version**: v10.14.0 → v11.0.0
**Sprint Branch**: `feature/sprint-91-service-consolidation`

---

## Overview

Karmyq runs **11 services**, and the registry has long flagged three as architecturally
redundant (`statistics.candidates_for_removal: 2`, plus inline `CANDIDATE FOR …` notes on
feed-service, geocoding-service, and cleanup-service). The surface area costs us on every
sprint: more containers to build, more health checks, more cross-schema coupling, more places a
deploy can half-fail. This is the first of a multi-sprint pruning arc (the arc item previously
scoped as "Sprint 92 — architecture & service pruning"), pulled forward now that mobile parity
is deferred.

**feed-service is the cleanest first cut.** It is a pure **read/view layer** — ~2,000 LOC, nine
endpoints, **no Bull queue, no cron, no events published**. It already reads directly from the
`requests`, `community`, `auth`, and `reputation` schemas over the same `DATABASE_URL` that
request-service uses, and it owns a small `feed.*` schema (preferences + dismissed items). And
critically: **only 5 of its 9 endpoints are actually called by the frontend** — the other four
(`/feed/requests`, `/feed/milestones`, `/feed/featured-stories`, `/feed/mixed`) are dead code.

Sprint 91 folds the **5 live feed endpoints** into request-service as a `/requests/feed/*` view
layer, **drops the 4 dead endpoints** (and the `feed.featured_stories` table they read),
decommissions feed-service from compose / nginx / registry, and publishes **ADR-071** with a
phased decommission plan for the remaining candidates (geocoding → client-side; cleanup → kept,
with rationale). Net result: **11 services → 10**, ~700 LOC of dead code removed, one fewer
container in the demo, and a documented roadmap for the rest of the prune.

### Core Principle: Fewer moving parts, same behavior

A service that owns no schedule, publishes no events, and only reads data another service
already owns is not a service — it's a route file in the wrong process. Consolidation here
must be **behavior-preserving for the 5 live endpoints** and **subtractive for everything else**.
No new feed features ship this sprint; the win is purely structural.

---

## Multi-Sprint Arc

### Sprint 89 — Community Sovereignty Redesign (complete) — v10.13.0
### Sprint 90 — Designed to Forget (complete) — v10.14.0
### Sprint 91 — Service Consolidation Phase 1: fold feed-service (THIS) → v11.0.0
### Sprint 92 — Service Consolidation Phase 2: execute the ADR-071 plan for geocoding (→ client-side) (upcoming)

ADR-071 (this sprint) is the spine of the arc — it records the keep/merge/replace decision for
**all** remaining candidates so the later phases execute against a written plan instead of
re-litigating scope each time.

---

## New Concepts

None. This is a structural sprint — no new domain terms, parameters, or abstractions. The only
conceptual shift is **ownership**: the `feed.*` schema and the feed composition logic move from
feed-service to request-service.

---

## Service Audit (the basis for ADR-071)

| Service | Registry flag | Live consumers | Sprint 91 decision | Rationale |
|---|---|---|---|---|
| **feed-service** | CANDIDATE FOR MERGE → request-service | 5 frontend endpoints | **MERGE this sprint** | Pure read/view layer, no queue/cron/events, already reads `requests` schema, 4/9 endpoints dead |
| **geocoding-service** | CANDIDATE FOR REMOVAL → browser API | `LocationPicker`, `EnhancedAutocomplete` | **DEFER → Sprint 92** | Autocomplete needs a geocoder; browser Geolocation can't search addresses → needs a client-side Nominatim/provider call. Real migration, not a delete |
| **cleanup-service** | CANDIDATE FOR REPLACEMENT → pg_cron | N/A (cron jobs) | **KEEP** | Sprint 90 just shipped `memoryRetentionJob` (ADR-069) here; jobs carry real TypeScript logic (per-community window resolution, Exchange-Unit cascade) that pg_cron can't host cleanly. Replacing it would regress forgetting. Re-evaluate only if the job set shrinks to trivial SQL |
| simulation-service | dev-only | demo seeding | **KEEP** | Demo data generation; not in the production footprint |

---

## Data Model

**No migration required.** The `feed.*` schema tables already exist (`infrastructure/postgres/init.sql`,
`006_social_karma_v2_schema.sql`). Ownership moves to request-service; the tables stay in place.

| Table | Sprint 91 action |
|---|---|
| `feed.preferences` | **Keep** — request-service now reads/writes it (preferences endpoints) |
| `feed.dismissed_items` | **Keep** — request-service now reads/writes it (dismiss endpoint) |
| `feed.featured_stories` | **Drop usage** — only the dead `/feed/featured-stories` endpoint read it; remove the endpoint + composer path. Leave the (now-unread) table in place rather than risk a DROP on the demo DB; note it as orphaned in ADR-071 for a later cleanup phase |

> **Do NOT `DROP SCHEMA feed`** — `preferences` and `dismissed_items` live there and stay live.

---

## API Endpoints

All feed endpoints move into request-service mounted at **`/requests/feed`** (so the public
path through nginx becomes `/api/requests/feed/*`, served by the existing `/api/requests` nginx
block — **no new nginx location needed**, and the dead `/api/feed` block + `feed_service`
upstream get removed).

### Endpoints that MOVE (the 5 live ones)

| Method | New path (in request-service) | Was (feed-service) | Description |
|---|---|---|---|
| GET | `/requests/feed` | `/feed` | Main composed feed (socialKarma composer + ranker) |
| GET | `/requests/feed/preferences` | `/feed/preferences` | Read user feed preferences |
| PUT | `/requests/feed/preferences` | `/feed/preferences` | Update user feed preferences |
| POST | `/requests/feed/dismiss/:itemId` | `/dismiss/:itemId` | Dismiss a feed item |
| GET | `/requests/feed/community-health` | `/feed/community-health` | Community health hero metrics |

> **⚠️ Path mismatch to reconcile:** feed-service mounts dismiss at `/dismiss/:itemId`
> (→ `/feed/dismiss/:itemId`), but the frontend currently calls `/feed/:itemId/dismiss`. One of
> these is wrong (the dismiss call is likely currently failing/dead). Reconcile to a **single
> canonical path** during the merge: server `/requests/feed/dismiss/:itemId`, and fix the
> frontend call to match it.

### Endpoints that are DROPPED (dead — no frontend caller)

| Method | Path | Why dropped |
|---|---|---|
| GET | `/feed/requests` | No frontend caller |
| GET | `/feed/milestones` | No frontend caller |
| GET | `/feed/featured-stories` | No frontend caller (+ drops `feed.featured_stories` usage) |
| GET | `/feed/mixed` | No frontend caller |

---

## Frontend Changes

| File | Change |
|---|---|
| `apps/frontend/src/lib/api.ts` | Remove `FEED_API_URL` const + `feedApi` client export. Migrate the 5 live feed calls to `requestApi` with `/requests/feed/*` paths. Fix the dismiss path to `/requests/feed/dismiss/:itemId` |
| `apps/frontend/src/components/CommunityHealthHero.tsx` | `feedApi.get('/feed/community-health…')` → `requestApi.get('/requests/feed/community-health…')` |
| Any other `feedApi.*` call sites | Repoint to `requestApi` + `/requests/feed/*` (grep `feedApi` to find all) |
| `apps/frontend/.env*` / env docs | Remove `NEXT_PUBLIC_FEED_API_URL` references |
| `apps/mobile/config/api.ts`, `apps/mobile/services/api.ts`, `apps/mobile/README.md` | Point mobile feed reads at request-service `/requests/feed`; remove port 3007/feed-service references |

No UI/UX behavior change — same data, same components, different base URL + path prefix.

---

## Infrastructure Changes

| File | Change |
|---|---|
| `infrastructure/nginx/*.conf` | Remove `upstream feed_service { … }` and `/api/feed` locations. (`/api/requests/feed` is served by the existing `/api/requests` block) |
| `infrastructure/docker/docker-compose*.yml`, `tests/docker-compose.test.yml` | Remove the `feed-service:` / `feed-service-test:` service definitions and FEED_* env wiring |
| `.github/workflows/*.yml`, `scripts/deploy.sh`, `scripts/smoke-test.sh`, local test helpers | Remove feed-service from Docker image matrices, health checks, rebuilt-service arrays, and smoke tests |
| `apps/frontend/Dockerfile`, `infrastructure/scripts/setup_env.sh`, `.env.demo.example` | Remove `NEXT_PUBLIC_FEED_API_URL` / `FEED_API_URL` |
| `infrastructure/observability/grafana/provisioning/dashboards/json/service-overview.json` | Remove feed-service log panels/queries |
| `services/registry.json` | Remove the `feed-service` entry; move its 5 live endpoints under `request-service.apis.provides`; update `statistics` (total 11→10, candidates_for_removal 2→1) |
| `services/feed-service/` | **Delete the directory** |
| `services/dependency-graph.md`, `services/impact-analysis.md`, `services/version-drift.md` | **Regenerated** by `npm run analyze:services` — do not hand-edit |
| `package-lock.json` | Regenerate/update so the deleted feed-service workspace entries disappear |

---

## User Guide & Doc Updates

This is a structural sprint with no user-facing behavior change, but the docs MUST still reflect
the new architecture:

- **ADR-071** (`docs/adr/ADR-071-service-consolidation.md`) — new. Records the audit, the
  feed-service merge, and the phased decommission plan for geocoding/cleanup. Add to
  `docs/adr/README.md` index.
- **Landing ADR JSON** — `apps/landing/src/data/docs/concepts/adr-071-service-consolidation.json`
  + nav.json "Architecture Decisions" entry.
- **Landing services docs** — remove `apps/landing/src/data/docs/services/feed-service.json`
  (+ its nav.json "Services" entry); update `request-service.json` to list the new feed endpoints.
- **CONTEXT.md** — `services/request-service/CONTEXT.md` gains the feed view layer + `feed.*`
  schema ownership + the dropped-endpoints note; `services/feed-service/CONTEXT.md` removed with
  the directory.
- **`services/request-service/.claude/README.md`** — note it now serves the feed.
- **ARCHITECTURE.md** — update the service count (11→10) and any feed-service mention.
- **No user-facing guide change** — the feed page behaves identically; if a feed guide exists,
  verify it doesn't reference a separate "feed service" by name.

---

## Critical Implementation Notes

1. **FOLD THE UNCOMMITTED S90 DOC TAIL INTO SPRINT 91's FIRST COMMIT.** The working tree carries
   ADR-069/070 → Implemented (md + README + regenerated landing JSON) + the prior handoff,
   intentionally NOT pushed (a docs-only master push triggers a redundant deploy that transiently
   breaks the demo — `feedback_no_docs_push_to_master`). Sprint 91's branch carries them in its
   first commit. Do NOT push them standalone.
2. **feed-service is a pure read/view layer — no Bull queue, no cron, no events published.** Safe
   to fold with zero scheduler/event rewiring. Confirm with a final grep for `Queue`/`cron`/
   `karmyq-events` in `services/feed-service/src` before deleting (expect none).
3. **Only 5 of 9 endpoints are live — DROP the 4 dead ones** (`/feed/requests`, `/feed/milestones`,
   `/feed/featured-stories`, `/feed/mixed`) and the `feed.featured_stories` read path. Do not
   carry dead code into request-service.
4. **Mount the feed router at `/requests/feed` in request-service `index.ts`.** The existing
   `/api/requests` nginx block routes `/api/requests/feed/*` to it — **no new nginx location**.
   **Remove** the now-dead `/api/feed` location + `feed_service` upstream from nginx.conf.
   Register this mount **before** the generic `/requests` router so `GET /requests/feed` is not
   captured by `GET /requests/:id`. Mount it with the feed-service-equivalent middleware:
   `rateLimiters.relaxed` (or `readHeavy`), `authMiddleware`, `optionalTenantMiddleware`, and
   `dbContextMiddleware(pool)`. **nginx.conf changes only take effect on deploy**
   (`feedback_nginx_config`).
5. **Frontend: replace `feedApi` (`FEED_API_URL`:3007) with `requestApi` (`REQUEST_API_URL`:3003);
   paths become `/requests/feed/*`.** Remove `FEED_API_URL` + `feedApi`. requestApi resource
   calls already use `/requests/...` paths (verified). **API unwrap: `res.data`, not
   `res.data.data`** — the interceptor already unwraps.
6. **Reconcile the dismiss path mismatch** — server `/dismiss/:itemId` vs frontend
   `/:itemId/dismiss`. Canonical: `/requests/feed/dismiss/:itemId`; fix the frontend to match.
7. **Do NOT `DROP SCHEMA feed`** — `feed.preferences` + `feed.dismissed_items` stay live and
   request-service now owns them. No migration needed. `feed.featured_stories` becomes orphaned
   (unread) — note in ADR-071, don't drop it on the demo this sprint.
8. **social-graph proximity call:** `basicFeedRanker` POSTs `SOCIAL_GRAPH_API_URL /paths/batch`.
   request-service already calls social-graph in `dibs.ts` via `SOCIAL_GRAPH_API_URL` — reuse the
   same env var/pattern. Forward the caller's `Authorization` header to `/paths/batch`; do not
   keep feed-service's old `x-user-id` shortcut. Ensure the env var is set in request-service's
   compose/test env.
9. **request-service DB role already has cross-schema read** (same `DATABASE_URL`) — the feed
   composers' reads of `requests`/`community`/`auth`/`reputation` work unchanged.
10. **Version bump 10.14.0 → 11.0.0 (MAJOR)** — removing a service is a breaking architectural
    change. Bump the root product version only; service package versions currently do not track
    product semver.
11. **JWT field is `communities`** (`user.communities ?? []`) for any membership gate on the
    moved endpoints (carry feed-service's existing auth — don't loosen it).
12. **Port/adapt feed-service tests before deleting the directory** — preserve `basicFeedRanker`,
    `feedComposer`, and relevant `socialKarmaFeedComposer` coverage under request-service so the
    move does not silently drop regression protection.
13. **Decommission every active feed-service reference**, not just compose/nginx. Grep `.github`,
    `scripts`, `tests`, `infrastructure`, `apps`, and `services` for `feed-service`,
    `feed_service`, `3007`, `FEED_API_URL`, `FEED_SERVICE_URL`, and
    `NEXT_PUBLIC_FEED_API_URL`.
14. **Run `npm run analyze:services` after deleting feed-service** to regenerate
    `dependency-graph.md` / `impact-analysis.md` / `version-drift.md` — these are GENERATED, never
    hand-edit (a hook blocks it).
15. **Landing docs are gitignored** (`git add -f`); **nav.json reverts** after `generate-docs`
    (grep-verify, re-apply).
16. **ADR numbering: next free = 071.** This sprint creates ADR-071.
17. **Behavior-preserving:** the 5 live endpoints must return identical shapes. The TDD/integration
    test asserts request-service serves them with the same response contract feed-service did.
