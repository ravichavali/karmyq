# Production Database Seeding

**Date**: 2026-01-01
**Target**: karmyq.com (132.226.89.171)
**Method**: API-based seeding via HTTPS

## Overview

This guide explains how to seed the production database with demo data using API endpoints. The seeding process creates realistic test data through actual API calls, ensuring all business logic and event handlers are triggered correctly.

## Prerequisites

1. **SSH Access**: You must have SSH access to `ubuntu@karmyq.com`
2. **DEMO_PASSWORD**: Set a secure password for all demo accounts
3. **Services Running**: All backend services must be healthy
4. **Network Access**: Your machine must be able to reach https://karmyq.com

## What Gets Created

The production seeding profile creates:
- **2000 users** - Realistic names and emails (user1@test.karmyq.com through user2000@test.karmyq.com)
- **200 communities** - Various types (neighborhoods, workplaces, schools, interest groups)
- **~10,000 help requests** - Polymorphic requests (rides, events, services, questions, items)
- **~3,000 matches** - Complete request-to-match workflows
- **~12,000 messages** - Realistic conversation threads
- **Karma records** - Reputation and trust scores
- **Aged data** - 6 months of historical data with realistic time distributions

## Seeding Process

### Step 1: Choose Password

Choose a secure password for all demo accounts:

```bash
export DEMO_PASSWORD="YourSecurePassword123!"
```

**Security Note**: This password will be used for all 2000 demo accounts. Use a strong password and store it securely.

### Step 2: Run Seeding Script

From your local machine (not the production server):

```bash
./scripts/seed-production-remote.sh
```

### What Happens:

1. **Disable Rate Limiting** (~10 seconds)
   - SSHs to production server
   - Adds `RATE_LIMIT_DISABLED=true` to `.env`
   - Restarts auth, community, request, and messaging services
   - Waits for services to come back up

2. **Seed Data** (~15-30 minutes, possibly longer depending on network)
   - Creates users via `POST /auth/register`
   - Creates communities via `POST /communities`
   - Joins users to communities via `POST /communities/:id/members`
   - Creates requests via `POST /requests`
   - Creates offers and matches
   - Sends messages through messaging service
   - Awards karma through reputation service
   - **Note**: Script includes waits between API calls for safety - may run overnight if needed

3. **Re-enable Rate Limiting** (~10 seconds)
   - SSHs to production server
   - Removes `RATE_LIMIT_DISABLED` from `.env`
   - Restarts services to restore normal rate limiting

**Total Duration**: ~20-40 minutes (could be longer with waits - safe to run overnight)

## Progress Monitoring

The script provides verbose output showing:
- Users created (batch progress: 1/40, 2/40, etc.)
- Communities created
- Memberships assigned
- Requests and workflows generated
- Match and message counts

Example output:
```
👥 Creating 2000 users...
  Batch 1/40: Creating 50 users...
  ✓ Created 50 users (total: 50/2000)
  Batch 2/40: Creating 50 users...
  ✓ Created 50 users (total: 100/2000)
  ...

📍 Creating 200 communities...
  ✓ Created TechCo Engineering Team
  ✓ Created Downtown Food Co-op
  ...

🤝 Assigning community memberships...
  ✓ Assigned 2000 users to communities
```

## Verification

After seeding completes, verify data was created:

### Via Frontend

1. Navigate to https://karmyq.com
2. Log in with any demo account:
   - Email: `user1@test.karmyq.com` (or user2, user3, ... user2000)
   - Password: `$DEMO_PASSWORD`
3. You should see:
   - Communities you're a member of
   - Help requests from community members
   - Your karma/reputation scores

### Via Database

SSH to production and check counts:

```bash
ssh ubuntu@karmyq.com

# Check users
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT COUNT(*) FROM auth.users;"

# Check communities
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT COUNT(*) FROM community.communities;"

# Check requests
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT COUNT(*) FROM requests.help_requests;"

# Check matches
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT COUNT(*) FROM requests.matches;"
```

Expected output:
```
 count
-------
  2000
(1 row)

 count
-------
   200
(1 row)

 count
-------
 ~10000
(1 row)

 count
-------
  ~3000
(1 row)
```

## Troubleshooting

### Error: "Too many authentication attempts"

**Cause**: Rate limiting wasn't disabled properly.

**Fix**:
```bash
ssh ubuntu@karmyq.com
cd ~/karmyq/infrastructure/docker

# Manually add to .env
echo "RATE_LIMIT_DISABLED=true" >> .env

# Restart services
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart auth-service community-service request-service messaging-service
```

Then re-run the seeding script.

### Error: "Network request failed" or "ECONNREFUSED"

**Cause**: Services aren't running or nginx isn't routing correctly.

**Fix**:
```bash
ssh ubuntu@karmyq.com
cd ~/karmyq/infrastructure/docker

# Check service health
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Check nginx
sudo systemctl status nginx

# Check logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs auth-service
```

### Error: SSL/Certificate Issues

**Cause**: SSL certificate expired or invalid.

**Fix**:
```bash
ssh ubuntu@karmyq.com

# Check certificate status
sudo certbot certificates

# Renew if needed
sudo certbot renew --nginx
```

### Seeding Times Out or Takes Too Long

**Cause**: Network latency or slow API responses.

**Note**: This is expected and okay! The script is designed to be safe and can run overnight if needed.

**Solutions**:
1. **Let it run**: Script can safely run for hours if needed (includes automatic waits)
2. **Run from production server**: SSH to production and run seeding locally (change URLs to http://localhost)
3. **Use smaller batch size**: Edit [tests/fixtures/consolidatedSeeder.ts](../../tests/fixtures/consolidatedSeeder.ts:64) and change `batchSize` from 50 to 10
4. **Use direct SQL seeding**: Use `scripts/seed-direct-sql.sh` instead (faster but skips business logic)

## Re-seeding

To clear existing data and re-seed:

### Option 1: Truncate and Re-seed

The seeding script automatically truncates existing data before seeding. Just run it again:

```bash
export DEMO_PASSWORD="YourNewPassword123!"
./scripts/seed-production-remote.sh
```

### Option 2: Manual Database Reset

```bash
ssh ubuntu@karmyq.com

# Truncate all tables (preserves schema)
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod << EOF
TRUNCATE TABLE messaging.messages CASCADE;
TRUNCATE TABLE requests.matches CASCADE;
TRUNCATE TABLE requests.help_requests CASCADE;
TRUNCATE TABLE community.memberships CASCADE;
TRUNCATE TABLE community.communities CASCADE;
TRUNCATE TABLE reputation.karma_records CASCADE;
TRUNCATE TABLE auth.users CASCADE;
EOF
```

Then run seeding script.

## Data Profiles

The seeder supports three profiles:

### Quick (Development)
```bash
npm run seed -- --profile quick
```
- 20 users
- 5 communities
- 1 month of aged data
- Duration: ~30 seconds

### Staging
```bash
npm run seed -- --profile staging
```
- 2000 users
- 200 communities
- 6 months of aged data
- Includes test personas for E2E testing
- Duration: ~5-10 minutes (local), ~15-20 minutes (remote)

### Production (Current)
```bash
npm run seed -- --profile production
```
- 2000 users
- 200 communities
- 6 months of aged data
- No test personas (realistic data only)
- Duration: ~15-30 minutes (could run overnight)

## Custom Sizes

You can adjust volume with `--size` parameter:

```bash
# 10% volume (200 users, 20 communities)
npm run seed -- --profile production --size small

# 50% volume (1000 users, 100 communities)
npm run seed -- --profile production --size medium

# 100% volume (2000 users, 200 communities) - DEFAULT
npm run seed -- --profile production --size large
```

## Security Notes

1. **DEMO_PASSWORD**: All demo accounts use the same password. Don't use production user data.
2. **Rate Limiting**: Script automatically restores rate limiting after seeding (even if seeding fails)
3. **Test Accounts**: All accounts use `@test.karmyq.com` domain to distinguish from real users
4. **SSH Access**: Script requires SSH access to production - keep SSH keys secure

## Related Documentation

- [FRONTEND_FIXES_SUMMARY.md](FRONTEND_FIXES_SUMMARY.md) - Frontend deployment fixes
- [../../tests/fixtures/consolidatedSeeder.ts](../../tests/fixtures/consolidatedSeeder.ts) - Seeder implementation
- [../../tests/fixtures/volumeSeeder.ts](../../tests/fixtures/volumeSeeder.ts) - Volume seeding logic
- [../../packages/shared/middleware/rateLimit.ts](../../packages/shared/middleware/rateLimit.ts) - Rate limiting config

## Next Steps

After seeding completes:

1. ✅ **Test Login**: Log in at https://karmyq.com with demo accounts
2. ✅ **Verify Data**: Check communities, requests, and messages load correctly
3. ✅ **Test Workflows**: Create a new request, make an offer, send messages
4. ⏳ **SSL Auto-Renewal**: Setup certbot cron job
5. ⏳ **GitHub Actions**: Setup CI/CD pipelines

---

**Last Updated**: 2026-01-01
**Status**: Ready for use
