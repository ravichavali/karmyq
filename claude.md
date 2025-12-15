# Karmyq - Mutual Aid Platform

## Project Overview
Karmyq is a multi-tenant SaaS mutual aid platform where community members help each other. Version 6.0.0 with clean architecture, comprehensive documentation, and production-ready services.

## Architecture
- **Microservices**: 8 backend services communicating via REST and Redis queues
- **Multi-Tenant**: Row-Level Security (RLS) with community_id isolation
- **Event-Driven**: Bull/Redis queues for async processing (karmyq-events)

## Tech Stack
- **Backend**: Node.js/Express/TypeScript (all services)
- **Frontend**: Next.js 14 with Tailwind CSS
- **Mobile**: React Native + Expo
- **Database**: PostgreSQL 15 with schemas (auth, community, requests, reputation, notifications, messaging)
- **Cache/Queue**: Redis + Bull
- **Monorepo**: Turborepo

## Service Ports
| Service | Port | Schema |
|---------|------|--------|
| Frontend | 3000 | - |
| Auth | 3001 | auth |
| Community | 3002 | community |
| Request | 3003 | requests |
| Reputation | 3004 | reputation |
| Notification | 3005 | notifications |
| Messaging | 3006 | messaging |
| Feed | 3007 | - (reads all) |
| Cleanup | 3008 | - (writes all) |

## Key Patterns

### Authentication
- JWT tokens with `userId` and `communityMemberships` array
- Middleware chain: `authenticateToken` -> `extractCommunityContext` -> `requireRole`
- All requests require Bearer token in Authorization header

### Database Schema Conventions
- Tables use schema prefixes: `requests.help_requests`, `community.memberships`
- Foreign keys to users: `requester_id`, `responder_id` (not `user_id`, `helper_id`)
- All tables have `community_id` for RLS
- Timestamps: `created_at`, `updated_at`, `expires_at`

### API Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

## Development Commands
```bash
# Start all services
docker-compose up -d

# Frontend dev
cd apps/frontend && npm run dev

# Single service logs
docker logs karmyq-auth-service -f
```

## Testing Requirements

**IMPORTANT**: Run the complete test suite before committing changes to prevent regressions.

### Before Every Commit
```bash
# Windows
scripts\test-all.bat

# Mac/Linux
./scripts/test-all.sh
```

This runs:
1. **Integration tests** - API tests for all services (~1-2 minutes)
2. **Unit tests** - Jest tests for services that have them (~1 minute)
3. **E2E tests** - Playwright tests for UI and full workflows (~3-5 minutes)

**Total time**: ~5-10 minutes

### Quick Testing (During Development)
```bash
# Windows
scripts\test-local.bat quick

# Mac/Linux
./scripts/test-local.sh quick
```

**Time**: ~30 seconds (type-check + integration tests only)

### Test Documentation
- **[LOCAL_TESTING.md](docs/testing/LOCAL_TESTING.md)** - Complete local testing guide
- **[SOCIAL_KARMA_V2_TESTING.md](docs/testing/SOCIAL_KARMA_V2_TESTING.md)** - Test coverage reference

### Git Hooks (Optional)
Automatically run tests on commit/push:
```bash
./scripts/setup-git-hooks.sh
```

## Important Files
- `infrastructure/docker/docker-compose.yml` - Service orchestration
- `infrastructure/postgres/init.sql` - Database schema
- `packages/shared/` - Shared utilities, middleware, types
- `tests/` - Integration and E2E tests
- `docs/architecture/ARCHITECTURE.md` - Complete system architecture
- `docs/V6_ARCHITECTURAL_REVIEW.md` - v6.0 architectural review

## Service Documentation
Each service has complete context documentation:
- `services/{service-name}/CONTEXT.md` - Complete service documentation
- `services/{service-name}/README.md` - Quick reference
- Standardized format across all services

## Current Status (v6.0)
- **8 Production-Ready Services** - All services with complete documentation
- **Multi-Tenant SaaS** - Row-Level Security (RLS) with community isolation
- **Ephemeral Data** - Configurable TTL (60 days default)
- **Reputation Decay** - Time-based karma decay (6-month half-life)
- **Clean Architecture** - Consolidated documentation, service templates
- **Comprehensive Testing** - Integration, E2E, and load tests
- **Full Observability** - Grafana/Loki/Prometheus stack
