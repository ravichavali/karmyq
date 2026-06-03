# Unified Feed & Dashboard Redesign — Research & Direction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

> **Sprint tag: `no-deploy`.** The deliverable is a design-direction document plus throwaway
> HTML/Tailwind mockups. There is NO production code, NO schema/API change, and NO deploy step.
> The "build" gates below are adapted accordingly — there is no unit test on a research doc.

**Goal:** Produce a purpose-driven, research-backed design direction for a single unified feed
system spanning the dashboard home and the community feed, delivered as a markdown doc + browser-
viewable HTML/Tailwind mockups, ready for Sprint 85 to implement.

**Architecture:** New artifacts live under `docs/design/sprint-84-unified-feed/` — a `README.md`
direction doc and standalone `mockups/*.html`. Nothing is added to the Next.js app; existing feed
components are read for the audit, never modified.

**Tech Stack:** Markdown (deliverable), static HTML + Tailwind via CDN (mockups). No app build,
no Node services touched.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/design/sprint-84-unified-feed/README.md` | The design-direction document (audit → inventory → references → principles → unified IA → Sprint 85 recommendations) |
| `docs/design/sprint-84-unified-feed/mockups/dashboard-home.html` | Throwaway mockup of the redesigned dashboard-home feed |
| `docs/design/sprint-84-unified-feed/mockups/community-feed.html` | Throwaway mockup of the redesigned community feed |
| `docs/design/sprint-84-unified-feed/mockups/index.html` | Simple index linking the mockups (+ optional before/after framing) |

### Existing files to modify
| File | Change |
|------|--------|
| `.claude/handoff/CURRENT_HANDOFF.md` | Update to reflect Sprint 84 in progress / complete |
| `docs/IDEAS.md` | Mark the [2026-05-20] feed framing idea as being addressed by Sprint 84 (light cross-link, optional) |

**Read-only (audit sources — do NOT modify):**
`apps/frontend/src/pages/dashboard.tsx`, `components/BrowseFeed.tsx`, `components/BrowseModeControl.tsx`,
`components/community/tabs/BrowseTab.tsx`, `components/Feed/Feed.tsx`, `components/Feed/FeedItem.tsx`,
`components/Feed/RequestPayloadRenderer.tsx`, `components/FeedFilterPanel.tsx`, `components/TabBar.tsx`,
`components/CommitmentsTab.tsx`, `components/MyRequestsTab.tsx`, `components/dashboard/TrustNetworkWidget.tsx`,
`components/ProviderDashboardCard.tsx`, `types/feed-items.ts`.

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Deliverable is a document, not code.** Do not write production feed components. Drift toward
   editing `apps/frontend/src/components/` means stop — that's Sprint 85.
2. **Mockups are throwaway.** Standalone HTML + Tailwind CDN under
   `docs/design/sprint-84-unified-feed/mockups/`. Do not wire into the Next.js build, do not add
   to `apps/frontend`, do not import app components.
3. **Design backward from the job** — "connect need with help inside a community of trust." Every
   recommendation traces to it; reject borrowed social-feed patterns unless re-justified.
4. **Audit before inventing.** Read all three current feed surfaces before proposing the unified
   model — documenting their duplication is the point.
5. **No schema/API/endpoint changes.** Missing data the redesign wants → log as a Sprint 85
   recommendation, don't build it.
6. **Unify, don't add a fourth surface.** Output is ONE feed model in two views.
7. **`docs/design/` is not gitignored** (only `apps/landing/src/data/docs/` is) — normal
   `git add` works.

---

## Task 1: Feature branch + deliverable scaffold

**Files:**
- Create: `docs/design/sprint-84-unified-feed/README.md` (skeleton with section headers only)

- [ ] Create the branch

```bash
git checkout master && git pull
git checkout -b feature/sprint-84-unified-feed-redesign-research
```

- [ ] Scaffold the direction doc with empty sections: Overview/Job, Audit, Data & Action
  Inventory, Reference Study, Principles, Unified Information Architecture, Mockups, Open
  Questions & Sprint 85 Recommendations.

- [ ] Verify scaffold exists

```bash
test -f docs/design/sprint-84-unified-feed/README.md && echo OK
```

---

## Task 2: Audit the current feed/dashboard surfaces

**Files:**
- Modify: `docs/design/sprint-84-unified-feed/README.md` (fill Audit section)

- [ ] Read each read-only audit source. For each surface (dashboard `BrowseFeed`, community
  `BrowseTab`, `Feed/Feed.tsx`) document: what it renders, what data it fetches, what actions its
  cards expose, and how it overlaps/diverges from the others.

- [ ] Explicitly call out the duplication (three feeds of the same requests) and every borrowed
  social-media pattern (infinite scroll, engagement-first ordering, etc.) that doesn't serve the
  job.

- [ ] Verify the Audit section names all three surfaces and the tab shell

```bash
grep -iE "BrowseFeed|BrowseTab|Feed/Feed" docs/design/sprint-84-unified-feed/README.md
```

---

## Task 3: Catalog the real data + actions

**Files:**
- Modify: `docs/design/sprint-84-unified-feed/README.md` (fill Data & Action Inventory)

- [ ] From `types/feed-items.ts` and the components, list the actual request/match/offer/trust
  fields the cards consume and every action a card can trigger (accept offer, make offer, view
  request, withdraw, message, etc.).

- [ ] Note which existing endpoints feed each surface (catalog only — no API change). Flag any
  data the eventual redesign will want that doesn't exist yet as a **Sprint 85 recommendation**.

- [ ] `/simplify` is not applicable to a prose section; instead self-check the inventory is
  grounded in real code, not invented fields.

---

## Task 4: Reference study — fit-for-purpose feeds

**Files:**
- Modify: `docs/design/sprint-84-unified-feed/README.md` (fill Reference Study)

- [ ] Study 3–5 products that solved *purposeful* (non-engagement) feeds — task triage,
  mutual-aid/coordination boards, marketplace request queues, support/ticket inboxes. For each:
  what problem it solves and the specific pattern worth borrowing for Karmyq.

- [ ] Use WebSearch/WebFetch where helpful; cite sources inline. Tie each borrowed pattern back
  to the job-to-be-done.

---

## Task 5: Principles + Unified Information Architecture

**Files:**
- Modify: `docs/design/sprint-84-unified-feed/README.md` (fill Principles + Unified IA)

- [ ] Write the design principles, led by "design backward from the job" and the explicit
  rejection of infinite-scroll-for-its-own-sake. Include **action altitude** (decisions-needed
  foregrounded over passive browsing).

- [ ] Define the single unified feed model: the shared card vocabulary, the two views (dashboard
  home = all-my-communities/action-first; community feed = one-community scope), and how today's
  three surfaces collapse into it. Be explicit that this is ONE model in two views, not a fourth
  surface.

- [ ] Verify both sections are filled

```bash
grep -iE "action altitude|unified feed model|two views" docs/design/sprint-84-unified-feed/README.md
```

---

## Task 6: Build the throwaway HTML/Tailwind mockups

**Files:**
- Create: `docs/design/sprint-84-unified-feed/mockups/dashboard-home.html`
- Create: `docs/design/sprint-84-unified-feed/mockups/community-feed.html`
- Create: `docs/design/sprint-84-unified-feed/mockups/index.html`

- [ ] Build standalone mockups (Tailwind via CDN `<script src="https://cdn.tailwindcss.com">`),
  using realistic sample request/offer/trust content drawn from the Task 3 inventory. Render the
  unified card vocabulary and action altitude from Task 5.

- [ ] Build an `index.html` that links both mockups; optionally frame before/after vs the current
  surfaces.

- [ ] Cross-link the mockups from the README "Mockups" section.

- [ ] Verify the mockups open standalone (no app build, no imports)

```bash
ls docs/design/sprint-84-unified-feed/mockups/*.html
grep -L "from '@/" docs/design/sprint-84-unified-feed/mockups/*.html   # must list all files (no app imports)
```

---

## Task 7: Open questions + Sprint 85 recommendations

**Files:**
- Modify: `docs/design/sprint-84-unified-feed/README.md` (fill final section)
- Modify: `docs/IDEAS.md` (optional light cross-link on the [2026-05-20] framing idea)

- [ ] Write the Sprint 85 recommendations: suggested first vertical slice (likely dashboard
  home), build sequencing, the proposed ADR to write at implementation time, and any data/API
  implications surfaced during research.

- [ ] List open questions the research could not resolve (decisions for Sprint 85 planning).

---

## Task 8: Quality gates (adapted for a docs/mockup sprint)

> No production logic ⇒ no unit/regression/TDD tests apply. The standing gates adapt to:

- [ ] **Self-review the direction doc** for internal consistency: every recommendation traces to
  the job-to-be-done; the unified model is ONE model in two views; no invented data fields.

- [ ] **`/simplify`** on the diff — applies to the **mockup HTML** (dedupe markup, no dead
  styles, no copy-pasted bloat). Skip prose.

```bash
# /simplify on the branch diff (mockups)
```

- [ ] **`/code-review`** on the branch diff — review mockup HTML for correctness (valid markup,
  Tailwind CDN loads, links resolve) and the doc for claims that contradict the codebase.

```bash
# /code-review on the branch diff
```

- [ ] **`/security-review`** on the branch diff — light, but confirm mockups embed no real
  tokens/PII/secrets and no live API calls; CDN script tag is the only external resource.

```bash
# /security-review on the branch diff
```

- [ ] Resolve real findings; record any dismissals with written justification.

---

## Task 9: Finalize — handoff + verification (no deploy)

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Update the handoff: Sprint 84 deliverable complete, link the direction doc + mockups, set
  Sprint 85 (implementation) as the next sprint with the recommended first slice.

- [ ] Final verification

```bash
test -f docs/design/sprint-84-unified-feed/README.md && \
ls docs/design/sprint-84-unified-feed/mockups/*.html && echo "deliverables present"
npm run feedback:check   # informational — this sprint changes no services; confirm it's clean
```

- [ ] Commit + open PR per the multi-agent PR contract. Merge on admin authorization. **No deploy
  step** (`no-deploy` — nothing ships to `karmyq.com`); the PR landing on master is the
  completion.

```bash
git add docs/design/ docs/superpowers/ .claude/handoff/CURRENT_HANDOFF.md docs/IDEAS.md
git commit   # body must satisfy .github/pull_request_template.md headers
```
