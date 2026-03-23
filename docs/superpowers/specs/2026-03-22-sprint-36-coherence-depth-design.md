# Sprint 36: Site Coherence + Commitment Depth + Admin Power + Community Discovery — Design Spec

**Date**: 2026-03-22
**Status**: Approved
**Version**: v9.10.0 → v9.11.0
**Sprint Branch**: `feature/sprint-36-coherence-depth`

---

## Overview

Sprints 33–35 established the design system, rebuilt navigation, and introduced the Request Wizard. The visual language now exists — but only on pages those sprints touched. Sprint 36 closes the aesthetic gap: every surface the user sees should feel like one product, not a patchwork of different design eras.

Beyond aesthetics, this sprint deepens two of the platform's most important experiences. Commitments — the engine of mutual aid — get action-priority ordering (needs-response first, not chronological), an inline expandable conversation widget (so users stay in flow), and clear status transitions. The community admin page gets a structural simplification (7 tabs → 5, unified by intent) plus the first "admin as connector" tools: boosting requests and proposing matches. Finally, community discovery gets a geography/interest toggle so users can find communities by proximity (default) or by shared interest.

### Core Principle: Flow Over Navigation

Every interaction in Sprint 36 should keep users in context. Inline messaging expands in place. Admin actions happen without leaving the admin page. Community discovery changes the view without a page reload. Users should feel like they're diving deeper, not jumping around.

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation — tokens, typography, card patterns | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request Wizard + service hiring CTA | ✅ Complete |
| **36** | Commitment depth + admin simplification + community discovery | 🔜 **This sprint** |

---

## New Concepts

**Action Priority Ordering**: Commitments sorted by urgency of required action, not by when they were created. The three tiers: (1) needs-your-response (proposed status, awaiting your accept/decline), (2) active (matched, help in progress), (3) resolved (completed/cancelled). Within each tier, sort by `updated_at DESC` so most recent activity surfaces first.

**Expandable Conversation Widget**: A minimized chat panel embedded within a commitment card. Shows unread count when collapsed. Expands inline (no page nav) to show the full message thread. Uses the existing messaging service `getOrCreateConversation(match_id)` pattern — conversations are auto-created on first open.

**Admin as Connector**: Admins can take direct action on requests: boost (surfaces the request higher in member feeds for 48h), propose a specific member as a match, or tag as community-urgent. These are admin privileges that go beyond passive request viewing.

**Community Discovery Mode**: Two lenses for the communities listing — Geography (default, sorted by distance from user's current location using browser geolocation) and Interests (filtered by community tags). Mode persists in local storage.

---

## Data Model

### Migration 014: Community Tags + Coordinates

```sql
-- Add geographic coordinates and interest tags to communities
ALTER TABLE communities.communities
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for geographic queries
CREATE INDEX IF NOT EXISTS idx_communities_location_geo
  ON communities.communities (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_communities_tags
  ON communities.communities USING GIN (tags);
```

### Migration 015: Request Boost Fields

```sql
-- Add admin boost capability to help_requests
ALTER TABLE requests.help_requests
  ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS boosted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS boosted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS boosted_expires_at TIMESTAMP; -- boosts expire after 48h

CREATE INDEX IF NOT EXISTS idx_requests_is_boosted
  ON requests.help_requests (is_boosted, boosted_expires_at)
  WHERE is_boosted = TRUE;
```

**No schema change needed for inline messaging**: `messaging.conversations` already has `request_match_id UUID REFERENCES requests.matches(id)`. The messaging service already implements `getOrCreateConversation(match_id)`. Frontend just needs to call it.

---

## API Endpoints

### Community Service — New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/communities?mode=geography&lat=X&lng=Y` | JWT | List communities sorted by distance from lat/lng |
| `GET` | `/communities?mode=interests&tags=a,b` | JWT | List communities filtered by tags |
| `PUT` | `/communities/:id/tags` | JWT (admin) | Update community tags (array of strings) |
| `PUT` | `/communities/:id/location` | JWT (admin) | Update community lat/lng (geocoding call inside) |

### Request Service — Admin Actions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/requests/:id/boost` | JWT (community admin) | Boost request for 48h. Sets `is_boosted=true`, `boosted_expires_at = now() + 48h` |
| `DELETE` | `/requests/:id/boost` | JWT (community admin) | Remove boost early |
| `POST` | `/requests/:id/propose-match` | JWT (community admin) | Body: `{ user_id }`. Creates a match record with status `proposed` on behalf of admin |
| `PATCH` | `/requests/:id/urgent` | JWT (community admin) | Toggles `urgency` to `urgent`. Body: `{ urgent: boolean }` |

### Messaging Service — No New Endpoints

Existing: `GET /conversations/match/:matchId` (or `POST /conversations` with `{ request_match_id }`) returns or creates a conversation. Messages fetched via existing `GET /conversations/:id/messages`. Real-time via existing Socket.IO.

---

## Frontend Changes

### CommitmentsTab.tsx — Priority Ordering + Expandable Conversation

- **Sort function**: `sortByActionPriority(matches)` — maps status to priority: `proposed=0`, `matched=1`, `completed=2`. Within tier, sort by `updated_at DESC`.
- **Section headers**: "Needs Your Response", "In Progress", "Completed" — collapsible groups within the tab.
- **ExpandableConversation component** (new): Embedded in each commitment card. Props: `matchId`, `otherUserId`, `otherUserName`. Renders a chat icon + unread badge when collapsed. Clicking opens an inline panel (max-height with overflow-y scroll) showing message thread. Uses existing `/api/messaging/conversations/match/:matchId` and Socket.IO for real-time.
- **Status clarity**: Visual step-indicator (dots or pills: Proposed → Matched → Completed) replacing the simple status badge. Proposed status shows "Accept / Decline" action buttons prominently.

### communities/[id].tsx — Admin Tab Consolidation + Aesthetic Refresh

**Current tabs (7)**: Overview | Members | Norms | Requests | Insights | Providers | Settings

**New tabs (5)**:
| New Tab | Contains | Access |
|---------|----------|--------|
| **Overview** | Stats, quick actions, trust health, network graph | All members |
| **People** | Active members + pending invites (toggle) + community norms inline | isAdminOrMod |
| **Requests** | Request list + admin actions (boost, propose match, urgent tag) + insights merged | isAdminOrMod |
| **Providers** | Provider config unchanged | isAdminOrMod |
| **Settings** | Trust config + community config + export — consolidated | isAdmin |

**Aesthetic refresh**: Apply Sprint 33–35 design tokens — semantic colors (`--color-primary`, `--color-surface`, `--color-border`), consistent card patterns, skeleton loaders for async sections, proper spacing rhythm. Bring visual parity with BrowseFeed and RequestWizard.

### communities/index.tsx — Discovery Toggle

- **DiscoveryToggle component** (new): Two-button toggle "Near Me" (geography, default) | "By Interest" (tags). Persists mode to `localStorage`.
- **Geography mode**: On mount, request `navigator.geolocation`. If granted, call `GET /communities?mode=geography&lat=X&lng=Y`. Show communities sorted by distance with a subtle distance label ("~2.4 km away"). If geolocation denied, fall back to alphabetical with a notice.
- **Interests mode**: Tag filter chips (from unique tags across communities). Multi-select. Calls `GET /communities?mode=interests&tags=a,b`.
- **Aesthetic refresh**: Match card styling to BrowseFeed cards. Add skeleton loader.

### Admin Connector Actions in Requests Tab

- Each request row has an action dropdown (admin only): Boost / Remove Boost | Tag Urgent | Propose a Match
- "Propose a Match" opens a MemberPicker modal — type-ahead search of community members, select one, confirm. Calls `POST /requests/:id/propose-match`.
- Boosted requests show a "⚡ Boosted" badge with expiry countdown.

---

## Feed Integration — Boosted Requests

The feed service must factor in `is_boosted` when scoring requests for the curated feed. Boosted requests that are still within `boosted_expires_at` get a `+0.3` score bonus (capped at 1.0). A cron-style cleanup (or query-time filter) auto-expires boosts past `boosted_expires_at`.

---

## User Guide & Doc Updates

Every sprint ships doc updates. Required this sprint:

| Guide | Change |
|-------|--------|
| `apps/landing/src/data/docs/guides/managing-commitments.json` | New guide: action-priority ordering, status step indicator, inline messaging widget UX |
| `apps/landing/src/data/docs/guides/finding-communities.json` | New guide: geography vs interest discovery, how to set community tags, distance sorting |
| `apps/landing/src/data/docs/guides/admin-community.json` | Update: new 5-tab structure, admin connector tools (boost, propose match, urgent), People tab |
| `apps/landing/src/data/docs/concepts/community-discovery.json` | New concept: geography-first vs interest-based community organization |
| `apps/landing/src/data/docs/nav.json` | Add managing-commitments and finding-communities to User Guides; add community-discovery to Concepts |

---

## Critical Implementation Notes

1. **Messaging wire-up — no new schema**: `messaging.conversations.request_match_id` already exists. The messaging service `messageService.getOrCreateConversation(matchId)` creates conversations lazily. Frontend calls `GET /api/messaging/conversations/match/:matchId` to get the conversation id, then fetches messages normally.

2. **Tab restructure — preserve ValidTab type**: `communities/[id].tsx` defines `ValidTab` as a union type and `VALID_TABS` array. Both must be updated when removing/renaming tabs. The URL param `?tab=...` must remain backward-compatible via the existing `OLD_TAB_MAP` — add mappings for removed tab names.

3. **Boost expiry — query-time, not cron**: When fetching curated feed, filter with `AND (is_boosted = FALSE OR boosted_expires_at > NOW())`. Don't rely on a background cleanup job. The index on `(is_boosted, boosted_expires_at)` makes this fast.

4. **Geolocation permission flow**: `navigator.geolocation.getCurrentPosition` is async and may be denied. The communities listing must render immediately with a loading/fallback state, then update when/if location resolves. Never block render on geolocation.

5. **Tag normalization**: Store tags lowercase, trimmed, no special chars. `tags.map(t => t.toLowerCase().trim())` before DB insert. The `GIN` index on `tags` supports `@>` and `&&` operators for filtering.

6. **Admin propose-match creates a real match**: `POST /requests/:id/propose-match` inserts into `requests.matches` with `status='proposed'`, `responder_id` = the proposed user. The proposed user sees it in their CommitmentsTab as "Needs Your Response". They accept or decline normally.

7. **People tab — merge Members + Norms**: The People tab shows the members list (active/pending toggle) with the norms accordion below. This is frontend-only — both data fetches already exist, just co-located on one tab.

8. **Settings tab consolidation**: Trust config (currently in Insights/Settings mix) and community config (max_members, access_type, etc.) merge into a single Settings tab with clearly labeled sections. No backend changes — just layout.

9. **tailwindcss-animate NOT installed**: Do not use `animate-in` class. Use CSS transitions with inline `style` or className conditionals.
