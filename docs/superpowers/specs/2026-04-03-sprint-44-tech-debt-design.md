# Sprint 44: Tech Debt + Architecture Review — Design Spec

**Date**: 2026-04-03
**Status**: Approved
**Version**: v9.10.0 → v9.11.0
**Sprint Branch**: `feature/sprint-44-tech-debt`

---

## Overview

Sprint 43 delivered Feed Ranking v2. Sprint 44 is a no-new-features sprint while Ravi is
travelling. The goal is to reduce accumulated technical debt before the upcoming UI redesign
sprints and to produce a gap analysis that informs Sprint 45+ priorities.

Three workstreams: (1) security vulnerabilities, code quality, and CI hygiene; (2) propagating
the existing structured logging infrastructure into the service route handlers and frontend;
(3) an architecture review asking whether domain experts can operate each platform area without
developer involvement.

### Core Principle: Fix the Foundation

Before adding new capability, ensure what exists is secure, observable, and maintainable. This
sprint cleans up what's been deferred, and produces a clear-eyed assessment of where the platform
still requires developer involvement for routine operations.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 42 | Dibs / First Refusal | ✅ Complete, deployed |
| Sprint 43 | Feed Ranking v2 + Logging | ✅ Complete, deployed |
| Sprint 44 | Tech Debt + Architecture Review | 🟡 This sprint |
| Sprint 45 | UI Redesign / Pruning | ⬜ Upcoming |
| Sprint 45+ | Group Communities / Onboarding | ⬜ Future |

---

## Workstream 1 — Security & Code Quality

### npm Vulnerabilities

Current state at root workspace: 16 vulnerabilities (1 critical, 8 high, 3 moderate, 4 low).

Approach:
1. `npm audit fix` — resolve all auto-fixable without breaking changes
2. `npm audit fix --force` — resolve breaking-change packages; manually fix any API breaks in
   calling code
3. If a forced fix causes a break too invasive to fix in this sprint: revert that single package
   and document it as architecture debt in the gap analysis

### Node.js Version Bump

GitHub Actions workflows use outdated Node.js versions that will be force-upgraded to Node 24
in June 2026. Bump proactively now.

| File | Current | Target |
|------|---------|--------|
| `.github/workflows/ci.yml` | `NODE_VERSION: '20.x'` | `'24.x'` |
| `.github/workflows/test.yml` | `node-version: '18'` (×2) | `'24'` |
| `.github/workflows/e2e-tests.yml` | `node-version: '18'` (×1) | `'24'` |

### TypeScript Warnings — Full Cleanup

Fix **all** instances. Known locations from prior sprints (grep during implementation for
additional occurrences):

| File | Warning | Fix |
|------|---------|-----|
| `notification-service/src/notificationTemplates.ts` | Unused `data` param | Prefix `_data` |
| `feed-service/src/feed.ts` | Unused `feedComposer` import | Remove import |
| `feed-service/src/feedComposer.ts` | Unused `userBehavior` | Prefix `_userBehavior` |
| `cleanup-service/src/` middleware helpers | Unused `res`/`error` params | Prefix `_res`, `_error` |
| `scripts/generate-docs.ts` | Implicit `any` on `match` | Add `RegExpMatchArray \| null` type |

Run `tsc --noEmit` across all services to surface any additional instances not listed above.

### Mobile Lint

`@karmyq/mobile#lint` has been failing with exit code 2 since at least Sprint 42.
Isolate and fix the lint errors in `apps/mobile/`.

---

## Workstream 2 — Observability & Logging

### Current State

The shared logger (`@karmyq/shared/utils/logger`) exports `createLogger` and
`requestLoggingMiddleware`. Eight services mount it at `index.ts` level. However:

- **3 services have no structured logging**: `social-graph-service`, `cleanup-service`,
  `simulation-service` — no `createLogger` call in index.ts
- **Route handlers use raw console**: 174 `console.*` calls in route files across all services,
  vs only 19 `req.logger` calls — route-level errors are unstructured
- **Frontend**: 157 `console.*` calls; no global error boundary

### Service Logging Adoption

Add the standard 3-line pattern to the 3 uncovered services (copy from `auth-service/src/index.ts`):

```typescript
import { createLogger, requestLoggingMiddleware } from '@karmyq/shared/utils/logger';
const logger = createLogger('social-graph-service'); // or cleanup/simulation
app.use(requestLoggingMiddleware(logger));
```

### Route Handler Logging

Replace route-level `console.error('msg:', error)` with structured calls:

```typescript
// Before
console.error('Error fetching profile:', error);

// After
req.logger?.error('Error fetching profile', {
  service: 'social-graph-service',
  endpoint: 'GET /profile/:userId',
  error: error instanceof Error ? error.message : String(error)
});
```

Where `req` is not in scope (event callbacks, startup, cron handlers), use the module-level
`logger` from `createLogger(...)`.

**Scope rule**: Route handler `catch` blocks are mandatory. Dev-time startup messages
(`console.log('Server started on port...')`) are acceptable as-is.

### Frontend Error Handling

Add a global error boundary component in `apps/frontend/src/pages/_app.tsx` that:
- Catches unhandled React render errors
- Logs structured context: `{ component: displayName, error: err.message, info: componentStack }`
- Renders a user-friendly "Something went wrong" fallback with a reload button

Replace `console.error` in API call failure handlers (fetch/axios catch blocks) with structured
error objects:
```typescript
console.error('API error', {
  service: 'request-service',
  endpoint: '/requests',
  error: err.message
});
```

Full frontend console sweep is out of scope for this sprint — remaining instances are documented
as tech debt in the gap analysis.

---

## Workstream 3 — Architecture Review: Expert Contribution Gaps

### Purpose

Karmyq's thesis is that each domain (trust, community, requests, providers) can be operated by
a domain expert without developer involvement. This review asks: **is that actually true today?**

### Five Areas

**1. Trust Model Configuration (ADR-044)**
Can a community admin configure the trust questionnaire and scoring model via the admin UI,
or does it require direct database edits to `community_configs`?

**2. Feed Weight Configuration (ADR-048)**
Can admins set the 7 feed ranking weights (recency, relevance, match score, urgency, proximity,
relationship, reciprocity) via a UI, or only via SQL `UPDATE community_configs SET ...`?

**3. Request Type Schemas (ADR-032)**
Can new request types be added using server-driven UI schemas without a code deploy? Is the
admin surface for adding/editing schema definitions in place?

**4. Provider Directory Self-Management**
Can a service provider manage their complete presence end-to-end: profile, availability toggle,
rate card, service categories? Or are some operations admin/dev-only?

**5. Observability Access**
When something goes wrong, what does a community admin or provider see? Is there an in-app
error surface, or do they rely on filing support requests and waiting for a developer to check
`pm2 logs`?

### Deliverable Format

`docs/architecture/expert-contribution-gaps.md` — one section per area:

```markdown
## [Area Name]

**Current State**: What works today without developer involvement.
**Gap**: What requires developer or database access.
**Priority**: High / Medium / Low for the roadmap.
**Recommended Next Step**: Specific Sprint 45+ action.
```

---

## User Guide & Doc Updates

- **New concept page** (`apps/landing/src/data/docs/concepts/observability-logging.json`):
  Documents the structured logging approach, error shape, and what errors look like in pm2 logs
- **Nav.json update**: Add "Observability & Logging" entry to "Concepts" section
- **Service CONTEXT.md**: Update for any service where logging behavior changed materially
  (social-graph, cleanup, simulation — now have structured logging)

---

## Critical Implementation Notes

1. **req.logger availability** — `req.logger` is attached by `requestLoggingMiddleware`. In
   catch blocks where `req` is not in scope, use the module-level `logger` from
   `createLogger('service-name')` defined at the top of the route file or imported from index.

2. **console.* scope rule** — Route handler `catch` blocks must use `req.logger` or module
   `logger`. Startup/init `console.log` calls are acceptable and do not need changing.

3. **npm audit --force risk** — Run `npm test` after applying --force. If failures occur,
   `git diff package-lock.json` to identify the culprit package. Fix the API break or revert
   that single package and document it in the gap analysis as deferred debt.

4. **Node 24 compatibility** — After bumping CI workflows, verify no native addon build failures
   in GitHub Actions logs. Node 24 LTS is stable; breakage is unlikely but possible in older
   native modules.

5. **Gap analysis scope** — Task 9 produces documentation only. Do NOT start implementing any
   identified gaps in this sprint. The doc feeds Sprint 45+ prioritization.
