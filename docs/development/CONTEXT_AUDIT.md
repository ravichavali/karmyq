# CONTEXT.md Standardization Audit

**Date:** 2025-12-24
**Purpose:** Audit existing CONTEXT.md files against SERVICE_CONTEXT_TEMPLATE.md

---

## Template Sections Checklist

Based on `SERVICE_CONTEXT_TEMPLATE.md`, each service CONTEXT.md should have:

1. ✅ **Header with Metadata** (Last Updated, Version, Port, Status)
2. ✅ **Quick Start** (Commands to start, test, view logs)
3. ✅ **Overview** (Purpose, Responsibilities, NOT Responsible For)
4. ✅ **Architecture** (Tech Stack, Components, Database Schema)
5. ✅ **API Reference** (All endpoints with examples)
6. ❓ **Events** (Published & Consumed)
7. ✅ **Key Patterns** (Auth, Database, Events)
8. ❓ **Dependencies** (Upstream, Downstream, Shared Libraries)
9. ❓ **Testing** (Unit, Integration, Fixtures, Scenarios)
10. ❓ **Configuration** (Env vars, Feature flags)
11. ❓ **Monitoring** (Metrics, Logging, Health checks)
12. ❓ **Troubleshooting** (Common issues)
13. ❓ **Future Enhancements** (Roadmap items)
14. ❓ **Related Documentation** (Links to other docs)

---

## Service-by-Service Analysis

### 1. Auth Service (Port 3001)

**File:** `services/auth-service/CONTEXT.md`

**Existing Sections:**
- ✅ Purpose
- ✅ Database Schema
- ✅ API Endpoints
- ✅ Key Patterns
- ✅ Events (partial - has published events)

**Missing Sections:**
- ❌ Header metadata (Last Updated, Version, Status)
- ❌ Quick Start commands
- ❌ Consumed Events section
- ❌ Dependencies (Upstream/Downstream)
- ❌ Testing section
- ❌ Configuration (env vars)
- ❌ Monitoring & Observability
- ❌ Troubleshooting
- ❌ Future Enhancements

**Recommendation:** HIGH PRIORITY
- Auth is critical - needs complete documentation
- Add missing sections from template

---

### 2. Community Service (Port 3002)

**File:** `services/community-service/CONTEXT.md`

**Existing Sections:**
- ✅ Purpose
- ✅ Database Schema (comprehensive)
- ✅ API Endpoints
- ✅ Key Patterns

**Missing Sections:**
- ❌ Header metadata
- ❌ Quick Start
- ❌ Events (Published & Consumed)
- ❌ Dependencies
- ❌ Testing
- ❌ Configuration
- ❌ Monitoring
- ❌ Troubleshooting
- ❌ Future Enhancements

**Recommendation:** HIGH PRIORITY
- Core service for multi-tenancy
- Needs event documentation

---

### 3. Request Service (Port 3003)

**File:** `services/request-service/CONTEXT.md`

**Existing Sections:**
- ✅ Quick Start (partial - has port and health URL)
- ✅ Purpose
- ✅ Database Schema (very detailed)
- ✅ API Endpoints (comprehensive)
- ✅ Key Patterns

**Missing Sections:**
- ❌ Header metadata
- ❌ Events section (critical - this service publishes request.created!)
- ❌ Dependencies
- ❌ Testing scenarios
- ❌ Configuration
- ❌ Monitoring
- ❌ Troubleshooting

**Recommendation:** CRITICAL
- This will be the first service modified for "Everything App"
- MUST have Events section before Phase 1
- MUST document polymorphic request handling

---

### 4. Reputation Service (Port 3004)

**File:** `services/reputation-service/CONTEXT.md`

**Existing Sections:**
- ✅ Purpose
- ✅ Database Schema
- ✅ API Endpoints
- ✅ Events (has consumed events - match_completed)

**Missing Sections:**
- ❌ Header metadata
- ❌ Quick Start
- ❌ Published events (if any)
- ❌ Dependencies
- ❌ Testing
- ❌ Configuration
- ❌ Monitoring
- ❌ Troubleshooting

**Recommendation:** MEDIUM PRIORITY
- Has some event documentation (good!)
- Needs to document karma calculation patterns for agents

---

### 5. Notification Service (Port 3005)

**File:** `services/notification-service/CONTEXT.md`

**Existing Sections:**
- ✅ Purpose
- ✅ Database Schema
- ✅ API Endpoints
- ✅ SSE Implementation details

**Missing Sections:**
- ❌ Header metadata
- ❌ Quick Start
- ❌ Events (what events trigger notifications?)
- ❌ Dependencies
- ❌ Testing (especially SSE testing)
- ❌ Configuration
- ❌ Monitoring
- ❌ Troubleshooting (SSE connection issues)

**Recommendation:** HIGH PRIORITY
- SSE is complex - needs troubleshooting section
- Event triggers are critical

---

### 6. Messaging Service (Port 3006)

**File:** `services/messaging-service/CONTEXT.md`

**Existing Sections:**
- ✅ Purpose
- ✅ Database Schema
- ✅ API Endpoints
- ✅ WebSocket implementation

**Missing Sections:**
- ❌ Header metadata
- ❌ Quick Start
- ❌ Events
- ❌ Dependencies
- ❌ Testing (WebSocket testing)
- ❌ Configuration
- ❌ Monitoring
- ❌ Troubleshooting (connection issues)

**Recommendation:** HIGH PRIORITY
- WebSocket is complex
- Needs troubleshooting for connection issues

---

### 7. Feed Service (Port 3007)

**File:** `services/feed-service/CONTEXT.md`

**Existing Sections:**
- ✅ Purpose
- ✅ Database Schema
- ✅ API Endpoints
- ✅ Feed Algorithm details

**Missing Sections:**
- ❌ Header metadata
- ❌ Quick Start
- ❌ Events (what events update the feed?)
- ❌ Dependencies (reads from ALL services!)
- ❌ Testing
- ❌ Configuration
- ❌ Monitoring
- ❌ Troubleshooting

**Recommendation:** MEDIUM PRIORITY
- Dependencies section is CRITICAL (aggregates data from all services)

---

### 8. Cleanup Service (Port 3008)

**File:** `services/cleanup-service/CONTEXT.md`

**Existing Sections:**
- ✅ Purpose
- ✅ Scheduled Jobs (excellent detail!)
- ✅ API Endpoints
- ✅ Configuration (TTL settings)

**Missing Sections:**
- ❌ Header metadata
- ❌ Quick Start
- ❌ Events
- ❌ Dependencies (writes to ALL schemas!)
- ❌ Testing
- ❌ Monitoring (job success/failure)
- ❌ Troubleshooting

**Recommendation:** MEDIUM PRIORITY
- Already has good configuration documentation
- Needs monitoring section (cron job health)

---

## Standardization Priority Matrix

| Priority | Service | Why | Estimated Effort |
|----------|---------|-----|------------------|
| 🔴 CRITICAL | Request Service | First to be modified for Everything App | 2 hours |
| 🟠 HIGH | Auth Service | Core authentication patterns | 1.5 hours |
| 🟠 HIGH | Community Service | Multi-tenancy foundation | 1.5 hours |
| 🟠 HIGH | Notification Service | Complex SSE implementation | 1.5 hours |
| 🟠 HIGH | Messaging Service | WebSocket complexity | 1.5 hours |
| 🟡 MEDIUM | Reputation Service | Event consumer patterns | 1 hour |
| 🟡 MEDIUM | Feed Service | Aggregation dependencies | 1 hour |
| 🟡 MEDIUM | Cleanup Service | Scheduled job monitoring | 1 hour |

**Total Estimated Effort:** ~11 hours

---

## Recommended Approach

### Phase 1: Critical (Before Everything App)
**Time:** 2 hours

Focus on **Request Service only** since it's the first to be modified:

1. Add header metadata with version v8.0.0
2. Add **Events Section**:
   - Published: `request.created`, `request.completed`, `match.accepted`, `match.rejected`
   - Consumed: None currently (will add in Phase 2)
3. Add **Testing Scenarios**:
   - Create generic request
   - Create polymorphic request (new!)
   - Validate Zod schemas
4. Add **Troubleshooting**:
   - Common validation errors
   - RLS issues

### Phase 2: High Priority Services (After Phase 1 Complete)
**Time:** 6 hours

Standardize Auth, Community, Notification, Messaging:
- Add all missing sections from template
- Focus on Events and Dependencies
- Document troubleshooting for complex features (SSE, WebSocket)

### Phase 3: Remaining Services (Before v9.0 Release)
**Time:** 3 hours

Complete Reputation, Feed, Cleanup:
- Full template compliance
- Ensure all sections present

---

## Automation Opportunities

### Script to Validate CONTEXT.md Completeness

```bash
#!/bin/bash
# docs/development/validate-context.sh

TEMPLATE_SECTIONS=(
  "Last Updated"
  "Quick Start"
  "Overview"
  "Architecture"
  "API Reference"
  "Events"
  "Key Patterns"
  "Dependencies"
  "Testing"
  "Configuration"
  "Monitoring"
  "Troubleshooting"
  "Future Enhancements"
  "Related Documentation"
)

for service in services/*/CONTEXT.md; do
  echo "Checking $service..."

  for section in "${TEMPLATE_SECTIONS[@]}"; do
    if ! grep -q "$section" "$service"; then
      echo "  ❌ Missing: $section"
    fi
  done
done
```

### Add to package.json

```json
{
  "scripts": {
    "docs:validate": "bash docs/development/validate-context.sh",
    "docs:audit": "node docs/development/audit-context.js"
  }
}
```

---

## Next Steps

1. **Decision Point:** Should we:
   - Option A: Standardize Request Service only (2 hours) → Proceed to Everything App
   - Option B: Standardize all services now (11 hours) → Then Everything App
   - Option C: Create validation script → Standardize incrementally

2. **My Recommendation:** **Option A**
   - Get Request Service perfect for Everything App
   - Standardize others in parallel as we work on them
   - Use validation script to track progress

3. **Commit Strategy:**
   ```bash
   git commit -m "docs: standardize Request Service CONTEXT.md for Everything App

   - Add Events section (published: request.created, request.completed)
   - Add Testing section with polymorphic request scenarios
   - Add Troubleshooting section
   - Update to v8.0.0 metadata

   Preparing Request Service for polymorphic data model in v9.0"
   ```

---

## Template Compliance Score

**Current Average:** ~40% complete (4/10 sections on average)

**Goal for v9.0:** 100% complete for all services

**Goal for Phase 1:** 100% complete for Request Service only
