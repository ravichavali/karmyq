# Sprint 134 PR K — BUG-069: Admin Gates Re-derive the Live Role Implementation Plan

> ## ✅ Executed 2026-10-22 (K6 first, then K1–K9) on `agent/claude/sprint-134-pr-k-live-admin-role`
> Deviations from this plan, made by the gates: BUG-071 is fixed at the root (the admin chain covers exactly the router's own
> routes via `adminChainPaths`; the mount move in K2 was reverted). BUG-072 (split ownership) was fixed and BUG-073 logged
> from `/code-review`. Tests were promoted from `tdd/` to `regression/`. The gate derives its helper names instead of K6's list.
> See the handoff's *PR K state*.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every admin/moderator gate in a service decides from `communities.members`, never from the JWT `communities`
claim, so a demoted or removed admin loses admin powers on the next request instead of when the token expires (1 h,
`services/auth-service/src/routes/auth.ts:74`). Due **2026-10-30**.

**Architecture:** One `liveRole` module per service (request, community, reputation, social-graph) with the same API and
the same argument order, `(communityId, userId)`. Every gate this PR fixes calls it with `await`. A root static gate parses
`services/*/src` and `packages/shared/middleware` with the TypeScript AST and fails on any claim read that is not on a reviewed
hint-only allowlist, and on any un-awaited live-role call. A real-SQL integration test drives each fixed route against the
running services. ADR-102 records the rule and amends ADR-010's "no database lookup per request" consequence.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture* (Express 5: rejected async middleware reaches the
error handler, so an async gate needs no wrapper).

**Spec:** `docs/superpowers/specs/2026-10-20-sprint-134-dated-obligations-design.md` → *PR K*.
**Branch:** `agent/claude/sprint-134-pr-k-live-admin-role`, cut from `origin/master` `0321c415` (v11.97.0).
**ADR:** **ADR-102** (maintainer-allocated 2026-10-20).
**Merge order:** renewal PR (10-24 UTC) → #315 (PR L) → PR K. After #315 merges, update this branch from `origin/master`
with a merge commit (no rebase) and resolve the handoff conflict to the newer content; re-derive the version then.

## Global Constraints

- Membership table is `communities.members` (schema `communities`, plural); one row per `(community_id, user_id)`
  (`members_community_id_user_id_key`, `infrastructure/postgres/init.sql:3255`); `role` and `status` are unconstrained
  `varchar(50)` (`init.sql` `CREATE TABLE communities.members`). A live role is the `role` of the row with `status = 'active'`.
- RLS is enabled on `communities.members` (`init.sql:6765`); the service pools already read it in every existing live check
  (e.g. `services/community-service/src/routes/links.ts:16`), so the helper uses the same `query`/`pool` import as its service.
- The claim is a hint only (CLAUDE.md *Authentication*). It is also **truncated** to the 15 most recently joined communities
  (`JWT_COMMUNITIES_LIMIT`, `auth.ts:60`), so a claim-only gate also wrongly denies an admin of an older community.
- No token issuer signs a `role` field (`auth.ts:66-71`, `demoSessionService.ts:238-244`): every `user.role === 'admin'`
  branch is dead and is removed, not made live.
- A malformed community id answers `null`/`false` (→ 403), never a Postgres `22P02` (→ 500). Today the claim check 403s it.
- Helper names (the static gate's await rule keys on these exact names): `getLiveRole`, `isLiveAdmin`,
  `isLiveAdminOfAnyCommunity`, `hasLiveRoleInRequestCommunities`.
- Real-SQL tests need Postgres + the live services: CI-only on this Windows box (spec *Critical notes* 4). Local proof is the
  per-service wiring tests (helper module mocked) plus the static gate.
- New service tests start in `services/<svc>/tests/tdd/`; the root gate goes straight to `tests/regression/` (the promoter walks
  only `services/*` and `apps/*`, `scripts/promote-tdd-tests.js:8`); the promoter sweeps every green tdd file repo-wide, so
  restore unrelated promotions.
- `npm test` regenerates `apps/landing/src/data/docs/` with timestamp churn: revert it, but `git add -f` the new ADR page.
- Re-derive the version from `origin/master`'s `package.json` at PR time; the second of two open PRs re-bumps at merge.

## Inventory (spec step 1, run untruncated 2026-10-22)

`grep -rn "\.communities" services/*/src` → **136 hits in 55 files** = 90 schema-qualified SQL table references
(`communities.communities`, incl. `tablePolicy.ts:59`) + 19 reads of other objects (`row.communities_served_count`,
`behavior.communities_count`, `index.communitiesByUser`, manifest/baseline/response `.communities` in simulation) +
**27 claim reads**, classified below. The grep cannot see `packages/shared`; a separate search found the shared tenant
middleware's two claim reads.

| # | Site | Route(s) | Class | Action |
|---|---|---|---|---|
| R1 | request `middleware/adminAuth.ts:106` `requireAdmin` (+ legacy `communityMemberships` alias, dead `user.role`) | mount gate for `/admin/schemas` and the `/requests` admin-actions mount (`src/index.ts:91-97`, `:150-157`) | gate: admin of **any** community | **fix** → `isLiveAdminOfAnyCommunity` |
| R2 | request `routes/adminActions.ts:11` `isAdminOrModOfRequestCommunity` | POST/DELETE `/requests/:id/boost`, POST `/:id/propose-match`, PATCH `/:id/urgent` | gate: admin/mod of a request community | **fix** → `hasLiveRoleInRequestCommunities` |
| R3 | request `routes/collectives.ts:447` | POST `/collectives/:id/communities` | gate (OR collective admin) | **fix** → `isLiveAdmin` |
| R4 | request `routes/collectives.ts:485` | DELETE `/collectives/:id/communities/:communityId` | gate (OR collective admin) | **fix** → `isLiveAdmin` |
| C1 | community `routes/communities.ts:641` | PUT `/communities/:id/tags` | gate | **fix** |
| C2 | community `routes/communities.ts:691` | PUT `/communities/:id/location` | gate | **fix** |
| C3 | community `routes/fusions.ts:18` `isAdmin` | POST fusions, `/accept`, `/reject`, `/start-vote`, `/execute` | gate | **fix** |
| C4 | community `routes/splits.ts:20` `isAdmin` | POST splits, PUT `/assignments`, POST `/start-vote`, `/execute` | gate | **fix** |
| C5 | community `routes/trust-questions.ts:48,78,114,140,171,206` | POST/PUT/DELETE questions and choices (6) | gate: admin of any community (global resource) | **fix** → `isLiveAdminOfAnyCommunity` |
| P1 | reputation `routes/providerReviews.ts:131` | POST `/reputation/provider-trust/recalculate` | gate: admin of any community | **fix** |
| P2 | reputation `routes/reputation.ts:490,514,543,561,577` | GET+PUT `trust-evolution`, GET `evolution/history`, GET `evolution/summary`, PUT `evolution/toggle` | gate (3 reads + 2 writes) | **fix** (reads too: CLAUDE.md, visibility gates are live) |
| S1 | social-graph `routes/trustDecayConfig.ts:50` | PUT `/trust/decay-config/:communityId` | gate | **fix** |
| H1 | auth `routes/auth.ts:325` | GET `/auth/verify` echoes the token's own payload | issuer echo | stays (allowlisted) |
| H2 | request `routes/providers.ts:569` | `provider_went_on_duty` fan-out | hint: the push carries only a count (`notification-service subscriber.ts:395-413`) | stays (spec: event fan-out) |
| H3 | request `routes/requests.ts:326` | feed's default community for the caller's own effective params | hint: default | stays |
| H4 | simulation `scripts/rehearseMariaRelationshipStory.ts:49`, `scripts/rotateMariaStories.ts:69,70` | — | API client reading its own login response | stays |
| H5 | shared `middleware/tenant.ts:64,118` | sets `req.communityRole` | hint: **no service reads `communityRole`; no service imports `adminOnlyMiddleware`** (searched 2026-10-22) | stays; the gate proves it inert |

Spec-listed `social-graph database/trustEdgeDb.ts` is SQL only (`:530,:558`). Reputation's `utils/disclosureAuth.ts:86`
`isCommunityAdmin(memberships, …)` is a claim helper with **no caller**: deleted.

**Feasibility:** 21 claim reads in 12 gate sites, 31 routes, mechanical; one PR opens by 2026-10-23 and merges after #315.
No dated risk acceptance or split is needed.

**Found by the inventory (BUG-071, new):** `requesterOffersRouter` (`GET /requests/:id/offers`, `PUT /requests/offers/:id/
accept|decline`) is mounted **after** the admin-actions mount (`src/index.ts:162` vs `:150`), and nothing earlier matches those
paths (`routes/requests.ts` has no such route and no `router.use`), so `requireAdmin` 403s every requester who is not an admin
somewhere. Since 2026-03-26 (`b26e7b5d`). The frontend calls all three (`apps/frontend/src/lib/api/providerApi.ts:24,29,34`).
Fixed here (Task K2) because K rewrites the gate that causes it.

## Rulings for the maintainer (made here; veto in review)

1. Admin-only **reads** in reputation (3 GETs) are fixed with the writes: CLAUDE.md makes visibility gates live too.
2. "Admin of any community" gates (R1, C5, P1) keep that scope, now live. Whether any community's admin should edit
   platform-wide schemas, trust questions and trust backfills is a policy question, logged in `docs/IDEAS.md`, not changed.
3. BUG-071 is fixed by moving one mount, with its own test (K2).
4. The IDEAS 2026-10-08 helper item is folded in: each service gets one helper, every gate K fixes uses it, and the duplicates
   in files K touches collapse onto it (community `memberVisibility.getLiveRole`, `fusions`/`splits` `isMember`; request
   `inventoryDb.isActiveAdmin`/`isActiveMember`; social-graph `trustDecayConfig.isActiveMember`). The already-live inline queries
   elsewhere (community `members.ts`, `settings.ts`, `stats.ts`, `export.ts`, `norms.ts`, `communities.ts:741,814`, `links.ts`,
   `activities.ts`; request `providerReachService.isActiveMember`) are correct and stay; their consolidation is logged.
5. `adminOnlyMiddleware` / `req.communityRole` stay in `packages/shared` (no shared-package change in K); the gate fails if a
   service ever reads them. Deleting them is logged.
6. The `/requests` admin-actions mount keeps `requireAdmin` (admin somewhere), so a moderator who is admin nowhere still cannot
   reach the moderator-capable handlers. Pre-existing; logged, not changed.

## Review Focus

1. **Un-awaited helper call.** `if (!isLiveAdmin(…))` is a truthy Promise and opens the gate to everyone. Pinned by the
   gate's await rule (K6) and by every wiring test's "helper says no → 403" case (K1, K3–K5).
2. **Malformed community id** (`/communities/not-a-uuid/tags`, `community_id: 'x'` in a collectives body) → 403, not 500.
   Pinned by each helper's unit cases (no query issued) and the integration table (K7).
3. **Removed admin (`status = 'left'`) whose row still says `role = 'admin'`** → 403. A helper that forgets the status filter
   passes the "member" case and fails this one. Pinned in K7 for every route.
4. **Admin of a community outside the 15-entry claim** (live admin, empty claim) → admitted. Pinned as the positive control of
   every K7 row, which proves each gate reads the row, not the claim.
5. **A gate that 403s everyone** passes every negative test. Pinned by the same positive controls; each one stops at a
   validation or state check right after the gate, so it proves the gate passed without mutating, except where noted.

---

## File Map

| File | Change |
|---|---|
| `services/request-service/src/db/liveRole.ts` | **Create**: `LiveRole`, `getLiveRole`, `isLiveAdmin`, `isLiveAdminOfAnyCommunity`, `hasLiveRoleInRequestCommunities` |
| `services/request-service/src/middleware/adminAuth.ts` | `requireAdmin` async + live; drop `role`, `communityMemberships` from its `JWTPayload` |
| `services/request-service/src/routes/adminActions.ts` | `isAdminOrModOfRequestCommunity` → `hasLiveRoleInRequestCommunities(id, userId, ['admin','moderator'])` |
| `services/request-service/src/routes/collectives.ts` | `:447`, `:485` → `isLiveAdmin` |
| `services/request-service/src/db/inventoryDb.ts` | `isActiveAdmin`/`isActiveMember` delegate to `getLiveRole` (same exports, same order) |
| `services/request-service/src/index.ts` | Move the `requesterOffersRouter` mount above the admin-actions mount (BUG-071) |
| `services/community-service/src/utils/liveRole.ts` | **Create**: `LiveRole`, `getLiveRole` (moved from `memberVisibility.ts`, + UUID guard), `isLiveAdmin`, `isLiveAdminOfAnyCommunity` |
| `services/community-service/src/utils/memberVisibility.ts` | Import `LiveRole` from `./liveRole`; `getLiveRole` leaves |
| `services/community-service/src/routes/{communities,members}.ts` | Import `getLiveRole`/`LiveRole` from `../utils/liveRole`; `communities.ts` C1, C2 |
| `services/community-service/src/routes/{fusions,splits,trust-questions}.ts` | C3, C4, C5 |
| `services/reputation-service/src/utils/liveRole.ts` | **Create**: `getLiveRole`, `isLiveAdmin`, `isLiveAdminOfAnyCommunity` |
| `services/reputation-service/src/utils/disclosureAuth.ts` | Delete the uncalled claim helper `isCommunityAdmin` |
| `services/reputation-service/src/routes/{reputation,providerReviews}.ts` | P2, P1 |
| `services/social-graph-service/src/database/liveRole.ts` | **Create**: `getLiveRole`, `isLiveAdmin` |
| `services/social-graph-service/src/routes/trustDecayConfig.ts` | GET uses `getLiveRole(...) !== null`; PUT uses `isLiveAdmin` (S1) |
| `services/<4>/tests/tdd/sprint-134-pr-k-live-role.test.ts` | **Create**: helper unit cases + route wiring table |
| `tests/regression/sprint-134-pr-k-claim-gate.test.ts` | **Create**: static gate (K6) |
| `tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts` | **Create**: real-SQL table (K7) |
| `docs/adr/ADR-102-live-membership-authorization.md` + `docs/adr/README.md` + `scripts/generate-docs.ts` `ADR_GROUPS` (Foundation, after `adr-010-jwt-multi-community-auth`) | **Create** + index |
| `docs/adr/ADR-010-jwt-multi-community-auth.md` | One amendment line pointing at ADR-102 |
| 4 services' `CONTEXT.md` | Known Issues → Recent Fixes (BUG-069; request: BUG-071) |
| `docs/BUGS.md` | BUG-069 → fixed; BUG-071 logged (via the `bug` skill) and fixed |
| `docs/IDEAS.md` | 2026-10-08 helper item → partly done; follow-ups from Rulings 2, 4, 5, 6 |
| `docs/guides/admin-community-guide.md` | "Admin powers follow your current role" (published guide, `generate-docs.ts:327`) |

---

## Helper contract (all four services)

```ts
export type LiveRole = 'admin' | 'moderator' | 'member' | null;
/** Role on the caller's ACTIVE row; null for no row, a non-active row, no userId, or a malformed communityId (no query). */
export async function getLiveRole(communityId: unknown, userId: string | undefined): Promise<LiveRole>;
export async function isLiveAdmin(communityId: unknown, userId: string | undefined): Promise<boolean>; // === 'admin'
/** request, community, reputation only. False for no userId (no query). */
export async function isLiveAdminOfAnyCommunity(userId: string | undefined): Promise<boolean>;
/** request only: an active row with role ∈ roles in ANY of the request's communities. False for no userId or a malformed requestId. */
export async function hasLiveRoleInRequestCommunities(requestId: unknown, userId: string | undefined, roles: readonly Exclude<LiveRole, null>[]): Promise<boolean>;
```

SQL (each takes params in this order; `status = 'active'` in all three):
- `getLiveRole`: `SELECT role FROM communities.members WHERE community_id = $1 AND user_id = $2 AND status = 'active'`, `[communityId, userId]`
- `isLiveAdminOfAnyCommunity`: `SELECT 1 FROM communities.members WHERE user_id = $1 AND status = 'active' AND role = 'admin' LIMIT 1`, `[userId]`
- `hasLiveRoleInRequestCommunities`: `SELECT 1 FROM requests.request_communities rc JOIN communities.members m ON m.community_id = rc.community_id WHERE rc.request_id = $1 AND m.user_id = $2 AND m.status = 'active' AND m.role = ANY($3::text[]) LIMIT 1`, `[requestId, userId, roles]`

UUID guard: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`, the regex every service already copies
(`request inventoryDb.ts:66`, `reputation reputation.ts:34`, `social-graph communityContext.ts:36`); `userId` comes from the
verified JWT and needs no guard. Each helper module's unit cases (in its service's tdd file, `query`/`pool` mocked):

```ts
it('reads the active row with exact params', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [{ role: 'moderator' }], rowCount: 1 });
  expect(await getLiveRole(C, U)).toBe('moderator');
  expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'active'"), [C, U]);
});
it.each([[undefined, U], ['not-a-uuid', U], [C, undefined]])('answers null without a query for (%p, %p)', async (c, u) => {
  expect(await getLiveRole(c, u)).toBeNull();
  expect(mockQuery).not.toHaveBeenCalled();
});
it('isLiveAdmin is false for a moderator and true for an admin', ...);           // two instances, exact booleans
it('isLiveAdminOfAnyCommunity passes [userId] and is false on no rows', ...);   // where exported
```

## Wiring-test contract (K1, K3–K5)

Each service's tdd file `jest.mock`s its `liveRole` module, so the test proves the **route's** decision, not the SQL (K7 owns
the SQL). Every request carries a token whose claim says `admin` of the target community (`communities: [{ id: C, role:
'admin' }]`). The rows below run for every route in the task's table:

| Case | Helper mock answers | Expect |
|---|---|---|
| stale claim | `false` / `null` | **403**; the helper was called with exactly `(C, U)` (or `(U)` / `(REQ, U, roles)`); `query` saw no `INSERT`/`UPDATE`/`DELETE` |
| live admin, **empty** claim | `true` / `'admin'` | status **≠ 403** (the exact status per row, read from the handler) |

---

### Task K1: request-service helper and gates R1–R4

**Files:** Create `services/request-service/src/db/liveRole.ts`; modify `middleware/adminAuth.ts`, `routes/adminActions.ts`,
`routes/collectives.ts`, `db/inventoryDb.ts`; test `services/request-service/tests/tdd/sprint-134-pr-k-live-role.test.ts`.

**Interfaces:** Produces the helper contract above (all four functions) from `../db/liveRole` / `./liveRole`.

- [ ] **Step 1: Write the failing tests.** Helper unit cases (contract above, for all four functions, incl. `hasLiveRoleInRequestCommunities`
  passing `[REQ, U, ['admin','moderator']]`). Wiring table over the **real app** (`(await import('../../src/index')).default`, the
  `sprint-132-inventory-routes.test.ts` pattern: `JWT_SECRET` set before import, `database/db` mocked): `GET /admin/schemas`;
  `POST`/`DELETE /requests/:id/boost`, `POST /requests/:id/propose-match`, `PATCH /requests/:id/urgent` (mock the request-exists
  query to return the row so the gate is reached); `POST /collectives/:id/communities {community_id: C}` and `DELETE
  /collectives/:id/communities/:C` (collective-admin query returns no row). For the admin-actions routes the stale case covers
  both layers: `isLiveAdminOfAnyCommunity → false` → 403; then `true` with `hasLiveRoleInRequestCommunities → false` → 403.
- [ ] **Step 2: Run** `npm exec --workspace=@karmyq/request-service -- jest --runTestsByPath tests/tdd/sprint-134-pr-k-live-role.test.ts`.
  Expected: FAIL (module `../../src/db/liveRole` not found).
- [ ] **Step 3: Implement** `db/liveRole.ts` per the contract (`query` from `../database/db`). `requireAdmin` becomes `async`,
  401 unchanged, 403 unless `await isLiveAdminOfAnyCommunity(user.userId)`. `adminActions` calls
  `hasLiveRoleInRequestCommunities(id, user.userId, ['admin', 'moderator'])` at the four call sites. `collectives` uses
  `await isLiveAdmin(community_id, userId)` / `(communityId, userId)`. `inventoryDb.isActiveAdmin = (c, u) => isLiveAdmin(c, u)`,
  `isActiveMember = async (c, u) => (await getLiveRole(c, u)) !== null`; move `UUID_RE` into `liveRole.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `npm test --workspace=@karmyq/request-service` and
  `npx tsc --noEmit -p services/request-service`: green (fix any existing test whose mock now meets the live query).
- [ ] **Step 5: Commit** `fix(request-service): admin gates re-derive the live role (BUG-069)`.

### Task K2: BUG-071 requester-offers mount

**Files:** modify `services/request-service/src/index.ts`; test: add to the K1 tdd file; `docs/BUGS.md` via the `bug` skill.

- [ ] **Step 1: Log BUG-071** with the `bug` skill (text: the Inventory paragraph above; proposed **MEDIUM**).
- [ ] **Step 2: Write the failing test** `it('a requester who is admin nowhere reaches the requester-offers routes (BUG-071)')`:
  `isLiveAdminOfAnyCommunity → false`, member-only claim; `GET /requests/:id/offers` with the request row owned by the caller
  → **200**; `PUT /requests/offers/:id/decline` → not `403 "Admin access required"` (the exact status from `requesterOffers.ts:70`'s
  path with the mocked rows).
- [ ] **Step 3: Run** it. Expected: FAIL, 403 `Admin access required`.
- [ ] **Step 4: Move** `app.use('/requests', rateLimiters.standard, requesterOffersRouter)` directly after the `dibsRouter` mount,
  extending that mount's "must be registered BEFORE adminActionsRouter" comment to name the offer routes.
- [ ] **Step 5: Run** it and the request-service suite. Expected: PASS. **Commit** `fix(request-service): requester-offer routes no longer pass the admin mount (BUG-071)`.

### Task K3: community-service helper and gates C1–C5

**Files:** Create `services/community-service/src/utils/liveRole.ts`; modify `utils/memberVisibility.ts`, `routes/communities.ts`,
`routes/members.ts` (import line only), `routes/fusions.ts`, `routes/splits.ts`, `routes/trust-questions.ts`; test
`services/community-service/tests/tdd/sprint-134-pr-k-live-role.test.ts`.

**Interfaces:** Produces `getLiveRole`, `isLiveAdmin`, `isLiveAdminOfAnyCommunity`, `LiveRole` from `../utils/liveRole`.

- [ ] **Step 1: Write the failing tests.** Helper unit cases. Wiring table, routers mounted on a bare `express()` behind a stub
  auth that sets `req.user` (the `sprint-91-feed-router` pattern) at the `src/index.ts` paths: PUT `/communities/:C/tags`, PUT
  `/communities/:C/location`; fusions `POST /communities/:C/fusions` and the four `:fusionId` actions (mock `fusionsDb.getFusionProposal`
  to return a proposal with `community_a_id: C`, `community_b_id: C2`; the stale case makes the helper deny both); splits `POST
  /communities/:C/splits` and the three `:splitId` actions; the six trust-question writes (`isLiveAdminOfAnyCommunity`).
- [ ] **Step 2: Run** `npm exec --workspace=@karmyq/community-service -- jest --runTestsByPath tests/tdd/sprint-134-pr-k-live-role.test.ts`.
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Move `LiveRole` + `getLiveRole` from `memberVisibility.ts` into `liveRole.ts` with the UUID guard;
  update the two importers. C1/C2: `if (!(await isLiveAdmin(communityId, user?.userId)))`. C3/C4: delete the local `isAdmin` and
  `isMember`; call `await isLiveAdmin(…, req.user?.userId)` at each of the 9 sites (start-vote/execute: admin of `a` **or** `b`),
  and `(await getLiveRole(communityId, userId)) !== null` where `isMember` was used. C5: `await isLiveAdminOfAnyCommunity(user.userId)` ×6.
- [ ] **Step 4: Run** the tdd file, `npm test --workspace=@karmyq/community-service`, `npx tsc --noEmit -p services/community-service`.
  Expected: green. **Step 5: Commit** `fix(community-service): admin gates re-derive the live role (BUG-069)`.

### Task K4: reputation-service helper and gates P1–P2

**Files:** Create `services/reputation-service/src/utils/liveRole.ts`; modify `utils/disclosureAuth.ts` (delete `isCommunityAdmin`),
`routes/reputation.ts`, `routes/providerReviews.ts`; test `services/reputation-service/tests/tdd/sprint-134-pr-k-live-role.test.ts`.

- [ ] **Step 1: Write the failing tests.** Helper unit cases; wiring table for the five `reputation.ts` routes (`isLiveAdmin(C, U)`)
  and `POST /reputation/provider-trust/recalculate` (`isLiveAdminOfAnyCommunity(U)`; mock `backfillAllProviderTrustScores`
  so the positive case returns 200 with `{ updated }` and the stale case proves it was **not** called).
- [ ] **Step 2: Run** it (`--workspace=@karmyq/reputation-service`). Expected: FAIL.
- [ ] **Step 3: Implement**; drop the dead `user.role` branch. **Step 4:** tdd file + workspace suite + `tsc`: green.
- [ ] **Step 5: Commit** `fix(reputation-service): admin gates re-derive the live role (BUG-069)`.

### Task K5: social-graph-service helper and gate S1

**Files:** Create `services/social-graph-service/src/database/liveRole.ts` (`pool` from `../config/database`); modify
`routes/trustDecayConfig.ts`; test `services/social-graph-service/tests/tdd/sprint-134-pr-k-live-role.test.ts`.

- [ ] **Step 1: Write the failing tests.** Helper unit cases (`getLiveRole`, `isLiveAdmin`); wiring: PUT `/trust/decay-config/:C`
  (stale → 403 and `upsertDecayConfig` not called; live admin → 200), GET `/trust/decay-config/:C` keeps its 404
  `DECAY_CONFIG_NOT_AVAILABLE` for `getLiveRole → null` and 200 for `'member'`.
- [ ] **Step 2: Run** (`--workspace=@karmyq/social-graph-service`). Expected: FAIL.
- [ ] **Step 3: Implement**: delete the local `isActiveMember`; GET `(await getLiveRole(...)) !== null`; PUT `await isLiveAdmin(...)`,
  no `user.role` branch. **Step 4:** green. **Step 5: Commit** `fix(social-graph-service): decay-config PUT re-derives the live role (BUG-069)`.

### Task K6 (executed FIRST, as K0): static claim gate

Written before K1 so it fails on the unfixed tree first: that run is the proof it can fail on real code, not only on fixtures.

**Files:** Create `tests/regression/sprint-134-pr-k-claim-gate.test.ts` (uses `./helpers/workspaces` `tracked`/`read` and
`typescript`, like `sprint-131-dotenv-quiet.test.ts`).

**Interfaces:** `export function scanClaims(files: SourceFile[]): ClaimHit[]` and `export function violations(files, allowlist): string[]`
inside the test file (not exported to other files).

- [ ] **Step 1: Write the gate.** Sources: `tracked(':(glob)services/*/src/**/*.ts', ':(glob)packages/shared/middleware/**/*.ts')`
  minus `__tests__` (`:(glob)` per `docs/gotchas/git-pathspec-double-star-needs-glob-magic.md`). Rules, each with a negative fixture
  that must produce exactly one violation:
  1. **Claim read**: a property or element access named `communities` or `communityMemberships`, or a destructured binding of either,
     whose receiver (after stripping `!`, `?.`, parentheses and `as` casts) is an identifier `user`/`decoded` or a property access
     named `user`. Each hit must match exactly one `ALLOWLIST` entry `{ file, line: <trimmed source line>, reason }`, and each entry
     must match exactly one hit (identity, not a count). Entries: H1, H2, H3, the three H4 lines, the two H5 lines. Fixtures:
     `req.user!.communities.some(...)`, `(req as any).user?.['communities']`, `const { communities } = req.user`.
  2. **Await**: every call to `getLiveRole`, `isLiveAdmin`, `isLiveAdminOfAnyCommunity`, `hasLiveRoleInRequestCommunities` is the
     operand of `await` (definitions excluded). Fixture: `if (!isLiveAdmin(c, u)) return;`.
  3. **Inert tenant role**: no service file reads `communityRole` or imports `adminOnlyMiddleware`. Fixture: a route reading
     `req.communityRole === 'admin'`.
  4. **Scans enough**: ≥ 9 `src/index.ts` files and ≥ 200 files scanned; `tenant.ts` is among them.
- [ ] **Step 2: Run it on the unfixed tree** (`npm exec --workspace=tests -- jest --runTestsByPath regression/sprint-134-pr-k-claim-gate.test.ts`).
  Expected: the live-source case FAILS listing **exactly** the 21 claim reads of rows R1–S1 (compare the `file:line` set to the
  Inventory) plus adminAuth's `communityMemberships` alias, and nothing else; every fixture case passes.
- [ ] **Step 3: Commit** `test: static gate on JWT-claim role reads (BUG-069, ADR-102)` (local only; nothing is pushed until K1–K5
  turn it green). After K5, re-run: PASS.

### Task K7: real-SQL integration table

**Files:** Create `tests/integration/sprint-134-pr-k-live-admin-role.integration.test.ts` (the PR A file's pattern: `createPool`,
`ServiceUrls`, tokens signed with `process.env.JWT_SECRET || 'dev-secret-key'`, `randomUUID` fixtures, `afterAll` cleanup;
"unavailable infrastructure fails").

- [ ] **Step 1: Write it.** Fixtures: communities C, C2; users: `A` (active admin of C, **empty claim**), `M` (active member of C,
  claim says admin of C), `F` (row `admin` + `status 'left'` in C, claim says admin of C), `O` (requester, member of C), `A2`
  (active admin of C2); a request in C; a fusion proposal (C→C2) and a split proposal (C) in states that stop each handler right
  after the gate; a provider collective with no members. One `it.each` row per route in Tasks K1–K5 (31 routes), each with three
  cases: `M` → **403**, `F` → **403**, `A` → the row's exact non-403 status. Choose each row's body/state so `A` stops at the first
  validation or state check after the gate (e.g. tags `{ tags: 'x' }` → 400; fusion accept on a `discussion` proposal → 422); where
  no such check exists (boost, `/admin/schemas` GET, decay-config PUT), `A` succeeds on a disposable fixture and the row asserts the
  write. After each `M`/`F` case, assert the target row is unchanged. Plus: malformed ids (`/communities/not-a-uuid/tags` by `A`,
  collectives `{ community_id: 'not-a-uuid' }` by `A`) → **403**; BUG-071: `O` (admin nowhere) `GET /requests/:id/offers` → **200**.
- [ ] **Step 2:** It cannot run here (no Postgres). Type-check it: `npx tsc --noEmit -p tests` (or the workspace's jest
  `--listTests` + ts-jest compile) and review every SQL column against `init.sql`. CI's Integration Tests job is the arbiter.
- [ ] **Step 3: Commit** `test(integration): stale admin claims are refused on every fixed gate (BUG-069)`.

### Task K8: ADR-102 and the docs feedback loop

- [ ] ADR-102 (`template.md` shape; Status **Accepted**, Implemented on deploy): Context (BUG-069, BUG-065 precedent, the 15-entry
  truncation, dead `role`), Decision (live role per service, the helper contract, the claim as hint only, the allowlist), Consequences
  (one indexed lookup per gated request; role changes take effect on the next request; ADR-010's "no database lookup" no longer
  holds for authorization), Alternatives (shorter token TTL; revocation list; shared-package helper, rejected: a shared helper needs
  every service's pool and couples the lanes). Index it in `docs/adr/README.md` (*Core Architecture*, top) and `ADR_GROUPS`.
  ADR-010 gets `**Amended by** [ADR-102](…): authorization re-derives the role from live membership; the claim is a hint.`
- [ ] CONTEXT.md ×4 (Recent Fixes), `docs/BUGS.md` (BUG-069 fixed; BUG-071 fixed), `docs/IDEAS.md` (update the 2026-10-08 item;
  append the Rulings 2/4/5/6 follow-ups), the guide paragraph (avoid the license-gate phrases, `docs/gotchas/license-gate-…`).
- [ ] `npm run feedback:check` (advisory; it reads `--cached`, so run it before committing); regenerate landing docs; revert the
  churn; `git add -f` the ADR-102 page. **Commit** `docs: ADR-102 live-membership authorization; BUG-069/071 records`.

### Task K9: gates, version, handoff, PR

- [ ] `npm test` (root, 27 tasks) → restore unrelated tdd promotions → commit this PR's promoted tests; `npm test --workspace=tests`;
  `tsc --noEmit` in request, community, reputation, social-graph.
- [ ] `/simplify` (one pass), `/code-review` **high** (4-service authorization change), `/security-review`; fix or rule each finding.
- [ ] Version = `origin/master` minor + 1 at PR time (`package.json` + the version line(s) the drift gate reads).
- [ ] Handoff: this branch's `CURRENT_HANDOFF.md` starts from PR L's (`origin/agent/claude/sprint-134-pr-l-legacy-handlers`); add a
  *PR K state* section and mark PR K **open, awaiting maintainer merge**; push; open the PR; report the link; stop.

## Human validation (maintainer, after deploy; ask before any demo data operation)

As a community admin on karmyq.com: in a second browser, have another admin demote you to member; without logging out, try
**Update tags** → refused ("Only community admins can update tags"). As a requester who administers nothing, open a request with
a provider offer and accept it → accepted (BUG-071).
