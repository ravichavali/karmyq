# ADR-071: Fold Feed Service Into Request Service

**Status:** Implemented
**Date:** 2026-06-07
**Sprint:** 91

## Context

Karmyq entered Sprint 91 with 11 backend services. `feed-service` was a pure read/view layer: it owned no Bull queues, cron jobs, event subscribers, or durable write workflow. Its live behavior depended on request, community, reputation, and feed schema reads that are already inside request-service's operational boundary.

Only five feed endpoints were live:

- `GET /feed`
- `GET /feed/preferences`
- `PUT /feed/preferences`
- `POST /feed/dismiss/:itemId`
- `GET /feed/community-health`

Four endpoints were dead and had no frontend caller:

- `GET /feed/requests`
- `GET /feed/milestones`
- `GET /feed/featured-stories`
- `GET /feed/mixed`

## Decision

Remove `feed-service` and serve the five live feed endpoints from request-service under `/requests/feed/*`:

- `GET /requests/feed`
- `GET /requests/feed/preferences`
- `PUT /requests/feed/preferences`
- `POST /requests/feed/dismiss/:itemId`
- `GET /requests/feed/community-health`

The router is mounted before the generic `/requests` router so `/requests/feed` is not captured by `/requests/:id`. It uses the same behavior-preserving middleware shape as the removed service: relaxed/read-heavy rate limiting, auth, optional tenant context, and request-service DB context.

The ranked feed forwards the caller's `Authorization` header to social-graph `/paths/batch`. The old `x-user-id` shortcut is not carried forward.

## Consequences

- Backend service count drops from 11 to 10.
- Public feed traffic moves from `/api/feed/*` to `/api/requests/feed/*`.
- `feed.preferences` and `feed.dismissed_items` remain active tables.
- `feed.featured_stories` is intentionally left in place but unread; dropping data is deferred to a later cleanup migration.
- The four dead Social Karma feed endpoints are removed rather than migrated.
- Docker, nginx, CI, smoke tests, client API config, mobile config, and observability no longer build, proxy, test, or monitor `feed-service`.

## Alternatives Considered

Keep `feed-service` as a separate view service.

Rejected because its operational overhead was larger than its boundary value: no asynchronous work, no independent state ownership, and no active consumers for nearly half its routes.

Move all curated feed behavior into `feed-service`.

Rejected because curated request feed behavior is already tightly integrated with request-service's request schemas, matching states, and request visibility logic. This would increase coupling rather than reduce it.

## Follow-Ups

- Decide whether to drop or repurpose `feed.featured_stories`.
- Geocoding-service was re-evaluated in Sprint 109. ADR-080 keeps it as a backend cache and external
  API policy boundary rather than removing it.
- Keep cleanup-service separate while it owns scheduled retention and memory jobs.
