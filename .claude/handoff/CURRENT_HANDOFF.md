# SPRINT 35 READY TO EXECUTE

## Handoff Document for New Conversation

**Date**: 2026-03-22
**Current Version**: v9.9.0 (Sprint 34 complete, merged to master, deployed)
**Status**: Sprint 35 fully planned. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch:
   ```bash
   git checkout -b feature/sprint-35-request-wizard
   ```
3. Open plan: `docs/superpowers/plans/2026-03-22-sprint-35-request-wizard.md`
4. Run: `/execute-plan` (uses `superpowers:subagent-driven-development`)

---

## Sprint 35 Goal

Replace the inline smart-text request form with a clean two-step type-first wizard (3 clicks: FAB → type → submit), add a speed-dial FAB with "Get Help" / "Get Service" actions, and surface "Get Service" on provider cards and profiles.

**No backend changes.**

---

## What Just Shipped — Sprint 34 (v9.8.0 → v9.9.0)

| Area | What changed | Key files |
|------|-------------|-----------|
| **Tab navigation** | 4-tab shell replaces 3-column layout | `dashboard.tsx`, `TabBar.tsx` |
| **BrowseFeed** | Single-column card feed of community requests | `BrowseFeed.tsx` |
| **CommitmentsTab** | "I'm Helping" + "I Asked For Help" two-section view | `CommitmentsTab.tsx` |
| **MyRequestsTab** | My requests + offer management | `MyRequestsTab.tsx` |
| **FilterChipRow** | Horizontal type/urgency chips | `FilterChipRow.tsx` |
| **Design system** | `.tab-bar`, `.bottom-nav`, `.fab`, `.status-badge`, `.filter-chip`, `.feed-card` | `globals.css` |
| **TDD tests** | 25 new tests across 3 test files | `tests/tdd/` |

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | 🔜 **This sprint** |
| **36** | Commitment depth + admin simplification | Future |

---

## Sprint 35 Scope Summary

### What changes
- **`RequestWizard`** — self-contained two-step modal. Step 1: type picker grid (2-col mobile, 3-col desktop). Step 2: DynamicForm + plain description textarea + urgency chips + community scope. Replaces the 500-line inline form block in dashboard.tsx.
- **`SpeedDialFab`** — replaces `.fab` button. Single button expands into "Get Help" + "Get Service" action stack. Tab-aware: browse/commitments = both; my-requests = Get Help only; profile = hidden.
- **Provider "Get Service" CTA** — `ProviderCard` gets "Get Service" button with `onGetService` callback. `providers/[id].tsx` gets a prominent "Get Service" button wired to `RequestWizard` with pre-fill props.
- **Aesthetics pass** — tab content transitions, semantic color audit, skeleton loaders, focus rings, spacing consistency.

### What does NOT change this sprint
- Backend APIs (none needed)
- Tab navigation structure (Sprint 34 work)
- Commitment depth or timeline (Sprint 36)

---

## ⚠️ Critical Implementation Notes

1. **Remove NLP logic entirely.** `EnhancedAutocomplete`, `ExtractedDataChips`, `parsedRequest`, `autocompleteSuggestions`, `handleDescriptionChange` (NLP version), `buildPayloadFromParsed` — all gone from dashboard. Wizard uses a plain `onChange` textarea.

2. **`availableTypes` is fetched, not hardcoded.** `RequestWizard` must call `requestService.getRequestTypes()` on mount. Do not hardcode the type list.

3. **`DynamicForm` is kept.** Call `fetchSchema(type)` immediately when user taps a type tile in step 1, so step 2 loads instantly. Do not wait until step 2 mounts.

4. **Urgency is now explicit.** User selects `normal | urgent | critical`. Map `normal → medium` when building the API payload (backend uses `medium`).

5. **`preferred_provider_id` in request payload.** When `preferredProviderId` prop is set, include it in `POST /requests` body. Backend already accepts this field.

6. **`ProviderCard` gets a callback, not navigation.** `onGetService?: (provider) => void` — listing page opens wizard modal, does NOT navigate.

7. **SpeedDialFab Z-index.** Actions: `z-40`. Backdrop: `z-39`. Wizard modal: `z-50`.

8. **When `preferredProviderServiceType` is set: skip to step 2.** Initialize `step` to `2` and `requestType` to the provider's service type. Still show step 1 if user wants to go back.

9. **No worktrees.** Work directly on `feature/sprint-35-request-wizard`.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Design spec | `docs/superpowers/specs/2026-03-22-sprint-35-request-wizard-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-03-22-sprint-35-request-wizard.md` |
| Sprint branch | `feature/sprint-35-request-wizard` |

---

## Carry-Forward Issues

- **Pre-existing test failures** (not Sprint 34 regressions): `preSelectProvider`, `trust-evolution-flow`, `rateCards`
- **Migration runner**: deploy.sh does NOT auto-run migrations. Apply manually post-deploy if schema changes.
- **GitHub security vulnerabilities**: 8 dependabot alerts remain on default branch.
- **Untracked file**: `docs/superpowers/specs/2026-03-18-sprint-29-rate-cards-design.md` — ignore unless relevant.

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
- **Admin page tab structure (v9.2.0+)**: 7 tabs — Overview, Members, Norms; Requests, Insights, Providers (`isAdminOrMod`); Settings (`isAdmin` only).
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
- **Sprint 34 patterns**:
  - Tab-based dashboard shell: `dashboard.tsx` renders `<BrowseFeed>`, `<CommitmentsTab>`, `<MyRequestsTab>` based on `activeTab` state
  - `TabBar` component: `tab-bar` (desktop horizontal) + `bottom-nav` (mobile sticky footer)
  - FAB: `fixed bottom-24 right-6` — above bottom-nav
  - Single responsive breakpoint: `md:` (768px)
  - Content max-width: `max-w-2xl mx-auto` (672px)
  - `EmptyState` props: `heading` + `body` (NOT `title`/`description`)
- **Sprint 35 patterns** (once implemented):
  - `RequestWizard`: two-step modal. Props: `preferredProviderId`, `preferredProviderName`, `preferredProviderServiceType`. When provider type set, initialize at step 2.
  - `SpeedDialFab`: tab-aware. browse/commitments = both actions; my-requests = get-help only; profile = hidden.
  - Urgency mapping: UI uses `normal/urgent/critical`; API uses `medium/urgent/critical` (normal → medium).
  - NLP/autocomplete removed: `EnhancedAutocomplete`, `ExtractedDataChips`, `parsedRequest` no longer in codebase.
  - `ProviderCard.onGetService`: callback pattern — listing page holds wizard state, card calls callback.
