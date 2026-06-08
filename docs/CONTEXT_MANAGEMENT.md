# Context Management Strategy

**Problem Identified**: 2026-01-21
**Status**: CRITICAL - Context fragmentation causing repeated errors and skipped steps

---

## The Problem

We have **context rot** across the codebase:

### Symptoms
1. **Skipping steps**: Not reading files before editing, not running tests
2. **Repeated errors**: Fixing the same bugs multiple times (simulation service had 5 rounds of fixes)
3. **Context fragmentation**: 8,202 lines across 20+ service docs, no clear entry point
4. **No local context**: Services don't have `.claude/` folders with scoped instructions
5. **Global-only context**: Root `CLAUDE.md` tries to cover everything (impossible)

### Evidence
- Simulation service debugging: Fixed same API response parsing 3x
- No `.claude/` folders in any service directory
- Root `CLAUDE.md` is 177 lines trying to cover 11 services + system
- Service `CONTEXT.md` files are comprehensive but not discoverable by agents

---

## Root Cause Analysis

### Current Context Architecture (Broken)

```
karmyq/
├── CLAUDE.md                    # Global context (177 lines)
├── services/
│   ├── claude.md               # Generic service info (49 lines)
│   ├── auth-service/
│   │   ├── CONTEXT.md          # 400+ lines, NOT loaded by default
│   │   └── README.md           # Duplicate info
│   ├── request-service/
│   │   ├── CONTEXT.md          # 600+ lines, NOT loaded by default
│   │   └── README.md
│   └── ... 9 more services
```

**Problem**: When working in `services/request-service/`:
- Agent loads `karmyq/CLAUDE.md` (global)
- Agent does NOT see `services/request-service/CONTEXT.md`
- Agent makes changes without service-specific knowledge
- Result: Errors, skipped steps, repeated mistakes

---

## The Solution: Hierarchical Context System

### Principle: **Context Follows Directory Scope**

When working in a directory, the agent should:
1. Load **local context** first (service-specific)
2. Reference **global context** for system-wide patterns
3. Have **clear prompts** for what to do before/after changes

### Implementation: `.claude/` Folders Per Service

```
karmyq/
├── .claude/
│   └── settings.json           # Root-level settings
├── CLAUDE.md                    # System overview (BRIEF)
│
├── services/
│   ├── auth-service/
│   │   ├── .claude/
│   │   │   └── README.md       # Service-scoped instructions
│   │   ├── CONTEXT.md          # Technical reference
│   │   └── src/
│   │
│   ├── request-service/
│   │   ├── .claude/
│   │   │   └── README.md       # Service-scoped instructions
│   │   ├── CONTEXT.md
│   │   └── src/
│   │
│   └── ... (all services)
│
├── apps/
│   ├── frontend/
│   │   ├── .claude/
│   │   │   └── README.md       # Frontend-scoped instructions
│   │   └── src/
│   │
│   └── mobile/
│       ├── .claude/
│       │   └── README.md       # Mobile-scoped instructions
│       └── src/
```

---

## Service `.claude/README.md` Template

Each service gets a `.claude/README.md` with:

```markdown
# [Service Name] - Local Context

> **IMPORTANT**: When working in this directory, follow these steps EXACTLY.

## Quick Facts
- **Port**: 3001
- **Health**: http://localhost:3001/health
- **Database Schema**: auth.*
- **Dependencies**: None (foundation service)

## Before Making ANY Changes

1. **Read CONTEXT.md**: `cat services/auth-service/CONTEXT.md`
2. **Check registry**: Is this service critical? (see services/registry.json)
3. **Run tests**: `npm test` (must pass before changes)
4. **Check health**: `curl http://localhost:3001/health`

## Development Workflow

### 1. Understanding the Service
- Read `CONTEXT.md` for API docs and schema
- Check `services/registry.json` for dependencies and consumers
- Run `npm run analyze:services` to see impact radius

### 2. Making Changes
- **NEVER skip reading files before editing**
- **ALWAYS run tests after changes**
- **ALWAYS check if dependent services are affected**

### 3. Testing
```bash
# Unit tests
npm test

# Integration tests (from root)
cd ../../tests && npm run test:integration

# Manual health check
curl http://localhost:3001/health
```

### 4. Deployment
```bash
# Build
npm run build

# Restart (development)
pm2 restart karmyq-auth

# Check logs
pm2 logs karmyq-auth --lines 50
```

## Common Mistakes to AVOID

❌ **Don't**: Edit files without reading them first
✅ **Do**: Use Read tool, understand existing code

❌ **Don't**: Skip tests "because it's a small change"
✅ **Do**: Run tests before AND after changes

❌ **Don't**: Assume API responses are flat objects
✅ **Do**: Check actual API response structure first

❌ **Don't**: Make changes without checking dependent services
✅ **Do**: Run `npm run analyze:services` to see impact

## Critical Patterns (This Service)

### JWT Token Structure
```typescript
{
  userId: string,
  email: string,
  communityMemberships: Array<{id: string, name: string, role: string}>
}
```

### API Response Format
```typescript
{
  success: boolean,
  data: T,
  message?: string
}
```

### Error Handling
- 400: Validation errors
- 401: Authentication required
- 500: Internal server error

## Integration Points

### Services That Depend On This
- community-service (auth verification)
- request-service (auth verification)
- reputation-service (auth verification)
- notification-service (auth verification)
- messaging-service (auth verification)
- request-service (feed auth verification)
- social-graph-service (auth verification)

**Impact**: If this service is down, 7 services fail!

### This Service Depends On
- postgres (database)
- redis (session storage)

## File Organization

```
src/
├── index.ts              # Express app setup
├── routes/
│   └── auth.routes.ts    # /register, /login, /verify, /profile
├── database/
│   └── db.ts            # PostgreSQL connection
└── middleware/          # (uses shared middleware from packages/shared)
```

## Reference Documents

- Technical details: `CONTEXT.md` (this directory)
- System architecture: `../../docs/ARCHITECTURE.md`
- Service registry: `../../services/registry.json`
- Global context: `../../CLAUDE.md`
```

---

## Root `CLAUDE.md` Revision (Simplified)

**Current**: 177 lines trying to cover everything
**New**: ~50 lines focusing on:
1. Where to find context (pointer to `.claude/README.md` in each area)
2. High-level architecture (service list, ports)
3. Development disciplines (update don't create, test before commit)
4. How to use governance framework

**Key change**: Root context says "GO TO LOCAL CONTEXT" instead of duplicating info.

---

## Implementation Plan

### Phase 1: Create Service `.claude/README.md` Files (1 hour)
```bash
# For each production service
for service in auth community request reputation notification messaging feed social-graph cleanup geocoding; do
  mkdir -p services/${service}-service/.claude
  # Generate from template above
done
```

### Phase 2: Simplify Root `CLAUDE.md` (30 min)
- Remove service-specific details
- Add pointers to local context
- Keep only global patterns

### Phase 3: Update Service `CONTEXT.md` Files (1 hour)
- Remove duplication with `.claude/README.md`
- Focus on technical reference (API docs, schema)
- Link to `.claude/README.md` for workflow

### Phase 4: Create App-Level Context (30 min)
- `apps/frontend/.claude/README.md`
- `apps/mobile/.claude/README.md`
- Focus on UI patterns, component structure

### Phase 5: Test and Validate (30 min)
- Navigate to a service directory
- Verify `.claude/README.md` is discoverable
- Make a test change following the checklist
- Verify errors are caught early

---

## Expected Outcomes

### Before (Current State)
- Agent works in `services/request-service/`
- Loads global `CLAUDE.md` (177 lines, generic)
- Makes changes without service knowledge
- Skips tests, skips file reading
- Fixes same bug 3 times

### After (With Local Context)
- Agent works in `services/request-service/`
- Loads `services/request-service/.claude/README.md`
- Sees: "IMPORTANT: Before making ANY changes..."
- Reads CONTEXT.md first
- Runs tests before/after
- Checks impact with `analyze:services`
- One-and-done fixes

---

## Context Hierarchy Rules

### 1. Local Context Wins
When in `services/auth-service/`:
- **Primary**: `.claude/README.md` (service workflow)
- **Reference**: `CONTEXT.md` (technical details)
- **System**: `../../CLAUDE.md` (global patterns)
- **Registry**: `../../services/registry.json` (dependencies)

### 2. Clear Escalation Path
Service context should say:
- "For database schema: see CONTEXT.md"
- "For service dependencies: see services/registry.json"
- "For deployment: see root CLAUDE.md"
- "For architecture decisions: see docs/adr/"

### 3. No Duplication
- `.claude/README.md`: **Workflow and checklists**
- `CONTEXT.md`: **Technical reference (API, schema)**
- `README.md`: **Human-readable overview (can be minimal)**

---

## Preventing Context Rot

### 1. Single Source of Truth per Topic
- **API endpoints**: service `CONTEXT.md`
- **Database schema**: service `CONTEXT.md` + `infrastructure/postgres/init.sql`
- **Service dependencies**: `services/registry.json`
- **Workflow checklists**: service `.claude/README.md`

### 2. Update, Don't Duplicate (Existing Discipline)
- Already in root `CLAUDE.md`
- Enforce with service context: "Before creating X, search for existing"

### 3. Context Validation
Add to `scripts/` directory:
```bash
# scripts/validate-context.sh
# Check that all services have .claude/README.md
# Check that CONTEXT.md exists
# Warn if files are out of sync
```

### 4. Pre-commit Hook Enhancement
Update `scripts/git-hooks/pre-commit`:
```bash
# If service changed, check that .claude/README.md exists
# If service changed, remind to update CONTEXT.md
```

---

## Metrics for Success

After implementing this system, we should see:

1. **Zero repeated bugs**: Same error not fixed multiple times
2. **100% test coverage before commit**: Tests always run
3. **Zero "forgot to read file" errors**: Files always read before edit
4. **Clear impact awareness**: Always know what breaks
5. **Faster onboarding**: New developers find context easily

---

## Next Steps

1. **Review this document** with team
2. **Approve approach** or suggest changes
3. **Generate `.claude/README.md`** for all services (can be scripted)
4. **Test with one service** (request-service - most complex)
5. **Roll out to all services**
6. **Update governance framework** to include context validation

---

## Open Questions

1. **Naming**: `.claude/README.md` or `.claude/INSTRUCTIONS.md`?
2. **Scope**: Should tests/ have its own `.claude/` folder?
3. **Automation**: Script to generate service `.claude/README.md` from template?
4. **Validation**: Add `npm run validate:context` command?
5. **Mobile/Frontend**: Same pattern or different approach?

---

**Status**: Proposal - Awaiting Approval
**Priority**: CRITICAL - Blocking efficient agent usage
**Effort**: ~4 hours to implement fully
**Impact**: 10x reduction in repeated errors
