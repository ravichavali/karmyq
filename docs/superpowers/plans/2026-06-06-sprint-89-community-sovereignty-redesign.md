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
| `apps/frontend/src/components/community/tabs/StewardshipTab.tsx` | Container: governance + split + fusion + admin-only settings/providers sub-nav |
| `apps/frontend/src/hooks/useCommunityPulse.ts` | Fetch + state for the pulse endpoint |
| `docs/adr/ADR-068-community-page-information-architecture.md` | Records the four-tab model + default-Home + pulse seam |
| `services/request-service/tests/tdd/sprint-89-community-pulse.test.ts` | TDD: pulse endpoint aggregation + membership gate |
| `apps/frontend/tests/tdd/sprint-89-community-page-ia.test.tsx` *(or `tests/unit/frontend/`)* | TDD: default Home for all roles, warm feed un-gated, old-tab redirects, pulse render |

### Existing files to modify
| File | Change |
|------|--------|
| `services/request-service/src/routes/requests.ts` | Add `GET /community/:communityId/pulse` handler (membership-gated aggregation) |
| `apps/frontend/src/pages/communities/[id].tsx` | 4-tab restructure; Home default for all roles; un-gate warm feed; wire hero + pulse; extend `OLD_TAB_MAP` |
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

1. **The warm feed is currently admin-gated — that is the headline bug.** `[id].tsx` renders the
   `requests` tab (→ `BrowseTab` → `UnifiedFeed`) only under `isAdminOrMod`. Home must render the
   warm feed for **every** role. Verify a *member* (not admin) lands on Home and sees the cards.
2. **Default tab = `'home'` for all roles.** Remove the `overview` default; admins reach management
   via Stewardship.
3. **Preserve deep links.** Extend `OLD_TAB_MAP`: `overview`/`requests`→`home`; `trust`→`connected`;
   `governance`/`fission`/`fusion`/`settings`/`providers`→`stewardship` (right sub-section). Existing
   redirect tests stay green.
4. **Pulse seam:** endpoint returns only `helpedThisWeek`/`openAsks`/`timeSensitive` (request schema);
   **recent joins is derived client-side** from `community.members` (`joined_at`). Do not make
   request-service read member-recency.
5. **Pulse membership gate uses `user.communities`**, not `communityMemberships` (always 403).
   Non-members → 403.
6. **No empty tiles** — suppress zero/meaningless pulse rows; the Dunbar capline always renders.
7. **API unwrap:** consume `res.data`, not `res.data.data`.
8. **Don't rewrite admin management** — Stewardship *relocates* existing components under sub-nav.
9. **Cap bar uses the real cap** (`max_members` if present, else 150 Dunbar); width = count/cap.
10. **`community_type`** — Activities stays a group-only tab.
11. **Schema is `communities.*` (plural)**; request-service local README is stale on the JWT field.
12. **nav.json reverts** after `generate-docs` — grep-verify + re-apply; landing docs gitignored → `git add -f`.

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
  - `openAsks` counts only `status='open'` help requests scoped to the community via
    `request_communities`.
  - `timeSensitive` counts only `urgency IN ('urgent','high')` among the open asks.
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
      (403 otherwise). Run one read-only aggregation (parameterized, last-7-days window):

```sql
-- helpedThisWeek: completed matches in this community in the last 7 days
SELECT COUNT(*) FROM requests.matches mt
  JOIN requests.help_requests r ON r.id = mt.request_id
  JOIN requests.request_communities rc ON rc.request_id = r.id
 WHERE rc.community_id = $1
   AND mt.status = 'completed'
   AND mt.completed_at >= NOW() - INTERVAL '7 days';

-- openAsks + timeSensitive: open help requests scoped to the community
SELECT
  COUNT(*) AS open_asks,
  COUNT(*) FILTER (WHERE r.urgency IN ('urgent','high')) AS time_sensitive
FROM requests.help_requests r
  JOIN requests.request_communities rc ON rc.request_id = r.id
 WHERE rc.community_id = $1 AND r.status = 'open';
```

- [ ] Return `{ success: true, data: { helpedThisWeek, openAsks, timeSensitive, windowDays: 7 } }`.
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
  - default `activeTab` is Home for a **member** (non-admin), and the warm feed (`UnifiedFeed`) renders.
  - default Home also for an **admin** (not `overview`).
  - tab bar shows exactly the four warm tabs (+ Activities only for `community_type==='group'`).
  - `?tab=overview`, `?tab=requests` resolve to Home; `?tab=trust` → connected;
    `?tab=governance` → stewardship.
  - `CommunityPulse` renders helped/openAsks rows when data present and **suppresses** a zero row.
  - recent-joins derives from `community.members` `joined_at` (no extra fetch).

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
      ("N neighbours · room for M more · stewarded by {admin}"), Dunbar cap bar (width = count/cap,
      cap = `max_members ?? 150`), "capped at 150, on purpose" note. Embed the join CTA for
      non-members/pending (reuse existing `CommunityHeader` logic; keep `onJoin`).
- [ ] `CommunityPulse`: "This week in the neighbourhood" card; rows for helped / open asks
      (+ time-sensitive sub) / recent joins; **suppress rows with no meaningful data**; loading +
      fail-soft states.
- [ ] Run `/simplify` on this task's diff.

---

## Task 6: StewardshipTab container

**Files:**
- Create: `apps/frontend/src/components/community/tabs/StewardshipTab.tsx`

- [ ] Compose existing components under a warm sub-nav: **Decisions** (`GovernanceTab`), **Split**
      (`FissionTab`), **Fusion** (`FusionTab`) for all members; admin-only **Settings** + **Providers**
      sub-sections (`ProfileTab section="settings"|"providers"`). Surface the active-proposal dot for
      Split/Fusion as today. Reuse — do not re-implement (Critical Note #8).
- [ ] Run `/simplify` on this task's diff.

---

## Task 7: Restructure the community page to four tabs

**Files:**
- Modify: `apps/frontend/src/pages/communities/[id].tsx`
- Modify: `apps/frontend/src/components/community/CommunityHeader.tsx` (retire/reduce)

- [ ] Replace `ValidTab`/tab set with `'home' | 'people' | 'connected' | 'stewardship'`
      (+ `'activities'` for groups). Initial `activeTab = 'home'` for all roles.
- [ ] Extend `OLD_TAB_MAP` per Critical Note #3 so old deep links + the existing redirect test pass.
- [ ] Render `CommunityHero` (replacing the pre-shell header chrome) + `CommunityPulse` + the warm
      feed (`BrowseTab`/`UnifiedFeed`) on **Home, un-gated for all roles**. Wire `useCommunityPulse`
      (enabled when Home active); compute recent-joins from `community.members`.
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
