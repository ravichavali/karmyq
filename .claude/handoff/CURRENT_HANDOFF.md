# Sprint 28 — IN PROGRESS | Sprint 29 Ready

## Handoff Document for New Conversation

**Date**: 2026-03-18
**Current Version**: v9.4.0
**Status**: Sprint 28 backend fully implemented (uncommitted). Needs commit + deploy + verification on karmyq.com, then Sprint 29 begins.

---

## ⚡ Quick Start — Finish Sprint 28 & Verify on karmyq.com

### Step 1: Commit Sprint 28 work
All Sprint 28 changes are implemented but not yet committed. Files modified:
```
services/reputation-service/src/services/providerTrustService.ts  ← NEW (key file)
services/reputation-service/src/events/subscriber.ts               ← refactored
services/reputation-service/src/routes/providerReviews.ts          ← refactored + backfill endpoint
services/request-service/src/routes/providers.ts                   ← user_id filter added
services/simulation-service/src/api-client.ts                      ← 2 new methods
services/simulation-service/src/workflows/complete-match-workflow.ts ← submits reviews
tests/unit/reputation/provider-completion-rate.test.ts             ← updated for refactor
services/reputation-service/tests/tdd/providerTrustScore.test.ts   ← expanded
docs/adr/ADR-042-provider-trust-score.md                           ← Implemented
```

```bash
# Verify tests pass first
npm test

# Then commit
git add services/reputation-service/src/services/providerTrustService.ts
git add services/reputation-service/src/events/subscriber.ts
git add services/reputation-service/src/routes/providerReviews.ts
git add services/request-service/src/routes/providers.ts
git add services/simulation-service/src/api-client.ts
git add services/simulation-service/src/workflows/complete-match-workflow.ts
git add tests/unit/reputation/provider-completion-rate.test.ts
git add services/reputation-service/tests/tdd/providerTrustScore.test.ts
git add docs/adr/ADR-042-provider-trust-score.md
git commit -m "feat(reputation): Sprint 28 — wire provider trust score to real data (ADR-042)"
git push origin master
```

### Step 2: After CI deploys, verify on karmyq.com

**2a. Run the backfill** to recalculate existing provider trust scores from historical match data:
```bash
# You need an admin JWT token — log in as admin first
curl -X POST https://karmyq.com/api/reputation/provider-trust/recalculate \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
# Should return: { "success": true, "data": { "updated": N }, "message": "Recalculated trust scores for N providers" }
```

**2b. Check the DB** — scores should no longer all be `30`:
```bash
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT pts.trust_score, pts.avg_stars, pts.completion_rate, pts.total_reviews, pts.last_calculated FROM reputation.provider_trust_scores pts ORDER BY pts.trust_score DESC LIMIT 20;"
```

**2c. Run simulation** — should now generate reviews:
```bash
# After sim runs, check for new reviews
docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT COUNT(*) FROM reputation.provider_reviews;"
# Should be > 0 after sim runs a few sessions
```

**2d. Verify trust score updates** — complete a match in sim, then check the affected provider's score changed.

---

## ✅ Sprint 28 — What Was Implemented (2026-03-18)

### Root cause of static "30" scores
The event wiring was correct — `updateProviderCompletionRate()` was firing on `match_completed`. But two bugs made all scores `30`:
1. **Formula mismatch**: `subscriber.ts` used `avg_stars / 5.0 * 100` (wrong) instead of ADR-042's `((avg_stars - 1) / 4) * 100`; the wrong formula with `avg_stars = 0` avoids negative, but formula differed from `providerReviews.ts`
2. **No reviews**: Simulation was sending `{ rating, comment }` to `PUT /matches/:id/complete` which ignored them — no reviews ever landed in `reputation.provider_reviews`, so `avg_stars` stayed `0` forever. Result: `0*0.6 + 100*0.3 + 0*0.1 = 30`

### Changes made

**`services/reputation-service/src/services/providerTrustService.ts`** ← NEW
- `recalculateProviderTrustScore(providerId)`: single authoritative formula, reads from `provider_reviews` + existing metrics, writes `trust_score`
- `updateProviderCompletionRate(userId)`: updates `completion_rate` then calls recalculate
- `backfillAllProviderTrustScores()`: iterates all active providers, recalculates from historical data

**`services/reputation-service/src/events/subscriber.ts`**
- Removed inline SQL trust score formula (was the buggy one)
- Now imports `updateProviderCompletionRate` from `providerTrustService`

**`services/reputation-service/src/routes/providerReviews.ts`**
- Removed local `recalculateProviderTrustScore` implementation
- Imports from `providerTrustService` instead
- Added: `POST /reputation/provider-trust/recalculate` (admin-only backfill endpoint)

**`services/request-service/src/routes/providers.ts`**
- Added optional `user_id` query param to `GET /providers`
- Allows simulation (and frontend) to find a specific user's provider profiles

**`services/simulation-service/src/api-client.ts`**
- Added `getProvidersByUser(userId)`: `GET /providers?user_id=xxx`
- Added `submitProviderReview(providerId, matchId, stars, reviewText)`: `POST /reputation/provider-reviews`

**`services/simulation-service/src/workflows/complete-match-workflow.ts`**
- Added `submitProviderReviewIfApplicable()` helper
- When requester marks done, looks up if responder has a provider profile and submits a review
- Fixed: removed backwards rating logic (was sending rating from responder's side)
- 80% chance of 5★, 20% of 4★; randomized positive/neutral comment

**`tests/unit/reputation/provider-completion-rate.test.ts`**
- Updated mock setup for the extra 3 queries `recalculateProviderTrustScore` now makes

**`services/reputation-service/tests/tdd/providerTrustScore.test.ts`**
- Added DB-mocked unit tests for `recalculateProviderTrustScore`, `updateProviderCompletionRate`, `backfillAllProviderTrustScores`

**`docs/adr/ADR-042-provider-trust-score.md`**
- Status: Accepted → Implemented
- Documented both update triggers, cold-start behavior, backfill endpoint, implementation notes

### Test results
- 27/27 monorepo tasks: ✅ all passing
- 100 reputation-service TDD tests: ✅
- 16 unit tests (provider-completion-rate): ✅

---

## 🚀 Sprint 29 — Rate Cards / Pricing Transparency

**Spec**: `docs/superpowers/specs/2026-03-15-provider-economy-arc.md` (Sprint 29 section)

**Problem**: Providers have no way to publish what they charge. Requestors have no way to see pricing before contacting a provider.

### What ships
- New `rate_cards` table in `requests` schema (linked to `provider_profiles`)
  - Fields: `service_type`, `label` (e.g. "Tutoring — Math"), `rate` (e.g. "$30/hr"), `notes`, `active`
- Provider UI in the Provider tab of `/profile` to create/edit/delete rate cards
- Rate card display on `/providers/[id]` — visible to unauthenticated users
- Rate card display on collective detail page for collective members who have cards
- When filing a typed request: requestors can browse matching provider rate cards and optionally pre-select a provider as their preferred responder

### Stop criteria
- [ ] Providers can create, edit, and delete rate cards from their profile
- [ ] Rate cards visible on provider detail page (unauthenticated access works)
- [ ] Collective page shows rate cards for member providers
- [ ] Requestors can browse rate cards and pre-select a provider when filing a request
- [ ] Pre-selected provider receives the request as a direct match proposal
- [ ] All TDD tests pass, no regressions

### Dependencies
- Sprint 28 must be committed and deployed first
- Provider tab on `/profile` already exists (Sprint 27) — rate cards go there

### Key files to read at Sprint 29 start
- `apps/frontend/src/app/profile/page.tsx` — Provider tab (where rate card UI will live)
- `apps/frontend/src/app/providers/[id]/page.tsx` — Provider detail page (where rate cards display)
- `services/request-service/src/routes/providers.ts` — Provider profiles API (where rate card endpoints will be added)
- `infrastructure/postgres/migrations/022-provider-profiles.sql` — schema reference for the new `rate_cards` table

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
- **React 19 everywhere**: All workspaces use React 19. Root `package.json` has `react@^19.0.0` in both `devDependencies` and `overrides` to force hoisting to `root/node_modules/react` (prevents styled-jsx dual-instance crash).
- **providerTrustService is the single formula source**: Both `subscriber.ts` (on match_completed) and `providerReviews.ts` (on review submitted) call `recalculateProviderTrustScore` from `services/reputation-service/src/services/providerTrustService.ts`. Never duplicate the formula.
- **Simulation now submits provider reviews**: `complete-match-workflow.ts` calls `submitProviderReviewIfApplicable()` when the requester marks done. The responder's provider profile (if any) gets a review. This is how `avg_stars` gets populated in `reputation.provider_trust_scores`.
