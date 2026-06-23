# Belonging Graph System — Reference-Product Study (Sprint 110)

**Date**: 2026-06-22  
**Sprint**: 110 (research only)  
**Purpose**: Concrete lessons from mature products that present a personal/relationship graph
prominently and interactively — each distilled into 2–3 "steal this" lessons mapped to a
specific Karmyq surface and a candidate S111 task.

---

## Why This Study

Karmyq's graphs exist but underdeliver. The audit showed a dead `/network` route, two visual idioms,
and a graph that lives in a secondary card. Before designing the S111 solution, this study answers:
"What do great products do when they make a graph feel like it matters?" The lessons below drive the
decision points in ADR-081.

---

## Reference 1: Obsidian / Roam Graph View

**What to study**: Full-canvas force-graph as a first-class page. Hover highlights a node's
neighborhood; the rest fades. Zoom-to-fit on load. Depth filter ("show connections up to N hops").
The graph is navigable — clicking a node navigates to that note — not just display.

### Lessons for Karmyq

**Lesson 1.1 — Full-bleed, zoomable explorer as the primary home**  
Obsidian's graph lives on its own full-canvas page, not a side panel. Contrast with Karmyq's widget
(a `bg-slate-800/50 rounded-xl p-5` card that shares vertical real estate with three other widgets).
The `/network` explorer (D4 in ADR-081) should be **full-bleed**: no surrounding card padding, no
competing sidebar, SVG fills the viewport. `useLazyGraphData` already defers the heavy D3 until the
container is visible — on a full-canvas page that means the graph fires immediately on route entry.  
→ **Surface**: Dashboard widget → full-page explorer redirect; `/network` page  
→ **S111 task**: Build `/network` page with full-bleed SVG container, zoom/pan controls, and
   "depth" slider (1–3 hops) using the existing `socialGraphClient.getTrustGraphAggregate()` endpoint.

**Lesson 1.2 — Neighborhood highlight on hover (focus + fade)**  
Hover over a node in Obsidian and unrelated nodes fade to near-invisible; the hovered node's
neighborhood snaps to full opacity. This pattern is already partially in `TrustGraphHEB.tsx` (node
selection → detail panel) but it is click-only and shows a panel, not a canvas-level fade.
Hover-to-highlight on the full-page explorer would make the network scannable — "how do I connect
to this person" is legible without clicking.  
→ **Surface**: `/network` explorer, Community TrustGraphTab  
→ **S111 task**: Add `mouseover`/`mouseout` handlers to `TrustGraphHEB` that set an `activeNodeId`
   state; reduce `opacity` of all non-neighbor paths to 0.15 on hover.

**Lesson 1.3 — Zoom-to-fit + "local graph" (ego view) as the default**  
Obsidian's global graph is useful but overwhelming on large vaults; local graph (just the current
note's neighborhood) is the default. For Karmyq, the ego graph is the "local graph" — the right
default on dashboard and profile because it centers the viewer. The community graph is the "global
graph" and belongs on the community tab and the `/network` explorer's community mode. The
dashboard/profile should land on `mode="ego"` and invite deeper exploration via "View full →".  
→ **Surface**: Dashboard widget, Profile  
→ **S111 task**: Default dashboard and profile widget to `mode="ego"`; "View full →" links to
   `/network?mode=ego` and lets the user switch to community or communities-of-communities view.

---

## Reference 2: LinkedIn "My Network" / Connection Degrees

**What to study**: 1st / 2nd / 3rd-degree framing: "You and Alice have 3 mutual connections." The
"how you're connected" path is surfaced inline (not behind a click) as a short prose sentence. The
path is *narrative*, not just a chip.

### Lessons for Karmyq

**Lesson 2.1 — Make the trust path a story, not a chip**  
`TrustPathBadge` currently renders a compact chip showing degree count and a short path string.
LinkedIn phrases it: "You → Bob → Alice (2 degrees)." A short narrative — "You helped Bob, Bob
helped Alice" — uses Karmyq's actual karma vocabulary and is far more emotionally resonant than
"2°".  
→ **Surface**: Inline TrustPathBadge (RequestCard, OfferItem, DibsPrompt, providers/[id])  
→ **S111 task**: Add a `narrative` prop to `TrustPathBadge`; when `narrative=true`, render
   "You → {path[1].name} → {path[n].name}" inline instead of the compact chip. Use on the
   `/network` node detail panel and on profile.

**Lesson 2.2 — "How you're connected" in the node detail panel**  
On LinkedIn, visiting someone's profile shows "You're connected" or "You and Sarah have 12 mutual
connections." On Karmyq, clicking a node in the HEB shows a detail panel (post-S79 behavior)
that could display the trust path from the current user to that node — powered by the existing
`useTrustPath` hook. This transforms the static panel into a micro-story.  
→ **Surface**: Community TrustGraphTab node detail panel, `/network` explorer node detail  
→ **S111 task**: In `TrustGraphHEB`'s node detail panel, render `<TrustPathBadge targetUserId={selectedNode.id} narrative />`.

**Lesson 2.3 — Degree rings as a visual encoding layer**  
LinkedIn's connection list uses ring color to encode degree (1st = solid blue, 2nd = gray ring,
3rd = dotted). In `TrustGraphHEB`, the `decayTier` already fades edges (ADR-070). Layering
degree-of-separation onto node border style (solid ring for direct connection, dashed for 2-hop,
faint for 3-hop) would give the graph a second readable dimension. This is a polish layer, not
structural.  
→ **Surface**: Community TrustGraphTab, `/network` explorer  
→ **S111 task** (stretch): Add `degrees_of_separation` field to `TrustNode` from the backend
   and encode it as node border style in `TrustGraphHEB` (solid / dashed / dotted ring).

---

## Reference 3: Are.na / Kumu / Nodus Relationship Maps

**What to study**: Progressive click-to-expand — clicking a node grows the visible neighborhood
inline ("ego → ego+1-hop"). Clustering: semantically related nodes are pulled together, isolated
clusters are visually distinct. Node detail appears without leaving the canvas (a floating card,
not a sidebar shift).

### Lessons for Karmyq (and the S79 answer)

**Lesson 3.1 — Scope expand to the full-page explorer only (why S79 removal was correct, and how to un-do it safely)**  
Sprint 79 removed progressive expand. Based on the code comment in `NetworkGraph.tsx:L36-40`
("Progressive click-to-expand was removed in Sprint 79; the HEB component owns node selection and
its own detail panel"), the likely reason was **layout instability** on the small dashboard card:
a D3 HEB recomputes its entire radial layout when nodes are added (the cluster() tree is
recalculated from scratch), causing jarring re-renders in a 360px card.

The safe re-introduction is to **scope expand to the `/network` full-page explorer only** — the
canvas is large enough for layout transitions to be smooth, and the user is in an exploration
context (they navigated there). On the dashboard card and profile widget, keep the current
static HEB (click → panel, not click → expand). This answers S79: the card context was wrong for
expand; the full-page context is right.

Design specifics to avoid S79's failure:
- **Capped growth**: click-to-expand fetches only the clicked node's 1-hop neighborhood, not the
  full graph. The `socialGraphClient.getTrustPath` result already contains path nodes; a new
  endpoint `GET /graph/neighborhood/:userId` (S111 backend task) returns the 1-hop set.
- **Smooth layout transitions**: D3's `.transition().duration(400)` on the cluster recomputation
  softens the radial re-layout. Are.na does this with a spring simulation; HEB can do it with
  tween interpolation on the bezier control points.
- **"Collapse" affordance**: right-click or a ✕ on the expanded node collapses back to the ego
  graph, preventing unbounded growth.

→ **Surface**: `/network` explorer only (not dashboard card, not profile widget)  
→ **S111 tasks**:
  1. Add `GET /graph/neighborhood/:userId` to social-graph-service (S111 backend item)
  2. Add expand state (`expandedNodes: Set<string>`) to the `/network` page
  3. In `TrustGraphHEB`, add `onNodeExpand` prop; on click-to-expand, merge neighborhood into
     `graphData` and re-run the cluster layout with a transition

**Lesson 3.2 — Canvas-level node detail (floating card, not sidebar shift)**  
Are.na shows a node's detail in a small floating card anchored to the node — the canvas does not
shift. Karmyq's current HEB shows a static panel below the graph (or an overlay), which forces
the graph to shrink. On the `/network` full-page explorer a floating `<div>` positioned near the
clicked node's SVG coordinates (`d.x`, `d.y` converted from polar to cartesian) would keep the
canvas intact and the detail visible simultaneously.  
→ **Surface**: `/network` explorer  
→ **S111 task**: Render node detail as an absolutely-positioned floating card inside the SVG
   container div; close on canvas click-outside.

---

## Reference 4: GitHub Contribution Graph / Spotify Wrapped

**What to study**: Making personal data feel like *identity* — warm, narrative, celebratory. GitHub
contributions are just a count, but the heatmap calendar makes "your coding presence" visible and
personal. Spotify Wrapped is transient data (listens) turned into an identity story ("You were in
your jazz era").

### Lessons for Karmyq

**Lesson 4.1 — Profile belonging graph as a "this is your weave" headline**  
Profile today reuses the dashboard widget (`pages/profile.tsx:L842`). GitHub and Spotify both give
personal-activity data a dedicated, prominent visual treatment on the profile/overview page —
it is not a sidebar or a widget; it is the first thing you see about this person. For Karmyq,
the belonging graph on profile should be a distinct section with a headline ("How you're woven
into Karmyq"), a larger canvas, and some warm narrative language — not a reused widget card.  
→ **Surface**: Profile page  
→ **S111 task**: Add a `<BelongingSection>` to `pages/profile.tsx` above the fold (or as the
   second section after the karma summary). Render the ego graph at `height=480` (vs the current
   360), add a prose subheading ("You're connected to N people across M communities"), link to
   `/network` for exploration.

**Lesson 4.2 — Belonging pulse: one key "your weave" number**  
Spotify Wrapped leads with one number ("You spent 47 minutes in jazz"). Karmyq can lead with:
"You've helped N people across M communities" — a compound stat that captures both the karma
dimension (helped) and the graph dimension (communities). This number already exists in the DB
(karma records + community memberships); surfacing it at the top of the profile graph section
makes the graph's data legible before the user looks at the nodes.  
→ **Surface**: Profile page, possibly Dashboard  
→ **S111 task**: Add a `BelongingPulse` component (query: count distinct `karma_awarded_to` in
   `reputation.karma_records` + count `community.members` for this user) rendered as a stat line
   above the profile graph.

---

## Reference 5: D3 Hierarchical Edge Bundling Galleries

**What to study**: Best-in-class HEB interaction — focus/fade, radial label legibility at many
nodes, smooth transitions between graph modes, the "tension" parameter (how bundled the curves are).

### Lessons for Karmyq

**Lesson 5.1 — Tension parameter as a "belonging density" dial**  
D3 HEB has a `tension` value on the bundle generator (0 = straight lines, 1 = fully bundled).
High tension makes the graph look more "webby" and dense; low tension looks more like a force
layout. Exposing this as a UI control ("Compact / Spread") on the explorer gives power users a
way to see both density (high tension) and individual paths (low tension) without switching idioms.  
→ **Surface**: `/network` explorer  
→ **S111 task** (stretch): Add a "Compact / Spread" toggle that tweens the HEB tension between
   0.85 (current compact) and 0.3 (spread). One line of D3 code.

**Lesson 5.2 — Radial label legibility at 30+ nodes**  
D3 HEB galleries typically render 30–100 nodes; at that scale label overlap is a solved problem
(rotate labels to be tangent to the circle; truncate long names; show full name on hover tooltip).
`TrustGraphHEB.tsx` already rotates and truncates labels, but the hover tooltip is a detail panel,
not an in-place overlay. Adding a `<title>` element on each `<text>` gives the browser a native
tooltip with zero JS, and is a safe fallback.  
→ **Surface**: All HEB views (Community TrustGraphTab, `/network`, dashboard widget)  
→ **S111 task**: Add `<title>{node.name}</title>` inside the D3 `text` selection in
   `TrustGraphHEB.tsx`; no layout change, browser handles overflow text.

**Lesson 5.3 — Mode-transition animation (ego ↔ community ↔ fission)**  
The best HEB galleries use a cross-fade or arc-tween when switching datasets — nodes that persist
between modes stay anchored; new nodes fade in. `TrustNetworkWidget` does a hard swap (People
button → `<NetworkGraph>` unmounts; Communities → `<CommunityDepthGraph>` mounts). A shared
`<BelongingGraph mode>` wrapper (D3) makes this trivial: re-bind data, re-run cluster, tween.  
→ **Surface**: Dashboard widget, `/network` explorer  
→ **S111 task**: The `<BelongingGraph>` consolidation (D3 in ADR-081) naturally enables this;
   add a `.transition().duration(300)` when the mode prop changes.

---

## The S79 Answer (summary)

Sprint 79 removed progressive click-to-expand. The most likely reason (inferred from the code comment
and the dashboard card's 360px height) is **layout instability on the small card canvas**: a D3 HEB
recomputes its entire radial cluster when nodes are added, causing jarring re-renders in a constrained
card. The fix is not to add expand back to the card — it is to **build a full-canvas explorer at
`/network`** where layout transitions are smooth, growth is bounded (1-hop at a time, with collapse),
and the user is in an explicit exploration context. The dashboard and profile widgets remain static
(click → panel), and "View full →" becomes the invitation to explore. See ADR-081 D5.
