# ADR-028: NPM Workspace Package for Shared Code in Docker

**Date**: 2026-01-30
**Status**: Accepted
**Decision Makers**: Engineering Team

## Context

Services were failing at runtime with "Cannot use import statement outside a module" errors when importing from `@karmyq/shared`. Investigation revealed multiple issues with how the shared package was being built and deployed in Docker containers.

### Problems Encountered

1. **TypeScript source imported instead of compiled JavaScript**: Production containers had both `.ts` source files and compiled `.js` files, causing Node.js to resolve incorrectly
2. **Missing TypeScript type definitions**: `@types/express`, `@types/pg`, `@types/node` missing from shared package devDependencies
3. **Incorrect tsconfig rootDir**: Services compiling to `dist/src/` instead of `dist/`
4. **Module resolution timing**: npm install ran before compiled shared package was available
5. **Platform-specific code in builds**: `api/client.ts` included in server builds despite requiring browser-only dependencies

## Decision

Implement `@karmyq/shared` as a proper npm workspace package with the following requirements:

### 1. Shared Package Configuration

**packages/shared/tsconfig.json**:
```json
{
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    // ... other options
  },
  "include": ["**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "api/client.ts",
    "api/mobile-storage.ts",
    "api/web-storage.ts"
  ]
}
```

**packages/shared/package.json**:
```json
{
  "name": "@karmyq/shared",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./utils/logger": {
      "types": "./dist/utils/logger.d.ts",
      "default": "./dist/utils/logger.js"
    }
    // ... more exports
  },
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9"
    // ... other types
  }
}
```

### 2. Service tsconfig Configuration

**services/{service}/tsconfig.json**:
```json
{
  "compilerOptions": {
    "rootDir": "./src",  // CRITICAL: prevents dist/src/
    "outDir": "./dist"
  },
  "include": ["src/**/*"],  // NOT tests/**/*
  "exclude": ["node_modules", "dist", "../shared"]
}
```

### 3. Dockerfile Build Order (TypeScript Services)

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# 1. Copy workspace package.json
COPY package.json package-lock.json* ./

# 2. Copy package declarations
COPY packages/shared/package*.json ./packages/shared/
COPY services/{service}/package*.json ./services/{service}/

# 3. Install dependencies
RUN npm install

# 4. Build shared package FIRST
COPY packages/shared/ ./packages/shared/
RUN rm -f ./packages/shared/api/client.ts \
           ./packages/shared/api/mobile-storage.ts \
           ./packages/shared/api/web-storage.ts
WORKDIR /app/packages/shared
RUN npm run build

# 5. Build service
COPY services/{service}/ /app/services/{service}/
WORKDIR /app/services/{service}
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# 1. Copy workspace root
COPY package.json package-lock.json* ./

# 2. Copy COMPILED shared package BEFORE npm install
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# 3. Copy service package.json
COPY services/{service}/package*.json ./services/{service}/

# 4. Install production dependencies (workspace sees compiled dist/)
RUN npm install --omit=dev

# 5. Copy compiled service
COPY --from=builder /app/services/{service}/dist ./services/{service}/dist

WORKDIR /app/services/{service}
CMD ["node", "dist/index.js"]
```

### 4. Special Case: JavaScript-Only Services (geocoding)

```dockerfile
# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy package.json
COPY services/geocoding-service/package*.json ./

# Install dependencies directly (NOT as workspace)
RUN npm install --omit=dev

# Copy service source
COPY services/geocoding-service/index.js ./index.js

CMD ["node", "./index.js"]
```

## Consequences

### Positive

- **Proper module resolution**: Services correctly import compiled JavaScript
- **Type safety during development**: TypeScript has all type definitions
- **Consistent build output**: All services compile to `dist/index.js`
- **Faster Docker builds**: Shared package built once, reused by all services
- **Clear separation**: Platform-specific code excluded from server builds

### Negative

- **Build complexity**: Multi-stage builds with specific ordering required
- **Dockerfile duplication**: Similar patterns across all service Dockerfiles
- **Debugging difficulty**: Build failures can be hard to trace through multiple stages

### Neutral

- **Workspace awareness required**: Developers must understand npm workspaces
- **Build order dependency**: Shared package must build before services

## Implementation Checklist

When creating a new TypeScript service:

- [ ] Add `"rootDir": "./src"` to tsconfig.json
- [ ] Set `"include": ["src/**/*"]` (exclude tests)
- [ ] Copy Dockerfile from existing TypeScript service
- [ ] Verify `npm run build` produces `dist/index.js` (not `dist/src/index.js`)
- [ ] Test Docker build: `docker build -t test-service -f services/{service}/Dockerfile .`
- [ ] Verify runtime: imports resolve to `@karmyq/shared/dist/*.js`

When modifying shared package:

- [ ] Ensure all type dependencies in devDependencies
- [ ] Exclude platform-specific files from tsconfig
- [ ] Update package.json exports for new modules
- [ ] Run `npm run build` in shared package
- [ ] Rebuild dependent services to test

## Lessons Learned

1. **Copy order matters**: Shared package dist/ must exist before `npm install` in production stage
2. **Empty arrays don't override**: `volumes: []` in docker-compose doesn't clear volumes; use `volumes: ~`
3. **TypeScript rootDir is critical**: Without it, directory structure is preserved in output
4. **Workspace resolution is Node.js, not TypeScript**: package.json exports control runtime resolution

## Related ADRs

- ADR-004: Microservices + Event-Driven Architecture
- ADR-023: Infrastructure Standardization

## References

- [npm workspaces documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
