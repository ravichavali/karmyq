# SPRINT 45 — Trust Configuration Externalization

## Handoff Document

**Date**: 2026-04-04
**Current Version**: v9.11.0 → v9.12.0 (next)
**Status**: Sprint 45 spec + plan written. Ready to execute.

---

## Quick Start

1. Read this handoff
2. Check out branch: `git checkout -b feature/sprint-45-trust-config-externalization`
3. Open plan: `docs/superpowers/plans/2026-04-04-sprint-45-trust-config-externalization.md`
4. Run: `/execute-plan` (uses superpowers:subagent-driven-development)

---

## Sprint Goal

Move the trust model questionnaire from hardcoded frontend code to a DB-backed, admin-editable system — two new DB tables, a CRUD API in community-service, a data-driven `answersToConfig`, and an admin management UI. Secondary: wire all 7 feed weight signals (already in DB, never exposed in UI or TypeScript types) to the community admin panel.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 43 | Feed Ranking v2 + Logging | ✅ Complete |
| Sprint 44 | Tech Debt + Architecture Review | ✅ Complete |
| **Sprint 45** | **Trust Configuration Externalization** | 🟡 Ready to execute |
| Sprint 46 | Log Aggregation + Admin Dashboard | ⬜ Future |
| Sprint 47 | Group Communities / Onboarding | ⬜ Future |

---

## Spec + Plan

| Artifact | Path |
|----------|------|
| Design spec | `docs/superpowers/specs/2026-04-04-sprint-45-trust-config-externalization-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-04-04-sprint-45-trust-config-externalization.md` |

---

## What This Sprint Builds

### Primary — Trust Questionnaire Externalization (Gap #1)

**Current state:** `QUESTIONS` array + `answersToConfig` hardcoded in `apps/frontend/src/lib/trust-model.ts`. Adding a question requires a code change + deploy.

**After Sprint 45:**
- Two new DB tables: `community.trust_questions`, `community.trust_question_choices`
- Each choice stores a `config_delta` JSONB (Partial<CommunityConfig>) — merged in `display_order` order to produce the final config
- New `GET /communities/trust-questions` endpoint in community-service
- Frontend questionnaire (`CommunityTrustQuestionnaire.tsx`) fetches questions via `useTrustQuestions` hook
- New `answersToConfig(questions, answers)` function replaces the hardcoded Maps
- Admin page at `/admin/trust-questions` to add/edit/reorder questions without a deploy

### Secondary — Feed Weight Admin UI (Gap #2)

**Current state:** 7 feed weight columns exist in DB (4 original + 3 added in Sprint 43), but `CommunityConfig` TypeScript type has zero `feed_weight_*` fields, PUT /config doesn't save the 3 v2 fields, and the admin UI has no sliders.

**After Sprint 45:**
- All 7 `feed_weight_*` fields added to `CommunityConfig` type
- PUT /config updated to accept + save v2 weight fields
- "Feed Signal Weights" section with 7 sliders in the community admin tab

---

## ⚠️ Critical Implementation Notes (copy to every session)

1. **Q6 merge order preserves the Q2 override.** Give `request_curation` (Q6) `display_order = 50` in the DB seed; Q1-Q5 get 10–45. Data-driven `answersToConfig` iterates questions in `display_order ASC` — Q6 merges last and overrides Q2's `request_approval_required`. No special-casing needed.

2. **`QuestionnaireAnswers` type change cascades.** `{q1: Q1Answer, ...}` → `TrustQuestionnaireAnswers = Record<string, string>` (question UUID → choice value). Update: `CommunityTrustQuestionnaire.tsx`, `TrustModelDiff.tsx`, `new.tsx`. Search: `grep -r "QuestionnaireAnswers\|Q1Answer" apps/frontend/src`.

3. **Do not delete `trust-model.ts`.** Keep `diffConfigs`, `formatConfigValue`, `FIELD_LABELS`. Remove: `QUESTIONS` const, per-answer union types (`Q1Answer` etc.), `answersToConfig`. Add: `TrustQuestionnaireAnswers = Record<string, string>`.

4. **`init.sql` is stale — must fix when adding new tables.** Remove `feed_weights_sum` CHECK constraint (~line 1108 of `init.sql`). Add `feed_weight_requester_trust`, `feed_weight_prior_interaction`, `feed_weight_recency` to `community_configs` table definition in `init.sql`.

5. **PUT /config positional params.** Current UPDATE uses `$1–$25` with `communityId = $22`. Add v2 feed weights as `$26`, `$27`, `$28`; move `communityId` to `$29`.

6. **`config-validator.ts` must accept v2 fields.** Service-side interface has 4 original feed weights, not the 3 v2 ones — add them or `mergeAndValidateConfig` strips them.

7. **Questionnaire loading state.** After switching to async hook, show a loading skeleton (3 placeholder choice cards with `animate-pulse`) so the community creation wizard doesn't flash empty during load.

8. **No DB migration needed for feed weights.** Sprint 43's `20260403-feed-ranking-v2.sql` already added the 3 v2 columns. Only TypeScript types, the PUT endpoint, config-validator, and admin UI need updating.

9. **Migration must be run manually on demo server after deploy.** The `deploy.sh` script does not auto-run migrations. After `git push` triggers the GitHub Actions deploy, SSH to `karmyq.com` and run: `psql $DATABASE_URL -f infrastructure/postgres/migrations/20260404-trust-questions.sql`

---

## Key Files for Sprint 45

| File | Role |
|------|------|
| `apps/frontend/src/lib/trust-model.ts` | Hardcoded questionnaire — primary target for refactor |
| `apps/frontend/src/components/CommunityTrustQuestionnaire.tsx` | Questionnaire UI — switch to hook |
| `apps/frontend/src/types/community-config.ts` | Add 7 feed_weight_* fields |
| `services/community-service/src/routes/config.ts` | PUT /config — add v2 weight fields |
| `services/community-service/src/services/config-validator.ts` | Add v2 weight fields to interface |
| `services/community-service/src/index.ts` | Register trust-questions router BEFORE config router |
| `infrastructure/postgres/init.sql` | Fix stale feed_weights_sum constraint; add new tables |
| `apps/frontend/src/pages/admin/trust-questions/index.tsx` | New admin page (create this file) |
| `apps/frontend/src/pages/communities/[id].tsx` | Add feed weight sliders to admin tab |

---

## Deferred to Future Sprints

- **"Confirmed match → CommitmentsTab only"** (IDEAS.md [2026-04-02]) — once a match is accepted, remove from browse feed; both sides see it in CommitmentsTab. Discuss scope when ready.
- **Schema visual builder / live form preview** (Gap #3) — drag-and-drop field builder for `/admin/schemas/[id]/edit`. Sprint 46+.
- **Log Aggregation** (Gap #5) — Loki/Grafana or Axiom wiring. Sprint 46 target.

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

### Feed Weights Sum Constraint
The `feed_weights_sum` CHECK constraint was dropped in Sprint 43 (migration `20260403-feed-ranking-v2.sql`). Any new weight columns must NOT recreate it. Note: `init.sql` still has the constraint — fix it in Task 1.

### npm Lockfile (Node 24 / npm 10)
npm 10 requires `resolved` + `integrity` fields on all lockfile entries.

### Security Scan Baseline
- GitHub code scanning: 0 open alerts
- npm audit: 3 high vulns remaining (node-forge, picomatch, tar) — all in expo@54, unfixable until Expo SDK upgrade
- CI blocks on `--audit-level=critical` only

### Solo Dev Workflow
Work directly on `feature/sprint-45-trust-config-externalization` — no worktrees.

### Community Service Route Order
Register `trustQuestionsRouter` at `/communities/trust-questions` BEFORE `configRouter` in `index.ts` — the config router's `/:id` param would otherwise swallow `/trust-questions` as a community ID.
