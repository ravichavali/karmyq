# Simulation Service — Technical Context

**Port**: N/A (runs as a standalone process)
**Status**: development
**Criticality**: optional — used for demo data generation only

---

## Purpose

Generates realistic synthetic activity on the karmyq.com demo environment. Simulates users joining communities, posting requests, offering help, completing matches, registering as providers, and organizing into collectives. Runs continuously on the demo server to keep data fresh.

---

## Architecture

### Key Directories
```
src/
├── config/           # default.json — worker count, profile distribution, growth rate
├── data/
│   └── realistic-data.ts  # COMMUNITIES, request templates, PROVIDER_TEMPLATES, FEEDBACK_COMMENTS, name lists
├── profiles/
│   └── index.ts      # User behavior profiles + selectWorkflow() — picks action based on weights
├── types.ts          # UserProfile, ActionWeight, SimulatedUser, SimulationConfig types
├── simulator.ts      # Main orchestrator — bootstrapFounders, growth setInterval, WorkerPool launch
├── worker-pool.ts    # WorkerPool class — 10 concurrent async workers running 24/7
├── api-client.ts     # HTTP client wrapping all karmyq API endpoints
├── db-user-loader.ts # Loads real sim users from PostgreSQL; exports getPool()
└── workflows/        # One file per action type
```

### WorkerPool Architecture (Sprint 72)

`WorkerPool` runs 10 independent async worker loops via `Promise.all`. Each worker:
1. Picks a random DB user
2. Assigns a profile based on config distribution
3. Generates a JWT token directly (bypasses login API)
4. Creates an `ApiClient` instance with the token
5. Calls `selectWorkflow()` to pick an action weighted by profile
6. Executes the action; catches and logs errors without stopping the loop
7. Sleeps 5–30 seconds before the next iteration

Growth (new user registration) runs on a standalone `setInterval` every 3 minutes, decoupled from workers. Business hours gate has been removed — simulation runs 24/7.

---

## Workflows

| File | Action | Triggered by |
|------|--------|--------------|
| `request-workflow.ts` | Create help request (all 5 types) | REQUESTER, COMMUNITY_BUILDER, others |
| `offer-workflow.ts` | Offer help on an open request | ACTIVE_HELPER, COMMUNITY_BUILDER |
| `accept-offer-workflow.ts` | Accept a proposed match | REQUESTER |
| `complete-match-workflow.ts` | Mark match complete (both sides) | ACTIVE_HELPER, REQUESTER, COMMUNITY_BUILDER |
| `submit-feedback-workflow.ts` | Rate a completed match (helpfulness/responsiveness/clarity) | ACTIVE_HELPER, REQUESTER, COMMUNITY_BUILDER, SOCIAL_USER |
| `browse-workflow.ts` | Browse requests (no side effects) | BROWSER, others |
| `message-workflow.ts` | Send a message in a match conversation | SOCIAL_USER, ACTIVE_HELPER |
| `join-community-workflow.ts` | Discover and join communities | All profiles (forced if 0 communities) |
| `create-community-workflow.ts` | Create a new community from template | COMMUNITY_BUILDER (weight 0.001) |
| `register-provider-workflow.ts` | Register as a service provider | ACTIVE_HELPER (weight 0.02) |
| `create-collective-workflow.ts` | Create a provider collective, link to community | COMMUNITY_BUILDER (weight 0.01) |
| `join-collective-workflow.ts` | Join an existing provider collective | ACTIVE_HELPER (weight 0.01) |
| `browse-providers-workflow.ts` | Browse service provider listings | BROWSER, ACTIVE_HELPER |
| `schedule-activity-workflow.ts` | Create activities in group communities | COMMUNITY_BUILDER |
| `join-activity-workflow.ts` | Join open activities in communities | ACTIVE_HELPER, SOCIAL_USER, COMMUNITY_BUILDER |
| `vote-on-governance-workflow.ts` | Vote on active split/fusion proposals | ACTIVE_HELPER, COMMUNITY_BUILDER, SOCIAL_USER |
| `dibs-workflow.ts` | Requester calls dibs on a prior provider; provider accepts/declines | REQUESTER, ACTIVE_HELPER |
| `governance-nominate-workflow.ts` | Nominate high-trust members for moderator; ratify pending nominations | COMMUNITY_BUILDER, ACTIVE_HELPER, SOCIAL_USER |

---

## Key Behavioral Parameters (Sprint 72)

| Parameter | Value | File | Notes |
|-----------|-------|------|-------|
| Worker count | 10 | `config/default.json` + `worker-pool.ts` | 10 concurrent async workers running 24/7 |
| Worker delay | 5–30s | `config/default.json` | Random sleep between actions per worker |
| Business hours | Disabled | `simulator.ts` (removed gate) | Simulation runs 24/7 |
| Growth rate | 5 new users/day | `config/default.json` | ~480 growth ticks/day; probability per tick = 5/480 |
| Max users | 500 | `config/default.json` | |
| Community cap | 50 | `create-community-workflow.ts` | Sprint 77: was a dead `>=15` check against `limit:11` (unreachable); now `MAX_COMMUNITIES=50` |
| Join guard | `>= 6` communities → skip | `join-community-workflow.ts` | |
| Open request cap | 2 per user | `request-workflow.ts` | |
| Email domain | `@test.karmyq.com` | `db-user-loader.ts` | All sim user queries filtered to this domain via `SIM_ACTOR_POOL_FILTER`; explicitly excludes `@karmyq.test` e2e fixtures (Sprint 77) |
| `createCommunities` weight (COMMUNITY_BUILDER) | 0.001 | `profiles/index.ts` | Near-zero — avoids community proliferation |
| `createCollective` weight (COMMUNITY_BUILDER) | 0.01 | `profiles/index.ts` | Near-zero |
| `submitFeedback` weight (ACTIVE_HELPER) | 0.25 | `profiles/index.ts` | High weight — drives Social Karma data |
| `submitFeedback` weight (REQUESTER) | 0.30 | `profiles/index.ts` | Requesters rate their helpers |

---

## Organic Growth Engine (Sprint 21)

The simulation no longer requires a bulk user creation script. Users are registered organically:

1. **Founder bootstrap** (`simulator.ts:bootstrapFounders`): On startup, checks if 5 named founder accounts exist. If not, registers them via the API. Founders: Maria Reyes, James Okafor, Priya Sharma, Wei Zhang, Fatima Alhassan — all with `@test.karmyq.com` emails.

2. **Ongoing growth** (`simulator.ts:maybeRegisterNewUser`): Each main loop tick probabilistically registers a new user. Rate = `newUsersPerDay / 480` per tick (loop runs every 1-5 min, ~480 ticks/day). Capped at `maxUsers` total and `newUsersPerDay` per 24h window.

3. **New user registration** (`workflows/register-user-workflow.ts`): Generates a random name + unique `{name}{suffix}@test.karmyq.com` email, registers via `/auth/register`, returns `{ id, email, name, token }`. Newly registered users immediately get an onboarding session (first action: join communities).

**To slow down growth**: Set `GROWTH_USERS_PER_DAY=3` env var. No code changes needed.

**To wipe and reseed**: `DELETE FROM auth.users WHERE email LIKE '%@test.karmyq.com'` — sim will re-bootstrap founders on next restart.

---

## Community Templates (Sprint 21)

9 communities, capped at 15 total:
1. Portland Mutual Aid Network (mutual_aid)
2. Southeast PDX Helpers (neighborhood)
3. PDX Parents Co-op (family)
4. Portland Tool Library & Share (sharing)
5. PDX Service Providers Network (professional) — anchor for provider collectives
6. PDX Rides Collective (professional) — ride providers
7. PDX Home Repair & Trades (professional) — tradesperson providers
8. Portland Tutors Network (professional) — tutor providers
9. Northeast PDX Community Circle (neighborhood)

---

## Provider Types

Valid API service types: `ride`, `tradesperson`, `tutor`, `other`

Ride providers include `ride_details` (vehicle_type, max_passengers, advance_booking_required).

---

## API Client Methods (`api-client.ts`)

### Requests & Matches
- `browseRequests(params)` — GET /requests
- `createRequest(data)` — POST /requests
- `offerHelp(requestId, userId)` — POST /matches
- `getMatches(params?)` — GET /matches
- `acceptMatch(matchId, userId)` — PUT /matches/:id/accept
- `completeMatch(matchId, userId, payload)` — PUT /matches/:id/complete

### Providers
- `registerProvider(data)` — POST /requests/providers
- `getMyProviderProfiles()` — GET /requests/providers/my
- `getProviders(serviceType?)` — GET /requests/providers (public browsing)

### Collectives
- `createCollective(data)` — POST /requests/collectives
- `getCollectives()` — GET /requests/collectives
- `getMyCollectives()` — GET /requests/collectives/my
- `joinCollective(collectiveId)` — POST /requests/collectives/:id/members
- `linkCollectiveToCommunity(collectiveId, communityId)` — POST /requests/collectives/:id/communities

### Communities
- `getCommunities(userId?)` — GET /communities
- `discoverCommunities(params?)` — GET /communities
- `createCommunity(data)` — POST /communities

---

## Recent Changes

### Sprint 78 (2026-05-31) — Autonomous fission
- **`vote-on-governance-workflow.ts`** now drives the full fission loop for an admin's communities: (1) **propose** a split when `current_members >= 140` (urgent threshold) and no active proposal exists; (2) **vote** on `voting` split/fusion proposals; (3) **execute** any `approved` split. Over-cap communities now split with zero human action.
- **`api-client.ts`**: added `executeSplit`, `createSplitProposal`, `startSplitVote`.
- **`profiles/index.ts`**: bumped `voteOnGovernance` weight (0.03/0.05 → 0.10/0.12) so the propose→vote→execute loop progresses in reasonable time (it was too slow with a single admin per community).

### Sprint 77 (2026-05-30) — Data hygiene (ADR-062)
- **FIXED (cap bug)**: `create-community-workflow.ts` fetched `discoverCommunities({limit:11})` then checked `>= 15` — unreachable. Now `MAX_COMMUNITIES=50`, fetching `limit:51`. (Idempotent `POST /communities` makes runaway duplication impossible regardless; the cap just bounds churn.)
- **FIXED (actor pool)**: `db-user-loader.ts` now uses `SIM_ACTOR_POOL_FILTER` — selects `@test.karmyq.com` and explicitly excludes `@karmyq.test` e2e/integration fixtures so sim workflows never corrupt those accounts.

### Sprint 72 (2026-05-29)
- WorkerPool class: 10 concurrent async workers via `Promise.all` running 24/7
- Business hours gate removed from `simulator.ts` entirely
- Growth engine moved to standalone `setInterval(3min)`, decoupled from workers
- `selectWorkflow()` added to `profiles/index.ts` — replaces `performRandomAction()` in simulator
- 4 new workflows: vote-on-governance, submit-feedback, dibs (call + respond), governance nominations (nominate + ratify)
- All new api-client methods: `voteOnSplit`, `voteOnFusion`, `submitMatchFeedback`, `callDibs`, `getPendingDibsForProvider`, `acceptDibs`, `declineDibs`, `getGovernanceState`, `getCommunityMembers`, `nominateMember`, `ratifyNomination`
- Session affinity: if user has open requests, `acceptOffer`/`completeMatch` weights doubled
- Workflow weight calibration: `createCommunities` → 0.001, `createCollective` → 0.01, `submitFeedback` → 0.25–0.30
- Request templates expanded: 20+ authentic Portland mutual aid templates in GENERIC_REQUESTS
- `FEEDBACK_COMMENTS` pool (15 entries) added to `realistic-data.ts`
- User guide: "Understanding the Demo" added to landing site
- `getPool()` exported from db-user-loader.ts for direct DB queries in governance workflows

### Sprint 21 (2026-03-10)
- Organic user growth engine: 5 founders bootstrapped on startup, 10-15 new users/day via API registration
- New `register-user-workflow.ts`: standalone `registerNewUser()` for growth engine
- All DB queries now filtered to `@test.karmyq.com` domain
- Added `getUserCount()` and `userExistsByEmail()` to `db-user-loader.ts`
- Community cap raised 5 → 15; join guard raised 3 → 6 (target 5-6 communities/user, 75/community)
- Open request cap: 2 per user (prevents request glut)
- 4 new community templates: PDX Rides Collective, PDX Home Repair & Trades, Portland Tutors Network, Northeast PDX Community Circle
- FOUNDERS constant added to realistic-data.ts
- REQUESTER createRequests weight 0.8 → 0.3; ACTIVE_HELPER registerAsProvider weight 0.05 → 0.08
- Growth config in `default.json`: `newUsersPerDay`, `maxUsers`, `emailDomain`, `password`
- Configurable via env: `GROWTH_USERS_PER_DAY`, `GROWTH_MAX_USERS`, `GROWTH_EMAIL_DOMAIN`

### Sprint 20 (2026-03-10)
- Fixed community membership: join guard changed from "any → skip" to ">= 3 → skip" (was root cause of 3-6 members per community)
- Reduced community cap from 10 to 5 (demo had accumulated 37 communities)
- Trimmed COMMUNITIES to 5 templates, added PDX Service Providers Network
- Fixed provider service type mismatch: `skill`/`errand`/`care` → `tradesperson`/`tutor` (invalid types caused silent API failures)
- Added ride_details to ride provider registrations
- Added 3 new workflows: `create-collective`, `join-collective`, `browse-providers`
- Added 6 new API client methods for collectives and provider browsing
- Increased match completion rate from 10% to 50%
- Offer workflow now deduplicates (no same-user double offers) and routes providers to matching request types

## Sprint 116 (PR B): Maria relationship-story rehearsal

`src/scenarios/mariaRelationshipStory.ts` is a PURE planner + API-only apply for standing up two
contrasting demo stories: a rich, cross-community ORDINARY helper story and a low-overlap PROVIDER
story.

The rich floor splits into two parts. **Structural** overlap (`≥3` shared, `≥4` one-hop per side)
can only come from the real graph — `planMariaRelationshipStory` selects only structurally-rich
helpers and never synthesizes shared people. The **path** degree, by contrast, is repairable: when a
structurally-rich helper is more than two hops from Maria, the plan emits a single Maria↔helper
`request → offer → accept → two-sided-completion` exchange (`create_repair_request` … `complete_repair`
×2) to create the direct bond. A helper with no structural overlap cannot be repaired by one exchange,
so the plan warns and `applyMariaRelationshipStory` refuses (`floor.achievable === false`) rather than
validate a sparse picture.

Discovery is **selection-aware and lifecycle-aware**: a pre-existing match/offer only counts as
"already done" when it belongs to the selected helper/provider (matched by `responderId` /
`providerUserId`) **and is still reviewable** (`proposed` match, `pending` offer, on an `open`
request) — a terminal row never masks the story. Matches are fetched with the API's `request_id`
filter (not a latest-N system-wide window, which drops older stories on a busy demo). Candidate
one-hop overlap is measured with the **candidate's own token** (the neighborhood endpoint 404s on a
non-shared-community target, so Maria's token would abort gather for exactly the cross-community
helper). **Cross-community** is community-set disjointness (not first-community equality).

Selection-time overlap is a pre-match heuristic (`overlapFromNeighborhoods`) that counts only true
one-hop neighbours (`degrees_of_separation === 1`) and excludes **both anchors** — otherwise each ego's
own center and the post-repair direct edge would leak in as fake shared connections. Requests are
created at **platform** visibility scope (`STORY_REQUEST_SCOPE`) so a cross-community helper/provider
can actually reach and offer on them; the **provider** request is a valid `service` request carrying
the required `payload.service_category`. The repair exchange is **resumable and lifecycle-aware**: prior
repair request/match/completion state is gathered (the repair request is looked up regardless of
status, since accepting its match closes it), only a still-live (`proposed`/`matched`) repair match is
resumed — a rejected/cancelled one triggers a fresh exchange, a fully-completed one emits nothing — and
only the missing steps are re-emitted.

Apply mutates only through ordinary APIs, then verifies in two stages: it **re-reads authoritative
state** to derive the demo IDs from the server (never from mutation responses) — requiring an **open**
request with a still-live decision (`proposed` match / `pending` offer), so a concurrent transition to
rejected/declined/closed fails verification instead of being printed as "verified" — and then confirms
the rich floor by **re-measuring from the platform-wide match relationship-context** (the same contract
the demo renders), polling with bounded retries to tolerate the asynchronous `match_completed` trust
projection. Community-scoped neighborhoods are deliberately NOT used for verification: a repaired
cross-community edge is stored under Maria's request community and is invisible to a neighborhood walk
that requires the disjoint helper's active membership there. It imports no DB pool and seeds no trust
edges. The CLI
(`npm --workspace @karmyq/simulation-service run rehearse:maria-relationship`) is dry-run by default
and applies only with `-- --apply`. New api-client methods: `submitProviderOffer`,
`getOffersForRequest`, `getNeighborhood`.

### Sprint 116 post-deploy fix (2026-07-01) — neighborhood node identity normalization

The privacy-safe `GET /trust/neighborhood/:userId` contract identifies nodes with `user_id`, while
older simulation fixtures used the internal `id` field. The rehearsal now resolves either shape
through `neighborhoodNodeId()` before measuring one-hop overlap or path degree. Without this
normalization, every projected node collapsed to `undefined`, producing the misleading live floor
`sharedConnections: 1, mariaOneHop: 1, helperOneHop: 1` regardless of the actual graph. Regression
coverage uses the real outward `{ user_id, degrees_of_separation }` shape.
