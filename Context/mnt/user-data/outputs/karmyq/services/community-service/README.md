# Community Service

**Purpose**: Manage communities, membership, and community-level settings.

**Owner**: Community Service Team  
**Port**: 4002  
**Database Schema**: `communities`  

## Overview

The Community Service is responsible for:

✅ Creating and managing communities (groups of ~150 people)  
✅ Handling membership invitations and joins  
✅ Managing community norms (rules/guidelines)  
✅ Enforcing Dunbar's number (max 150 members)  
✅ Tracking community metadata  

## Key Concepts

### Communities

A community is a local group of ~150 people who practice mutual aid.

```
Community {
  id: UUID
  name: string              // "Oakland Neighbors"
  description: string       // Purpose of the community
  maxMembers: 150           // Dunbar's number
  currentMembers: int
  creatorId: UUID           // Who started it
  status: 'active' | 'paused' | 'archived'
  createdAt: timestamp
}
```

### Trust Chain

When users join communities, they're invited by an existing member, creating a chain of trust:

```
User A creates community
    ↓
User A invites User B
    ↓
Community links: A → B
    ↓
User B can invite User C
    ↓
Community links: A → B → C
```

This creates accountability through referral chains.

### Community Norms

Norms are guidelines established by the community through consensus:

```
Norm {
  description: "Requests must specify timeframe"
  rationale: "Helps people coordinate"
  createdBy: userID
  status: 'proposed' | 'approved' | 'archived'
  approvals: [userId1, userId2, ...] // Consensus tracking
}
```

## API Endpoints

### Communities

#### `GET /`

List all communities.

**Query Parameters**:
- `page` (int, default: 1) - Pagination page
- `pageSize` (int, default: 20) - Items per page

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "comm-123",
      "name": "Oakland Neighbors",
      "description": "Mutual aid for Oakland",
      "maxMembers": 150,
      "currentMembers": 42,
      "creatorId": "user-456",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### `GET /:communityId`

Get details for a specific community.

**Response** (200 OK):
```json
{
  "success": true,
  "data": { /* Community object */ }
}
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Community not found"
  }
}
```

#### `POST /`

Create a new community.

**Body**:
```json
{
  "name": "Oakland Neighbors",
  "description": "Mutual aid for Oakland area",
  "maxMembers": 150
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": { /* Created community */ }
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Name must be between 3 and 255 characters"
  }
}
```

**Publishes Event**:
- `community_created`

#### `PUT /:communityId`

Update community details.

**Body**:
```json
{
  "name": "Oakland Neighbors Updated",
  "description": "Updated description"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": { /* Updated community */ }
}
```

#### `DELETE /:communityId`

Archive a community (soft delete).

**Response** (200 OK):
```json
{
  "success": true,
  "data": { "archived": true }
}
```

---

### Members

#### `GET /:communityId/members`

List members in a community.

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "mem-123",
      "communityId": "comm-456",
      "userId": "user-789",
      "role": "member",
      "invitedBy": "user-abc",
      "status": "active",
      "joinedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### `POST /:communityId/members`

Add a member to community (invite).

**Body**:
```json
{
  "userId": "user-123",
  "role": "member"  // or "moderator", "admin"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "mem-456",
    "communityId": "comm-123",
    "userId": "user-456",
    "role": "member",
    "invitedBy": "user-789",
    "status": "active",
    "joinedAt": "2025-01-20T00:00:00Z"
  }
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "COMMUNITY_FULL",
    "message": "Community has reached max members (150)"
  }
}
```

**Publishes Event**:
- `user_joined_community`

#### `DELETE /:communityId/members/:userId`

Remove member from community.

**Response** (200 OK):
```json
{
  "success": true,
  "data": { "removed": true }
}
```

---

### Norms

#### `GET /:communityId/norms`

List norms for a community.

**Query Parameters**:
- `status` - Filter by: 'proposed', 'approved', 'archived'

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "norm-123",
      "communityId": "comm-456",
      "description": "Help requests must include timeframe",
      "rationale": "Allows people to coordinate schedules",
      "createdBy": "user-789",
      "status": "approved",
      "approvals": ["user-111", "user-222", "user-333"],
      "createdAt": "2025-01-10T00:00:00Z"
    }
  ]
}
```

#### `POST /:communityId/norms`

Propose a new norm.

**Body**:
```json
{
  "description": "Help requests must specify timeframe",
  "rationale": "Allows people to plan their schedules"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": { /* Proposed norm */ }
}
```

**Publishes Event**:
- `community_norm_proposed`

#### `POST /:communityId/norms/:normId/approve`

Approve a norm (community consensus).

**Body**:
```json
{
  "approved": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": { /* Updated norm with your approval */ }
}
```

---

## Events

### Published

**`community_created`**
```typescript
{
  communityId: string;
  name: string;
  creatorId: string;
  maxMembers: number;
}
```
Triggered when a new community is created. Other services can subscribe to initialize data.

**`user_joined_community`**
```typescript
{
  userId: string;
  communityId: string;
  invitedBy: string;
}
```
Triggered when a user joins a community. Signals reputation-service to initialize trust scores.

**`community_norm_proposed`**
```typescript
{
  normId: string;
  communityId: string;
  proposedBy: string;
  description: string;
}
```
Triggered when a norm is proposed. Signals governance-service to start voting.

### Consumed

**`user_created`** (from auth-service)

When a user is created, initialize their community relationships.

## Database Schema

Located in: `infrastructure/postgres/init.sql`

### `communities.communities`
```sql
CREATE TABLE communities.communities (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_members INTEGER DEFAULT 150,
    current_members INTEGER DEFAULT 0,
    creator_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `communities.members`
```sql
CREATE TABLE communities.members (
    id UUID PRIMARY KEY,
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role VARCHAR(50) DEFAULT 'member',
    invited_by UUID REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'active',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);
```

### `communities.norms`
```sql
CREATE TABLE communities.norms (
    id UUID PRIMARY KEY,
    community_id UUID NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT,
    created_by UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'proposed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Development

### Setup

```bash
cd services/community-service
cp .env.example .env
npm install
```

### Run

```bash
# Start all infrastructure
docker-compose up

# In another terminal
npm run dev
```

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Project Structure

```
src/
├── index.ts              # Entry point
├── routes/
│   ├── communities.ts    # GET/POST/PUT/DELETE /
│   ├── members.ts        # Member endpoints
│   ├── norms.ts          # Norm endpoints
│   └── index.ts          # Route aggregation
├── services/
│   ├── communityService.ts    # Business logic
│   ├── memberService.ts
│   ├── normService.ts
│   └── index.ts
├── handlers/
│   └── eventHandlers.ts  # Event subscriptions
├── models/
│   ├── community.ts      # Database queries
│   ├── member.ts
│   ├── norm.ts
│   └── index.ts
├── types.ts              # Local types
└── __tests__/
    ├── community.test.ts
    ├── member.test.ts
    ├── integration.test.ts
    └── fixtures.ts
```

## Common Tasks

### Add a New Field to Community

**1. Update types** (`shared/types/index.ts`):
```typescript
export interface Community {
  // ... existing fields
  location?: string; // NEW
}
```

**2. Database migration**:
```sql
ALTER TABLE communities.communities ADD COLUMN location VARCHAR(255);
```

**3. Update API endpoint**:
```typescript
app.post('/', async (req, res) => {
  const { name, description, location } = req.body; // Add location
  // ...
});
```

**4. Test**:
```bash
npm test
```

### Add Event Subscription

**1. In `handlers/eventHandlers.ts`**:
```typescript
eventQueue.process('some_event', async (job) => {
  console.log('Processing some_event', job.data);
  
  // React to event
  // Example: Update community metrics
  const { communityId } = job.data;
  await updateCommunityMetrics(pool, communityId);
});
```

**2. Test manually**:
```bash
# Trigger event from another service
# Check redis-commander for queue processing
http://localhost:8081
```

## Debugging

### View Service Logs
```bash
docker logs karmyq-community-service -f
```

### Database Queries
```bash
# Connect to postgres
psql -h localhost -U karmyq -d karmyq

# Query community data
SELECT * FROM communities.communities;
SELECT * FROM communities.members;
```

### Test Endpoints
```bash
# Get token first
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}'

# Use token for community endpoints
curl http://localhost:3000/api/communities \
  -H "Authorization: Bearer TOKEN"
```

## TODO / Future Improvements

- [ ] Implement permission system (who can add members)
- [ ] Add community settings (visibility, membership requirements)
- [ ] Implement norm voting workflow
- [ ] Add community statistics/metrics
- [ ] Create community activity feed
- [ ] Add community branding (logo, colors)

## Related Services

- **Auth Service**: Manages user accounts (required for membership)
- **Request Service**: Handles help requests within communities
- **Reputation Service**: Tracks trust within communities
- **Governance Service**: Handles community voting and norms

## Questions?

- 📖 [ARCHITECTURE.md](../../ARCHITECTURE.md) - System overview
- 🛠️ [SERVICE-GUIDE.md](../../SERVICE-GUIDE.md) - Development patterns
- 💬 GitHub Discussions
- 📧 Team email

---

**Contributing**? See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines!
