# Self-Hosted Docker Registry Setup

This guide explains how to set up and use the self-hosted Docker registry for Karmyq.

## Why Self-Hosted Registry?

- **No Storage Limits**: GitHub Container Registry free tier has 500MB limit, our images total ~5GB
- **Fast Local Network**: Transfers between local machine and production server are faster
- **Cost Effective**: Completely free, no subscription needed
- **Full Control**: Manage your own images and storage

## Architecture

```
Development Machine                Production Server
┌─────────────────┐                ┌──────────────────────┐
│                 │                │                      │
│  Build Images   │                │  Docker Registry     │
│  (localhost)    │────push───────▶│  (karmyq.com:5000)  │
│                 │                │  Port 5000           │
│                 │                │                      │
└─────────────────┘                │  Docker Services     │
                                   │  (pull from registry)│
                                   └──────────────────────┘
```

## Setup on Production Server

### Step 1: Initial Setup

SSH into production server and run the setup script:

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/setup-registry.sh
```

This script will:
1. Create registry directories
2. Generate secure authentication credentials
3. Save credentials to `~/.karmyq-registry-creds`
4. Display the credentials (save them securely!)

### Step 2: Start the Registry

```bash
cd ~/karmyq/infrastructure/docker
docker-compose up -d registry
```

Verify it's running:
```bash
docker ps | grep registry
# Should show: karmyq-registry running on port 5000
```

### Step 3: Update Nginx Configuration

The registry is proxied through nginx at `/v2/` endpoint:

```bash
# Copy updated nginx config
sudo cp ~/karmyq/infrastructure/nginx/karmyq.com.conf /etc/nginx/sites-available/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Login to Registry

Using the credentials from Step 1:

```bash
docker login karmyq.com -u karmyq-admin
# Enter password when prompted
```

### Step 5: Verify Registry

```bash
# Check registry API
curl -u karmyq-admin:PASSWORD https://karmyq.com/v2/_catalog

# Should return: {"repositories":[]}
```

## Local Development Workflow

### Step 1: Login to Production Registry

On your development machine:

```bash
docker login karmyq.com -u karmyq-admin
# Enter password
```

### Step 2: Build Images

Build all images with version tag:

```bash
cd c:/Users/ravic/development/karmyq
bash scripts/build-images.sh v8.1.0 karmyq.com
```

This builds all 11 images:
- Frontend: ~213MB
- Auth Service: ~762MB
- Community Service: ~867MB
- Request Service: ~480MB
- Reputation Service: ~480MB
- Notification Service: ~480MB
- Messaging Service: ~324MB
- Feed Service: ~465MB
- Cleanup Service: ~348MB
- Geocoding Service: ~209MB
- Social Graph Service: ~497MB

**Total: ~5GB**

### Step 3: Push Images to Registry

```bash
bash scripts/push-images.sh v8.1.0 karmyq.com
```

This pushes all images to `karmyq.com` registry.

**Note**: First push will take ~10-15 minutes depending on internet speed. Subsequent pushes are faster due to layer caching.

### Step 4: Deploy to Production

SSH to production and deploy:

```bash
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy-images.sh v8.1.0 karmyq.com
```

This will:
1. Pull images from local registry (fast!)
2. Stop old containers
3. Start new containers with the new images
4. Verify deployment

## Registry Management

### List Images in Registry

```bash
curl -u karmyq-admin:PASSWORD https://karmyq.com/v2/_catalog
```

### List Tags for an Image

```bash
curl -u karmyq-admin:PASSWORD https://karmyq.com/v2/karmyq-frontend/tags/list
```

### Check Registry Storage

```bash
# On production server
docker exec karmyq-registry du -sh /var/lib/registry
```

### Delete Old Images

If storage grows too large, delete old images:

```bash
# Get image digest
curl -I -u karmyq-admin:PASSWORD \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
  https://karmyq.com/v2/karmyq-frontend/manifests/v8.0.0

# Delete by digest
curl -X DELETE -u karmyq-admin:PASSWORD \
  https://karmyq.com/v2/karmyq-frontend/manifests/sha256:DIGEST

# Garbage collect to free space
docker exec karmyq-registry bin/registry garbage-collect /etc/docker/registry/config.yml
```

## Troubleshooting

### Can't Push Images

**Error**: `unauthorized: authentication required`

**Solution**: Login to registry
```bash
docker login karmyq.com -u karmyq-admin
```

### Slow Push/Pull

**Cause**: Large images, slow internet

**Solution**:
- First push takes time, be patient
- Consider pushing during off-peak hours
- Use `latest` tag for quick deployments (already on registry)

### Registry Not Accessible

**Check 1**: Is registry container running?
```bash
ssh ubuntu@karmyq.com
docker ps | grep registry
```

**Check 2**: Is nginx configured correctly?
```bash
sudo nginx -t
curl -u user:pass http://localhost:5000/v2/_catalog
```

**Check 3**: Are ports open?
```bash
sudo netstat -tlnp | grep 5000
```

### Disk Space Full

**Check space**:
```bash
df -h
docker system df
```

**Clean up**:
```bash
# Remove old unused images
docker image prune -a

# Remove build cache
docker builder prune -a

# Garbage collect registry
docker exec karmyq-registry bin/registry garbage-collect /etc/docker/registry/config.yml
```

## Security Notes

1. **Strong Passwords**: Registry uses bcrypt hashed passwords in htpasswd
2. **HTTPS Only**: All registry access goes through nginx with SSL/TLS
3. **Private Network**: Registry port 5000 is bound to 127.0.0.1 (localhost only)
4. **Authentication Required**: All API calls require HTTP Basic Auth
5. **Credentials Storage**: Keep `~/.karmyq-registry-creds` secure, chmod 600

## Rollback Procedure

If a deployment goes wrong, rollback to previous version:

```bash
# On production
./scripts/deploy-images.sh v8.0.0 karmyq.com
```

Images stay in registry, so rollback is fast (no rebuild needed).

## Complete Deployment Workflow

```bash
# 1. On local machine: Build and push
cd c:/Users/ravic/development/karmyq
bash scripts/build-images.sh v8.1.0 karmyq.com
bash scripts/push-images.sh v8.1.0 karmyq.com

# 2. On production: Deploy
ssh ubuntu@karmyq.com
cd ~/karmyq
./scripts/deploy-images.sh v8.1.0 karmyq.com

# 3. Verify
curl https://karmyq.com/health
docker ps --filter "name=karmyq"

# 4. Monitor logs
docker logs karmyq-frontend --follow
```

## Comparison: Git-Based vs Image-Based Deployment

| Aspect | Git-Based | Image-Based (Registry) |
|--------|-----------|----------------------|
| Build Location | Production server | Local machine |
| Build Time | ~10-15 mins on prod | ~10-15 mins locally |
| Deploy Time | ~15 mins (build + start) | ~2 mins (pull + start) |
| Network Usage | Git pull (~100MB) | Image pull (~5GB first time) |
| Rollback | Rebuild previous commit | Pull previous version (fast) |
| Testing | Can't test before prod | Test locally before push |
| Prod Resource Usage | High (npm install, build) | Low (just pull) |
| Flakiness | Moderate (git conflicts) | Low (immutable images) |

**Winner**: Image-based deployment - faster, more reliable, testable locally.

## Cost Analysis

### GitHub Container Registry (ghcr.io)
- Free tier: 500MB storage
- Our images: 5GB (10x over limit)
- Cost for 5GB: ~$0.25/GB = $1.25/month minimum

### Self-Hosted Registry
- Server storage: Already paid for
- Bandwidth: Internal network (free)
- Registry overhead: <100MB RAM
- **Total cost: $0**

## Files Modified/Created

- `infrastructure/docker/registry/config.yml` - Registry configuration
- `infrastructure/docker/registry/README.md` - Registry documentation
- `infrastructure/docker/docker-compose.yml` - Added registry service
- `infrastructure/nginx/karmyq.com.conf` - Added `/v2/` location
- `scripts/setup-registry-auth.sh` - Generate htpasswd file
- `scripts/setup-registry.sh` - Complete production setup
- `scripts/build-images.sh` - Updated to support custom registry
- `scripts/push-images.sh` - Updated to support custom registry
- `scripts/deploy-images.sh` - Updated to support custom registry
- `docs/operations/SELF_HOSTED_REGISTRY.md` - This documentation
