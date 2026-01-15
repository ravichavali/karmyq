# Minimal Karma Measurement (Private-First)

**Date**: 2026-01-09
**Status**: Proposed
**Priority**: P1 - Medium Priority
**Estimated Effort**: 6-8 hours
**Related**: [Fractal Karma & Trust](../concepts/FRACTAL_KARMA_TRUST.md)

## Philosophy

**Core Principles**:
1. **Private by default** - No public leaderboards, no competition
2. **Encouragement, not gamification** - Help people understand their contribution
3. **Opt-in display** - Users choose if they want to see their score
4. **Fractal design** - Same concept for users and communities

**Anti-Goals**:
- ❌ No public karma displays
- ❌ No leaderboards or rankings
- ❌ No karma requirements ("must have X karma to...")
- ❌ No competitive elements
- ❌ No pressure to increase score

---

## User Story

**As a** community member
**I want to** understand my contribution level privately
**So that** I can see if I'm helping as much as I'd like to, without feeling judged or pressured

---

## Minimal Implementation

### Phase 1: Backend Calculation Only (4 hours)

**Goal**: Calculate karma, don't display it yet

**What to build**:

1. **Karma calculation service** (already partially exists in reputation service)
   - Calculate karma from completed matches
   - Apply 6-month half-life decay (ADR-011)
   - Store in `reputation.karma_records` table
   - Scope: per user, per community

2. **Private API endpoint**
   ```typescript
   GET /users/me/karma?community_id={id}

   Response:
   {
     "karma": 150,
     "trend": "growing", // or "stable", "declining"
     "recent_helps": 5,
     "recent_requests": 3,
     "last_updated": "2026-01-09T..."
   }
   ```

3. **Background job** (runs daily)
   - Recalculate all karma scores
   - Apply decay
   - Update trends

**No UI yet** - Just the data infrastructure

### Phase 2: Opt-In Private Display (2-4 hours)

**Goal**: Let users see their own karma if they want to

**What to build**:

1. **User setting** (in privacy/preferences)
   ```typescript
   // auth.user_privacy_settings table
   show_my_karma_to_me: boolean DEFAULT false
   ```

2. **Profile display** (only if setting enabled)
   ```
   [Your Profile]
   ─────────────────────────
   Alex Chen
   Portland Tools Community

   [If show_my_karma_to_me = true]
   ┌──────────────────────┐
   │ Your Contribution    │
   │ 150 karma (growing)  │
   │ 5 recent helps       │
   │ 3 recent requests    │
   └──────────────────────┘

   [Always visible]
   Skills: Carpentry, Plumbing
   Member since: 8 months ago
   ```

3. **Settings UI**
   ```
   Privacy Settings
   ─────────────────
   □ Show my karma score to me
     (This is only visible to you, never public)
   ```

**Default**: OFF (users opt-in)

---

## Technical Implementation

### Database (No Changes Needed)

Existing schema already supports this:

```sql
-- reputation.karma_records (already exists)
CREATE TABLE reputation.karma_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  community_id UUID REFERENCES community.communities(id),
  points INTEGER NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- For decay
);

-- Index for user karma lookups
CREATE INDEX idx_karma_user_community ON reputation.karma_records(user_id, community_id);
```

**Need to add** (for user setting):

```sql
-- auth.user_privacy_settings (create if doesn't exist)
ALTER TABLE auth.user_privacy_settings
ADD COLUMN show_my_karma_to_me BOOLEAN DEFAULT FALSE;
```

### API Endpoints

**New endpoint** (reputation service):

```typescript
// GET /users/me/karma?community_id={id}
router.get('/users/me/karma', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const communityId = req.query.community_id;

  // Calculate current karma (sum with decay)
  const karma = await calculateUserKarma(userId, communityId);

  // Get trend (compare to last week)
  const trend = await getKarmaTrend(userId, communityId);

  // Get recent activity
  const recentHelps = await countRecentMatches(userId, communityId, 'helper');
  const recentRequests = await countRecentMatches(userId, communityId, 'requester');

  res.json({
    karma,
    trend,
    recent_helps: recentHelps,
    recent_requests: recentRequests,
    last_updated: new Date()
  });
});
```

**Karma calculation logic**:

```typescript
async function calculateUserKarma(userId: string, communityId: string): Promise<number> {
  const halfLife = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in ms
  const now = Date.now();

  // Get all karma records for user in community
  const records = await db.query(`
    SELECT points, created_at
    FROM reputation.karma_records
    WHERE user_id = $1 AND community_id = $2
    ORDER BY created_at DESC
  `, [userId, communityId]);

  // Apply exponential decay
  let totalKarma = 0;
  for (const record of records) {
    const age = now - record.created_at.getTime();
    const decayFactor = Math.pow(0.5, age / halfLife);
    totalKarma += record.points * decayFactor;
  }

  return Math.round(totalKarma);
}

async function getKarmaTrend(userId: string, communityId: string): Promise<'growing' | 'stable' | 'declining'> {
  const currentKarma = await calculateUserKarma(userId, communityId);
  const lastWeekKarma = await calculateUserKarmaAtTime(userId, communityId, Date.now() - 7 * 24 * 60 * 60 * 1000);

  const change = currentKarma - lastWeekKarma;
  if (change > 10) return 'growing';
  if (change < -10) return 'declining';
  return 'stable';
}
```

### Frontend Changes

**Profile page** (apps/frontend/src/pages/profile.tsx):

```typescript
const Profile = () => {
  const [showKarma, setShowKarma] = useState(false);
  const [karma, setKarma] = useState(null);

  useEffect(() => {
    // Load user privacy settings
    fetch('/api/users/me/settings')
      .then(res => res.json())
      .then(data => {
        setShowKarma(data.show_my_karma_to_me);

        // Only fetch karma if user wants to see it
        if (data.show_my_karma_to_me) {
          fetch(`/api/users/me/karma?community_id=${currentCommunityId}`)
            .then(res => res.json())
            .then(setKarma);
        }
      });
  }, []);

  return (
    <div>
      <h1>{user.name}</h1>

      {showKarma && karma && (
        <div className="karma-display">
          <h3>Your Contribution</h3>
          <p>{karma.karma} karma ({karma.trend})</p>
          <p>{karma.recent_helps} recent helps</p>
          <p>{karma.recent_requests} recent requests</p>
        </div>
      )}

      {/* Rest of profile... */}
    </div>
  );
};
```

**Settings page** (apps/frontend/src/pages/settings/privacy.tsx):

```typescript
const PrivacySettings = () => {
  const [showMyKarma, setShowMyKarma] = useState(false);

  const handleToggle = async () => {
    await fetch('/api/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify({ show_my_karma_to_me: !showMyKarma })
    });
    setShowMyKarma(!showMyKarma);
  };

  return (
    <div>
      <h2>Privacy Settings</h2>

      <label>
        <input
          type="checkbox"
          checked={showMyKarma}
          onChange={handleToggle}
        />
        Show my karma score to me
        <p className="help-text">
          This is only visible to you, never public.
          It helps you understand your contribution level.
        </p>
      </label>
    </div>
  );
};
```

---

## Testing Requirements

### Backend Tests

```typescript
describe('Karma Calculation', () => {
  it('calculates karma from completed matches', async () => {
    // Create user, create matches, calculate karma
    const karma = await calculateUserKarma(userId, communityId);
    expect(karma).toBeGreaterThan(0);
  });

  it('applies 6-month half-life decay', async () => {
    // Create old karma record (1 year ago)
    // Check that it's decayed to ~25% of original
  });

  it('calculates trend correctly', async () => {
    // Add recent karma, check trend = "growing"
  });

  it('only returns karma for current user', async () => {
    // Try to get another user's karma, expect 403
  });
});
```

### Frontend Tests

```typescript
describe('Karma Display', () => {
  it('hides karma by default', () => {
    render(<Profile />);
    expect(screen.queryByText(/karma/i)).not.toBeInTheDocument();
  });

  it('shows karma when setting enabled', () => {
    // Mock user settings with show_my_karma_to_me: true
    render(<Profile />);
    expect(screen.getByText(/Your Contribution/i)).toBeInTheDocument();
  });

  it('allows toggling karma display in settings', () => {
    render(<PrivacySettings />);
    const checkbox = screen.getByLabelText(/show my karma/i);
    fireEvent.click(checkbox);
    // Verify API call made
  });
});
```

---

## Community Karma (Future)

Not in this phase, but following fractal design:

**Community karma** would be calculated similarly:

```typescript
interface CommunityKarma {
  total_matches_completed: number;
  completion_rate: number; // % of requests that got fulfilled
  active_members: number; // members who helped/requested in last 30 days
  trend: 'growing' | 'stable' | 'declining';
}
```

**Displayed on community page** (public, transparent):

```
Portland Tools Community
────────────────────────
158 members, 89 active this month

Community Activity
├─ 52 matches completed
├─ 89% completion rate
└─ Growing trend
```

**No ranking** - Just this community's health, not compared to others

---

## Success Metrics

**How we know this is working**:

1. **Adoption**: % of users who enable "show my karma"
   - Target: 30-50% (not everyone will want to see it)

2. **Engagement**: Do users who see karma help more?
   - Compare help frequency: karma viewers vs non-viewers
   - Hypothesis: Visibility encourages contribution

3. **Sentiment**: Does it feel encouraging or pressuring?
   - Survey: "Does seeing your karma make you feel..."
     - ✅ Encouraged / Aware of impact
     - ❌ Pressured / Judged / Competitive
   - Target: >70% positive sentiment

4. **No negative effects**: Does hiding karma reduce participation?
   - Compare: users who never enable it
   - Hypothesis: Should make no difference (it's opt-in)

**If metrics are bad**: Remove the feature, it's not helping

---

## Open Questions

1. **Should karma be shown during matches?**
   - "You'll earn 10 karma for helping with this"
   - Pro: Transparency, motivation
   - Con: Feels transactional, gamified
   - **Recommendation**: No, keep karma separate from action

2. **Should karma affect anything functional?**
   - Higher karma = more privileges?
   - **Recommendation**: No, keep it purely informational

3. **Should there be karma milestones?**
   - "You've reached 100 karma!" notification
   - Pro: Celebration, encouragement
   - Con: Gamification, pressure to hit next milestone
   - **Recommendation**: Maybe later, start without

4. **What if someone wants to see others' karma?**
   - "I want to know if this person is reliable"
   - **Recommendation**: Show completion rate (%), not karma score
   - Completion rate = functional info, karma = personal metric

---

## Implementation Plan

### Week 1: Backend (4 hours)

- [ ] Create karma calculation service (or enhance existing)
- [ ] Add `/users/me/karma` API endpoint
- [ ] Add privacy setting to user_privacy_settings table
- [ ] Write unit tests for karma calculation
- [ ] Write integration tests for API endpoint

### Week 2: Frontend (2-4 hours)

- [ ] Add privacy setting toggle in settings page
- [ ] Add karma display to profile page (conditional)
- [ ] Style karma display (subtle, non-gamified)
- [ ] Write component tests
- [ ] Test with real users (internal team first)

### Week 3: Validation & Learning

- [ ] Deploy to staging
- [ ] Enable for 10-20 beta users
- [ ] Gather feedback via survey
- [ ] Monitor: adoption rate, sentiment, engagement
- [ ] Decide: continue, iterate, or remove

---

## Design Mockups

### Profile Page (Karma Enabled)

```
┌─────────────────────────────────────┐
│ Alex Chen                           │
│ Portland Tools                      │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Your Contribution (Private)     ││
│ │                                 ││
│ │ 150 karma                       ││
│ │ Growing this week               ││
│ │                                 ││
│ │ Recent Activity:                ││
│ │ • 5 helps given                 ││
│ │ • 3 requests made               ││
│ └─────────────────────────────────┘│
│                                     │
│ Skills                              │
│ • Carpentry                         │
│ • Plumbing                          │
│                                     │
│ Member since 8 months ago           │
└─────────────────────────────────────┘
```

### Settings Page

```
┌─────────────────────────────────────┐
│ Privacy Settings                    │
│                                     │
│ Karma & Stats                       │
│                                     │
│ ☐ Show my karma score to me         │
│                                     │
│   Your karma score is a private     │
│   measure of your contribution.     │
│   It's only visible to you, never   │
│   shared publicly.                  │
│                                     │
│   Use it to understand your impact  │
│   and stay encouraged.              │
│                                     │
│ [Save Changes]                      │
└─────────────────────────────────────┘
```

---

## Related Documents

- [Fractal Karma & Trust](../concepts/FRACTAL_KARMA_TRUST.md) - Conceptual foundation
- [ADR-011: Reputation Decay](../adr/ADR-011-reputation-decay.md) - Existing karma system
- [Trust & Reputation Features Backlog](TRUST_REPUTATION_FEATURES.md) - Larger feature set (now deprecated/revised)

---

## Decision Log

**2026-01-09**: Created minimal karma measurement approach
- Focus: Private, opt-in, encouragement (not gamification)
- Philosophy: Fractal design (same for users and communities)
- Next: Build backend, validate with small group
