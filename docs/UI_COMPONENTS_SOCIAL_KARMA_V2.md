# Social Karma v2.0 - UI Component Designs

> **Purpose**: Make community health metrics front-and-center to drive engagement
> **Date**: 2025-12-13
> **Version**: 7.0.0

## Design Principle

**Metrics must be visible where users spend time, not hidden in profiles.**

---

## 1. Dashboard Hero Section (Top Priority)

**Location**: `/dashboard` - Above the feed
**Size**: Full-width card, ~120px height
**Updates**: Real-time from cached health_summary

### Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│ 🌟 Portland Mutual Aid                                         │
│                                                                 │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│ │ Network      │  │ Active This  │  │ Growth       │         │
│ │ Strength     │  │ Week         │  │ Trend        │         │
│ │              │  │              │  │              │         │
│ │    78.5      │  │ 156 exchanges│  │  ↗️ +12.5%  │         │
│ │   ━━━━━━━━   │  │ 42 helpers   │  │  7-day      │         │
│ │   Strong     │  │              │  │              │         │
│ └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│ "Your community is thriving! Quality interactions are up 8%"   │
└────────────────────────────────────────────────────────────────┘
```

### Component Props

```typescript
interface CommunityHealthHero {
  communityId: string;
  communityName: string;
  networkStrength: number;        // 0-100
  networkStrengthLabel: string;   // "Weak", "Growing", "Strong", "Thriving"
  totalMatches: number;
  activeHelpers: number;
  growthRate: number;             // percentage
  growthPeriod: "7d" | "30d";
  trendDirection: "growing" | "stable" | "declining";
  motivationalMessage: string;
}
```

### Data Source

```typescript
// API: GET /reputation/community-health/:communityId
// Use cached communities.health_summary for instant load
// Poll every 5 minutes for updates
```

### Network Strength Color Scale

```typescript
const getStrengthColor = (score: number) => {
  if (score >= 80) return { color: "emerald", label: "Thriving" };
  if (score >= 60) return { color: "green", label: "Strong" };
  if (score >= 40) return { color: "amber", label: "Growing" };
  if (score >= 20) return { color: "orange", label: "Developing" };
  return { color: "slate", label: "Building" };
};
```

---

## 2. Feed Integration - Milestone Posts

**Location**: Mixed into main feed (`/dashboard`)
**Frequency**: When milestones are achieved
**Priority**: Pinned to top for 48 hours

### Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│ 🎉 MILESTONE ACHIEVED!                                         │
│                                                                 │
│ Your community reached 100 successful help exchanges!          │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Network Strength: 78.5 (+5.2 this week)                  │  │
│ │ 🌟🌟🌟🌟                                                  │  │
│ │                                                           │  │
│ │ "Every exchange makes our community stronger. Thank you  │  │
│ │  for being part of this journey!"                        │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ 🔥 32 members celebrated this • 2 hours ago                    │
└────────────────────────────────────────────────────────────────┘
```

### Component Props

```typescript
interface MilestonePost {
  id: string;
  milestoneType: "matches_10" | "matches_50" | "matches_100" | "matches_500" |
                 "matches_1000" | "participants_10" | "participants_25" |
                 "participants_50" | "participants_100" | "quality_4.0" |
                 "quality_4.5" | "quality_4.8";
  achievedAt: Date;
  description: string;
  currentNetworkStrength: number;
  strengthChange: number;        // Change since last week
  celebrationCount: number;      // Users who reacted
  isPinned: boolean;             // True for 48 hours
}
```

### Celebration Reactions

```typescript
// Users can react with celebration emojis
// Stored in feed.post_reactions table
// Show top 3 reactors: "🎉 Alice, Bob, Carol and 29 others celebrated"
```

---

## 3. Feed Integration - Featured Stories

**Location**: Mixed into main feed
**Frequency**: When both parties consent to featuring
**Privacy**: Anonymous by default, named only with two-way consent

### Visual Design (Anonymous)

```
┌────────────────────────────────────────────────────────────────┐
│ 💬 Featured Story                                              │
│                                                                 │
│ "Quick response, super helpful with my moving boxes!"          │
│                                                                 │
│ ⭐⭐⭐⭐⭐ Helpfulness                                        │
│ ⭐⭐⭐⭐⭐ Responsiveness                                     │
│ ⭐⭐⭐⭐⭐ Clarity                                            │
│                                                                 │
│ Category: Moving & Transportation                              │
│ 3 hours ago                                                    │
└────────────────────────────────────────────────────────────────┘
```

### Visual Design (Named - Two-Way Consent)

```
┌────────────────────────────────────────────────────────────────┐
│ 💬 Featured Story                                              │
│                                                                 │
│ "Alex was amazing! Helped me move all my boxes in under an     │
│  hour. Super organized and friendly."                          │
│                                                                 │
│ ⭐⭐⭐⭐⭐ Helpfulness • ⭐⭐⭐⭐⭐ Responsiveness           │
│                                                                 │
│ 👤 Sarah thanked Alex • Moving & Transportation                │
│ 3 hours ago                                                    │
└────────────────────────────────────────────────────────────────┘
```

### Component Props

```typescript
interface FeaturedStory {
  id: string;
  comment: string;
  helpfulness: number;           // 1-5
  responsiveness: number;        // 1-5
  clarity: number;               // 1-5
  interactionCategory: string;   // e.g., "Moving & Transportation"
  createdAt: Date;

  // Privacy-aware fields
  isAnonymous: boolean;
  requesterName?: string;        // Only if both consented
  responderName?: string;        // Only if both consented
}
```

---

## 4. Post-Match Feedback Prompt

**Location**: Triggered after completing a match
**Timing**: Modal/sheet immediately after marking match complete
**Dismissible**: Can skip, but encourage with "Help our community grow!"

### Visual Design (Mobile)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│ How was your exchange with Alex?                               │
│                                                                 │
│ Your feedback helps build a stronger community! 🌟             │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Helpfulness                                              │  │
│ │ ⭐ ⭐ ⭐ ⭐ ⭐                                             │  │
│ │                                                           │  │
│ │ Responsiveness                                            │  │
│ │ ⭐ ⭐ ⭐ ⭐ ⭐                                             │  │
│ │                                                           │  │
│ │ Clarity                                                   │  │
│ │ ⭐ ⭐ ⭐ ⭐ ⭐                                             │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Add a comment (optional)                                 │  │
│ │ ┌────────────────────────────────────────────────────┐   │  │
│ │ │ Quick response, very helpful!                      │   │  │
│ │ └────────────────────────────────────────────────────┘   │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ☐ Share as a featured story (anonymous)                        │
│                                                                 │
│ ┌──────────────┐  ┌──────────────┐                            │
│ │ Skip for now │  │ Submit ✓     │                            │
│ └──────────────┘  └──────────────┘                            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Component Props

```typescript
interface FeedbackPrompt {
  matchId: string;
  fromUserId: string;
  toUserId: string;
  toUserName: string;

  // Form state
  helpfulness: number | null;    // 1-5
  responsiveness: number | null; // 1-5
  clarity: number | null;        // 1-5
  comment: string;
  allowFeaturing: boolean;

  onSubmit: (feedback: FeedbackData) => Promise<void>;
  onSkip: () => void;
}
```

### Validation

```typescript
// All three ratings required to submit
// Comment optional but encouraged
// allowFeaturing defaults to false (privacy-first)
```

---

## 5. Request/Offer Cards - Trust Score Badge

**Location**: Every request/offer card in feed and lists
**Purpose**: Show requester's interaction quality without being judgmental

### Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│ 📦 Help needed: Moving boxes                                   │
│                                                                 │
│ Need help moving 20 boxes from my apartment to storage.        │
│ Can provide dolly and packing tape.                            │
│                                                                 │
│ Posted by Alex • ⭐ 4.8 (12 exchanges)                         │
│ 2 hours ago • Moving & Transportation                          │
│                                                                 │
│ [Offer to Help]                                                │
└────────────────────────────────────────────────────────────────┘
```

### Badge Calculation

```typescript
interface TrustBadge {
  averageQuality: number;        // Average of helpfulness, responsiveness, clarity
  totalExchanges: number;        // Total completed matches
  showBadge: boolean;            // Only show if >= 3 exchanges
}

// Display logic
const getBadgeText = (badge: TrustBadge) => {
  if (!badge.showBadge) return null;
  return `⭐ ${badge.averageQuality.toFixed(1)} (${badge.totalExchanges} exchanges)`;
};
```

### Badge Color

```typescript
const getBadgeColor = (avgQuality: number) => {
  if (avgQuality >= 4.5) return "emerald";   // Excellent
  if (avgQuality >= 4.0) return "green";      // Great
  if (avgQuality >= 3.5) return "amber";      // Good
  return "slate";                             // Neutral (no judgment)
};
```

---

## 6. Community Health Widget (Sidebar/Mobile Tab)

**Location**: Right sidebar on desktop, separate tab on mobile
**Purpose**: Always-visible health metrics

### Visual Design

```
┌────────────────────────────────┐
│ Community Health               │
├────────────────────────────────┤
│                                │
│ Network Strength               │
│ ━━━━━━━━━━━━━━━━ 78.5/100    │
│ Strong                         │
│                                │
│ This Week                      │
│ • 23 exchanges                 │
│ • 18 active helpers            │
│ • 4.6 avg quality ⭐          │
│                                │
│ Trending ↗️                    │
│ +12.5% vs last week            │
│                                │
│ Next Milestone                 │
│ 44 more exchanges to reach     │
│ 200 total! 🎯                 │
│                                │
└────────────────────────────────┘
```

### Component Props

```typescript
interface CommunityHealthWidget {
  networkStrength: number;
  networkStrengthLabel: string;
  thisWeek: {
    exchanges: number;
    activeHelpers: number;
    avgQuality: number;
  };
  trend: {
    direction: "up" | "down" | "stable";
    percentage: number;
  };
  nextMilestone: {
    type: string;
    current: number;
    target: number;
    remaining: number;
  } | null;
}
```

---

## 7. Personal Impact Card (Profile)

**Location**: User profile page
**Purpose**: Show individual contribution to community health

### Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│ Your Impact on Portland Mutual Aid                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│ │ Helped         │  │ Received Help  │  │ Your Quality   │   │
│ │                │  │                │  │                │   │
│ │      18        │  │       12       │  │     ⭐ 4.7    │   │
│ │   exchanges    │  │   exchanges    │  │  (8 ratings)   │   │
│ └────────────────┘  └────────────────┘  └────────────────┘   │
│                                                                 │
│ Interaction Quality Breakdown                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Helpfulness      ⭐⭐⭐⭐⭐ 4.8                              │
│ Responsiveness   ⭐⭐⭐⭐⭐ 4.9                              │
│ Clarity          ⭐⭐⭐⭐  4.4                              │
│                                                                 │
│ Recent Feedback                                                │
│ • "Super helpful and responsive!" - 2 days ago                 │
│ • "Clear communication, made it easy" - 1 week ago             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Component Props

```typescript
interface PersonalImpact {
  userId: string;
  communityId: string;
  stats: {
    timesHelped: number;
    timesReceivedHelp: number;
    avgQuality: number;
    totalRatings: number;
  };
  qualityBreakdown: {
    avgHelpfulness: number;
    avgResponsiveness: number;
    avgClarity: number;
  };
  recentFeedback: Array<{
    comment: string;
    createdAt: Date;
  }>;
}
```

---

## Component Hierarchy

```
App
├── Dashboard
│   ├── CommunityHealthHero ← NEW (top priority)
│   ├── Feed
│   │   ├── MilestonePost ← NEW (event-driven)
│   │   ├── FeaturedStory ← NEW (privacy-aware)
│   │   ├── RequestCard (enhanced with trust badge)
│   │   ├── OfferCard (enhanced with trust badge)
│   │   └── ...
│   └── Sidebar
│       └── CommunityHealthWidget ← NEW
│
├── MatchCompletion
│   └── FeedbackPrompt ← NEW (modal/sheet)
│
└── Profile
    └── PersonalImpact ← NEW
```

---

## API Integration Summary

### New API Calls Required

```typescript
// 1. Community Health Hero
GET /reputation/community-health/:communityId
→ Returns: network strength, trends, metrics

// 2. Milestone Posts (via Feed Service)
GET /feed/posts?communityId=:id&type=milestone
→ Returns: milestone posts with metadata

// 3. Featured Stories (via Feed Service)
GET /feed/posts?communityId=:id&type=featured_story
→ Returns: privacy-aware featured stories

// 4. Submit Feedback
POST /matches/:matchId/feedback
→ Body: { helpfulness, responsiveness, clarity, comment, allowFeaturing }

// 5. User Trust Score (for badges on cards)
GET /reputation/trust/:userId/:communityId
→ Returns: avg quality, total exchanges, breakdown

// 6. Personal Impact
GET /reputation/user-impact/:userId/:communityId
→ Returns: comprehensive stats for profile
```

---

## Implementation Priority

### Phase 1: High Impact, Low Effort
1. ✅ **CommunityHealthHero** - Most visible, uses existing API
2. ✅ **FeedbackPrompt** - Drives data collection
3. ✅ **Trust Score Badges** - Minimal UI change, big impact

### Phase 2: Feed Integration
4. ✅ **MilestonePost** - Requires Feed Service update
5. ✅ **FeaturedStory** - Requires Feed Service update

### Phase 3: Polish
6. ✅ **CommunityHealthWidget** - Nice-to-have sidebar
7. ✅ **PersonalImpact** - Profile enhancement

---

## Design System Notes

### Color Palette

```typescript
const colors = {
  milestone: "purple",      // Celebration
  featured: "blue",         // Story highlight
  networkStrong: "emerald", // Thriving community
  networkGrowing: "green",  // Healthy growth
  networkDeveloping: "amber", // Building
  quality5Star: "yellow",   // Excellent rating
};
```

### Typography

```typescript
const textStyles = {
  heroTitle: "text-2xl font-bold",
  metricValue: "text-4xl font-bold",
  metricLabel: "text-sm text-gray-600",
  feedbackComment: "text-base italic",
  badge: "text-xs font-semibold",
};
```

---

## Accessibility

- All star ratings keyboard navigable
- Color + icon + text for network strength (not color alone)
- Screen reader labels for all metrics
- Focus traps for modals
- Skip links for dashboard hero

---

**Next Step**: Implement Feed Service updates to compose these post types!
