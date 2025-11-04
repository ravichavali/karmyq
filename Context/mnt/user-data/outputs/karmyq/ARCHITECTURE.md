# Karmyq Architecture Documentation

## Overview

Karmyq is built using a **loosely-coupled microservices architecture** specifically designed for community-driven development. This means:

- **Parallel Development**: Multiple contributors can work on different services without blocking each other
- **Clear Boundaries**: Each service owns its domain and communicates through well-defined APIs and events
- **Easy Onboarding**: New contributors can pick one service and understand it fully
- **Technology Agility**: Services could eventually use different tech stacks if needed

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (PWA)                           │
│                   React/Next.js @ :3001                        │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP/REST/WebSocket
             │
┌────────────▼────────────────────────────────────────────────────┐
│                   API Gateway (Nginx) @ :3000                  │
│         Routes & load balances to microservices               │
└────┬──────────┬──────────┬────────┬──────────┬──────────┬───────┘
     │          │          │        │          │          │
     ▼          ▼          ▼        ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Auth   │ │Community│ │Request │ │Reputation│ │Message │ │Notif  │
│Service │ │Service │ │Service │ │Service │ │Service │ │Service│
│ :4001  │ │ :4002  │ │ :4003  │ │ :4004  │ │ :4005  │ │ :4006  │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
                                                             ▲
                                                             │
                                               ┌─────────────┘
                                               │
                   ┌─────────────────┬─────────▼──────────┬──────────┐
                   ▼                 ▼                    ▼          ▼
              ┌────────────────┐ ┌────────────┐  ┌──────────────┐ ┌──────────┐
              │ PostgreSQL     │ │   Redis    │  │ Governance   │ │ Event    │
              │ Database       │ │  Caching & │  │   Service    │ │ Queue    │
              │                │ │ Bull Queue │  │    :4007     │ │(Redis)   │
              └────────────────┘ └────────────┘  └──────────────┘ └──────────┘
```

## Microservices

### 1. Auth Service (Port 4001)

**Purpose**: Handle user authentication, registration, and session management

**Key Responsibilities**:
- User registration and login
- Password hashing and JWT token generation
- Session management
- User profile management

**Publishes Events**:
- `user_created` - When a new user registers
- `user_updated` - When user profile changes

**Consumes Events**:
- None (pure provider service)

**Database**: `auth` schema
- `users` - User accounts
- `sessions` - Active sessions

**API Endpoints** (Example):
- `POST /register` - Create new account
- `POST /login` - Authenticate user
- `GET /profile/:userId` - Get user profile
- `PUT /profile/:userId` - Update profile

---

### 2. Community Service (Port 4002)

**Purpose**: Manage communities, membership, and community-level settings

**Key Responsibilities**:
- Create and manage communities
- Handle community membership (invitations, joins, removals)
- Manage community norms and rules
- Enforce Dunbar's number (max 150 members)

**Publishes Events**:
- `user_joined_community` - When user joins a community
- `community_created` - New community formed
- `community_norm_proposed` - Norm proposal created

**Consumes Events**:
- `user_created` - To initialize user community relationships

**Database**: `communities` schema
- `communities` - Community metadata
- `members` - Community membership records
- `norms` - Community guidelines
- `norm_approvals` - Consensus tracking

**API Endpoints** (Example):
- `POST /` - Create community (5+ members)
- `GET /:communityId` - Get community details
- `POST /:communityId/members` - Add member
- `POST /:communityId/norms` - Propose norm
- `GET /:communityId/members` - List members

**Community Trust Chain**:
```
User A creates community
    ↓
User A invites User B (trust chain: A→B)
    ↓
User B invites User C (trust chain: A→B→C)
    ↓
This creates a verifiable chain of trust
```

---

### 3. Request Service (Port 4003)

**Purpose**: Handle help requests and offers (the core of Karmyq)

**Key Responsibilities**:
- Create and manage help requests ("I need X")
- Create and manage help offers ("I can do X")
- Match requests to offers
- Track request lifecycle (open → matched → completed)

**Publishes Events**:
- `request_created` - New request posted
- `offer_created` - New offer posted
- `request_matched` - Request matched with responder
- `request_completed` - Request fulfilled

**Consumes Events**:
- `user_joined_community` - To initialize user's request/offer history
- `feedback_submitted` - To update request status

**Database**: `requests` schema
- `help_requests` - Help requests posted by users
- `help_offers` - Help offers posted by users
- `matches` - Request-responder pairings

**API Endpoints** (Example):
- `POST /requests` - Create help request
- `POST /offers` - Create help offer
- `GET /requests/:communityId` - List requests in community
- `POST /requests/:requestId/match` - Propose match
- `PUT /matches/:matchId` - Accept/reject match
- `PUT /requests/:requestId/complete` - Mark request completed

**Request Lifecycle**:
```
Request Posted (open)
    ↓
User Responds (proposal sent)
    ↓
Requester Accepts (matched)
    ↓
Interaction Happens
    ↓
Request Completed (with feedback)
    ↓
Karma Awarded & Trust Updated
```

---

### 4. Reputation Service (Port 4004)

**Purpose**: Calculate trust scores, karma points, and badges

**Key Responsibilities**:
- Award karma points for completed requests
- Calculate trust scores based on feedback
- Award badges for achievements
- Track user reputation in each community

**Publishes Events**:
- `karma_awarded` - Points given to user
- `trust_score_updated` - User's trust score changed
- `badge_earned` - User earned a badge

**Consumes Events**:
- `request_completed` - Award karma for completion
- `feedback_submitted` - Update trust score
- `user_joined_community` - Initialize community reputation

**Database**: `reputation` schema
- `karma_records` - Individual karma transactions
- `trust_scores` - Aggregate trust per user per community
- `badges` - User achievements

**API Endpoints** (Example):
- `GET /users/:userId/karma/:communityId` - Get karma in community
- `GET /users/:userId/trust-score/:communityId` - Get trust score
- `GET /users/:userId/badges` - List badges
- `POST /karma/award` - Award karma (internal use)

**Karma System**:
```
Request Completed: +10 points
Feedback Received: +2 points per rating star
Helper Accepted: +5 points
Norm Respected: +3 points (community-specific)
Badge Earned: +50 points
```

**Trust Score Calculation**:
```
Base: 50 points
+ (Requests completed × 2)
+ (Average feedback rating × 10)
+ (Days active / 30)
- (Conflicts reported × 15)
= Trust Score (0-100)
```

---

### 5. Messaging Service (Port 4005)

**Purpose**: Handle direct messaging between users

**Key Responsibilities**:
- Create conversations between users
- Store and retrieve messages
- Track message status (sent, delivered, read)
- Support real-time notifications

**Publishes Events**:
- `message_sent` - New message created
- `conversation_started` - New conversation initiated

**Consumes Events**:
- `request_matched` - Create conversation for matched request/responder

**Database**: `messaging` schema
- `conversations` - Message threads (usually per request-match)
- `conversation_participants` - Who's in each conversation
- `messages` - Individual messages

**API Endpoints** (Example):
- `GET /conversations/:userId` - List user's conversations
- `POST /conversations` - Start new conversation
- `GET /conversations/:conversationId/messages` - Get messages
- `POST /conversations/:conversationId/messages` - Send message
- `PUT /messages/:messageId/read` - Mark as read

**WebSocket Support** (for real-time messaging):
```
Connection: ws://localhost:3000/api/messages/ws/:userId
Events: message_received, message_read, user_typing
```

---

### 6. Notification Service (Port 4006)

**Purpose**: Send notifications via email and push

**Key Responsibilities**:
- Send transactional emails
- Send push notifications
- Manage notification preferences
- Track notification history

**Publishes Events**:
- `notification_sent` - Notification delivery confirmed

**Consumes Events**:
- `request_created` - Notify community members
- `request_matched` - Notify matched parties
- `message_sent` - Notify recipient
- `proposal_created` - Notify community for voting
- `feedback_requested` - Prompt for feedback

**Database**: `notifications` schema
- `notification_preferences` - User notification settings
- `notification_log` - Sent notification history

**API Endpoints** (Example):
- `GET /preferences/:userId` - Get notification preferences
- `PUT /preferences/:userId` - Update preferences
- `POST /send-email` - Send email (internal)
- `POST /send-push` - Send push (internal)

**Notification Types**:
- Transactional: Request matched, message received
- Digest: Weekly community summary
- Announcement: New community norms, governance votes
- Reminder: Incomplete requests, pending feedback

---

### 7. Governance Service (Port 4007)

**Purpose**: Community decision-making, conflict resolution, and norms management

**Key Responsibilities**:
- Manage community proposals (voting, policy, conflicts)
- Handle voting on community decisions
- Manage conflict cases and mediation
- Track decision history

**Publishes Events**:
- `proposal_created` - New proposal for vote
- `vote_submitted` - User voted
- `conflict_reported` - New conflict case opened
- `conflict_resolved` - Case closed with resolution

**Consumes Events**:
- `community_norm_proposed` - Initialize norm voting
- `feedback_submitted` - Trigger community review if low rating

**Database**: `governance` schema
- `proposals` - Community decisions being voted on
- `votes` - Individual votes on proposals
- `conflict_cases` - Dispute records
- `conflict_mediators` - Assigned mediators

**API Endpoints** (Example):
- `POST /proposals` - Create proposal
- `GET /proposals/:communityId` - List proposals
- `POST /proposals/:proposalId/vote` - Submit vote
- `POST /conflicts` - Report conflict
- `GET /conflicts/:caseId` - Get conflict details
- `PUT /conflicts/:caseId/resolve` - Resolve conflict

**Governance Workflow**:

**Community Norm Proposal**:
```
Community member proposes norm
    ↓
Voting period starts (default: 7 days)
    ↓
Members vote (yes/no/abstain)
    ↓
If majority yes: Norm becomes active
    ↓
Notification sent: "New community norm"
```

**Conflict Resolution**:
```
User A reports conflict with User B
    ↓
Conflict case created
    ↓
Mediators assigned (community volunteers)
    ↓
Mediation process (comments, evidence)
    ↓
Resolution or escalation
    ↓
Notification: Conflict resolved
```

---

## Event-Driven Communication

Services communicate asynchronously through a Redis-based event queue (Bull). This creates loose coupling while maintaining consistency.

### Event Flow Example: Request Completion

```
1. Request Service
   User marks request as completed
   → Publishes: request_completed event

2. Event Queue (Redis/Bull)
   Queues the event
   → Distributes to all subscribers

3. Reputation Service (listening)
   Receives: request_completed
   → Awards karma points to requester
   → Updates trust scores for both users
   → Publishes: karma_awarded event

4. Notification Service (listening)
   Receives: request_completed
   → Sends thank you email to responder
   → Sends follow-up request for feedback
   → Publishes: notification_sent event

5. Governance Service (listening)
   Receives: request_completed
   → Updates community metrics
   → Checks if user deserves badge
   → Triggers conflict review if low feedback
```

### Event Queue Setup

**Technology**: Redis with Bull library

```typescript
// Publishing an event
const eventQueue = new Queue('events', { redis });

await eventQueue.add('request_completed', {
  requestId: '123',
  requesterId: '456',
  responderId: '789',
  communityId: 'abc'
});

// Consuming events
eventQueue.process('request_completed', async (job) => {
  const { requesterId, responderId } = job.data;
  // Award karma
  // Update trust scores
});
```

**Benefits**:
- Services don't need to know about each other
- Events can be retried if processing fails
- Full audit trail of what happened
- Easy to debug with `redis-commander`
- Scales well for MVP/early growth

---

## Database Strategy

**Approach**: Single PostgreSQL database with separate schemas per service

```
karmyq (database)
├── auth (Auth Service)
├── communities (Community Service)
├── requests (Request Service)
├── reputation (Reputation Service)
├── messaging (Messaging Service)
├── notifications (Notification Service)
├── feedback (Feedback & Reviews)
├── governance (Governance Service)
└── events (Event Log)
```

**Why Single Database for MVP**:
- Simpler to manage and backup
- Easier for new contributors
- Can shard/split later as scale increases

**Schema Boundaries**:
- Services own their schemas
- Services don't access other schemas' tables directly
- Inter-service communication via REST APIs + Events only
- Enforced by database permissions

---

## API Gateway

**Technology**: Nginx

**Responsibilities**:
- Route requests to appropriate services
- Load balance
- Rate limiting
- CORS handling
- Health checks

**Routes**:
```
/api/auth/*          → Auth Service (:4001)
/api/communities/*   → Community Service (:4002)
/api/requests/*      → Request Service (:4003)
/api/reputation/*    → Reputation Service (:4004)
/api/messages/*      → Messaging Service (:4005)
/api/notifications/* → Notification Service (:4006)
/api/governance/*    → Governance Service (:4007)
```

**Features**:
- Rate limiting: 10 req/s general, 5 req/s for auth
- CORS headers for frontend access
- Security headers (XSS protection, content-type enforcement)
- WebSocket support for real-time messaging
- Health check endpoint: `/health`

---

## Frontend Architecture

**Technology**: React/Next.js Progressive Web App

**API Consumption**:
- All requests go through `/api/*` endpoints
- Gateway handles routing to services
- Shared types ensure type safety

**Features**:
- Offline capability with service workers
- Progressive loading
- Mobile-first responsive design
- Real-time messaging via WebSocket
- Push notifications

---

## Development Workflow for Contributors

### Picking a Service

```bash
cd services/[SERVICE_NAME]
cat README.md              # Understand what this service does
cat API.md                 # See what endpoints it provides
```

### Local Development

```bash
# Start all infrastructure
docker-compose up

# Development mode (hot reload)
cd services/[SERVICE_NAME]
npm run dev
```

### Making Changes

```bash
# 1. Make code changes
# 2. Service auto-reloads in Docker
# 3. Test via API Gateway: http://localhost:3000/api/[service]/*
# 4. Check shared types match: ../../shared/types/index.ts
# 5. Publish/subscribe to events as needed
```

### Testing Event Integration

```bash
# View event queue
http://localhost:8081 (redis-commander)

# Trigger event
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"title":"Help with X","category":"household"}'

# Watch:
# 1. notification-service logs for email
# 2. reputation-service logs for karma
# 3. redis-commander shows queue processing
```

---

## Scaling Beyond MVP

### When to Shard Database
- Single community per database
- One DB replica per region
- Event queue as sync mechanism

### When to Add New Services
- Authentication rules (add auth cache service)
- Payments (add billing service)
- Analytics (add analytics service)
- Search (add search service with Elasticsearch)

### When to Migrate to Different Tech
- Example: Notification service could become Python + Celery
- Governance could use specialized voting system
- Messaging could move to WebSocket-native service

---

## Deployment Strategy

### Development (Local)
```bash
docker-compose up
```

### Staging (Containerized VM)
```bash
docker-compose up -d
# All services in one box
```

### Production (Self-hosted)
```bash
# Each service on separate VM/container
# PostgreSQL on managed database or separate server
# Redis on separate cache server
# Nginx load balancer in front
```

### Production (Cloud)
```bash
# Kubernetes with:
# - Service per pod
# - PostgreSQL managed service
# - Redis managed cache
# - Load balancer
# - Auto-scaling based on metrics
```

---

## Key Design Principles

1. **Loose Coupling**: Services communicate via APIs and events, not direct dependencies
2. **Community First**: Simple enough for volunteers to understand and contribute to
3. **Transparency**: All decisions logged, all events auditable
4. **Gradual Complexity**: Start simple, add governance/conflicts later
5. **Trust-Based**: Presume good intent, minimal defensive design
6. **Open Source**: Use open source tools, avoid vendor lock-in

---

## Next Steps

1. Review individual service READMEs for detailed specs
2. Check API-CONTRACTS.md for exact API formats
3. Look at SERVICE-GUIDE.md for event publishing patterns
4. Start with one service (maybe community-service or request-service)
5. Join the community development effort!
