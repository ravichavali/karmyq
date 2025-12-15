# Dashboard Development Guide

**Quick reference for working with the Karmyq v7.0 dashboard**

---

## Component Structure

```
src/
├── pages/
│   ├── dashboard.tsx              # Main dashboard (3-column layout)
│   ├── profile.tsx                # User profile page
│   └── reputation/
│       ├── karma.tsx              # Karma points detail page
│       └── trust.tsx              # Trust score detail page
│
├── components/
│   ├── LeftSidebar.tsx            # User profile + community selector
│   ├── RightSidebar.tsx           # Community health + milestones
│   ├── MilestonePost.tsx          # Milestone card component
│   └── CommunityHealthHero.tsx    # Legacy (not used in v7.0)
│
└── lib/
    └── api.ts                     # API client with response interceptors
```

---

## Quick Start

### Running Locally

```bash
# Start all services
docker-compose up -d

# Watch frontend logs
docker logs karmyq-frontend -f

# Rebuild frontend after changes
cd apps/frontend
npm run build
docker-compose -f infrastructure/docker/docker-compose.yml build frontend
docker-compose -f infrastructure/docker/docker-compose.yml up -d frontend
```

### Seeding Test Data

```bash
# Seed Social Karma v2.0 data
cat tests/e2e/seed-social-karma-v2-simple.sql | \
  docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db

# Or seed for specific community (replace COMMUNITY_ID)
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db <<EOF
INSERT INTO reputation.milestone_events (community_id, milestone_type, milestone_value, description, achieved_at)
VALUES ('COMMUNITY_ID', 'matches_50', 50, 'Reached 50 successful exchanges!', NOW());
EOF
```

---

## Common Tasks

### Adding a New Clickable Card

```typescript
// In LeftSidebar.tsx or RightSidebar.tsx
<button
  onClick={() => router.push('/your-page')}
  className="w-full hover:bg-gray-50 rounded-lg p-3 transition-colors"
>
  <div>Your card content</div>
</button>
```

### Fetching Community-Specific Data

```typescript
// In Dashboard.tsx or sidebar component
const [data, setData] = useState<any[]>([])

useEffect(() => {
  if (!communityId) return

  const fetchData = async () => {
    const res = await someApi.get(`/endpoint?community_id=${communityId}`)
    setData(res.data || [])
  }

  fetchData()
}, [communityId])
```

### Adding a New Navigation Link

```typescript
// 1. Add route in pages/
// pages/your-feature.tsx

// 2. Add navigation in component
import { useRouter } from 'next/router'

const router = useRouter()
<button onClick={() => router.push('/your-feature')}>
  Navigate
</button>
```

### Updating Community State

```typescript
// Dashboard.tsx already provides this
const handleCommunityChange = (communityId: string) => {
  setActiveCommunityId(communityId)
  // Add your custom logic here
  fetchYourData(communityId)
}

// Pass to LeftSidebar
<LeftSidebar onCommunityChange={handleCommunityChange} />
```

---

## Styling Guide

### Color Palette

```typescript
// Trust Score Colors
score >= 80: 'from-emerald-500 to-green-600'  // Trusted
score >= 60: 'from-blue-500 to-cyan-600'      // Reliable
score >= 40: 'from-amber-500 to-orange-600'   // Building
score <  40: 'from-slate-400 to-gray-500'     // New

// Action Colors
- Blue (bg-blue-600): Primary actions, offers
- Amber (bg-amber-50): User's requests
- Green (bg-green-600): Success, accepted, helping
- Gray (bg-gray-50): Neutral, inactive
```

### Common Patterns

#### Card with Shadow
```typescript
className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
```

#### Clickable with Hover
```typescript
className="hover:bg-gray-50 transition-colors cursor-pointer"
```

#### Progress Bar
```typescript
<div className="bg-gray-100 rounded-full h-2">
  <div
    className="bg-blue-500 rounded-full h-2 transition-all duration-500"
    style={{ width: `${percentage}%` }}
  />
</div>
```

#### Active State
```typescript
className={`${
  isActive ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-transparent'
} border-2 rounded-lg transition-colors`}
```

---

## API Response Handling

### ⚠️ Important: Response Unwrapping

The API client unwraps standardized responses automatically:

```typescript
// ❌ WRONG
const data = response.data.data.communities

// ✅ CORRECT
const data = response.data.communities || []

// Backend sends:
{ success: true, data: { communities: [...] }, meta: {...} }

// After interceptor:
{ communities: [...], meta: {...}, success: true }
```

### Always Use Fallbacks

```typescript
// ✅ Always provide defaults
const communities = response.data.communities || []
const karma = response.data.total_karma || 0
const score = response.data.trust_score || 0

// ❌ Never do this
const communities = response.data.communities  // May be undefined!
```

---

## State Management

### Dashboard State

```typescript
// User & Communities
const [user, setUser] = useState<any>(null)
const [userCommunities, setUserCommunities] = useState<Community[]>([])
const [activeCommunityId, setActiveCommunityId] = useState<string>('')

// Feed
const [feedItems, setFeedItems] = useState<any[]>([])
const [milestones, setMilestones] = useState<any[]>([])

// Quick Create
const [description, setDescription] = useState('')
const [postingMode, setPostingMode] = useState<'all' | 'specific'>('all')
const [creating, setCreating] = useState(false)
```

### State Flow

```
User Clicks Community
       ↓
onCommunityChange(id)
       ↓
setActiveCommunityId(id)
       ↓
    ┌──────────────────┐
    ↓                  ↓
fetchMilestones    RightSidebar
for community      re-renders
```

---

## Debugging

### Check API Responses

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"isabella.thomas0@example.com","password":"password123"}' \
  | jq -r '.data.token')

# Test karma endpoint
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3004/reputation/karma/00000000-0000-0000-0000-000000000001" \
  | jq

# Test milestones endpoint
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3007/feed/milestones?community_id=COMMUNITY_ID&limit=5" \
  | jq
```

### Browser Console

```javascript
// Check active community
console.log('Active Community:', activeCommunityId)

// Check milestones
console.log('Milestones:', milestones)

// Check user data
console.log('User:', localStorage.getItem('user'))
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot read properties of undefined (reading 'length')` | Missing fallback | Add `|| []` |
| Sidebars not visible | Screen too narrow | Resize to ≥1024px |
| Community not switching | Handler not passed | Check `onCommunityChange` prop |
| Trust score shows 0 | Service not running | Check port 3004 |

---

## Testing

### Manual Testing Checklist

```bash
# 1. Login
http://localhost:3000/login
Email: isabella.thomas0@example.com
Password: password123

# 2. Dashboard loads
http://localhost:3000/dashboard

# 3. Click interactions
- [ ] Click user name → /profile
- [ ] Click trust score → /reputation/trust
- [ ] Click karma → /reputation/karma
- [ ] Click community → milestones update
- [ ] Click "Your Communities" → /communities
- [ ] Click "+ Join Community" → /communities

# 4. Responsive
- [ ] Desktop view (≥1024px) shows 3 columns
- [ ] Mobile view (<1024px) shows single column
- [ ] Sidebars stick on scroll
```

### E2E Tests

```bash
cd tests/e2e
npm test tests/10-social-karma-v2.spec.ts
```

---

## Performance Tips

1. **Use `|| []` for arrays**: Prevents mapping over undefined
2. **Use `|| 0` for numbers**: Prevents NaN in calculations
3. **Conditional rendering**: Hide sidebars on mobile with `hidden lg:block`
4. **Parallel fetching**: Use `Promise.all()` for multiple API calls
5. **Sticky positioning**: Better than scroll listeners for sidebars

---

## File Locations

### Component Files
- Dashboard: `apps/frontend/src/pages/dashboard.tsx`
- Left Sidebar: `apps/frontend/src/components/LeftSidebar.tsx`
- Right Sidebar: `apps/frontend/src/components/RightSidebar.tsx`
- Karma Page: `apps/frontend/src/pages/reputation/karma.tsx`
- Trust Page: `apps/frontend/src/pages/reputation/trust.tsx`

### API Files
- API Client: `apps/frontend/src/lib/api.ts`
- Reputation Service: `services/reputation-service/`
- Feed Service: `services/feed-service/`

### Documentation
- Architecture: `docs/architecture/V7_UI_ARCHITECTURE.md`
- This Guide: `docs/DASHBOARD_GUIDE.md`

---

## Need Help?

1. **Documentation**: See `docs/architecture/V7_UI_ARCHITECTURE.md`
2. **API Docs**: See service README files in `services/*/README.md`
3. **Issues**: Check `docs/KNOWN_ISSUES.md`
4. **Testing**: See `docs/testing/LOCAL_TESTING.md`

---

## Quick Reference

### Environment
- Frontend: http://localhost:3000
- Auth Service: http://localhost:3001
- Community Service: http://localhost:3002
- Reputation Service: http://localhost:3004
- Feed Service: http://localhost:3007

### Test User
- Email: `isabella.thomas0@example.com`
- Password: `password123`

### Common Commands
```bash
# Rebuild frontend
npm run build && docker-compose -f infrastructure/docker/docker-compose.yml build frontend && docker-compose -f infrastructure/docker/docker-compose.yml up -d frontend

# View logs
docker logs karmyq-frontend -f

# Run tests
./scripts/test-all.sh
```
