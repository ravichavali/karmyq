# Deploy All Localhost URL Fixes to Production

## What This Fixes

**Problem**: Frontend had **4 different hardcoded localhost URLs** causing `ERR_CONNECTION_REFUSED` errors in production.

**Solution**: All services now use environment variables to route requests through nginx proxy.

### Issues Fixed:
1. ✅ **Geocoding Service** (localhost:3009) - Search and cache endpoints
2. ✅ **Social Graph Service** (localhost:3010) - Invitation validation
3. ✅ **Messaging Service** - Wrong environment variable name
4. ✅ **Feed Service** (localhost:3007) - Redundant fallback removed

See [LOCALHOST_FIXES_SUMMARY.md](LOCALHOST_FIXES_SUMMARY.md) for complete details.

## Changes Made

✅ Fixed geocoding service (localhost:3009)
✅ Fixed social graph invitation validation (localhost:3010)
✅ Fixed messaging service environment variable
✅ Fixed feed service redundant fallbacks
✅ Added comprehensive testing documentation
✅ Committed and pushed to master (commits: dafd64b, 5ee7d18)

## Deployment Commands

Run these commands on the **production server** (karmyq.com):

### Step 1: Pull Latest Code

```bash
cd ~/karmyq
git pull origin master
```

### Step 2: Run Deployment Script

```bash
chmod +x ~/karmyq/scripts/deploy-frontend-geocoding-fix.sh
bash ~/karmyq/scripts/deploy-frontend-geocoding-fix.sh
```

This script will:
1. Verify `.env.production` has `NEXT_PUBLIC_GEOCODING_API_URL=/api/geocoding`
2. Build the frontend with production environment
3. Restart the frontend container with `--force-recreate`
4. Verify the container is running

### Expected Output

```
==========================================
Deploy Frontend - Geocoding Fix
==========================================

Step 1: Building frontend with production environment...
Environment variables being used:
NEXT_PUBLIC_GEOCODING_API_URL=/api/geocoding
✅ Frontend built successfully

Step 2: Restarting frontend container...
✅ Frontend container restarted

Step 3: Verifying deployment...
✅ Frontend container is running

==========================================
✅ Frontend Deployed Successfully
==========================================

Changes:
  - Added NEXT_PUBLIC_GEOCODING_API_URL=/api/geocoding
  - Updated geocoding.ts to use environment variable
  - Frontend now uses nginx proxy instead of localhost:3009
```

## Testing the Fix

1. **Visit**: https://karmyq.com
2. **Open Browser Console**: Press F12
3. **Test Location Search**:
   - Click "Create Request"
   - Start typing in the location field (e.g., "San Francisco")
4. **Verify**:
   - ✅ NO `localhost:3009` errors in console
   - ✅ Network tab shows `/api/geocoding/search` requests
   - ✅ Location suggestions appear correctly
   - ✅ Geocoding cache works (check for "Tier 2: Backend DB" logs)

## Expected Behavior

### Before Fix (❌):
```
GET http://localhost:3009/search?q=San net::ERR_CONNECTION_REFUSED
POST http://localhost:3009/cache net::ERR_CONNECTION_REFUSED
⚠️ Backend geocoding unavailable (Failed to fetch), falling back to direct API
```

### After Fix (✅):
```
GET https://karmyq.com/api/geocoding/search?q=San 200 OK
✅ Tier 2: Backend DB CACHE HIT for: San
```

## Rollback (If Needed)

If something goes wrong:

```bash
cd ~/karmyq
git checkout 2b7ce13  # Previous commit before geocoding fix
npm run build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate karmyq-frontend
```

## Next Steps After This Fix

1. ✅ **Geocoding localhost references** - FIXED
2. ⏳ **Address 429 rate limiting errors** - User getting rate limited when browsing dashboard
3. ⏳ **Improve seeding data quality** - Or implement synthetic user simulation (ADR-006)

## Files Changed

- [apps/frontend/.env.production](apps/frontend/.env.production) - Added geocoding URL
- [apps/frontend/.env.local.example](apps/frontend/.env.local.example) - Added geocoding URL
- [apps/frontend/src/lib/geocoding.ts](apps/frontend/src/lib/geocoding.ts) - Use env var instead of hardcoded URL
- [scripts/deploy-frontend-geocoding-fix.sh](scripts/deploy-frontend-geocoding-fix.sh) - Deployment automation
- [scripts/deploy-frontend-geocoding-fix.ps1](scripts/deploy-frontend-geocoding-fix.ps1) - Windows deployment

## Commit

- **Commit**: dafd64b
- **Message**: fix: replace hardcoded localhost:3009 with geocoding API URL env var
- **Branch**: master

---

**Status**: Ready to deploy
**Estimated Time**: ~5 minutes
**Risk**: Low (frontend-only change, nginx already configured)
