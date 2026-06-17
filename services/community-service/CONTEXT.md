# Community Service Context

> **Quick Start**: `cd services/community-service && npm run dev`
> **Port**: 3002 | **Health**: http://localhost:3002/health

## Purpose

Manages communities, membership, and community norms (rules). Enforces Dunbar's number (max 150 members) to maintain meaningful relationships and prevent scaling issues.

## Database Schema

### Tables Owned by This Service

```sql
-- communities.communities
CREATE TABLE communities.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    category VARCHAR(100),
    max_members INTEGER DEFAULT 150,           -- Dunbar's number
    current_members INTEGER DEFAULT 0,
    creator_id UUID NOT NULL REFERENCES auth.users(id),
    access_type VARCHAR(50) DEFAULT 'public',  -- public/private
    status VARCHAR(50) DEFAULT 'active',       -- active/archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Sprint 36: Geographic and interest-based discovery (Migration 014)
    latitude NUMERIC(10, 7),                   -- geographic coordinate
    longitude NUMERIC(10, 7),                  -- geographic coordinate
    tags TEXT[] DEFAULT '{}',                  -- interest tags for discovery

    -- Sprint 47: Group Communities (Migration 020)
    community_type VARCHAR(50) DEFAULT 'mutual_aid'  -- mutual_aid | group
);

-- communities.members
CREATE TABLE communities.members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',         -- admin/member
    status VARCHAR(50) DEFAULT 'active',       -- active/pending/inactive
    invited_by UUID REFERENCES auth.users(id),
    join_request_message TEXT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

-- communities.norms
CREATE TABLE communities.norms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    rationale TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'proposed',     -- proposed/active/archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- communities.norm_approvals
CREATE TABLE communities.norm_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    norm_id UUID NOT NULL REFERENCES communities.norms(id) ON DELETE CASCADE,
    approved_by UUID NOT NULL REFERENCES auth.users(id),
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(norm_id, approved_by)
);

-- Indexes
CREATE INDEX idx_communities_status ON communities.communities(status);
CREATE INDEX idx_communities_location ON communities.communities(location);
CREATE INDEX idx_communities_location_geo ON communities.communities(latitude, longitude);
CREATE INDEX idx_communities_tags ON communities.communities USING GIN(tags);
CREATE INDEX idx_members_user_id ON communities.members(user_id);
CREATE INDEX idx_members_community_id ON communities.members(community_id);
CREATE INDEX idx_norms_community_id ON communities.norms(community_id);
```

**Social Karma v2.0 Schema Extensions:**

```sql
-- communities.health_summary (NEW)
CREATE TABLE communities.health_summary (
    community_id UUID PRIMARY KEY REFERENCES communities.communities(id) ON DELETE CASCADE,

    -- Latest metrics (from reputation.community_health_metrics)
    total_exchanges INTEGER DEFAULT 0,
    active_members INTEGER DEFAULT 0,
    network_strength NUMERIC(5,2) DEFAULT 0,

    -- Trend indicators (7-day vs previous 7-day)
    trend_direction VARCHAR(20) DEFAULT 'stable',
    trend_percentage NUMERIC(5,2) DEFAULT 0,

    -- Last updated
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.health_summary IS 'Cached summary of community health for quick access';
COMMENT ON COLUMN communities.health_summary.network_strength IS 'Composite score: activity + quality + density';

-- communities.community_configs (NEW - Migration 011)
CREATE TABLE communities.community_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE UNIQUE,

    -- Identity & Boundaries
    member_cap INTEGER DEFAULT 150 CHECK (member_cap BETWEEN 10 AND 150),
    visibility_mode VARCHAR(50) DEFAULT 'public',  -- public/members_only/hybrid
    outsider_response_allowed BOOLEAN DEFAULT FALSE,

    -- Request Types (community-defined taxonomy as JSONB)
    enabled_request_types JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Karma Mechanics
    karma_split_helper INTEGER DEFAULT 60,
    karma_split_requestor INTEGER DEFAULT 40,
    base_karma_pool_per_request INTEGER DEFAULT 100,
    karma_decay_half_life_days INTEGER DEFAULT 0,  -- 0 = no decay

    -- Trust Mechanics
    trust_depth_weight DECIMAL(3,2) DEFAULT 0.60,
    trust_breadth_weight DECIMAL(3,2) DEFAULT 0.40,
    trust_decay_half_life_days INTEGER DEFAULT 90,
    trust_path_max_hops INTEGER DEFAULT 3,
    min_interactions_for_trust INTEGER DEFAULT 1,

    -- Feed Scoring Weights (7 signals, Sprint 43 v2 — normalized at query time)
    feed_weight_skill_match DECIMAL(3,2) DEFAULT 0.25,
    feed_weight_trust_distance DECIMAL(3,2) DEFAULT 0.20,
    feed_weight_community_relevance DECIMAL(3,2) DEFAULT 0.15,
    feed_weight_urgency DECIMAL(3,2) DEFAULT 0.10,
    feed_weight_requester_trust DECIMAL(3,2) DEFAULT 0.15,
    feed_weight_prior_interaction DECIMAL(3,2) DEFAULT 0.10,
    feed_weight_recency DECIMAL(3,2) DEFAULT 0.05,

    -- Community Onboarding
    request_approval_required BOOLEAN DEFAULT FALSE,
    new_member_karma_lockout_days INTEGER DEFAULT 0,
    join_approval_required BOOLEAN DEFAULT TRUE,
    joining_counts_as_interaction BOOLEAN DEFAULT TRUE,

    -- Metadata
    template_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- communities.config_templates (NEW - Migration 011)
CREATE TABLE communities.config_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    config_json JSONB NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE communities.community_configs IS 'Phase 1: Comprehensive configuration for community trust, karma, and coordination mechanics';
COMMENT ON TABLE communities.config_templates IS 'Pre-made configuration templates for evolutionary discovery';
```

-- communities.community_links (NEW - Migration 025, Sprint 15)
CREATE TABLE communities.community_links (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_a_id       UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  community_b_id       UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
  link_type            TEXT NOT NULL CHECK (link_type IN ('sister', 'parent_child', 'split_origin')),
  trust_carry_factor   NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  show_in_sister_feeds BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_admin_a   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_admin_b   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_a_id, community_b_id),
  CHECK (community_a_id <> community_b_id)
);

### communities.activities
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| community_id | UUID FK | → communities.communities(id) ON DELETE CASCADE |
| created_by | UUID FK | → auth.users(id) |
| title | VARCHAR(255) | Required |
| description | TEXT | Optional |
| activity_type | VARCHAR(100) | pickup_game \| group_run \| workout \| social \| other |
| scheduled_at | TIMESTAMPTZ | UTC, display in browser local time |
| duration_minutes | INTEGER | Optional |
| location | TEXT | Optional |
| latitude | NUMERIC(10,7) | Optional |
| longitude | NUMERIC(10,7) | Optional |
| max_participants | INTEGER | Optional cap |
| current_participants | INTEGER | Denormalized counter — increment/decrement in same op as participant insert/delete |
| status | VARCHAR(50) | open \| cancelled \| completed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### communities.activity_participants
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| activity_id | UUID FK | → communities.activities(id) ON DELETE CASCADE |
| user_id | UUID FK | → auth.users(id) ON DELETE CASCADE |
| joined_at | TIMESTAMP | |
| | UNIQUE(activity_id, user_id) | |

### communities.split_proposals (Sprint 69)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| community_id | UUID FK | → communities.communities(id) |
| proposed_by | UUID FK | → auth.users(id) |
| split_type | TEXT | size_threshold \| admin_initiated |
| rationale | TEXT | Optional |
| group_a_name | TEXT | Required |
| group_b_name | TEXT | Required |
| status | TEXT | discussion → voting → approved/rejected → executed |
| quorum_pct | INTEGER | Default 60 |
| approval_pct | INTEGER | Default 60 |
| voting_ends_at | TIMESTAMPTZ | Set when voting opens |
| executed_at | TIMESTAMPTZ | Set on execution |
| child_community_a_id | UUID FK | Set on execution |
| child_community_b_id | UUID FK | Set on execution |
| | UNIQUE(community_id, status) | One active proposal per community |

### communities.split_votes (Sprint 69)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| proposal_id | UUID FK | → communities.split_proposals(id) ON DELETE CASCADE |
| user_id | UUID FK | → auth.users(id) |
| vote | TEXT | yes \| no \| abstain |
| prestige_weight | NUMERIC(8,2) | Community-scoped trust score at vote time |
| voted_at | TIMESTAMPTZ | |
| | UNIQUE(proposal_id, user_id) | One vote per member per proposal |

### communities.split_member_assignments (Sprint 69)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| proposal_id | UUID FK | → communities.split_proposals(id) ON DELETE CASCADE |
| user_id | UUID FK | → auth.users(id) |
| assigned_to | TEXT | group_a \| group_b \| unassigned |
| cluster_suggestion | TEXT | Algorithm's initial guess: group_a \| group_b \| NULL |
| admin_overridden | BOOLEAN | TRUE if admin changed from cluster_suggestion |
| | UNIQUE(proposal_id, user_id) | One assignment per member per proposal |

### communities.fusion_proposals (Sprint 70)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| community_a_id | UUID FK | → communities.communities(id) — proposing community |
| community_b_id | UUID FK | → communities.communities(id) — target community |
| proposed_by | UUID FK | → auth.users(id) |
| merged_community_name | TEXT | Required |
| rationale | TEXT | Optional |
| status | TEXT | pending_acceptance → discussion → voting → approved/rejected → executed |
| quorum_pct | INTEGER | Default 60 |
| approval_pct | INTEGER | Default 60 |
| accepted_by | UUID FK | → auth.users(id) — admin B who accepted |
| voting_ends_at | TIMESTAMPTZ | Set when voting opens |
| executed_at | TIMESTAMPTZ | Set on execution |
| merged_community_id | UUID FK | → communities.communities(id) — set on execution |

### communities.fusion_votes (Sprint 70)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| proposal_id | UUID FK | → communities.fusion_proposals(id) ON DELETE CASCADE |
| community_id | UUID FK | → communities.communities(id) — which community this vote belongs to |
| user_id | UUID FK | → auth.users(id) |
| vote | TEXT | yes \| no \| abstain |
| prestige_weight | NUMERIC(8,2) | Community-scoped trust score at vote time |
| voted_at | TIMESTAMPTZ | |
| | UNIQUE(proposal_id, user_id) | One vote per member per proposal |

### Tables Read by This Service
- `auth.users` - User details for member profiles and creator names
- `social_graph.trust_edges_live` - Read-only view used for clustering algorithm and prestige weight computation

## API Endpoints

### GET /communities
Get all communities with optional filters.

**Query Parameters:**
- `status` - Filter by status (default: 'active')
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)
- `search` - Search in name and description
- `location` - Filter by location
- `category` - Filter by category
- `has_space` - Filter communities with available space ('true')
- `sort` - Sort order: 'activity' (default), 'newest', 'members', 'alphabetical'

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Seattle Mutual Aid",
      "description": "Helping neighbors in Seattle",
      "location": "Seattle, WA",
      "category": "General",
      "max_members": 150,
      "current_members": 42,
      "access_type": "public",
      "creator_id": "uuid",
      "creator_name": "Alice Smith",
      "status": "active",
      "created_at": "2025-01-10T12:00:00Z",
      "inner_circle_count": 3,
      "active_community_count": 12,
      "extended_network_count": 27
    }
  ],
  "count": 1,
  "total": 1
}
```

**Additional query modes (Sprint 36):**

- `mode=geography&lat=X&lng=Y` — sort communities by distance from the given coordinates. Each result includes a `distance_km` field. If no communities have coordinates, falls back to returning all communities and includes `"fallback": true` in the response data.
- `mode=interests&tags=tag1,tag2` — filter communities that have ALL of the specified tags (array overlap via `&&` operator).

**Implementation:** `src/routes/communities.ts:8`

### GET /communities/tags
Return all distinct tags in use across active communities (Sprint 36).

**Response:**
```json
{
  "success": true,
  "data": ["mutual-aid", "food", "housing", "seattle", "childcare"]
}
```

**Implementation:** `src/routes/communities.ts`

### PUT /communities/:id/tags
Update community interest tags (admin only, Sprint 36). Tags are normalized to lowercase and deduplicated.

**Auth:** Caller must be an active admin of the community.

**Request:**
```json
{
  "tags": ["mutual-aid", "Food", "Housing"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tags": ["food", "housing", "mutual-aid"]
  },
  "message": "Tags updated successfully"
}
```

**Implementation:** `src/routes/communities.ts`

### PUT /communities/:id/location
Update community geographic coordinates (admin only, Sprint 36). Enables geography-mode discovery and distance sorting.

**Auth:** Caller must be an active admin of the community.

**Request:**
```json
{
  "lat": 47.6062,
  "lng": -122.3321
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "latitude": 47.6062,
    "longitude": -122.3321
  },
  "message": "Location updated successfully"
}
```

**Implementation:** `src/routes/communities.ts`

### GET /communities/my/communities
Get communities the user is a member of.

**Query Parameters:**
- `user_id` - User UUID (required)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Seattle Mutual Aid",
      "role": "admin",
      "joined_at": "2025-01-10T12:00:00Z"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/communities.ts:94`

### GET /communities/:id
Get specific community with all members.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Seattle Mutual Aid",
    "description": "Helping neighbors",
    "members": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "user_name": "Alice Smith",
        "role": "admin",
        "joined_at": "2025-01-10T12:00:00Z"
      }
    ]
  }
}
```

**Implementation:** `src/routes/communities.ts:136`

### POST /communities
Create new community — **idempotent on community identity** (ADR-062).

A community's identity is `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,''))))`. Before inserting, the route looks up an **active** community by this identity key:
- **Match found (public):** the caller is joined (`communities.members` upsert, `current_members` bumped only if newly inserted) and the existing community is returned with `existing: true` and HTTP **200** — no duplicate row is created.
- **Match found (private):** not auto-joined; returns `existing: true, joined: false` and an approval-required message.
- **No match:** the community is created as before and returned with `existing: false` and HTTP **201**.

Clients should read the `existing` flag rather than assuming a new row was created. A partial unique index `idx_communities_identity_active` enforces one active community per identity.

**Request:**
```json
{
  "name": "Brooklyn Helpers",
  "description": "Mutual aid in Brooklyn",
  "location": "Brooklyn, NY",
  "category": "General",
  "max_members": 100
}
```

**Response (created):**
```json
{
  "success": true,
  "data": {
    "community": { "id": "uuid", "name": "Brooklyn Helpers", "current_members": 1, "role": "admin" },
    "existing": false,
    "config": { },
    "token": "<refreshed-jwt>"
  }
}
```

**Response (joined existing):**
```json
{
  "success": true,
  "data": {
    "community": { "id": "uuid", "name": "Brooklyn Helpers", "role": "member" },
    "existing": true,
    "joined": true,
    "token": "<refreshed-jwt>"
  }
}
```

**Implementation:** `src/routes/communities.ts` — `POST /` (identity lookup before insert)

**Events Published:** `community_created` (only on actual creation)

### PUT /communities/:id
Update community details (admin only).

**Request:**
```json
{
  "user_id": "uuid",
  "name": "Updated Name",
  "description": "Updated description",
  "max_members": 120
}
```

**Implementation:** `src/routes/communities.ts:258`

### DELETE /communities/:id
Archive community (admin only, soft delete).

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Implementation:** `src/routes/communities.ts:341`

**Events Published:** `community_archived`

### GET /communities/:communityId/members
Get all members of a community.

**Query Parameters:**
- `status` - Filter by member status (default: 'active')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "user_name": "Alice Smith",
      "role": "admin",
      "status": "active",
      "joined_at": "2025-01-10T12:00:00Z",
      "layer": "active_community"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/members.ts:8`

### POST /communities/:communityId/join
Join a community (public: immediate, private: pending approval).

**Request:**
```json
{
  "user_id": "uuid",
  "message": "I'd like to join this community!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active"
  },
  "message": "Joined community successfully"
}
```

**Implementation:** `src/routes/members.ts:43`

**Events Published:** `user_joined_community` (public) or `join_request_created` (private)

### POST /communities/:communityId/members
Add member to community (invite).

**Request:**
```json
{
  "user_id": "uuid",
  "invited_by": "uuid",
  "role": "member"
}
```

**Implementation:** `src/routes/members.ts:162`

**Events Published:** `user_joined_community`

### PUT /communities/:communityId/members/:userId
Update member role or status.

**Request:**
```json
{
  "admin_user_id": "uuid",
  "role": "admin",
  "status": "active"
}
```

**Implementation:** `src/routes/members.ts:260`

**Sprint 25 — Moderator support:** Moderators (`role='moderator'`) can update member `status` (e.g., approve or reject pending members) but cannot change member `role`. Admins retain full update capability (role + status). Non-admin/non-moderator callers receive `403`.

### DELETE /communities/:communityId/members/:userId
Remove member from community (self-leave or admin kick). **Auth required** (router mounts `authMiddleware`).

**Request:** no body. The caller's identity is taken from the verified JWT (`req.user.userId`),
**not** from the request body. Self-leave = JWT userId === `:userId`; removing another member
requires the JWT caller to be an active `admin`. (ADR-064 close-out, Sprint 93 — the previous
`admin_user_id` body field was spoofable and is now ignored; the last-admin guard is unchanged.)

**Implementation:** `src/routes/members.ts` (DELETE handler)

**Events Published:** `user_left_community`

### GET /communities/:communityId/norms
Get all norms for a community.

**Query Parameters:**
- `status` - Filter by norm status ('proposed', 'active', 'archived')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "description": "No spam or self-promotion",
      "rationale": "Keeps community focused on mutual aid",
      "status": "active",
      "created_by": "uuid",
      "creator_name": "Alice Smith",
      "approval_count": 23,
      "created_at": "2025-01-10T12:00:00Z"
    }
  ],
  "count": 1
}
```

**Implementation:** `src/routes/norms.ts:8`

### GET /communities/:communityId/norms/:normId
Get specific norm with all approvals.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "description": "No spam or self-promotion",
    "status": "active",
    "approvals": [
      {
        "id": "uuid",
        "approved_by": "uuid",
        "approver_name": "Bob Johnson",
        "approved_at": "2025-01-10T13:00:00Z"
      }
    ],
    "approval_count": 23
  }
}
```

**Implementation:** `src/routes/norms.ts:56`

### POST /communities/:communityId/norms
Propose a new community norm.

**Request:**
```json
{
  "description": "No spam or self-promotion",
  "rationale": "Keeps community focused on mutual aid",
  "created_by": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "proposed",
    "created_at": "2025-01-10T12:00:00Z"
  },
  "message": "Norm proposed successfully"
}
```

**Implementation:** `src/routes/norms.ts:111`

**Events Published:** `norm_proposed`

**Note:** Creator automatically approves the norm upon creation.

### POST /communities/:communityId/norms/:normId/approve
Approve a proposed norm (requires simple majority >50% of members).

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
  "message": "Norm approved and accepted by the community",
  "data": {
    "norm_id": "uuid",
    "status": "active",
    "approvals": 26,
    "required": 26,
    "total_members": 51
  }
}
```

**Implementation:** `src/routes/norms.ts:181`

**Events Published:** `norm_established` (when threshold reached)

### DELETE /communities/:communityId/norms/:normId
Archive a norm (admin or creator only).

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Implementation:** `src/routes/norms.ts:312`

### GET /communities/:id/config
Get community configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "community_id": "uuid",
    "config": {
      "member_cap": 150,
      "visibility_mode": "public",
      "outsider_response_allowed": true,
      "enabled_request_types": [
        {
          "name": "meal_share",
          "description": "Share meals or cooking",
          "karma_multiplier": 1.0
        }
      ],
      "karma_split_helper": 60,
      "karma_split_requestor": 40,
      "base_karma_pool_per_request": 100,
      "karma_decay_half_life_days": 0,
      "trust_depth_weight": 0.6,
      "trust_breadth_weight": 0.4,
      "trust_decay_half_life_days": 180,
      "trust_path_max_hops": 3,
      "min_interactions_for_trust": 1,
      "feed_weight_skill_match": 0.40,
      "feed_weight_trust_distance": 0.25,
      "feed_weight_community_relevance": 0.20,
      "feed_weight_urgency": 0.15,
      "request_approval_required": false,
      "new_member_karma_lockout_days": 0,
      "join_approval_required": true,
      "joining_counts_as_interaction": true,
      "template_source": "Cohousing Default",
      "created_at": "2025-01-10T12:00:00Z",
      "updated_at": "2025-01-10T12:00:00Z"
    },
    "template_source": "Cohousing Default"
  }
}
```

**Implementation:** `src/routes/config.ts:18`

**Frontend Integration:**
- `apps/frontend/src/pages/communities/[id].tsx` - Displays config in read-only mode (Configuration tab)
- `apps/frontend/src/pages/communities/[id]/admin.tsx` - Fetches config for editing (Configuration tab)

### PUT /communities/:id/config
Update community configuration (founder only for Phase 1).

**Request:**
```json
{
  "config_updates": {
    "karma_split_helper": 70,
    "karma_split_requestor": 30,
    "visibility_mode": "hybrid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "community_id": "uuid",
    "config": { ... }
  },
  "message": "Community configuration updated successfully"
}
```

**Implementation:** `src/routes/config.ts:82`

**Events Published:** `community.config.updated`

**Frontend Integration:**
- `apps/frontend/src/pages/communities/[id]/admin.tsx` - Founder-only config updates (Configuration tab)

### GET /communities/config-templates
Browse available configuration templates.

**Query Parameters:**
- `sort_by` - Sort order: 'usage', 'name', 'created_at' (default: 'usage')
- `public_only` - Filter to public templates only (default: 'true')

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "uuid",
        "name": "Cohousing Default",
        "description": "High-trust, balanced participation...",
        "usage_count": 42,
        "config_preview": {
          "karma_split": "60/40",
          "trust_model": "balanced",
          "visibility": "public",
          "member_cap": 150
        },
        "full_config": { ... },
        "created_at": "2025-01-10T12:00:00Z"
      }
    ]
  }
}
```

**Implementation:** `src/routes/config.ts:226`

**Frontend Integration:**
- `apps/frontend/src/pages/communities/config-templates.tsx` - Template browser page
- `apps/frontend/src/pages/communities/new.tsx` - Fetches templates for community creation

### POST /communities/:id/config/copy-from/:source_community_id
Copy configuration from another community.

**Request:**
```json
{
  "include_request_types": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "community_id": "uuid",
    "config": { ... },
    "copied_from": "source-uuid"
  },
  "message": "Configuration copied successfully"
}
```

**Implementation:** `src/routes/config.ts:274`

**Note:** Source community must be public or user must be a member.

**Frontend Integration:**
- `apps/frontend/src/pages/communities/configs/public.tsx` - Copy configuration modal (founders only)

### GET /communities/configs/public
Browse configurations from thriving communities.

**Query Parameters:**
- `min_members` - Minimum member count (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "communities": [
      {
        "community_id": "uuid",
        "name": "Seattle Mutual Aid",
        "member_count": 87,
        "config": { ... }
      }
    ]
  }
}
```

**Implementation:** `src/routes/config.ts:420`

**Note:** Only returns communities with public or hybrid visibility.

**Frontend Integration:**
- `apps/frontend/src/pages/communities/configs/public.tsx` - Thriving communities browser page

### GET /health
Service health check.

**Response:**
```json
{
  "service": "community-service",
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

### Community Links (Sprint 15)

#### POST /communities/:communityId/links
Propose a link from this community to another (admin-only). Creates a `pending` link awaiting approval by the other community's admin.

**Body:**
```json
{
  "target_community_id": "uuid",
  "link_type": "sister | parent_child | split_origin",
  "trust_carry_factor": 0.40,
  "show_in_sister_feeds": false
}
```

#### PUT /communities/:communityId/links/:linkId
Approve a pending link (other community's admin), or update `trust_carry_factor`/`show_in_sister_feeds`. Use `action: "approve"` or `action: "deactivate"` in the body.

#### GET /communities/:communityId/links
List all links involving this community. Optional `?status=pending|active|inactive` filter. Returns `partner_community_id` and `partner_community_name` for convenience.

#### DELETE /communities/:communityId/links/:linkId
Remove a link (sets status to `inactive`). Either community's admin can do this.

### Activities (Sprint 47)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /communities/:id/activities | member | List upcoming open activities with is_joined flag |
| POST | /communities/:id/activities | admin | Create activity (validates type enum, future date) |
| GET | /communities/:id/activities/:activityId | member | Get activity detail with participant list |
| POST | /communities/:id/activities/:activityId/join | member | Join activity (400 if full, 409 if already joined) |
| DELETE | /communities/:id/activities/:activityId/leave | member | Leave activity |

## Dependencies

### Calls (Outbound)
- None (community service does not call other services)

### Called By (Inbound)
- Frontend (for community browsing, creation, management)
- Request Service (to verify community membership)
- Feed Service (to get user's communities for feed personalization)

### Events Published
- `community_created` - When new community is created
- `community_archived` - When community is archived
- `community.config.created` - When community configuration is created
- `community.config.updated` - When community configuration is updated
- `user_joined_community` - When user joins a community
- `join_request_created` - When user requests to join private community
- `user_left_community` - When user leaves or is removed from community
- `norm_proposed` - When new norm is proposed
- `norm_established` - When norm reaches approval threshold

### Trust Questions (Sprint 45)

#### GET /communities/trust-questions
Returns active trust questionnaire questions with choices, ordered by `display_order`. Public endpoint — no auth required.

#### POST /communities/trust-questions
Create a trust question. Platform admin only.

#### PUT /communities/trust-questions/:id
Update question text, subtext, display_order, or active status. Platform admin only.

#### DELETE /communities/trust-questions/:id
Deactivate a trust question (sets active=false). Platform admin only.

#### POST /communities/trust-questions/:id/choices
Add a choice to a question. Platform admin only.

#### PUT /communities/trust-questions/:id/choices/:choiceId
Update a choice's label, description, config_delta, or display_order. Platform admin only.

#### DELETE /communities/trust-questions/:id/choices/:choiceId
Remove a choice permanently. Platform admin only.

---

### Events Consumed
- None

### External Dependencies
- PostgreSQL (communities schema)
- Redis (event publishing via Bull queue)

## Environment Variables

```bash
# Server
PORT=3002
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/karmyq_db

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info                   # debug, info, warn, error
```

## Key Files

### Entry Point
- `src/index.ts` - Express app initialization, route registration

### Routes
- `src/routes/communities.ts` - Community CRUD operations
- `src/routes/members.ts` - Membership management (join, leave, invite)
- `src/routes/norms.ts` - Community norms proposal and approval

### Services
- None (business logic is in routes for simplicity)

### Database
- `src/database/db.ts` - PostgreSQL connection pool

### Events
- `src/events/publisher.ts` - Redis event publishing

## Common Development Tasks

### Add a New Community Field

1. **Create migration:**
```sql
-- infrastructure/postgres/migrations/00X_add_community_field.sql
ALTER TABLE communities.communities
ADD COLUMN new_field VARCHAR(255);
```

2. **Update TypeScript types:**
```typescript
// src/types/community.ts
interface Community {
  // ... existing fields
  new_field?: string;
}
```

3. **Update create endpoint:**
```typescript
// src/routes/communities.ts - POST /communities
const { new_field } = req.body;

const result = await query(
  `INSERT INTO communities.communities
    (name, description, ..., new_field)
  VALUES ($1, $2, ..., $N)
  RETURNING *`,
  [name, description, ..., new_field]
);
```

4. **Update GET endpoints to include field:**
```typescript
// src/routes/communities.ts - GET /communities
SELECT
  c.id, c.name, ..., c.new_field
FROM communities.communities c
```

### Change Dunbar's Number Limit

**Option 1: Change default in database**
```sql
ALTER TABLE communities.communities
ALTER COLUMN max_members SET DEFAULT 100;  -- New default
```

**Option 2: Change validation in code**
```typescript
// src/routes/communities.ts - POST /communities
if (max_members < 1 || max_members > 100) {  // Changed from 150
  return res.status(400).json({
    success: false,
    message: 'Max members must be between 1 and 100',
  });
}
```

### Add New Member Role

1. **Update validation:**
```typescript
// src/routes/members.ts
const validRoles = ['admin', 'member', 'moderator'];  // Add new role

if (role && !validRoles.includes(role)) {
  return res.status(400).json({
    success: false,
    message: `Role must be one of: ${validRoles.join(', ')}`,
  });
}
```

2. **Update permission checks:**
```typescript
// Example: Allow moderators to update members
const canUpdate = ['admin', 'moderator'].includes(adminCheck.rows[0].role);
```

### Change Norm Approval Threshold

```typescript
// src/routes/norms.ts - POST /:communityId/norms/:normId/approve

// Current: Simple majority (>50%)
const approvalThreshold = Math.ceil(totalMembers / 2);

// Option 1: Two-thirds majority
const approvalThreshold = Math.ceil(totalMembers * 2 / 3);

// Option 2: Fixed threshold (e.g., 10 members)
const approvalThreshold = Math.min(10, Math.ceil(totalMembers / 2));

// Option 3: Percentage-based (e.g., 60%)
const approvalThreshold = Math.ceil(totalMembers * 0.6);
```

### Add Private Community Approval Workflow

1. **Get pending join requests:**
```typescript
// src/routes/members.ts
router.get('/:communityId/pending-requests', async (req, res) => {
  const { communityId } = req.params;

  const result = await query(
    `SELECT
      m.id, m.user_id, m.join_request_message, m.joined_at,
      u.name as user_name, u.email as user_email
    FROM communities.members m
    LEFT JOIN auth.users u ON m.user_id = u.id
    WHERE m.community_id = $1 AND m.status = 'pending'
    ORDER BY m.joined_at ASC`,
    [communityId]
  );

  res.json({
    success: true,
    data: result.rows,
    count: result.rowCount,
  });
});
```

2. **Approve join request:**
```typescript
// src/routes/members.ts
router.post('/:communityId/approve-request/:userId', async (req, res) => {
  const { communityId, userId } = req.params;
  const { admin_user_id } = req.body;

  // Verify admin permission
  const adminCheck = await query(
    `SELECT role FROM communities.members
     WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
    [communityId, admin_user_id]
  );

  if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can approve join requests',
    });
  }

  // Update member status
  await query(
    `UPDATE communities.members
     SET status = 'active'
     WHERE community_id = $1 AND user_id = $2 AND status = 'pending'`,
    [communityId, userId]
  );

  // Increment current_members
  await query(
    `UPDATE communities.communities
     SET current_members = current_members + 1
     WHERE id = $1`,
    [communityId]
  );

  // Publish event
  await publishEvent('join_request_approved', {
    community_id: communityId,
    user_id: userId,
    approved_by: admin_user_id,
  });

  res.json({
    success: true,
    message: 'Join request approved',
  });
});
```

### Add Community Categories

1. **Define categories:**
```typescript
// src/constants/categories.ts
export const COMMUNITY_CATEGORIES = [
  'General',
  'Housing',
  'Food',
  'Transportation',
  'Childcare',
  'Healthcare',
  'Education',
  'Technology',
  'Arts & Culture',
  'Environmental',
] as const;

export type CommunityCategory = typeof COMMUNITY_CATEGORIES[number];
```

2. **Add validation:**
```typescript
// src/routes/communities.ts - POST /communities
import { COMMUNITY_CATEGORIES } from '../constants/categories';

if (category && !COMMUNITY_CATEGORIES.includes(category)) {
  return res.status(400).json({
    success: false,
    message: `Category must be one of: ${COMMUNITY_CATEGORIES.join(', ')}`,
  });
}
```

## Security Considerations

### Dunbar's Number Enforcement
- Hard limit of 150 members prevents scaling issues
- Maintains social cohesion and trust
- Cannot be bypassed in code (database constraint)

```typescript
// src/routes/members.ts - Dunbar's number check
if (community.current_members >= community.max_members) {
  return res.status(400).json({
    success: false,
    message: 'Community is full (Dunbar\'s number limit reached)',
  });
}
```

### Admin Permissions
- Only admins can update community details
- Only admins can remove other members
- Prevent removing the last admin

```typescript
// src/routes/members.ts - Last admin protection
if (memberResult.rows[0].role === 'admin') {
  const adminCount = await query(
    `SELECT COUNT(*) as count FROM communities.members
     WHERE community_id = $1 AND role = 'admin' AND status = 'active'`,
    [communityId]
  );

  if (adminCount.rows[0].count <= 1) {
    return res.status(400).json({
      success: false,
      message: 'Cannot remove the last admin. Assign another admin first.',
    });
  }
}
```

### Member-Only Actions
- Only active community members can propose norms
- Only active members can approve norms
- Check membership before allowing actions

```typescript
// src/routes/norms.ts - Member verification
const memberCheck = await query(
  `SELECT id FROM communities.members
   WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
  [communityId, created_by]
);

if (memberCheck.rowCount === 0) {
  return res.status(403).json({
    success: false,
    message: 'Only community members can propose norms',
  });
}
```

### Input Validation
- Community name: 3-255 characters
- Max members: 1-150 (Dunbar's number)
- Sanitize all user inputs
- Validate UUIDs for foreign keys

## Debugging Common Issues

### "Community is full" errors
1. Check current_members vs max_members: `SELECT current_members, max_members FROM communities.communities WHERE id = '...'`
2. Verify count matches reality: `SELECT COUNT(*) FROM communities.members WHERE community_id = '...' AND status = 'active'`
3. If mismatch, sync the count:
```sql
UPDATE communities.communities c
SET current_members = (
  SELECT COUNT(*) FROM communities.members m
  WHERE m.community_id = c.id AND m.status = 'active'
)
WHERE c.id = '...';
```

### Norm not being accepted
1. Check approval count: `SELECT COUNT(*) FROM communities.norm_approvals WHERE norm_id = '...'`
2. Check member count: `SELECT COUNT(*) FROM communities.members WHERE community_id = '...' AND status = 'active'`
3. Verify threshold calculation (>50% = ceil(members / 2))
4. Check norm status: `SELECT status FROM communities.norms WHERE id = '...'`

### Member can't join community
1. Check community status: `SELECT status FROM communities.communities WHERE id = '...'`
2. Check if already member: `SELECT status FROM communities.members WHERE community_id = '...' AND user_id = '...'`
3. Check if community is full
4. Check access_type (public vs private)

### Permission denied errors
1. Verify user is member: `SELECT role, status FROM communities.members WHERE community_id = '...' AND user_id = '...'`
2. Check if user is admin: `... WHERE role = 'admin'`
3. Verify user_id matches admin_user_id in request body

### Database connection errors
1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running: `docker ps | grep postgres`
3. Test connection: `psql $DATABASE_URL`
4. Check communities schema exists: `\dn` in psql

## Testing

### Manual Testing with curl

**Create Community:**
```bash
curl -X POST http://localhost:3002/communities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Community",
    "description": "A test community",
    "location": "Seattle, WA",
    "category": "General",
    "max_members": 50,
    "creator_id": "uuid-here"
  }'
```

**List Communities:**
```bash
curl "http://localhost:3002/communities?status=active&limit=10"
```

**Join Community:**
```bash
curl -X POST http://localhost:3002/communities/COMMUNITY_UUID/join \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-here",
    "message": "I would like to join!"
  }'
```

**Propose Norm:**
```bash
curl -X POST http://localhost:3002/communities/COMMUNITY_UUID/norms \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Be respectful to all members",
    "rationale": "Creates a positive community environment",
    "created_by": "uuid-here"
  }'
```

**Approve Norm:**
```bash
curl -X POST http://localhost:3002/communities/COMMUNITY_UUID/norms/NORM_UUID/approve \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-here"
  }'
```

### Unit Tests

Run tests:
```bash
npm test
```

Test structure:
```
src/
├── __tests__/
│   ├── communities.test.ts    # Community CRUD tests
│   ├── members.test.ts        # Membership tests
│   └── norms.test.ts          # Norms and approval tests
```

## Performance Considerations

- Database queries use indexes on frequently queried columns
- Member count is denormalized (stored on community record) for fast access
- Approval count is calculated on-demand (could be cached if needed)
- Connection pooling for PostgreSQL (max 20 connections)
- JOIN queries limited to necessary data only

## Recent Changes

### Sprint 103 (2026-06-17) — Split child admins are child-local
- **FIXED (`executeSplit`)**: executing a split no longer promotes the executing parent admin into
  both child communities by default. Each child now receives exactly one admin selected from that
  child's assigned members: the executing admin if assigned there, otherwise an assigned parent admin,
  otherwise the strongest assigned member by within-child trust degree with deterministic
  `joined_at`/user-id tie-breaks. `split_origin` links and Sprint 86 trust/karma carry-forward remain
  unchanged. (`src/services/fissionService.ts`)

### Sprint 93 (2026-06-10) — Members DELETE derives caller from JWT (ADR-064 close-out)
- **FIXED (`DELETE /communities/:communityId/members/:userId`)**: the handler read `admin_user_id`
  from the request **body**, so an attacker could spoof an admin — or set it equal to the target
  `:userId` to fake a "self-remove" and bypass the admin check entirely, removing any member. The
  caller is now taken from the verified JWT (`req.user.userId`), mirroring the PUT handler; the body
  is ignored. Last-admin guard and the `user_left_community` event (`removed_by` = JWT caller) are
  unchanged. All clients dropped the `admin_user_id` argument (`apps/frontend/src/lib/api.ts`, shared
  `packages/shared/api/client.ts`, `ActiveTab.tsx`). Test:
  `tests/tdd/sprint-93-members-delete-jwt.test.ts`. (`src/routes/members.ts`)

### Sprint 86 follow-up (2026-06-05) — Split carries trust + karma forward
- **FIXED (`executeSplit`)**: a split moved members to child communities but left their trust edges
  (`social_graph.trust_edges`) and karma (`reputation.karma_records`) under the parent `community_id`,
  so each child started at 0 — connections "vanished" even though the split clusters on strong bonds.
  `executeSplit` now copies, per child: **within-group trust edges at full weight** (both endpoints in
  the same child; cross-group trust still flows via the `split_origin` link at 0.40) and the group's
  **karma records**. (`src/services/fissionService.ts`)
- **Data repair**: `infrastructure/postgres/migrations/20260605-split-carry-trust-karma-backfill.sql`
  backfills already-split communities — within-group parent edges → child (ON CONFLICT DO NOTHING),
  and group karma → child (guarded to children with no karma yet, so re-runs never duplicate the ledger).

### Sprint 86 follow-up (2026-06-05) — Fusion member-count fix
- **FIXED (`executeFusion`)**: the merged community was created with `current_members` left at the table default (0) and the count was **never recomputed** after migrating members — so a merged community rendered "0 members" in the header while the member list showed everyone (the same class of bug Sprint 78 fixed for `executeSplit`, but the fix had never been applied to the fusion path). `executeFusion` now upserts the executing admin as an active `admin` and recomputes `current_members` from actual active membership. (`src/services/fusionService.ts`)
- **Data repair**: `infrastructure/postgres/migrations/20260605-fusion-member-count-backfill.sql` recomputes `current_members` from actual active rows for already-drifted communities (past fusions, pre-fix splits, or ordinary join/leave counter drift). Idempotent.

### Sprint 78 (2026-05-31) — Autonomous fission fixes (ADR-057)
- **FIXED (`executeSplit`)**: child communities were created with `current_members` left at the table default (0) and **no admin member** (only `creator_id` was set) — so they rendered empty and un-administrable. `executeSplit` now upserts the executing admin as an active `admin` in BOTH children and recomputes `current_members` from actual membership. (`src/services/fissionService.ts`)
- Enables autonomous fission: the simulation votes split proposals to `approved` (auto-approve at quorum in the vote route), then a sim admin executes them. Used to split the post-dedup over-cap communities (>150) back under Dunbar's number.

### Sprint 77 (2026-05-30) — Community Identity & Idempotent Creation (ADR-062)
- **MODIFIED**: `POST /communities` is now **idempotent on community identity** `(LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,''))))`. An active match is joined (returns `existing: true`, HTTP 200) instead of inserting a duplicate; a new identity creates as before (`existing: false`, HTTP 201). Private matches are not auto-joined. Extracted `buildRefreshedToken()` helper (shared by create + join paths) and `src/utils/identity.ts` (`identityKey`, `pickCanonical`).
- **NEW**: partial unique index `idx_communities_identity_active` on `communities.communities (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,'')))) WHERE status='active'` — enforces one active community per identity going forward; partial-on-active so archived/split/fused names stay re-creatable.
- **NEW**: one-time de-duplication migration `infrastructure/postgres/migrations/20260530-community-dedup.sql` — FK-discovery-driven re-parent-before-delete that collapsed the demo DB's 707 communities (~23 distinct identities) onto the oldest canonical survivor per identity. Inter-duplicate relationship rows (community_links, community_trust_edges, fusion/split proposals) are dropped rather than re-parented; `community_trust_edges` is recomputable.
- **FIXED (cap bug, sim)**: `create-community-workflow.ts` previously fetched `discoverCommunities({limit:11})` then checked `>= 15` — unreachable dead code. Replaced with a coherent `MAX_COMMUNITIES = 50` bound.
- **FIXED (sim hygiene)**: simulation actor pool now explicitly excludes `@karmyq.test` e2e/integration fixture accounts (`SIM_ACTOR_POOL_FILTER`).

### Sprint 70 (2026-05-28) — Fusion Mechanism
- **MODIFIED**: `GET /communities/:id` — now also returns `active_fusion_proposal` (id, status, community_a/b_id, merged_community_name) if a non-executed/rejected proposal exists
- **NEW**: `POST /communities/:id/fusions` — admin A creates fusion proposal targeting another community
- **NEW**: `POST /communities/:id/fusions/:fusionId/accept` — admin B accepts, moves to discussion
- **NEW**: `POST /communities/:id/fusions/:fusionId/reject` — admin B rejects proposal
- **NEW**: `GET /communities/:id/fusions/:fusionId` — proposal detail + both community tallies + my_vote + my_community
- **NEW**: `POST /communities/:id/fusions/:fusionId/start-vote` — either admin opens parallel vote
- **NEW**: `POST /communities/:id/fusions/:fusionId/vote` — member casts trust-weighted vote for their community
- **NEW**: `POST /communities/:id/fusions/:fusionId/execute` — either admin executes approved fusion (atomic: creates merged community, migrates members + trust×0.70 + karma, creates fusion_origin links, archives originals)
- **NEW**: `communities.fusion_proposals` table — bilateral proposal lifecycle (status: `pending_acceptance → discussion → voting → approved → executed | rejected`)
- **NEW**: `communities.fusion_votes` table — per-member, per-community votes with prestige weighting
- **NEW**: `community_links.link_type` CHECK extended to include `'fusion_origin'`
- **NEW**: `src/database/fusionsDb.ts` — DB query functions for fusion tables
- **NEW**: `src/services/fusionService.ts` — atomic execute transaction
- **NEW**: `src/routes/fusions.ts` — all 7 fusion route handlers (mounted at /communities)

### Sprint 69 (2026-05-27) — Fission Mechanism
- **MODIFIED**: `GET /communities/:id` — now returns `size_alert` ('approaching'|'recommend_split'|'urgent_split'|null) computed from `current_members`, and `active_split_proposal` (id, status, group names) if a non-executed/rejected proposal exists
- **NEW**: `POST /communities/:id/splits` — admin creates split proposal; runs trust-graph clustering; seeds `split_member_assignments`
- **NEW**: `GET /communities/:id/splits/:splitId` — get proposal detail + member assignments + prestige-weighted vote tally
- **NEW**: `PUT /communities/:id/splits/:splitId/assignments` — admin bulk-updates member assignments
- **NEW**: `POST /communities/:id/splits/:splitId/start-vote` — admin transitions proposal from `discussion` → `voting`
- **NEW**: `POST /communities/:id/splits/:splitId/vote` — member casts vote (prestige-weighted by community trust score)
- **NEW**: `POST /communities/:id/splits/:splitId/execute` — admin executes approved split (atomic transaction: creates 2 child communities, moves members, creates split_origin link, marks parent status='split')
- **NEW**: `communities.split_proposals` table — proposal lifecycle
- **NEW**: `communities.split_votes` table — per-member prestige-weighted votes
- **NEW**: `communities.split_member_assignments` table — per-member group assignment (cluster_suggestion vs assigned_to)
- **NEW**: `src/database/splitsDb.ts` — DB query functions for proposals, votes, assignments
- **NEW**: `src/services/fissionService.ts` — greedy bisection clustering algorithm + atomic execute transaction
- **NEW**: `src/routes/splits.ts` — all 6 split route handlers (mounted at /communities)

### Sprint 67 (2026-05-26) — Trust-Gated Governance
- **NEW**: `GET /communities/:id/governance` — returns governance state: settings, maturity (constrained/mature), eligible members, pending nominations, current role holders
- **NEW**: `POST /communities/:id/governance/nominate` — nominate eligible member for a role; validates trust score ≥ eligibility threshold; 409 on duplicate pending nomination
- **NEW**: `POST /communities/:id/governance/ratify/:nominationId` — ratify a nomination; auto-grants role at quorum in a single transaction
- **NEW**: `communities.governance_nominations` + `communities.governance_ratifications` tables (migration 009-governance-schema.sql)
- **NEW**: `communities.communities.governance_settings` JSONB column (eligibility_threshold, quorum_size, template)
- **NEW**: `src/database/governanceDb.ts` — all governance DB queries
- **NEW**: `src/routes/governance.ts` — governance route handlers

### Sprint 56 (2026-05-17) — Publisher centralization
- **CHANGED**: `src/events/publisher.ts` — delegates to `createPublisher('community-service')` from `@karmyq/shared`; local Bull setup removed
- **CHANGED**: `package.json` — added `@karmyq/shared` to dependencies (was missing, caused implicit resolution)

### Sprint 40 (2026-03-25) — Geo Mode Graceful Fallback
- `GET /communities?mode=geography` now falls back to returning all communities when the geo query returns 0 rows (no communities have coordinates); response includes `fallback: true`

### Sprint 36 (2026-03-23) — Geographic and Interest-Based Discovery
- Added `latitude`, `longitude`, and `tags` columns to `communities.communities` (migration 014)
- Added GIN index on `tags` and composite index on `(latitude, longitude)`
- New query modes on `GET /communities`: `mode=geography` (sort by distance) and `mode=interests` (filter by tags)
- New `GET /communities/tags` endpoint returns all distinct tags across active communities
- New `PUT /communities/:id/tags` endpoint for admins to set community interest tags
- New `PUT /communities/:id/location` endpoint for admins to set community coordinates

## Future Enhancements (TODO)

- [x] Community tags/keywords for better discovery (completed Sprint 36)
- [ ] Community avatars/images
- [ ] Member roles beyond admin/member (moderator, organizer, etc.)
- [ ] Community activity feed
- [ ] Email notifications for join requests (private communities)
- [ ] Community analytics dashboard
- [ ] Sub-communities or working groups
- [ ] Community-specific help request categories
- [ ] Norm voting with expiration (time-limited voting period)
- [ ] Federation support (cross-instance communities)

## Related Documentation

- Main architecture: `/docs/ARCHITECTURE.md`
- Database schema: `/infrastructure/postgres/init.sql` (lines 33-91)
- Federation communities: `/docs/FEDERATION_PROTOCOL.md` (section: Federated Communities)
