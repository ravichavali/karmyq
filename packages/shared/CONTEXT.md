# @karmyq/shared — Context

**Last Updated**: 2026-06-29 (Sprint 116 reciprocal relationship-context contract)

Shared TypeScript library consumed by all Karmyq services and frontend apps.

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
| `./middleware` | All middleware barrel |
| `./middleware/auth` | `authMiddleware`, `AuthenticatedRequest` |
| `./middleware/dbContext` | `dbContextMiddleware` |
| `./middleware/rateLimit` | `globalRateLimiter`, `rateLimiters` |
| `./middleware/tenant` | `tenantMiddleware`, `optionalTenantMiddleware` |
| `./middleware/validate` | Validation middleware |
| `./types` | Shared TypeScript types |
| `./constants/config` | Platform-wide constants |
| `./api/client` | API client utilities |
| `./api/mobile-storage` | Mobile storage helpers |
| `./api/web-storage` | Web storage helpers |
| `./matching` | `calculateMatchScore`, `calculateFeedScore`, scoring utilities, `DEFAULT_FEED_WEIGHTS` |
| `./matching/types` | `UserProfile`, `FeedScoringWeights`, `VisibilityScope` |
| `./schemas/requests` | Zod schemas for request types (generic, ride, service, event, borrow) |
| `./schemas/ui` | UI schema types for DynamicForm |
| `./schemas/providers` | TypeScript interfaces for provider profiles, reviews, trust scores (ADR-041/042) |
| `./events/publisher` | `createPublisher(source)` — Bull queue factory; returns `{ initEventPublisher, publishEvent, getEventQueue }` |

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
