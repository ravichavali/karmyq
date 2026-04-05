# Sprint 45: Trust Configuration Externalization — Design Spec

**Date**: 2026-04-04
**Status**: Approved
**Version**: v9.11.0 → v9.12.0
**Sprint Branch**: `feature/sprint-45-trust-config-externalization`

---

## Overview

The trust model questionnaire is the primary lever through which community founders shape their community's character. Six questions — covering membership openness, new-member warmth, relationship style, karma splits, decay rates, and request curation — map human-readable choices to precise numeric config fields. But the questions and their answer-to-config mappings are hardcoded in `apps/frontend/src/lib/trust-model.ts`. Adding a question, reordering options, or adjusting a config delta requires a developer PR and deployment.

Sprint 45 externalizes this logic. Questions and their config deltas move to two new DB tables (`community.trust_questions`, `community.trust_question_choices`), served by a new `GET /communities/trust-questions` API endpoint in community-service. The frontend questionnaire becomes data-driven: it fetches questions at render time and merges choice `config_delta` JSONB values at runtime. A new platform admin page at `/admin/trust-questions` allows adding, editing, and reordering questions without a deploy.

As a secondary deliverable, all seven feed weight signals are wired to the community admin UI. The three v2 signals (`feed_weight_requester_trust`, `feed_weight_prior_interaction`, `feed_weight_recency`) were added to the DB in Sprint 43 but have never appeared in the TypeScript types, the PUT /config endpoint, or the frontend. Sprint 45 closes that gap with a "Feed Signal Weights" section in the community admin panel.

### Core Principle: Configuration as Data

Community design belongs in the database, not in code. When configuration lives in code, every change to community defaults requires a developer. When it lives in the database, founders and platform admins can iterate without deployments — and the questionnaire becomes the first step toward a fully declarative community design language.

---

## Multi-Sprint Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| Sprint 43 | Feed Ranking v2 + Logging | ✅ Complete — added 3 v2 feed weight columns to DB, never exposed in UI |
| Sprint 44 | Tech Debt + Architecture Review | ✅ Complete — gap analysis produced; all CI/security green |
| **Sprint 45** | **Trust Configuration Externalization** | 🟡 This sprint |
| Sprint 46 | Log Aggregation + Admin Dashboard | ⬜ Future |
| Sprint 47 | Group Communities / Onboarding | ⬜ Future |

---

## New Concepts

**TrustQuestion** — A platform-wide question displayed during community creation (questionnaire step) and the "Revisit trust model" admin flow. Stored in `community.trust_questions`. Has an ordered list of choices.

**TrustQuestionChoice** — One selectable answer within a question. Stored in `community.trust_question_choices`. The `config_delta` JSONB field is a `Partial<CommunityConfig>` that gets merged into the running config output when the choice is selected.

**Data-driven `answersToConfig`** — The new implementation of the config-mapping function. Instead of hardcoded Maps per question, it iterates questions in `display_order` ASC and merges each selected choice's `config_delta`. The override behavior (Q6 applies last to override Q2's `request_approval_required`) is preserved by giving Q6 a higher `display_order`.

---

## Data Model

### New table: `community.trust_questions`

```sql
CREATE TABLE community.trust_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(60) NOT NULL UNIQUE,
  question_text TEXT NOT NULL,
  subtext       TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Seeded with six rows from the current `QUESTIONS` array. Slugs and display_orders:

| slug | display_order |
|------|--------------|
| `who_is_this_for` | 10 |
| `new_member_warmth` | 20 |
| `relationship_style` | 30 |
| `asking_for_help` | 40 |
| `generosity_memory` | 45 |
| `request_curation` | 50 |

Q6 (`request_curation`) gets `display_order = 50` — highest — so its `config_delta` is merged last and overrides Q2's `request_approval_required` setting. This matches the explicit comment in the current `answersToConfig`.

### New table: `community.trust_question_choices`

```sql
CREATE TABLE community.trust_question_choices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES community.trust_questions(id) ON DELETE CASCADE,
  value         VARCHAR(60) NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  config_delta  JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(question_id, value)
);
```

Seeded with 17 rows. Config delta values are copied verbatim from `trust-model.ts`'s answer maps:

| Question | value | config_delta |
|----------|-------|-------------|
| who_is_this_for | just_us | `{"visibility_mode":"members_only","join_approval_required":true,"member_cap":50,"outsider_response_allowed":false}` |
| who_is_this_for | neighborhood | `{"visibility_mode":"hybrid","join_approval_required":true,"member_cap":100,"outsider_response_allowed":false}` |
| who_is_this_for | anyone | `{"visibility_mode":"public","join_approval_required":false,"member_cap":150,"outsider_response_allowed":true}` |
| new_member_warmth | trust_takes_time | `{"new_member_karma_lockout_days":14,"request_approval_required":true,"min_interactions_for_trust":3,"joining_counts_as_interaction":false}` |
| new_member_warmth | cautious | `{"new_member_karma_lockout_days":7,"request_approval_required":false,"min_interactions_for_trust":2,"joining_counts_as_interaction":false}` |
| new_member_warmth | open_arms | `{"new_member_karma_lockout_days":0,"request_approval_required":false,"min_interactions_for_trust":1,"joining_counts_as_interaction":true}` |
| relationship_style | deep_bonds | `{"trust_depth_weight":0.8,"trust_breadth_weight":0.2}` |
| relationship_style | mix | `{"trust_depth_weight":0.6,"trust_breadth_weight":0.4}` |
| relationship_style | wide_web | `{"trust_depth_weight":0.3,"trust_breadth_weight":0.7}` |
| asking_for_help | givers_matter | `{"karma_split_helper":80,"karma_split_requestor":20}` |
| asking_for_help | balanced | `{"karma_split_helper":60,"karma_split_requestor":40}` |
| asking_for_help | asking_is_brave | `{"karma_split_helper":60,"karma_split_requestor":60}` |
| generosity_memory | forever | `{"karma_decay_half_life_days":365,"trust_decay_half_life_days":365}` |
| generosity_memory | seasonal | `{"karma_decay_half_life_days":90,"trust_decay_half_life_days":180}` |
| generosity_memory | present | `{"karma_decay_half_life_days":30,"trust_decay_half_life_days":60}` |
| request_curation | admin_review | `{"request_approval_required":true}` |
| request_curation | trust_freely | `{"request_approval_required":false}` |

### Modified: `community.community_configs` — no DB migration needed

Sprint 43's `20260403-feed-ranking-v2.sql` already added `feed_weight_requester_trust`, `feed_weight_prior_interaction`, and `feed_weight_recency` columns. Only TypeScript types, the PUT endpoint, and the admin UI need updating.

---

## API Endpoints

### New routes — Community Service

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/communities/trust-questions` | Optional auth | List active questions with choices (ordered by display_order) |
| POST | `/communities/trust-questions` | Admin | Create a question |
| PUT | `/communities/trust-questions/:id` | Admin | Update question text / subtext / order / active |
| DELETE | `/communities/trust-questions/:id` | Admin | Deactivate question (soft delete via `active = false`) |
| POST | `/communities/trust-questions/:id/choices` | Admin | Add a choice to a question |
| PUT | `/communities/trust-questions/:id/choices/:choiceId` | Admin | Update choice label / description / config_delta / order |
| DELETE | `/communities/trust-questions/:id/choices/:choiceId` | Admin | Remove a choice |

### Modified routes — Community Service

| Method | Path | Change |
|--------|------|--------|
| PUT | `/communities/:id/config` | Add `feed_weight_requester_trust`, `feed_weight_prior_interaction`, `feed_weight_recency` to UPDATE query params `$26/$27/$28` |

The GET `/communities/:id/config` already returns v2 weight values — no change needed there.

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/types/community-config.ts` | Add 7 `feed_weight_*` fields to `CommunityConfig` interface |
| `apps/frontend/src/lib/trust-model.ts` | Remove `QUESTIONS` const and typed `QuestionnaireAnswers` / answer types. Keep `diffConfigs`, `formatConfigValue`, `FIELD_LABELS`. Add `TrustQuestionnaireAnswers = Record<string, string>` type. |
| `apps/frontend/src/lib/answersToConfig.ts` | New file — data-driven `answersToConfig(questions, answers)` merging config_deltas in display_order |
| `apps/frontend/src/hooks/useTrustQuestions.ts` | New hook — `GET /communities/trust-questions`, returns `{questions, loading, error}` |
| `apps/frontend/src/lib/api.ts` | Add `trustQuestionsService` with `list()` and admin CRUD methods |
| `apps/frontend/src/components/CommunityTrustQuestionnaire.tsx` | Replace `QUESTIONS` import with `useTrustQuestions()` hook; show skeleton during load |
| `apps/frontend/src/components/TrustModelDiff.tsx` | Adapt to `TrustQuestionnaireAnswers = Record<string, string>` |
| `apps/frontend/src/pages/communities/new.tsx` | Update questionnaire answers state to `TrustQuestionnaireAnswers` |
| `apps/frontend/src/pages/admin/trust-questions/index.tsx` | New page — list, add, edit, reorder, toggle questions and choices. Uses `requireAdmin` gate. |
| `apps/frontend/src/pages/communities/[id].tsx` | Add "Feed Signal Weights" section with 7 sliders in the community admin tab |
| `services/community-service/src/services/config-validator.ts` | Add v2 feed weight fields to `CommunityConfig` interface and validation rules |

---

## User Guide & Doc Updates

Every sprint ships doc updates. Required this sprint:

1. **Update User Guide: Community Creation** (`apps/landing/src/data/docs/guides/community-creation.json`) — document that questionnaire questions are now managed by platform admins; note that answers map to config fields.
2. **Update User Guide: Admin Configuration** (`apps/landing/src/data/docs/guides/admin-configuration.json`) — add "Feed Signal Weights" section explaining each signal and when to tune it.
3. **New Concept page: Trust Questions** (`apps/landing/src/data/docs/concepts/trust-questions.json`) — explain the question-to-config-delta model, how questions are ordered, and the override mechanic (Q6 last).
4. **Update service doc: community-service** (`apps/landing/src/data/docs/services/community-service.json`) — add new trust-questions endpoints.
5. **nav.json** — add Trust Questions concept page entry.

---

## Critical Implementation Notes

1. **Q6 merge order preserves the Q2 override.** Current `answersToConfig` comment says "Q6 intentionally applied last — overrides Q2's `request_approval_required`." In the DB seed, give `request_curation` (Q6) `display_order = 50` and all other questions display_orders 10–45. The data-driven function iterates in `display_order ASC` — this matches the existing override behavior without special-casing.

2. **`QuestionnaireAnswers` type change cascades to 3+ files.** `{q1: Q1Answer, q2: Q2Answer, ...}` → `Record<string, string>` (question UUID → choice value). Update: `CommunityTrustQuestionnaire.tsx`, `TrustModelDiff.tsx`, `new.tsx`. The exported type alias changes from `QuestionnaireAnswers` to `TrustQuestionnaireAnswers`. Check `apps/frontend/src/` broadly for any other imports of the old type.

3. **Do not delete `trust-model.ts`.** Three utilities still live there: `diffConfigs`, `formatConfigValue`, `FIELD_LABELS`. The file becomes a pure utility module — the `QUESTIONS` array and per-answer types (`Q1Answer`, etc.) move out; the new `TrustQuestionnaireAnswers` type moves in.

4. **`init.sql` is stale — fix when adding new tables.** The `feed_weights_sum` CHECK constraint (line ~1108) was dropped in Sprint 43's migration but `init.sql` still has it. When adding the two new trust_questions tables to `init.sql`, also: (a) remove the `feed_weights_sum` constraint from the `community_configs` table definition, and (b) add the three v2 feed weight columns (`feed_weight_requester_trust`, `feed_weight_prior_interaction`, `feed_weight_recency`) to the `community_configs` table definition.

5. **PUT /config positional params.** The current UPDATE query uses `$1–$25` with `$22` = `communityId`. To add three new v2 feed weight fields: add them to the SET clause as `$26`, `$27`, `$28`, and move `community_id = $22` accordingly (or append at end as `$29`). Do not break the existing 25-param binding order.

6. **`config-validator.ts` (community-service) must accept v2 fields.** The service-side `CommunityConfig` interface has the 4 original feed weights but NOT the 3 v2 fields. Add them so `mergeAndValidateConfig` doesn't strip them from incoming PUT /config bodies.

7. **Questionnaire loading state in the wizard.** `CommunityTrustQuestionnaire` currently renders synchronously from the const. After the change, it waits for the API. Show a loading skeleton (3 placeholder choice cards) so the community creation wizard step doesn't flash empty. The wizard's `questionnaire` step already exists in `new.tsx` — it must tolerate async loading before the user can proceed.

8. **Admin trust questions page uses `requireAdmin` (community admin role).** This matches the existing `/admin/schemas` auth gate pattern (`requireAdmin` from `utils/admin-auth.ts`). Platform-wide vs. community-scoped admin distinction is deferred to a future sprint.
