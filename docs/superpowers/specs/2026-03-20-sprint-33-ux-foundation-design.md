# Sprint 33: UX Foundation — Design Spec

**Date**: 2026-03-20
**Status**: Approved
**Version**: v9.7.1 → v9.8.0
**Sprint Branch**: `feature/sprint-33-ux-foundation`

---

## Overview

Karmyq has grown organically across 32 sprints. The result is a feature-rich platform with a design that feels assembled rather than intentional — inconsistent component styling, no onboarding for new users, sparse empty states, and documentation written for developers rather than the people who will actually use the app.

Sprint 33 begins a multi-sprint UX arc by laying the foundation: establishing a canonical design language, guiding new users through their first steps, and rewriting the public-facing copy and documentation for plain-language accessibility. The goal is to make Karmyq feel considered — every screen, every interaction, every word.

Mobile responsiveness is deliberately deferred to Sprint 34. Web patterns should be settled first so that the same decisions can be applied consistently across screen sizes and eventually inform the React Native mobile app.

### Core Principle: Intentional Simplicity

Every design choice in this sprint asks: *would a non-technical person find this obvious?* If not, make it simpler — don't add more UI to explain bad UI.

---

## Multi-Sprint Arc

### Sprint 32 — Fractal Feed (complete)
Trust-score-driven feed calibration. Evolution parameters wired to reputation. ADR-046 arc complete.

### Sprint 33 — UX Foundation (this sprint)
Design consistency + onboarding + empty states + landing page + guide rewrites.

### Sprint 34 — UX: Mobile + Core Flows (upcoming)
Mobile navigation (hamburger/drawer), dashboard responsive redesign, community join flow simplification, request creation UX.

### Sprint 35 — UX: Admin + Polish (upcoming)
Admin page simplification, social graph naturalness improvements, final performance deep-dive.

---

## New Concepts

**`karmyq_onboarded`** — localStorage key set after a user completes or dismisses the WelcomeModal. Absence of this key triggers the 3-step welcome flow on first dashboard visit.

**Canonical design classes** — `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input`, `.section-heading` defined as `@layer components` in `globals.css`. These replace ad-hoc one-off Tailwind utility strings throughout the app.

---

## Data Model

No database or schema changes. Pure frontend sprint.

---

## API Endpoints

No new endpoints. The evolution toggle move (`profile.tsx`) reuses existing endpoints already in `api.ts`:
- `reputationService.getGlobalEvolutionSetting(userId)` — line 684
- `reputationService.setGlobalEvolutionSetting(userId, enabled)` — line 685

---

## Frontend Changes

### New Components

**`EmptyState.tsx`**
Reusable component: emoji icon, heading, body text, optional CTA button or link. Used on all list pages when content is absent.

Props:
```typescript
interface EmptyStateProps {
  icon?: string
  heading: string
  body: string
  ctaLabel?: string
  ctaHref?: string
  ctaOnClick?: () => void
}
```

Instances:
| Page | Condition | Message |
|------|-----------|---------|
| `dashboard.tsx` | No feed items + not loading | "Nothing here yet" → Browse Communities |
| `communities/index.tsx` | No communities + not loading | "No communities found" → Create a Community |
| `requests/index.tsx` | No requests + not loading | "No requests yet" → Post a Request |
| `offers/index.tsx` | No offers + not loading | "No offers yet" → Go to Dashboard |

---

**`WelcomeModal.tsx`**
3-step onboarding modal shown to users who have never visited the dashboard (controlled by `karmyq_onboarded` localStorage flag). Hydration-safe: `visible` initializes `false`, set to `true` in `useEffect` only.

| Step | Heading | Body | CTA |
|------|---------|------|-----|
| 1 | "Welcome to Karmyq" | "Karmyq is a place where neighbors help neighbors. Ask for what you need. Offer what you can. Build real connections." | Next → |
| 2 | "Start with a community" | "Communities are the heart of Karmyq. Join one near you — your neighborhood, building, or a group you're part of." | Browse Communities / Skip → |
| 3 | "Ask for something" | "Don't be shy. Whether it's a ride, a tool to borrow, or just a hand — just ask. Your community wants to help." | Post a Request / Done |

---

### Modified Pages / Components

**`globals.css`** — add canonical `@layer components` classes (btn-primary, btn-secondary, btn-ghost, btn-danger, card, input, section-heading). Apply across high-traffic pages to replace inconsistent one-off utilities.

**`dashboard.tsx`** — add `<WelcomeModal>`, replace inline empty state with `<EmptyState>`, apply canonical classes.

**`reputation/trust.tsx`** — remove evolution toggle block entirely. Add link: "Manage trust evolution settings on your Profile page."

**`profile.tsx`** — add "Trust Evolution Settings" section at bottom (copy of evolution toggle UI from trust.tsx). Replace static `NetworkGraph` import with `next/dynamic` + `ssr: false`.

**`communities/new.tsx`**, **`communities/[id].tsx`** — `next/dynamic` for `CommunityConfigEditor` (592 lines, not needed on page load).

**`admin/schemas/[id]/edit.tsx`** — `next/dynamic` for `SchemaCanvas`.

---

## User Guide & Doc Updates

**MANDATORY** — every sprint ships doc updates.

### Landing page (`apps/landing/`)

| Item | Change |
|------|--------|
| `Hero.tsx` | Rewrite eyebrow ("Mutual aid for everyday life"), H1 ("Ask for help. Offer what you can. Build real connections."), body (remove "gift economy"/"infrastructure" jargon) |
| `scripts/generate-docs.ts` | Fix label truncation: `.slice(0, 55)` → `.slice(0, 80)` |
| `scripts/generate-docs.ts` | Fix ADR status regex: add `[^a-zA-Z]*` to skip emoji before status word |
| `scripts/generate-docs.ts` | Add 11 orphaned ADRs to `ADR_GROUPS` (unreachable from sidebar today) |

Orphaned ADRs to add:
- Foundation: `adr-005-minimalist-dashboard`, `adr-008-three-column-dashboard`
- Trust & Reputation: `adr-035-karma-allocation-trust-score-strategy`
- Requests & Matching: `adr-033-offer-fulfillment-workflow`
- Infrastructure: `adr-001`, `adr-002`, `adr-012`, `adr-014`, `adr-023`, `adr-024`, `adr-027`

### User guides (source files in `docs/guides/`)

| Guide | Change |
|-------|--------|
| `getting-started-guide.md` | Plain-language rewrite: simpler headings, remove "karma lockout period" jargon, conversational tone |
| `making-requests-guide.md` | Add concrete example (`"I need a lift to the airport Friday morning — 7am, NW6 area"`), simplify expiration concept |

Both guides are source markdown; `generate-docs.ts` propagates to JSON. No new nav entries needed — these are rewrites of existing guides.

---

## Critical Implementation Notes

1. **`generate-docs.ts` is source of truth for `nav.json`** — NEVER edit `apps/landing/src/data/docs/nav.json` directly. It is wiped on every build. All three landing fixes go in `scripts/generate-docs.ts`.

2. **`git add -f` for generated docs** — use `git add -f apps/landing/src/data/docs/nav.json` (and other generated files) before commit. The directory may be partially gitignored.

3. **WelcomeModal hydration safety** — initialize `visible = false`. Set to `true` only in `useEffect`. Never read `localStorage` at render time.

4. **`next/dynamic` requires `ssr: false`** for `NetworkGraph`, `CommunityConfigEditor`, `SchemaCanvas` — all reference browser APIs that crash during SSR.

5. **EmptyState visibility** — only show when `!loading && items.length === 0`. Avoids flash on initial load.

6. **Design consistency scope** — NOT a redesign. The existing CSS variables and Tailwind tokens are well-structured. This pass replaces visible divergence (wrong colors, hardcoded padding, inline styles) with canonical classes. Do not touch visually consistent components.

7. **Evolution toggle duplication** — `TrustEvolutionToggle` sub-component will be temporarily duplicated in `profile.tsx` (copied from trust.tsx). Extraction to a shared component is Sprint 34 cleanup.

8. **Evolution communities in profile.tsx** — read from localStorage JWT to avoid an extra API call: `JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []`. Each item has `id` and `name`.
