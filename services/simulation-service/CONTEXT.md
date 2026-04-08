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
├── config/           # default.json — user count, concurrent sessions, profile distribution
├── data/
│   └── realistic-data.ts  # COMMUNITIES, request templates, PROVIDER_TEMPLATES, name lists
├── profiles/
│   └── index.ts      # User behavior profiles (ACTIVE_HELPER, REQUESTER, BROWSER, COMMUNITY_BUILDER, SOCIAL_USER)
├── types.ts          # UserProfile, ActionWeight, Workflow, SimulatedUser types
├── simulator.ts      # Main orchestrator — session management, action selection
├── session-manager.ts
├── api-client.ts     # HTTP client wrapping all karmyq API endpoints
├── db-user-loader.ts # Loads real sim users from PostgreSQL
└── workflows/        # One file per action type
```

---

## Workflows

| File | Action | Triggered by |
|------|--------|--------------|
| `request-workflow.ts` | Create help request (all 5 types) | REQUESTER, COMMUNITY_BUILDER, others |
| `offer-workflow.ts` | Offer help on an open request | ACTIVE_HELPER, COMMUNITY_BUILDER |
| `accept-offer-workflow.ts` | Accept a proposed match | REQUESTER |
| `complete-match-workflow.ts` | Mark match complete (both sides) | ACTIVE_HELPER, REQUESTER, COMMUNITY_BUILDER |
| `browse-workflow.ts` | Browse requests (no side effects) | BROWSER, others |
| `message-workflow.ts` | Send a message in a match conversation | SOCIAL_USER, ACTIVE_HELPER |
| `join-community-workflow.ts` | Discover and join communities | All profiles (forced if 0 communities) |
| `create-community-workflow.ts` | Create a new community from template | COMMUNITY_BUILDER |
| `register-provider-workflow.ts` | Register as a service provider | ACTIVE_HELPER |
| `create-collective-workflow.ts` | Create a provider collective, link to community | COMMUNITY_BUILDER |
| `join-collective-workflow.ts` | Join an existing provider collective | ACTIVE_HELPER |
| `browse-providers-workflow.ts` | Browse service provider listings | BROWSER, ACTIVE_HELPER |
| `schedule-activity-workflow.ts` | COMMUNITY_BUILDER admins create activities in group communities (2-10 days out) | COMMUNITY_BUILDER |
| `join-activity-workflow.ts` | Members join open activities in their communities | ACTIVE_HELPER, SOCIAL_USER, COMMUNITY_BUILDER |

---

## Key Behavioral Parameters (Sprint 21)

| Parameter | Value | File | Notes |
|-----------|-------|------|-------|
| Community cap | 15 | `create-community-workflow.ts` | Was 5; raised to accommodate 9 templates + organic growth |
| Join guard | `>= 6` communities → skip | `join-community-workflow.ts` | Was `>= 3`; target 5-6 communities per user |
| Open request cap | 2 per user | `request-workflow.ts` | Prevents request glut; skip if user already has 2+ open |
| Growth rate | 10-15 users/day | `simulator.ts` + `config/default.json` | Configurable via `GROWTH_USERS_PER_DAY` env var |
| Max users | 500 | `config/default.json` | Configurable via `GROWTH_MAX_USERS` env var |
| Email domain | `@test.karmyq.com` | `db-user-loader.ts` | All sim user queries filtered to this domain |
| REQUESTER createRequests weight | 0.3 | `profiles/index.ts` | Was 0.8; reduced to avoid request glut |
| ACTIVE_HELPER registerAsProvider weight | 0.08 | `profiles/index.ts` | Was 0.05; nudges toward 1:10 provider ratio |
| Match completion rate | 50% | `complete-match-workflow.ts` | Unchanged from Sprint 20 |
| Provider service types | ride, tradesperson, tutor, other | `realistic-data.ts` | Unchanged from Sprint 20 |

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
