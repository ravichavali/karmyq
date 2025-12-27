# Karmyq Documentation

**Complete documentation for the Karmyq mutual aid platform**

**Current Version**: v8.0.0
**Last Updated**: 2025-12-27

---

## 🚀 Quick Start

**New to Karmyq? Start here:**

1. **[getting-started/](getting-started/)** - Complete onboarding path
2. **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current features and roadmap
3. **[CLAUDE.md](../CLAUDE.md)** - Quick reference for AI assistants

---

## 📚 Documentation Structure

### 🎯 Getting Started
**[getting-started/](getting-started/)** - Everything you need to start developing

- **[README.md](getting-started/README.md)** - Onboarding guide (start here!)
- **[GETTING_STARTED.md](getting-started/GETTING_STARTED.md)** - Complete setup guide
- **[DOCKER_SETUP.md](getting-started/DOCKER_SETUP.md)** - Docker configuration
- **[ENVIRONMENT_VARIABLES.md](getting-started/ENVIRONMENT_VARIABLES.md)** - Environment setup
- **[MOBILE_DEVELOPMENT.md](getting-started/MOBILE_DEVELOPMENT.md)** - React Native/Expo guide
- **[CROSS_PLATFORM_GUIDE.md](getting-started/CROSS_PLATFORM_GUIDE.md)** - Multi-platform development
- **[REQUIREMENTS_SETUP.md](getting-started/REQUIREMENTS_SETUP.md)** - Requirements management workflow

### 🏗️ Architecture
**[architecture/](architecture/)** - System design and structure

- **[ARCHITECTURE.md](architecture/ARCHITECTURE.md)** ⭐ **Authoritative** - Complete system architecture (1000+ lines)
- **[SERVICE_DEPENDENCIES.md](architecture/SERVICE_DEPENDENCIES.md)** - Service dependency graph
- **[DATA_MODEL.md](architecture/DATA_MODEL.md)** - Database schema with ERD (29 tables, 9 schemas)
- **[RLS_POLICIES.md](architecture/RLS_POLICIES.md)** - Row-Level Security explained
- **[V7_UI_ARCHITECTURE.md](architecture/V7_UI_ARCHITECTURE.md)** - Social Karma v2.0 dashboard

### 💻 Development
**[development/](development/)** - Developer guides and workflows

- **[creating-a-service.md](development/creating-a-service.md)** - Step-by-step new service guide
- **[implementing-logging.md](development/implementing-logging.md)** - Structured logging
- **[testing-guide.md](development/testing-guide.md)** - Testing strategy
- **[workflow.md](development/workflow.md)** - Git workflow and best practices
- **[turborepo.md](development/turborepo.md)** - Monorepo tooling

### 🧪 Testing
**[testing/](testing/)** - Test infrastructure and guides

- **[README.md](testing/README.md)** ⭐ **Authoritative** - Complete testing index
- **[V8_TESTING_GUIDE.md](testing/V8_TESTING_GUIDE.md)** - Primary testing guide (realistic data, personas, performance)
- **[LOCAL_TESTING.md](testing/LOCAL_TESTING.md)** - Running tests locally
- **[TEST_DATA_STRATEGY.md](testing/TEST_DATA_STRATEGY.md)** - Test data generation
- **[SOCIAL_KARMA_V2_TESTING.md](testing/SOCIAL_KARMA_V2_TESTING.md)** - Feature-specific tests

### 🔧 Operations
**[operations/](operations/)** - DevOps, deployment, and observability

- **[logging-and-monitoring.md](operations/logging-and-monitoring.md)** - Complete observability guide
- **[log-levels.md](operations/log-levels.md)** - Log verbosity configuration
- **[ci-cd.md](operations/ci-cd.md)** - CI/CD pipeline
- **[SELF_HOSTING_GUIDE.md](operations/SELF_HOSTING_GUIDE.md)** - Deploy your own instance
- **[QA_DEPLOYMENT.md](operations/QA_DEPLOYMENT.md)** - QA environment deployment
- **[SECRETS_MANAGEMENT.md](operations/SECRETS_MANAGEMENT.md)** - Secrets and credentials
- **[GITHUB_SELF_HOSTED_RUNNER.md](operations/GITHUB_SELF_HOSTED_RUNNER.md)** - Self-hosted CI runners

### 📖 Guides
**[guides/](guides/)** - Feature and usage guides

- **[EPHEMERAL_DATA_GUIDE.md](guides/EPHEMERAL_DATA_GUIDE.md)** - TTL and reputation decay
- **[DASHBOARD_GUIDE.md](guides/DASHBOARD_GUIDE.md)** - Dashboard development quick reference
- **[POLYMORPHIC_REQUESTS_GUIDE.md](guides/POLYMORPHIC_REQUESTS_GUIDE.md)** - Advanced request patterns
- **[PERFORMANCE_OPTIMIZATION.md](guides/PERFORMANCE_OPTIMIZATION.md)** - Performance best practices

### ✨ Features
**[features/](features/)** - Feature-specific documentation

- **[social-karma-v2/](features/social-karma-v2/)** - Social Karma v2.0 complete docs (v7.0)
  - Implementation guide
  - UI architecture
  - Component reference
  - Testing coverage
- **[SOCIAL_GRAPH_TRUST_PATHS.md](features/SOCIAL_GRAPH_TRUST_PATHS.md)** - Trust path algorithms (planned)

### 🗂️ Requirements
**[requirements/](requirements/)** - Functional and technical requirements

- **[functional/](requirements/functional/)** - FR-001 through FR-010 (user-facing features)
- **[technical/](requirements/technical/)** - TR-001 through TR-005 (technical architecture)
- **[non-functional/](requirements/non-functional/)** - Performance, security, scalability

### 📦 Service Documentation
**Each service has CONTEXT.md + README.md**

#### Backend Services (9 total)
1. **[Auth Service](../services/auth-service/CONTEXT.md)** (3001) - Authentication & JWT
2. **[Community Service](../services/community-service/CONTEXT.md)** (3002) - Communities & members
3. **[Request Service](../services/request-service/CONTEXT.md)** (3003) - Help requests & offers
4. **[Reputation Service](../services/reputation-service/CONTEXT.md)** (3004) - Karma & trust scores
5. **[Notification Service](../services/notification-service/CONTEXT.md)** (3005) - Real-time notifications
6. **[Messaging Service](../services/messaging-service/CONTEXT.md)** (3006) - Chat & conversations
7. **[Feed Service](../services/feed-service/CONTEXT.md)** (3007) - Personalized feed
8. **[Cleanup Service](../services/cleanup-service/CONTEXT.md)** (3008) - Data expiration & decay
9. **[Geocoding Service](../services/geocoding-service/CONTEXT.md)** (3009) - Address geocoding cache

#### Frontend Applications
- **[Web Frontend](../apps/frontend/README.md)** (3000) - Next.js web app
- **[Mobile App](../apps/mobile/README.md)** - React Native + Expo

### 🗃️ Archive
**[archive/](archive/)** - Historical documentation (preserved for context)

- **[reviews/](archive/reviews/)** - Architectural reviews (Gemini, v6.0)
- **[planning/](archive/planning/)** - Historical planning documents
- **[V6_MIGRATION_GUIDE.md](archive/V6_MIGRATION_GUIDE.md)** - v6.0 migration guide
- **[TESTING_STRATEGY.md](archive/TESTING_STRATEGY.md)** - v5.4.0 testing strategy (outdated)

---

## 🎯 Core Documentation (Root Level)

### Primary References
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current status (v8.0), roadmap, milestones
- **[MULTI_TENANT_GUIDE.md](MULTI_TENANT_GUIDE.md)** - Multi-tenant architecture deep dive
- **[TDD_WORKFLOW.md](TDD_WORKFLOW.md)** - Test-Driven Development methodology
- **[TEST_SUMMARY.md](TEST_SUMMARY.md)** - Unit test implementation summary (163 tests)
- **[API_RESPONSE_STANDARD.md](API_RESPONSE_STANDARD.md)** - API response format conventions
- **[CLAUDE_SESSION_WORKFLOW.md](CLAUDE_SESSION_WORKFLOW.md)** - Claude Code session management

---

## 🔍 Quick Navigation

### I want to...

**...get started developing**
→ [getting-started/README.md](getting-started/README.md)

**...understand the architecture**
→ [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)

**...run tests**
→ [testing/README.md](testing/README.md)

**...create a new service**
→ [development/creating-a-service.md](development/creating-a-service.md)

**...understand multi-tenancy**
→ [MULTI_TENANT_GUIDE.md](MULTI_TENANT_GUIDE.md)

**...deploy to production**
→ [operations/SELF_HOSTING_GUIDE.md](operations/SELF_HOSTING_GUIDE.md)

**...understand a specific service**
→ [../services/{service-name}/CONTEXT.md](../services/)

**...see what's been built**
→ [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

## 📊 Current Status (v8.0.0)

### What's Working Right Now ✅

- **8 Production-Ready Services** - All with complete CONTEXT.md documentation
- **Multi-Tenant SaaS** - Row-Level Security (RLS) with community isolation
- **Comprehensive Testing** - 163 unit tests (98%+ coverage), 126 integration tests, E2E tests
- **TDD Framework** - Jest + TypeScript with custom matchers
- **Ephemeral Data** - Configurable TTL (60 days default)
- **Reputation Decay** - Time-based karma decay (6-month half-life)
- **Social Karma v2.0 UI** - Modern 3-column dashboard with real-time updates
- **Full Observability** - Grafana/Loki/Prometheus stack
- **CI/CD Pipeline** - GitHub Actions with automated testing

### Known Issues ⚠️

- **Mobile App**: Not tested on native simulators (web version fully functional)

### Next Steps 🚀

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for complete roadmap.

---

## 🎓 Learning Path

### Beginner (New to Project)
1. [getting-started/README.md](getting-started/README.md) - Start here
2. [PROJECT_STATUS.md](PROJECT_STATUS.md) - What's been built
3. [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) - How it works
4. [testing/README.md](testing/README.md) - How to test

### Intermediate (Ready to Contribute)
1. [development/workflow.md](development/workflow.md) - Git workflow
2. [development/creating-a-service.md](development/creating-a-service.md) - Create services
3. [MULTI_TENANT_GUIDE.md](MULTI_TENANT_GUIDE.md) - Multi-tenancy deep dive
4. [TDD_WORKFLOW.md](TDD_WORKFLOW.md) - Test-driven development

### Advanced (Architectural Changes)
1. [architecture/SERVICE_DEPENDENCIES.md](architecture/SERVICE_DEPENDENCIES.md) - Service interactions
2. [architecture/DATA_MODEL.md](architecture/DATA_MODEL.md) - Database design
3. [architecture/RLS_POLICIES.md](architecture/RLS_POLICIES.md) - Security model
4. [requirements/](requirements/) - Requirements management

---

## 💡 Documentation Principles

### ⭐ Authoritative Documents
Marked with ⭐ - these are the **single source of truth**:
- [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) - System architecture
- [testing/README.md](testing/README.md) - Testing infrastructure

### 🗃️ Historical vs Active
- **Active docs**: Current, maintained, reflect v8.0
- **Archived docs**: [archive/](archive/) - Historical context preserved

### 🔗 Service Documentation
Every production service has:
- **CONTEXT.md** - Complete service documentation
- **README.md** - Quick reference and API endpoints

---

## 🆘 Getting Help

1. **Documentation Issues**: Check this README index
2. **Setup Problems**: See [getting-started/](getting-started/)
3. **Service Questions**: Check service CONTEXT.md files
4. **Architecture Questions**: See [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)
5. **Testing Issues**: See [testing/README.md](testing/README.md)

---

## 📖 External Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - Database
- [Next.js Documentation](https://nextjs.org/docs) - Web frontend
- [React Native Documentation](https://reactnative.dev/) - Mobile app
- [Expo Documentation](https://docs.expo.dev/) - Mobile platform
- [Grafana Documentation](https://grafana.com/docs/) - Observability
- [Docker Documentation](https://docs.docker.com/) - Containerization
- [Playwright Documentation](https://playwright.dev) - E2E testing
- [Jest Documentation](https://jestjs.io/) - Unit testing

---

**Version**: 8.0.0
**Last Updated**: 2025-12-27
**Maintained by**: Karmyq Development Team
