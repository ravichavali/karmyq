# Sprint 133 PR V — Request and Offer Read Boundary (BUG-065, BUG-064) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **One PR.** Branch `agent/claude/sprint-133-pr-v-visibility`, cut 2026-10-16 from `d5276e2c` (= `origin/master`
> `36a9972f` + the PR Q post-deploy doc flips and this sprint's handoff). PR Q (#305) is shipped. **PR D waits until this PR
> deploys green.** BUG-065 is HIGH with a **2026-10-17** deadline: see Task V0.

**Goal:** A caller can list only the requests they could open one by one, and read only the standing offers of communities
they belong to (or their own). Every community-scoped request read decides membership from `communities.members`, not
from the JWT claim.

**Architecture:** The visibility boundary that `GET /requests/:id` enforces since BUG-056 (own ∨ any-status match
responder ∨ pre-selected provider ∨ directed audience ∨ reachable) becomes **one SQL fragment** in
`services/request-service/src/db/eligibility.ts`. `getRequestReachability` and the list builder both use it, so the
list and the detail route can't drift apart. Standing offers get an owner-or-live-member predicate on every read. Every
"offer not yours" answer becomes the same 404 as a missing id.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Request-service only. No migration, no
dependency edit, no `packages/shared` change, no event change.

**Spec:** there is no separate spec document (PR Q precedent). This plan argues from:
- [`docs/BUGS.md`](../../BUGS.md) **BUG-065** and **BUG-064** (both with the maintainer decisions of 2026-10-16 recorded
  in place);
- [`docs/superpowers/specs/2026-10-08-sprint-133-skills-depth-design.md`](../specs/2026-10-08-sprint-133-skills-depth-design.md)
  Critical Note 2 (the BUG-056 detail gate this PR generalizes) and Note 5 (live membership only);
- the maintainer decisions of 2026-10-16, recorded in `.claude/handoff/CURRENT_HANDOFF.md`:
  1. **Bundle** into one request-service PR before PR D.
  2. **BUG-065:** the list uses **the same boundary as the detail route**. Directed asks stay out of public browsing.
  3. **BUG-064:** offers are readable by the **offerer and live members of the offer's community** (`is_public` is
     not consulted).
  4. **BUG-068 is not in this PR.** Its route has no client (the web app rates through reputation-service
     `POST /reputation/feedback`; only `simulation-service/src/api-client.ts:461` calls the dead route, with
     `.catch(() => null)`). It is reclassified as a dead route and **retired in the ADR-101 legacy-handler removal PR**,
     before its 2026-10-29 deadline.

## Global Constraints

- **Request-service only.** Never touch another service, `packages/shared`, `package.json` or `package-lock.json`.
- **No new membership helper.** Two already exist with **opposite argument orders**:
  `db/inventoryDb.ts:66 isActiveMember(communityId, userId)` and
  `services/providerReachService.ts:74 isActiveMember(userId, communityId)`. Use the `inventoryDb` one and name
  arguments at each call site in review. Consolidating the two is a `/simplify` candidate, not a requirement.
- **Fail closed and look absent.** Every out-of-boundary single read returns the route's existing 404 body for a
  missing id (no 403 that reveals existence). Lists omit the row.
- **Response shapes are unchanged** for callers inside the boundary (same columns, same envelope).
- **The directed-surface hash gate.** `services/request-service/tests/helpers/directedSurfaceScan.ts` pins the hash of
  every `help_requests` query that skips the directed predicate (`tests/helpers/directedSurfaceAllowlist.json`). Editing
  such a query changes its hash: re-pin it **with an updated `reason`** and say so in the PR description. Never delete
  an entry to make the gate pass.
- **New sprint tests start in `services/request-service/tests/tdd/`**. Root integration tests go in
  `tests/integration/*.integration.test.ts`, the only place CI's Integration Tests job looks. Promote when green and
  restore any unrelated file the promoter sweeps (memory: *TDD promoter sweeps unrelated files*).
- **Before every push:** `npm exec --workspace=tests -- jest regression` (about 1 min). Root gates read this service's
  source (memory: *Re-run root gates after review fixes*).
- **Version:** the minor from `origin/master` **at merge time** (11.88.0 today → 11.89.0 unless something merges first).
- **Demo:** the post-deploy smoke is read-only. Any demo write needs per-operation authorization; name lane "PR V".

## Review Focus

Failure modes a green unit suite would not show. Each one has its test in the owning task:

1. **List and detail drift.** Two hand-written predicates diverge the first time one is edited. Task V3 builds one
   fragment; Task V2's parity test checks every (viewer, ask) pair against the detail route's status **by identity**,
   with each legitimate difference named (see the exception table in V2).
2. **Positional parameter drift in `buildRequestsQuery`.** It computes `$n` by counting
   (`utils/queryBuilder.ts:40`, `requesterParam`). A new bound viewer parameter shifts every later index. Real SQL is
   the only proof: the root integration test, plus a unit test that every `$n` in the text has a param.
3. **`requester_id` spoofing.** `requester_id === viewer_id` selects the private "my requests" list
   (`queryBuilder.ts:57`). Any other `requester_id` is browse and must be gated: an outsider listing
   `?requester_id=<R>` sees only R's asks they could open.
4. **A stale-claim gate survives.** Four community-read routes in `routes/requests.ts` check the JWT claim. A test
   removes the member (`status='left'`) while their token still lists the community, and expects 403 from each.
5. **Offer existence oracle.** `PUT`/`DELETE /offers/:id` answer 403 for a foreign offer and 404 for a missing one, and
   `POST /matches` with `offer_id` answers 404 / 400 / 403 for missing / inactive / foreign. After this PR, a foreign
   offer is indistinguishable from a missing one on every route.

## Read-surface inventory (verified 2026-10-16 on `d5276e2c`)

`grep -n "FROM requests.help_requests\|FROM requests.help_offers" services/request-service/src -r`, every hit mapped to
its enclosing handler. Re-run it untruncated in Task V1 and paste the final classification into the PR description.

| Site | Today | PR V |
|---|---|---|
| `GET /requests` → `utils/queryBuilder.ts:25 buildRequestsQuery` | no boundary; only `notDirectedSql` | **V4**: shared fragment |
| `GET /requests/:id` (`routes/requests.ts:1609`) | BUG-056 gate (JS over SQL flags + `getRequestReachability`) | **V3**: same fragment, behavior unchanged |
| community feed view (`routes/requests.ts:1336`, in the `view=community` handler) | JWT claim | **V5**: live membership |
| `GET /requests/community/:communityId/pulse` (`:1422`) | JWT claim | **V5** |
| `GET /requests/community/:communityId/open-asks` (`:1463`, `:1467`) | JWT claim | **V5** |
| `GET /requests/retention-policy?communityId` (`:1553`) | JWT claim | **V5** |
| curated feed `handleCuratedFeed` (`:265`, queries `:391`, `:490`), `services/feed/feedComposer.ts`, `basicFeedRanker.ts` | feed visibility tiers | unchanged (already the source of the boundary) |
| `PUT /:id`, `DELETE /:id`, `PUT /:id/privacy`, `PATCH /:id/admin-triage` | owner / admin writes | unchanged (classify in V1) |
| `routes/dibs.ts:36,139`, `routes/providerOffers.ts:56` | dibs / provider flows | unchanged (classify in V1) |
| `GET /offers` (`routes/offers.ts:16`) | no boundary | **V6**: owner ∨ live member |
| `GET /offers/:id` (`:64`) | no boundary | **V6** |
| `PUT /offers/:id`, `DELETE /offers/:id` (`offers.ts:167`, `:242`) | owner check, but 403 vs 404 oracle | **V6**: one 404 |
| `POST /matches` offer lookup (`routes/matches.ts:203-229`) | 404 / 400 / 403 oracle | **V6**: one 404 for missing ∨ foreign |
| `matches.ts:41,105,577,716`, `feedback.ts:127`, `basicFeedRanker.ts:177` | offer joined into a participant-scoped match read | unchanged |

**Out of scope, logged as BUG-069** (planning, 2026-10-16): admin-*write* checks that read the JWT claim
(`middleware/adminAuth.ts:106`, `routes/adminActions.ts:11`, `routes/collectives.ts:447,485`, plus sites in
community, reputation and social-graph services). It is a cross-service class with a 1-hour exposure window
(`auth-service/src/routes/auth.ts:74`). `routes/requests.ts:310` (`primaryCommunityId` default) and `providers.ts:569`
(on-duty event fan-out) read the claim as a hint, not a gate: leave them.

## File map

### New files
| File | Responsibility |
|---|---|
| `services/request-service/tests/tdd/sprint-133-pr-v-read-boundary.test.ts` | Unit: fragment shape, builder params, route wiring (mocked `query` only where the SQL text is what's asserted) |
| `tests/integration/sprint-133-pr-v-read-boundary.integration.test.ts` | Real SQL: list/detail parity matrix, stale-claim 403s, offer boundary, offer oracles |

### Modified files
| File | Change |
|---|---|
| `services/request-service/src/db/eligibility.ts` | Export `requestReachableSql(alias, viewerParam)` and `requestReadableSql(alias, viewerParam)`; `getRequestReachability` reuses the reachable parts |
| `services/request-service/src/utils/queryBuilder.ts` | Browse branch ANDs `requestReadableSql('r', $viewer)`; viewer always bound |
| `services/request-service/src/routes/requests.ts` | `GET /` passes viewer unconditionally; detail gate uses the fragment; four claim gates → `isActiveMember` |
| `services/request-service/src/routes/offers.ts` | Boundary on `GET /`, `GET /:id`; single 404 on `PUT`/`DELETE` |
| `services/request-service/src/routes/matches.ts` | Offer lookup `WHERE id=$1 AND offerer_id=$2` → one 404 |
| `services/request-service/tests/unit/queryBuilder.test.ts` | Params/positions for the always-bound viewer |
| `services/request-service/tests/helpers/directedSurfaceAllowlist.json` | Re-pin edited hashes, with reasons |
| `services/request-service/CONTEXT.md`, `services/registry.json` | §3.1 `GET /requests`, §3.2 offers, Recent Changes; registry notes |
| `docs/guides/making-requests-guide.md`, `docs/guides/fulfilling-requests-guide.md` | "Who can see your request"; "Finding Requests" boundary + a new "Standing offers" section (no guide documents standing offers today) |
| `docs/BUGS.md` | BUG-064 and BUG-065 → fixed with the version |

---

## ⚠️ Critical Implementation Notes (read before Task V2)

1. **One predicate, two consumers.** `requestReadableSql(r, $v)` =
   `r.requester_id = $v`
   ∨ `EXISTS (matches WHERE request_id = r.id AND responder_id = $v)` (any status: BUG-056)
   ∨ `EXISTS (provider_profiles WHERE id = r.preferred_provider_id AND user_id = $v)`
   ∨ (`r.is_directed` ∧ `directedAudienceSql(r, $v)`)
   ∨ (`NOT r.is_directed` ∧ `requestReachableSql(r, $v)`).
   `requestReachableSql` = active member of a request community ∨ sister-reachable (`community_links.status='active'
   AND show_in_sister_feeds`) ∨ `visibility_scope IN ('trust_network','platform')`. Lift the `EXISTS` bodies **verbatim**
   from `getRequestReachability` (`db/eligibility.ts:38-63`) and make that function use the new fragment, so there is
   exactly one copy. The detail route keeps its JS combination for `viewer_relation`. Its gate must produce the same
   200/404 as before for every PR S test (`tests/integration/sprint-133-request-detail-visibility.integration.test.ts`
   and `services/request-service/tests/regression/sprint-133-request-detail-visibility.test.ts` stay green
   **unedited**).
2. **The browse list still excludes directed asks.** `queryBuilder.ts:57` keeps `notDirectedSql('r')` on the browse
   branch. `requestReadableSql` is ANDed on top. The private branch (`requester_id === viewer_id`) keeps
   `directedAudienceSql` and needs no extra gate (own rows).
3. **Bind the viewer on every query.** Today the viewer is bound only `if (viewer_id)` (BUG-002 exclusion). Bind it
   always (`viewer_id ?? null`), and keep the BUG-002 `NOT EXISTS` conditional on a non-null viewer. With a null
   viewer the fragment still admits `platform`/`trust_network` asks, exactly as the detail route does for
   `userId=null`. Every router here sits behind `authMiddleware` (`src/index.ts:130-137`), so null is defensive only.
4. **Parity has named exceptions, not silent ones.** The list legitimately differs from the detail route in exactly
   three ways: it drops `expired = TRUE` rows (`queryBuilder.ts:56`), it drops directed asks from browse, and it drops
   the viewer's own live `proposed`/`matched` matches (BUG-002). The parity test asserts
   `inList(v, a) === (detail(v, a) === 200) && !exception(v, a)` for **every** pair and lists each exception with its
   reason. A count comparison does not satisfy this (memory: *Gates that assert weaker than they claim*).
5. **Live membership for community reads.** Replace the four claim checks (`routes/requests.ts:1336`, `:1422`,
   `:1467`, `:1553`) with `await isActiveMember(communityId, userId)` from `db/inventoryDb.ts`. Keep each route's
   existing 403 code and message (members are entitled to know they're not members). Update the doc comments that say
   "gated on the JWT `communities` claim" (`:1461`, and the pulse comment near `:1414`).
6. **Offer boundary.** `GET /offers` adds
   `AND (o.offerer_id = $v OR EXISTS (SELECT 1 FROM communities.members cm WHERE cm.community_id = o.community_id AND
   cm.user_id = $v AND cm.status = 'active'))`. A client-supplied `community_id` filter narrows within the boundary and
   never widens it. `GET /offers/:id` applies the same predicate in SQL and returns the existing 404 body. `PUT` and
   `DELETE` select `WHERE id = $1 AND offerer_id = $2` and return the existing 404 for zero rows (drop the 403 branch).
   `POST /matches` (`matches.ts:203`) does the same and then checks `status !== 'active'` → 400, which is safe
   because only the owner reaches it.
7. **`is_public` and `offerer_visibility_consent` are not read by the boundary.** Grep them in V1. If any UI promises
   that a public offer is visible outside the community, stop and ask the maintainer rather than reinterpret.
8. **Who sees fewer rows after deploy.** `useCommunityData.ts:178` (members: unchanged), `providerApi.ts:19` (open
   asks with no community: now only reachable ones), `CommitmentsTab.tsx:189` and `MyRequestsTab.tsx:60` (own list:
   unchanged), `pages/offers/index.tsx:43` (now only member communities' offers), and simulation
   `api-client.ts:67` (actors are members of their communities; confirm the simulation suite stays green). Name each
   in the PR description.
9. **No index work.** `communities.members` has `(community_id)` and `(user_id)` indexes, `request_communities` has
   both columns indexed, and `matches` has `(request_id)` and `(responder_id)` (`init.sql:4428-4440, 5076-5082,
   5148-5154`). No migration is planned. If review asks for a composite index, that's a separate migration PR.
10. **BUG-065 deadline.** See Task V0. A dated risk acceptance is the maintainer's to sign; never write one as
    accepted on their behalf.

---

## Task V0: Precondition and deadline

- [ ] `git fetch origin && git log --oneline -1 origin/master` is `36a9972f` (or later, with no request-service change
  in between: `git diff 36a9972f origin/master --stat -- services/request-service`). If master moved, merge it into
  this branch (merge commit, no rebase).
- [ ] **If PR V is not merged by the end of 2026-10-17**, add a dated risk-acceptance block under BUG-065 in
  `docs/BUGS.md` stating: exposure (any signed-in user can list any community's non-directed open asks), mitigations
  in place (detail route gated since v11.84.0; directed asks excluded; admin notes gated), the fix in flight (this PR),
  and a new date, **2026-10-20**. Mark it `PROPOSED, awaiting maintainer sign-off` and ask the maintainer to accept it.
  Commit it on this branch.

## Task V1: Inventory

- [ ] Re-run untruncated:
  `grep -rn "FROM requests.help_requests\|FROM requests.help_offers\|JOIN requests.help_offers\|user?.communities\|user!.communities\|user.communities" services/request-service/src`
  and confirm every hit is classified in the table above. Add any new row; never drop one.
- [ ] `grep -rn "is_public\|offerer_visibility_consent" services apps/frontend/src` and classify (Critical Note 7).
- [ ] Record both results in the PR description draft
  (`.superpowers/sdd/2026-10-16-sprint-133-pr-v-visibility/progress.md`, local).

## Task V2: TDD tests first

**Files:** create `services/request-service/tests/tdd/sprint-133-pr-v-read-boundary.test.ts` and
`tests/integration/sprint-133-pr-v-read-boundary.integration.test.ts`; modify `services/request-service/tests/unit/queryBuilder.test.ts`.

- [ ] **Root integration (real SQL; fails, never skips, under `CI=true` without a DB).** Copy the fixture style of
  `tests/integration/sprint-133-request-detail-visibility.integration.test.ts` (users R, M, X, H; communities C, OTHER;
  `jwt.sign` with `communities: []`) and extend it:
  - communities: C, OTHER, SISTER (an active `community_links` row C↔SISTER with `show_in_sister_feeds=TRUE`), FAR;
  - users: R (requester, C), M (member C), S (member SISTER), X (member OTHER), H (completed match on a C ask, then
    `status='left'`), P (pre-selected provider via `requests.provider_profiles` + `r.preferred_provider_id`, member of
    FAR only), L (member C whose JWT lists C but whose row is `status='left'`);
  - asks by R in C: `community`-scope, `trust_network`-scope, `platform`-scope, an expired `community` ask, a
    directed ask (inventory borrow, as in the PR S test), and a second R ask where M holds a live `proposed` match;
  - **parity matrix:** for every viewer in {R, M, S, X, H, P, L} and every ask: `GET /requests/:id` status, and
    whether `GET /requests?community_id=C&limit=200` contains the id. Assert Critical Note 4 for every pair, and assert
    specifically that X's list omits the `community` ask (the BUG-065 reproduction), S's list includes it (sister),
    H and P see the asks they're entitled to, and L sees none of the `community` asks;
  - `GET /requests?requester_id=<R>` as X returns only the trust_network and platform asks;
  - **stale claim:** L's token lists C in `communities`; the pulse, open-asks, community feed view and
    `retention-policy?communityId=C` all return 403 for L and 200 for M;
  - **offers:** an offer by M in C. M and R (member) see it in `GET /offers` and `GET /offers/:id`. X gets no row and
    a 404. M sees their own offer after leaving C. `?community_id=C` as X returns zero rows;
  - **offer oracles:** X's `PUT` and `DELETE /offers/<M's offer>` and `/offers/<random uuid>` return the same status and
    body. `POST /matches` by X with `offer_id=<M's offer>` and `offer_id=<random uuid>` return the same status and body.
  - Cleanup in `afterAll` as in the PR S test (FK order: matches, outbox, offers, requests, items, provider_profiles,
    links, members via community delete, users).
- [ ] **Workspace TDD (unit):** `buildRequestsQuery` binds the viewer on every call and contains the fragment on the
  browse branch but not the private branch; every `$n` in `queryText` is `<= params.length` and every param is used
  (parse the text: guards Review Focus 2); `requestReadableSql('r', '$9')` contains `directedAudienceSql('r', '$9')`
  and `requestReachableSql('r', '$9')` verbatim (single-source guard).
- [ ] **Verify red:** `npm exec --workspace=services/request-service -- jest tests/tdd/sprint-133-pr-v-read-boundary` fails
  on the missing exports. The integration file is proven red in CI (no local Docker on the Windows box), so check the
  first CI run's Integration Tests log and confirm the new file ran and failed where expected.

## Task V3: The shared fragment

**Files:** modify `services/request-service/src/db/eligibility.ts`, `services/request-service/src/routes/requests.ts`
(detail gate only).

- [ ] Export `requestReachableSql(alias, viewerParam)` and `requestReadableSql(alias, viewerParam)` (Critical Note 1).
  `getRequestReachability` selects `requestReachableSql`'s parts as columns (`is_member`, `sister_reachable`) from the
  same strings, so its return value is byte-for-byte unchanged.
- [ ] The detail route keeps its SQL and JS. Only replace pieces if that makes it read the shared strings without
  changing any status. The PR S tests stay green unedited.
- [ ] **Verify:** TDD unit green for the fragment; `npm exec --workspace=services/request-service -- jest --testPathPatterns "tests/(unit|regression)"` green; `npx tsc --noEmit -p services/request-service`.

## Task V4: List gate (BUG-065)

**Files:** modify `services/request-service/src/utils/queryBuilder.ts`, `services/request-service/src/routes/requests.ts:188-228`,
`services/request-service/tests/unit/queryBuilder.test.ts`.

- [ ] Bind the viewer always (Critical Note 3). On the browse branch, AND `requestReadableSql('r', $viewer)`.
  Replace the counting arithmetic for `requesterParam` with a push-and-return helper
  (`const bind = (v) => (params.push(v), `$${params.length}`)`) if it removes the positional coupling, but only if
  every existing `queryBuilder.test.ts` case still passes with updated expected params (no deleted assertions).
- [ ] Re-pin `directedSurfaceAllowlist.json` for any edited hash, with a reason naming BUG-065.
- [ ] **Verify:** TDD unit green; request-service unit + regression green; `sprint-92-feed-exclusion` green (BUG-002
  still holds).

## Task V5: Live membership for community reads

**Files:** modify `services/request-service/src/routes/requests.ts` (`:1336`, `:1422`, `:1467`, `:1553` and their doc
comments).

- [ ] Import `isActiveMember` from `../db/inventoryDb` and replace each claim check (Critical Note 5). Same 403 code and
  message.
- [ ] **Verify:** existing tests for pulse/open-asks/community view/retention-policy that mock the claim are updated to
  mock the live lookup **and** a new case proves a claim-holding non-member gets 403 (Review Focus 4). Grep:
  `grep -n "user?.communities" services/request-service/src/routes/requests.ts` returns only `:310`.

## Task V6: Offer boundary (BUG-064)

**Files:** modify `services/request-service/src/routes/offers.ts`, `services/request-service/src/routes/matches.ts:203-229`.

- [ ] `GET /offers` and `GET /offers/:id`: owner ∨ live member, in SQL (Critical Note 6). `PUT`/`DELETE`: one 404.
- [ ] `POST /matches` offer lookup: `WHERE id = $1 AND offerer_id = $2` → 404, then the `active` check → 400.
- [ ] **Verify:** TDD unit green; request-service unit + regression green; existing offers/matches tests updated only
  where they asserted the 403 oracle (each such edit noted in the ledger).

## Task V7: Guides and BUGS

**Files:** `docs/guides/making-requests-guide.md`, `docs/guides/fulfilling-requests-guide.md`, `docs/BUGS.md`.

- [ ] *making-requests-guide.md*: a "Who can see your request" section: community / sister / trust network / platform,
  plus people already involved (anyone who offered, a provider you picked). Directed asks are seen only by their
  recipients. Removed members lose access at once.
- [ ] *fulfilling-requests-guide.md*: in *Finding Requests*, one line that browsing a community shows only asks you
  could open; add a short *Standing offers* section (post one from the Offers page; members of the offer's community
  and you can see it; leaving the community hides it from you only if you are not its author). `dashboard-home.md`
  describes offers on asks, not standing offers: leave it.
- [ ] `docs/BUGS.md`: BUG-065 and BUG-064 → `fixed (Sprint 133 PR V, v11.89.0)` with the test names. (The commit SHA
  is filled after merge, on the PR D branch.)
- [ ] Regenerate landing docs (`npm run build --workspace=apps/landing` prebuild, or `npx tsx scripts/generate-docs.ts`),
  `git add -f` any new page, and revert unrelated timestamp/HEAD-sha churn (memory: *npm test regenerates landing docs*).
- [ ] No ADR: this applies the BUG-056 boundary to more surfaces. If review decides it's architectural, ask the
  maintainer to allocate a number. Don't self-assign.

## Task V8: CONTEXT.md, registry, promotion

- [ ] `services/request-service/CONTEXT.md`: Recent Changes entry; §3.1 `GET /requests` (boundary + exceptions);
  §3.2 offers (boundary, 404s); the four community reads (live membership); Known Issues → Recent Fixes.
- [ ] `services/registry.json` request-service `notes`: one sentence for BUG-065/064.
- [ ] Promote the TDD file (`node scripts/promote-tdd-tests.js` or the workspace promoter); restore unrelated sweeps.
- [ ] **Verify:** `npm run feedback:check` (advisory; it reads `git diff --cached`, so stage first: memory *feedback:check is a false-green*).

## Task V9: SDLC quality gates

- [ ] `/simplify` on the branch diff (one pass). **Verify:** findings applied or dismissed in the ledger.
- [ ] `/code-review` **high** (security boundary). **Verify:** every correctness finding fixed RED→GREEN or ruled in
  the ledger with a reason.
- [ ] `/security-review`. **Verify:** real findings fixed; dismissals justified in the ledger and the PR description.

## Task V10: Final verification

```bash
npx tsc --noEmit -p services/request-service; echo "tsc=$?"
npm exec --workspace=services/request-service -- jest --testPathPatterns "tests/(unit|regression)"; echo "svc=$?"
npm exec --workspace=tests -- jest regression; echo "root=$?"
npm test; echo "all=$?"
git status --short
npm run feedback:check
```

Every exit code is 0. `git status` shows only intended files (no promoter sweeps, no landing churn).

## Task V11: PR, merge, deploy, smoke

- [ ] Push; open the PR with the inventory, the exception table, the client-impact list (Critical Note 8), any re-pins,
  and the gate rulings. Confirm in CI's Integration Tests log that `sprint-133-pr-v-read-boundary` ran and passed.
- [ ] Version bump from `origin/master` at merge time (root `package.json` + `package-lock.json` root version).
- [ ] Land the handoff update (PR V awaiting merge) **before** asking for merge authorization (memory: *Handoff
  stranded by the merge*). **Maintainer merge authorization** (approve-then-merge is impossible: the maintainer is the PR
  author's account; ask "admin merge, yes/no?"). Then `/deploy`. Expect a CodeQL line-shift re-raise only if `api.ts`
  changed (it should not).
- [ ] **Read-only smoke on karmyq.com as maria.reyes** (`POST /api/auth/login`): `GET /api/requests?community_id=<a
  community she is not in>` returns no `community`-scope rows; the same for one of her communities returns rows;
  `GET /api/offers` returns only offers in her communities; `GET /api/offers/<an offer outside them>` is 404. Choose ids
  by reading, never by writing.
- [ ] After deploy, on the **PR D branch** (re-cut from the new `origin/master`, see the handoff): BUG-064/065 commit
  SHA, handoff → PR V shipped, PR D next.

## Self-review (2026-10-16)

- Every line reference above was read on `d5276e2c` this session. The surface table came from a full grep.
- BUG-068 is deliberately absent; its retirement is recorded in `docs/IDEAS.md` (legacy-handler removal entry) and in
  BUG-068 itself.
- No placeholder steps: every task names its files, its verification command and its proof.
