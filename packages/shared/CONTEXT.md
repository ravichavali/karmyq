# @karmyq/shared — Context

**Last Updated**: 2026-04-06

Shared TypeScript library consumed by all Karmyq services and frontend apps.

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
