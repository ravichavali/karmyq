# SPRINT 49 — Community Discovery + Empty States

## Handoff Document

**Date**: 2026-04-09
**Current Version**: v9.14.0 → v9.15.0
**Status**: Sprint 48 complete and deployed. Sprint 49 ready to plan.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to spec and plan Sprint 49
3. Or if the plan already exists: `git checkout -b feature/sprint-49-discovery` and execute

---

## Sprint 48 — COMPLETE ✅

Deployed to karmyq.com via commit `7985fe4`. CI/CD pipeline run 24172247204 completed success (12m24s).

### What was built

**Frontend — Onboarding Overlays**
- `apps/frontend/src/lib/onboarding/workflows.ts` — central config for all four workflows (feed, communities, requests, activities)
- `apps/frontend/src/hooks/useOnboarding.ts` — SSR-safe hook (initializes `shouldShow: false`, sets in `useEffect`)
- `apps/frontend/src/components/OnboardingOverlay.tsx` — step modal with Back/Next/Skip/Done + dot indicators
- Wired into: `dashboard.tsx` (feed), `communities/index.tsx`, `requests/index.tsx`, `ActivitiesTab.tsx`
- State stored in `localStorage` under key `karmyq_onboarding` — JSON object with per-workflow seen flags

**Tests**
- `tests/tdd/sprint-48-onboarding.test.ts` — 22 tests covering hook logic, step navigation, corrupt localStorage handling, and workflow config integrity. All passing.

**Docs**
- `docs/guides/onboarding-guide.md` — source file for user guide
- `scripts/generate-docs.ts` — updated GUIDE_ORDER / GUIDE_LABELS / GUIDE_SLUGS to include `onboarding-guide`
- Landing page regenerated: `apps/landing/src/data/docs/guides/onboarding.json` + nav entry added
- `claude.md` — added "Onboarding content updated" checklist item to Documentation section

### Key lessons from Sprint 48

- **generate-docs deletes and recreates OUT_DIR** — never hand-edit `apps/landing/src/data/docs/` directly. Always add guide source to `docs/guides/` and update the three arrays in `scripts/generate-docs.ts` (GUIDE_ORDER, GUIDE_LABELS, GUIDE_SLUGS). The "write directly" exception in the Sprint 48 handoff was wrong.
- **generate-docs is triggered by `prebuild`** which runs before every turbo `test` run — any direct edits to `apps/landing/src/data/docs/` will be overwritten on the next test run.
- **`claude.md` is tracked in git as lowercase** — `git add CLAUDE.md` silently does nothing on Windows. Use `git add claude.md`.
- **`git add` on gitignored tracked files** — `apps/landing/src/data/docs/` is gitignored but files are tracked (force-added). Use `git add -u apps/landing/src/data/docs/` to stage modified tracked files; use `git add -f` for new files in that directory.
- **Pre-existing TDD failures** remain: `sprint-39-provider-ux` (7 tests fail) and `sprint-43-feed-ranking` (crashes). Do not attempt to fix them.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 45 | Trust Configuration Externalization | ✅ Complete |
| Sprint 46 | Error Visibility + Committed Match State | ✅ Complete |
| Sprint 47 | Group Communities — Data Model + Activity Scheduling | ✅ Complete |
| Sprint 48 | Onboarding — Contextual Workflow Guides | ✅ Complete |
| **Sprint 49** | **Community Discovery + Empty States** | 🔵 Ready to plan |
| Sprint 50 | TBD | Upcoming |

---

## Sprint 49 Direction

The roadmap names "Community Discovery + Empty States" as the next sprint. Likely scope:

- **Empty states** for zero-content views: feed with no requests, communities page before joining any, requests page for new users, ActivitiesTab with no activities scheduled
- **Community discovery improvements**: better search UX, suggested communities based on location/interests, onboarding flow that leads new users to join their first community

This is not yet specced. Start with `/sprint-planning` to nail down the exact scope before implementation.

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: highest existing ADR is 050. Next is **051**.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **trust-questions route**: must be registered BEFORE the generic config route in `community-service/src/index.ts`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail) and `sprint-43-feed-ranking` (crashes). These are NOT regressions — do not attempt to fix them.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
