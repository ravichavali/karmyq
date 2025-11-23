# Services Directory

## Overview
All backend microservices. Each service is independent with its own Dockerfile, package.json, and entry point.

## Service Structure Pattern
```
service-name/
├── src/
│   ├── index.ts        # Express app entry
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   └── models/         # Data access (if needed)
├── Dockerfile
├── package.json
├── tsconfig.json
├── CONTEXT.md          # Service documentation
└── README.md
```

## Database Connections
All services connect to the same PostgreSQL instance but use schema-specific queries:
- Auth: `auth.users`, `auth.sessions`
- Community: `community.communities`, `community.memberships`, `community.norms`
- Request: `requests.help_requests`, `requests.offers`, `requests.matches`
- Reputation: `reputation.karma_records`, `reputation.trust_scores`
- Notification: `notifications.notifications`, `notifications.preferences`
- Messaging: `messaging.conversations`, `messaging.messages`

## Common Environment Variables
All services require:
- `PORT` - Service port
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - For token verification
- `REDIS_URL` - Redis connection (services using queues)

## Event Queue
Services emit/consume events via Bull queue `karmyq-events`:
- `match_completed` -> Reputation, Notification services
- `karma_awarded` -> Notification service
- `new_request` -> Feed, Notification services

## Creating New Services
1. Copy `_template/` directory
2. Update package.json name and port
3. Add to docker-compose.yml
4. Add database schema if needed
5. Create CONTEXT.md with API docs
