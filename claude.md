# Karmyq - Mutual Aid Platform

## Project Overview
Karmyq is a multi-tenant SaaS mutual aid platform where community members help each other.

**Version**: 8.1.0 | **Status**: Demo/Development

---

## Development Disciplines (MUST FOLLOW)

### 1. Update, Don't Create
Before creating ANY new file:
- Search for existing file on same topic
- If exists: UPDATE it with date stamp
- Only create new file if truly novel topic

### 2. One Source of Truth
- Each concept has ONE authoritative document
- Service documentation lives in `services/{name}/CONTEXT.md`
- System docs in `docs/` (4 files + ADRs)

### 3. Test Before Commit
```bash
./scripts/test-local.sh   # Before commit
./scripts/test-all.sh     # Before push
```

### 4. Fix Forward, Not Around
- BAD: Create workaround (seed-v3.sh)
- GOOD: Fix the original script
- Document why in ADR if architectural

---

## Architecture

### Services (10 total)
| Service | Port | Status |
|---------|------|--------|
| Frontend | 3000 | Core |
| Auth | 3001 | Core |
| Community | 3002 | Core |
| Request | 3003 | Core |
| Reputation | 3004 | Core |
| Notification | 3005 | Core |
| Messaging | 3006 | Core |
| Feed | 3007 | Review |
| Cleanup | 3008 | Review |
| Geocoding | 3009 | Review |
| Social-Graph | 3010 | Core |

### Tech Stack
- **Backend**: Node.js/Express/TypeScript
- **Frontend**: Next.js 14
- **Mobile**: React Native + Expo
- **Database**: PostgreSQL 15 with RLS
- **Cache/Queue**: Redis + Bull
- **Build**: Turborepo

---

## Quick Reference

### Development Commands
```bash
# Start infrastructure only
cd infrastructure/docker && docker-compose up -d postgres redis

# Run tests
./scripts/test-local.sh

# Start dev
npm run dev
```

### Key Patterns

**Authentication**: JWT with `userId` and `communityMemberships[]`

**Database**: Tables use schema prefixes (`requests.help_requests`)

**API Response**:
```json
{"success": true, "data": {...}, "message": "..."}
```

---

## Documentation Structure

```
CLAUDE.md                    <- You are here
docs/
  README.md                  <- Doc index
  ARCHITECTURE.md            <- System architecture
  DATA_FLOWS.md              <- Data flow diagrams
  adr/                       <- Architecture decisions
  archive/                   <- Historical docs
services/{name}/
  CONTEXT.md                 <- Service documentation
```

---

## Important Files
- `infrastructure/docker/docker-compose.yml` - Service orchestration
- `infrastructure/postgres/init.sql` - Database schema
- `packages/shared/` - Shared utilities
- `tests/` - Integration and E2E tests
- `docs/adr/` - Architecture Decision Records

---

## Deployment (Production)

Production is ARM64 (Oracle Cloud). Single command deployment:

```bash
# SSH to production server, then:
cd ~/karmyq
./scripts/deploy.sh
```

That's it. The script automatically:
1. Pulls latest code from master
2. Loads `.env.production` environment variables
3. Builds all Docker images (ARM64 native)
4. Deploys via docker-compose
5. Verifies all services are running

### First-time Setup

```bash
# Copy and configure environment file
cp .env.production.example .env.production
# Edit .env.production with secure values for:
# - POSTGRES_PASSWORD
# - DATABASE_URL (use same password)
# - JWT_SECRET (generate with: openssl rand -base64 32)
```

### Useful Commands

```bash
# View logs
docker compose -f infrastructure/docker/docker-compose.yml \
               -f infrastructure/docker/docker-compose.prod.yml logs -f

# Restart a service
docker compose ... restart auth-service

# Stop everything
docker compose ... down
```

---

## Current Focus

See [docs/ARCHITECTURE_RESET_ANALYSIS.md](docs/ARCHITECTURE_RESET_ANALYSIS.md) for:
- Cleanup plan
- Service consolidation roadmap
- Process improvements
