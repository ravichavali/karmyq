# Sprint 96: Founding-Circle Backend Intake — Design Spec

**Date**: 2026-06-12
**Status**: Approved
**Version**: v11.4.0 → v11.5.0
**Sprint Branch**: `feature/sprint-96-founding-circle-intake`

---

## Overview

Sprint 95 relaunched `karmyq.org` as five static routes and shaped the `/join` form fields
(email, lens, contribution, concern) for exactly this follow-up — but the submit path is still a
client-side `mailto:` that depends on the visitor having a working mail client and never reaches
us as data. People who want to join the founding circle should land in a durable, queryable list,
not a draft email that may never be sent.

Sprint 96 replaces the mailto with a real backend write. The static landing page POSTs the same
four fields (plus a honeypot) to a new public, unauthenticated endpoint —
`POST /founding-circle/submissions` — hosted in **auth-service** (the platform's existing public
"front door"). The submission is validated, screened by a honeypot, and persisted to a new
`auth.founding_circle_submissions` table. The visible `contact@karmyq.org` fallback stays, and the
form gains success/error states so a visitor knows their note actually landed.

This sprint is deliberately **persist-only**: the platform has **no outbound email/SMTP
infrastructure today**, so there is no honest "email the team on each submission" path without
standing up email transport (a separate concern with its own secrets and deliverability risk).
Submissions are reviewed via `psql` for now; a notify channel is deferred to a future sprint that
builds email/Slack delivery properly.

### Core Principle: Capture the intent where it actually lands

A founding-circle note is the strongest signal a stranger can send us. It belongs in a table we
own — not in the visitor's outbox. Make the capture real and trustworthy first; make it loud
(notifications) only once we can do that honestly.

---

## Multi-Sprint Arc

### Sprint 95 — karmyq.org Multi-Route Relaunch (complete, v11.4.0)
Five static routes; `/join` form-shaped with encoded mailto + visible `contact@karmyq.org`
fallback. Fields (email, lens, contribution, concern) intentionally pre-shaped for backend wiring.

### Sprint 96 — Founding-Circle Backend Intake (this sprint, v11.5.0)
Public `POST /founding-circle/submissions` in auth-service; new table + migration; honeypot +
validation; cross-origin landing → API (CORS + nginx); success/error UI; mailto fallback retained.
**Persist-only — no notify.**

### Sprint 97+ — Notify + Review (upcoming, deferred)
When email/Slack transport exists: notify on submission (`founding_circle_submitted` event →
delivery), and optionally an authenticated admin review surface (list + status transitions).

---

## New Concepts

- **Founding-circle submission** — an unauthenticated, pre-account expression of interest captured
  from the public `karmyq.org/join` form. It is *not* a user account, an invite, or a community
  membership; it is a lead in a review queue we own.
- **Honeypot field** — a hidden form input (`website`) that legitimate users never see or fill.
  A non-empty value marks the request as bot traffic; the server responds with success but does
  **not** persist (silent drop, so bots get no signal that they were filtered).

---

## Data Model

New table, owned by auth-service, in the existing `auth` schema:

```sql
CREATE TABLE IF NOT EXISTS auth.founding_circle_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(320) NOT NULL,          -- RFC 5321 max length
  lens          VARCHAR(200),
  contribution  TEXT,                            -- app-level cap 4000 chars
  concern       TEXT,                            -- app-level cap 4000 chars
  source_page   VARCHAR(64)  NOT NULL DEFAULT 'join',
  status        VARCHAR(24)  NOT NULL DEFAULT 'new',  -- new | reviewed | contacted | archived
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_founding_circle_status_created
  ON auth.founding_circle_submissions (status, created_at DESC);
```

- No FK to `auth.users` — submitters are pre-account by definition.
- `status` is a free review-state column for future admin tooling; only `new` is written this sprint.
- Migration file: `infrastructure/postgres/migrations/20260612-founding-circle-submissions.sql`
  **and** mirror the `CREATE TABLE` into `infrastructure/postgres/init.sql` (auth schema block)
  so fresh DBs get it.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/founding-circle/submissions` | none (public) | Persist a founding-circle note from the public landing form. |

**Request body:**
```json
{
  "email": "you@example.com",
  "lens": "community organizer",
  "contribution": "…",
  "concern": "…",
  "website": ""            // honeypot — must be empty
}
```

**Validation (app-level, returns ADR-074 canonical errors):**
- `email` — required, must match a simple email shape, ≤ 320 chars.
- `lens` — optional, ≤ 200 chars.
- `contribution`, `concern` — optional, ≤ 4000 chars each.
- `website` (honeypot) — if present and non-empty → respond `200 { success: true }` **without
  persisting** (silent drop).
- Oversized/empty-required → `sendValidationError` (`{ success:false, message, error:"VALIDATION_ERROR" }`).

**Success response** (`201`, via `sendSuccess(res, { id }, 201, …)` — note the shared helper emits
**no top-level `message`**; it returns `data` + `meta`):
```json
{ "success": true, "data": { "id": "<uuid>" }, "meta": { "timestamp": "…", "requestId": "…" } }
```

**Mounting:** `app.use('/founding-circle', foundingCircleRoutes)` in
`services/auth-service/src/index.ts`. Rely on the existing app-wide `globalRateLimiter` only — do
**not** add `rateLimiters.standard` (per-sprint decision: honeypot + global limiter, no dedicated
rate-limit layer).

---

## Frontend Changes (apps/landing — static export)

- **New** `apps/landing/src/lib/submitFoundingCircle.ts` — minimal `fetch`-based client that POSTs
  to `${NEXT_PUBLIC_API_URL}/founding-circle/submissions`, returns a typed `{ ok, error? }`.
- **Modify** `apps/landing/src/components/landing/JoinForm.tsx`:
  - Primary "Write the note" button now `POST`s the four fields + honeypot instead of opening a mailto.
  - Add a visually-hidden honeypot input (`website`, `aria-hidden`, `tabIndex={-1}`,
    `autoComplete="off"`).
  - Add `idle | submitting | success | error` states; disable the button while submitting; show a
    success confirmation and an inline error on failure.
  - Keep the visible `contact@karmyq.org` fallback line always present (it is now the
    error-path fallback, not the primary channel).
- **Env**: introduce `NEXT_PUBLIC_API_URL` for the landing app (`https://karmyq.com/api` in
  `.env.demo`), with a **production-safe fallback of `https://karmyq.com/api`** in the client (never
  `localhost`/relative in production — the bundle is served from `karmyq.org`). `deploy.sh` sources
  `.env.demo` before building, so the value is baked in at build time. Document in
  `apps/landing/.env.example` if one exists, else note in landing README.

`apps/landing/next.config.js` stays `output: 'export'` — the submit is a browser `fetch`, which is
fully compatible with static export (no Next API route needed).

---

## Infrastructure

- **nginx** (`infrastructure/nginx/nginx.conf`): add a routing block
  ```
  location ~ ^/api/founding-circle(/.*)?$ {
      proxy_pass http://auth_service/founding-circle$1$is_args$args;
      # + the same proxy_set_header lines as the other /api/* blocks
  }
  ```
- **CORS**: auth-service CORS is driven by `ALLOWED_ORIGINS`. Add `https://karmyq.org` (and
  `https://www.karmyq.org`) to `ALLOWED_ORIGINS` in `.env.demo`. The `cors()` middleware already
  handles the `OPTIONS` preflight. Without this, the cross-origin POST is blocked in the browser.
- **Landing API base**: set `NEXT_PUBLIC_API_URL=https://karmyq.com/api` in `.env.demo` too — it is
  consumed at **build time** (`deploy.sh` sources `.env.demo` before `npm run build`), not runtime.
  These are two separate `.env.demo` changes; both are required for `/join` to work end-to-end.

---

## User Guide & Doc Updates (MANDATORY)

- **Landing concept/guide** (`apps/landing/src/data/docs/`): update the "Join the circle" guide (or
  add a short concept page) to describe that submissions are now captured directly and a person
  will follow up — replacing any language implying email is the only path. Add nav.json entry if a
  new page is created. (Generated docs are gitignored — `git add -f`.)
- **ADR-076** (architectural): document the decision to host the first public unauthenticated
  intake endpoint in auth-service, the cross-origin static-landing → API pattern, the honeypot
  approach, and the explicit "persist-only / no email transport yet" decision. **Write only the
  source `docs/adr/ADR-076-*.md`** — the landing concept JSON
  (`apps/landing/src/data/docs/concepts/adr-076-*.json`) is **generated** by `generateConcepts()`
  in `scripts/generate-docs.ts`, and the curated nav is rebuilt from `ADR_GROUPS` in that same
  script into `apps/landing/src/data/docs/nav.json` (top-level, **not** `concepts/nav.json`). Add
  the slug to `ADR_GROUPS`, regenerate, then `git add -f` the generated JSON + nav.json. Do not
  hand-edit generated files — the landing `prebuild` overwrites them.
- **CONTEXT.md**: update `services/auth-service/CONTEXT.md` — new endpoint + new table.
- **registry.json**: add the new endpoint to auth-service `apis.provides`.

---

## Critical Implementation Notes

1. **No email infrastructure exists** anywhere in the platform (no nodemailer/SMTP/SES) — this
   sprint is **persist-only by decision**. Do not add an email send; defer notify to a later sprint.
2. **Cross-origin is the whole game.** Landing is served from `karmyq.org`; the API is on
   `karmyq.com`. The POST will fail in-browser unless `ALLOWED_ORIGINS` in `.env.demo` includes
   `https://karmyq.org` (and `www`). This is a deploy-config step, not just code.
3. **Static export** (`output: 'export'`) means **no Next API routes** — the submit must be a
   client `fetch` to the external API base URL (`NEXT_PUBLIC_API_URL`).
4. **Honeypot = silent success.** When the `website` field is non-empty, return `200/201 success`
   without persisting. Never reveal that the request was filtered.
5. **Canonical error contract (ADR-074):** all error responses are
   `{ success:false, message:string, error:"CODE" }` — use the shared `sendValidationError` /
   `sendError` helpers, never a literal object in `error`.
6. **JWT field is `communities`** (not `communityMemberships`) — irrelevant here because the
   endpoint is unauthenticated, but do **not** add auth middleware to it.
7. **Mount without `rateLimiters.standard`** — the app-wide `globalRateLimiter` already applies;
   the per-sprint anti-spam decision is honeypot + global limiter only.
8. **Mirror schema in both places:** the migration file *and* `init.sql` (auth schema block), so
   fresh databases and the demo both get the table. Migrations are plain SQL run via
   `run-migration.sh`; guard with `IF NOT EXISTS`.
9. **ADR docs are generated, not hand-authored.** Write `docs/adr/ADR-076-*.md`, add the slug to
   `ADR_GROUPS` in `scripts/generate-docs.ts`, regenerate, then `git add -f` the generated
   `concepts/adr-076-*.json` + `apps/landing/src/data/docs/nav.json` (top-level path, **not**
   `concepts/nav.json`). The landing `prebuild` overwrites any hand-edited generated JSON.
10. **Keep the visible `contact@karmyq.org` fallback** in the form at all times — it is the
    error-path escape hatch now that the primary path is a network call.
11. **auth-service tests are service-local** (`services/auth-service/tests/{unit,tdd}`), not the
    root `tests/` tree — place new tests there.
12. **No real integration test-DB harness in auth-service.** `tests/integration/*` are
    `expect(true)` placeholders and `src/index.ts` calls `start()` unconditionally (cannot be
    imported). Test the route with the existing **isolated-`express()`-app + `jest.mock`ed DB +
    supertest** pattern (`tests/regression/auth.routes.test.ts`). Real persistence is verified by
    the migration + post-deploy DB check, not an in-repo DB test.
13. **Use exact shared response-helper signatures** (`packages/shared/utils/response.ts`):
    `sendSuccess(res, data, statusCode, opts)` — **no top-level `message`**;
    `sendValidationError(res, message, details?, opts)`;
    `sendInternalError(res, message, err?, opts)` (emits `error:'INTERNAL_ERROR'`);
    `sendError(res, code, message, statusCode, details?, opts)` — **code first, then message**.
14. **Version bump touches `package-lock.json` too** — bump the root `version` field in the lock
    in place (do not scratch-regen on Windows; see lockfile gotcha in memory).
