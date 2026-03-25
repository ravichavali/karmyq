# Sprint 38: Contextual Trust + Member Profile Depth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface trust contextually in match/feed moments via a clickable TrustCard, and deepen personal profiles with self-declared skills, interests, and needs tags.

**Architecture:** Two new API surfaces (social-graph `/trust-card/:targetUserId` + auth `/profile/tags`) backed by a single new `auth.user_tags` table; two new frontend components (`TrustCard.tsx`, `ProfileTagsSection.tsx`) wired into existing feed and profile pages.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `infrastructure/postgres/migrations/20260324-user-tags.sql` | `auth.user_tags` table + index |
| `services/social-graph-service/src/routes/trustCard.ts` | `GET /trust-card/:targetUserId` route |
| `services/auth-service/src/routes/profileTags.ts` | GET / POST / DELETE / suggestions routes for user tags |
| `services/auth-service/src/constants/tagSuggestions.ts` | Predefined skill/interest/need suggestions |
| `apps/frontend/src/components/TrustCard.tsx` | Modal showing trust tier, path chain, invitation path |
| `apps/frontend/src/components/ProfileTagsSection.tsx` | Tag editor (skills / interests / needs) for `/profile` |
| `tests/tdd/sprint-38-trust-profile.test.ts` | TDD tests for trust tier logic + ProfileTagsSection + TrustCard |
| `docs/guides/understanding-trust.md` | User guide: trust tiers, trust path, TrustCard |
| `docs/guides/profile-guide.md` | User guide: adding skills, interests, needs |
| `docs/concepts/trust-path.md` | Concept: path computation, degrees, tier thresholds |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/ProviderDashboardCard.tsx` | Remove `* 100` from completion_rate display |
| `apps/frontend/src/pages/reputation/providers.tsx` | Remove `* 100` from completion_rate display |
| `services/social-graph-service/src/index.ts` | Register `/trust-card` route |
| `services/auth-service/src/index.ts` | Register `/auth/profile/tags` routes |
| `apps/frontend/src/components/Feed/FeedItem.tsx` | Make TrustPathBadge clickable → open TrustCard modal |
| `apps/frontend/src/pages/profile.tsx` | Add ProfileTagsSection below existing profile content |
| `services/social-graph-service/CONTEXT.md` | Document new trust-card endpoint |
| `services/auth-service/CONTEXT.md` | Document new profile/tags endpoints |
| `services/registry.json` | Add new endpoints |
| `scripts/generate-docs.ts` | Add new guides + concept to GUIDE_ORDER/LABELS/SLUGS |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Trust path endpoint is in social-graph-service, NOT reputation-service.** The new `/trust-card/:targetUserId` route goes in social-graph-service and calls `pathComputation.ts` internally, then fetches karma from reputation-service via `REPUTATION_API_URL` env var.

2. **`REPUTATION_API_URL` in Docker = `http://reputation-service:3004`.** Never hardcode `localhost:3004`.

3. **TrustCard is never a page.** Modal only — no URL, no route. State (`selectedTrustUserId`) lives in FeedItem parent.

4. **Completion rate bug** — remove `* 100` from exactly two places: `ProviderDashboardCard.tsx` line ~24 and `reputation/providers.tsx` line ~157. Backend returns 0–100 already.

5. **`auth.user_skills` is left untouched.** `auth.user_tags` is additive.

6. **Tag suggestions are hardcoded** in `src/constants/tagSuggestions.ts` — not a DB table.

7. **TrustPathBadge is already rendered in FeedItem line 158.** Wrap in a `<button>` with `onClick={() => setSelectedTrustUserId(item.userId)}`. Add `selectedTrustUserId` state + TrustCard modal render in FeedItem.

8. **generate-docs.ts is source of truth for nav.json** — never edit nav.json directly. Add new guides/concepts to GUIDE_ORDER, GUIDE_LABELS, GUIDE_SLUGS, and howItWorks arrays in `scripts/generate-docs.ts`.

9. **Landing page force-add**: `git add -f apps/landing/src/data/docs/...` after running generate-docs.

---

## Task 1: Feature branch + bug fix + DB migration

**Files:**
- Create branch: `feature/sprint-38-trust-profile`
- Modify: `apps/frontend/src/components/ProviderDashboardCard.tsx`
- Modify: `apps/frontend/src/pages/reputation/providers.tsx`
- Create: `infrastructure/postgres/migrations/20260324-user-tags.sql`

- [ ] **Create the feature branch**

```bash
git checkout -b feature/sprint-38-trust-profile
```

- [ ] **Fix completion rate bug in ProviderDashboardCard.tsx**

Find the line doing `Math.round(Number(profile.completion_rate) * 100)` and change to `Math.round(Number(profile.completion_rate))`. The backend stores completion_rate as 0–100 (e.g. `75.00` = 75%). The `* 100` double-multiplies it to 7500%.

- [ ] **Fix completion rate bug in reputation/providers.tsx**

Find `Math.round(provider.completion_rate * 100)` and change to `Math.round(provider.completion_rate)`.

- [ ] **Create DB migration**

```sql
-- infrastructure/postgres/migrations/20260324-user-tags.sql
CREATE TABLE IF NOT EXISTS auth.user_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_type    VARCHAR(20) NOT NULL CHECK (tag_type IN ('skill', 'interest', 'need')),
  tag_value   VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_tags_unique UNIQUE (user_id, tag_type, tag_value)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON auth.user_tags(user_id);
```

- [ ] **Verify** — open the Provider dashboard in the running app; confirm completion rate shows e.g. `85%` not `8500%`.

---

## Task 2: Backend — trust-card endpoint (social-graph-service)

**Files:**
- Create: `services/social-graph-service/src/routes/trustCard.ts`
- Modify: `services/social-graph-service/src/index.ts`

- [ ] **Create `trustCard.ts` route**

```typescript
// services/social-graph-service/src/routes/trustCard.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { computePath } from '../services/pathComputation';
import axios from 'axios';

const router = Router();

const TIER_THRESHOLDS = { PILLAR: 100, TRUSTED: 30 } as const;
function getTrustTier(karma: number): 'Pillar' | 'Trusted' | 'Emerging' {
  if (karma >= TIER_THRESHOLDS.PILLAR) return 'Pillar';
  if (karma >= TIER_THRESHOLDS.TRUSTED) return 'Trusted';
  return 'Emerging';
}

router.get('/:targetUserId', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.userId;

    // Fetch trust path using existing pathComputation
    const pathResult = await computePath(currentUserId, targetUserId);

    // Fetch target user's karma from reputation service
    const reputationUrl = process.env.REPUTATION_API_URL || 'http://reputation-service:3004';
    let karma = 0;
    try {
      const karmaRes = await axios.get(
        `${reputationUrl}/reputation/karma/${targetUserId}`,
        { headers: { Authorization: req.headers.authorization } }
      );
      karma = karmaRes.data?.data?.total_karma ?? 0;
    } catch {
      // karma stays 0 — trust tier will be Emerging
    }

    const trust_tier = getTrustTier(karma);

    const targetNode = pathResult?.path?.at(-1);
    res.json({
      success: true,
      data: {
        targetUser: {
          id: targetUserId,
          name: targetNode?.name ?? 'Unknown',
          karma,
          trust_tier,
        },
        trustPath: pathResult?.path ?? [],
        invitationPath: pathResult?.invitationPath ?? null,
        degrees: pathResult?.degrees ?? null,
        path_type: pathResult?.path_type ?? null,
      },
    });
  } catch (err) {
    console.error('trust-card error:', err);
    res.status(500).json({ success: false, message: 'Failed to load trust card' });
  }
});

export default router;
```

- [ ] **Register the route in `index.ts`**

```typescript
import trustCardRoutes from './routes/trustCard';
// Add alongside other routes:
app.use('/trust-card', trustCardRoutes);
```

- [ ] **Check what `computePath` / `pathComputation.ts` exports** — read the file to confirm the function signature and return shape, then adjust the route if needed.

- [ ] **Verify** — `curl` the endpoint with a valid JWT and two user IDs that have a known connection. Confirm the response shape matches the spec.

---

## Task 3: Backend — user tags API (auth-service)

**Files:**
- Create: `services/auth-service/src/constants/tagSuggestions.ts`
- Create: `services/auth-service/src/routes/profileTags.ts`
- Modify: `services/auth-service/src/index.ts`

- [ ] **Create `tagSuggestions.ts`**

```typescript
// services/auth-service/src/constants/tagSuggestions.ts
export const TAG_SUGGESTIONS: Record<'skill' | 'interest' | 'need', string[]> = {
  skill: [
    'Carpentry', 'Cooking', 'Driving', 'Spanish tutoring', 'Childcare',
    'Bookkeeping', 'Gardening', 'Plumbing', 'Electrical', 'Web design',
    'Photography', 'Music lessons', 'Pet care', 'Elder care', 'Moving help',
  ],
  interest: [
    'Urban gardening', 'Food access', 'Youth mentorship', 'Housing justice',
    'Language exchange', 'Community art', 'Neighborhood safety', 'Climate action',
    'Disability inclusion', 'Mutual aid organizing', 'Local history',
  ],
  need: [
    'Rides on weekdays', 'Childcare swaps', 'Help moving', 'Home repairs',
    'Grocery runs', 'Tech support', 'Language practice', 'Meal sharing',
    'Tutoring', 'Pet sitting', 'Elderly parent support',
  ],
};
```

- [ ] **Create `profileTags.ts` route**

```typescript
// services/auth-service/src/routes/profileTags.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import pool from '../db';
import { TAG_SUGGESTIONS } from '../constants/tagSuggestions';

const router = Router();

// GET /auth/profile/tags — current user's tags grouped by type
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.query(
    'SELECT id, tag_type, tag_value FROM auth.user_tags WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const grouped = { skills: [], interests: [], needs: [] } as Record<string, any[]>;
  for (const row of result.rows) {
    const key = row.tag_type === 'skill' ? 'skills'
               : row.tag_type === 'interest' ? 'interests' : 'needs';
    grouped[key].push({ id: row.id, tag_value: row.tag_value });
  }
  res.json({ success: true, data: grouped });
});

// POST /auth/profile/tags — add a tag
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { tag_type, tag_value } = req.body;
  if (!['skill', 'interest', 'need'].includes(tag_type)) {
    return res.status(400).json({ success: false, message: 'Invalid tag_type' });
  }
  if (!tag_value?.trim()) {
    return res.status(400).json({ success: false, message: 'tag_value required' });
  }
  const result = await pool.query(
    `INSERT INTO auth.user_tags (user_id, tag_type, tag_value)
     VALUES ($1, $2, $3)
     ON CONFLICT ON CONSTRAINT user_tags_unique DO NOTHING
     RETURNING id, tag_type, tag_value`,
    [userId, tag_type, tag_value.trim()]
  );
  res.json({ success: true, data: result.rows[0] ?? null });
});

// DELETE /auth/profile/tags/:tagId — remove a tag
router.delete('/:tagId', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { tagId } = req.params;
  await pool.query(
    'DELETE FROM auth.user_tags WHERE id = $1 AND user_id = $2',
    [tagId, userId]
  );
  res.json({ success: true });
});

// GET /auth/profile/tags/suggestions?tag_type=skill
router.get('/suggestions', authenticateToken, (req, res) => {
  const tag_type = req.query.tag_type as string;
  if (!['skill', 'interest', 'need'].includes(tag_type)) {
    return res.status(400).json({ success: false, message: 'Invalid tag_type' });
  }
  res.json({ success: true, data: TAG_SUGGESTIONS[tag_type as 'skill' | 'interest' | 'need'] });
});

export default router;
```

- [ ] **Register routes in auth-service `index.ts`**

```typescript
import profileTagsRoutes from './routes/profileTags';
// Register (suggestions route must come before parameterized routes):
app.use('/auth/profile/tags', profileTagsRoutes);
```

- [ ] **Verify** — `curl POST /auth/profile/tags` with a valid JWT; confirm tag is created. `curl GET /auth/profile/tags`; confirm it appears under correct type.

---

## Task 4: Frontend — TrustCard component

**Files:**
- Create: `apps/frontend/src/components/TrustCard.tsx`

- [ ] **Create `TrustCard.tsx`**

Design requirements:
- Modal/sheet (not a page). Receives `userId: string` + `onClose: () => void` props.
- Fetches `GET /api/social-graph/trust-card/:userId` on mount.
- Shows loading skeleton, then:
  - **Header**: Member name + trust tier badge
    - Emerging → gray badge
    - Trusted → blue badge
    - Pillar → green badge
  - **Trust score line**: e.g. "72 karma · Trusted"
  - **Connection path**: horizontal chain of avatar initials with arrows between them. Intermediate nodes show karma score below name. Example: `[You] → [Maria 87] → [Alex]`
  - **Path type label**: "Connected through shared exchanges" / "Connected through community" / "Connected through invitation"
  - **Invitation path** (if different from trust path): shown below with dashed separator and label "Invitation chain"
  - **Footer**: If path is `null` (no connection found): "No direct connection found — you may be meeting someone new."
- Uses existing Karmyq design tokens (green palette, card styling consistent with other modals).

```typescript
// apps/frontend/src/components/TrustCard.tsx
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface TrustPathNode {
  id: string;
  name: string;
  karma?: number;
  exchanged_at?: string;
  invited_at?: string;
}

interface TrustCardData {
  targetUser: { id: string; name: string; karma: number; trust_tier: 'Emerging' | 'Trusted' | 'Pillar' };
  trustPath: TrustPathNode[];
  invitationPath: TrustPathNode[] | null;
  degrees: number | null;
  path_type: string | null;
}

const TIER_COLORS = {
  Emerging: 'bg-gray-100 text-gray-700',
  Trusted: 'bg-blue-100 text-blue-700',
  Pillar: 'bg-green-100 text-green-700',
};

export function TrustCard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<TrustCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/social-graph/trust-card/${userId}`)
      .then(res => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const pathTypeLabel: Record<string, string> = {
    exchange: 'Connected through shared exchanges',
    community: 'Connected through community membership',
    invitation_chain: 'Connected through invitation chain',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-16 bg-gray-100 rounded" />
          </div>
        ) : data ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg text-gray-900">{data.targetUser.name}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_COLORS[data.targetUser.trust_tier]}`}>
                  {data.targetUser.trust_tier}
                </span>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {data.targetUser.karma} karma · {data.targetUser.trust_tier}
            </p>

            {data.trustPath.length > 1 ? (
              <div className="mb-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Connection path</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {data.trustPath.map((node, i) => (
                    <span key={node.id} className="flex items-center gap-1">
                      <span className="flex flex-col items-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                          {node.name.charAt(0)}
                        </span>
                        <span className="text-xs text-gray-600 max-w-[60px] truncate text-center">{node.name}</span>
                        {node.karma != null && <span className="text-xs text-gray-400">{node.karma}</span>}
                      </span>
                      {i < data.trustPath.length - 1 && <span className="text-gray-300">→</span>}
                    </span>
                  ))}
                </div>
                {data.path_type && (
                  <p className="text-xs text-gray-400 mt-2">{pathTypeLabel[data.path_type] ?? data.path_type}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No direct connection found — you may be meeting someone new.</p>
            )}

            {data.invitationPath && data.invitationPath.length > 1 &&
              JSON.stringify(data.invitationPath) !== JSON.stringify(data.trustPath) && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Invitation chain</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {data.invitationPath.map((node, i) => (
                    <span key={node.id} className="flex items-center gap-1">
                      <span className="text-xs text-gray-600">{node.name}</span>
                      {i < data.invitationPath!.length - 1 && <span className="text-gray-300">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">Could not load trust information.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Verify** — render `<TrustCard userId="some-id" onClose={() => {}} />` in isolation (Storybook or a test page) and confirm it shows loading → data states correctly.

---

## Task 5: Frontend — make TrustPathBadge clickable in FeedItem

**Files:**
- Modify: `apps/frontend/src/components/Feed/FeedItem.tsx`

- [ ] **Read FeedItem.tsx** — understand current structure around line 158 where `TrustPathBadge` is rendered, and identify what user ID is available for the feed item author/offerer.

- [ ] **Add `selectedTrustUserId` state and TrustCard integration**

```typescript
// In FeedItem.tsx — add near top of component:
const [selectedTrustUserId, setSelectedTrustUserId] = useState<string | null>(null);

// Import TrustCard:
import { TrustCard } from '@/components/TrustCard';
```

- [ ] **Wrap TrustPathBadge in a clickable button**

Find the existing `<TrustPathBadge ... />` render and wrap it:

```tsx
<button
  type="button"
  onClick={() => setSelectedTrustUserId(item.userId /* or creator_id — use whichever field has the other user's ID */)}
  className="cursor-pointer hover:opacity-80 transition-opacity text-left"
>
  <TrustPathBadge trustPath={trustPath} compact />
</button>
```

- [ ] **Render TrustCard conditionally**

```tsx
{selectedTrustUserId && (
  <TrustCard userId={selectedTrustUserId} onClose={() => setSelectedTrustUserId(null)} />
)}
```

- [ ] **Verify** — click a trust path badge on a feed item. TrustCard modal opens with correct user data.

---

## Task 6: Frontend — ProfileTagsSection on /profile

**Files:**
- Create: `apps/frontend/src/components/ProfileTagsSection.tsx`
- Modify: `apps/frontend/src/pages/profile.tsx`

- [ ] **Create `ProfileTagsSection.tsx`**

Design requirements:
- Three sections: Skills, Interests, Needs (rendered identically, different label and tag_type)
- Each section: current tags as chips (with ✕ to remove), + Add button
- Clicking Add: shows a small dropdown with predefined suggestions + a text input for freeform
- Saves immediately on add/remove (no Save button)
- Max 10 tags per type (warn client-side, do not disable)
- Fetches tags on mount from `GET /api/auth/profile/tags`
- Fetches suggestions from `GET /api/auth/profile/tags/suggestions?tag_type={type}`

```typescript
// apps/frontend/src/components/ProfileTagsSection.tsx
import { useEffect, useState, useRef } from 'react';
import { apiClient } from '@/lib/api';

type TagType = 'skill' | 'interest' | 'need';

interface Tag {
  id: string;
  tag_value: string;
}

interface TagGroupState {
  tags: Tag[];
  suggestions: string[];
  adding: boolean;
  inputValue: string;
  loading: boolean;
}

const SECTION_CONFIG: { type: TagType; label: string; placeholder: string; description: string }[] = [
  { type: 'skill',    label: 'Skills',    placeholder: 'e.g. Carpentry, Spanish tutoring...', description: 'What can you offer?' },
  { type: 'interest', label: 'Interests', placeholder: 'e.g. Urban gardening, Food access...', description: 'What do you care about?' },
  { type: 'need',     label: 'Needs',     placeholder: 'e.g. Rides on weekdays, Help moving...', description: 'What might you need?' },
];

export function ProfileTagsSection() {
  const [groups, setGroups] = useState<Record<TagType, TagGroupState>>({
    skill:    { tags: [], suggestions: [], adding: false, inputValue: '', loading: false },
    interest: { tags: [], suggestions: [], adding: false, inputValue: '', loading: false },
    need:     { tags: [], suggestions: [], adding: false, inputValue: '', loading: false },
  });

  useEffect(() => {
    apiClient.get('/auth/profile/tags').then(res => {
      const { skills, interests, needs } = res.data.data;
      setGroups(prev => ({
        skill:    { ...prev.skill,    tags: skills },
        interest: { ...prev.interest, tags: interests },
        need:     { ...prev.need,     tags: needs },
      }));
    });

    (['skill', 'interest', 'need'] as TagType[]).forEach(type => {
      apiClient.get(`/auth/profile/tags/suggestions?tag_type=${type}`).then(res => {
        setGroups(prev => ({ ...prev, [type]: { ...prev[type], suggestions: res.data.data } }));
      });
    });
  }, []);

  const addTag = async (type: TagType, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (groups[type].tags.length >= 10) return;
    const res = await apiClient.post('/auth/profile/tags', { tag_type: type, tag_value: trimmed });
    if (res.data.data) {
      setGroups(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          tags: [...prev[type].tags, res.data.data],
          adding: false,
          inputValue: '',
        },
      }));
    }
  };

  const removeTag = async (type: TagType, tagId: string) => {
    await apiClient.delete(`/auth/profile/tags/${tagId}`);
    setGroups(prev => ({
      ...prev,
      [type]: { ...prev[type], tags: prev[type].tags.filter(t => t.id !== tagId) },
    }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">About You</h2>
      {SECTION_CONFIG.map(({ type, label, placeholder, description }) => {
        const group = groups[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-gray-700">{label}</h3>
              <span className="text-xs text-gray-400">{description}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {group.tags.map(tag => (
                <span key={tag.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-800 text-sm">
                  {tag.tag_value}
                  <button onClick={() => removeTag(type, tag.id)} className="text-green-500 hover:text-green-700 ml-1">✕</button>
                </span>
              ))}
              {!group.adding && (
                <button
                  onClick={() => setGroups(prev => ({ ...prev, [type]: { ...prev[type], adding: true } }))}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 text-sm hover:border-green-400 hover:text-green-600"
                >
                  + Add
                </button>
              )}
            </div>
            {group.adding && (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  type="text"
                  value={group.inputValue}
                  onChange={e => setGroups(prev => ({ ...prev, [type]: { ...prev[type], inputValue: e.target.value } }))}
                  onKeyDown={e => { if (e.key === 'Enter') addTag(type, group.inputValue); if (e.key === 'Escape') setGroups(prev => ({ ...prev, [type]: { ...prev[type], adding: false, inputValue: '' } })); }}
                  placeholder={placeholder}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 w-full max-w-xs"
                />
                {group.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {group.suggestions.filter(s => !group.tags.some(t => t.tag_value === s)).slice(0, 6).map(s => (
                      <button key={s} onClick={() => addTag(type, s)} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {group.tags.length >= 10 && (
                  <p className="text-xs text-amber-600">You've added 10 {label.toLowerCase()} — consider removing one first.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Add `ProfileTagsSection` to `pages/profile.tsx`**

Read the file first to find the right insertion point (below the main profile card, before provider tab section). Add:
```tsx
import { ProfileTagsSection } from '@/components/ProfileTagsSection';
// In JSX, below the main profile info section:
<ProfileTagsSection />
```

- [ ] **Verify** — open `/profile`, see three tag sections, add a skill using suggestion chip, add an interest with freeform input, remove it. All persist on refresh.

---

## Task 7: TDD tests

**Files:**
- Create: `tests/tdd/sprint-38-trust-profile.test.ts`

- [ ] **Write tests for trust tier computation**

```typescript
// tests/tdd/sprint-38-trust-profile.test.ts
import { describe, it, expect } from '@jest/globals';

// Trust tier thresholds
function getTrustTier(karma: number): 'Pillar' | 'Trusted' | 'Emerging' {
  if (karma >= 100) return 'Pillar';
  if (karma >= 30) return 'Trusted';
  return 'Emerging';
}

describe('Trust tier computation', () => {
  it('returns Emerging for karma 0', () => expect(getTrustTier(0)).toBe('Emerging'));
  it('returns Emerging for karma 29', () => expect(getTrustTier(29)).toBe('Emerging'));
  it('returns Trusted for karma 30', () => expect(getTrustTier(30)).toBe('Trusted'));
  it('returns Trusted for karma 99', () => expect(getTrustTier(99)).toBe('Trusted'));
  it('returns Pillar for karma 100', () => expect(getTrustTier(100)).toBe('Pillar'));
  it('returns Pillar for karma 500', () => expect(getTrustTier(500)).toBe('Pillar'));
});

describe('Completion rate display', () => {
  it('does not multiply by 100 — backend already returns 0-100', () => {
    const completionRate = 75.0; // as returned from API
    const displayed = Math.round(Number(completionRate));
    expect(displayed).toBe(75);
    expect(displayed).not.toBe(7500);
  });
});
```

- [ ] **Add rendering tests for TrustCard and ProfileTagsSection** using `@testing-library/react`. Test:
  - TrustCard shows loading state then renders tier badge
  - TrustCard shows "No direct connection" when path is empty
  - ProfileTagsSection renders three sections (Skills, Interests, Needs)
  - Clicking ✕ on a tag calls the delete API

- [ ] **Run TDD tests**

```bash
npm run test:tdd -- --testPathPattern=sprint-38
```

- [ ] **Confirm all tests pass** (or document known integration failures clearly in test comments).

---

## Task 8: User guides + landing page docs

**Files:**
- Create: `docs/guides/understanding-trust.md`
- Create: `docs/guides/profile-guide.md`
- Create: `docs/concepts/trust-path.md`
- Modify: `scripts/generate-docs.ts`

- [ ] **Create `docs/guides/understanding-trust.md`**

```markdown
# Understanding Trust on Karmyq

## Trust Tiers

Every member has a trust tier based on their karma in the community:

- **Emerging** — newer to the community, building a track record
- **Trusted** — established member with positive contribution history
- **Pillar** — a cornerstone of the community with deep roots

Trust tiers are not rankings or status symbols. They reflect how long and how actively someone has been part of the mutual aid ecosystem.

## Reading the Trust Path

When you see a request in your feed, a trust badge shows how you are connected to the person who posted it. For example:

> **You → Maria (87 karma) → Alex**

This means you know Maria through a completed exchange, and Maria knows Alex. You are two degrees apart.

## Opening the Trust Card

Click the connection badge on any feed item to open the full Trust Card. It shows:
- The person's trust tier and karma score
- The full connection chain, step by step
- How they joined your community (invitation chain), if different

## Why Member Profiles Stay Private

Karmyq is a platform of relationships, not a browsable directory. You see trust information about someone only when there is a live connection between you — a match, a curated feed item. This is intentional. The trust path is earned through real interactions, not profile browsing.
```

- [ ] **Create `docs/guides/profile-guide.md`**

```markdown
# Your Profile on Karmyq

## Skills, Interests, and Needs

Your profile lets you share three things about yourself:

- **Skills** — what you can offer ("Carpentry", "Spanish tutoring", "Bookkeeping")
- **Interests** — what you care about ("Urban gardening", "Food access")
- **Needs** — what you might need help with ("Childcare swaps", "Help moving")

These are global — they apply across all your communities.

## Adding Tags

Open your profile and scroll to the "About You" section. Click **+ Add** next to any category. You can pick from suggested tags or type your own. Tags save immediately.

## Why Keep It Simple

Karmyq does not ask for a resumé. Skills, interests, and needs are lightweight signals — enough for the platform to start finding better matches over time, without requiring you to maintain a detailed profile. Let it evolve naturally.
```

- [ ] **Create `docs/concepts/trust-path.md`**

```markdown
# Trust Paths

## How Connections Form

A trust path is the chain of relationships between two people on Karmyq. Connections form through:

1. **Exchange** — two people complete a mutual aid match. This is the strongest signal.
2. **Community** — two people share a community. A weaker but real connection.
3. **Invitation** — one person invited the other to join Karmyq.

## Degrees of Separation

Karmyq computes the shortest path between any two users, up to 4 degrees. A path of 1 means you have a direct connection. A path of 3 means there are two people between you.

## Trust Tiers

| Tier | Karma Range | Meaning |
|------|------------|---------|
| Emerging | 0–29 | Building track record |
| Trusted | 30–99 | Established contributor |
| Pillar | 100+ | Community cornerstone |

Karma at each step in the path shows the strength of intermediate connections.

## Philosophy

Trust paths make the invisible visible — you can see *why* a match feels safe, not just *that* it does. The platform never shows you a stranger; it shows you how close a connection already exists.
```

- [ ] **Add guides and concept to `scripts/generate-docs.ts`**

Read the file first, then add:
- `'understanding-trust'` to GUIDE_ORDER (and GUIDE_LABELS, GUIDE_SLUGS)
- `'profile-guide'` to GUIDE_ORDER (and GUIDE_LABELS, GUIDE_SLUGS)
- `'trust-path'` to the concepts/howItWorks array (check exact structure in the file)

- [ ] **Regenerate and force-add landing docs**

```bash
cd c:/Users/ravic/development/karmyq
npm test -- --testPathPattern=docs-generation
git add -f apps/landing/src/data/docs/
```

---

## Task 9: CONTEXT.md + registry.json

**Files:**
- Modify: `services/social-graph-service/CONTEXT.md`
- Modify: `services/auth-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `social-graph-service/CONTEXT.md`** — add `GET /social-graph/trust-card/:targetUserId` to the API Endpoints section.

- [ ] **Update `auth-service/CONTEXT.md`** — add the four profile/tags endpoints to the API Endpoints section.

- [ ] **Update `services/registry.json`** — add new endpoints to `social-graph-service` and `auth-service` `apis.provides` arrays.

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

Fix any issues it reports.

---

## Task 10: Final type check + pre-push verification

- [ ] **TypeScript check across modified services**

```bash
cd services/social-graph-service && npx tsc --noEmit
cd ../auth-service && npx tsc --noEmit
cd ../../apps/frontend && npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Run full test suite**

```bash
cd c:/Users/ravic/development/karmyq
npm test
```

All unit + regression tests must pass.

- [ ] **Run TDD tests**

```bash
npm run test:tdd
```

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Final git status review** — confirm no unintended files staged. Then commit:

```bash
git add -A
git commit -m "feat: Sprint 38 — Contextual Trust + Member Profile Depth v9.13.0"
```

---

## Task 11: Merge + Deploy

Use the `/deploy` skill.

- [ ] **Merge to master**

```bash
git checkout master
git merge feature/sprint-38-trust-profile
git push origin master
```

- [ ] **Apply DB migration on demo server**

```bash
ssh ubuntu@karmyq.com
psql $DATABASE_URL -f ~/karmyq/infrastructure/postgres/migrations/20260324-user-tags.sql
```

- [ ] **Monitor GitHub Actions** — confirm build → deploy → health check all green.

- [ ] **Smoke test on karmyq.com**
  - Open feed → click a trust path badge → TrustCard opens with correct path
  - Open `/profile` → Skills/Interests/Needs sections visible → add a tag → confirm persists
  - Open Provider dashboard → completion rate shows correctly (e.g. `85%` not `8500%`)

- [ ] **Update handoff** with Sprint 38 complete status and Sprint 39 context.
