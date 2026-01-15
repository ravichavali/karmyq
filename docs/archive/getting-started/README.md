# Getting Started with Karmyq

**Quick navigation for new developers**

---

## 🚀 Quick Start (5 Minutes)

**Start here if you just want to run the platform:**

1. **[Docker Setup](DOCKER_SETUP.md)** - Fastest way to get running
   ```bash
   docker-compose up -d
   ```

2. **[GETTING_STARTED.md](GETTING_STARTED.md)** - Complete setup guide
   - Prerequisites
   - Environment variables
   - First run
   - Accessing the application

---

## 📚 Full Onboarding Path

### 1. Setup & Installation
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Docker-based development setup (recommended)
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Complete installation guide
- **[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)** - Required environment configuration

### 2. Understanding the Platform
- **[../MULTI_TENANT_GUIDE.md](../MULTI_TENANT_GUIDE.md)** - Multi-tenant architecture overview
- **[../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)** - Complete system architecture
- **[../PROJECT_STATUS.md](../PROJECT_STATUS.md)** - Current implementation status (v8.0)

### 3. Development Workflow
- **[../development/workflow.md](../development/workflow.md)** - Git workflow and contribution process
- **[../testing/README.md](../testing/README.md)** - Testing strategy and running tests
- **[../TDD_WORKFLOW.md](../TDD_WORKFLOW.md)** - Test-Driven Development methodology

### 4. Platform-Specific Development
- **[MOBILE_DEVELOPMENT.md](MOBILE_DEVELOPMENT.md)** - React Native/Expo mobile app development
- **[CROSS_PLATFORM_GUIDE.md](CROSS_PLATFORM_GUIDE.md)** - Shared code between web and mobile

### 5. Requirements & Planning
- **[REQUIREMENTS_SETUP.md](REQUIREMENTS_SETUP.md)** - Requirements management workflow
- **[../requirements/](../requirements/)** - Functional and technical requirements

---

## 🎯 Common Tasks

### Running Tests
```bash
# All tests
npm test

# Integration tests only
cd tests && npm run test:integration

# E2E tests
cd tests && npx playwright test
```

### Starting Services
```bash
# All services
docker-compose up -d

# Single service
docker-compose up -d auth-service

# View logs
docker logs karmyq-auth-service -f
```

### Database Operations
```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres

# Seed test data
cat tests/fixtures/quick-seed.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
```

---

## 🆘 Troubleshooting

### Port Conflicts
```bash
# Check what's using port 3001-3009
netstat -ano | findstr :3001  # Windows
lsof -i :3001-3009            # Mac/Linux
```

### Services Won't Start
1. Check Docker is running
2. Check no port conflicts
3. Check environment variables set
4. View service logs: `docker logs karmyq-<service-name>`

### Tests Failing
1. Reset database: `docker-compose down -v && docker-compose up -d`
2. Regenerate test data: See database operations above
3. Check all services are running: `docker-compose ps`

---

## 📖 Related Documentation

- **[../README.md](../README.md)** - Main documentation index
- **[../CLAUDE.md](../../CLAUDE.md)** - Quick reference for AI assistants
- **[../PROJECT_STATUS.md](../PROJECT_STATUS.md)** - Current implementation status

---

**Last Updated**: 2025-12-27
