# Image-Based Deployment Guide

## Overview

This guide explains how to deploy Karmyq using pre-built Docker images instead of building on the production server.

## Benefits

✅ **Reproducible builds** - Same image everywhere (dev, staging, prod)
✅ **Atomic deployments** - One command to deploy
✅ **Easy rollback** - Revert to previous image tag
✅ **No file sync issues** - Image contains everything
✅ **Faster deployments** - No building on production
✅ **Testable** - Test exact production artifact before deploying
✅ **No browser cache issues** - Each build gets unique file hashes

## Current Problems with Git-Based Deployment

❌ Building on production is slow and uses disk space
❌ Git state and files can diverge
❌ Browser caching defeats deployments
❌ Partial deployments possible (some services updated, others not)
❌ No way to guarantee what version is running
❌ Disk space issues cause build failures

## Architecture

### Image Registry

We'll use **GitHub Container Registry** (ghcr.io) - free, integrated with GitHub, no rate limits.

### Image Naming Convention

```
ghcr.io/ravichavali/karmyq-frontend:v8.0.1
ghcr.io/ravichavali/karmyq-auth-service:v8.0.1
ghcr.io/ravichavali/karmyq-community-service:v8.0.1
```

Format: `ghcr.io/{owner}/{service}:{tag}`

Tags:
- **Semantic versions**: `v8.0.1`, `v8.1.0` (production releases)
- **Commit SHAs**: `sha-abc1234` (development)
- **Latest**: `latest` (always points to newest)

### Deployment Flow

```
Local/CI → Build Images → Push to Registry → Pull on Production → Deploy
```

## Setup Instructions

### 1. Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: `karmyq-ghcr`
4. Scopes: Check `write:packages`, `read:packages`, `delete:packages`
5. Click "Generate token"
6. **Save the token** - you won't see it again

### 2. Configure Local Docker

```bash
# Login to GitHub Container Registry
echo "YOUR_TOKEN" | docker login ghcr.io -u ravichavali --password-stdin
```

### 3. Configure Production Server

```bash
# On production server
ssh ubuntu@karmyq.com
echo "YOUR_TOKEN" | docker login ghcr.io -u ravichavali --password-stdin
```

## Building and Pushing Images

### Option 1: Build All Services Locally

```bash
# Build all images with version tag
./scripts/build-images.sh v8.0.1

# This builds and tags:
# - Frontend
# - All backend services
# - Tags with both version and 'latest'

# Push to registry
./scripts/push-images.sh v8.0.1
```

### Option 2: Build Individual Service

```bash
# Build frontend
docker build -t ghcr.io/ravichavali/karmyq-frontend:v8.0.1 \
  -f apps/frontend/Dockerfile .

# Push to registry
docker push ghcr.io/ravichavali/karmyq-frontend:v8.0.1
```

## Deploying to Production

### Full Deployment (All Services)

```bash
# On production server
cd ~/karmyq
./scripts/deploy-images.sh v8.0.1
```

This script:
1. Pulls all images with the specified tag
2. Stops running containers
3. Starts new containers with the new images
4. Verifies all services are healthy
5. Shows deployment summary

### Deploy Single Service

```bash
# Example: Deploy just the frontend
ssh ubuntu@karmyq.com
docker pull ghcr.io/ravichavali/karmyq-frontend:v8.0.1
docker stop karmyq-frontend
docker rm karmyq-frontend
docker run -d \
  --name karmyq-frontend \
  --network karmyq-network \
  -p 127.0.0.1:3000:3000 \
  -e NODE_ENV=production \
  ghcr.io/ravichavali/karmyq-frontend:v8.0.1
```

## Rolling Back

If a deployment has issues, roll back to the previous version:

```bash
# Roll back to previous version
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy-images.sh v8.0.0  # Previous working version
```

## Monitoring Deployments

### Check Running Versions

```bash
# See what versions are running
docker ps --format 'table {{.Names}}\t{{.Image}}'
```

### View Image History

```bash
# See all available versions in registry
docker images ghcr.io/ravichavali/karmyq-frontend
```

## CI/CD Integration (Future)

### GitHub Actions Workflow

```yaml
name: Build and Deploy

on:
  push:
    branches: [master]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push images
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          ./scripts/build-images.sh $VERSION
          ./scripts/push-images.sh $VERSION

      - name: Deploy to production
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          ssh deploy@karmyq.com "cd ~/karmyq && ./scripts/deploy-images.sh $VERSION"
```

## Best Practices

### Versioning Strategy

- **Major versions** (v9.0.0): Breaking changes, major features
- **Minor versions** (v8.1.0): New features, no breaking changes
- **Patch versions** (v8.0.1): Bug fixes, security patches

### Testing Before Production

```bash
# Build images locally
./scripts/build-images.sh v8.0.1-rc1

# Test locally with docker-compose
docker-compose -f docker-compose.test.yml up

# If tests pass, tag as production release
docker tag ghcr.io/ravichavali/karmyq-frontend:v8.0.1-rc1 \
           ghcr.io/ravichavali/karmyq-frontend:v8.0.1

# Push production tag
docker push ghcr.io/ravichavali/karmyq-frontend:v8.0.1
```

### Disk Space Management

Images can accumulate over time:

```bash
# Clean up old images on production
docker image prune -a --filter "until=720h"  # Remove images older than 30 days

# Or remove specific old versions
docker rmi ghcr.io/ravichavali/karmyq-frontend:v7.0.0
```

## Troubleshooting

### Problem: Image Pull Fails

```
Error response from daemon: unauthorized
```

**Solution**: Re-authenticate with GitHub Container Registry
```bash
echo "YOUR_TOKEN" | docker login ghcr.io -u ravichavali --password-stdin
```

### Problem: Service Won't Start with New Image

**Solution**: Check logs and roll back if needed
```bash
docker logs karmyq-frontend --tail 50
# If issues, roll back
./scripts/deploy-images.sh v8.0.0  # Previous version
```

### Problem: Old Version Still Showing

**Solution**: Browser cache - users need to hard refresh (Ctrl+Shift+R)

## Migration from Git-Based Deployment

### Step 1: Build Initial Images

```bash
# Build current production state
cd ~/karmyq
git pull origin master
./scripts/build-images.sh v8.0.0

# Push to registry
./scripts/push-images.sh v8.0.0
```

### Step 2: Test Image Deployment

```bash
# Deploy from images (on staging or test environment first)
./scripts/deploy-images.sh v8.0.0
```

### Step 3: Switch Production

Once confident:
```bash
# On production
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy-images.sh v8.0.0
```

### Step 4: Remove Old Deployment Scripts

After verifying image-based deployment works:
```bash
# Archive old scripts
mv scripts/deploy-frontend-prod.sh scripts/archive/
mv scripts/build-frontend-prod.sh scripts/archive/
```

## Cost and Storage

### GitHub Container Registry
- **Free tier**: Unlimited public images
- **Private images**: 500MB free, $0.25/GB after
- **Bandwidth**: 1GB/month free, then $0.50/GB

### Recommendations
- Keep last 5 versions of each service
- Auto-delete images older than 90 days
- Use public registry (it's open source anyway)

## Next Steps

1. Create deployment scripts (`build-images.sh`, `push-images.sh`, `deploy-images.sh`)
2. Test locally with a single service (frontend)
3. Deploy to staging environment
4. Deploy to production
5. Set up GitHub Actions for automated builds
6. Document rollback procedures
7. Train team on new workflow
