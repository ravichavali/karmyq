# Karmyq - Mutual Aid Platform

**Version**: 8.1.0 | **Status**: Demo/Development

---

## 🎯 Working in This Codebase? START HERE

### **Context Follows Directory Scope**

When working in a specific area, **GO TO THE LOCAL CONTEXT FIRST**:

```
Working in a service?
→ Read: services/{service-name}/.claude/README.md

Working in frontend?
→ Read: apps/frontend/.claude/README.md

Working in mobile?
→ Read: apps/mobile/.claude/README.md

Writing tests?
→ Read: tests/.claude/README.md
```

**This file (root CLAUDE.md) is for global patterns only.**

---

## Development Disciplines (MUST FOLLOW)

### 1. Context-Driven Development
- **ALWAYS** read local `.claude/README.md` before making changes
- Local context has mandatory checklists - follow them EXACTLY
- When in doubt: `cat .claude/README.md`

### 2. Update, Don't Create
- Before creating ANY new file: Search for existing
- If exists: UPDATE it with date stamp
- Only create if truly novel topic

### 3. Git Hooks (Automatic)
Git hooks automatically run checks on commit/push:
- **Pre-commit**: Service analysis & documentation checks
- **Pre-push**: Unit tests (integration tests if DB available)

```bash
npm run hooks:install  # Install/update hooks
git commit             # Hooks run automatically
git push --no-verify   # Skip hooks if needed
SKIP_PREPUSH=1 git push # Skip pre-push checks
```

### 4. Fix Forward, Not Around
- BAD: Create workaround (seed-v3.sh)
- GOOD: Fix the original script
- Document why in ADR if architectural

### 5. Feedback Loops (NEW)
Changes trigger documentation updates:
- New endpoint → Update CONTEXT.md + registry.json
- New dependency → Update registry.json + run analyze:services
- Fix bug → Document in CONTEXT.md "Recent Fixes"
- Find bug → Add to CONTEXT.md "Known Issues"

Run feedback loop check:
```bash
npm run feedback:check
```

---

## System Architecture

### Services (11 total)
See **[services/registry.json](services/registry.json)** for complete list.

| Service | Port | Criticality | Dependents |
|---------|------|-------------|------------|
| Auth | 3001 | Critical | 7 services |
| Community | 3002 | Critical | 3 services |
| Request | 3003 | Critical | 0 services |
| Reputation | 3004 | Critical | 0 services |
| Notification | 3005 | Critical | 0 services |
| Messaging | 3006 | Critical | 0 services |
| Social-Graph | 3010 | Critical | 0 services |
| Feed | 3007 | Important | 0 services |
| Cleanup | 3008 | Important | 0 services |
| Geocoding | 3009 | Optional | 0 services |
| Simulation | dev | Optional | 0 services |

**Governance Tools**:
```bash
npm run analyze:services  # Generate dependency graph, impact analysis
npm run dashboard         # Real-time service health monitoring
npm run health:check      # Check all critical services
```

### Tech Stack
- **Backend**: Node.js/Express/TypeScript
- **Frontend**: Next.js 14
- **Mobile**: React Native + Expo
- **Database**: PostgreSQL 15 with RLS
- **Cache/Queue**: Redis + Bull
- **Build**: Turborepo
- **Governance**: Service Registry + Auto-analysis

---

## Global Patterns

### Authentication
All services use JWT with standardized payload:
```typescript
{
  userId: string,
  email: string,
  communityMemberships: Array<{id: string, name: string, role: string}>
}
```

Header: `Authorization: Bearer <token>`

### Database Schema
Tables use schema prefixes:
- `auth.users`, `auth.sessions`
- `community.communities`, `community.members`
- `requests.help_requests`, `requests.matches`
- `reputation.karma_records`
- `notifications.notifications`
- `messaging.conversations`

### API Response Format
ALL endpoints MUST return:
```json
{
  "success": boolean,
  "data": T,
  "message": "optional"
}
```

Errors:
```json
{
  "success": false,
  "message": "Human-readable error",
  "error": "ERROR_CODE"
}
```

### Event-Driven Communication
Services communicate via Bull queue (`karmyq-events`):
- `match_completed` → Reputation, Notification
- `karma_awarded` → Notification
- `request_created` → Feed, Notification
- `user_joined_community` → Feed, Notification

See [services/registry.json](services/registry.json) for event publishers/subscribers.

---

## Development Commands

### Infrastructure
```bash
# Start PostgreSQL + Redis
cd infrastructure/docker && docker-compose up -d postgres redis

# View all service health
npm run dashboard

# Check critical services
npm run health:check
```

### Building
```bash
# Build all services
npm run build

# Build specific service
cd services/auth-service && npm run build
```

### Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
cd tests && npm run test:e2e

# Coverage
npm run test:coverage
```

### Git Hooks
```bash
# Install git hooks (runs automatically on npm install)
npm run hooks:install

# Hooks run automatically on commit/push
# Pre-commit: Service analysis & documentation checks
# Pre-push: Unit tests (+ integration tests if DB available)

# Skip hooks when needed
git commit --no-verify
git push --no-verify
SKIP_PREPUSH=1 git push
```

### Service Governance
```bash
# Generate dependency graph + impact analysis
npm run analyze:services

# Interactive health dashboard
npm run dashboard

# Check for context updates needed
npm run feedback:check

# Generate .claude/README.md for services
node scripts/generate-service-context.js
```

---

## Documentation Structure

```
CLAUDE.md                           ← You are here (global context)

services/
  registry.json                     ← Single source of truth for services
  dependency-graph.md               ← Generated dependency diagram
  impact-analysis.md                ← Generated impact radius report
  {service-name}/
    .claude/README.md               ← LOCAL CONTEXT (read first!)
    CONTEXT.md                      ← Technical reference
    README.md                       ← Human-readable overview

apps/
  frontend/.claude/README.md        ← Frontend-specific context
  mobile/.claude/README.md          ← Mobile-specific context

docs/
  README.md                         ← Documentation index
  ARCHITECTURE.md                   ← System architecture
  SERVICE_GOVERNANCE.md             ← Governance framework
  CONTEXT_MANAGEMENT.md             ← This context system
  adr/                              ← Architecture Decision Records
```

---

## Creating New Services

**MANDATORY Checklist** (enforced by pre-commit):

1. [ ] Add entry to `services/registry.json`
2. [ ] Run `npm run analyze:services` (check for circular deps)
3. [ ] Run `node scripts/generate-service-context.js`
4. [ ] Create service using generated `.claude/README.md` template
5. [ ] **Configure TypeScript correctly** (see ADR-028):
   - [ ] Set `"rootDir": "./src"` in tsconfig.json
   - [ ] Set `"include": ["src/**/*"]` (exclude tests)
   - [ ] Verify build produces `dist/index.js` not `dist/src/index.js`
6. [ ] **Configure Dockerfile** (copy from existing TypeScript service):
   - [ ] Build shared package before service
   - [ ] Copy shared/dist BEFORE npm install in production stage
   - [ ] Use multi-stage build pattern
7. [ ] Add health check endpoint `/health`
8. [ ] Add to `docker-compose.yml`
9. [ ] Add database schema to `infrastructure/postgres/init.sql` (if needed)
10. [ ] Update simulation service to test new endpoints
11. [ ] Run `npm run health:check` to verify
12. [ ] Document in ADR if architectural decision

See:
- [docs/SERVICE_GOVERNANCE.md](docs/SERVICE_GOVERNANCE.md)
- [docs/adr/ADR-028-npm-workspace-docker-build.md](docs/adr/ADR-028-npm-workspace-docker-build.md)

---

## Deployment

### Development
```bash
# Start all services
npm run dev

# Restart specific service (pm2)
pm2 restart karmyq-{service-name}

# View logs
pm2 logs karmyq-{service-name}
```

### Production (ARM64 / Oracle Cloud)
```bash
# SSH to production, then:
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy.sh
```

The script automatically:
1. Pulls latest code from master
2. Loads `.env.production`
3. Builds Docker images (ARM64)
4. Deploys via docker-compose
5. Verifies health

---

## Common Workflows

### Adding a New Endpoint
1. Read service's `.claude/README.md`
2. Update `src/routes/{name}.ts`
3. Update `CONTEXT.md` "API Endpoints" section
4. Update `services/registry.json` "apis.provides"
5. Run `npm run analyze:services`
6. Run tests
7. Document in frontend if consumed

### Fixing a Bug
1. Document bug in service `CONTEXT.md` "Known Issues"
2. Write failing test
3. Fix bug
4. Verify test passes
5. Remove from "Known Issues", add to "Recent Fixes"
6. Commit with reference to issue

### Changing Database Schema
1. Update `infrastructure/postgres/init.sql`
2. Create migration in `infrastructure/postgres/migrations/`
3. Update service `CONTEXT.md` "Database Schema"
4. Document in ADR if significant
5. Test migration locally
6. Deploy with migration

---

## Reference

### Key Documents
- **Service Registry**: [services/registry.json](services/registry.json)
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Governance**: [docs/SERVICE_GOVERNANCE.md](docs/SERVICE_GOVERNANCE.md)
- **Context System**: [docs/CONTEXT_MANAGEMENT.md](docs/CONTEXT_MANAGEMENT.md)
- **Roadmap**: [docs/archive/gemini-review/roadmap.md](docs/archive/gemini-review/roadmap.md)

### ADRs (Architecture Decision Records)
- [ADR-001](docs/adr/ADR-001-postgresql-schemas.md): PostgreSQL Schemas
- [ADR-004](docs/adr/ADR-004-microservices-event-driven.md): Microservices + Event-Driven
- [ADR-011](docs/adr/ADR-011-reputation-decay.md): Reputation Decay System
- [Full list](docs/adr/)

---

## Getting Help

### Debugging
1. Check service health: `npm run dashboard`
2. View logs: `pm2 logs {service-name}`
3. Check dependencies: `npm run analyze:services`
4. Read service `.claude/README.md` for troubleshooting

### Understanding the System
1. Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. View dependency graph: [services/dependency-graph.md](services/dependency-graph.md)
3. Check impact analysis: [services/impact-analysis.md](services/impact-analysis.md)
4. Read service-specific docs in `services/{name}/.claude/README.md`

---

**Remember**: This is global context. For specific areas, **read the local `.claude/README.md` first!**
