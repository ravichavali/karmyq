# ADR-044: Community Trust Model Questionnaire

**Status**: Implemented

---

## Context

Community configuration has 17+ abstract numeric fields (`trust_depth_weight: 0.6`, `karma_split_helper: 80`, `karma_decay_half_life_days: 90`, etc.). Founders found these numbers difficult to reason about. There was no clear mental model for what a value of `0.6` vs `0.8` meant for their community's culture.

The underlying issue: the numbers are technically precise but semantically opaque. Founders think in terms of values and relationships, not weight coefficients.

---

## Decision

Replace the initial config screen with a six-question questionnaire that maps human values to configuration parameters. Add a "Revisit trust model" path for existing communities that shows a diff of proposed vs. current config with selective apply.

Pure frontend change — no backend modifications, no new migrations.

---

## The Six Questions and Their Mappings

### Q1: Who is this community for?

| Answer | Config fields |
|--------|---------------|
| `just_us` | visibility_mode=members_only, join_approval=true, member_cap=50, outsider=false |
| `neighborhood` | visibility_mode=hybrid, join_approval=true, member_cap=100, outsider=false |
| `anyone` | visibility_mode=public, join_approval=false, member_cap=150, outsider=true |

### Q2: How do you feel about new members?

| Answer | Config fields |
|--------|---------------|
| `trust_takes_time` | lockout=14d, request_approval=true, min_interactions=3, joining_counts=false |
| `cautious` | lockout=7d, request_approval=false, min_interactions=2, joining_counts=false |
| `open_arms` | lockout=0, request_approval=false, min_interactions=1, joining_counts=true |

### Q3: What kind of relationships do you want?

| Answer | Config fields |
|--------|---------------|
| `deep_bonds` | trust_depth_weight=0.8, trust_breadth_weight=0.2 |
| `mix` | trust_depth_weight=0.6, trust_breadth_weight=0.4 |
| `wide_web` | trust_depth_weight=0.3, trust_breadth_weight=0.7 |

Note: depth + breadth always sums to 1.0.

### Q4: How do you feel about asking for help?

| Answer | Config fields |
|--------|---------------|
| `givers_matter` | karma_split_helper=80, karma_split_requestor=20 |
| `balanced` | karma_split_helper=60, karma_split_requestor=40 |
| `asking_is_brave` | karma_split_helper=60, karma_split_requestor=60 |

### Q5: How long should acts be remembered?

| Answer | Config fields |
|--------|---------------|
| `forever` | karma_decay=365d, trust_decay=365d |
| `seasonal` | karma_decay=90d, trust_decay=180d |
| `present` | karma_decay=30d, trust_decay=60d |

### Q6: How do you want to curate requests?

| Answer | Config fields |
|--------|---------------|
| `admin_review` | request_approval_required=true |
| `trust_freely` | request_approval_required=false |

**Important**: Q6 is applied last, always overriding Q2's `request_approval_required`. This ensures the admin gets a clean answer to the curation question without confusing overlap with new-member policy.

---

## UX Design

### Community Creation Flow

Three-step flow:
1. **Basic Info** — name, description, location, category
2. **Trust Model** — six-question questionnaire, one question at a time
3. **Review & Customize (Optional)** — pre-populated config editor, with Skip & Create option

Templates bypass the questionnaire (template already has values set).

### Questionnaire UI
- One question at a time
- Three radio-style choice cards per question
- Auto-advances 200ms after selection (lets animation land)
- Progress dots: clickable for previously answered questions, visual indicator for current
- Back button navigates to previous question, or to Basic Info on Q1

### Revisit Flow (Existing Communities)
- Banner in founder Config tab: "Revisit trust model"
- Inline questionnaire (no page navigation)
- On complete → diff view
- Diff table: Field label | Current value | Proposed value | Checkbox
- All diffs checked by default; founders can uncheck individual fields
- Apply All, Apply Selected (n), or Discard
- Empty diff: "Your config already matches this trust model"

---

## Implementation

**New files:**
- `apps/frontend/src/lib/trust-model.ts` — pure logic (no React, no side effects). Exports: types, QUESTIONS, answersToConfig(), diffConfigs(), FIELD_LABELS, formatConfigValue()
- `apps/frontend/src/components/CommunityTrustQuestionnaire.tsx` — questionnaire UI
- `apps/frontend/src/components/TrustModelDiff.tsx` — diff table with selective apply

**Modified:**
- `apps/frontend/src/pages/communities/new.tsx` — 3-step flow with questionnaire as Step 2
- `apps/frontend/src/pages/communities/[id].tsx` — Revisit trust model in config tab

**Tests:** 33 TDD tests covering all 18 answer→config mappings, Q6 override behavior, diffConfigs, component rendering, and selective apply logic.

---

## Consequences

**Positive:**
- Founders interact with values and culture, not numbers
- Config is still fully editable after questionnaire — power users keep access
- Selective diff apply lets communities partially adopt evolution proposals
- Questionnaire is decoupled from config: adding new questions or changing mappings is a single-file change in `trust-model.ts`

**Neutral:**
- The questionnaire produces a `Partial<CommunityConfig>` merged on top of defaults — fields not covered by questionnaire answers (e.g. `trust_path_max_hops`, `base_karma_pool_per_request`) retain defaults
- Part 2 of the original idea (system-observed evolution proposals based on actual community behavior) is not yet implemented — that requires backend analytics

---

## Related

- ADR-030: Community Configuration System (Phase 1)
- ADR-037: Multi-Signal Trust Score
- ADR-040: Community Trust Score
