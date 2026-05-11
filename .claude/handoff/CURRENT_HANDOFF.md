# SPRINT 55 — UI Facelift | Next Up

## Handoff Document

**Date**: 2026-05-11
**Current Version**: v9.21.0 (Sprint 54 shipped)
**Status**: Sprint 54 complete + deployed. Sprint 55 (UI Facelift) is next.

---

## Sprint 54 — Complete ✅

All 6 OWASP vulnerabilities closed and pushed to master (commit `d867430`):

| Finding | Fix |
|---------|-----|
| SQL injection — `batchHardDelete()` | Whitelist guard exported as `ALLOWED_CLEANUP_TABLES` |
| Schema typo — `community.members` | Fixed to `communities.members` in cleanup-service |
| Broken access control — 8 reputation endpoints | `authMiddleware` added per-route |
| CORS `origin: '*'` — all 10 services | `ALLOWED_ORIGINS` env var allowlist |
| Missing security headers | `helmet()` across all 10 services |
| JWT 7-day lifetime, no refresh rotation | 1hr access tokens + SHA-256 hashed refresh tokens with replay protection |
| PII in logs (email on auth failure) | Email removed from warn/error log calls |

**DB migration needed on demo server** (GitHub Actions deploy handles code; migration must be run manually once):
```bash
ssh ubuntu@karmyq.com
psql -U postgres -d karmyq < ~/karmyq/infrastructure/postgres/migrations/20260510-refresh-tokens.sql
```

**Note**: JWT 1hr change will invalidate all existing sessions on first deploy — expected behavior.

**Note**: Set `ALLOWED_ORIGINS=https://karmyq.com` in `/home/ubuntu/karmyq/.env.demo` if not already there.

---

## Sprint 55 — UI Facelift

### Goal

Redesign the community detail page and dashboard using Claude Design feedback (when limits reset).

### What we know (audit from Sprint 54 context)

- **Dashboard**: 4 tabs → 3 (Browse / Active / Profile), remove sidebars (full-width), merge Commitments + My Requests into action-first "Active" tab
- **Design decisions confirmed**: no sidebars, 3 tabs, action-first filter (items needing response by default)
- **Claude Design tool feedback pending** — user was waiting on limits to reset; paste feedback into sprint planning session when available
- **Main complexity hotspots**:
  - `apps/frontend/src/components/CommitmentsTab.tsx` (616 lines)
  - `apps/frontend/src/pages/communities/[id].tsx` (2,257 lines)
- **Token inconsistency**: hardcoded `red-100`, `amber-100`, `blue-500` throughout — needs semantic token pass

### Quick Start for Sprint 55

1. Read `apps/frontend/.claude/README.md`
2. Get Claude Design feedback from user (paste it in)
3. Do layout audit + reference product research (skill: superpowers:brainstorming)
4. Then write spec + plan before implementing

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 51 | Trust scores + explore/exploit | ✅ Complete |
| Sprint 52 | Trust-path visibility in DibsPrompt | ✅ Complete |
| Sprint 53 | Test coverage: critical paths + CI enforcement | ✅ Complete + deployed |
| Sprint 54 | OWASP security hardening | ✅ Complete + deployed |
| **Sprint 55** | **UI Facelift (Claude Design)** | 🔵 Next up |

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: next ADR is **053**.
- **TDD test placement**: sprint TDD tests go in `services/request-service/tests/tdd/` (NOT root `tests/tdd/`). Imports are relative: `../../src/...`.
- **Router mount paths**: always mount at full path (e.g. `/communities/trust-questions`) when router uses `router.get('/')`.
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`.
- **Feed weights**: no sum constraint; normalized at query time in feed-service.
- **`git add` on CLAUDE.md**: file is tracked as lowercase `claude.md` — always `git add claude.md`.
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 tests fail), `sprint-43-feed-ranking` (crashes), schema-related tests. Do NOT fix.
- **Solo dev — no worktrees**: work directly on feature branches (`git checkout -b feature/sprint-NN`). Worktrees cause hundreds of npm install prompts, lockfile conflicts, and jest path bugs.
- **`?type=` routing in dibs-candidate**: `type === 'service'` → `getBestCandidate` (provider_profiles). Anything else → `getMutualAidBestCandidate` (auth.users).
- **Provider nav (post Sprint 50)**: `ProviderModeSwitcher` and `ProviderNotificationBell` are no longer rendered. Do not add them back. Only provider control in nav is the availability dot in `Layout.tsx`.
- **Explore tier — `sg.type = 'exchange'` only**: community-only connections do NOT qualify for explore dibs tier.
- **Trust path URL pattern**: `http://social-graph-service:3010/social-graph/paths/:userId` — nginx strips `/api` prefix but NOT the service prefix (`/social-graph`). Always use the full path when calling from request-service.
- **Provider offer acceptance**: `offersDb.acceptOffer` now correctly closes the request and rejects proposed matches. Mirrors `dibs.ts` and `matches.ts` accept paths — keep consistent if any new acceptance path is added.
- **Offer validation**: `providerOffersDb.validateRequestForOffer` uses live DB JOIN — no JWT community array. If touching this function, do not reintroduce JWT-based auth.
- **community-service coverage**: scoped to `src/services/**/*.ts` (NOT all src files) because DB-dependent routes can't reach 60% without a live DB. coverageProvider set to 'v8' to fix babel instrumentation bug.
- **Sprint 54 security gotchas**:
  - `ALLOWED_CLEANUP_TABLES` in cleanup-service is exported — tests import the constant directly (don't mock DB).
  - `isRefreshing` + `pendingRequests` in `apps/frontend/src/lib/api.ts` are module-level — must stay outside interceptor function body or the concurrent 401 queue breaks.
  - Refresh token raw value never stored — always SHA-256 hashed before DB insert.
  - `auth.refresh_tokens` table added in migration `20260510-refresh-tokens.sql` + in `init.sql` with `IF NOT EXISTS`.
- **Frontend lint pre-existing failure**: `@next/eslint-plugin-next` not found in CI — pre-existing since before Sprint 54. Not a blocker.
- **Version drift (pre-existing)**: 5 packages have version drift flagged by `npm run analyze:services`. Defer to a dedicated chore PR, do not mix with feature sprints.
