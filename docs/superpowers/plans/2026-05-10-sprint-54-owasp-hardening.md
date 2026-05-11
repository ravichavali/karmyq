# Sprint 54: OWASP Security Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close all OWASP Top 10 vulnerabilities identified in the Sprint 54 security audit — SQL injection, broken access control, CORS misconfiguration, missing security headers, JWT lifetime, and PII in logs.

**Architecture:** No new services. Changes span 10 existing backend services (middleware + config), the auth-service (new DB table + new endpoint), and the frontend API client (token refresh interceptor).

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260510-refresh-tokens.sql` | Add `auth.refresh_tokens` table |
| `services/auth-service/src/utils/refreshToken.ts` | Generate, hash, store, validate refresh tokens |

### Existing files to modify
| File | Change |
|------|--------|
| `services/auth-service/src/routes/auth.ts` | JWT 1hr, issue refresh tokens on login/register, add /auth/refresh, update logout, sanitize PII logs |
| `services/cleanup-service/src/jobs/expirationJob.ts` | Add `ALLOWED_CLEANUP_TABLES` whitelist to `batchHardDelete()` |
| `services/cleanup-service/src/index.ts` | Fix schema typo: `community.members` → `communities.members` |
| `services/reputation-service/src/routes/reputation.ts` | Add `authenticateToken` per-route to 8 unauthenticated endpoints |
| `services/auth-service/src/index.ts` | Add helmet, update CORS |
| `services/community-service/src/index.ts` | Add helmet, update CORS |
| `services/request-service/src/index.ts` | Add helmet, update CORS |
| `services/reputation-service/src/index.ts` | Add helmet, update CORS |
| `services/notification-service/src/index.ts` | Add helmet, update CORS |
| `services/messaging-service/src/index.ts` | Add helmet, update CORS |
| `services/social-graph-service/src/index.ts` | Add helmet, replace existing custom CORS |
| `services/feed-service/src/index.ts` | Add helmet, update CORS |
| `services/cleanup-service/src/index.ts` | Add helmet, update CORS |
| `services/geocoding-service/index.js` | Add helmet, update CORS (CommonJS) |
| `apps/frontend/src/lib/api.ts` | Refresh token interceptor, store refreshToken on login, concurrent 401 queue |
| `infrastructure/docker/.env.demo` | Add `ALLOWED_ORIGINS=https://karmyq.com` |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Refresh token raw value is never stored** — always hash with `crypto.createHash('sha256').update(token).digest('hex')` before DB insert. Compare hash when validating.

2. **Replay attack protection**: if `used_at IS NOT NULL` on a refresh token lookup, revoke ALL tokens for that user (token theft indicator).

3. **Frontend concurrent 401 queue**: `isRefreshing` flag and `pendingRequests` array MUST be module-level — outside the interceptor function body. If declared inside, they reset on every request and the queue never works.

4. **social-graph-service already has custom CORS** (`services/social-graph-service/src/index.ts`) — replace, don't add a second `app.use(cors(...))`.

5. **geocoding-service is JavaScript** (`index.js`) — use `require('helmet')` and `require('cors')` (CommonJS).

6. **cleanup-service schema fix** — `community.members` → `communities.members` in `src/index.ts` line 106. Fix this in Task 3 before testing admin endpoints.

7. **JWT expiry change 7d → 1h** will invalidate all existing sessions on deploy. Expected behavior for demo env.

8. **`batchHardDelete` whitelist** must use schema-qualified names: `'requests.help_requests'`, `'requests.help_offers'`, `'messaging.messages'`, `'notifications.notifications'`.

9. **Add `authenticateToken` per-route** on reputation endpoints — not at router level. Per-route is explicit and doesn't break internal service calls.

10. **`ALLOWED_ORIGINS` env var** is comma-separated, trim each value. On demo server, set to `https://karmyq.com` in `.env.demo`. In local dev, defaults to `http://localhost:3000`.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create branch: `feature/sprint-54-owasp-hardening`
- Create: `infrastructure/postgres/migrations/20260510-refresh-tokens.sql`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-54-owasp-hardening
```

- [ ] **Write migration**

```sql
-- infrastructure/postgres/migrations/20260510-refresh-tokens.sql
-- Sprint 54: Add refresh token table for JWT rotation (ADR-052)

BEGIN;

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON auth.refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
  ON auth.refresh_tokens(token_hash);

COMMIT;
```

- [ ] **Verify migration syntax**

```bash
cd infrastructure/docker && docker-compose exec postgres psql -U karmyq -d karmyq -f /dev/stdin < ../../postgres/migrations/20260510-refresh-tokens.sql
```

---

## Task 2: SQL injection + schema fixes in cleanup-service

**Files:**
- Modify: `services/cleanup-service/src/jobs/expirationJob.ts`
- Modify: `services/cleanup-service/src/index.ts`

- [ ] **Add table whitelist to `batchHardDelete()`** in `expirationJob.ts`

```typescript
const ALLOWED_CLEANUP_TABLES = new Set([
  'requests.help_requests',
  'requests.help_offers',
  'messaging.messages',
  'notifications.notifications',
]);

export async function batchHardDelete(
  table: string,
  batchSize: number = 1000
): Promise<number> {
  if (!ALLOWED_CLEANUP_TABLES.has(table)) {
    throw new Error(`batchHardDelete: table '${table}' is not in the allowed list`);
  }
  // ... rest of function unchanged
```

- [ ] **Fix schema typo** in `src/index.ts` line 106

```typescript
// Before:
`SELECT EXISTS(
   SELECT 1 FROM community.members
   WHERE user_id = $1 AND role = 'admin' AND status = 'active'
 ) as is_admin`

// After:
`SELECT EXISTS(
   SELECT 1 FROM communities.members
   WHERE user_id = $1 AND role = 'admin' AND status = 'active'
 ) as is_admin`
```

- [ ] **Verify TypeScript compiles**

```bash
cd services/cleanup-service && npx tsc --noEmit
```

---

## Task 3: Reputation service — add auth to all 8 endpoints

**Files:**
- Modify: `services/reputation-service/src/routes/reputation.ts`

- [ ] **Identify all unauthenticated route handlers** — the 8 endpoints found in the audit:
  - `GET /karma/:userId`
  - `GET /trust/:userId`
  - `GET /trust/:userId/:communityId`
  - `GET /community-trust/:communityId`
  - `GET /leaderboard/:communityId`
  - `GET /history/:userId`
  - `GET /badges/:userId`
  - `GET /users/:userId/badges`

- [ ] **Add `authenticateToken` as second argument to each route** (per-route, not router-level)

Check how `authenticateToken` is imported in this service and add it to each route:
```typescript
router.get('/karma/:userId', authenticateToken, async (req, res) => { ... });
```

- [ ] **Verify TypeScript compiles**

```bash
cd services/reputation-service && npx tsc --noEmit
```

---

## Task 4: Helmet + CORS hardening — all 10 services

**Files:**
- Modify: all 10 service `index.ts` / `index.js` files

- [ ] **Install helmet in all TypeScript services** that don't already have it

```bash
cd services/auth-service && npm install helmet @types/helmet
cd services/community-service && npm install helmet @types/helmet
cd services/request-service && npm install helmet @types/helmet
cd services/reputation-service && npm install helmet @types/helmet
cd services/notification-service && npm install helmet @types/helmet
cd services/messaging-service && npm install helmet @types/helmet
cd services/social-graph-service && npm install helmet @types/helmet
cd services/feed-service && npm install helmet @types/helmet
cd services/cleanup-service && npm install helmet @types/helmet
cd services/geocoding-service && npm install helmet
```

- [ ] **Apply helmet + CORS to each service**

For TypeScript services, add after `const app = express()`:
```typescript
import helmet from 'helmet';
import cors from 'cors';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
```

For `geocoding-service/index.js` (CommonJS):
```javascript
const helmet = require('helmet');
// ... (same CORS pattern with require('cors'))
app.use(helmet());
```

- [ ] **social-graph-service**: find the existing `cors({ origin: ... })` call and replace it entirely — do not add a second one.

- [ ] **Verify TypeScript compiles for all modified services**

```bash
for svc in auth-service community-service request-service reputation-service notification-service messaging-service social-graph-service feed-service cleanup-service; do
  echo "=== $svc ===" && cd services/$svc && npx tsc --noEmit && cd ../..
done
```

---

## Task 5: JWT 1hr + refresh token infrastructure (auth-service backend)

**Files:**
- Create: `services/auth-service/src/utils/refreshToken.ts`
- Modify: `services/auth-service/src/routes/auth.ts`

- [ ] **Create `refreshToken.ts` utility**

```typescript
import crypto from 'crypto';
import { query } from '../database/db';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function storeRefreshToken(userId: string, rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await query(
    `INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );
}

export async function validateAndRotateRefreshToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);

  const result = await query(
    `SELECT id, user_id, used_at, revoked, expires_at
     FROM auth.refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!result.rows.length) return null;
  const record = result.rows[0];

  // Replay attack: token already used — revoke all tokens for this user
  if (record.used_at !== null) {
    await query(
      `UPDATE auth.refresh_tokens SET revoked = TRUE WHERE user_id = $1`,
      [record.user_id]
    );
    return null;
  }

  if (record.revoked || new Date(record.expires_at) < new Date()) return null;

  // Mark old token as used+revoked, issue new token
  await query(
    `UPDATE auth.refresh_tokens SET used_at = NOW(), revoked = TRUE WHERE id = $1`,
    [record.id]
  );

  const newRawToken = generateRawToken();
  await storeRefreshToken(record.user_id, newRawToken);
  return newRawToken;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await query(
    `UPDATE auth.refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
    [tokenHash]
  );
}

export async function getUserIdFromRefreshToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const result = await query(
    `SELECT user_id FROM auth.refresh_tokens
     WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0]?.user_id ?? null;
}
```

- [ ] **Modify `auth.ts`**:

  1. Change `expiresIn: '7d'` → `expiresIn: '1h'` in `generateJWT()`

  2. On `POST /auth/register` — after creating user and generating JWT, also generate refresh token:
  ```typescript
  const rawRefreshToken = generateRawToken();
  await storeRefreshToken(userId, rawRefreshToken);
  // Include in response:
  sendSuccess(res, { token, refreshToken: rawRefreshToken, user: { ... } }, ...);
  ```

  3. On `POST /auth/login` — same addition after `generateJWT()`.

  4. Add `POST /auth/refresh` endpoint:
  ```typescript
  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendValidationError(res, 'refreshToken required');

    const userId = await getUserIdFromRefreshToken(refreshToken);
    if (!userId) return sendUnauthorized(res, 'Invalid or expired refresh token', {}, { error: 'INVALID_REFRESH_TOKEN' });

    // Get user for JWT generation
    const userResult = await query('SELECT id, email FROM auth.users WHERE id = $1', [userId]);
    if (!userResult.rows.length) return sendUnauthorized(res, 'User not found');

    const newAccessToken = await generateJWT(userId, userResult.rows[0].email);
    const newRawRefreshToken = await validateAndRotateRefreshToken(refreshToken);
    if (!newRawRefreshToken) return sendUnauthorized(res, 'Refresh token rotation failed');

    return sendSuccess(res, { token: newAccessToken, refreshToken: newRawRefreshToken });
  });
  ```

  5. Update `POST /auth/logout` to accept optional `refreshToken` body param and revoke it.

- [ ] **Sanitize PII from logs** — find all `req.logger?.warn(...)` and `logger.warn(...)` calls in auth.ts that include `{ email }` and replace with `{ hasEmail: !!email }` or remove the email field entirely.

- [ ] **Verify TypeScript compiles**

```bash
cd services/auth-service && npx tsc --noEmit
```

---

## Task 6: Frontend — refresh token interceptor

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Add module-level refresh state** at the top of the file (before the axios instances):

```typescript
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

function drainPendingRequests(newToken: string) {
  pendingRequests.forEach(resolve => resolve(newToken));
  pendingRequests = [];
}
```

- [ ] **Replace the current `errorInterceptor`** with a refresh-aware version:

```typescript
const errorInterceptor = async (error: any) => {
  // Capture X-Request-Id from 5xx responses
  if (error.response?.status >= 500) {
    const refId = error.response.headers?.['x-request-id'];
    if (refId) error.refId = refId;
  }

  // Transform error response shape
  if (error.response?.data && typeof error.response.data === 'object') {
    if ('error' in error.response.data && error.response.data.error) {
      error.response.data.error = error.response.data.error.message || error.response.data.error;
    }
  }

  // Optional endpoints that should never trigger logout or refresh
  const optionalEndpoints = ['/invitations', '/me/settings', '/me/karma'];
  const url = error.config?.url || '';
  const isOptionalEndpoint = optionalEndpoints.some(ep => url.includes(ep));

  if (error.response?.status === 401 && !error.config?._retry && !isOptionalEndpoint) {
    if (typeof window === 'undefined') return Promise.reject(error);

    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise(resolve => {
        pendingRequests.push(token => {
          error.config.headers.Authorization = `Bearer ${token}`;
          error.config._retry = true;
          resolve(axios(error.config));
        });
      });
    }

    error.config._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(`${AUTH_API_URL}/auth/refresh`, {
        refreshToken: storedRefreshToken,
      });
      const { token: newToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      drainPendingRequests(newToken);
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios(error.config);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }

  return Promise.reject(error);
};
```

- [ ] **Update login/register response handling** to store `refreshToken`:

Search for `localStorage.setItem('token',` in the frontend and add alongside it:
```typescript
localStorage.setItem('refreshToken', data.refreshToken);
```

- [ ] **Update logout** to clear `refreshToken`:

```typescript
localStorage.removeItem('refreshToken');
```

- [ ] **TypeScript build check**

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 7: ADR-052 + CONTEXT.md + registry.json

**Files:**
- Create: `docs/adr/ADR-052-security-hardening.md`
- Create: `apps/landing/src/data/docs/concepts/adr-052-security-hardening.json`
- Modify: `apps/landing/src/data/docs/nav.json` (add ADR-052 to Architecture Decisions)
- Modify: `services/auth-service/CONTEXT.md`

- [ ] **Write ADR-052**

```markdown
# ADR-052: Security Hardening — OWASP Top 10 Baseline

**Date**: 2026-05-10
**Status**: Implemented
**Sprint**: 54

## Context
No security audit had been performed on Karmyq prior to Sprint 54. An OWASP Top 10 review identified vulnerabilities in SQL injection prevention, access control, security headers, CORS policy, and JWT token lifetime.

## Decision
Close all identified vulnerabilities in one sprint, using targeted fixes at the exact vulnerability layer.

### Changes Made
- SQL injection: whitelist in `batchHardDelete()` + schema typo fix in cleanup-service
- Broken access control: `authenticateToken` added per-route to all 8 unauthenticated reputation endpoints
- CORS: restricted to `ALLOWED_ORIGINS` env var (default: localhost:3000, production: karmyq.com)
- Security headers: `helmet()` added to all 10 services
- JWT lifetime: 1hr access tokens + 7-day refresh tokens with rotation and replay protection
- PII in logs: email removed from auth failure log entries

## Consequences
- Existing 7-day sessions are invalidated on deploy (users must re-login). Acceptable for demo env.
- All services now require `ALLOWED_ORIGINS` env var for non-localhost CORS (set in `.env.demo`).
- Frontend stores `refreshToken` in localStorage alongside `token`. Not ideal (XSS risk for refresh tokens) but consistent with existing token storage and acceptable for a demo platform.
```

- [ ] **Create ADR JSON for landing page**

```json
{
  "slug": "adr-052-security-hardening",
  "number": "052",
  "title": "ADR-052: Security Hardening — OWASP Top 10 Baseline",
  "status": "implemented",
  "description": "**Status**: Implemented",
  "content": "...(full markdown from ADR-052.md)...",
  "filename": "ADR-052-security-hardening.md"
}
```

- [ ] **Add to nav.json** under "Architecture Decisions"

- [ ] **Update `services/auth-service/CONTEXT.md`**:
  - Add `/auth/refresh` to API Endpoints table
  - Update `/auth/login` and `/auth/register` response shape to include `refreshToken`
  - Add `auth.refresh_tokens` to Database Schema section
  - Update JWT description to "1 hour lifetime with 7-day refresh token rotation"

---

## Task 8: TDD integration tests

**Files:**
- Create: `services/auth-service/tests/tdd/sprint-54-refresh-tokens.test.ts`
- Create: `services/cleanup-service/tests/tdd/sprint-54-security.test.ts`

- [ ] **Refresh token tests** (`auth-service/tests/tdd/`):

```typescript
describe('POST /auth/refresh', () => {
  it('returns new access token + refresh token on valid token');
  it('returns 401 on expired refresh token');
  it('returns 401 on already-used refresh token (replay attack)');
  it('revokes all user tokens when replay detected');
  it('returns 401 on non-existent token');
});

describe('POST /auth/login', () => {
  it('returns refreshToken in response alongside token');
});
```

- [ ] **Cleanup service whitelist tests** (`cleanup-service/tests/tdd/`):

```typescript
describe('batchHardDelete', () => {
  it('throws for table not in whitelist');
  it('does not throw for allowed tables');
});
```

- [ ] **Run TDD tests** (informational — can fail, won't block):

```bash
npm run test:tdd
```

---

## Task 9: `.env.demo` + final type check

**Files:**
- Modify: `infrastructure/docker/.env.demo`

- [ ] **Add `ALLOWED_ORIGINS`** to `.env.demo`:

```bash
ALLOWED_ORIGINS=https://karmyq.com
```

- [ ] **Run full test suite**

```bash
npm test
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Run service analysis** (new env var across services counts as a dependency change):

```bash
npm run analyze:services
```

- [ ] **Type check all modified services**

```bash
cd services/auth-service && npx tsc --noEmit
cd services/reputation-service && npx tsc --noEmit
cd services/cleanup-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

---

## Task 10: Merge + Deploy

- [ ] **Run pre-commit check** using `/pre-commit-check` skill
- [ ] **Merge to master**

```bash
git add -A
git commit -m "feat(security): Sprint 54 OWASP hardening — JWT refresh, CORS, helmet, SQL whitelist, auth fixes"
git checkout master
git merge feature/sprint-54-owasp-hardening
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch for build/test failures
- [ ] **SSH and run migration on demo server**

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
psql -U karmyq -d karmyq -f infrastructure/postgres/migrations/20260510-refresh-tokens.sql
```

- [ ] **Verify health after deploy**

```bash
npm run health:check
```

- [ ] **Update handoff** — mark Sprint 54 complete, set Sprint 55 as upcoming (UI Facelift)
