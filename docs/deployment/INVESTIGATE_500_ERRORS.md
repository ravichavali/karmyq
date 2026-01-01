# Investigating 500 Errors on Production

**Date**: 2026-01-01
**Issue**: Dashboard showing 500 errors for communities and requests endpoints
**Status**: Auth service works, login works, but request/community services returning 500

## Affected Endpoints

From browser console on https://karmyq.com:
```
❌ /api/requests/requests?requester_id=89be4818-0676-41b1-8a23-0c1df25853cf&limit=50 - 500
❌ /api/requests/matches - 500
❌ /api/communities/communities - 500
```

## Run Diagnostics on Production Server

SSH into the production server and run:

```bash
cd ~/karmyq
./scripts/check-api-errors.sh
```

## What to Check

### 1. Service Logs (Most Important)

Look for error stack traces in the service logs:

```bash
# Request Service
docker logs karmyq-request-service --tail=50

# Community Service
docker logs karmyq-community-service --tail=50
```

**Look for**:
- Database connection errors (like we saw with auth service)
- Missing tables/schemas
- Permission errors
- TypeScript/runtime errors
- Middleware errors (authentication, community context)

### 2. Database Connection

Check if services can connect to database:

```bash
# Check request service env
docker exec karmyq-request-service env | grep DATABASE_URL

# Check community service env
docker exec karmyq-community-service env | grep DATABASE_URL

# Test connection from request service
docker exec karmyq-request-service node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT current_database(), current_user;')
  .then(res => console.log('✓ Connected:', res.rows[0]))
  .catch(err => console.error('✗ Error:', err.message))
  .finally(() => pool.end());
"
```

### 3. Service Health from Inside Containers

Test if services respond to requests internally:

```bash
# Request Service health
docker exec karmyq-request-service wget -qO- http://localhost:3003/health

# Community Service health
docker exec karmyq-community-service wget -qO- http://localhost:3002/health

# Request Service API (without auth)
docker exec karmyq-request-service wget -qO- "http://localhost:3003/requests?limit=10"

# Community Service API (without auth)
docker exec karmyq-community-service wget -qO- "http://localhost:3002/communities?limit=10"
```

**Expected**: Either working responses OR clear error messages

### 4. Check if Services Are Running

```bash
docker ps | grep -E "(request-service|community-service)"
```

**Expected**: Both services should be "Up" not restarting

### 5. Check Nginx Routing

```bash
# Test nginx routing
curl -v http://localhost/api/requests/health
curl -v http://localhost/api/communities/health
```

## Likely Causes

Based on previous auth service fix, most likely issues:

### 1. Database Authentication (Same as Auth Service)
**Symptoms**: Services crash or can't query database
**Fix**: Run password reset for these services too
```bash
docker restart karmyq-request-service karmyq-community-service
docker logs karmyq-request-service --tail=20
docker logs karmyq-community-service --tail=20
```

### 2. Missing Database Schemas/Tables
**Symptoms**: "relation does not exist" errors
**Fix**: Already ran init.sql, should be fine

### 3. Middleware Issues
**Symptoms**: 500 errors with auth-related stack traces
**Possible causes**:
- `authenticateToken` middleware failing silently
- `extractCommunityContext` expecting community_id
- Missing or malformed JWT tokens

### 4. Service-Specific Issues
**Possible**:
- TypeScript compilation errors
- Missing environment variables
- Node module issues

## Quick Fix Attempts

### Attempt 1: Restart Services (May fix if startup race condition)
```bash
docker restart karmyq-request-service karmyq-community-service
sleep 10
docker logs karmyq-request-service --tail=30
docker logs karmyq-community-service --tail=30
```

### Attempt 2: Check Service Code for Errors
```bash
# Check request service startup
docker exec karmyq-request-service node -v
docker exec karmyq-request-service ls -la /app

# Check community service startup
docker exec karmyq-community-service node -v
docker exec karmyq-community-service ls -la /app
```

### Attempt 3: Test with Direct Database Query
```bash
# From request service container
docker exec -i karmyq-request-service node <<'EOF'
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT COUNT(*) FROM requests.help_requests;')
  .then(res => console.log('✓ Requests table accessible:', res.rows[0]))
  .catch(err => console.error('✗ Error:', err.message))
  .finally(() => pool.end());
EOF

# From community service container
docker exec -i karmyq-community-service node <<'EOF'
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT COUNT(*) FROM communities.communities;')
  .then(res => console.log('✓ Communities table accessible:', res.rows[0]))
  .catch(err => console.error('✗ Error:', err.message))
  .finally(() => pool.end());
EOF
```

## Expected Findings

After running diagnostics, we should see one of:

1. **Database connection errors** → Same fix as auth service (password reset + restart)
2. **Missing tables** → Re-run init.sql for specific schemas
3. **TypeScript/code errors** → Fix code and redeploy
4. **Middleware auth errors** → Check JWT token format, middleware chain
5. **Service crashes on startup** → Check dependencies, environment variables

## Next Steps After Diagnosis

Once we identify the root cause:
1. Apply the fix (likely same as auth service)
2. Restart affected services
3. Verify endpoints work
4. Run production seeding (2000 users, 200 communities)

## Contact

After running diagnostics, share the output from:
```bash
./scripts/check-api-errors.sh > ~/api-diagnostic-$(date +%Y%m%d-%H%M).txt
cat ~/api-diagnostic-$(date +%Y%m%d-%H%M).txt
```
