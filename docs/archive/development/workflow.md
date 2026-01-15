# Modular Development Workflow

## Overview

This guide explains how to work on Karmyq using a modular, context-efficient approach. Instead of loading the entire codebase into context, we focus on ONE microservice at a time.

## Why Modular Development?

- **Context Conservation**: Keep AI assistant context focused (~500-1000 lines vs. 5000+ lines)
- **Reduced Cognitive Load**: Work on one problem domain at a time
- **Faster Iteration**: Quicker builds, tests, and deployments per service
- **Better Focus**: Deep work on specific functionality without distractions

## The Modular Approach

### 1. Service-by-Service Development

Work on microservices in this recommended order:

1. **Auth Service** ✓ COMPLETE
   - User registration, login, JWT
   - Database schema: `auth.users`, `auth.sessions`
   - Event publishing ready

2. **Community Service** ← NEXT
   - Community creation, member management
   - Database schemas: `communities.communities`, `communities.members`, `communities.norms`
   - Depends on: Auth Service (user IDs)

3. **Request Service**
   - Help requests and offers
   - Request matching logic
   - Database schemas: `requests.help_requests`, `requests.help_offers`, `requests.matches`
   - Depends on: Auth Service, Community Service

4. **Reputation Service**
   - Karma tracking
   - Trust scores
   - Badge system
   - Database schemas: `reputation.karma_records`, `reputation.trust_scores`, `reputation.badges`
   - Depends on: Auth Service, Community Service, Request Service

5. **Messaging Service**
   - Direct messaging between matched users
   - Database schemas: `messaging.conversations`, `messaging.messages`
   - Depends on: Auth Service, Request Service

6. **Notification Service**
   - Email and push notifications
   - Database schemas: `notifications.notification_preferences`, `notifications.notification_log`
   - Depends on: Auth Service, Event System

7. **Governance Service**
   - Voting on proposals
   - Conflict resolution
   - Database schemas: `governance.proposals`, `governance.votes`, `governance.conflict_cases`
   - Depends on: Auth Service, Community Service

### 2. Context-Efficient File Selection

When working on a service, ONLY reference:

**Essential Context** (~500 lines total):
- Current service directory (e.g., `services/community-service/`)
- Shared types: `shared/types/index.ts`
- Database schema: Relevant section from `infrastructure/postgres/init.sql`
- Auth patterns: `services/auth-service/src/routes/auth.ts` (as reference)

**Don't Load**:
- Other services' implementations
- Frontend code (unless specifically working on it)
- All documentation files
- Full init.sql (only extract relevant schema)

### 3. Working on a Single Service

#### Step 1: Create Service Directory Structure

```bash
cd services
mkdir community-service
cd community-service
npm init -y
```

#### Step 2: Copy Reference Files

Only reference these patterns from Auth Service:
- Package.json structure
- tsconfig.json
- Dockerfile
- Express setup pattern
- Event publisher pattern

#### Step 3: Implement Core Features

Focus on:
1. Database connection (copy from auth-service)
2. Routes for the service's domain
3. Event publishing for cross-service communication
4. Input validation
5. Error handling

#### Step 4: Write Tests

Use the same testing pattern:
- `tests/unit/` - Route logic tests
- `tests/integration/` - Full request/response tests
- `tests/helpers/` - Mock utilities

#### Step 5: Update Docker Compose

Add the new service to `docker-compose.yml`:

```yaml
community-service:
  build:
    context: ./services/community-service
  ports:
    - "3002:3002"
  depends_on:
    - postgres
    - redis
```

## Practical Tips

### For AI Assistant Sessions

**Starting a session:**
```
"I want to work on the Community Service. Please:
1. Read services/community-service/src/
2. Read shared/types/index.ts
3. Reference the communities schema from init.sql (lines 32-81)
4. Use auth-service routes as a pattern reference"
```

**During development:**
- Focus on ONE feature at a time (e.g., "Create community endpoint")
- Test immediately after implementing
- Commit frequently with clear messages

### Git Workflow

```bash
# Feature branch per service
git checkout -b feature/community-service

# Commit after each endpoint
git add services/community-service/
git commit -m "feat(community): add create community endpoint"

# Merge when service is functional
git checkout master
git merge feature/community-service
```

### Testing Strategy

Test each service in isolation:

```bash
cd services/community-service
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:watch         # Watch mode
```

### Docker Development

Start only the services you need:

```bash
# Full stack
docker-compose up

# Only database and specific service
docker-compose up postgres redis community-service

# Rebuild one service
docker-compose up --build community-service
```

## Service Development Template

### Checklist for Each Service

- [ ] Create service directory structure
- [ ] Set up package.json with dependencies
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Implement database connection
- [ ] Create route handlers
- [ ] Add input validation
- [ ] Implement business logic
- [ ] Set up event publishing
- [ ] Write unit tests (80%+ coverage)
- [ ] Write integration tests
- [ ] Create Dockerfile
- [ ] Add to docker-compose.yml
- [ ] Update service documentation
- [ ] Test with full stack
- [ ] Commit and push

### Standard Dependencies

All services use:
- `express` - Web framework
- `pg` - PostgreSQL client
- `dotenv` - Environment variables
- `cors` - CORS middleware
- `bull` - Event queue
- `redis` - Redis client

Dev dependencies:
- `typescript` - Type safety
- `@types/node`, `@types/express` - Type definitions
- `ts-node`, `nodemon` - Development
- `jest`, `ts-jest`, `supertest` - Testing

## Context Window Management

### Recommended Context Size

- **Minimum**: ~300 lines (current service routes + types)
- **Optimal**: ~500-800 lines (routes + database + tests)
- **Maximum**: ~1500 lines (full service implementation)

### Files to Keep in Context

**Always:**
- `services/[current-service]/src/routes/*.ts`
- `services/[current-service]/src/index.ts`
- `shared/types/index.ts`

**As Needed:**
- `services/[current-service]/src/database/db.ts`
- `services/[current-service]/tests/`
- Relevant schema section from `init.sql`

**Reference Only (don't load fully):**
- Auth service patterns
- Event publisher implementation
- Docker configuration

## Next Steps

You are here: **Auth Service Complete**

Next: **Community Service Implementation**

Recommended approach:
1. Create `services/community-service/` directory
2. Implement community CRUD operations
3. Add member management endpoints
4. Implement norms creation and approval
5. Test thoroughly
6. Move to Request Service

## Resources

- **Current Status**: See `docs/PROJECT_STATUS.md`
- **Database Schema**: `infrastructure/postgres/init.sql`
- **Testing Guide**: `services/auth-service/TESTING.md`
- **Docker Setup**: `docs/DOCKER_SETUP.md`
- **Architecture**: `Context/ARCHITECTURE.md`

## Summary

**Key Principle**: One service, one focus, minimal context.

This approach allows you to build complex microservices architecture without overwhelming your development context. Each service is a self-contained sprint that builds on established patterns.
