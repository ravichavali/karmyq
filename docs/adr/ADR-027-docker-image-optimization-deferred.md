# ADR-027: Docker Image Size Optimization (Deferred Technical Debt)

**Status**: Accepted
**Date**: 2026-01-12
**Deciders**: Development Team
**Related**: ADR-026 (Self-Hosted Docker Registry)

## Context

During implementation of the self-hosted Docker registry (ADR-026), we discovered that our Docker images are significantly larger than optimal:

### Current Image Sizes

| Service | Size | Status |
|---------|------|--------|
| Frontend | 213MB | ✅ Optimized (multi-stage build) |
| Auth Service | 762MB | ❌ Unoptimized |
| Community Service | 867MB | ❌ Unoptimized (largest) |
| Request Service | 480MB | ❌ Unoptimized |
| Reputation Service | 480MB | ❌ Unoptimized |
| Notification Service | 480MB | ❌ Unoptimized |
| Messaging Service | 324MB | ❌ Unoptimized |
| Feed Service | 465MB | ❌ Unoptimized |
| Cleanup Service | 348MB | ❌ Unoptimized |
| Geocoding Service | 209MB | ❌ Unoptimized |
| Social Graph Service | 497MB | ❌ Unoptimized |
| **Total** | **~5GB** | ❌ Could be ~1.7GB (66% reduction) |

### Root Causes of Large Images

1. **Build Tools Retained** (281MB per service)
   - Python3, make, g++ installed for bcrypt compilation
   - Not removed in final image (no multi-stage build)

2. **Full node_modules** (155MB per service)
   - Includes devDependencies (TypeScript, testing tools, etc.)
   - Not pruned to production-only dependencies

3. **Source Files Included** (~10MB per service)
   - TypeScript source files (not needed after compilation)
   - Test files and documentation
   - Build artifacts

4. **No Multi-Stage Builds**
   - All intermediate layers remain in final image
   - Dockerfile pattern: Install → Copy Everything → Run Dev
   - Missing production optimization

### Optimization Potential

With proper multi-stage builds:
```dockerfile
# Current (auth-service): 762MB
FROM node:18-alpine
RUN apk add --no-cache python3 make g++  # 281MB kept!
RUN npm install  # 155MB with devDeps
COPY . .  # Everything copied
CMD ["npm", "run", "dev"]

# Optimized: ~150MB (80% smaller)
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++
RUN npm ci --only=production
RUN npm run build

FROM node:18-alpine AS runtime
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

**Potential savings**:
- Per service: 480MB → 150MB (~330MB saved)
- Total: 5GB → 1.7GB (~3.3GB / 66% reduction)

## Decision

**We will defer Docker image optimization** and document it as technical debt for future work.

### Why Defer?

1. **Self-Hosted Registry Solves Immediate Problem**
   - No storage limits (vs 500MB GHCR free tier)
   - 5GB images fit comfortably on production server
   - Cost is $0 regardless of image size

2. **Limited Impact on Workflow**
   - First push: 5GB takes ~15 mins (1.7GB would take ~5 mins)
   - Subsequent pushes: Layer caching makes both fast
   - Pull times on production: Local network is fast either way
   - Build times: Same (optimization doesn't speed up builds)

3. **Optimization Requires Significant Work**
   - 10 backend Dockerfiles need rewriting
   - Each service needs testing after changes
   - Estimated effort: 1-2 hours work + testing
   - Risk of breaking production builds

4. **Current System Works**
   - Images build successfully
   - Services run correctly
   - Deployment pipeline functional

### When to Optimize?

Trigger optimization when any of these conditions occur:

1. **Storage becomes a concern**
   - Registry disk usage exceeds 70%
   - Multiple versions accumulate (5GB × 10 versions = 50GB)

2. **Transfer speed becomes pain point**
   - Slow deployments due to image size
   - Bandwidth costs increase
   - Team feedback about slow pushes/pulls

3. **Build times need improvement**
   - When combined with other build optimizations
   - As part of CI/CD pipeline improvements

4. **Professional polish needed**
   - Before open-sourcing
   - For investor demos
   - Production readiness audit

## Consequences

### Positive
- ✅ Focus on feature development, not infrastructure optimization
- ✅ Self-hosted registry deployed faster (no optimization delays)
- ✅ No risk of breaking builds with Dockerfile changes
- ✅ Technical debt documented for future planning

### Negative
- ❌ Larger storage footprint (5GB vs 1.7GB per version)
- ❌ Slower first-time pushes/pulls (~15 mins vs ~5 mins)
- ❌ Less professional image sizes
- ❌ Technical debt accumulates if not addressed

### Neutral
- 📦 Storage cost: $0 either way (self-hosted)
- 📦 Subsequent operations: Fast with layer caching regardless
- 📦 Runtime performance: Unaffected by image size

## Implementation Plan (Future)

When optimization is triggered, follow this approach:

### Phase 1: Create Optimized Dockerfile Template
```dockerfile
# Multi-stage production Dockerfile template
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE ${PORT}
CMD ["node", "dist/index.js"]
```

### Phase 2: Optimize Services in Batches
1. Start with smallest service (geocoding-service, 209MB)
2. Test thoroughly before proceeding
3. Roll out to remaining services
4. Update documentation

### Phase 3: Measure Impact
- Before/after size comparison
- Push/pull speed comparison
- Storage savings calculation
- Document in ADR amendment

## Alternatives Considered

### Alternative 1: Optimize Immediately
**Rejected**: Delays registry deployment, adds risk, limited immediate benefit.

### Alternative 2: Optimize Only Problem Services
**Rejected**: Inconsistent Dockerfiles, technical debt remains for most services.

### Alternative 3: Never Optimize
**Rejected**: Technical debt would accumulate indefinitely, professional polish lacking.

## References

- [Self-Hosted Registry Documentation](../operations/SELF_HOSTED_REGISTRY.md)
- ADR-026: Self-Hosted Docker Registry
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Frontend Dockerfile](../../apps/frontend/Dockerfile) - Example of optimized build
- Current backend Dockerfiles: `services/*/Dockerfile` (all need optimization)

## Metrics to Track

When optimization is implemented, measure:
- Image size reduction (target: 66%)
- Push time improvement (target: 50%)
- Pull time improvement (target: 50%)
- Storage savings over time (GB saved × # of versions)

## Notes

- Frontend already uses multi-stage builds (213MB, well optimized)
- Backend services all use same unoptimized pattern
- This is **intentional technical debt**, not oversight
- Decision may be revisited if conditions change
