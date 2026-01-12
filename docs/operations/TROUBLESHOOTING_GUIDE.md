# Production Troubleshooting Guide

## Problem: Frontend Changes Not Appearing in Production

### Symptoms
- Code changes committed and pushed to git
- Production server shows correct source code
- But frontend behavior doesn't change
- Users still see old version even with hard refresh

### Root Cause
Current git-based deployment has multiple failure points:
1. **Build inconsistency**: Building on production server creates unreproducible builds
2. **File sync issues**: Git state and actual files can diverge
3. **Container staleness**: Docker container may have cached old build
4. **Browser caching**: Aggressive caching of JavaScript assets

### Diagnosis Steps

#### 1. Check Container vs Server Build Timestamps
```bash
# On production server
stat -c '%y %n' ~/karmyq/apps/frontend/.next/static/chunks/pages/profile-*.js
docker exec karmyq-frontend stat -c '%y %n' /app/.next/static/chunks/pages/profile-*.js
```

If timestamps differ, container has stale build.

#### 2. Verify Source Code on Server
```bash
ssh ubuntu@karmyq.com "md5sum ~/karmyq/apps/frontend/src/pages/profile.tsx"
```

Compare with local:
```powershell
certutil -hashfile "c:\Users\ravic\development\karmyq\apps\frontend\src\pages\profile.tsx" MD5
```

If hashes differ, git sync failed.

#### 3. Check if Code is in Compiled Output
```bash
docker exec karmyq-frontend strings /app/.next/static/chunks/pages/profile-*.js | grep -E '(your-feature-keyword)'
```

If keyword missing, Next.js didn't include the code in build.

### Quick Fix (Current System)

**Force rebuild and redeploy:**
```bash
ssh ubuntu@karmyq.com
cd ~/karmyq/apps/frontend
rm -rf .next .next.bak node_modules/.cache
NODE_ENV=production npm run build
docker stop karmyq-frontend
docker cp .next karmyq-frontend:/app/
docker start karmyq-frontend
```

### Long-Term Solution: Image-Based Deployment

**Current Problem:** Building on production server from git is flaky and unreliable.

**Solution:** Build Docker images locally or in CI, push to registry, deploy immutable images.

**Benefits:**
- Reproducible builds (same image everywhere)
- Atomic deployments (one step to deploy)
- Easy rollback (revert to previous image tag)
- No file sync issues
- Test exact production artifact before deploying

## Problem: Service Not Working After Deployment

### Common Pattern
Every new service follows similar issues:
1. Backend endpoint works (curl succeeds)
2. nginx routing works (logs show requests)
3. Frontend code exists in source
4. But frontend doesn't call the endpoint

### Root Causes
1. **Stale frontend build** (most common - Next.js didn't rebuild properly)
2. **TypeScript compilation error** (silent failure)
3. **Import/export mismatch** (service not exported from api.ts)
4. **Environment variable missing** (build-time vs runtime)

### Standard Debugging Workflow

#### Step 1: Verify Backend
```bash
# Check service logs
docker logs karmyq-auth-service -f

# Test endpoint directly
curl -H "Authorization: Bearer $TOKEN" https://karmyq.com/api/users/me/settings
```

#### Step 2: Verify nginx
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/access.log | grep "users/me/settings"
```

#### Step 3: Verify Frontend Build
```bash
# Check if service is exported
grep "userSettingsService" ~/karmyq/apps/frontend/src/lib/api.ts

# Check if code calls the service
grep "userSettingsService" ~/karmyq/apps/frontend/src/pages/profile.tsx

# Verify it's in compiled output
docker exec karmyq-frontend strings /app/.next/static/chunks/pages/*.js | grep "userSettings"
```

#### Step 4: Force Frontend Rebuild
If code is in source but not in compiled output:
```bash
cd ~/karmyq/apps/frontend
rm -rf .next node_modules/.cache
NODE_ENV=production npm run build
docker cp .next karmyq-frontend:/app/
docker restart karmyq-frontend
```

## Prevention: Pre-Deployment Checklist

Before deploying any feature:

- [ ] Test locally in Docker (`docker-compose up`)
- [ ] Run integration tests (`./scripts/test-local.sh`)
- [ ] Verify API endpoints work (`curl` tests)
- [ ] Check frontend calls the API (browser DevTools Network tab)
- [ ] Build production frontend locally (`NODE_ENV=production npm run build`)
- [ ] Verify compiled output contains feature code (`strings .next/static/chunks/pages/*.js`)
- [ ] Have rollback plan ready

## Next Steps

1. **Image-based deployment** - Build once, deploy everywhere (CRITICAL - current git-based approach is unreliable)
2. **Staging environment** - Test changes before production
3. **Automated smoke tests** - Verify deployment succeeded
4. **Monitoring alerts** - Catch issues immediately
