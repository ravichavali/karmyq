# Karmyq - Mutual Aid Platform

**Version**: 9.1.0 | **Status**: Demo/Development

---

## 🚀 Starting a New Conversation?

**CHECK FOR HANDOFF FIRST!**

Before starting work, check if there's an active handoff document:

```bash
cat .claude/handoff/CURRENT_HANDOFF.md
```

**What is a handoff?**
- A detailed implementation plan left by the previous conversation
- Contains context, file paths, code patterns, and a ready-to-execute plan
- Enables seamless continuation of work across conversations

**If a handoff exists:**
1. Read the handoff document (you'll find everything you need)
2. Follow the "Quick Start" section to begin implementation
3. Update the handoff as you make progress
4. When feature is complete, archive or delete it

**If no handoff exists:**
- Proceed with normal development workflow (see below)

**Creating a handoff for the next conversation:**
- Ask: "Create a handoff document for the next conversation"
- Include: context, current state, implementation plan, success criteria
- Use template: `.claude/handoff/TEMPLATE.md`

See [`.claude/handoff/README.md`](.claude/handoff/README.md) for complete handoff framework documentation.

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

### 3. Git Hooks & TDD Framework (Automatic)
Git hooks automatically run checks on commit/push:
- **Pre-commit**: Service analysis & documentation checks
- **Pre-push**: Unit + regression tests (MUST pass), TDD tests (informational), integration tests (if DB available)

**IMPORTANT**: Unit + regression tests MUST pass before push. This is a core tenant of our TDD framework ([ADR-029](docs/adr/ADR-029-tdd-test-framework.md)).

```bash
npm run hooks:install  # Install/update hooks
git commit             # Hooks run automatically
git push               # Runs unit+regression (blocks if fails), TDD (reports only)
git push --no-verify   # Emergency only - skips all hooks
SKIP_PREPUSH=1 git push # Skip pre-push checks only
```

See [Testing section](#testing-tdd-framework) below for complete TDD workflow.

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

### 6. Documentation Updates (MANDATORY)

Every code change that modifies behavior MUST include documentation updates:

#### Service changes
- New/modified endpoint → Update service `CONTEXT.md` "API Endpoints" section
- New/modified endpoint → Update `services/registry.json` "apis.provides"
- Schema change → Update service `CONTEXT.md` "Database Schema" section
- Schema change → Create migration in `infrastructure/postgres/migrations/`
- New event → Update `services/registry.json` "events" section
- New dependency → Update `services/registry.json` "dependencies" section

#### Shared package changes
- New export → Update `packages/shared/CONTEXT.md`
- New matching type → Update type definitions in `matching/types.ts`
- New event type → Update `services/registry.json` "events" section

#### Concept/architecture changes (ADRs)
- New architectural decision → Create ADR in `docs/adr/` + update `docs/adr/README.md` index
- Modified system behavior → Update `docs/ARCHITECTURE.md` if applicable
- ADR implementation deployed → Update ADR status from `Accepted` → `Implemented`
- ADR status lifecycle: `Proposed` → `Accepted` → `Implemented` | `Superseded` | `Deprecated`
- New trust/matching/feed pattern → Create or update relevant ADR
- Significant cross-service change (3+ services) → Create ADR documenting the decision

#### After all changes
- Run `npm run analyze:services` if service dependencies changed
- Run `npm run feedback:check` to verify all documentation updates are included
- Docs site auto-regenerates on next deploy (pre-build step)

---

## Pre-Merge Checklist (MUST COMPLETE BEFORE `git push`)

Every feature branch or phase of work **must pass all items** before merging to master. This checklist exists because Phase 3 revealed a pattern: code is implemented but tests and docs are left as follow-ups that never happen.

### 1. Tests (Non-Negotiable)

- [ ] **Unit/TDD tests written** for every new or changed behavior:
  - New component rendering logic → test in `tests/tdd/`
  - New conditional UI (show/hide based on role, state) → test the condition
  - New API call wiring (previously stubbed with `setTimeout`) → test the call is made with correct args
  - New hook or utility function → test its return values
- [ ] All existing tests still pass: `npm test` (unit + regression)
- [ ] TDD tests pass: `npm run test:tdd`
- [ ] No tests silently skipped (`describe.skip`, `it.skip`) unless documented in a comment

**Minimum test coverage for UI changes:**
| Change Type | Required Tests |
|---|---|
| New component | Renders correctly, handles edge cases |
| Conditional render (role/state gate) | Shows for authorized, hidden for unauthorized |
| API call wired to user action | Mock verifies call made with correct payload |
| Data fetch on mount | Shows fetched data, falls back gracefully on error |

### 2. Documentation (Non-Negotiable)

- [ ] **Guide updated** if the feature has a user-facing guide in `docs/guides/`:
  - New workflow step → add to the relevant guide
  - New navigation path → document where to find it
  - New integration between two features → document the connection end-to-end
- [ ] **CONTEXT.md updated** for any changed service (endpoint, schema, events)
- [ ] **services/registry.json updated** for new endpoints or events
- [ ] **ADR created or updated** if this is an architectural decision
- [ ] `npm run feedback:check` passes

### 3. Landing Page Docs (Non-Negotiable)

The public docs site at `apps/landing/` has three doc types — keep all three in sync with every feature shipped.

#### What changed → What to update

| Change type | Update required |
|---|---|
| New user-facing feature or workflow | Add/update a **User Guide** in `apps/landing/src/data/docs/guides/` + nav.json "User Guides" |
| New platform concept or philosophy | Add/update a **Concept page** in `apps/landing/src/data/docs/concepts/` + nav.json "Concepts" |
| New ADR | Create ADR JSON in `apps/landing/src/data/docs/concepts/` + add to nav.json "Architecture Decisions" |
| New/changed service endpoints | Update `apps/landing/src/data/docs/services/{service-name}.json` |
| New service | Create service JSON + add to nav.json "Services" |

#### Checklist
- [ ] **New ADR** → `apps/landing/src/data/docs/concepts/adr-{NNN}-{slug}.json` with `slug`, `number`, `title`, `status`, `description`, `content`, `filename` fields
- [ ] **New ADR** → add entry to nav.json "Architecture Decisions" section
- [ ] **New user-facing feature** → add/update relevant User Guide in `apps/landing/src/data/docs/guides/{slug}.json`
- [ ] **New user-facing feature** → add entry to nav.json "User Guides" section if new page
- [ ] **New platform concept** → add concept page in `apps/landing/src/data/docs/concepts/{slug}.json`
- [ ] **New platform concept** → add entry to nav.json "Concepts" section
- [ ] **New/changed endpoints** → update `apps/landing/src/data/docs/services/{service-name}.json`
- [ ] **Nav integrity** → every JSON file in `concepts/` and `guides/` has a nav.json entry

**JSON format for ADR files:**
```json
{
  "slug": "adr-{NNN}-{slug}",
  "number": "{NNN}",
  "title": "ADR-{NNN}: Title",
  "status": "proposed | accepted | implemented | superseded | deprecated",
  "description": "**Status**: Implemented",
  "content": "# ADR-{NNN}: Title\n\n...(full markdown content)...",
  "filename": "ADR-{NNN}-{slug}.md"
}
```

**JSON format for Concept and User Guide files:**
```json
{
  "slug": "concept-or-guide-slug",
  "title": "Page Title",
  "description": "One-sentence summary shown in nav and previews.",
  "content": "# Title\n\n...(full markdown content)..."
}
```

**JSON format for service endpoint entries:**
```json
{
  "method": "GET | POST | PUT | DELETE",
  "path": "/path/:param",
  "description": "One-sentence description of what the endpoint does."
}
```

### 4. Handoff Updated

- [ ] If this completes a phase: mark the phase complete in `CURRENT_HANDOFF.md`
- [ ] If work continues next session: update handoff with current state and next steps
- [ ] Success criteria in handoff are checked off

### 5. Quick Verification

```bash
# Run this before every push
npm test                    # Must pass (unit + regression)
npm run test:tdd            # Must pass (or document known failures)
npm run feedback:check      # Must pass (docs complete)
npm run analyze:services    # If service dependencies changed
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
  communities: Array<{id: string, name: string, role: string}>  // ← field is 'communities', NOT 'communityMemberships'
}
```

Header: `Authorization: Bearer <token>`

**⚠️ Common mistake:** The JWT field is `communities`, not `communityMemberships`. Every new service's auth middleware MUST check `user.communities` to read membership roles. Using `communityMemberships` will always be `undefined` → always 403.

**Checking admin role in middleware:**
```typescript
const memberships = user.communities ?? [];
const isAdmin = user.role === 'admin' || memberships.some(m => m.role === 'admin');
```

**New service nginx routing checklist:**
- Add `location ~ ^/api/{your-prefix}(/.*)?$` block to `infrastructure/nginx/nginx.conf`
- The proxy_pass path must strip `/api` prefix: `proxy_pass http://your_service/{your-prefix}$1$is_args$args`
- Changes to nginx.conf take effect on next deploy (deploy.sh copies and reloads), or manually: `sudo cp infrastructure/nginx/nginx.conf /etc/nginx/sites-available/karmyq && sudo nginx -t && sudo systemctl reload nginx`

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

### Testing (TDD Framework)

**Core Tenant**: Unit + regression tests MUST ALWAYS pass. See [ADR-029](docs/adr/ADR-029-tdd-test-framework.md).

#### Test Directory Structure

Every service/app has three test tiers:
```
tests/
  ├── unit/         # Unit tests (mocked, fast, must pass)
  ├── regression/   # Locked-in behavior (must pass)
  ├── tdd/          # Work-in-progress (can fail)
  └── integration/  # Integration tests (require DB)
```

#### Test Commands

```bash
# Run unit + regression (MUST pass before push)
npm test

# Run individual tiers
npm run test:unit        # Unit tests only
npm run test:regression  # Regression tests only
npm run test:tdd         # TDD/WIP tests (can fail)

# Integration tests (requires database)
npm run test:integration

# E2E tests
cd tests && npm run test:e2e

# Coverage
npm run test:coverage

# Auto-promote passing TDD tests to regression
node scripts/promote-tdd-tests.js
```

#### TDD Workflow

**Writing new tests**:
1. Create test in `tests/tdd/` directory
2. Write test first (TDD approach)
3. Implement feature until test passes
4. Test auto-promotes to `regression/` (or move manually)
5. Now test MUST pass forever (locked in)

**Test states**:
- `tdd/` → Can fail, won't block commits/pushes
- `regression/` → Must pass, blocks push if fails
- `unit/` → Must pass, fast isolated tests

**Pre-push hook behavior**:
1. ✅ Runs unit + regression → **BLOCKS if fails**
2. ✅ Runs TDD tests → Reports but **NEVER blocks**
3. ✅ Runs integration tests → **BLOCKS if fails** (only if DB available)

See [ADR-029](docs/adr/ADR-029-tdd-test-framework.md) for complete framework details.

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

### Demo Environment (ARM64 / Oracle Cloud)

> **Note:** karmyq.com is a **demo/QA environment**, not production. Treat it accordingly.

**Option 1: Automatic Deployment (Recommended)**
```bash
# Simply push to master - GitHub Actions handles deployment
git push origin master
```

GitHub Actions automatically:
1. Runs tests + builds images
2. SSH to karmyq.com
3. Runs `./scripts/deploy.sh`
4. Verifies health
5. **Rolls back on any failure**

**Setup:** See [docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md)

**Option 2: Manual Deployment**
```bash
# SSH to demo server:
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy.sh

# Skip tests for emergency deploys
SKIP_TESTS=1 ./scripts/deploy.sh
```

**Deployment Script Automatically:**
1. Saves current commit for rollback
2. Pulls latest code from master
3. Installs git hooks
4. **Runs integration tests** (with auto-rollback on failure)
5. Loads `.env.demo`
6. Builds Docker images (ARM64)
7. Deploys via docker-compose
8. Verifies health

**Safety Features:**
- ✅ Integration tests run against demo DB before deployment
- ✅ Auto-rollback to previous commit if tests fail
- ✅ `SKIP_TESTS=1` flag for emergency deploys
- ✅ Hooks installed automatically on server
- ✅ GitHub Actions runs full test suite before deployment

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

## Bug Fixing

**MANDATORY steps before writing any fix:**

1. **Identify the layer** — is this a DB, API, or UI bug? Apply the fix at the correct layer. Never add client-side filters/workarounds for server-side problems.
2. **Find ALL instances** — use `Grep` to search the entire codebase for the pattern before touching anything. Assume the same bug exists in multiple files (services, frontend, mobile, simulation). Fix every occurrence.
3. **Trace end-to-end** — after the fix, mentally trace the full data flow: source config → build/template → runtime → client. State explicitly where the bug was and confirm no other path reintroduces it.
4. **Never edit generated files** — `/dist/`, `/build/`, `dependency-graph.md`, `impact-analysis.md` are build artifacts. Find the source and edit that instead. (A hook will block you if you try.)
5. **Wait for actual output** — if the user says they're about to paste error output, stop and wait. Do not guess from symptoms.

---

## Pre-Commit Checks

- After making changes, always verify the fix works end-to-end before committing.
- For TypeScript projects, run `tsc --noEmit` before pushing. CI failures from type errors are avoidable.
- For generated/build-time files, never hand-edit them — fix the source template instead.

---

## Project Architecture

This is a TypeScript monorepo with multiple services. When fixing a value (API URLs, config, types), grep across **all** services to find every occurrence before making changes. Primary languages: TypeScript, with Shell scripts for CI/CD and deployment. When fixing CI issues, check Alpine Linux compatibility, correct package names/versions, and environment variable loading order.

---

## Session Workflow

Update handoff documents (`CURRENT_HANDOFF.md`) at the end of every session with current status, blockers, and next steps. Follow the established handoff framework in `.claude/handoff/`.

---

**Remember**: This is global context. For specific areas, **read the local `.claude/README.md` first!**
