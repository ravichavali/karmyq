# Karmyq Documentation

**Version**: 10.11.0
**Last Updated**: 2026-06-05

---

## Documentation Structure

```
docs/
  README.md              <- You are here
  ARCHITECTURE.md        <- System architecture (single source of truth)
  DATA_FLOWS.md          <- How data flows through services
  ARCHITECTURE_RESET_ANALYSIS.md <- Cleanup analysis and plan
  adr/                   <- Architecture Decision Records (27 ADRs)
  archive/               <- Historical docs (preserved for reference)
```

## Service Documentation

**Each service is self-documenting with CONTEXT.md**

| Service | Port | Documentation | Status |
|---------|------|---------------|--------|
| auth-service | 3001 | [CONTEXT.md](../services/auth-service/CONTEXT.md) | Core |
| community-service | 3002 | [CONTEXT.md](../services/community-service/CONTEXT.md) | Core |
| request-service | 3003 | [CONTEXT.md](../services/request-service/CONTEXT.md) | Core |
| reputation-service | 3004 | [CONTEXT.md](../services/reputation-service/CONTEXT.md) | Core |
| notification-service | 3005 | [CONTEXT.md](../services/notification-service/CONTEXT.md) | Core |
| messaging-service | 3006 | [CONTEXT.md](../services/messaging-service/CONTEXT.md) | Core |
| feed-service | 3007 | [CONTEXT.md](../services/feed-service/CONTEXT.md) | Review |
| cleanup-service | 3008 | [CONTEXT.md](../services/cleanup-service/CONTEXT.md) | Review |
| geocoding-service | 3009 | [CONTEXT.md](../services/geocoding-service/CONTEXT.md) | Review |
| social-graph-service | 3010 | [CONTEXT.md](../services/social-graph-service/CONTEXT.md) | Core |

**Frontend Applications**
- Web: [apps/frontend/](../apps/frontend/) - Next.js 14
- Mobile: [apps/mobile/](../apps/mobile/) - React Native + Expo

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Development
```bash
# Start infrastructure
cd infrastructure/docker
docker-compose up -d postgres redis

# Install dependencies
npm install

# Run tests
./scripts/test-local.sh

# Start all services
npm run dev
```

### Scripts
| Script | Purpose |
|--------|---------|
| `./scripts/test-local.sh` | Quick tests (before commit) |
| `./scripts/test-all.sh` | Full test suite (before push) |
| `./scripts/seed-test-data.sh` | Seed database |
| `./scripts/truncate-database.sh` | Reset database |

---

## Deployment

### Production (ARM64 server)
```bash
# On production server
cd ~/karmyq
git pull
./scripts/build-images.sh v8.1.0 localhost:5000
./scripts/deploy-images.sh v8.1.0 localhost:5000
```

---

## Architecture Decision Records

See [adr/README.md](adr/README.md) for complete index.

**Key ADRs:**
- [ADR-003](adr/ADR-003-multi-tenant-rls.md): Multi-tenant Row-Level Security
- [ADR-004](adr/ADR-004-microservices-event-driven.md): Microservices + Events
- [ADR-019](adr/ADR-019-referral-chain-trust.md): Trust path system
- [ADR-020](adr/ADR-020-trust-first-design.md): Trust-first philosophy

---

## Development Disciplines

1. **Update, Don't Create** - Search for existing docs before creating new ones
2. **One Source of Truth** - Each concept has ONE authoritative document
3. **Service Self-Documentation** - Each service maintains its own CONTEXT.md
4. **Test Before Commit** - Run `test-local.sh` before every commit
5. **Archive, Don't Delete** - Move outdated docs to `archive/`

---

## Archive

Historical documentation preserved in [archive/](archive/):
- Session summaries
- Planning documents
- Old roadmaps
- Migration guides

---

## Getting Help

1. **Service questions** → Check service's CONTEXT.md
2. **Architecture** → [ARCHITECTURE.md](ARCHITECTURE.md)
3. **Data flow** → [DATA_FLOWS.md](DATA_FLOWS.md)
4. **Decisions** → [adr/](adr/)
