# Frontend API Fix Deployment Guide

## Overview
This guide covers deploying the frontend API routing fixes to production (karmyq.com / 132.226.89.171).

## Problem Summary
The frontend was experiencing extensive 500/404 errors due to:
1. **Missing production environment variables** - `.env.production` didn't exist
2. **Incorrect nginx routing** - Was passing `/api/communities/` to `/api/communities/` instead of stripping the `/api` prefix
3. **Path doubling** - Frontend calling `/api/communities/communities` instead of `/api/communities`

## Solution Summary
1. Created [apps/frontend/.env.production](../../apps/frontend/.env.production) with correct API URLs
2. Fixed [infrastructure/nginx/karmyq.com.conf](../../infrastructure/nginx/karmyq.com.conf) to strip `/api` prefix
3. Created deployment script [scripts/fix-frontend-production.sh](../../scripts/fix-frontend-production.sh)

## Deployment Steps

### On Production Server (132.226.89.171)

```bash
# SSH to production server
ssh ubuntu@karmyq.com  # or ssh ubuntu@132.226.89.171

# Navigate to karmyq directory
cd ~/karmyq

# Pull latest changes (includes the deployment script)
git pull origin master

# Make scripts executable
chmod +x scripts/*.sh

# Run deployment script (all-in-one)
./scripts/deploy-frontend-fixes.sh
```

**OR** run steps manually:

```bash
# 1. Pull latest changes
git pull origin master

# 2. Make scripts executable
chmod +x scripts/*.sh

# 3. Setup git hooks (one-time)
./scripts/setup-production-hooks.sh

# 4. Deploy frontend fixes
./scripts/fix-frontend-production.sh
```

## What the Deployment Does

### 1. Updates Nginx Configuration
- Backs up current config to `/etc/nginx/sites-available/karmyq.backup-YYYYMMDD-HHMM`
- Copies new config from `infrastructure/nginx/karmyq.com.conf`
- Tests config with `nginx -t`
- If test fails, restores backup automatically

**Key Changes**:
```nginx
# Before (WRONG - was doubling paths)
location /api/communities/ {
    proxy_pass http://community_service/api/communities/;
}

# After (CORRECT - strips /api prefix)
location /api/communities/ {
    proxy_pass http://community_service/communities/;
}
```

### 2. Rebuilds Frontend
- Uses [apps/frontend/.env.production](../../apps/frontend/.env.production) automatically in build
- Sets all API URLs to `/api` (not `/api/communities`, `/api/requests`, etc.)
- So `communityApi` with `baseURL=/api` + `.get('/communities')` = `/api/communities` ✓

**Environment Variables**:
```bash
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_COMMUNITY_API_URL=/api
NEXT_PUBLIC_REQUEST_API_URL=/api
# ... all set to /api base
```

### 3. Restarts Services
- Reloads nginx: `systemctl reload nginx`
- Restarts frontend container: `docker restart karmyq-frontend`

## Verification

### 1. Test API Routes
```bash
# Should return 200 OK with health status
curl https://karmyq.com/api/auth/health

# Should return 200 OK with communities array
curl https://karmyq.com/api/communities/communities

# Should return 200 OK with requests array
curl https://karmyq.com/api/requests/requests
```

### 2. Check Frontend in Browser
- Visit https://karmyq.com/dashboard
- Open browser console (F12)
- Should see **NO** 500/404 errors
- Should see successful API calls like:
  - `GET /api/communities 200`
  - `GET /api/requests/feed 200`
  - `GET /api/notifications 200`

### 3. Verify Services
```bash
# Check all containers are running
docker ps

# Check nginx is running
sudo systemctl status nginx

# Check recent logs
docker logs karmyq-frontend --tail 50
docker logs karmyq-community-service --tail 50
docker logs karmyq-request-service --tail 50
```

## Rollback (If Needed)

If deployment fails:

```bash
# Nginx config is automatically restored on test failure
# To manually restore:
sudo cp /etc/nginx/sites-available/karmyq.backup-YYYYMMDD-HHMM /etc/nginx/sites-available/karmyq
sudo systemctl reload nginx

# Rebuild frontend with previous code
cd ~/karmyq
git reset --hard HEAD~1
cd apps/frontend
npm run build
cd ../..
docker restart karmyq-frontend
```

## Next Steps After Deployment

Once frontend is working:

1. **Production Seeding** - Create 2000 users and 200 communities
   ```bash
   # Option 1: Direct SQL (faster - 2-3 minutes)
   ./scripts/seed-direct-sql.sh

   # Option 2: API-based (slower - 15-20 minutes)
   export DEMO_PASSWORD=your_secure_password
   ./scripts/seed-with-no-rate-limit.sh
   ```

2. **Fix Messaging Service** - Investigate 502 errors on `/api/messages/conversations`

3. **Configure WebSocket/SSE** - For real-time notifications

## Timeline
- **Duration**: 5-10 minutes
- **Downtime**: ~10 seconds (during nginx reload and frontend restart)
- **Risk**: Low (automatic rollback on nginx test failure)

## Related Files
- [apps/frontend/.env.production](../../apps/frontend/.env.production) - Production environment variables
- [infrastructure/nginx/karmyq.com.conf](../../infrastructure/nginx/karmyq.com.conf) - Nginx configuration
- [scripts/fix-frontend-production.sh](../../scripts/fix-frontend-production.sh) - Deployment script
- [scripts/setup-production-hooks.sh](../../scripts/setup-production-hooks.sh) - Git hooks setup
- [scripts/deploy-frontend-fixes.sh](../../scripts/deploy-frontend-fixes.sh) - All-in-one deployment

## Troubleshooting

### "Permission denied" when running scripts
```bash
chmod +x scripts/*.sh
```

### "Nginx test failed"
Check the error message - likely syntax error in config. The backup will be restored automatically.

### "Frontend build failed"
Check for missing dependencies:
```bash
cd apps/frontend
npm install
npm run build
```

### "500 errors still occurring"
Check service logs:
```bash
docker logs karmyq-community-service --tail 100
docker logs karmyq-request-service --tail 100
docker logs karmyq-auth-service --tail 100
```

### "404 errors still occurring"
Verify nginx routing:
```bash
# Should show updated config with /communities/, /requests/, etc. (not /api/communities/)
cat /etc/nginx/sites-available/karmyq | grep proxy_pass
```
