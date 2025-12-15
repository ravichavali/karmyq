# Karmyq v7.0 - UI Architecture & Dashboard Redesign

**Version**: 7.0.0
**Date**: December 14, 2025
**Author**: Architecture Team

---

## Executive Summary

Version 7.0 introduces a complete UI overhaul with a modern, information-dense 3-column dashboard layout inspired by contemporary social platforms (Twitter/X, LinkedIn). The redesign focuses on:

- **Information Density**: 3x more information visible without scrolling
- **Interactivity**: All cards are clickable with proper navigation
- **Community Context**: Dynamic content based on selected community
- **User Engagement**: Visual feedback, karma/trust score tracking
- **Social Karma v2**: Integrated community health and milestone displays

---

## Architecture Overview

### 3-Column Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│                         Header (Layout)                      │
├────────────┬──────────────────────────┬────────────────────┤
│            │                          │                     │
│   Left     │      Center Feed         │   Right Sidebar   │
│  Sidebar   │      (50%)               │      (25%)        │
│   (25%)    │                          │                    │
│            │  - Quick Create          │  - Community      │
│  - User    │  - Milestones            │    Health         │
│    Profile │  - Feed Posts            │  - Recent         │
│  - Karma   │  - Requests              │    Milestones     │
│  - Trust   │  - Offers                │  - Top Helpers    │
│  - Comms   │  - Inline Chat           │  - Active Now     │
│            │                          │                    │
│ (sticky)   │  (scrollable)            │  (sticky)         │
└────────────┴──────────────────────────┴────────────────────┘
```

### Responsive Behavior

- **Desktop (≥1024px)**: Full 3-column layout
- **Tablet/Mobile (<1024px)**: Single column (center feed only)
- **Sticky Sidebars**: Left and right sidebars stick on scroll
- **Max Width**: 1280px (max-w-7xl) container

---

## Component Architecture

### 1. Left Sidebar (`LeftSidebar.tsx`)

**Purpose**: User identity, reputation, and community switching

#### Sub-components

##### 1.1 User Profile Card
```typescript
interface ProfileCard {
  user: User
  karmaData: KarmaData
  trustScore: number
}
```

**Features**:
- **Avatar & Name**: Click → `/profile`
- **Trust Score**: Click → `/reputation/trust`
  - Color-coded gradient (Emerald/Blue/Amber/Gray)
  - Progress bar (0-100)
  - Labels: Trusted (80+), Reliable (60+), Building (40+), New (<40)
- **Karma Points**: Click → `/reputation/karma`
  - Hover effect with background highlight
  - Large number display

**Color Coding**:
```typescript
const getTrustColor = (score: number) => {
  if (score >= 80) return 'from-emerald-500 to-green-600'   // Trusted
  if (score >= 60) return 'from-blue-500 to-cyan-600'       // Reliable
  if (score >= 40) return 'from-amber-500 to-orange-600'    // Building
  return 'from-slate-400 to-gray-500'                       // New
}
```

##### 1.2 Community Selector
```typescript
interface CommunitySelectorProps {
  communities: Community[]
  activeCommunityId: string
  onCommunityChange: (id: string) => void
}
```

**Features**:
- **Title**: Click → `/communities`
- **Each Community**: Click → Updates active community
  - Active indicator: Blue border + dot
  - Inactive: Gray background, hover state
- **"+ Join Community"**: Click → `/communities`

**State Management**:
```typescript
// Dashboard.tsx
const [activeCommunityId, setActiveCommunityId] = useState<string>('')

const handleCommunityChange = (communityId: string) => {
  setActiveCommunityId(communityId)
  fetchMilestonesForCommunity(communityId)
}
```

##### 1.3 Quick Stats
- Requests Made (blue progress bar)
- Help Given (green progress bar)
- Exchanges Completed (purple progress bar)

---

### 2. Center Feed (`Dashboard.tsx`)

**Purpose**: Main content stream with posts, requests, and milestones

#### Feed Priority System

```typescript
enum FeedPriority {
  MY_REQUESTS_MATCHED = 1,      // Amber - Highest priority
  MY_ACCEPTED_OFFERS = 2,       // Blue
  MY_REQUESTS_PENDING = 3,      // Amber
  MY_PENDING_OFFERS = 4,        // Blue
  COMMUNITY_REQUESTS = 5        // White - Lowest priority
}
```

#### Post Card Styling

| Type                  | Background  | Border       | Badge                        |
|-----------------------|-------------|--------------|------------------------------|
| My Request (Matched)  | bg-amber-50 | border-amber-400 | ✓ YOUR REQUEST - MATCHED |
| My Request (Pending)  | bg-amber-50 | border-amber-400 | YOUR REQUEST             |
| My Offer (Accepted)   | bg-blue-50  | border-blue-400  | ✓ YOU'RE HELPING         |
| My Offer (Pending)    | bg-blue-50  | border-blue-400  | YOUR OFFER               |
| Community Request     | bg-white    | border-gray-200  | (none)                   |

#### Quick Create Component
- **2-row textarea** (compact)
- **Mode selector**: All Communities / Specific
- **Community dropdown**: (if specific mode)
- **Post button**: Disabled if empty or creating

#### Milestone Posts
- Displayed at top of feed
- 1 pinned milestone (within 48 hours)
- Color-coded by community health
- Network strength indicator
- Growth trend (+/- percentage)

---

### 3. Right Sidebar (`RightSidebar.tsx`)

**Purpose**: Community pulse and contextual information

#### Sub-components

##### 3.1 Community Health Widget (Compact)
```typescript
interface CommunityHealth {
  networkStrength: number
  networkStrengthLabel: string
  totalMatches: number
  activeHelpers: number
  growthRate: number
  trendDirection: 'growing' | 'stable' | 'declining'
}
```

**Color Coding**:
- 80-100: Emerald (Thriving)
- 60-79: Green (Strong)
- 40-59: Amber (Building)
- 20-39: Orange (Emerging)
- 0-19: Gray (Starting)

**Layout**:
```
┌─────────────────────────┐
│ Community Health        │
│ [Thriving]              │
│                         │
│     90.8 /100           │
│ ████████████████░░      │
│                         │
│ Exchanges      Active   │
│    50          18       │
│                         │
│ Growth: ↗️ +12.5%       │
└─────────────────────────┘
```

##### 3.2 Recent Milestones
- Top 3 milestones
- Pinned indicator (📌)
- Relative time ("2d ago")
- Dividers between items

##### 3.3 Top Helpers (Coming Soon)
- Placeholder for leaderboard
- Will show top 3 helpers this week

##### 3.4 Active Now
- Avatar stack (-space-x-2)
- "and more..." text

##### 3.5 Footer Links
- About, Help, Terms, Privacy
- Copyright

---

## State Management

### Dashboard State Flow

```typescript
// Component State
const [user, setUser] = useState<any>(null)
const [userCommunities, setUserCommunities] = useState<Community[]>([])
const [activeCommunityId, setActiveCommunityId] = useState<string>('')
const [feedItems, setFeedItems] = useState<any[]>([])
const [milestones, setMilestones] = useState<any[]>([])

// Community Change Flow
┌──────────────────────┐
│ User clicks          │
│ community in         │
│ LeftSidebar          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ onCommunityChange()  │
│ handler fires        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ setActiveCommunityId │
│ updates state        │
└──────────┬───────────┘
           │
           ├──────────────────┐
           ▼                  ▼
┌────────────────────┐  ┌─────────────────┐
│ fetchMilestones    │  │ RightSidebar    │
│ for new community  │  │ re-renders with │
│                    │  │ new communityId │
└────────────────────┘  └─────────────────┘
```

### Props Drilling

```typescript
Dashboard
  ├─ LeftSidebar
  │    ├─ user (read)
  │    ├─ communities (read)
  │    ├─ activeCommunityId (read)
  │    └─ onCommunityChange (callback)
  │
  ├─ CenterFeed
  │    ├─ milestones (read)
  │    └─ feedItems (read)
  │
  └─ RightSidebar
       └─ communityId (read)
```

---

## API Integration Patterns

### Response Unwrapping

The frontend uses axios interceptors to unwrap standardized API responses:

```typescript
// Backend Response
{
  success: true,
  data: { communities: [...] },
  meta: { timestamp, requestId }
}

// After Interceptor
{
  communities: [...],
  meta: { timestamp, requestId },
  success: true
}

// Frontend Access
const communities = response.data.communities  // ✓ Correct
// NOT: response.data.data.communities          // ✗ Wrong
```

### Data Fetching Patterns

#### Initial Load
```typescript
useEffect(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    const parsedUser = JSON.parse(userData)
    fetchDashboardData(parsedUser.id)
  }
}, [router])
```

#### Parallel Data Fetching
```typescript
const [
  myRequestsRes,
  allMatchesRes,
  suggestedRes,
  matchedRequestsRes,
  communitiesRes
] = await Promise.all([
  requestService.getRequests({ requester_id: userId, limit: 50 }),
  requestService.getMatches({ limit: 100 }),
  requestService.getRequests({ status: 'open', limit: 50 }),
  requestService.getRequests({ status: 'matched', limit: 50 }),
  communityService.getCommunities(),
])
```

#### Community-Specific Fetching
```typescript
const fetchMilestonesForCommunity = async (communityId: string) => {
  const milestonesRes = await feedApi.get(
    `/feed/milestones?community_id=${communityId}&limit=5`
  )
  setMilestones(milestonesRes.data || [])
}
```

### Error Handling

```typescript
try {
  const response = await api.get('/endpoint')
  setData(response.data?.field || defaultValue)
} catch (err) {
  console.error('Failed to fetch:', err)
  setData(defaultValue)  // Fallback to safe default
}
```

---

## Navigation & Routing

### Route Structure

```
/
├─ /dashboard (main)
│
├─ /profile
│
├─ /reputation
│  ├─ /karma
│  └─ /trust
│
├─ /communities
│  ├─ /[id]
│  ├─ /[id]/admin
│  └─ /new
│
├─ /requests
│  ├─ /[id]
│  └─ /new
│
├─ /offers
│  ├─ /new
│
└─ /notifications
```

### Navigation Patterns

#### Programmatic Navigation
```typescript
const router = useRouter()

// User clicks trust score
onClick={() => router.push('/reputation/trust')}

// User clicks community title
onClick={() => router.push('/communities')}
```

#### Back Navigation
```typescript
// In karma/trust pages
<button onClick={() => router.back()}>
  ← Back
</button>
```

---

## New Pages

### `/reputation/karma`

**Features**:
- Large karma number display (6xl font)
- Breakdown by source:
  - Karma from Giving
  - Karma from Receiving
  - Bonuses
- Recent activity timeline
  - Event type icons (🤝, 💙, 🎉)
  - Timestamps
  - Point changes (+/-)

**Data Fetching**:
```typescript
const karmaRes = await reputationService.getKarma(userId)
const historyRes = await reputationService.getKarmaHistory(userId, { limit: 20 })
```

### `/reputation/trust`

**Features**:
- Giant trust score (8xl font)
- Color-coded gradient background
- Trust level label
- Calculation breakdown:
  - Karma Points (40%)
  - Exchanges Completed (30%)
  - Positive Feedback (20%)
  - Account Age (10%)
- Tips to improve score

**Data Fetching**:
```typescript
const trustRes = await reputationService.getTrustScore(userId)
```

---

## Styling System

### Tailwind Classes

#### Spacing Scale
- `p-4`: Standard card padding
- `gap-4`: Standard grid gap
- `space-y-4`: Vertical stack spacing
- `space-y-3`: Tighter vertical spacing (feed)
- `space-y-2`: Community list spacing

#### Text Sizes
- `text-8xl`: Trust score display
- `text-6xl`: Karma display
- `text-3xl`: Page headers
- `text-xl`: Card headers
- `text-lg`: Section headers
- `text-sm`: Body text (feed posts)
- `text-xs`: Metadata, timestamps

#### Colors
- **Blue**: Primary actions, offers
- **Amber**: User's requests
- **Green**: Success, helping, trusted
- **Emerald**: Highest trust (80+)
- **Purple**: Exchanges, bonuses
- **Gray**: Neutral, inactive

#### Gradients
```css
.from-emerald-500.to-green-600  /* Trusted (80+) */
.from-blue-500.to-cyan-600      /* Reliable (60+) */
.from-amber-500.to-orange-600   /* Building (40+) */
.from-slate-400.to-gray-500     /* New (<40) */
```

### Component Patterns

#### Clickable Cards
```typescript
<button
  onClick={() => handleClick()}
  className="w-full hover:bg-gray-50 transition-colors"
>
  {/* Card content */}
</button>
```

#### Active States
```typescript
className={`${
  isActive
    ? 'bg-blue-50 border-2 border-blue-500'
    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
}`}
```

#### Progress Bars
```typescript
<div className="bg-white/20 rounded-full h-2">
  <div
    className="bg-white rounded-full h-2 transition-all duration-500"
    style={{ width: `${percentage}%` }}
  />
</div>
```

---

## Performance Considerations

### Optimization Techniques

1. **Sticky Sidebars**: `position: sticky` for better scroll performance
2. **Conditional Rendering**: `hidden lg:block` for responsive
3. **Lazy State Updates**: Only fetch milestones when community changes
4. **Parallel Fetching**: `Promise.all()` for initial data
5. **Memoization**: React callbacks with `useCallback` (LeftSidebar)
6. **Fallback Defaults**: `data || []` to prevent undefined errors

### Bundle Size

```
Dashboard:           8.57 kB (+0.12 kB from v6.0)
LeftSidebar:         ~1.2 kB (new)
RightSidebar:        ~1.0 kB (new)
/reputation/karma:   1.56 kB (new)
/reputation/trust:   1.62 kB (new)
```

### Load Time Improvements

- **Sidebar components**: Loaded only on desktop (lg breakpoint)
- **Sticky positioning**: No scroll event listeners needed
- **CSS transitions**: GPU-accelerated transforms
- **Image-free**: No avatar images loaded (initials only)

---

## User Experience Enhancements

### Visual Feedback

1. **Hover States**:
   - Clickable cards: `hover:bg-gray-50`
   - Trust score: `hover:bg-white/20`
   - Community selector: `hover:bg-gray-100`

2. **Active States**:
   - Blue border on active community
   - Blue dot indicator
   - Button color changes

3. **Loading States**:
   - Spinner for initial dashboard load
   - Pulse animation for sidebar loading

4. **Transitions**:
   - `transition-colors` for background changes
   - `transition-opacity` for hover effects
   - `transition-all duration-500` for progress bars

### Accessibility

1. **Semantic HTML**:
   - `<button>` for clickable elements
   - Proper heading hierarchy (h1, h2, h3)

2. **Keyboard Navigation**:
   - All buttons are keyboard-accessible
   - Focus states preserved

3. **ARIA Labels**: (Future enhancement)
   - Add `aria-label` to icon-only buttons
   - Add `aria-current` to active community

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Dashboard loads without errors
- [ ] Click user name → navigates to /profile
- [ ] Click trust score → navigates to /reputation/trust
- [ ] Click karma → navigates to /reputation/karma
- [ ] Click community → updates milestones
- [ ] Click community → updates right sidebar
- [ ] Active community shows blue border + dot
- [ ] RightSidebar shows correct community data
- [ ] Milestones display for active community
- [ ] Back button works on karma/trust pages
- [ ] Responsive layout on mobile (single column)
- [ ] Sticky sidebars work on scroll

### Integration Testing

```bash
# Run E2E tests
cd tests/e2e
npm test tests/10-social-karma-v2.spec.ts
```

### API Testing

```bash
# Test karma endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3004/reputation/karma/USER_ID

# Test trust endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3004/reputation/trust/USER_ID

# Test milestones endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3007/feed/milestones?community_id=COMMUNITY_ID
```

---

## Future Enhancements

### Phase 1 (Next Sprint)
- [ ] Top Helpers leaderboard implementation
- [ ] Active Now real-time user tracking
- [ ] Your Impact stats with real data
- [ ] Community rank calculation

### Phase 2
- [ ] Community health history graph
- [ ] Karma breakdown by community
- [ ] Trust score trends over time
- [ ] Mobile drawer navigation for sidebars

### Phase 3
- [ ] Dark mode support
- [ ] Customizable sidebar layout
- [ ] Feed filtering (by priority, community)
- [ ] Advanced search

---

## Migration Notes

### From v6.0 to v7.0

#### Breaking Changes
None - fully backward compatible

#### New Dependencies
None - uses existing Next.js and Tailwind

#### Database Changes
None - uses existing schemas

#### API Changes
None - uses existing endpoints

#### Environment Variables
None

---

## Troubleshooting

### Common Issues

#### Issue: Sidebars not visible
**Solution**: Check browser width ≥ 1024px (lg breakpoint)

#### Issue: Community switching not working
**Solution**: Ensure `onCommunityChange` prop is passed to LeftSidebar

#### Issue: Trust score shows 0
**Solution**: Reputation service must be running on port 3004

#### Issue: "Cannot read properties of undefined"
**Solution**: Add `|| []` or `|| 0` fallbacks to all API response accesses

#### Issue: Milestones not updating
**Solution**: Check `activeCommunityId` state is updating correctly

---

## Conclusion

The v7.0 UI redesign delivers a modern, information-dense dashboard that significantly improves user engagement and community awareness. The 3-column layout, interactive components, and community-specific content create a cohesive social platform experience.

**Key Achievements**:
✅ 3x information density
✅ Fully interactive cards
✅ Community-aware content
✅ Social Karma v2 integration
✅ Responsive design
✅ Zero breaking changes

**Next Steps**:
1. User feedback collection
2. Analytics integration
3. Performance monitoring
4. Leaderboard implementation
