# Sprint 99 Release Experience Audit

**Date opened:** 2026-06-14
**Release target:** v11.8.0
**Primary tester:** `maria.reyes@test.karmyq.com` / `password123`
**Fallback tester:** `aisha.white6964@test.karmyq.com` / `password123`
**Walkthrough method:** Playwright MCP against live demo (`karmyq.com` app, `karmyq.org` landing), logged in as the rich tester. Screenshots saved under `.playwright-mcp/s99-*.png`.

## Audit Lanes

| Lane | Status | Notes |
|---|---|---|
| Dashboard Home | Done | Default band = Provider → empty; curated feed returns 0 even at minScore=0; "You're caught up" overclaims |
| Community pages | Done | Home/People/Connected/Stewardship all render; Stewardship fires admin-only /stats → 403 for members |
| Provider flows | Done | Directory + detail polished; "Get Service" submits a generic neighbour broadcast, not a directed/paid request |
| Request flows | Done | Get Help / Get Service split; both produce identical "Ask neighbours / Share with: All communities" form |
| Trust/copy | Done | Provider scope copy good; dashboard terminal copy overclaims; governance jargon on Stewardship |
| Demo data | Done | "Test 1", "Test 2", "Foster city Cricket Aficianados" (typo), stacked "— Group A/— Group B" fission names leak everywhere |
| Landing first impression | Done | Home/join/docs polished; NetworkVisualization resize handler doesn't redistribute nodes; docs ADR count mismatch |

## Findings

| ID | Severity | Surface | Finding | Root cause | Decision | Status |
|---|---|---|---|---|---|---|
| S99-001 | P1 | Community → Stewardship | Tab fires `GET /api/communities/:id/stats` for every member; non-admins get **403 "Only community admins can view statistics"** → 2 console errors + "Failed to load statistics" each visit | Frontend calls an admin-only endpoint unconditionally; no role gate / no graceful 403 handling | TBD (freeze) | Open |
| S99-002 | P1 | Dashboard Home terminal state | "Show more open requests" → **"You're caught up — That's everyone for now"** even though the member's communities hold 100+ open/browsable asks (Berkeley alone reports "16 open asks waiting for a hand") | Curated home feed (`/api/requests/curated?view=home`) returns **0 items even at minScore=0** (relationship-led match feed is genuinely empty for her right now); terminal copy treats empty curated feed as "nothing anywhere" | TBD (freeze) | Open |
| S99-003 | P1 | Demo data | "Test 1", "Test 2", "Foster city Cricket Aficianados" (typo for "Aficionados", lowercase "city"), and stacked fission names ("Marin Mutual Aid — Group A/— Group B", "Portland Tool Library & Share — Group B — Group A") appear in the community dropdown, ask-scope picker, provider shared-community badges, and discovery list | Noisy/test demo communities never cleaned; fission split appends suffixes that stack | TBD (freeze) | Open |
| S99-004 | P1 | Providers → Get Service | Modal titled "Request from {Provider}" but the only action is **"Ask neighbours"** with **"Share with: All communities"** — identical to the generic Get Help form. Requesting a specific paid provider never directs the request to that provider | "Get Service" reuses the generic broadcast ask flow; no directed-to-provider routing or expectation-setting copy | TBD (freeze) | Open |
| S99-005 | P2 | Landing NetworkVisualization | On window resize the canvas re-scales but nodes are **never redistributed** and `connectionDistance` is computed once → after a significant resize the dot field clusters/clamps to stale bounds. NOTE: the plan's hypothesised "transform compounding / DPR" bug does **not** exist — assigning `canvas.width` already resets the transform each resize, so `ctx.scale(dpr,dpr)` does not accumulate | Resize handler (`NetworkVisualization.tsx` L34-38) only resizes the buffer; node positions + connectionDistance are init-once | TBD (freeze) | Open |
| S99-006 | P2 | Community → People | Member roster exposes raw `@test.karmyq.com` emails for all 115 members; hurts demo realism + is a privacy smell | People tab renders member email verbatim | TBD (freeze) | Open |
| S99-007 | P2 | Landing → Docs | Header/stat card say **"75 ADRs"** while "Concepts & Decisions" card says **"72 architecture decision records"** | Two different counts sourced/hardcoded separately in generated docs | TBD (freeze) | Open |
| S99-008 | P2 | Community → People | Each member row shows an empty "—" placeholder column (between role badge and join date) that is blank for everyone → looks unfinished | Column rendered with no data bound | TBD (freeze) | Open |
| S99-009 | P2 | Dashboard / global | Two separate availability indicators — "Available" pill (top nav) and "On duty" pill (community bar / provider header) — with no explanation of the difference | Two availability concepts surfaced side by side | TBD (freeze) | Open |
| S99-010 | P3 | Dashboard → Asks | `dibs_pending` status renders as raw "Dibs, pending" | Status enum shown without label mapping | TBD (freeze) | Open |
| S99-011 | P3 | Public landing (app `/`) | A stale/expired token in localStorage fires authenticated calls (providers/my, conversations, notifications, SSE) on the logged-out splash → wall of 401s in console | App makes authed calls before validating session on public route | TBD (freeze) | Open |

## Data / API Truth Probes (Task 3)

Run in-page as maria (token from `localStorage.token`, same-origin `fetch`):

- `GET /api/requests/curated?view=home&minScore=30&limit=50` → 200, **0 items**
- `GET /api/requests/curated?view=home&minScore=0&limit=50` → 200, **0 items** (empty regardless of score → S99-002 is genuinely-empty curated feed, not a threshold artifact)
- `GET /api/communities/ff54a7d5-…/stats` → **403** `{success:false, message:"Only community admins can view statistics"}` (confirms S99-001 is admin-only by design; UI shouldn't call it for members)
- `GET /api/requests/feed?communityId=ff54a7d5-…&limit=100` → 200, **100+ items** (confirms abundant browsable content exists while dashboard says "caught up" → S99-002)
- Community-scoped pulse/feed alt paths (`/communities/:id/feed`, `/pulse`, `/requests/feed/community/:id`) → 404 (the live feed is the generic `/api/requests/feed?communityId=` surface; cf. `queryBuilder.ts`)

## Fix List Freeze

**Frozen 2026-06-14 (maintainer-confirmed).** Six repairs in scope; five P2/P3 deferred.

| ID | Fix | Exact file(s) | Test file |
|---|---|---|---|
| S99-001 | Gate the admin-only `/stats` fetch to admins so members stop getting 403 + console errors on Stewardship | `apps/frontend/src/pages/communities/[id].tsx` (L79: `if (!stats) refetchStats()` → gate on `isAdmin`) | `apps/frontend/tests/tdd/sprint-99-release-experience.test.tsx` |
| S99-002 | Make the dashboard terminal state truthful: don't claim "That's everyone" when the member's communities have open asks — scope the claim to "best matches" and keep the Browse CTA | `apps/frontend/src/components/Feed/UnifiedFeed.tsx` (non-community branch L256-265) | same test file |
| S99-003 | Scripted, idempotent demo-data cleanup: remove/rename "Test 1"/"Test 2" test communities, fix "Aficianados"→"Aficionados" + "Foster city"→"Foster City" typo, collapse stacked fission suffixes | `scripts/audit-release-experience.sql` (read-only audit) + `infrastructure/postgres/migrations/20260614-release-experience-repair.sql` (idempotent repair) | SQL audit before/after counts recorded in this log |
| S99-004 | Copy-clarify provider Get Service: the payload already carries `preferred_provider_id` (RequestWizard L161), so tell the user the provider is contacted — button → "Ask {provider}" + a one-line note instead of bare "Ask neighbours" | `apps/frontend/src/components/RequestWizard.tsx` (L264 title, L381 scope label, L418 submit) | same test file |
| S99-005 | NetworkVisualization resize: redistribute node positions proportionally + recompute `connectionDistance` on resize (NOT the transform/DPR change the plan hypothesised — that is already correct) | `apps/landing/src/components/NetworkVisualization.tsx` (L34-57) | `apps/landing/tests/tdd/sprint-99-network-visualization.test.tsx` |
| S99-006 | Mask member emails on the People roster for non-admins (privacy + demo realism); keep visible to admins/mods | `apps/frontend/src/components/community/tabs/ActiveTab.tsx` (member table L247; gate on `isAdminOrMod`) | same frontend test file |

**Deferred to a later sprint (logged, not fixed in S99):** S99-007 (docs ADR 75 vs 72 count), S99-008 (empty "—" column on People), S99-009 (dual Available/On-duty indicators), S99-010 (raw "Dibs, pending" status label), S99-011 (401 wall on logged-out splash).

**S99-004 product decision:** copy-clarify only this sprint; a true directed/paid provider-request flow is deferred to a future provider/community UX sprint.

## Final Validation

### S99-003 demo-data — BEFORE evidence (read-only audit ran on demo `karmyq_prod`, 2026-06-14)

| Group | Records found |
|---|---|
| Test/junk names | `Test 1` (65 members), `Test 2` (64 members), `Test Community 1779770190663` (7 members) |
| Typo | `Foster city Cricket Aficianados` (10 members) |
| Stacked fission suffixes | 14 communities `… — Group A — Group A` / `…A — Group B` / `…B — Group A` / `…B — Group B` (71-83 members each) across PDX Home Repair & Trades, PDX Service Providers Network, Portland Tool Library & Share, Portland Tutors Network |
| Totals | 69 communities, 6525 members |

**Decision: rename, never delete** — Test 1/2 and the grandchildren hold 60-83 real members each;
deleting would strand thousands of memberships. Renames are id-stable. Repair:
`infrastructure/postgres/migrations/20260614-release-experience-repair.sql` (idempotent + collision-guarded).
Proposed renames: `Test 1`→`Bayview Neighbors`, `Test 2`→`Excelsior Mutual Aid`,
`Test Community 1779770190663`→`Glen Park Community Care`, typo→`Foster City Cricket Aficionados`,
stacked suffixes `… — Group A — Group A`→`… — Group AA` (AB/BA/BB).

**AFTER evidence: PENDING.** Applying the repair to the live demo DB is a shared-database write that
needs explicit maintainer authorization (the safety classifier blocked the ad-hoc apply, correctly).
Apply at deploy or with explicit go-ahead, then re-run `scripts/audit-release-experience.sql` and paste
the (empty) result here.

### Frontend / landing repairs — test evidence

- `apps/frontend/tests/tdd/sprint-99-release-experience.test.tsx` — 5/5 pass (S99-001/002/004/006).
- `apps/landing/tests/tdd/sprint-99-network-visualization.test.ts` — 5/5 pass (S99-005).
- Existing `sprint-97-feed-terminal-state` + `sprint-98-feed-caught-up-show-more` still pass (no regression from the S99-002 copy change).
- Frontend `tsc --noEmit` clean; landing `tsc` clean for changed source (4 pre-existing test-file errors unrelated to S99).
- Pre-existing TDD-tier failures (6 suites / 39 tests: trust-model, useTrustQuestions, sprint-38/39/40, sprint-85 optimistic-offer) verified identical on master with S99 src stashed — **zero new failures introduced**.

### SDLC gates

- `/simplify` — diff already clean (no existing helpers duplicated; new pure modules novel; right altitude).
- `/code-review` — no correctness findings (gate uses `isAdmin` matching server authz; resize math correct + idempotent SQL).
- `/security-review` — no findings; `npm audit --audit-level=high` → 0 vulnerabilities.

### Follow-up (deferred, logged)

- **S99-006 backend hardening:** the UI no longer renders member emails for non-admins, but `community.members` still includes `user_email` in the API payload, so a non-admin could still read it via devtools. A complete fix requires community-service to omit `user_email` for non-admin requesters. Out of Sprint 99 scope (UI-only repair was selected); candidate for a later sprint.
- **S99-007 docs ADR count (75 vs 72)** and S99-008/009/010/011 remain deferred.
