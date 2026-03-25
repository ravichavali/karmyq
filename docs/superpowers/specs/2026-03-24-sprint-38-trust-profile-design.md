# Sprint 38: Contextual Trust + Member Profile Depth — Design Spec

**Date**: 2026-03-24
**Status**: Approved
**Version**: v9.12.0 → v9.13.0
**Sprint Branch**: `feature/sprint-38-trust-profile`

---

## Overview

Sprint 38 surfaces trust information where it actually matters — in the context of a match — and deepens the personal profile with self-declared identity tags (skills, interests, needs). The platform does not become a browsable social network; member profiles remain private. Trust becomes visible only in relational moments: when two people are connected through a match, the feed surfaces a compact trust path badge, and clicking it opens a full TrustCard revealing how they are connected, trust scores, and the invitation chain.

The second surface is the personal profile page (`/profile`). Users can now declare what they bring (skills), what they care about (interests), and what they might need — lightweight self-description that feeds the platform's matching logic over time. The data model is intentionally open-ended: a unified `auth.user_tags` table with a `tag_type` column, allowing new tag categories to emerge without schema changes.

Sprint 38 also fixes the provider dashboard completion rate bug (10000% display) introduced when the frontend double-multiplied a value the backend already returns as a 0–100 percentage.

### Core Principle: Trust in Context, Not on Demand

Trust information is not a public profile feature. It is a relational signal, revealed only when a connection is live and relevant — a match, a curated feed item, a shared moment. Members cannot browse other members. Providers remain fully public (no change). The distinction between member privacy and provider publicity is a first-class design decision.

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin power + community discovery | ✅ Complete |
| **37** | Provider Mode + Notification Separation | ✅ Complete |
| **38** | Contextual Trust + Member Profile Depth | 🔜 This sprint |
| **39** | Admin/Moderator as Connector (TBD) | Upcoming |

---

## New Concepts

### Trust Tier
A human-readable label derived from a member's karma score. Three tiers:
- **Emerging** — karma 0–29. New to the community, building track record.
- **Trusted** — karma 30–99. Established participant with positive history.
- **Pillar** — karma 100+. Community cornerstone.

Thresholds are intentionally simple and can be tuned. The tier is computed server-side and returned alongside the raw karma score.

### TrustCard
A modal component that surfaces how the current user is connected to another member. Accessible only by clicking the existing `TrustPathBadge` / `ConnectionBadge` on feed items and match cards. Shows: trust tier label, trust score, the directional connection chain (A→B→C with karma at each intermediate hop), and the invitation path if different. Not a page — never has a URL.

### User Tags
Self-declared, user-owned identity signals. Three types:
- **Skills** — what they can offer ("Carpentry", "Spanish tutoring", "Bookkeeping")
- **Interests** — what they care about ("Urban gardening", "Food access", "Youth mentorship")
- **Needs** — what they might need ("Childcare swaps", "Rides on Tuesdays", "Help moving")

Tags are global (not per-community). Stored in a unified `auth.user_tags` table with a `tag_type` column, leaving the schema open to new categories without migrations. Predefined suggestions are shown as hints; freeform entry is always allowed.

---

## Data Model

### New table: `auth.user_tags`

```sql
CREATE TABLE IF NOT EXISTS auth.user_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_type    VARCHAR(20) NOT NULL CHECK (tag_type IN ('skill', 'interest', 'need')),
  tag_value   VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_tags_unique UNIQUE (user_id, tag_type, tag_value)
);

CREATE INDEX idx_user_tags_user_id ON auth.user_tags(user_id);
```

Note: `auth.user_skills` (existing table) is left untouched. It has no active UI; `auth.user_tags` supersedes it for user-facing tag management. A future migration can consolidate if needed.

### No other schema changes
- Trust tier computation uses existing `reputation.karma_records` data — no new columns.
- The `auth.social_distances` cache (existing) is used by the new trust-card endpoint.

---

## API Endpoints

### New: Social Graph Service

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/social-graph/trust-card/:targetUserId` | Required | Returns trust path + target trust tier for TrustCard modal |

**Response shape:**
```json
{
  "success": true,
  "data": {
    "targetUser": {
      "id": "uuid",
      "name": "Alex Chen",
      "karma": 72,
      "trust_tier": "Trusted"
    },
    "trustPath": [
      { "id": "me", "name": "You" },
      { "id": "uuid-b", "name": "Maria Reyes", "karma": 87, "exchanged_at": "2026-01-15T00:00:00Z" },
      { "id": "uuid-c", "name": "Alex Chen" }
    ],
    "invitationPath": [
      { "id": "me", "name": "You" },
      { "id": "uuid-b", "name": "Maria Reyes", "invited_at": "2025-11-01T00:00:00Z" },
      { "id": "uuid-c", "name": "Alex Chen" }
    ],
    "degrees": 2,
    "path_type": "exchange"
  }
}
```

The endpoint delegates path computation to existing `pathComputation.ts`, then enriches the target user node with karma + computed trust_tier. `invitationPath` is omitted if identical to `trustPath` or if no invitation chain exists.

### New: Auth Service

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/profile/tags` | Required | Get current user's tags grouped by type |
| POST | `/auth/profile/tags` | Required | Add a tag (body: `{ tag_type, tag_value }`) |
| DELETE | `/auth/profile/tags/:tagId` | Required | Remove a tag |
| GET | `/auth/profile/tags/suggestions` | Required | Get predefined suggestions per tag_type (query: `?tag_type=skill`) |

**GET /auth/profile/tags response:**
```json
{
  "success": true,
  "data": {
    "skills": [{ "id": "uuid", "tag_value": "Carpentry" }],
    "interests": [{ "id": "uuid", "tag_value": "Urban gardening" }],
    "needs": [{ "id": "uuid", "tag_value": "Childcare swaps" }]
  }
}
```

Suggestions are hardcoded constants in the auth service (no DB table). They are starting hints only — the platform evolves organically from what users actually enter.

### Bug fix (no new endpoints)
- `ProviderDashboardCard.tsx` and `reputation/providers.tsx`: remove `* 100` from `completion_rate` display. Backend returns 0–100; frontend must not re-multiply.

---

## Frontend Changes

| Component / Page | Change |
|---|---|
| `ProviderDashboardCard.tsx` | Remove `* 100` from completion_rate display |
| `reputation/providers.tsx` | Remove `* 100` from completion_rate display |
| `TrustCard.tsx` (new) | Modal showing trust tier, trust path chain (A→B→C with karma badges), invitation path |
| `FeedItem.tsx` | Make existing `TrustPathBadge` clickable — onClick opens TrustCard modal for that user |
| `ProfileTagsSection.tsx` (new) | Skills / Interests / Needs tag editor component for `/profile` page |
| `pages/profile.tsx` | Add `ProfileTagsSection` below existing profile content |

### TrustCard design notes
- Opens as a modal/sheet (not a new page, no URL)
- Header: member name + trust tier badge (color-coded: gray=Emerging, blue=Trusted, green=Pillar)
- Trust score shown as a number with label ("72 · Trusted")
- Path section: horizontal chain of avatar chips with karma numbers at intermediate nodes. Arrows between each hop. "You → Maria (87 karma) → Alex"
- Invitation path section (if different from trust path): shown below with a distinct visual (dashed line or different icon)
- Footer: "Mutual communities: [list]" — if any
- No "view full profile" link — this IS the profile for a member

### ProfileTagsSection design notes
- Three collapsible or tabbed sections: Skills, Interests, Needs
- Each shows current tags as removable chips
- "Add" button opens a small dropdown with predefined suggestions + freeform text input
- Max 10 tags per type (enforced client-side with a soft warning)
- Saves on each add/remove (no Save button — immediate API call)

---

## User Guide & Doc Updates

Every sprint ships doc updates. For Sprint 38:

1. **New user guide**: `docs/guides/understanding-trust.md`
   - What is a trust tier (Emerging / Trusted / Pillar)
   - How to read the trust path on feed items
   - How to open the TrustCard and what it shows
   - Why member profiles are private (platform philosophy)

2. **Update user guide**: `docs/guides/profile-guide.md` (create if doesn't exist)
   - How to add skills, interests, needs on your profile
   - What predefined suggestions look like
   - How these tags might affect matching over time (expectation-setting)

3. **Update concept page**: `docs/concepts/trust-path.md` (create if doesn't exist)
   - Explain trust path computation (degrees of separation, path types: exchange / community / invitation)
   - Define trust tier thresholds and philosophy

4. **Landing page docs** (via `scripts/generate-docs.ts`):
   - Add `understanding-trust` guide to GUIDE_ORDER/GUIDE_LABELS/GUIDE_SLUGS
   - Add `profile-guide` guide
   - Add or update `trust-path` concept page

---

## Critical Implementation Notes

1. **Trust path endpoint is in social-graph-service, NOT reputation-service.** The path computation already lives in `social-graph-service/src/services/pathComputation.ts`. The new `/trust-card/:targetUserId` route goes in social-graph-service and calls pathComputation internally, then fetches karma from reputation-service.

2. **Karma fetch from reputation-service uses internal service URL.** Social-graph-service must call `REPUTATION_API_URL` (env var) to get karma for the target user. Do not hardcode `localhost:3004` — use the env var (Docker uses `http://reputation-service:3004`).

3. **TrustCard is NOT a page.** It must never have a URL or be navigable directly. It is a modal component instantiated wherever TrustPathBadge is clicked. State lives in the parent (FeedItem or future match card).

4. **`auth.user_tags` uses a CHECK constraint**, not a foreign key to an enum table. This keeps it schema-flexible. The allowed values (`'skill'`, `'interest'`, `'need'`) are enforced at the DB level. Future tag types require only a migration to the CHECK constraint.

5. **Completion rate bug**: Backend stores 0–100 (e.g., `75.00` meaning 75%). Frontend was doing `Math.round(Number(completion_rate) * 100)` → `7500`. Fix: `Math.round(Number(completion_rate))`. Check both `ProviderDashboardCard.tsx` and `reputation/providers.tsx`.

6. **`auth.user_skills` is left alone.** Do not migrate it or break existing code that may reference it. `auth.user_tags` is additive.

7. **Suggestions are hardcoded in auth-service**, not in a DB table. They are starter hints, not a curated taxonomy. Return them from a constants file: `src/constants/tagSuggestions.ts`. This keeps the system lightweight and evolvable.

8. **TrustPathBadge already renders in FeedItem** (line 158). For Sprint 38, wrap it in a button/clickable div with an `onClick` that sets `selectedTrustUserId` state, which triggers the TrustCard modal. Minimal changes to existing FeedItem logic.

9. **nginx routing**: No new services in this sprint, so no nginx changes needed.
