# NAV_AUDIT.md — Navigation Label Audit

**Sprint 55 · Brand Rollout** | Read-only audit — no labels changed in this PR.

## Approved label map (from Design System)

| Tab / nav | Approved label | Mobile short | Disallowed |
|---|---|---|---|
| Discovery feed | **Browse** | Browse | Feed, Discover, Home |
| Things I've offered | **Helping** | Helping | Commitments, Promises, Volunteering, My Offers |
| Things I've asked for | **Asks** | Asks | My Requests, Requests, Wants, Needs |
| Notifications inbox | **Updates** | 🔔 | Activity, Inbox, Alerts |
| Self / settings | **Me** | Me | Profile, Account, You |
| Compose CTA (FAB) | **Ask** | Ask | New, Post, Create, +Add |

---

## Findings

### Frontend web app (`apps/frontend/`)

| File | Line | Current label | Suggested replacement | Risk |
|---|---|---|---|---|
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L3) | 3 | `TabId` type includes `'commitments'` | `'helping'` | **High** — URL query param (`?tab=commitments`); must rename in sync with all callers |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L3) | 3 | `TabId` type includes `'my-requests'` | `'asks'` | **High** — URL query param; must rename in sync |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L3) | 3 | `TabId` type includes `'profile'` | `'me'` | **High** — URL query param; must rename in sync |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L37) | 37 | `label: 'Commitments'` | `'Helping'` | Low — display only |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L37) | 37 | `mobileLabel: 'Commits'` | `'Helping'` | Low — display only |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L38) | 38 | `label: 'My Requests'` | `'Asks'` | Low — display only |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L38) | 38 | `mobileLabel: 'Requests'` | `'Asks'` | Low — display only |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L39) | 39 | `label: 'Profile'` | `'Me'` | Low — display only |
| [apps/frontend/src/components/TabBar.tsx](apps/frontend/src/components/TabBar.tsx#L39) | 39 | `mobileLabel: 'Profile'` | `'Me'` | Low — display only |
| [apps/frontend/src/pages/dashboard.tsx](apps/frontend/src/pages/dashboard.tsx#L119) | 119 | `tabParam === 'commitments'` | `'helping'` | **High** — must change with TabBar.tsx; inbound notification links use this |
| [apps/frontend/src/pages/dashboard.tsx](apps/frontend/src/pages/dashboard.tsx#L119) | 119 | `tabParam === 'my-requests'` | `'asks'` | **High** — same as above |
| [apps/frontend/src/pages/dashboard.tsx](apps/frontend/src/pages/dashboard.tsx#L119) | 119 | `tabParam === 'profile'` | `'me'` | **High** — same as above |
| [apps/frontend/src/pages/requests/[id].tsx](apps/frontend/src/pages/requests/[id].tsx#L20) | 20 | `router.replace('/dashboard?tab=commitments')` | `?tab=helping` | **High** — deep link; must match renamed TabId |
| [apps/frontend/src/components/MyRequestsTab.tsx](apps/frontend/src/components/MyRequestsTab.tsx#L123) | 123 | `<h2>My Requests</h2>` | `Asks` | Medium — section heading visible to users |
| [apps/frontend/src/components/Layout.tsx](apps/frontend/src/components/Layout.tsx#L35) | 35 | `Profile` (hamburger link text → `/profile` page) | `Me` or keep — this links to a page, not a tab | Low — page link, not a tab label; `/profile` route unchanged |
| [apps/frontend/src/components/community/CommunityLinks.tsx](apps/frontend/src/components/community/CommunityLinks.tsx#L257) | 257 | `Feed` (toggle label in community link settings) | `Browse` | Low — admin UI label |
| [apps/frontend/src/components/Feed/Feed.tsx](apps/frontend/src/components/Feed/Feed.tsx#L149) | 149 | `"Your Feed"` section heading | `"Browse"` or keep as prose | Low — not a nav label, just a heading |

### Mobile app (`apps/mobile/`)

| File | Line | Current label | Suggested replacement | Risk |
|---|---|---|---|---|
| [apps/mobile/app/(tabs)/_layout.tsx](apps/mobile/app/(tabs)/_layout.tsx#L22) | 22 | `title: "Feed"` | `"Browse"` | Medium — tab bar label; route file is `feed.tsx` (rename optional) |
| [apps/mobile/app/(tabs)/_layout.tsx](apps/mobile/app/(tabs)/_layout.tsx#L40) | 40 | `title: "Requests"` | `"Asks"` | Medium — tab bar label; route file is `requests.tsx` |
| [apps/mobile/app/(tabs)/_layout.tsx](apps/mobile/app/(tabs)/_layout.tsx#L57) | 57 | `title: "Profile"` | `"Me"` | Medium — tab bar label; route file is `profile.tsx` |

---

## Implementation notes (for when labels are changed)

**Rename TabId values atomically** — `TabBar.tsx` line 3 defines the type; `dashboard.tsx` line 119 reads `?tab=` from the URL; `requests/[id].tsx` line 20 builds a `?tab=commitments` redirect. All three must change together in one commit or deep links break.

**Notification service links** — confirm whether `notification-service` builds URLs with `?tab=commitments`. If so, that must be updated server-side too before deploying the renamed tab IDs.

**Mobile route files** — renaming `feed.tsx` → `browse.tsx`, `requests.tsx` → `asks.tsx`, `profile.tsx` → `me.tsx` is optional; changing only the `title:` strings in `_layout.tsx` is enough to fix the visible labels.
