# SPRINT 46 — Error Visibility & Committed Match State

## Handoff Document

**Date**: 2026-04-06
**Current Version**: v9.11.0 → v9.12.0
**Status**: Plan approved. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-46-error-visibility`
3. Open plan: `docs/superpowers/plans/2026-04-06-sprint-46-error-visibility.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 46 Goal

Make errors observable in Grafana (structured `error_type` field, `X-Request-Id` response header, provisioned error dashboard) and fix CommitmentsTab showing stale "My Open Requests" after a match is accepted.

---

## Sprint 45 — COMPLETE ✅

Two commits shipped:
- `52db2fc` — feat(trust-config): externalize questionnaire to DB, expose all 7 feed weight sliders
- `824b5e2` — fix(community-service): mount trust-questions router at full path

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 43 | Feed Ranking v2 + Logging | ✅ Complete |
| Sprint 44 | Tech Debt + Architecture Review | ✅ Complete |
| Sprint 45 | Trust Configuration Externalization | ✅ Complete |
| **Sprint 46** | **Error Visibility + Committed Match State** | 🟡 Ready to execute |
| Sprint 47 | Group Communities / Onboarding | ⬜ Future |

---

## Sprint 46 — What Gets Built

### Error Visibility
- **`packages/shared/utils/logger.ts`**: Add `error_type: 'user_error' | 'system_error'` to `LogContext`/`LogEntry`. Set `X-Request-Id` response header immediately after generating `requestId` (before `next()`). Log `error_type` in `res.on('finish')` based on status code.
- **`apps/frontend/src/pages/_app.tsx`**: Class-based `ErrorBoundary` wrapping `<Component>`. Shows friendly message + `refId` for 5xx errors.
- **`apps/frontend/src/lib/api.ts`**: Axios response interceptor captures `x-request-id` header from 5xx responses, attaches as `error.refId`.
- **`infrastructure/observability/grafana/provisioning/dashboards/json/error-visibility.json`**: New Grafana dashboard — 5 Loki panels (error rate by service, rate over time, recent system/user errors, errors with request IDs). Auto-provisioned on next Grafana restart.

### CommitmentsTab Fix
- **`apps/frontend/src/components/CommitmentsTab.tsx`**: In `handleAccept` (requester-side), after match acceptance, remove the accepted request from `myOpenRequests` state. The backend already updates request status to `matched` correctly. This is a frontend state stale update only.

### Carryover Cleanup
- **`apps/frontend/tests/tdd/CommunityTrustQuestionnaire.test.tsx`**: Fix broken imports from Sprint 45 (`QUESTIONS`/`answersToConfig` from removed `trust-model.ts` exports).

### Docs
- ADR-032: error visibility convention
- ADR-015: status → Implemented
- Landing page: `observability.json` concept + `adr-032-error-visibility.json`

---

## Critical Implementation Notes

1. **`X-Request-Id` header timing**: set `res.setHeader('X-Request-Id', requestId)` BEFORE calling `next()` in `requestLoggingMiddleware` — NOT inside `res.on('finish')` (too late).

2. **`error_type` is a JSON body field, not a Promtail label**: write it as a normal `LogContext` field; LogQL queries it with `| json | error_type="system_error"`. No Promtail config changes needed.

3. **CommitmentsTab fix is requester-side only**: `handleAccept` with `side === 'requested'` — use `requested.find(m => m.id === matchId)?.request_id` to locate the request to filter from `myOpenRequests`.

4. **Grafana dashboard JSON**: must include `uid: "karmyq-error-visibility"`, `schemaVersion: 38`. Loki datasource: `{ "type": "loki", "uid": "loki" }`. Validate with `node -e "JSON.parse(...)"` before committing.

5. **No DB migration needed**: no schema changes in this sprint.

6. **Stale TDD test (`CommunityTrustQuestionnaire.test.tsx`)**: imports `QUESTIONS` and `answersToConfig` from `@/lib/trust-model` — both removed in Sprint 45. Fix or rewrite in Task 1.

---

## Spec & Plan

- Spec: `docs/superpowers/specs/2026-04-06-sprint-46-error-visibility-design.md`
- Plan: `docs/superpowers/plans/2026-04-06-sprint-46-error-visibility.md`

---

## Architecture Gotchas (Persistent)

- **Router mount paths**: always mount at the full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **`apps/landing/src/data/docs/`** is gitignored — generated at build time. Edit sources in `docs/concepts/`, `docs/guides/`, or `scripts/generate-docs.ts`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **PUT /config param order**: provider=$22–$24, v2 feed weights=$25–$27, communityId=$28.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **`answersToConfig`**: merges config_deltas in `display_order` ASC; Q6 (order 50) overrides Q2's `request_approval_required`.
