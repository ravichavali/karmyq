# Provider Mode + Notification Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add a Member/Provider mode switcher to the nav that reorients the dashboard and feed for providers, and split notifications into two distinct community vs. provider streams.

**Architecture:** `ProviderModeSwitcher` in Layout writes to localStorage; `dashboard.tsx` reads it to conditionally render `ProviderDashboardCard` and pass service-type filters to `BrowseFeed`; `NotificationContext` derives two streams client-side from the existing notification array — no new API calls, no DB migration.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/components/ProviderModeSwitcher.tsx` | `Member / Provider` pill toggle; reads/writes `localStorage` key `karmyq_provider_mode`; only shown when user has ≥1 provider profile |
| `apps/frontend/src/components/ProviderDashboardCard.tsx` | Stats card (active commitments, pending reviews, completion rate) shown at top of dashboard in Provider mode |
| `apps/frontend/src/components/ProviderNotificationBell.tsx` | Separate notification bell for provider-stream notifications |
| `apps/frontend/src/lib/notificationCategories.ts` | `PROVIDER_NOTIFICATION_TYPES` constant; source of truth for stream split |
| `apps/frontend/src/contexts/ProviderContext.tsx` | Holds `hasProviderProfile`, `providerProfiles`, `providerMode` state; fetches `GET /api/requests/providers/my` once on mount |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/Layout.tsx` | Add `ProviderModeSwitcher` + `ProviderNotificationBell` to nav |
| `apps/frontend/src/components/NotificationBell.tsx` | Use `communityUnreadCount` from context instead of `unreadCount` |
| `apps/frontend/src/components/NotificationItem.tsx` | Add icon + CTA cases for 4 missing notification types |
| `apps/frontend/src/contexts/NotificationContext.tsx` | Expose `providerNotifications`, `communityNotifications`, `providerUnreadCount`, `communityUnreadCount` |
| `apps/frontend/src/pages/dashboard.tsx` | Render `ProviderDashboardCard` + pass service-type filter to `BrowseFeed` in Provider mode |
| `apps/frontend/pages/_app.tsx` | Wrap with `ProviderProvider` |
| `services/notification-service/src/templates/notificationTemplates.ts` | Add `provider_request_matched` + `provider_review_received` types |
| `services/notification-service/src/events/subscriber.ts` | Handle new event types |
| `services/request-service/src/routes/requests.ts` | Include `service_type` in `request_created` event payload |
| `services/request-service/src/routes/providers.ts` | Publish `provider_review_received` event after review saved |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Provider mode is UI-only — never send it to the server.** `karmyq_provider_mode` must never appear in API request bodies or headers.
2. **Mode switcher only appears when user has a provider profile.** Fetch `GET /api/requests/providers/my` once on mount in `ProviderContext`; if empty array, show "Become a Provider" link instead of toggle.
3. **Provider feed uses `service_type` filter, not a new endpoint.** Pass user's service types to existing `BrowseFeed` via `serviceTypeFilter` prop. Do NOT create a new route.
4. **Notification split is entirely client-side.** `useMemo` in `NotificationContext` derives the two streams. No new API calls.
5. **`provider_request_matched` must skip the requester.** Notification service subscriber must exclude `requester_id` when finding matching providers.
6. **Do not disable `new_request`.** It serves member volunteers. Provider routing is additive via `provider_request_matched`.
7. **No `tailwindcss-animate` / `animate-in` class** — unavailable in this project.
8. **`ProviderDashboardCard` derives from existing data.** Use already-fetched matches data and provider trust score. If unavailable, show `—` gracefully. No new endpoints.
9. **Carry-forward fixes: read the test, trace the source, fix forward.** No `describe.skip` or `it.skip`.

---

## Task 1: Feature branch + notification template backend

**Files:**
- Modify: `services/notification-service/src/templates/notificationTemplates.ts`
- Modify: `services/request-service/src/routes/requests.ts`
- Modify: `services/request-service/src/routes/providers.ts`

- [ ] **Create the sprint branch**

```bash
git checkout -b feature/sprint-37-provider-mode
```

- [ ] **Add `provider_request_matched` and `provider_review_received` to `NotificationType` union and `notificationTemplates` record**

In `notificationTemplates.ts`, extend the union type and add template entries:

```typescript
// Add to NotificationType union:
| 'provider_request_matched'
| 'provider_review_received'

// Add to notificationTemplates record:
provider_request_matched: {
  type: 'provider_request_matched',
  priority: 'high',
  title: (data) => `New ${data.service_type} request — can you help?`,
  body: (data) => `${data.requester_name} needs help with: "${data.request_title}"`,
  icon: 'briefcase',
  ctaLabel: 'View Request',
  actionUrl: (data) => `/requests/${data.request_id}`,
  channels: { in_app: true, push: false, email: false },
},

provider_review_received: {
  type: 'provider_review_received',
  priority: 'medium',
  title: (_data) => 'You received a new review',
  body: (data) => `${data.reviewer_name} left you a ${data.rating}-star review: "${data.review_excerpt}"`,
  icon: 'star',
  ctaLabel: 'View Review',
  actionUrl: (data) => `/providers/${data.provider_id}`,
  channels: { in_app: true, push: false, email: false },
},
```

- [ ] **Include `service_type` in `request_created` event payload** in `request-service/src/routes/requests.ts`

Find the `request_created` Bull queue publish call. Add `service_type: newRequest.request_type` (or `payload.service_type`) to the event data so notification service can route to matching providers.

- [ ] **Publish `provider_review_received` event after review saved** in `request-service/src/routes/providers.ts`

Find the endpoint that saves a provider review (likely `POST /requests/providers/:providerId/reviews` or similar). After saving, publish to Bull queue:

```typescript
await queue.add('provider_review_received', {
  provider_id: providerId,
  provider_user_id: provider.user_id,
  reviewer_name: user.name,
  rating: body.rating,
  review_excerpt: body.body?.substring(0, 80) ?? '',
})
```

- [ ] **Verify TypeScript compiles in notification-service**

```bash
cd services/notification-service && npx tsc --noEmit
```

---

## Task 2: Notification service subscriber — new event handlers

**Files:**
- Modify: `services/notification-service/src/events/subscriber.ts`

- [ ] **Add handler for `provider_request_matched` event**

When `request_created` fires and `service_type` is present:
1. Call `GET /api/requests/providers?service_type={type}&community_id={id}` (internal HTTP call or shared DB query)
2. For each matching provider whose `user_id !== requester_id`: call `createNotification` with type `provider_request_matched`

```typescript
case 'request_created': {
  const { request_id, requester_id, service_type, community_id, request_title, requester_name } = data
  if (service_type) {
    // Find providers matching service_type in the same community
    const providers = await getMatchingProviders(service_type, community_id)
    for (const provider of providers) {
      if (provider.user_id === requester_id) continue
      await createNotification({
        userId: provider.user_id,
        type: 'provider_request_matched',
        data: { request_id, service_type, request_title, requester_name },
      })
    }
  }
  // ... existing new_request handling ...
  break
}
```

- [ ] **Add handler for `provider_review_received` event**

```typescript
case 'provider_review_received': {
  await createNotification({
    userId: data.provider_user_id,
    type: 'provider_review_received',
    data,
  })
  break
}
```

- [ ] **Add `getMatchingProviders` helper** (inline in subscriber or separate util) that queries `requests.provider_profiles` joined with `community.members` to find active, available providers of a given service type in a given community.

- [ ] **Verify TypeScript compiles**

```bash
cd services/notification-service && npx tsc --noEmit
```

---

## Task 3: Notification client-side split + fix rendering

**Files:**
- Create: `apps/frontend/src/lib/notificationCategories.ts`
- Modify: `apps/frontend/src/contexts/NotificationContext.tsx`
- Modify: `apps/frontend/src/components/NotificationItem.tsx`

- [ ] **Create `notificationCategories.ts`**

```typescript
export const PROVIDER_NOTIFICATION_TYPES = new Set([
  'preferred_provider_selected',
  'provider_request_matched',
  'provider_review_received',
  'match_reminder',
])
```

- [ ] **Extend `NotificationContext` to expose split streams**

Add derived values using `useMemo`:

```typescript
const providerNotifications = useMemo(
  () => notifications.filter(n => PROVIDER_NOTIFICATION_TYPES.has(n.type)),
  [notifications]
)
const communityNotifications = useMemo(
  () => notifications.filter(n => !PROVIDER_NOTIFICATION_TYPES.has(n.type)),
  [notifications]
)
const providerUnreadCount = useMemo(
  () => providerNotifications.filter(n => !n.read).length,
  [providerNotifications]
)
const communityUnreadCount = useMemo(
  () => communityNotifications.filter(n => !n.read).length,
  [communityNotifications]
)
```

Add all four to `NotificationContextValue` interface and to the context value object.

- [ ] **Fix `NotificationItem` — add missing icon/CTA cases**

In `getIcon()`:
```typescript
case 'preferred_provider_selected': return '🎯'
case 'match_reminder': return '⏰'
case 'provider_request_matched': return '🔧'
case 'provider_review_received': return '⭐'
```

In `getCtaLabel()`:
```typescript
case 'preferred_provider_selected': return 'View Request'
case 'match_reminder': return 'View Commitment'
case 'provider_request_matched': return 'View Request'
case 'provider_review_received': return 'View Review'
```

- [ ] **Update `NotificationBell.tsx`** to use `communityUnreadCount` instead of `unreadCount`

---

## Task 4: ProviderContext + ProviderModeSwitcher

**Files:**
- Create: `apps/frontend/src/contexts/ProviderContext.tsx`
- Create: `apps/frontend/src/components/ProviderModeSwitcher.tsx`
- Modify: `apps/frontend/src/pages/_app.tsx`

- [ ] **Create `ProviderContext.tsx`**

```typescript
interface ProviderContextValue {
  hasProviderProfile: boolean
  providerProfiles: ProviderProfile[]
  providerServiceTypes: string[]  // unique service types across all profiles
  providerMode: 'member' | 'provider'
  setProviderMode: (mode: 'member' | 'provider') => void
  loading: boolean
}
```

On mount:
- Fetch `GET /api/requests/providers/my` (with auth)
- Set `hasProviderProfile` based on response
- Read `karmyq_provider_mode` from localStorage; default `'member'`
- `setProviderMode` writes to localStorage + updates state

- [ ] **Create `ProviderModeSwitcher.tsx`**

Pill toggle component:
- If `hasProviderProfile === false`: render `<Link href="/providers/new">Become a Provider →</Link>` (small, muted style)
- If `hasProviderProfile === true` and `loading === false`: render `Member | Provider` pill toggle
  - Active segment: solid `bg-primary text-white`
  - Inactive segment: `text-text-muted`
  - On click: call `setProviderMode()`
- If `loading`: render nothing (avoid flash)

```tsx
<div className="flex items-center bg-surface rounded-full border border-border text-sm font-medium">
  <button
    onClick={() => setProviderMode('member')}
    className={`px-3 py-1 rounded-full transition-colors ${
      providerMode === 'member' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
    }`}
  >
    Member
  </button>
  <button
    onClick={() => setProviderMode('provider')}
    className={`px-3 py-1 rounded-full transition-colors ${
      providerMode === 'provider' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
    }`}
  >
    Provider
  </button>
</div>
```

- [ ] **Wrap app with `ProviderProvider` in `_app.tsx`**

Add `<ProviderProvider>` wrapping the existing `<NotificationProvider>` or alongside it.

---

## Task 5: ProviderNotificationBell + Layout nav integration

**Files:**
- Create: `apps/frontend/src/components/ProviderNotificationBell.tsx`
- Modify: `apps/frontend/src/components/Layout.tsx`

- [ ] **Create `ProviderNotificationBell.tsx`**

Mirrors `NotificationBell` but:
- Uses `providerNotifications` and `providerUnreadCount` from context
- Icon: briefcase/wrench SVG instead of bell
- Badge color: `bg-amber-500` (amber, distinct from community bell's red)
- Passes `providerNotifications` to `NotificationDropdown` (add optional `notifications` prop to `NotificationDropdown`, falling back to `communityNotifications` if not provided)
- Only rendered when `hasProviderProfile === true` (read from `ProviderContext`)

- [ ] **Update `Layout.tsx` nav**

In the desktop nav area (alongside the existing `<NotificationBell />`):

```tsx
// Before NotificationBell:
<ProviderModeSwitcher />
// After NotificationBell:
<ProviderNotificationBell />
```

Also add to `HamburgerMenu` mobile dropdown:
```tsx
<div className="px-4 py-2 border-t border-border">
  <ProviderModeSwitcher />
</div>
```

- [ ] **Verify nav renders correctly at all breakpoints** (desktop + mobile hamburger)

---

## Task 6: ProviderDashboardCard component

**Files:**
- Create: `apps/frontend/src/components/ProviderDashboardCard.tsx`

- [ ] **Create `ProviderDashboardCard.tsx`**

Fetches `GET /api/requests/providers/my` (reuse from ProviderContext — accept as props or consume context). Derives:
- `activeCommitments`: count of matches with `status === 'matched'` and `responder_id === currentUser.id`
- `pendingReviews`: count of completed matches without a review from the requester (derive from match data if available, else show `—`)
- `completionRate`: from `reputation.provider_trust_scores.completion_rate` (included in provider profile API response)
- `avgResponseTime`: from `reputation.provider_trust_scores.response_rate` or show `—`

Card layout (two-column stat grid):
```tsx
<div className="bg-surface-raised border border-border rounded-xl p-4 mb-4">
  <div className="flex items-center justify-between mb-3">
    <h2 className="font-semibold text-text">Provider Overview</h2>
    <span className="text-xs text-text-muted">
      {providerProfiles.length} profile{providerProfiles.length !== 1 ? 's' : ''}
    </span>
  </div>
  <div className="grid grid-cols-2 gap-3">
    <StatCell label="Active Commitments" value={activeCommitments} />
    <StatCell label="Completion Rate" value={completionRate ? `${completionRate}%` : '—'} />
    <StatCell label="Pending Reviews" value={pendingReviews} />
    <StatCell label="Avg Response" value={avgResponseTime ?? '—'} />
  </div>
</div>
```

`StatCell` is an inline sub-component (not exported separately):
```tsx
const StatCell = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-surface rounded-lg p-3">
    <div className="text-lg font-bold text-text">{value}</div>
    <div className="text-xs text-text-muted mt-0.5">{label}</div>
  </div>
)
```

- [ ] **Verify card renders without crashing when data is partially unavailable**

---

## Task 7: Dashboard integration — Provider mode view

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] **Import `ProviderDashboardCard` and `useProvider` hook**

- [ ] **Read `providerMode` from ProviderContext**

```typescript
const { providerMode, providerServiceTypes } = useProvider()
const isProviderMode = providerMode === 'provider'
```

- [ ] **Conditionally render `ProviderDashboardCard` above the TabBar**

```tsx
{isProviderMode && <ProviderDashboardCard />}
<TabBar ... />
```

- [ ] **Pass `serviceTypeFilter` to `BrowseFeed` when in Provider mode**

`BrowseFeed` likely accepts filter props already. If it doesn't have a `serviceTypeFilter` prop yet, add it:
- In `BrowseFeed`, if `serviceTypeFilter` array is non-empty, filter displayed feed items to those whose `request_type` matches any value in the array
- This is a client-side filter on already-fetched feed data — no new API call

- [ ] **Change the Browse tab label in Provider mode**

```tsx
const browseTabLabel = isProviderMode ? 'Requests for Me' : 'Browse'
```

Pass this to `TabBar` (check how tab labels are defined — likely a tabs array; conditionally override the label).

- [ ] **Verify dashboard renders correctly in both modes** — toggle between Member and Provider and confirm feed and tab label change.

---

## Task 8: Fix carry-forward test failures

**Files:**
- `tests/tdd/` or `tests/unit/` — whichever files contain the failing tests

- [ ] **Find and read each failing test file**

```bash
grep -r "preSelectProvider\|trust-evolution-flow\|rateCards" tests/ --include="*.test.*" -l
```

- [ ] **Fix `preSelectProvider` test**

Read the test. Trace the component or function it references. Common causes:
- Import path changed (component moved from `providers/` to `components/providers/`)
- Mock target renamed (API function renamed in `lib/api.ts`)
- Assertion against stale prop name

Fix the root cause — do not skip.

- [ ] **Fix `trust-evolution-flow` test**

Known pattern from persistent context: `_communityEvolutionQueue` is null at module load (Bull queue lazy init in `trustEvolutionService`). In test setup, the queue mock must be set up before the module is imported, OR the test must call the queue initializer before exercising the flow.

Read the test, confirm the actual failure reason, fix accordingly.

- [ ] **Fix `rateCards` test**

Known pattern: rate card DELETE is a soft-delete (`is_active = false`). Test may assert the card is gone from the list (hard-delete assumption). Fix: align assertion with the actual API contract — deleted card should have `is_active: false`, not be absent from the array.

- [ ] **Run each fixed test file individually to confirm passing**

```bash
npx jest tests/tdd/preSelectProvider --no-coverage
npx jest tests/tdd/trust-evolution-flow --no-coverage
npx jest tests/tdd/rateCards --no-coverage
# (adjust paths to actual filenames found in the grep above)
```

- [ ] **Run the full test suite to confirm no regressions**

```bash
npm test
```

---

## Task 9: User guides + landing page docs

**Files:**
- Create: `apps/landing/src/data/docs/guides/provider-mode.json`
- Create: `apps/landing/src/data/docs/guides/managing-notifications.json`
- Create: `apps/landing/src/data/docs/concepts/provider-mode.json`
- Modify: `apps/landing/src/data/docs/guides/finding-providers.json` (if exists; check first)
- Modify: `apps/landing/src/data/docs/nav.json` (via generate-docs.ts — read that file first)

> **Note**: `generate-docs.ts` is source of truth for `nav.json`. Never edit `nav.json` directly.

- [ ] **Create `guides/provider-mode.json`**

```json
{
  "slug": "provider-mode",
  "title": "Using Provider Mode",
  "description": "Switch your Karmyq interface into a provider-focused view to manage incoming service requests, track commitments, and monitor your provider stats.",
  "content": "# Using Provider Mode\n\n## What is Provider Mode?\n\nProvider Mode is a view toggle that reorients your Karmyq dashboard around your role as a service provider. When active, your feed shows requests that match your service type(s), a stats card surfaces your active commitments and completion rate, and your notification bell separates provider activity from community activity.\n\nYou remain in the same community — nothing about your membership, karma, or trust changes. Provider Mode is just a lens.\n\n## How to Switch Modes\n\nLook for the **Member / Provider** pill toggle in the top navigation bar. Click **Provider** to enter Provider Mode. Click **Member** to return to your normal community view.\n\nYour mode is saved in your browser — it persists across page loads until you change it.\n\n## What Changes in Provider Mode\n\n- **Feed → Requests for Me**: Your browse feed shows only help requests that match your service type(s). No unrelated community posts.\n- **Provider Overview card**: A stats card appears at the top of your dashboard showing active commitments, completion rate, pending reviews, and average response time.\n- **Provider notification bell**: A second notification indicator (amber) appears for provider-specific alerts — pre-selections, new matching requests, and incoming reviews.\n\n## Unlocking Provider Mode\n\nProvider Mode is only available to users with at least one provider profile. If you haven't created one yet, you'll see a **Become a Provider** link in the nav instead of the toggle.\n\nTo create a provider profile: go to **Service Providers → + Add Profile** or visit your Profile page and open the Provider tab.\n\n## Provider Notifications\n\nIn Provider Mode, you'll see two notification bells:\n- **Bell (red)** — community activity: match offers, karma, community invites\n- **Briefcase (amber)** — provider activity: pre-selections, new requests matching your service type, new reviews\n\nSee [Managing Your Notifications](managing-notifications) for details on each notification type."
}
```

- [ ] **Create `guides/managing-notifications.json`**

Content should cover: community vs. provider streams, what triggers each notification type, how to read each bell, the volume philosophy (only fire when action-driving).

- [ ] **Create `concepts/provider-mode.json`**

```json
{
  "slug": "provider-mode",
  "title": "Provider Mode",
  "description": "The member/provider duality in Karmyq — how the same user can be both a community member and a service provider, and how the UI adapts.",
  "content": "# Provider Mode\n\n## The Dual-Role User\n\nIn Karmyq, the same person is often both a community member and a service provider. A tutor might request a ride from a neighbor (member role) and offer tutoring sessions for karma or compensation (provider role). These two roles share the same identity, karma balance, and trust graph — but they call for different views of the platform.\n\n## How It Works\n\nProvider Mode is a client-side view toggle stored in `localStorage` as `karmyq_provider_mode`. It never affects API calls or server state. When set to `'provider'`:\n\n- The dashboard feed filters to requests matching the user's provider service type(s)\n- A stats card surfaces provider-specific metrics\n- The notification system surfaces a separate provider stream\n\nSwitching modes is instant — no page reload, no data re-fetch.\n\n## Notification Separation\n\nNotifications are split into two streams by type:\n\n**Community notifications** (red bell): match offers, karma awards, community invites, join requests, messages\n\n**Provider notifications** (amber bell): `preferred_provider_selected`, `provider_request_matched`, `provider_review_received`, `match_reminder`\n\nThe split is computed client-side by filtering `notification.type` against a constant set (`PROVIDER_NOTIFICATION_TYPES` in `lib/notificationCategories.ts`). No database column is needed.\n\n## Design Principle\n\nProvider Mode is a lens, not a separate app. Both modes share all context — community membership, karma, social graph. This avoids the complexity of role-based routing while still giving providers a focused work surface."
}
```

- [ ] **Update `finding-providers.json`** if it exists — add a short section "Are you a provider?" pointing to the Provider Mode guide.

- [ ] **Update nav via generate-docs.ts** — add the three new pages to the nav source and regenerate.

```bash
cd apps/landing && node src/scripts/generate-docs.ts 2>/dev/null || echo "check generate-docs path"
git add -f apps/landing/src/data/docs/
```

---

## Task 10: CONTEXT.md + registry.json

**Files:**
- Modify: `services/notification-service/CONTEXT.md`
- Modify: `services/request-service/CONTEXT.md`
- Modify: `services/registry.json`

- [ ] **Update `notification-service/CONTEXT.md`**
  - Add `provider_request_matched` and `provider_review_received` to the notification types table
  - Add entries to event subscriber section: `provider_review_received` (new event), updated `request_created` handler (now also routes to providers)

- [ ] **Update `request-service/CONTEXT.md`**
  - Note that `request_created` event now includes `service_type` field
  - Note that provider review endpoint now publishes `provider_review_received` event

- [ ] **Update `services/registry.json`**
  - Under notification-service `events.subscribes`: add `provider_review_received`
  - Under request-service `events.publishes`: add `provider_review_received`
  - Under request-service `events.publishes`: note `request_created` now includes `service_type`

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

---

## Task 11: TDD integration test

**Files:**
- Create: `tests/tdd/sprint-37-provider-mode.test.ts`

- [ ] **Create TDD test file covering the core new behaviors**

```typescript
// tests/tdd/sprint-37-provider-mode.test.ts
describe('Sprint 37 — Provider Mode', () => {
  describe('ProviderModeSwitcher', () => {
    it('renders pill toggle when user has a provider profile', () => { ... })
    it('renders "Become a Provider" link when user has no profiles', () => { ... })
    it('writes karmyq_provider_mode to localStorage on toggle', () => { ... })
  })

  describe('NotificationContext split', () => {
    it('puts preferred_provider_selected into providerNotifications', () => { ... })
    it('puts provider_request_matched into providerNotifications', () => { ... })
    it('puts match_created into communityNotifications', () => { ... })
    it('communityUnreadCount counts only unread community notifications', () => { ... })
    it('providerUnreadCount counts only unread provider notifications', () => { ... })
  })

  describe('ProviderDashboardCard', () => {
    it('renders stat cells with — when data unavailable', () => { ... })
    it('shows active commitments count from match data', () => { ... })
  })

  describe('dashboard provider mode integration', () => {
    it('shows ProviderDashboardCard when providerMode is provider', () => { ... })
    it('hides ProviderDashboardCard when providerMode is member', () => { ... })
    it('shows "Requests for Me" tab label in provider mode', () => { ... })
    it('shows "Browse" tab label in member mode', () => { ... })
  })
})
```

- [ ] **Run TDD tests to confirm they are wired up (can fail at this stage)**

```bash
npm run test:tdd
```

---

## Task 12: Final type check + pre-push verification

**Files:** None created — verification only.

- [ ] **TypeScript check across all modified services and frontend**

```bash
cd services/notification-service && npx tsc --noEmit && cd ../..
cd services/request-service && npx tsc --noEmit && cd ../..
cd apps/frontend && npx tsc --noEmit && cd ../..
```

- [ ] **Run full test suite**

```bash
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

- [ ] **Verify notification split works end-to-end in browser** — log in as a user with a provider profile, check both bells render, toggle between modes, confirm feed changes.

- [ ] **Bump version to v9.12.0** in `package.json` (root) and any relevant service `package.json` files.

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(ux): Sprint 37 — Provider Mode + Notification Separation v9.12.0"
```

---

## Task 13: Merge + Deploy

- [ ] **Run `/deploy` skill** to merge to master and deploy to karmyq.com

```bash
# Merge to master
git checkout master
git merge feature/sprint-37-provider-mode
git push origin master
```

- [ ] **Monitor GitHub Actions** — watch the deploy pipeline complete successfully

- [ ] **Verify on karmyq.com**
  - Log in as a user with a provider profile
  - Confirm `Member / Provider` toggle appears in nav
  - Toggle to Provider mode → confirm feed shows filtered requests
  - Confirm `ProviderDashboardCard` appears with stats
  - Confirm two notification bells render (community red, provider amber)
  - Toggle back to Member mode → confirm feed returns to normal

- [ ] **No DB migrations required for this sprint** (notification types are TypeScript only)
