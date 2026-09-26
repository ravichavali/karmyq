# @karmyq/shared — Context

**Last Updated**: 2026-09-24 (Sprint 131 D6 zod 4)

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

## Declared imports (Sprint 131 PR B2, 2026-09-17)

`bull` (`events/publisher.ts`) and `jsonwebtoken` (`middleware/auth.ts`) are now `dependencies` at root's ranges.
**`pg` is a `peerDependency` (`^8.23.0`)**: `middleware/dbContext.ts` uses `Pool` only as a parameter type, and the
consuming service constructs the pool. This is the same single-provider contract as Express above. As with Express,
`apps/frontend` doesn't provide it, and `.npmrc` `legacy-peer-deps=true` silences that. The peer covers the runtime
package only: the `Pool` type resolves from `@types/pg` (this package's `devDependencies`).

This package's build excludes three `api/` files (`tsconfig.json` `exclude`, ADR-028). Two of them, `api/client.ts`
(axios) and `api/mobile-storage.ts` (`@react-native-async-storage/async-storage`), still import undeclared packages, so
they are the only allowlist entries in `tests/regression/sprint-131-workspace-declarations.test.ts`. That gate fails if they
stop being violations, so delete an entry when its file is fixed or removed.

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

*(Pre-existing: `apps/frontend` consumes this package without providing Express at all, so the
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

## Canonical completed-match standing policy (added 2026-08-20, ADR-096)

`src/projections/completedMatchStanding.ts` — exported from the **root barrel** (no new subpath).
This is the single definition of what a completed match does to personal standing. Live event
delivery (`reputation-service` `standingProjector.ts`), the curated fixture projector
(`completedExchange.ts`), and historical operator replay (`backfill:standing`) all consume it.
Sprint 126 deleted `reputation-service/src/services/karmaAllocation.ts` when its last importers
moved here.

| Export | Contract |
|---|---|
| `COMPLETED_MATCH_REASONS` | `Provided help`, `Received help`, `First help in community`, `10/50/100 exchanges milestone` |
| `COMPLETED_MATCH_MILESTONES` | helper-side bonuses at counts 1 / 10 / 50 / 100 → 15 / 25 / 50 / 100 points |
| `MAX_COMMUNITIES_PER_KARMA_AWARD` | `3` |
| `DEFAULT_KARMA_POOL` | `100` |
| `compareReplayKeys(a, b)` | total order over `(completedAt, matchId)`; code-unit tie-break |
| `selectStandingCommunities(candidates, limit?)` | prior-karma DESC, community-id tie-break, capped |
| `allocateCompletedMatchKarma(configs, totalPool, requestType?)` | largest-remainder allocation (ADR-032) |
| `planCompletedMatchStanding(facts, totalPool?)` | every karma row one match produces |

**Invariants this module exists to hold:**

- **Pure.** No clock, no database. The same facts always produce the same plan — that is what makes
  historical replay safe.
- **The reason strings are a data contract, not labels.** `updateTrustScore` compares against them
  in SQL, so karma written under any other label is stored and then invisible to standing. The
  fixture's old `help_provided` / `help_received` are exactly that failure.
- **Every predicate is as-of.** Community selection and milestone rank are functions of stored
  history as of the match plus the match itself, never of current table state. Callers supply the
  two aggregates; deriving them strictly-before is what makes a replay stable, because the match's
  own rows are never counted. The boundary is **not** exported as a shared predicate — both
  consumers use running accumulators advanced after each match, which has no predicate call site.
  What binds SQL and TypeScript together is a runtime check, not a type: `applyStandingBackfill`
  re-derives every projected row in memory, compares it to what SQL wrote, and fails the run on any
  mismatch.
- **The pool is fixed per match.** Being in three communities never awards more total karma than
  being in one.

⚠️ `DEFAULT_KARMA_POOL` is a flat constant. `communities.community_configs.base_karma_pool_per_request`
is admin-editable and read by callers, but has always been ignored in favour of this value.
Pre-existing; documented on the constant; not changed by Sprint 126.

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
- `PROVIDER_SERVICE_TYPES` — const array `['ride', 'tradesperson', 'tutor', 'other']`. Since Sprint
  125 this is also the arbiter for a community's `provider_services_list` allowlist, validated in
  community-service's `config-validator.ts` — a value outside this list would match no provider and
  silently empty a community's provider layer.
- `ProviderServiceType` — union type derived from above
- `PROVIDER_SERVICE_TYPE_LABELS` (Sprint 125) — display labels keyed by service type. Added because
  the frontend had ~10 verbatim copies of this map that had already drifted (`'Trades'` vs
  `'Home Repair'`). New code imports it; the existing copies are a separate cleanup. ⚠️ Look values
  up with `Object.hasOwn` — `service_type` is bare `TEXT` in the DB, so a stored `'constructor'`
  resolves up the prototype chain.

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

## Sprint 131 D6 — zod 4 (2026-09-24)

`zod` **→ 4.6.5** (#264) in this package and root. zod 3 is gone from the runtime graph. Only
`@expo/cli` still nests its own 3.25.76, and nothing in our source imports it. The zod
`DIVERGENCE_ALLOWLIST` entry in `tests/regression/sprint-131-workspace-declarations.test.ts` is retired, so the map is empty.

A two-version differential over the real request schemas (102 cases) found 20 verdict changes,
57 message/code-only changes and no issue-path changes. Each change is either preserved or accepted on purpose:

| # | Change | Decision |
|---|---|---|
| P1 | zod 4 `z.string().uuid()` is RFC 9562-strict | **Preserved.** All 15 former `.uuid()` sites are `z.guid()`, zod 4's name for zod 3's 8-4-4-4-12 hex check. Seeded ids such as `11111111-…` stay valid |
| P2 | Custom messages | **Preserved** |
| P3 | `error.format()` tree and issue paths | **Preserved** |
| I1 | String `.min/.max/.length` count code points, not UTF-16 units | Intentional. Stricter on `.min` for emoji. More permissive on `.max` (I1′) |
| I2 | `.datetime()` requires seconds | Intentional. Every in-repo producer uses `toISOString()` |
| I3 | `z.number()` rejects ±`Infinity` | Intentional. zod 3 accepted it, and JSON then stored `null` |
| I4 | Default messages and codes (`Required` → `Invalid input: expected string, received undefined`; `invalid_enum_value` → `invalid_value`; `invalid_string` → `invalid_format`) | Intentional. Nothing matches on this text |
| I5 | `.int()` requires a safe integer | Intentional. Only `roles[].count` lacked a small `.max()` |
| I6 | **Type-level.** In a `strict: false` workspace, zod 3's `z.infer` made **every** key optional: its `requiredKeys` test is `undefined extends T[k]`, which is always true without `strictNullChecks`. zod 4 keeps required and defaulted keys required | Intentional: the inferred types are now accurate. This affects the 7 non-strict services and `apps/frontend`. It surfaced in exactly one test fixture (`request-service` `curated-feed.test.ts`, missing the defaulted `location_type`) |

⚠️ **A local green after a zod (or any type-only) bump can be false.** The ts-jest cache
(`%TEMP%/jest`) keys on the test file, not on dependency types, so a test compiled before the bump
is reused unchecked, even under `turbo --force`. Only PR CI caught I6. Before claiming a type-level
bump green, run `npx jest --clearCache` or `--no-cache`.

**New shared code must use `z.guid()` for ids, not `.uuid()`.** A textual scan in the P1 test fails
on any `.uuid(` in this package's source.

Pinned by:
- `src/schemas/__tests__/zod4-guid-semantics.test.ts`: P1 at every site, both halves, on the site's own path.
- `src/schemas/requests/__tests__/zod4-request-contract.test.ts`: P2, P3 and I1–I5. It was proven two-sided: under
  zod 3, exactly the 14 intentional rows fail and the 12 preserved rows pass.

## Sprint 131 D3 — express-rate-limit 8 (2026-09-21)

`express-rate-limit` **→ 8.7.0** (#224). One PR moves root, `packages/shared`, cleanup-service and geocoding-service.
shared and geocoding were deliberately held back on **7.5.1** and are now on 8.
Their two `DIVERGENCE_ALLOWLIST` entries in `tests/regression/sprint-131-workspace-declarations.test.ts` are
removed: the gate's stale-entry test went red on #224 as soon as they stopped being divergences.

I checked behavior against the installed `dist/index.cjs` of both versions and with a real-Express probe:
- CommonJS `require()` still returns the function.
- `max` still maps to `limit`.
- `standardHeaders: true` still selects `draft-6`.
- The default key generator is still per-IP. v8 applies a /56 subnet to IPv6.
- None of v8's new validations fires for any option shape used here, and no test output contains `ERR_ERL`.

v8.7.0 adds a **runtime dependency, `debug@^4.4.3`**, installed under express-rate-limit's own folder because root
has `debug@2.6.9`.

✅ **BUG-049 (fixed, Sprint 131).** `createRateLimiter`'s `keyGenerator` returns `user:<userId>` when the
request is authenticated and `ipKeyGenerator(req.ip)` otherwise — IPv4 unchanged, IPv6 narrowed to a /56.
It previously returned `undefined`, and neither express-rate-limit 7 nor 8 falls back to an IP key when it
does, so every anonymous caller shared one bucket. When `req.ip` is undefined — only when the socket
has no remote address — the key falls back to the literal `'unknown'`, a single fail-closed bucket.

**A consuming service behind nginx MUST set `app.set('trust proxy', 1)`**, or `req.ip` is the Docker
gateway and the key collapses to one bucket again. A service nginx does **not** proxy must set
nothing: trusting an absent hop makes `req.ip` a client-supplied header. Both directions are gated. nginx already supplies `X-Forwarded-For` via `/etc/nginx/proxy_params`, so no
nginx change was needed. The value must stay `1`: `true` would let a client spoof `req.ip`. Both halves are
gated by `tests/regression/sprint-131-rate-limit-trust-proxy.test.ts`, and the per-IP behaviour by
`src/middleware/__tests__/sprint-131-rate-limit-key.test.ts`.

⚠️ The `user:<userId>` branch is reached in **exactly one service**. `social-graph-service` calls
`app.use(authMiddleware)` at `src/index.ts:135`, ahead of six route limiters (`/invitations`, `/paths`,
`/network`, `/trust-card`, `/trust` ×2), so those key **per user**; its `globalRateLimiter` and its two
public/internal limiters run earlier and stay per-IP. Every other consuming service positions every limiter
ahead of `authMiddleware`, so `req.user` is unset when the key is computed and the limit is per-IP.

So the presets' "per user" wording is accurate in one service and misleading in the rest — check where a
limiter sits relative to `authMiddleware` before reasoning about what a preset's `max` actually bounds.

No export, endpoint, payload or event change.
