# Error Visibility & Committed Match State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make errors observable in Grafana by adding an `error_type` discriminator and `X-Request-Id` header to the shared logger, provision a Grafana error dashboard, add a frontend error boundary, and fix stale UI state in CommitmentsTab after match acceptance.

**Architecture:** The shared logger (`packages/shared/utils/logger.ts`) is the single point of change for error instrumentation — all 11 services use it. The Grafana dashboard is provisioned as a JSON file picked up automatically by Grafana on startup. CommitmentsTab fix is a frontend-only state update in `handleAccept`. No DB schema changes, no new endpoints.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/observability/grafana/provisioning/dashboards/json/error-visibility.json` | Grafana error dashboard — 5 Loki-powered panels |
| `docs/adr/ADR-032-error-visibility.md` | ADR for `error_type` discriminator + `X-Request-Id` convention |
| `apps/landing/src/data/docs/concepts/adr-032-error-visibility.json` | Landing page doc for ADR-032 |
| `apps/landing/src/data/docs/concepts/observability.json` | Concept page: how to use Grafana for error diagnosis |

### Existing files to modify

| File | Change |
|------|--------|
| `packages/shared/utils/logger.ts` | Add `error_type` to `LogContext`/`LogEntry`; set `X-Request-Id` response header before `next()` in middleware; include `error_type` in finish log |
| `apps/frontend/src/pages/_app.tsx` | Add `ErrorBoundary` class component wrapping `<Component>` |
| `apps/frontend/src/lib/api.ts` | In axios error interceptor, extract `X-Request-Id` header from 5xx responses |
| `apps/frontend/src/components/CommitmentsTab.tsx` | In `handleAccept`, remove accepted request from `myOpenRequests` state |
| `apps/frontend/tests/tdd/CommunityTrustQuestionnaire.test.tsx` | Fix stale Sprint 45 imports (`QUESTIONS`, `answersToConfig` from `trust-model.ts`) |
| `docs/adr/ADR-015-*.md` | Update status: `Accepted` → `Implemented` |
| `apps/landing/src/data/docs/nav.json` | Add ADR-032 + observability concept entries |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`X-Request-Id` header timing.** `res.setHeader('X-Request-Id', requestId)` must be called immediately after generating `requestId`, before `next()`. Setting it inside `res.on('finish')` is too late — the response is already written.

2. **`error_type` is a JSON body field, not a Promtail label.** Write it into `LogContext`/`LogEntry` as a normal field. LogQL extracts it with `| json | error_type="system_error"`. No Promtail config changes needed.

3. **CommitmentsTab `handleAccept` is requester-side only.** Responders only see "Withdraw Offer" in `renderHelpingCard`, not an Accept button. The stale `myOpenRequests` entry belongs to the requester side. In `handleAccept` when `side === 'requested'`, the match object has a `request_id` field — use it to filter `myOpenRequests`.

4. **Grafana dashboard JSON structure.** Must include top-level `uid`, `schemaVersion: 38`, `title`, `timezone`, `refresh`, `time`. Copy outer structure from `service-overview.json`. Loki datasource reference: `{ "type": "loki", "uid": "loki" }`.

5. **Stale TDD test (`CommunityTrustQuestionnaire.test.tsx`).** This file imports `QUESTIONS` and `answersToConfig` from `@/lib/trust-model`, both removed in Sprint 45. The test also references the old hardcoded question structure. Either rewrite it to test the new data-driven component (using mock API response), or delete and recreate. Do not leave broken imports in the tdd suite.

6. **ADR-015 source file name.** Run `ls docs/adr/ADR-015*` to confirm the filename before editing status.

---

## Task 1: Feature branch + stale TDD test fix

**Files:**
- Modify: `apps/frontend/tests/tdd/CommunityTrustQuestionnaire.test.tsx`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-46-error-visibility
```

- [ ] **Fix stale TDD test** — open `apps/frontend/tests/tdd/CommunityTrustQuestionnaire.test.tsx`. The file imports `QUESTIONS` and `answersToConfig` from `@/lib/trust-model` (both removed in Sprint 45). Replace the test body with a data-driven version that mocks `GET /communities/trust-questions` and verifies `CommunityTrustQuestionnaire` renders questions from the API response. Keep at least one meaningful assertion.

- [ ] **Verify TDD suite no longer fails on this file**

```bash
cd apps/frontend && npx jest tests/tdd/CommunityTrustQuestionnaire --no-coverage 2>&1 | tail -10
```

---

## Task 2: Shared logger — `error_type` + `X-Request-Id` header

**Files:**
- Modify: `packages/shared/utils/logger.ts`

- [ ] **Add `error_type` to `LogContext`**

```typescript
export interface LogContext {
  userId?: string;
  requestId?: string;
  service?: string;
  error_type?: 'user_error' | 'system_error';
  [key: string]: any;
}
```

- [ ] **Add `error_type` to `LogEntry`**

```typescript
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service?: string;
  context?: LogContext;
  error?: { name: string; message: string; stack?: string };
  duration?: number;
  error_type?: 'user_error' | 'system_error';
}
```

- [ ] **Set `X-Request-Id` response header in `requestLoggingMiddleware`** — immediately after generating `requestId`, before `next()`:

```typescript
res.setHeader('X-Request-Id', requestId);
```

- [ ] **Compute and log `error_type` on `res.on('finish')`**

```typescript
res.on('finish', () => {
  const duration = Date.now() - start;
  const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
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
});
```

- [ ] **Verify TypeScript compiles**

```bash
cd packages/shared && npx tsc --noEmit
```

---

## Task 3: Frontend error boundary + API request ID capture

**Files:**
- Modify: `apps/frontend/src/pages/_app.tsx`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Add `ErrorBoundary` class component to `_app.tsx`** — place it before the default export, wrap `<Component {...pageProps} />`:

```typescript
import React from 'react'

interface ErrorBoundaryState { hasError: boolean; refId?: string }

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, refId: error?.refId }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong.</h2>
          <p>Try refreshing the page.</p>
          {this.state.refId && (
            <p style={{ fontSize: '0.75rem', color: '#999' }}>
              Reference: {this.state.refId}
            </p>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
```

Then in the `MyApp` component, wrap the render:
```tsx
return (
  <ErrorBoundary>
    <Layout>
      <Component {...pageProps} />
    </Layout>
  </ErrorBoundary>
)
```

- [ ] **Capture `X-Request-Id` in axios error interceptor** — in `apps/frontend/src/lib/api.ts`, in the response error interceptor (or add one if it only has a request interceptor), attach the `refId` to thrown errors for 5xx responses:

```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status >= 500) {
      const refId = error.response.headers?.['x-request-id']
      if (refId) error.refId = refId
    }
    return Promise.reject(error)
  }
)
```

Apply the same interceptor to each axios instance (`requestApi`, `communityApi`, etc.) if they are separate instances. Check how they're defined in `api.ts`.

- [ ] **Verify frontend builds**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

---

## Task 4: CommitmentsTab stale state fix

**Files:**
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`

- [ ] **Remove accepted request from `myOpenRequests` in `handleAccept`** — in the `handleAccept` function (line ~205), after `await requestService.acceptMatch(matchId, currentUser.id)` succeeds, find the match's `request_id` and filter it out:

```typescript
// After the acceptMatch call succeeds:
if (side === 'requested') {
  const acceptedMatch = requested.find((m) => m.id === matchId)
  if (acceptedMatch?.request_id) {
    setMyOpenRequests((prev) => prev.filter((r) => r.id !== acceptedMatch.request_id))
  }
  setRequested((prev) =>
    prev.map((m) => (m.id === matchId ? { ...m, status: 'matched' } : m))
  )
} else {
  setHelping((prev) =>
    prev.map((m) => (m.id === matchId ? { ...m, status: 'matched' } : m))
  )
}
```

- [ ] **Verify component still renders without errors**

```bash
cd apps/frontend && npx jest tests/tdd/sprint-39-provider-ux --no-coverage 2>&1 | tail -5
```

---

## Task 5: Grafana error visibility dashboard

**Files:**
- Create: `infrastructure/observability/grafana/provisioning/dashboards/json/error-visibility.json`

- [ ] **Create `error-visibility.json`** — model the outer structure on `service-overview.json` (uid, schemaVersion 38, refresh, timezone). Add 5 panels:

```json
{
  "title": "Error Visibility",
  "uid": "karmyq-error-visibility",
  "tags": ["karmyq", "errors", "observability"],
  "timezone": "browser",
  "refresh": "30s",
  "schemaVersion": 38,
  "time": { "from": "now-24h", "to": "now" },
  "panels": [
    {
      "id": 1,
      "title": "System Errors by Service (24h)",
      "type": "stat",
      "datasource": { "type": "loki", "uid": "loki" },
      "gridPos": { "x": 0, "y": 0, "w": 12, "h": 4 },
      "targets": [{
        "expr": "sum by(service) (count_over_time({level=\"error\"}[24h]))",
        "datasource": { "type": "loki", "uid": "loki" },
        "legendFormat": "{{service}}"
      }],
      "options": { "colorMode": "background", "graphMode": "area", "orientation": "horizontal" },
      "fieldConfig": { "defaults": { "unit": "short", "color": { "mode": "thresholds" }, "thresholds": { "steps": [{"color": "green", "value": 0}, {"color": "yellow", "value": 5}, {"color": "red", "value": 20}] } } }
    },
    {
      "id": 2,
      "title": "Error Rate Over Time (by service)",
      "type": "timeseries",
      "datasource": { "type": "loki", "uid": "loki" },
      "gridPos": { "x": 12, "y": 0, "w": 12, "h": 4 },
      "targets": [{
        "expr": "sum by(service) (rate({level=\"error\"}[5m]))",
        "datasource": { "type": "loki", "uid": "loki" },
        "legendFormat": "{{service}}"
      }],
      "fieldConfig": { "defaults": { "unit": "reqps" } }
    },
    {
      "id": 3,
      "title": "Recent System Errors (5xx)",
      "type": "logs",
      "datasource": { "type": "loki", "uid": "loki" },
      "gridPos": { "x": 0, "y": 4, "w": 24, "h": 8 },
      "targets": [{
        "expr": "{level=\"error\"} | json | error_type=\"system_error\"",
        "datasource": { "type": "loki", "uid": "loki" }
      }],
      "options": { "showTime": true, "showLabels": true, "wrapLogMessage": true }
    },
    {
      "id": 4,
      "title": "Recent User Errors (4xx)",
      "type": "logs",
      "datasource": { "type": "loki", "uid": "loki" },
      "gridPos": { "x": 0, "y": 12, "w": 24, "h": 8 },
      "targets": [{
        "expr": "{level=\"warn\"} | json | error_type=\"user_error\"",
        "datasource": { "type": "loki", "uid": "loki" }
      }],
      "options": { "showTime": true, "showLabels": true, "wrapLogMessage": true }
    },
    {
      "id": 5,
      "title": "Errors with Request ID (last 50)",
      "type": "logs",
      "datasource": { "type": "loki", "uid": "loki" },
      "gridPos": { "x": 0, "y": 20, "w": 24, "h": 6 },
      "targets": [{
        "expr": "{level=\"error\"} | json | requestId != \"\"",
        "datasource": { "type": "loki", "uid": "loki" },
        "maxLines": 50
      }],
      "options": { "showTime": true, "showLabels": true, "wrapLogMessage": false }
    }
  ]
}
```

- [ ] **Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('infrastructure/observability/grafana/provisioning/dashboards/json/error-visibility.json', 'utf8')); console.log('valid')"
```

---

## Task 6: ADR-032 + ADR-015 status update

**Files:**
- Create: `docs/adr/ADR-032-error-visibility.md`
- Modify: `docs/adr/ADR-015-*.md` (update status field)
- Modify: `docs/adr/README.md` (add ADR-032 entry)

- [ ] **Create `docs/adr/ADR-032-error-visibility.md`**

```markdown
# ADR-032: Error Visibility — `error_type` Discriminator and `X-Request-Id` Convention

**Date**: 2026-04-06
**Status**: Implemented
**Deciders**: Development Team
**Related**: ADR-015 (Observability Stack)

## Context

All 11 services emit structured JSON logs via the shared logger. Grafana/Loki is deployed
(ADR-015) but no dashboard existed specifically for error diagnosis. Operators had no way to
distinguish user-input errors (4xx) from system failures (5xx) without reading raw log lines.
End-users had no reference ID to attach to bug reports.

## Decision

1. Add `error_type: 'user_error' | 'system_error'` to `LogContext` and `LogEntry`.
   Set automatically by `requestLoggingMiddleware` based on response status code.
   Written as a JSON field; LogQL filters it with `| json | error_type="system_error"`.

2. Set `X-Request-Id` response header on every HTTP response, echoing the `requestId`
   generated by `requestLoggingMiddleware`. Frontend captures it on 5xx errors.

3. Provision a Grafana error dashboard (`error-visibility.json`) with 5 panels:
   error rate by service, rate over time, recent system errors, recent user errors,
   errors with request IDs.

## Consequences

- Every 4xx/5xx response is now tagged and queryable in Grafana without per-endpoint instrumentation.
- Users can reference a request ID when reporting errors.
- No DB schema changes, no new endpoints, no external services required.
```

- [ ] **Update ADR-015 status** — find the `**Status**:` line and change `Accepted` → `Implemented`.

- [ ] **Add ADR-032 to `docs/adr/README.md`**

---

## Task 7: Landing page docs

**Files:**
- Create: `apps/landing/src/data/docs/concepts/adr-032-error-visibility.json`
- Create: `apps/landing/src/data/docs/concepts/observability.json`
- Modify: `apps/landing/src/data/docs/nav.json`

- [ ] **Create `apps/landing/src/data/docs/concepts/adr-032-error-visibility.json`**

```json
{
  "slug": "adr-032-error-visibility",
  "number": "032",
  "title": "ADR-032: Error Visibility",
  "status": "implemented",
  "description": "**Status**: Implemented",
  "content": "# ADR-032: Error Visibility — error_type Discriminator and X-Request-Id Convention\n\n**Status**: Implemented | **Date**: 2026-04-06\n\n## Decision\n\nAdded `error_type: 'user_error' | 'system_error'` to the shared logger and `X-Request-Id` response header to all services. Provisioned a Grafana error dashboard for operator visibility.\n\n## Why\n\nErrors across 11 services were silent to operators. The structured logger already emitted JSON in production, but no dashboard existed and no discriminator separated user mistakes from system failures.\n\n## What Changed\n\n- `packages/shared/utils/logger.ts`: `error_type` field in `LogContext`/`LogEntry`; `X-Request-Id` response header\n- Grafana `error-visibility.json` dashboard provisioned automatically\n- Frontend error boundary in `_app.tsx`",
  "filename": "ADR-032-error-visibility.md"
}
```

- [ ] **Create `apps/landing/src/data/docs/concepts/observability.json`**

```json
{
  "slug": "observability",
  "title": "Error Observability",
  "description": "How Karmyq uses Grafana and Loki to diagnose errors across all services.",
  "content": "# Error Observability\n\n## Overview\n\nKarmyq ships structured JSON logs from all 11 services to Loki (via Promtail), visualized in Grafana. Every request gets a `requestId`; every error response includes an `X-Request-Id` header users can reference.\n\n## Error Types\n\nEvery log entry for a failed request includes an `error_type` field:\n\n- **`system_error`** — 5xx responses: unexpected crashes, DB failures, downstream timeouts.\n- **`user_error`** — 4xx responses: bad input, auth failures, not-found.\n\n## Grafana Dashboard\n\nThe **Error Visibility** dashboard at `/grafana` provides:\n\n- Error counts by service (last 24h)\n- Error rate over time per service\n- Recent system errors with full context\n- Recent user errors (4xx)\n- Errors indexed by request ID\n\n## Support Reference IDs\n\nWhen a 5xx error occurs, the response includes `X-Request-Id`. The frontend surfaces this as a reference code. Users can include this when reporting issues."
}
```

- [ ] **Update `apps/landing/src/data/docs/nav.json`** — add entries for ADR-032 (under "Architecture Decisions") and observability (under "Concepts").

---

## Task 8: CONTEXT.md + registry.json updates

**Files:**
- Modify: `services/community-service/CONTEXT.md` — no changes (no new endpoints)
- Modify: `packages/shared/CONTEXT.md` — document `error_type` and `X-Request-Id` additions to logger

- [ ] **Update `packages/shared/CONTEXT.md`** — in the logger/utils section, document: `error_type` field on `LogContext`/`LogEntry`, `X-Request-Id` set by `requestLoggingMiddleware`, both available since v9.12.0.

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

---

## Task 9: TDD integration test

**Files:**
- Create: `tests/tdd/error-visibility.test.ts`

- [ ] **Create `tests/tdd/error-visibility.test.ts`** — tests that `requestLoggingMiddleware` sets `X-Request-Id` response header and that error logs include `error_type`:

```typescript
import express from 'express';
import request from 'supertest';
import { createLogger, requestLoggingMiddleware } from '../../packages/shared/utils/logger';

describe('requestLoggingMiddleware', () => {
  const logger = createLogger('test');
  const app = express();
  app.use(requestLoggingMiddleware(logger));

  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.get('/bad-input', (_req, res) => res.status(400).json({ error: 'bad' }));
  app.get('/crash', (_req, res) => res.status(500).json({ error: 'crash' }));

  it('sets X-Request-Id on 200 response', async () => {
    const res = await request(app).get('/ok');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('sets X-Request-Id on 400 response', async () => {
    const res = await request(app).get('/bad-input');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('sets X-Request-Id on 500 response', async () => {
    const res = await request(app).get('/crash');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });
});
```

- [ ] **Run the new test**

```bash
npx jest tests/tdd/error-visibility --no-coverage 2>&1 | tail -15
```

---

## Task 10: Final verification + merge + deploy

**Files:** none

- [ ] **Type check shared package**

```bash
cd packages/shared && npx tsc --noEmit
```

- [ ] **Type check frontend**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

- [ ] **Run full test suite**

```bash
npm test
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Merge to master and deploy**

```bash
git add -A
git commit -m "feat(observability): error_type discriminator, X-Request-Id header, Grafana error dashboard, CommitmentsTab stale state fix"
git checkout master
git merge feature/sprint-46-error-visibility
git push origin master
```

Monitor GitHub Actions. No DB migration needed — no schema changes.

Use `/deploy` skill if manual deploy is needed.
