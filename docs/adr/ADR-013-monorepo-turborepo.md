# ADR-013: Monorepo with Turborepo

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: package.json, turbo.json

## Context

Karmyq has multiple applications (frontend web, mobile) and shared code (utilities, types, schemas). We needed to decide how to organize the codebase.

## Decision

**Use a monorepo with Turborepo for build orchestration.**

### Structure

```
karmyq/
├── apps/
│   ├── frontend/          # Next.js web app
│   └── mobile/            # React Native mobile app
├── services/
│   ├── auth-service/      # Microservice
│   ├── community-service/
│   └── ...                # 9 total services
├── packages/
│   └── shared/            # Shared utilities, types, middleware
└── infrastructure/
    ├── docker/
    └── postgres/
```

### Shared Package

```typescript
// packages/shared/src/
├── middleware/         # Auth, logging, error handling
├── types/             # TypeScript interfaces
├── schemas/           # Zod validation
├── utils/             # Helper functions
└── constants/         # Shared constants
```

**Import Pattern:**
```typescript
import { authenticateToken } from '@karmyq/shared/middleware/auth';
import { sendSuccess } from '@karmyq/shared/utils/response';
import { RidePayloadSchema } from '@karmyq/shared/schemas/requests/ride';
```

### Turborepo Benefits

- **Dependency Awareness**: Only rebuilds affected packages
- **Parallel Execution**: Builds multiple services concurrently
- **Caching**: Skips unchanged packages
- **Task Pipelines**: Defines build order

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

## Consequences

### Positive

- **Code Sharing**: Single source of truth for types, utilities
- **Atomic Commits**: Change interface + all implementations together
- **Refactoring Easier**: Find all usages across codebase
- **Consistent Versions**: All services use same shared code version
- **Fast Builds**: Turborepo caching speeds up CI/CD

### Negative

- **Repo Size**: Larger repository than multi-repo
- **Clone Time**: Longer initial clone
- **Build Complexity**: Turborepo learning curve
- **Merge Conflicts**: More likely with single repo

## Alternatives Considered

### Alternative 1: Multi-Repo (Polyrepo)

- **Description**: Separate repo for each service, separate npm packages
- **Why rejected**: Version coordination nightmare, harder refactoring

### Alternative 2: Lerna

- **Description**: Older monorepo tool
- **Why rejected**: Turborepo faster, better caching, more modern

### Alternative 3: Nx

- **Description**: More feature-rich monorepo tool
- **Why rejected**: Overkill for our needs, steeper learning curve

## References

- Root package.json: `package.json`
- Turborepo config: `turbo.json`
- Shared package: `packages/shared/`
- Turborepo docs: https://turbo.build/repo
