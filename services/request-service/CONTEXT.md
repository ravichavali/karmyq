# Request Service - Complete Context Documentation

> **Last Updated:** 2026-04-03
> **Version:** v9.18.0
> **Port:** 3003
> **Status:** Production (Polymorphic Request System + Curated Feed)

## Quick Start

```bash
# Start this service
docker-compose up request-service

# Start in development mode
cd services/request-service && npm run dev

# Test this service
npm run test:integration -- integration/request-service.test.ts

# View logs
docker logs karmyq-request-service -f

# Health check
curl http://localhost:3003/health
```

---

## 1. Overview

### 1.1 Purpose
The Request Service manages polymorphic help requests (v9.0), help offers, and matches between requesters and helpers within communities. It implements skill-based matching and curated feed filtering to intelligently suggest relevant requests to users.

### 1.2 Responsibilities (v9.0)
- **Polymorphic Request Management** - CRUD for 5 request types (generic, ride, service, event, borrow)
- **Curated Feed Filtering** - Skill-based + preference-based feed curation with match scores
- **Help Offer Management** - CRUD operations for help offers
- **Type-Specific Matching** - Match using specialized algorithms per request type
- **Privacy Controls** - Social Karma v2.0 privacy and consent management
- **Interaction Feedback** - Collect exchange quality ratings (not person ratings)
- **Event Publishing** - Emit domain events for request lifecycle

### 1.3 NOT Responsible For
- **Karma Calculation** - Handled by Reputation Service
- **User Authentication** - Handled by Auth Service
- **Messaging** - Handled by Messaging Service
- **Community Management** - Handled by Community Service

---

## 2. Architecture

### 2.1 Technology Stack
- **Runtime:** Node.js 18
- **Framework:** Express.js
- **Database Schema:** `requests`
- **Event Queues:** `karmyq-events` (Bull/Redis)
- **External Services:** PostgreSQL, Redis

### 2.2 Key Components (v9.0)
```
src/
├── index.ts              # Express app initialization, route registration
├── routes/
│   ├── requests.ts       # Polymorphic request CRUD + curated feed endpoint
│   ├── offers.ts         # Help offer CRUD
│   ├── matches.ts        # Match creation and status updates
│   └── feedback.ts       # Interaction feedback (Social Karma v2.0)
├── services/
│   └── matcher.ts        # Type-specific matching algorithms
├── database/
│   └── db.ts             # PostgreSQL connection pool
└── events/
    └── publisher.ts      # Redis event publishing (Bull)

Shared Packages (v9.0):
├── packages/shared/src/schemas/requests/
│   ├── index.ts          # Zod discriminated union schema
│   ├── generic.ts        # Generic request schema
│   ├── ride.ts           # Ride request schema
│   ├── service.ts        # Service request schema
│   ├── event.ts          # Event request schema
│   └── borrow.ts         # Borrow request schema
└── packages/shared/src/matching/
    ├── index.ts          # Matching algorithm exports
    ├── types.ts          # UserProfile, MatchScore interfaces
    └── matchers/         # Type-specific matchers
        ├── generic.ts
        ├── ride.ts
        ├── service.ts
        ├── event.ts
        └── borrow.ts
```

### 2.3 Database Schema

#### Tables Owned by This Service

**requests.help_requests** - Core polymorphic help request table (v9.0)
```sql
CREATE TABLE requests.help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- v9.0: Polymorphic Request System
    request_type request_type_enum NOT NULL DEFAULT 'generic',
    payload JSONB,                            -- Type-specific data
    requirements JSONB,                       -- Type-specific requirements

    -- Legacy fields (maintained for backward compatibility)
    category VARCHAR(100),                    -- transportation, moving, childcare, etc.
    urgency VARCHAR(50) DEFAULT 'medium',     -- low, medium, high, critical
    preferred_start_date TIMESTAMP,
    preferred_end_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'open',        -- open, matched, completed, cancelled
    expired BOOLEAN DEFAULT false,

    -- ADR-022: Multi-Tier Visibility
    visibility_scope visibility_scope_enum NOT NULL DEFAULT 'community',
    visibility_max_degrees INTEGER DEFAULT 3 CHECK (visibility_max_degrees BETWEEN 1 AND 6),

    -- Social Karma v2.0 Privacy
    is_public BOOLEAN DEFAULT false,
    requester_visibility_consent BOOLEAN DEFAULT false,

    -- Sprint 36: Admin boost (Migration 015)
    is_boosted BOOLEAN DEFAULT FALSE,
    boosted_at TIMESTAMP,
    boosted_expires_at TIMESTAMP,
    boosted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ADR-022: Visibility scope enum
CREATE TYPE visibility_scope_enum AS ENUM ('community', 'trust_network', 'platform');

-- v9.0: Request Type Enum
CREATE TYPE request_type_enum AS ENUM ('generic', 'ride', 'service', 'event', 'borrow');

-- v9.0: Multi-community support
CREATE TABLE requests.request_communities (
    request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (request_id, community_id)
);

-- Indexes
CREATE INDEX idx_help_requests_community_id ON requests.help_requests(community_id);
CREATE INDEX idx_help_requests_status ON requests.help_requests(status);
CREATE INDEX idx_help_requests_category ON requests.help_requests(category);
```

**requests.request_admin_notes** - Community-scoped admin triage notes (Sprint 25)
```sql
CREATE TABLE requests.request_admin_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    updated_by UUID NOT NULL REFERENCES auth.users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id, community_id)
);
```
One note per (request, community) pair; upserted via `PATCH /requests/:id/admin-triage`.

**requests.help_offers** - Help offers from community members
```sql
CREATE TABLE requests.help_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    offerer_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    availability_start TIMESTAMP,
    availability_end TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',      -- active, matched, expired

    -- Social Karma v2.0 Privacy
    is_public BOOLEAN DEFAULT false,
    offerer_visibility_consent BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_help_offers_community_id ON requests.help_offers(community_id);
```

**requests.matches** - Connections between requests and responders
```sql
CREATE TABLE requests.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id),
    offer_id UUID REFERENCES requests.help_offers(id),
    responder_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'pending',     -- pending, accepted, in_progress, completed, cancelled

    -- Social Karma v2.0 Privacy
    requester_visible BOOLEAN DEFAULT false,
    responder_visible BOOLEAN DEFAULT false,
    interaction_category VARCHAR(100),

    -- Sprint 40: Admin propose-match (Migration 018)
    admin_proposed BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE when match created via propose-match admin route

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    requester_done_at TIMESTAMP,   -- set when requester clicks Done (migration 017)
    responder_done_at TIMESTAMP,   -- set when responder clicks Done (migration 017)
    UNIQUE(request_id, offer_id)
);

CREATE INDEX idx_matches_request_id ON requests.matches(request_id);
CREATE INDEX idx_matches_status ON requests.matches(status);
```

**requests.interaction_feedback** - Social Karma v2.0 exchange quality ratings
```sql
CREATE TABLE requests.interaction_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES requests.matches(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Interaction quality ratings (1-5)
    helpfulness INTEGER CHECK (helpfulness BETWEEN 1 AND 5),
    responsiveness INTEGER CHECK (responsiveness BETWEEN 1 AND 5),
    clarity INTEGER CHECK (clarity BETWEEN 1 AND 5),

    -- Optional comment about the exchange (not the person)
    comment TEXT,

    -- Visibility consent for featuring in stories
    allow_featuring BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, from_user_id)
);

CREATE INDEX idx_interaction_feedback_match ON requests.interaction_feedback(match_id);
CREATE INDEX idx_interaction_feedback_to_user ON requests.interaction_feedback(to_user_id);
```

#### Privacy Design Principles (Social Karma v2.0)
- **Privacy First**: All requests/offers default to `is_public = false`
- **Two-Way Consent**: Both parties must consent for names in featured stories
- **Interaction Ratings**: Rate the exchange quality, NOT the individual

**requests.provider_rate_cards** - Provider pricing entries (Sprint 29)
```sql
CREATE TABLE requests.provider_rate_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    pricing_model VARCHAR(50) NOT NULL,   -- 'standard', 'free', 'negotiable'
    rate_amount NUMERIC(10,2),            -- null for free/negotiable
    rate_unit VARCHAR(50),                -- 'per_hour', 'per_session', 'per_trip', 'flat'
    currency CHAR(3) DEFAULT 'USD',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
Cards are never hard-deleted; deactivation sets `is_active = false`.

**requests.help_requests** — Sprint 29 addition: `preferred_provider_id UUID REFERENCES requests.provider_profiles(id)` — optional field set when a requestor pre-selects a provider while filing a typed request.

**requests.help_requests** — Sprint 42 addition: `scheduled_for TIMESTAMPTZ` — nullable; when set, the request is a scheduled request eligible for the dibs flow. When null, the request is treated as ASAP and always broadcast publicly (dibs rejected).

**requests.feed_events** — Sprint 43 addition: append-only feed outcome log for weight tuning.
```sql
CREATE TABLE requests.feed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id    UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('impression', 'offer_made', 'match_completed')),
  feed_score    NUMERIC(5,2),
  feed_rank     INTEGER,
  source_tier   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Indexed by `(user_id, created_at DESC)`, `(request_id, event_type)`, and `(event_type, created_at DESC)`. Fire-and-forget writes — never blocks feed response.

**requests.dibs** - Private first-refusal records for scheduled requests (Sprint 42)
```sql
CREATE TABLE requests.dibs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    provider_user_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'pending',  -- pending, accepted, declined, expired
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id)  -- one active dibs per request at a time
);

CREATE INDEX idx_dibs_request_id ON requests.dibs(request_id);
CREATE INDEX idx_dibs_provider_user_id ON requests.dibs(provider_user_id);
CREATE INDEX idx_dibs_status ON requests.dibs(status);
CREATE INDEX idx_dibs_expires_at ON requests.dibs(expires_at) WHERE status = 'pending';
```

**provider.offers** - Provider priced offers on help requests (Sprint 41)
```sql
CREATE TABLE provider.offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES requests.provider_profiles(id) ON DELETE CASCADE,
    provider_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    price NUMERIC(10,2),            -- null means free / price TBD
    note TEXT,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, accepted, declined, withdrawn
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, request_id)        -- one offer per provider per request
);
```

#### Tables Read by This Service
- `auth.users` - User details for requester/helper names
- `auth.user_skills` - User skills for skill-based matching
- `auth.user_feed_preferences` - Feed visibility preferences (ADR-022)
- `auth.social_distances` - Trust distance between users (ADR-031)
- `communities.communities` - Community names, details, and `default_request_scope`
- `communities.members` - Verify community membership
- `communities.community_configs` - Feed scoring weights (ADR-031)
- `reputation.karma_records` - Karma scores for feed display (ADR-031)
- `reputation.trust_scores` - Trust scores for feed display (ADR-031)

---

## 3. API Reference

### 3.1 Help Requests

#### GET /requests
Get all help requests with optional filters.

**Query Parameters:**
- `community_id` (UUID) - Filter by community
- `status` (string) - Filter by status (default: 'open')
- `type` (string) - Filter by category
- `limit` (number) - Max results (default: 50)
- `offset` (number) - Pagination offset (default: 0)
- `include_admin_notes` (boolean) - When `true` and `community_id` is also provided, each request in the response includes an `admin_note` field scoped to that community (sourced from `requests.request_admin_notes`). Only returned to active admins/moderators of the community.

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "community_id": "uuid",
    "community_name": "Seattle Mutual Aid",
    "requester_id": "uuid",
    "requester_name": "Alice Smith",
    "title": "Need help moving furniture",
    "description": "Moving couch upstairs, need 2-3 people",
    "category": "moving",
    "urgency": "medium",
    "status": "open",
    "created_at": "2025-01-10T12:00:00Z"
  }],
  "count": 1
}
```

**Implementation:** `src/routes/requests.ts:8`

#### GET /requests/matched/for-user
Get requests matching user's skills from their communities (skill-based matching algorithm).

**Query Parameters:**
- `user_id` (UUID, required) - User to match requests for
- `limit` (number) - Max results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "title": "Need help moving furniture",
    "category": "moving",
    "urgency": "high",
    "urgency_priority": 3,
    "community_name": "Seattle Mutual Aid",
    "requester_name": "Alice Smith",
    "created_at": "2025-01-10T12:00:00Z"
  }],
  "count": 1
}
```

**Algorithm:**
- Orders by urgency (high=3, medium=2, low=1) then creation date
- Matches based on category-to-skill mapping (see Section 5.2)
- Excludes user's own requests
- Only includes communities user is a member of

#### GET /requests/curated (v9.18 + ADR-048 Feed Ranking v2)
Get curated feed scored on 7 signals: skill match, trust distance, community relevance, urgency, requester trust, prior interaction, and recency. Response includes `priorInteractionScore` and `recencyScore` in each request object. Impressions are logged fire-and-forget to `requests.feed_events`.

**Query Parameters:**
- `minScore` (number) - Minimum match score 0-100 (default: 30)
- `limit` (number) - Max results (default: 20)
- `community_id` (UUID) - Filter by specific community (optional)
- `tier` (string) - Filter by visibility tier: `community`, `trust_network`, `platform`, `sister_community` (optional)
- `includeSisterCommunities` (boolean) - Include requests from linked sister communities where `show_in_sister_feeds=true`, scored with trust_carry_factor applied (Sprint 15)

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [{
      "id": "uuid",
      "request_type": "service",
      "title": "Need plumber for leak repair",
      "description": "Kitchen pipe leaking...",
      "urgency": "high",
      "visibility_scope": "community",
      "visibility_max_degrees": 3,
      "payload": {
        "service_category": "plumbing",
        "skill_level_required": "intermediate"
      },
      "matchScore": 85,
      "feedScore": 72,
      "is_boosted": true,
      "boosted_expires_at": "2026-03-27T12:00:00Z",
      "sourceTier": "community",
      "trustDistance": 2,
      "karmaScore": 150,
      "matchReasons": [
        "You have plumbing skill",
        "Skill level matches",
        "High urgency bonus"
      ],
      "matchBreakdown": {
        "skillScore": 50,
        "urgencyBonus": 35
      },
      "community_name": "Seattle Mutual Aid",
      "requester_name": "Alice Smith"
    }],
    "count": 15,
    "tiers": {
      "community": 10,
      "trust_network": 3,
      "platform": 2
    },
    "filters": {
      "minMatchScore": 30,
      "totalRequests": 50,
      "matchedRequests": 15,
      "subscribedTypes": ["generic", "service", "event"]
    },
    "feedPreferences": {
      "feed_show_trust_network": true,
      "feed_trust_network_max_degrees": 3,
      "feed_show_platform": false,
      "feed_platform_categories": ["digital", "questions"]
    },
    "userProfile": {
      "skills": ["plumbing", "carpentry"],
      "skillCount": 2
    }
  }
}
```

**Algorithm (ADR-031):**
1. Fetch user feed preferences from `auth.user_feed_preferences`
2. Fetch user preferences (subscribed request types from auth.user_request_preferences)
3. Fetch user skills from auth.user_skills
4. Get open requests across three tiers:
   - **Community**: Requests in user's communities
   - **Trust Network**: Requests with `visibility_scope != 'community'` within trust degree limits
   - **Platform**: Requests with `visibility_scope = 'platform'` (if user opted in)
5. Batch-fetch trust distances from `auth.social_distances` and karma from `reputation.karma_records`
6. Resolve source tier per request using `resolveSourceTier()` from `@karmyq/shared/matching`
7. Calculate feed scores using community-configurable weights (ADR-031); active boost adds +30 to feedScore (capped at 100)
8. Sort by tier priority (community > trust_network > platform), then by feedScore
9. Return top N results with transparency (scores, tier, trust distance, karma)

**Implementation:** `src/routes/requests.ts:194`

#### GET /requests/:id
Get specific request details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Need help moving furniture",
    "description": "Moving couch upstairs",
    "category": "moving",
    "urgency": "medium",
    "status": "open",
    "requester_id": "uuid",
    "requester_name": "Alice Smith",
    "requester_email": "alice@example.com",
    "community_id": "uuid",
    "community_name": "Seattle Mutual Aid",
    "created_at": "2025-01-10T12:00:00Z"
  }
}
```

**Implementation:** `src/routes/requests.ts:134`

#### POST /requests (v9.0 Polymorphic + ADR-022 Visibility)
Create new polymorphic help request (supports 5 types) with visibility scope.

**Request (Generic):**
```json
{
  "community_id": "uuid",
  "request_type": "generic",
  "title": "Need help moving furniture",
  "description": "Moving couch upstairs, need 2-3 strong people",
  "urgency": "medium",
  "payload": {},
  "visibility_scope": "community",
  "visibility_max_degrees": 3
}
```

**Visibility Fields (ADR-022):**
- `visibility_scope` - One of: `community` (default), `trust_network`, `platform`. Falls back to community's `default_request_scope` if omitted.
- `visibility_max_degrees` - Max trust hops for trust_network scope (1-6, default: 3)

**Request (Service - Plumbing):**
```json
{
  "community_id": "uuid",
  "request_type": "service",
  "title": "Need plumber for leak repair",
  "description": "Kitchen pipe leaking, needs professional help",
  "urgency": "high",
  "payload": {
    "service_category": "plumbing",
    "skill_level_required": "intermediate",
    "estimated_duration_hours": 2,
    "budget_range": {
      "min": 50,
      "max": 100,
      "currency": "USD"
    },
    "location_type": "on_site",
    "certifications_required": ["Licensed Plumber"]
  }
}
```

**Request (Ride):**
```json
{
  "community_id": "uuid",
  "request_type": "ride",
  "title": "Need ride to airport",
  "description": "Flying out tomorrow morning",
  "urgency": "medium",
  "payload": {
    "origin": {
      "address": "123 Main St, Seattle, WA",
      "lat": 47.6062,
      "lng": -122.3321
    },
    "destination": {
      "address": "SEA Airport",
      "lat": 47.4502,
      "lng": -122.3088
    },
    "seats_needed": 1,
    "departure_time": "2024-06-15T10:00:00Z",
    "preferences": {
      "pet_friendly": false,
      "luggage_space": "medium"
    }
  }
}
```

**Multi-Community Posting (v9.0):**
```json
{
  "post_to_all_communities": true,
  "request_type": "generic",
  "title": "Need general help",
  "description": "..."
}
```

**Validation:**
- User must be active member of community (or all communities if post_to_all_communities)
- request_type must be one of: generic, ride, service, event, borrow
- payload must conform to type-specific Zod schema (see Section 3.6)
- Required fields: `community_id`, `requester_id`, `title`, `type`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Need help moving furniture",
    "category": "moving",
    "urgency": "high",
    "status": "open",
    "created_at": "2025-01-10T12:00:00Z"
  },
  "message": "Request created successfully"
}
```

**Events Published:** `request_created` (includes `service_type` field since Sprint 37 — notification-service uses this to route `provider_request_matched` to matching providers)

**Implementation:** `src/routes/requests.ts:173`

#### PUT /requests/:id
Update help request (requester only).

**Request:**
```json
{
  "user_id": "uuid",
  "title": "Updated title",
  "description": "Updated description",
  "urgency": "low",
  "status": "completed"
}
```

**Authorization:** Only the original requester can update

**Events Published:** `request.completed` (when status changed to 'completed')

**Implementation:** `src/routes/requests.ts:235`

#### DELETE /requests/:id
Cancel help request (requester only).

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Events Published:** `request.cancelled`

**Implementation:** `src/routes/requests.ts:316`

#### PUT /requests/:id/privacy
Update privacy settings for a request (Social Karma v2.0).

**Request:**
```json
{
  "user_id": "uuid",
  "is_public": true,
  "requester_visibility_consent": true
}
```

**Authorization:** Only requester can update their request privacy

**Events Published:** `privacy_settings.updated`

**Implementation:** `src/routes/requests.ts` (Social Karma v2.0)

### 3.6 Polymorphic Request Type Schemas (v9.0)

This section documents the payload structure for each request type. All payloads are validated using Zod discriminated unions in `packages/shared/src/schemas/requests/`.

#### Generic Request
The default request type for simple help requests.

**Payload Schema:**
```typescript
{
  request_type: 'generic',
  payload: {}  // Empty object, no type-specific fields
}
```

**Example:**
```json
{
  "request_type": "generic",
  "title": "Need help moving furniture",
  "description": "Moving couch upstairs, need 2-3 people",
  "urgency": "medium",
  "payload": {}
}
```

#### Ride Request
For transportation help (rides, carpools, etc.).

**Payload Schema:**
```typescript
{
  request_type: 'ride',
  payload: {
    origin: {
      address: string,        // Human-readable address
      lat: number,            // Latitude (-90 to 90)
      lng: number             // Longitude (-180 to 180)
    },
    destination: {
      address: string,
      lat: number,
      lng: number
    },
    seats_needed: number,     // 1-10
    departure_time: string,   // ISO 8601 timestamp
    preferences?: {           // Optional
      pet_friendly?: boolean,
      luggage_space?: 'small' | 'medium' | 'large',
      wheelchair_accessible?: boolean
    }
  }
}
```

**Example:**
```json
{
  "request_type": "ride",
  "title": "Need ride to airport",
  "description": "Flying out tomorrow morning",
  "urgency": "medium",
  "payload": {
    "origin": {
      "address": "123 Main St, Seattle, WA",
      "lat": 47.6062,
      "lng": -122.3321
    },
    "destination": {
      "address": "SEA Airport",
      "lat": 47.4502,
      "lng": -122.3088
    },
    "seats_needed": 1,
    "departure_time": "2024-06-15T10:00:00Z",
    "preferences": {
      "pet_friendly": false,
      "luggage_space": "medium"
    }
  }
}
```

#### Borrow Request
For borrowing items from community members.

**Payload Schema:**
```typescript
{
  request_type: 'borrow',
  payload: {
    item_category: 'tools' | 'electronics' | 'furniture' | 'vehicles' |
                   'sports_equipment' | 'books' | 'clothing' | 'kitchen' | 'other',
    item_description: string,
    duration_days: number,         // 1-30 days
    return_date?: string,          // ISO 8601 date (optional)
    condition_min?: 'any' | 'good' | 'excellent',  // Optional
    images?: string[]              // Array of image URLs (optional)
  }
}
```

**Example:**
```json
{
  "request_type": "borrow",
  "title": "Need ladder for weekend",
  "description": "Painting exterior walls, need 6-8ft ladder",
  "urgency": "low",
  "payload": {
    "item_category": "tools",
    "item_description": "Extension ladder, 6-8 feet",
    "duration_days": 2,
    "return_date": "2024-06-17",
    "condition_min": "good"
  }
}
```

#### Service Request
For professional or skilled services.

**Payload Schema:**
```typescript
{
  request_type: 'service',
  payload: {
    service_category: 'plumbing' | 'electrical' | 'carpentry' | 'tutoring' |
                      'tech_support' | 'cleaning' | 'pet_care' | 'childcare' |
                      'landscaping' | 'photography' | 'legal' | 'financial' | 'other',
    skill_level_required: 'beginner' | 'intermediate' | 'expert',
    estimated_duration_hours?: number,  // Optional
    budget_range?: {                    // Optional
      min: number,
      max: number,
      currency: string  // e.g., 'USD'
    },
    location_type: 'on_site' | 'remote' | 'flexible',
    preferred_schedule?: {              // Optional
      days: string[],    // e.g., ['monday', 'tuesday']
      times: string[]    // e.g., ['morning', 'afternoon']
    },
    certifications_required?: string[]  // Optional
  }
}
```

**Example:**
```json
{
  "request_type": "service",
  "title": "Need plumber for leak repair",
  "description": "Kitchen pipe leaking, needs professional help",
  "urgency": "high",
  "payload": {
    "service_category": "plumbing",
    "skill_level_required": "intermediate",
    "estimated_duration_hours": 2,
    "budget_range": {
      "min": 50,
      "max": 100,
      "currency": "USD"
    },
    "location_type": "on_site",
    "certifications_required": ["Licensed Plumber"]
  }
}
```

#### Event Request
For community events needing volunteers or participants.

**Payload Schema:**
```typescript
{
  request_type: 'event',
  payload: {
    event_type: 'volunteer' | 'social' | 'educational' | 'fundraiser' | 'meeting' | 'other',
    event_date: string,                 // ISO 8601 timestamp
    event_duration_hours?: number,      // Optional
    participants_needed: number,        // 1-1000
    location: {
      is_virtual: boolean,
      address?: string,                 // Required if not virtual
      lat?: number,                     // Required if not virtual
      lng?: number,                     // Required if not virtual
      virtual_link?: string             // Required if virtual
    },
    roles?: Array<{                     // Optional
      name: string,
      count: number,
      description: string
    }>,
    recurring?: {                       // Optional
      frequency: 'daily' | 'weekly' | 'monthly',
      end_date: string
    }
  }
}
```

**Example (Physical Event):**
```json
{
  "request_type": "event",
  "title": "Community Garden Cleanup",
  "description": "Monthly garden maintenance day",
  "urgency": "low",
  "payload": {
    "event_type": "volunteer",
    "event_date": "2024-06-20T09:00:00Z",
    "event_duration_hours": 3,
    "participants_needed": 10,
    "location": {
      "is_virtual": false,
      "address": "456 Park Ave, Seattle, WA",
      "lat": 47.6097,
      "lng": -122.3331
    },
    "roles": [
      {
        "name": "Weeding",
        "count": 5,
        "description": "Help remove weeds"
      },
      {
        "name": "Planting",
        "count": 5,
        "description": "Plant new flowers"
      }
    ]
  }
}
```

**Example (Virtual Event):**
```json
{
  "request_type": "event",
  "title": "Online Tutoring Session",
  "description": "Math help for high school students",
  "urgency": "medium",
  "payload": {
    "event_type": "educational",
    "event_date": "2024-06-18T18:00:00Z",
    "event_duration_hours": 1,
    "participants_needed": 2,
    "location": {
      "is_virtual": true,
      "virtual_link": "https://zoom.us/j/123456789"
    }
  }
}
```

#### Validation Rules (All Types)

All polymorphic requests are validated using Zod discriminated unions. The `request_type` field acts as the discriminator, and TypeScript/Zod ensures the payload structure matches the selected type.

**Validation Files:**
- `packages/shared/src/schemas/requests/index.ts` - Discriminated union
- `packages/shared/src/schemas/requests/generic.ts` - Generic schema
- `packages/shared/src/schemas/requests/ride.ts` - Ride schema
- `packages/shared/src/schemas/requests/borrow.ts` - Borrow schema
- `packages/shared/src/schemas/requests/service.ts` - Service schema
- `packages/shared/src/schemas/requests/event.ts` - Event schema

**Type Guards:**
```typescript
import { isRideRequest, isBorrowRequest, isServiceRequest,
         isEventRequest, isGenericRequest } from '@karmyq/shared/schemas/requests';

// Runtime type narrowing
if (isRideRequest(request)) {
  // TypeScript knows request.payload has origin, destination, etc.
  const distance = calculateDistance(
    request.payload.origin,
    request.payload.destination
  );
}
```

**Validation Example:**
```typescript
import { validateRequest } from '@karmyq/shared/schemas/requests';

const result = validateRequest({
  request_type: 'service',
  title: 'Need plumber',
  description: 'Leak repair',
  payload: {
    service_category: 'plumbing',
    skill_level_required: 'intermediate',
    location_type: 'on_site'
  }
});

if (result.success) {
  // result.data is fully typed
  console.log(result.data.payload.service_category);
} else {
  // result.error contains Zod validation errors
  console.error(result.error.errors);
}
```

#### PATCH /requests/:id/admin-triage
Override request urgency and/or add a community-scoped admin note (Sprint 25).

**Auth:** Caller must be an active admin or moderator of the community the request belongs to.

**Request:**
```json
{
  "community_id": "uuid",
  "urgency": "high",
  "note": "Escalated — requester confirmed no transport available"
}
```

- `community_id` (required) - The community context for the triage action
- `urgency` (optional) - One of `'low'`, `'medium'`, `'high'`, `'critical'`. Updates `help_requests.urgency` when provided.
- `note` (optional) - Free-text admin note. Upserts `requests.request_admin_notes` (one note per request per community).

At least one of `urgency` or `note` must be provided (400 if neither is present).

**Response:**
```json
{ "message": "Triage saved" }
```

**Errors:**
- `400` — Neither `urgency` nor `note` provided
- `403` — Caller is not an admin or moderator of the request's community

**Implementation:** `src/routes/requests.ts` (Sprint 25)

#### POST /requests/:id/boost
Boost a request for 48 hours, adding a +0.3 feed score bonus via the feed-service boost scoring rule (Sprint 36). Admin only.

**Auth:** Caller must be an active admin of the community.

**Request:**
```json
{
  "community_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request boosted",
  "data": {
    "id": "uuid",
    "is_boosted": true,
    "boosted_at": "2026-03-23T10:00:00Z",
    "boosted_expires_at": "2026-03-25T10:00:00Z"
  }
}
```

Sets `is_boosted=TRUE`, `boosted_at=NOW()`, `boosted_expires_at=NOW()+48h`, `boosted_by=<caller>`.

**Errors:**
- `403` — Caller is not an admin of the community

**Implementation:** `src/routes/adminActions.ts`

#### DELETE /requests/:id/boost
Remove an active boost from a request (Sprint 36). Admin only.

**Auth:** Caller must be an active admin of the community.

**Query Parameters:**
- `community_id` (UUID, required)

**Response:**
```json
{
  "success": true,
  "message": "Boost removed"
}
```

Clears `is_boosted`, `boosted_at`, `boosted_expires_at`, and `boosted_by`.

**Implementation:** `src/routes/adminActions.ts`

#### POST /requests/:id/propose-match
Admin proposes a specific community member as a helper (Sprint 36). Creates a real `requests.matches` row with `status='proposed'`.

**Auth:** Caller must be an active admin of the community.

**Request:**
```json
{
  "user_id": "uuid",
  "community_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Match proposed",
  "data": {
    "match_id": "uuid",
    "request_id": "uuid",
    "responder_id": "uuid",
    "status": "proposed"
  }
}
```

**Errors:**
- `403` — Caller is not an admin of the community
- `404` — Request or user not found

**Implementation:** `src/routes/adminActions.ts`

#### PATCH /requests/:id/urgent
Toggle request urgency between `urgent` and `medium` (Sprint 36). Admin only.

**Auth:** Caller must be an active admin of the community.

**Request:**
```json
{
  "urgent": true,
  "community_id": "uuid"
}
```

- `urgent: true` — sets `urgency='urgent'`
- `urgent: false` — sets `urgency='medium'`

**Response:**
```json
{
  "success": true,
  "message": "Urgency updated",
  "data": {
    "id": "uuid",
    "urgency": "urgent"
  }
}
```

**Errors:**
- `403` — Caller is not an admin of the community

**Implementation:** `src/routes/adminActions.ts`

### 3.2 Help Offers

#### GET /offers
Get all help offers with optional filters.

**Query Parameters:** Same as GET /requests

**Implementation:** `src/routes/offers.ts:8`

#### GET /offers/:id
Get specific offer details.

**Implementation:** `src/routes/offers.ts:60`

#### POST /offers
Create new help offer.

**Request:**
```json
{
  "community_id": "uuid",
  "offerer_id": "uuid",
  "title": "I can help with moving",
  "description": "Available on weekends, have truck",
  "type": "moving"
}
```

**Events Published:** `offer.created`

**Implementation:** `src/routes/offers.ts:99`

#### PUT /offers/:id/privacy
Update privacy settings for an offer (Social Karma v2.0).

**Implementation:** `src/routes/offers.ts` (Social Karma v2.0)

### 3.3 Matches

#### GET /matches
Get all matches with optional filters.

**Query Parameters:**
- `request_id` - Filter by request
- `offer_id` - Filter by offer
- `status` - Filter by status

**Implementation:** `src/routes/matches.ts:8`

#### GET /matches/:id
Get specific match details.

**Implementation:** `src/routes/matches.ts:69`

#### POST /matches
Create a match between request and responder.

**Request:**
```json
{
  "request_id": "uuid",
  "offer_id": "uuid",
  "responder_id": "uuid"
}
```

**Note:** `offer_id` is optional (direct response without offer)

**Validation:**
- Request must exist and be 'open'
- Offer must exist and be 'active' (if provided)
- Responder cannot match their own request

**Events Published:** `match.created`

**Implementation:** `src/routes/matches.ts:113`

#### PUT /matches/:id/complete
Two-phase match completion. Each party calls this independently; the match
only becomes `completed` and karma fires when **both** parties have confirmed.

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fully_completed": false,
    "waiting_for": "helper"
  },
  "message": "Your completion recorded — waiting for the other party"
}
```

**Authorization:** Only requester or responder can complete

**Side Effects (first party only):** Sets `requester_done_at` or `responder_done_at` timestamp

**Side Effects (both parties):** Sets `status = 'completed'`, updates request status, fires `match_completed` event

**Events Published:** `match_completed` (only when both parties have confirmed)

**Implementation:** `src/routes/matches.ts`

**Schema changes (migration 017):** Added `requester_done_at TIMESTAMP` and `responder_done_at TIMESTAMP` to `requests.matches`

### 3.3b Provider Offer Endpoints (Sprint 41)

#### GET /requests/:id/offers
List pending provider offers on a specific help request. Requester only.

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "offers": [
      {
        "id": "uuid",
        "provider_id": "uuid",
        "provider_user_id": "uuid",
        "provider_email": "provider@example.com",
        "request_id": "uuid",
        "price": 50.00,
        "note": "I can help this weekend",
        "status": "pending",
        "created_at": "2026-03-26T10:00:00Z"
      }
    ]
  }
}
```

**Implementation:** `src/routes/providerOffers.ts`

#### PUT /requests/offers/:id/accept
Accept a pending provider offer. Creates a match between the requester and the provider.

**Authentication:** Required (JWT token — must be the requester)

**Response:**
```json
{
  "success": true,
  "message": "Offer accepted",
  "data": { "match_id": "uuid" }
}
```

**Events Published:** `offer_accepted`

**Implementation:** `src/routes/providerOffers.ts`

#### PUT /requests/offers/:id/decline
Decline a pending provider offer.

**Authentication:** Required (JWT token — must be the requester)

**Response:**
```json
{
  "success": true,
  "message": "Offer declined"
}
```

**Events Published:** `offer_declined`

**Implementation:** `src/routes/providerOffers.ts`

#### POST /providers/offers
Submit a provider offer on an open help request.

**Authentication:** Required (JWT token — must be an active provider)

**Request:**
```json
{
  "request_id": "uuid",
  "price": 50.00,
  "note": "Available this weekend"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "pending" },
  "message": "Offer submitted"
}
```

**Events Published:** `offer_submitted`

**Implementation:** `src/routes/providerOffers.ts`

#### GET /providers/offers
List offers submitted by the authenticated provider.

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "offers": [
      {
        "id": "uuid",
        "request_id": "uuid",
        "request_title": "Need help with plumbing",
        "price": 50.00,
        "note": "Available this weekend",
        "status": "pending",
        "created_at": "2026-03-26T10:00:00Z"
      }
    ]
  }
}
```

**Implementation:** `src/routes/providerOffers.ts`

#### PUT /providers/offers/:id/withdraw
Withdraw a pending provider offer.

**Authentication:** Required (JWT token — must be the offer owner)

**Response:**
```json
{
  "success": true,
  "message": "Offer withdrawn"
}
```

**Implementation:** `src/routes/providerOffers.ts`

### 3.3c Dibs Endpoints (Sprint 42)

Dibs is a private first-refusal window for any request type. All requests (scheduled and ASAP) are eligible for dibs as of Sprint 50.

**Eligibility rules:**
- For service requests (`type = 'service'`): candidate must have a provider profile with `is_available = true` and `priorInteractions >= 1`
- For all other request types (mutual aid, ride, event, borrow, generic): any community member with `priorInteractions >= 1` is eligible
- Only one active dibs record per request (`UNIQUE(request_id)`)

**Window formula:**
- Scheduled: `expires_at = created_at + 0.20 × (scheduled_for − created_at)`
- ASAP / non-scheduled: `expires_at = created_at + 24h`

**Status flow:** `open` → `dibs_pending` → `matched` (accept) | `open` (decline/expire)

#### GET /requests/:id/dibs-candidate
Returns the top-scored dibs candidate for any request. Accepts optional `?type=` query param — `type=service` uses provider-profile candidates; any other value (or missing) uses mutual-aid candidates.

**Candidate selection — two-tier explore/exploit (ADR-051, Sprint 51):**
- **Tier 1 (exploit):** Prior interactions ≥ 1 + available. Preferred.
- **Tier 2 (explore):** 0 prior interactions + `trustGraphConnection = 'direct'` (exchange connections only) + available. Fallback when Tier 1 is empty.

**Mutual aid trust scores (Sprint 51):** `getMutualAidCandidates` reads `reputation.trust_scores` via correlated subquery (`MAX(score)` across requester's communities, default 50). Previously hardcoded to 50.

Returns `null` if no eligible candidate exists in either tier.

**Authentication:** Required (JWT token — must be the requester)

**Response (Sprint 52):** includes `trustPath` fetched from social-graph-service.
```json
{
  "success": true,
  "data": {
    "provider_user_id": "uuid",
    "provider_id": "uuid",
    "match_score": 87,
    "prior_interactions": 3,
    "trustPath": {
      "degrees_of_separation": 2,
      "path": [{ "id": "...", "name": "You" }, { "id": "...", "name": "Jordan" }, { "id": "...", "name": "Alice" }],
      "connection_type": "exchange"
    }
  }
}
```
`trustPath` is `null` if no path found or social-graph is unavailable (non-fatal degradation).
Returns `"data": null` when no eligible candidate is found.

**Implementation:** `src/routes/dibs.ts`

#### POST /requests/:id/dibs
Send dibs to a specific provider or community member. Valid for all request types (scheduled and ASAP).

**Authentication:** Required (JWT token — must be the requester)

**Request:**
```json
{
  "provider_id": "uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "request_id": "uuid",
    "provider_user_id": "uuid",
    "status": "pending",
    "expires_at": "2026-03-28T14:00:00Z",
    "created_at": "2026-03-28T13:00:00Z"
  }
}
```

**Errors:**
- `400 ASAP_NOT_ELIGIBLE` — Request has no `scheduled_for`
- `403 NO_PRIOR_INTERACTION` — Provider has no prior interaction with requester
- `409 DIBS_ALREADY_SENT` — A pending dibs record already exists for this request

**Events Published:** `dibs_submitted`

**Implementation:** `src/routes/dibs.ts`

#### PUT /requests/dibs/:id/accept
Provider accepts dibs. Creates a `requests.matches` record directly and sets request status to `matched`.

**Authentication:** Required (JWT token — must be the dibs provider)

**Response:**
```json
{
  "success": true,
  "data": {
    "dibs_status": "accepted",
    "match_id": "uuid"
  }
}
```

**Events Published:** `dibs_accepted`

**Implementation:** `src/routes/dibs.ts`

#### PUT /requests/dibs/:id/decline
Provider declines dibs. Reverts request status to `open` for public broadcast.

**Authentication:** Required (JWT token — must be the dibs provider)

**Response:**
```json
{
  "success": true,
  "data": {
    "dibs_status": "declined"
  }
}
```

**Events Published:** `dibs_declined`

**Implementation:** `src/routes/dibs.ts`

#### GET /requests/dibs/pending-for-provider
Returns the authenticated provider's pending dibs records (status = `pending`).

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "request_id": "uuid",
      "request_title": "Need help with plumbing",
      "scheduled_for": "2026-03-30T10:00:00Z",
      "expires_at": "2026-03-28T16:00:00Z",
      "status": "pending"
    }
  ]
}
```

**Implementation:** `src/routes/dibs.ts`

#### POST /requests/dibs/:id/expire
TEST-ONLY: Force-expire a dibs record regardless of `expires_at`. Sets status to `expired` and reverts request to `open`.

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "dibs_status": "expired"
  }
}
```

**Implementation:** `src/routes/dibs.ts`

### 3.4 Interaction Feedback (Social Karma v2.0)

#### POST /matches/:id/feedback
Submit interaction feedback for a completed match.

**Request:**
```json
{
  "from_user_id": "uuid",
  "helpfulness": 5,
  "responsiveness": 4,
  "clarity": 5,
  "comment": "Great communication, very helpful exchange!",
  "allow_featuring": true
}
```

**Validation:**
- Match must be completed
- `from_user_id` must be requester or responder
- Can only submit feedback once per match
- All ratings must be 1-5

**Two-Way Consent Logic:**
When both parties submit feedback with `allow_featuring = true`:
1. Check `requester_visibility_consent` and `responder_visibility_consent`
2. If both true: Names visible in featured story
3. If either false: Anonymous story only
4. Update `matches.requester_visible` and `matches.responder_visible`

**Events Published:** `interaction_feedback.submitted`

**Implementation:** `src/routes/feedback.ts`

#### GET /matches/:id/feedback
Get feedback for a match.

**Authorization:** Only requester or responder can view

**Implementation:** `src/routes/feedback.ts`

### 3.5 Health Check

#### GET /providers
List all provider profiles. Optional query param: service_type.

#### GET /providers/my
Get the authenticated user's own provider profiles. Auth required.

#### GET /providers/:id
Get a single provider profile by ID, including ride details if applicable.

#### POST /providers
Create a provider profile for the authenticated user.

#### PUT /providers/:id
Update a provider profile. Owner only.

#### DELETE /providers/:id
Delete a provider profile. Owner only.

#### GET /collectives
List all provider collectives. Optional query param: service_type.

#### GET /collectives/my
Get collectives the authenticated user belongs to (via their provider profiles). Auth required.

#### GET /collectives/:id
Get a collective with members and communities served.

#### POST /collectives
Create a new provider collective.

#### PUT /collectives/:id
Update a collective. Collective admin only.

#### DELETE /collectives/:id
Delete a collective. Collective admin only.

#### POST /collectives/:id/members
Join a collective as a member.

#### DELETE /collectives/:id/members/:providerId
Remove a member from a collective. Collective admin only.

#### POST /collectives/:id/communities
Link a collective to a community.

#### DELETE /collectives/:id/communities/:communityId
Unlink a collective from a community. Auth: collective admin OR community admin (Sprint 26).

#### GET /collectives/:id/stats
Returns aggregate performance stats for a collective: `total_requests_matched`, `fulfillment_rate`, `avg_completion_hours` (null if no completed matches), `communities_served_count`, `available_member_count`. Auth required.

#### PATCH /providers/:providerId/availability
Toggle a provider's availability status. Body: `{ is_available: boolean }`. Auth: owner only (provider_profiles.user_id must match JWT userId). Returns `{ id, is_available }`. (Sprint 26)

#### GET /requests/providers/:providerId/rate-cards
List active rate cards for a provider (public). Owner can pass `?include_inactive=true` to include deactivated cards.

#### POST /requests/providers/:providerId/rate-cards
Create a new rate card for a provider. Auth: owner only. Body: `{ label, pricing_model, rate_amount?, rate_unit?, currency?, notes? }`.

#### PUT /requests/providers/:providerId/rate-cards/:cardId
Update an existing rate card. Auth: owner only.

#### DELETE /requests/providers/:providerId/rate-cards/:cardId
Soft-delete a rate card — sets `is_active = false`. Auth: owner only. Card remains in database for historical reference.

**Note:** `POST /requests` now accepts optional `preferred_provider_id` (UUID) in the request body, allowing a requestor to pre-select a provider when filing a typed request.

#### GET /health
Service health check.

**Response:**
```json
{
  "service": "request-service",
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

---

## 4. Events

### 4.1 Published Events

| Event Name | Queue | Payload | When Emitted |
|------------|-------|---------|--------------|
| `request.created` | `karmyq-events` | `{ request_id, requester_id, community_id, category }` | After successful request creation |
| `request.completed` | `karmyq-events` | `{ request_id, requester_id, community_id }` | When request status changed to 'completed' |
| `request.cancelled` | `karmyq-events` | `{ request_id, requester_id, community_id }` | When request is cancelled |
| `offer.created` | `karmyq-events` | `{ offer_id, offerer_id, community_id, category }` | After successful offer creation |
| `match.created` | `karmyq-events` | `{ match_id, request_id, offer_id, responder_id }` | When request and responder are matched |
| `match.completed` | `karmyq-events` | `{ match_id, request_id, responder_id, completed_at }` | When match is marked as completed |
| `interaction_feedback.submitted` | `karmyq-events` | `{ feedback_id, match_id, from_user_id, to_user_id, ratings }` | When user submits feedback (Social Karma v2.0) |
| `privacy_settings.updated` | `karmyq-events` | `{ entity_type, entity_id, is_public, visibility_consent }` | When request/offer privacy changes (Social Karma v2.0) |

### 4.2 Consumed Events
None currently. Request Service does not consume events.

**Note:** In v9.0 (Everything App), this service will consume:
- `user.verified` - To unlock premium request types (rides, services)

### 4.3 Event Publishing Pattern

```typescript
// src/routes/requests.ts
import { publishEvent } from '../events/publisher';

// After successful request creation
await publishEvent('request.created', {
  request_id: newRequest.id,
  requester_id: req.user.id,
  community_id: req.community.id,
  category: newRequest.category
});
```

---

## 5. Key Patterns

### 5.1 Authentication & Authorization Flow

**Standard Auth Pattern:**
```typescript
// All routes protected with auth middleware
router.post('/requests',
  authenticateToken,           // Verify JWT
  extractCommunityContext,     // Set req.community
  requireRole('member'),       // Check minimum role
  async (req, res) => { ... }
);
```

**Membership Verification:**
```typescript
// Verify user is active community member before allowing post
const memberCheck = await db.query(
  `SELECT id FROM communities.members
   WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
  [community_id, requester_id]
);

if (memberCheck.rowCount === 0) {
  return res.status(403).json({
    success: false,
    message: 'Only community members can post requests'
  });
}
```

**Requester-Only Updates:**
```typescript
// Only original requester can update/cancel their request
const requestCheck = await db.query(
  `SELECT requester_id FROM requests.help_requests WHERE id = $1`,
  [id]
);

if (requestCheck.rows[0].requester_id !== user_id) {
  return res.status(403).json({
    success: false,
    message: 'Only the requester can update this request'
  });
}
```

### 5.2 Skill-Based Matching Algorithm

**Category-to-Skill Mapping:**

| Category | Matched Skills |
|----------|---------------|
| transportation | driving |
| moving | moving, handyman |
| childcare | childcare |
| pet_care | pet_care |
| tech_support | tech_support, coding |
| home_repair | home_repair, handyman, electrical, plumbing, carpentry |
| gardening | gardening |
| cooking | cooking, baking |
| tutoring | tutoring |
| language | languages |
| professional_advice | career_advice |
| cleaning | cleaning, organizing |

**Matching Query Pattern:**
```sql
SELECT
  r.id, r.title, r.category, r.urgency,
  CASE
    WHEN r.urgency = 'high' THEN 3
    WHEN r.urgency = 'medium' THEN 2
    ELSE 1
  END as urgency_priority,
  c.name as community_name,
  u.name as requester_name,
  r.created_at
FROM requests.help_requests r
INNER JOIN communities.communities c ON r.community_id = c.id
INNER JOIN auth.users u ON r.requester_id = u.id
WHERE r.status = 'open'
  AND r.requester_id != $1                    -- Exclude user's own requests
  AND EXISTS (
    SELECT 1 FROM communities.members m
    WHERE m.user_id = $1
      AND m.community_id = r.community_id
      AND m.status = 'active'                 -- Only user's communities
  )
  AND EXISTS (
    SELECT 1 FROM auth.user_skills s
    WHERE s.user_id = $1
    AND (
      (r.category = 'moving' AND s.skill IN ('moving', 'handyman'))
      OR (r.category = 'tech_support' AND s.skill IN ('tech_support', 'coding'))
      -- ... other category mappings
    )
  )
ORDER BY urgency_priority DESC, r.created_at ASC
LIMIT $2;
```

### 5.3 Database Query Pattern (RLS-Aware)

```typescript
// All queries respect community_id for multi-tenant isolation
const result = await db.query(
  `SELECT * FROM requests.help_requests
   WHERE community_id = $1 AND status = $2`,
  [req.community.id, 'open']
);
```

### 5.4 Event Publishing Pattern

```typescript
// Publish event after successful database operation
const newRequest = await db.query(
  'INSERT INTO requests.help_requests (...) VALUES (...) RETURNING *',
  [...]
);

// Fire and forget (don't block response)
await publishEvent('request.created', {
  request_id: newRequest.rows[0].id,
  requester_id: req.user.id,
  community_id: req.community.id
});

return res.status(201).json({
  success: true,
  data: newRequest.rows[0]
});
```

---

## 6. Dependencies

### 6.1 Upstream Services (This service calls)
- **Community Service** (via database) - Verify community membership
- **Auth Service** (via database) - Get user details and skills

### 6.2 Downstream Services (This service is called by)
- **Gateway** - All client requests route through gateway
- **Frontend (Web)** - For browsing/creating requests and offers
- **Frontend (Mobile)** - Mobile app access
- **Feed Service** - Reads open requests for personalized feed

### 6.3 Event Consumers (Who listens to our events)
- **Reputation Service** - Listens to `match.completed` → Awards karma
- **Notification Service** - Listens to `request.created` → Notifies community
- **Feed Service** - Listens to `request.created` → Updates feed

### 6.4 Shared Libraries
- `@karmyq/shared/middleware` - `authenticateToken`, `extractCommunityContext`, `requireRole`
- `@karmyq/shared/utils/logger` - Structured logging
- `@karmyq/shared/database` - PostgreSQL connection utilities
- `@karmyq/shared/schemas/requests` - Zod validation schemas for polymorphic requests (v9.0)
- `@karmyq/shared/matching` - Match scoring, `resolveSourceTier()`, `DEFAULT_FEED_PREFERENCES`, feed scoring utilities (ADR-031)

---

## 7. Testing

### 7.1 Unit Tests

**Run Tests:**
```bash
cd services/request-service
npm test
```

**Test Structure:**
```
src/__tests__/
├── requests.test.ts       # Request CRUD and matching
├── offers.test.ts         # Offer CRUD
└── matches.test.ts        # Match creation and completion
```

### 7.2 Integration Tests

**Run Integration Tests:**
```bash
cd tests
npm run test:integration -- integration/request-service.test.ts
```

**Test Scenarios:**
- Request lifecycle (create → match → complete)
- Skill-based matching algorithm
- Privacy controls (Social Karma v2.0)
- Event publishing

### 7.3 Test Fixtures

**Test Personas:**
- `tests/fixtures/quick-seed.sql` - 7 test personas
- `tests/fixtures/large-dataset.sql` - 2000 users, realistic data

**Mock Data:**
```typescript
// Example test request
const testRequest = {
  community_id: 'test-community-uuid',
  requester_id: 'test-user-uuid',
  title: 'Test: Need help moving',
  description: 'Moving couch upstairs',
  type: 'moving',
  urgency: 'high'
};
```

### 7.4 Key Test Scenarios

**Generic Requests (v8.0 - Legacy Tests):**
- [x] Create generic request successfully
- [x] Reject request with missing required fields
- [x] Only requester can update their request
- [x] User cannot match their own request
- [x] Skill-based matching returns relevant requests
- [x] Privacy settings update correctly
- [x] Two-way consent logic works correctly

**Polymorphic Requests (v9.0 - Production):**
- [x] Create generic request (backward compatibility) - `tests/integration/polymorphic-requests-lifecycle.test.ts`
- [x] Create ride request with valid coordinates - `tests/integration/polymorphic-requests-lifecycle.test.ts`
- [x] Create service request with skill requirements - `tests/integration/polymorphic-requests-lifecycle.test.ts`
- [x] Create event request (physical + virtual) - `tests/integration/polymorphic-requests-lifecycle.test.ts`
- [x] Create borrow request with item details - `tests/integration/polymorphic-requests-lifecycle.test.ts`
- [x] Reject ride request with invalid coordinates - `tests/unit/validation.test.ts`
- [x] Validate payload against Zod schema - `tests/unit/validation.test.ts`
- [x] Emit `request.created` with `request_type` field - `tests/integration/events.test.ts`
- [x] Multi-community posting with post_to_all_communities - `tests/integration/polymorphic-requests-lifecycle.test.ts`

**Curated Feed & Matching (v9.0 - Production):**
- [x] Calculate match scores for all 5 request types - `tests/unit/curated-feed.test.ts` (69 tests)
- [x] Filter by user skills and preferences - `tests/integration/curated-feed-preferences.test.ts`
- [x] Sort by match score descending - `tests/unit/curated-feed.test.ts`
- [x] Apply minimum match score threshold - `tests/integration/curated-feed-preferences.test.ts`
- [x] Return match reasons and breakdown - `tests/unit/curated-feed.test.ts`
- [x] Respect user request type subscriptions - `tests/integration/curated-feed-preferences.test.ts`

**User Preferences (v9.0 - Production):**
- [x] Subscribe/unsubscribe from request types - `tests/integration/curated-feed-preferences.test.ts`
- [x] Add/remove user interests - `tests/integration/curated-feed-preferences.test.ts`
- [x] Persist preferences across sessions - `tests/integration/curated-feed-preferences.test.ts`
- [x] Filter curated feed by preferences - `tests/integration/curated-feed-preferences.test.ts`

**UX & Smart Defaults (v9.0 - Production):**
- [x] Generic type shown by default - `tests/unit/smart-defaults.test.tsx`
- [x] Type selector collapsible (progressive disclosure) - `tests/unit/smart-defaults.test.tsx`
- [x] Create generic request in < 3 clicks - `tests/e2e/12-polymorphic-requests-ux.spec.ts`
- [x] Display match scores on request cards - `tests/e2e/12-polymorphic-requests-ux.spec.ts`
- [x] Toggle between all requests and curated feed - `tests/e2e/12-polymorphic-requests-ux.spec.ts`

**Event Publishing:**
- [x] `request.created` event published on creation
- [x] `match.completed` event published on completion
- [x] Events include all required payload fields

### 7.5 Manual Testing with curl

**Create Request:**
```bash
curl -X POST http://localhost:3003/requests \
  -H "Content-Type: application/json" \
  -d '{
    "community_id": "uuid-here",
    "requester_id": "uuid-here",
    "title": "Need help moving couch",
    "description": "Heavy couch, need 2-3 people",
    "type": "moving",
    "urgency": "high"
  }'
```

**Get Matched Requests:**
```bash
curl "http://localhost:3003/requests/matched/for-user?user_id=uuid-here&limit=5"
```

**Complete Match:**
```bash
curl -X PUT http://localhost:3003/matches/uuid-here \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "user_id": "uuid-here"
  }'
```

---

## 8. Configuration

### 8.1 Environment Variables

```bash
# Server
PORT=3003
NODE_ENV=development          # development | production

# Database
DATABASE_URL=postgresql://karmyq_user:password@localhost:5432/karmyq_db

# Redis (for events)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info                # debug | info | warn | error
```

### 8.2 Feature Flags

**Current (v8.0):**
- All features enabled by default

**Planned (v9.0 - Everything App):**
```bash
# Feature flags for new verticals
ENABLE_RIDE_REQUESTS=false
ENABLE_BORROW_REQUESTS=false
ENABLE_SERVICE_REQUESTS=false
ENABLE_EVENT_REQUESTS=false
```

### 8.3 Database Connection Pool

```typescript
// src/database/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000
});
```

---

## 9. Monitoring & Observability

### 9.1 Key Metrics

**Request Metrics:**
- Total requests created (counter)
- Requests by category (counter with labels)
- Requests by urgency (counter with labels)
- Open requests count (gauge)

**Match Metrics:**
- Matches created (counter)
- Matches completed (counter)
- Time to first match (histogram)

**API Performance:**
- Request latency (histogram)
- Error rate (counter)
- Throughput (requests/second)

### 9.2 Logging

**Structured JSON Logging:**
```typescript
import { logger } from '@karmyq/shared/utils/logger';

logger.info('Request created', {
  request_id: newRequest.id,
  requester_id: req.user.id,
  community_id: req.community.id,
  category: newRequest.category
});

logger.error('Failed to create request', {
  error: err.message,
  stack: err.stack,
  requester_id: req.user.id
});
```

**Log Levels:**
- `DEBUG` - Detailed query logs, matching algorithm steps
- `INFO` - Request creation, match completion
- `WARN` - Invalid input, failed validations
- `ERROR` - Database errors, event publishing failures

### 9.3 Health Checks

**Endpoint:** `GET /health`

**Health Check Logic:**
```typescript
// src/routes/health.ts
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');

    // Check Redis connection
    await redis.ping();

    res.json({
      service: 'request-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        redis: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      service: 'request-service',
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

**Monitoring Alerts:**
- Database connection failures
- Redis connection failures
- High error rate (>5% of requests)
- High latency (P95 > 500ms)

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Issue: Skill-based matching returns no results

**Symptoms:** `GET /requests/matched/for-user` returns empty array

**Diagnosis:**
1. Check user has skills:
   ```sql
   SELECT * FROM auth.user_skills WHERE user_id = 'uuid-here';
   ```

2. Check user is member of communities:
   ```sql
   SELECT * FROM communities.members
   WHERE user_id = 'uuid-here' AND status = 'active';
   ```

3. Check requests exist in those communities:
   ```sql
   SELECT * FROM requests.help_requests
   WHERE community_id IN (...) AND status = 'open';
   ```

4. Verify category-to-skill mapping matches user's skills
5. Ensure user is not the requester (excluded from results)

**Solution:**
- Add skills to user: `INSERT INTO auth.user_skills ...`
- Ensure user joined communities
- Verify skill mapping in Section 5.2

#### Issue: Request not appearing in list

**Symptoms:** Request exists but not in `GET /requests` response

**Diagnosis:**
1. Check request status:
   ```sql
   SELECT status FROM requests.help_requests WHERE id = 'uuid-here';
   ```

2. Verify `community_id` filter if applied
3. Check pagination (limit/offset)
4. Verify request hasn't been soft-deleted

**Solution:**
- Use correct status filter
- Increase limit or adjust offset
- Check all status values: `open`, `matched`, `completed`, `cancelled`

#### Issue: Match creation fails

**Symptoms:** `POST /matches` returns 400 or 403

**Diagnosis:**
1. Verify request exists and is 'open':
   ```sql
   SELECT id, status FROM requests.help_requests WHERE id = 'uuid-here';
   ```

2. If using offer, verify it's 'active':
   ```sql
   SELECT id, status FROM requests.help_offers WHERE id = 'uuid-here';
   ```

3. Check responder is not requester
4. Look for duplicate match error (unique constraint)

**Solution:**
- Ensure request is in 'open' status
- Verify offer_id is valid (or omit for direct match)
- Different user_id for responder

#### Issue: Events not publishing

**Symptoms:** No events in Redis queue, downstream services not reacting

**Diagnosis:**
1. Check Redis connection:
   ```bash
   docker exec -it karmyq-redis redis-cli PING
   ```

2. Verify REDIS_URL environment variable
3. Check event publisher initialization in logs
4. Look for try-catch that swallows errors

**Solution:**
- Restart Redis: `docker-compose restart redis`
- Update REDIS_URL in `.env`
- Check publisher initialization: `src/events/publisher.ts`

#### Issue: Database connection errors

**Symptoms:** 500 errors, "connection pool exhausted"

**Diagnosis:**
1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

3. Test connection:
   ```bash
   psql $DATABASE_URL
   ```

4. Check requests schema exists:
   ```sql
   \dn
   ```

**Solution:**
- Restart PostgreSQL: `docker-compose restart postgres`
- Verify connection string format
- Run migrations: `psql $DATABASE_URL < infrastructure/postgres/init.sql`

### 10.2 Performance Issues

#### Issue: Slow skill-based matching queries

**Solution:**
- Verify indexes exist: `idx_help_requests_community_id`, `idx_help_requests_category`
- Add index on `auth.user_skills(user_id, skill)` if missing
- Consider materialized view for frequently accessed matches

#### Issue: High memory usage

**Solution:**
- Check connection pool size (default: 20)
- Verify connections are being released properly
- Monitor with: `docker stats karmyq-request-service`

### 10.3 Recent Changes (v9.10)

**Version 9.15.0 - Sprint 41 (2026-03-26)**

Provider offer flow — providers can now submit, list, and withdraw priced offers on open requests; requesters can accept or decline pending offers.

- **NEW**: `GET /requests/:id/offers` — list provider offers on a specific request (requester only)
- **NEW**: `PUT /requests/offers/:id/accept` — accept a pending provider offer; creates a match
- **NEW**: `PUT /requests/offers/:id/decline` — decline a pending provider offer
- **NEW**: `POST /providers/offers` — submit a provider offer on an open help request
- **NEW**: `GET /providers/offers` — list offers submitted by the authenticated provider
- **NEW**: `PUT /providers/offers/:id/withdraw` — withdraw a pending provider offer
- **Schema**: New `provider.offers` table (`id`, `provider_id`, `provider_user_id`, `request_id`, `price`, `note`, `status`, `created_at`, `updated_at`)
- **Events Published**: `provider_went_on_duty`, `offer_submitted`, `offer_accepted`, `offer_declined`
- **Files**: `src/routes/providerOffers.ts`

**Version 9.14.0 - Sprint 40 (2026-03-25)**

- `requests.matches.admin_proposed BOOLEAN NOT NULL DEFAULT FALSE` — set to TRUE when match created via the `POST /requests/:id/propose-match` admin route (migration 018)
- `GET /requests/curated` now returns `is_boosted` and `boosted_expires_at` fields per request item
- Active boost contributes +30 to feedScore (capped at 100) during feed score calculation

**Version 9.10.0 - Admin Power Actions (Sprint 36, 2026-03-23)**

New admin action endpoints giving community admins direct control over request visibility and matching:

1. **Boost System** — `POST /requests/:id/boost` / `DELETE /requests/:id/boost`
   - Sets `is_boosted=TRUE` with a 48-hour expiry on `requests.help_requests`
   - New columns added via migration 015: `is_boosted`, `boosted_at`, `boosted_expires_at`, `boosted_by`
   - Boosted requests receive a +0.3 feed score bonus in the feed-service (capped at 1.0)
2. **Propose Match** — `POST /requests/:id/propose-match`
   - Admin can propose a specific community member as a helper
   - Creates a `requests.matches` row with `status='proposed'`
3. **Toggle Urgency** — `PATCH /requests/:id/urgent`
   - Admin can flip urgency between `urgent` and `medium`
   - Distinct from the existing `PATCH /requests/:id/admin-triage` (which also handles notes)
4. All endpoints live in `src/routes/adminActions.ts` and require the caller to be an active community admin

**Version 9.0.0 - Polymorphic Request System (2026-02-05)**

This major release transforms the request system from single-type generic requests to a polymorphic system supporting 5 specialized request types with intelligent feed curation.

**Core Features:**

1. **Polymorphic Request Types** (Days 1-5)
   - Added `request_type` enum column: `generic`, `ride`, `service`, `event`, `borrow`
   - Added JSONB `payload` column for type-specific data
   - Added JSONB `requirements` column for matching criteria
   - Implemented Zod discriminated union validation in `@karmyq/shared/schemas/requests`
   - Created type-specific schemas for all 5 request types
   - Added type guards for runtime type narrowing

2. **Smart Defaults & Progressive Disclosure** (Day 6)
   - Default to `generic` request type (reduces clicks from 3 to 2)
   - Collapsible type selector with progressive disclosure UX
   - Request type examples and "Most Used" badges
   - Target: < 3 clicks to create generic request (achieved: 2 clicks)

3. **Curated Feed with Match Scores** (Day 7)
   - New endpoint: `GET /requests/curated` with match score calculation
   - Type-specific matching algorithms in `@karmyq/shared/matching`
   - Match scores (0-100%) with transparency (reasons + breakdown)
   - Skill-based filtering using user profile
   - Result: 85% noise reduction (100 requests → 15 relevant)

4. **User Preferences System** (Day 8)
   - Request type subscriptions (subscribe/unsubscribe per type)
   - Interest-based filtering (service categories, item categories, event types)
   - Preference persistence in `auth.user_request_preferences` table
   - Interest storage in `auth.user_interests` table
   - Result: 67% additional reduction (15 requests → 5 highly relevant)
   - Combined: 95% total noise reduction

5. **Multi-Community Posting** (Days 1-5)
   - New junction table: `requests.request_communities`
   - Support for `post_to_all_communities` flag
   - Requests can appear in multiple communities

6. **Comprehensive Testing** (Days 9-12)
   - 200+ tests covering all features
   - Unit tests (69 tests for curated feed algorithm)
   - Regression tests (40+ integration tests for polymorphic lifecycle)
   - Integration tests (30+ tests for preferences + curated feed)
   - E2E tests (25+ Playwright tests for complete user flows)

**Database Changes:**
```sql
-- Migration 009_polymorphic_requests.sql
ALTER TABLE requests.help_requests
  ADD COLUMN request_type request_type_enum NOT NULL DEFAULT 'generic',
  ADD COLUMN payload JSONB,
  ADD COLUMN requirements JSONB;

CREATE TYPE request_type_enum AS ENUM ('generic', 'ride', 'service', 'event', 'borrow');

-- Migration 010_user_request_preferences.sql
CREATE TABLE auth.user_request_preferences (
    user_id UUID NOT NULL,
    request_type request_type_enum NOT NULL,
    subscribed BOOLEAN DEFAULT true,
    PRIMARY KEY (user_id, request_type)
);

CREATE TABLE auth.user_interests (
    user_id UUID NOT NULL,
    interest_type VARCHAR(50) NOT NULL,
    interest_value VARCHAR(100) NOT NULL,
    PRIMARY KEY (user_id, interest_type, interest_value)
);
```

**API Changes:**
- ✅ POST /requests - Now accepts polymorphic payloads with `request_type` + `payload`
- ✅ GET /requests/curated - New endpoint for intelligent feed curation
- ✅ Backward compatible - Generic requests work exactly as before

**Frontend Changes:**
- ✅ Smart defaults with progressive disclosure UX
- ✅ Curated feed toggle with match score slider
- ✅ Match score badges and reason tooltips
- ✅ Preferences page for type subscriptions and interests

**Performance Impact:**
- Payload column uses JSONB with GIN indexes for fast queries
- Curated feed endpoint optimized with user preference filtering
- Match score calculation in-memory (no additional DB queries per request)

**Migration Path:**
- All existing requests automatically assigned `request_type = 'generic'`
- `payload = {}` for backward compatibility
- No breaking changes to existing API contracts

### 10.4 Known Issues

**Current Issues (v9.0.0):**

1. **Location-Based Matching Not Implemented**
   - Match scores don't yet consider geographic proximity for ride/service requests
   - Planned: PostGIS integration for distance-based scoring
   - Workaround: Users manually filter by community (implicit location)

2. **Event Recurring Patterns Not Fully Implemented**
   - Event schema includes `recurring` field but no backend logic to create recurring instances
   - Planned: Scheduled job to generate recurring event requests
   - Workaround: Users manually create multiple event requests

3. **Image Upload for Borrow Requests Not Implemented**
   - Borrow schema includes `images` field but no upload endpoint
   - Planned: Image upload service integration
   - Workaround: Users include image URLs in description

4. **Budget Range Not Enforced in Matching**
   - Service requests include budget_range but not used in match score calculation
   - Planned: Budget-based filtering in curated feed
   - Workaround: Users manually review budget in request details

5. **Certification Verification Not Automated**
   - Service requests can require certifications but no automated verification
   - Planned: Integration with credential verification service
   - Workaround: Manual verification during match acceptance

**Resolved Issues:**

1. ✅ **TypeScript Type Narrowing for Polymorphic Payloads** (Resolved Day 6)
   - Issue: TypeScript couldn't infer payload structure from request_type
   - Solution: Implemented type guards (isRideRequest, isServiceRequest, etc.)
   - Files: `packages/shared/src/schemas/requests/index.ts`

2. ✅ **Jest Not Finding Regression Tests** (Resolved Days 4-5)
   - Issue: New regression test directory not included in jest.config.js
   - Solution: Updated testMatch pattern to include `tests/regression/**/*.test.ts`
   - Files: `services/request-service/jest.config.js`

3. ✅ **Event Matcher Accessing Undefined Location** (Resolved Day 7)
   - Issue: Event location.is_virtual check failed when location undefined
   - Solution: Added proper null checking and required location field validation
   - Files: `packages/shared/src/matching/matchers/event.ts`

4. ✅ **Workspace Alias Imports in Unit Tests** (Resolved Day 6)
   - Issue: `@karmyq/shared` imports failed in Jest tests
   - Solution: Changed to relative path imports from workspace root
   - Files: All unit test files

5. ✅ **Provider offer acceptance did not close the request** (Resolved 2026-05-06)
   - Issue: `offersDb.acceptOffer` inserted a `matched` match record but never set `requests.help_requests.status = 'matched'`, leaving the request `open`. Old proposed matches remained visible in CommitmentsTab with an Accept button that fired "Match must be in proposed state to accept".
   - Solution: Added `UPDATE requests.help_requests SET status = 'matched'` and a bulk reject of remaining `proposed` matches — same pattern used by `dibs.ts` and `matches.ts` accept paths.
   - Files: `src/db/offersDb.ts`

6. ✅ **validateRequestForOffer used stale JWT community IDs** (Resolved 2026-05-06)
   - Issue: Offer validation compared provider's JWT community array against request communities. Stale JWTs (or membership in >15 communities) caused "Request not found in your communities" for valid providers.
   - Solution: Rewrote to JOIN `communities.members` live, removing the JWT-sourced `communityIds` parameter.
   - Files: `src/db/providerOffersDb.ts`, `src/routes/providerOffers.ts`

**Performance Considerations:**

- JSONB payload queries are fast with GIN indexes but not as fast as native columns
- Curated feed endpoint performs N+1 matching calculations (optimized with limit parameter)
- Match score calculation is CPU-bound but fast (~0.1ms per request)
- User preference lookup adds ~5ms to curated feed endpoint

---

## 11. Future Enhancements

### 11.1 v9.0 - Polymorphic Request System ✅ COMPLETED (2026-02-05)

- [x] **Polymorphic Data Model** - Added `request_type`, `payload`, `requirements` columns
- [x] **Zod Schema Validation** - Validate payloads against type-specific schemas
- [x] **Ride Requests** - Origin/destination coordinates, seats needed, preferences
- [x] **Borrow Requests** - Item category, condition, duration, return date
- [x] **Service Requests** - Professional services with skill levels, budget, certifications
- [x] **Event Requests** - Community events with RSVP, physical + virtual support
- [x] **Curated Feed** - Match score algorithm with skill-based filtering
- [x] **User Preferences** - Request type subscriptions and interest-based filtering
- [x] **Smart Defaults** - Progressive disclosure UX (< 3 clicks to post)
- [x] **Multi-Community Posting** - Requests visible across multiple communities
- [x] **Comprehensive Testing** - 200+ tests (unit, regression, integration, E2E)

### 11.2 v9.1 - Provider Profiles (ADR-041) ✅ COMPLETED (2026-02-27)

**New endpoints** (see `src/routes/providers.ts`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/providers` | Public | Browse active providers, filter by `service_type` |
| GET | `/providers/:id` | Public | Get single provider with ride details + trust score |
| POST | `/providers` | Required | Create provider profile (+ ride details if `service_type=ride`) |
| PUT | `/providers/:id` | Owner | Update profile or ride details |
| DELETE | `/providers/:id` | Owner | Delete profile (cascades reviews/trust scores) |

**New tables** (migration 022):
- `requests.provider_profiles` — generic base (Sprint 26: `is_available BOOLEAN DEFAULT FALSE` added via migration 20260314)
- `requests.provider_ride_details` — ride-specific extension
- `reputation.provider_reviews` — stars + text, tied to match_id
- `reputation.provider_trust_scores` — computed cache (ADR-042)

**Community config additions**:
- `provider_services_enabled` — opt-in per community
- `provider_min_personal_trust_score` — gate by ADR-037 trust
- `provider_services_list` — allowed service types

### 11.4 Matching Engine Enhancements

- [ ] Auto-matching algorithm (suggest best helpers)
- [ ] Location-based matching (PostGIS integration)
- [ ] Skill proficiency levels (beginner, intermediate, expert)
- [ ] Multi-helper requests (request needs 3 people)

### 11.3 Request Lifecycle

- [ ] Request expiration (auto-cancel old requests)
- [ ] Request templates (common request types)
- [ ] Recurring requests (weekly/monthly help)
- [ ] Request attachments/images

### 11.4 Quality & Trust

- [ ] Helper ratings aggregation
- [ ] Verified helper badges
- [ ] Request categories requiring verification (e.g., childcare)

---

## 12. Related Documentation

### 12.1 Architecture Documentation
- [Main Architecture](../../docs/architecture/ARCHITECTURE.md)
- [Everything App Roadmap](../../docs/gemini-architecture-review/roadmap.md)
- [API Gateway Design](../../docs/gemini-architecture-review/gateway_design.md)
- [Events Architecture](../../docs/gemini-architecture-review/events_architecture.md)

### 12.2 Database Documentation
- [Database Schema](../../infrastructure/postgres/init.sql) - Lines 91-144 (requests schema)
- [Polymorphic Migration](../../infrastructure/postgres/migrations/009_polymorphic_requests.sql) - v9.0

### 12.3 Testing Documentation
- [Local Testing Guide](../../docs/testing/LOCAL_TESTING.md)
- [V8 Testing Guide](../../docs/testing/V8_TESTING_GUIDE.md)
- [Integration Test Suite](../../tests/integration/request-service.test.ts)

### 12.4 Development Guides
- [Agent-Driven Development](../../docs/development/AGENT_DRIVEN_DEVELOPMENT.md)
- [Service Context Template](../../docs/development/SERVICE_CONTEXT_TEMPLATE.md)
- [CONTEXT.md Audit](../../docs/development/CONTEXT_AUDIT.md)

### 12.5 API Documentation
- API Gateway endpoints (TBD - v9.0)
- Swagger/OpenAPI spec (TBD - v9.0)

---

## Appendix A: Request Categories Reference

Complete category-to-skill mapping for skill-based matching:

```typescript
// src/services/matcher.ts
export const CATEGORY_SKILL_MAP = {
  transportation: ['driving'],
  moving: ['moving', 'handyman'],
  childcare: ['childcare'],
  pet_care: ['pet_care'],
  tech_support: ['tech_support', 'coding'],
  home_repair: ['home_repair', 'handyman', 'electrical', 'plumbing', 'carpentry'],
  gardening: ['gardening'],
  cooking: ['cooking', 'baking'],
  tutoring: ['tutoring'],
  language: ['languages'],
  professional_advice: ['career_advice'],
  cleaning: ['cleaning', 'organizing']
};
```

## Appendix B: Development Tasks Reference

### Add New Request Category

1. Add to skill mapping in `src/routes/requests.ts`
2. Update CATEGORY_SKILL_MAP in Appendix A
3. Update documentation

### Add New Request Field

1. Create migration: `ALTER TABLE requests.help_requests ADD COLUMN ...`
2. Update POST endpoint to accept field
3. Update GET endpoints to return field
4. Update tests

### Change Urgency Levels

Update urgency priority calculation in skill matching query (see Section 5.2)

---

**End of Request Service Context Documentation**

*This document is the gold standard for service documentation. All other services should follow this structure.*

---

### Admin Schema API (Server-Driven UI - Phase 2)
**Last Updated:** 2026-02-17

**Purpose:** Enable non-technical admins to create and manage request type schemas without code deployments.

**API Endpoints:** All endpoints require admin role authentication (super_admin or admin).

#### Schema Management
- `GET /admin/schemas` - List all schemas (supports status, type, pagination filtering)
  - `GET /admin/schemas/:id` - Get specific schema by ID (includes version history)
  - `POST /admin/schemas` - Create new schema with type, sections, metadata
  - `PUT /admin/schemas/:id` - Update schema (increments version automatically)
  - `POST /admin/schemas/:id/publish` - Publish draft schema (validates structure: sections array, non-empty field keys/labels/types, valid summary field refs; returns 400 with `errors[]` array on failure)
  - `POST /admin/schemas/:id/archive` - Archive schema (hide from users)
  - `GET /admin/schemas/:id/versions` - Get version history for rollback
  - `POST /admin/schemas/:id/rollback/:version` - Rollback to specific version
  - `POST /admin/schemas/:id/variants` - Create A/B test variant
  - `POST /schemas/:type/validate` - Validate schema payload (for testing)

**Data Models:**
- Uses `requests.ui_schemas` table for schema storage
- Uses `requests.ui_schema_versions` for version history
- JSON Schema validation in `requests.validation_rules` for custom types

**Frontend Integration:**
- [`/admin/schemas`](apps/frontend/src/pages/admin/schemas/index.tsx) - Schema list with filtering
- [`/admin/schemas/new`](apps/frontend/src/pages/admin/schemas/new.tsx) - Schema creation with form builder
- [`/admin/schemas/[id]/edit`](apps/frontend/src/pages/admin/schemas/[id]/edit.tsx) - Full editor with tabs (Sections/Fields/Preview/Versions)
- [`/admin/schemas/[id]/versions`](apps/frontend/src/pages/admin/schemas/[id]/versions.tsx) - Version timeline with rollback
- Admin authentication middleware (super_admin/admin check)

**Usage Example:**
```typescript
// Create new schema
const newSchema = {
  type: 'dogwalking',
  label: 'Dog Walking Request',
  icon: '🐕',
  color: '#f59e0b',
  description: 'Help with walking your dog',
  sections: [
    {
      id: 'section-1',
      title: 'Dog Details',
      fields: [
        { id: 'field-1', type: 'text', label: 'Dog Breed', required: true },
        { id: 'field-2', type: 'number', label: 'Duration (hours)', required: true }
      ]
    }
  ]
}

await uiSchemaService.createSchema(newSchema)
```
