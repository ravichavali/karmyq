# Karmyq: Complete Getting Started Guide

You now have a complete containerized development environment for Karmyq. This guide will walk you through everything you need to know.

## 📦 What You Have

```
karmyq/
├── docker-compose.yml          ← Starts all services
├── README.md                   ← Project overview
├── ARCHITECTURE.md             ← System design (READ FIRST!)
├── SERVICE-GUIDE.md            ← How to build services
├── CONTRIBUTING.md             ← How to contribute
├── COPILOT-GUIDE.md            ← GitHub Copilot tips
│
├── shared/types/               ← API contracts (all services use these)
├── services/                   ← All microservices
│   ├── auth-service/
│   ├── community-service/
│   ├── request-service/
│   ├── reputation-service/
│   ├── messaging-service/
│   ├── notification-service/
│   └── governance-service/
├── frontend/                   ← React/Next.js PWA (not included, you build it)
└── infrastructure/             ← Docker, nginx, postgres configs
```

**Everything is containerized and ready to run locally at zero cost.**

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites

```bash
# Make sure you have these installed
docker --version        # Should be 20.10+
docker-compose --version # Should be 1.29+
git --version           # Any recent version
```

### 2. Start Everything

```bash
# Navigate to project
cd karmyq

# Start all services (this is the magic moment!)
docker-compose up

# You should see lots of output...
# Wait for all services to be healthy (green checkmarks)
```

### 3. Verify It Works

**In a new terminal**:
```bash
# Check API Gateway
curl http://localhost:3000/health
# Response: {"status":"ok"}

# Check Redis
http://localhost:8081
# Should show Redis Commander UI

# Check Database
psql -h localhost -U karmyq -d karmyq -c "SELECT 1;"
# Should return "1"
```

✅ **All services running!**

## 📖 Understanding the Architecture (15 minutes)

**CRITICAL**: Read this to understand how everything fits together.

```bash
cat ARCHITECTURE.md
```

Key concepts:
- 🏗️ **7 Microservices** - Each owns a domain
- 🔗 **Loosely Coupled** - Services don't directly depend on each other
- 📨 **Event-Driven** - Services communicate via Redis event queue
- 🗄️ **Single Database** - Separate schemas per service (for MVP)
- 🌐 **API Gateway** - Nginx routes requests to services

**Visual**:
```
You develop one service → Changes auto-reload in Docker
Other services don't care → Event queue handles it
Your PoC works locally → Easy to deploy later
```

## 🛠️ First Development Task (30 minutes)

Let's build something to verify everything works!

### Goal
Create a simple endpoint in Community Service that creates a community.

### Steps

**1. Start in one terminal**:
```bash
cd karmyq
docker-compose up
```

**2. In another terminal, navigate to community-service**:
```bash
cd karmyq/services/community-service
```

**3. Understand the structure**:
```bash
cat README.md          # What this service does
ls src/               # See the code structure
```

**4. Read the existing code**:
```bash
cat src/index.ts      # Main entry point
cat src/routes/       # See existing routes
```

**5. Open in VS Code**:
```bash
code .
```

**6. With GitHub Copilot**, add a new endpoint:

In `src/index.ts`, find the route section and type:

```typescript
// POST /communities
// Create a new community
app.post('/communities', async (req, res) => {
```

**Let Copilot auto-complete** (press Tab to accept). It should generate:
- Database insert
- Error handling
- Event publishing

**7. Review what it generated**:
- ✅ Does it use the database schema correctly?
- ✅ Does the event shape match `shared/types`?
- ✅ Is error handling appropriate?

**8. Test it**:

```bash
# Get a token (we'll use a dummy one for now)
TOKEN="test_token_123"

# Create a community
curl -X POST http://localhost:3000/api/communities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Community",
    "description": "Testing Karmyq",
    "maxMembers": 150
  }'
```

**9. Check Redis to see the event**:
```bash
http://localhost:8081
# Navigate to the event queue
# Should see 'community_created' event queued
```

**10. Verify database**:
```bash
psql -h localhost -U karmyq -d karmyq
SELECT * FROM communities.communities;
```

✅ **You've built a working endpoint!**

## 📚 Recommended Reading Path

Read in this order:

1. **README.md** (10 min) - Project overview
2. **ARCHITECTURE.md** (20 min) - System design
3. **SERVICE-GUIDE.md** (30 min) - How to code
4. **COPILOT-GUIDE.md** (15 min) - If using GitHub Copilot
5. **CONTRIBUTING.md** (10 min) - How to contribute

Total: ~85 minutes of reading = solid understanding

## 🎯 Next Steps by Interest

### Option A: Build a New Feature
1. Pick a service (`ls services/`)
2. Read its README
3. Add an API endpoint
4. Publish an event
5. Test end-to-end

### Option B: Add a New Service
1. Read `SERVICE-GUIDE.md`
2. Copy service template
3. Define your purpose
4. Implement endpoints
5. Connect to event queue

### Option C: Build the Frontend
1. Create React/Next.js app in `frontend/`
2. Call API Gateway (`http://localhost:3000/api/*`)
3. Use shared types for type safety
4. Add to docker-compose.yml

### Option D: Add Tests
1. Open `src/__tests__/`
2. Look at existing test patterns
3. Write tests for new endpoints
4. Run `npm test`

### Option E: Understand the Community
1. Follow trust chain in Community Service
2. See how requests match in Request Service
3. Watch karma flow in Reputation Service
4. Understand governance in Governance Service

## 🤝 Now You Can Build!

You have:
- ✅ Containerized dev environment (costs $0)
- ✅ 7 microservices running locally
- ✅ PostgreSQL for persistence
- ✅ Redis for event queue
- ✅ Nginx for API routing
- ✅ TypeScript types for safety
- ✅ Clear architecture documentation
- ✅ Service templates for consistency
- ✅ GitHub Copilot integration guide

## 🧠 Key Concepts to Remember

### Microservices Pattern
```
Each service = one responsibility
Services don't depend on each other
All communication via REST APIs or events
```

### Event-Driven Architecture
```
Service A does something important
  ↓
Publishes event to Redis queue
  ↓
Service B listens to event
  ↓
Service B reacts (updates DB, publishes new event)
```

### Trust Chain
```
User A creates community
  ↓
User A invites User B (A vouches for B)
  ↓
User B can invite User C (chain: A→B→C)
  ↓
Community verifies trust through chain
```

### Karma System
```
Complete request: +10 points
Give feedback: +2 points per star
Help accepted: +5 points
Norm respected: +3 points
Badge earned: +50 points
```

## 🐛 Troubleshooting

### "docker-compose up" fails
```bash
# Check Docker is running
docker ps

# Check version
docker-compose --version  # Need 1.29+

# Check port conflicts
sudo lsof -i :3000  # Check if port in use
```

### Service crashes
```bash
# Check logs
docker logs karmyq-[service-name]

# Restart
docker-compose restart [service-name]

# Full reset
docker-compose down -v  # Remove volumes
docker-compose up       # Fresh start
```

### Database connection issues
```bash
# Check postgres is running
docker ps | grep postgres

# Connect directly
psql -h localhost -U karmyq -d karmyq

# Check schema
\dn  # List schemas
```

### Event queue problems
```bash
# Check Redis
docker logs karmyq-redis

# View queue via UI
http://localhost:8081
```

## 📞 Getting Help

### Documentation
- 📖 ARCHITECTURE.md - How things fit together
- 🛠️ SERVICE-GUIDE.md - How to code
- 💬 COPILOT-GUIDE.md - How to use Copilot
- 🤝 CONTRIBUTING.md - How to contribute

### From other services
- Check `services/[service-name]/README.md`
- Look at existing code for patterns
- Review test examples

### Ask in community
- GitHub Discussions
- Issues for bugs/features

## 🎓 Learning Resources

**Understanding Microservices**:
- [Microservices.io](https://microservices.io/)
- [Sam Newman - Building Microservices](https://samnewman.io/books/building_microservices/)

**Event-Driven Architecture**:
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS](https://martinfowler.com/bliki/CQRS.html)

**Karmyq Philosophy**:
- Dunbar's Number research
- Gift economy anthropology
- Prestige systems in traditional societies
- See `/docs/VISION.md` (when created)

## 🚢 Next Phase: Cloud Deployment

When you're ready to scale:

**Self-Hosted** (same code, bigger server):
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Cloud** (Kubernetes, managed services):
```bash
# Each service gets its own container
# PostgreSQL on managed service
# Redis on managed cache
# Nginx as load balancer
# Auto-scaling based on load
```

**All the same code, just more resources.**

## 🎉 You're Ready!

You now have:
1. ✅ Complete understanding of architecture
2. ✅ Running development environment
3. ✅ First feature built
4. ✅ Team of 1 (you!) who can maintain it
5. ✅ Path to scale and add contributors

**The real journey starts now.**

## 📋 Checklist: Before Starting Development

- [ ] Read ARCHITECTURE.md
- [ ] Run `docker-compose up` successfully
- [ ] Access all services (curl tests)
- [ ] Read SERVICE-GUIDE.md
- [ ] Read service README for area you'll work on
- [ ] Open VS Code in project
- [ ] Install GitHub Copilot (optional but recommended)
- [ ] Create your first branch: `git checkout -b feature/[your-idea]`

## 🌱 Remember Why We're Doing This

Karmyq isn't just code. It's:
- Building trust in communities
- Enabling mutual aid networks
- Creating alternatives to transactional systems
- Proving people are fundamentally good

Every line of code serves this mission.

---

## Quick Reference: Port Numbers

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3001 | http://localhost:3001 |
| API Gateway | 3000 | http://localhost:3000/api/* |
| Auth Service | 4001 | http://localhost:4001 |
| Community Service | 4002 | http://localhost:4002 |
| Request Service | 4003 | http://localhost:4003 |
| Reputation Service | 4004 | http://localhost:4004 |
| Messaging Service | 4005 | http://localhost:4005 |
| Notification Service | 4006 | http://localhost:4006 |
| Governance Service | 4007 | http://localhost:4007 |
| Redis Commander | 8081 | http://localhost:8081 |
| PostgreSQL | 5432 | psql://karmyq:karmyq_dev_password@localhost/karmyq |

## Quick Commands

```bash
# Start all services
docker-compose up

# View specific service logs
docker logs karmyq-[service-name] -f

# Connect to database
psql -h localhost -U karmyq -d karmyq

# View event queue
http://localhost:8081

# Stop everything
docker-compose down

# Fresh start (remove all data)
docker-compose down -v
docker-compose up

# Develop a service
cd services/[service-name]
npm run dev

# Run tests
npm test

# Check if all healthy
curl http://localhost:3000/health
```

---

**You've got this. Let's build trust together.** 🚀🌱

Have questions? Check the docs or ask in [GitHub Discussions](https://github.com/karmyq/karmyq/discussions)
