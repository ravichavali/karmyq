# SPRINT 48 — Onboarding: Contextual Workflow Guides

## Handoff Document

**Date**: 2026-04-08
**Current Version**: v9.13.0 → v9.14.0
**Status**: Sprint 47 complete. Sprint 48 spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-48-onboarding`
3. Open plan: `docs/superpowers/plans/2026-04-08-sprint-48-onboarding.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 48 Goal

Add contextual onboarding overlays to four workflows (feed, communities, requests, activities). Each overlay shows once per device on first visit, explains the concept in 2–4 steps, and never appears again after dismissal. All content lives in one config file for easy maintenance.

---

## What This Sprint Builds

- `apps/frontend/src/lib/onboarding/workflows.ts` — central content config (all step definitions)
- `apps/frontend/src/hooks/useOnboarding.ts` — localStorage read/write hook
- `apps/frontend/src/components/OnboardingOverlay.tsx` — reusable step-by-step modal
- Wired into: `dashboard.tsx`, `communities/index.tsx`, `requests/index.tsx`, `ActivitiesTab.tsx`
- User guide on landing page + CLAUDE.md checklist update
- No database changes — localStorage only

---

## ⚠️ Critical Implementation Notes

1. **`shouldShow` must be false during SSR** — `localStorage` is not available server-side. Initialize state to `false`, set in a `useEffect`. Never read localStorage outside of a `useEffect` or event handler.
2. **One overlay at a time** — only the current page's overlay shows. Do not queue or stack overlays.
3. **Skip and Done are equivalent** — both call `markSeen()` and `onDismiss()`. "Skip" is labelled to feel lower-commitment; there is no functional difference.
4. **Overlay renders on top of everything** — use `z-50` and a full-screen backdrop. Page content must not be interactive while overlay is open.
5. **localStorage key is `"karmyq_onboarding"`** — a JSON object. Always read the full object, update the relevant key, and write back. Never write per-key localStorage entries.
6. **ActivitiesTab trigger** — the activities overlay fires on first render of the tab component, not on page load. A user visiting a mutual_aid community (no Activities tab) must NOT consume the `activities` seen-state.
7. **No backend change** — `onboarding_completed` on `auth.users` is explicitly out of scope. localStorage is sufficient for the demo.

---

## Task Summary (9 tasks)

| # | Task | Key files |
|---|------|-----------|
| 1 | Feature branch + central config file | `src/lib/onboarding/workflows.ts` |
| 2 | `useOnboarding` hook | `src/hooks/useOnboarding.ts` |
| 3 | `OnboardingOverlay` component | `src/components/OnboardingOverlay.tsx` |
| 4 | Wire into feed + communities | `dashboard.tsx`, `communities/index.tsx` |
| 5 | Wire into requests + ActivitiesTab | `requests/index.tsx`, `ActivitiesTab.tsx` |
| 6 | TDD tests | `tests/tdd/sprint-48-onboarding.test.ts` |
| 7 | User guide + nav.json + CLAUDE.md checklist | `guides/onboarding.json`, `nav.json`, `CLAUDE.md` |
| 8 | Full verification (tsc, tests, feedback:check, smoke test) | — |
| 9 | Merge + Deploy | `git push`, GitHub Actions |

---

## Spec & Plan

- **Design spec**: `docs/superpowers/specs/2026-04-08-sprint-48-onboarding-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-04-08-sprint-48-onboarding.md`

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 45 | Trust Configuration Externalization | ✅ Complete |
| Sprint 46 | Error Visibility + Committed Match State | ✅ Complete |
| Sprint 47 | Group Communities — Data Model + Activity Scheduling | ✅ Complete |
| **Sprint 48** | **Onboarding — Contextual Workflow Guides** | 🔵 Ready to execute |
| Sprint 49 | Community Discovery + Empty States | Upcoming |

---

## Sprint 47 — COMPLETE ✅

Deployed to karmyq.com via commit `479212c`. CI/CD pipeline run 24115305660 completed success.

### What was built

**Database**
- Migration `20260407-group-communities.sql`: adds `community_type` column, creates `communities.activities` + `communities.activity_participants` tables, 5 indexes
- `init.sql` updated with full schema (for fresh deploys)

**Community Service**
- `community_type` exposed on all community GET/POST endpoints
- New `routes/activities.ts`: 5 endpoints (list, create, get, join, leave) with two-step atomic join, capacity guard, denormalized `current_participants`

**Frontend**
- Community creation page: mutual_aid / group radio toggle
- `ActivitiesTab.tsx`, `ActivityCard.tsx`, `CreateActivityModal.tsx` — Activities tab shown only on group communities
- API client updated with getActivities, joinActivity, leaveActivity, createActivity

**Simulation**
- 4 GROUP_COMMUNITIES templates, ACTIVITY_TEMPLATES data
- `schedule-activity-workflow.ts`, `join-activity-workflow.ts`
- Profile weights updated (SOCIAL_USER, ACTIVE_HELPER, COMMUNITY_BUILDER get joinActivity)

**Docs**
- ADR-050 (Implemented), concept page, user guide, landing page regenerated

### Key lessons from Sprint 47
- `ADD CONSTRAINT IF NOT EXISTS` is not valid PostgreSQL — use `DO $$ BEGIN IF NOT EXISTS ... THEN ... END IF; END$$;`
- GRANT statements in migrations fail on demo if the role doesn't exist in pg_roles; init.sql's blanket grant covers it
- Simulation workflows must call `client.getCommunities()` — SimulatedUser has no decoded JWT communities field
- `Router({ mergeParams: true })` required for nested routers; mount specific paths BEFORE generic ones in index.ts

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/concepts/*.md` + `scripts/generate-docs.ts`. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly (gitignored/generated).
  - **Exception for Sprint 48**: `guides/onboarding.json` and `nav.json` are written directly (they are not generated by generate-docs).
- **ADR numbering**: highest existing ADR is 050. Next is **051**.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail) and `sprint-43-feed-ranking` (crashes). These are NOT regressions — do not attempt to fix them.
