# Karmyq Documentation

Complete documentation for the Karmyq mutual aid platform.

**Current Version**: v6.0.0
**Last Updated**: 2025-12-05

## 🚀 Quick Start

- **[Getting Started](GETTING_STARTED.md)** - Set up and run Karmyq locally
- **[Project Status](PROJECT_STATUS.md)** - Current features, roadmap, and statistics
- **[v6.0 Migration Guide](V6_MIGRATION_GUIDE.md)** - Upgrade from v5.1.0 to v6.0
- **[Main README](../README.md)** - Project overview
- **[Contributing](../CONTRIBUTING.md)** - How to contribute

## 📚 Core Guides

### Multi-Tenant Architecture (v4.0.0+)
- **[Multi-Tenant Guide](MULTI_TENANT_GUIDE.md)** - Complete guide to multi-tenant SaaS architecture
  - Row-Level Security (RLS)
  - Multi-community JWT
  - Middleware chain
  - Developer workflows

### Ephemeral Data & Reputation Decay (v5.1.0+)
- **[Ephemeral Data Guide](guides/EPHEMERAL_DATA_GUIDE.md)** - Ephemeral data and reputation decay
  - TTL configuration
  - Reputation decay formula
  - Activity tracking
  - Cleanup jobs

### Platform-Specific
- **[Docker Setup](DOCKER_SETUP.md)** - Docker configuration and troubleshooting
- **[Cross-Platform Guide](CROSS_PLATFORM_GUIDE.md)** - Development on different platforms
- **[Mobile Development](MOBILE_DEVELOPMENT.md)** - React Native + Expo guide
- **[Self-Hosting Guide](SELF_HOSTING_GUIDE.md)** - Deploy your own instance

## 🏗️ Architecture

- **[Architecture](architecture/ARCHITECTURE.md)** - Complete system architecture (500+ lines)
- **[Service Dependencies](architecture/SERVICE_DEPENDENCIES.md)** - Service dependency graph and failure modes
- **[Data Model](architecture/DATA_MODEL.md)** - Database schema with ERD diagram (29 tables, 9 schemas)
- **[RLS Policies](architecture/RLS_POLICIES.md)** - Row-Level Security policies explained
- **[Architectural Review](V6_ARCHITECTURAL_REVIEW.md)** - v6.0 architectural review and decisions

## 💻 Development

- **[Creating a Service](development/creating-a-service.md)** - Step-by-step guide to create new services
- **[Implementing Logging](development/implementing-logging.md)** - Add structured logging to services
- **[Testing Guide](development/testing-guide.md)** - Comprehensive testing strategy (fixtures, E2E, load testing)
- **[Development Workflow](development/workflow.md)** - Git workflow and best practices
- **[Turborepo](development/turborepo.md)** - Monorepo tooling guide
- **[Environment Variables](ENVIRONMENT_VARIABLES.md)** - Complete environment variable reference

## 🔧 Operations

- **[Logging & Monitoring](operations/logging-and-monitoring.md)** - Complete observability guide
- **[Log Levels](operations/log-levels.md)** - Configure log verbosity
- **[CI/CD Pipeline](operations/ci-cd.md)** - Continuous integration and deployment

## 🧪 Testing

- **[Integration Tests](../tests/README.md)** - Multi-tenant integration test suite
- **[E2E Tests](../tests/e2e/README.md)** - Playwright end-to-end tests
- **[Load Tests](../tests/load/README.md)** - Performance and stress testing
- **[Testing Guide](development/testing-guide.md)** - Complete testing strategy (fixtures, E2E, load)
- **[Testing & Observability](../TESTING_AND_OBSERVABILITY.md)** - Overview

## 📦 Service Documentation

Each service has comprehensive CONTEXT.md and README.md files:

### Backend Services (8 Total)
1. **[Auth Service](../services/auth-service/CONTEXT.md)** (Port 3001) - Authentication & JWT
2. **[Community Service](../services/community-service/CONTEXT.md)** (Port 3002) - Communities & members
3. **[Request Service](../services/request-service/CONTEXT.md)** (Port 3003) - Help requests & offers
4. **[Reputation Service](../services/reputation-service/CONTEXT.md)** (Port 3004) - Karma & trust scores
5. **[Notification Service](../services/notification-service/CONTEXT.md)** (Port 3005) - Real-time notifications
6. **[Messaging Service](../services/messaging-service/CONTEXT.md)** (Port 3006) - Chat & conversations
7. **[Feed Service](../services/feed-service/CONTEXT.md)** (Port 3007) - Personalized activity feed
8. **[Cleanup Service](../services/cleanup-service/CONTEXT.md)** (Port 3008) - Data expiration & decay

### Frontend Applications
- **[Web Frontend](../apps/frontend/README.md)** (Port 3000) - Next.js web app
- **[Mobile App](../apps/mobile/README.md)** - React Native + Expo

## 🗂️ Documentation Organization

```
docs/
├── README.md (this file)
├── PROJECT_STATUS.md          # Current status & roadmap
├── GETTING_STARTED.md         # Quick start guide
├── V6_MIGRATION_GUIDE.md      # v6.0 migration guide
├── V6_ARCHITECTURAL_REVIEW.md # v6.0 architectural review
├── MULTI_TENANT_GUIDE.md      # Multi-tenant architecture
├── guides/
│   └── EPHEMERAL_DATA_GUIDE.md  # Ephemeral data guide
├── DOCKER_SETUP.md            # Docker guide
├── SELF_HOSTING_GUIDE.md      # Self-hosting guide
├── MOBILE_DEVELOPMENT.md      # Mobile dev guide
├── CROSS_PLATFORM_GUIDE.md    # Cross-platform guide
├── architecture/              # Architecture docs
│   ├── ARCHITECTURE.md        # Complete system architecture
│   ├── SERVICE_DEPENDENCIES.md # Service dependency graph
│   ├── DATA_MODEL.md          # Database schema with ERD
│   └── RLS_POLICIES.md        # Row-Level Security policies
├── development/               # Development guides
│   ├── creating-a-service.md
│   ├── implementing-logging.md
│   ├── testing-guide.md
│   ├── workflow.md
│   └── turborepo.md
├── operations/                # Operations guides
│   ├── logging-and-monitoring.md
│   ├── log-levels.md
│   └── ci-cd.md
└── archive/                   # Historical docs
    ├── README.md              # Archive index
    ├── federation/            # Federation protocol (archived)
    ├── releases/              # Version-specific fix docs
    ├── planning/              # Historical planning docs
    └── session-summaries/     # Development session notes
```

## 🎯 Common Tasks

### First Time Setup
1. Read [Getting Started](GETTING_STARTED.md)
2. Follow [Docker Setup](DOCKER_SETUP.md) for your platform
3. Run `bash scripts/dev/start.sh` (or `npm run dev`)
4. Access app at http://localhost:3000

### Development Workflow
1. Review [Development Workflow](development/workflow.md)
2. Create a feature branch
3. Make changes with [structured logging](development/implementing-logging.md)
4. Write [tests](development/testing-guide.md)
5. Submit PR

### Creating a New Service
1. Follow [Creating a Service](development/creating-a-service.md)
2. Implement multi-tenant middleware (see [Multi-Tenant Guide](MULTI_TENANT_GUIDE.md))
3. Add [structured logging](development/implementing-logging.md)
4. Write tests
5. Create CONTEXT.md and README.md

### Debugging Issues
1. Check logs in Grafana: http://localhost:3007
2. Review [Logging & Monitoring](operations/logging-and-monitoring.md)
3. Adjust [log levels](operations/log-levels.md) for more detail
4. Use integration tests to reproduce issues
5. Check service CONTEXT.md for common issues

### Running Tests
```bash
# Integration tests
cd tests && npm run test:integration

# Specific test suite
npm run test:auth        # Authentication tests
npm run test:tenant      # Tenant isolation tests
npm run test:rls         # RLS policy tests
npm run test:flows       # Multi-community flows

# E2E tests
cd tests/e2e && npm run test
```

## 📊 Current Status (v6.0.0)

- ✅ **8 Backend Services** - All production-ready with multi-tenant support
- ✅ **Multi-Tenant SaaS** - Row-Level Security, community isolation
- ✅ **Ephemeral Data** - Configurable TTL (60 days default)
- ✅ **Reputation Decay** - Time-based karma decay (6-month half-life)
- ✅ **Cleanup Service** - 5 automated jobs for data management
- ✅ **Frontend** - Next.js web app with inline messaging
- ✅ **Mobile App** - React Native + Expo SDK 52 (100% functional on web)
- ✅ **Feed Service** - Schema properly aligned with database
- ✅ **Database** - PostgreSQL with 9 schemas, 19 RLS-protected tables
- ✅ **Observability** - Grafana/Loki/Prometheus stack
- ✅ **Testing** - Integration tests + E2E tests
- ✅ **CI/CD** - GitHub Actions pipeline

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed status and roadmap.

## 🚧 Known Issues

- **Mobile App**: Not tested on native simulators (web version fully functional)

## 🔮 Next Steps (Phase 4+)

1. **Admin UI** - Community settings management interface
2. **TTL Configuration UI** - Per-community ephemeral data settings
3. **Decay Configuration UI** - Per-community reputation decay
4. **Activity Tracking Configuration** - Configure which activities are tracked
5. **Community Analytics Dashboard** - Insights, trends, health metrics

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for complete roadmap.

## 🗃️ Archived Documentation

Outdated documentation has been moved to `archive/`:
- Federation docs (replaced by multi-tenant SaaS)
- Old setup guides (superseded by current docs)
- Historical planning documents

See [archive/README.md](archive/README.md) for details.

## 💡 Getting Help

- **Documentation Issues**: Open an issue on GitHub
- **Questions**: Check CONTEXT.md files and this documentation first
- **Bugs**: Include logs from Grafana and steps to reproduce
- **Feature Requests**: Describe the use case and benefit to the community

## 📖 External Resources

- [PostgreSQL Docs](https://www.postgresql.org/docs/) - Database
- [Next.js Docs](https://nextjs.org/docs) - Web frontend
- [React Native Docs](https://reactnative.dev/) - Mobile app
- [Expo Docs](https://docs.expo.dev/) - Mobile platform
- [Grafana Docs](https://grafana.com/docs/) - Observability
- [Docker Docs](https://docs.docker.com/) - Containerization
- [Playwright Docs](https://playwright.dev) - E2E testing

---

**For the latest updates, see [PROJECT_STATUS.md](PROJECT_STATUS.md)**
