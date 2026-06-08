# Service Governance Framework

**Version**: 1.0.0
**Date**: 2026-01-21
**Status**: Proposed

---

## The Problem

As Karmyq scales from 10 → 20 → 50 services, we're hitting critical issues:

### Current Pain Points

1. **Dependency Chaos**
   - 11 services each independently manage `express`, `pg`, `redis`, `bull`
   - Version drift: `redis: ^4.6.11` in 6 services, `redis: ^4.7.1` in 1 service
   - No shared dependency strategy
   - Each service: ~40 dependencies × 11 services = 440+ dependency declarations

2. **No Impact Analysis**
   - When adding geocoding-service, how did it impact the system?
   - When simulation-service had 1065 restarts, how did we know?
   - No automated health checks
   - No dependency graph visualization

3. **Service Sprawl**
   - 13 service folders (3 deprecated: `_template`, `matching-service`, `simulation-service`)
   - No clear criteria for "when to create a service vs extend existing"
   - Services vary wildly in size: 100 LOC to 600 LOC

4. **Documentation Disconnect**
   - Each service has CONTEXT.md (2663 lines total)
   - No single view of system health
   - No service dependency map
   - Changes to one service require manual checking of others

5. **Build/Deploy Opacity**
   - Turborepo builds all services, even if only one changed
   - docker-compose.yml is 13KB with 11+ service definitions
   - No visibility into what's being built/deployed

---

## The Framework: Service Governance System

### 1. Service Registry (Single Source of Truth)

**File**: `services/registry.json`

```json
{
  "version": "1.0.0",
  "services": {
    "auth-service": {
      "port": 3001,
      "status": "production",
      "owner": "core",
      "dependencies": {
        "services": [],
        "infrastructure": ["postgres", "redis"]
      },
      "apis": {
        "provides": ["/auth/register", "/auth/login", "/auth/verify"],
        "consumes": []
      },
      "health_check": "http://localhost:3001/health",
      "criticality": "critical"
    },
    "request-service": {
      "port": 3003,
      "status": "production",
      "owner": "core",
      "dependencies": {
        "services": ["auth-service", "community-service"],
        "infrastructure": ["postgres", "redis", "bull-queue"]
      },
      "apis": {
        "provides": ["/requests", "/offers", "/matches"],
        "consumes": ["/auth/verify", "/communities/validate"]
      },
      "health_check": "http://localhost:3003/health",
      "criticality": "critical"
    },
    "simulation-service": {
      "port": null,
      "status": "development",
      "owner": "testing",
      "dependencies": {
        "services": ["all"],
        "infrastructure": []
      },
      "apis": {
        "provides": [],
        "consumes": ["all"]
      },
      "health_check": null,
      "criticality": "optional"
    }
  }
}
```

### 2. Dependency Analysis Tooling

**Script**: `scripts/analyze-services.js`

Capabilities:
- Generate service dependency graph (Mermaid diagram)
- Detect circular dependencies
- Calculate impact radius: "If X fails, what breaks?"
- Identify orphaned services (no consumers)
- Version drift detection

**Usage**:
```bash
npm run analyze:services
# Outputs:
# - services/dependency-graph.md (Mermaid diagram)
# - services/impact-analysis.json
# - services/health-report.md
```

### 3. Automated Health Monitoring

**Script**: `scripts/health-check.sh`

```bash
#!/bin/bash
# Check all services listed in registry.json with status=production
# Exit code 1 if any critical service is down

for service in $(jq -r '.services | to_entries[] | select(.value.criticality=="critical") | .key' services/registry.json); do
  health_url=$(jq -r ".services.\"$service\".health_check" services/registry.json)
  if ! curl -sf "$health_url" > /dev/null; then
    echo "CRITICAL: $service is down"
    exit 1
  fi
done
```

**Integration**:
- Run before deployment
- Run every 5 minutes via cron
- Alert on critical service failures

### 4. Service Creation Checklist

**Decision Tree**: When to create a new service?

```
Does this feature need a new service?
├─ YES if:
│  ├─ Different data domain (new schema)
│  ├─ Independent scaling needs
│  ├─ Different technology stack
│  └─ Clear bounded context (DDD)
│
└─ NO if:
   ├─ Just a new endpoint in existing domain
   ├─ Same database schema
   ├─ Tightly coupled to existing service
   └─ < 200 lines of code
```

**Required Steps** (enforced via PR template):

1. [ ] Add entry to `services/registry.json`
2. [ ] Run `npm run analyze:services` - verify no circular deps
3. [ ] Create `services/{name}/CONTEXT.md` with sections:
   - Purpose (1-2 sentences)
   - Provides APIs (list)
   - Consumes APIs (list)
   - Database schema
   - Event subscriptions
4. [ ] Add health check endpoint `/health`
5. [ ] Update `docker-compose.yml`
6. [ ] Update `turbo.json` if needed
7. [ ] Run `npm run health:check` to verify
8. [ ] Update `docs/ARCHITECTURE.md` service table

### 5. Shared Dependency Management

**Approach**: Hoist common dependencies to workspace root

**Root `package.json`**:
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "redis": "^4.6.11",
    "bull": "^4.11.5",
    "winston": "^3.18.3",
    "zod": "^4.1.12"
  }
}
```

**Service `package.json`**: Only service-specific dependencies

**Benefits**:
- Single version of each core dep
- Faster `npm install` (shared node_modules)
- Easier security patching

**Exceptions**: Allow service-specific versions only when justified in CONTEXT.md

### 6. Impact Analysis Before Changes

**Pre-commit hook**: `scripts/git-hooks/pre-commit`

```bash
#!/bin/bash
# If files changed in services/*/src, run impact analysis

changed_services=$(git diff --cached --name-only | grep '^services/' | cut -d/ -f2 | sort -u)

if [ -n "$changed_services" ]; then
  echo "Services changed: $changed_services"
  npm run analyze:impact -- $changed_services
  echo "Review impact-analysis.md before committing"
fi
```

### 7. Service Status Dashboard

**Tool**: `scripts/dashboard.sh` (interactive CLI dashboard)

Output:
```
KARMYQ SERVICE STATUS
=====================
Service              Port   Status      Health   Criticality   Consumers
auth-service         3001   production  ✓        critical      6 services
community-service    3002   production  ✓        critical      4 services
request-service      3003   production  ✓        critical      2 services
simulation-service   -      development ✗        optional      0 services
```

---

## Implementation Plan

### Phase 1: Foundation (Today - 3 hours)

1. **Create `services/registry.json`**
   - Document all 13 existing services
   - Mark status (production/development/deprecated)
   - List dependencies

2. **Create `scripts/analyze-services.js`**
   - Parse registry.json
   - Generate dependency graph (Mermaid)
   - Output to `services/dependency-graph.md`

3. **Create `scripts/health-check.sh`**
   - Check all production services
   - Exit code 1 on failure

### Phase 2: Tooling (Tomorrow - 4 hours)

4. **Implement impact analysis**
   - Given service X, find all consumers
   - Calculate blast radius

5. **Create service dashboard**
   - Interactive CLI showing health status
   - Real-time updates

6. **Set up pre-commit hook**
   - Auto-run impact analysis on service changes

### Phase 3: Cleanup (This Week - 2 days)

7. **Delete deprecated services**
   - `_template/` (use registry.json as template)
   - `matching-service/` (unused)
   - Mark `simulation-service/` as development-only

8. **Hoist shared dependencies**
   - Move common deps to root package.json
   - Update service package.json files

9. **Consolidate services** (per ARCHITECTURE_RESET_ANALYSIS.md)
   - Convert `cleanup-service` → pg_cron
   - Delete `geocoding-service` (use browser API)

### Phase 4: Enforcement (Ongoing)

10. **GitHub PR Template**
    - Checklist for new services
    - Link to governance doc

11. **CI/CD integration**
    - Run health checks before deploy
    - Block merge if critical service down

---

## Service Classification

### Critical Services (Cannot fail)
- auth-service
- community-service
- request-service
- reputation-service
- messaging-service
- social-graph-service

### Important Services (Degraded experience if down)
- notification-service

### Optional Services (Dev/testing only)
- simulation-service
- cleanup-service (replace with pg_cron)

### Deprecated Services (Delete)
- `_template/`
- `matching-service/`
- `geocoding-service/`

---

## Success Metrics

After implementing this framework:

1. **Dependency clarity**: Single `dependency-graph.md` shows all relationships
2. **Health visibility**: Dashboard shows status at a glance
3. **Impact awareness**: Before changing X, know what breaks
4. **Faster onboarding**: New developers run `npm run dashboard` to understand system
5. **Fewer surprises**: Pre-commit hooks catch issues early
6. **Service discipline**: Clear criteria prevent service sprawl

---

## Example: Adding a New Service

**Scenario**: Adding "payment-service" for handling transactions

**OLD WAY** (no governance):
1. Copy `_template/` folder
2. Update package.json
3. Add to docker-compose.yml
4. Hope nothing breaks

**NEW WAY** (with governance):
1. **Check decision tree**: New data domain (payments) → YES, new service justified
2. **Add to registry.json**:
   ```json
   "payment-service": {
     "port": 3011,
     "status": "development",
     "owner": "transactions",
     "dependencies": {
       "services": ["auth-service", "community-service"],
       "infrastructure": ["postgres", "redis", "stripe-api"]
     },
     "apis": {
       "provides": ["/payments/create", "/payments/refund"],
       "consumes": ["/auth/verify", "/communities/validate"]
     },
     "health_check": "http://localhost:3011/health",
     "criticality": "important"
   }
   ```
3. **Run analysis**: `npm run analyze:services`
   - Checks for circular deps
   - Updates dependency graph
4. **Create service** using registry as template
5. **Run health check**: `npm run health:check`
6. **Commit** with checklist completed

---

## Open Questions

1. **Should we enforce registry.json validation in CI?**
   - Pro: Catches missing health checks
   - Con: Adds CI complexity

2. **How to handle service versioning?**
   - Do we version services independently?
   - Or version the entire monorepo?

3. **Service mesh future?**
   - At what scale do we need Istio/Linkerd?
   - For now: Simple health checks sufficient

---

## Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [ARCHITECTURE_RESET_ANALYSIS.md](ARCHITECTURE_RESET_ANALYSIS.md) - Service consolidation plan
- [docs/adr/ADR-004-microservices-event-driven.md](adr/ADR-004-microservices-event-driven.md) - Why microservices

---

**Next Steps**: Review this framework, approve Phase 1, begin implementation.
