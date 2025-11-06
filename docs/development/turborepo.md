# Turborepo Setup Guide

Karmyq uses Turborepo to manage our monorepo structure efficiently.

## What is Turborepo?

Turborepo is a high-performance build system for JavaScript/TypeScript monorepos. It provides:
- ⚡ Fast parallel execution of tasks
- 🔄 Intelligent caching (only rebuild what changed)
- 📦 Simple workspace management
- 🎯 Task orchestration across packages

## Project Structure

```
karmyq/
├── apps/                    # Applications
│   └── frontend/           # Next.js frontend
├── services/               # Backend microservices
│   ├── auth-service/
│   ├── community-service/
│   ├── messaging-service/
│   ├── notification-service/
│   ├── reputation-service/
│   └── request-service/
├── packages/               # Shared packages
│   └── shared/            # Shared types, constants, utilities
├── infrastructure/         # Docker, observability, etc.
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── turbo.json            # Turborepo configuration
└── package.json          # Root workspace config
```

## Quick Start

### Run all services in development mode
```bash
npm run dev
```

This will start all services in parallel (though for Docker services, use the Docker Compose method below).

### Build everything
```bash
npm run build
```

### Run tests across all packages
```bash
npm run test
```

### Lint all code
```bash
npm run lint
```

## Working with Workspaces

### Install dependencies for all workspaces
```bash
npm install
```

### Add a dependency to a specific workspace
```bash
# Add to frontend
npm install --workspace=apps/frontend <package-name>

# Add to auth-service
npm install --workspace=services/auth-service <package-name>

# Add to shared package
npm install --workspace=packages/shared <package-name>
```

### Run a command in a specific workspace
```bash
# Run dev in frontend only
npm run dev --workspace=apps/frontend

# Build auth-service only
npm run build --workspace=services/auth-service
```

## Turborepo Commands

### Run task in specific packages
```bash
# Build only frontend
turbo run build --filter=frontend

# Test only auth-service
turbo run test --filter=auth-service

# Run multiple
turbo run build --filter=frontend --filter=auth-service
```

### Force rebuild (ignore cache)
```bash
turbo run build --force
```

### Dry run (see what would be executed)
```bash
turbo run build --dry-run
```

### See dependency graph
```bash
turbo run build --graph
```

## Docker Development

Even with Turborepo, we use Docker Compose for running services:

```bash
# Start all services
cd infrastructure/docker
docker-compose up -d

# Or use the convenience script
bash scripts/dev/start.sh
```

## Adding New Packages

### 1. Create a new shared package
```bash
mkdir -p packages/new-package
cd packages/new-package
npm init -y
```

### 2. Update package.json
```json
{
  "name": "@karmyq/new-package",
  "version": "1.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts"
}
```

### 3. Use in services
```typescript
// In any service
import { something } from '@karmyq/new-package';
```

## Adding New Services

### 1. Create service directory
```bash
mkdir -p services/new-service
cd services/new-service
npm init -y
```

### 2. Add to docker-compose.yml
```yaml
new-service:
  build:
    context: ../../services/new-service
  container_name: karmyq-new-service
  # ... rest of config
```

### 3. Add dev/build scripts to service's package.json
```json
{
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "test": "jest"
  }
}
```

## Turborepo Pipeline Configuration

The [turbo.json](../../turbo.json) file defines task pipelines:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],  // Build dependencies first
      "outputs": ["dist/**", ".next/**"]  // Cache these folders
    },
    "dev": {
      "cache": false,  // Don't cache dev mode
      "persistent": true  // Keep running
    },
    "test": {
      "dependsOn": ["build"],  // Run after build
      "outputs": ["coverage/**"]
    }
  }
}
```

## Caching

Turborepo automatically caches task outputs based on:
- Input files (source code)
- Dependencies in package.json
- Environment variables
- Previous task outputs

### Clear cache
```bash
turbo run build --force
# or
rm -rf node_modules/.cache/turbo
```

## CI/CD Integration

Turborepo works great with GitHub Actions:

```yaml
- name: Install dependencies
  run: npm ci

- name: Build
  run: turbo run build

- name: Test
  run: turbo run test
```

## Best Practices

1. **Keep services independent** - Don't import directly from other services
2. **Use packages/ for shared code** - Types, utils, constants go here
3. **One package.json per workspace** - Each app/service/package has its own
4. **Use npm workspaces commands** - Don't cd into directories to install
5. **Leverage caching** - Let Turborepo cache builds for speed
6. **Test locally before CI** - Run `turbo run test` before pushing

## Troubleshooting

### Workspace not found
```bash
# Re-install to rebuild workspace links
npm install
```

### Cache issues
```bash
# Clear Turborepo cache
rm -rf node_modules/.cache/turbo

# Clear all node_modules
rm -rf node_modules services/*/node_modules apps/*/node_modules
npm install
```

### Docker build issues
```bash
# Rebuild without cache
cd infrastructure/docker
docker-compose build --no-cache
```

## Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [npm Workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [Monorepo Best Practices](https://turbo.build/repo/docs/handbook)
