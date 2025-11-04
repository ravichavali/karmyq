# Karmyq: Rebuilding Trust Through Community

Welcome to Karmyq, a community-driven platform designed to rebuild societal trust through non-monetary mutual aid and local cooperation.

## What is Karmyq?

Karmyq is a Progressive Web App that enables communities to help each other through trust-based exchanges. Instead of relying on monetary transactions or centralized services, Karmyq connects neighbors, coworkers, and friends to exchange help based on community trust and reciprocity.

**Core Vision**:
- Trust is a muscle—communities that practice helping each other grow stronger
- Prestige, not currency, motivates generosity
- Small communities of ~150 people create natural accountability
- Technology should enable human connection, not replace it

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- Node.js 16+ (for local development)

### Run Locally

```bash
# Clone repository
git clone https://github.com/karmyq/karmyq.git
cd karmyq

# Start all services
docker-compose up

# Services are now running:
# Frontend:          http://localhost:3001
# API Gateway:       http://localhost:3000/api
# Redis Commander:   http://localhost:8081
# Postgres Admin:    (optional, connect with psql)
```

**All services running:**
- ✅ Frontend (React/Next.js PWA)
- ✅ Auth Service
- ✅ Community Service
- ✅ Request Service
- ✅ Reputation Service
- ✅ Messaging Service
- ✅ Notification Service
- ✅ Governance Service
- ✅ Redis (event queue)
- ✅ PostgreSQL (database)
- ✅ Nginx (API gateway)

### First Steps

1. **Explore the Architecture**
   ```bash
   cat ARCHITECTURE.md
   ```

2. **Pick a Service to Develop**
   ```bash
   ls services/
   cat services/[service-name]/README.md
   ```

3. **Join the Community**
   - GitHub: [karmyq/karmyq](https://github.com/karmyq/karmyq)
   - Discussions: GitHub Discussions
   - OpenCollective: [OpenCollective.com/karmyq](https://opencollective.com/karmyq)

## Project Structure

```
karmyq/
├── docker-compose.yml          # Infrastructure configuration
├── README.md                   # This file
├── ARCHITECTURE.md             # System design & microservices
├── SERVICE-GUIDE.md            # How to build services
├── CONTRIBUTING.md             # Contribution guidelines
├── LICENSE                     # Open source license
│
├── shared/
│   └── types/
│       └── index.ts           # Shared TypeScript types (API contracts)
│
├── services/
│   ├── auth-service/          # User authentication & sessions
│   ├── community-service/     # Communities & membership
│   ├── request-service/       # Help requests & offers
│   ├── reputation-service/    # Karma & trust scores
│   ├── messaging-service/     # Direct messaging
│   ├── notification-service/  # Email & push notifications
│   └── governance-service/    # Proposals, voting, conflict resolution
│
├── frontend/
│   └── src/
│       ├── pages/            # Next.js pages
│       ├── components/       # React components
│       └── lib/              # Utilities
│
└── infrastructure/
    ├── postgres/            # Database initialization
    └── nginx/              # API gateway configuration
```

## Architecture Overview

Karmyq uses a **loosely-coupled microservices architecture** designed for community development:

```
Frontend (React/Next.js)
        ↓
API Gateway (Nginx)
        ↓
[Auth] [Community] [Request] [Reputation] [Messaging] [Notification] [Governance]
        ↓
PostgreSQL Database (multi-schema)
        ↓
Redis Event Queue (Bull)
```

### Why Microservices?

✅ **Community-First**: Each service is independently understandable  
✅ **Parallel Development**: Multiple contributors work simultaneously  
✅ **Clear Boundaries**: Services own their domain  
✅ **Event-Driven**: Loose coupling through event queue  
✅ **Scalable**: Each service scales independently  

**For detailed architecture explanation**, see [ARCHITECTURE.md](./ARCHITECTURE.md)

## Core Services

### Authentication Service
Handles user registration, login, and session management.
- **Port**: 4001
- **Owns**: User accounts, sessions
- **Publishes**: `user_created`, `user_updated`

### Community Service
Manages communities, membership, and community governance.
- **Port**: 4002
- **Owns**: Communities, members, norms
- **Publishes**: `community_created`, `user_joined_community`

### Request Service
Core platform: help requests, offers, and matching.
- **Port**: 4003
- **Owns**: Help requests, offers, matches
- **Publishes**: `request_created`, `request_matched`, `request_completed`

### Reputation Service
Calculates trust scores, karma points, and badges.
- **Port**: 4004
- **Owns**: Karma records, trust scores, badges
- **Publishes**: `karma_awarded`, `trust_score_updated`

### Messaging Service
Direct user-to-user messaging for coordination.
- **Port**: 4005
- **Owns**: Messages, conversations
- **Publishes**: `message_sent`, `conversation_created`

### Notification Service
Sends emails and push notifications.
- **Port**: 4006
- **Owns**: Notification preferences, delivery logs
- **Consumes**: Events from all services

### Governance Service
Community voting, proposals, and conflict resolution.
- **Port**: 4007
- **Owns**: Proposals, votes, conflict cases
- **Publishes**: `proposal_created`, `vote_submitted`, `conflict_reported`

**For detailed service documentation**, see `services/[service-name]/README.md`

## Event-Driven Architecture

Services communicate asynchronously through a Redis event queue (Bull):

```typescript
// Service A publishes an event
await eventQueue.add('request_completed', {
  requestId: '123',
  responderId: 'user-456',
});

// Service B listens and reacts
eventQueue.process('request_completed', async (job) => {
  // Award karma, update trust scores, send notifications
});
```

This ensures:
- ✅ Loose coupling between services
- ✅ Reliable event delivery with retries
- ✅ Full audit trail of all activities
- ✅ Easy debugging with redis-commander

## Development Workflow

### 1. Choose a Service
```bash
cd services/community-service
cat README.md        # Understand the service
cat API.md          # See available endpoints
```

### 2. Start Development
```bash
docker-compose up   # Start all infrastructure
npm run dev         # Service auto-reloads in Docker
```

### 3. Make Changes
- Edit code in `services/[service]/src/`
- Service automatically reloads
- Test via API Gateway: `http://localhost:3000/api/[service]/*`

### 4. Publish Events (When Needed)
```typescript
await eventQueue.add('event_name', {
  // event data
});
```

### 5. Test Integration
- Check redis-commander for queued events: `http://localhost:8081`
- Verify other services react correctly
- Write tests in `src/__tests__/`

### 6. Submit Pull Request
```bash
git checkout -b feature/[service]/[description]
# Make changes, commit, push
# Create PR with description of changes
```

## API Documentation

### Authentication

All API requests (except `/auth/register` and `/auth/login`) require:
```
Authorization: Bearer [JWT_TOKEN]
```

### Base URL
```
http://localhost:3000/api
```

### Example Requests

**Create a community**:
```bash
curl -X POST http://localhost:3000/api/communities \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Oakland Mutual Aid",
    "description": "Help network for Oakland neighbors",
    "maxMembers": 150
  }'
```

**Create a help request**:
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "communityId": "community-123",
    "title": "Need help moving boxes",
    "description": "Moving to new apartment on Saturday",
    "category": "household",
    "urgency": "high"
  }'
```

**Get user karma**:
```bash
curl http://localhost:3000/api/reputation/users/user-123/karma/community-456 \
  -H "Authorization: Bearer TOKEN"
```

**For complete API documentation**, see [API-CONTRACTS.md](./API-CONTRACTS.md)

## Event Queue Monitoring

The Redis Commander GUI lets you monitor events in real-time:

```
http://localhost:8081
```

You can:
- ✅ View queued jobs
- ✅ Check failed jobs
- ✅ Replay failed events
- ✅ Monitor processing latency

## Database

Karmyq uses PostgreSQL with separate schemas per service:

```
karmyq (database)
├── auth (auth-service)
├── communities (community-service)
├── requests (request-service)
├── reputation (reputation-service)
├── messaging (messaging-service)
├── notifications (notification-service)
├── governance (governance-service)
└── events (event log)
```

Connect directly:
```bash
psql -h localhost -U karmyq -d karmyq
```

## Testing

### Unit Tests
```bash
cd services/[service-name]
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Manual API Testing
```bash
# Start services
docker-compose up

# Test endpoint
curl http://localhost:3000/api/communities \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Deployment

### Local Development
```bash
docker-compose up
```

### Self-Hosted VM
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud (Eventually)
- Kubernetes with containerized services
- Managed PostgreSQL
- Managed Redis
- Load balancer
- Auto-scaling

## Contributing

We welcome all contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code of conduct
- How to report issues
- Pull request process
- Style guide
- Licensing

## Roadmap

### Phase 1: Foundation (MVP)
- [x] Basic community formation
- [x] Help requests/offers
- [x] Simple matching
- [x] Basic trust scores
- [ ] Launch with 3-5 seed communities

### Phase 2: Refinement
- [ ] Governance & voting
- [ ] Conflict resolution
- [ ] Community norms enforcement
- [ ] More feedback categories

### Phase 3: Scale
- [ ] Cross-community interactions
- [ ] Multi-region deployment
- [ ] Mobile app (via PWA)
- [ ] Analytics & reporting

## Community

- **GitHub Discussions**: Ask questions, share ideas
- **OpenCollective**: Support the project financially
- **Social Media**: Follow for updates
- **Issues**: Report bugs, request features

## License

Karmyq is open source under the [AGPL-3.0 License](./LICENSE).

This ensures:
- ✅ Code remains free and open
- ✅ Derivative works remain open source
- ✅ Community benefits from improvements

## Tech Stack

**Frontend**: React, Next.js, TypeScript, Tailwind CSS  
**Backend**: Node.js, Express, TypeScript  
**Database**: PostgreSQL  
**Cache/Queue**: Redis with Bull  
**Gateway**: Nginx  
**Containerization**: Docker & Docker Compose  
**All open source & self-hostable**

## FAQ

**Q: Why microservices?**  
A: For community development—multiple people can work independently on different services.

**Q: Why not use a monolith?**  
A: Monoliths become harder to understand as they grow. Microservices let contributors own their domain.

**Q: How do services communicate?**  
A: REST APIs for synchronous calls, Redis event queue for async notifications.

**Q: Can I deploy just one service?**  
A: Services depend on auth-service, so you need at minimum: auth + your service + database + redis.

**Q: How do I add a new service?**  
A: See [SERVICE-GUIDE.md](./SERVICE-GUIDE.md) for the template and patterns.

## Getting Help

- 📖 Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- 🛠️ Read [SERVICE-GUIDE.md](./SERVICE-GUIDE.md) for development
- 💬 Ask in GitHub Discussions
- 🐛 File an issue for bugs
- 🚀 Submit PRs for improvements

---

**Let's rebuild trust together.** 🌱

Questions? Join the conversation in our GitHub Discussions!

[Visit GitHub](https://github.com/karmyq/karmyq) | [Support on OpenCollective](https://opencollective.com/karmyq) | [Read the Whitepaper](./docs/VISION.md)
