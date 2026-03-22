# Sprint 35: Request Wizard + Service Hiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace the inline smart-text request form with a clean two-step type-first wizard, add a speed-dial FAB with "Get Help" / "Get Service" actions, and surface "Get Service" on provider cards and profiles.

**Architecture:** `RequestWizard` is a self-contained modal component that owns all request creation logic (extracted from dashboard). `SpeedDialFab` replaces the current `.fab` button and is tab-aware. No backend changes.

**Tech Stack:** Next.js 14 (Pages Router), React, TypeScript, Tailwind CSS `@layer components`.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/components/RequestWizard.tsx` | Two-step request wizard modal. Step 1: type picker grid. Step 2: DynamicForm + description + urgency + scope. Accepts provider pre-fill props. Owns `handleCreateRequest` logic. |
| `apps/frontend/src/components/SpeedDialFab.tsx` | Expandable FAB: resting = single `+` button; expanded = "Get Help" + "Get Service" action stack. Tab-aware. |
| `tests/tdd/request-wizard.test.ts` | Pure logic tests: `getFieldsForType`, `isFormValid`, `mapUrgencyToApi`, `buildWizardPayload`, `getVisibleActions` (SpeedDialFab logic) |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/pages/dashboard.tsx` | Remove inline form block + `.fab` button. Add `<SpeedDialFab>` + `<RequestWizard>`. Remove NLP imports. |
| `apps/frontend/src/pages/providers/index.tsx` | Add `<SpeedDialFab>` (Get Service only) + `<RequestWizard>`. Wire `ProviderCard.onGetService`. |
| `apps/frontend/src/pages/providers/[id].tsx` | Add "Get Service" button + `<RequestWizard>` with pre-fill props. |
| `apps/frontend/src/components/providers/ProviderCard.tsx` | Add "Get Service" button. New prop: `onGetService?: (provider: ProviderCardData) => void`. |
| `apps/frontend/src/styles/globals.css` | Add `.speed-dial`, `.speed-dial-action`, `.wizard-step`, `.type-card`, `.urgency-option`. Aesthetics pass on existing classes. |
| `apps/frontend/CONTEXT.md` | Document Sprint 35 new components + patterns. |
| `docs/guides/making-requests-guide.md` | Update to wizard flow; remove smart-text references; add "Get Service" section. |
| `docs/guides/getting-started-guide.md` | Update first-request instructions to wizard flow. |
| `docs/concepts/ux-design-principles.md` | Add Sprint 35 row + 3-click rule section. |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Remove NLP logic entirely.** `EnhancedAutocomplete`, `ExtractedDataChips`, `parsedRequest`, `autocompleteSuggestions`, `handleDescriptionChange` (NLP version), `buildPayloadFromParsed` — all gone from dashboard. The wizard uses a plain `onChange` textarea.

2. **`availableTypes` is fetched, not hardcoded.** `RequestWizard` must call `requestService.getRequestTypes()` on mount. Do not hardcode the type list.

3. **`DynamicForm` is kept.** Call `fetchSchema(type)` immediately when the user taps a type tile in step 1 so step 2 loads instantly. Do not wait until step 2 mounts to start the fetch.

4. **Urgency is now explicit.** User selects `normal | urgent | critical`. Map `normal → medium` when building the API payload (backend uses `medium`).

5. **`preferred_provider_id` in request payload.** When `preferredProviderId` prop is set, include it in `POST /requests` body. Backend already accepts this field.

6. **`ProviderCard` gets a callback, not navigation.** `onGetService?: (provider) => void` — listing page opens the wizard modal, does NOT navigate to a new page.

7. **SpeedDialFab Z-index.** Actions: `z-40`. Backdrop click-catcher: `z-39`. Wizard modal: `z-50`.

8. **`ProviderCard` in `providers/index.tsx` passes `onGetService`.** The listing page holds `[wizardProvider, setWizardProvider]` state; passing it to ProviderCard triggers the wizard.

9. **No worktrees.** Work directly on `feature/sprint-35-request-wizard`.

---

## Task 1: Branch + CSS foundations

**Files:**
- Create branch: `feature/sprint-35-request-wizard`
- Modify: `apps/frontend/src/styles/globals.css`

- [ ] Check out branch:
```bash
git checkout -b feature/sprint-35-request-wizard
```

- [ ] Add new CSS classes to `globals.css` after the existing `.filter-chip` block:
```css
/* Speed-dial FAB */
.speed-dial { @apply relative inline-flex flex-col items-end gap-3; }
.speed-dial-action {
  @apply flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-raised border border-border
         shadow-md text-sm font-medium text-text whitespace-nowrap
         hover:bg-primary hover:text-white hover:border-primary transition-all;
}

/* Request Wizard */
.wizard-step { @apply flex flex-col gap-4 animate-in fade-in duration-150; }
.type-card {
  @apply flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border
         text-center cursor-pointer transition-all hover:border-primary hover:bg-primary-light;
}
.type-card.selected { @apply border-primary bg-primary-light text-primary; }
.type-card.locked { @apply border-border bg-surface-raised opacity-60 cursor-not-allowed; }
.urgency-option {
  @apply flex-1 py-2 text-sm font-medium rounded-lg border border-border text-center
         cursor-pointer transition-all hover:border-primary hover:text-primary;
}
.urgency-option.selected { @apply border-primary bg-primary text-white; }
```

- [ ] Aesthetics pass — add `min-h-[36px]` to the `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` definitions (touch target minimum):
```css
/* find the existing btn-primary line and add min-h */
.btn-primary { @apply ... min-h-[36px]; }
```

- [ ] Verify globals.css compiles cleanly by running Next.js dev build check:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 2: TDD tests (write before implementation)

**Files:**
- Create: `tests/tdd/request-wizard.test.ts`

- [ ] Create `tests/tdd/request-wizard.test.ts` with these pure-logic tests (no React rendering):

```typescript
// Pure logic extracted from RequestWizard for testability

type UrgencyLevel = 'normal' | 'urgent' | 'critical'
type TabId = 'browse' | 'commitments' | 'my-requests' | 'profile'

// Maps UI urgency to backend value
function mapUrgencyToApi(urgency: UrgencyLevel): string {
  return urgency === 'normal' ? 'medium' : urgency
}

// Determines if form is valid enough to submit
function isFormValid(params: {
  requestType: string | null
  description: string
  schemaLoading: boolean
}): boolean {
  return !!(params.requestType && params.description.trim().length > 0 && !params.schemaLoading)
}

// Which FAB actions are visible for a given tab
function getVisibleActions(tab: TabId): Array<'get-help' | 'get-service'> {
  switch (tab) {
    case 'browse': return ['get-help', 'get-service']
    case 'commitments': return ['get-help']
    case 'my-requests': return ['get-help']
    case 'profile': return []
  }
}

// Builds the API payload for the wizard
function buildWizardPayload(params: {
  requestType: string
  description: string
  urgency: UrgencyLevel
  dynamicPayload: Record<string, unknown>
  communityId?: string
  preferredProviderId?: string
}) {
  return {
    request_type: params.requestType,
    description: params.description.trim(),
    urgency: mapUrgencyToApi(params.urgency),
    payload: params.dynamicPayload,
    ...(params.communityId ? { community_id: params.communityId } : {}),
    ...(params.preferredProviderId ? { preferred_provider_id: params.preferredProviderId } : {}),
  }
}

describe('mapUrgencyToApi', () => {
  it('maps normal → medium', () => expect(mapUrgencyToApi('normal')).toBe('medium'))
  it('maps urgent → urgent', () => expect(mapUrgencyToApi('urgent')).toBe('urgent'))
  it('maps critical → critical', () => expect(mapUrgencyToApi('critical')).toBe('critical'))
})

describe('isFormValid', () => {
  it('returns false when no type selected', () =>
    expect(isFormValid({ requestType: null, description: 'need help', schemaLoading: false })).toBe(false))
  it('returns false when description is empty', () =>
    expect(isFormValid({ requestType: 'generic', description: '   ', schemaLoading: false })).toBe(false))
  it('returns false when schema is loading', () =>
    expect(isFormValid({ requestType: 'generic', description: 'need help', schemaLoading: true })).toBe(false))
  it('returns true when type + description set and schema loaded', () =>
    expect(isFormValid({ requestType: 'generic', description: 'need help', schemaLoading: false })).toBe(true))
})

describe('getVisibleActions', () => {
  it('browse shows both actions', () =>
    expect(getVisibleActions('browse')).toEqual(['get-help', 'get-service']))
  it('commitments shows only get-help', () =>
    expect(getVisibleActions('commitments')).toEqual(['get-help']))
  it('my-requests shows only get-help', () =>
    expect(getVisibleActions('my-requests')).toEqual(['get-help']))
  it('profile shows nothing', () =>
    expect(getVisibleActions('profile')).toEqual([]))
})

describe('buildWizardPayload', () => {
  const base = { requestType: 'generic', description: '  need help  ', urgency: 'normal' as UrgencyLevel, dynamicPayload: {} }
  it('trims description', () =>
    expect(buildWizardPayload(base).description).toBe('need help'))
  it('maps urgency normal → medium', () =>
    expect(buildWizardPayload(base).urgency).toBe('medium'))
  it('omits community_id when not set', () =>
    expect(buildWizardPayload(base)).not.toHaveProperty('community_id'))
  it('includes community_id when set', () =>
    expect(buildWizardPayload({ ...base, communityId: 'c1' }).community_id).toBe('c1'))
  it('includes preferred_provider_id when set', () =>
    expect(buildWizardPayload({ ...base, preferredProviderId: 'p1' }).preferred_provider_id).toBe('p1'))
  it('omits preferred_provider_id when not set', () =>
    expect(buildWizardPayload(base)).not.toHaveProperty('preferred_provider_id'))
})
```

- [ ] Run tests to confirm they pass:
```bash
cd tests && npx jest tdd/request-wizard --no-coverage 2>&1 | tail -15
```

---

## Task 3: `RequestWizard` component

**Files:**
- Create: `apps/frontend/src/components/RequestWizard.tsx`

- [ ] Create `RequestWizard.tsx`. The component owns: type fetch, schema fetch, form state, request creation. Key structure:

```tsx
interface RequestWizardProps {
  onClose: () => void
  preferredProviderId?: string
  preferredProviderName?: string
  preferredProviderServiceType?: string  // if set, pre-selects + locks this type in step 1
}

export default function RequestWizard({
  onClose, preferredProviderId, preferredProviderName, preferredProviderServiceType
}: RequestWizardProps) {
  const [step, setStep] = useState<1 | 2>(preferredProviderServiceType ? 2 : 1)
  const [requestType, setRequestType] = useState<string | null>(preferredProviderServiceType ?? null)
  const [availableTypes, setAvailableTypes] = useState<{ value: string; label: string; icon: string }[]>([])
  const [currentSchema, setCurrentSchema] = useState<any>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [dynamicPayload, setDynamicPayload] = useState<Record<string, unknown>>({})
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'critical'>('normal')
  const [communityId, setCommunityId] = useState<string>('')
  const [userCommunities, setUserCommunities] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  // On mount: fetch available types + user communities
  // If preferredProviderServiceType: also kick off fetchSchema immediately
  // handleSelectType: sets requestType + calls fetchSchema
  // handleSubmit: builds payload using buildWizardPayload logic, calls requestService.createRequest
}
```

Step 1 JSX:
```tsx
// 2-col mobile, 3-col desktop grid of .type-card tiles
// Each: icon SVG (24px) + label
// Tap calls handleSelectType(type.value) → sets step to 2
// If preferredProviderServiceType: that type shows .selected.locked; others dimmed
```

Step 2 JSX:
```tsx
// Header: "What do you need?" or "Request from {preferredProviderName}"
// If DynamicForm schema loaded: <DynamicForm schema={...} value={dynamicPayload} onChange={...} />
// <textarea> — clean, NO autocomplete, no @hints placeholder
// Urgency chips: Normal | Urgent | Critical (3 inline .urgency-option buttons)
// Scope: collapsed "Post to: All communities" with expand to community <select>
// [← Back] [Post Request btn-primary]
```

- [ ] Verify no TypeScript errors:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -i "RequestWizard\|error" | head -20
```

---

## Task 4: `SpeedDialFab` component

**Files:**
- Create: `apps/frontend/src/components/SpeedDialFab.tsx`

- [ ] Create `SpeedDialFab.tsx`:

```tsx
import { TabId } from './TabBar'

interface SpeedDialFabProps {
  activeTab: TabId
  onGetHelp: () => void
  onGetService: () => void
}

export default function SpeedDialFab({ activeTab, onGetHelp, onGetService }: SpeedDialFabProps) {
  const [expanded, setExpanded] = useState(false)
  const actions = getVisibleActions(activeTab)  // pure logic from test file

  if (actions.length === 0) return null

  // If only one action, behave as a plain FAB (no expansion needed)
  // If two actions, expand on tap
}
```

Resting state: `<button className="fab">+</button>`

Expanded state (two actions):
```tsx
<div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3 md:bottom-8">
  {/* backdrop click-catcher */}
  <div className="fixed inset-0 z-[-1]" onClick={() => setExpanded(false)} />
  {/* actions animate up with translate-y transition */}
  {actions.includes('get-service') && (
    <button className="speed-dial-action" onClick={() => { onGetService(); setExpanded(false) }}>
      Get Service
    </button>
  )}
  {actions.includes('get-help') && (
    <button className="speed-dial-action" onClick={() => { onGetHelp(); setExpanded(false) }}>
      Get Help
    </button>
  )}
  <button className="fab" onClick={() => setExpanded(false)}>×</button>
</div>
```

- [ ] Verify no TypeScript errors:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -i "SpeedDialFab\|error" | head -20
```

---

## Task 5: Wire `dashboard.tsx`

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] Remove NLP-related state and imports:
  - Remove imports: `EnhancedAutocomplete`, `ExtractedDataChips`
  - Remove state: `parsedRequest`, `autocompleteSuggestions`, `autocompleteTrigger`, `searchQuery`, `setTextareaRef`
  - Remove functions: `handleDescriptionChange` (the NLP version), `handleSelectSuggestion`, `handleCloseAutocomplete`
  - Keep: `availableTypes`, `requestType`, `schemaLoading`, `currentSchema`, `dynamicPayload`, `handleCreateRequest` — these move INTO `RequestWizard`; remove them from dashboard once wizard is wired

- [ ] Remove state that moves into `RequestWizard`: `requestType`, `availableTypes`, `schemaLoading`, `currentSchema`, `dynamicPayload`, `description`, `creating`, `parsedRequest`, `postingMode`, `selectedCommunity`, `selectedProvider`, `showProviderPicker`, `providerPickerLoading`, `providerPickerProviders`

  **Note**: Only remove these if they are EXCLUSIVELY used by the inline form. If any are used elsewhere in dashboard, keep them.

- [ ] Add new state:
```tsx
const [showWizard, setShowWizard] = useState(false)
const [wizardMode, setWizardMode] = useState<'help' | 'service'>('help')
```

- [ ] Replace the `.fab` button and inline `{showRequestForm && ...}` modal block with:
```tsx
<SpeedDialFab
  activeTab={activeTab}
  onGetHelp={() => { setWizardMode('help'); setShowWizard(true) }}
  onGetService={() => { setWizardMode('service'); setShowWizard(true) }}
/>
{showWizard && (
  <RequestWizard onClose={() => setShowWizard(false)} />
)}
```

- [ ] Add imports for `SpeedDialFab`, `RequestWizard`

- [ ] Run TypeScript check:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

---

## Task 6: `ProviderCard` + providers listing

**Files:**
- Modify: `apps/frontend/src/components/providers/ProviderCard.tsx`
- Modify: `apps/frontend/src/pages/providers/index.tsx`

- [ ] Add `onGetService` prop to `ProviderCard`:
```tsx
interface ProviderCardProps {
  provider: { id: string; display_name: string; service_type: string; ... }
  onGetService?: (provider: ProviderCardData) => void
}
```

- [ ] Add "Get Service" button inside the card — position it at the bottom of the card, secondary in hierarchy (don't overshadow the card's link-to-profile behavior):
```tsx
{onGetService && (
  <button
    className="btn-secondary text-xs px-3 py-1.5 mt-2 w-full"
    onClick={(e) => { e.preventDefault(); onGetService(provider) }}
  >
    Get Service
  </button>
)}
```
Note: `e.preventDefault()` stops the parent `<Link>` from navigating.

- [ ] In `providers/index.tsx`, add state + wizard:
```tsx
const [wizardProvider, setWizardProvider] = useState<any>(null)
```

- [ ] Pass `onGetService` to each `ProviderCard`:
```tsx
<ProviderCard
  key={p.id}
  provider={p}
  onGetService={(provider) => setWizardProvider(provider)}
/>
```

- [ ] Add `SpeedDialFab` (Get Service only — override tab to show only service action) and `RequestWizard`:
```tsx
// Providers page doesn't use TabId — pass a flag differently
// Option: SpeedDialFab accepts optional override: forceActions?: Array<'get-help' | 'get-service'>
// Simpler: just add a plain .fab button labeled "Get Service" on this page
<button className="fab" onClick={() => setWizardProvider({ id: '', display_name: '', service_type: 'other' })}>
  Get Service
</button>
{wizardProvider && (
  <RequestWizard
    onClose={() => setWizardProvider(null)}
    preferredProviderId={wizardProvider.id || undefined}
    preferredProviderName={wizardProvider.display_name || undefined}
    preferredProviderServiceType={wizardProvider.service_type || undefined}
  />
)}
```

- [ ] Verify TypeScript:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -i "ProviderCard\|providers/index\|error" | head -20
```

---

## Task 7: Provider detail page (`providers/[id].tsx`)

**Files:**
- Modify: `apps/frontend/src/pages/providers/[id].tsx`

- [ ] Add state:
```tsx
const [showWizard, setShowWizard] = useState(false)
```

- [ ] Find the provider hero / header section (where `display_name`, service type badge, and trust score live). Add a "Get Service" button after the trust score / review stars row:
```tsx
<button
  className="btn-primary mt-4 px-6"
  onClick={() => setShowWizard(true)}
>
  Get Service
</button>
```

- [ ] Add `RequestWizard` at the bottom of the page JSX (before closing `</Layout>`):
```tsx
{showWizard && (
  <RequestWizard
    onClose={() => setShowWizard(false)}
    preferredProviderId={provider?.id}
    preferredProviderName={provider?.display_name}
    preferredProviderServiceType={provider?.service_type}
  />
)}
```

- [ ] Add `import RequestWizard from '@/components/RequestWizard'`

- [ ] Verify TypeScript:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | grep -i "providers/\[id\]\|error" | head -20
```

---

## Task 8: Aesthetics pass

**Files:**
- Modify: `apps/frontend/src/styles/globals.css`
- Modify: `apps/frontend/src/components/BrowseFeed.tsx`
- Modify: `apps/frontend/src/components/CommitmentsTab.tsx`
- Modify: `apps/frontend/src/components/MyRequestsTab.tsx`
- Modify: `apps/frontend/src/components/providers/ProviderCard.tsx`

- [ ] **Tab content transitions**: In `dashboard.tsx`, wrap each tab panel in a `<div key={activeTab} className="animate-in fade-in duration-150">` so the content fades on tab switch.

- [ ] **Semantic color audit**: Grep for hardcoded color classes in the four tab components:
```bash
grep -n "text-gray-\|text-white\|bg-white\|bg-gray-\|border-gray-" \
  apps/frontend/src/components/BrowseFeed.tsx \
  apps/frontend/src/components/CommitmentsTab.tsx \
  apps/frontend/src/components/MyRequestsTab.tsx \
  apps/frontend/src/components/providers/ProviderCard.tsx
```
Replace each with the semantic equivalent:
- `text-gray-900` / `text-gray-800` → `text-text`
- `text-gray-500` / `text-gray-400` → `text-text-muted`
- `text-gray-300` / `text-gray-200` → `text-text-subtle`
- `bg-white` → `bg-surface`
- `bg-gray-50` / `bg-gray-100` → `bg-surface-raised`
- `border-gray-200` / `border-gray-100` → `border-border`

- [ ] **Skeleton loaders**: Replace any `{loading && <p className="...">Loading…</p>}` patterns in all four components with pulse skeletons:
```tsx
{loading && (
  <div className="space-y-3 p-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="card p-4 animate-pulse">
        <div className="h-4 bg-border rounded w-3/4 mb-2" />
        <div className="h-3 bg-border rounded w-1/2" />
      </div>
    ))}
  </div>
)}
```

- [ ] **Focus rings**: Audit `ProviderCard` and wizard components for interactive elements missing focus rings. Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` where missing.

- [ ] **Spacing consistency**: Confirm all 4 tab content root divs use `px-4 py-4 max-w-2xl mx-auto`. Fix any that differ.

- [ ] Verify aesthetics changes don't break TypeScript:
```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 9: Docs + CONTEXT.md

**Files:**
- Modify: `apps/frontend/CONTEXT.md`
- Modify: `docs/guides/making-requests-guide.md`
- Modify: `docs/guides/getting-started-guide.md`
- Modify: `docs/concepts/ux-design-principles.md`

- [ ] Update `apps/frontend/CONTEXT.md`:
  - Bump version to v9.10.0
  - Add Sprint 35 new components section (RequestWizard, SpeedDialFab)
  - Note: NLP/autocomplete components removed (EnhancedAutocomplete, ExtractedDataChips)

- [ ] Update `docs/guides/making-requests-guide.md`:
  - Replace the form description with: Step 1 = type picker grid, Step 2 = description + urgency + scope
  - Remove any mention of `@time`, `#count`, `$budget`, `!urgent` smart shortcuts
  - Add new section: "Hiring a provider" → explain "Get Service" button on provider cards and profiles

- [ ] Update `docs/guides/getting-started-guide.md`:
  - Update first-request steps to reflect wizard flow
  - Update FAB description: "The + button expands to show Get Help and Get Service"

- [ ] Update `docs/concepts/ux-design-principles.md`:
  - Add row to design evolution table: Sprint 35 / Wizard / "Type-first: one decision per screen"
  - Add paragraph: "3-click rule: every primary action (Get Help, Get Service) completes in 3 interactions"

- [ ] Regenerate landing docs:
```bash
cd apps/landing && npx ts-node --project tsconfig.scripts.json scripts/generate-docs.ts
git add -f apps/landing/src/data/docs/
```

---

## Task 10: Final verification

**Files:** None (verification only)

- [ ] Run all tests:
```bash
npm test 2>&1 | tail -20
npm run test:tdd 2>&1 | tail -20
```

- [ ] Full TypeScript check:
```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] Run feedback check:
```bash
npm run feedback:check 2>&1 | tail -20
```

- [ ] Bump version in `package.json` (root) and `apps/frontend/package.json` to `9.10.0`

- [ ] Commit:
```bash
git add apps/frontend/src/components/RequestWizard.tsx \
        apps/frontend/src/components/SpeedDialFab.tsx \
        apps/frontend/src/pages/dashboard.tsx \
        apps/frontend/src/pages/providers/index.tsx \
        "apps/frontend/src/pages/providers/[id].tsx" \
        apps/frontend/src/components/providers/ProviderCard.tsx \
        apps/frontend/src/styles/globals.css \
        apps/frontend/CONTEXT.md \
        docs/guides/making-requests-guide.md \
        docs/guides/getting-started-guide.md \
        docs/concepts/ux-design-principles.md \
        tests/tdd/request-wizard.test.ts \
        package.json \
        apps/frontend/package.json
git add -f apps/landing/src/data/docs/

git commit -m "feat(ux): Sprint 35 — Request Wizard + Service Hiring v9.10.0"
```

- [ ] Push and confirm GitHub Actions deploys successfully:
```bash
git push origin feature/sprint-35-request-wizard
# Then: git checkout master && git merge feature/sprint-35-request-wizard && git push origin master
```
