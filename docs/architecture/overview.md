# Karmyq Project Structure

## Directory Layout

```
karmyq/
├── services/          # Backend microservices
├── frontend/          # Next.js PWA
├── infrastructure/    # Database & configs
├── shared/            # Shared TypeScript types
├── docs/              # Documentation
├── .github/           # CI/CD workflows
└── docker-compose.yml # Service orchestration
```

## Services

- auth-service (Port 3001) - COMPLETE
- community-service (Port 3002) - TODO
- request-service (Port 3003) - TODO
- reputation-service (Port 3004) - TODO
- messaging-service (Port 3005) - TODO
- notification-service (Port 3006) - TODO
- governance-service (Port 3007) - TODO

## Frontend

- Next.js React app (Port 3000)
- Tailwind CSS
- Pages: home, login, register, dashboard

## Documentation

All guides moved to docs/ folder:
- GETTING_STARTED.md
- DOCKER_SETUP.md
- NEXT_STEPS.md
- RUN_TESTS.md
- And more...

## Key Files

- docker-compose.yml - Container orchestration
- infrastructure/postgres/init.sql - All database schemas
- shared/types/index.ts - TypeScript definitions
- .github/workflows/test.yml - CI/CD pipeline
