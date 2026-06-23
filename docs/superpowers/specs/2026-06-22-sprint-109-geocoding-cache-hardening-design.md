# Sprint 109: Geocoding Cache Hardening & Dependency Hygiene - Design Spec

**Date**: 2026-06-22
**Status**: Approved
**Version**: v11.16.0 -> v11.17.0
**Sprint Branch**: `feature/sprint-109-geocoding-cache-hardening`

---

## Overview

Karmyq originally added `geocoding-service` to avoid turning every browser session into direct
traffic against the public OpenStreetMap Nominatim API. That reason still holds. The official
Nominatim usage policy asks applications to stay below an app-wide 1 request/sec ceiling, cache
results, identify the application, avoid public-API client-side autocomplete, and be able to switch
providers without a client update. A browser-only implementation would weaken those guarantees.

Sprint 109 therefore keeps `geocoding-service` as a small backend policy boundary and hardens it
rather than decommissioning it. The service should remain optional and leaf-like, but its actual
runtime contract needs to match production reality: frontend depends on it, it uses PostgreSQL rather
than Redis, it lacks package test scripts, and its route responses do not fully follow the platform
error envelope.

The sprint also includes a bounded dependency hygiene lane. `npm audit --package-lock-only
--audit-level=high` is currently clean for high/critical vulnerabilities, while the local audit reports
21 moderate alerts concentrated in Expo/Jest/tooling transitives. Sprint 109 should fix safe leaf-level
moderates if available and document any risky major-toolchain carry-forward, without turning this into
an Expo or Jest migration sprint.

### Core Principle: Centralize External API Responsibility

Browsers may cache and suggest, but app-wide rate limiting, shared cache hits, provider switching, and
public geocoder policy compliance belong at the backend boundary.

---

## Multi-Sprint Arc

### Sprint 91 - Service Consolidation Phase 1 (complete)

Folded `feed-service` into `request-service`, removed the standalone service, and recorded ADR-071.

### Sprint 109 - Geocoding Cache Hardening (this sprint)

Keep `geocoding-service`, harden it as a policy-compliant shared cache boundary, correct docs and
tests, and triage current dependency drift.

### Future - Privacy Controls (upcoming, not this sprint)

Member-initiated forget/export remains a separate privacy sprint. It is deliberately out of Sprint 109.

---

## New Concepts

**Geocoding policy boundary.** The backend component responsible for enforcing app-wide public geocoder
constraints: shared cache before external calls, centralized throttling, application identification,
and provider-switchability without requiring frontend redeploys.

**External geocoder throttle.** A process-local queue/guard that permits at most one outbound Nominatim
request per second from `geocoding-service`, independent of per-client HTTP rate limits.

**Dependency hygiene lane.** A bounded security-maintenance thread inside the sprint: high/critical
audit remains blocking; moderate alerts are fixed only when the fix is low-risk and does not require
major Expo/Jest churn.

---

## Data Model

No schema changes are required.

The existing `geocoding_cache` table remains the service-owned cache:

```sql
CREATE TABLE geocoding_cache (
    query TEXT PRIMARY KEY,
    results JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
    hit_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'nominatim'
);
```

Implementation must confirm whether this table is created by `infrastructure/postgres/init.sql` and
whether any migration drift exists. If the table definition is missing from source-controlled schema,
the sprint should add an idempotent migration and document it.

---

## API Endpoints

No endpoint removals.

| Method | Path | Description | Auth | Response |
|---|---|---|---|---|
| GET | `/health` | Service health. | None | `{ status:'healthy', service:'geocoding-cache', port }` |
| GET | `/search?q=` | Search shared geocoding cache first; on miss, call external provider through centralized throttle and cache results. | None | `{ success:true, data:{ results, source, cached } }` |
| POST | `/cache` | Manually cache validated geocoding results, used by frontend fire-and-forget cache warmup. | None | `{ success:true, data:{ query }, message }` |
| GET | `/stats` | Cache statistics and top active queries. | None | `{ success:true, data:{ stats, top_queries } }` |
| POST | `/cleanup` | Delete expired cache rows. | None | `{ success:true, data:{ deleted }, message }` |

Error responses should follow the project contract:

```json
{ "success": false, "message": "Human-readable error", "error": "ERROR_CODE" }
```

The service may keep `/health` in the existing flat health shape for compatibility with Docker and
smoke checks.

---

## Frontend Changes

`apps/frontend/src/lib/geocoding.ts` should continue to prefer local browser caches first:

1. IndexedDB common locations.
2. IndexedDB API cache.
3. Backend shared geocoding cache (`NEXT_PUBLIC_GEOCODING_API_URL` or localhost/dev default).
4. Legacy localStorage cache.
5. Direct Nominatim fallback only if the backend is clearly unreachable and the action is
   user-triggered.

The sprint should add comments/tests that make the direct fallback a last resort, not the primary
autocomplete strategy. A slow backend response or request timeout must not silently become a
browser-to-Nominatim autocomplete path; either wait longer for the backend or fail closed to cached/no
results. Do not remove the backend tier. Do not add a new map provider.

---

## User Guide & Doc Updates

Mandatory docs:

- `services/geocoding-service/CONTEXT.md` - current contract, Postgres dependency, route envelopes,
  policy boundary, tests, and recent fixes.
- `services/geocoding-service/.claude/README.md` - correct "no dependents" and "redis" drift; document
  frontend consumer and PostgreSQL dependency.
- `services/geocoding-service/README.md` - align with hardened API and Nominatim policy.
- `services/registry.json` - keep service registered; correct infrastructure dependency to Postgres,
  update endpoint entries as structured objects if needed, and update notes.
- `apps/frontend/CONTEXT.md` - document that frontend geocoding must use the backend shared cache tier
  before any direct external fallback.
- `docs/adr/ADR-080-geocoding-cache-policy-boundary.md` - new ADR recording the decision to keep the
  backend cache instead of decommissioning it.
- `docs/adr/README.md` - add ADR-080.
- Landing docs generated from sources: add ADR-080 concept JSON and update service docs/nav as required.
- `.claude/handoff/CURRENT_HANDOFF.md` - updated during and after execution.

---

## Dependency Hygiene

Current observed local audit state on 2026-06-22:

```text
npm audit --package-lock-only --audit-level=high --json
high: 0
critical: 0
moderate: 21
```

Sprint 109 should:

- Keep the high/critical gate clean.
- Run moderate-level audit during implementation.
- Prefer root `overrides` or safe patch/minor bumps for vulnerable leaves.
- Avoid `npm audit fix --force`.
- Avoid major Expo/Jest migrations in this sprint unless a fix is plainly low-risk and testable.
- Document unresolved moderate alerts in the PR body and handoff if they remain.

---

## Critical Implementation Notes

1. **Do not decommission `geocoding-service`.** The backend is retained as the shared cache and external
   API policy boundary.
2. **Do not make browser-to-Nominatim the primary autocomplete path.** Direct external calls stay a
   last-resort fallback after local caches and backend cache fail.
3. **Respect the Nominatim policy.** Centralize outbound Nominatim calls, send a real Karmyq
   `User-Agent`, cache results, and throttle app-wide external requests to at most one request per
   second per process.
4. **Per-client HTTP rate limits are not enough.** `express-rate-limit` limits inbound callers; add a
   separate outbound throttle around `callNominatimAPI`, and make the throttle resilient so one rejected
   external call cannot poison the queue for future cache misses.
5. **Response envelopes should match ADR-074.** Keep `/health` compatible, but use
   `{ success, data, message, error }` for API and error responses.
6. **Fix documentation drift.** The service is not "no dependents" in practice: frontend geocoding
   consumes it. It uses PostgreSQL, not Redis.
7. **Add test scripts before relying on tests.** `services/geocoding-service/package.json` currently has
   no `test`, `test:unit`, or `test:regression` scripts.
8. **Mock external calls in tests.** Tests must not call public Nominatim. Use mocked `fetch` and mocked
   `pool.query`.
9. **Do not take risky dependency majors.** Moderate audit cleanup is bounded; Expo/Jest major churn is
   out of scope unless proven safe.
10. **Update ADR-071/ADR-080 coherently.** ADR-071's geocoding follow-up should point to ADR-080's
    decision to retain and harden the service.
11. **Update the Docker image when extracting `src/`.** The current Dockerfile copies only `index.js`;
    after extraction it must copy `services/geocoding-service/src/` into both build and production
    stages, or the deployed container will fail with `Cannot find module './src/geocodingApp'`.
12. **Do not add already-hoisted test dev dependencies to the service package.** Add scripts only unless
    verification proves `jest` or `supertest` cannot resolve from the root install.

---

## Out of Scope

- Deleting or folding `geocoding-service`.
- Member forget/export controls.
- Replacing Nominatim with Mapbox, Google, or a paid provider.
- Self-hosting Nominatim.
- Reverse geocoding.
- Address-book product work.
- Major Expo/Jest migrations for moderate alerts.
