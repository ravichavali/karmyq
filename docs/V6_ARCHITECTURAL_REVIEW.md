# Karmyq v6.0 Architectural Review

**Date**: 2025-12-05
**Purpose**: Pre-release architectural review, simplification, and documentation sync
**Target**: v6.0 release with clean, maintainable codebase

---

## Executive Summary

### Current State (v5.1.0)
- ✅ 8 microservices with multi-tenant architecture
- ✅ Row-Level Security (RLS) for data isolation
- ✅ Event-driven architecture (Redis/Bull)
- ✅ Comprehensive test suite
- ✅ Observability stack (Grafana/Loki/Prometheus)
- ✅ Mobile app (React Native + Expo)
- ⚠️ Documentation sprawl (53 files)
- ⚠️ Inconsistent service documentation
- ⚠️ Some duplicate code patterns
- ⚠️ Missing unified service template

### Goals for v6.0
1. **Simplify documentation** - Consolidate and organize 53 docs
2. **Standardize service structure** - Unified CONTEXT.md format
3. **Improve service isolation** - Each service self-contained with complete context
4. **Remove technical debt** - Identify and eliminate duplicate code
5. **Update root documentation** - Sync CLAUDE.md, README.md with current state
6. **Create migration guide** - Help developers upgrade from v5.x

---

## Documentation Audit

### Current Documentation (53 files)

#### Core Documentation (Keep & Update)
```
✅ docs/README.md (main index)
✅ docs/PROJECT_STATUS.md
✅ docs/GETTING_STARTED.md
✅ docs/MULTI_TENANT_GUIDE.md
✅ docs/PHASE3_EPHEMERAL_DATA_DECAY.md
✅ docs/DOCKER_SETUP.md
✅ docs/ENVIRONMENT_VARIABLES.md
```

#### Architecture Docs (Consolidate)
```
⚠️ docs/architecture/overview.md
⚠️ docs/architecture/review.md
⚠️ docs/architecture/proposed-structure.md
→ Action: Merge into single docs/architecture/ARCHITECTURE.md
```

#### Development Guides (Keep)
```
✅ docs/development/creating-a-service.md
✅ docs/development/implementing-logging.md
✅ docs/development/testing-guide.md
✅ docs/development/workflow.md
✅ docs/development/turborepo.md
```

#### Operations Guides (Keep)
```
✅ docs/operations/logging-and-monitoring.md
✅ docs/operations/log-levels.md
✅ docs/operations/ci-cd.md
```

#### Requirements Management (New in v5.1.0)
```
✅ docs/requirements/functional/FR-001 through FR-010
✅ docs/requirements/technical/TR-001 through TR-005
✅ docs/REQUIREMENTS_INDEX.md
✅ docs/GETTING_STARTED_WITH_REQUIREMENTS.md
✅ docs/GITHUB_PROJECT_SETUP.md
✅ docs/INITIAL_BACKLOG_ISSUES.md
```

#### Session Summaries (Archive)
```
❌ docs/SESSION_SUMMARY_V5.2.md
❌ docs/SESSION_SUMMARY_V5.3.md
❌ docs/SESSION_SUMMARY_V5_4.md
→ Action: Move to docs/archive/session-summaries/
```

#### Version-Specific Fixes (Archive)
```
❌ docs/FIXES_V5.3.1.md
❌ docs/TEST_FIXES_DETAILED.md
❌ docs/TEST_RESULTS_BASELINE.md
❌ docs/TESTING_CHECKLIST_V5.3.md
→ Action: Move to docs/archive/releases/
```

#### Feature Planning Docs (Archive or Move to Requirements)
```
❌ docs/DASHBOARD_REDESIGN_V5.3.md
❌ docs/INLINE_MESSAGING_PLAN.md
❌ docs/MOBILE_APP_FINAL_STEPS.md
❌ docs/MOBILE_APP_PORT_V5_4.md
❌ docs/MOBILE_APP_PROGRESS_V5_4.md
❌ docs/REFACTOR_REQUEST_ARCHITECTURE_V5.4.md
→ Action: Move to docs/archive/planning/ or convert to GitHub issues
```

#### Specialized Guides (Keep)
```
✅ docs/CROSS_PLATFORM_GUIDE.md
✅ docs/MOBILE_DEVELOPMENT.md
✅ docs/SELF_HOSTING_GUIDE.md
✅ docs/TESTING_STRATEGY.md
✅ docs/secrets-management.md
✅ docs/qa-deployment-guide.md
```

### Proposed Documentation Structure (v6.0)

```
docs/
├── README.md                          # Main index
├── GETTING_STARTED.md                 # Quick start
├── PROJECT_STATUS.md                  # Current state & roadmap
├── V6_ARCHITECTURAL_REVIEW.md         # This document
├── V6_MIGRATION_GUIDE.md              # Upgrade from v5.x
│
├── guides/                            # User guides
│   ├── MULTI_TENANT_GUIDE.md
│   ├── EPHEMERAL_DATA_GUIDE.md        # Renamed from PHASE3...
│   ├── DOCKER_SETUP.md
│   ├── MOBILE_DEVELOPMENT.md
│   ├── CROSS_PLATFORM_GUIDE.md
│   ├── SELF_HOSTING_GUIDE.md
│   └── ENVIRONMENT_VARIABLES.md
│
├── architecture/                      # Architecture docs
│   ├── ARCHITECTURE.md                # Consolidated overview
│   ├── SERVICE_DEPENDENCIES.md        # Service dependency graph
│   └── DATA_MODEL.md                  # Database schema overview
│
├── development/                       # Development guides
│   ├── creating-a-service.md
│   ├── implementing-logging.md
│   ├── testing-guide.md
│   ├── workflow.md
│   └── turborepo.md
│
├── operations/                        # Operations guides
│   ├── logging-and-monitoring.md
│   ├── log-levels.md
│   ├── ci-cd.md
│   └── qa-deployment-guide.md
│
├── requirements/                      # Requirements management
│   ├── REQUIREMENTS_INDEX.md
│   ├── GETTING_STARTED_WITH_REQUIREMENTS.md
│   ├── GITHUB_PROJECT_SETUP.md
│   ├── INITIAL_BACKLOG_ISSUES.md
│   ├── functional/
│   │   └── FR-001 through FR-010
│   └── technical/
│       └── TR-001 through TR-005
│
└── archive/                           # Historical docs
    ├── README.md
    ├── federation/                    # Federation protocol (archived)
    ├── releases/                      # Version-specific fix docs
    ├── planning/                      # Historical planning docs
    └── session-summaries/             # Development session notes
```

---

## Service Architecture Audit

### Current Services (8)

| Service | Port | Schema | CONTEXT.md | README.md | Status |
|---------|------|--------|------------|-----------|--------|
| auth-service | 3001 | auth | ✅ Excellent | ✅ Good | Production-ready |
| community-service | 3002 | community | ✅ Good | ✅ Good | Production-ready |
| request-service | 3003 | requests | ✅ Good | ✅ Good | Production-ready |
| reputation-service | 3004 | reputation | ✅ Good | ✅ Good | Production-ready |
| notification-service | 3005 | notifications | ✅ Good | ✅ Good | Production-ready |
| messaging-service | 3006 | messaging | ✅ Good | ✅ Good | Production-ready |
| feed-service | 3007 | - (reads all) | ✅ Good | ✅ Good | Production-ready |
| cleanup-service | 3008 | - (writes all) | ✅ Good | ❌ Missing | Production-ready |
| matching-service | - | - | ❌ Missing | ✅ Basic | Deprecated/Unused |

### Service Documentation Issues

#### 1. Matching Service Status Unclear
- Has README.md but minimal content
- No CONTEXT.md file
- Not in docker-compose.yml
- **Action**: Clarify if deprecated or archive it

#### 2. Cleanup Service Missing README
- Has excellent CONTEXT.md
- Missing README.md
- **Action**: Create README.md from CONTEXT.md

#### 3. Inconsistent CONTEXT.md Format
- Auth service has most comprehensive format
- Other services have varying levels of detail
- **Action**: Standardize all CONTEXT.md files

### Standard CONTEXT.md Template (Based on auth-service)

Every service CONTEXT.md should include:

```markdown
# {Service Name} Context

> **Quick Start**: `cd services/{service-name} && npm run dev`
> **Port**: {port} | **Health**: http://localhost:{port}/health

## Purpose
Brief 1-2 sentence description.

## Database Schema
### Tables Owned by This Service
- Full CREATE TABLE statements
- Indexes
- RLS policies

### Tables Read by This Service
- List of tables from other schemas

## API Endpoints
For each endpoint:
- Method and path
- Request example (JSON)
- Response example (JSON)
- Implementation file reference (e.g., src/routes/foo.ts:42)

## Dependencies
### Calls (Outbound)
- Services this service calls

### Called By (Inbound)
- Services that call this service

### Events Published
- Event types and payloads

### Events Consumed
- Event types and handlers

### External Dependencies
- PostgreSQL, Redis, etc.

## Environment Variables
Complete list with descriptions and defaults

## Key Files
- Entry point
- Routes
- Services/Business logic
- Middleware
- Database

## Common Development Tasks
Step-by-step guides for common modifications:
- Add new endpoint
- Add new field
- Change business logic
- etc.

## Security Considerations
- Authentication requirements
- Authorization patterns
- Input validation
- Rate limiting

## Debugging Common Issues
- Common error messages and solutions
- Connection issues
- Data issues
- etc.

## Testing
- Manual testing examples (curl)
- Unit test structure
- Integration test references

## Performance Considerations
- Query optimization
- Caching strategy
- Resource limits

## Future Enhancements (TODO)
- Planned features
- Known limitations
- Technical debt items

## Related Documentation
- Links to other relevant docs
```

---

## Code Organization Audit

### Shared Packages

#### packages/shared/
```
packages/shared/
├── api/
│   ├── client.ts              # API client for frontend
│   ├── mobile-storage.ts      # Mobile async storage
│   └── web-storage.ts         # Web localStorage
├── constants/
│   └── config.ts              # Shared constants
├── middleware/
│   ├── auth.ts                # JWT auth middleware
│   ├── dbContext.ts           # RLS session variable
│   ├── rateLimit.ts           # Rate limiting
│   ├── tenant.ts              # Community context extraction
│   ├── validate.ts            # Input validation
│   └── index.ts               # Middleware exports
├── types/
│   └── index.ts               # Shared TypeScript types
├── utils/
│   └── logger.ts              # Winston logger
├── index.ts                   # Main exports
└── package.json
```

**Status**: ✅ Well organized

### Duplicate Code Patterns

Need to audit each service for:

1. **Database connection boilerplate**
   - Each service has similar `src/database/db.ts`
   - **Consider**: Shared database connection module

2. **Express setup boilerplate**
   - Each service has similar `src/index.ts`
   - Middleware registration patterns
   - **Consider**: Service bootstrap utility

3. **Event publishing/consuming code**
   - Similar Bull queue setup across services
   - **Consider**: Shared event bus module

4. **Error handling patterns**
   - Each service has error middleware
   - **Consider**: Shared error handler

### Middleware Chain Consistency

All services should use consistent middleware order:

```typescript
// Standard middleware chain for authenticated endpoints
app.use(cors(corsOptions));
app.use(express.json());
app.use(rateLimiters.standard);
app.use(authMiddleware);                  // JWT verification
app.use(tenantMiddleware);                 // Extract community context
app.use(dbContextMiddleware(pool));        // Set RLS session variable
app.use(routes);
app.use(errorMiddleware);
```

**Action**: Audit all services for consistency

---

## API Standardization

### Current Response Formats

Most services use:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

But some inconsistencies exist:
- Auth service returns `{ user, token }` directly on register/login
- Some services return arrays directly
- Error formats vary

### Proposed Standard Response Format (v6.0)

#### Success Response
```json
{
  "success": true,
  "data": { ... } | [ ... ],
  "meta": {
    "timestamp": "2025-12-05T12:00:00Z",
    "requestId": "uuid"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2025-12-05T12:00:00Z",
    "requestId": "uuid"
  }
}
```

#### List Response (with pagination)
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "meta": {
    "timestamp": "2025-12-05T12:00:00Z",
    "requestId": "uuid"
  }
}
```

**Action**: Create shared response wrapper utilities

---

## Database Schema Review

### Current Schemas (7)

1. **auth** - Users, sessions
2. **community** - Communities, memberships, norms, join requests
3. **requests** - Help requests, offers, matches, request_communities (junction)
4. **reputation** - Karma records, trust scores, badges
5. **notifications** - Notifications, preferences, global_preferences
6. **messaging** - Conversations, messages, participants
7. **feed** - User activity feed

### RLS Implementation Status

| Schema | RLS Enabled | Policy Complexity | Status |
|--------|-------------|-------------------|--------|
| auth | ✅ | Simple | Working |
| community | ✅ | Medium (membership-based) | Working |
| requests | ✅ | Complex (junction table) | Working |
| reputation | ✅ | Medium | Working |
| notifications | ✅ | Simple | Working |
| messaging | ✅ | Complex (participants) | Working |
| feed | ✅ | Simple | Working |

**Action**: Document RLS policies in architecture/DATA_MODEL.md

---

## Testing Infrastructure

### Current Tests

#### Integration Tests (tests/)
- ✅ Multi-tenant isolation tests
- ✅ RLS policy tests
- ✅ Cross-service flow tests
- ✅ Auth flow tests

#### E2E Tests (tests/e2e/)
- ✅ Playwright tests for web app
- ✅ User journey tests

#### Load Tests (tests/load/)
- ✅ K6 performance tests

**Status**: ✅ Comprehensive test coverage

---

## Identified Issues & Action Items

### Critical (Must Fix for v6.0)

1. **Clarify matching-service status**
   - Either fully implement or remove from codebase
   - Update architecture docs

2. **Create cleanup-service README.md**
   - Extract from CONTEXT.md
   - Maintain consistency

3. **Standardize all CONTEXT.md files**
   - Use auth-service as template
   - Ensure completeness for each service

4. **Consolidate architecture docs**
   - Merge 3 architecture files into one
   - Create clear service dependency diagram

### Important (Should Fix for v6.0)

5. **Archive historical documentation**
   - Move session summaries to archive/
   - Move version-specific fix docs to archive/
   - Move planning docs to archive/

6. **Rename PHASE3_EPHEMERAL_DATA_DECAY.md**
   - New name: EPHEMERAL_DATA_GUIDE.md
   - Remove "Phase 3" reference (phases are internal)

7. **Create v6.0 migration guide**
   - Breaking changes (if any)
   - New features
   - Upgrade steps

8. **Update root CLAUDE.md**
   - Bump version to v6.0
   - Update service list
   - Add new patterns/conventions

### Nice to Have (Consider for v6.0)

9. **Create shared response wrapper utilities**
   - Standardize API responses
   - Add request ID tracking
   - Consistent error formats

10. **Extract common service patterns**
    - Database connection utility
    - Event bus wrapper
    - Service bootstrap helper

11. **Create architecture diagram**
    - Service dependencies
    - Data flow
    - Event flow

12. **Database schema diagram**
    - Tables and relationships
    - RLS policies visualization

---

## Service Isolation Strategy

### Goal
Each service should be independently understandable without reading entire codebase.

### Requirements for Each Service

1. **Complete CONTEXT.md**
   - Everything a developer needs to work on the service
   - No external documentation dependencies

2. **Self-contained testing**
   - Unit tests in service directory
   - Integration tests reference in CONTEXT.md

3. **Clear boundaries**
   - What data this service owns
   - What APIs it exposes
   - What events it publishes/consumes

4. **Minimal coupling**
   - Services communicate only via REST or events
   - No direct database access to other schemas (except feed/cleanup)

### Special Services

#### Feed Service
- **Purpose**: Read-only aggregation across all schemas
- **Pattern**: No writes, joins across schemas for personalized feed
- **Documentation**: Clearly state "read-only, cross-schema access"

#### Cleanup Service
- **Purpose**: Data lifecycle management across all schemas
- **Pattern**: Writes to all schemas for expiration and decay
- **Documentation**: Clearly state "write-access to all schemas for cleanup"

---

## Monorepo Structure Review

### Current Structure
```
karmyq/
├── apps/
│   ├── frontend/         # Next.js web app
│   └── mobile/           # React Native + Expo
├── services/
│   ├── _template/        # Service template
│   ├── auth-service/
│   ├── community-service/
│   ├── request-service/
│   ├── reputation-service/
│   ├── notification-service/
│   ├── messaging-service/
│   ├── feed-service/
│   ├── cleanup-service/
│   └── matching-service/  # Status unclear
├── packages/
│   └── shared/           # Shared utilities
├── infrastructure/
│   ├── docker/           # Docker Compose
│   └── postgres/         # Database init scripts
├── tests/                # Integration & E2E tests
├── docs/                 # Documentation
└── scripts/              # Automation scripts
```

**Status**: ✅ Well organized, clear separation of concerns

---

## Performance Considerations

### Current Optimizations
- ✅ Database connection pooling
- ✅ Redis caching for event queue
- ✅ Rate limiting on all endpoints
- ✅ Query optimization (indexes on frequent lookups)
- ✅ RLS for security (with performance impact accepted)

### Areas for Improvement
- ⚠️ No application-level caching (consider Redis for frequent queries)
- ⚠️ No CDN for frontend assets
- ⚠️ No database read replicas
- ⚠️ No service-level caching of user/community lookups

**Action**: Document performance patterns in architecture docs

---

## Security Review

### Current Security Measures
- ✅ JWT authentication on all services
- ✅ Password hashing (bcrypt)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Row-Level Security (RLS)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Environment variable for secrets

### Security Gaps
- ⚠️ No refresh tokens (JWT expires but no rotation)
- ⚠️ No email verification flow
- ⚠️ No password reset flow
- ⚠️ No 2FA/MFA support
- ⚠️ No rate limiting on sensitive operations (only global)
- ⚠️ SSE endpoint has no authentication (userId in URL only)

**Action**: Document security architecture and future enhancements

---

## Deployment & DevOps

### Current Setup
- ✅ Docker Compose for local development
- ✅ Grafana/Loki/Prometheus observability stack
- ✅ Structured logging (Winston)
- ✅ Health check endpoints on all services
- ✅ GitHub Actions CI/CD (basic)

### Production Readiness Checklist
- [ ] Kubernetes deployment manifests
- [ ] Database migrations strategy
- [ ] Backup and restore procedures
- [ ] Disaster recovery plan
- [ ] Monitoring alerts and thresholds
- [ ] Production secrets management (not .env files)
- [ ] SSL/TLS certificates
- [ ] Domain configuration
- [ ] Database connection pooling tuning
- [ ] Load balancer configuration

**Action**: Create production deployment guide

---

## Recommendations for v6.0

### Must Have (Blocking v6.0 Release)

1. ✅ Archive historical documentation
2. ✅ Consolidate architecture docs
3. ✅ Standardize all service CONTEXT.md files
4. ✅ Create cleanup-service README.md
5. ✅ Clarify matching-service status
6. ✅ Update root CLAUDE.md to v6.0
7. ✅ Create v6.0 migration guide
8. ✅ Create service dependency diagram

### Should Have (Highly Recommended)

9. ✅ Standardize API response formats
10. ✅ Create shared response utilities
11. ✅ Document RLS policies comprehensively
12. ✅ Create database schema diagram

### Nice to Have (Can Defer to v6.1)

13. ⭕ Extract common service patterns (database, events, bootstrap)
14. ⭕ Add application-level caching strategy
15. ⭕ Implement refresh tokens
16. ⭕ Add email verification and password reset
17. ⭕ Create Kubernetes deployment manifests

---

## Timeline Estimate

### Phase 1: Documentation (2-3 hours)
- Archive historical docs
- Consolidate architecture docs
- Standardize service CONTEXT.md files
- Update root documentation

### Phase 2: Code Standardization (1-2 hours)
- Create shared response utilities
- Audit API response formats
- Update services to use standard format

### Phase 3: Diagrams & Visuals (1 hour)
- Service dependency diagram
- Database schema diagram
- Architecture flow diagrams

### Phase 4: Testing & Validation (1 hour)
- Run full test suite
- Verify all services start correctly
- Test integration between services
- Validate documentation accuracy

### Phase 5: Release (30 minutes)
- Create v6.0 migration guide
- Update version numbers
- Tag release
- Create GitHub release notes

**Total Estimate**: 5-7 hours

---

## Next Steps

1. **Review this document** - Confirm priorities and scope
2. **Execute Phase 1** - Documentation cleanup and standardization
3. **Execute Phase 2** - Code standardization
4. **Execute Phase 3** - Create diagrams
5. **Execute Phase 4** - Testing
6. **Execute Phase 5** - Release v6.0

---

## Questions for Review

1. **Matching Service**: Should we remove it entirely or fully implement it?
2. **API Format**: Should we implement the proposed standard response format in v6.0 or defer to v6.1?
3. **Shared Patterns**: Should we extract common patterns (database, events) now or later?
4. **Production Deployment**: Should v6.0 include production deployment guides?
5. **Breaking Changes**: Are we okay with any breaking changes to API responses?

---

**Status**: ✅ Review complete, ready for implementation
**Next**: Await approval and proceed with Phase 1
