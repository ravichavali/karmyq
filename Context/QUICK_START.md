# Karmyq - Quick Start Guide

Welcome! This guide will get you up and running with Karmyq development in about 10 minutes.

## What is Karmyq?

Karmyq is a community-based mutual aid platform built on trust, prestige, and gift economies. It's designed to be developed by a community, which is why it uses loosely coupled microservices.

**Philosophy**: People are fundamentally good. Help each other without money. Build trust through repeated interactions.

## Prerequisites

Make sure you have these installed:

- **Docker** & **Docker Compose** (https://www.docker.com/products/docker-desktop)
- **Git** (https://git-scm.com/)
- **Node.js** 18+ (https://nodejs.org/) - Optional, but helpful for local development
- **VS Code** with recommended extensions (https://code.visualstudio.com/)

Verify installation:
```bash
docker --version          # Docker version 20+
docker-compose --version  # Docker Compose version 2+
git --version             # Git version 2+
```

## Project Setup (5 minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/karmyq/karmyq.git
cd karmyq
```

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults are good for development):
```
NODE_ENV=development
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@postgres:5432/karmyq_db
REDIS_URL=redis://redis:6379
JWT_SECRET=dev_jwt_secret_change_in_production
```

### 3. Start All Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (database)
- Redis (caching & event queue)
- 7 Microservices (auth, community, request, reputation, messaging, notification, governance)
- Nginx (API gateway)
- Frontend (React app)
- Development tools (Redis Commander, MailHog)

Watch the startup:
```bash
docker-compose logs -f
```

Wait for this message:
```
nginx-api-gateway: All services ready!
```

### 4. Access the Application

Open your browser:

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3100 | Karmyq web app |
| API Gateway | http://localhost:3000/api | All API endpoints |
| Redis Commander | http://localhost:8081 | View event queue |
| MailHog (Email) | http://localhost:8025 | Catch development emails |
| Postgres (Direct) | localhost:5432 | Database |

## Architecture Overview

Karmyq uses **loosely coupled microservices**:

```
Frontend (React)
      ↓
API Gateway (Nginx) at :3000
      ↓
┌─────────────────────────────────────┐
│  7 Independent Microservices:       │
│  • auth-service:3001                │
│  • community-service:3002           │
│  • request-service:3003             │
│  • reputation-service:3004          │
│  • messaging-service:3005           │
│  • notification-service:3006        │
│  • governance-service:3007          │
└─────────────────────────────────────┘
      ↓
PostgreSQL + Redis (shared infrastructure)
```

**Why this design?**
- Each service can be developed independently
- Contributor can pick one service and own it
- Services communicate via events (Redis queue)
- No hard dependencies between services

## First Test: Make an API Call

### Option 1: Using curl

```bash
# Health check - auth service
curl http://localhost:3000/api/auth/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

### Option 2: Using VS Code REST Client

Create `test.http`:
```http
### Check Auth Service
GET http://localhost:3000/api/auth/health

### Create User
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "name": "Test User",
  "password": "password123"
}

### Login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Install the REST Client extension in VS Code, then click "Send Request" on each endpoint.

## Common Tasks

### See What's Running

```bash
docker-compose ps
```

### View Logs for a Specific Service

```bash
# Watch reputation-service logs in real-time
docker-compose logs -f reputation-service

# View last 100 lines
docker-compose logs --tail=100 reputation-service
```

### Stop Everything

```bash
docker-compose down
```

### Start Everything Again

```bash
docker-compose up -d
```

### Rebuild After Code Changes

```bash
docker-compose restart reputation-service
```

Or to force rebuild:
```bash
docker-compose down
docker-compose up -d --build
```

### View the Event Queue

Go to http://localhost:8081 (Redis Commander)

This shows:
- Events waiting to be processed
- Event history
- Queue depth

This is **super helpful** for understanding the event-driven architecture!

### View Development Emails

Go to http://localhost:8025 (MailHog)

All emails sent in development end up here instead of your inbox. Perfect for testing notifications!

### Access Database Directly

```bash
# Connect to PostgreSQL
psql -h localhost -U karmyq_user -d karmyq_db

# List all schemas
\dn

# Connect to auth schema
SET search_path TO auth;
SELECT * FROM users;
```

## Contributing Your First Service

Let's say you want to work on the **notification service**. Here's the flow:

### 1. Pick a Service

Read these docs:
- `PROJECT_STRUCTURE.md` - Where everything lives
- `ARCHITECTURE.md` - How services communicate
- `SERVICE_GUIDE.md` - How to build/modify a service

The notification-service owns sending emails and push notifications.

### 2. Understand the Service

```bash
# Look at the service code
cd services/notification-service
cat README.md           # What it does
cat src/index.ts       # Entry point
cat src/routes/        # API endpoints
cat src/events/        # Event handling
```

### 3. Make Changes

Edit files in `src/` and the container will auto-reload:

```bash
# Watch for changes (container auto-reloads)
docker-compose logs -f notification-service
```

Edit `services/notification-service/src/services/email-sender.ts` and see it reload!

### 4. Test Your Changes

```bash
# Run tests
docker-compose exec notification-service npm run test

# Or test via API
curl -X GET http://localhost:3000/api/notifications/preferences/user-123 \
  -H "Authorization: Bearer <token>"
```

### 5. Commit and Push

```bash
git add services/notification-service/src/
git commit -m "feat: improve email template rendering"
git push origin feature/better-emails
```

### 6. Open a Pull Request

Include:
- What you changed
- Why you changed it
- How to test it

## Understanding the Event Flow

### Example: User Creates a Help Request

This shows how loosely coupled the system is:

```
1. User clicks "Create Request" in frontend
           ↓
2. request-service receives POST /api/requests
   - Saves to database
   - Publishes "request_created" event to Redis queue
           ↓
3. Three things happen (independently!):

   reputation-service listens:
   - Awards 1 karma to requester
   - Publishes "karma_awarded" event
   
   notification-service listens:
   - Finds users with matching skills
   - Sends email notifications
   - Publishes "email_sent" event
   
   governance-service listens:
   - Updates community request count
   - Updates governance metrics

4. Frontend automatically shows:
   - Request in community feed
   - Notifications in sidebar
   - Updated karma score
```

**Key insight**: request-service doesn't call reputation-service or notification-service. They all listen to events independently. This means:
- ✅ request-service never fails because reputation-service is slow
- ✅ You can modify reputation-service without touching request-service
- ✅ New services can join by subscribing to existing events
- ✅ It's easier to test and debug each service

## File Structure

Quick reference for where things live:

```
karmyq/
├── docker-compose.yml              # Start everything
├── .env.example                    # Environment variables template
├── README.md                       # Full project docs
│
├── shared/
│   └── types/                      # TypeScript types used by all services
│
├── services/                       # The actual services
│   ├── auth-service/
│   ├── community-service/
│   ├── request-service/
│   ├── reputation-service/
│   ├── messaging-service/
│   ├── notification-service/
│   └── governance-service/
│
├── frontend/                       # React/Next.js web app
│   ├── src/pages/
│   ├── src/components/
│   └── src/services/               # API client
│
├── infrastructure/                 # Docker configs
│   ├── postgres/                   # Database setup
│   ├── nginx/                      # API gateway
│   └── redis/                      # Cache & queue
│
└── docs/                          # Documentation
    ├── ARCHITECTURE.md
    ├── PROJECT_STRUCTURE.md
    ├── SERVICE_GUIDE.md
    └── CONTRIBUTING.md
```

## Troubleshooting

### "docker-compose: command not found"

Docker Compose is not installed or not in PATH.

**Solution:**
```bash
# Install Docker Desktop (includes docker-compose)
# Or install separately: https://docs.docker.com/compose/install/
```

### "Port 3000 is already in use"

Another service is using port 3000.

**Solution:**
```bash
# Kill whatever is on port 3000
lsof -i :3000
kill -9 <PID>

# Or start Karmyq on different port
docker-compose.yml
# Change nginx port from 3000:80 to 3001:80
```

### "Cannot connect to database"

PostgreSQL container didn't start properly.

**Solution:**
```bash
# Check container status
docker-compose ps

# View postgres logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
docker-compose up -d
```

### "Service X is crashing on startup"

Check the service logs:

```bash
docker-compose logs notification-service
# Look for error messages
```

Common issues:
- Database not ready (wait a few seconds)
- Redis not ready
- Environment variables not set
- Port already in use

**Solution:**
```bash
# Restart everything
docker-compose down
docker-compose up -d
sleep 10
docker-compose logs -f
```

### "I modified code but changes didn't appear"

Services reload automatically when you change code in the `src/` directory.

If it's not reloading:
```bash
# Restart the service
docker-compose restart notification-service

# Or rebuild if package.json changed
docker-compose down
docker-compose up -d --build
```

## Next Steps

1. **Read the Architecture**: `ARCHITECTURE.md` - Understand the system design
2. **Pick a Service**: Choose one to contribute to (or ask which needs help!)
3. **Follow the Service Guide**: `SERVICE_GUIDE.md` - Create or modify a service
4. **Write Tests**: Every change should have tests
5. **Submit a PR**: Share your work with the community!

## Key Concepts

**Microservices**: Each service is independent. No shared code, only shared types.

**Event-Driven**: Services communicate through a Redis queue. When something happens, an event is published and subscribers react asynchronously.

**Loose Coupling**: Services don't depend on each other's implementation. They only know about event contracts and API contracts.

**Community Development**: The architecture is designed so a non-expert can understand and contribute to one service without knowing the whole system.

**Dunbar's Number**: Communities are capped at 150 members (the limit of human trust relationships).

**Prestige System**: Instead of money, members earn karma by helping others. This creates positive incentives.

## Questions?

- **Architecture questions?** → `ARCHITECTURE.md`
- **How to build a service?** → `SERVICE_GUIDE.md`
- **Where does X go?** → `PROJECT_STRUCTURE.md`
- **How do I contribute?** → `CONTRIBUTING.md`
- **I'm stuck!** → Check the logs: `docker-compose logs <service-name>`

## Welcome to Karmyq! 🎉

You're about to be part of something special - building a platform that rebuilds societal trust through community mutual aid.

We believe people are good. Help us prove it. 💚

---

**Need help?** Open an issue: https://github.com/karmyq/karmyq/issues

**Want to chat?** Join our community discussions!

**First time contributing?** Look for issues tagged `good-first-issue`.

Happy hacking! 🚀
