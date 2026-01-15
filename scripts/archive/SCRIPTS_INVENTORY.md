# Scripts Inventory & Organization Plan

**Created**: 2026-01-08
**Purpose**: Document all scripts, identify what we actually use, and plan cleanup

---

## 📊 Current State: 67 Scripts

### Data Generation/Seeding (16 scripts) 🔴 HIGH CLUTTER

| Script | Size | Purpose | Status | Keep? |
|--------|------|---------|--------|-------|
| **seed-test-data.js** | 24K | **API-based seeding for dev/test** | ✅ ACTIVE | ✅ YES - Primary |
| populate-fresh-database.js | 12K | API-based seeding (8 users, 3 communities) | ✅ Used recently | ⚠️ REDUNDANT with seed-test-data.js? |
| generate-realistic-data.ts | 48K | Large-scale data generation (2000 users) | ⚠️ Unclear | ⚠️ Consolidate? |
| populate-polymorphic-data.js | 12K | Polymorphic request examples | ⚠️ Unclear | ⚠️ Merge into main? |
| generate-large-dataset.js | 9K | Performance testing (100-500 requests) | ⚠️ Unclear | ⚠️ Keep separate? |
| seed-production-data.sh | 4K | Production seeding wrapper | ✅ WORKING | ✅ YES |
| seed-production-local.sh | 5K | Local production seeding | ✅ WORKING | ✅ YES |
| seed-production-remote.sh | 4K | Remote production seeding | ✅ WORKING | ✅ YES (SSH) |
| seed-production-remote.ps1 | 3K | Remote production (Windows) | ✅ WORKING | ✅ YES (SSH Windows) |
| **seed-production-screen.sh** | 3K | **Production seeding in screen** | ✅ WORKING | ✅ YES (BEST) |
| seed-production-screen.ps1 | 3K | Production seeding (Windows) | ✅ WORKING | ✅ YES |
| seed-with-no-rate-limit.sh | 3K | Seeding without rate limits | ⚠️ Unclear | ? |
| seed-test-data.sh | 1K | Wrapper for seed-test-data.js | ⚠️ Unclear | ? |
| seed-test-data.bat | 1K | Windows wrapper | ⚠️ Unclear | ? |
| seed-test-data.sql | 10K | Direct SQL seeding | ⚠️ Unclear | ? |
| seed-direct-sql.sh | 2K | Direct SQL wrapper | ⚠️ Unclear | ? |

**Three Seeding Approaches** (all needed):
1. **DB-based**: seed-test-data.js (direct SQL - fastest for dev)
2. **API-based**: populate-fresh-database.js (tests API layer)
3. **Config-based**: Production scripts call tests/scripts/seed-data.ts (production profiles)

**Production Scripts**: All 6 variants working correctly - keep for different deployment scenarios

---

### Testing (4 scripts) ✅ ORGANIZED

| Script | Size | Purpose | Status | Keep? |
|--------|------|---------|--------|-------|
| **test-all.bat** | ? | Run full test suite (Windows) | ✅ ACTIVE | ✅ YES |
| **test-all.sh** | ? | Run full test suite (Unix) | ✅ ACTIVE | ✅ YES |
| test-local.bat | ? | Quick dev testing (Windows) | ✅ ACTIVE | ✅ YES |
| test-local.sh | ? | Quick dev testing (Unix) | ✅ ACTIVE | ✅ YES |

**Recommendation**: Keep all - these are documented in DEVELOPMENT_PROCESS.md

---

### Deployment (10 scripts) 🔴 HIGH CLUTTER

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| deploy-qa.sh | QA deployment | ⚠️ Unclear | ? |
| deploy-frontend-debug.sh | Frontend debugging | ⚠️ Unclear | ? |
| deploy-frontend-fixes.sh | Frontend fixes | ⚠️ Unclear | ? |
| deploy-frontend-geocoding-fix.sh | Geocoding fix | ⚠️ Unclear | ? |
| deploy-frontend-geocoding-fix.ps1 | Geocoding fix (Windows) | ⚠️ Unclear | ? |
| fix-frontend-production.sh | Production frontend fix | ⚠️ Unclear | ? |
| fix-nginx-api-routes.sh | Nginx routing fix | ⚠️ Unclear | ? |
| fix-rate-limit-production.sh | Rate limit fix | ⚠️ Unclear | ? |
| fix-production-database.sh | Database fixes | ⚠️ Unclear | ? |
| init-production-database.sh | Initialize production DB | ⚠️ Unclear | ? |

**Recommendation**: These look like one-time fixes. Archive or delete?

---

### Diagnostics (14 scripts) ⚠️ MEDIUM CLUTTER

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| check-api-errors.sh | Check API errors | ⚠️ Unclear | ? |
| check-containers.sh | Check Docker containers | ✅ Useful | ✅ YES |
| check-database-setup.sh | Verify DB setup | ✅ Useful | ✅ YES |
| check-nginx-config.sh | Verify nginx | ✅ Useful | ✅ YES |
| check-production-schema.sh | Production schema check | ⚠️ Unclear | ? |
| check-production-triggers.sh | Trigger verification | ⚠️ Unclear | ? |
| check-recent-requests.sh | Recent requests check | ⚠️ Unclear | ? |
| check-trigger-function.sh | Trigger function check | ⚠️ Unclear | ? |
| diagnose-500-errors.sh | Debug 500 errors | ⚠️ One-time? | ? |
| diagnose-feed-issue.sh | Feed debugging | ⚠️ One-time? | ? |
| diagnose-frontend-request.js | Frontend debugging | ⚠️ One-time? | ? |
| production-diagnostics.sh | Production diagnostics | ✅ Useful | ✅ YES |
| standardize-responses.js | Response standardization | ⚠️ Unclear | ? |
| validate-context-docs.bat | Validate CONTEXT.md files | ✅ Useful | ✅ YES |
| validate-context-docs.sh | Validate CONTEXT.md files | ✅ Useful | ✅ YES |

**Recommendation**: Keep diagnostic scripts, archive one-time fixes

---

### Maintenance (7 scripts) ⚠️ MEDIUM CLUTTER

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| truncate-database.bat | Clear database (Windows) | ✅ Useful | ✅ YES |
| truncate-database.sh | Clear database (Unix) | ✅ Useful | ✅ YES |
| truncate-database.sql | SQL for clearing | ✅ Useful | ✅ YES |
| restart-services.sh | Restart Docker services | ✅ Useful | ✅ YES |
| run-migrations.sh | Run DB migrations | ✅ Useful | ✅ YES |
| fix-postgres-auth.sh | Fix Postgres auth | ⚠️ One-time? | ? |
| reset-postgres-password.sh | Reset DB password | ⚠️ One-time? | ? |

**Recommendation**: Keep core maintenance, review one-time scripts

---

### Database Triggers/Fixes (3 scripts) ⚠️ ONE-TIME FIXES

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| fix-message-expires-trigger.sh | Fix message expiry trigger | ⚠️ One-time | ❌ Archive |
| fix-request-expires-trigger.sh | Fix request expiry trigger | ⚠️ One-time | ❌ Archive |
| sync-database-password.sh | Sync DB password | ⚠️ One-time | ❌ Archive |

**Recommendation**: Archive - these were specific bug fixes

---

### GitHub Integration (4 scripts) ✅ ORGANIZED

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| create-github-issues.ps1 | Create GitHub issues | ✅ Useful | ✅ YES |
| create-github-issues.sh | Create GitHub issues | ✅ Useful | ✅ YES |
| create-github-labels.ps1 | Create GitHub labels | ✅ Useful | ✅ YES |
| create-github-labels.sh | Create GitHub labels | ✅ Useful | ✅ YES |
| add-labels-to-issues.ps1 | Add labels to issues | ✅ Useful | ✅ YES |

**Recommendation**: Keep all - useful for project management

---

### Claude Transcript Capture (3 scripts) ✅ ORGANIZED

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| **capture-claude-sessions-v2.ps1** | Capture sessions (v2) | ✅ ACTIVE | ✅ YES |
| capture-claude-sessions.bat | Wrapper (batch) | ✅ ACTIVE | ✅ YES |
| capture-claude-sessions.ps1 | Old version | ⚠️ Deprecated | ❌ Remove? |
| sync-claude-transcripts.ps1 | Sync to separate repo | ✅ ACTIVE | ✅ YES |

**Recommendation**: Remove old v1, keep v2 + wrappers

---

### Git Hooks (3 scripts) ✅ ORGANIZED

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| setup-git-hooks.sh | Setup pre-commit hooks | ✅ Useful | ✅ YES |
| install-git-hooks.sh | Install hooks | ✅ Useful | ✅ YES |
| install-git-hooks.bat | Install hooks (Windows) | ✅ Useful | ✅ YES |
| setup-production-hooks.sh | Production hooks | ⚠️ Unclear | ? |

**Recommendation**: Keep all except review production hooks

---

### Secrets Management (2 scripts) ⚠️ UNCLEAR

| Script | Purpose | Status | Keep? |
|--------|---------|--------|-------|
| secrets-rotate.sh | Rotate secrets | ⚠️ Unclear | ? |
| secrets-rollback.sh | Rollback secrets | ⚠️ Unclear | ? |

**Recommendation**: Document or archive

---

### Data Configs (NOT scripts - configuration files)

| File | Purpose | Status |
|------|---------|--------|
| scripts/data-configs/dev.json | Dev data config | ⚠️ Created but unused |
| scripts/data-configs/test.json | Test data config | ⚠️ Created but unused |
| scripts/data-configs/staging.json | Staging data config | ⚠️ Created but unused |
| scripts/data-configs/production.json | Production data config | ⚠️ Created but unused |
| scripts/data-configs/config.types.ts | TypeScript types | ⚠️ Created but unused |

**Status**: Created during SYNTHETIC_DATA_PLAN Phase 1 but never integrated
**Recommendation**: Either finish the consolidation OR remove these configs

---

## 🎯 Recommended Organization

### Keep & Organize

```
scripts/
├── data/                     # Data generation (consolidated to 2-3)
│   ├── seed-test-data.js    # Primary dev/test seeding
│   ├── generate-realistic-data.ts  # Large-scale production
│   └── generate-large-dataset.js   # Performance testing (optional)
│
├── testing/                  # Test suite runners
│   ├── test-all.bat
│   ├── test-all.sh
│   ├── test-local.bat
│   └── test-local.sh
│
├── diagnostics/             # Health checks & debugging
│   ├── check-containers.sh
│   ├── check-database-setup.sh
│   ├── check-nginx-config.sh
│   ├── production-diagnostics.sh
│   ├── validate-context-docs.bat
│   └── validate-context-docs.sh
│
├── maintenance/             # Regular maintenance tasks
│   ├── truncate-database.*
│   ├── restart-services.sh
│   └── run-migrations.sh
│
├── github/                  # GitHub integration
│   ├── create-github-issues.*
│   ├── create-github-labels.*
│   └── add-labels-to-issues.ps1
│
├── claude/                  # Claude transcript capture
│   ├── capture-claude-sessions-v2.ps1
│   ├── capture-claude-sessions.bat
│   └── sync-claude-transcripts.ps1
│
└── hooks/                   # Git hooks setup
    ├── setup-git-hooks.sh
    ├── install-git-hooks.*
    └── setup-production-hooks.sh
```

### Archive (One-Time Fixes)

```
scripts/archive/
├── deployment-fixes/       # One-time deployment fixes
│   ├── deploy-frontend-*.sh
│   ├── fix-frontend-production.sh
│   ├── fix-nginx-api-routes.sh
│   └── fix-rate-limit-production.sh
│
├── database-fixes/         # One-time DB fixes
│   ├── fix-message-expires-trigger.sh
│   ├── fix-request-expires-trigger.sh
│   ├── fix-postgres-auth.sh
│   └── sync-database-password.sh
│
└── deprecated/            # Old versions
    └── capture-claude-sessions.ps1 (v1)
```

### Delete (Redundant)

- Multiple seed-production-* variants (keep best one)
- populate-fresh-database.js (if redundant with seed-test-data.js)
- populate-polymorphic-data.js (merge into main seeder)
- One-time diagnostic scripts (diagnose-*.sh)

---

## ❓ Questions to Answer

1. **Which seeding script do we actually use regularly?**
   - seed-test-data.js?
   - populate-fresh-database.js?
   - Both?

2. **Production seeding - which variant?**
   - seed-production-data.sh?
   - seed-production-remote.sh?
   - seed-production-screen.sh?

3. **Are deployment scripts one-time fixes or reusable?**
   - Should we keep any deploy-* or fix-* scripts?

4. **Do we need the data-configs/ created earlier?**
   - Finish the consolidation plan?
   - Or remove and stick with current scripts?

---

## 📝 Next Steps

1. **Answer questions above** (need user input)
2. **Create organized directory structure**
3. **Move scripts to categories**
4. **Update documentation** (README for each category)
5. **Delete/archive redundant scripts**
6. **Update any references** (other docs pointing to moved scripts)

---

**Last Updated**: 2026-01-08
**Status**: Inventory Complete - Awaiting Decisions
