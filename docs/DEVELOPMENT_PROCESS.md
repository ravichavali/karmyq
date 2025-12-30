# Karmyq Development Process

**Version**: 1.0.0
**Last Updated**: 2025-12-28
**Status**: Active - This is the authoritative guide for all development work

---

## Purpose

This document defines the **mandatory development process** for Karmyq. All code changes must follow this process to prevent regressions and maintain system quality.

**For AI Assistants**: Read this document before making ANY code changes. Follow the checklists exactly.

---

## Core Principles

1. **Test Before Commit** - All tests must pass before any commit
2. **Understand Before Change** - Read related code, check dependencies
3. **Validate Integration** - Changes work across services, database, and UI
4. **Document Breaking Changes** - Update all affected documentation
5. **No Silent Failures** - If something might break, ask the user first

---

## Pre-Change Checklist

Before making ANY code change, complete this checklist:

### 1. Understand the Change Scope

- [ ] Read the files you're about to modify
- [ ] Identify which services are affected
- [ ] Check if database schema changes are needed
- [ ] Identify which UI components consume this data
- [ ] Review recent git commits touching these files

### 2. Check Dependencies

**Database Changes**:
- [ ] Does this change database schema? → Update `infrastructure/postgres/init.sql`
- [ ] Does this add/remove columns? → Check all queries using this table
- [ ] Does this change data format? → Check data generation scripts

**API Changes**:
- [ ] Does this change API response format? → Check all consumers
- [ ] Does this add/remove endpoints? → Update API client
- [ ] Does this change authentication? → Test with auth middleware

**UI Changes**:
- [ ] Does this change props/types? → Check all usages with `Grep`
- [ ] Does this affect styling? → Test responsive design
- [ ] Does this change routing? → Update navigation components

### 3. Plan the Changes

Create a written plan listing:
1. Files to modify (with line numbers if known)
2. New files to create
3. Tests to update
4. Documentation to update

### 4. Identify Breaking Changes

Answer these questions:
- Does this break existing API contracts? → **Ask user for approval**
- Does this require database migration? → **Create migration script**
- Does this change authentication flow? → **Test all auth paths**
- Does this affect deployed services? → **Plan deployment order**

---

## Making Changes

### Code Modification Process

1. **Read First**
   ```bash
   # Always read the file before editing
   Read the entire file (don't use offset/limit unless file is huge)
   ```

2. **Make Atomic Changes**
   - Change one thing at a time
   - Keep related changes together
   - Use descriptive commit messages

3. **Preserve TypeScript Types**
   - Never use `any` unless absolutely necessary
   - Add proper type guards
   - Update interface definitions when changing data structures

4. **Follow Existing Patterns**
   - Match code style in the file
   - Use existing utilities/helpers
   - Follow naming conventions

### Data Generation Changes

When modifying `scripts/generate-realistic-data.ts`:

**Required Steps**:
1. Update the INSERT statements
2. Update any dependent queries (counts, aggregations)
3. Update validation queries
4. Run the script to verify
5. Check database integrity with sample queries

**Common Pitfalls**:
- ✅ Update counter columns (like `current_members`)
- ✅ Maintain referential integrity (foreign keys exist)
- ✅ Generate realistic data (not lorem ipsum)
- ✅ Include polymorphic payloads for typed requests

### Frontend Changes

When modifying UI components:

**Required Steps**:
1. Check if component accepts new props
2. Update TypeScript interfaces
3. Verify prop usage in parent components
4. Test with realistic data from database

**Common Pitfalls**:
- ❌ Adding props without updating interface
- ❌ Using undefined data without null checks
- ❌ Breaking responsive design
- ❌ Not testing with actual backend data

---

## Testing Requirements

### Before Every Commit

**Mandatory**: Run the complete test suite:

```bash
# Windows
scripts\test-all.bat

# Mac/Linux
./scripts/test-all.sh
```

This runs:
1. **TypeScript Type Checking** - Catches type errors (~30 seconds)
2. **Integration Tests** - API tests for all services (~1-2 minutes)
3. **Unit Tests** - Jest tests (~1 minute)
4. **E2E Tests** - Playwright UI tests (~3-5 minutes)

**Total Time**: 5-10 minutes

**Rule**: If ANY test fails, DO NOT commit. Fix the issue first.

### Quick Development Testing

During active development (before commit):

```bash
# Windows
scripts\test-local.bat quick

# Mac/Linux
./scripts/test-local.sh quick
```

**Time**: ~30 seconds (type-check + integration only)

### After Data Generation Changes

When modifying data generation:

```bash
# 1. Truncate database
cd scripts
truncate-database.bat  # or .sh

# 2. Run generation
npm run generate:realistic

# 3. Validate data
docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db -c "
  -- Check for data integrity issues
  SELECT 'communities' as table_name,
         COUNT(*) FILTER (WHERE current_members !=
           (SELECT COUNT(*) FROM communities.members m WHERE m.community_id = c.id)
         ) as invalid_count
  FROM communities.communities c;
"
```

### Docker Build Validation

Before suggesting `docker-compose up --build`:

1. Check for TypeScript errors in all services
2. Verify Dockerfile syntax
3. Check for missing dependencies
4. Validate build context paths

---

## Architecture Understanding

### System Overview

```
┌─────────────┐
│  Frontend   │ (Next.js)
│  Port 3000  │
└──────┬──────┘
       │
       ├─────────────────────────────────────┐
       ↓                                     ↓
┌─────────────┐                      ┌──────────────┐
│   Backend   │                      │   Database   │
│  Services   │ ←────────────────────│  PostgreSQL  │
│ Ports 3001+ │                      │   Port 5432  │
└──────┬──────┘                      └──────────────┘
       │
       ├─ Auth Service (3001)
       ├─ Community Service (3002)
       ├─ Request Service (3003)
       ├─ Reputation Service (3004)
       ├─ Notification Service (3005)
       ├─ Messaging Service (3006)
       ├─ Feed Service (3007)
       ├─ Cleanup Service (3008)
       ├─ Geocoding Service (3009)
       └─ Social Graph Service (3010)
```

### Data Flow: Help Request

Understanding how data flows through the system prevents breaking changes:

```
1. USER CREATES REQUEST (Frontend)
   └─> dashboard.tsx
       ├─ Parses user input
       ├─ Builds polymorphic payload
       └─> POST /api/requests/create

2. API STORES REQUEST (Request Service)
   └─> services/request-service/src/routes/requests.ts
       ├─ Validates request data
       ├─ Inserts into requests.help_requests
       │   ├─ Basic fields: title, description, urgency
       │   ├─ Polymorphic: payload (JSONB), requirements (JSONB)
       │   └─ Temporal: preferred_start_date, preferred_end_date
       └─> Links to communities via requests.request_communities

3. FEED SERVICE AGGREGATES (Feed Service)
   └─> services/feed-service/src/routes/feed.ts
       ├─ Joins help_requests + users + communities
       ├─ Adds trust path data
       └─> Returns feed items

4. UI DISPLAYS REQUEST (Frontend)
   └─> components/Feed/FeedItem.tsx
       ├─ OpenRequestItem component
       ├─ Currently shows: title, description, urgency, author
       └─ ❌ MISSING: payload, requirements, preferred dates
```

**Critical Points**:
- Database has rich polymorphic data (payload JSONB)
- Feed Service returns all fields
- **UI only renders subset** - adding UI display won't break backend

### Database Schema Dependencies

**When changing these tables, check all consumers**:

| Table | Used By Services | Used By Scripts | UI Components |
|-------|-----------------|-----------------|---------------|
| `auth.users` | Auth, Community, Request, Feed | generate-realistic-data.ts | All authenticated pages |
| `communities.communities` | Community, Request, Feed | generate-realistic-data.ts | CommunityList, FeedItem |
| `communities.members` | Community, Feed, Social Graph | generate-realistic-data.ts | MemberList, current_members display |
| `requests.help_requests` | Request, Feed, Reputation | generate-realistic-data.ts | FeedItem, RequestDetail |
| `requests.matches` | Request, Reputation, Feedback | generate-realistic-data.ts | MatchList, karma calculation |
| `reputation.karma_records` | Reputation | generate-realistic-data.ts | UserProfile, Leaderboard |
| `reputation.trust_scores` | Reputation, Feed | generate-realistic-data.ts | TrustPathBadge |

### TypeScript Type Flow

**Request Data Types**:
```typescript
// Database (init.sql)
requests.help_requests {
  payload: JSONB,           // Polymorphic data (locations, times, etc.)
  requirements: JSONB,      // Structured requirements
  preferred_start_date: TIMESTAMP,
  preferred_end_date: TIMESTAMP
}

// API Response (services/request-service)
interface HelpRequest {
  id: string;
  title: string;
  description: string;
  request_type: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  payload?: any;            // Should be typed based on request_type
  requirements?: any;       // Should be typed based on request_type
  preferred_start_date?: string;
  preferred_end_date?: string;
}

// Feed Item (services/feed-service)
interface FeedItem {
  type: 'open_request';
  data: {
    request_id: string;
    title: string;
    description: string;
    urgency: string;
    author_name: string;
    community_name: string;
    // ❌ MISSING: payload, requirements, preferred dates
  }
}

// UI Component (components/Feed/FeedItem.tsx)
function OpenRequestItem({ data }: { data: any }) {
  // Currently uses: title, description, urgency, author_name
  // ❌ MISSING: payload rendering based on type
}
```

**Type Safety Issue**: The `any` types throughout the stack allow data to flow but lose type safety for polymorphic payloads.

---

## Common Anti-Patterns to Avoid

### ❌ Don't: Make Changes Without Reading Context

```typescript
// Bad: Adding prop without checking usage
export function MyComponent({ newProp }: { newProp: string }) {
  // Added newProp but didn't check if parent components pass it
}
```

**Do Instead**:
1. Use `Grep` to find all usages: `<MyComponent`
2. Update all call sites
3. Add proper TypeScript types

### ❌ Don't: Update Database Without UI

```sql
-- Bad: Added columns but UI doesn't display them
ALTER TABLE requests.help_requests
ADD COLUMN payload JSONB,
ADD COLUMN requirements JSONB;
```

**Do Instead**:
1. Plan the full data flow: DB → API → UI
2. Update all layers together (or document what's pending)
3. Add TODO comments for incomplete work

### ❌ Don't: Trust Assumptions

```typescript
// Bad: Assuming data exists without checking
const location = request.payload.pickup_location.address;
```

**Do Instead**:
```typescript
// Good: Safe access with type guards
const location = request.payload?.pickup_location?.address ?? 'Location not specified';
```

### ❌ Don't: Skip Testing Because "It's Simple"

```bash
# Bad: Committing without running tests
git add .
git commit -m "Quick fix"
```

**Do Instead**:
```bash
# Good: Always run test suite
scripts\test-all.bat
git add .
git commit -m "fix: update current_members sync in data generation"
```

---

## Git Workflow

### Commit Message Format

Follow conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Updating build tasks, package manager configs, etc.

**Examples**:
```
feat(feed): add polymorphic request rendering in FeedItem
fix(data-gen): sync current_members count after member insertion
docs(process): add development process documentation
test(request-service): add integration tests for polymorphic requests
```

### Before Committing

```bash
# 1. Run full test suite
scripts\test-all.bat

# 2. Review changes
git diff

# 3. Stage changes
git add <files>

# 4. Commit with descriptive message
git commit -m "feat(scope): description"
```

### After Major Changes

```bash
# 1. Verify Docker build
cd infrastructure/docker
docker-compose build

# 2. Test services start correctly
docker-compose up

# 3. Run E2E tests against running system
cd ../../tests
npm run test:e2e
```

---

## Documentation Requirements

### When to Update Documentation

**Always update when**:
- Adding new service
- Changing API contracts
- Modifying database schema
- Adding new features
- Changing authentication/authorization
- Modifying deployment process

**Documentation Locations**:
- `docs/architecture/` - System design, service architecture
- `docs/testing/` - Testing guides, coverage reports
- `services/*/CONTEXT.md` - Service-specific documentation
- `CLAUDE.md` - Project overview for AI assistants
- `docs/DEVELOPMENT_PROCESS.md` - **This file**

### Updating This Document

**This document should be updated when**:
- Development process changes
- New testing requirements are added
- Common issues are identified
- New architectural patterns are established

**Process for Updates**:
1. Propose changes in comment or separate doc
2. Discuss with team
3. Update this document
4. Communicate changes to all developers
5. Archive old version if major changes

---

## Incident Response

### When Tests Fail

1. **Don't commit** - Fix the issue first
2. **Identify root cause** - Which test failed and why
3. **Fix properly** - Don't hack around the test
4. **Verify fix** - Run full test suite again
5. **Document** - If it's a common issue, add to this guide

### When Production Breaks

1. **Rollback immediately** - Revert to last working version
2. **Investigate locally** - Reproduce the issue
3. **Fix with tests** - Add regression test
4. **Verify thoroughly** - Run all tests + manual testing
5. **Deploy carefully** - Monitor during deployment

### When Data Generation Fails

1. **Check database state** - Are tables populated?
2. **Check referential integrity** - Do foreign keys exist?
3. **Check data quality** - Are values realistic?
4. **Fix and re-run** - Truncate and regenerate if needed

---

## AI Assistant Guidelines

**For Claude Code and other AI assistants working on this project**:

### Before ANY Code Change

1. **Read this document** - Understand the process
2. **Complete Pre-Change Checklist** - All items must be checked
3. **Plan the change** - Write down what will be modified
4. **Ask if unsure** - Better to ask than break production

### During Development

1. **Use Read tool extensively** - Understand before changing
2. **Use Grep to find usages** - Check all call sites
3. **Run type checks** - Catch TypeScript errors early
4. **Test incrementally** - Don't batch multiple changes

### Before Suggesting Commit

1. **Run test suite** - `scripts\test-all.bat`
2. **Verify all tests pass** - No exceptions
3. **Review changes** - Does it make sense?
4. **Update documentation** - If needed

### Red Flags - Stop and Ask User

- Multiple test failures
- Breaking API changes
- Database schema modifications
- Authentication/security changes
- Docker build failures
- TypeScript errors you can't resolve

---

## Quick Reference

### Testing Commands

```bash
# Full test suite (run before every commit)
scripts\test-all.bat              # Windows
./scripts/test-all.sh              # Mac/Linux

# Quick development tests
scripts\test-local.bat quick       # Windows
./scripts/test-local.sh quick      # Mac/Linux

# Specific test suites
npm run test                       # Unit tests
npm run test:integration          # Integration tests
npm run test:e2e                  # E2E tests
```

### Data Generation

```bash
# Clean database and regenerate
cd scripts
truncate-database.bat              # or .sh
npm run generate:realistic
```

### Docker

```bash
# Build and start all services
cd infrastructure/docker
docker-compose up --build

# View logs for specific service
docker logs karmyq-{service-name} -f

# Restart specific service
docker-compose restart {service-name}
```

### Database Queries

```bash
# Connect to database
docker exec -it karmyq-postgres psql -U karmyq_user -d karmyq_db

# Common queries
SELECT COUNT(*) FROM auth.users;
SELECT * FROM communities.communities LIMIT 5;
SELECT * FROM requests.help_requests WHERE payload IS NOT NULL LIMIT 3;
```

---

## Changelog

### Version 1.0.0 (2025-12-28)

**Created**: Initial development process documentation

**Sections**:
- Core principles and pre-change checklist
- Testing requirements and validation
- Architecture understanding and data flows
- Common anti-patterns and git workflow
- AI assistant guidelines

**Motivation**: Prevent regressions and establish systematic development process

---

## Next Steps

1. **Create skills** - Build automated validation tools
2. **Enhance documentation** - Add more data flow diagrams
3. **Improve testing** - Add more integration test coverage
4. **Monitor compliance** - Track how well we follow this process
