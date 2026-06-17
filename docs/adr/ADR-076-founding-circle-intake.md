# ADR-076: Founding-Circle Backend Intake

**Status**: Accepted

## Context

Sprint 95 relaunched `karmyq.org` as five static public routes (see
[ADR-075](ADR-075-karmyq-org-multi-route-relaunch.md)) and shaped the `/join` form around four
fields — email, lens, contribution, concern — explicitly for a backend follow-up. But the submit
path was still a client-side `mailto:`: it depended on the visitor having a working mail client,
and a founding-circle note never reached us as data. The strongest signal a stranger can send —
"I want to help build this" — was landing in the visitor's outbox, not in a list we own.

Three constraints shaped this decision:

1. **The landing app is a Next.js static export** (`output: 'export'`). It cannot host Next API
   routes, so the submit must be a browser `fetch` to an external API base URL — it cannot be a
   server action or an internal route.
2. **The landing page (`karmyq.org`) and the API (`karmyq.com`) are different origins.** Any
   browser POST from the static site to the API is cross-origin and must be explicitly allowed.
3. **There is no outbound email/SMTP/Slack transport anywhere in the platform today.** An honest
   "notify the team on each submission" path would require standing up email/messaging transport
   with its own secrets and deliverability risk — out of scope for this sprint.

## Decision

Add a single public, unauthenticated endpoint —
`POST /founding-circle/submissions` — hosted in **auth-service** (the platform's existing public
"front door", which already terminates CORS and the app-wide rate limiter). It validates and
persists submissions to a new `auth.founding_circle_submissions` table. The static landing page
POSTs the four fields plus a honeypot cross-origin to this endpoint.

Key choices:

- **Host in auth-service, not a new service.** `/auth/login` and `/auth/register` are already public;
  the intake follows the same unauthenticated public pattern with no new service, port, or deploy
  surface.
- **Persist first; review in-app; no notify.** Because no email/Slack transport exists, the original
  sprint stopped at durable capture. Sprint 103 adds authenticated reviewer endpoints and a small
  admin page so review no longer requires direct `psql` access. Notify is still deferred to a later
  sprint that builds delivery properly (see *Future*).
- **Anti-spam is a honeypot + app-level validation, not a dedicated rate-limit layer.** A
  visually-hidden `website` field (off-screen, `tabIndex={-1}`, `aria-hidden`) that real users never
  see; a non-empty value is treated as bot traffic and the server responds with success **without
  persisting** (a silent drop, so bots get no signal they were filtered). The app-wide
  `globalRateLimiter` already applies; the route adds no `rateLimiters.standard`.
- **Cross-origin wiring is a deploy-config concern.** auth-service CORS is driven by
  `ALLOWED_ORIGINS`; `https://karmyq.org` and `https://www.karmyq.org` are added there. nginx routes
  `^/api/founding-circle(/.*)?$` to auth-service. The landing client's API base is
  `NEXT_PUBLIC_API_URL`, baked in at build time (`deploy.sh` sources `.env.demo` before `next
  build`), with a **production-safe fallback of `https://karmyq.com/api`** — never localhost or a
  relative path, which in the deployed static bundle would resolve to the origin-less `karmyq.org`.
- **Canonical error contract** ([ADR-074](ADR-074-canonical-error-response-contract.md)): all
  responses use the shared `sendSuccess` / `sendValidationError` / `sendInternalError` helpers.

### Data model

```sql
CREATE TABLE IF NOT EXISTS auth.founding_circle_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(320) NOT NULL,
  lens          VARCHAR(200),
  contribution  TEXT,
  concern       TEXT,
  source_page   VARCHAR(64)  NOT NULL DEFAULT 'join',
  status        VARCHAR(24)  NOT NULL DEFAULT 'new',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   TIMESTAMP
);
```

No FK to `auth.users` — submitters are pre-account leads by definition. `status` is the reviewer
state (`new`, `reviewed`, `contacted`, `archived`). Sprint 103 reuses the existing column; no schema
change was needed.

### Review endpoints

Sprint 103 adds authenticated reviewer tooling:

- `GET /founding-circle/submissions` lists submissions newest-first, with optional `status`, `limit`,
  and `offset`.
- `PATCH /founding-circle/submissions/:id/status` moves a submission among `new`, `reviewed`,
  `contacted`, and `archived`.

For this sprint, a founding-circle reviewer is any authenticated user who is an active admin in at
least one community. That mirrors the existing admin UI gate and deliberately avoids introducing a
new platform-admin role.

## Consequences

**Positive**

- Founding-circle interest now lands in a durable, queryable table we own, with success/error UI so
  the visitor knows their note actually arrived.
- No new service, port, or auth surface; reuses auth-service's existing public front door.
- The honeypot screens the bulk of automated spam with zero friction for real users.

**Negative / trade-offs**

- **No outbound notification.** Submissions are reviewable in-app, but there is still no email,
  Slack, webhook, queue event, or push transport for new notes. A reviewer must open the queue.
- **Public unauthenticated write.** Mitigated by strict input validation, parameterized SQL, the
  honeypot, and the app-wide rate limiter; there is no dedup, so a determined actor could submit
  repeatedly within the rate limit.
- **Cross-origin depends on deploy config.** `ALLOWED_ORIGINS` **must** include the landing origins
  (`https://karmyq.org`, `www`) at deploy, or the browser blocks the cross-origin POST at the CORS
  preflight. An absolute `NEXT_PUBLIC_API_URL` (e.g. `https://karmyq.com/api`) is optional but
  preferred: the client treats a missing or relative value (the demo shares `/api` with the
  same-origin frontend) as unset and hard-falls-back to `https://karmyq.com/api`, so a misconfigured
  base does not silently fail — but CORS is the one hard requirement.

## Future

When email/Slack transport is built, a later sprint can emit a `founding_circle_submitted` event on
insert and deliver it. A future architecture decision can also replace the "any active community
admin" reviewer rule with a true platform-admin role if that separation becomes necessary.
