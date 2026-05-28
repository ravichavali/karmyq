# v10.0 Polish + karmyq.org Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the ego-network and fission graph UX, update karmyq.org with community lifecycle narrative, and ship v10.0.

**Architecture:** No new services, no schema changes, no new API endpoints. All changes are in `apps/frontend/src/components/TrustGraph.tsx`, `apps/frontend/src/components/community/tabs/FissionTab.tsx` (verification only — may not need changes), and `apps/landing/src/components/sections/HowItWorks.tsx`. Version bump in root `package.json`.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/components/TrustGraph.tsx` | Pin ego-network user at center; add x-force for fission bipartite layout |
| `apps/landing/src/components/sections/HowItWorks.tsx` | Add community lifecycle paragraphs to "How communities govern themselves" |
| `docs/guides/trust-graph.md` | Note ego-network anchor + fission group assignment view |
| `apps/landing/src/data/docs/guides/trust-graph.json` | Sync content with trust-graph.md |
| `package.json` (root) | Bump version 9.50.0 → 10.0.0 |

### No new files needed

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **`fx`/`fy` must go in the `fgData` useMemo** — not in raw `graphData.nodes`. The useMemo produces the copy react-force-graph-2d owns.

2. **`fgRef` for fission x-force**: Ref passed as `ref={fgRef}`. `fgRef.current.d3Force(...)` only callable post-mount. Guard with `if (!fgRef.current) return`.

3. **`d3ReheatSimulation()` after adding x-force**: Adding a force doesn't restart simulation. Must call `fgRef.current.d3ReheatSimulation()`.

4. **Custom force without d3 import**: A d3 force is just `(alpha) => { nodes.forEach(n => { n.vx += (target(n) - n.x) * strength * alpha }) }`. Use inline function — do not import d3 directly.

5. **`warmupTicks={120} cooldownTicks={50}`**: Fast initial settle, animation stops quickly.

6. **Landing page `git add -f`**: `apps/landing/src/data/docs/` is in `.gitignore`. Always `git add -f` for files in that path.

7. **ADR status already done**: ADR-057 and ADR-058 are both `implemented`. No ADR work this sprint.

8. **nav.json**: No nav changes needed (trust-graph.json already present). But always grep-verify after any docs build.

---

## Task 1: Feature branch + smoke-test

**Files:** none modified

- [ ] **Create feature branch**

```bash
git checkout -b feature/sprint-71-v10-polish
```

- [ ] **Smoke-test fission flow on karmyq.com**

Navigate to karmyq.com → any community with an active fission proposal (or create one via admin) → FissionTab. Verify:
- Graph renders with blue/orange groups visible
- Clicking a node shows the info panel
- "Move to Group B/A" button works
- Graph **does** show groups as visually separated after Sprint 71 (this verifies Task 3 worked)

- [ ] **Smoke-test fusion flow on karmyq.com**

Navigate to karmyq.com → any community → FusionTab. Verify:
- Proposal creation form opens for admins
- Proposal status shows correctly (pending / discussion / voting)
- Vote buttons appear when voting is open

- [ ] **Smoke-test trust graph ego-network**

Navigate to karmyq.com → any community → Trust Graph tab. Verify:
- Current user node is at center after Sprint 71 (verifies Task 2)
- Clicking a neighbor to expand works
- Empty state shows for communities with no interactions

Document any gaps found in a comment here before proceeding.

---

## Task 2: Ego-network layout — pin current user at center

**Files:**
- Modify: `apps/frontend/src/components/TrustGraph.tsx`

- [ ] **Read the file before editing**

Read `apps/frontend/src/components/TrustGraph.tsx` lines 76–79 (the `fgData` useMemo).

- [ ] **Pin current user node at origin in the useMemo**

Change the useMemo so the current user node gets `fx: 0, fy: 0`:

```tsx
const fgData = useMemo(() => ({
  nodes: graphData.nodes.map(n => ({
    ...n,
    ...(n.id === currentUserId ? { fx: 0, fy: 0 } : {}),
  })),
  links: graphData.links.map(l => ({ ...l })),
}), [graphData, currentUserId])
```

(The existing useMemo excludes `currentUserId` from deps to avoid simulation restarts. Add it — pinning depends on the user ID.)

- [ ] **Add `warmupTicks` and tune `cooldownTicks` on the ForceGraph**

Find the `<ForceGraph` JSX (around line 129). Add:
```tsx
warmupTicks={120}
cooldownTicks={50}
```
Remove the existing `cooldownTicks={100}` if present.

- [ ] **Verify the prop change doesn't break non-ego mode**

In fission mode (`groupMap` defined), the current user node should also be pinned (fine — admin is still a member). No exclusion needed.

- [ ] **Verification**

```bash
cd apps/frontend && npx tsc --noEmit
```
Must have zero new errors.

---

## Task 3: Fission bipartite layout — x-force to separate groups

**Files:**
- Modify: `apps/frontend/src/components/TrustGraph.tsx`

- [ ] **Add a ref for the ForceGraph instance**

At the top of the component, add:
```tsx
const fgRef = useRef<any>(null)
```

- [ ] **Wire the ref to the ForceGraph JSX**

Add `ref={fgRef}` to the `<ForceGraph` element. Existing props are unchanged.

- [ ] **Add a useEffect that applies x-force when in fission mode**

After the existing `useEffect` hooks, add:

```tsx
useEffect(() => {
  if (!fgRef.current || !groupMap) return
  const fg = fgRef.current

  // Custom x-positioning force: attract nodes toward their group column
  const xForce = (alpha: number) => {
    const data = fg.graphData()
    if (!data?.nodes) return
    data.nodes.forEach((node: any) => {
      const group = groupMap[node.id]
      const targetX = group === 'group_a'
        ? graphWidth * 0.28
        : group === 'group_b'
        ? graphWidth * 0.72
        : graphWidth * 0.5

      node.vx = (node.vx ?? 0) + (targetX - (node.x ?? 0)) * 0.4 * alpha
    })
  }

  fg.d3Force('x-group', xForce)
  fg.d3ReheatSimulation()
}, [graphData, groupMap, graphWidth])
```

Note: We name the force `'x-group'` (not `'x'`) to avoid overwriting d3's built-in centering x-force.

- [ ] **Verification**

```bash
cd apps/frontend && npx tsc --noEmit
```
Zero new errors.

---

## Task 4: Landing page — community lifecycle narrative

**Files:**
- Modify: `apps/landing/src/components/sections/HowItWorks.tsx`

- [ ] **Read the current "How communities govern themselves" section**

Read `apps/landing/src/components/sections/HowItWorks.tsx` lines 109–135 (the governance section).

- [ ] **Add community lifecycle paragraphs after the existing two paragraphs**

Immediately before the closing `</AnimateOnScroll>` of the governance section's last animated block, add:

```tsx
<AnimateOnScroll delay={0.2}>
  <div className="space-y-5 body-large mt-8">
    <p>
      As a community grows, the platform watches. When membership approaches the
      Dunbar threshold — the cognitive limit above which genuine relationship becomes
      difficult — a size alert appears for admins. No automatic action. Just a signal
      that the community might be ready to evolve.
    </p>
    <p>
      Communities that choose to split do so through a governed process: an admin
      proposes two child communities, the trust graph suggests which members belong
      together based on their actual interaction history, and members vote with
      weights proportional to their standing. The algorithm offers a starting point.
      The community decides.
    </p>
    <p>
      The reverse is also possible. Two communities that have grown closer — through
      shared members, inter-community trust, or aligned purpose — can choose to merge.
      Both sets of admins propose, both communities vote in parallel, and the merge
      executes atomically if both pass. The platform calls this fusion. Communities
      call it becoming one thing.
    </p>
  </div>
</AnimateOnScroll>
```

- [ ] **Verify the landing page builds**

```bash
cd apps/landing && npm run build 2>&1 | tail -20
```
Must succeed with no type errors.

---

## Task 5: Version bump

**Files:**
- Modify: `package.json` (root)

- [ ] **Read the root package.json version line**

- [ ] **Bump version to 10.0.0**

Change `"version": "9.50.0"` to `"version": "10.0.0"`.

- [ ] **Verify**

```bash
node -e "console.log(require('./package.json').version)"
```
Must print `10.0.0`.

---

## Task 6: User guide updates

**Files:**
- Modify: `docs/guides/trust-graph.md`
- Modify: `apps/landing/src/data/docs/guides/trust-graph.json`

- [ ] **Read docs/guides/trust-graph.md**

- [ ] **Add ego-network anchor note**

After the "Reading the Graph" section (or the "Nodes" subsection), add:

```markdown
### Your position

You are always at the center. The graph pins your node at the center of the canvas — your direct trust connections arrange themselves around you. If you have no trust connections yet, you'll see an empty-state message instead.
```

- [ ] **Add fission group assignment note**

At the end of the guide, add a new section:

```markdown
## Fission Group Assignment View

When your community has an active fission proposal, the Trust Graph tab switches to a group assignment view. Members are color-coded by their proposed group (blue = Group A, orange = Group B, gray = unassigned) and the layout places the two groups in opposite halves of the canvas. Click any member to see their trust connections and, if you're an admin, move them between groups.
```

- [ ] **Sync landing page JSON**

Read `apps/landing/src/data/docs/guides/trust-graph.json`. Update its `content` field to match the full updated Markdown from `docs/guides/trust-graph.md`.

- [ ] **Force-add landing docs file**

```bash
git add -f apps/landing/src/data/docs/guides/trust-graph.json
```

---

## Task 7: TDD integration test

**Files:**
- Create: `services/community-service/tests/tdd/sprint-71-v10-polish.test.ts`

- [ ] **Write tests verifying the polish does not regress existing behavior**

```typescript
// sprint-71-v10-polish.test.ts
// Verifies that sprint-71 changes don't regress community lifecycle behavior.
// Frontend graph layout changes are visual — tested via smoke-test (Task 1).
// This file covers the package version bump and any backend-side invariants.

import { describe, it, expect } from 'vitest'

describe('Sprint 71 — v10.0 polish invariants', () => {
  describe('version', () => {
    it('root package.json is 10.0.0', async () => {
      const pkg = await import('../../../../package.json', { assert: { type: 'json' } })
      expect(pkg.default.version).toBe('10.0.0')
    })
  })

  describe('fission status (smoke invariants)', () => {
    it('group colors are defined for both groups', () => {
      // These are the hex values used in TrustGraph.tsx nodeColor()
      // If they change, the legend copy must change too.
      const GROUP_A_COLOR = '#3b82f6'  // blue-500
      const GROUP_B_COLOR = '#f97316'  // orange-500
      expect(GROUP_A_COLOR).toMatch(/^#[0-9a-f]{6}$/)
      expect(GROUP_B_COLOR).toMatch(/^#[0-9a-f]{6}$/)
    })

    it('x-force targets are within canvas bounds', () => {
      const graphWidth = 700  // default
      const groupATarget = graphWidth * 0.28
      const groupBTarget = graphWidth * 0.72
      expect(groupATarget).toBeLessThan(graphWidth * 0.5)
      expect(groupBTarget).toBeGreaterThan(graphWidth * 0.5)
      expect(groupATarget).toBeGreaterThan(0)
      expect(groupBTarget).toBeLessThan(graphWidth)
    })
  })
})
```

- [ ] **Run TDD tests**

```bash
npm run test:tdd 2>&1 | tail -20
```

---

## Task 8: CONTEXT.md + registry verification

**Files:**
- No modifications needed (no new endpoints or events)

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

If it fails, read the output and make the required documentation updates before continuing.

- [ ] **Verify no registry changes needed**

No new endpoints were added. `services/registry.json` does not need updating.

---

## Task 9: Final type check + pre-push verification

**Files:** none

- [ ] **Full type check — frontend**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Full type check — landing**

```bash
cd apps/landing && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Run unit + regression tests**

```bash
npm test 2>&1 | tail -30
```
Must pass.

- [ ] **Run TDD tests**

```bash
npm run test:tdd 2>&1 | tail -20
```
Must pass (or pre-existing failures only — see handoff for known failures).

- [ ] **Run feedback check**

```bash
npm run feedback:check
```

- [ ] **Confirm version**

```bash
node -e "console.log(require('./package.json').version)"
```
Must print `10.0.0`.

---

## Task 10: Update handoff

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] **Mark Sprint 71 complete**

Update the handoff to reflect Sprint 71 shipped. Set the Trust Network Arc to complete. Add next sprint candidates (if any) or note that v10.0 is the capstone and the next sprint direction is TBD.

---

## Task 11: Merge + Deploy

- [ ] **Run `/deploy` skill** (uses GitHub Actions CI/CD)

```bash
git add -A
git commit -m "feat(polish): Sprint 71 — v10.0 polish, ego-network anchor, fission bipartite layout, karmyq.org update"
git push origin feature/sprint-71-v10-polish
```

Then merge to master and push. GitHub Actions handles the deploy.

If migration scripts are needed (none this sprint), SSH to karmyq.com and run them manually first.

- [ ] **Monitor GitHub Actions**

Watch the deploy workflow. Verify all stages pass. Confirm karmyq.com health check green.

- [ ] **Post-deploy smoke test**

Repeat Task 1's checklist on the live karmyq.com after deploy. Confirm ego-network pins user at center and fission graph separates groups visually.
