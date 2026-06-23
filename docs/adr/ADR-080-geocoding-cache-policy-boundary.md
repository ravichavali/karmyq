# ADR-080: Retain Geocoding Cache as External API Policy Boundary

**Status:** Implemented
**Date:** 2026-06-22
**Sprint:** 109

## Context

ADR-071 listed geocoding-service as a candidate for removal after feed-service was folded into
request-service. During Sprint 109 planning, we rechecked the public Nominatim usage policy. Karmyq's
frontend address search is autocomplete-like and can be triggered by many users; direct browser calls
would weaken shared caching, app-wide throttling, provider switching, and policy compliance.

## Decision

Keep `geocoding-service` as a small backend cache and external geocoder policy boundary. The service
continues to own shared PostgreSQL geocoding cache reads/writes, centralized outbound throttling, and
Nominatim application identification. The frontend remains local-cache-first and uses the backend cache
before any direct fallback.

## Consequences

- Backend service count remains 10.
- `geocoding-service` is no longer a near-term decommission candidate.
- The service must carry tests and docs like any other production service.
- A future provider swap can happen server-side without requiring browser code to know provider details.

## Alternatives Considered

Delete the backend and call Nominatim directly from the browser.

Rejected because it weakens app-wide policy compliance and shared caching.

Fold geocoding into request-service or community-service.

Deferred. It would reduce service count but increase ownership ambiguity and blast radius for a small,
optional, externally-facing utility.
