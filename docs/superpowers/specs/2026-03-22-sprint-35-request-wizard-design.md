# Sprint 35: Request Wizard + Service Hiring — Design Spec

**Date**: 2026-03-22
**Status**: Approved
**Version**: v9.9.0 → v9.10.0
**Sprint Branch**: `feature/sprint-35-request-wizard`

---

## Overview

The current request form is embedded inside `dashboard.tsx` as a 500-line inline block. It couples a type selector, NLP smart-text autocomplete, schema-driven dynamic fields, and community scope into one overwhelming surface. Research showed users abandon the form because it's unclear where to start — and the smart-text autocomplete (`@time`, `#count`, `$budget`, `!urgent`) proved flaky and unfamiliar.

Sprint 35 replaces this with a two-step wizard: **pick a type** (step 1), then **fill minimal fields** for that type (step 2). The entire flow takes 3 interactions: FAB tap → type tap → Submit. Smart-text is removed entirely. The `DynamicForm` schema system is preserved — the wizard is a cleaner shell around it.

A second outcome: **service hiring gets a front door**. Provider cards and profiles gain a "Get Service" CTA. The FAB on the dashboard expands into two actions: "Get Help" (community request) and "Get Service" (provider request). From a provider profile, the wizard opens pre-filled — provider and service type locked — so the user only writes a description.

### Core Principle: One Decision Per Screen

Every screen in the wizard asks one question. Step 1: "What kind of help?" Step 2: "Tell us more." No decision competes with another.

---

## Multi-Sprint UX Arc

| Sprint | Focus | Status |
|--------|-------|--------|
| **33** | Design system foundation | ✅ Complete |
| **34** | Tab navigation + feed simplification | ✅ Complete |
| **35** | Request wizard + service hiring CTA | 🔜 **This sprint** |
| **36** | Commitment depth (timeline, inline messaging) + admin simplification | Future |

---

## New Concepts

**Speed-dial FAB**: A single floating action button that expands on tap into a small stack of labeled action buttons. Resting state keeps the UI clean; expanded state surfaces contextual actions without permanent screen real estate.

**Wizard pre-fill context**: When the wizard is opened from a provider profile, `preferredProviderId` + `preferredProviderServiceType` are passed as props. Step 1 type is pre-selected and locked (greyed with a lock icon); step 2 shows the provider's name in the header.

---

## Data Model

No schema changes. `preferred_provider_id` and explicit `urgency` are already accepted by the request service. The `nlpPayload` / `buildPayloadFromParsed` logic is removed from the request payload — wizard sends explicit fields only.

---

## API Endpoints

No new endpoints. Existing:
- `POST /requests` — wizard calls this with `request_type`, `description`, `urgency`, `dynamic_payload`, `preferred_provider_id` (optional), `community_id` (optional)
- `GET /requests/schemas/:type` — used in step 2 to load the DynamicForm schema (same as current)

---

## Frontend Changes

### New Components

| Component | Path | Description |
|-----------|------|-------------|
| `RequestWizard` | `src/components/RequestWizard.tsx` | Self-contained two-step modal wizard. Step 1: type picker grid. Step 2: DynamicForm + description + urgency + scope. Accepts `preferredProviderId`, `preferredProviderServiceType`, `preferredProviderName` props for pre-fill context. Owns all request creation logic (extracted from dashboard). |
| `SpeedDialFab` | `src/components/SpeedDialFab.tsx` | Expandable FAB. Resting: single `+` button. Expanded: stacked action buttons animate up. Props: `activeTab`, `onGetHelp`, `onGetService`. Tab-aware: Browse/Commitments show both; My Requests shows Get Help only; Providers shows Get Service only; Profile shows nothing. |

### Modified Components

| File | Change |
|------|--------|
| `apps/frontend/src/pages/dashboard.tsx` | Remove 500-line inline form. Replace `.fab` with `<SpeedDialFab>`. Add `<RequestWizard>` controlled by `showWizard` + `wizardMode` state. |
| `apps/frontend/src/pages/providers/index.tsx` | Add `SpeedDialFab` (Get Service only). Import `RequestWizard`. Add `onGetService` handler. |
| `apps/frontend/src/pages/providers/[id].tsx` | Add prominent "Get Service" button near the top of provider detail. Import `RequestWizard`. Wire with provider pre-fill props. |
| `apps/frontend/src/components/providers/ProviderCard.tsx` | Add "Get Service" button inside card. Needs `onGetService?: (provider) => void` callback prop. Listing page wires this callback to open the wizard. |
| `apps/frontend/src/styles/globals.css` | New CSS classes: `.speed-dial`, `.speed-dial-action`, `.wizard-step`, `.type-card`, `.type-card.selected`, `.type-card.locked`, `.urgency-option`. Aesthetics pass: audit and fix spacing/color/transition inconsistencies. |

### Request Wizard — Detailed Flow

**Step 1: Type picker**
- 2-column grid on mobile, 3-column on desktop
- Each cell: icon (SVG, 24px) + label, `type-card` class
- Icons: Generic (sparkle), Ride (car), Service (wrench), Event (calendar), Borrow (box), Food (shopping bag)
- Tap → step 1 collapses, step 2 slides in
- When `preferredProviderServiceType` set: that type pre-selected + `.locked` styling + lock icon; other types are dimmed (not disabled — user can still change)

**Step 2: Fields**
- Header: "What do you need?" (or "Request from [Provider Name]" if provider context)
- `DynamicForm` for schema-specific fields (same as current `fetchSchema` + `DynamicForm` pattern)
- Clean `<textarea>` for description — **no autocomplete, no smart text, no @hints**
- Urgency: `<div>` with 3 radio-style chip buttons: `Normal` | `Urgent` | `Critical`
- Scope: subtle "Post to: All communities ▾" dropdown collapsed; expands to community picker
- Back button: returns to step 1 (does not reset type)
- Submit: `btn-primary w-full`

**Step progress**: Two dots at top of modal — dot 1 filled in step 1, both filled in step 2. No labels needed.

### SpeedDialFab — Behavior

```
Resting:
  [ + ]  ← .fab at bottom-24 right-6 (desktop: bottom-8)

Expanded (tap):
  [ Get Service ]  ← .speed-dial-action (slides up 64px)
  [ Get Help    ]  ← .speed-dial-action (slides up 128px)
  [ × ]            ← dismiss/close button

Tab-aware visibility:
  browse:       Get Help + Get Service
  commitments:  Get Help only
  my-requests:  Get Help only
  profile:      hidden
  /providers:   Get Service only
```

### Aesthetics Pass

These changes are part of this sprint and must be included in Task 9 (aesthetics):

| Area | Change |
|------|--------|
| Tab content transitions | Add `transition-opacity duration-150` wrapper on tab panel mount/unmount |
| Semantic color audit | Replace inline `gray-*` / `white` with semantic tokens (`text-text`, `bg-surface`, `bg-surface-raised`, `border-border`) in `BrowseFeed`, `CommitmentsTab`, `MyRequestsTab`, `ProviderCard` |
| Skeleton loaders | Replace all `text-xs text-text-subtle` "Loading…" strings with `animate-pulse` skeleton divs |
| Focus rings | All interactive elements: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` |
| Spacing consistency | Tab content areas: `px-4 py-4 max-w-2xl mx-auto` — confirm all 4 tabs match |
| Button height | All `.btn-*` buttons: `h-9` minimum for touch targets (add `min-h-[36px]` to globals.css btn classes if needed) |

---

## User Guide & Doc Updates

### Update: `docs/guides/making-requests-guide.md`
- Replace the "Step 2: Fill in the form" section to document the two-step wizard
- Remove any mention of smart-text shortcuts (`@time`, `#count`, `$budget`, `!urgent`)
- Add a section: "Getting help from a provider" → document the "Get Service" button flow

### Update: `docs/guides/getting-started-guide.md`
- Section "Getting Started → First request" → update to reflect wizard flow
- Add a note about the FAB expanding to two options

### Update: `docs/concepts/ux-design-principles.md`
- Add a row to the design evolution table for Sprint 35
- Add a paragraph on the "3-click rule" and type-first design rationale

---

## Critical Implementation Notes

1. **Remove NLP logic entirely.** `EnhancedAutocomplete`, `ExtractedDataChips`, `parsedRequest`, `setParsedRequest`, `autocompleteSuggestions`, `handleDescriptionChange` (the NLP-calling version), and `buildPayloadFromParsed` are removed from dashboard. The `RequestWizard` uses a plain `onChange` textarea. DO NOT carry these imports into the new wizard.

2. **`availableTypes` is fetched, not hardcoded.** The current dashboard fetches `requestService.getRequestTypes()` into `availableTypes`. `RequestWizard` must replicate this fetch on mount (or accept it as a prop). Do not hardcode the type list.

3. **`DynamicForm` is kept.** The schema-driven fields work well — only the container (smart textarea) is replaced. `fetchSchema(type)` is called in step 1 as soon as user taps a type, so step 2 loads instantly.

4. **Urgency is now explicit.** Currently `urgency` comes from NLP (`parsedRequest?.extractedData.urgency || 'medium'`). In the wizard, urgency is an explicit user selection, defaulting to `'normal'`. Map: `normal → medium` when building the API payload (backend uses `medium`, not `normal`).

5. **`preferred_provider_id` goes in the request payload.** When `preferredProviderId` is set, include it in the `POST /requests` body. The backend already accepts this field. No other changes needed.

6. **`ProviderCard` needs a callback, not a router.push.** The card lives inside `providers/index.tsx`. When the user clicks "Get Service" on a card, the listing page opens the `RequestWizard` modal with provider props — it does NOT navigate. Use `onGetService?: (provider) => void` prop pattern.

7. **Step 1 must kick off `fetchSchema` immediately.** As soon as the user taps a type tile, call `fetchSchema(type)` so the DynamicForm is ready by the time step 2 renders. Do not wait until step 2 mounts.

8. **SpeedDialFab Z-index layering.** Speed-dial actions must sit above tab content (`z-40`) but below the wizard modal (`z-50`). The dismiss overlay (backdrop) for the speed-dial is a transparent click-catcher div at `z-39`.

9. **No worktrees.** Work directly on `feature/sprint-35-request-wizard`.
