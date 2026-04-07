# Sprint 46: Error Visibility & Committed Match State — Design Spec

**Date**: 2026-04-06
**Status**: Approved
**Version**: v9.11.0 → v9.12.0
**Sprint Branch**: `feature/sprint-46-error-visibility`

---

## Overview

Sprint 46 ships two independent improvements under one branch.

The first is error visibility. Errors across all 11 services currently produce structured JSON logs (the `requestLoggingMiddleware` + `Logger` class in `packages/shared/utils/logger.ts` already emits JSON in production), but three things are missing: (1) an `error_type` discriminator so Grafana dashboards can separate user mistakes (4xx) from system failures (5xx), (2) a `X-Request-Id` response header so end-users can reference a request ID when reporting problems, and (3) a Grafana error dashboard to actually surface this data. ADR-015 designed and deployed Grafana/Loki/Prometheus — this sprint makes it useful for error diagnosis.

The second is a stale UI state bug in CommitmentsTab. When a requester accepts a match (`PUT /matches/:id/accept`), the backend already updates the request status to `matched` and the accepted request correctly drops out of the curated browse feed. However, the CommitmentsTab's "My Open Requests" section fetches requests on mount and never refreshes after match acceptance, so the accepted request keeps showing with its offer cards until the user refreshes the page. The fix is frontend-only: remove the accepted request from `myOpenRequests` state when `handleAccept` resolves.

### Core Principle: Observable by Default

Every error that reaches a service should automatically emit queryable context to Grafana — no manual instrumentation per endpoint required.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 43 | Feed Ranking v2 + Logging | ✅ Complete |
| Sprint 44 | Tech Debt + Architecture Review | ✅ Complete |
| Sprint 45 | Trust Configuration Externalization | ✅ Complete |
| **Sprint 46** | **Error Visibility + Committed Match State** | 🟡 This sprint |
| Sprint 47 | Group Communities / Onboarding | ⬜ Future |

---

## New Concepts

**`error_type: 'user_error' | 'system_error'`** — a new field on `LogContext` and `LogEntry`. Set automatically by `requestLoggingMiddleware` based on response status code: `user_error` = 4xx (bad input, auth failures, not-found), `system_error` = 5xx (unexpected crashes, DB failures, downstream timeouts). Written as a JSON field in the log body; LogQL queries like `| json | error_type="system_error"` filter it in Grafana.

**`X-Request-Id` response header** — the `requestLoggingMiddleware` already generates a `requestId` per request. This sprint echoes it back as a response header on every request. The frontend captures it from 5xx error responses and surfaces a support reference ("If this keeps happening, reference: req_xxxxx").

---

## Data Model

No new tables or migrations needed.

`requests.help_requests.status` already has the value `matched` set when a match is accepted. No change to the DB schema or match acceptance logic — the backend is correct. The fix is entirely in the frontend.

---

## API Changes

None. The existing `PUT /matches/:id/accept` handler already:
1. Transitions match status → `matched`
2. Updates `help_requests.status` → `matched`
3. Rejects all other proposed matches for the same request

The curated feed already queries `WHERE r.status = 'open'`, which correctly excludes `matched` requests. No backend changes are needed for the feed bug.

---

## Logger Changes (`packages/shared/utils/logger.ts`)

### 1. `LogContext` interface
Add `error_type?: 'user_error' | 'system_error'`.

### 2. `LogEntry` interface
Add `error_type?: 'user_error' | 'system_error'`.

### 3. `requestLoggingMiddleware`

Two changes:

**`X-Request-Id` header** — set immediately after generating `requestId`, before calling `next()`:
```typescript
res.setHeader('X-Request-Id', requestId);
```

**`error_type` on finish** — in the `res.on('finish')` handler, compute and include `error_type`:
```typescript
const error_type =
  res.statusCode >= 500 ? 'system_error' :
  res.statusCode >= 400 ? 'user_error' :
  undefined;

req.logger.log(
  level,
  `${req.method} ${req.path} ${res.statusCode}`,
  {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    ip: req.ip,
    ...(error_type && { error_type }),
  },
  undefined,
  duration
);
```

---

## Frontend Changes

### `apps/frontend/src/pages/_app.tsx` — Global Error Boundary

Wrap the rendered component tree in a React class-based `ErrorBoundary`:
- Catches unhandled React render errors
- Shows a friendly fallback: "Something went wrong. Try refreshing the page."
- If a `requestId` is available on the error (set by the API interceptor), shows: "Reference: [requestId]"

### `apps/frontend/src/lib/api.ts` — Request ID capture

In the axios response interceptor, on error:
```typescript
if (error.response?.status >= 500) {
  const refId = error.response.headers['x-request-id'];
  if (refId) error.refId = refId;
}
```

### `apps/frontend/src/components/CommitmentsTab.tsx` — Stale state fix

In `handleAccept`, after `await requestService.acceptMatch(...)` resolves, remove the accepted request from `myOpenRequests`:
```typescript
// The accepted match's request is now 'matched' — remove from open requests panel
const acceptedMatch = helping.find(m => m.id === matchId) ?? requested.find(m => m.id === matchId);
if (acceptedMatch) {
  setMyOpenRequests(prev => prev.filter(r => r.id !== acceptedMatch.request_id));
}
```

---

## Grafana Error Dashboard (`error-visibility.json`)

New provisioned dashboard with 5 panels, all using Loki datasource (`uid: "loki"`):

| Panel | Type | Query |
|-------|------|-------|
| Error rate by service (24h) | Stat | `sum by(service) (count_over_time({level="error"}[24h]))` |
| Error type split (1h) | Pie chart | `{level="error"} \| json \| error_type=~"user_error\|system_error"` count by error_type |
| Recent system errors | Logs | `{level="error"} \| json \| error_type="system_error"` |
| Recent user errors | Logs | `{level="error"} \| json \| error_type="user_error"` |
| Error rate over time | Time series | `sum by(service) (rate({level="error"}[5m]))` |

---

## User Guide & Doc Updates

Every sprint ships doc updates. This sprint's updates:

1. **New concept page** `apps/landing/src/data/docs/concepts/observability.json` — describes the error visibility system: `error_type`, `X-Request-Id`, and how to use Grafana to diagnose errors.
2. **Update `apps/landing/src/data/docs/services/community-service.json`** — no changes needed (no new endpoints).
3. **Update `apps/landing/src/data/docs/services/social-graph-service.json`** — no changes needed.
4. **New ADR-032 landing page entry** — `apps/landing/src/data/docs/concepts/adr-032-error-visibility.json` — documents the `error_type` discriminator decision and `X-Request-Id` convention.
5. **Update nav.json** — add observability concept + ADR-032 entries.

---

## Critical Implementation Notes

1. **`X-Request-Id` header must be set BEFORE `next()`**, not in `res.on('finish')`. Headers sent in the `finish` event are too late — the response body has already been written. Set it on the `res` object immediately after generating the `requestId`.

2. **`error_type` is a JSON body field, not a Promtail label.** Promtail labels must be low-cardinality and are applied at scrape time. `error_type` is written into the structured JSON log body; LogQL's `| json` parser extracts it for filtering. No Promtail config changes are needed.

3. **CommitmentsTab fix is requester-side only.** The stale `myOpenRequests` panel only appears in the requester's view. The `handleAccept` in CommitmentsTab is only called with `side === 'requested'` (requester accepting a responder's offer). The `side === 'helping'` branch is for the responder withdrawing, not accepting — the responder has no "Accept" button in `renderHelpingCard`.

4. **`handleAccept` `request_id` lookup.** `helping` and `requested` Match objects have `request_id` (see interface line 12-22 of CommitmentsTab.tsx). Use `requested.find(m => m.id === matchId)?.request_id` since accept is always requester-side.

5. **Grafana dashboard JSON requires `uid`, `schemaVersion`, `version`.** Copy the top-level structure from the existing `service-overview.json` and replace the panels array. Set `"uid": "error-visibility"`, `"title": "Error Visibility"`, `"schemaVersion": 36`.

6. **ADR-015 status update.** Update `docs/adr/ADR-015-*.md` status from `Accepted` → `Implemented` since the Grafana stack is now being actively used with a provisioned dashboard.

7. **Stale TDD test carryover from Sprint 45.** `apps/frontend/tests/tdd/CommunityTrustQuestionnaire.test.tsx` still imports `QUESTIONS` and `answersToConfig` from `trust-model.ts` (removed in Sprint 45). Fix these imports to remove or replace the broken references in Task 1.
