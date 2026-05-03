# SPRINT 50 — Complete ✅ | Sprint 51 Ready to Plan

## Handoff Document

**Date**: 2026-05-03
**Current Version**: v9.16.0 (deployed to karmyq.com via commit `2b4847a`)
**Status**: Sprint 50 complete and pushed. Sprint 51 not yet planned.

---

## Quick Start

Sprint 50 is done. To start Sprint 51:

1. Read this handoff
2. Run `/sprint-planning` to spec + plan Sprint 51 (trust-score-integrated matching — see multi-sprint arc below)
3. Or pick a different sprint goal if priorities have shifted

---

## What Sprint 50 Completed

**Commit**: `2b4847a feat(provider): Sprint 50 — provider on/off duty API sync + dibs for all request types`

### 5 gaps closed:

1. **Provider mode toggle now calls the API** — `ProviderContext.tsx` `setProviderMode` is now async; calls `PATCH /providers/:id/availability` for each active profile. Local state still updates synchronously first (UX is instant).

2. **Dibs available for all request types** — removed `scheduled_for` guards from both `GET /:id/dibs-candidate` and `POST /:id/dibs` in `services/request-service/src/routes/dibs.ts`.

3. **Mutual aid candidate query** — `getMutualAidCandidates()` in `dibsDb.ts` queries `auth.users` (not `provider_profiles`) for non-service requests. `getMutualAidBestCandidate()` wrapper in `dibsScoringService.ts`. `?type=service` → provider-profile candidates; anything else → mutual-aid candidates.

4. **Off-duty confirmation** — `ProviderModeSwitcher.tsx` shows inline banner "Active commitments won't be affected" with Go off-duty / Stay on buttons when switching from Provider → Member.

5. **24h expiry for non-scheduled requests** — `POST /:id/dibs` now uses `DIBS_FIXED_WINDOW_MS = 24 * 60 * 60 * 1000` when `scheduled_for` is null.

### Key files changed:
- `services/request-service/src/routes/dibs.ts`
- `services/request-service/src/db/dibsDb.ts`
- `services/request-service/src/services/dibsScoringService.ts`
- `apps/frontend/src/contexts/ProviderContext.tsx`
- `apps/frontend/src/components/ProviderModeSwitcher.tsx`
- `apps/frontend/src/components/RequestWizard.tsx`
- `apps/frontend/src/lib/api.ts`
- `docs/guides/provider-dibs-guide.md` (new)
- `docs/guides/dibs-request.md` (updated — removed stale scheduled-only language)
- `docs/guides/provider-mode-guide.md` (appended off-duty section)
- `docs/guides/using-service-providers-guide.md` (appended dibs from requester perspective)
- `services/request-service/CONTEXT.md`
- `services/registry.json`
- `tests/tdd/sprint-50-provider-dibs.test.ts` (new — 11 `it.todo()` placeholders)

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 37–42 | Provider profiles, rate cards, offers, dibs infrastructure | ✅ Complete |
| Sprint 50 | Wire the toggle + lift the scheduled-only restriction | ✅ Complete |
| **Sprint 51** | **Trust-score-integrated matching** | ⬜ To plan |

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
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
