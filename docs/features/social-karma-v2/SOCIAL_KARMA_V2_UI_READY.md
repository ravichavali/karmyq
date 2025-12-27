# Social Karma v2.0 - UI Implementation Ready

> **Date**: 2025-12-13
> **Status**: Backend Complete, UI Designs Ready, Test Data Seeded
> **Version**: 7.0.0

## ✅ What's Complete

### 1. UI Component Designs
**Document**: [docs/UI_COMPONENTS_SOCIAL_KARMA_V2.md](UI_COMPONENTS_SOCIAL_KARMA_V2.md)

Complete visual designs and specifications for:
- **Dashboard Hero Section** - Network strength widget (top priority)
- **Milestone Posts** - Celebration posts in feed
- **Featured Stories** - Privacy-aware success stories
- **Feedback Prompt** - Post-match rating flow
- **Trust Score Badges** - Quality indicators on cards
- **Community Health Widget** - Sidebar/tab metrics
- **Personal Impact Card** - Profile stats

All components include:
- Visual mockups (ASCII art)
- TypeScript interfaces
- API integration specs
- Color schemes
- Accessibility notes

### 2. Feed Service APIs
**File**: [services/feed-service/src/services/socialKarmaFeedComposer.ts](../services/feed-service/src/services/socialKarmaFeedComposer.ts)

**New Endpoints**:
```
GET /feed/milestones?community_id=<id>
→ Returns: milestone posts with achievement details

GET /feed/featured-stories?community_id=<id>
→ Returns: privacy-aware featured stories

GET /feed/community-health?community_id=<id>
→ Returns: network strength, growth trends, metrics

GET /feed/mixed?community_id=<id>
→ Returns: interleaved feed (milestones + stories)
```

**Features**:
- Privacy-aware story composition (anonymous/named based on consent)
- Milestone pinning (48-hour priority)
- Network strength calculation
- Growth trend analysis
- Smart feed interleaving

### 3. Test Data
**Script**: [tests/e2e/seed-social-karma-v2-simple.sql](../tests/e2e/seed-social-karma-v2-simple.sql)

**Seeded Data** ✅:
- 5 milestone events (matches_10, participants_10, matches_50, quality_40, participants_25)
- 2 health metrics snapshots (7 days ago, today)
- Simulated network strength: 78.5/100 (Strong)
- Simulated growth: +12.5% (7-day trend)

**Test Community ID**: `f4269736-1286-46b6-8d60-c08db7ab13f6`

To reseed:
```bash
cat tests/e2e/seed-social-karma-v2-simple.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

---

## 🎯 Implementation Priorities

### Phase 1: High Impact, Quick Wins (Start Here!)

**1. Community Health Hero** (Top of Dashboard)
```typescript
// Component: apps/frontend/components/CommunityHealthHero.tsx
// API: GET /feed/community-health?community_id=<id>
// Priority: HIGHEST - Most visible, drives engagement
```

**Visual Impact**:
```
┌─────────────────────────────────────────┐
│ 🌟 Portland Mutual Aid                  │
│ Network Strength: 78.5/100 ↗️ +12.5%   │
│ 50 exchanges • 18 helpers active        │
└─────────────────────────────────────────┘
```

**Why First**: Users see this every time they open the app. Sets the tone for community-focused metrics.

---

**2. Milestone Posts in Feed**
```typescript
// Component: apps/frontend/components/feed/MilestonePost.tsx
// API: GET /feed/milestones?community_id=<id>
// Priority: HIGH - Celebration drives engagement
```

**Visual Impact**:
```
┌─────────────────────────────────────────┐
│ 🎉 MILESTONE ACHIEVED!                  │
│ Reached 50 successful help exchanges!   │
│ Network Strength: 78.5 (+5.2 this week) │
└─────────────────────────────────────────┘
```

**Why Second**: Social proof, feels good, motivates participation.

---

**3. Post-Match Feedback Prompt**
```typescript
// Component: apps/frontend/components/FeedbackPrompt.tsx
// API: POST /matches/:matchId/feedback
// Priority: HIGH - Drives data collection
```

**Visual Impact**:
```
How was your exchange with Alex?

Helpfulness:     ⭐⭐⭐⭐⭐
Responsiveness:  ⭐⭐⭐⭐⭐
Clarity:         ⭐⭐⭐⭐⭐

☐ Share as a featured story (anonymous)
```

**Why Third**: Without feedback, no stories. This populates the system.

---

### Phase 2: Polish & Delight

**4. Featured Stories in Feed**
```typescript
// Component: apps/frontend/components/feed/FeaturedStory.tsx
// API: GET /feed/featured-stories?community_id=<id>
```

**5. Trust Score Badges on Cards**
```typescript
// Enhancement to existing components
// API: GET /reputation/trust/:userId/:communityId
```

**6. Community Health Widget** (Sidebar/Tab)
```typescript
// Component: apps/frontend/components/CommunityHealthWidget.tsx
```

---

## 📡 API Integration Guide

### Authentication
All endpoints require JWT token:
```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Community-ID': communityId
}
```

### Example API Calls

**Get Community Health for Hero**:
```typescript
const response = await fetch(
  `/feed/community-health?community_id=${communityId}`,
  { headers: authHeaders }
);

// Response:
{
  "success": true,
  "data": {
    "communityId": "...",
    "communityName": "Portland Mutual Aid",
    "networkStrength": 78.5,
    "networkStrengthLabel": "Strong",
    "totalMatches": 50,
    "activeHelpers": 18,
    "growthRate": 12.5,
    "trendDirection": "growing"
  }
}
```

**Get Milestones for Feed**:
```typescript
const response = await fetch(
  `/feed/milestones?community_id=${communityId}&limit=5`,
  { headers: authHeaders }
);

// Response:
{
  "success": true,
  "data": [
    {
      "id": "...",
      "type": "milestone",
      "milestoneType": "matches_50",
      "description": "Reached 50 successful help exchanges!",
      "achievedAt": "2025-12-07T...",
      "networkStrength": 78.5,
      "strengthChange": 5.2,
      "isPinned": true,
      "communityId": "...",
      "communityName": "Portland Mutual Aid"
    }
  ]
}
```

**Submit Feedback**:
```typescript
const response = await fetch(
  `/matches/${matchId}/feedback`,
  {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_user_id: userId,
      helpfulness: 5,
      responsiveness: 5,
      clarity: 5,
      comment: "Super helpful!",
      allow_featuring: true
    })
  }
);
```

---

## 🎨 Design System Reference

### Colors (Tailwind CSS)

```typescript
const colors = {
  networkThriving: 'emerald-500',    // 80-100
  networkStrong: 'green-500',         // 60-79
  networkGrowing: 'amber-500',        // 40-59
  networkDeveloping: 'orange-400',    // 20-39
  networkBuilding: 'slate-400',       // 0-19

  milestone: 'purple-500',            // Celebration
  featuredStory: 'blue-500',          // Story highlight
  qualityExcellent: 'yellow-400',     // 5-star rating
};
```

### Typography

```typescript
const textStyles = {
  heroTitle: 'text-2xl font-bold text-gray-900',
  metricValue: 'text-4xl font-bold text-gray-900',
  metricLabel: 'text-sm text-gray-600',
  feedbackComment: 'text-base italic text-gray-700',
  badge: 'text-xs font-semibold px-2 py-1 rounded',
};
```

---

## 🧪 Testing the APIs (Manual)

**1. Get a JWT Token**:
```bash
# Login to get token
TOKEN=$(curl -s http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.data.token')
```

**2. Test Milestones**:
```bash
curl "http://localhost:3007/feed/milestones?community_id=f4269736-1286-46b6-8d60-c08db7ab13f6" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**3. Test Community Health**:
```bash
curl "http://localhost:3007/feed/community-health?community_id=f4269736-1286-46b6-8d60-c08db7ab13f6" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**4. Test Mixed Feed**:
```bash
curl "http://localhost:3007/feed/mixed?community_id=f4269736-1286-46b6-8d60-c08db7ab13f6" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 📋 Frontend Implementation Checklist

### Community Health Hero
- [ ] Create `CommunityHealthHero.tsx` component
- [ ] Add network strength progress bar/gauge
- [ ] Add growth trend indicator (↗️↘️→)
- [ ] Add API polling (every 5 minutes)
- [ ] Add to top of dashboard page

### Milestone Posts
- [ ] Create `MilestonePost.tsx` component
- [ ] Add celebration emoji/animation
- [ ] Add pinning logic (top for 48 hours)
- [ ] Integrate into feed composer
- [ ] Add celebration reaction feature (optional)

### Feedback Prompt
- [ ] Create `FeedbackPrompt.tsx` modal/sheet
- [ ] Add star rating input (1-5)
- [ ] Add comment textarea
- [ ] Add "allow featuring" checkbox
- [ ] Trigger on match completion
- [ ] Add "skip for now" option

### Featured Stories
- [ ] Create `FeaturedStory.tsx` component
- [ ] Handle anonymous vs named stories
- [ ] Display star ratings visually
- [ ] Add interaction category badge
- [ ] Integrate into feed composer

### Trust Score Badges
- [ ] Enhance `RequestCard.tsx` with badge
- [ ] Enhance `OfferCard.tsx` with badge
- [ ] Only show if ≥ 3 exchanges
- [ ] Use color coding (emerald/green/amber)

---

## 🚀 Quick Start (Frontend Developer)

1. **Start with the Hero**:
   - Copy mockup from [UI_COMPONENTS_SOCIAL_KARMA_V2.md](UI_COMPONENTS_SOCIAL_KARMA_V2.md)
   - Create component in `apps/frontend/components/`
   - Fetch from `/feed/community-health`
   - Add to dashboard page

2. **Test with Real Data**:
   - Use community ID: `f4269736-1286-46b6-8d60-c08db7ab13f6`
   - Data is already seeded
   - APIs are running on port 3007

3. **Iterate**:
   - Start simple (text only)
   - Add styling
   - Add interactivity
   - Polish animations

---

## 📊 Expected User Experience

### Before (Current)
```
User opens app
  ↓
Sees list of requests
  ↓
No sense of community health
  ↓
No motivation beyond individual karma
```

### After (Social Karma v2.0)
```
User opens app
  ↓
"🌟 Network Strength: 78.5 - Strong!"
  ↓
"🎉 We just hit 50 exchanges!"
  ↓
Sees featured story: "Super helpful!"
  ↓
Feels part of thriving community
  ↓
Motivated to contribute
```

---

## 🎯 Success Metrics (How We'll Know It Works)

1. **Visibility**: Hero section visible on 100% of dashboard loads
2. **Engagement**: Feedback submission rate >60% (vs current 0%)
3. **Stories**: 10+ featured stories per week per community
4. **Milestones**: Users celebrate milestones (reactions/comments)
5. **Retention**: Users check dashboard daily to see network strength

---

## 💡 Design Philosophy

**Key Insight**: Hidden metrics don't drive behavior.

**Solution**: Make metrics unavoidable, social, and celebratory.

**Result**: Users see community health every time they open the app, not just when they dig into profiles.

---

**Ready to build? Start with the Community Health Hero!** 🚀
