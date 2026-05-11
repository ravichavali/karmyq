# Sprint 54: OWASP Security Hardening — Design Spec

**Date**: 2026-05-10
**Status**: Approved
**Version**: v9.20.0 → v9.21.0
**Sprint Branch**: `feature/sprint-54-owasp-hardening`

---

## Overview

Karmyq has never had a dedicated security review. An OWASP Top 10 audit conducted in Sprint 54 scoping identified six distinct vulnerability classes across the codebase: SQL injection via unsanitized table names, broken access control on the reputation service, open CORS on all services, missing security headers, a 7-day JWT with no rotation, and PII leaking into logs.

This sprint closes all identified findings. The scope is deliberately contained to the specific vulnerabilities found — no speculative hardening, no architecture changes beyond what's required. The goal is to bring the platform to a defensible baseline before the UI Facelift sprint.

### Core Principle: Fix At The Layer Where The Problem Lives

Every fix targets the exact location of the vulnerability. No workarounds — no nginx rewrites to hide open CORS, no client-side filters to compensate for missing auth. Where auth is missing, add auth. Where SQL is raw, add a whitelist. Where headers are absent, add helmet.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 53 | Test coverage + CI enforcement | ✅ Complete |
| **Sprint 54** | **OWASP security hardening** | 🔵 In Progress |
| Sprint 55+ | UI Facelift (Claude Design) | ⬜ Upcoming |

---

## Vulnerability Inventory

### A01 — Broken Access Control

**Finding**: `services/reputation-service/src/routes/reputation.ts` has 8 endpoints that return user karma, trust scores, karma history, badges, and community leaderboards — all accessible without authentication. The service-level `authMiddleware` wrapper applies to the `/reputation` prefix but individual route handlers lack their own auth check, violating defense-in-depth.

**Fix**: Add `authenticateToken` middleware to each of the 8 unauthenticated route handlers in `reputation.ts`.

### A03 — SQL Injection

**Finding 1**: `services/cleanup-service/src/jobs/expirationJob.ts` lines 147–152 — `batchHardDelete(table)` interpolates the `table` parameter directly into a SQL DELETE statement: `` DELETE FROM ${table} ``. If called with attacker-controlled input, this allows arbitrary table deletion.

**Fix**: Add a `ALLOWED_CLEANUP_TABLES` whitelist constant. Validate `table` against the whitelist at function entry; throw if not found. Valid tables: `requests.help_requests`, `requests.help_offers`, `messaging.messages`, `notifications.notifications`.

**Finding 2**: `services/cleanup-service/src/index.ts` line 106 — admin auth check queries `community.members` (wrong schema) instead of `communities.members`. If the query returns 0 rows due to schema mismatch, the `is_admin` check fails and admin endpoints become inaccessible — or depending on error handling, potentially bypassed.

**Fix**: Correct the schema name to `communities.members`.

### A05 — Security Misconfiguration

**CORS Finding**: All 9 backend services call `app.use(cors())` with no arguments, defaulting to `origin: '*'`. This allows any domain to make credentialed API requests.

**Fix**: Replace with a restricted origin allowlist read from `ALLOWED_ORIGINS` env var. Default: `http://localhost:3000`. Production `.env.demo` value: `https://karmyq.com`. Use a function-style CORS origin callback to allow multiple origins from a comma-separated env var.

**Headers Finding**: No service uses `helmet.js`. Missing headers include `X-Frame-Options` (clickjacking), `X-Content-Type-Options` (MIME sniffing), `Strict-Transport-Security`, and `Referrer-Policy`.

**Fix**: Add `helmet()` as the first middleware in all 10 services (auth, community, request, reputation, notification, messaging, social-graph, feed, cleanup, geocoding). Geocoding service is JavaScript — add via npm install.

### A07 — Authentication Failures

**Finding**: Access tokens have a 7-day lifetime (`expiresIn: '7d'` in `services/auth-service/src/routes/auth.ts` line 65). No refresh token infrastructure exists. Compromised tokens remain valid for up to 7 days with no revocation mechanism.

**Fix**: Reduce access token lifetime to 1 hour. Add refresh token infrastructure: DB table, issue on login/register, rotate on each use, revoke on logout. Frontend: replace the current "logout on 401" behavior with token refresh + retry.

### A09 — Security Logging Failures

**Finding**: `services/auth-service/src/routes/auth.ts` logs the user's email address in warn-level entries for failed registration and login attempts. Email is PII and should not appear in structured log output.

**Fix**: Replace email logging with a non-identifying indicator (e.g., hash suffix of email domain, or omit email entirely). User ID is safe to log once a user exists.

---

## Data Model

### New Table: `auth.refresh_tokens`

```sql
-- infrastructure/postgres/migrations/20260510-refresh-tokens.sql

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hex of the raw token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON auth.refresh_tokens(token_hash);
```

The raw token is never stored — only the SHA-256 hex hash. This means a DB breach exposes no usable tokens.

---

## API Changes

### Modified: `POST /auth/login` and `POST /auth/register`

**Before**:
```json
{ "success": true, "data": { "token": "...", "user": {...} } }
```

**After**:
```json
{
  "success": true,
  "data": {
    "token": "<access_token>",         // JWT, 1hr
    "refreshToken": "<refresh_token>", // UUID hex, 7d
    "user": { ... }
  }
}
```

### New: `POST /auth/refresh`

**Request**:
```json
{ "refreshToken": "<refresh_token>" }
```

**Response (success)**:
```json
{
  "success": true,
  "data": {
    "token": "<new_access_token>",
    "refreshToken": "<new_refresh_token>"
  }
}
```

**Response (expired/invalid)**:
```json
{ "success": false, "message": "Invalid or expired refresh token", "error": "INVALID_REFRESH_TOKEN" }
```

**Behavior**: validate token hash, check not expired/revoked/used, mark old token `used_at = now()` + `revoked = true`, generate and store new refresh token, return new access token + new refresh token. If the same refresh token is used twice (replay attack), revoke all tokens for that user.

### Modified: `POST /auth/logout`

Accepts optional `{ "refreshToken": "<token>" }` in body. If provided, marks the token as revoked in DB. Works without a refresh token for clients that don't have one.

---

## Frontend Changes

### `apps/frontend/src/lib/api.ts`

Replace the current `errorInterceptor` with a refresh-aware version:

1. On 401: attempt `POST /auth/refresh` with stored `refreshToken`
2. On refresh success: update `localStorage.token` + `localStorage.refreshToken`, retry the original request
3. On refresh failure: clear tokens, redirect to `/login`
4. **Concurrent 401s**: use a `isRefreshing` flag + a `pendingRequests` queue — only one refresh call runs at a time; all queued requests resolve with the new token once refresh completes

```typescript
// Pattern for concurrent 401 handling
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

// In errorInterceptor:
if (error.response?.status === 401 && !error.config._retry) {
  if (isRefreshing) {
    return new Promise(resolve => {
      pendingRequests.push(token => {
        error.config.headers.Authorization = `Bearer ${token}`;
        resolve(axios(error.config));
      });
    });
  }
  error.config._retry = true;
  isRefreshing = true;
  // ... call refresh, drain queue, retry
}
```

### `apps/frontend/src/lib/api.ts` — login/register response handling

Store `refreshToken` from login/register response into `localStorage.setItem('refreshToken', ...)`.

---

## CORS Configuration (all services)

Replace `app.use(cors())` with:

```typescript
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (no origin header) and allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
```

Add `ALLOWED_ORIGINS=https://karmyq.com` to `infrastructure/docker/.env.demo`.

---

## Helmet Configuration (all services)

```typescript
import helmet from 'helmet';
app.use(helmet());  // Apply before all other middleware
```

Default helmet settings cover: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `X-DNS-Prefetch-Control: off`, `Referrer-Policy: no-referrer`. On production (HTTPS), `Strict-Transport-Security` is also activated automatically.

---

## User Guide & Doc Updates

- **New ADR-052**: Document the security hardening decisions (refresh tokens, CORS policy, helmet adoption)
- **Landing page**: Add `adr-052-security-hardening.json` to `apps/landing/src/data/docs/concepts/` + nav.json "Architecture Decisions"
- **Auth service CONTEXT.md**: Update "API Endpoints" with `/auth/refresh` and modified login/register responses; update "Database Schema" with `auth.refresh_tokens`

---

## Critical Implementation Notes

1. **Refresh token raw value is never stored** — always hash with `crypto.createHash('sha256').update(token).digest('hex')` before inserting. Compare hash when validating.

2. **Replay attack protection**: if `used_at IS NOT NULL` and someone tries to use the token again, revoke ALL refresh tokens for that user immediately (token theft indicator).

3. **Frontend concurrent 401 queue**: the `isRefreshing` flag and `pendingRequests` queue MUST be module-level (outside the interceptor function) — not inside a closure that resets on each request.

4. **CORS `credentials: true`** is required if the frontend ever sends cookies. Set it now even if not currently needed.

5. **social-graph-service already has custom CORS** at `services/social-graph-service/src/index.ts` — replace the existing `cors({ origin: ... })` call, don't add a second one.

6. **geocoding-service is JavaScript** (`index.js`, not TypeScript) — install `helmet` and `cors` normally, import as CommonJS `const helmet = require('helmet')`.

7. **cleanup-service schema fix** (`community.members` → `communities.members`) is in `src/index.ts` line 106 — this is a correctness bug, not just security. Fix it first before testing admin endpoints.

8. **JWT expiry from 7d to 1h** — this WILL log out all existing sessions immediately after deploy. Acceptable for a demo environment; note it in the handoff.

9. **`batchHardDelete` whitelist** must match exactly the schema-qualified table names used in `hardDeleteExpiredData` — use `'requests.help_requests'`, `'requests.help_offers'`, `'messaging.messages'`, `'notifications.notifications'`.

10. **Don't add `authenticateToken` to the reputation service's router-level middleware** — add it per-route to the 8 endpoints. The router-level middleware is shared with internal service calls; per-route is safer and more explicit.
