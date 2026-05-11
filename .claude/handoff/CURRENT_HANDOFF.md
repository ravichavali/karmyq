# SPRINT 54 — OWASP Security Hardening | Ready to Execute

## Handoff Document

**Date**: 2026-05-10
**Current Version**: v9.20.0 → v9.21.0 (on completion)
**Status**: Sprint 54 fully scoped, spec + plan written. Next session executes.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-54-owasp-hardening`
3. Open plan: `docs/superpowers/plans/2026-05-10-sprint-54-owasp-hardening.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint 54 Goal

Close all OWASP Top 10 vulnerabilities identified in the security audit: SQL injection, broken access control, CORS misconfiguration, missing security headers (helmet), JWT lifetime + refresh token rotation, and PII in logs.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 51 | Trust scores + explore/exploit | ✅ Complete |
| Sprint 52 | Trust-path visibility in DibsPrompt | ✅ Complete |
| Sprint 53 | Test coverage: critical paths + CI enforcement | ✅ Complete + deployed |
| **Sprint 54** | **OWASP security hardening** | 🔵 Ready to execute |
| Sprint 55+ | UI Facelift (Claude Design) — deferred | ⬜ Upcoming |

---

## Sprint 54 — Vulnerability Inventory

### What was found (by OWASP category)

| Finding | Severity | File | Fix |
|---------|----------|------|-----|
| SQL injection — `batchHardDelete()` raw table name | HIGH | `cleanup-service/src/jobs/expirationJob.ts:147` | Whitelist |
| Schema typo — admin check queries wrong schema | MEDIUM | `cleanup-service/src/index.ts:106` | Fix typo |
| Broken access control — 8 reputation endpoints unauthenticated | HIGH | `reputation-service/src/routes/reputation.ts` | Add per-route auth |
| CORS `origin: '*'` — all 9 services wide open | HIGH | all `services/*/src/index.ts` | `ALLOWED_ORIGINS` env var |
| Missing security headers — no helmet.js anywhere | MEDIUM | all services | `helmet()` middleware |
| JWT 7-day lifetime, no refresh rotation | MEDIUM | `auth-service/src/routes/auth.ts:65` | 1hr + refresh tokens |
| PII in logs — email logged on auth failures | LOW | `auth-service/src/routes/auth.ts` | Remove email from logs |

---

## Sprint 54 — Design Spec

Full spec: `docs/superpowers/specs/2026-05-10-sprint-54-owasp-hardening-design.md`

---

## ⚠️ Critical Implementation Notes

1. **Refresh token raw value is never stored** — hash with SHA-256 before DB insert, compare hash on lookup.

2. **Replay attack protection**: if `used_at IS NOT NULL` on a refresh token, revoke ALL tokens for that user (token theft). Return 401.

3. **Frontend concurrent 401 queue**: `isRefreshing` flag and `pendingRequests` array MUST be module-level — declared outside the interceptor function body. If declared inside, they reset per request and the queue never works.

4. **social-graph-service already has custom CORS** (`services/social-graph-service/src/index.ts`) — replace the existing call, do not add a second `app.use(cors(...))`.

5. **geocoding-service is JavaScript** (`services/geocoding-service/index.js`) — use `require('helmet')` and `require('cors')` (CommonJS, not TypeScript imports).

6. **cleanup-service schema fix**: `community.members` → `communities.members` in `src/index.ts` line 106.

7. **JWT expiry 7d → 1h will log out all existing sessions on deploy.** Expected behavior for demo env. Note in deploy checklist.

8. **`batchHardDelete` whitelist** exact values: `'requests.help_requests'`, `'requests.help_offers'`, `'messaging.messages'`, `'notifications.notifications'`.

9. **Add `authenticateToken` per-route** on reputation endpoints — not at the router level. Per-route avoids breaking internal service calls.

10. **`ALLOWED_ORIGINS` env var** — comma-separated list, trim values. Add `ALLOWED_ORIGINS=https://karmyq.com` to `infrastructure/docker/.env.demo`.

---

## Task Summary (10 tasks)

| Task | What |
|------|------|
| Task 1 | Feature branch + DB migration (`auth.refresh_tokens` table) |
| Task 2 | SQL injection fix + schema typo fix in cleanup-service |
| Task 3 | Reputation service: add auth to 8 unauthenticated endpoints |
| Task 4 | Helmet + CORS hardening across all 10 services |
| Task 5 | JWT 1hr + refresh token backend (auth-service) |
| Task 6 | Frontend: refresh token interceptor + concurrent 401 queue |
| Task 7 | ADR-052 + auth-service CONTEXT.md + landing page docs |
| Task 8 | TDD tests (refresh token rotation, cleanup whitelist) |
| Task 9 | `.env.demo` update + final type check + `npm test` |
| Task 10 | Merge + deploy + SSH migration + health check |

---

## Architecture Gotchas (Persistent)

- **Landing page docs source**: edit `docs/guides/*.md` + update `scripts/generate-docs.ts` arrays. Run `cd apps/landing && npm run generate-docs` to regenerate. Never hand-edit `apps/landing/src/data/docs/` directly.
- **ADR numbering**: next ADR is **052** (this sprint).
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

---

## UI Facelift — Sprint 55 Context (preserved)

Audit completed 2026-05-10. Key findings for when Sprint 55 starts:
- **Dashboard**: 4 tabs → 3 (Browse / Active / Profile), remove sidebars (full-width), merge Commitments + My Requests into action-first "Active" tab
- **Design decisions confirmed**: no sidebars, 3 tabs, action-first filter (items needing response by default)
- **Claude Design tool feedback pending** — user waiting on limits to reset; paste feedback into sprint planning session when available
- **Audit findings**: `apps/frontend/src/components/CommitmentsTab.tsx` (616 lines), `apps/frontend/src/pages/communities/[id].tsx` (2,257 lines) are main complexity hotspots
- **Token inconsistency**: hardcoded `red-100`, `amber-100`, `blue-500` throughout — needs semantic token pass
