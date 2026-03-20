# SPRINT 30 COMPLETE — READY TO MERGE

## Handoff Document for New Conversation

**Date**: 2026-03-19
**Current Version**: v9.5.0 (Sprint 30 complete)
**Branch**: `feature/sprint-30-trust-evolution` (ready to merge to master)
**Status**: Sprint 30 fully implemented, all 13 tasks complete, build green, all tests passing.

---

## Sprint 31 Next Up: Community Evolution Engine

The next session should:

1. **Merge `feature/sprint-30-trust-evolution` to master** (open PR or direct merge)
2. **Apply migration on demo server**:
   ```bash
   ssh ubuntu@karmyq.com
   docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < infrastructure/postgres/migrations/20260319-trust-evolution.sql
   ```
3. **Create `feature/sprint-31-community-evolution`** and begin Sprint 31
4. **Reference Sprint 31 spec** when it's written (not yet created)

---

## Sprint 30 Summary

All 13 tasks implemented and verified:

| Task | Status |
|------|--------|
| 1 - Migration + init.sql | DONE |
| 2 - Extract `trustConfigDb.ts` | DONE |
| 3 - Unit tests (18 tests, all passing) | DONE |
| 4 - `trustEvolutionDb.ts` | DONE |
| 5 - `trustEvolutionService.ts` | DONE |
| 6 - Wire into `subscriber.ts` | DONE |
| 7 - 5 API routes + inline feedback evolution | DONE |
| 8 - Frontend API + trust.tsx toggle | DONE |
| 9 - "My Trust Journey" page (`evolution.tsx`) | DONE |
| 10 - Community admin evolution section | DONE |
| 11 - ADR-046 + landing page docs | DONE |
| 12 - CONTEXT.md + registry.json + TDD integration test | DONE |
| 13 - Final type check + verification | DONE |

**Verification results**: `npm run build` — 13/13 tasks successful. `npm test` — 27/27 tasks successful. All unit tests pass (18 trust evolution tests + all prior tests). `npm run feedback:check` — no staged changes detected (clean).

---

## 3-Sprint Arc Context

- **Sprint 30 (complete)** — Individual trust config layer + evolution engine + history report
- **Sprint 31 (next)** — Community evolution (aggregate individual signals → community config drift)
- **Sprint 32** — Fractal feed interface (feed/matching uses blended individual+community model)

---

## 🎯 Sprint 30: Trust Evolution Foundation (Complete)

### What We're Building

A **per-user trust config layer** with automatic parameter calibration. Users and communities can opt in to having their trust models evolve based on lived experience.

**Core principle**: accuracy over direction. The system calibrates toward what's real — not toward more or less openness. An accurate low-trust model is healthier than an inaccurate high-trust model.

### New Concept: `cross_community_prior`

A Bayesian prior (0.05–0.95, default 0.50) — your starting trust assumption for people from other communities before any shared history. Distinct from depth/breadth weights (which measure interaction patterns). Calibrates in either direction based on actual experience.

### The 3-Sprint Arc

- **Sprint 30 (this)** — Individual trust config layer + evolution engine + history report
- **Sprint 31** — Community evolution (aggregate individual signals → community config drift)
- **Sprint 32** — Fractal feed interface (feed/matching uses blended individual+community model)

---

## 📋 Implementation Plan Summary (13 Tasks)

Full plan: `docs/superpowers/plans/2026-03-19-trust-evolution-foundation.md`

| Task | What | Key files |
|------|------|-----------|
| 1 | Migration + init.sql | `migrations/20260319-trust-evolution.sql`, `init.sql` |
| 2 | Extract shared `trustConfigDb.ts` | `karmaService.ts` (only — NOT `communityTrustService.ts`) |
| 3 | Write unit tests (TDD — write first, fail) | `tests/unit/reputation/trustEvolutionService.test.ts` |
| 4 | Implement `trustEvolutionDb.ts` | `src/database/trustEvolutionDb.ts` |
| 5 | Implement `trustEvolutionService.ts` | `src/services/trustEvolutionService.ts` |
| 6 | Wire into `subscriber.ts` (match events) | `src/events/subscriber.ts` |
| 7 | Wire inline feedback + 5 API routes | `src/routes/reputation.ts` |
| 8 | Frontend API + trust.tsx toggle | `api.ts`, `pages/reputation/trust.tsx` |
| 9 | "My Trust Journey" page | `pages/reputation/evolution.tsx` |
| 10 | Community admin section | `pages/communities/[id].tsx` |
| 11 | ADR + landing page docs | ADR-046, concept JSON, nav.json |
| 12 | CONTEXT.md + registry + TDD test | `CONTEXT.md`, `registry.json`, `tests/tdd/` |
| 13 | Final type check + verification | `npm test`, `npm run feedback:check` |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

### `trustConfigDb.ts` field name remapping
The existing `karmaService.ts` likely remaps raw DB column names (`trust_depth_weight` → `depth_weight`). The extracted `trustConfigDb.ts` must return the SAME field names that `karmaService.ts` already expects internally. **Read `karmaService.ts` before writing `trustConfigDb.ts`.** Do NOT touch `communityTrustService.ts` — its `getCommunityTrustConfig` queries completely different columns and is NOT a duplicate.

### `match_completed` payload has no `community_id`
The Bull event payload only has: `match_id`, `request_id`, `requester_id`, `responder_id`. The subscriber iterates communities via a loop. Evolution calls must go **inside that community loop** using the loop's community variable — not outside it.

### `insertFeedback` returns void
In the feedback handler, use `match_id` (not `feedback_id`) as `triggerEventId`. The `insertFeedback` DB function returns `void` — there is no feedback row ID in scope.

### `getUserEffectiveParams` is NOT wired into `updateTrustScore` (intentional)
Evolution log fills with adjustments but they don't yet affect displayed scores. Sprint 32 wires it in. The UI must communicate: "Your trust model is calibrating. It will influence your experience in a future update."

### Evolution signals — two code paths
- `cross_community_positive_feedback` and `cross_community_negative_feedback` → inline in `POST /reputation/feedback` handler (NOT a Bull event — `insertFeedback` is already inline)
- Other 3 signals → inside the `match_completed` Bull event handler

---

## 🗂️ New Files Being Created

```
infrastructure/postgres/migrations/20260319-trust-evolution.sql
services/reputation-service/src/database/trustConfigDb.ts
services/reputation-service/src/database/trustEvolutionDb.ts
services/reputation-service/src/services/trustEvolutionService.ts
apps/frontend/src/pages/reputation/evolution.tsx
docs/adr/ADR-046-trust-model-evolution.md
apps/landing/src/data/docs/concepts/trust-model-evolution.json
apps/landing/src/data/docs/concepts/adr-046-trust-model-evolution.json
tests/unit/reputation/trustEvolutionService.test.ts
tests/tdd/trust-evolution-flow.test.ts
```

---

## ⚠️ Sprint 31 Design Note: Evolution Should Be Opt-Out

Current Sprint 30 implementation is opt-in (`community_evolution_enabled` defaults false, user `evolution_enabled` defaults false). **This is wrong** — evolution should be on by default with an opt-out path.

Sprint 31 should fix:
- Migration default for `community_configs.community_evolution_enabled` → `true`
- `user_trust_configs` insert defaults → `evolution_enabled = true`
- UI copy: "Your trust model evolves automatically" + opt-out toggle (not opt-in)

Captured in `docs/IDEAS.md` [2026-03-20].

---

## ⚠️ Known Issues / Watch List (carry-forward)

- **Provider trust scores still show 30** for most providers — formula-correct but no reviews yet. Will improve organically.
- **Network graph looks unnatural** — Maria hyperconnected, newer users isolated. Captured in `docs/IDEAS.md`.
- **7 communities on demo** — simulation bug fixed 2026-03-18 (`access_type: 'open'` → `'public'`). New Portland communities will appear after next simulation cycles.
- **Migration must be applied manually on demo** — `deploy.sh` does NOT auto-run migrations. After merging Sprint 30:
  ```bash
  ssh ubuntu@karmyq.com
  docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < infrastructure/postgres/migrations/20260319-trust-evolution.sql
  ```

---

## Persistent Context (carry forward always)

- **Migration runner**: `deploy.sh` does NOT auto-run migrations. Apply manually: `docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < migration.sql`
  *(Note: prod DB user is `karmyq_prod`, DB is `karmyq_prod` — not `karmyq_user`/`karmyq_db`)*
- **Landing page docs**: Files live in `apps/landing/src/data/docs/` — force-add with `git add -f` since the directory is gitignored but files are tracked. Do NOT regenerate from source.
- **Registry.json events must be plain strings**: The landing page `services/[name]/page.tsx` maps over `events.publishes` and `events.subscribes` and expects strings. If you add an event as an object `{ type, description }` the build fails with TS2322.
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
- **Rate card soft-delete**: DELETE endpoint sets `is_active = false`, never hard-deletes. Public GET only returns `is_active = true` cards. Owner GET uses `?include_inactive=true`.
- **Rate card routes must precede /:providerId**: Express route ordering — `/:providerId/rate-cards` must be registered before `/:providerId` or it will never match.
- **preferred_provider_id validation order**: PROVIDER_NOT_FOUND → PROVIDER_INACTIVE → PROVIDER_TYPE_MISMATCH — all checked before Zod schema validation in `POST /requests`.
- **trust evolution — cross_community_prior**: The new `cross_community_prior` parameter (0.05–0.95) is direction-agnostic. Never describe higher values as "more open." UI language: "Your cross-community trust calibration."
- **trust evolution — community_id not in match_completed payload**: The Bull event has no `community_id`. Evolution calls must go inside the per-community loop in `subscriber.ts`, not outside it.
- **trust evolution — insertFeedback returns void**: Use `match_id` as `triggerEventId` in feedback handler. There is no `feedback_id` in scope.
- **trust evolution — getUserEffectiveParams not wired to updateTrustScore**: Intentional. Sprint 32 connects it. Evolution log fills but displayed scores don't change yet.
