# Sprint 48: Onboarding — Contextual Workflow Guides — Design Spec

**Date**: 2026-04-08
**Status**: Approved
**Version**: v9.13.0 → v9.14.0
**Sprint Branch**: `feature/sprint-48-onboarding`

---

## Overview

New users arrive at Karmyq with no context. The feed, communities, requests, and activities all make sense once you've used the platform — but the first session is disorienting. There's no explanation of what anything is or how the pieces connect.

This sprint adds contextual onboarding overlays: a step-by-step modal guide that appears the first time a user visits each major workflow. Each workflow (feed, communities, requests, activities) has its own overlay with 2–4 steps explaining the concept and how to act on it. Once dismissed, the overlay never shows again for that workflow.

Content lives in a single central config file (`src/lib/onboarding/workflows.ts`). Steps are written at the concept level — not UI-detail level — so they survive design changes without needing edits. A lightweight process (reference comment in each page + checklist gate) keeps the file in sync as features evolve.

### Core Principle: Concepts, Not Controls

Onboarding steps describe what something *is* and *why it matters*, not where to click. This keeps content durable and focused on understanding rather than instruction-following.

---

## Multi-Sprint Arc

### Sprint 47 — Group Communities (complete)
`community_type` field, activities CRUD, group community workflows, ADR-050.

### Sprint 48 — Onboarding: Contextual Workflow Guides (this sprint)
First-time overlays for feed, communities, requests, and activities.

### Sprint 49 — Community Discovery + Empty States (upcoming)
Community type filter, recommended communities, empty state improvements.

---

## Workflows Covered

Four workflows get onboarding overlays this sprint:

| Workflow ID | Page/Component | Trigger |
|-------------|---------------|---------|
| `feed` | `pages/dashboard.tsx` | First visit to dashboard |
| `communities` | `pages/communities/index.tsx` | First visit to communities list |
| `requests` | `pages/requests/index.tsx` | First visit to requests page |
| `activities` | `components/ActivitiesTab.tsx` | First render of the Activities tab |

---

## Data Model

No database changes. Onboarding state is stored in localStorage.

```
localStorage key: "karmyq_onboarding"
Value: JSON object mapping workflowId → boolean
Example: { "feed": true, "communities": false }
```

A workflow is "seen" when the user clicks Done or Skip on its overlay. Seen workflows never show again on that device.

---

## Central Config File

**Path**: `apps/frontend/src/lib/onboarding/workflows.ts`

```typescript
export interface OnboardingStep {
  title: string;
  body: string;
}

export interface WorkflowDef {
  id: string;
  workflowTitle: string;
  steps: OnboardingStep[];
}

export const WORKFLOWS: Record<string, WorkflowDef> = {
  feed: {
    id: 'feed',
    workflowTitle: 'Your Feed',
    steps: [
      {
        title: 'What is the feed?',
        body: 'The feed shows help requests posted by people in your communities. Posts surface based on urgency, your trust relationships, and community relevance.',
      },
      {
        title: 'Responding to a request',
        body: 'Tap any request to offer help, ask a question, or pass it along. Your response is visible to the requester and tied to your reputation.',
      },
      {
        title: 'Commitments',
        body: 'When a requester accepts your offer, it becomes a commitment — trackable for both sides in the Commitments tab.',
      },
    ],
  },
  communities: {
    id: 'communities',
    workflowTitle: 'Communities',
    steps: [
      {
        title: 'What is a community?',
        body: 'Communities are the core unit of Karmyq. Your help requests, reputation, and trust relationships are all rooted in the communities you belong to.',
      },
      {
        title: 'Two types of community',
        body: 'Mutual aid communities connect neighbours to share help and resources. Group communities organise around shared activities — think sports teams, book clubs, or fitness groups.',
      },
      {
        title: 'Joining and creating',
        body: 'Join a public community instantly, or request access to a private one. You can also create your own and invite people you trust.',
      },
    ],
  },
  requests: {
    id: 'requests',
    workflowTitle: 'Help Requests',
    steps: [
      {
        title: 'What is a request?',
        body: 'A request is how you ask your communities for help — a ride, a favour, a skill, or anything else. Requests are visible to community members and matched to people who can help.',
      },
      {
        title: 'Request types',
        body: 'Karmyq supports several request types: general help, rides, services, events, and borrows. Each type has fields tailored to that kind of ask.',
      },
      {
        title: 'Trust and matching',
        body: 'The platform uses your trust relationships to surface the most relevant helpers. Higher trust means faster, more reliable matches.',
      },
    ],
  },
  activities: {
    id: 'activities',
    workflowTitle: 'Activities',
    steps: [
      {
        title: 'What are activities?',
        body: 'Activities are scheduled events organised by a group community — a training session, meetup, or recurring event. They appear here for communities you\'ve joined.',
      },
      {
        title: 'Joining an activity',
        body: 'Tap an activity to see the details and join. Capacity is limited, so spots are first-come first-served. Joining earns karma and reinforces your standing in the group.',
      },
    ],
  },
};
```

---

## New Components and Hooks

### `useOnboarding(workflowId: string)`

**Path**: `apps/frontend/src/hooks/useOnboarding.ts`

```typescript
// Returns whether to show the overlay and a function to mark it seen
const { shouldShow, markSeen } = useOnboarding('feed');
```

- Reads `karmyq_onboarding` from localStorage on mount
- `shouldShow` is true if the workflowId key is absent or false
- `markSeen()` sets `{ [workflowId]: true }` and persists to localStorage

### `OnboardingOverlay`

**Path**: `apps/frontend/src/components/OnboardingOverlay.tsx`

Props:
```typescript
interface OnboardingOverlayProps {
  workflow: WorkflowDef;
  onDismiss: () => void;
}
```

Renders:
- Modal backdrop (semi-transparent)
- Card with: workflow title, step indicator ("Step 2 of 3"), step title, step body
- Back / Next buttons; "Done" on final step; "Skip" link always visible
- Both "Done" and "Skip" call `onDismiss`

---

## Frontend Changes

| File | Change |
|------|--------|
| `src/lib/onboarding/workflows.ts` | New — central workflow content config |
| `src/hooks/useOnboarding.ts` | New — localStorage read/write hook |
| `src/components/OnboardingOverlay.tsx` | New — reusable step-by-step modal |
| `src/pages/dashboard.tsx` | Wire `useOnboarding('feed')` + render overlay; add reference comment |
| `src/pages/communities/index.tsx` | Wire `useOnboarding('communities')` + render overlay; add reference comment |
| `src/pages/requests/index.tsx` | Wire `useOnboarding('requests')` + render overlay; add reference comment |
| `src/components/ActivitiesTab.tsx` | Wire `useOnboarding('activities')` + render overlay; add reference comment |

**Reference comment format** (top of each wired file):
```typescript
// Onboarding: see src/lib/onboarding/workflows.ts → 'feed'
```

---

## Maintenance Process

To keep `workflows.ts` accurate as features evolve:

1. **Reference comment** — each wired page/component has a comment pointing to the relevant workflow key. Developers editing that file see it immediately.
2. **Pre-merge checklist** — CLAUDE.md gets a new checklist item: "If you changed a workflow's UI or behavior, update `src/lib/onboarding/workflows.ts`."
3. **Concept-level writing** — steps describe what something *is*, not where to click. This means content stays valid through UI changes without editing.

---

## User Guide & Doc Updates

- **New user guide**: `apps/landing/src/data/docs/guides/onboarding.json` — explains the onboarding system for new users
- **Update nav.json**: add "Getting Started" or "Onboarding" entry under User Guides
- No new ADR — this is a UX feature, not an architectural decision

---

## Critical Implementation Notes

1. **`shouldShow` must be false during SSR** — `localStorage` is not available server-side. The hook must return `shouldShow: false` until after mount (use a `useEffect` with a `mounted` flag or initialize state to `false` and set in effect).
2. **One overlay at a time** — if a user hits communities for the first time right after feed, only the current page's overlay shows. Do not queue or stack overlays.
3. **Skip and Done are equivalent** — both call `markSeen()` and `onDismiss()`. There is no functional difference; "Skip" is just labelled to feel lower-commitment.
4. **Overlay renders on top of everything** — use `z-50` (or equivalent) and a full-screen backdrop. Do not let page content be interactive while overlay is open.
5. **localStorage key is `"karmyq_onboarding"`** — a JSON object. Never write per-key localStorage entries. Always read/parse the full object, update the relevant key, and write back.
6. **ActivitiesTab trigger** — the activities overlay fires on first render of the tab, not first visit to the community page. A user who visits a mutual_aid community (no Activities tab) should not consume the `activities` workflow seen-state.
7. **No backend change** — `onboarding_completed` flag on `auth.users` is explicitly out of scope. localStorage is sufficient for the demo.
