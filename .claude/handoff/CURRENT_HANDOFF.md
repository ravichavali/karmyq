# SPRINT 42 COMPLETE — READY FOR SPRINT 43

## Handoff Document

**Date**: 2026-03-31
**Current Version**: v9.17.0 (Sprint 42 complete)
**Status**: Deployed to karmyq.com ✅

---

## Sprint 42 Summary: Direct Dibs Request

**Feature**: Scheduled requests can nominate one trusted provider (prior completed interaction required) for first right of refusal before broadcasting publicly. Dibs window = 20% of lead time. ASAP requests always broadcast immediately.

**All 14 tasks completed and deployed.**

### What shipped

- `requests.help_requests.scheduled_for` column (TIMESTAMPTZ, nullable)
- `requests.dibs` table with FK integrity and unique-per-request constraint
- `GET /:id/dibs-candidate` — surfaces best candidate via trust/interaction scoring
- `POST /:id/dibs` — submit dibs, flips request to `dibs_pending`
- `GET /dibs/pending-for-provider` — provider sees their open dibs
- `PUT /dibs/:id/accept` — creates match, broadcasts `dibs_accepted` event
- `PUT /dibs/:id/decline` — flips back to `open`, broadcasts `dibs_declined` event
- `*/5 * * * *` expiry cron in cleanup-service
- 4 notification events: `dibs_submitted`, `dibs_accepted`, `dibs_declined`, `dibs_expired`
- `DibsPrompt` overlay in RequestWizard post-creation
- `DibsCard` with live countdown in CommitmentsTab provider section
- User guide: `apps/landing/src/data/docs/guides/dibs-request.json`
- 18/18 unit tests passing (dibsScoringService)

### Post-deploy fixes (part of this sprint)
- `init.sql` updated with `scheduled_for` + `dibs` table (CI test database fix)
- Both migration files idempotent (`IF NOT EXISTS` guards)

---

## Current State

- **Branch**: `master` (feature branch deleted)
- **Commits**: All Sprint 42 work at `2d94bcf`
- **CI/CD**: All green (Tests ✅, CI/CD Pipeline ✅, CodeQL ✅)
- **Demo server**: request-service, cleanup-service, notification-service all healthy
- **Migrations**: Both `20260328-*.sql` applied on karmyq.com

---

## Known Issues / Follow-ups

1. **GitHub security vulnerabilities** (28 total: 1 critical, 16 high, 9 moderate, 2 low) — Dependabot alerts on default branch. See IDEAS.md `[2026-03-11] architecture` entry. Address before any investor review.

2. **Pre-existing TypeScript warnings** (captured in IDEAS.md `[2026-03-30] other`) — unused params in notificationTemplates.ts, feed.ts, feedComposer.ts, cleanup-service helpers, generate-docs.ts. Low-priority cleanup.

3. **TDD integration tests** (`tests/tdd/sprint-42-dibs.test.ts`) — 11 tests fail with "Services not available" (expected — no live server in CI). Promotion to regression requires a live integration environment.

---

## Starting Sprint 43?

1. Check IDEAS.md for open questions and architecture notes
2. Create new spec + plan in `docs/superpowers/`
3. Check out a new feature branch: `git checkout -b feature/sprint-43-{slug}`
4. Run `/execute-plan` or `/superpowers:subagent-driven-development`
