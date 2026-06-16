# Visible Memory + Re-warm First Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Make Karmyq's "designed to forget" promise visible and trustworthy in Profile, community
trust, and weekly pulse surfaces while keeping counts humane rather than accounting-like.

**Architecture:** Sprint 102 is a frontend productization sprint over existing Sprint 90 APIs:
`GET /trust/me/memory`, `GET /trust/relationships/fading`, graph `decayTier`, and
`GET /requests/retention-policy`. It adds no new schema, no new endpoints, and no new decay math.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create

| File | Responsibility |
|------|----------------|
| `apps/frontend/tests/tdd/sprint-102-visible-memory.test.tsx` | TDD coverage for `MemorySection` and `ReWarmingNudge` visible memory copy. |
| `apps/frontend/tests/tdd/sprint-102-community-memory-copy.test.tsx` | TDD coverage for community trust legend and community pulse copy. |

### Existing files to modify

| File | Change |
|------|--------|
| `apps/frontend/src/components/profile/MemorySection.tsx` | Render memory independently from karma, add text-legible tier framing, keep empty rows suppressed. |
| `apps/frontend/src/pages/profile.tsx` | Give memory a first-class placement and safe community selection independent of karma display. |
| `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx` | Add memory legend/explanation near graph and keep re-warm nudge self-suppressed. |
| `apps/frontend/src/components/relationships/ReWarmingNudge.tsx` | Reframe nearly-forgotten copy as an optional re-warm first step. |
| `apps/frontend/src/components/community/CommunityPulse.tsx` | Reframe helped-count copy from KPI/accounting to contribution evidence. |
| `apps/frontend/src/styles/karmyq-shell.css` | Add small reusable memory legend classes only if needed. |
| `docs/guides/your-memory-and-relationships-guide.md` | Update guide for Sprint 102 placement and optional re-warm action. |
| `docs/concepts/designed-to-forget.md` | Clarify content retention vs relationship fading and memory-not-scorekeeping. |
| `docs/concepts/community-home.md` | Update pulse copy semantics and keep inspectability language. |
| `docs/concepts/reading-the-trust-graph.md` | Add fading/nearly-forgotten graph reading guidance. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Align onboarding memory copy with visible memory surfaces. |
| `apps/frontend/CONTEXT.md` | Document Sprint 102 frontend behavior. |
| `apps/landing/src/data/docs/**` | Regenerated docs from source docs; verify nav does not revert. |
| `.claude/handoff/CURRENT_HANDOFF.md` | Mark Sprint 102 ready to execute and include validation checklist. |

---

## Critical Implementation Notes (read before Task 2)

1. **No new decay math.** Use existing `decayTier` values and `decayPresentation`; do not duplicate or
   reinterpret `classifyDecayTier` thresholds in frontend code.
2. **`trust_edges_live` is read-only.** It is a VIEW. Sprint 102 must not write to it or add a decay job.
3. **Memory must not depend on karma visibility.** The profile memory section should render relationship
   memory for a selected community even when the member has not enabled "Show My Karma."
4. **Counts are evidence, not scoreboards.** Keep truthful counts, but phrase them as signs of care and
   community memory. Do not add leaderboard, streak, productivity, or engagement language.
5. **Re-warm is optional and gentle.** A nearly-forgotten bond may be let go. Copy must not imply failure,
   penalty, or urgency manipulation.
6. **No notification or messaging expansion.** Keep the existing `/messages?to=` reconnect action unless
   implementation discovers it is broken; do not add automated reminders.
7. **Fading must be text-legible.** Opacity alone is not enough. Add readable labels/explanations for
   fading and nearly-forgotten states.
8. **Do not scatter router mocks.** Preserve the global `apps/frontend/jest.setup.js` `next/router` mock;
   use per-test mocks only when a custom query or spy is needed.
9. **Avoid unsafe localStorage parsing.** If touching profile localStorage reads, wrap JSON parsing or use
   existing guarded patterns.
10. **Docs are part of done.** User guides, concept pages, onboarding, frontend context, and generated
    landing docs ship with the sprint.
11. **Generated landing docs are gitignored.** After regeneration, use `git add -f` for changed
    `apps/landing/src/data/docs/*` files that must be committed.
12. **Known CodeQL false positive.** Editing `apps/frontend/src/lib/api.ts` can re-trigger the recurring
    `js/request-forgery` false positive on trusted `NEXT_PUBLIC_API_URL` base URLs. Avoid api.ts edits
    unless necessary; if it recurs, dismiss with the documented false-positive rationale and re-run.

---

## Task 1: Branch + Existing Context Check

**Files:**
- Read: `apps/frontend/CONTEXT.md`
- Read: `services/social-graph-service/CONTEXT.md`
- Read: `docs/adr/ADR-069-data-retention-and-forgetting.md`
- Read: `docs/adr/ADR-070-visible-decay-model.md`

- [ ] Confirm branch.

```bash
git branch --show-current
```

Expected: `feature/sprint-102-visible-memory-rewarm`.

- [ ] Confirm existing local changes before editing.

```bash
git status --short
```

Expected: existing unrelated `docs/BUGS.md` may be modified. Do not edit, stage, or revert it.

- [ ] Read the local/frontend and social-graph context listed above.

- [ ] Verify existing API wrappers before changing frontend code.

```bash
rg -n "getRelationshipMemory|getFadingRelationships|getFullCommunityGraph|getRetentionPolicy" apps/frontend/src/lib/api.ts
```

Expected: wrappers already exist. Avoid editing `apps/frontend/src/lib/api.ts` unless a wrapper is missing.

- [ ] Commit checkpoint if only docs planning artifacts are present from planning chat.

```bash
git status --short
```

Expected: no implementation files changed yet.

---

## Task 2: TDD - Profile Memory + Re-warm Copy

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-102-visible-memory.test.tsx`
- Test target: `apps/frontend/src/components/profile/MemorySection.tsx`
- Test target: `apps/frontend/src/components/relationships/ReWarmingNudge.tsx`

- [ ] Create the failing test file with mocked API calls.

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import MemorySection from '@/components/profile/MemorySection'
import ReWarmingNudge from '@/components/relationships/ReWarmingNudge'
import { socialGraphService } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  socialGraphService: {
    getRelationshipMemory: jest.fn(),
    getFadingRelationships: jest.fn(),
  },
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

const memory = {
  activeCount: 2,
  fading: [
    {
      peerId: 'peer-fading',
      peerName: 'Maya Patel',
      currentWeight: 0.8,
      decayTier: 'fading',
      lastInteractionAt: '2026-05-01T00:00:00.000Z',
      matchCompletedCount: 2,
    },
  ],
  nearlyForgotten: [
    {
      peerId: 'peer-nearly',
      peerName: 'Sam Rivera',
      currentWeight: 0.55,
      decayTier: 'nearly_forgotten',
      lastInteractionAt: '2026-04-12T00:00:00.000Z',
      matchCompletedCount: 3,
    },
  ],
}

describe('Sprint 102 - visible profile memory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders relationship memory without requiring a karma trend', async () => {
    ;(socialGraphService.getRelationshipMemory as jest.Mock).mockResolvedValue({ data: memory })

    render(<MemorySection communityId="community-1" karmaTrend={null} />)

    expect(
      await screen.findByText((_, node) =>
        node?.tagName.toLowerCase() === 'p' &&
        node.textContent === "2 active relationships you're tending.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Maya Patel')).toBeInTheDocument()
    expect(screen.getByText(/Going quiet/i)).toBeInTheDocument()
    expect(screen.getByText(/Sam Rivera/i)).toBeInTheDocument()
    expect(screen.queryByText(/Karma trend/i)).not.toBeInTheDocument()
  })

  it('makes fading and nearly-forgotten states text-legible', async () => {
    ;(socialGraphService.getRelationshipMemory as jest.Mock).mockResolvedValue({ data: memory })

    render(<MemorySection communityId="community-1" />)

    expect(await screen.findByText(/Going quiet/i)).toBeInTheDocument()
    expect(screen.getByText(/Close to being let go/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /What we keep/i })).toHaveAttribute('href', '/about/memory')
  })

  it('suppresses hollow memory rows when there is no relationship memory', async () => {
    ;(socialGraphService.getRelationshipMemory as jest.Mock).mockResolvedValue({
      data: { activeCount: 0, fading: [], nearlyForgotten: [] },
    })

    render(<MemorySection communityId="community-1" />)

    await waitFor(() => expect(socialGraphService.getRelationshipMemory).toHaveBeenCalled())
    expect(screen.queryByLabelText(/Your memory/i)).not.toBeInTheDocument()
  })
})

describe('Sprint 102 - re-warm first step', () => {
  it('frames reconnect as optional memory care with one action', () => {
    render(
      <ReWarmingNudge
        communityId="community-1"
        relationships={[memory.nearlyForgotten[0] as any]}
      />,
    )

    expect(screen.getByText(/Close to being let go/i)).toBeInTheDocument()
    expect(screen.getByText(/Sam Rivera/)).toBeInTheDocument()
    expect(screen.getByText(/reconnect if this bond still matters/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Reconnect/i })).toHaveLength(1)
  })
})
```

- [ ] Run the new test and confirm it fails before implementation.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-visible-memory.test.tsx --runInBand
```

Expected: fails because current copy/labels do not yet include the Sprint 102 wording.

---

## Task 3: Implement Profile Memory Copy and Rendering

**Files:**
- Modify: `apps/frontend/src/components/profile/MemorySection.tsx`

- [ ] Update `RelationshipFace` so each chip includes a text label that does not rely on hover/title.

Implementation pattern:

```tsx
const DECAY_COPY: Record<DecayTier, string> = {
  strong: 'Active',
  warm: 'Warm',
  fading: 'Fading',
  nearly_forgotten: 'Nearly forgotten',
  swept: 'Let go',
}

function RelationshipFace({ rel }: { rel: Relationship }) {
  const decay = decayPresentation(rel.decayTier)
  return (
    <span className={`kq-path-badge${decay.className}`} title={decay.title}>
      <span className="kq-path-avatar" aria-hidden="true">
        {rel.peerName.charAt(0).toUpperCase()}
      </span>
      <span>{rel.peerName}</span>
      <span className="text-[11px] font-medium text-text-muted">{DECAY_COPY[rel.decayTier]}</span>
    </span>
  )
}
```

- [ ] Split the fading and nearly-forgotten rows with clear labels:

```tsx
{hasFading && (
  <div>
    <p className="kq-quiet-meta mb-2">Going quiet</p>
    <p className="text-sm text-text-muted mb-2">
      These bonds are still here, but they have been quieter lately.
    </p>
    <div className="flex flex-wrap gap-2">
      {data.fading.map((rel) => (
        <RelationshipFace key={rel.peerId} rel={rel} />
      ))}
    </div>
  </div>
)}

{hasNearly && (
  <ReWarmingNudge
    communityId={communityId}
    relationships={data.nearlyForgotten as FadingRelationship[]}
  />
)}
```

- [ ] Keep the section self-suppression rule based on actual memory:

```tsx
if (!hasActive && !hasFading && !hasNearly && !trend) return null
```

- [ ] Update footer copy:

```tsx
<p className="kq-quiet-meta border-t border-border-light pt-3">
  We keep the fact that care happened - active bonds, completed exchanges, karma, and trust - while
  private request and message details are let go on a schedule.{' '}
  <a href="/about/memory" className="underline">What we keep</a>
</p>
```

- [ ] Run the focused test.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-visible-memory.test.tsx --runInBand
```

Expected: `MemorySection` assertions pass; `ReWarmingNudge` assertions may still fail until Task 4.

---

## Task 4: Implement Gentle Re-warm Copy

**Files:**
- Modify: `apps/frontend/src/components/relationships/ReWarmingNudge.tsx`

- [ ] Change section label and copy to optional memory care.

Implementation pattern:

```tsx
<section className={`kq-card border-l-4 border-l-primary ${className}`} aria-label="Relationships to re-warm">
  <p className="kq-section-label !mt-0">Close to being let go</p>
  <ul className="grid gap-3">
    {fading.map((rel) => (
      <li key={rel.peerId} className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text">
            You and <span className="font-semibold">{rel.peerName}</span> have a bond that is close
            to fading from active memory - reconnect if this bond still matters.
          </p>
          <p className="kq-quiet-meta">
            {rel.lastInteractionAt
              ? `Last connected ${new Date(rel.lastInteractionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : 'It has been a while'}
          </p>
        </div>
        <Link
          href={`/messages?to=${encodeURIComponent(rel.peerId)}`}
          className="kq-pill flex-none border-primary-medium bg-primary-light text-primary-dark hover:opacity-90"
        >
          Reconnect
        </Link>
      </li>
    ))}
  </ul>
</section>
```

- [ ] Keep the existing self-suppression:

```tsx
if (!fading || fading.length === 0) return null
```

- [ ] Run the focused test.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-visible-memory.test.tsx --runInBand
```

Expected: all tests in `sprint-102-visible-memory.test.tsx` pass.

- [ ] Run simplify check on this slice.

Verification: review the diff for duplicated copy/constants and remove any unnecessary branching.

---

## Task 5: TDD - Community Trust Legend and Pulse Copy

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-102-community-memory-copy.test.tsx`
- Test target: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
- Test target: `apps/frontend/src/components/community/CommunityPulse.tsx`

- [ ] Create the failing test file.

```tsx
import { render, screen } from '@testing-library/react'
import CommunityPulse from '@/components/community/CommunityPulse'
import TrustGraphTab from '@/components/community/tabs/TrustGraphTab'

jest.mock('@/lib/api', () => ({
  socialGraphService: {
    getFullCommunityGraph: jest.fn(() => Promise.resolve({ data: { nodes: [], links: [] } })),
    getTrustGraph: jest.fn(() => Promise.resolve({ data: { nodes: [], links: [] } })),
    getFadingRelationships: jest.fn(() => Promise.resolve({ data: [] })),
  },
}))

jest.mock('@/components/TrustGraph', () => ({
  __esModule: true,
  default: () => <div data-testid="trust-graph" />,
}))

jest.mock('@/components/relationships/ReWarmingNudge', () => ({
  __esModule: true,
  default: () => null,
}))

describe('Sprint 102 - community memory copy', () => {
  it('explains fading relationships in the connected tab', async () => {
    render(<TrustGraphTab communityId="community-1" currentUserId="user-1" />)

    expect(screen.getByText(/How memory fades/i)).toBeInTheDocument()
    expect(screen.getByText(/Strong and warm bonds/i)).toBeInTheDocument()
    expect(screen.getByText(/Nearly forgotten bonds/i)).toBeInTheDocument()
  })

  it('reframes helped count as care, not accounting', () => {
    render(
      <CommunityPulse
        pulse={{
          helpedThisWeek: 3,
          openAsks: 0,
          timeSensitive: 0,
          recentJoins: 0,
          recentHelpers: [{ name: 'Maria Reyes', count: 1 }, { name: 'David Park', count: 1 }],
          windowDays: 7,
        }}
        loading={false}
      />,
    )

    expect(screen.getByText(/3 neighbours showed up for one another/i)).toBeInTheDocument()
    expect(screen.getByText(/with care from Maria Reyes, David Park/i)).toBeInTheDocument()
    expect(screen.queryByText(/helped each other/i)).not.toBeInTheDocument()
  })

  it('still suppresses zero helped rows and links open asks', () => {
    render(
      <CommunityPulse
        communityId="community-1"
        pulse={{ helpedThisWeek: 0, openAsks: 4, timeSensitive: 1, recentJoins: 0, recentHelpers: [], windowDays: 7 }}
        loading={false}
      />,
    )

    expect(screen.queryByText(/0 neighbours/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /4 open asks across the community/i })).toHaveAttribute(
      'href',
      '/communities/community-1/open-asks',
    )
  })
})
```

- [ ] Run the new test and confirm it fails before implementation.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-community-memory-copy.test.tsx --runInBand
```

Expected: fails because current legend/copy is absent.

---

## Task 6: Implement Community Memory Legend

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/TrustGraphTab.tsx`
- Optional modify: `apps/frontend/src/styles/karmyq-shell.css`

- [ ] Add a small legend component inside `TrustGraphTab.tsx` above `ReWarmingNudge`.

Implementation pattern:

```tsx
function MemoryLegend() {
  return (
    <section className="kq-action-band mb-4" aria-label="How memory fades">
      <p className="kq-section-label !mt-0">How memory fades</p>
      <div className="grid gap-2 text-sm text-text-muted md:grid-cols-3">
        <div>
          <span className="font-semibold text-text">Strong and warm bonds</span>
          <p>Recent or well-tended relationships stay vivid.</p>
        </div>
        <div>
          <span className="font-semibold text-text">Fading bonds</span>
          <p>Quiet relationships look softer so the graph reflects what is alive now.</p>
        </div>
        <div>
          <span className="font-semibold text-text">Nearly forgotten bonds</span>
          <p>You can reconnect, or let them fade from active memory.</p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] Render it before `ReWarmingNudge`.

```tsx
<MemoryLegend />
<ReWarmingNudge communityId={communityId} className="mb-4" />
```

- [ ] Do not change graph fetching or `decayTier` data flow.

- [ ] Run the focused test.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-community-memory-copy.test.tsx --runInBand
```

Expected: TrustGraphTab assertions pass; pulse assertions may still fail until Task 7.

---

## Task 7: Reframe Community Pulse Copy

**Files:**
- Modify: `apps/frontend/src/components/community/CommunityPulse.tsx`
- Modify if necessary: `apps/frontend/tests/tdd/sprint-89-community-page-ia.test.tsx`

- [ ] Change the helped row lead and subcopy only. Do not alter count semantics.

Implementation pattern:

```tsx
if (pulse.helpedThisWeek > 0) {
  rows.push({
    key: 'helped',
    icon: '🤝',
    lead: `${pulse.helpedThisWeek} ${pulse.helpedThisWeek === 1 ? 'neighbour' : 'neighbours'} showed up for one another`,
    sub: helpers.length > 0 ? `with care from ${helpers.join(', ')}` : 'We keep the fact of care, not every private detail',
  })
}
```

- [ ] Keep zero suppression and open-ask link behavior unchanged.

- [ ] Update the Sprint 89 IA test only if it asserts the old exact phrase. Preserve the zero-row test.

- [ ] Run focused tests.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-community-memory-copy.test.tsx tests/tdd/sprint-89-community-page-ia.test.tsx --runInBand
```

Expected: both suites pass.

- [ ] Run simplify check on this slice.

Verification: ensure no copy is duplicated across tests and implementation beyond necessary literals.

---

## Task 8: Profile Placement and Safe Community Selection

**Files:**
- Modify: `apps/frontend/src/pages/profile.tsx`

- [ ] Ensure memory renders independently of `showKarmaToMe`. Keep this render condition:

```tsx
{selectedCommunityId && (
  <MemorySection communityId={selectedCommunityId} karmaTrend={karmaData?.trend ?? null} />
)}
```

This condition may remain outside the `showKarmaToMe` branch. If the current code already satisfies
this, leave the render in place and avoid churn.

- [ ] Add or preserve a community selector that updates `selectedCommunityId` even when karma is hidden.

Implementation pattern if selector is only inside the karma section:

```tsx
{communities.length > 1 && (
  <div className="mb-4">
    <label className="block text-sm font-medium text-text-muted mb-2">
      Memory in community
    </label>
    <select
      value={selectedCommunityId}
      onChange={(e) => setSelectedCommunityId(e.target.value)}
      className="px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {communities.map((community) => (
        <option key={community.id} value={community.id}>
          {community.name}
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] If moving the selector, avoid rendering a duplicate selector in the karma block. Keep a single source
of selected community state.

- [ ] Guard any new localStorage reads:

```tsx
function readStoredCommunities(): Array<{ id: string; name: string }> {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []
  } catch {
    return []
  }
}
```

- [ ] Run Profile-related focused tests if present.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-visible-memory.test.tsx --runInBand
```

Expected: pass.

---

## Task 9: Docs, Onboarding, and Generated Landing Docs

**Files:**
- Modify: `docs/guides/your-memory-and-relationships-guide.md`
- Modify: `docs/concepts/designed-to-forget.md`
- Modify: `docs/concepts/community-home.md`
- Modify: `docs/concepts/reading-the-trust-graph.md`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts`
- Modify: `apps/frontend/CONTEXT.md`
- Regenerate: `apps/landing/src/data/docs/**`

- [ ] Update `your-memory-and-relationships-guide.md` with:

```markdown
## Re-warming is optional

When Karmyq says a bond is nearly forgotten, it is not a warning that you did something wrong. It means
the relationship has been quiet long enough that the platform is close to letting it leave active
memory. You can reconnect if the bond still matters, or you can let it fade.
```

- [ ] Update `designed-to-forget.md` with:

```markdown
## Memory, not scorekeeping

Karmyq keeps enough memory for trust to stay honest: that care happened, who showed up, and which bonds
are still alive. It does not need to keep every private detail forever, and it should not turn care into
a productivity ledger.
```

- [ ] Update `community-home.md` to describe the new helped-row copy:

```markdown
The pulse says how many neighbours showed up for one another. The count is still real and distinct; the
language is softer because it is evidence of community life, not a scoreboard.
```

- [ ] Update `reading-the-trust-graph.md` with:

```markdown
## Fading bonds

Some lines look softer because Karmyq weights recent, tended relationships more than old ones. A fading
bond is still present. A nearly forgotten bond is close to leaving active memory; you may reconnect, or
let it fade.
```

- [ ] Update onboarding `feed` workflow copy to mention Profile memory and community graph memory in the
same terms.

- [ ] Add a Sprint 102 section to `apps/frontend/CONTEXT.md` summarizing:
  - Profile memory is independent of karma visibility.
  - Community graph includes memory legend.
  - Re-warm copy is optional/gentle.
  - Community pulse says "showed up for one another."

- [ ] Regenerate landing docs.

```bash
npm run generate:docs
```

If the repo uses a different script name, inspect `package.json` and use the existing docs generation
script. Do not hand-edit generated JSON when the source markdown can generate it.

- [ ] Verify generated docs/nav.

```bash
rg -n "showed up for one another|Re-warming is optional|Memory, not scorekeeping|Fading bonds" docs apps/landing/src/data/docs
rg -n "Designed to Forget|The Community Home|Reading the Trust Graph|Your Memory & Relationships" apps/landing/src/data/docs/nav.json
```

Expected: all terms found; nav entries still present.

---

## Task 10: CONTEXT, Registry, and API Contract Check

**Files:**
- Modify if needed: `services/registry.json`
- Modify if needed: `services/social-graph-service/CONTEXT.md`
- Modify if needed: `services/request-service/CONTEXT.md`

- [ ] Confirm no API contract changed.

```bash
git diff -- apps/frontend/src/lib/api.ts services/social-graph-service/src services/request-service/src services/registry.json
```

Expected: no endpoint or API wrapper changes. If no API changed, do not edit `services/registry.json`.

- [ ] Confirm frontend context was updated.

```bash
rg -n "Sprint 102|showed up for one another|Profile memory" apps/frontend/CONTEXT.md
```

Expected: Sprint 102 section exists.

- [ ] If implementation unexpectedly changed an endpoint, update:
  - affected service `CONTEXT.md`
  - `services/registry.json`
  - landing service JSON
  - tests for the changed contract

Expected for the planned sprint: this step is not needed because there are no API changes.

---

## Task 11: Focused Frontend Verification

**Files:**
- Test: `apps/frontend/tests/tdd/sprint-102-visible-memory.test.tsx`
- Test: `apps/frontend/tests/tdd/sprint-102-community-memory-copy.test.tsx`
- Test: `apps/frontend/tests/tdd/sprint-89-community-page-ia.test.tsx`

- [ ] Run Sprint 102 TDD suites.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-102-visible-memory.test.tsx tests/tdd/sprint-102-community-memory-copy.test.tsx --runInBand
```

Expected: pass.

- [ ] Run related regressions.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-89-community-page-ia.test.tsx --runInBand
```

Expected: pass.

- [ ] Run frontend type check.

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: clean.

- [ ] Run root TypeScript check if the repo supports it.

```bash
npx tsc --noEmit
```

Expected: clean or same known pre-existing warnings only. Document any pre-existing failures with exact
test names and proof from `master`.

---

## Task 12: SDLC Quality Gates

**Files:**
- Review: full branch diff

- [ ] Testing gate: run unit/regression.

```bash
npm test
```

Expected: unit + regression pass. If unrelated TDD failures appear, verify they already fail on `master`
before documenting as pre-existing.

- [ ] TDD gate: run TDD tests.

```bash
npm run test:tdd
```

Expected: Sprint 102 TDD passes. Existing unrelated TDD failures may remain only if documented and
confirmed on `master`.

- [ ] Feedback loop check.

```bash
npm run feedback:check
```

Expected: pass.

- [ ] Security dependency gate.

```bash
npm audit --package-lock-only --audit-level=high
```

Expected: no high/critical vulnerabilities. Moderate advisories are within ADR-059 SLA unless new or
older than SLA.

- [ ] `/simplify` on the branch diff.

Verification: record findings in PR body. Resolve duplication, copy sprawl, and unnecessary styling
abstractions.

- [ ] `/code-review` on the branch diff.

Verification: record findings in PR body. Resolve correctness findings before merge.

- [ ] `/security-review` on the branch diff.

Verification: record findings in PR body. Confirm no PII is exposed in memory surfaces and no new
cross-community data fetch is added.

---

## Task 13: Final Pre-push Verification

**Files:**
- Review: full branch diff

- [ ] Check status and diff.

```bash
git status --short
git diff --stat
```

Expected: only Sprint 102 files are changed; pre-existing `docs/BUGS.md` is not staged unless explicitly
part of the sprint.

- [ ] Run final root verification.

```bash
npm test
npm run feedback:check
npm audit --package-lock-only --audit-level=high
```

Expected: all required gates pass.

- [ ] Stage implementation and docs, including generated landing docs.

```bash
git add apps/frontend/src/components/profile/MemorySection.tsx apps/frontend/src/pages/profile.tsx apps/frontend/src/components/community/tabs/TrustGraphTab.tsx apps/frontend/src/components/relationships/ReWarmingNudge.tsx apps/frontend/src/components/community/CommunityPulse.tsx apps/frontend/src/styles/karmyq-shell.css apps/frontend/tests/tdd/sprint-102-visible-memory.test.tsx apps/frontend/tests/tdd/sprint-102-community-memory-copy.test.tsx docs/guides/your-memory-and-relationships-guide.md docs/concepts/designed-to-forget.md docs/concepts/community-home.md docs/concepts/reading-the-trust-graph.md apps/frontend/src/lib/onboarding/workflows.ts apps/frontend/CONTEXT.md
git add -f apps/landing/src/data/docs
```

- [ ] Confirm `docs/BUGS.md` is not staged unless intentionally changed by the implementer.

```bash
git diff --cached --name-only
```

Expected: no unrelated files.

- [ ] Commit.

```bash
git commit -m "Sprint 102: visible memory and re-warm first step"
```

---

## Task 14: Merge + Deploy

**Files:**
- Read: `.github/pull_request_template.md`

- [ ] Push branch.

```bash
git push -u origin feature/sprint-102-visible-memory-rewarm
```

- [ ] Create PR with the full PR template body. `gh pr create` does not auto-apply the template.

```bash
gh pr create --base master --head feature/sprint-102-visible-memory-rewarm --title "Sprint 102: Visible Memory + Re-warm First Step" --body-file .github/pull_request_template.md
```

- [ ] Fill every required PR contract section:
  - Summary
  - Tests
  - Docs
  - Security dismissals, if any
  - Manual validation checklist

- [ ] Wait for required CI checks.

```bash
gh pr checks --watch
```

- [ ] Do not self-merge. Admin/Claude owns merge authority per repo process.

- [ ] After Admin authorizes merge/deploy, use the `/deploy` skill and monitor GitHub Actions deploy.

---

## Sprint 102 - Post-Deploy Validation (Human Checklist)

### 1. Profile memory smoke test (2 min)

Login as:

```text
maria.reyes@test.karmyq.com / password123
```

Open `https://karmyq.com/profile`.

Expected: memory section appears for a selected community even if karma display is hidden; fading and
nearly-forgotten states have readable text; `/about/memory` link works.

### 2. Community trust smoke test (2 min)

Open one of Maria's communities, then **How we're connected**.

Expected: graph area shows "How memory fades" legend; any re-warm nudge is gentle and optional; graph
still renders.

### 3. Community pulse copy check (1 min)

Open a community Home with weekly help activity.

Expected: helped row says "N neighbours showed up for one another"; zero helped rows remain hidden;
open asks row still links to `/communities/:id/open-asks`.

### 4. Retention transparency check (1 min)

Open `https://karmyq.com/about/memory`.

Expected: retention windows load; page still says private details are anonymized/deleted while aggregates
are kept.
