# Onboarding — Contextual Workflow Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add contextual onboarding overlays to the feed, communities, requests, and activities workflows — shown once per device on first visit, driven by a single maintainable config file.

**Architecture:** A central `workflows.ts` config + `useOnboarding` hook + `OnboardingOverlay` component wired into four existing pages/components. State stored in localStorage; no backend changes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `apps/frontend/src/lib/onboarding/workflows.ts` | Central content config — all workflow step definitions |
| `apps/frontend/src/hooks/useOnboarding.ts` | localStorage read/write; `shouldShow` + `markSeen` |
| `apps/frontend/src/components/OnboardingOverlay.tsx` | Reusable step-by-step modal component |
| `tests/tdd/sprint-48-onboarding.test.ts` | TDD tests for hook logic and overlay rendering |

### Existing files to modify

| File | Change |
|------|--------|
| `apps/frontend/src/pages/dashboard.tsx` | Wire `useOnboarding('feed')` + render overlay + reference comment |
| `apps/frontend/src/pages/communities/index.tsx` | Wire `useOnboarding('communities')` + render overlay + reference comment |
| `apps/frontend/src/pages/requests/index.tsx` | Wire `useOnboarding('requests')` + render overlay + reference comment |
| `apps/frontend/src/components/ActivitiesTab.tsx` | Wire `useOnboarding('activities')` + render overlay + reference comment |
| `CLAUDE.md` | Add workflows.ts to pre-merge checklist |
| `apps/landing/src/data/docs/guides/onboarding.json` | New user guide for onboarding feature |
| `apps/landing/src/data/docs/nav.json` | Add onboarding entry under User Guides |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`shouldShow` must be false during SSR** — `localStorage` is not available server-side. The hook must return `shouldShow: false` until after mount. Use a `useEffect` with a `mounted` flag, or initialize state to `false` and set it in a `useEffect`.
2. **One overlay at a time** — only the current page's overlay shows. Do not queue or stack overlays.
3. **Skip and Done are equivalent** — both call `markSeen()` and `onDismiss()`. "Skip" is just labelled to feel lower-commitment.
4. **Overlay renders on top of everything** — use `z-50` and a full-screen backdrop. Page content must not be interactive while overlay is open.
5. **localStorage key is `"karmyq_onboarding"`** — a JSON object. Always read the full object, update the relevant key, and write back.
6. **ActivitiesTab trigger** — the activities overlay fires on first render of the tab component, not on page load. A user who visits a mutual_aid community (no Activities tab) must NOT consume the `activities` seen-state.
7. **No backend change** — `onboarding_completed` on `auth.users` is out of scope. localStorage is sufficient.

---

## Task 1: Feature branch + central config file

**Files:**
- Create: `apps/frontend/src/lib/onboarding/workflows.ts`

- [ ] Create feature branch:
```bash
git checkout -b feature/sprint-48-onboarding
```

- [ ] Create `apps/frontend/src/lib/onboarding/workflows.ts` with the full workflow definitions:

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
        body: "Activities are scheduled events organised by a group community — a training session, meetup, or recurring event. They appear here for communities you've joined.",
      },
      {
        title: 'Joining an activity',
        body: 'Tap an activity to see the details and join. Capacity is limited, so spots are first-come first-served. Joining earns karma and reinforces your standing in the group.',
      },
    ],
  },
};
```

- [ ] Verify file compiles:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 2: `useOnboarding` hook

**Files:**
- Create: `apps/frontend/src/hooks/useOnboarding.ts`

- [ ] Create the hook:

```typescript
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'karmyq_onboarding';

function readSeenMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useOnboarding(workflowId: string): {
  shouldShow: boolean;
  markSeen: () => void;
} {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const seen = readSeenMap();
    if (!seen[workflowId]) {
      setShouldShow(true);
    }
  }, [workflowId]);

  const markSeen = () => {
    const seen = readSeenMap();
    seen[workflowId] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    setShouldShow(false);
  };

  return { shouldShow, markSeen };
}
```

- [ ] Verify no type errors:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 3: `OnboardingOverlay` component

**Files:**
- Create: `apps/frontend/src/components/OnboardingOverlay.tsx`

- [ ] Create the component:

```typescript
import { useState } from 'react';
import { WorkflowDef } from '@/lib/onboarding/workflows';

interface OnboardingOverlayProps {
  workflow: WorkflowDef;
  onDismiss: () => void;
}

export default function OnboardingOverlay({ workflow, onDismiss }: OnboardingOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = workflow.steps;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={workflow.workflowTitle}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">{workflow.workflowTitle}</h2>
          <span className="text-sm text-text-muted">
            {stepIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Step content */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-text mb-2">{step.title}</h3>
          <p className="text-sm text-text-muted leading-relaxed">{step.body}</p>
        </div>

        {/* Step indicator dots */}
        <div className="flex gap-1.5 justify-center mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === stepIndex ? 'bg-primary' : 'bg-surface-raised'}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onDismiss}
            className="text-sm text-text-muted hover:text-text transition-colors"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex(i => i - 1)}
                className="px-4 py-2 text-sm rounded-lg border border-border text-text hover:bg-surface-raised transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={() => setStepIndex(i => i + 1)}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Verify no type errors:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 4: Wire onboarding into feed + communities pages

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Modify: `apps/frontend/src/pages/communities/index.tsx`

- [ ] In `dashboard.tsx`, add at the top (after existing imports):
```typescript
// Onboarding: see src/lib/onboarding/workflows.ts → 'feed'
import { useOnboarding } from '@/hooks/useOnboarding';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import { WORKFLOWS } from '@/lib/onboarding/workflows';
```

- [ ] Add hook call near other hooks at top of component:
```typescript
const { shouldShow: showFeedOnboarding, markSeen: markFeedSeen } = useOnboarding('feed');
```

- [ ] Add overlay render at the top of the JSX return (before `<Head>` or as first child of outermost div):
```typescript
{showFeedOnboarding && (
  <OnboardingOverlay workflow={WORKFLOWS.feed} onDismiss={markFeedSeen} />
)}
```

- [ ] Repeat the same pattern for `communities/index.tsx` with workflow key `'communities'`.

- [ ] Verify no type errors:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 5: Wire onboarding into requests page + ActivitiesTab

**Files:**
- Modify: `apps/frontend/src/pages/requests/index.tsx`
- Modify: `apps/frontend/src/components/ActivitiesTab.tsx`

- [ ] In `requests/index.tsx`, apply the same pattern with workflow key `'requests'`:
```typescript
// Onboarding: see src/lib/onboarding/workflows.ts → 'requests'
```

- [ ] In `ActivitiesTab.tsx`, apply the same pattern with workflow key `'activities'`:
```typescript
// Onboarding: see src/lib/onboarding/workflows.ts → 'activities'
```

  Note: for `ActivitiesTab`, the overlay fires when the tab component renders — not when the parent community page loads. This is correct behaviour (a mutual_aid community never renders ActivitiesTab, so the `activities` seen-state is only consumed when the tab actually appears).

- [ ] Verify no type errors:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 6: TDD tests

**Files:**
- Create: `tests/tdd/sprint-48-onboarding.test.ts`

- [ ] Write tests covering:

```typescript
// Hook logic
describe('useOnboarding', () => {
  beforeEach(() => localStorage.clear());

  it('returns shouldShow=true when workflow has not been seen', ...);
  it('returns shouldShow=false when workflow is already in localStorage', ...);
  it('markSeen sets the workflow key to true in localStorage', ...);
  it('markSeen does not affect other workflow keys', ...);
  it('handles corrupt localStorage gracefully (returns shouldShow=true)', ...);
});

// Overlay rendering
describe('OnboardingOverlay', () => {
  it('renders the workflow title and first step', ...);
  it('renders step indicator "1 of N"', ...);
  it('Next button advances to the next step', ...);
  it('Back button is not shown on the first step', ...);
  it('Done button appears on the last step and calls onDismiss', ...);
  it('Skip link always calls onDismiss', ...);
});
```

- [ ] Run TDD tests:
```bash
npm run test:tdd -- --testPathPattern=sprint-48-onboarding
```

---

## Task 7: User guide + landing page docs + CLAUDE.md checklist update

**Files:**
- Create: `apps/landing/src/data/docs/guides/onboarding.json`
- Modify: `apps/landing/src/data/docs/nav.json`
- Modify: `CLAUDE.md`

- [ ] Create `apps/landing/src/data/docs/guides/onboarding.json`:

```json
{
  "slug": "onboarding",
  "title": "Getting Started with Karmyq",
  "description": "A guided introduction to the feed, communities, requests, and activities — shown automatically on your first visit to each section.",
  "content": "# Getting Started with Karmyq\n\nWhen you first use Karmyq, a short guided intro appears in each section of the platform. These overlays explain what the section is and how to use it — you only see each one once.\n\n## Your Feed\n\nThe feed surfaces help requests from your communities, ranked by urgency, trust, and relevance. Tap any request to offer help or ask a question. When your offer is accepted, it becomes a Commitment.\n\n## Communities\n\nCommunities are the foundation of Karmyq. All requests, reputation, and trust relationships are community-scoped. There are two types:\n\n- **Mutual aid** — neighbours sharing help and resources\n- **Group** — organised around shared recurring activities (sports, clubs, fitness)\n\n## Help Requests\n\nRequests let you ask your communities for help. Karmyq supports five types: general, ride, service, event, and borrow. The platform uses your trust network to match you with the most relevant helpers.\n\n## Activities\n\nActivities are scheduled events inside group communities. Join to participate, earn karma, and strengthen your ties within the group. Capacity is capped — spots are first-come first-served.\n\n## Dismissing and Resetting\n\nEach intro overlay can be skipped at any time. Once dismissed, it won't appear again on that device. If you want to see an intro again, clear your browser's localStorage for karmyq.com."
}
```

- [ ] Add to `apps/landing/src/data/docs/nav.json` under "User Guides":

```json
{ "slug": "onboarding", "title": "Getting Started with Karmyq" }
```

- [ ] Add to the pre-merge checklist in `CLAUDE.md` under "Documentation (Non-Negotiable)":

```markdown
- [ ] **Onboarding content updated** if you changed a workflow's UI or behavior: update `apps/frontend/src/lib/onboarding/workflows.ts` for the affected workflow key
```

- [ ] Verify nav integrity — every guides JSON file has a nav.json entry:
```bash
ls apps/landing/src/data/docs/guides/ | sed 's/.json//'
```
Then confirm each name appears in nav.json.

---

## Task 8: Full verification

**Files:** None

- [ ] Type check passes:
```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] Unit + regression tests pass:
```bash
npm test
```

- [ ] TDD tests pass:
```bash
npm run test:tdd -- --testPathPattern=sprint-48-onboarding
```

- [ ] Feedback check passes:
```bash
npm run feedback:check
```

- [ ] Manual smoke test: clear localStorage, visit dashboard, communities, requests, and an Activities tab. Confirm overlays appear, step navigation works, and overlays do not reappear after dismissal.

---

## Task 9: Merge + Deploy

- [ ] Use the `/deploy` skill to merge to master, push, and monitor GitHub Actions.
- [ ] Confirm CI passes (lint → tests → Docker build → deploy → health check).
- [ ] If migration is needed (none this sprint), SSH and run manually.
- [ ] Verify on karmyq.com: clear localStorage, walk through all four onboarding overlays.
