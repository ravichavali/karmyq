# Karmyq - Community Mutual Aid Platform 🤝

[![Version](https://img.shields.io/badge/version-9.0.0-blue.svg)](https://github.com/ravichavali/karmyq/releases/tag/v9.0.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tests](https://github.com/ravichavali/karmyq/actions/workflows/test.yml/badge.svg)](https://github.com/ravichavali/karmyq/actions/workflows/test.yml)
[![E2E Tests](https://github.com/ravichavali/karmyq/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/ravichavali/karmyq/actions/workflows/e2e-tests.yml)

A trust-based mutual aid platform where people help each other without money, building reputation through karma. Communities are limited to 150 members (Dunbar's number) for authentic connections.

**Multi-Tenant SaaS** - Users join communities with one click. No server setup required. Each community owns their data and can export anytime.

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/karmyq.git
cd karmyq

# 2. Install dependencies (npm workspaces + Turborepo)
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Start everything with Docker
cd infrastructure/docker
docker-compose up --build

# Or use the convenience script
bash scripts/dev/start.sh

# 5. Open the app
open http://localhost:3000
```

**That's it!** The first startup takes 60-90 seconds. You'll see "Ready in X.Xs" when it's ready.

### Testing

```bash
# Generate realistic test data (one-time setup)
cd tests
npm run generate-test-data
npm run load-test-data

# Run full test suite
./scripts/test-all.sh      # Mac/Linux
scripts\test-all.bat        # Windows

# Install git hooks (enforces testing)
./scripts/install-git-hooks.sh      # Mac/Linux
scripts\install-git-hooks.bat       # Windows

# Run individual test suites
cd tests
npm run test:integration    # Integration tests
cd e2e && npm run test      # E2E tests
cd performance && npm test  # Performance tests
```

See [Test Suite Documentation](tests/README.md) for more.

### Turborepo Commands

```bash
# Build all packages
npm run build

# Run unit tests across all services
npm run test

# Lint everything
npm run lint
```

See [Turborepo Guide](docs/development/turborepo.md) for more.

## 📚 Documentation

- **[Full Documentation](docs/README.md)** - Complete guide
- **[Multi-Tenant Guide](docs/MULTI_TENANT_GUIDE.md)** - How multi-tenancy works
- **[Getting Started](docs/getting-started/)** - Installation and setup
- **[Architecture](docs/architecture/)** - System design
- **[Development](docs/development/)** - Contributing guide
- **[Operations](docs/operations/)** - Deployment and monitoring

### For Developers
Each service has a `CONTEXT.md` file for context-efficient development:
- [Auth Service](services/auth-service/CONTEXT.md) - JWT with multi-community support
- [Community Service](services/community-service/CONTEXT.md) - Community CRUD
- [Request Service](services/request-service/CONTEXT.md) - Help requests/offers
- [Reputation Service](services/reputation-service/CONTEXT.md) - Karma & trust scores
- [Notification Service](services/notification-service/CONTEXT.md) - SSE notifications
- [Messaging Service](services/messaging-service/CONTEXT.md) - Real-time chat
- [Feed Service](services/feed-service/CONTEXT.md) - Personalized activity feed

## 🏗️ Tech Stack

**Backend**: Node.js, TypeScript, Express, PostgreSQL, Redis
**Frontend**: Next.js, React, TypeScript, Tailwind CSS
**Infrastructure**: Docker, Turborepo, Grafana, Loki, Prometheus
**Architecture**: Microservices monorepo with npm workspaces

## ✨ Features

### Core Features
- **Multi-Community Membership** - Join multiple communities, different reputation in each
- **Communities** - Create and manage communities (max 150 members, Dunbar's number)
- **Polymorphic Request System** (v9.0) - 5 request types (generic, ride, service, event, borrow) with intelligent matching
- **Curated Feed** (v9.0) - Match score algorithm filters noise by 95% using skills + preferences
- **Smart Defaults** (v9.0) - Progressive disclosure UX (< 3 clicks to post a request)
- **User Preferences** (v9.0) - Subscribe/unsubscribe from request types and set interests
- **Karma & Reputation** - Earn karma by helping, build trust scores and badges
- **Real-time Chat** - Socket.IO messaging between matched users
- **Notifications** - Server-Sent Events for instant updates
- **Personalized Feed** - Adaptive feed balancing exploration and exploitation

### Platform Features
- **Multi-Tenant Architecture** - Database-enforced isolation between communities
- **Low-Friction Onboarding** - Sign up once, join communities instantly
- **Community Data Sovereignty** - Each community controls and can export their data
- **Ephemeral Data** - Requests and messages fade like memory (configurable TTL)
- **Reputation Decay** - Trust scores decay for inactive users (half-life algorithm)
- **Mobile Apps** - React Native + Expo for iOS and Android
- **Observability** - Grafana dashboards for logs and metrics

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📖 Project Structure

```
karmyq/
├── docs/              # All documentation
├── services/          # Backend microservices
├── apps/              # Frontend applications
├── packages/          # Shared code
├── infrastructure/    # Docker, configs
└── scripts/           # Developer tools
```

See [Project Structure](docs/architecture/proposed-structure.md) for details.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Star History

If you find this project useful, please consider giving it a star!

---

**Built with ❤️ by the Karmyq community**
