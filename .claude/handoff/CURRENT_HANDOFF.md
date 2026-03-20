# SPRINT 31 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-20
**Current Version**: v9.5.0 → v9.6.0 (Sprint 31 planned, not yet implemented)
**Branch**: Create `feature/sprint-31-community-evolution` (see Quick Start)
**Status**: Sprint 30 merged (PR #6). Sprint 31 spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-31-community-evolution`
3. Open plan: `docs/superpowers/plans/2026-03-20-sprint-31-community-evolution.md`
4. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

> Note: Before executing, also merge Sprint 30 and apply its migration on demo if not done:
> ```bash
> ssh ubuntu@karmyq.com
> docker exec karmyq-postgres psql -U karmyq_prod -d karmyq_prod -f /dev/stdin < infrastructure/postgres/migrations/20260319-trust-evolution.sql
> ```

---

## Sprint 31 Goal

> **Aggregate member trust deltas into community config drift across three parameters — default-on, opt-out, with a clean pluggable service boundary.**

---

## The 3-Sprint Arc

- **Sprint 30** (complete) — Individual trust config + evolution engine + history report
- **Sprint 31** (this sprint) — Community evolution: aggregate member deltas → community config drift
- **Sprint 32** (upcoming) — Fractal feed: feed/matching uses blended individual + community model

---

## Design Decisions Made This Session

### Opt-Out Model (Two Flags, No Middle State)
- `user_trust_configs.evolution_enabled` — user opts in/out of personal trust evolution
- `community_configs.community_evolution_enabled` — admin opts in/out of community evolution
- If a user's trust evolves, their delta **automatically** contributes to community evolution — no third flag. Opting out of personal evolution is the only way to stop contributing.
- Both default to `TRUE` (opt-out philosophy, not opt-in). The migration flips existing rows.

### Signal: Delta-Based Aggregation + Interaction Rate Validation
- Primary driver: median delta across active evolving members' `cross_community_prior` (option C)
- Interaction rate as health validator: if interaction rate declines, dampen the nudge (dampening: stable/improving → 1.0, declining >10% → 0.5, declining >25% → 0.0 skip)
- This instruments for option A (interaction rate correlation) without betting on it in Sprint 31

### Three Parameters That Evolve
| Parameter | Mechanism |
|-----------|-----------|
| `cross_community_prior` | Direct delta aggregation × 0.30 damping |
| `karma_split_helper` | Follows prior direction, ±1 per cycle |
| `trust_path_max_hops` | Follows prior direction, ±1 only after 3 consecutive same-direction cycles |

### Architecture: Pluggable Module
- `communityEvolutionService.ts` checks `community_evolution_enabled` at every entry point
- Removable by deleting the file + 3 call sites — no core system depends on it
- Bull queue: `karmyq-community-evolution`, deduplicated by `community_id` as job ID

---

## ⚠️ Critical Implementation Notes (copy from spec — read before Task 2)

1. **Evolution default flip updates ALL existing rows** — the migration has `UPDATE ... SET evolution_enabled = TRUE` for both tables. Intentional design reset.

2. **No member snapshot table** — baselines come from the first `old_value` in `user_trust_evolution_log`. Members with no evolution history contribute no delta and are excluded.

3. **Community cooldown via log query** — no separate column. Query `MAX(applied_at)` from `community_evolution_log WHERE community_id = $1`. If < 30 days ago, skip.

4. **`karma_split_helper` and `trust_path_max_hops` follow prior direction** — no per-user versions of these params exist. The aggregate prior delta is the sole directional signal.

5. **Direction consensus gate for hops** — only shift `trust_path_max_hops` if last 3 entries in `community_evolution_log` for `cross_community_prior` agree on direction. If fewer than 3 entries, skip.

6. **Minimum 3 contributing members** — fewer than 3 active members with evolution log entries → skip the cycle.

7. **`communityEvolutionService.ts` must never throw** — wrap everything in try/catch. Evolution failure must not affect the user request flow.

8. **Bull job deduplication** — use `community_id` as the Bull job ID. Only one pending job per community at a time.

9. **`community_evolution_enabled` default was FALSE in Sprint 30** — migration must also update `init.sql` so fresh DB installs get the correct default.

---

## Sprint 31 Task Summary (12 tasks)

| Task | What | Key new files |
|------|------|---------------|
| 1 | Feature branch + DB migration | `20260320-community-evolution.sql`, `init.sql` |
| 2 | Unit tests (TDD — write first) | `tests/unit/reputation/communityEvolutionService.test.ts` |
| 3 | `communityEvolutionDb.ts` | `src/database/communityEvolutionDb.ts` |
| 4 | `communityEvolutionService.ts` | `src/services/communityEvolutionService.ts` |
| 5 | Wire user evolution → queue community check | `trustEvolutionService.ts` |
| 6 | Bull queue consumer | `subscriber.ts` |
| 7 | API routes (3 new endpoints) | `reputation.ts` |
| 8 | Frontend — community admin evolution section | `pages/communities/[id].tsx` |
| 9 | Frontend — personal trust page note | `pages/reputation/trust.tsx` |
| 10 | ADR-047 + landing page docs | `ADR-047-*.md`, landing JSONs, `nav.json` |
| 11 | CONTEXT.md + registry.json + TDD test | `CONTEXT.md`, `registry.json`, `tests/tdd/` |
| 12 | Final type check + verification | `npm test`, `npm run feedback:check` |

Full plan: `docs/superpowers/plans/2026-03-20-sprint-31-community-evolution.md`
Design spec: `docs/superpowers/specs/2026-03-20-sprint-31-community-evolution-design.md`

---

## ⚠️ Known Issues / Watch List (carry-forward)

- **Sprint 30 migration must be applied on demo before Sprint 31 deploys** — `20260319-trust-evolution.sql`
- **Provider trust scores still show 30** — formula-correct but no reviews yet. Will improve organically.
- **Network graph naturalness** — deferred to a future sprint. See `docs/IDEAS.md` [2026-03-18].
- **7 communities on demo** — simulation bug fixed 2026-03-18. New Portland communities growing organically.

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
- **community evolution — evolution defaults are now TRUE (opt-out)**: Sprint 31 migration flips both `user_trust_configs.evolution_enabled` and `community_configs.community_evolution_enabled` to DEFAULT TRUE. Existing rows are updated.
- **community evolution — no snapshot table**: Baselines derived from first `old_value` in `user_trust_evolution_log`. Members with no evolution entries contribute no delta.
- **community evolution — Bull queue key is community_id**: `karmyq-community-evolution` queue uses community_id as job ID for deduplication. One pending job per community.
- **community evolution — minimum 3 contributing members**: Fewer than 3 active members with evolution log entries → skip the cycle entirely.
- **community evolution — hop count needs 3 consecutive prior cycles**: `trust_path_max_hops` only shifts after 3 consecutive `community_evolution_log` entries for `cross_community_prior` agree on direction.
