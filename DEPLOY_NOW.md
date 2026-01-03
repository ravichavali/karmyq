# Deploy All Fixes NOW

## Current Issues on Production

Looking at your console logs, I can see:

1. ❌ **Geocoding still using localhost:3009** - Frontend hasn't been rebuilt yet
2. ❌ **429 Rate Limiting on /api/communities** - Users can't load dashboard
3. ⚠️ **404 on /api/invitations** - Social graph endpoints missing
4. ⚠️ **404 on /api/users/{id}/skills** - Profile skills endpoint missing

## Quick Fix Commands

SSH into your server and run these commands:

```bash
# Connect to server
ssh ubuntu@karmyq.com

# Pull latest code
cd ~/karmyq
git pull origin master

# Deploy frontend (fixes localhost:3009 issue)
chmod +x ~/karmyq/scripts/deploy-frontend-geocoding-fix.sh
bash ~/karmyq/scripts/deploy-frontend-geocoding-fix.sh

# Check if services are running
docker ps | grep karmyq

# Check rate limit settings (should be disabled)
docker exec karmyq-auth-service env | grep RATE_LIMIT_DISABLED
docker exec karmyq-community-service env | grep RATE_LIMIT_DISABLED
docker exec karmyq-request-service env | grep RATE_LIMIT_DISABLED

# If rate limiting is enabled, disable it
cd ~/karmyq/infrastructure/docker
nano .env  # Set RATE_LIMIT_DISABLED=true

# Restart services with new env
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate auth-service community-service request-service
```

## Expected Results

After running these commands:

✅ Geocoding uses `/api/geocoding` (no more localhost:3009 errors)
✅ Rate limiting disabled (no more 429 errors)
✅ Users can load dashboard and browse communities
✅ Location search works properly

## Test After Deployment

1. Visit https://karmyq.com
2. Open browser console (F12)
3. Refresh the page
4. **Should see NO**:
   - localhost:3009 errors
   - 429 rate limit errors
5. **Should work**:
   - Dashboard loads
   - Communities list loads
   - Create request with location search

---

**Time Estimate**: 5 minutes
**Risk**: Low (just rebuilding frontend and restarting services)
