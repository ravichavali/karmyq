# Track B: Infrastructure & Production Deployment - Antigravity Initialization Prompt

**Branch**: `feature/docker-compose-production`
**GitHub User**: `kompellachavali`
**Estimated Effort**: 36 hours
**Status**: Ready to Start
**Date**: 2025-12-30

---

## 🎯 Mission Statement

You are working on **Track B: Infrastructure & Production Deployment** for the Karmyq mutual aid platform. Your goal is to prepare the platform for production deployment on Oracle Cloud Infrastructure (OCI) free tier using **Docker Compose** (NOT Kubernetes).

This work stream runs in parallel with Track A (Frontend - Karma/Trust Display). You should coordinate merge order but work independently.

---

## 📚 REQUIRED READING (Read in Order)

Before starting ANY work, you **MUST** read these documents in this exact order:

1. **[docs/DEPLOYMENT_DECISION.md](../DEPLOYMENT_DECISION.md)** - Complete strategic analysis and deployment rationale
   - **WHY** Docker Compose over Kubernetes
   - Multi-instance readiness assessment
   - Specific blockers and fixes required
   - Deployment tier recommendations

2. **[docs/DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md)** - Current project status and backlog
   - Lines 1-195: Current focus, active work streams, completed tangents
   - Lines 199-1200: Backlog items #38, #40 (your primary tasks)
   - Lines 1860-1867: Tangent management workflow

3. **[docs/DEVELOPMENT_PROCESS.md](../DEVELOPMENT_PROCESS.md)** - Mandatory development workflow
   - Testing requirements (you MUST run tests before commits)
   - Git workflow and commit message format
   - Pre-push hook expectations

4. **[docs/architecture/DATA_FLOWS.md](../architecture/DATA_FLOWS.md)** - System data flows
   - Understand service dependencies
   - Impact analysis for infrastructure changes

5. **[infrastructure/docker/docker-compose.yml](../../infrastructure/docker/docker-compose.yml)** - Current deployment configuration
   - This is your starting point (already 90% production-ready)
   - Understand service orchestration

6. **[docs/adr/README.md](../adr/README.md)** - Architecture Decision Records
   - Key decisions that affect infrastructure:
     - ADR-003: Multi-Tenant RLS Database Design
     - ADR-004: Microservices Event-Driven Architecture
     - ADR-012: Real-Time Communication Stack (WebSocket + SSE)
     - ADR-015: Observability Stack (Grafana/Loki/Prometheus)

---

## 🚨 CRITICAL CONTEXT

### What You're Building On

**Current State (v8.0.0)**:
- ✅ 9 microservices running in Docker Compose (development mode)
- ✅ PostgreSQL with RLS (Row-Level Security) multi-tenant architecture
- ✅ Redis + Bull for event-driven messaging
- ✅ Observability stack (Grafana/Loki/Prometheus) deployed
- ✅ 85% integration test pass rate (127/149 tests)
- ✅ Comprehensive documentation and ADRs
- ❌ **NOT production-ready**: No OCI deployment, multi-instance blockers exist

**Why NOT Kubernetes** (from DEPLOYMENT_DECISION.md):
- Current scale: MVP with 0 production traffic
- K8s overhead: 30-40 hours setup + 20+ hours/month maintenance
- OCI free tier: K8s control plane would consume significant resources
- Team size: No dedicated DevOps team
- **Verdict**: Docker Compose on single OCI VM is adequate for 0-1,000 users

**Tech Stack**:
- Backend: Node.js/Express/TypeScript (all 9 services)
- Frontend: Next.js 14 with Tailwind CSS
- Database: PostgreSQL 15 (schemas: auth, community, requests, reputation, notifications, messaging)
- Cache/Queue: Redis + Bull
- Observability: Grafana + Loki + Prometheus
- Reverse Proxy: Nginx (you will configure)
- SSL: Let's Encrypt (you will configure)

**Service Ports**:
| Service | Port | Multi-Instance Ready? |
|---------|------|----------------------|
| Auth | 3001 | ✅ Yes (stateless JWT) |
| Community | 3002 | ✅ Yes (DB-backed) |
| Request | 3003 | ✅ Yes (Bull queue) |
| Reputation | 3004 | ✅ Yes (Bull publisher) |
| Notification | 3005 | ✅ Yes (SSE, needs sticky sessions) |
| Messaging | 3006 | ❌ **BLOCKER** (in-memory WebSocket state) |
| Feed | 3007 | ✅ Yes (read-only) |
| Cleanup | 3008 | ✅ Yes (DB locking) |
| Geocoding | 3009 | ✅ Yes (DB cache) |
| Social Graph | 3010 | ✅ Yes (stateless) |

---

## 🎯 Your Tasks (Track B)

### Backlog Item #38: Multi-Environment Deployment Strategy
**From**: DEVELOPMENT_ROADMAP.md lines 318-352

**Current Situation**:
- Development environment: Docker Compose works perfectly
- Production environment: **DOES NOT EXIST**
- No deployment guides, runbooks, or rollback procedures

**Your Goal**: Create production deployment on OCI free tier

**Deliverables**:
1. ✅ Provision OCI compute instance (ARM or AMD, free tier)
2. ✅ Install Docker + Docker Compose on OCI
3. ✅ Configure environment variables for production
4. ✅ Set up Nginx reverse proxy (all services behind single domain)
5. ✅ Configure Let's Encrypt SSL certificates (auto-renewal)
6. ✅ Deploy all 9 services + PostgreSQL + Redis
7. ✅ Configure health checks and monitoring
8. ✅ Document deployment process in `docs/operations/PRODUCTION_DEPLOYMENT.md`
9. ✅ Document rollback procedures in `docs/operations/ROLLBACK_GUIDE.md`
10. ✅ Create troubleshooting playbook in `docs/operations/TROUBLESHOOTING.md`

**Acceptance Criteria**:
- All services healthy and accessible via HTTPS
- SSL certificates auto-renew
- Grafana dashboards showing production metrics
- Complete deployment documentation
- Rollback procedure tested and documented

**Estimate**: 12 hours

---

### Backlog Item #40: Multi-Instance Support (Reframed)
**From**: DEVELOPMENT_ROADMAP.md lines 362-403

**Original Title**: "Kubernetes Architecture for Scaling"
**New Title**: "Multi-Instance Support with Docker Compose"

**Why Reframed**: Kubernetes is overkill for current scale (see DEPLOYMENT_DECISION.md). Use Docker Compose with 2-3 replicas per service instead.

**Critical Blocker - Messaging Service WebSocket State**:
- **File**: `services/messaging-service/src/socket/messageHandler.ts`
- **Lines**: 5-6
- **Problem**:
  ```typescript
  const userSockets = new Map<string, string>(); // userId -> socketId
  const socketUsers = new Map<string, string>(); // socketId -> userId
  ```
  These in-memory Maps prevent cross-instance messaging. User A on Instance 1 cannot message User B on Instance 2.

**Your Goal**: Enable 2-3 replicas of each service

**Deliverables**:

1. ✅ **Fix Messaging Service WebSocket State** (4-6 hours)
   - Move socket tracking from in-memory Maps to Redis
   - Implement Redis Pub/Sub for cross-instance messaging
   - File to modify: `services/messaging-service/src/socket/messageHandler.ts`
   - Test with 2 instances of messaging service
   - Verify User A on Instance 1 can message User B on Instance 2

2. ✅ **Fix Database Connection Pool Size** (10 minutes)
   - Current: 10 connections per service
   - Problem: 3 instances × 9 services × 10 = 270 connections (exceeds PostgreSQL default 100)
   - Solution: Reduce to `max: 5` per service
   - File to modify: `services/auth-service/src/database/db.ts` (line 5)
   - Replicate change to all 9 services

3. ✅ **Configure Sticky Sessions** (2 hours)
   - Notification Service (SSE) needs sticky sessions
   - Messaging Service (WebSocket) needs sticky sessions (even after Redis fix)
   - Configure Nginx to use `ip_hash` or cookie-based sticky sessions

4. ✅ **Update Docker Compose for Multi-Instance** (2 hours)
   - Use Docker Compose `deploy.replicas` (requires Docker Swarm mode)
   - OR: Create separate service definitions (e.g., `auth-1`, `auth-2`, `auth-3`)
   - Configure Nginx to load balance across replicas

5. ✅ **Test Multi-Instance Deployment** (4 hours)
   - Run 2-3 replicas of all services
   - Verify load balancing works
   - Verify sticky sessions work (Notification, Messaging)
   - Verify cross-instance messaging works
   - Run integration test suite (should pass with 85%+ rate)

6. ✅ **Document Multi-Instance Setup** (2 hours)
   - Update `docs/operations/PRODUCTION_DEPLOYMENT.md`
   - Document scaling procedures (how to add/remove instances)
   - Document monitoring and health checks

**Acceptance Criteria**:
- 2-3 replicas of each service running successfully
- Messaging service cross-instance communication works
- Sticky sessions configured for Notification and Messaging
- Database connection count stays within PostgreSQL limits
- Integration tests pass (85%+ rate)
- Complete documentation

**Estimate**: 12 hours

---

### Additional Infrastructure Tasks (6 hours)

**Monitoring and Alerting**:
- Configure Grafana dashboards for production metrics
- Set up Loki log aggregation for all services
- Create alerts for:
  - Service health (down/unhealthy)
  - High error rates (>5% 5xx responses)
  - Database connection exhaustion
  - Redis queue backlog
  - SSL certificate expiration (30 days before)

**Backup and Recovery**:
- Set up PostgreSQL automated backups (daily, 7-day retention)
- Document database restore procedure
- Test restore from backup

**Security Hardening**:
- Configure firewall rules (only ports 80, 443, 22 open)
- Set up fail2ban for SSH
- Configure Docker security options (user namespaces, seccomp profiles)
- Rotate SSL certificates (Let's Encrypt auto-renewal)

**Documentation** (must be created):
- `docs/operations/PRODUCTION_DEPLOYMENT.md` - Complete deployment guide
- `docs/operations/ROLLBACK_GUIDE.md` - How to rollback deployments
- `docs/operations/TROUBLESHOOTING.md` - Common issues and solutions
- `docs/operations/SCALING_GUIDE.md` - How to scale up/down instances

**Estimate**: 6 hours

---

## 🔒 Multi-Instance Readiness - Detailed Analysis

**From**: DEPLOYMENT_DECISION.md lines 93-150

### Services Ready for Multi-Instance (8/9) ✅

1. **Auth Service (3001)** - Stateless JWT validation
   - No shared state
   - Can run N instances immediately

2. **Community Service (3002)** - Database-backed
   - All state in PostgreSQL
   - Can run N instances immediately

3. **Request Service (3003)** - Bull queue via Redis
   - Event publishing coordinated via Redis
   - Can run N instances immediately

4. **Reputation Service (3004)** - Bull queue publisher
   - Event publishing coordinated via Redis
   - Can run N instances immediately

5. **Notification Service (3005)** - SSE, needs sticky sessions
   - SSE connections must stay on same instance
   - **Solution**: Configure sticky sessions in Nginx
   - Can run N instances with sticky sessions

6. **Feed Service (3007)** - Read-only aggregation
   - No writes, just reads from other services
   - Can run N instances immediately

7. **Cleanup Service (3008)** - DB-level locking for cron
   - Uses PostgreSQL advisory locks to prevent duplicate runs
   - Can run N instances immediately (only one executes cron job)

8. **Geocoding Service (3009)** - Database cache
   - All state in PostgreSQL (geocoding cache)
   - Can run N instances immediately

9. **Social Graph Service (3010)** - Stateless
   - No shared state
   - Can run N instances immediately

### Service with Blocker (1/9) ❌

**Messaging Service (3006)** - In-memory WebSocket state

**File**: `services/messaging-service/src/socket/messageHandler.ts`
**Lines**: 5-6

**Current Code**:
```typescript
const userSockets = new Map<string, string>(); // userId -> socketId
const socketUsers = new Map<string, string>(); // socketId -> userId
```

**Problem**:
- These Maps are in-memory and instance-specific
- User A connects to Instance 1 → stored in Instance 1's Map
- User B connects to Instance 2 → stored in Instance 2's Map
- User A sends message to User B → Instance 1 can't find User B's socket
- **Result**: Cross-instance messaging fails

**Solution - Redis-Based Socket Tracking** (4-6 hours):

1. **Replace In-Memory Maps with Redis**:
   ```typescript
   // OLD (in-memory, instance-specific)
   const userSockets = new Map<string, string>();
   const socketUsers = new Map<string, string>();

   // NEW (Redis, shared across instances)
   import { createClient } from 'redis';
   const redisClient = createClient({ url: process.env.REDIS_URL });

   // Store: userId -> socketId + instanceId
   async function registerSocket(userId: string, socketId: string, instanceId: string) {
     await redisClient.hSet('user_sockets', userId, JSON.stringify({ socketId, instanceId }));
     await redisClient.hSet('socket_users', socketId, userId);
   }

   // Retrieve: socketId + instanceId for a userId
   async function getSocket(userId: string): Promise<{ socketId: string, instanceId: string } | null> {
     const data = await redisClient.hGet('user_sockets', userId);
     return data ? JSON.parse(data) : null;
   }
   ```

2. **Implement Redis Pub/Sub for Cross-Instance Messaging**:
   ```typescript
   // Publisher (Instance 1): Send message to User B
   async function sendMessage(recipientUserId: string, message: any) {
     const socketInfo = await getSocket(recipientUserId);
     if (!socketInfo) {
       console.log('User not connected');
       return;
     }

     // Publish to Redis channel (all instances listen)
     await redisClient.publish('messaging', JSON.stringify({
       targetInstanceId: socketInfo.instanceId,
       socketId: socketInfo.socketId,
       message: message
     }));
   }

   // Subscriber (All Instances): Listen for messages
   const subscriber = redisClient.duplicate();
   subscriber.subscribe('messaging', (rawMessage) => {
     const { targetInstanceId, socketId, message } = JSON.parse(rawMessage);

     // Only deliver if this is the target instance
     if (targetInstanceId === process.env.INSTANCE_ID) {
       io.to(socketId).emit('message', message);
     }
   });
   ```

3. **Handle Socket Disconnects**:
   ```typescript
   socket.on('disconnect', async () => {
     const userId = await redisClient.hGet('socket_users', socket.id);
     if (userId) {
       await redisClient.hDel('user_sockets', userId);
       await redisClient.hDel('socket_users', socket.id);
     }
   });
   ```

4. **Test Cross-Instance Messaging**:
   - Start 2 instances of messaging service (ports 3006, 3016)
   - Connect User A to Instance 1 (port 3006)
   - Connect User B to Instance 2 (port 3016)
   - Send message from User A to User B
   - Verify message arrives via Redis Pub/Sub

**Alternative Solution - Sticky Sessions** (0 hours, quick workaround):
- Configure Nginx to pin users to same instance (IP hash or cookie-based)
- Limitation: Doesn't scale indefinitely, but works for low traffic
- Use this if Redis solution is too complex initially

---

## 🛠️ Development Workflow (MANDATORY)

**From**: docs/DEVELOPMENT_PROCESS.md

### Before Every Commit

1. ✅ **Read the file first** (use Read tool, never edit without reading)
2. ✅ **Run type check**: `npm run type-check` (must pass)
3. ✅ **Run integration tests**: `cd tests && npm run test:integration` (85%+ pass rate)
4. ✅ **Document changes** in commit message (see format below)

### Commit Message Format

```
<type>: <short summary> (50 chars max)

## Summary
<1-2 paragraph summary of changes>

## Key Changes
- <Change 1>
- <Change 2>
- <Change 3>

## Technical Details
<Any implementation notes, gotchas, or important context>

## Testing
- <How you tested this>
- <Test results>

## Files Modified
- <file 1> (line numbers if relevant)
- <file 2> (line numbers if relevant)

## Related
- Backlog Item #38 or #40
- DEPLOYMENT_DECISION.md
- ADR-XXX (if applicable)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Commit Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `infra:` - Infrastructure changes (use this for Track B)
- `test:` - Test changes
- `refactor:` - Code refactoring

### Pre-Push Hook

**Location**: `.git/hooks/pre-push`

**What it does**:
- Runs type-check
- Runs full integration test suite
- **Warning**: Currently failing due to auth service ECONNRESET errors (pre-existing infrastructure issue)
- **Workaround**: Use `git push --no-verify` if tests fail due to infrastructure (not your changes)

### Testing Requirements

**Integration Tests** (MUST RUN):
```bash
cd tests
npm run test:integration
```

**Expected Pass Rate**: 85%+ (127/149 tests)

**Known Failures** (pre-existing, not your fault):
- Auth service ECONNRESET errors during parallel test execution
- `reputation-decay.test.ts` - 4 tests (status code mismatches for not-yet-implemented features)
- `complete-workflow.test.ts` - timeout errors during heavy load

**What to do if tests fail**:
1. Check if failures are pre-existing (compare with known failures above)
2. If new failures introduced by your changes → **FIX THEM**
3. If pre-existing failures → Document in commit message, use `--no-verify` if needed

---

## 🚫 What NOT to Do

**DO NOT**:
- ❌ Use Kubernetes (we chose Docker Compose, see DEPLOYMENT_DECISION.md)
- ❌ Modify frontend code (that's Track A, will cause merge conflicts)
- ❌ Change database schema (not needed for infrastructure work)
- ❌ Skip reading DEPLOYMENT_DECISION.md (contains critical context)
- ❌ Commit without running tests
- ❌ Create new ADRs without discussing first (infrastructure decisions already made)
- ❌ Modify service business logic (only infrastructure/deployment changes)
- ❌ Push to `master` branch directly (work on `feature/docker-compose-production`)

**DO**:
- ✅ Read all required documentation FIRST
- ✅ Use Docker Compose for deployment
- ✅ Fix multi-instance blockers (messaging service WebSocket state)
- ✅ Document everything you create
- ✅ Run tests before every commit
- ✅ Coordinate with Track A (merge order: Track A first, then Track B)

---

## 📁 Files You'll Modify

### New Files (Create These)

**Documentation**:
- `docs/operations/PRODUCTION_DEPLOYMENT.md` - Complete deployment guide
- `docs/operations/ROLLBACK_GUIDE.md` - Rollback procedures
- `docs/operations/TROUBLESHOOTING.md` - Common issues and solutions
- `docs/operations/SCALING_GUIDE.md` - How to scale instances

**Infrastructure Configuration**:
- `infrastructure/docker/docker-compose.prod.yml` - Production overrides
- `infrastructure/docker/docker-compose.swarm.yml` - Multi-instance configuration (if using Swarm)
- `infrastructure/nginx/nginx.conf` - Nginx reverse proxy configuration
- `infrastructure/nginx/ssl.conf` - SSL configuration
- `infrastructure/scripts/deploy.sh` - Deployment script
- `infrastructure/scripts/rollback.sh` - Rollback script
- `infrastructure/scripts/backup-db.sh` - Database backup script
- `.env.production.example` - Production environment variables template

**Monitoring**:
- `infrastructure/grafana/dashboards/production.json` - Production Grafana dashboard
- `infrastructure/grafana/alerts/production.yml` - Production alerts

### Existing Files (Modify These)

**Messaging Service WebSocket Fix**:
- `services/messaging-service/src/socket/messageHandler.ts` (lines 5-6) - Replace in-memory Maps with Redis
- `services/messaging-service/package.json` - Add `redis` dependency
- `services/messaging-service/src/config/redis.ts` (create) - Redis client configuration

**Database Connection Pool Fix**:
- `services/auth-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/community-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/request-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/reputation-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/notification-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/messaging-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/feed-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/cleanup-service/src/database/db.ts` (line 5) - Reduce pool size to 5
- `services/geocoding-service/src/database/db.ts` (line 5) - Reduce pool size to 5

**Docker Compose**:
- `infrastructure/docker/docker-compose.yml` - May need minor tweaks for production

**Environment Variables**:
- `.env.example` - Add production-specific variables (SSL paths, domain, etc.)

---

## 🤝 Coordination with Track A

**Track A**: Frontend - Karma/Trust Display (18 hours)
**Track B**: Infrastructure - Production Deployment (36 hours)
**Merge Conflict Risk**: 🟢 **GREEN - Safe to Parallelize (95% confidence)**

**From**: DEPLOYMENT_DECISION.md lines 195-220

### File Overlap Analysis

**ZERO File Overlap**:
- Track A touches: `apps/frontend/src/**`
- Track B touches: `infrastructure/**, services/**/database.ts, services/messaging-service/src/socket/**`
- **No overlap**: Can work completely independently

### Coordination Points

1. ✅ **Check `.env.example` before merging Track B**
   - Track A may add frontend-specific variables
   - Track B adds production infrastructure variables
   - Minimal overlap, easy to merge

2. ✅ **Merge Order**: Track A first, then Track B
   - Track A is smaller (18 hours) and higher priority
   - Track B is larger (36 hours) and can adapt to Track A changes
   - If Track A merges first, Track B just rebases on latest master

3. ✅ **Communication**:
   - Check DEVELOPMENT_ROADMAP.md for Track A status
   - If Track A completes before Track B, rebase your branch on latest master
   - If Track B completes before Track A, wait for Track A merge before pushing

### Merge Conflict Resolution (If Needed)

**If `.env.example` conflicts**:
- Keep both sets of variables
- Frontend variables first, then infrastructure variables
- Add comments to separate sections

**If `package.json` conflicts** (unlikely):
- Keep both sets of dependencies
- Frontend dependencies for Track A
- Infrastructure dependencies (nginx, redis) for Track B

---

## 📊 Success Metrics

**From**: DEPLOYMENT_ROADMAP.md lines 1823-1830

### How to Measure Success

**Infrastructure Readiness** (Track B):
- ✅ OCI instance provisioned and accessible
- ✅ All 9 services running on OCI via HTTPS
- ✅ SSL certificates auto-renewing
- ✅ Grafana showing production metrics
- ✅ Database backups running daily
- ✅ Multi-instance configuration tested (2-3 replicas per service)
- ✅ Complete production deployment documentation
- ✅ Rollback procedure tested and documented

**Test Results**:
- ✅ Integration tests: 85%+ pass rate (127/149 tests minimum)
- ✅ Multi-instance messaging test: Pass (User A on Instance 1 → User B on Instance 2)
- ✅ Sticky sessions test: Pass (SSE connections stay on same instance)
- ✅ Load balancing test: Pass (requests distributed across instances)

**Documentation Completeness**:
- ✅ PRODUCTION_DEPLOYMENT.md - Complete step-by-step guide
- ✅ ROLLBACK_GUIDE.md - Tested rollback procedures
- ✅ TROUBLESHOOTING.md - Common issues and solutions
- ✅ SCALING_GUIDE.md - How to scale up/down instances

---

## 🎯 Your First Steps (Action Plan)

### Phase 1: Setup and Context (2 hours)

1. ✅ **Read all required documentation** (1 hour)
   - DEPLOYMENT_DECISION.md (complete)
   - DEVELOPMENT_ROADMAP.md (backlog items #38, #40)
   - DEVELOPMENT_PROCESS.md (testing workflow)
   - DATA_FLOWS.md (service dependencies)
   - Current docker-compose.yml (baseline)

2. ✅ **Create feature branch** (5 minutes)
   ```bash
   git checkout master
   git pull origin master
   git checkout -b feature/docker-compose-production
   git push -u origin feature/docker-compose-production
   ```

3. ✅ **Set up local development environment** (30 minutes)
   - Clone repository
   - Run `docker-compose up -d` to verify all services start
   - Run integration tests to get baseline pass rate
   - Verify Grafana accessible at http://localhost:3011

4. ✅ **Create TODO tracking** (15 minutes)
   ```bash
   # Use TodoWrite tool to create task list
   # Track all deliverables from this document
   ```

### Phase 2: OCI Deployment (12 hours)

5. ✅ **Provision OCI Instance** (2 hours)
   - Sign up for OCI free tier
   - Create compute instance (ARM or AMD)
   - Configure security lists (ports 80, 443, 22)
   - Set up SSH access

6. ✅ **Install Docker Environment** (1 hour)
   - Install Docker + Docker Compose
   - Configure Docker daemon
   - Test with hello-world container

7. ✅ **Deploy Services** (3 hours)
   - Copy docker-compose.yml to OCI
   - Set up environment variables (.env.production)
   - Start all services
   - Verify health endpoints

8. ✅ **Configure Nginx Reverse Proxy** (2 hours)
   - Install Nginx
   - Configure virtual hosts for all services
   - Set up HTTPS redirects
   - Test routing

9. ✅ **Set up SSL Certificates** (1 hour)
   - Install Certbot
   - Generate Let's Encrypt certificates
   - Configure auto-renewal cron job
   - Test HTTPS access

10. ✅ **Configure Monitoring** (2 hours)
    - Set up Grafana dashboards
    - Configure Loki log aggregation
    - Create production alerts
    - Test alerting

11. ✅ **Document Deployment** (1 hour)
    - Write PRODUCTION_DEPLOYMENT.md
    - Write ROLLBACK_GUIDE.md
    - Write TROUBLESHOOTING.md

### Phase 3: Multi-Instance Support (12 hours)

12. ✅ **Fix Messaging Service WebSocket State** (6 hours)
    - Read current messageHandler.ts implementation
    - Design Redis-based socket tracking
    - Implement Redis Pub/Sub for cross-instance messaging
    - Test with 2 instances
    - Verify cross-instance messaging works

13. ✅ **Fix Database Connection Pool Size** (1 hour)
    - Update all 9 services to use `max: 5` connections
    - Test with 3 instances (9 × 5 × 3 = 135 connections, within PostgreSQL limit)

14. ✅ **Configure Sticky Sessions** (2 hours)
    - Configure Nginx for sticky sessions
    - Test Notification Service SSE connections
    - Test Messaging Service WebSocket connections
    - Verify sessions stay on same instance

15. ✅ **Update Docker Compose for Multi-Instance** (2 hours)
    - Decide: Docker Swarm mode OR separate service definitions
    - Configure replicas (2-3 per service)
    - Update Nginx to load balance across replicas
    - Test deployment

16. ✅ **Test Multi-Instance Deployment** (4 hours)
    - Deploy 2-3 replicas of all services
    - Run integration test suite (85%+ pass rate)
    - Test cross-instance messaging
    - Test sticky sessions
    - Test load balancing
    - Verify Grafana shows metrics from all instances

17. ✅ **Document Multi-Instance Setup** (1 hour)
    - Update PRODUCTION_DEPLOYMENT.md
    - Write SCALING_GUIDE.md

### Phase 4: Additional Infrastructure (6 hours)

18. ✅ **Set up Database Backups** (2 hours)
    - Create backup script
    - Configure cron job (daily, 7-day retention)
    - Test restore from backup
    - Document restore procedure

19. ✅ **Security Hardening** (2 hours)
    - Configure firewall rules
    - Set up fail2ban for SSH
    - Configure Docker security options
    - Review SSL configuration

20. ✅ **Create Deployment Scripts** (2 hours)
    - Write deploy.sh (automated deployment)
    - Write rollback.sh (automated rollback)
    - Test both scripts
    - Document usage

### Phase 5: Testing and Documentation (6 hours)

21. ✅ **Run Complete Test Suite** (2 hours)
    - Integration tests (85%+ pass rate)
    - Multi-instance tests
    - Load tests (optional)
    - Document test results

22. ✅ **Finalize Documentation** (2 hours)
    - Review all documentation
    - Add screenshots/diagrams
    - Ensure step-by-step instructions are clear
    - Add troubleshooting for common issues

23. ✅ **Prepare for Merge** (2 hours)
    - Rebase on latest master
    - Resolve any conflicts
    - Run final test suite
    - Create pull request with detailed description

---

## 📞 Communication

**GitHub User**: `kompellachavali`
**Branch**: `feature/docker-compose-production`
**Coordination**: Check DEVELOPMENT_ROADMAP.md for Track A status

**When to Ask Questions**:
- If DEPLOYMENT_DECISION.md is unclear
- If you find better approaches than documented
- If you encounter blockers not mentioned in this document
- If Track A changes affect your work

**How to Ask Questions**:
- Create issue in GitHub with label `track-b`
- Ping `@ravichavali` (project owner)
- Reference specific sections of DEPLOYMENT_DECISION.md

---

## ✅ Checklist Before You Start

Before writing ANY code, confirm:

- [ ] Read DEPLOYMENT_DECISION.md (complete)
- [ ] Read DEVELOPMENT_ROADMAP.md (backlog items #38, #40)
- [ ] Read DEVELOPMENT_PROCESS.md (testing workflow)
- [ ] Read DATA_FLOWS.md (service dependencies)
- [ ] Reviewed current docker-compose.yml
- [ ] Understand why NOT Kubernetes (see DEPLOYMENT_DECISION.md)
- [ ] Understand multi-instance blockers (messaging service WebSocket state)
- [ ] Understand coordination with Track A (merge order, file overlap)
- [ ] Created feature branch `feature/docker-compose-production`
- [ ] Set up local development environment
- [ ] Ran integration tests to get baseline pass rate

---

## 🎉 Final Notes

**You are building critical infrastructure for a production mutual aid platform**. Your work will:

- ✅ Enable the platform to serve 1,000+ users on OCI free tier
- ✅ Provide multi-instance scalability (2-3 replicas per service)
- ✅ Ensure high availability with health checks and monitoring
- ✅ Create comprehensive deployment documentation for future team members
- ✅ Validate that Docker Compose is sufficient (no need for Kubernetes at current scale)

**This is a well-defined, well-documented infrastructure project**. All decisions have been made (see DEPLOYMENT_DECISION.md). All blockers have been identified (messaging service WebSocket state, database connection pool size). All coordination points have been mapped (Track A file overlap analysis).

**Your job is to execute the plan, not redesign it**. Follow the documentation, run the tests, document your work, and coordinate with Track A.

**Good luck! 🚀**

---

**Document Version**: 1.0
**Last Updated**: 2025-12-30
**Author**: Claude Sonnet 4.5 (AI Assistant)
**Reviewed By**: ravichavali (Project Owner)
