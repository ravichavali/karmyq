# SPRINT 45 — UI Redesign / Expert Configuration Surfaces

## Handoff Document

**Date**: 2026-04-04
**Current Version**: v9.11.0 → v9.12.0 (next)
**Status**: Sprint 44 complete and deployed (CI green after lockfile fix). Sprint 45 direction established. Ready to plan.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to produce the Sprint 45 spec + plan
3. OR: if a plan already exists in `docs/superpowers/plans/`, run `/execute-plan`

---

## What We Just Completed (Sprint 44)

Sprint 44 was a tech debt + architecture review sprint. All three workstreams shipped:

### Workstream 1 — Security & Code Quality
- `npm audit fix` + `npm audit fix --force` — resolved all auto-fixable vulnerabilities
- `next.js` upgraded to latest in `apps/frontend` and `apps/landing`
- Node.js bumped **20→24** in all GitHub Actions workflows (`ci.yml`, `test.yml`, `e2e-tests.yml`)
- TypeScript/ESLint warnings eliminated in `cleanup-service` (any→typed interfaces, `unknown` catch narrowing)
- Mobile lint: installed missing `eslint-plugin-react-hooks`, exit code now 0 (was exit 2)
- **Post-sprint lockfile fix**: `react-native-screens@4.6.0` properly resolved in lockfile — the broken workspace-local `4.4.0` entry (no resolved/integrity) was replaced with a hoisted root entry with full registry metadata. Root cause: npm 10 (Node 24) strictly validates lockfile completeness; the old entry had no `resolved`/`integrity` fields.

### Workstream 2 — Observability & Logging
- `createLogger` + `requestLoggingMiddleware` added to **social-graph-service** and **cleanup-service** `index.ts`
- All **169 `console.error` calls** in route handlers across 8 services replaced with `req.logger?.error()` structured logging
- Global `ErrorBoundary` added to `apps/frontend/src/pages/_app.tsx`
- 122 frontend API catch blocks converted to structured `{ error: err.message }` objects
- 7-test smoke suite: `tests/tdd/sprint-44-logging.test.ts`

### Workstream 3 — Architecture Review
- **`docs/architecture/expert-contribution-gaps.md`** — five-area gap analysis document (new file)
- **`apps/landing/src/data/docs/concepts/observability-logging.json`** — new concept page
- `services/social-graph-service/CONTEXT.md` and `services/cleanup-service/CONTEXT.md` updated

### Deferred (documented in gap analysis)
- `picomatch`, `node-forge`, `tar` vulnerabilities locked inside `expo@54` — requires Expo SDK upgrade
- These are dev-toolchain only (not in app bundle), runtime risk is low

---

## Sprint 44 Final State

- **Branch**: `master`
- **Latest commit**: `ecde40b feat: Sprint 44 — Tech Debt + Architecture Review (v9.11.0)`
- **CI/CD**: Push sent — GitHub Actions pipeline running
- **Demo server**: Will auto-deploy on CI pass

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 42 | Dibs / First Refusal | ✅ Complete, deployed |
| Sprint 43 | Feed Ranking v2 + Logging | ✅ Complete, deployed |
| Sprint 44 | Tech Debt + Architecture Review | ✅ Complete, deployed |
| Sprint 45 | UI Redesign / Expert Config Surfaces | 🟡 Next |
| Sprint 46 | Log Aggregation + Admin Dashboard | ⬜ Future |
| Sprint 47 | Group Communities / Onboarding | ⬜ Future |

---

## Sprint 45 Direction

Based on the `docs/architecture/expert-contribution-gaps.md` review, two areas are **High priority**:

### Top Candidates for Sprint 45

**1. Request Type Schema Visual Builder (Gap #3 — High)**
- Current state: JSON editor at `/admin/schemas/[id]/edit` — developer tool only
- Gap: No visual field-builder, no form preview, no community-scoped schemas
- First step: Add live form preview alongside the JSON editor

**2. Trust Model Questionnaire Externalization (Gap #1 — High)**
- Current state: `QUESTIONS` array hardcoded in `apps/frontend/src/lib/trust-model.ts`
- Gap: Adding questions or changing mappings requires a code change
- First step: Move questions to a DB table or server-side config endpoint

**3. Feed Weight Full Exposure (Gap #2 — Medium)**
- Current state: 4 of 7 feed signals are tunable; 3 v2 signals (social_karma, recency, prior_interaction) are hardcoded
- Gap: Admins can't tune v2 signals
- First step: Add 3 new columns to `community_configs`, remove sum-to-1 constraint, add sliders

### UI Redesign Context
Sprint 45 was also described as "UI Redesign / Pruning" in the arc. The gap analysis feeds
directly into what expert configuration surfaces need to be redesigned. Start sprint planning
by reviewing the gap analysis + current UX state before locking scope.

---

## Key Files for Sprint 45

| File | Role |
|------|------|
| `docs/architecture/expert-contribution-gaps.md` | Gap analysis — read first for Sprint 45 context |
| `apps/frontend/src/lib/trust-model.ts` | Hardcoded questionnaire (Gap #1 target) |
| `apps/frontend/src/components/CommunityTrustQuestionnaire.tsx` | Questionnaire UI |
| `apps/frontend/src/pages/admin/schemas/[id]/edit.tsx` | JSON schema editor (Gap #3 target) |
| `services/community-service/src/routes/config.ts` | Config update endpoint |
| `infrastructure/postgres/init.sql` | community_configs table schema |
| `infrastructure/postgres/migrations/` | Where new migrations go |

---

## Persistent Context

### JWT Field
JWT payload uses `communities` (NOT `communityMemberships`) for the membership array.
Auth middleware: `const memberships = user.communities ?? []`

### Nginx Config
`infrastructure/nginx/nginx.conf` is source of truth — deploy.sh copies + reloads on each deploy.

### Module Resolution
`@karmyq/shared` subpaths require `moduleResolution: "node16"` and `module: "node16"`.

### Structured Logging Pattern (established Sprint 44)
Route handlers: `(req as any).logger?.error('message', error instanceof Error ? error : new Error(String(error)), { service: 'service-name', endpoint: 'METHOD /path' })`
Module-level (cron/events): `logger.error('message', error instanceof Error ? error : undefined, { service, step })`

### Error Observability (ongoing practice)
Every route handler catch block must produce structured logs. Sprint 44 propagated this to all 8 services.

### Solo Dev Workflow
Work directly on `feature/sprint-45-*` — no worktrees.

### Feed Weights Sum Constraint
The `feed_weights_sum` CHECK constraint in `community_configs` was dropped in Sprint 43 (migration `9189e4d`). Any new weight columns should NOT recreate it — use normalization in application code instead.
