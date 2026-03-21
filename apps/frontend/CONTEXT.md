# Frontend CONTEXT.md

**Last updated**: 2026-03-20 (Sprint 33)

## Overview

Next.js 14 web application (Pages Router) consuming all Karmyq backend services.

---

## New Components (Sprint 33)

### `EmptyState.tsx`
**Path**: `src/components/EmptyState.tsx`
Reusable empty-state block. Used on: Dashboard, Communities list, Requests list, Offers list.

Props: `icon?` (emoji), `heading`, `body`, `ctaLabel?`, `ctaHref?`, `ctaOnClick?`

**Usage guard**: Only render when `!loading && items.length === 0` to prevent flash during initial load.

### `WelcomeModal.tsx`
**Path**: `src/components/WelcomeModal.tsx`
3-step first-time onboarding modal. Controlled by `karmyq_onboarded` localStorage key.

- Hydration-safe: `visible` initialises `false`; set `true` only inside `useEffect` after checking localStorage
- On close/done: writes `karmyq_onboarded = '1'` to localStorage
- Rendered inside `dashboard.tsx` `<Layout>`, above the main grid

---

## Patterns

### `next/dynamic` + `ssr: false`
Used for components that reference browser APIs (`window`, `canvas`, `document`). Omitting `ssr: false` crashes the dev server during SSR.

| Component | File |
|---|---|
| `NetworkGraph` | `profile.tsx` |
| `CommunityConfigEditor` | `communities/new.tsx`, `communities/[id].tsx` |
| `SchemaCanvas` | `admin/schemas/[id]/edit.tsx` |

### `karmyq_onboarded` localStorage flag
Absence of this key triggers the `WelcomeModal`. Set to `'1'` on first close. Checked in `useEffect` (never at render time).

### Canonical CSS classes (`globals.css @layer components`)
Sprint 33 added canonical utility classes. Use these instead of raw Tailwind on buttons, inputs, and cards:

| Class | Usage |
|---|---|
| `.btn-primary` | Primary action buttons |
| `.btn-secondary` | Secondary / outline buttons |
| `.btn-ghost` | Text-style buttons |
| `.btn-danger` | Destructive actions |
| `.card` | Container cards |
| `.input` | Form inputs |
| `.section-heading` | Section headings within pages |

---

## Evolution Toggle (Sprint 33 move)

The Trust Evolution toggle was removed from `reputation/trust.tsx` and moved to `profile.tsx` (bottom section, "Trust Evolution Settings").

- `trust.tsx` now shows a plain link: "Manage trust evolution settings on your Profile page."
- `profile.tsx` reads communities from the localStorage JWT (no extra API call): `JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []`

---

## Known Issues / Pre-existing TS Warnings

These warnings exist in the codebase and were NOT introduced in Sprint 33:
- `BUILD_VERSION` declared but never read (profile.tsx)
- `fetchUserCommunities` / `fetchPrivacySettings` declared but never read (profile.tsx)
- `FormEvent` deprecated (login.tsx, register.tsx, communities/[id].tsx, communities/new.tsx)
- `InlineChat` unused import
