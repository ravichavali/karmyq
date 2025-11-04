# Karmyq Architecture Document

## Overview

Karmyq is built as a **loosely coupled microservices system** designed specifically for community-driven development. Each service is independent, testable, and ownable by different contributors while remaining coordinated through a central event bus.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React/Next.js)               │
│                    Progressive Web App (PWA)                │
│  - Community UI | Request/Offer UI | Messaging | Governance │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              NGINX API GATEWAY (Port 3000)                   │
│  Routes:                                                     │
│  /api/auth/* → auth-service:3001                            │
│  /api/communities/* → community-service:3002                │
│  /api/requests/* → request-service:3003                     │
│  /api/karma/* → reputation-service:3004                     │
│  /api/messages/* → messaging-service:3005                   │
│  /api/notifications/* → notification-service:3006           │
│  /api/governance/* → governance-service:3007                │
└────────────────────────────┬────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ Microservice │   │ Microservice │   │ Microservice │
  │   Services   │   │   Services   │   │   Services   │
  └──────────────┘   └──────────────┘   └──────────────┘
        │                    │                    │
        └────────────┬───────┴────────┬──────────┘
                     │                │
        ┌────────────▼────────────────▼───────────┐
        │   SHARED DATA & EVENT INFRASTRUCTURE    │
        │                                          │
        │  PostgreSQL        Redis         Bull   │
        │  (Persistent)      (Cache)      (Queue) │
        └──────────────────────────────────────────┘
```

## Core Principles

### 1. Loose Coupling

**Definition**: Services are independent. They don't call each other's code; they communicate through:
- **REST APIs**: Synchronous queries (e.g., "Get user by ID")
- **Event Queue**: Asynchronous reactions (e.g., "React to request_created")

**Example**: When a user creates a help request:
```
request-service stores in DB → publishes "request_created" event
         ↓ (asynchronously)
reputation-service listens → awards karma
notification-service listens → sends email
```

No hard dependencies. Each service can be developed, tested, and deployed independently.

### 2. Event-Driven Architecture

**Event Bus**: Redis + Bull (job queue)

**How it works**:
1. Service A performs an action
2. Service A publishes an event to Redis queue
3. Service B subscribes to that event type
4. When event arrives, Service B reacts
5. Service B may publish new events
6. Other services react, and so on

**Benefits for Community Development**:
- Contributors can work on different services without coordination
- Clear boundaries between what each service does
- Easy to test services in isolation
- Easy to understand side effects
- Auditable event history

### 3. API-First Design

**Contract First**: Each service has a clear API contract defined in `/shared/types/`

**REST Endpoints**: Synchronous queries
```
GET    /api/users/:id              → auth-service
GET    /api/communities/:id        → community-service
POST   /api/requests              → request-service
GET    /api/karma/user/:userId    → reputation-service
POST   /api/messages              → messaging-service
GET    /api/notifications         → notification-service
POST   /api/governance/proposals  → governance-service
```

**Event Streams**: Asynchronous reactions
```
user_created event
  ↓ (auth-service publishes)
  ├→ community-service (initializes user profile)
  ├→ reputation-service (creates karma record)
  ├→ notification-service (sends welcome email)
  └→ governance-service (updates member count)
```

## Service Responsibilities

### auth-service (Port 3001)
**Owns**: User authentication, sessions, account management

**Responsibilities**:
- User registration and login
- Password hashing and reset
- JWT token generation and validation
- Session management

**Publishes Events**:
- `user_created`
- `user_deleted`
- `password_reset`
- `login`

**Subscribes To**: (None - auth is foundational)

**Database Schema**: `auth.*`

---

### community-service (Port 3002)
**Owns**: Communities, memberships, community relationships

**Responsibilities**:
- Create communities (with Dunbar's 150 member limit)
- Manage memberships and roles
- Enforce referral chains (seed/trust-based membership)
- Community profiles and settings
- Community hierarchies

**Publishes Events**:
- `community_created`
- `user_joined_community`
- `user_left_community`
- `community_archived`
- `member_role_changed`

**Subscribes To**:
- `user_created` (initialize user's community profile)
- `karma_awarded` (update member status if needed)

**Database Schema**: `community.*`

---

### request-service (Port 3003)
**Owns**: Help requests and offers

**Responsibilities**:
- Create help requests (what people need)
- Create help offers (what people can provide)
- Track request lifecycle (open → matched → completed)
- Store request responses
- Basic matching algorithm (improved by reputation-service)

**Publishes Events**:
- `request_created`
- `request_matched`
- `request_completed`
- `request_cancelled`
- `offer_response_received`

**Subscribes To**:
- `user_joined_community` (only show requests from their communities)
- `trust_score_updated` (improve matching)
- `karma_awarded` (prioritize high-karma users in matching)

**Database Schema**: `requests.*`

---

### reputation-service (Port 3004)
**Owns**: Karma scoring, trust metrics, reputation

**Responsibilities**:
- Calculate karma scores (giving vs receiving)
- Track trust scores based on historical behavior
- Determine user status in communities
- Provide reputation data for matching
- Award karma for good behavior

**Publishes Events**:
- `karma_awarded`
- `trust_score_updated`
- `user_status_changed`

**Subscribes To**:
- `request_completed` (award karma to both parties)
- `user_joined_community` (initialize reputation in community)
- `proposal_closed` (award karma for participation)
- `community_moderation_action` (adjust karma for infractions)

**Database Schema**: `reputation.*`

---

### messaging-service (Port 3005)
**Owns**: In-app messaging between users

**Responsibilities**:
- Store messages and conversations
- Track read status
- Real-time messaging via WebSocket
- Message history retrieval
- Notification preferences for messages

**Publishes Events**:
- `message_sent`
- `conversation_started`
- `conversation_closed`

**Subscribes To**:
- `request_matched` (suggest messaging)
- `user_left_community` (clean up conversations)

**Database Schema**: `messaging.*`

**Tech**: WebSocket support for real-time messaging

---

### notification-service (Port 3006)
**Owns**: All notifications (email, push, in-app)

**Responsibilities**:
- Send emails via SMTP
- Send push notifications to PWA
- Store notification preferences per user
- Template management
- Notification history
- Digest compilation (weekly summaries)

**Publishes Events**:
- `email_sent`
- `push_sent`
- `notification_preference_updated`

**Subscribes To**:
- **EVERYTHING** - This service listens to all event types
- Decides what to notify based on user preferences
- Examples:
  - `request_created` → notify relevant community members
  - `request_matched` → notify both parties
  - `karma_awarded` → digest only (not immediate)
  - `proposal_created` → notify community members
  - `message_sent` → notify recipient

**Database Schema**: `notifications.*`

**External Services**: SMTP (using MailHog in dev)

---

### governance-service (Port 3007) [STUBS]
**Owns**: Community governance, voting, conflict resolution

**Responsibilities** (to be expanded):

1. **Proposal Management** [STUB]
   - Create proposals for community decisions
   - Types: norm changes, policy changes, member removal, general decisions
   - Proposal lifecycle: draft → active → closed → passed/failed

2. **Voting System** [STUB]
   - Simple majority, consensus, or supermajority voting
   - Vote tracking and tallying
   - Minimum participation thresholds
   - Vote reasoning/discussion

3. **Norm Setting** [STUB]
   - Document community norms
   - Track norm changes via proposals
   - Display norms to new members

4. **Conflict Resolution** [STUB]
   - Report conflicts
   - Mediation process
   - Escalation path
   - Resolution recording

**Publishes Events**:
- `proposal_created`
- `vote_cast`
- `proposal_closed`
- `proposal_passed`
- `norm_established`
- `conflict_reported`
- `conflict_resolved`

**Subscribes To**:
- `user_joined_community` (notify of community norms)
- `request_completed` (data for governance metrics)

**Database Schema**: `governance.*`

---

## Event Flow Examples

### Example 1: User Creates a Help Request

```
1. Frontend: POST /api/requests with request data
           ↓ (HTTP request)
2. request-service:
   - Validates input (using shared types)
   - Stores in requests.help_requests table
   - Publishes event: {
       type: "request_created",
       data: { requestId, communityId, requesterId, category, ... }
     }

3. Redis Bull Queue receives event

4. Subscribers react (asynchronously):

   reputation-service:
   - Listens for "request_created"
   - Awards 1 karma to requester (for participating)
   - Publishes: { type: "karma_awarded", data: {...} }

   notification-service:
   - Listens for "request_created"
   - Checks request category
   - Queries community members with matching skills
   - Checks notification preferences for each member
   - Sends email/push to interested members
   - Publishes: { type: "email_sent", data: {...} }

   governance-service:
   - Listens for "request_created"
   - Updates community request count
   - May trigger governance metrics

5. Frontend: Polls for updates or receives via WebSocket
   - Shows request in community feed
   - Highlights to users with matching skills
```

### Example 2: Help Request Gets Matched and Completed

```
Step 1: User responds to request
────────────────────────────────
1. Frontend: POST /api/requests/:requestId/respond
2. request-service:
   - Stores response
   - Publishes: { type: "offer_response_received", data: {...} }

Step 2: Reputation service matches
─────────────────────────────────
3. reputation-service:
   - Listens for "offer_response_received"
   - Calculates match score (karma, trust, skills, history)
   - If score > threshold, publishes: { type: "request_matched", data: {...} }

Step 3: Notification sent to both parties
──────────────────────────────────────────
4. notification-service:
   - Listens for "request_matched"
   - Sends email to requester and helper
   - Publishes: { type: "email_sent", ... }

Step 4: Request completed
─────────────────────────
5. Frontend: User marks request complete with rating
6. request-service:
   - Updates request status to completed
   - Stores ratings
   - Publishes: { type: "request_completed", data: { 
                    requestId, completedAt, requesterRating,
                    helperRating, ...
                  }}

Step 5: Reputation updated
──────────────────────────
7. reputation-service:
   - Listens for "request_completed"
   - Awards karma to both parties (5-10 points each)
   - Increases trust score based on rating
   - Publishes: { type: "karma_awarded", ... }
              { type: "trust_score_updated", ... }

Step 6: Governance updated
──────────────────────────
8. governance-service:
   - Listens for "request_completed"
   - Updates community metrics
   - May award special badges or statuses

Step 7: Notifications sent
──────────────────────────
9. notification-service:
   - Listens for "karma_awarded"
   - Sends digest notification (not immediate) about karma change
```

### Example 3: Community Proposes a New Norm

```
1. Frontend: POST /api/governance/proposals
2. governance-service:
   - Creates proposal
   - Status: "draft"
   - Publishes: { type: "proposal_created", data: {...} }

3. notification-service:
   - Listens for "proposal_created"
   - Sends notification to all community members
   - Publishes: { type: "email_sent", ... }

4. Frontend: Users vote on proposal
   - POST /api/governance/proposals/:proposalId/vote

5. governance-service:
   - Records vote
   - Publishes: { type: "vote_cast", data: {...} }

6. reputation-service:
   - Listens for "vote_cast"
   - Awards karma for participation
   - Publishes: { type: "karma_awarded", ... }

7. When voting period ends (automatic via Bull scheduled job):
   - governance-service:
     - Tallies votes
     - Determines if passed (simple majority, consensus, etc)
     - Updates proposal status
     - Publishes: { type: "proposal_closed", ... }
                 { type: "proposal_passed", ... }
     - If it's about a norm: { type: "norm_established", ... }

8. Other services react:
   - notification-service: Sends results to community
   - governance-service: Updates community norms document
   - reputation-service: May adjust karma based on participation
```

## Database Design

### Single PostgreSQL Instance with Multiple Schemas

```
karmyq_db
├── auth schema
│   ├── users
│   ├── sessions
│   └── password_resets
│
├── community schema
│   ├── communities
│   ├── community_members
│   ├── community_invitations
│   ├── community_roles
│   └── community_settings
│
├── requests schema
│   ├── help_requests
│   ├── request_responses
│   ├── request_completions
│   ├── request_ratings
│   └── help_offers
│
├── reputation schema
│   ├── karma_scores
│   ├── karma_transactions
│   ├── trust_scores
│   └── trust_factors
│
├── messaging schema
│   ├── conversations
│   ├── messages
│   └── message_read_status
│
├── notifications schema
│   ├── notification_preferences
│   ├── notifications
│   └── email_logs
│
└── governance schema
    ├── proposals
    ├── votes
    ├── community_norms
    ├── conflict_reports
    └── mediation_records
```

### Schema Access Rules

- Each service **owns** its schema
- Services can **read** from other schemas (immutable queries)
- Services **cannot write** to other schemas
- Cross-schema updates happen via events
- Data consistency maintained through event ordering

## Communication Patterns

### Pattern 1: Synchronous (API Call)

**When**: Need immediate response or data lookup
**Example**: Frontend needs to display user profile
```
Frontend → request-service: GET /api/users/:id
request-service → queries auth schema
request-service ← returns user data
Frontend ← displays user
```

**Pros**: Immediate, simple
**Cons**: Creates dependency

### Pattern 2: Asynchronous (Event)

**When**: Reactions that don't need to block
**Example**: Award karma when request is completed
```
request-service: publishes "request_completed"
     ↓
Redis queue
     ↓
reputation-service: listens, processes asynchronously
     ↓
(user gets karma in background)
```

**Pros**: Decoupled, scalable
**Cons**: Eventually consistent

### Pattern 3: Query Service Data

**When**: Need information from another service
**Example**: notification-service needs user's notification preferences
```
notification-service: GET /api/notifications/preferences/:userId
     ↓
notification-service reads notifications schema
     ↓
Returns preference data
```

**Pros**: Owns its data
**Cons**: Must maintain endpoint

## Deployment & Scaling

### Local Development
```bash
docker-compose up -d
# All services start in containers
# All connected via docker-network
# Accessible via nginx gateway on localhost:3000
```

### Self-Hosted Production
```
Same docker-compose setup but:
- Use environment variables for production secrets
- Use external PostgreSQL and Redis (not containers)
- Mount volumes for persistent data
- Use reverse proxy (nginx) for SSL/TLS
- Monitor services via logs/metrics
```

### Cloud Deployment
```
Same architecture, different infrastructure:
- PostgreSQL: AWS RDS / Google Cloud SQL
- Redis: AWS ElastiCache / Google Cloud Memorystore
- Services: Kubernetes / App Engine / Cloud Run
- Queue: Managed Bull or RabbitMQ
- Frontend: CDN (Cloudflare) + static hosting
```

The beauty: **Same code, different deployment**.

## For Contributors

### Adding a New Service

1. **Create service directory**: `services/new-service/`

2. **Copy template**:
```bash
cp -r services/request-service services/new-service
# Modify for your service
```

3. **Define API contract** in `/shared/types/`

4. **Implement REST endpoints** for synchronous queries

5. **Define events** your service publishes and subscribes to

6. **Update docker-compose.yml**:
```yaml
new-service:
  build:
    context: ./services/new-service
    dockerfile: Dockerfile
  ports:
    - "3008:3008"
  environment:
    DATABASE_URL: ...
    REDIS_URL: ...
  depends_on:
    - postgres
    - redis
```

7. **Update nginx api-gateway.conf**:
```nginx
location /api/newservice/ {
  proxy_pass http://new-service:3008/;
}
```

8. **Document in README.md**:
- What it does
- Events it publishes/subscribes
- API endpoints
- Database schema

### Testing Locally

```bash
# Run everything
docker-compose up -d

# Watch service logs
docker-compose logs -f reputation-service

# Test via API
curl http://localhost:3000/api/karma/user/123

# Check event queue
open http://localhost:8081  # redis-commander
```

## Performance & Reliability

### Scalability
- Services scale independently
- Horizontal scaling: run multiple instances of each service
- Load balance via nginx
- Redis handles concurrent connections
- PostgreSQL can be replicated

### Reliability
- Services fail independently (isolates impact)
- Event queue provides retry logic
- Healthchecks ensure services are available
- Database backups protect data
- Monitoring/logging track issues

### Consistency
- Eventual consistency via events
- Synchronous APIs for critical data
- Audit trail via event history
- Version control for schema changes

## Security Model

### Authentication
- All requests require JWT token (auth-service)
- Tokens include user ID and permissions
- Services verify tokens on protected endpoints

### Authorization
- Community members can only access their communities
- Admins have elevated permissions
- Roles: member, moderator, admin

### Privacy
- Services share only necessary data
- Events don't contain sensitive info (use IDs)
- Notifications don't leak information
- GDPR-compliant data handling

## Monitoring & Observability

### Logging
- Centralized logs for all services
- Structured logging with context
- Track request IDs across services

### Metrics
- Service health metrics
- Event queue depth
- Database performance
- API response times

### Debugging
- Redis Commander for queue inspection
- Database queries via admin panel
- Event history audit trail
- Service logs via docker-compose

---

## Summary

Karmyq's architecture is designed for:

✅ **Community Development**: Clear ownership, independent services
✅ **Scalability**: Loose coupling, independent scaling
✅ **Reliability**: Isolation of failures, event-based resilience
✅ **Clarity**: Clear service boundaries, event flow documentation
✅ **Maintainability**: Standardized structure, consistent patterns
✅ **Flexibility**: Easy to add services, extend functionality

The loosely coupled design means contributors can work on different services without deep knowledge of the entire system, while the event-driven architecture keeps everything coordinated and data-consistent.
