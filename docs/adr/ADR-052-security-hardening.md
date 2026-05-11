# ADR-052: Security Hardening — OWASP Top 10 Baseline

**Date**: 2026-05-10
**Status**: Implemented
**Sprint**: 54

## Context

No security audit had been performed on Karmyq prior to Sprint 54. An OWASP Top 10 review identified vulnerabilities across six categories: SQL injection, broken access control, CORS misconfiguration, missing security headers, JWT token lifetime, and PII in log output.

## Decision

Close all identified vulnerabilities in one sprint using targeted fixes at the exact vulnerability layer. No architectural changes — only hardening of existing patterns.

### Changes Made

**SQL Injection (A03)**
- Added `ALLOWED_CLEANUP_TABLES` whitelist to `batchHardDelete()` in cleanup-service. The function accepted raw table names interpolated into a SQL query; now throws if the table is not in the allowlist.
- Fixed schema typo `community.members` → `communities.members` in cleanup-service admin auth check (was causing 403s on all admin endpoints).

**Broken Access Control (A01)**
- Added `authMiddleware` per-route to 8 unauthenticated endpoints in reputation-service: `/karma/:userId`, `/trust/:userId`, `/trust/:userId/:communityId`, `/community-trust/:communityId`, `/leaderboard/:communityId`, `/history/:userId`, `/badges/:userId`, `/users/:userId/badges`.
- Per-route (not router-level) to avoid breaking internal service-to-service calls.

**CORS Misconfiguration (A05)**
- Replaced `cors()` (origin: `*`) with an allowlist-based origin check across all 10 services.
- Origin list is configured via `ALLOWED_ORIGINS` env var (comma-separated, trimmed). Default: `http://localhost:3000`. Production: `https://karmyq.com`.

**Security Headers Missing (A05)**
- Added `helmet()` middleware to all 10 services (9 TypeScript + geocoding-service JavaScript).

**JWT Token Lifetime (A07)**
- Changed access token lifetime from 7 days to 1 hour.
- Added `auth.refresh_tokens` table with rotation and replay protection.
- New `POST /auth/refresh` endpoint: accepts refresh token, validates, rotates (marks old as used+revoked, issues new), returns new access token + refresh token.
- Replay attack protection: if a refresh token is presented after already being used (`used_at IS NOT NULL`), all tokens for that user are revoked.
- Frontend: module-level `isRefreshing` flag and `pendingRequests` queue to handle concurrent 401s correctly.
- Refresh tokens stored in localStorage (consistent with existing access token storage — acceptable risk for demo platform).

**PII in Logs (A09)**
- Removed email field from all auth failure log entries in auth-service (`warn` and `error` calls on login/register failures).

## Consequences

- Existing 7-day sessions are invalidated on deploy (users must re-login). Acceptable for demo env.
- All services now require `ALLOWED_ORIGINS` env var for non-localhost CORS. Set in `.env.demo` as `https://karmyq.com`.
- The `POST /auth/refresh` endpoint replaces the old access-token-based refresh that was exposed under the same path. Old clients that pass an access token in the body will get a 400 (refreshToken required).
- DB migration required on deploy: `infrastructure/postgres/migrations/20260510-refresh-tokens.sql`.
