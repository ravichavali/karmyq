# Sprint 27 — COMPLETE ✅

## Handoff Document for New Conversation

**Date**: 2026-03-16
**Current Version**: v9.4.0
**Status**: Sprint 27 complete. Merged to master. Migration needs to be applied to karmyq.com.

---

## ⚡ Quick Start

Sprint 27 is done. **One action required before Sprint 28 can begin:**

Apply the Sprint 27 DB migration on karmyq.com:
```bash
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /dev/stdin < ~/karmyq/infrastructure/postgres/migrations/20260315-social-graph-connections.sql
```

Then push to deploy:
```bash
git push origin master
```

After verifying karmyq.com is healthy, start Sprint 28: **Provider Trust Score Wiring**.
Sprint 28 spec is in `docs/superpowers/specs/2026-03-15-provider-economy-arc.md` (section "Sprint 28").

---

## ✅ What Was Completed (Sprint 27)

**Sprint goal**: Give providers a unified identity surface (profile + network graph) and surface social trust context on the provider detail page.

**Merge commit**: `926daa0` on master (15 feature commits on `feature/sprint-27`)

### Backend: `social_graph.connections` table

- **Migration**: `infrastructure/postgres/migrations/20260315-social-graph-connections.sql`
  - Creates `social_graph` schema
  - Creates `social_graph.connections` table with normalized-pair UNIQUE index (expression-based, uses `CREATE UNIQUE INDEX`, not inline UNIQUE constraint — PostgreSQL doesn't support expressions in inline UNIQUE)
  - Backfills from `requests.matches WHERE status = 'completed'`
  - Indexes on `user_a_id` and `user_b_id` for efficient neighbor queries
- **init.sql**: Updated with schema + table definition (no backfill)

### Backend: `match_completed` event handler (extended)

- **File**: `services/social-graph-service/src/events/subscriber.ts`
- Extended the existing `match_completed` handler — did NOT create a new file (would have caused Bull round-robin split)
- Now does: (1) clear trust path cache [existing] + (2) upsert into `social_graph.connections`
- Upsert uses ON CONFLICT with explicit expression target for idempotency

### Backend: `GET /network` endpoint

- **File**: `services/social-graph-service/src/routes/network.ts`
- Registered at `/network` in `services/social-graph-service/src/index.ts` (behind `authMiddleware`)
- Returns `{ nodes: [{id, name, provider_id}], edges: [{source, target, type}] }`
- Exchange connections from `social_graph.connections`, community co-members from `communities.members`
- Exchange edges take precedence on dedup; cap at 150 nodes
- Current user always included as center node (first in nodes array)
- Single DB query for all user display names (merged `[userId, ...connectedIds]`)

### Frontend: `api.ts`

- Added `getNetwork: () => socialGraphApi.get('/network')` to `socialGraphService`

### Frontend: Profile page (`apps/frontend/src/pages/profile.tsx`)

- Two-tab layout: **Community** (always) + **Provider** (conditional on `myProviders.length > 0`)
- Tab bar only rendered when user has provider profiles
- `?tab=provider` query param activates provider tab on load
- Fetches `myProviders` + `myCollectives` in parallel on mount (errors are silently swallowed — profile never blocks on provider data)
- `NetworkGraph` inserted in Community tab between Invitation Chain and Skills sections

### Frontend: `ProviderProfileTab` (`apps/frontend/src/components/ProviderProfileTab.tsx`)

- Shows "Your Service Profiles" section (cards with type badge, availability dot, link to `/providers/[id]`)
- Shows "Your Collectives" section (cards with member count, link to `/providers/collectives/[id]`)

### Frontend: `NetworkGraph` (`apps/frontend/src/components/NetworkGraph.tsx`)

- `react-force-graph-2d` v1.29.1 installed
- Lazy-loaded via `IntersectionObserver` — `GET /network` is NOT called until section scrolls into view
- `react-force-graph-2d` dynamically imported (avoids SSR issues)
- Center node: green (`#10b981`); provider nodes: indigo (`#6366f1`); peer nodes: slate (`#94a3b8`)
- Exchange edges: green; community edges: indigo
- Node click: provider nodes navigate via `router.push('/providers/[provider_id]')`; non-provider nodes do nothing (tooltip not implemented — deferred)
- Empty state: "No connections yet — complete a help exchange to build your network."

### Frontend: Provider detail page (`apps/frontend/src/pages/providers/[id].tsx`)

- `isOwner` and `useTrustPath` hook moved to top-level (hooks must be unconditional)
- **TrustPathBadge** shown below bio for non-owner viewers (`!isOwner && trustPath`)
- **"← Your Profile"** link at top for owner, linking to `/profile?tab=provider`

### Tests (32 new TDD tests across 3 files)

| File | Tests | What they cover |
|------|-------|-----------------|
| `tests/tdd/network-endpoint-contract.test.ts` | 11 | Normalized pair ordering, upsert idempotency, response contract (node/edge shape, 150-node cap, empty state) |
| `tests/tdd/profile-tabs.test.ts` | 8 | `shouldShowProviderTab` logic, `resolveActiveTab` with query param + hasProviders combos |
| `tests/tdd/network-graph.test.ts` | 13 | `isProviderNode`, `classifyNode` (self/provider/peer), `filterEdgesByType`, node click navigation logic |

All 124 TDD tests pass (`cd tests && npx jest tdd/ --no-coverage`).

### Docs updated

- `services/social-graph-service/CONTEXT.md` — new endpoint + events consumed + Sprint 27 recent changes
- `services/registry.json` — `GET /network` in apis.provides, `match_completed` subscription
- `apps/landing/src/data/docs/services/social-graph-service.json` — `GET /network` entry

---

## ⚠️ Post-Deploy Action Required

The Sprint 27 migration **must be applied manually** (deploy.sh does NOT auto-run migrations):

```bash
ssh ubuntu@karmyq.com
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /dev/stdin < ~/karmyq/infrastructure/postgres/migrations/20260315-social-graph-connections.sql
```

**Also check if Sprint 25 migration was applied** — if not, apply it too:
```bash
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -f /dev/stdin < ~/karmyq/infrastructure/postgres/migrations/20260313-admin-request-triage.sql
```

### Stop criteria for Sprint 27 (verify on karmyq.com after deploy)

- [ ] `social_graph.connections` table exists with backfilled data
- [ ] New completed matches upsert a connection row
- [ ] Provider users see two tabs on `/profile`; non-provider users see no change
- [ ] Provider tab lists all service profiles and collectives with correct links
- [ ] Network graph loads on scroll, renders exchange + community edges
- [ ] Provider detail page shows trust path badge to viewer
- [ ] Provider detail page shows "← Your Profile" link for owner
- [ ] `GET /network` documented in landing page service docs ✅ (done)
- [ ] All TDD tests pass ✅ (done — 124 passing)
- [ ] No regressions ✅ (done — all unit/regression tests pass)

---

## 🚀 Next Sprint — Sprint 28: Provider Trust Score Wiring

**Spec**: `docs/superpowers/specs/2026-03-15-provider-economy-arc.md` (Sprint 28 section)

**Problem**: All provider trust scores are a static `30` — a seed default that never changes. The trust score badge on provider cards, collective stats, and the provider detail page (now showing via TrustScoreBadge) is misleading.

**Sprint 28 goal**:
- Investigate where the `30` comes from (schema + seed data)
- Wire trust score recalculation to `match_completed` events
- Backfill existing providers from match + review history
- Formula to be designed at sprint start (informed by ADR-011 and ADR-040)

**Dependencies**: Sprint 27 must be deployed ✅

---

## Persistent Context (carry forward always)

- **Migration runner**: `deploy.sh` does NOT auto-run migrations. Apply manually: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < migration.sql`
  *(Note: prod DB user is `karmyq_prod`, DB is `karmyq_prod` — not `karmyq_user`/`karmyq_db`)*
- **Landing page docs**: Files live in `apps/landing/src/data/docs/` — force-add with `git add -f` since the directory is gitignored but files are tracked. Do NOT regenerate from source.
- **Community page is the admin page** — `/communities/[id]/admin` redirects to `/communities/[id]`. Tabs are role-gated.
- **init.sql must stay in sync with migrations** — add new columns/tables to both.
- **Trust score is 0-100 integer** — stored as integer, display as-is, do not multiply by 100.
- **Tests/ excluded from main tsconfig** — `apps/frontend/tsconfig.json` excludes `tests/**`. Test type-checking handled by ts-jest.
- **LSP diagnostics are false positives** — VSCode shows parse errors that aren't real. `npx tsc --noEmit` is the source of truth.
- **Provider service types** — Valid API types: `ride`, `tradesperson`, `tutor`, `other`. Never use `skill`, `errand`, `care`.
- **Simulation community name** — `create-collective-workflow` looks up by exact name `'PDX Service Providers Network'`.
- **Sim email domain** — `@test.karmyq.com`, password `password123`. Wipe: `DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com'`
- **No bulk user creation scripts** — simulation grows organically. Do NOT re-create `create-simulated-users.js`.
- **JWT communities cap** — auth service caps communities in JWT at 15 (`JWT_COMMUNITIES_LIMIT`). Full membership always checked via DB.
- **Auto-generated files gitignored** — `services/dependency-graph.md`, `impact-analysis.md`, `version-drift.md` are generated by pre-commit hook and ignored by git.
- **No worktrees** — solo developer workflow. Work directly on a feature branch (`git checkout -b feature/sprint-NN`). Worktrees cause npm install overhead and jest path bugs.
- **Network cohesion 90-day window** — both active member count (N) and edge data are filtered to 90 days to keep density ≤ 1.
- **Only one simulation now** — `simulation/` directory deleted. Only `services/simulation-service/` exists. DB user: `karmyq_user`, organic growth.
- **Match status lifecycle**: `proposed` → `matched` → `completed`. There is NO `active` status for matches.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from request body (not JWT).
- **responseInterceptor unwraps one level**: All axios API clients unwrap `{ success, data }` → `response.data` is already the inner object. Never do `response.data?.data`.
- **Table schema naming**: Community schema is `communities` (plural). `requests.help_requests` has NO `community_id` — use `requests.request_communities` junction table.
- **Community stats bypasses RLS**: `community-service/src/routes/stats.ts` uses `BEGIN; SET LOCAL row_security = off`.
- **Admin page tab structure (v9.2.0+)**: 7 tabs — Overview, Members, Norms (always visible); Requests, Insights, Providers (`isAdminOrMod`); Settings (`isAdmin` only).
- **Triage modal state**: 6 vars — `selectedRequest`, `showTriageModal`, `triageUrgency`, `triageNote`, `selectedResponderId`, `proposingMatch`. All reset by `handleCloseTriageModal()`.
- **request_admin_notes table**: UNIQUE(request_id, community_id). `PATCH /requests/:id/admin-triage` body: `{ community_id, urgency?, note? }`.
- **Moderator role escalation prevention**: moderators cannot pass `role` in member updates.
- **Collective stats SQL join**: `matches.responder_id` is a `user_id`, NOT `provider_id` — always join through `auth.users`.
- **Collective discovery search is client-side**: `discoverCollectives` has no `search` param — filtering in `CollectiveDiscoveryPanel`.
- **Collective link auth (v9.3.0+)**: Both link/unlink endpoints accept collective admin OR community admin via `user.communities` JWT array.
- **Cross-schema queries in request-service**: Use `communities.communities` (plural schema), not `community.communities`.
- **social_graph.connections UNIQUE constraint**: Uses `CREATE UNIQUE INDEX` (not inline UNIQUE) because PostgreSQL doesn't support expressions in inline UNIQUE constraints in CREATE TABLE. Index name: `connections_normalized_pair`.
- **social_graph.connections pair normalization**: Always `LEAST(user_a_id::text, user_b_id::text)` for user_a, `GREATEST(...)` for user_b. Both INSERT and ON CONFLICT target must use `::text` cast.
- **GET /network response**: `{ nodes: [{id, name, provider_id}], edges: [{source, target, type}] }`. Current user is always first node. `provider_id` is `null` (not undefined) when user has no provider profile.
- **NetworkGraph lazy-load**: Uses `IntersectionObserver` — `GET /network` is NOT called on profile mount, only when the "Your Network" section scrolls into view.
- **react-force-graph-2d**: Dynamically imported (`await import('react-force-graph-2d')`) inside the fetch callback to avoid SSR issues. Version 1.29.1.
