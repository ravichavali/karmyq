# feed-service - Local Context

> **⚠️ CRITICAL**: When working in this directory, follow these steps EXACTLY.
> This is a important service - no dependents.

## Quick Facts

- **Port**: 3007
- **Health Check**: http://localhost:3007/health
- **Database Schema**: feed
- **Status**: production
- **Criticality**: important

## Service Dependencies

### This Service Depends On
- auth-service

### Infrastructure Dependencies
- postgres
- redis

### Services That Depend On This
- None (leaf service)



---

## ✅ MANDATORY: Before Making ANY Changes

### 1. Read Service Documentation
```bash
# Read technical reference
cat CONTEXT.md

# Check service registry entry
cat ../../services/registry.json | jq '.services."feed-service"'

# View dependency graph
cat ../../services/dependency-graph.md
```

### 2. Understand Impact Radius
```bash
# Run impact analysis
cd ../.. && npm run analyze:services

# View impact report
cat services/impact-analysis.md | grep -A 10 "feed-service"
```

### 3. Check Current Health
```bash
# Health check
curl -f http://localhost:3007/health || echo "Service is DOWN"

# View recent logs (if using pm2)
pm2 logs feed-service --lines 50 --nostream
```

### 4. Run Tests
```bash
# Unit tests
npm test

# Integration tests (from root)
cd ../../tests && npm run test:integration
```

---

## 🔄 Development Workflow

### Step 1: Understand the Change
- [ ] Read CONTEXT.md for API documentation
- [ ] Check services/registry.json for dependencies
- [ ] Review recent commits: `git log --oneline -10`
- [ ] Search for similar code: `grep -r "pattern" src/`

### Step 2: Make Changes
- [ ] **NEVER skip reading files before editing**
- [ ] **ALWAYS understand existing patterns first**
- [ ] Use Read tool before Edit tool
- [ ] Follow existing code style

### Step 3: Test Changes
```bash
# Run unit tests
npm test

# Start service locally
npm run dev

# Test API endpoints manually
curl http://localhost:3007/health

# Check for errors in logs
pm2 logs feed-service --lines 20
```

### Step 4: Update Documentation
- [ ] Update CONTEXT.md if API changed
- [ ] Update services/registry.json if dependencies changed
- [ ] Add ADR if architectural decision made
- [ ] Update this .claude/README.md if workflow changed

### Step 5: Deploy
```bash
# Build
npm run build

# Restart service
pm2 restart feed-service

# Verify health
curl -f http://localhost:3007/health

# Monitor logs for errors
pm2 logs feed-service --lines 50
```

---

## 🔁 FEEDBACK LOOPS (Update Context)

### When You Create a New Endpoint
1. Add to CONTEXT.md "API Endpoints" section
2. Update services/registry.json "apis.provides" array
3. Run: `npm run analyze:services` to update graphs
4. If consumed by frontend: Document in apps/frontend/.claude/API_CHANGES.md

### When You Add a Dependency
1. Update package.json
2. Update services/registry.json "dependencies.services" array
3. Run: `npm run analyze:services` to detect circular deps
4. Update this .claude/README.md "Service Dependencies" section

### When You Find a Bug
1. Document in CONTEXT.md under "## Known Issues" section
2. Create issue in GitHub or add to docs/BUGS.md
3. If pattern is common: Add to "Common Mistakes" below

### When You Fix a Bug
1. Remove from CONTEXT.md "Known Issues"
2. Add to CONTEXT.md "## Recent Fixes" with date
3. If it was a repeated error: Update "Common Mistakes" with prevention tip

### When You Change Database Schema
1. Update infrastructure/postgres/init.sql
2. Update CONTEXT.md "Database Schema" section
3. Create migration script in infrastructure/postgres/migrations/
4. Document in ADR if significant change

### When You Add Event Publishing/Subscribing
1. Update services/registry.json "events" section
2. Update CONTEXT.md "Events" section
3. Run: `npm run analyze:services` to update event flow diagram
4. Verify consuming services are updated

---

## ❌ Common Mistakes to AVOID

### API Response Parsing
❌ **Don't**: Assume API responses are flat
```typescript
const data = response.data; // WRONG - often nested
```

✅ **Do**: Check actual response structure
```typescript
const data = response.data.data || response.data; // Handle nesting
if (!Array.isArray(data)) throw new Error('Expected array');
```

### File Operations
❌ **Don't**: Edit files without reading them first
❌ **Don't**: Assume file structure from memory

✅ **Do**: Use Read tool before Edit tool
✅ **Do**: Verify file exists and understand current state

### Testing
❌ **Don't**: Skip tests "because it's a small change"
❌ **Don't**: Assume tests still pass

✅ **Do**: Run tests before AND after changes
✅ **Do**: Add new tests for new functionality

### Dependency Management
❌ **Don't**: Add dependencies to service package.json
❌ **Don't**: Use different versions than root

✅ **Do**: Check if dependency is already in root package.json
✅ **Do**: Request hoisting if common dependency

### Error Handling
❌ **Don't**: Return 500 for validation errors
❌ **Don't**: Expose stack traces in production

✅ **Do**: Use 400 for client errors, 500 for server errors
✅ **Do**: Check NODE_ENV before exposing details

---

## 📋 Service-Specific Patterns

### API Response Format
All endpoints MUST return:
```typescript
{
  success: boolean,
  data?: T,
  message?: string,
  error?: string // Only in development
}
```

### Authentication
- JWT token in `Authorization: Bearer <token>` header
- Verified by authMiddleware from @karmyq/shared
- Token payload: `{ userId: string, email: string, communityMemberships: [...] }`

### Error Responses
```typescript
{
  success: false,
  message: "Human-readable error",
  error: "VALIDATION_ERROR" // Error code
}
```

### Logging
```typescript
req.logger.info('Action performed', { userId, context });
req.logger.error('Error occurred', error, { userId, context });
```

---

## 📂 File Organization

```
feed-service/
├── .claude/
│   └── README.md          ← You are here
├── src/
│   ├── index.ts           ← Express app setup
│   ├── routes/            ← API route handlers
│   ├── services/          ← Business logic
│   ├── database/          ← DB queries
│   └── middleware/        ← Custom middleware (if any)
├── tests/
│   ├── unit/              ← Unit tests
│   └── integration/       ← Integration tests
├── CONTEXT.md             ← Technical reference
├── README.md              ← Human-readable overview
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## 🔗 Reference Documents

### Service-Level
- **Technical Details**: [CONTEXT.md](./CONTEXT.md) (this directory)
- **Human Overview**: [README.md](./README.md) (this directory)

### System-Level
- **Architecture**: [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- **Service Registry**: [../../services/registry.json](../../services/registry.json)
- **Dependency Graph**: [../../services/dependency-graph.md](../../services/dependency-graph.md)
- **Impact Analysis**: [../../services/impact-analysis.md](../../services/impact-analysis.md)
- **Global Context**: [../../CLAUDE.md](../../CLAUDE.md)

### Decision Records
- **ADRs**: [../../docs/adr/](../../docs/adr/)
- **Roadmap**: [../../docs/archive/gemini-review/roadmap.md](../../docs/archive/gemini-review/roadmap.md)

---

## 🆘 Troubleshooting

### Service Won't Start
1. Check logs: `pm2 logs feed-service`
2. Verify environment variables: `cat .env`
3. Test database connection: `psql $DATABASE_URL -c "SELECT 1"`
4. Check port availability: `lsof -i :3007`

### Tests Failing
1. Check if database is seeded: `npm run seed`
2. Verify environment: `NODE_ENV=test npm test`
3. Check test isolation: Each test should clean up
4. Review recent changes: `git diff HEAD~1`

### API Errors
1. Check request format matches CONTEXT.md
2. Verify authentication token is valid
3. Check database schema matches expectations
4. Review logs for detailed error messages

---

**Last Updated**: 2026-03-03
**Service Owner**: core
**Criticality**: important
**Impact Radius**: 0 dependent service(s)
