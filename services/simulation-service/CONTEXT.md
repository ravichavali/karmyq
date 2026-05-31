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
