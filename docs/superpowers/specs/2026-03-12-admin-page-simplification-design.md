# Admin Page Simplification

**Date**: 2026-03-12
**Status**: Approved
**Author**: Brainstorming session

---

## Problem

The community admin page (`/communities/[id]`) has 12 tabs visible to admins — 4 public and 8 admin-only. Three of those tabs handle member management with significant overlap, and two separate tabs both deal with community configuration. The result is a busy, hard-to-navigate admin experience.

Specific pain points:
- **Members** (public) and **Manage Members** (admin) show nearly identical member lists — one is read-only, the other adds role/remove controls
- **Pending** is a third separate tab just for join request approval
- **Configuration** (trust model, karma, request types) and **Settings** (TTLs, karma decay) are both "community settings" split across two tabs for no clear reason

---

## Goal

Reduce admin tab count from 12 to 7 by collapsing related surfaces. No functionality is removed. All existing features remain accessible — just reorganized.

---

## Design

### New tab structure

| Tab | Visibility | What it contains |
|-----|-----------|-----------------|
| Overview | Public | Unchanged |
| Members | Public + admin actions | Merged: Members + Manage Members + Pending |
| Norms | Public | Unchanged |
| Requests | Admin | Unchanged |
| Insights | Admin | Merged: Statistics + Export |
| Settings | Admin | Merged: Configuration + Settings + Linked Communities section |
| Providers | Admin | Unchanged |

**Removed tabs** (content absorbed into others):
- Manage Members → Members
- Pending → Members
- Configuration → Settings
- Statistics → Insights
- Export → Insights
- Linked Communities → Settings (as a section)

**Note on Configuration tab visibility change**: The existing Configuration tab is public (visible to all members, read-only for non-founders). Moving its content into the admin-only Settings tab intentionally removes this public read-only view. This is acceptable because the Overview tab already surfaces key config values as highlight panels (Karma Mechanics, Trust Mechanics, Request Types, Community Rules) — non-admins retain visibility into community configuration via Overview.

---

### Members tab

Replaces three tabs: Members, Manage Members, Pending.

**Non-admin view** (unchanged from today's Members tab):
- Existing card layout: name, email, invited-by, trust score badge, role badge, join date
- No filter row, no role dropdown, no Remove button
- Invite button not shown (admin-only)

**Admin view** (augmented):
- Filter row at top: `Active (N)` | `Pending (N)` (red badge when count > 0) | `+ Invite member`
- **Active view** (default): table with member name, email, join date, role dropdown, Remove button
  - Role dropdown disabled for: community creator, currently logged-in admin (can't self-demote)
  - Remove button disabled for same accounts
  - Inline save — role dropdown change saves on change (existing behavior)
- **Pending view**: one row per join request — name, email, request date, join message (if provided), Approve / Reject buttons
  - No change to underlying API calls

**Tab badge**: Red dot on the "Members" tab label itself when pending count > 0 (admin-only, derived from `community.members` filtered by `status === 'pending'`).

---

### Settings tab

Admin-only. Replaces two tabs (Configuration, Settings) and absorbs Linked Communities.

Three sections, rendered as a scrollable single page:

#### 1. Community configuration
- Summary card showing current key values: karma split, trust path hops, visibility mode, join approval setting
- "Edit configuration" button opens the existing `CommunityConfigEditor` inline (no navigation change)
- "↺ Revisit trust model" button triggers `CommunityTrustQuestionnaire` (same as today)
- `TrustModelDiff` shown when questionnaire produces a proposed config change

#### 2. Linked communities
- Renders the existing `<CommunityLinks>` component unchanged
- Previously its own tab; now a section here

#### 3. Advanced (collapsed by default)
- Toggle: `▸ Advanced` expands to reveal lower-level settings
- Contains all 6 TTL fields: Request, Offer, Match, Notification, Message, Session (days)
- Contains karma decay toggle + half-life months input
- Single "Save advanced settings" button for this section
- Collapsed by default — admins who never touch these settings never see them

---

### Insights tab

Admin-only. Replaces two tabs: Statistics, Export.

Two sections, rendered top-to-bottom:

#### 1. Community stats
- 4 stat cards: Total exchanges, Active requests, Avg karma, This week
- Community trust score panel: score out of 100, progress bar, 3-part breakdown (Member Quality 40pts, Bonding 30pts, Bridging 30pts)
- Network Cohesion panel: reciprocity, density, clustering, avg path length (same as today's Statistics tab)
- "↻ Refresh" button re-fetches live data (same behavior as today's Statistics tab)

#### 2. Export data
- 3 export rows: Full community export, Members list, Activity report
- Each row: description + JSON button + CSV button
- No functional change from today's Export tab

---

## Implementation notes

### Files affected

- `apps/frontend/src/pages/communities/[id].tsx` — primary file, all changes land here
- No backend changes required
- No new components required — existing components (`CommunityConfigEditor`, `CommunityTrustQuestionnaire`, `TrustModelDiff`, `CommunityLinks`) are reused as-is

### State changes

- `activeTab` type union narrows: remove `'manage'`, `'pending'`, `'export'`, `'stats'`, `'links'`; add `'insights'`; rename `'config'` to `'settings'`
  - Before: `'overview' | 'members' | 'norms' | 'config' | 'manage' | 'pending' | 'settings' | 'stats' | 'export' | 'providers' | 'links' | 'requests'`
  - After: `'overview' | 'members' | 'norms' | 'requests' | 'insights' | 'settings' | 'providers'`
- Add `memberFilter: 'active' | 'pending'` state for the Members tab admin filter
- Remove state used exclusively by removed tabs (no functional impact)

### Tab navigation guard

The `?tab=` query param is used both by the `/communities/[id]/admin` redirect and by any direct navigation to `/communities/[id]?tab=X` (from browser history, external links, etc.). The guard must apply to all navigation, not just the admin redirect. Map old tab names to new ones:

- `?tab=manage` → `?tab=members`
- `?tab=pending` → `?tab=members`
- `?tab=config` → `?tab=settings`
- `?tab=stats` → `?tab=insights`
- `?tab=export` → `?tab=insights`
- `?tab=links` → `?tab=settings`

Implement as a `useEffect` on `router.query.tab` that replaces unknown tab values with their mapped equivalents before setting `activeTab`.

### Pending badge

In the tab bar, when `activeTab !== 'members'` and `isAdmin` and pending count > 0, show a red dot on the Members tab button. Pending count derived from `community.members.filter(m => m.status === 'pending').length` (already fetched on page load).

---

## Out of scope

- No changes to Overview, Norms, Requests, or Providers tabs
- No backend API changes
- No redesign of the CommunityConfigEditor component itself
- No mobile-specific changes
- The Overview tab's existing config highlight panels (Karma Mechanics, Trust Mechanics, etc.) are intentionally left as the non-admin's view of community configuration — no changes needed there

---

## Success criteria

- [ ] Admin sees exactly 7 tabs
- [ ] All existing admin functionality is accessible within the new structure
- [ ] Non-admin members see the existing card-style member list (no filter row, no role/remove controls)
- [ ] Pending join requests surface via badge on Members tab when count > 0 (admin-only)
- [ ] Advanced settings collapsed by default; all 6 TTL fields + karma decay accessible on expand
- [ ] Old `?tab=` query params redirect correctly for both admin redirect and direct navigation
- [ ] Network Cohesion panel present in Insights tab
- [ ] Overview tab config highlight panels remain unchanged (non-admin config visibility preserved)
