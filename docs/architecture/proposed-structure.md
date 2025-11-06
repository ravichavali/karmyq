# Proposed Karmyq Structure - Visual Guide

## 🎯 Quick Comparison

### Current (Cluttered)
```
karmyq/
├── 📄 15+ files at root (confusing!)
├── 📚 5 different doc files (fragmented)
├── 🔧 services/ (inconsistent structure)
├── 📱 frontend/ (unclear it's a web app)
├── 📱 mobile/ (incomplete/unclear)
├── 📦 shared/ (not used)
└── 🤷 Context/ (mystery folder)
```

### Proposed (Organized)
```
karmyq/
├── 📚 docs/ (all documentation, organized)
├── 🔧 services/ (consistent, template-based)
├── 🎨 apps/ (clear: web, mobile)
├── 📦 packages/ (shared code, used everywhere)
├── 🏗️ infrastructure/ (all configs centralized)
└── 🛠️ scripts/ (organized by purpose)
```

---

## 📁 Detailed Proposed Structure

```
karmyq/
│
├── 📚 docs/                                    # Documentation Hub
│   ├── README.md ⭐                           # Start here!
│   │   ├── "What is Karmyq?"
│   │   ├── "Quick Start" → getting-started/
│   │   ├── "For Developers" → development/
│   │   └── "Architecture" → architecture/
│   │
│   ├── 🚀 getting-started/
│   │   ├── installation.md                    # Docker setup
│   │   ├── quickstart.md                      # 5-minute guide
│   │   └── environment-setup.md               # .env explained
│   │
│   ├── 🏛️ architecture/
│   │   ├── overview.md                        # System design
│   │   ├── services.md                        # Service descriptions
│   │   ├── database-schema.md                 # DB structure
│   │   ├── event-flow.md                      # Redis/Bull events
│   │   └── tech-stack.md                      # Technologies used
│   │
│   ├── 💻 development/
│   │   ├── workflow.md                        # Git flow, branches
│   │   ├── creating-a-service.md              # Use template
│   │   ├── testing.md                         # Test standards
│   │   ├── coding-standards.md                # ESLint, Prettier
│   │   └── contributing.md                    # PR process
│   │
│   ├── 🔧 operations/
│   │   ├── deployment.md                      # Production deploy
│   │   ├── monitoring.md                      # Grafana setup
│   │   ├── logging.md                         # Full logging guide
│   │   ├── logging-quickstart.md              # Quick reference
│   │   └── troubleshooting.md                 # Common issues
│   │
│   └── 📖 api/
│       ├── auth-service.md                    # API reference
│       ├── community-service.md
│       ├── request-service.md
│       └── ...
│
├── 🔧 services/                                # Backend Microservices
│   │
│   ├── _template/ ⭐                          # Copy this for new services!
│   │   ├── src/
│   │   │   ├── index.ts                       # Entry point
│   │   │   ├── routes/                        # Express routes
│   │   │   ├── services/                      # Business logic
│   │   │   ├── database/                      # DB queries
│   │   │   ├── utils/                         # Helpers
│   │   │   └── types/                         # Local types
│   │   ├── tests/
│   │   │   ├── unit/                          # Unit tests
│   │   │   └── integration/                   # Integration tests
│   │   ├── Dockerfile
│   │   ├── package.json                       # Dependencies
│   │   ├── tsconfig.json                      # TypeScript config
│   │   ├── jest.config.js                     # Test config
│   │   ├── .eslintrc.js                       # Linting
│   │   └── README.md                          # Service docs
│   │
│   ├── auth-service/                          # ✅ Fully implemented
│   │   ├── src/                               # User auth, JWT
│   │   ├── tests/                             # Has tests
│   │   └── coverage/                          # Test coverage
│   │
│   ├── community-service/                     # ✅ Implemented
│   ├── request-service/                       # ✅ Implemented
│   ├── matching-service/                      # ⚠️ To implement
│   ├── reputation-service/                    # ✅ Implemented
│   ├── notification-service/                  # ✅ Implemented
│   └── messaging-service/                     # ✅ Implemented
│
├── 🎨 apps/                                    # Client Applications
│   │
│   ├── web/                                    # Web Frontend (Next.js)
│   │   ├── src/
│   │   │   ├── components/                    # React components
│   │   │   ├── pages/                         # Next.js pages
│   │   │   ├── contexts/                      # React contexts
│   │   │   ├── lib/                           # API clients
│   │   │   └── styles/                        # CSS/Tailwind
│   │   ├── public/                            # Static assets
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── README.md                          # Frontend docs
│   │
│   └── mobile/                                 # Mobile App (Future)
│       └── README.md                          # "Coming soon" or plans
│
├── 📦 packages/                                # Shared Code (Monorepo)
│   │
│   ├── types/                                  # ⭐ Shared TypeScript types
│   │   ├── src/
│   │   │   ├── user.ts                        # User interfaces
│   │   │   ├── community.ts                   # Community interfaces
│   │   │   ├── request.ts                     # Request interfaces
│   │   │   └── index.ts                       # Export all
│   │   ├── package.json                       # @karmyq/types
│   │   └── tsconfig.json
│   │
│   ├── utils/                                  # Shared utilities
│   │   ├── src/
│   │   │   ├── validation.ts                  # Input validation
│   │   │   ├── date.ts                        # Date helpers
│   │   │   └── index.ts
│   │   └── package.json                       # @karmyq/utils
│   │
│   └── constants/                              # Shared constants
│       ├── src/
│       │   ├── skills.ts                      # Skill list
│       │   ├── urgency.ts                     # Urgency levels
│       │   └── index.ts
│       └── package.json                       # @karmyq/constants
│
├── 🏗️ infrastructure/                         # Infrastructure Configs
│   │
│   ├── docker/
│   │   ├── docker-compose.yml                 # Main compose
│   │   ├── docker-compose.dev.yml             # Dev overrides
│   │   ├── docker-compose.observability.yml   # Logging stack
│   │   └── docker-compose.prod.yml            # Production (future)
│   │
│   ├── postgres/
│   │   ├── init.sql                           # Schema init
│   │   └── migrations/                        # DB migrations
│   │       ├── 001_add_community_fields.sql
│   │       └── 002_add_skills.sql
│   │
│   ├── nginx/
│   │   └── nginx.conf                         # Reverse proxy (prod)
│   │
│   ├── observability/
│   │   ├── grafana/
│   │   │   └── provisioning/                  # Datasources
│   │   ├── loki/
│   │   │   ├── loki-config.yml               # Loki settings
│   │   │   └── promtail-config.yml           # Log collector
│   │   └── prometheus/
│   │       └── prometheus.yml                 # Metrics config
│   │
│   └── kubernetes/                             # Future K8s configs
│       ├── deployments/
│       └── services/
│
├── 🛠️ scripts/                                # Developer Tools
│   │
│   ├── dev/                                    # Development scripts
│   │   ├── start.sh                           # Start all services
│   │   ├── stop.sh                            # Stop all
│   │   ├── restart.sh                         # Restart specific service
│   │   ├── logs.sh                            # View logs
│   │   ├── reset-db.sh                        # Drop and recreate DB
│   │   └── test-all.sh                        # Run all tests
│   │
│   ├── setup/                                  # One-time setup
│   │   ├── install-dependencies.sh            # npm install all
│   │   ├── setup-logging.sh                   # Create log dirs
│   │   ├── setup-git-hooks.sh                 # Install husky
│   │   └── first-time-setup.sh                # Complete setup
│   │
│   └── data/                                   # Database tools
│       ├── generate-test-data.js              # Seed test data
│       ├── seed-database.js                   # Initial data
│       └── backup-db.sh                       # Backup script
│
├── .github/                                    # GitHub Configuration
│   ├── workflows/
│   │   ├── ci.yml                             # Run tests on PR
│   │   ├── deploy.yml                         # Deploy on merge
│   │   └── lint.yml                           # Lint code
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .vscode/                                    # VS Code Settings
│   ├── settings.json                          # Workspace settings
│   ├── extensions.json                        # Recommended extensions
│   └── launch.json                            # Debugging configs
│
├── .env.example                                # Environment template
├── .gitignore                                  # Git ignore rules
├── package.json ⭐                            # Root monorepo config
├── README.md                                   # Project overview
├── CONTRIBUTING.md                             # Contribution guide
└── LICENSE                                     # MIT license
```

---

## 🔄 Usage Examples

### For New Contributors

```bash
# 1. First time setup
git clone https://github.com/your-org/karmyq.git
cd karmyq
./scripts/setup/first-time-setup.sh

# 2. Read the docs
cat README.md                          # Overview
open docs/getting-started/quickstart.md  # Get started

# 3. Start development
npm run dev                            # Starts everything

# 4. Make changes
# ... edit code ...

# 5. Run tests
npm test                               # All tests
npm test -- --watch                    # Watch mode
```

### For Service Development

```bash
# Create new service
cp -r services/_template services/my-new-service
cd services/my-new-service

# Update package.json name
# Implement your service
# Add tests
npm test

# Add to docker-compose
# Update docs/api/my-new-service.md
```

### For Using Shared Packages

```typescript
// In any service
import { User, Community } from '@karmyq/types'
import { validateEmail } from '@karmyq/utils'
import { URGENCY_LEVELS } from '@karmyq/constants'

const user: User = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User'
}

if (validateEmail(user.email)) {
  // ...
}
```

---

## 📊 Benefits Visualization

### Current Problems
```
❌ "Where's the getting started guide?"
   → 5 different docs, hard to find

❌ "How do I create a new service?"
   → No template, inconsistent structure

❌ "Why are types defined in every service?"
   → No shared packages

❌ "Where do I run scripts from?"
   → Some at root, some in /scripts
```

### After Reorganization
```
✅ "Where's the getting started guide?"
   → README.md → docs/getting-started/

✅ "How do I create a new service?"
   → Copy services/_template/

✅ "Why are types defined in every service?"
   → Import from @karmyq/types

✅ "Where do I run scripts from?"
   → All in scripts/, organized by purpose
```

---

## 🎓 Learning Path for New Contributors

```
1. Start Here
   └── README.md
       ├── What is Karmyq?
       ├── Tech Stack
       └── Quick Links

2. Get Running
   └── docs/getting-started/
       ├── installation.md      (15 min)
       ├── quickstart.md        (5 min)
       └── environment-setup.md (10 min)

3. Understand Architecture
   └── docs/architecture/
       ├── overview.md          (System design)
       └── services.md          (What each service does)

4. Start Contributing
   └── docs/development/
       ├── workflow.md          (Git flow)
       ├── creating-a-service.md
       └── contributing.md

5. Reference as Needed
   └── docs/api/               (API docs)
   └── docs/operations/        (Ops guides)
```

---

## 🚀 Migration Path

### Step 1: Backup (5 min)
```bash
git checkout -b architecture-cleanup
git tag backup-before-cleanup
```

### Step 2: Move Docs (30 min)
```bash
mkdir -p docs/{getting-started,architecture,development,operations,api}
# Move files
# Update links
# Test
```

### Step 3: Move Scripts (15 min)
```bash
mkdir -p scripts/{dev,setup,data}
# Move scripts
# Update paths in docker-compose
# Test
```

### Step 4: Move Infrastructure (15 min)
```bash
mkdir infrastructure/docker infrastructure/observability
# Move files
# Update docker-compose paths
# Test: docker-compose up
```

### Step 5: Create Service Template (1 hour)
```bash
# Create services/_template
# Document usage
# Add to CONTRIBUTING.md
```

### Step 6: Set Up Monorepo (2 hours)
```bash
# Create packages/
# Create shared types
# Migrate one service
# Test
```

---

## ✅ Success Checklist

After migration, verify:

- [ ] `npm install` works at root
- [ ] `npm run dev` starts all services
- [ ] `npm test` runs all tests
- [ ] All docs accessible and links work
- [ ] Scripts work from new locations
- [ ] Docker Compose works
- [ ] Grafana/Loki accessible
- [ ] New contributor can follow docs and get running
- [ ] Service template works for creating new service

---

**Ready to clean up?** Let me know which phases you want to tackle!
