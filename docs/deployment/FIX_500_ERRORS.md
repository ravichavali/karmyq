# Fix 500 Errors - Production Deployment

**Date**: 2026-01-01
**Issue**: Request and Community services returning 500 errors
**Status**: Fix ready to deploy

## Problem Summary

After successful auth service deployment, discovered 500 errors on:
- `/api/requests/requests` - Missing `community_id` column error
- `/api/communities/communities` - UUID parsing error

### Root Causes

1. **Missing Database Columns**: Production database missing polymorphic request columns added in v9.0
   - `request_type`, `payload`, `requirements` (polymorphic requests)
   - `is_public`, `requester_visibility_consent` (privacy features)

2. **Code Bug**: request-service SQL query references `r.community_id` which doesn't exist
   - The column was removed when refactoring to use junction table `request_communities`
   - Query needs to join through the junction table instead

## Solution

### Step 1: Pull Latest Code

```bash
cd ~/karmyq
git reset --hard HEAD  # Clean any local changes
git pull origin master
chmod +x scripts/*.sh
```

### Step 2: Run Database Migration

```bash
./scripts/run-migrations.sh
```

This will:
- Add polymorphic request columns to `requests.help_requests`
- Add privacy columns for Social Karma v2.0
- Create indexes for performance
- Backfill `request_type` from existing `category` data

**Expected Output**:
```
Running migration: 001-add-polymorphic-requests.sql
✓ Migration completed successfully
Checking help_requests table columns:
request_type    | character varying(50)     |           | default 'generic'::character varying
payload         | jsonb                     |           | default '{}'::jsonb
requirements    | jsonb                     |           | default '{}'::jsonb
is_public       | boolean                   |           | default true
requester_visibility_consent | boolean      |           | default false
```

### Step 3: Restart Affected Services

```bash
docker restart karmyq-request-service karmyq-community-service
sleep 10
```

### Step 4: Verify Fix

```bash
# Check service logs
docker logs karmyq-request-service --tail=30
docker logs karmyq-community-service --tail=30

# Test endpoints from inside containers
docker exec karmyq-request-service wget -qO- "http://localhost:3003/requests?limit=1"
docker exec karmyq-community-service wget -qO- "http://localhost:3002/communities?limit=1"
```

### Step 5: Test from Browser

Login to https://karmyq.com and navigate to:
- Communities page (should load without 500 error)
- Requests page (should load without 500 error)

Check browser console - should see 200 OK responses instead of 500 errors.

## Files Changed

### New Migration
- `infrastructure/postgres/migrations/001-add-polymorphic-requests.sql`

### Code Fix
- `services/request-service/src/routes/requests.ts`
  - Fixed `/requests/matched/for-user` query
  - Removed `r.community_id` references
  - Added junction table join via `request_communities`

### New Scripts
- `scripts/run-migrations.sh` - Apply database migrations
- `scripts/diagnose-500-errors.sh` - Diagnostic tool
- `scripts/check-api-errors.sh` - Quick error checker

### Documentation
- `docs/deployment/INVESTIGATE_500_ERRORS.md` - Troubleshooting guide
- `docs/deployment/FIX_500_ERRORS.md` - This file

## Quick Command Summary

```bash
# All commands in sequence
cd ~/karmyq
git reset --hard HEAD
git pull origin master
chmod +x scripts/*.sh
./scripts/run-migrations.sh
docker restart karmyq-request-service karmyq-community-service
sleep 10
docker logs karmyq-request-service --tail=20
docker logs karmyq-community-service --tail=20
```

## Rollback (If Needed)

If migration causes issues:

```bash
# Connect to database
docker exec -it karmyq-postgres psql -U karmyq_prod -d karmyq_prod

# Remove added columns
ALTER TABLE requests.help_requests
  DROP COLUMN IF EXISTS request_type,
  DROP COLUMN IF EXISTS payload,
  DROP COLUMN IF EXISTS requirements,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS requester_visibility_consent;

# Drop indexes
DROP INDEX IF EXISTS idx_help_requests_type;
DROP INDEX IF EXISTS idx_help_requests_public;
```

However, this is unlikely to be needed as:
1. Migration uses `IF NOT EXISTS` - won't fail if already run
2. Adds columns with defaults - existing data unaffected
3. Code is backward compatible - works with or without new columns

## Next Steps After Fix

Once 500 errors are resolved:

1. **Seed Production Data**
   ```bash
   export DEMO_PASSWORD=your_secure_password
   ./scripts/seed-production-data.sh
   ```

2. **Verify All Services**
   ```bash
   ./scripts/production-diagnostics.sh
   ```

3. **Test Complete Workflow**
   - Register user
   - Join/create community
   - Create help request
   - Browse requests
   - Respond to request

## Expected Timeline

- Pull code: 1 minute
- Run migration: 2 minutes
- Restart services: 1 minute
- Verification: 2 minutes

**Total: ~5-10 minutes**

## Success Criteria

✅ Migration runs successfully
✅ Services restart without errors
✅ No "missing column" errors in logs
✅ `/api/requests/requests` returns 200 (may be empty array)
✅ `/api/communities/communities` returns 200 (may be empty array)
✅ Browser console shows no 500 errors

## Contact

If issues occur, run diagnostics and share output:

```bash
./scripts/diagnose-500-errors.sh > ~/fix-diagnostic-$(date +%Y%m%d-%H%M).txt
cat ~/fix-diagnostic-$(date +%Y%m%d-%H%M).txt
```
