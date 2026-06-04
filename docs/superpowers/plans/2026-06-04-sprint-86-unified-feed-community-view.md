# Unified Feed — Community Feed view + texture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the unified-feed union in its second view (Community Feed, replacing `BrowseTab`'s
bespoke cards), populate the `activity`/`story` texture layer from request-service, retire the legacy
feed components, and fix the `request_type`/`payload_type` modelling seam so payload detail renders.

**Architecture:** A new `view=community` branch on `GET /requests/curated` assembles a community-scoped
union (`request` + `activity` + `story`) from request-service's own DB reads — no feed-service call —
ranked by extended action-altitude bands; the frontend `UnifiedFeed` gains a `view` prop plus `activity`/
`story` renderers and replaces every legacy bespoke card surface.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `apps/frontend/src/components/Feed/ActivityCard.tsx` | Presentational community-activity texture card. |
| `apps/frontend/src/components/Feed/StoryCard.tsx` | Presentational story texture card. |
| `services/request-service/src/services/communityTexture.ts` | Pure builders + priority bands for `activity`/`story` items (unit-testable). |
| `services/request-service/src/services/payloadType.ts` | `categoryToPayloadType()` — maps the messy `category` column to the renderer's `PayloadType` (seam fix). |
| `services/request-service/tests/unit/community-texture.test.ts` | Unit tests for texture builders + ranking (TDD, written first). |
| `services/request-service/tests/unit/payload-type.test.ts` | Unit tests for the `category → PayloadType` map incl. legacy aliases (`moving`→`moving_help`, `tech_support`→`tech_help`) + unknown→undefined. |
| `services/request-service/tests/integration/sprint-86-community-feed.test.ts` | Real-DB test: `view=community` returns ranked request+activity+story union; 400 on missing `community_id`; non-member gets no texture. |
| `apps/frontend/tests/tdd/sprint-86-unified-feed-community.test.tsx` | UnifiedFeed renders community view (cards + texture, no decision band); `payload_type` reaches the renderer; community view requests `view=community`. |
| `docs/adr/ADR-067-request-type-payload-vocabulary.md` | The `request_type` vs `payload_type` separation. |
| `apps/landing/src/data/docs/concepts/adr-067-request-type-payload-vocabulary.json` | Landing-site ADR-067. |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/types/unified-feed.ts` | Add `payload_type?: PayloadType` to `RequestCardData`; export `PayloadType`; update activity/story doc comments. |
| `services/request-service/src/services/unifiedFeed.ts` | Extend priority bands (activity/story); generalize `assembleHomeFeed` → also serve community view. |
| `services/request-service/src/routes/requests.ts` | `view=community` branch (`respondCommunityFeed`) with `community_id` + membership guard; add `payload_type: categoryToPayloadType(r.category)` in `toRequestCardData`. |
| `apps/frontend/src/lib/api.ts` | Widen `getCuratedRequests` `view?: 'home'` → `view?: 'home' \| 'community'`. |
| `apps/frontend/src/components/Feed/RequestCard.tsx` | Pass `data.payload_type` to `RequestPayloadRenderer`. |
| `apps/frontend/src/components/Feed/UnifiedFeed.tsx` | `view` prop; render `activity`/`story`; hide decision band + browse-mode in community view. |
| `apps/frontend/src/components/community/tabs/BrowseTab.tsx` | Replace bespoke card list with `<UnifiedFeed view="community" communityId={…} />`; keep management controls. |
| `apps/frontend/src/components/BrowseFeed.tsx` | **Delete.** |
| `apps/frontend/src/components/Feed/Feed.tsx`, `Feed/FeedItem.tsx` | **Delete.** |
| `apps/frontend/src/components/FeedFilterPanel.tsx` | **Delete** (de-dup into `FilterChipRow`). |
| `services/request-service/CONTEXT.md` | Document `view=community` + texture. |
| `services/registry.json` | Document the `view=community` curated branch. |
| `docs/adr/ADR-066-unified-feed-model.md` | Mark deferred consequences resolved; link ADR-067. |
| `docs/adr/README.md` | Add ADR-067 to index. |
| `apps/landing/src/data/docs/concepts/unified-feed.json` | "Two views, one model" + texture section. |
| `apps/landing/src/data/docs/guides/{unified-feed-guide}.json` | Community tab now shows the canonical feed. |
| `apps/landing/src/data/docs/nav.json` | Add ADR-067 entry. |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Update any workflow pointing at the old Browse card UI. |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Texture is computed in request-service, NOT feed-service.** `view=community` assembles request +
   activity + story from request-service's own DB reads. No feed-service call (ADR-066 single-source).
2. **Seam fix = two fields + a normalization map, no migration. A raw `r.category` passthrough is WRONG.**
   `request_type` stays the 5-value enum (filter). Derive `payload_type` from `category` via
   `categoryToPayloadType()`: on INSERT, `category` and `request_type` get the *same* value
   (`requests.ts:1147`), so newer rows hold the enum while older/sim rows hold skill tokens (`moving`,
   `tech_support`, `gardening`, …) that the matching SQL keys off (`requests.ts:112–123`). The renderer
   switches on `moving_help`/`tech_help`/etc. The map translates known aliases (`moving`→`moving_help`,
   `tech_support`→`tech_help`, plus `transportation`/`childcare`/`home_repair`/`cooking`→`food`/`pet_care`)
   and returns `undefined` for anything unrecognized — `RequestPayloadRenderer` already no-ops on an unknown
   type / empty payload (safe, no regression).
3. **Community view has NO decision band, and needs a community_id + membership guard.** `view=community`
   returns `request`/`activity`/`story` only (never call `fetchDecisions`). MUST 400 on a missing
   `community_id` and verify the caller is a member of that community (JWT `user.communities`) before running
   texture reads — otherwise a non-member could pull community texture even when no request rows match.
4. **Texture ranks below requests; stories below activity.** Extend priority bands in `unifiedFeed.ts`:
   requests (1000–1100) > activity (~500) > story (~100). Reuse the stable descending-priority sort.
5. **Texture queries are best-effort** — each wrapped in try/catch, degrade to "no texture", log; never
   break the feed (same pattern as `fetchDecisions`).
6. **Delete legacy components, don't bypass them.** Grep every import before deleting — a dangling import
   fails the type check. `BrowseTab` keeps its triage/export/member-picker controls; only its bespoke
   *card rendering* is replaced.
7. **`UnifiedFeed` already takes `communityId`** — extend it (add `view` prop + texture renderers +
   conditional band hiding); don't rebuild its fetch/filter plumbing.
8. **`view=home` request items also gain `payload_type`** (`categoryToPayloadType(r.category)` in
   `toRequestCardData`) — payload detail now renders on Dashboard Home too.
9. **Dry-run `category` population** on the demo DB before trusting the map
   (`SELECT request_type, category, COUNT(*) FROM requests.help_requests GROUP BY 1,2`) — use the real
   distinct `category` values to drive the map's alias cases and its unit test. Null/unknown `category`
   → `payload_type` undefined → renderer no-ops on empty payload (safe).
10. **`res.data.items` not `res.data.data.items`** (interceptor unwraps). **JWT field is `communities`.**
11. **Landing docs dir is gitignored** → `git add -f`. Run `generate-docs` from `apps/landing/`,
    **grep-verify nav.json after** (it silently reverts).

---

## Task 1: Feature branch + seam-fix types (TDD setup)

**Files:**
- Create branch
- Modify: `apps/frontend/src/types/unified-feed.ts`

- [ ] Create the branch:

```bash
git checkout -b feature/sprint-86-unified-feed-community-view
```

- [ ] **Dry-run the `category` vocabulary** (drives the Task 2 `categoryToPayloadType` map + its test).
  Run against the demo DB (read-only); capture the real distinct values so the map covers every alias that
  actually occurs:

```bash
# psql to the demo DB (read-only)
SELECT request_type, category, COUNT(*) FROM requests.help_requests GROUP BY 1,2 ORDER BY 3 DESC;
```

- [ ] Export a `PayloadType` union and add `payload_type` to `RequestCardData` (keep `request_type` as the
  enum). Update the `activity`/`story` doc comments from "shape-only" to "populated S86".

```typescript
// unified-feed.ts — the fine payload subtype the renderer switches on (distinct from request_type enum)
export type PayloadType =
  | 'transportation' | 'moving_help' | 'childcare' | 'tech_help'
  | 'home_repair' | 'food' | 'pet_care' | 'event_help' | 'other'

export interface RequestCardData extends Omit<OpenRequestData, 'status'> {
  status: RequestStatusToken
  payload_type?: PayloadType   // fine subtype (from DB `category`) — drives RequestPayloadRenderer
  match_score: number | null
  match_reason: string
  trust_degree?: number | null
  created_at?: string
}
```

- [ ] Verify it type-checks:

```bash
cd apps/frontend && npx tsc --noEmit
```

---

## Task 2: Texture builders + priority bands + `category → payload_type` map (TDD — test first)

**Files:**
- Create: `services/request-service/tests/unit/community-texture.test.ts` (FIRST)
- Create: `services/request-service/tests/unit/payload-type.test.ts` (FIRST)
- Create: `services/request-service/src/services/communityTexture.ts`
- Create: `services/request-service/src/services/payloadType.ts`
- Modify: `services/request-service/src/services/unifiedFeed.ts`

- [ ] **Write `payload-type.test.ts` first** (the sleeper-bug guard): assert `categoryToPayloadType` maps
  the real distinct `category` values (from the Task 0 dry-run) — at minimum the legacy aliases
  `'moving' → 'moving_help'` and `'tech_support' → 'tech_help'`, the already-aligned `'transportation'`,
  `'childcare'`, `'home_repair'`, the `'cooking'/'food' → 'food'` and `'pet_care'` cases — and returns
  `undefined` for unrecognized tokens (`'gardening'`, `'generic'`, `'ride'`, `''`, `null`). Assert exact
  values (no stubs).

- [ ] Implement `payloadType.ts`:

```typescript
import type { PayloadType } from '...'; // mirror the frontend union
const CATEGORY_TO_PAYLOAD_TYPE: Record<string, PayloadType> = {
  transportation: 'transportation', ride: 'transportation',
  moving: 'moving_help', moving_help: 'moving_help',
  childcare: 'childcare',
  tech_support: 'tech_help', tech_help: 'tech_help',
  home_repair: 'home_repair',
  cooking: 'food', food: 'food',
  pet_care: 'pet_care',
};
// Unknown/null → undefined: RequestPayloadRenderer no-ops on an unknown type / empty payload (safe).
export function categoryToPayloadType(category: string | null | undefined): PayloadType | undefined {
  return category ? CATEGORY_TO_PAYLOAD_TYPE[category] : undefined;
}
```

- [ ] **Write `community-texture.test.ts` first**: assert `buildActivityItem` / `buildStoryItem` produce
  items whose `priority` falls strictly below `PRIORITY_REQUEST_BASE`, that activity outranks story, and
  that `assembleFeed` keeps requests > activity > story after sorting a shuffled input. Assert exact
  priority values (no stubs for the logic under test).

- [ ] Add priority bands + builders. Extend `unifiedFeed.ts`:

```typescript
export const PRIORITY_ACTIVITY_BASE = 500;
export const PRIORITY_STORY_BASE = 100;
// generalize assembleHomeFeed → assembleFeed (keep an alias if other callers import the old name)
```

- [ ] Implement `communityTexture.ts` builders (pure): `buildActivityItem(data): UnifiedFeedItem<ActivityData>`
  and `buildStoryItem(data): UnifiedFeedItem<StoryData>` using the new bands.

- [ ] Verify:

```bash
cd services/request-service && npx jest tests/unit/community-texture.test.ts tests/unit/payload-type.test.ts
```

- [ ] Run `/simplify` on this task's diff.

---

## Task 3: `view=community` route branch + texture queries

**Files:**
- Modify: `services/request-service/src/routes/requests.ts`

- [ ] In `toRequestCardData`, add `payload_type: categoryToPayloadType(r.category)` (seam fix — both views
  benefit; import from `services/payloadType.ts`). **Do NOT use a raw `r.category` passthrough** (Critical
  Note 2).

- [ ] Add `respondCommunityFeed(req, res, userId, communityId, scoredRequests)`. **Guard first:** if
  `communityId` is missing/empty → `sendError(res, 400, …)`; then verify the caller is a member of that
  community (`(req.user.communities ?? []).some(c => c.id === communityId)`) → 403 if not. Only after the
  guard, build request items (reuse `buildRequestItem`/`toRequestCardData`), then **best-effort** texture:
  - one `activity` item from `requests.matches` (completed this week), `communities.members` (joined this
    week), and open `requests.help_requests` count for the community — each in its own try/catch.
  - `story` items from recently-completed first exchanges / visible karma milestones — try/catch, degrade
    to none.
  Then `assembleFeed([...requestItems, activityItem, ...storyItems])` and send `{ items, count }`.

- [ ] Wire the branch in `handleCuratedFeed` next to the existing `view=home` check (`community_id` is read
  the same way the existing handler reads it):

```typescript
if (req.query.view === 'community') {
  await respondCommunityFeed(req, res, userId, communityId, filteredRequests);
  return;
}
```

- [ ] Verify the service builds:

```bash
cd services/request-service && npm run build
```

- [ ] Run `/simplify` on this task's diff.

---

## Task 4: `view=community` integration test (real Postgres)

**Files:**
- Create: `services/request-service/tests/integration/sprint-86-community-feed.test.ts`

> Placed in `tests/integration/` (DB-gated, runs in the real-Postgres CI tier — blocks when DB is
> available) rather than `tests/tdd/`, so the endpoint's real-DB behavior isn't commingled with the
> tolerated pre-existing TDD failures. The pure ranking + `payload_type` logic is already locked by the
> Task 2 **unit** tests; this test exercises the wired endpoint against a real schema.

- [ ] Test `GET /requests/curated?view=community&community_id=:id` (caller is a member): returns `{ items }`
  with `request` items ranked above the single `activity` item ranked above any `story` items, and **no
  `decision` item**. Assert a request item's `data.payload_type` resolves via the map (e.g. a `moving`-
  category row → `'moving_help'`).
- [ ] Assert the guards: **400** when `community_id` is omitted; a **non-member** caller gets 403 (or no
  texture, per the implemented guard) — never another community's texture.

- [ ] Verify:

```bash
cd services/request-service && npx jest tests/integration/sprint-86-community-feed.test.ts
```

---

## Task 5: Texture renderers + RequestCard seam fix

**Files:**
- Create: `apps/frontend/src/components/Feed/ActivityCard.tsx`, `StoryCard.tsx`
- Modify: `apps/frontend/src/components/Feed/RequestCard.tsx`

- [ ] `RequestCard`: pass `data.payload_type` (not `data.request_type`) to `RequestPayloadRenderer`:

```tsx
{data.payload_type && data.payload && (
  <RequestPayloadRenderer type={data.payload_type} payload={data.payload} ... />
)}
```

- [ ] Build `ActivityCard` (exchanges this week / new members / open requests / recent helpers) and
  `StoryCard` (milestone/first-timer narrative) as presentational components matching the existing card
  visual language.

- [ ] Verify:

```bash
cd apps/frontend && npx tsc --noEmit
```

- [ ] Run `/simplify` on this task's diff.

---

## Task 6: UnifiedFeed `view` prop + texture rendering (TDD test first)

**Files:**
- Create: `apps/frontend/tests/tdd/sprint-86-unified-feed-community.test.tsx` (FIRST)
- Modify: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/components/Feed/UnifiedFeed.tsx`

- [ ] Widen `getCuratedRequests` in `api.ts`: `view?: 'home'` → `view?: 'home' | 'community'` (its current
  type would reject `view: 'community'`).

- [ ] **Write the test first**: in `view="community"` UnifiedFeed renders request cards + `ActivityCard` +
  `StoryCard` and does **not** render the `DecisionBand` or `BrowseModeControl`; in `view="home"` the
  decision band still renders. Assert it calls `getCuratedRequests` with `view: 'community'`, and that
  `payload_type` reaches `RequestPayloadRenderer` (payload detail shows).

- [ ] Add a `view: 'home' | 'community'` prop (default `'home'`). Request that view via
  `getCuratedRequests({ view, community_id, limit })`. Render `activity`/`story` items in array order
  (server-ranked). Hide the decision band + browse-mode control when `view === 'community'`.

- [ ] Verify:

```bash
cd apps/frontend && npx jest tests/tdd/sprint-86-unified-feed-community.test.tsx && npx tsc --noEmit
```

- [ ] Run `/simplify` on this task's diff.

---

## Task 7: Wire Community tab + retire legacy components

**Files:**
- Modify: `apps/frontend/src/components/community/tabs/BrowseTab.tsx`
- Delete: `BrowseFeed.tsx`, `Feed/Feed.tsx`, `Feed/FeedItem.tsx`, `FeedFilterPanel.tsx`

- [ ] `BrowseTab`: replace the bespoke request-card list with
  `<UnifiedFeed view="community" communityId={communityId} communityType={community.community_type} />`.
  Keep the triage modal, export, member-picker, and status filter that are community-management (not feed
  rendering).

- [ ] Grep for every import of the doomed components, then delete them:

```bash
cd apps/frontend && grep -rn "BrowseFeed\|Feed/Feed'\|Feed/FeedItem\|FeedFilterPanel" src
```

  Migrate any remaining `FeedFilterPanel` caller to `FilterChipRow`, then delete the four files.

- [ ] Verify nothing dangles:

```bash
cd apps/frontend && npx tsc --noEmit && npm run lint
```

- [ ] Run `/simplify` on this task's diff.

---

## Task 8: ADR-067 + ADR-066 update + landing docs + guide + onboarding

**Files:**
- Create: `docs/adr/ADR-067-request-type-payload-vocabulary.md`
- Create: `apps/landing/src/data/docs/concepts/adr-067-request-type-payload-vocabulary.json`
- Modify: `docs/adr/ADR-066-unified-feed-model.md`, `docs/adr/README.md`, `apps/landing/.../nav.json`,
  `apps/landing/.../concepts/unified-feed.json`, the unified-feed guide JSON, `workflows.ts`

- [ ] Write ADR-067: `request_type` (coarse enum, filter) vs `payload_type` (fine subtype, payload
    rendering); how it closes the ADR-066 seam; no migration (sourced from `category`). Add to
    `docs/adr/README.md` index.
- [ ] Update ADR-066 "Harder/deferred" consequences → mark legacy retirement, texture layer, and the
    `request_type` seam **resolved in Sprint 86**, link ADR-067.
- [ ] Landing: create the ADR-067 JSON (`git add -f`), add nav.json entry; update `unified-feed.json`
    concept ("two views, one model" + texture); update the unified-feed user guide (Community tab now
    shows the canonical feed; decision band is Home-only). Run `generate-docs` from `apps/landing/`.
- [ ] Update `workflows.ts` for any workflow referencing the old Browse card UI.

- [ ] **Grep-verify nav.json after** (it silently reverts) and re-apply if needed:

```bash
cd apps/landing && grep -n "adr-067\|unified-feed" src/data/docs/nav.json
```

---

## Task 9: CONTEXT.md + registry.json + feedback check

**Files:**
- Modify: `services/request-service/CONTEXT.md`, `services/registry.json`

- [ ] Document the `view=community` curated branch (request + activity + story union, no decision band)
    in request-service `CONTEXT.md` "API Endpoints" and in `registry.json` `apis.provides`.

- [ ] Verify docs completeness:

```bash
npm run feedback:check
npm run analyze:services
```

---

## Task 10: SDLC quality gates

**Files:** none (review pass on the branch diff)

- [ ] **`/simplify`** — final pass on the whole branch diff (reuse/simplification/altitude).

```bash
# resolve any findings before proceeding
```

- [ ] **`/code-review`** — run on the branch diff; resolve correctness/logic findings before merge.

```bash
# resolve correctness findings
```

- [ ] **`/security-review`** — run on the branch diff; resolve real findings, justify dismissals
    (expect the recurring `js/request-forgery` FP on `apps/frontend/src/lib/api.ts` — dismiss as FP).

```bash
# resolve real findings; document dismissals in the PR body
```

---

## Task 11: Final type check + pre-push verification

**Files:** none

- [ ] Full verification:

```bash
npx tsc --noEmit                                   # repo-wide types clean
npm test                                            # unit + regression (MUST pass)
npm run test:tdd                                    # sprint-86 TDD green (pre-existing failures only)
npm run feedback:check                              # docs complete
npm audit --package-lock-only --audit-level=high    # ADR-059 gate clean
```

- [ ] Confirm no NEW TDD regression (only the documented pre-existing failures from the handoff).

---

## Task 12: Merge + Deploy

**Files:** none

- [ ] Bump root `package.json` version `10.9.0 → 10.10.0`.
- [ ] Commit, push the branch, open a PR against master with the `pull_request_template.md` contract body
    (Summary / Validation / Docs / Quality gates / Security dismissals / Follow-ups / Lane).
- [ ] On Admin authorization ("pull it in"): admin-merge → CI/CD "Deploy to Demo" runs.
- [ ] Use the `/deploy` skill to monitor the GitHub Actions deploy. **No migration this sprint** — nothing
    to apply on the server.
- [ ] **Demo validation:**
  - `GET /requests/curated?view=community&community_id=:id` returns the ranked request+activity+story union
    (auth-gated), no decision item.
  - On a community's **Requests tab**: canonical cards render **with payload detail** (the seam fix), plus
    the activity summary + any stories; Dashboard Home still shows the decision band + payload detail.
  - Confirm the deleted legacy components don't appear anywhere (Browse tab, dashboard).

---

## Definition of Done

- [ ] `view=community` returns the ranked request+activity+story union from request-service alone (no
    feed-service call); no decision band on that path.
- [ ] Canonical `RequestCard` renders payload detail (seam fixed: `payload_type` from `category`).
- [ ] Community tab uses `<UnifiedFeed view="community" />`; `BrowseFeed`/`Feed.tsx`/`FeedItem.tsx`/
    `FeedFilterPanel.tsx` deleted; no dangling imports.
- [ ] ADR-067 created; ADR-066 deferred-consequences marked resolved; guide + concept + onboarding updated.
- [ ] `npm test`, `npm run test:tdd` (no new regressions), `npm run feedback:check` all green.
- [ ] All four SDLC gates run; shipped v10.10.0 and validated on demo.
