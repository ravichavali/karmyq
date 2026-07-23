# Frontend CONTEXT.md

**Last updated**: 2026-07-22 (v11.32.0 Sprint 120 PR C — five-second clarity)

## Overview

Next.js 15 web application (Pages Router) consuming all Karmyq backend services.

---

## Sprint 120 PR C Five-Second Clarity (2026-07-22, v11.32.0)

Presentation-layer outcomes of the five-second audit
(`docs/superpowers/research/2026-07-16-sprint-120-five-second-audit.md`). All pinned by
`tests/regression/sprint-120-five-second-fixes.test.tsx`.

- **JWT payloads decode as UTF-8 — `src/lib/jwt.ts` is the ONLY decode path** (BUG-032). Bare
  `atob()` returns one character per byte, so any non-ASCII in a JWT-sourced name (community names
  carry em dashes) arrived as Latin-1 mojibake. `decodeJwtPayload` normalizes base64url, re-reads the
  bytes through `TextDecoder('utf-8', { fatal: true })`, and returns `null` on any failure — the
  contract is "the real characters or null", never a U+FFFD-corrupted payload that still parses.
  Adopted at all five former `atob` sites (`lib/api.ts`, `pages/communities/index.tsx` ×2,
  `pages/communities/[id].tsx`, `pages/demo.tsx`). **Do not reintroduce a local `atob` decode.**
  The payload remains unverified and display-only; authorization still re-derives membership server-side.
- **Onboarding overlays never stack.** `useOnboarding(workflowId, { suppressed })` reads
  `suppressed` ONCE at mount (a `useRef` snapshot) — deliberately, so that dismissing the other
  overlay mid-visit cannot raise a second one. `pages/dashboard.tsx` computes
  `welcomeModalOwnsThisVisit` from storage (not from the `user` state, which arrives in a later
  effect) and passes it in; the workflow is not marked seen, so its tour appears on the next visit.
- **The create action is labelled and never overlays the feed.** A right-corner floating FAB cannot
  avoid a 375px column: cards carry right-aligned actions ("Explore →", "Offer to Help") reaching
  x≈323, and any bottom-right button reaches x≥303, so they intersect at rest (measured on the live
  build: FAB `[288–336]` ∩ "Explore →" `[259–323]`). So `SpeedDialFab` renders **two layouts**: on
  `< md` a **docked, opaque, full-width bar** (`.kq-create-bar`, anchored `bottom-16` above the now
  deterministic `h-16` `.bottom-nav`) — bottom chrome content scrolls behind, like the nav; on `md+`
  the labelled floating corner FAB (no bottom nav there, wide viewport has room). Tab content keeps
  `.kq-fab-safe-bottom` (`pb-44 md:pb-0`) so the last card clears both bottom bars. **Do not revert to
  a single floating FAB on mobile** — it reintroduces the overlap. jsdom has no layout engine, so the
  geometry is browser-verified and the tests pin the layout/class contract
  (`data-testid=create-bar-mobile` / `create-fab-desktop`).
- **The dashboard community `<select>` cannot set page width.** It sits in a `min-w-0 flex-1
  sm:max-w-xs` wrapper with `w-full max-w-full`. Without this, the longest option name drove the
  intrinsic width and pushed the 375px document to 470px (a horizontal page scrollbar).
- **`/network` speaks to a sparse member.** With ≤1 first-degree connection the page renders a
  prompt linking `/dashboard` (`data-testid="sparse-network-cta"`); the graph itself still renders at
  exactly 1. The active mode pill uses the green primary (the page's indigo accents are gone).
- **Entry points:** the logged-out app root offers a third CTA to `/demo`; `/login` and `/register`
  share `components/AuthBrandHeader` (wordmark linking `/` + product line).
- **jsdom note:** `jest.setup.js` polyfills `TextEncoder`/`TextDecoder` (jsdom ships neither,
  browsers do) — required by `lib/jwt.ts`. jsdom also has no layout engine, so FAB/overflow geometry
  is pinned by class contract in tests and verified in a real browser.

## v11.32.0 Next.js advisory floor (2026-07-23)

- **`next` floor is `^15.5.21`** (frontend + landing only), raised from `^15.5.18` for the
  `GHSA-m99w-x7hq-7vfj` batch (8 high-severity advisories affecting `next 12.0.0 – 15.5.20`). Root
  `package.json` is unchanged — `next` is NOT a root dependency.
- **`next` must stay HOISTED to root `node_modules` in the lockfile.** The root `overrides` entry
  `sharp@<0.35.0 → 0.35.3` does not reach `apps/*` subtrees (a known npm workspace-overrides
  limitation), so if `next` de-hoists into `apps/*/node_modules` its optional `sharp` resolves to the
  vulnerable `0.34.5` there and the ADR-059 audit gate goes red. Bumping the floor with a plain
  `npm install --package-lock-only` DOES de-hoist it (minimal-change resolution nests the new
  version). The floor bump was therefore followed by **`npm dedupe --package-lock-only`**, which
  re-hoists a single `next@15.5.21` + `sharp@0.35.3` to root — `next` stays reachable only through the
  app workspaces, so backend `--omit=dev` images (which copy only the root manifest, not the apps) are
  byte-identical to before (169 top-level packages, no `next`/`sharp`/`@swc`). Verified:
  `npm audit --package-lock-only --audit-level=high` → `found 0 vulnerabilities`.
- If a future `next` bump de-hoists it again (check `node_modules/next` is at ROOT, not under
  `apps/*`, in the lockfile), re-run `npm dedupe --package-lock-only`. Do NOT "fix" it by adding
  `next` to root `dependencies` — that pins next/swc/sharp into every backend production image.
- The lockfile was updated **in place**, never regenerated from scratch on Windows.

---

## v11.30.1 dependency-security runtime floor (2026-07-21)

- Frontend build and runtime containers use Node 20 Alpine; `apps/frontend/package.json` requires
  Node `>=20.9.0`. This is the minimum supported by patched `sharp@0.35.x`.
- Root dependency overrides keep Next.js on the existing 15.5 line while replacing its vulnerable
  optional Sharp/libvips leaf. Frontend behavior and public API contracts are unchanged.
- Axios is pinned to the patched `^1.18.1` floor across direct consumers. Do not lower these floors
  without rerunning the ADR-059 high/critical audit gate.

---

## Sprint 116 Relationship Lens — PR A Foundation (2026-06-30, ADR-084)

- `components/relationships/relationshipLensModel.ts` is the pure deterministic dual-ego geometry:
  equal mirrored anchors, disclosed path through the center, shared one-hop people in the overlap,
  and stable-ID one-sided fans behind each anchor. It has no D3/force layout or inferred clustering.
- `RelationshipLens.tsx` renders accessible SVG plus the server summary as normal text. Every person
  has the same radius; provider status is an external service badge. Only coarse `bond_depth` maps to
  line widths (`forming` 1.2, `growing` 1.9, `established` 2.8). Relationship state remains in text
  and `<title>`; brightness/opacity encodes nothing.
- PR A intentionally does not mount the lens on a browsing surface. PR B will fetch it only from the
  request/ordinary-match/provider-offer routes at the corresponding helping decision boundary.

### PR C — Guided read-only demo (`/demo`, 2026-07-01)

- `src/pages/demo.tsx` is a public, standalone page (no app `Layout`, no auth required) that walks a
  read-only Maria story. It discloses the read-only 30-minute synthetic tour, then `demoService`
  `startSession()` (`POST /auth/demo-session`) issues the demo token. The page stores
  `token`/`user`/`demoContext` and **explicitly `removeItem('refreshToken')`** — a demo session never
  keeps a refresh token, so it simply expires. On mount it rehydrates an unexpired session so a refresh
  doesn't drop the tour.
- It renders both stories through the same `RelationshipContextPanel`: the ordinary story as
  `kind="match"` and the provider story as `kind="provider-offer"`. It shows **no** mutating controls
  (Accept/Decline/Submit/Withdraw/Complete) — defense in depth on top of the server-side read-only
  guard. Join the Platform (`https://karmyq.com/register`) and Log in are always reachable, including
  in the unavailable state.

---

## Sprint 115 Belonging Graph — Earned Structure (2026-06-27, ADR-083)

One wrapper + one canonical model + one shared visual encoding, dispatched to **purpose-built,
deterministic renderers** (no force/HEB layout for person modes — position and edges are earned from
disclosed topology, never invented by a layout or cluster detection).

- **Mode map.** `<BelongingGraph mode>` still owns all fetch/normalize, then dispatches:
  `ego` → `EgoOrbitGraph` (you at origin; concentric orbits by **local BFS distance**, never
  `node.degrees_of_separation`; stable baseline + expansion-arc layout via `baselineNodeIds` /
  `expansionRootIds`); `community` → `CommunityRingGraph` (every member on one ring, one direct
  quadratic chord per disclosed link, incomplete `N of M` copy); `communities` → `CommunityHubGraph`
  (unchanged); `fission` → `TrustGraphHEB` (now **fission-only**, `mode: 'fission'`).
- **Shared encoding.** `components/graphs/graphVisualEncoding.ts` owns the single source of person-node
  colors, edge hues (caller amber > focused teal > ordinary slate), constant `1.35px` at-rest /
  `2.5px` focused widths, the five decay-tier opacity bands (+ `0.16` unknown), adjacency, and
  accessible labels. `communityRingModel.ts` / `egoOrbitModel.ts` are **pure** (no React/DOM) and
  return geometry only.
- **Pure-model + memoization test pattern.** Geometry lives in pure model functions tested directly
  (`tests/regression/sprint-115-graph-models.test.ts` asserts exact coordinates, path strings, BFS
  distances, and the "ignore response-supplied depth" invariant). Renderers memoize the model on
  `[graphData.nodes, graphData.links, …dimensions, baselineNodeIds, expansionRootIds]` and **exclude
  focus** from those deps, so hover/focus/search recolors without recomputing geometry — asserted by
  `sprint-115-graph-renderers.test.tsx` (path `d`/endpoints unchanged on focus) and
  `sprint-115-structural-truth.test.ts` (topology, no health metric).
- **Full-community contract.** `getFullCommunityGraph` selects up to 149 non-caller members neutrally
  (normalized name + ID, never trust score), unions the caller, and returns
  `meta: { totalActiveMembers, truncated }`; `normalizePersonGraph`/`GraphData.meta` carry it through.
- **Consolidation guard.** `tests/regression/belonging-graph-consolidation.test.ts` now requires all
  four renderers + `graphVisualEncoding` to exist ("one wrapper, canonical model, shared visual
  encoding, contextual renderers").

---

## Sprint 111 Belonging Graph System (2026-06-23, ADR-081)

> **Partly superseded by Sprint 115 (ADR-083) — see the section above.** The "single `TrustGraphHEB`
> renderer for every mode" claim below is historical: person modes now render through `EgoOrbitGraph` /
> `CommunityRingGraph` and `communities` through `CommunityHubGraph`; `TrustGraphHEB` is fission-only.
> The one-wrapper architecture, canonical model, and fetch dispatch described here still hold.

One graph engine, one client model, one explorer. All belonging surfaces now render through a single
`<BelongingGraph mode>` over the canonical `TrustGraphHEB` D3 renderer.

- **Canonical model.** `components/graphs/types.ts` holds the single `TrustNode` / `TrustLink` /
  `GraphData` / `BelongingMode` definitions. `components/graphs/normalizeGraphData.ts` (pure) holds
  `normalizeCommunityDepthGraph` (DepthNode/DepthLink → canonical) and `mergeGraphData` (order-
  independent merge; baseline is authoritative on identity, expansions add neighbors and keep the
  **min** `degrees_of_separation`). `TrustGraphHEB` is canonical-type-only.
- **`<BelongingGraph mode>`** dispatches fetching per mode via `socialGraphService`:
  `ego` → `getTrustGraphAggregate`; `community` →
  `getFullCommunityGraph(communityId)`; `communities` → `getCommunityGraph` then normalize; `fission`
  → caller-supplied `graphData` (no fetch). `load="immediate"` opts out of lazy IntersectionObserver
  loading (used by `/network`); card surfaces stay lazy. `onDataLoaded` lets the profile pulse reuse
  the same ego response without a second fetch.
- **`TrustGraphHEB` extensions.** communities mode (emerald member ring via stroke — uniform radius
  preserved, ADR-063; organic solid-slate / fission dashed-violet edges; member count/status in
  detail); hover/focus fade of unrelated topology; keyboard activation + full-name `<title>`; optional
  D3 zoom (`enableZoom`, scale `[0.5,4]`); keyed joins + 400ms transitions (no per-update
  `selectAll('*').remove()`).
- **`/network` explorer** (`pages/network.tsx`). Modes via `?mode=ego|community|communities` (+`id=`).
  Ego has a depth slider (1–3) and progressive expansion: activating a node fetches
  `getNeighborhood(id, { depth: 1 })`, FIFO-capped at 3, each with a keyboard-reachable "Collapse
  {name}" chip. Community = the whole `getFullCommunityGraph` (no depth/expansion); communities =
  depth view. Search focuses an already-loaded node only.
- **Profile altitude.** `BelongingSection` ("How you're woven into Karmyq", graph height 480) replaces
  the reused dashboard widget on `profile.tsx`; `BelongingPulse` shows the honest "You're connected to
  N people across M communities" (excludes self; degrades to graph-only copy if the membership read
  fails).
- **Retired.** `NetworkGraph.tsx`, `TrustGraph.tsx`, `graphs/CommunityDepthGraph.tsx`, and
  `types/react-cytoscapejs.d.ts` deleted; `cytoscape`, `react-cytoscapejs`, `@types/cytoscape`,
  `react-force-graph-2d` removed from `package.json`. **D3 is the only graph dependency.**
- **Test infra.** `jest.config.js` maps `^d3$` → the UMD dist bundle (D3 v7 is ESM-only and next/jest
  forces its own `transformIgnorePatterns`); `jest.setup.js` stubs `ResizeObserver` (IntersectionObserver
  is left undefined so immediate-mode tests can assert it's never constructed).

---

## Sprint 109 Geocoding Cache Boundary (2026-06-22)

- **Geocoding boundary:** `src/lib/geocoding.ts` must keep IndexedDB/common-location cache first,
  `geocoding-service` second, and direct Nominatim fallback last. The backend cache is the app-wide
  rate-limit/provider-switching boundary.
- Backend `/search` timeouts do not silently fall through to direct browser-to-Nominatim calls; direct
  external fallback is reserved for clear backend reachability failures after local caches are checked.

---

## Sprint 107 App Shell Clarity & Commitment Truth (2026-06-20)

- **Chrome width is separate from content measure.** `src/styles/globals.css` keeps `--measure: 42rem`
  for feed/prose content and adds `--measure-chrome: 72rem`; `src/styles/karmyq-shell.css` exposes
  `.kq-chrome-page` for topbar/app shell chrome. Do not widen `.kq-page`.
- **Responsive overflow is intentional.** `Layout.tsx` uses `.kq-chrome-page` for the topbar. Since
  Sprint 119 (header lever 2) the overflow menu is the one home for Communities, Service
  Providers/Become a provider, provider profile management, and Profile at EVERY viewport — only
  My Network keeps a topnav slot (xl+). Logout, notification bell, and the provider duty toggle
  stay in the topbar; the menu also carries Logout.
- **Pending dibs have one action surface.** `CommitmentsTab` no longer renders a separate pending
  `DibsCard` list. The Helping tab's `DecisionBand` is the canonical surface for accept/decline dibs,
  and the dibs badge derives from freshly mapped decision rows.
- **Offered-awaiting truth is shared.** Home's "You've offered to help" preview and Helping's
  **Offers awaiting requester** section use the request-service offered-awaiting predicate. The
  frontend calls `requestService.getOfferedAwaiting()` and renders the rows under Helping so
  `/dashboard?tab=helping` shows the same asks Home previews.

---

## Sprint 105 Visual Design System v2 Implementation (2026-06-17, ADR-079)

- **Foundation tokens.** `src/styles/globals.css` now exposes `--measure` and `--radius-card`;
  `src/styles/karmyq-shell.css` adds `kq-headline-sm`; Tailwind exposes `max-w-measure` and
  `rounded-card`. The optional texture/motif hook was deliberately deferred because Sprint 105 had no
  finite-state/divider consumer for it.
- **Shared request display vocabulary.** `src/lib/requestDisplay.ts` centralizes humanized request
  status/urgency labels plus semantic token classes. Feed cards, request detail, offers, and match
  detail should consume it instead of rendering raw DB tokens or raw Tailwind status colors.
- **Empty states.** `components/EmptyState.tsx` now renders the shared `kq-finite-state` treatment with
  stable `data-testid="empty-state"` and accessible heading/body/CTA semantics.
- **Retired standalone request feed.** `/requests` deliberately redirects to `/dashboard`; request
  discovery lives on Dashboard Home, Community Home, and community open-asks. `/requests/[id]` remains
  the canonical single-ask detail route.
- **Migrated surfaces.** Request cards/detail, offers, match detail, Profile, Layout chrome, Dashboard
  selector/caught-up states, and Community pending/error indicators now use `.kq-card`, semantic
  tokens, and the warm finite-state language. Community pending tab dots have accessible labels; status
  is never color-only.
- **Dashboard Home secondary altitude.** Established members with an empty primary queue see the
  primary "You're caught up" finite state plus a quieter "Still want to lend a hand?" community browse
  row. No-community users see only the join-community finite state.

---

## Sprint 103 Governance + Intake Clarity (2026-06-17)

- **Request action copy is centralized.** `src/lib/requestActionCopy.ts` is the single helper for
  offer labels and fallback error copy. Service asks render **Offer service** / **Offering service…**;
  mutual-aid asks render **Offer to Help** / **Offering…**. `Feed/RequestCard.tsx` and
  `pages/requests/[id].tsx` both consume the helper.
- **Founding-circle review queue.** `pages/admin/founding-circle.tsx` lists persisted landing-page
  submissions for authenticated, explicitly allowlisted reviewers, filters by
  `new`/`reviewed`/`contacted`/`archived`, and updates status through `foundingCircleAdminService` in
  `src/lib/api.ts`. The API interceptor unwraps envelopes, so callers read `res.data`. The backend is
  deny-by-default unless `FOUNDING_CIRCLE_REVIEWER_IDS` or `FOUNDING_CIRCLE_REVIEWER_EMAILS` is set,
  and still requires active community-admin status.
- **Admin navigation.** `components/admin/AdminLayout.tsx` does not link to `/admin/founding-circle`;
  the review queue is direct-URL only for the allowlisted reviewer because demo/test admin credentials
  must not be invited into real submissions.
- **No outbound review transport.** The admin page updates status only; it does not send email,
  Slack, webhook, queue events, or notifications.

## Sprint 102 Visible Memory + Re-warm First Step (2026-06-16, ADR-070)

Productizes the existing Sprint 90 forgetting/decay surfaces — no new endpoints, schema, or decay math.

- **Profile memory is independent of karma visibility.** `profile.tsx` renders `MemorySection` for the
  selected community regardless of `showKarmaToMe`, and the community selector is no longer gated on
  karma display (single source of `selectedCommunityId` drives both karma stats and memory).
- **Memory is text-legible.** `MemorySection` chips now carry a plain-text tier label
  (`Active`/`Warm`/`Fading`/`Nearly forgotten`/`Let go`) — fading no longer relies on opacity alone.
- **Nearly-forgotten bonds are informational.** `ReWarmingNudge` surfaces bonds "Close to being let go"
  (self-suppressing when none). The per-peer "Reconnect" CTA was **removed** (2026-06-16): it linked to
  `/messages?to=<peerId>`, a route that never existed, and Karmyq messaging is match-anchored (no peer
  DM to land on). Copy now frames re-warming as "helping each other again", with no dead link. Restore a
  CTA once peer messaging or a directed-ask flow ships.
- **Community graph memory legend.** `TrustGraphTab` renders a "How memory fades" legend (strong/warm,
  fading, nearly forgotten) above the re-warm nudge; no change to graph fetching or `decayTier` flow.
- **Community pulse reads as care.** `CommunityPulse` helped row now says "N neighbours showed up for
  one another" with "with care from …" subcopy. Count semantics and zero-row suppression unchanged.

---

## Sprint 101 Actionability + State Truth (2026-06-15)

Every request surface now states the lifecycle truth and offers the next real action for the viewer.

- **Home pending-offers preview.** `Feed/OfferedAwaitingPanel.tsx` replaces the Sprint 100 count-only
  band. It renders the actual open asks the member has offered on (from `offeredAwaitingItems` on the
  `view=home` curated response), each with an explicit **Open ask →** link to `/requests/{request_id}`
  (Sprint 108), and a trailing "View all in Helping" link. Still Home-only and positive-count-only;
  `UnifiedFeed.tsx` reads both `offeredAwaiting` (count) and `offeredAwaitingItems` (preview).
- **Home suggested-as-helper preview (Sprint 108).** `Feed/SuggestedAsHelperPanel.tsx` is a sibling
  calm band, rendered by `UnifiedFeed.tsx` on Home when `suggestedAsHelper.count > 0`: the open asks
  where an admin/matchmaker proposed this member as helper. It is **non-actionable** (no inline
  accept/decline — BUG-015 keeps the actionable `DecisionBand` in Helping) and links there with
  **Respond in Helping →**. The actual accept/decline renders in the Helping `DecisionBand`:
  `DecisionBand.tsx` labels a responder-role `match` decision "Suggested you as a helper for …" and
  routes accept → `requestService.acceptMatch` (`PUT /matches/:id/accept`), decline → `rejectMatch`.
  `CommitmentsTab.tsx` no longer renders proposed responder matches as helping cards (they live in the
  band / offered-awaiting band) — the BUG-022 dedupe.
- **Actionable request detail.** `src/pages/requests/[id].tsx` is no longer a redirect shim — it
  fetches `requestService.getRequest(id)` and renders the ask plus the one true next step from the
  server-derived `viewer_relation`: `can_offer` → Offer to Help / Offer service (same `createMatch`
  mutation as `RequestCard`); `already_offered` → "waiting for the requester" + Helping link;
  `own_request` → "This is your ask" + Asks link; `not_actionable` → finite-state copy (completed/
  cancelled/matched/expired), no fake action. Self-contained (no `Layout`, which pulls `useProvider`)
  with a back link; `localStorage.user` read is try/caught.
- **Community open-asks are the action path.** `communities/[id]/open-asks.tsx` and
  `community/tabs/BrowseTab.tsx` copy now says opening an ask shows its detail + the available action
  (replacing the read-only "calm queue" implication). Cards stay inline-action-free; the detail page
  is where you act.
- **State-aware Asks.** `MyRequestsTab.tsx` `emptyOfferCopy(status)` replaces the blanket "No offers
  yet" — only an `open` ask says that; completed/matched/cancelled get lifecycle-true copy.
- **Router test guardrail.** New tests reuse the global `apps/frontend/jest.setup.js` `next/router`
  mock; only `sprint-101-request-detail-action.test.tsx` mocks `useRouter` locally (it needs a custom
  `query.id` + a `replace` spy to prove the page no longer redirects).
- **Graph layout.** `graphs/CommunityDepthGraph.tsx` orders ring nodes deterministically (membership,
  then link-derived degree, then name) before circular placement — a bounded, formulaic reduction of
  edge length / label churn, no force sim or hand-placement. `TrustGraphHEB` was left unchanged:
  crossings there are inherent to dense topology + hierarchical edge bundling and can't be removed
  formulaically without changing topology or hand-placing nodes (documented in the trust-graph guide).

## Sprint 99 Release Experience Audit (2026-06-14)

Findings + evidence: `docs/bugs/sprint-99-release-experience-audit.md`.

- **S99-001 — Stewardship 403.** `GET /communities/:id/stats` is admin-only (403 "Only community admins can view statistics"). The community page (`src/pages/communities/[id].tsx`) now gates `refetchStats()` behind `canViewCommunityStats({ isAdmin })` (`src/lib/community/statsVisibility.ts`) and re-runs the stewardship effect when `isAdmin` resolves, so members no longer flood the console with 403s.
- **S99-002 — caught-up overclaim.** The empty *curated* home feed terminal copy (`Feed/UnifiedFeed.tsx`) no longer says "That's everyone for now"; an empty curated feed only means no direct matches, so it points to community open asks instead.
- **S99-004 — provider Get Service routing.** `RequestWizard.tsx` already sends `preferred_provider_id`; the modal now surfaces it — submit reads "Ask {provider}" and a note says the provider will see it first — instead of looking like a blind "Ask neighbours" broadcast.
- **S99-006 — member email privacy.** The member-facing People roster (`community/tabs/ActiveTab.tsx`) no longer renders member emails; they remain in the admin/mod management table only.

## Sprint 98 Trust Truth Audit (2026-06-14, ADR-077)

- **BUG-098-001 — trust-path community context.** `useTrustPath`/`useBatchTrustPaths` (`src/hooks/useTrustPath.ts`) now accept an optional `communityId` and pass it as `X-Community-ID` via `socialGraphService.getTrustPath/getBatchTrustPaths(id, communityId)` (`src/lib/api.ts`). `RequestCard` supplies the card's `data.community_id`, so a badge's path matches the visible surface; absent context = platform-wide. The localStorage `user` parse is guarded (`readCurrentUserId`) so a corrupt value can't crash the hook.
- **BUG-098-005 — feed terminal state.** `UnifiedFeed` no longer shows "You're caught up" together with "Show more open requests"; "caught up" appears only after the feed is widened (`showingMoreOpen`). Onboarding workflow copy updated to match.
- **BUG-098-006 — legacy `/network`.** Removed the unused `socialGraphService.getNetwork()` wrapper; all trust-graph surfaces use `getTrustGraph*`.
- Relationship copy (DibsPrompt `community_connection`, ProviderCard "✓ In {community}") was already honest; the data-layer fixes make it true.

## Sprint 97 Release Readiness Data Quality (2026-06-13)

### `dashboard.tsx` membership bootstrap (BUG-097-001)

The mount effect called `fetchCommunities()` (async, not awaited) and then ran `setLoading(false)`
synchronously, so the page rendered with `loading=false` and an empty `userCommunities` before the
membership fetch resolved — flashing the false "Join a community to see requests" state for users
who *are* in communities. Fixed by tracking membership loading separately: a new
`communitiesLoading` state (initialised `true`) gates the loading screen
(`!user || loading || communitiesLoading`), `fetchCommunities` toggles it instead of `loading`, and
the zero-community block is gated on `!communitiesLoading && !communityLoadError &&
userCommunities.length === 0` — so a fetch failure shows the existing retry banner, never the false
empty state. Test: `tests/tdd/sprint-97-dashboard-community-load.test.tsx`.

### `Feed/UnifiedFeed.tsx` widened-feed terminal state (BUG-097-003)

The "That's everyone for now" finite copy only existed in the zero-card empty states; when the
widened feed (`showingMoreOpen`/`minScore=0`) still returned cards, the list just ended silently.
Added a terminal note rendered after the request cards, gated on `showingMoreOpen && activeType ===
'all' && activeUrgency === 'all' && !noCommunities`, so it appears only after the user clicks **Show
more open requests** and only on an unfiltered widened feed. Test:
`tests/tdd/sprint-97-feed-terminal-state.test.tsx`.

---

## Sprint 89 Community Sovereignty Redesign (2026-06-06, ADR-068)

### Community page → warm four-tab model
**Paths**: `src/pages/communities/[id].tsx`, `src/lib/communityTabs.ts`, `src/components/community/CommunityHero.tsx`, `src/components/community/CommunityPulse.tsx`, `src/components/community/StewardRequestsAdmin.tsx`, `src/components/community/tabs/StewardshipTab.tsx`, `src/components/community/tabs/BrowseTab.tsx`, `src/components/Feed/UnifiedFeed.tsx`, `src/hooks/useCommunityPulse.ts`, `src/styles/karmyq-shell.css`

- The `/communities/[id]` page is restructured from ~10 pre-shell tabs into **four warm tabs** — **Home · People · How we're connected · Stewardship** (+ a group-only **Activities**). The initial `activeTab` is **`home` for every role** (the `overview` default is gone). This fixes the headline S88 bug: the warm feed (`BrowseTab` → `UnifiedFeed`) was admin-gated under the old `requests` tab, so members never reached it.
- **`lib/communityTabs.ts`** is the single exported deep-link resolver (`resolveCommunityTab`, `VALID_TABS`). It maps every legacy `?tab=` alias into the four-tab model (`overview`/`requests`→home, `trust`→connected, `governance`/`fission`/`fusion`/`settings`/`config`/`links`/`providers`/`stats`/`insights`/`export`→stewardship, `manage`/`pending`/`members`/`norms`→people, unknown→home). The page **and** the IA test import it — never copy the map.
- **`BrowseTab` was split.** It now renders the member `UnifiedFeed` only (Home, all roles). Its admin steward-request manager (all-status list, triage/boost/propose, member picker, insights, export) was **extracted verbatim** into `StewardRequestsAdmin`, relocated under **Stewardship** (admin-only). `CommunityHeader` is **retired** in favour of `CommunityHero` (warm serif hero + member faces + Dunbar cap bar + embedded join CTA).
- **`CommunityPulse`** ("This week in the neighbourhood") replaces empty KPI tiles, fed by `useCommunityPulse` → `GET /requests/community/:id/pulse`. Zero/meaningless rows are suppressed. To avoid a double summary, `UnifiedFeed` gained a **`suppressActivity`** prop that hides the in-feed `ActivityCard` on community Home (the hero pulse renders it once).
- **`StewardshipTab`** composes the existing Governance/Split/Fusion (all members) + admin `StewardRequestsAdmin`/Settings/Providers under a warm sub-nav — a relocation, not a rewrite.

---

## Sprint 88 Help-Loop Redesign (2026-06-05)

### Shared shell and feed hierarchy
**Paths**: `src/styles/karmyq-shell.css`, `src/pages/dashboard.tsx`, `src/components/community/tabs/BrowseTab.tsx`, `src/components/Feed/*`

- Adds the warm shared shell layer: Fraunces headings, Hanken Grotesk body type, `kq-page`, `kq-page-header`, `kq-card`, `kq-path-badge`, `kq-action-band`, and `kq-finite-state`.
- Fidelity follow-up: `body` now carries the approved faint paper-grain radial texture, and `Layout` uses the mockup-aligned warm topbar (`kq-topbar`, seed-dot `kq-wordmark`, Home / Communities / Providers nav, one quiet notification dot).
- Dashboard Browse now leads with a calm Home header before `UnifiedFeed view="home"`.
- Community Browse now leads with a Community Home header before `UnifiedFeed view="community"` and suppresses empty KPI tiles.
- `RequestCard` is relationship-led: `RequestTrustBadge` / `TrustPathBadge` is the lead element, rendered with the feed-only `presentation="feed"` green face-pill; raw `KarmaBadge` is removed, and match percentage is demoted to a qualitative `describeMatchSignal()` line.
- `UnifiedFeed` defaults to `minScore=30`; the quiet **Show more open requests** affordance explicitly re-fetches with `minScore=0` so sub-30 open asks can appear on demand.
- `DecisionBand` and card shells wrap on mobile; `.fab` and `SpeedDialFab` use `bottom-28` on mobile to avoid CTA overlap.

### Copy and affordance polish
**Paths**: `src/components/RequestWizard.tsx`, `src/components/Layout.tsx`, `src/components/FissionProposalModal.tsx`, `src/components/FusionProposalModal.tsx`

- Request wizard copy now asks in neighbourly language (`Ask neighbours`) while keeping the warm emoji type picker.
- Layout keeps one quiet notification affordance by removing the extra provider notification bell from the top nav.
- Split/fusion proposal names are cleaned before submit so repeated `— Group A/B` suffixes do not accumulate.

---

## Sprint 86 Hotfix (2026-06-05)

### `UnifiedFeed.tsx` decision-band reconciliation
**Path**: `src/components/Feed/UnifiedFeed.tsx`

- After a decision-band action resolves, Dashboard Home optimistically drops the acted-on decision and background-refetches `view=home` without showing the loading skeleton.
- Prevents stale sibling offer decisions from remaining after the backend accepts one proposed match and rejects the other proposed matches for the same request.
- Fixes repeated `Match must be in proposed state to accept` 400s caused by clicking stale rejected match decisions.

### Tests updated
- `tests/tdd/sprint-85-unified-feed.test.tsx`
  - new case: accepting one decision refetches and removes sibling decisions rejected by the server.

---

## UX Usability Pass (Step 3, 2026-06-01)

### `dashboard.tsx` community-load recovery feedback
**Path**: `src/pages/dashboard.tsx`

- Adds an inline warning banner when community loading fails.
- Includes a `Retry` action that re-runs `fetchCommunities(user.id)` without forcing a full page refresh.
- Keeps failure feedback visible and actionable instead of logging-only behavior.

### `RequestWizard.tsx` accessibility + guidance polish
**Path**: `src/components/RequestWizard.tsx`

- Adds `type="button"` on non-submit controls to prevent accidental default submit behavior.
- Adds `aria-pressed` to urgency chips.
- Adds `aria-expanded` + `aria-controls` to community scope toggle.
- Adds short helper guidance below Description to improve request quality.

### Tests updated
- `tests/unit/sprint-80-dashboard-bootstrap.test.tsx`
  - new case: failed community load shows retry banner and retry re-calls API.
- `tests/unit/sprint-80-request-wizard-draft.test.tsx`
  - new case: urgency and community scope controls expose expected accessibility state.

---

## Reliability Hardening (Sprint 80)

### `dashboard.tsx` auth/session bootstrap
**Path**: `src/pages/dashboard.tsx`

- Prevents infinite spinner state when `token` exists but localStorage `user` is missing/corrupt.
- Behavior:
  - missing token → redirect to `/login`
  - token present but missing `user` → clear token/refresh token and redirect
  - malformed/invalid `user` JSON or missing `id` → clear auth storage and redirect
- Ensures `loading` is explicitly set false in all redirect branches.

### `Layout.tsx` localStorage parsing guard
**Path**: `src/components/Layout.tsx`

- Wraps `JSON.parse(localStorage.user)` in try/catch.
- On parse failure, clears stale `user` storage instead of throwing.

### `RequestWizard.tsx` safe close
**Path**: `src/components/RequestWizard.tsx`

- Adds draft protection on backdrop/X close:
  - if no draft, close immediately
  - if draft exists, asks for confirmation before discarding
- Prevents accidental request draft loss.

### `TabBar.tsx` label consistency
**Path**: `src/components/TabBar.tsx`

- Renames tab label from `Active` to `Helping` (desktop + mobile) to align with approved navigation taxonomy.

---

## Product Taxonomy Alignment (Sprint 81)

### Navigation labels
- Dashboard tab labels are standardized to: `Browse`, `Helping`, `Asks`.
- Request/offer confirmation copy updated from “Active tab”/“My Requests” language to `Helping`/`Asks`.
- Mobile tab titles standardized to `Browse`, `Asks`, `Me`.

---

## New Components (Sprint 35)

### `RequestWizard.tsx`
**Path**: `src/components/RequestWizard.tsx`
Two-step request creation modal. Fully self-contained — owns type fetch, schema fetch, form state, and request submission.

- **Step 1**: Type picker grid (2-col mobile, 3-col desktop). Tiles are `.type-card` CSS class.
- **Step 2**: DynamicForm (schema-driven fields) + plain description textarea + urgency chips + community scope selector.
- Props: `onClose`, `onSuccess?`, `preferredProviderId?`, `preferredProviderName?`, `preferredProviderServiceType?`
- When `preferredProviderServiceType` is set: initializes at step 2 with that type pre-selected and locked.
- Urgency mapping: UI uses `normal | urgent | critical`; backend uses `medium | urgent | critical` (normal → medium).
- Fetches available types via `requestService.getSchemas()` on mount; augments built-in types with custom schemas.
- Calls `fetchSchema(type)` immediately when user taps a tile in step 1 (so step 2 loads instantly).
- Module-level `schemaCache` prevents redundant fetches within a session.
- Z-index: backdrop `z-[49]`, modal `z-50`.

### `SpeedDialFab.tsx`
**Path**: `src/components/SpeedDialFab.tsx`
Tab-aware expandable FAB. Replaces the old static `.fab` button.

- **browse**: expands to "Get Help" + "Get Service" action stack.
- **helping** / **asks**: single "Get Help" action (plain FAB, no expansion).
- Props: `activeTab: TabId`, `onGetHelp: () => void`, `onGetService: () => void`
- Z-index: actions `z-40`, backdrop `z-39` (wizard modal is `z-50`).

### Removed in Sprint 35
- `EnhancedAutocomplete` and `ExtractedDataChips` are no longer used in dashboard.
- NLP/smart-text logic (`parseRequestDescription`, `buildPayloadFromParsed`, `getSuggestions`, `updateLocationCoordinates`) no longer called from dashboard.
- All NLP-related state removed from `dashboard.tsx`: `parsedRequest`, `autocompleteSuggestions`, `autocompleteTrigger`, etc.

## New Components (Sprint 34)

### `TabBar.tsx`
**Path**: `src/components/TabBar.tsx`
Tab navigation component. Renders horizontal tab bar on desktop (`md:`) and sticky bottom nav on mobile.

- **Desktop**: `div.tab-bar.hidden.md:flex` — horizontal tabs below top nav
- **Mobile**: `nav.bottom-nav` — fixed to `bottom-0`, hidden at `md:` breakpoint
- Props: `activeTab: TabId`, `onChange: (tab: TabId) => void`, `commitmentCount?: number`
- `TabId` = `'browse' | 'helping' | 'asks'`
- Shows commitment count dot/badge on Commitments tab when `commitmentCount > 0`

### `Feed/UnifiedFeed.tsx` (current feed surface — replaced the retired `BrowseFeed`)
**Path**: `src/components/Feed/UnifiedFeed.tsx`
Single-column unified feed. The same component powers two surfaces via a `view` prop:
- **Dashboard Home** (`view=home`) — rendered by `pages/dashboard.tsx`
- **Community Home** (`view=community`) — rendered by `components/community/tabs/BrowseTab.tsx`

- Fetches via `requestService.getCuratedRequests({ view, minScore?, community_id?, ... })` → `GET /requests/curated`. request-service is the **feed source-of-truth** (ADR-066); when a `view` is passed the response is `{ items: UnifiedFeedItem[] }`. Sprint 88: default feed calls pass `minScore=30`; **Show more open requests** passes explicit `minScore=0` and must not omit the param.
- `UnifiedFeedItem` is a discriminated union of four kinds rendered in priority order: `decision` (`DecisionBand` — proposed matches needing your accept/reject), `request` (`RequestCard` — open asks you can help with), `activity` (`ActivityCard`), `story` (`StoryCard`). The texture layer (activity/story cards) is ADR-066/067.
- `RequestCard` surfaces `category` as `payload_type` and switches its body on it via `RequestPayloadRenderer` (ADR-067). Sprint 88: it leads with the trust path, removes requester Karma from the card, and renders `match_score` only as qualitative quiet meta via `describeMatchSignal()`.
- After a decision-band action resolves, Dashboard Home optimistically drops the acted-on decision and background-refetches `view=home` (see Sprint 86 Hotfix above).

> **Retired in Sprint 86:** the legacy `BrowseFeed.tsx`, `Feed.tsx`, `FeedItem.tsx`, and `FeedFilterPanel` components no longer exist — do not reference them as live. The unified feed (ADR-066) replaced them.

### `FilterChipRow.tsx`
**Path**: `src/components/FilterChipRow.tsx`
Horizontal chip row for type + urgency filtering. Urgency row only shows when a type filter is active or urgency is not "all".

### `CommitmentsTab.tsx`
**Path**: `src/components/CommitmentsTab.tsx`
Two-section view: "I'm Helping" (matches where I'm the responder) and "I Asked For Help" (matches on my own requests). Fetches independently via `requestService.getMatches()`.

### `MyRequestsTab.tsx`
**Path**: `src/components/MyRequestsTab.tsx`
My posted requests with expandable offer management. Calls `requestService.getRequests({ requester_id })` + `requestService.getMatches()`.

---

## New Components (Sprint 33)

### `EmptyState.tsx`
**Path**: `src/components/EmptyState.tsx`
Reusable empty-state block. Used on: Dashboard, Communities list, Requests list, Offers list.

Props: `icon?` (emoji), `heading`, `body`, `ctaLabel?`, `ctaHref?`, `ctaOnClick?`

**Usage guard**: Only render when `!loading && items.length === 0` to prevent flash during initial load.

### `WelcomeModal.tsx`
**Path**: `src/components/WelcomeModal.tsx`
3-step first-time onboarding modal. Sprint 118 (ADR-085): gates on the **user-scoped**
`karmyq_onboarded:<userId>` key, honoring the legacy global `karmyq_onboarded` (existing users see
nothing new).

- Hydration-safe: `visible` initialises `false`; set `true` only inside `useEffect` after checking localStorage
- On close/done: writes `karmyq_onboarded:<userId> = '1'` to localStorage
- Rendered inside `dashboard.tsx` `<Layout>`, above the main grid
- Suppressed for members who passed through the `/welcome` arrival (it writes the same key)

---

## Patterns

### `next/dynamic` + `ssr: false`
Used for components that reference browser APIs (`window`, `canvas`, `document`). Omitting `ssr: false` crashes the dev server during SSR.

| Component | File |
|---|---|
| `NetworkGraph` | `profile.tsx` |
| `CommunityConfigEditor` | `communities/new.tsx`, `communities/[id].tsx` |
| `SchemaCanvas` | `admin/schemas/[id]/edit.tsx` |

### Join funnel + arrival gate (Sprint 118, ADR-085)
Invite-primary funnel: `/invite/[code]` is the landing (context card + inline account form;
preserves the register side effects: `token`, `refreshToken`, `user`, `demoContext` clear) →
accept → re-login → `/welcome`. Open path: `/register` (invite nudge) →
`/communities?welcome=true` → first public join → `/welcome`. Both paths stash the arrival
context in **sessionStorage `karmyq_arrival`** (`{path, inviterId?, inviterName?, communityId,
communityName}`); `/welcome` renders `ArrivalGraph` (ring primitives, never sparse-gated; the
invitation bond is a distinct dashed chord from funnel context — NEVER a trust edge) and writes
the user-scoped onboarded key on completion/skip.

### `karmyq_onboarded:<userId>` localStorage flag
Absence of this key (and of the legacy global `karmyq_onboarded`) triggers the `WelcomeModal`.
Written `'1'` when the `/welcome` arrival completes or is skipped, or on modal close. Checked in
`useEffect` (never at render time). The legacy global key is read but no longer written.

### Canonical CSS classes (`globals.css @layer components`)
Sprint 33 added canonical utility classes. Use these instead of raw Tailwind on buttons, inputs, and cards:

| Class | Usage |
|---|---|
| `.btn-primary` | Primary action buttons |
| `.btn-secondary` | Secondary / outline buttons |
| `.btn-ghost` | Text-style buttons |
| `.btn-danger` | Destructive actions |
| `.card` | Container cards |
| `.input` | Form inputs |
| `.section-heading` | Section headings within pages |
| `.tab-bar` + `.tab-bar-item` | Desktop horizontal tab bar |
| `.bottom-nav` + `.bottom-nav-item` | Mobile sticky bottom nav |
| `.fab` | Floating action button |
| `.status-badge` + `.status-badge--{state}` | Commitment status chips |
| `.filter-chip` | Horizontal filter chips |
| `.feed-card` | Feed request cards (extends `.card`) |

---

## Evolution Toggle (Sprint 33 move)

The Trust Evolution toggle was removed from `reputation/trust.tsx` and moved to `profile.tsx` (bottom section, "Trust Evolution Settings").

- `trust.tsx` now shows a plain link: "Manage trust evolution settings on your Profile page."
- `profile.tsx` reads communities from the localStorage JWT (no extra API call): `JSON.parse(localStorage.getItem('user') || '{}')?.communities ?? []`

---

## Layout & Navigation (Sprint 34, updated Sprint 86)

### Tab-Based Dashboard Architecture
`dashboard.tsx` is a tab shell — it does NOT own feed logic. The active tab drives which component renders. As of Sprint 86 the Browse tab renders `UnifiedFeed` (`view=home`), not the retired `BrowseFeed`.

```
dashboard.tsx
├── Community selector (top bar, scopes the feed)
├── TabBar (Browse | Helping | Asks)
├── Tab content area
│   ├── <UnifiedFeed view="home" communityId={activeCommunityId} />   # decisions + open requests + texture
│   ├── <CommitmentsTab />
│   └── <MyRequestsTab onNewRequest={...} />
└── FAB ("Get Help") — visible on Browse + Helping only
```

The community page (`communities/[id]`) renders the same `UnifiedFeed` with `view="community"` inside `components/community/tabs/BrowseTab.tsx`.

### Single Responsive Breakpoint
`md:` (768px) is the only breakpoint for layout:
- Below `md:`: bottom tab bar, stacked layout
- At/above `md:`: horizontal tab bar, no bottom nav

### Content Max-Width
All tab content areas use `max-w-2xl mx-auto` (672px).

### FAB Positioning
```css
.fab { @apply fixed bottom-28 right-6 md:bottom-8; }
```
`bottom-28` clears the bottom nav and feed card CTAs on mobile. On desktop (`md:`), drops to `bottom-8`.

### Layout.tsx Changes (Sprint 34)
Top nav simplified:
- **Desktop**: Logo | Communities | Providers | [Avatar] | [Logout]
- **Mobile**: Logo | [Avatar] | [☰ hamburger → Communities, Providers, Profile]
- Dashboard / main nav links removed — tabs replace them on the dashboard page
- `LeftSidebar` and `RightSidebar` kept in codebase but NOT rendered in `dashboard.tsx` (available for other pages if needed)

---

## Known Issues / Pre-existing TS Warnings

These warnings exist in the codebase and were NOT introduced in Sprint 33:
- `BUILD_VERSION` declared but never read (profile.tsx)
- `fetchUserCommunities` / `fetchPrivacySettings` declared but never read (profile.tsx)
- `FormEvent` deprecated (login.tsx, register.tsx, communities/[id].tsx, communities/new.tsx)
- `InlineChat` unused import

---

## Sprint 116 (PR B): Reciprocal relationship context on helping surfaces

`RelationshipContextPanel` (`src/components/relationships/RelationshipContextPanel.tsx`) is the one
non-blocking wrapper that renders the deterministic `RelationshipLens` on all four decision surfaces.
It takes a discriminated `kind` prop — `request` | `match` | `provider-offer` — and fetches through
`useRelationshipContext` (`src/hooks/useRelationshipContext.ts`), a cancel-safe hook that ignores
stale resolutions after the target changes.

State → presentation:
- `200` with context → render the lens.
- `204` / `403` / `404` → suppress the panel entirely (no error, no layout jump).
- `5xx` / timeout → a small "Connection context isn't available right now." note.

Wired surfaces (the decision action is NEVER gated on the fetch):
- `requests/[id].tsx` — request-scoped panel, shown only when `viewer_relation === 'can_offer'`.
- `MyRequestsTab.tsx` — match-scoped panel inside each expanded proposed offer, before Accept/Decline.
- `SubmitOfferModal.tsx` — request-scoped panel above price/note (provider sees the requester).
- `CommitmentsTab.tsx` — provider-offer-scoped panel in each pending offer, before Accept/Decline
  (requester sees the provider role + collective badge).

API methods live on `requestService` in `src/lib/api.ts`:
`getRequestRelationshipContext`, `getMatchRelationshipContext`, `getProviderOfferRelationshipContext`.
Any test that mounts one of the surfaces above must include the relevant method in its `@/lib/api`
mock (a missing method throws synchronously in the hook).
