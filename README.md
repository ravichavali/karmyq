# Karmyq - Community Mutual Aid Platform

A trust-based community platform where people help each other without money, building reputation through karma.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### Start the Platform

```bash
# Clone the repository (or use your local setup)
git clone <your-repo-url>
cd karmyq

# Start all services
docker-compose up --build

# Wait for all services to start (about 30-60 seconds)
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **Redis Commander** (Event Queue Viewer): http://localhost:8081
- **PostgreSQL**: localhost:5432 (user: karmyq_user, password: karmyq_password_dev)

## Architecture

### Microservices
- **Auth Service** (Port 3001): User authentication, registration, JWT tokens
- **Frontend** (Port 3000): Next.js React PWA

### Infrastructure
- **PostgreSQL**: All data storage with separate schemas per service
- **Redis**: Event queue for loosely-coupled service communication
- **Redis Commander**: Visual interface to monitor events

## Features Implemented

- User Registration
- User Login with JWT authentication
- Protected Dashboard
- Event Publishing System
- Database Schemas for all future services

## Project Structure

```
karmyq/
├── services/              # Microservices
│   └── auth-service/      # ✅ Complete - User authentication
├── frontend/              # ✅ Complete - Next.js PWA
├── infrastructure/        # Database & gateway configs
├── shared/                # Shared TypeScript types
├── docs/                  # 📚 All documentation (moved here)
└── docker-compose.yml     # Service orchestration
```

**See [STRUCTURE.md](STRUCTURE.md) for detailed organization**

## Development

### Testing the Auth Service

```bash
# Register a new user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Verify token (replace YOUR_TOKEN)
curl -X GET http://localhost:3001/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
docker-compose logs -f frontend
```

### Restart a Service

```bash
docker-compose restart auth-service
```

### Stop Everything

```bash
docker-compose down

# With volumes (clears database)
docker-compose down -v
```

## Next Steps

1. **Build More Services**: Community Service, Request Service, etc.
2. **Add Frontend Features**: Community creation, request posting
3. **Implement Event Subscribers**: Services listening to events
4. **Add Testing**: Unit and integration tests
5. **Deploy**: Production deployment guide

## Technology Stack

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: React, Next.js, Tailwind CSS
- **Database**: PostgreSQL
- **Queue**: Redis + Bull
- **Container**: Docker & Docker Compose

## Contributing

See [Context/CONTRIBUTING.md](Context/CONTRIBUTING.md) for detailed contribution guidelines.

## Documentation

- [Architecture Overview](Context/ARCHITECTURE.md)
- [Service Guide](Context/SERVICE_GUIDE.md)
- [Project Structure](Context/PROJECT_STRUCTURE.md)

## License

MIT (or your chosen license)

## Built with Community

Karmyq is designed for community-driven development. Each service is independent, making it easy for multiple contributors to work in parallel.

## Documentation

All guides are now in the [docs/](docs/) folder:

| Guide | Purpose |
|-------|---------|
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Complete setup guide |
| [DOCKER_SETUP.md](docs/DOCKER_SETUP.md) | Docker troubleshooting |
| [START_WINDOWS.md](docs/START_WINDOWS.md) | Windows-specific guide |
| [NEXT_STEPS.md](docs/NEXT_STEPS.md) | What to build next |
| [RUN_TESTS.md](docs/RUN_TESTS.md) | How to run tests |
| [PUSH_TO_GITHUB.md](docs/PUSH_TO_GITHUB.md) | Push to GitHub |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Current status |

## Testing

```bash
cd services/auth-service
npm test
```

See [docs/RUN_TESTS.md](docs/RUN_TESTS.md) for complete testing guide.

## Contributing

1. Write tests first (TDD)
2. Ensure 80%+ code coverage
3. Follow existing patterns
4. Update documentation

See [Context/CONTRIBUTING.md](Context/CONTRIBUTING.md) for guidelines.
