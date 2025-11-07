# Karmyq - Community Mutual Aid Platform 🤝

[![Version](https://img.shields.io/badge/version-2.0-blue.svg)](https://github.com/ravichavali/karmyq/releases/tag/v2.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tests](https://github.com/ravichavali/karmyq/actions/workflows/test.yml/badge.svg)](https://github.com/ravichavali/karmyq/actions/workflows/test.yml)
[![E2E Tests](https://github.com/ravichavali/karmyq/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/ravichavali/karmyq/actions/workflows/e2e-tests.yml)

A trust-based community platform where people help each other without money, building reputation through karma. Communities are limited to 150 members (Dunbar's number) for authentic connections.

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

### Turborepo Commands

```bash
# Build all packages
npm run build

# Run tests across all services
npm run test

# Lint everything
npm run lint
```

See [Turborepo Guide](docs/development/turborepo.md) for more.

## 📚 Documentation

- **[Full Documentation](docs/README.md)** - Complete guide
- **[Getting Started](docs/getting-started/)** - Installation and setup
- **[Architecture](docs/architecture/)** - System design
- **[Development](docs/development/)** - Contributing guide
- **[Operations](docs/operations/)** - Deployment and monitoring

## 🏗️ Tech Stack

**Backend**: Node.js, TypeScript, Express, PostgreSQL, Redis
**Frontend**: Next.js, React, TypeScript, Tailwind CSS
**Infrastructure**: Docker, Turborepo, Grafana, Loki, Prometheus
**Architecture**: Microservices monorepo with npm workspaces

## ✨ Features

- **Communities** - Create and manage communities (max 150 members)
- **Help System** - Post requests and offers, auto-matched by skills
- **Karma & Reputation** - Earn karma by helping, build trust scores
- **Real-time Chat** - Socket.IO messaging between matched users
- **Notifications** - Server-Sent Events for instant updates
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
