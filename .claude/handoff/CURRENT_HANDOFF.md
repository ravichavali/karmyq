# SPRINT 44 — Tech Debt + Architecture Review

## Handoff Document

**Date**: 2026-04-03
**Current Version**: v9.10.0 → v9.11.0
**Status**: Plan approved. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-44-tech-debt`
3. Open plan: `docs/superpowers/plans/2026-04-03-sprint-44-tech-debt.md`
4. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

---

## Sprint Goal

Reduce accumulated tech debt and produce an expert-contribution gap analysis before the
upcoming UI redesign sprints — no new features.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 42 | Dibs / First Refusal | ✅ Complete, deployed |
| Sprint 43 | Feed Ranking v2 + Logging | ✅ Complete, deployed |
| Sprint 44 | Tech Debt + Architecture Review | 🟡 Ready to execute |
| Sprint 45 | UI Redesign / Pruning | ⬜ Upcoming |
| Sprint 45+ | Group Communities / Onboarding | ⬜ Future |

---

## Three Workstreams

### Workstream 1 — Security & Code Quality
- `npm audit fix` then `npm audit fix --force` (fix API breaks; document reverted packages as debt)
- Bump Node.js: `ci.yml` 20.x → 24.x; `test.yml` + `e2e-tests.yml` 18 → 24
- Fix ALL TypeScript warnings (unused params, unused imports, implicit any)
- Fix mobile lint (`@karmyq/mobile#lint` exits 2 — pre-existing)

### Workstream 2 — Observability & Logging
- Add `createLogger` + `requestLoggingMiddleware` to social-graph, cleanup, simulation `index.ts`
  (3 services currently have no structured logging)
- Replace `console.error` in all service route handler catch blocks with `req.logger?.error(...)`
  using structured shape `{ service, endpoint, error: err.message }`
- Add global React error boundary to `apps/frontend/src/pages/_app.tsx`
- Replace `console.error` in frontend API call failure handlers with structured objects

### Workstream 3 — Architecture Review
- Investigate 5 areas: trust questionnaire, feed weights, request type schemas, provider
  directory, observability access
- Write `docs/architecture/expert-contribution-gaps.md` (doc only — do NOT implement fixes)

---

## Key Files

| File | Role |
|------|------|
| `docs/superpowers/plans/2026-04-03-sprint-44-tech-debt.md` | **Implementation plan — start here** |
| `docs/superpowers/specs/2026-04-03-sprint-44-tech-debt-design.md` | Design spec |
| `docs/architecture/expert-contribution-gaps.md` | Gap analysis (to create in Task 9) |
| `.github/workflows/ci.yml` | `NODE_VERSION: '20.x'` → `'24.x'` |
| `.github/workflows/test.yml` | `node-version: '18'` → `'24'` (×2) |
| `.github/workflows/e2e-tests.yml` | `node-version: '18'` → `'24'` (×1) |
| `services/social-graph-service/src/index.ts` | Add createLogger (missing) |
| `services/cleanup-service/src/index.ts` | Add createLogger (missing) |
| `services/simulation-service/src/index.ts` | Add createLogger (missing) |
| `apps/frontend/src/pages/_app.tsx` | Add error boundary |
| `tests/tdd/sprint-44-logging.test.ts` | Smoke test for logging middleware |

---

## Critical Implementation Notes

1. **req.logger availability** — `req.logger` is attached by `requestLoggingMiddleware`. In
   catch blocks where `req` is not in scope, use the module-level `logger` from
   `createLogger('service-name')` at the top of the route file.

2. **console.* scope rule** — Route handler `catch` blocks must use `req.logger` or module
   `logger`. Startup `console.log('Server started...')` calls are acceptable as-is.

3. **npm audit --force risk** — Run `npm test` after each `--force` application. On failure,
   `git diff package-lock.json` to find the culprit. Fix the API break or revert and document
   as deferred debt in the gap analysis.

4. **Node 24 compatibility** — Watch the first CI run after bumping. Native addon failures
   are unlikely but possible. If they occur, investigate before reverting.

5. **Gap analysis is docs only** — Task 9 writes `expert-contribution-gaps.md`. Do NOT start
   fixing identified gaps in this sprint. They feed Sprint 45+.

---

## Current State

- **Branch**: `master`
- **Latest commit**: `9189e4d fix(migration): drop feed_weights_sum constraint before adding new weight columns`
- **CI/CD**: All green ✅
- **Demo server**: Healthy

---

## Known Issues (carry-forward)

1. **npm vulnerabilities** — 16 at root (1 critical, 8 high); addressed in Task 2-3
2. **TypeScript warnings** — unused params in notificationTemplates.ts, feed.ts, feedComposer.ts,
   cleanup-service; addressed in Task 5
3. **Mobile lint** — `@karmyq/mobile#lint` exits 2; addressed in Task 6
4. **TDD integration tests** (`tests/tdd/sprint-42-dibs.test.ts`) — 11 tests fail with
   "Services not available" (expected in CI). Need live integration env to promote to regression.

---

## Persistent Context

### JWT Field
JWT payload uses `communities` (NOT `communityMemberships`) for the membership array.
Auth middleware: `const memberships = user.communities ?? []`

### Nginx Config
`infrastructure/nginx/nginx.conf` is source of truth — deploy.sh copies + reloads on each deploy.

### Module Resolution
`@karmyq/shared` subpaths require `moduleResolution: "node16"` and `module: "node16"`.

### Community Config Templates
Three existing presets in `community_configs`: Cohousing Default, Neighborhood Cautious,
Experimental Reciprocal.

### Error Observability (ongoing practice)
Every route handler catch block must produce structured logs: `{ service, endpoint, step, error }`.
Distinguish 400 (user error) from 500 (unexpected). Sprint 44 propagates this to all services.

### Solo Dev Workflow
Work directly on `feature/sprint-44-tech-debt` — no worktrees.
