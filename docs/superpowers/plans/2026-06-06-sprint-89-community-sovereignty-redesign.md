# Community Sovereignty Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the whole `/communities/[id]` page up to the approved warm `community-home` mockup —
four warm tabs (Home · People · How we're connected · Stewardship), warm Home as the default for
every role, a serif hero with the Dunbar cap bar, and a real "this week in the neighbourhood" pulse.

**Architecture:** A new read-only request-service endpoint returns the community's weekly help-loop
pulse; the Next.js community page is restructured from ~10 pre-shell tabs into four `.kq-*` warm
tabs, with the previously admin-gated warm feed (`BrowseTab`/`UnifiedFeed`) promoted to the default
Home surface for all roles.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/components/community/CommunityHero.tsx` | Warm serif hero: name, mission, faces, capline, Dunbar cap bar |
| `apps/frontend/src/components/community/CommunityPulse.tsx` | "This week in the neighbourhood" pulse card |
| `apps/frontend/src/components/community/StewardRequestsAdmin.tsx` | Admin steward-request manager extracted from `BrowseTab` (all-status list, triage/boost/propose/insights/export) |
| `apps/frontend/src/components/community/tabs/StewardshipTab.tsx` | Container: governance + split + fusion + admin-only `StewardRequestsAdmin` + settings/providers sub-nav |
| `apps/frontend/src/hooks/useCommunityPulse.ts` | Fetch + state for the pulse endpoint |
| `apps/frontend/src/lib/communityTabs.ts` | Centralized, exported tab resolver (old `?tab=` aliases → 4-tab model) — imported by the page AND the redirect test |
| `docs/adr/ADR-068-community-page-information-architecture.md` | Records the four-tab model + default-Home + pulse seam |
| `services/request-service/tests/tdd/sprint-89-community-pulse.test.ts` | TDD: pulse endpoint aggregation + membership gate |
| `apps/frontend/tests/tdd/sprint-89-community-page-ia.test.tsx` *(or `tests/unit/frontend/`)* | TDD: default Home for all roles, warm feed un-gated, old-tab redirects, pulse render |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/requests.ts` | Add `GET /community/:communityId/pulse` reusing the S86 texture aggregation (~L1010–1051) + new `timeSensitive`; membership-gated |
| `apps/frontend/src/pages/communities/[id].tsx` | 4-tab restructure; Home default for all roles; render **member feed only** on Home; wire hero + pulse; use the centralized resolver |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | Split: extract admin steward block → `StewardRequestsAdmin`; leave member `UnifiedFeed` for Home |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | Add a prop to suppress the in-feed `ActivityCard` on community Home (de-dup vs the hero pulse) |
| `apps/frontend/src/lib/api.ts` | Add `requestService.getCommunityPulse(communityId)` |
| `apps/frontend/src/styles/karmyq-shell.css` | Hero/pulse/4-tab classes if not already in the shell |
| `apps/frontend/src/components/community/CommunityHeader.tsx` | Retire/reduce in favor of `CommunityHero` |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update community workflow nav/tab names |
| `apps/frontend/CONTEXT.md` | Record community-page IA + default-tab change |
| `services/request-service/CONTEXT.md` | Document the pulse endpoint |
| `services/registry.json` | Add pulse endpoint to request-service `apis.provides` |
| `docs/adr/README.md` | Index ADR-068 |
| `apps/landing/src/data/docs/guides/{community guide}.json` | Update community guide (four tabs, default Home, pulse) |
| `apps/landing/src/data/docs/concepts/{...}.json` + `adr-068-*.json` + `nav.json` | Concept + ADR + nav entries |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Headline bug + BrowseTab is two surfaces.** The warm feed is admin-gated today (`requests` tab
   under `isAdminOrMod`), so members never see it. But `BrowseTab` contains BOTH the member
   `UnifiedFeed` AND an admin steward-request manager (all-status list, triage/boost/propose/insights/
   export). Home renders the **member `UnifiedFeed` only**, for every role; the admin block is
   **extracted** to `StewardRequestsAdmin` under Stewardship. Whole-`BrowseTab`-on-Home re-strands
   admins in management; `UnifiedFeed`-only without extracting loses the admin tools.
2. **Default tab = `'home'` for all roles.** Remove the `overview` default; admins reach management
   via Stewardship.
3. **Preserve EVERY deep link via a centralized exported resolver** (`lib/communityTabs.ts`). The
   live map aliases more than the obvious set — remap ALL: `overview`/`requests`→`home`;
   `trust`→`connected`; `governance`/`fission`/`fusion`→`stewardship`;
   `settings`/`config`/`links`/`providers`→`stewardship` (admin sub-section);
   `manage`/`pending`/`members`/`norms`→`people`; `stats`/`insights`/`export`→`stewardship` (admin
   steward/insights). The redirect test currently owns a *copied* map — change it to import the real
   resolver so green proves the live behavior.
4. **Pulse reuses the S86 texture aggregation — no second query, de-dup the in-feed card.**
   request-service already computes the same numbers at `requests.ts ~L1010–1051` (`exchanges_completed_week`,
   `new_members_count`, `open_requests_count` with `expired = FALSE`, `recent_helpers`) and appends an
   `ActivityCard` to the feed. Extract/reuse that query (adding only `timeSensitive`); `recentJoins`
   comes from the endpoint (server already reads `members.joined_at` — no client-side seam). **Suppress
   the in-feed `ActivityCard` on community Home** so the pulse isn't shown twice.
5. **Pulse membership gate uses `user.communities`**, not `communityMemberships` (always 403).
   Non-members → 403.
6. **`openAsks` excludes expired** — `status='open' AND expired = FALSE` (match the existing query).
7. **No empty tiles** — suppress zero/meaningless pulse rows; the Dunbar capline always renders.
8. **API unwrap:** consume `res.data`, not `res.data.data`.
9. **Don't rewrite admin management** — Stewardship *relocates* existing components (incl. extracted
   `StewardRequestsAdmin`) under sub-nav. `/communities/[id]/admin` is a back-compat redirect, not a
   live config home.
10. **Cap bar uses the real cap** — `current_members` / `max_members` (both present; fall back to 150
    only if `max_members` null).
11. **`community_type`** — Activities stays a group-only tab.
12. **Schema is `communities.*` (plural)**; request-service local README is stale on the JWT field.
13. **nav.json reverts** after `generate-docs` — grep-verify + re-apply; landing docs gitignored → `git add -f`.

---

## Task 1: Feature branch + pulse endpoint TDD (write test first)

**Files:**
- Create: `services/request-service/tests/tdd/sprint-89-community-pulse.test.ts`

- [ ] Create branch `feature/sprint-89-community-sovereignty-redesign` from `master` (at/after `95fa62c`).
- [ ] Bump root `package.json` version `10.12.0` → `10.13.0`.
- [ ] **Write the failing TDD test first** for the pulse endpoint, asserting exact values against
      seeded rows (per the robust-testing standard — no stubs for the logic under test):
  - completed matches in the last 7 days for the community count into `helpedThisWeek`; a match
    completed 8 days ago does **not**.
  - `openAsks` counts only `status='open' AND expired = FALSE` help requests scoped via
    `request_communities`; **seed an expired open row and assert it is excluded** (Critical Note #6).
  - `timeSensitive` counts only `urgency IN ('urgent','high')` among the open asks.
  - `recentJoins` counts members with `joined_at` in the last 7 days (server-side, from the reused
    aggregation); a member who joined 8 days ago does **not** count.
  - a non-member caller (JWT `communities` lacking `:communityId`) gets **403**.

```bash
cd services/request-service && npx jest tests/tdd/sprint-89-community-pulse.test.ts --runInBand
# Expected: FAILS (endpoint not implemented yet)
```

---

## Task 2: Implement the pulse endpoint

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] Add `GET /community/:communityId/pulse`. Gate on active membership read from `user.communities`
      (403 otherwise). **Reuse the existing S86 texture aggregation** at `requests.ts ~L1010–1051`
      (`exchanges_completed_week` → `helpedThisWeek`, `new_members_count` → `recentJoins`,
      `open_requests_count` (already `expired = FALSE`) → `openAsks`, `recent_helpers` → `recentHelpers`)
      — extract it into a shared helper rather than copy-pasting, so the in-feed `ActivityCard` and the
      pulse endpoint stay in lockstep. Add **one new field** `timeSensitive`:

```sql
-- ADD to the reused aggregation (alongside open_requests_count), same WHERE scope:
COUNT(*) FILTER (WHERE hr.urgency IN ('urgent','high')) AS time_sensitive
-- ...from requests.help_requests hr JOIN request_communities rc
--    WHERE rc.community_id = $1 AND hr.status = 'open' AND hr.expired = FALSE
```

- [ ] Return `{ success: true, data: { helpedThisWeek, openAsks, timeSensitive, recentJoins, recentHelpers, windowDays: 7 } }`.
- [ ] Verify the TDD test from Task 1 now passes.

```bash
cd services/request-service && npx jest tests/tdd/sprint-89-community-pulse.test.ts --runInBand
```

- [ ] Run `/simplify` on this task's diff.

---

## Task 3: API client + pulse hook

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/hooks/useCommunityPulse.ts`

- [ ] Add `requestService.getCommunityPulse(communityId)` calling
      `GET /requests/community/:communityId/pulse`; return `res.data` (envelope already unwrapped).
- [ ] `useCommunityPulse(communityId, enabled)` → `{ pulse, loading, error }`; fetch only when
      `enabled` (Home active) and `communityId` present. Fail soft (pulse hidden, page still renders).
- [ ] Run `/simplify` on this task's diff.

---

## Task 4: Frontend TDD for page IA (write test first)

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-89-community-page-ia.test.tsx`

- [ ] **Write failing tests first** asserting the new behavior:
  - default `activeTab` is Home for a **member** (non-admin), and the member feed (`UnifiedFeed`) renders.
  - default Home also for an **admin** (not `overview`), and the admin **does NOT** see the steward-
    request manager on Home (it lives under Stewardship now).
  - tab bar shows exactly the four warm tabs (+ Activities only for `community_type==='group'`).
  - **resolver coverage:** import the centralized resolver (`lib/communityTabs.ts`) and assert it maps
    every legacy alias — `overview`/`requests`→home, `trust`→connected,
    `governance`/`fission`/`fusion`/`settings`/`config`/`links`/`providers`→stewardship,
    `manage`/`pending`/`members`/`norms`→people, `stats`/`insights`/`export`→stewardship.
  - `CommunityPulse` renders helped/openAsks rows when data present and **suppresses** a zero row.

```bash
cd apps/frontend && npx jest tests/tdd/sprint-89-community-page-ia.test.tsx
# Expected: FAILS
```

---

## Task 5: CommunityHero + CommunityPulse components

**Files:**
- Create: `apps/frontend/src/components/community/CommunityHero.tsx`
- Create: `apps/frontend/src/components/community/CommunityPulse.tsx`
- Modify: `apps/frontend/src/styles/karmyq-shell.css` (only if classes missing)

- [ ] `CommunityHero`: eyebrow, serif name, mission quote, member faces (first N + "+rest"), capline
      ("N neighbours · room for M more · stewarded by {admin}"), Dunbar cap bar
      (width = `current_members / max_members`, fall back to 150 only if `max_members` null),
      "capped at 150, on purpose" note. Embed the join CTA for non-members/pending (reuse existing
      `CommunityHeader` logic; keep `onJoin`).
- [ ] `CommunityPulse`: "This week in the neighbourhood" card fed by the pulse endpoint; rows for
      helped / open asks (+ time-sensitive sub) / recent joins (+ optional top helpers); **suppress
      rows with no meaningful data**; loading + fail-soft states.
- [ ] Run `/simplify` on this task's diff.

---

## Task 6: Extract StewardRequestsAdmin + StewardshipTab container

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/BrowseTab.tsx`
- Create: `apps/frontend/src/components/community/StewardRequestsAdmin.tsx`
- Create: `apps/frontend/src/components/community/tabs/StewardshipTab.tsx`

- [ ] **Split `BrowseTab`** (Critical Note #1): move the admin steward-request block — all-status
      request list, triage modal, boost, propose-match, member picker, insights, and export — into a
      new `StewardRequestsAdmin` component (admin-only). Leave the member `UnifiedFeed` + member-level
      "show more open" in `BrowseTab` for Home. Keep the existing admin actions wired exactly as they
      are (do not re-implement — Critical Note #9).
- [ ] `StewardshipTab`: compose under a warm sub-nav — **Decisions** (`GovernanceTab`), **Split**
      (`FissionTab`), **Fusion** (`FusionTab`) for all members; admin-only **Steward requests**
      (`StewardRequestsAdmin`), **Settings** + **Providers** (`ProfileTab section="settings"|"providers"`).
      Surface the active-proposal dot for Split/Fusion as today.
- [ ] Run `/simplify` on this task's diff.

---

## Task 7: Restructure the community page to four tabs

**Files:**
- Create: `apps/frontend/src/lib/communityTabs.ts`
- Modify: `apps/frontend/src/pages/communities/[id].tsx`
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`
- Modify: `apps/frontend/src/components/community/CommunityHeader.tsx` (retire/reduce)

- [ ] Create `lib/communityTabs.ts`: an exported `resolveCommunityTab(rawTab)` covering EVERY legacy
      alias per Critical Note #3, plus the `VALID_TABS` list. The page imports it; the redirect test
      imports it (replacing its copied map).
- [ ] In `[id].tsx`: replace `ValidTab`/`OLD_TAB_MAP` with `'home' | 'people' | 'connected' | 'stewardship'`
      (+ `'activities'` for groups), resolving via `resolveCommunityTab`. Initial `activeTab = 'home'`
      for all roles.
- [ ] Render `CommunityHero` (replacing the pre-shell header chrome) + `CommunityPulse` + the **member
      feed only** (`BrowseTab`'s `UnifiedFeed`, post-split) on **Home, for all roles**. Wire
      `useCommunityPulse` (enabled when Home active).
- [ ] In `UnifiedFeed.tsx`: add a prop to **suppress the in-feed `ActivityCard`** on community Home so
      the pulse isn't rendered twice (Critical Note #4).
- [ ] Map People→`ActiveTab`, How we're connected→`TrustGraphTab`, Stewardship→`StewardshipTab`.
- [ ] Apply `.kq-*` shell classes to page chrome + the four-tab bar.
- [ ] Verify Task 4 frontend TDD now passes; `cd apps/frontend && npm run build`.
- [ ] Run `/simplify` on this task's diff.

---

## Task 8: User guides + landing docs + ADR-068

**Files:**
- Create: `docs/adr/ADR-068-community-page-information-architecture.md`; Modify: `docs/adr/README.md`
- Modify/Create: `apps/landing/src/data/docs/guides/{community guide}.json`,
  `apps/landing/src/data/docs/concepts/{model}.json`, `apps/landing/.../concepts/adr-068-*.json`, `nav.json`
- Modify: `apps/frontend/src/lib/onboarding/workflows.ts`

- [ ] Write ADR-068 (four-tab model, default Home, member/admin altitude split, pulse seam); index it.
- [ ] Update the community **user guide**: where members land, the four tabs, where management moved,
      what the pulse means. Update/add the **concept** page for the warm community model.
- [ ] Update community **onboarding workflow** nav/tab names (overview→Home, trust→connected,
      governance/split/fusion→stewardship).
- [ ] Run `generate-docs` from `apps/landing/`; **grep-verify nav.json** and re-apply if reverted;
      `git add -f` the landing docs dir.

```bash
cd apps/landing && npm run generate-docs && npm run build
```

---

## Task 9: CONTEXT.md + registry.json + verify docs loop

**Files:**
- Modify: `apps/frontend/CONTEXT.md`, `services/request-service/CONTEXT.md`, `services/registry.json`

- [ ] Record the community-page IA + default-tab change in `apps/frontend/CONTEXT.md`.
- [ ] Document `GET /requests/community/:communityId/pulse` in request-service `CONTEXT.md` +
      `services/registry.json` `apis.provides`.
- [ ] `npm run feedback:check` passes.

---

## Task 10: SDLC quality gates

- [ ] **Testing:** `npm test` (unit + regression) green; `npm run test:tdd` shows the two new S89
      suites passing and **no new** failures beyond the documented pre-existing set.
- [ ] **`/simplify`** — final pass over the whole branch diff (altitude/reuse/efficiency).
- [ ] **`/code-review`** — on the branch diff; resolve correctness/logic findings before merge.
- [ ] **`/security-review`** — on the branch diff; resolve real findings (the pulse endpoint's
      membership gate + parameterized SQL are the surfaces to scrutinize); justify any dismissal
      (e.g. the recurring `js/request-forgery` FP on `api.ts`).

```bash
npm test && npm run test:tdd
```

---

## Task 11: Final type check + pre-push verification

- [ ] `cd services/request-service && npm run build` (tsc) — clean.
- [ ] `cd apps/frontend && npm run build` — clean (pre-existing `swcMinify` warning OK).
- [ ] `npm test` — green; `npm run feedback:check` — green.
- [ ] `npm audit --package-lock-only --audit-level=high` — clean (ADR-059 gate).
- [ ] `git diff --check` — no whitespace errors.

---

## Task 12: Merge + Deploy

- [ ] Use the `/deploy` skill. Open the PR with `.github/pull_request_template.md` filled (Summary /
      Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- [ ] On maintainer authorization ("pull it in"), admin-merge to `master`, push, monitor GitHub
      Actions `CI/CD Pipeline` + `Tests` + `CodeQL` to green; verify deploy health checks.
- [ ] **Member-login UI check (per the validation standard):** log in as a *member* (sim password
      `password123`), open a community, confirm you land on warm **Home** with relationship-led cards
      and a populated pulse; click through People / How we're connected / Stewardship; confirm an old
      deep link (`?tab=overview`) still resolves.
- [ ] Update the handoff: mark Sprint 89 shipped + set Sprint 90 (trust/forgetting/profile) direction.
