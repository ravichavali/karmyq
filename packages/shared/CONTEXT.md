# @karmyq/shared — Context

**Last Updated**: 2026-07-29 (Sprint 122 Express 5 peer contract)

Shared TypeScript library consumed by all Karmyq services and frontend apps.

---

## Express 5 peer contract (Sprint 122)

**`peerDependencies.express` is `^5.0.0`** (was `^4.18.0`). This package is consumed by 6 services
and `apps/frontend`, so the peer range is a real contract, not decoration — a single Express
provider exists in the repo (the root **production** dependency, which is how all 9 Express
backends get it), and after Sprint 122 that provider is Express 5.

A dual `^4.18.0 || ^5.0.0` range was considered and **rejected**: nothing in the repo builds, tests
or ships Express 4 any more, so a dual range would advertise support that no run verifies.

`@types/express` is `^5.0.6`. Two consequences for the five middleware files in
`packages/shared/middleware/` (which live **outside `src/`** and import `Request`/`Response`/
`NextFunction` as types only):

- **`RouteParams` (exported from `middleware/auth`)** — Express 5's `path-to-regexp` 8 widened the
  default params type to `string | string[]`, because a repeatable segment (`:ids+`) or a wildcard
  (`*splat`) captures an array. Karmyq declares neither, so `AuthenticatedRequest extends
  Request<RouteParams>` narrows params back to `string`. That is an *enforced* invariant, not an
  assumption: `tests/regression/sprint-122-express5-route-params.test.ts` fails if any route literal
  introduces such syntax. Handlers that genuinely need an array param must widen their own generic
  rather than loosen `RouteParams`.
- Async handler rejections now auto-forward to the error middleware, so the ADR-074 envelope must
  keep coming from a real error handler; `res.status()` throws `RangeError` on an out-of-range code.

**⚠️ `normalizeRequestBody` (`middleware/bodyDefaults`) — mount it after `express.json()`.**
body-parser 1 initialised `req.body` to `{}` on every request; body-parser 2 leaves it
**`undefined`** unless a body was actually parsed. **76 handlers across 7 services** do
`const { x } = req.body`, which then throws a `TypeError` on a bodyless request and surfaces as a
**500**. Sprint 122 shipped exactly that bug to CI — `POST /communities/:id/join` legitimately
sends no body, and the integration suite caught it after every unit and regression tier was green.

This middleware restores the old default in one place rather than editing 76 call sites and
missing one. It is deliberately narrow: it fills in only a **missing** body, so a parsed array or
an explicitly-sent `null` survives untouched. Mounted in all 8 shared-consuming services;
`geocoding-service` carries an inline equivalent because it is plain JS and does not consume this
package. Pinned by `tests/regression/sprint-122-express5-empty-body.test.ts`, which also asserts
the raw Express 5 behaviour so the shim cannot be quietly removed.

**Known, deliberate, out of scope** (both pre-date this sprint and neither blocks Express 5):

| Package | `packages/shared` | root | Note |
|---|---|---|---|
| `express-rate-limit` | `^7.1.5` (peer `4 \|\| 5 \|\| ^5.0.0-beta.1`) | `^8.2.2` (peer `>= 4.11`) | split across majors; **both accept Express 5** |
| `zod` | `^3.22.4` | `^4.1.12` | same class of split, same answer |

*(Also pre-existing: `apps/frontend` consumes this package without providing Express at all, so the
peer is unsatisfied there and `.npmrc`'s `legacy-peer-deps=true` silences it.)*

---

## Canonical urgency scale (Sprint 85 / ADR-066)

`./matching` scorers use one canonical urgency scale — `urgent | high | medium | low` — with `urgent`
as the top tier (it replaces the retired `critical`):

- `scoreUrgency(urgency)` → `urgent: 100, high: 80, medium: 60, low: 30` (default 30). `urgent` scores
  **strictly above** `high` so it wins the curated home-feed composite signal (the feed ranks on this
  composite, not a SQL CASE).
- `applyUrgencyBonus(urgency, base)` → `urgent: +20, high: +15, medium: +5, low: 0`.

Producers must emit only the canonical four; `critical`/`normal` are retired. See
[ADR-066](../../docs/adr/ADR-066-unified-feed-model.md).

---

## Exports

| Subpath | Contents |
|---------|----------|
| `.` | Root re-exports |
| `./utils/logger` | `createLogger`, `requestLoggingMiddleware`, `LogContext`, `LogEntry`, `LogLevel` |
| `./utils/response` | `sendSuccess`, `sendError`, `sendValidationError`, `sendNotFound`, `sendInternalError`, `HTTP_STATUS`, `validateRequest`, `requestIdMiddleware` |
| `./middleware` | All middleware barrel, including `normalizeRequestBody` (restores the Express 4 `req.body = {}` default). **There is no `./middleware/bodyDefaults` subpath export** — every consumer imports it from this barrel. |
| `./middleware/auth` | `authMiddleware`, `AuthenticatedRequest`, `RouteParams` |
| `./middleware/dbContext` | `dbContextMiddleware` |
| `./middleware/rateLimit` | `globalRateLimiter`, `rateLimiters` |
| `./middleware/tenant` | `tenantMiddleware`, `optionalTenantMiddleware` |
| `./middleware/validate` | Validation middleware |
| `./types` | Shared TypeScript types |
| `./constants/config` | Platform-wide constants |
| `./matching` | `calculateMatchScore`, `calculateFeedScore`, scoring utilities, `DEFAULT_FEED_WEIGHTS` |
| `./matching/types` | `UserProfile`, `FeedScoringWeights`, `VisibilityScope` |
| `./schemas/requests` | Zod schemas for request types (generic, ride, service, event, borrow) |
| `./schemas/ui` | UI schema types for DynamicForm |
| `./schemas/providers` | TypeScript interfaces for provider profiles, reviews, trust scores (ADR-041/042) |
| `./schemas/reputation-disclosure` | Reputation disclosure boundary schema (ADR-082) |
| `./trust/decayTier` | Trust decay tier calculation |
| `./projections/completed-exchange` | Completed-exchange projection |
| `./events/publisher` | `createPublisher(source)` — Bull queue factory; returns `{ initEventPublisher, publishEvent, getEventQueue }` |

> **Sprint 122 PR 4 (ADR-089):** `./api/client`, `./api/mobile-storage` and `./api/web-storage`
> were **removed**. Their sources have been excluded from the build since `11ebb6a4` (2026-01-23),
> so all three had been unresolvable for ~7 months, with zero importers. The table above is now
> held identical to `package.json`'s `exports` — and to its `typesVersions` mirror — by
> `packages/shared/src/__tests__/exportsTypesVersionsParity.test.ts`.

> **Sprint 93 (ADR-064):** `ApiClient.removeCommunityMember(communityId, userId)` dropped its
> `adminUserId` argument — the community-service DELETE handler now derives the caller from the
> verified JWT and ignores any request body, so clients must not send `admin_user_id`.

> **Sprint 94 (ADR-074):** shared error helpers and shared middleware now emit the canonical error
> envelope `{ success:false, message:string, error:string, details?, meta? }`. The old
> `{ error:{ code, message } }` helper shape is retired; web clients remain dual-read tolerant for
> one release, and direct route literals are catalogued drift rather than fully swept.

---

## Logger: error_type + X-Request-Id (added 2026-04-06, ADR-049)

`requestLoggingMiddleware` now:
- Sets `X-Request-Id` response header (echoes `requestId`) **before** calling `next()`, so clients can always read it.
- Computes `error_type` on `res.on('finish')`: `'system_error'` for 5xx, `'user_error'` for 4xx, `undefined` for 2xx/3xx.

`LogContext` and `LogEntry` both include `error_type?: 'user_error' | 'system_error'`.

Query in Grafana/Loki:
```logql
{level="error"} | json | error_type="system_error"
{level="warn"}  | json | error_type="user_error"
```

---

## Schema: providers (added 2026-02-27, ADR-041/042)

Types exported from `./schemas/providers`:
- `ProviderProfile` — base provider record with optional joined fields (avg_stars, trust_score, ride_details)
- `ProviderRideDetails` — ride-specific extension (vehicle_type, max_passengers, typical_routes)
- `ProviderReview` — star rating + text review tied to a match
- `ProviderTrustScore` — computed trust cache (avg_stars, completion_rate, response_rate, trust_score)
- `CreateProviderProfileInput` — input type for POST /providers
- `CreateProviderReviewInput` — input type for POST /reputation/provider-reviews
- `PROVIDER_SERVICE_TYPES` — const array `['ride', 'tradesperson', 'tutor', 'other']`
- `ProviderServiceType` — union type derived from above

## Schema: reputation disclosure (added 2026-06-24, ADR-082)

Strict outward DTO contracts from `./schemas/reputation-disclosure` (also re-exported from the root)
that make an ordinary member's exact reputation self-only at the API boundary. Services compute with
rich internal rows and explicitly project to these `.strict()` schemas before `res.json`.

- `DisclosureClass` / `DisclosureClassSchema` — `self | ordinary_member | provider | community_aggregate | internal`
- `RelationshipState` / `RelationshipStateSchema` — qualitative bond `strong | warm | fading | nearly_forgotten` (derived from the ADR-070 decay tier; `swept` is never returned outward)
- `SelfCommunityReputationSchema` — the canonical community-scoped self summary (scope, reputation, karma, activity); consumed by `GET /reputation/me/community-summary`
- `SafeBelongingNodeSchema` / `SafeBelongingLinkSchema` / `SafePersonGraphSchema` — identity-only graph nodes + relationship-state links (no `trust_score`/`karma`/`*_weight`)
- `SafeTrustPathSchema` — structural path + coarse relationship band (no outward numeric trust score)
- `GovernanceEligibleMemberSchema` / `GovernanceRoleHolderSchema` / `GovernanceStateSchema` — coarse eligibility + roles, never member numbers
- `PublicMemberIdentitySchema` — `{ user_id, name }` only
- `ProviderReputationSchema` — explicit public provider-rating exception (carries numeric ratings)
- `CommunityAggregateSchema` — explicit aggregate exception (≥5-member cohort enforced in services, not the schema)
- `FORBIDDEN_ORDINARY_MEMBER_KEYS`, `assertNoForbiddenReputationKeys`, `findForbiddenReputationKeys` — recursive defence-in-depth scanner for ordinary-member/self fixtures (NOT applied to provider/aggregate exceptions)

## Schema: reciprocal relationship context (added 2026-06-29, Sprint 116)

Root exports from `@karmyq/shared` define the strict request/offer relationship-context boundary:

- `RelationshipContextSchema` / `relationshipContextSchema` and `RelationshipContext` — reciprocal
  viewer/counterpart identity, platform-wide path, bounded one-hop networks, qualitative links, and
  plain-language summary.
- `ContextNode`, `ContextLink`, `ContextCounterpart`, and related strict schemas — reject unknown keys
  at every outward nesting level.
- `BondDepthSchema` / `BondDepth` / `classifyBondDepth()` — intentionally ordinal shared-history bands:
  `forming` (defensive default/one interaction), `growing` (2–3), and `established` (4+). The band
  reveals an accepted floor, never an exact count, timestamp, exchange content, weight, karma, or
  reputation value.
- The ADR-082 forbidden-key scanner now also rejects `match_completed_count`,
  `total_interaction_count`, and `interaction_count` in disclosure-protected payloads.
