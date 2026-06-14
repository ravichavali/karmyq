# Sprint 98 Trust Truth Audit

**Date opened:** 2026-06-14
**Release target:** v11.7.0
**Primary tester:** `maria.reyes@test.karmyq.com` / `password123`

## Named Bugs

| ID | Severity | Area | Finding | Decision |
|---|---|---|---|---|
| BUG-098-001 | High | Trust paths | Community context can drift from visible surface. | Audit first |
| BUG-098-002 | High | Path computation | Exchange path graph may be platform-wide while scoring/cache is community-scoped; missing context can 500. | Audit first |
| BUG-098-003 | High | Graph APIs | Graph nodes/links may not prove active membership for claimed scope. | Audit first |
| BUG-098-004 | Medium | Relationship labels | UI labels use multiple relationship meanings. | Fix confirmed drift |
| BUG-098-005 | Low | Dashboard feed | "You're caught up" can appear with "Show more open requests." | Fix |
| BUG-098-006 | Low | Legacy endpoints | `/network` may still be reachable but no longer authoritative. | Audit/document |

## Relationship Semantics

| Label | Backing truth |
|---|---|
| Direct exchange connection | Completed help exchange path of degree 1. |
| Indirect exchange path | Completed help exchange path of degree 2 or 3. |
| Fellow community member | Shared active community membership, no exchange proof implied. |
| Invitation connection | Accepted invitation lineage. |
| Shared provider/community context | Provider and viewer share active community membership. |

## Static Source Findings (pre-live-audit)

### BUG-098-002 — CONFIRMED in source

- `auth.social_distances.community_id` is declared `UUID` ([init.sql:81](../../infrastructure/postgres/init.sql#L81)).
- `services/social-graph-service/src/routes/paths.ts` (single `GET /:targetUserId` and `POST /batch`)
  falls back to the literal string `'platform'` when neither `X-Community-ID` nor
  `req.user.currentCommunityId` is present, then uses that value in
  `WHERE ... AND community_id = $3`. Comparing the string `'platform'` to a `UUID` column raises a
  Postgres `invalid input syntax for type uuid` error → caught by the route's `catch` → **500**,
  before any path semantics are reached.
- The same `'platform'` string is then passed to `computeTrustPath(...)` and (if a path is found)
  written back into `auth.social_distances` via `INSERT ... ($3 = communityId)` — also a UUID-cast
  failure path on write.

## Audit Findings (live demo `karmyq_prod`, run 2026-06-14)

`scripts/audit-trust-truth.sql` run inside `karmyq-postgres`:

| Check | Result | Interpretation |
|---|---|---|
| 1 / 1b — trust edges whose endpoints are not active members of edge community | **325 rows** | Real drift. Trust edges are written on `match_completed` with the match's community; if a user later leaves that community (membership no longer `active`), the edge persists. Community-scoped graph endpoints that derive nodes from `trust_edges` can therefore surface non-members → **BUG-098-003 confirmed**. |
| 2 — `exchange` `social_graph.connections` without a completed match | **343 rows** | `connections` rows with `type='exchange'` are written **only** on `match_completed` ([subscriber.ts:25-42](../../services/social-graph-service/src/events/subscriber.ts#L25-L42)) and have **no FK to matches**. S87 demo cleanup deleted requests → cascade-deleted matches, orphaning these rows. **However**, `computeShortestPath` builds its adjacency from `requests.matches WHERE status='completed'` and **never reads `social_graph.connections`** ([pathComputation.ts:39-47](../../services/social-graph-service/src/services/pathComputation.ts#L39-L47)). So orphaned connections do **not** affect trust paths or the trust graph. They only surface via the legacy `/network` endpoint (**BUG-098-006**). |
| 3 — cached `social_distances` w/ missing/expired/orphan community | 100 (capped); all rows are simply `expires_at <= NOW()` (normal expiry). **No NULL community_id, no orphaned community_id.** | Not corruption. Normal cache expiry. |
| 3b — distinct cached `community_id` values | 11, **all valid UUIDs** (no `'platform'`, no NULL). | The `'platform'` string fallback has **never been written to the cache** → BUG-098-002 is a latent read-path 500 only, no cache pollution, **no data repair needed**. |
| 4 — provider shared-community not active on both sides | **0 rows** | Clean. `requests.providers.ts` shared-community query already enforces active membership (verify in source, no repair). |
| 5 — dibs admin-proposed match w/o active shared community | **0 rows** | Clean. No `community_connection` drift in live data (verify source enforces it, no repair). |

### Path semantics decision (BUG-098-001 / BUG-098-002)

**Schema fact:** `requests.help_requests` has **no `community_id`**; requests map to communities
many-to-many via `requests.request_communities` ([init.sql](../../infrastructure/postgres/init.sql)).
A completed match therefore cannot be cleanly attributed to a single community.

**Decision (deliberate, labeled platform-wide — spec BUG-098-002 "Allowed only if deliberate"):**

- **Exchange-path topology is platform-wide.** Trust earned from a real completed exchange is real
  regardless of which community it occurred in, and the schema cannot attribute a match to one
  community. `computeShortestPath` stays platform-wide.
- **Trust score and intermediate karma remain community-scoped** when a real community UUID is
  supplied (existing, correct behavior — karma and `trust_edges` are per-community).
- **No more `'platform'` string against a UUID column.** When no real community context exists, use a
  platform sentinel (`community_id IS NULL` cache rows via a NULL-safe lookup, or a fixed sentinel
  UUID) so the route never throws a UUID cast 500.
- **Responses carry an explicit `scope`** (`'community'` when a real UUID is supplied, `'platform'`
  otherwise) and `/paths`, `/paths/batch`, `/trust-card` share one resolver. UI labels accordingly.

This codifies the relationship-truth model → **ADR-077** (Trust path topology is platform-wide;
strength is community-scoped).

## API Smoke (live demo, `maria.reyes`, run 2026-06-14)

Run from the demo box (Windows curl + large JWT triggers a schannel TLS-renegotiation abort; Linux
curl on the server is clean). Target `hannah.okafor` (`7ba50c00…`), community `4c9b09f7…`.

| Surface | Result |
|---|---|
| `GET /paths/:id` with `X-Community-ID` | 200 · `connection_type: exchange` · degrees 1 · trust_score 0 |
| `GET /paths/:id` **without** `X-Community-ID` | **200** (not 500) — JWT carries `currentCommunityId`, so `'platform'` fallback is never reached |
| `POST /paths/batch` with community | 200 · same `exchange`/degree-1 result |
| `GET /trust-card/:id` without community | 200 · `trustPath` agrees: exchange degree 1 |

**All four surfaces agree** on relationship meaning (exchange, degree 1) — consistency is good.

**BUG-098-002 trigger characterized:** the 500 does **not** fire for normal tokens because
`currentCommunityId` is populated from `communities[0].id` at login
([auth.ts:69](../../services/auth-service/src/routes/auth.ts#L69)). It is `undefined` only when a
user has **zero communities**. So the latent UUID-cast 500 fires for a community-less user who
requests a trust path with no `X-Community-ID` header. Still a real bug to fix; just narrower than
the plan assumed. The fix (platform sentinel instead of the `'platform'` string) is unchanged.

<!-- AUDIT RESULTS BELOW -->
