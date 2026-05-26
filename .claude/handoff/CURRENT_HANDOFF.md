# Sprint 64: Admin-as-Connector + Feed ADR + Propose Fix | COMPLETE + DEPLOYED ✅

## Handoff Document

**Date**: 2026-05-25
**Current Version**: v9.40.0
**Status**: Sprint 64 complete + post-sprint fix deployed. Both pipelines **success**. karmyq.com is live on v9.40.0.

---

## Sprint 64 — What Was Done

All 3 code changes + docs delivered:

| Change | Status | File |
|--------|--------|------|
| "Community Pick" badge in BrowseFeed | ✅ Done | `apps/frontend/src/components/BrowseFeed.tsx` |
| Mod support in adminActions.ts | ✅ Done | `services/request-service/src/routes/adminActions.ts` |
| ADR-053 Feed Design Philosophy | ✅ Done | `docs/adr/ADR-053-feed-design-philosophy.md` |
| Landing ADR-053 JSON | ✅ Done | `apps/landing/src/data/docs/concepts/adr-053-feed-design-philosophy.json` |
| Landing nav.json ADR-053 entry | ✅ Done | `apps/landing/src/data/docs/nav.json` |
| admin-community guide expanded | ✅ Done | `apps/landing/src/data/docs/guides/admin-community.json` |
| request-service CONTEXT.md updated | ✅ Done | `services/request-service/CONTEXT.md` |
| TDD tests (4 passing) | ✅ Done | `apps/frontend/tests/tdd/sprint-64-admin-connector.test.tsx` |
| Version bump 9.29.0 → 9.40.0 | ✅ Done | `package.json` |

### Test Results
- Unit + regression: 27/27 tasks passing
- Sprint-64 TDD tests: 4/4 passing
- TypeScript check: clean (exit 0)

### Git
- Branch: `feature/sprint-64-admin-connector-adr` — merged to master, deleted
- Commit: `b637e7d` — feat(sprint-64): Community Pick badge, mod permissions, ADR-053 — v9.40.0

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 59 | Dashboard UX Simplification | ✅ Complete + deployed |
| Sprint 60 | Provider Browse Fork + Communities Polish | ✅ Complete + deployed |
| Sprint 61 | On-Duty Browse Refinement | ✅ Complete + deployed |
| Sprint 62 | Platform Coherence — 5 gaps | ✅ Complete + deployed |
| Sprint 63 | UX Coherence — admin, feed, visual language | ✅ Complete + deployed |
| **Sprint 64** | **Admin-as-Connector (badge + mod fix) + Feed ADR** | ✅ Complete + deploying |
| Sprint 65 | TBD — likely trust graph visualization or mobile parity | 🔲 Planned |

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: The `apps/landing/src/data/docs/` directory is in `.gitignore` — always use `git add -f` when committing JSON docs files.
- **ADR numbering**: next ADR is **054**.
- **TDD test placement**: frontend sprint tests go in `apps/frontend/tests/tdd/`. Imports are relative to frontend source.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes). Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches. Worktrees cause npm install prompts, lockfile conflicts, and jest path bugs.
- **BrowseModeControl**: shared component at `apps/frontend/src/components/BrowseModeControl.tsx`. `BrowseMode` type exported from there. `browseMode` state lives in `dashboard.tsx` and is passed to BrowseFeed (controlled). Active provider chip is now amber.
- **Tab id vs label**: Active tab has `id: 'helping'` (for URL routing) but label "Active". Do not change the id.
- **Response interceptor unwraps envelopes**: `socialGraphApi` (and all API clients) use a `responseInterceptor` that unwraps `{ success, data }` → `response.data = inner data`. Always use `res.data.field`, never `res.data.data.field`.
- **Flaky CI**: `feed-service` Docker build occasionally fails with npm install timeout. Not caused by code — retry if tests otherwise pass.
- **nav.json linter revert**: During Sprint 64 execution, the nav.json edit was silently reverted by something (linter?). Had to re-apply manually before committing. Watch for this on future nav.json edits — always verify with `grep` after editing.
- **Sprint 54 migration still needed on demo server** (if not yet run):
  ```bash
  ssh ubuntu@karmyq.com
  psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
  ```

---

## Next Sprint (65)

No plan written yet. Candidates:
- Trust graph visualization (show members how they're connected)
- Mobile parity (key flows in React Native app)
- Feed priority tiers (surface admin-proposed requests at top of BrowseFeed explicitly)
