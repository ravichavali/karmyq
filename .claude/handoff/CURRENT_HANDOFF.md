# SPRINT 36 READY TO PLAN

## Handoff Document for New Conversation

**Date**: 2026-03-22
**Current Version**: v9.10.0 (Sprint 35 complete, merged to master, deployed to demo)
**Status**: Sprint 35 shipped. Ready to plan Sprint 36.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to plan Sprint 36

---

## What Just Shipped — Sprint 35 (v9.9.0 → v9.10.0)

| Area | What changed | Key files |
|------|-------------|-----------|
| **RequestWizard** | Two-step modal: type picker grid → description + urgency + scope. Replaces 500-line NLP inline form | `RequestWizard.tsx` (new) |
| **SpeedDialFab** | Expandable FAB with Get Help / Get Service actions. Tab-aware visibility | `SpeedDialFab.tsx` (new) |
| **ProviderCard** | "Get Service" button with `onGetService` callback; exported `ProviderCardData` interface | `ProviderCard.tsx` |
| **providers/index.tsx** | onGetService wires into RequestWizard modal | `providers/index.tsx` |
| **providers/[id].tsx** | "Get Service" button pre-fills wizard with provider + service type, skips to step 2 | `providers/[id].tsx` |
| **dashboard.tsx** | NLP/autocomplete removed; wired to SpeedDialFab + RequestWizard | `dashboard.tsx` |
| **Aesthetics** | Semantic colors in BrowseFeed, skeleton loader in CommitmentsTab | `BrowseFeed.tsx`, `CommitmentsTab.tsx` |
| **CSS** | `.speed-dial`, `.speed-dial-action`, `.wizard-step`, `.type-card`, `.urgency-option` | `globals.css` |
| **TDD tests** | 17 tests: mapUrgencyToApi, isFormValid, getVisibleActions, buildWizardPayload | `tests/tdd/request-wizard.test.ts` |
| **Skills** | deploy + sprint-planning updated: auto-deploy at end of every sprint; `no-deploy` tag to opt out | `.claude/skills/` |
| **Docs** | making-requests guide (wizard flow + Hiring a Provider), getting-started, UX design principles | `docs/`, `apps/landing/` |

**Key decisions made this sprint:**
- `animate-in` (tailwindcss-animate) is NOT installed — removed from globals.css and dashboard.tsx
- Landing docs are gitignored but tracked — use `git add -f` to stage them
- Stale `karmyq-cadvisor` container on demo caused CI/CD failure — removed manually, redeployed

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin simplification | 🔜 **Next sprint** |

---

## Sprint 36 Preview (from original arc plan)

**Commitment depth + admin simplification**

The original arc notes for Sprint 36:
- **Commitment depth**: Timeline view of a commitment, inline messaging within a commitment, clear status transitions (proposed → matched → completed)
- **Admin simplification**: Simplify the admin panel — reduce cognitive load, cleaner tab structure

This is a starting point for sprint planning discussion, not a locked scope.

---

## Carry-Forward Issues

- **Pre-existing test failures** (not Sprint 35 regressions): `preSelectProvider`, `trust-evolution-flow`, `rateCards`
- **Migration runner**: deploy.sh does NOT auto-run migrations. Apply manually post-deploy if schema changes.
- **GitHub security vulnerabilities**: 8 dependabot alerts remain on default branch.
- **Untracked file**: `docs/superpowers/specs/2026-03-18-sprint-29-rate-cards-design.md` — ignore unless relevant.
- **Stale container pattern**: Demo server occasionally has stale Docker containers (e.g. cadvisor) that block `docker-compose up`. Fix: SSH and `docker rm -f <container-name>`, then redeploy.

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
- **tailwindcss-animate NOT installed**: `animate-in` class is unavailable. Do not use it in CSS or JSX.
- **Sprint 35 patterns**:
  - `RequestWizard`: two-step modal. Props: `preferredProviderId`, `preferredProviderName`, `preferredProviderServiceType`. When provider type set, initialize at step 2.
  - `SpeedDialFab`: tab-aware. browse/commitments = both actions; my-requests = get-help only; profile = hidden.
  - Urgency mapping: UI uses `normal/urgent/critical`; API uses `medium/urgent/critical` (normal → medium).
  - NLP/autocomplete removed: `EnhancedAutocomplete`, `ExtractedDataChips`, `parsedRequest` no longer in codebase.
  - `ProviderCard.onGetService`: callback pattern — listing page holds wizard state, card calls callback.
  - Module-level `schemaCache` in `RequestWizard.tsx` avoids redundant schema fetches.
