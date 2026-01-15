# Karmyq Data Flow Documentation

**Version**: 1.0.0
**Last Updated**: 2025-12-28

---

## Purpose

This document maps how data flows through the Karmyq system, from user input through the database and back to the UI. Use this to understand impact before making changes.

---

## Core Entities

### Help Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER CREATES REQUEST                      │
│                      (Frontend Dashboard)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Parse User Input                                        │
│ Location: apps/frontend/src/pages/dashboard.tsx                 │
│                                                                  │
│ Input:                                                           │
│   - description (string): "Need a ride to the airport tomorrow"│
│   - request_type (string): "transportation"                     │
│   - urgency (string): "high"                                    │
│                                                                  │
│ Processing:                                                      │
│   - AI parses description → structured data                     │
│   - Builds polymorphic payload based on type                    │
│                                                                  │
│ Output:                                                          │
│   {                                                              │
│     title: "Ride to Airport",                                   │
│     description: "Need a ride tomorrow",                        │
│     request_type: "transportation",                             │
│     urgency: "high",                                            │
│     payload: {                                                   │
│       pickup_location: { address, lat, lng },                   │
│       dropoff_location: { address, lat, lng },                  │
│       passengers: 1,                                            │
│       luggage: "medium"                                         │
│     }                                                            │
│   }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: API Call                                                │
│ Endpoint: POST /api/requests/create                             │
│ Service: Request Service (Port 3003)                            │
│ File: services/request-service/src/routes/requests.ts           │
│                                                                  │
│ Request Body:                                                    │
│   {                                                              │
│     title: string,                                              │
│     description: string,                                        │
│     request_type: string,                                       │
│     urgency: string,                                            │
│     payload?: object,        // Polymorphic JSONB               │
│     requirements?: object,   // Structured requirements         │
│     preferred_start_date?: string,                              │
│     preferred_end_date?: string                                 │
│   }                                                              │
│                                                                  │
│ Validation:                                                      │
│   - Checks authentication (JWT token)                           │
│   - Validates community membership                              │
│   - Validates required fields                                   │
│   - Sanitizes input                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Database Storage                                        │
│ Database: PostgreSQL                                            │
│ Schema: requests                                                │
│                                                                  │
│ Table: requests.help_requests                                   │
│   Columns:                                                       │
│     - id: UUID (PK)                                             │
│     - requester_id: UUID (FK → auth.users)                      │
│     - title: VARCHAR(255)                                       │
│     - description: TEXT                                         │
│     - category: VARCHAR(100)                                    │
│     - request_type: VARCHAR(100)                                │
│     - urgency: VARCHAR(50)                                      │
│     - payload: JSONB              ← Polymorphic data            │
│     - requirements: JSONB         ← Structured requirements     │
│     - preferred_start_date: TIMESTAMP                           │
│     - preferred_end_date: TIMESTAMP                             │
│     - status: VARCHAR(50)                                       │
│     - created_at: TIMESTAMP                                     │
│                                                                  │
│ Table: requests.request_communities (Many-to-Many)              │
│   - request_id: UUID (FK)                                       │
│   - community_id: UUID (FK)                                     │
│   - visibility: VARCHAR(50)                                     │
│                                                                  │
│ Example Payload Data:                                           │
│   Transportation:                                                │
│     {                                                            │
│       "pickup_location": {                                       │
│         "address": "123 Main St",                               │
│         "city": "Seattle",                                      │
│         "state": "WA",                                          │
│         "lat": 47.6062,                                         │
│         "lng": -122.3321                                        │
│       },                                                         │
│       "dropoff_location": { ... },                              │
│       "passengers": 2,                                          │
│       "luggage": "medium",                                      │
│       "return_trip": false                                      │
│     }                                                            │
│                                                                  │
│   Moving Help:                                                   │
│     {                                                            │
│       "current_address": {                                       │
│         "address": "456 Oak Ave",                               │
│         "floor": 3,                                             │
│         "has_elevator": false                                   │
│       },                                                         │
│       "new_address": { ... },                                   │
│       "distance_miles": 15,                                     │
│       "truck_needed": true,                                     │
│       "heavy_items": true,                                      │
│       "num_helpers_needed": 3                                   │
│     }                                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Feed Aggregation                                        │
│ Service: Feed Service (Port 3007)                               │
│ File: services/feed-service/src/routes/feed.ts                  │
│                                                                  │
│ Query:                                                           │
│   SELECT                                                         │
│     hr.id,                                                       │
│     hr.title,                                                   │
│     hr.description,                                             │
│     hr.urgency,                                                 │
│     hr.payload,           ← Includes polymorphic data           │
│     hr.requirements,      ← Includes structured requirements    │
│     hr.preferred_start_date,                                    │
│     hr.preferred_end_date,                                      │
│     u.name as author_name,                                      │
│     c.name as community_name                                    │
│   FROM requests.help_requests hr                                │
│   JOIN auth.users u ON hr.requester_id = u.id                  │
│   JOIN requests.request_communities rc ON hr.id = rc.request_id│
│   JOIN communities.communities c ON rc.community_id = c.id     │
│   WHERE hr.status = 'open'                                      │
│                                                                  │
│ Response Format:                                                 │
│   {                                                              │
│     items: [                                                     │
│       {                                                          │
│         type: "open_request",                                   │
│         priority: 85,                                           │
│         data: {                                                  │
│           request_id: "uuid",                                   │
│           title: "Ride to Airport",                             │
│           description: "Need a ride tomorrow",                  │
│           urgency: "high",                                      │
│           author_name: "John Doe",                              │
│           community_name: "Seattle Neighbors",                  │
│           payload: { ... },      ← Full polymorphic data        │
│           requirements: { ... }, ← Full requirements            │
│           preferred_start_date: "2025-01-15T10:00:00Z"         │
│         }                                                        │
│       }                                                          │
│     ]                                                            │
│   }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: UI Rendering                                            │
│ Component: apps/frontend/src/components/Feed/FeedItem.tsx       │
│ Function: OpenRequestItem()                                     │
│                                                                  │
│ Currently Displays:                                              │
│   ✅ Title (data.title)                                         │
│   ✅ Description (data.description)                             │
│   ✅ Urgency badge (data.urgency)                               │
│   ✅ Author name (data.author_name)                             │
│   ✅ Community name (data.community_name)                       │
│   ✅ Trust path badge (via useTrustPath hook)                   │
│                                                                  │
│ ❌ NOT Displayed (Data exists but not rendered):                │
│   ❌ Payload details (locations, times, counts)                 │
│   ❌ Requirements (background check, experience, etc.)          │
│   ❌ Preferred start/end dates                                  │
│                                                                  │
│ Rendering Logic:                                                 │
│   - Generic display for all request types                       │
│   - No type-specific rendering                                  │
│   - Polymorphic data ignored                                    │
│                                                                  │
│ To Add Polymorphic Rendering:                                   │
│   1. Check data.request_type                                    │
│   2. Render type-specific component:                            │
│      - TransportationDetails (pickup/dropoff, passengers)       │
│      - MovingHelpDetails (addresses, truck, helpers)            │
│      - ChildcareDetails (children, duration, requirements)      │
│      - etc.                                                      │
│   3. Add date/time display if preferred_start_date exists       │
│   4. Show requirements badges                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Community Membership Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER JOINS COMMUNITY                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Database Insert                                                  │
│ Table: communities.members                                       │
│   - community_id: UUID                                          │
│   - user_id: UUID                                               │
│   - role: VARCHAR (member/moderator/admin)                      │
│   - joined_at: TIMESTAMP                                        │
│                                                                  │
│ CRITICAL: Counter Update Required                               │
│   UPDATE communities.communities                                │
│   SET current_members = (                                       │
│     SELECT COUNT(*) FROM communities.members                    │
│     WHERE community_id = $1                                     │
│   )                                                              │
│   WHERE id = $1                                                 │
│                                                                  │
│ ⚠️  Common Bug: Forgetting this update causes:                  │
│   - UI shows 0/150 members                                      │
│   - Database has actual members                                 │
│   - Mismatch between current_members and member count           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ UI Display                                                       │
│ Component: CommunityList, CommunityDetail                        │
│                                                                  │
│ Displays: current_members / max_members                         │
│ Example: "25/150 members"                                       │
│                                                                  │
│ Data Source: communities.communities.current_members            │
│ Must Stay Synced: With COUNT(*) FROM communities.members        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Trust Path Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  USER VIEWS HELP REQUEST                         │
│                    (Feed Item Display)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Extract Target User                                     │
│ Component: OpenRequestItem                                       │
│ Code: const { trustPath } = useTrustPath(data.requester_id)    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: API Call                                                │
│ Endpoint: GET /api/trust-paths/:targetUserId                    │
│ Service: Social Graph Service (Port 3010)                       │
│ File: services/social-graph-service/src/routes/paths.ts         │
│                                                                  │
│ Authentication:                                                  │
│   - Extracts current user from JWT token                        │
│   - Uses as source_user_id for path calculation                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Path Calculation                                        │
│ Algorithm: Breadth-First Search (BFS)                           │
│                                                                  │
│ Data Source: auth.user_invitations                              │
│   - inviter_id: UUID (person who invited)                       │
│   - invitee_id: UUID (person who was invited)                   │
│   - community_id: UUID (context of invitation)                  │
│   - created_at: TIMESTAMP (when invitation happened)            │
│                                                                  │
│ Logic:                                                           │
│   1. Start from current user                                    │
│   2. Find all users they invited (1° connections)               │
│   3. For each 1°, find users they invited (2° connections)      │
│   4. Continue until target found or max depth (4°) reached      │
│   5. Build path: [current_user, inviter1, inviter2, target]     │
│                                                                  │
│ Response:                                                        │
│   {                                                              │
│     degrees_of_separation: 2,                                   │
│     path: [                                                      │
│       { id: "user1", name: "You" },                             │
│       { id: "user2", name: "Alice",  │
│         karma: 150, invited_at: "2024-06-15" },                 │
│       { id: "user3", name: "Bob", karma: 200 }                  │
│     ],                                                           │
│     trust_score: 75                                             │
│   }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: UI Rendering                                            │
│ Component: TrustPathBadge                                        │
│ File: apps/frontend/src/components/TrustPathBadge.tsx           │
│                                                                  │
│ Displays:                                                        │
│   ┌────────────────────────────────────────┐                   │
│   │ 🔗 2° Connection                       │                   │
│   │ You → Alice → Bob                      │                   │
│   │ ⭐⭐⭐⭐ 75                               │                   │
│   │ Connected Jun 15                        │                   │
│   └────────────────────────────────────────┘                   │
│                                                                  │
│ Color Coding:                                                    │
│   - 1° = Green (direct connection)                              │
│   - 2° = Blue (friend of friend)                                │
│   - 3° = Yellow (extended network)                              │
│   - 4° = Orange (distant connection)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Karma & Reputation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MATCH COMPLETED                               │
│              (User helped another user)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Update Match Status                                     │
│ Table: requests.matches                                          │
│   UPDATE SET                                                     │
│     status = 'completed',                                       │
│     completed_at = NOW()                                        │
│   WHERE id = $match_id                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Requester Leaves Feedback                               │
│ Table: feedback.feedback                                         │
│   Columns:                                                       │
│     - from_user_id: UUID (requester)                            │
│     - to_user_id: UUID (helper/responder)                       │
│     - request_match_id: UUID (FK)                               │
│     - community_id: UUID                                        │
│     - rating: INTEGER (3-5 stars)                               │
│     - comment: TEXT                                             │
│     - created_at: TIMESTAMP                                     │
│                                                                  │
│ Rating Scale:                                                    │
│   5 stars = Excellent (15 karma points)                         │
│   4 stars = Good (10 karma points)                              │
│   3 stars = Acceptable (5 karma points)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Award Karma                                             │
│ Table: reputation.karma_records                                  │
│                                                                  │
│ Two Karma Entries Created:                                       │
│                                                                  │
│ 1. Helper Karma (based on rating):                              │
│    INSERT INTO reputation.karma_records (                       │
│      user_id: helper_id,                                        │
│      community_id: community_id,                                │
│      points: 5-15 (based on rating),                            │
│      reason: 'Request completed - category',                    │
│      related_entity_id: match_id,                               │
│      created_at: NOW()                                          │
│    )                                                             │
│                                                                  │
│ 2. Requester Karma (small bonus):                               │
│    INSERT INTO reputation.karma_records (                       │
│      user_id: requester_id,                                     │
│      community_id: community_id,                                │
│      points: 3,                                                 │
│      reason: 'Posted request that was fulfilled',               │
│      related_entity_id: match_id,                               │
│      created_at: NOW()                                          │
│    )                                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Calculate Trust Score                                   │
│ Table: reputation.trust_scores                                   │
│                                                                  │
│ Calculation:                                                     │
│   base_score = 50 (everyone starts here)                        │
│                                                                  │
│   activity_score = MIN(25, completed_requests * 2)              │
│                                                                  │
│   feedback_bonus = IF (avg_rating >= 4.5) THEN 25               │
│                    ELSE IF (avg_rating >= 4.0) THEN 15          │
│                    ELSE IF (avg_rating >= 3.5) THEN 5           │
│                    ELSE 0                                        │
│                                                                  │
│   final_score = MIN(100, base + activity + feedback)            │
│                                                                  │
│ Example:                                                         │
│   User with 10 completed requests, 4.8 avg rating:              │
│   = 50 + 20 + 25 = 95                                           │
│                                                                  │
│ Stored:                                                          │
│   INSERT/UPDATE reputation.trust_scores (                       │
│     user_id, community_id, score,                               │
│     last_calculated_at: NOW()                                   │
│   )                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Generation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  REALISTIC DATA GENERATION                       │
│            (scripts/generate-realistic-data.ts)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Generate Users (6000)                                   │
│   - Uses @faker-js/faker for names, emails                      │
│   - Bcrypt password hashing (password123)                       │
│   - Geographic distribution (20 US cities)                      │
│   - 70% have inviters (social graph)                            │
│                                                                  │
│ CRITICAL: Store user objects for later reference                │
│   this.users = [{ id, name, email, city, invitedBy }]          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Generate Communities (600)                              │
│   - 60% city-based (e.g., "Seattle - Oak Lane")                │
│   - 40% interest-based (e.g., "Tech Professionals")            │
│   - Realistic descriptions (not lorem ipsum)                    │
│   - Assign creator from users                                   │
│                                                                  │
│ CRITICAL: Store community objects                               │
│   this.communities = [{ id, name, creatorId, city }]           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Assign Members to Communities                           │
│   - Each user joins 1-5 communities                             │
│   - Prefer communities in same city                             │
│   - Creator gets admin role, others get member role             │
│   - Historical join dates (within past year)                    │
│                                                                  │
│ ⚠️  CRITICAL: Update current_members counter                    │
│   After all members inserted:                                   │
│   UPDATE communities.communities c                              │
│   SET current_members = (                                       │
│     SELECT COUNT(*) FROM communities.members m                  │
│     WHERE m.community_id = c.id                                 │
│   )                                                              │
│                                                                  │
│ Common Bug: Forgetting this causes 0/150 display in UI          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Generate Invitations                                    │
│   - 70% of users have inviters                                  │
│   - Creates social graph for trust path calculation             │
│   - Links: auth.user_invitations                                │
│     inviter_id → invitee_id (with community context)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Generate Help Requests (18000)                          │
│   - Each user creates 0-5 requests                              │
│   - Distributed across 8 categories                             │
│   - Historical created_at (past year)                           │
│                                                                  │
│ ⚠️  CRITICAL: Polymorphic Payload Generation                    │
│   For each request type, generate structured JSONB:             │
│                                                                  │
│   Transportation:                                                │
│     payload = {                                                  │
│       pickup_location: { address, city, lat, lng },             │
│       dropoff_location: { address, city, lat, lng },            │
│       passengers: 1-4,                                          │
│       luggage: "none" | "small" | "medium" | "large",          │
│       return_trip: boolean                                      │
│     }                                                            │
│     preferred_start_date = random future date                   │
│     preferred_end_date = start + 2-5 hours                      │
│                                                                  │
│   Moving Help:                                                   │
│     payload = {                                                  │
│       current_address: { address, floor, has_elevator },        │
│       new_address: { ... },                                     │
│       distance_miles: 1-50,                                     │
│       truck_needed: boolean,                                    │
│       heavy_items: boolean,                                     │
│       num_helpers_needed: 1-5                                   │
│     }                                                            │
│                                                                  │
│   Requirements (all types):                                      │
│     requirements = {                                             │
│       background_check: boolean,                                │
│       experience_level: "none" | "some" | "extensive",         │
│       references_required: boolean,                             │
│       ... (type-specific)                                       │
│     }                                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Generate Offers and Matches                             │
│   - For each request, create 0-3 offers                         │
│   - 60% of requests with offers get matched                     │
│   - Match statuses: proposed, accepted, completed               │
│   - Completed matches have completed_at timestamp               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 7: Generate Feedback and Karma                             │
│   - For each COMPLETED match:                                   │
│     1. Create feedback (3-5 star rating)                        │
│     2. Award karma to helper (5-15 points based on rating)      │
│     3. Award karma to requester (3 points)                      │
│                                                                  │
│ ⚠️  CRITICAL: Use completed_at from match, not NOW()            │
│   - Ensures timestamps are historical                           │
│   - Must convert to ISO string for INSERT                       │
│     const completedAtISO = new Date(match.completed_at)         │
│                            .toISOString()                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 8: Calculate Trust Scores                                  │
│   - For each user in each community:                            │
│     1. Count completed requests                                 │
│     2. Calculate average rating from feedback                   │
│     3. Apply scoring formula                                    │
│     4. Insert into reputation.trust_scores                      │
│                                                                  │
│ Ensures realistic reputation distribution                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## TypeScript Type Flows

### Request Data Types

```typescript
// Database Schema (init.sql)
CREATE TABLE requests.help_requests (
  id UUID PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id),
  title VARCHAR(255),
  description TEXT,
  category VARCHAR(100),
  request_type VARCHAR(100),
  urgency VARCHAR(50),
  payload JSONB,                    -- Polymorphic structured data
  requirements JSONB,               -- Structured requirements
  preferred_start_date TIMESTAMP,
  preferred_end_date TIMESTAMP,
  status VARCHAR(50),
  created_at TIMESTAMP
);

// Backend Type (Request Service)
interface HelpRequest {
  id: string;
  requester_id: string;
  title: string;
  description: string;
  category: string;
  request_type: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  payload?: TransportationPayload | MovingPayload | ChildcarePayload | any;
  requirements?: RequestRequirements;
  preferred_start_date?: Date;
  preferred_end_date?: Date;
  status: 'open' | 'matched' | 'completed' | 'cancelled';
  created_at: Date;
}

// Polymorphic Payload Types
interface TransportationPayload {
  pickup_location: LocationData;
  dropoff_location: LocationData;
  passengers: number;
  luggage: 'none' | 'small' | 'medium' | 'large';
  return_trip: boolean;
}

interface MovingPayload {
  current_address: AddressData;
  new_address: AddressData;
  distance_miles: number;
  truck_needed: boolean;
  heavy_items: boolean;
  num_helpers_needed: number;
  estimated_duration_hours: number;
}

interface ChildcarePayload {
  children: Array<{
    age: number;
    special_needs: boolean;
  }>;
  duration_hours: number;
  location: LocationData;
  meal_prep_needed: boolean;
  homework_help_needed: boolean;
}

interface LocationData {
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

// Feed Service Response
interface FeedItem {
  type: 'open_request' | 'suggested_request' | 'community_activity';
  priority: number;
  created_at: string;
  data: {
    request_id: string;
    title: string;
    description: string;
    urgency: string;
    author_name: string;
    community_name: string;
    request_type: string;
    payload?: any;              // Should be typed based on request_type
    requirements?: any;
    preferred_start_date?: string;
    preferred_end_date?: string;
  };
}

// Frontend Component Props
interface OpenRequestItemProps {
  data: {
    request_id: string;
    title: string;
    description: string;
    urgency: string;
    author_name: string;
    community_name: string;
    requester_id: string;
    request_type?: string;      // Available but not used
    payload?: any;              // Available but not rendered
    requirements?: any;         // Available but not rendered
    preferred_start_date?: string;  // Available but not rendered
  };
  itemId: string;
  onDismiss?: (id: string) => void;
}
```

---

## Missing Implementations

### ❌ Polymorphic Request Display (High Priority)

**Location**: `apps/frontend/src/components/Feed/FeedItem.tsx`

**Issue**: Data exists in database and is returned by API, but UI doesn't render it.

**What's Available**:
- `data.payload` - Full polymorphic data
- `data.requirements` - Structured requirements
- `data.preferred_start_date` - Date/time information
- `data.request_type` - Type indicator

**What's Needed**:
1. Type-specific rendering components:
   - `<TransportationDetails payload={...} />`
   - `<MovingHelpDetails payload={...} />`
   - `<ChildcareDetails payload={...} />`
   - etc.

2. Date/time display:
   ```tsx
   {data.preferred_start_date && (
     <div className="flex items-center text-sm text-gray-600">
       <CalendarIcon />
       <span>Needed: {formatDate(data.preferred_start_date)}</span>
     </div>
   )}
   ```

3. Requirements badges:
   ```tsx
   {data.requirements && (
     <div className="flex gap-2">
       {data.requirements.background_check && (
         <Badge>Background Check Required</Badge>
       )}
       {data.requirements.experience_level && (
         <Badge>Experience: {data.requirements.experience_level}</Badge>
       )}
     </div>
   )}
   ```

**Impact**: Users can't see crucial information about requests. A transportation request shows "Need a ride" but not where from/to.

---

## Validation Queries

Use these to verify data integrity after changes:

### Community Membership Sync
```sql
-- Find communities with mismatched counts
SELECT
  c.name,
  c.current_members as stored_count,
  COUNT(m.user_id) as actual_count
FROM communities.communities c
LEFT JOIN communities.members m ON c.id = m.community_id
GROUP BY c.id, c.name, c.current_members
HAVING c.current_members != COUNT(m.user_id);

-- Fix mismatched counts
UPDATE communities.communities c
SET current_members = (
  SELECT COUNT(*) FROM communities.members m
  WHERE m.community_id = c.id
);
```

### Polymorphic Data Quality
```sql
-- Check requests have payload data
SELECT
  category,
  COUNT(*) as total,
  COUNT(payload) as with_payload,
  COUNT(payload) * 100.0 / COUNT(*) as payload_percentage
FROM requests.help_requests
GROUP BY category;

-- Sample polymorphic payloads
SELECT
  category,
  request_type,
  jsonb_pretty(payload) as payload_sample
FROM requests.help_requests
WHERE payload IS NOT NULL
LIMIT 5;
```

### Karma Integrity
```sql
-- Verify karma awarded for completed matches
SELECT
  COUNT(DISTINCT m.id) as completed_matches,
  COUNT(DISTINCT f.id) as feedback_entries,
  COUNT(DISTINCT kr.id) as karma_records
FROM requests.matches m
LEFT JOIN feedback.feedback f ON m.id = f.request_match_id
LEFT JOIN reputation.karma_records kr ON m.id = kr.related_entity_id::uuid
WHERE m.status = 'completed';

-- Should be: feedback_entries = completed_matches
--            karma_records = completed_matches * 2 (helper + requester)
```

---

## Change Impact Matrix

| Change Type | Database | Backend | Frontend | Tests | Docs |
|-------------|----------|---------|----------|-------|------|
| Add DB column | ✅ init.sql | ✅ Update queries | ⚠️ Check if displayed | ✅ Integration | ✅ DATA_FLOWS.md |
| Change API response | ❌ | ✅ Service code | ✅ Update types | ✅ Integration + E2E | ✅ Service CONTEXT.md |
| Add UI component | ❌ | ❌ | ✅ Component + page | ✅ E2E | ✅ If new flow |
| Modify data gen | ✅ Check schema | ❌ | ❌ | ⚠️ Manual verification | ✅ If new data type |
| Add polymorphic type | ✅ JSONB structure | ✅ Type definition | ✅ Renderer component | ✅ Integration | ✅ DATA_FLOWS.md |

---

## Quick Reference Commands

```bash
# Verify data quality after generation
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -c "
  SELECT 'users' as table_name, COUNT(*) as count FROM auth.users
  UNION ALL
  SELECT 'communities', COUNT(*) FROM communities.communities
  UNION ALL
  SELECT 'members', COUNT(*) FROM communities.members
  UNION ALL
  SELECT 'requests', COUNT(*) FROM requests.help_requests
  UNION ALL
  SELECT 'requests_with_payload', COUNT(*) FROM requests.help_requests WHERE payload IS NOT NULL
  UNION ALL
  SELECT 'matches', COUNT(*) FROM requests.matches
  UNION ALL
  SELECT 'feedback', COUNT(*) FROM feedback.feedback
  UNION ALL
  SELECT 'karma_records', COUNT(*) FROM reputation.karma_records;
"

# Check polymorphic data exists
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -c "
  SELECT category, request_type, preferred_start_date, preferred_end_date,
         jsonb_pretty(payload) as payload
  FROM requests.help_requests
  WHERE payload IS NOT NULL
  LIMIT 3;
"

# Verify community counts are synced
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -c "
  SELECT c.name, c.current_members, COUNT(m.user_id) as actual_members
  FROM communities.communities c
  LEFT JOIN communities.members m ON c.id = m.community_id
  GROUP BY c.id, c.name, c.current_members
  HAVING c.current_members != COUNT(m.user_id);
"
```

---

## Next Steps

1. **Implement polymorphic UI rendering** - Make use of existing payload data
2. **Add type-specific validators** - Ensure payload matches request_type schema
3. **Create migration scripts** - For schema changes in production
4. **Build data quality monitors** - Automated checks for integrity

---

**For AI Assistants**: Before changing ANY data flow, read this document to understand the full impact of your changes.
