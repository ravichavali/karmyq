Karmyq Project Structure
========================

```
karmyq/
├── docker-compose.yml                 # Main orchestration file
├── .env.example                       # Environment variables template
├── README.md                          # Project overview
├── GETTING_STARTED.md                 # Quick start guide
├── ARCHITECTURE.md                    # System architecture & event flow
├── SERVICE_GUIDE.md                   # How to create/contribute to services
├── CONTRIBUTING.md                    # Community contribution guidelines
│
├── shared/                            # Shared code & types (not a service)
│   ├── types/
│   │   ├── index.ts                  # Main types export
│   │   ├── user.ts                   # User-related types
│   │   ├── community.ts              # Community-related types
│   │   ├── request.ts                # Request/Offer types
│   │   ├── reputation.ts             # Karma/Reputation types
│   │   ├── governance.ts             # Governance types
│   │   ├── message.ts                # Messaging types
│   │   └── events.ts                 # Event payload types
│   │
│   ├── constants/
│   │   ├── enums.ts                  # Shared enumerations
│   │   ├── errors.ts                 # Standard error codes
│   │   └── config.ts                 # Shared configuration
│   │
│   ├── utils/
│   │   ├── logger.ts                 # Logging utility
│   │   ├── errors.ts                 # Error handling
│   │   └── validators.ts             # Input validation helpers
│   │
│   └── package.json                  # Shared utilities as npm package
│
├── services/
│   │
│   ├── auth-service/                 # User authentication & sessions
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # Auth endpoints
│   │   │   │   └── users.ts          # User profile endpoints
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── events/
│   │   │       └── publisher.ts      # Publishes user_created, password_reset, etc
│   │   ├── tests/
│   │   ├── README.md                 # Service documentation
│   │   └── package.json
│   │
│   ├── community-service/            # Community creation & management
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── communities.ts
│   │   │   │   └── memberships.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── events/
│   │   │       ├── publisher.ts      # Publishes community_created, user_joined, etc
│   │   │       └── subscribers.ts    # Listens to user_created event
│   │   ├── tests/
│   │   ├── README.md
│   │   └── package.json
│   │
│   ├── request-service/              # Help requests & offers
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── requests.ts
│   │   │   │   └── offers.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── events/
│   │   │       ├── publisher.ts      # Publishes request_created, request_matched, etc
│   │   │       └── subscribers.ts    # Listens to reputation events for matching
│   │   ├── tests/
│   │   ├── README.md
│   │   └── package.json
│   │
│   ├── reputation-service/           # Karma scoring & trust metrics
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── karma.ts
│   │   │   │   └── trust-scores.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── karma-calculator.ts
│   │   │   │   └── trust-aggregator.ts
│   │   │   ├── middleware/
│   │   │   └── events/
│   │   │       ├── publisher.ts      # Publishes karma_awarded, trust_updated, etc
│   │   │       └── subscribers.ts    # Listens to request_completed, user_joined, etc
│   │   ├── tests/
│   │   ├── README.md
│   │   └── package.json
│   │
│   ├── messaging-service/            # In-app messaging between users
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   └── messages.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── websocket/            # WebSocket for real-time messaging
│   │   │   ├── middleware/
│   │   │   └── events/
│   │   │       ├── publisher.ts      # Publishes message_sent, conversation_started
│   │   │       └── subscribers.ts
│   │   ├── tests/
│   │   ├── README.md
│   │   └── package.json
│   │
│   ├── notification-service/         # Emails, push notifications
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── preferences.ts
│   │   │   │   └── status.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── email-sender.ts
│   │   │   │   ├── push-notifier.ts
│   │   │   │   └── template-renderer.ts
│   │   │   ├── templates/             # Email templates
│   │   │   │   ├── welcome.html
│   │   │   │   ├── request-matched.html
│   │   │   │   └── weekly-digest.html
│   │   │   ├── middleware/
│   │   │   └── events/
│   │   │       └── subscribers.ts    # Listens to everything, decides what to notify
│   │   ├── tests/
│   │   ├── README.md
│   │   └── package.json
│   │
│   └── governance-service/           # Community governance & decision-making [STUB]
│       ├── Dockerfile
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── proposals.ts       # Community proposals/voting [STUB]
│       │   │   ├── conflicts.ts       # Conflict resolution [STUB]
│       │   │   └── norms.ts           # Community norms [STUB]
│       │   ├── controllers/
│       │   ├── services/
│       │   │   ├── proposal-engine.ts      # [STUB] How proposals are created/voted
│       │   │   ├── conflict-resolver.ts   # [STUB] How conflicts are resolved
│       │   │   └── norm-manager.ts        # [STUB] How community norms are set
│       │   ├── middleware/
│       │   └── events/
│       │       ├── publisher.ts      # Publishes proposal_created, vote_cast, etc
│       │       └── subscribers.ts    # Listens to proposal-related events
│       ├── tests/
│       ├── README.md
│       └── package.json
│
├── frontend/                          # React/Next.js PWA
│   ├── Dockerfile
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx             # Home page
│   │   │   ├── login.tsx
│   │   │   ├── communities/
│   │   │   ├── requests/
│   │   │   ├── profile/
│   │   │   └── governance/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── auth/
│   │   │   ├── community/
│   │   │   ├── requests/
│   │   │   └── common/
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useCommunity.ts
│   │   │   └── useNotifications.ts
│   │   ├── services/
│   │   │   └── api.ts                # API client
│   │   ├── store/                    # State management (Redux, Zustand, etc)
│   │   ├── types/                    # Links to shared types
│   │   └── styles/
│   ├── public/
│   ├── tests/
│   ├── package.json
│   ├── next.config.js
│   └── README.md
│
├── infrastructure/
│   ├── postgres/
│   │   ├── Dockerfile
│   │   ├── init.sql                  # Database initialization script
│   │   └── schemas/
│   │       ├── auth.sql
│   │       ├── community.sql
│   │       ├── requests.sql
│   │       ├── reputation.sql
│   │       ├── messaging.sql
│   │       ├── notifications.sql
│   │       └── governance.sql
│   │
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── api-gateway.conf          # Route configuration
│   │
│   └── redis/
│       └── redis.conf
│
└── docs/
    ├── ARCHITECTURE.md                # System design & event flow
    ├── SERVICE_GUIDE.md               # How to create new services
    ├── CONTRIBUTING.md                # Community guidelines
    ├── API_CONTRACTS.md               # Full API specification
    ├── EVENT_FLOW.md                  # Event-driven architecture details
    ├── DATABASE_SCHEMA.md             # Database design
    ├── DEPLOYMENT.md                  # Production deployment guide
    ├── TROUBLESHOOTING.md             # Common issues & solutions
    └── GLOSSARY.md                    # Karmyq-specific terminology
```

## Key Architectural Principles

### 1. Service Independence
- Each service owns its database tables
- Services communicate via REST APIs and events
- No direct database access between services
- Services can be deployed independently

### 2. Event-Driven Communication
- Redis + Bull for event queue
- Publishers send events (e.g., "user_created")
- Subscribers listen and react
- No hard dependencies between services

### 3. Shared but Not Shared
- `/shared` contains types and utilities
- Used by all services for consistency
- NOT a service itself
- Changes require careful coordination

### 4. Frontend Integration
- Next.js PWA consumes all backend APIs
- Unified API gateway at port 3000
- Real-time updates via messaging service
- Service worker for offline capabilities

### 5. Developer Experience
- One `docker-compose up` starts everything
- Each service has identical structure
- Clear README for each service
- Environment variables documented

## For New Contributors

A contributor choosing to work on "notification-service" would:

```bash
# 1. Clone the repo
git clone https://github.com/karmyq/karmyq.git
cd karmyq

# 2. Start everything locally
docker-compose up -d

# 3. Look at the service
cd services/notification-service
cat README.md

# 4. Understand what it does
- Listens to events from Redis queue
- Sends emails via SMTP
- Tracks notification preferences
- Publishes notification_sent events

# 5. Make changes
# Edit src/ files

# 6. Restart just that service
docker-compose restart notification-service

# 7. Test via API
curl http://localhost:3000/api/notifications/preferences

# 8. Submit PR
```

## Database Strategy

**Single PostgreSQL instance with multiple schemas:**
- `auth.*` - User credentials and auth tokens
- `community.*` - Communities and memberships
- `requests.*` - Help requests and offers
- `reputation.*` - Karma scores and trust metrics
- `messaging.*` - Messages and conversations
- `notifications.*` - Notification preferences and logs
- `governance.*` - Proposals, votes, conflicts, norms

Each service can write to its schema, read from others via APIs.

## Event Flow Example

When a user creates a help request:

1. **request-service** receives POST /requests
2. Stores in `requests.help_requests` table
3. Publishes "request_created" event to Redis queue
4. **reputation-service** subscribes, listens
5. Awards karma to requester (async)
6. Publishes "karma_awarded" event
7. **notification-service** subscribes
8. Checks user preferences, sends notification email
9. **frontend** polls for updates or uses WebSocket from messaging-service

All loosely coupled, all independent, all scalable.
