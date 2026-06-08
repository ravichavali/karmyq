# Architecture Reset Analysis

**Date**: 2026-01-14
**Purpose**: Ruthless assessment of what to keep, simplify, or eliminate
**Context**: Last 2 weeks were spent in infrastructure circles, not product development

---

## Current State Inventory

### Services (12 total)
| Service | Port | Lines of Code | Necessary? | Notes |
|---------|------|---------------|------------|-------|
| auth-service | 3001 | ~500 | **YES** | Core - authentication |
| community-service | 3002 | ~400 | **YES** | Core - multi-tenancy |
| request-service | 3003 | ~600 | **YES** | Core - help requests |
| reputation-service | 3004 | ~300 | **YES** | Core - karma system |
| notification-service | 3005 | ~300 | MAYBE | Could be Bull queue + simple handler |
| messaging-service | 3006 | ~400 | **YES** | Core - communication |
| feed view layer | request-service | ~500 | DONE | Folded into request-service in Sprint 91 |
| cleanup-service | 3008 | ~200 | MAYBE | Could be a cron job |
| geocoding-service | 3009 | ~300 | MAYBE | Could be frontend-only |
| social-graph-service | 3010 | ~400 | **YES** | Core - trust paths |
| simulation-service | - | ~200 | NO | Dev tooling only |
| matching-service | - | ~100 | NO | Unused/deprecated |

### Infrastructure (from docker-compose.yml)
- PostgreSQL 15 (required)
- Redis 7 (required for queues/caching)
- Redis Commander (dev only)
- Docker Registry (self-hosted - causing ARM/AMD issues)
- Loki/Promtail/Grafana (observability - nice to have)
- Prometheus (metrics - nice to have)

### Documentation (100+ markdown files)
- 27 ADRs
- Extensive operations docs
- Multiple roadmaps (some outdated)
- Session summaries, archives

---

## Root Cause Analysis: Why Last 2 Weeks Were Circles

### Problem 1: Architecture/Environment Mismatch
- **Local dev**: Windows/WSL (AMD64)
- **Production**: Oracle Cloud ARM64 server
- **Docker images**: Built on AMD64, fail on ARM64
- **Time wasted**: 3-4 sessions

### Problem 2: Frontend Dockerfile Builds Entire Monorepo
```dockerfile
# apps/frontend/Dockerfile line 49
RUN npm run build  # This runs Turborepo which builds ALL packages
```
When frontend builds, it tries to compile:
- cleanup-service (fails: tsc not found)
- All other services
- Mobile app

**This is fundamentally broken**. Frontend should only build frontend.

### Problem 3: Dependency Management Chaos
- `package-lock.json` in `.gitignore` (why??)
- `npm ci` fails because no lockfile
- Workaround: `npm install --legacy-peer-deps`
- Turborepo v2 breaking change (`pipeline` -> `tasks`)

### Problem 4: No CI/CD Pipeline
- Every deployment is manual
- Every deployment discovers new issues
- No automated testing before deploy

### Problem 5: Too Many Moving Parts
- 12 services with 12 Dockerfiles
- Each service has its own dependency tree
- Monorepo adds Turborepo complexity layer

---

## What's Actually Working Well

1. **Database schema**: Clean, well-designed with RLS
2. **API design**: Consistent patterns, good error handling
3. **Core business logic**: Request matching, karma, trust paths
4. **Testing infrastructure**: Integration tests exist and pass (when DB is up)
5. **Mobile app foundation**: React Native/Expo setup is solid

---

## Proposed Simplifications

### Level 1: Immediate Fixes (Today)

1. **Fix Frontend Dockerfile** - Build ONLY frontend, not entire monorepo
2. **Remove `package-lock.json` from `.gitignore`** - Commit lockfiles
3. **Verify turbo.json fix** - Already done (pipeline -> tasks)

### Level 2: Service Consolidation (This Week)

**Keep as separate services (6)**:
- auth-service
- community-service
- request-service
- reputation-service
- messaging-service
- social-graph-service

**Merge into existing services**:
- Feed view layer -> merged into `request-service` in Sprint 91
- `notification-service` -> merge into event handlers in relevant services
- `cleanup-service` -> PostgreSQL scheduled jobs or single cron container
- `geocoding-service` -> frontend-only with browser Geolocation API

**Delete entirely**:
- `simulation-service` (dev tool, not needed in prod)
- `matching-service` (deprecated)
- `_template` service folder

### Level 3: Infrastructure Simplification (This Week)

1. **Build images ON production server** (ARM64 native) - Already working
2. **Or: Use multi-stage builds with explicit platform**
3. **Remove observability stack from dev** - Not needed for development
4. **Keep observability only on production**

### Level 4: Process Changes (Ongoing)

1. **Add CI/CD via GitHub Actions**:
   - Run tests on PR
   - Build images on merge to main
   - Deploy to staging automatically

2. **Consolidate documentation**:
   - Archive everything in `docs/archive/`
   - Keep only: CLAUDE.md, README.md, 5 essential docs
   - Single source of truth

3. **Mobile-first development**:
   - Mobile app untouched for weeks
   - Next sprint: feature parity with web

---

## Recommended Tech Stack (Simplified)

### Backend
- **Runtime**: Node.js 18 (keep)
- **Framework**: Express (keep)
- **Database**: PostgreSQL 15 (keep)
- **Cache/Queue**: Redis (keep)
- **Build**: Turborepo (keep, but fix configs)

### Frontend
- **Web**: Next.js 14 (keep)
- **Mobile**: React Native + Expo (keep)
- **Shared**: Create `@karmyq/ui` package for shared components

### Infrastructure
- **Dev**: docker-compose with postgres + redis only
- **Prod**: Same server, but with pre-built images
- **CI/CD**: GitHub Actions

### Deployment Strategy
**Option A: Build on Production (Current path)**
- SSH to server, pull code, build natively
- Simple, works with ARM64
- Downside: Builds are slow, server does double duty

**Option B: Cross-compile with Docker Buildx**
- Build multi-arch images locally
- Push to registry
- Pull and run on production
- More complex, but cleaner separation

**Recommendation**: Option A for now, migrate to B later with proper CI/CD

---

## Immediate Action Plan

### Today (2-3 hours)

1. [ ] Fix frontend Dockerfile to NOT build entire monorepo
2. [ ] Commit package-lock.json files
3. [ ] Successfully deploy to production
4. [ ] Verify karmyq.com works

### This Week

1. [x] Merge feed-service into request-service
2. [ ] Convert cleanup-service to PostgreSQL cron
3. [ ] Delete simulation-service, matching-service
4. [ ] Archive 80% of documentation
5. [ ] Set up basic GitHub Actions (test on PR)

### Next Week

1. [ ] Mobile app feature parity sprint
2. [ ] Consolidate notification handling
3. [ ] Remove geocoding-service (use browser API)

---

## Questions for Decision

1. **Keep self-hosted registry?**
   - Pro: Free, unlimited storage
   - Con: Added complexity, ARM/AMD issues
   - Alternative: Just build on production (no registry needed)

2. **Keep observability stack?**
   - Pro: Good for debugging production
   - Con: Resource overhead, complexity
   - Alternative: Simple file logging + tail

3. **Keep monorepo structure?**
   - Pro: Shared packages, coordinated deploys
   - Con: Turborepo complexity, build interdependencies
   - Keep for now, but fix the build isolation

---

---

## New Development Disciplines

### Discipline 1: Update, Don't Create
Before creating ANY new file:
1. Search for existing file on same topic
2. If exists: UPDATE it with date stamp
3. If doesn't exist: Check if it belongs in existing file
4. Only create new file if truly novel topic

### Discipline 2: One Source of Truth
- Each concept has ONE authoritative document
- Other documents LINK to it, don't duplicate
- When in doubt, add to existing doc

### Discipline 3: Archive, Don't Delete
- Move outdated docs to `/docs/archive/`
- Move outdated scripts to `/scripts/archive/`
- Keeps history without cluttering active files

### Discipline 4: Test Before Commit
- Run `test-local.sh` before every commit
- Run `test-all.sh` before pushing to main
- No exceptions

### Discipline 5: Fix Forward, Not Around
When encountering a problem:
- BAD: Create workaround script (seed-production-v3.sh)
- GOOD: Fix the root cause in the original
- GOOD: Document why in ADR if architectural

### Discipline 6: Mobile Parity
- Every web feature should have mobile equivalent
- Mobile app gets weekly attention minimum
- Track mobile features in same backlog as web

### Discipline 7: Minimal Infrastructure
Development should work with:
- PostgreSQL
- Redis
- That's it

No observability stack needed for dev. No registry needed for dev.

---

## Success Criteria

We will know we've succeeded when:

1. `docker-compose up` starts all services in < 2 minutes
2. Deployment to production is a single command that works first try
3. Adding a new feature doesn't require infrastructure changes
4. Mobile app is receiving regular updates
5. Documentation fits in 10 files or less

---

---

## Documentation Audit (177 files -> Target: 15 files)

### The Problem
- **177 markdown files** in `/docs`
- Creates vs Updates culture: Every session creates new docs instead of updating existing
- Contradictory information across files
- AI assistants can't find authoritative source

### Documentation Structure (NEW)

```
docs/
  README.md                    # Quick start, links to other docs
  ARCHITECTURE.md              # Single source of truth for architecture
  DEPLOYMENT.md                # How to deploy (local + production)
  TESTING.md                   # How to run tests
  API.md                       # API documentation
  CONTRIBUTING.md              # How to contribute

  adr/                         # Architecture Decision Records (KEEP)
    README.md                  # ADR index
    ADR-001.md through ADR-027.md

  archive/                     # Everything else moves here
    (all other files)
```

### Files to KEEP at Root Level
| File | Purpose | Action |
|------|---------|--------|
| CLAUDE.md | AI assistant instructions | UPDATE (simplify) |
| README.md | Project overview | KEEP |
| docs/ARCHITECTURE.md | System architecture | CONSOLIDATE into single file |
| docs/DEPLOYMENT.md | Deployment guide | CONSOLIDATE |
| docs/TESTING.md | Testing guide | CONSOLIDATE |
| docs/API.md | API reference | CREATE (auto-generate) |

### Files to ARCHIVE (Move to docs/archive/)
- All session summaries
- All planning docs (V5.x, V6.x, V7.x)
- All one-off fix documentation
- Gemini architecture review
- Old roadmaps

### The Rule Going Forward
**UPDATE, DON'T CREATE**
- Before creating a new doc, search for existing doc on topic
- Update existing doc with new information
- Add date stamp to updates
- Archive instead of delete (for history)

---

## Scripts Audit (60+ scripts -> Target: 15 scripts)

### The Problem
- **60+ scripts** in `/scripts`
- Duplicate functionality (seed-test-data.sh, seed-production-data.sh, seed-production-local.sh, etc.)
- Platform fragmentation (.sh, .bat, .ps1 for same thing)
- Dead scripts that no longer work

### Scripts to KEEP (Essential)
| Script | Purpose | Notes |
|--------|---------|-------|
| test-all.sh | Run all tests | Keep |
| test-local.sh | Quick local tests | Keep |
| deploy-images.sh | Deploy from registry | Keep |
| build-images.sh | Build Docker images | Keep |
| push-images.sh | Push to registry | Keep |
| seed-test-data.sh | Seed test data | CONSOLIDATE all seeding |
| truncate-database.sh | Reset database | Keep |
| setup-git-hooks.sh | Install hooks | Keep |

### Scripts to DELETE/ARCHIVE
| Script | Reason |
|--------|--------|
| check-*.sh (6 scripts) | One-off debugging, not needed |
| seed-production-*.sh (5 scripts) | Consolidate into one |
| capture-claude-*.ps1 | Move to separate repo |
| create-github-*.sh | One-time use, done |
| secrets-*.sh | Not implemented, dead code |
| generate-*.js | Dev tools, move to dev/ |
| standardize-responses.js | One-time migration, done |

### Scripts Structure (NEW)
```
scripts/
  README.md              # What each script does

  # Development
  test-all.sh           # Run all tests
  test-local.sh         # Quick tests
  seed-data.sh          # Seed database (consolidate all seeding)
  truncate-db.sh        # Reset database

  # Deployment
  deploy.sh             # Deploy to production (consolidate)
  build-images.sh       # Build Docker images

  # Setup (run once)
  setup/
    setup-git-hooks.sh
    init-database.sh

  # Archive (historical)
  archive/
    (move everything else here)
```

### The Rule Going Forward
**ONE SCRIPT PER TASK**
- Don't create seed-production-v2.sh, update seed-data.sh
- Add flags for variants: `seed-data.sh --production --remote`
- Pick one platform (prefer .sh, use in Git Bash on Windows)
- Delete .bat/.ps1 duplicates

---

## Appendix: Services to Keep vs Remove

### KEEP (6 services)
```
services/
  auth-service/       # Authentication, JWT
  community-service/  # Multi-tenant communities
  request-service/    # Help requests + feed
  reputation-service/ # Karma, badges
  messaging-service/  # Direct messages
  social-graph-service/ # Trust paths, invitations
```

### REMOVE/MERGE (6 services)
```
services/
  request-service/    # Owns /requests/feed after Sprint 91
  notification-service/ # MERGE into event handlers
  cleanup-service/    # REPLACE with pg_cron
  geocoding-service/  # REMOVE (use browser API)
  simulation-service/ # DELETE (dev tooling)
  matching-service/   # DELETE (deprecated)
  _template/          # DELETE
```

### INFRASTRUCTURE SIMPLIFY
```yaml
# Minimal dev docker-compose.yml
services:
  postgres:     # Keep
  redis:        # Keep
  # Remove: redis-commander, registry, loki, promtail, grafana, prometheus
```
