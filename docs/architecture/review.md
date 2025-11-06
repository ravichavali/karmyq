# Karmyq Architecture Review

**Date**: November 2025
**Version**: 2.0
**Purpose**: Ensure modular, community-friendly structure

---

## 📊 Current State Analysis

### ✅ What's Working Well

1. **Microservices Architecture**
   - Services are well-separated by domain
   - Each service has its own database schema
   - Clear API boundaries
   - Event-driven communication via Redis/Bull

2. **Infrastructure as Code**
   - Docker Compose for local development
   - Separate compose files for different stacks
   - PostgreSQL migrations tracked in version control

3. **Frontend Separation**
   - Next.js app completely separate from backend
   - Clear API client abstraction

4. **Observability**
   - Grafana/Loki/Prometheus stack
   - Structured logging foundation

### ⚠️ Issues Identified

#### 1. **Root Directory Clutter**
**Problem**: Too many files at root level (15+ files)
```
.
├── .env.example
├── docker-compose.yml
├── docker-compose.observability.yml
├── DEVELOPMENT_WORKFLOW.md
├── LOGGING-QUICK-START.md
├── OBSERVABILITY.md
├── README.md
├── STRUCTURE.md
├── start.sh
├── stop.sh
├── test-services.sh
├── package-lock.json (shouldn't be here)
└── ... more
```

**Impact**:
- Hard to navigate
- Unclear what's documentation vs. config vs. scripts
- New contributors feel overwhelmed

#### 2. **Documentation Fragmentation**
**Problem**: Multiple docs with overlapping content
- `README.md` - Getting started
- `STRUCTURE.md` - Project structure
- `DEVELOPMENT_WORKFLOW.md` - Development guide
- `OBSERVABILITY.md` - Logging guide
- `LOGGING-QUICK-START.md` - Quick logging reference

**Impact**:
- Duplication of information
- Hard to find the right doc
- Maintenance burden

#### 3. **Inconsistent Service Structure**
**Problem**: Services have different structures
```
auth-service/          ✅ Has tests, coverage
  ├── src/
  ├── tests/
  └── coverage/

community-service/     ⚠️ Has tests, no coverage
  ├── src/
  └── tests/

messaging-service/     ❌ No tests
  └── src/

matching-service/      ❌ Empty (not implemented)
  └── logs/
```

**Impact**:
- Hard to maintain consistency
- Testing coverage varies
- No clear template for new services

#### 4. **Shared Code Not Utilized**
**Problem**: `/shared` folder exists but isn't used
```
shared/
├── api/         (empty or minimal use)
├── constants/   (empty or minimal use)
└── types/       (empty or minimal use)
```

**Impact**:
- Code duplication across services
- Type definitions repeated
- No single source of truth

#### 5. **Mobile App Skeleton**
**Problem**: `/mobile` exists but incomplete
```
mobile/
├── src/
│   ├── context/
│   └── screens/
└── (no package.json, no build config)
```

**Impact**:
- Unclear if this is active development or future work
- Takes up space in repo

#### 6. **Context Directory Mystery**
**Problem**: `/Context/mnt/user-data/` - unclear purpose
**Impact**: Confusion for contributors

#### 7. **Scripts Without Organization**
**Problem**: Scripts at root and in `/scripts`
```
Root:
  ├── start.sh
  ├── stop.sh
  └── test-services.sh

scripts/
  ├── setup-logging.sh
  ├── generate-test-data.js
  └── migrate-skills-from-bio.js
```

**Impact**: Hard to find the right script

---

## 🎯 Recommended Architecture

### Proposed Directory Structure

```
karmyq/
│
├── docs/                          # 📚 All documentation
│   ├── README.md                  # Main entry point (link to others)
│   ├── getting-started/
│   │   ├── installation.md
│   │   ├── quickstart.md
│   │   └── environment-setup.md
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── services.md
│   │   ├── database-schema.md
│   │   └── event-flow.md
│   ├── development/
│   │   ├── workflow.md
│   │   ├── coding-standards.md
│   │   ├── testing.md
│   │   └── contributing.md
│   ├── operations/
│   │   ├── deployment.md
│   │   ├── monitoring.md
│   │   ├── logging.md
│   │   └── troubleshooting.md
│   └── api/
│       ├── auth-service.md
│       ├── community-service.md
│       └── ...
│
├── services/                      # 🔧 Backend microservices
│   ├── _template/                 # Template for new services
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── README.md
│   ├── auth-service/
│   ├── community-service/
│   ├── request-service/
│   ├── matching-service/
│   ├── reputation-service/
│   ├── notification-service/
│   └── messaging-service/
│
├── apps/                          # 🎨 Client applications
│   ├── web/                       # Frontend (rename from 'frontend')
│   │   ├── src/
│   │   ├── public/
│   │   └── README.md
│   └── mobile/                    # Mobile app (move or remove)
│       └── README.md (Future plans or "Not implemented")
│
├── packages/                      # 📦 Shared packages
│   ├── types/                     # Shared TypeScript types
│   │   ├── src/
│   │   └── package.json
│   ├── utils/                     # Shared utilities
│   │   ├── src/
│   │   └── package.json
│   └── constants/                 # Shared constants
│       ├── src/
│       └── package.json
│
├── infrastructure/                # 🏗️ Infrastructure configs
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.observability.yml
│   │   └── docker-compose.prod.yml
│   ├── postgres/
│   │   ├── init.sql
│   │   └── migrations/
│   ├── nginx/
│   │   └── nginx.conf
│   ├── observability/
│   │   ├── grafana/
│   │   ├── loki/
│   │   └── prometheus/
│   └── kubernetes/ (future)
│
├── scripts/                       # 🛠️ Developer tools
│   ├── dev/
│   │   ├── start.sh
│   │   ├── stop.sh
│   │   ├── reset-db.sh
│   │   └── test-all.sh
│   ├── setup/
│   │   ├── setup-logging.sh
│   │   └── install-dependencies.sh
│   └── data/
│       ├── generate-test-data.js
│       └── seed-database.js
│
├── .github/                       # GitHub specific
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .vscode/                       # VS Code workspace settings
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
│
├── .env.example                   # Example environment variables
├── .gitignore
├── README.md                      # Project overview (link to docs/)
├── CONTRIBUTING.md                # How to contribute
├── LICENSE
└── package.json                   # Root workspace config (monorepo)
```

---

## 🔧 Proposed Changes

### Phase 1: Immediate Cleanup (1-2 hours)

1. **Consolidate Documentation**
   ```bash
   mkdir -p docs/getting-started docs/architecture docs/development docs/operations

   # Move and rename
   mv README.md docs/README.md
   mv STRUCTURE.md docs/architecture/overview.md
   mv DEVELOPMENT_WORKFLOW.md docs/development/workflow.md
   mv OBSERVABILITY.md docs/operations/logging.md
   mv LOGGING-QUICK-START.md docs/operations/logging-quickstart.md

   # Create new README.md at root (short, links to docs/)
   ```

2. **Organize Scripts**
   ```bash
   mkdir -p scripts/dev scripts/setup scripts/data

   mv start.sh scripts/dev/
   mv stop.sh scripts/dev/
   mv test-services.sh scripts/dev/
   mv scripts/setup-logging.sh scripts/setup/
   mv scripts/generate-test-data.js scripts/data/
   ```

3. **Move Infrastructure**
   ```bash
   mkdir infrastructure/docker

   mv docker-compose*.yml infrastructure/docker/
   mv infrastructure/grafana infrastructure/observability/
   mv infrastructure/loki infrastructure/observability/
   mv infrastructure/prometheus infrastructure/observability/
   ```

4. **Clean Up Root**
   - Remove `package-lock.json` (shouldn't be at root)
   - Remove `Context/` folder (unclear purpose)
   - Move mobile to `apps/mobile` or remove if not planned

### Phase 2: Service Standardization (2-3 hours)

1. **Create Service Template**
   ```
   services/_template/
   ├── src/
   │   ├── index.ts
   │   ├── routes/
   │   ├── services/
   │   ├── database/
   │   └── utils/
   ├── tests/
   │   ├── unit/
   │   └── integration/
   ├── Dockerfile
   ├── package.json
   ├── tsconfig.json
   ├── jest.config.js
   ├── .eslintrc.js
   └── README.md
   ```

2. **Standardize Existing Services**
   - Add missing tests to all services
   - Add README.md to each service
   - Consistent package.json scripts
   - Add health check endpoints

3. **Document Service Creation**
   - Create `docs/development/creating-a-service.md`
   - Explain how to use the template

### Phase 3: Shared Packages (3-4 hours)

1. **Set Up Monorepo**
   ```json
   // Root package.json
   {
     "name": "karmyq",
     "private": true,
     "workspaces": [
       "services/*",
       "apps/*",
       "packages/*"
     ]
   }
   ```

2. **Create Shared Packages**
   ```typescript
   // packages/types/src/index.ts
   export interface User {
     id: string
     email: string
     name: string
   }

   export interface Community { ... }
   export interface Request { ... }
   ```

3. **Migrate Services to Use Shared Types**
   ```typescript
   // In services/auth-service
   import { User } from '@karmyq/types'
   ```

### Phase 4: Frontend Rename (1 hour)

```bash
mv frontend apps/web
# Update all references in docker-compose, etc.
```

### Phase 5: CI/CD Enhancement (2-3 hours)

1. **Add GitHub Actions**
   - Lint all services
   - Run all tests
   - Build Docker images
   - Deploy to staging

2. **Add Pre-commit Hooks**
   ```bash
   npm install -D husky lint-staged
   ```

---

## 📋 Migration Checklist

### Before Starting
- [ ] Commit all current work
- [ ] Create a new branch: `git checkout -b architecture-cleanup`
- [ ] Backup database if needed

### Phase 1: Documentation (30 min)
- [ ] Create `docs/` folder structure
- [ ] Move all markdown files to docs
- [ ] Update internal links
- [ ] Create new root README.md
- [ ] Test all doc links work

### Phase 2: Scripts (15 min)
- [ ] Create scripts subfolders
- [ ] Move scripts to appropriate folders
- [ ] Update docker-compose paths
- [ ] Test all scripts still work

### Phase 3: Infrastructure (15 min)
- [ ] Move docker-compose files
- [ ] Move observability configs
- [ ] Update all paths in compose files
- [ ] Test: `docker-compose up`

### Phase 4: Root Cleanup (10 min)
- [ ] Remove package-lock.json
- [ ] Remove or document Context folder
- [ ] Move or remove mobile folder
- [ ] Clean .gitignore

### Phase 5: Service Template (1 hour)
- [ ] Create _template service
- [ ] Document template usage
- [ ] Add to CONTRIBUTING.md

### Phase 6: Shared Packages (2 hours)
- [ ] Set up monorepo
- [ ] Create @karmyq/types package
- [ ] Migrate one service to use shared types
- [ ] Document shared package usage

### Testing After Each Phase
- [ ] All services start: `npm run dev`
- [ ] All tests pass: `npm test`
- [ ] Documentation accessible
- [ ] Scripts work from new locations

---

## 🎓 Benefits of This Structure

### For New Contributors
- **Clear entry point**: README → docs/getting-started
- **Easy to navigate**: Logical folder structure
- **Learn by example**: Service template shows best practices
- **Consistent patterns**: All services follow same structure

### For Maintainers
- **Less duplication**: Shared types and utils
- **Easier testing**: Consistent test structure
- **Better tooling**: Monorepo enables cross-service refactoring
- **Cleaner root**: Professional appearance

### For Operations
- **Clear infrastructure**: All configs in one place
- **Easy deployment**: Organized docker configs
- **Better monitoring**: Observability configs centralized

---

## 🚀 Quick Start After Reorganization

```bash
# 1. Clone and install
git clone https://github.com/your-org/karmyq.git
cd karmyq
npm install  # Installs all workspaces

# 2. Set up environment
cp .env.example .env

# 3. Start everything
npm run dev  # Starts all services + frontend

# 4. View docs
open docs/README.md

# 5. View logs
open http://localhost:3007  # Grafana
```

---

## 📝 Next Steps

**Immediate (Today)**
1. Review this proposal
2. Decide on scope (all phases or subset?)
3. Create backup branch

**Short-term (This Week)**
1. Execute Phase 1-3 (cleanup)
2. Update all documentation
3. Test everything still works

**Medium-term (Next 2 Weeks)**
1. Implement service standardization
2. Set up shared packages
3. Add comprehensive testing

**Long-term (Next Month)**
1. Implement matching-service
2. Add mobile app or remove
3. Production deployment guide

---

## ❓ Questions to Answer

1. **Mobile App**: Keep, implement, or remove?
2. **Context folder**: What is it? Keep or remove?
3. **Monorepo**: Use npm workspaces or Lerna/Turborepo?
4. **Testing**: What coverage target? (suggest 80%+)
5. **CI/CD**: GitHub Actions sufficient or need more?

---

## 📊 Success Metrics

After reorganization, we should have:
- ✅ < 5 files at root level
- ✅ All docs in `docs/` folder
- ✅ All services have tests
- ✅ Shared types used in all services
- ✅ CI/CD pipeline running
- ✅ Contributing guide for new developers

---

**Ready to proceed?** Let's discuss which phases to tackle first!
