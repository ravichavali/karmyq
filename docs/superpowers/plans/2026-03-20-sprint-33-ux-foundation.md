# Sprint 33: UX Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Establish the UX foundation on web — design consistency, first-time onboarding, empty states, performance, landing page fixes, and plain-language guide rewrites.

**Architecture:** Two new reusable components (`EmptyState`, `WelcomeModal`) + canonical design classes in `globals.css` + `next/dynamic` lazy loading for heavy components. Pure frontend sprint — no service or schema changes.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14 (Pages Router), PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/components/EmptyState.tsx` | Reusable empty state (icon, heading, body, optional CTA) |
| `apps/frontend/src/components/WelcomeModal.tsx` | 3-step first-time onboarding modal |
| `tests/tdd/empty-state.test.ts` | TDD tests for empty state visibility conditions |
| `tests/tdd/welcome-modal.test.ts` | TDD tests for onboarding modal logic |
| `tests/tdd/evolution-toggle-profile.test.ts` | TDD tests for moved evolution toggle |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/styles/globals.css` | Add canonical `.btn-*`, `.card`, `.input`, `.section-heading` layer classes |
| `apps/frontend/src/pages/dashboard.tsx` | Add `<WelcomeModal>`, replace inline empty state with `<EmptyState>`, apply canonical classes |
| `apps/frontend/src/pages/profile.tsx` | Add evolution settings section + `next/dynamic` for NetworkGraph |
| `apps/frontend/src/pages/reputation/trust.tsx` | Remove evolution toggle block, add link to profile |
| `apps/frontend/src/pages/communities/index.tsx` | Add `<EmptyState>` for empty list |
| `apps/frontend/src/pages/communities/new.tsx` | `next/dynamic` for CommunityConfigEditor |
| `apps/frontend/src/pages/communities/[id].tsx` | `next/dynamic` for CommunityConfigEditor |
| `apps/frontend/src/pages/requests/index.tsx` | Add `<EmptyState>` for empty list |
| `apps/frontend/src/pages/offers/index.tsx` | Add `<EmptyState>` for empty list |
| `apps/frontend/src/pages/admin/schemas/[id]/edit.tsx` | `next/dynamic` for SchemaCanvas |
| `apps/landing/src/components/sections/Hero.tsx` | Plain-language copy rewrite |
| `docs/guides/getting-started-guide.md` | Plain-language rewrite (source for generate-docs) |
| `docs/guides/making-requests-guide.md` | Plain-language rewrite (source for generate-docs) |
| `scripts/generate-docs.ts` | Fix: label truncation (line 453), ADR status regex (line 58), add 11 orphaned ADRs to ADR_GROUPS |

### Auto-regenerated (after `npm run generate-docs`)
| File | Source |
|------|--------|
| `apps/landing/src/data/docs/nav.json` | `scripts/generate-docs.ts` |
| `apps/landing/src/data/docs/guides/getting-started.json` | `docs/guides/getting-started-guide.md` |
| `apps/landing/src/data/docs/guides/making-requests.json` | `docs/guides/making-requests-guide.md` |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`generate-docs.ts` is source of truth for `nav.json`** — NEVER edit `apps/landing/src/data/docs/nav.json` directly. All three landing page fixes go in `scripts/generate-docs.ts`:
   - **Line 453**: `.slice(0, 55)` → `.slice(0, 80)` (fixes 3 truncated ADR nav labels)
   - **Line 58**: Fix `extractAdrStatus` regex from `/\*?\*?Status\*?\*?:\s*(\w+)/i` to `/\*?\*?Status\*?\*?:\s*[^a-zA-Z]*(\w+)/i` — current regex fails when `✅` precedes the status word
   - **Lines 371–431** (`ADR_GROUPS`): Add 11 orphaned ADR slugs (see Task 8 for full list)

2. **`git add -f` for generated docs** — `apps/landing/src/data/docs/` may be gitignored. Always use `git add -f apps/landing/src/data/docs/...` before commit.

3. **WelcomeModal hydration safety** — initialize `visible = false`. Read `localStorage` ONLY inside `useEffect`. Never read at render time (Next.js SSR will throw hydration mismatch).

4. **`next/dynamic` requires `ssr: false`** for `NetworkGraph`, `CommunityConfigEditor`, `SchemaCanvas` — all reference browser APIs (`window`, `document`, canvas). Omitting `ssr: false` crashes the dev server.

5. **EmptyState visibility guard** — only show when `!loading && items.length === 0`. Prevents flash during initial load.

6. **Design consistency = targeted fixes only** — CSS variables and Tailwind tokens are well-structured. Replace visible divergence with canonical classes. Do NOT refactor components that already look consistent.

7. **Evolution toggle duplication is intentional** — `TrustEvolutionToggle` sub-component will be temporarily copied into `profile.tsx` from `trust.tsx`. Extraction to a shared file is Sprint 34 cleanup.

8. **Communities for evolution in `profile.tsx`** — read from localStorage JWT (no extra API call): `const evolutionCommunities = (JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []) as Array<{id: string; name: string}>`.

9. **Guide source files are markdown** — `docs/guides/*.md` are the source. `generate-docs.ts` reads them and writes to `apps/landing/src/data/docs/guides/*.json`. Always edit the `.md` file, then regenerate.

10. **No `services/registry.json` changes** — pure frontend sprint. Skip `npm run analyze:services`.

---

## Task 1: Feature Branch

**Files:** None

- [ ] Create branch from master:
  ```bash
  git checkout -b feature/sprint-33-ux-foundation
  ```

- [ ] Verify clean:
  ```bash
  git status
  ```

---

## Task 2: TDD Tests First

**Files:**
- Create: `tests/tdd/empty-state.test.ts`
- Create: `tests/tdd/welcome-modal.test.ts`
- Create: `tests/tdd/evolution-toggle-profile.test.ts`

Write pure-logic tests (no DOM, no React testing library — follow project pattern from existing TDD tests):

- [ ] **`empty-state.test.ts`**:
  ```typescript
  // shouldShowEmptyState(loading: boolean, count: number): boolean
  //   false when loading === true
  //   false when count > 0
  //   true when !loading && count === 0
  ```

- [ ] **`welcome-modal.test.ts`**:
  ```typescript
  // isOnboarded(storageValue: string | null): boolean
  //   true when storageValue is non-null
  //   false when storageValue is null
  // shouldShowModal(isLoggedIn: boolean, isOnboarded: boolean): boolean
  //   true only when isLoggedIn && !isOnboarded
  // stepNext(step: 1 | 2 | 3): 1 | 2 | 3
  //   1→2, 2→3, 3→3
  ```

- [ ] **`evolution-toggle-profile.test.ts`**:
  ```typescript
  // toggleGlobalEvolution(current: boolean): boolean
  //   returns !current
  // settingsVisible(user: User | null, globalEnabled: boolean | null): boolean
  //   true only when user is set AND globalEnabled is not null
  ```

- [ ] Verify parseable:
  ```bash
  npm run test:tdd -- --testPathPattern="empty-state|welcome-modal|evolution-toggle-profile" 2>&1 | head -40
  ```

---

## Task 3: Design Consistency Pass

**Files:**
- Modify: `apps/frontend/src/styles/globals.css`
- Modify (targeted): `dashboard.tsx`, `communities/index.tsx`, `profile.tsx`, `login.tsx`, `register.tsx`

- [ ] Add canonical `@layer components` utilities to `globals.css` (after existing component classes):
  ```css
  /* Buttons */
  .btn-primary   { @apply bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed; }
  .btn-secondary { @apply bg-surface-raised text-text border border-border px-6 py-2.5 rounded-lg font-medium hover:bg-primary-light transition-colors; }
  .btn-ghost     { @apply text-primary px-4 py-2 rounded-lg hover:bg-primary-light transition-colors; }
  .btn-danger    { @apply bg-error text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity; }

  /* Layout */
  .card          { @apply bg-surface-raised rounded-xl border border-border shadow-sm; }
  .input         { @apply w-full px-4 py-2.5 border border-border rounded-lg bg-surface text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent; }
  .section-heading { @apply text-lg font-semibold text-text mb-4; }
  ```

- [ ] Grep for divergent patterns to replace:
  ```bash
  grep -r "bg-green-\|text-blue-\|rounded-md.*px-4.*py-2\b" apps/frontend/src/pages/ --include="*.tsx" -l
  ```

- [ ] Apply canonical classes on high-traffic pages:
  - `login.tsx` / `register.tsx` — form inputs → `.input`, submit button → `.btn-primary`
  - `dashboard.tsx` — sidebar cards → `.card`, quick-create area
  - `communities/index.tsx` — community cards → `.card`, filter bar inputs → `.input`
  - `profile.tsx` — section headings → `.section-heading`, skill tag buttons

  > Do NOT refactor components that are already visually consistent. Target visible divergence only.

---

## Task 4: `EmptyState.tsx` + Integrate Into Pages

**Files:**
- Create: `apps/frontend/src/components/EmptyState.tsx`
- Modify: `dashboard.tsx`, `communities/index.tsx`, `requests/index.tsx`, `offers/index.tsx`

- [ ] Create `EmptyState.tsx`:
  ```typescript
  interface EmptyStateProps {
    icon?: string
    heading: string
    body: string
    ctaLabel?: string
    ctaHref?: string
    ctaOnClick?: () => void
  }
  // Renders: .card p-8 text-center — icon (text-4xl), heading (font-semibold text-lg), body (text-text-muted text-sm mt-2 mb-6), CTA (.btn-primary inline-flex)
  ```

- [ ] Wire into pages — guard with `!loading && items.length === 0`:

  | Page | Icon | Heading | Body | CTA |
  |------|------|---------|------|-----|
  | `dashboard.tsx` | 🤝 | "Nothing here yet" | "Join a community and post your first request — or offer to help someone." | "Browse Communities" → `/communities` |
  | `communities/index.tsx` | 🏘️ | "No communities found" | "Try a different search, or start your own community." | "Create a Community" → `/communities/new` |
  | `requests/index.tsx` | 📋 | "No requests yet" | "Be the first to ask for help — or check back soon." | "Post a Request" → `/dashboard` |
  | `offers/index.tsx` | 🙌 | "No offers yet" | "Browse requests and offer to help someone today." | "Go to Dashboard" → `/dashboard` |

---

## Task 5: `WelcomeModal.tsx` + Dashboard Integration

**Files:**
- Create: `apps/frontend/src/components/WelcomeModal.tsx`
- Modify: `apps/frontend/src/pages/dashboard.tsx`

- [ ] Create `WelcomeModal.tsx`:
  - State: `step: 1 | 2 | 3`, `visible: boolean` (init `false`)
  - Hydration-safe init:
    ```typescript
    useEffect(() => {
      if (!localStorage.getItem('karmyq_onboarded') && user) setVisible(true)
    }, [user])
    ```
  - On close/done: `localStorage.setItem('karmyq_onboarded', '1'); setVisible(false)`
  - Layout: `fixed inset-0 z-50 flex items-center justify-center`, backdrop `bg-black/50`, modal `.card p-8 max-w-md w-full mx-4`
  - Step dots: `flex justify-center gap-2 mt-6` — `bg-primary rounded-full w-2 h-2` (active), `bg-border rounded-full w-2 h-2` (inactive)
  - Step content (see spec for copy)

- [ ] In `dashboard.tsx`: import and render `<WelcomeModal user={user} />` inside `<Layout>`, above the main grid

---

## Task 6: Move Evolution Toggle — `trust.tsx` → `profile.tsx`

**Files:**
- Modify: `apps/frontend/src/pages/reputation/trust.tsx`
- Modify: `apps/frontend/src/pages/profile.tsx`

- [ ] **`trust.tsx`**:
  - Remove the `TrustEvolutionToggle` inline component definition (near top of file)
  - Remove the "Trust Model Evolution" JSX section (~lines 321–371)
  - Add replacement: `<p className="text-sm text-text-muted mt-6">Manage trust evolution settings on your <a href="/profile" className="text-primary underline">Profile page</a>.</p>`
  - Everything else (trust score display, per-community breakdown, tips) stays

- [ ] **`profile.tsx`**:
  - Copy `TrustEvolutionToggle` sub-component from trust.tsx (paste before main component export)
  - Add state: `const [globalEvolutionEnabled, setGlobalEvolutionEnabled] = useState<boolean | null>(null)`
  - In the existing init `useEffect`, add:
    ```typescript
    reputationService.getGlobalEvolutionSetting(user.id)
      .then(r => setGlobalEvolutionEnabled(r.data?.global_evolution_enabled ?? true))
      .catch(() => setGlobalEvolutionEnabled(true))
    ```
  - Community list from localStorage (no extra API call):
    ```typescript
    const evolutionCommunities = (JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []) as Array<{id: string; name: string}>
    ```
  - Add "Trust Evolution Settings" section at bottom of JSX (before closing `</Layout>`), after Skills — reuse the exact same JSX pattern from trust.tsx

---

## Task 7: Performance — `next/dynamic` for Heavy Components

**Files:**
- Modify: `apps/frontend/src/pages/profile.tsx`
- Modify: `apps/frontend/src/pages/communities/new.tsx`
- Modify: `apps/frontend/src/pages/communities/[id].tsx`
- Modify: `apps/frontend/src/pages/admin/schemas/[id]/edit.tsx`

- [ ] Add `import dynamic from 'next/dynamic'` to each file

- [ ] **`profile.tsx`** — NetworkGraph (static import is at line ~8):
  ```typescript
  // Remove: import NetworkGraph from '@/components/NetworkGraph'
  const NetworkGraph = dynamic(() => import('@/components/NetworkGraph'), {
    loading: () => <div className="card p-8 text-center text-text-muted animate-pulse">Loading network...</div>,
    ssr: false,
  })
  ```

- [ ] **`communities/new.tsx`** and **`communities/[id].tsx`** — CommunityConfigEditor:
  ```typescript
  const CommunityConfigEditor = dynamic(() => import('@/components/CommunityConfigEditor'), {
    loading: () => <div className="animate-pulse bg-border-light rounded-lg h-32" />,
    ssr: false,
  })
  ```

- [ ] **`admin/schemas/[id]/edit.tsx`** — SchemaCanvas:
  ```typescript
  const SchemaCanvas = dynamic(() => import('@/components/admin/SchemaCanvas'), {
    loading: () => <div className="animate-pulse bg-border-light rounded-lg h-64" />,
    ssr: false,
  })
  ```

---

## Task 8: Landing Page Fixes — `scripts/generate-docs.ts`

**Files:**
- Modify: `scripts/generate-docs.ts`

- [ ] **Fix label truncation** (line 453):
  ```typescript
  // Before:
  label: adr.title.replace(/^ADR-\d+[:\s-]+/, '').slice(0, 55),
  // After:
  label: adr.title.replace(/^ADR-\d+[:\s-]+/, '').slice(0, 80),
  ```

- [ ] **Fix ADR status regex** (line 58):
  ```typescript
  // Before:
  const match = content.match(/\*?\*?Status\*?\*?:\s*(\w+)/i);
  // After:
  const match = content.match(/\*?\*?Status\*?\*?:\s*[^a-zA-Z]*(\w+)/i);
  ```

- [ ] **Add 11 orphaned ADRs to `ADR_GROUPS`** (after line 431):
  ```typescript
  // '— Foundation —' group: append
  'adr-005-minimalist-dashboard',
  'adr-008-three-column-dashboard',

  // '— Trust & Reputation —' group: append
  'adr-035-karma-allocation-trust-score-strategy',

  // '— Requests & Matching —' group: append
  'adr-033-offer-fulfillment-workflow',

  // '— Infrastructure —' group: append
  'adr-001-natural-language-location-parsing',
  'adr-002-geocoding-cache-architecture',
  'adr-012-realtime-communication',
  'adr-014-testing-strategy',
  'adr-023-infrastructure-standardization',
  'adr-024-synthetic-user-simulation',
  'adr-027-docker-image-optimization-deferred',
  ```

- [ ] Run and verify:
  ```bash
  cd apps/landing && npm run generate-docs
  ```
  Check `apps/landing/src/data/docs/nav.json`:
  - ADR-037 label no longer ends in `"...Bridging Ca"`
  - ADR-007 concept JSON has `"status": "implemented"` (not `"unknown"`)
  - All 11 orphaned ADRs appear in nav

---

## Task 9: Landing Page Copy + Guide Rewrites

**Files:**
- Modify: `apps/landing/src/components/sections/Hero.tsx`
- Modify: `docs/guides/getting-started-guide.md`
- Modify: `docs/guides/making-requests-guide.md`

- [ ] **`Hero.tsx`** — change three string values only (Framer Motion wrappers unchanged):
  - Eyebrow: → `"Mutual aid for everyday life"`
  - H1: → `"Ask for help. Offer what you can. Build real connections."`
  - Body paragraph: → `"Karmyq connects neighbors who help each other — rides, borrowed tools, childcare, home repairs. No money changes hands. Just community."`

- [ ] **`docs/guides/getting-started-guide.md`** — rewrite for non-technical readers:
  - Headings: "1. Create Your Account", "2. Find Your Community", "3. Get to Know the App", "4. Do Something"
  - Replace "karma lockout period" → "some communities ask new members to wait a bit before posting big requests — it's just a way to build trust first"
  - Short, conversational, numbered steps

- [ ] **`docs/guides/making-requests-guide.md`** — plain-language pass:
  - Add concrete example: `"I need a lift to the airport on Friday morning — 7am, NW6 area"`
  - Simplify expiration: "set a date if you need it by a specific time"

- [ ] Regenerate and force-add:
  ```bash
  cd apps/landing && npm run generate-docs
  git add -f apps/landing/src/data/docs/guides/getting-started.json
  git add -f apps/landing/src/data/docs/guides/making-requests.json
  git add -f apps/landing/src/data/docs/nav.json
  ```

---

## Task 10: Docs + CONTEXT.md + TDD Tests Pass

**Files:**
- Modify: `apps/frontend/CONTEXT.md`

- [ ] Update `apps/frontend/CONTEXT.md`:
  - **New components**: `EmptyState.tsx` (reusable empty state, used on dashboard/communities/requests/offers), `WelcomeModal.tsx` (3-step onboarding, controlled by `karmyq_onboarded` localStorage key)
  - **New pattern**: `next/dynamic` + `ssr: false` for `NetworkGraph`, `CommunityConfigEditor`, `SchemaCanvas`
  - **New pattern**: `karmyq_onboarded` localStorage flag — absence triggers WelcomeModal
  - **Canonical classes**: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input`, `.section-heading` defined in `globals.css @layer components`
  - **Evolution toggle**: moved from `reputation/trust.tsx` → `profile.tsx` (bottom section)

- [ ] Run TDD tests:
  ```bash
  npm run test:tdd -- --testPathPattern="empty-state|welcome-modal|evolution-toggle-profile"
  ```
  All 3 new test files must pass.

- [ ] Run full suite:
  ```bash
  npm test
  ```
  Must pass.

---

## Task 11: Final Verification

- [ ] **TypeScript check**:
  ```bash
  cd apps/frontend && npx tsc --noEmit
  ```

- [ ] **Feedback loop**:
  ```bash
  npm run feedback:check
  ```

- [ ] **Manual browser spot-checks**:
  - Clear `karmyq_onboarded` → visit dashboard → WelcomeModal appears; all 3 steps work; Done closes
  - Visit dashboard again → WelcomeModal does NOT appear
  - `/requests` with 0 results → EmptyState with CTA visible
  - `/offers` empty → EmptyState visible
  - `/communities` empty search → EmptyState visible
  - `/profile` → scroll to bottom → "Trust Evolution Settings" section present
  - `/reputation/trust` → no toggle UI; "Profile page" link present
  - Landing `/docs` sidebar: ADR-037 label not truncated; all previously orphaned ADRs present
  - Hero copy: plain language, no "infrastructure" or "gift economy"
  - Buttons consistent across dashboard, login, communities pages

- [ ] **Version bump**: root `package.json` `"9.7.1"` → `"9.8.0"`

- [ ] **Commit**:
  ```bash
  git add -f apps/landing/src/data/docs/
  git add apps/frontend/src/ docs/guides/ scripts/ tests/ package.json
  npm test && npm run test:tdd && npm run feedback:check
  git commit -m "feat(ux): Sprint 33 — UX Foundation (design consistency, onboarding, landing fixes)"
  ```

- [ ] **Update handoff** (`/update-handoff`):
  Sprint 33 complete, v9.8.0, Sprint 34 = mobile nav + core flows

---

## Verification Commands (quick reference)

```bash
npm test                    # unit + regression — must pass
npm run test:tdd            # TDD tests — must pass
npm run feedback:check      # docs loop — must pass
cd apps/frontend && npx tsc --noEmit  # TypeScript — must pass
cd apps/landing && npm run generate-docs  # after all landing changes
```
