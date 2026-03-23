# SPRINT 36 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-22
**Current Version**: v9.10.0 → v9.11.0
**Status**: Sprint 36 planned. Spec and plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-36-coherence-depth`
3. Open plan: `docs/superpowers/plans/2026-03-22-sprint-36-coherence-depth.md`
4. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

---

## Sprint 36 Goal

Achieve full site aesthetic coherence, deepen commitments with action-priority ordering and inline messaging, consolidate the community admin page (7→5 tabs + admin connector tools), and introduce geography/interest-based community discovery.

---

## What This Sprint Ships

| Feature | Details |
|---------|---------|
| **Aesthetic coherence** | Community page + listing brought to Sprint 33–35 design language (semantic colors, card patterns, skeleton loaders) |
| **Commitment priority ordering** | Sorted by action urgency: Needs Response → In Progress → Completed. Within tier: newest first |
| **Inline expandable conversation** | Chat widget embedded in commitment card. Collapsed → shows unread count. Expanded → full thread inline, no page nav |
| **Admin tab consolidation** | 7 tabs → 5: Overview, People (Members+Norms), Requests (Requests+Insights+Actions), Providers, Settings |
| **Admin as connector** | Boost request (48h, +0.3 feed score), propose a specific member as match, tag as community-urgent |
| **Community discovery toggle** | Geography (default, near me sorted by distance) | Interests (tag filter chips) |
| **DB migrations** | 014: communities gets `latitude`, `longitude`, `tags[]`. 015: help_requests gets `is_boosted`, `boosted_at`, `boosted_expires_at`, `boosted_by` |

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin power + community discovery | 🔜 **This sprint** |

---

## Key Documents

- **Spec**: `docs/superpowers/specs/2026-03-22-sprint-36-coherence-depth-design.md`
- **Plan**: `docs/superpowers/plans/2026-03-22-sprint-36-coherence-depth.md`

---

## ⚠️ Critical Implementation Notes (copy from spec)

1. **Messaging wire-up — no new schema**: `messaging.conversations.request_match_id` already exists. Call `GET /api/messaging/conversations/match/:matchId` to get/create conversation. The messaging service `getOrCreateConversation(matchId)` creates lazily. No schema migration needed.

2. **Tab restructure — preserve ValidTab + OLD_TAB_MAP**: `communities/[id].tsx` defines `ValidTab` union and `VALID_TABS` array. Update both. Add to `OLD_TAB_MAP`: `members → 'people'`, `norms → 'people'`, `insights → 'requests'`.

3. **Boost expiry — query-time, no cron**: Filter: `AND (is_boosted = FALSE OR boosted_expires_at > NOW())`. The index `idx_requests_is_boosted` handles this efficiently.

4. **Geolocation is async and may be denied**: Communities listing must render immediately with skeleton/fallback, then update when location resolves. Never block render.

5. **Tag normalization**: Always `tags.map(t => t.toLowerCase().trim())` before DB insert/update.

6. **Admin propose-match = real match row**: Inserts into `requests.matches` with `status='proposed'`, `responder_id` = proposed user. Proposed user sees it in CommitmentsTab "Needs Your Response".

7. **tailwindcss-animate NOT installed**: Use CSS transitions via `style` prop or className conditionals only.

8. **Migrations must be applied manually post-deploy**: `deploy.sh` does NOT auto-run migrations. SSH to demo server and run migrations 014 and 015 manually after deployment.

9. **Landing page docs require `git add -f`**: Landing page files are gitignored but tracked. Always `git add -f apps/landing/src/data/docs/...`.

---

## Carry-Forward Issues

- **Pre-existing test failures** (not Sprint 35 regressions): `preSelectProvider`, `trust-evolution-flow`, `rateCards`
- **Migration runner**: deploy.sh does NOT auto-run migrations. Apply manually post-deploy.
- **GitHub security vulnerabilities**: 8 dependabot alerts remain on default branch.
- **Untracked file**: `docs/superpowers/specs/2026-03-18-sprint-29-rate-cards-design.md` — ignore unless relevant.
- **Stale container pattern**: Demo server occasionally has stale Docker containers. Fix: SSH and `docker rm -f <container-name>`, then redeploy.

---

## Persistent Context (carry forward always)

- **JWT field**: `user.communities` (NOT `communityMemberships`). Always: `const memberships = user.communities ?? [];`
- **Nginx**: `infrastructure/nginx/nginx.conf` is source of truth. deploy.sh copies + reloads.
- **Provider service types**: Valid API types: `ride`, `tradesperson`, `tutor`, `other`.
- **Simulation email domain**: `@test.karmyq.com`, password `password123`
- **JWT communities cap**: Auth service caps at 15 (`JWT_COMMUNITIES_LIMIT`).
- **Auto-generated files gitignored**: `services/dependency-graph.md`, `impact-analysis.md`, `version-drift.md`
- **Match status lifecycle**: `proposed` → `matched` → `completed`.
- **responseInterceptor unwraps one level**: `response.data` is already the inner object.
- **Table schema naming**: Community schema is `communities` (plural). `requests.help_requests` has NO `community_id` — use `requests.request_communities` junction table.
- **Admin page tab structure (v9.10.0)**: 7 tabs — Overview, Members, Norms; Requests, Insights, Providers (`isAdminOrMod`); Settings (`isAdmin` only). **Sprint 36 changes this to 5 tabs.**
- **Rate card soft-delete**: DELETE sets `is_active = false`.
- **cross_community_prior**: Direction-agnostic (0.05–0.95). Never "more open."
- **Only one simulation**: `services/simulation-service/`. DB user: `karmyq_user`.
- **Collective link auth**: Both link/unlink endpoints accept collective admin OR community admin.
- **social_graph.connections pair normalization**: Always `LEAST/GREATEST(::text)` cast.
- **NetworkGraph lazy-load**: Uses `IntersectionObserver`. Wrapped with `next/dynamic` (Sprint 33).
- **React 19 everywhere**: Root `package.json` has `react@^19.0.0` in `devDependencies` AND `overrides`.
- **completeMatch requires user_id in body**: `PUT /matches/:id/complete` reads `user_id` from body (not JWT).
- **generate-docs.ts is source of truth for nav.json**: Never edit nav.json directly.
- **Landing page force-add**: `git add -f apps/landing/src/data/docs/...`
- **No worktrees**: Solo developer. Work directly on feature branch.
- **Evolution defaults are opt-out (TRUE)**: Sprint 31 migration flipped both tables.
- **effectiveParamsCache circular import guard**: `trustEvolutionDb.ts` must NOT import `effectiveParamsCache.ts`.
- **Global evolution opt-out**: Missing `user_trust_preferences` row = opted IN (default TRUE).
- **Bull queue lazy init in trustEvolutionService**: `_communityEvolutionQueue` is null at module load.
- **REPUTATION_API_URL in Docker**: Must be `http://reputation-service:3004` — NOT `localhost:3004`.
- **Feed empty after deploy**: Transient — simulation needs warm-up time. Not a code regression.
- **tailwindcss-animate NOT installed**: `animate-in` class is unavailable. Do not use it in CSS or JSX.
- **Sprint 35 patterns**:
  - `RequestWizard`: two-step modal. Props: `preferredProviderId`, `preferredProviderName`, `preferredProviderServiceType`. When provider type set, initialize at step 2.
  - `SpeedDialFab`: tab-aware. browse/commitments = both actions; my-requests = get-help only; profile = hidden.
  - Urgency mapping: UI uses `normal/urgent/critical`; API uses `medium/urgent/critical` (normal → medium).
  - NLP/autocomplete removed: `EnhancedAutocomplete`, `ExtractedDataChips`, `parsedRequest` no longer in codebase.
  - `ProviderCard.onGetService`: callback pattern — listing page holds wizard state, card calls callback.
  - Module-level `schemaCache` in `RequestWizard.tsx` avoids redundant schema fetches.
- **Sprint 36 patterns** (new this sprint):
  - `sortByActionPriority`: `proposed=0, matched=1, completed=2`, then `updated_at DESC` within tier.
  - `ExpandableConversation`: uses `GET /api/messaging/conversations/match/:matchId` (getOrCreateConversation). Stays expanded until chevron clicked.
  - `isBoostActive`: checks `is_boosted && boosted_expires_at > now()`.
  - Community discovery: mode stored in `localStorage` key `community_discovery_mode`. Default: `'geography'`.
  - Admin propose-match: creates real `requests.matches` row, `status='proposed'`, `responder_id` = proposed user.
