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

---

## Key Behavioral Parameters (Sprint 20)

| Parameter | Value | File | Notes |
|-----------|-------|------|-------|
| Community cap | 5 | `create-community-workflow.ts` | Was 10; reduced for member density |
| Join guard | `>= 3` communities → skip | `join-community-workflow.ts` | Was `> 0`; allows users to join up to 3 communities |
| Match completion rate | 50% | `complete-match-workflow.ts` | Was 10%; increased to generate completions |
| Provider service types | ride, tradesperson, tutor, other | `realistic-data.ts` | Fixed mismatch with API schema |

---

## Community Templates (Sprint 20)

5 communities (down from 8), capped at 5 total:
1. Portland Mutual Aid Network (mutual_aid)
2. Southeast PDX Helpers (neighborhood)
3. PDX Parents Co-op (family)
4. Portland Tool Library & Share (sharing)
5. PDX Service Providers Network (professional) — anchor for provider collectives

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
