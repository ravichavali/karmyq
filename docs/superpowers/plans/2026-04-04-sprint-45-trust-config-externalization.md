# Trust Configuration Externalization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the trust model questionnaire from hardcoded frontend code to a DB-backed, admin-editable system; wire all 7 feed weight signals to the admin UI.

**Architecture:** Two new tables (`community.trust_questions`, `community.trust_question_choices`) serve a CRUD API in community-service; the frontend questionnaire becomes data-driven via a `useTrustQuestions` hook. Feed weights already exist in the DB from Sprint 43 — this sprint closes the type/API/UI gap.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260404-trust-questions.sql` | Create `trust_questions` + `trust_question_choices` tables; seed 6 questions + 17 choices |
| `services/community-service/src/routes/trust-questions.ts` | GET (public) + POST/PUT/DELETE admin CRUD for questions and choices |
| `apps/frontend/src/lib/answersToConfig.ts` | Data-driven `answersToConfig(questions, answers)` — merges config_deltas in display_order |
| `apps/frontend/src/hooks/useTrustQuestions.ts` | Fetch hook — GET /communities/trust-questions → `{questions, loading, error}` |
| `apps/frontend/src/pages/admin/trust-questions/index.tsx` | Admin page — list, add, edit, reorder, toggle active questions and choices |
| `tests/tdd/trust-questions-api.test.ts` | TDD integration test — GET trust-questions returns seeded data in order |
| `tests/unit/frontend/answersToConfig.test.ts` | Unit tests for data-driven `answersToConfig` — merges deltas, Q6 override preserved |

### Existing files to modify

| File | Change |
|------|--------|
| `infrastructure/postgres/init.sql` | Remove stale `feed_weights_sum` constraint; add 3 v2 feed weight columns to `community_configs`; add two new trust_questions table definitions |
| `services/community-service/src/index.ts` | Register `trustQuestionsRouter` at `/communities/trust-questions` before the generic config router |
| `services/community-service/src/routes/config.ts` | Add 3 v2 feed weight fields to PUT /config UPDATE query (`$26`, `$27`, `$28`) |
| `services/community-service/src/services/config-validator.ts` | Add v2 feed weight fields to `CommunityConfig` interface and validation |
| `services/community-service/CONTEXT.md` | Document new trust-questions endpoints |
| `services/registry.json` | Add trust-questions endpoints to community-service apis.provides |
| `apps/frontend/src/types/community-config.ts` | Add 7 `feed_weight_*` fields to `CommunityConfig` |
| `apps/frontend/src/lib/trust-model.ts` | Remove `QUESTIONS` const + answer union types; add `TrustQuestionnaireAnswers`; keep `diffConfigs`, `formatConfigValue`, `FIELD_LABELS` |
| `apps/frontend/src/lib/api.ts` | Add `trustQuestionsService.list()` + admin CRUD methods |
| `apps/frontend/src/components/CommunityTrustQuestionnaire.tsx` | Replace `QUESTIONS` import with `useTrustQuestions()` hook; add loading skeleton |
| `apps/frontend/src/components/TrustModelDiff.tsx` | Update type from `QuestionnaireAnswers` → `TrustQuestionnaireAnswers` |
| `apps/frontend/src/pages/communities/new.tsx` | Update questionnaire answers state type |
| `apps/frontend/src/pages/communities/[id].tsx` | Add "Feed Signal Weights" section (7 sliders) in admin tab |
| `apps/landing/src/data/docs/guides/community-creation.json` | Note questionnaire questions are platform-managed |
| `apps/landing/src/data/docs/guides/admin-configuration.json` | Add Feed Signal Weights section |
| `apps/landing/src/data/docs/concepts/trust-questions.json` | New concept page |
| `apps/landing/src/data/docs/services/community-service.json` | Add trust-questions endpoints |
| `apps/landing/src/data/nav.json` | Add Trust Questions concept nav entry |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Q6 merge order preserves the Q2 override.** Give `request_curation` (Q6) `display_order = 50` in the seed; all other questions get 10–45. Data-driven `answersToConfig` iterates `display_order ASC` — Q6 merges last, overriding Q2's `request_approval_required`. No special-casing needed.

2. **`QuestionnaireAnswers` type change cascades to 3+ files.** `{q1: Q1Answer, ...}` → `Record<string, string>` (question UUID → choice value). Update: `CommunityTrustQuestionnaire.tsx`, `TrustModelDiff.tsx`, `new.tsx`. Search broadly: `grep -r "QuestionnaireAnswers" apps/frontend/src`.

3. **Do not delete `trust-model.ts`.** `diffConfigs`, `formatConfigValue`, `FIELD_LABELS` stay there. The file becomes a pure utility module — remove `QUESTIONS` array + per-answer union types; add `TrustQuestionnaireAnswers = Record<string, string>`.

4. **`init.sql` is stale — fix it.** Remove `feed_weights_sum` CHECK constraint (~line 1108). Add `feed_weight_requester_trust`, `feed_weight_prior_interaction`, `feed_weight_recency` to `community_configs` table definition. Add the two new trust tables.

5. **PUT /config positional params.** Current UPDATE uses `$1–$25` with `communityId = $22`. Add v2 feed weights as `$26`, `$27`, `$28` in the SET clause; update `communityId` to `$29` in the WHERE clause to avoid collision.

6. **`config-validator.ts` must accept v2 fields.** Service-side `CommunityConfig` interface has 4 original feed weights but NOT the 3 v2 fields — add them or `mergeAndValidateConfig` strips them from PUT /config request bodies.

7. **Questionnaire loading state.** After switching to async hook, show a 3-card skeleton while questions load. The community creation wizard step must not allow the user to proceed past the questionnaire step during loading.

8. **Admin trust questions page uses `requireAdmin` gate.** Match the `/admin/schemas` pattern: `requireAdmin(router)` in `useEffect` on mount.

---

## Task 1: Feature branch + DB migration

**Files:**
- Create: `infrastructure/postgres/migrations/20260404-trust-questions.sql`
- Modify: `infrastructure/postgres/init.sql`

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-45-trust-config-externalization
```

- [ ] **Write migration** — create tables, seed questions and choices

```sql
-- infrastructure/postgres/migrations/20260404-trust-questions.sql
BEGIN;

-- 1. Create trust_questions table
CREATE TABLE IF NOT EXISTS community.trust_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(60) NOT NULL UNIQUE,
  question_text TEXT NOT NULL,
  subtext       TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create trust_question_choices table
CREATE TABLE IF NOT EXISTS community.trust_question_choices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES community.trust_questions(id) ON DELETE CASCADE,
  value         VARCHAR(60) NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  config_delta  JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(question_id, value)
);

-- 3. Seed questions (preserve existing order; request_curation last for Q6 override)
INSERT INTO community.trust_questions (slug, question_text, subtext, display_order) VALUES
  ('who_is_this_for',    'Who is this community for?',                    'This shapes who can find you, join, and participate.',                                             10),
  ('new_member_warmth',  'How do you feel about new members?',            'This controls how quickly newcomers can earn karma and post requests.',                            20),
  ('relationship_style', 'What kind of relationships do you want to build?', 'This shapes how the trust system weights repeated partners vs. new connections.',              30),
  ('asking_for_help',    'How do you feel about asking for help?',        'This sets how karma is split between helpers and those who ask.',                                  40),
  ('generosity_memory',  'How long should acts of generosity be remembered?', 'This controls how quickly karma and trust scores fade without activity.',                     45),
  ('request_curation',   'How do you want to curate what gets asked for?', 'This controls whether requests are visible immediately or reviewed first.',                      50)
ON CONFLICT (slug) DO NOTHING;

-- 4. Seed choices
WITH q AS (SELECT id, slug FROM community.trust_questions)
INSERT INTO community.trust_question_choices (question_id, value, label, description, config_delta, display_order)
SELECT
  q.id,
  c.value,
  c.label,
  c.description,
  c.config_delta::jsonb,
  c.display_order
FROM q
JOIN (VALUES
  -- who_is_this_for
  ('who_is_this_for',    'just_us',       'Just us — a curated circle',             'Private, invite-only. Small and intentional. Members are hand-picked.',                      '{"visibility_mode":"members_only","join_approval_required":true,"member_cap":50,"outsider_response_allowed":false}',      10),
  ('who_is_this_for',    'neighborhood',  'Our neighborhood or local group',         'Semi-open. Anyone nearby can find us, but joining needs approval.',                           '{"visibility_mode":"hybrid","join_approval_required":true,"member_cap":100,"outsider_response_allowed":false}',           20),
  ('who_is_this_for',    'anyone',        'Anyone who finds us',                     'Open doors. Public, welcoming, and easy to join.',                                            '{"visibility_mode":"public","join_approval_required":false,"member_cap":150,"outsider_response_allowed":true}',           30),
  -- new_member_warmth
  ('new_member_warmth',  'trust_takes_time', 'Trust takes time — go slow',          'New members observe before participating. Karma and requests are gated for two weeks.',       '{"new_member_karma_lockout_days":14,"request_approval_required":true,"min_interactions_for_trust":3,"joining_counts_as_interaction":false}', 10),
  ('new_member_warmth',  'cautious',      'Cautious but welcoming',                  'A short waiting period, then full access. Requests are open, karma comes after a week.',      '{"new_member_karma_lockout_days":7,"request_approval_required":false,"min_interactions_for_trust":2,"joining_counts_as_interaction":false}',  20),
  ('new_member_warmth',  'open_arms',     'Open arms — jump right in',               'New members can post and earn immediately. Joining itself counts as your first act.',          '{"new_member_karma_lockout_days":0,"request_approval_required":false,"min_interactions_for_trust":1,"joining_counts_as_interaction":true}',   30),
  -- relationship_style
  ('relationship_style', 'deep_bonds',    'Deep bonds with the same people',         'Trust grows through repeated exchanges. The system favors familiar partners.',                 '{"trust_depth_weight":0.8,"trust_breadth_weight":0.2}',  10),
  ('relationship_style', 'mix',           'A mix of close and new',                  'Balance between depth and breadth. Relationships deepen, but new connections are valued too.', '{"trust_depth_weight":0.6,"trust_breadth_weight":0.4}',  20),
  ('relationship_style', 'wide_web',      'A wide web of connections',               'Trust spreads broadly. The system values meeting new people across the network.',              '{"trust_depth_weight":0.3,"trust_breadth_weight":0.7}',  30),
  -- asking_for_help
  ('asking_for_help',    'givers_matter', 'Givers matter more — asking has a cost',  'Helpers earn most of the karma. Asking is meaningful but carries weight.',                    '{"karma_split_helper":80,"karma_split_requestor":20}',   10),
  ('asking_for_help',    'balanced',      'Giving and asking are equally valued',     'Karma is shared fairly. Both roles are honored in the community.',                            '{"karma_split_helper":60,"karma_split_requestor":40}',   20),
  ('asking_for_help',    'asking_is_brave', 'Asking is brave — we celebrate vulnerability', 'Both helpers and requestors earn generously. Reaching out is an act of trust.',       '{"karma_split_helper":60,"karma_split_requestor":60}',   30),
  -- generosity_memory
  ('generosity_memory',  'forever',       'They echo forever — contributions compound', 'Karma and trust decay very slowly. Long-term members benefit from their history.',         '{"karma_decay_half_life_days":365,"trust_decay_half_life_days":365}', 10),
  ('generosity_memory',  'seasonal',      'For a season — recent months matter most', 'Contributions fade over a few months. Staying active keeps your standing.',                  '{"karma_decay_half_life_days":90,"trust_decay_half_life_days":180}',  20),
  ('generosity_memory',  'present',       'We live in the present — freshness wins',  'Karma and trust refresh quickly. What you did last month matters more than last year.',       '{"karma_decay_half_life_days":30,"trust_decay_half_life_days":60}',   30),
  -- request_curation (display_order 50 — merges last, overrides request_approval_required from new_member_warmth)
  ('request_curation',   'admin_review',  'Admins review every request before it''s visible', 'Higher curation. Nothing appears until a moderator approves it.',               '{"request_approval_required":true}',  10),
  ('request_curation',   'trust_freely',  'Members post freely — we trust them',     'Requests are visible immediately. The community self-moderates.',                            '{"request_approval_required":false}', 20)
) AS c(slug, value, label, description, config_delta, display_order)
  ON q.slug = c.slug
ON CONFLICT (question_id, value) DO NOTHING;

COMMIT;
```

- [ ] **Fix `init.sql`** — three edits in the `community_configs` table definition:
  1. Remove the `CONSTRAINT feed_weights_sum CHECK (...)` block (~line 1108)
  2. Add columns after the existing 4 feed weight lines:
     ```sql
     feed_weight_requester_trust   DECIMAL(3,2) NOT NULL DEFAULT 0.15,
     feed_weight_prior_interaction DECIMAL(3,2) NOT NULL DEFAULT 0.10,
     feed_weight_recency           DECIMAL(3,2) NOT NULL DEFAULT 0.05,
     ```
  3. Add the two new tables and their seed INSERT at the bottom of the community schema section (after `community_configs`)

- [ ] **Verify migration is valid SQL** — `psql --dry-run` or review for syntax. Do not run it on demo yet (that happens at deploy time).

---

## Task 2: Community-service — trust-questions API

**Files:**
- Create: `services/community-service/src/routes/trust-questions.ts`
- Modify: `services/community-service/src/index.ts`

- [ ] **Write `trust-questions.ts` route file**

```typescript
// GET /communities/trust-questions — public, returns active questions + choices ordered by display_order
router.get('/', async (req, res) => {
  const result = await query(
    `SELECT
       tq.id, tq.slug, tq.question_text, tq.subtext, tq.display_order,
       json_agg(
         json_build_object(
           'id',            tqc.id,
           'value',         tqc.value,
           'label',         tqc.label,
           'description',   tqc.description,
           'config_delta',  tqc.config_delta,
           'display_order', tqc.display_order
         ) ORDER BY tqc.display_order
       ) AS choices
     FROM community.trust_questions tq
     LEFT JOIN community.trust_question_choices tqc ON tqc.question_id = tq.id
     WHERE tq.active = true
     GROUP BY tq.id
     ORDER BY tq.display_order`,
    []
  );
  res.json({ success: true, data: { questions: result.rows } });
});
```

Admin CRUD routes (POST/PUT/DELETE questions; POST/PUT/DELETE choices) all check `requireAuth` + `isAdmin` via the shared middleware pattern. Follow the existing admin auth pattern from the schemas routes in request-service.

- [ ] **Register router in `index.ts`** — add BEFORE the config router (config router has a catch-all `/:id` param that would swallow `/trust-questions`):

```typescript
import trustQuestionsRouter from './routes/trust-questions';
// ... in route registration section:
app.use('/communities/trust-questions', authMiddleware, trustQuestionsRouter);
// IMPORTANT: this must appear BEFORE the configRouter registration
```

- [ ] **Verify locally:** `curl http://localhost:3002/communities/trust-questions` returns 6 questions with choices

---

## Task 3: Community-service — wire v2 feed weights to PUT /config

**Files:**
- Modify: `services/community-service/src/routes/config.ts`
- Modify: `services/community-service/src/services/config-validator.ts`

- [ ] **Update `config-validator.ts`** — add v2 fields to the `CommunityConfig` interface and validation:

```typescript
// Feed Scoring Weights (Sprint 43 v2 signals)
feed_weight_requester_trust?: number;
feed_weight_prior_interaction?: number;
feed_weight_recency?: number;
```

Add validation: each must be between 0.0 and 1.0 if provided. No sum constraint (dropped in Sprint 43).

- [ ] **Update PUT /config in `config.ts`** — extend the UPDATE query:

In the SET clause, add after `feed_weight_urgency = $21`:
```sql
feed_weight_requester_trust   = $26,
feed_weight_prior_interaction = $27,
feed_weight_recency           = $28,
```

Move `WHERE community_id = $22` → `WHERE community_id = $29`.

Update the values array to add three new entries after `mergedConfig.feed_weight_urgency`:
```typescript
configUpdates.feed_weight_requester_trust   ?? existingConfig.feed_weight_requester_trust,
configUpdates.feed_weight_prior_interaction ?? existingConfig.feed_weight_prior_interaction,
configUpdates.feed_weight_recency           ?? existingConfig.feed_weight_recency,
```

And move `communityId` to position 29 in the array.

Also add the three v2 fields to the `parseFloat` block in the GET /config handler.

- [ ] **Run TypeScript check:** `cd services/community-service && npx tsc --noEmit`

---

## Task 4: Frontend types + data-driven answersToConfig

**Files:**
- Modify: `apps/frontend/src/types/community-config.ts`
- Modify: `apps/frontend/src/lib/trust-model.ts`
- Create: `apps/frontend/src/lib/answersToConfig.ts`

- [ ] **Update `community-config.ts`** — add all 7 feed weight fields to `CommunityConfig`:

```typescript
// Feed Scoring Weights (all 7 signals)
feed_weight_skill_match?: number;
feed_weight_trust_distance?: number;
feed_weight_community_relevance?: number;
feed_weight_urgency?: number;
feed_weight_requester_trust?: number;
feed_weight_prior_interaction?: number;
feed_weight_recency?: number;
```

- [ ] **Refactor `trust-model.ts`**:
  - Remove: `Q1Answer`, `Q2Answer`, ..., `Q6Answer`, `QuestionnaireAnswers`, `QuestionChoice`, `Question`, `QUESTIONS`, `answersToConfig`
  - Add: `export type TrustQuestionnaireAnswers = Record<string, string>`
  - Keep: `FIELD_LABELS`, `ConfigDiffEntry`, `diffConfigs`, `formatConfigValue`

- [ ] **Create `answersToConfig.ts`**:

```typescript
import type { CommunityConfig } from '../types/community-config'

export interface TrustChoice {
  value: string
  config_delta: Partial<CommunityConfig>
}

export interface TrustQuestion {
  id: string
  slug: string
  display_order: number
  choices: TrustChoice[]
}

/**
 * Merges config_deltas from selected choices in display_order (ascending).
 * Questions with higher display_order override earlier ones — this preserves
 * the Q6 (request_curation) override of Q2 (new_member_warmth) for request_approval_required.
 */
export function answersToConfig(
  questions: TrustQuestion[],
  answers: Record<string, string>   // question.id → choice.value
): Partial<CommunityConfig> {
  const sorted = [...questions].sort((a, b) => a.display_order - b.display_order)
  let result: Partial<CommunityConfig> = {}
  for (const question of sorted) {
    const selectedValue = answers[question.id]
    if (!selectedValue) continue
    const choice = question.choices.find(c => c.value === selectedValue)
    if (choice) {
      result = { ...result, ...choice.config_delta }
    }
  }
  return result
}
```

- [ ] **Find all imports of `QuestionnaireAnswers` in frontend and update to `TrustQuestionnaireAnswers`:**

```bash
grep -r "QuestionnaireAnswers\|Q1Answer\|Q2Answer\|Q3Answer\|Q4Answer\|Q5Answer\|Q6Answer\|QUESTIONS" apps/frontend/src --include="*.ts" --include="*.tsx"
```

Fix every hit.

---

## Task 5: Frontend hook + API client

**Files:**
- Create: `apps/frontend/src/hooks/useTrustQuestions.ts`
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Add `trustQuestionsService` to `api.ts`**:

```typescript
export const trustQuestionsService = {
  list: () => api.get('/community/trust-questions'),
  // Admin CRUD
  createQuestion: (data: { slug: string; question_text: string; subtext?: string; display_order: number }) =>
    api.post('/community/trust-questions', data),
  updateQuestion: (id: string, data: Partial<{ question_text: string; subtext: string; display_order: number; active: boolean }>) =>
    api.put(`/community/trust-questions/${id}`, data),
  deleteQuestion: (id: string) =>
    api.delete(`/community/trust-questions/${id}`),
  createChoice: (questionId: string, data: { value: string; label: string; description?: string; config_delta: object; display_order: number }) =>
    api.post(`/community/trust-questions/${questionId}/choices`, data),
  updateChoice: (questionId: string, choiceId: string, data: object) =>
    api.put(`/community/trust-questions/${questionId}/choices/${choiceId}`, data),
  deleteChoice: (questionId: string, choiceId: string) =>
    api.delete(`/community/trust-questions/${questionId}/choices/${choiceId}`),
}
```

- [ ] **Create `useTrustQuestions.ts`**:

```typescript
import { useState, useEffect } from 'react'
import { trustQuestionsService } from '@/lib/api'
import type { TrustQuestion } from '@/lib/answersToConfig'

export function useTrustQuestions() {
  const [questions, setQuestions] = useState<TrustQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trustQuestionsService.list()
      .then(res => setQuestions(res.data.data.questions))
      .catch(err => setError(err.message ?? 'Failed to load questions'))
      .finally(() => setLoading(false))
  }, [])

  return { questions, loading, error }
}
```

---

## Task 6: Update CommunityTrustQuestionnaire to data-driven

**Files:**
- Modify: `apps/frontend/src/components/CommunityTrustQuestionnaire.tsx`
- Modify: `apps/frontend/src/components/TrustModelDiff.tsx`
- Modify: `apps/frontend/src/pages/communities/new.tsx`

- [ ] **Rewrite `CommunityTrustQuestionnaire.tsx`**:

Replace:
```typescript
import { QUESTIONS, QuestionnaireAnswers } from '@/lib/trust-model'
```
With:
```typescript
import { useTrustQuestions } from '@/hooks/useTrustQuestions'
import { TrustQuestionnaireAnswers } from '@/lib/trust-model'
```

Change prop type `initialAnswers?: Partial<QuestionnaireAnswers>` → `initialAnswers?: TrustQuestionnaireAnswers`.
Change `onComplete: (answers: QuestionnaireAnswers)` → `onComplete: (answers: TrustQuestionnaireAnswers)`.

Inside the component:
- Call `const { questions, loading } = useTrustQuestions()`
- The `question` lookup changes from `QUESTIONS[currentIndex]` → `questions[currentIndex]`
- The `handleSelect` value stored in answers changes key from `question.id` (e.g. `'q1'`) → the DB question UUID
- Add loading skeleton: when `loading`, render 3 placeholder choice card divs with `animate-pulse bg-surface-raised rounded-lg h-20`
- The dot nav and `totalQuestions` use `questions.length` instead of `QUESTIONS.length`

- [ ] **Update `TrustModelDiff.tsx`** — change any import of `QuestionnaireAnswers` to `TrustQuestionnaireAnswers`

- [ ] **Update `new.tsx`** — change questionnaire answers state from `Partial<QuestionnaireAnswers>` to `TrustQuestionnaireAnswers`; update the `answersToConfig` call to pass `(questions, answers)` instead of `(answers)` alone. Import `questions` from a local `useTrustQuestions` call or pass as prop if already loaded.

- [ ] **TypeScript check:** `cd apps/frontend && npx tsc --noEmit`

---

## Task 7: Feed signal weights in community admin UI

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`

- [ ] **Read the admin tab config section in `[id].tsx`** to find where `CommunityConfigEditor` is rendered or where trust weights sliders appear, and add a "Feed Signal Weights" section after it.

- [ ] **Add 7 weight sliders** with labels, a live total display, and a note that values are normalized (no need to sum to 1.0):

```tsx
{/* Feed Signal Weights — admin only */}
<div className="space-y-4">
  <h3 className="text-base font-semibold text-text">Feed Signal Weights</h3>
  <p className="text-sm text-text-muted">
    These weights shape which requests appear first in members' feeds.
    Values are normalized automatically — you don't need to sum to 1.0.
  </p>
  {[
    { field: 'feed_weight_skill_match',         label: 'Skill Match' },
    { field: 'feed_weight_trust_distance',      label: 'Trust Distance' },
    { field: 'feed_weight_community_relevance', label: 'Community Relevance' },
    { field: 'feed_weight_urgency',             label: 'Urgency' },
    { field: 'feed_weight_requester_trust',     label: 'Requester Trust' },
    { field: 'feed_weight_prior_interaction',   label: 'Prior Interaction' },
    { field: 'feed_weight_recency',             label: 'Recency' },
  ].map(({ field, label }) => (
    <div key={field}>
      <label className="text-sm font-medium text-text">{label}</label>
      <div className="flex items-center gap-3 mt-1">
        <input
          type="range" min="0" max="1" step="0.05"
          value={(config as any)[field] ?? 0}
          onChange={e => handleConfigChange(field, parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="text-sm text-text-muted w-10 text-right">
          {((config as any)[field] ?? 0).toFixed(2)}
        </span>
      </div>
    </div>
  ))}
</div>
```

Adapt `handleConfigChange` to match the actual config update handler pattern in the file. The 7 sliders should only render when the user is the community founder/admin (already role-gated in the admin tab).

- [ ] **TypeScript check:** `cd apps/frontend && npx tsc --noEmit`

---

## Task 8: Admin trust questions management page

**Files:**
- Create: `apps/frontend/src/pages/admin/trust-questions/index.tsx`

- [ ] **Create `/admin/trust-questions` page** with:
  - `requireAdmin(router)` gate in `useEffect` on mount
  - Load questions via `trustQuestionsService.list()`
  - Display questions in `display_order` order, each expandable to show choices
  - For each question: edit button (question_text, subtext, display_order, active toggle)
  - For each choice: edit config_delta as JSON textarea, label, description
  - Add question form: slug, question_text, subtext, display_order
  - Add choice form per question: value, label, description, config_delta (JSON), display_order
  - Delete/deactivate controls

The page does not need to be visually polished — it's an internal admin tool. Use the same layout and section styling as the schema editor pages.

- [ ] **Add nav link** in the admin area (if a sidebar or nav exists — check `apps/frontend/src/pages/admin/schemas/index.tsx` for the pattern)

---

## Task 9: Landing page docs + ADR

**Files:**
- Modify: `apps/landing/src/data/docs/guides/community-creation.json`
- Modify (or create): `apps/landing/src/data/docs/guides/admin-configuration.json`
- Create: `apps/landing/src/data/docs/concepts/trust-questions.json`
- Modify: `apps/landing/src/data/docs/services/community-service.json`
- Modify: `apps/landing/src/data/nav.json`

- [ ] **Update community-creation guide** — add a note in the questionnaire section explaining that questions are managed by platform admins via `/admin/trust-questions` and can be updated without a deployment.

- [ ] **Update admin-configuration guide** — add a "Feed Signal Weights" section explaining each of the 7 signals and guidance on when to tune them (e.g. "increase Recency for time-sensitive communities").

- [ ] **Create trust-questions concept page**:

```json
{
  "slug": "trust-questions",
  "title": "Trust Questions",
  "description": "How the trust model questionnaire is stored in the database and drives community config.",
  "content": "# Trust Questions\n\n## What are trust questions?\n\nThe trust model questionnaire is the primary lever through which community founders shape their community's character. Six questions — covering membership openness, new-member warmth, relationship style, karma splits, decay rates, and request curation — map human-readable answers to precise numeric config fields.\n\n## How it works\n\nEach question has an ordered list of choices. Each choice carries a `config_delta` — a partial `CommunityConfig` object that is merged into the final config output when that choice is selected. Questions are processed in `display_order` ascending, so higher-order questions can override earlier ones.\n\nThis override mechanic is intentional: the 'Request Curation' question (highest display_order) always wins over the 'New Member Warmth' question for the `request_approval_required` field, allowing founders to make a final explicit choice about request moderation.\n\n## Managing questions\n\nPlatform admins can manage questions and choices at `/admin/trust-questions` without a code deployment. Adding a new question, adjusting config deltas, or changing option labels all happen via the admin UI.\n\n## Configuration as data\n\nThis pattern — configuration stored as JSONB deltas merged in order — is the foundation for a fully declarative community design language. Future sprints may extend this to let community admins propose custom questions for their community."
}
```

- [ ] **Update community-service.json** — add new trust-questions endpoints to the endpoints array.

- [ ] **Update nav.json** — add entry under "Concepts":

```json
{ "slug": "trust-questions", "title": "Trust Questions" }
```

---

## Task 10: CONTEXT.md + registry.json

**Files:**
- Modify: `services/community-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `community-service/CONTEXT.md`** — add trust-questions endpoints to "API Endpoints" section; note that `community_configs` now has 7 feed weight fields.

- [ ] **Update `services/registry.json`** — add trust-questions endpoints to `community-service.apis.provides`:

```json
{ "method": "GET",    "path": "/communities/trust-questions",                              "description": "List active trust questionnaire questions with choices" },
{ "method": "POST",   "path": "/communities/trust-questions",                              "description": "Create a trust question (admin)" },
{ "method": "PUT",    "path": "/communities/trust-questions/:id",                          "description": "Update a trust question (admin)" },
{ "method": "DELETE", "path": "/communities/trust-questions/:id",                          "description": "Deactivate a trust question (admin)" },
{ "method": "POST",   "path": "/communities/trust-questions/:id/choices",                  "description": "Add a choice to a trust question (admin)" },
{ "method": "PUT",    "path": "/communities/trust-questions/:id/choices/:choiceId",        "description": "Update a trust question choice (admin)" },
{ "method": "DELETE", "path": "/communities/trust-questions/:id/choices/:choiceId",        "description": "Remove a trust question choice (admin)" }
```

- [ ] **Run feedback check:**

```bash
npm run feedback:check
```

---

## Task 11: TDD integration test + unit tests

**Files:**
- Create: `tests/tdd/trust-questions-api.test.ts`
- Create: `tests/unit/frontend/answersToConfig.test.ts`

- [ ] **Write unit tests for `answersToConfig`** (write BEFORE implementation, but since answersToConfig is pure logic, write alongside Task 4):

```typescript
// tests/unit/frontend/answersToConfig.test.ts
import { answersToConfig, TrustQuestion } from '../../../apps/frontend/src/lib/answersToConfig'

const mockQuestions: TrustQuestion[] = [
  {
    id: 'q1-id', slug: 'new_member_warmth', display_order: 20,
    choices: [
      { value: 'open_arms', config_delta: { new_member_karma_lockout_days: 0, request_approval_required: false } },
      { value: 'trust_takes_time', config_delta: { new_member_karma_lockout_days: 14, request_approval_required: true } },
    ]
  },
  {
    id: 'q2-id', slug: 'request_curation', display_order: 50,
    choices: [
      { value: 'admin_review', config_delta: { request_approval_required: true } },
      { value: 'trust_freely', config_delta: { request_approval_required: false } },
    ]
  }
]

describe('answersToConfig', () => {
  it('merges config_deltas in display_order', () => {
    const result = answersToConfig(mockQuestions, { 'q1-id': 'open_arms', 'q2-id': 'admin_review' })
    // Q2 (display_order 50) merges last — admin_review wins
    expect(result.request_approval_required).toBe(true)
    expect(result.new_member_karma_lockout_days).toBe(0)
  })

  it('Q6 override: request_curation overrides new_member_warmth for request_approval_required', () => {
    const result = answersToConfig(mockQuestions, { 'q1-id': 'trust_takes_time', 'q2-id': 'trust_freely' })
    expect(result.request_approval_required).toBe(false)  // trust_freely wins despite trust_takes_time being true
  })

  it('skips questions with no selected answer', () => {
    const result = answersToConfig(mockQuestions, { 'q1-id': 'open_arms' })
    expect(result.new_member_karma_lockout_days).toBe(0)
    expect(result.request_approval_required).toBeUndefined()
  })
})
```

- [ ] **Write TDD integration test** for the trust-questions API:

```typescript
// tests/tdd/trust-questions-api.test.ts
// Tests GET /communities/trust-questions returns seeded data in order.
// Requires running community-service + DB.
```

The integration test should verify:
1. Returns 6 questions
2. Questions are ordered by `display_order` ascending
3. Each question has `choices` array (non-empty)
4. `request_curation` question has highest display_order (50)
5. Each choice has `config_delta` object

- [ ] **Run unit tests:**

```bash
npm run test:unit
npm run test:tdd
```

---

## Task 12: Final type check + pre-push verification

**Files:** None created, verification only.

- [ ] **Full TypeScript check across all changed packages:**

```bash
cd services/community-service && npx tsc --noEmit
cd apps/frontend && npx tsc --noEmit
```

- [ ] **Run full test suite:**

```bash
npm test
npm run test:tdd
```

- [ ] **Run feedback check:**

```bash
npm run feedback:check
```

- [ ] **Smoke test the questionnaire flow manually:**
  - Create a new community — verify the questionnaire step loads (not blank, not crashing)
  - Select all 6 answers — verify the config diff shows expected values
  - Submit — verify community is created with correct config

- [ ] **Smoke test the admin feed weights:**
  - Navigate to a community admin tab as founder
  - Verify 7 sliders appear in "Feed Signal Weights" section
  - Adjust one slider — verify save succeeds and value persists on reload

- [ ] **Smoke test the admin trust questions page:**
  - Navigate to `/admin/trust-questions` as admin user
  - Verify 6 questions listed with choices
  - Edit a question's subtext — verify it saves and appears in the questionnaire

---

## Task 13: Merge + Deploy

- [ ] **Pre-commit check:**

```bash
# Use /pre-commit-check skill or run manually:
npm test
npm run test:tdd
npm run feedback:check
```

- [ ] **Commit and merge to master:**

```bash
git add -p   # stage all sprint changes
git commit -m "feat(trust-config): externalize questionnaire to DB, expose all 7 feed weight sliders"
git checkout master
git merge feature/sprint-45-trust-config-externalization
git push origin master
```

- [ ] **Run migration on demo server (SSH required — migration is not auto-applied by deploy.sh):**

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
psql $DATABASE_URL -f infrastructure/postgres/migrations/20260404-trust-questions.sql
```

- [ ] **Monitor GitHub Actions deploy** — verify green build, all health checks pass

- [ ] **Post-deploy smoke test on karmyq.com** — create a community, walk through the questionnaire, verify feed weight sliders in admin tab
