# Karmyq Documentation

Complete documentation for the Karmyq mutual aid platform.

## Quick Links

- **[Main README](../README.md)** - Project overview and quick start
- **[Getting Started](GETTING_STARTED.md)** - Set up and run Karmyq
- **[Contributing](../CONTRIBUTING.md)** - How to contribute to the project
- **[Testing & Observability](../TESTING_AND_OBSERVABILITY.md)** - Complete testing and monitoring guide

## Documentation Structure

### 🏗️ Architecture
- **[Overview](architecture/overview.md)** - High-level system architecture
- **[Service Architecture](architecture/review.md)** - Microservices design and communication

### 💻 Development
- **[Creating a Service](development/creating-a-service.md)** - Step-by-step guide to create new services
- **[Implementing Logging](development/implementing-logging.md)** - Add structured logging to services
- **[Testing Guide](development/testing-guide.md)** - Comprehensive testing strategy
- **[Development Workflow](development/workflow.md)** - Git workflow and best practices

### 🔧 Operations
- **[Logging & Monitoring](operations/logging-and-monitoring.md)** - Complete observability guide
- **[Log Levels](operations/log-levels.md)** - Configure log verbosity

### 📱 Platform-Specific Guides
- **[Windows Setup](START_WINDOWS.md)** - Running Karmyq on Windows
- **[Cross-Platform Guide](CROSS_PLATFORM_GUIDE.md)** - Development on different platforms
- **[Docker Setup](DOCKER_SETUP.md)** - Docker configuration and troubleshooting

## Common Tasks

### First Time Setup
1. Read [Getting Started](GETTING_STARTED.md)
2. Follow platform-specific guide ([Windows](START_WINDOWS.md) or [Cross-Platform](CROSS_PLATFORM_GUIDE.md))
3. Run `bash scripts/dev/start.sh`

### Development
1. Review [Development Workflow](development/workflow.md)
2. Create a feature branch
3. Make changes with [structured logging](development/implementing-logging.md)
4. Write tests ([Testing Guide](development/testing-guide.md))
5. Submit PR

### Creating a New Service
1. Follow [Creating a Service](development/creating-a-service.md)
2. Implement [structured logging](development/implementing-logging.md) from day one
3. Write tests for your service
4. Update documentation

### Debugging Issues
1. Check logs in [Grafana](http://localhost:3007)
2. Review [Logging & Monitoring](operations/logging-and-monitoring.md)
3. Adjust [log levels](operations/log-levels.md) for more detail
4. Use E2E tests to reproduce issues

## Service-Specific Documentation

Each service has its own README with:
- API endpoints
- Database schema
- Environment variables
- Related services

### Services
- [Auth Service](../services/auth-service/README.md)
- [Community Service](../services/community-service/README.md)
- [Request Service](../services/request-service/README.md)
- [Reputation Service](../services/reputation-service/README.md)
- [Notification Service](../services/notification-service/README.md)
- [Messaging Service](../services/messaging-service/README.md)

## Testing

- **[E2E Tests](../tests/e2e/README.md)** - Playwright end-to-end tests
- **[Testing Guide](development/testing-guide.md)** - Complete testing strategy
- **[Testing & Observability](../TESTING_AND_OBSERVABILITY.md)** - Overview

## Project Status

- ✅ Microservices Architecture
- ✅ Frontend (Next.js)
- ✅ Database (PostgreSQL)
- ✅ Event Queue (Redis/Bull)
- ✅ Real-time Messaging (Socket.IO)
- ✅ Notifications (SSE)
- ✅ Observability Stack (Grafana/Loki/Prometheus)
- ✅ Structured Logging
- ✅ E2E Testing Framework
- ⏳ CI/CD Pipeline (in progress)
- ⏳ Matching Service (planned)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Code of conduct
- Development workflow
- Pull request process
- Coding standards

## Getting Help

- **Documentation Issues**: Open an issue on GitHub
- **Questions**: Check existing documentation first
- **Bugs**: Include logs from Grafana and steps to reproduce
- **Feature Requests**: Describe the use case and benefit

## External Resources

- [Playwright Docs](https://playwright.dev)
- [Next.js Docs](https://nextjs.org/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [Docker Docs](https://docs.docker.com/)

---

**Last Updated**: 2025-11-06 (v3.1)
