# Karmyq Containerized Development Setup - Complete Documentation

## 📋 Overview

This is a complete, production-ready containerized development setup for **Karmyq** - a community-based mutual aid platform built on trust and prestige systems.

You now have everything needed to:
1. ✅ Start developing locally with `docker-compose up -d`
2. ✅ Understand the loosely coupled microservices architecture
3. ✅ Contribute to individual services without touching others
4. ✅ Use GitHub Copilot effectively with clear context and contracts
5. ✅ Build a community-driven platform that scales

## 📦 What You Got

### Documentation Files

| File | Purpose | Read First? |
|------|---------|------------|
| **QUICK_START.md** | 5-minute setup guide | ✅ YES |
| **ARCHITECTURE.md** | System design, event flow, patterns | Then this |
| **SERVICE_GUIDE.md** | How to create/modify services | When building |
| **PROJECT_STRUCTURE.md** | Where everything lives | Reference |
| **shared-types.ts** | TypeScript contracts for all services | For coding |

### Configuration Files

| File | Purpose |
|------|---------|
| **docker-compose.yml** | Complete multi-container setup |

## 🚀 Quick Start (Really Quick)

```bash
# 1. You already have these ready to use
docker-compose.yml           # Full Docker setup
shared-types.ts              # All TypeScript contracts

# 2. In your project root, use them:
wget https://... docker-compose.yml
# (or copy the provided files)

# 3. Start everything
docker-compose up -d

# 4. Open browser
http://localhost:3100        # Frontend
http://localhost:3000/api    # API Gateway
http://localhost:8081        # Redis Commander (event queue)
http://localhost:8025        # MailHog (test emails)
```

## 🏗️ Architecture at a Glance

```
Karmyq = Loosely Coupled Microservices + Event-Driven Architecture

Frontend (React PWA)
        ↓ HTTP/WebSocket
    API Gateway (Nginx)
        ↓ Routes
┌───────────────────────────────┐
│  7 Independent Microservices  │
│  • auth-service              │
│  • community-service         │
│  • request-service           │
│  • reputation-service        │
│  • messaging-service         │
│  • notification-service      │
│  • governance-service        │
└───────────────────────────────┘
        ↓ Events
    Redis + Bull Queue
        ↓ Persists
    PostgreSQL (7 schemas)
```

**Why this design?**
- 👤 You pick ONE service, own it completely
- 🔗 Services don't depend on each other's code
- ⚡ Event-driven means no cascading failures
- 🎯 Perfect for community development
- 🐦 Easy for GitHub Copilot to help (clear boundaries)

## 💡 Key Innovation: Loosely Coupled Services

### Traditional Approach ❌
```
request-service → calls → reputation-service → calls → notification-service
        (If reputation-service is slow, everything slows down)
```

### Karmyq Approach ✅
```
request-service publishes "request_created" event
        ↓
Redis queue
        ↓ (asynchronously)
┌─────────────────────────────────────┐
│ reputation-service: "Give karma!"    │
│ notification-service: "Send email!" │
│ governance-service: "Update count!" │
│ (All independent, all simultaneous)
└─────────────────────────────────────┘
```

**Benefits for Your Use Case:**
- 🤝 Contributors can work in parallel on different services
- 🧪 Each service is fully testable in isolation
- 🚀 Services scale independently
- 🐛 Bugs in one service don't crash others
- 📝 Clear documentation = easy onboarding

## 📚 Documentation Guide

### For Complete Beginners: START HERE

1. **QUICK_START.md** (10 minutes)
   - Set up development environment
   - Make first API call
   - Understand what's running

2. **ARCHITECTURE.md** (30 minutes)
   - How the system is designed
   - Event flow examples
   - Database strategy
   - Communication patterns

### For Contributors: THEN READ THIS

3. **SERVICE_GUIDE.md** (1-2 hours as reference)
   - How to create a new service
   - How to modify existing service
   - Event publishing/subscribing patterns
   - Testing practices
   - Documentation requirements

### For Reference: KEEP HANDY

4. **PROJECT_STRUCTURE.md**
   - Where every file goes
   - Service boundaries
   - Schema organization
   - File locations

5. **shared-types.ts**
   - TypeScript interfaces for all services
   - API contracts
   - Event types
   - Copy types into your service code

## 🎯 For GitHub Copilot Users

The architecture is specifically designed to help Copilot help you:

**Clear Context** ✅
- Each service has a specific purpose
- Event contracts are explicit
- Database schema is isolated
- Types are shared and centralized

**Patterns to Copy** ✅
```typescript
// Look at existing services:
services/request-service/        // How to handle requests
services/reputation-service/     // How to calculate karma
services/notification-service/   // How to send emails

// Copilot will understand:
// "Oh, this service follows the same pattern!"
// "I can use the event publisher like this..."
// "The database schema goes in /database..."
```

**Instructions to Give Copilot** ✅
```
"In notification-service, create an endpoint that lists
notifications for a user, following the same pattern as
request-service/src/routes/requests.ts. Use the shared
types from shared/types/notification.ts. Subscribe to
the 'message_sent' event and send an in-app notification."
```

Copilot will understand the architecture and write better code.

## 🔄 Event-Driven Architecture Explained

### The Flow

```
1. Something happens in one service
   Example: User creates help request
   
2. Service publishes event to Redis queue
   event = {
     type: "request_created",
     data: { requestId, userId, communityId, ... }
   }

3. Other services subscribe to event types
   reputation-service: "I care about request_created"
   notification-service: "I care about request_created"
   
4. When event arrives, subscribers process asynchronously
   reputation-service: Awards karma (background job)
   notification-service: Sends email (background job)
   
5. If needed, they publish new events
   reputation-service publishes: "karma_awarded"
   notification-service publishes: "email_sent"
   
6. Chain continues...
```

### Why This Matters

- **Decoupled**: Services don't know about each other
- **Scalable**: Each service scales independently
- **Resilient**: If notification-service is down, request-service still works
- **Auditable**: Every action is an event (audit trail)
- **Testable**: Can test by publishing mock events

## 📦 Service Overview

| Service | Purpose | Owns |
|---------|---------|------|
| **auth-service** | User accounts & login | Users, sessions, passwords |
| **community-service** | Communities & membership | Communities, members, roles |
| **request-service** | Help requests & offers | Requests, offers, matches |
| **reputation-service** | Karma & trust scoring | Karma, trust scores |
| **messaging-service** | In-app messaging | Messages, conversations |
| **notification-service** | Emails & notifications | Notifications, preferences |
| **governance-service** | Community governance [STUB] | Proposals, votes, norms, conflicts |

## 🛠️ Services Are Stubs (Ready to Expand!)

All services include **stubs and placeholders** specifically so you can:

1. **Understand the pattern** - See what a complete service looks like
2. **Expand services** - Add the real business logic
3. **Invite contributors** - "Hey, help me flesh out governance-service!"
4. **Demonstrate capability** - Show it works before building full features

The governance-service is particularly stub-heavy because it's philosophically core to Karmyq:
- Proposal/voting system [STUB]
- Conflict resolution [STUB]
- Norm setting [STUB]
- These are great for attracting contributors who care about community!

## 🗄️ Database Design

**One PostgreSQL database with 7 schemas (one per service):**

```
karmyq_db/
├── auth schema          (auth-service tables)
├── community schema     (community-service tables)
├── requests schema      (request-service tables)
├── reputation schema    (reputation-service tables)
├── messaging schema     (messaging-service tables)
├── notifications schema (notification-service tables)
└── governance schema    (governance-service tables)
```

**Why?**
- Single database = simple deployment
- Multiple schemas = clear ownership
- Services read each other's data via APIs
- Services only write to their own schema
- Easy to backup and restore

## 🚦 Getting Started Checklist

- [ ] Download all files to your project directory
- [ ] Read `QUICK_START.md` (10 minutes)
- [ ] Run `docker-compose up -d`
- [ ] Open http://localhost:3100
- [ ] Make an API call via curl or REST Client
- [ ] View Redis Commander at http://localhost:8081
- [ ] Check emails at http://localhost:8025
- [ ] Read `ARCHITECTURE.md` (understand the design)
- [ ] Pick a service to work on
- [ ] Read `SERVICE_GUIDE.md` (how to contribute)
- [ ] Make your first change
- [ ] Test locally
- [ ] Commit and push

## 💬 Common Questions

**Q: Where do I start if I want to contribute?**
A: Read QUICK_START.md first. Then pick a service from PROJECT_STRUCTURE.md. Read SERVICE_GUIDE.md for that service.

**Q: Can I modify multiple services?**
A: Yes! Each service is independent. But start with one to understand the patterns.

**Q: How do I know what events are being published?**
A: Go to http://localhost:8081 (Redis Commander) to see the event queue in real-time.

**Q: What if I need to change the database schema?**
A: Edit the SQL files in `services/your-service/src/database/schema.sql`. Services auto-migrate on startup.

**Q: Can I use a different technology for one service?**
A: Not yet - all services are currently Node.js/TypeScript. But the architecture allows it in the future.

**Q: How do I deploy this to production?**
A: Same docker-compose, different infrastructure. Replace localhost containers with managed services (AWS RDS, Cloud Run, etc).

**Q: Can I self-host this?**
A: Yes! That's the whole point. Run the containers on your own server, your own hardware, your own domain.

## 📖 File Reference

### Main Files You'll Use

```
docker-compose.yml
├── Services: 7 microservices (auth, community, request, reputation, messaging, notification, governance)
├── Infrastructure: PostgreSQL, Redis, Nginx, Mailhog
├── Frontend: React/Next.js PWA
└── Networking: Docker bridge network

shared-types.ts
├── User, Community, Request, Offer types
├── Karma, TrustScore types
├── Message, Notification types
├── Governance, Proposal, Vote types
└── API response types & event types

PROJECT_STRUCTURE.md
├── Every directory explained
├── Service boundaries
├── Database schema layout
└── File naming conventions

ARCHITECTURE.md
├── System design diagrams
├── Event flow examples
├── Communication patterns
├── Database strategy
├── For contributors section

SERVICE_GUIDE.md
├── Step-by-step service creation
├── Event publishing patterns
├── Event subscribing patterns
├── Testing practices
├── Documentation template
└── Complete working example

QUICK_START.md
├── 5-minute setup
├── First API call
├── Common tasks
├── Troubleshooting
└── Next steps
```

## 🎓 Learning Path

**Day 1: Understand the System**
- Run `docker-compose up -d`
- Read QUICK_START.md
- Read ARCHITECTURE.md
- Explore the running services
- View event queue and emails

**Day 2: Understand Services**
- Read PROJECT_STRUCTURE.md
- Look at existing service code
- Read SERVICE_GUIDE.md
- Understand event patterns

**Day 3: Make Your First Contribution**
- Pick a service
- Make a small change
- Test it
- Commit and push

**Day 4+: Keep Contributing**
- Add features
- Fix bugs
- Help new contributors

## 🤝 Community Values

This architecture reflects Karmyq's values:

**Trust** - Clear boundaries, transparent communication
**Prestige** - Recognize contributors, celebrate wins
**Cooperation** - Services work together but independently
**Accessibility** - New contributors can understand one service
**Decentralization** - No single point of failure

## 🎯 Success Metrics

Your setup is successful when:

- ✅ `docker-compose up -d` starts everything
- ✅ Frontend loads at http://localhost:3100
- ✅ API Gateway responds at http://localhost:3000/api
- ✅ Redis Commander shows event queue at http://localhost:8081
- ✅ Emails appear in MailHog at http://localhost:8025
- ✅ You can make an API call (curl or REST Client)
- ✅ You understand the event flow
- ✅ You can modify a service and see changes
- ✅ Services restart properly when code changes
- ✅ You're ready to start contributing!

## 📞 Support

- **Setup issues?** → Check QUICK_START.md troubleshooting
- **Architecture questions?** → Read ARCHITECTURE.md
- **How to build?** → Follow SERVICE_GUIDE.md
- **Where does X go?** → Check PROJECT_STRUCTURE.md
- **Types & contracts?** → See shared-types.ts

## 🎉 You're Ready!

You have everything needed to:
1. Start developing Karmyq locally
2. Understand the system architecture
3. Contribute to any service
4. Attract other community developers
5. Scale from PoC to production

The loosely coupled design means contributors can work independently while maintaining overall coherence. GitHub Copilot will be incredibly effective because:
- Clear service boundaries
- Explicit contracts (shared types)
- Consistent patterns
- Well-documented architecture

## 📝 Next Steps

1. **Read QUICK_START.md** - Get it running
2. **Read ARCHITECTURE.md** - Understand the design
3. **Pick a service** - Find one that interests you
4. **Read SERVICE_GUIDE.md** - Learn how to contribute
5. **Make your first change** - You've got this! 💪

---

**Welcome to Karmyq! We're building a platform where people trust each other and communities thrive. Let's go! 🚀**

Questions? Check the documentation files or open an issue.

Happy coding! 💚
