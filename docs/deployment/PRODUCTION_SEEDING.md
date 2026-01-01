# Production Data Seeding Plan

**Environment**: Production (karmyq.com)
**Database**: karmyq_prod
**Purpose**: Populate with realistic demo data for launch

## Overview

Seed production with enough data to demonstrate platform capabilities while maintaining realistic patterns.

## Data Volumes

### Communities (5 total)
1. **Oakland Mutual Aid** - Large, active
2. **Berkeley Neighbors** - Medium, active
3. **SF Bay Area Help** - Large, newer
4. **East Bay Support Network** - Small, tight-knit
5. **Peninsula Community Care** - Medium, growing

### Users (100 total)
- 30 users in Oakland Mutual Aid
- 25 users in Berkeley Neighbors
- 25 users in SF Bay Area Help
- 10 users in East Bay Support Network
- 10 users in Peninsula Community Care

### Help Requests (150 total)
- 50 active (open, matched)
- 75 completed (historical, with karma awarded)
- 25 expired (showing cleanup process)

### Time Distribution
- Use `timeTravelFactory.ts` to create data across time periods:
  - 30 days ago: Initial community formation
  - 21 days ago: First wave of requests
  - 14 days ago: Community growth
  - 7 days ago: Recent activity
  - Today: Current active requests

## Seeding Strategy

### Use Existing Test Data Generators

We have comprehensive test data factories in `tests/fixtures/`:

1. **realisticDataFactory.ts**
   - Age distributions (18-75 years, normal distribution)
   - Realistic karma profiles (helper/receiver patterns)
   - Request categories and content
   - Geographic locations (Bay Area)

2. **timeTravelFactory.ts**
   - Create historical data with proper timestamps
   - Backdate requests, matches, completions
   - Set up realistic karma accumulation over time

3. **volumeSeeder.ts**
   - Bulk data generation
   - Maintains referential integrity
   - Configurable volumes

4. **consolidatedSeeder.ts**
   - Complete workflow seeding
   - End-to-end scenarios (user joins → posts request → gets help → earns karma)

### Seeding Script

Use the existing `tests/scripts/seed-data.ts`:

```bash
# From the repository root
cd tests

# Seed production (requires DATABASE_URL to be set for production)
npm run seed:prod -- --profile realistic --size large

# Or customize volumes
npm run seed:prod -- \
  --communities 5 \
  --users 100 \
  --requests 150 \
  --timespan 30d
```

## Detailed Seeding Plan

### Phase 1: Communities & Initial Users (Day -30)
```typescript
// Create 5 communities with founders
- Oakland Mutual Aid (founder: alice@example.com)
- Berkeley Neighbors (founder: bob@example.com)
- SF Bay Area Help (founder: carol@example.com)
- East Bay Support Network (founder: david@example.com)
- Peninsula Community Care (founder: eve@example.com)

// Add 5-10 early members to each community
```

### Phase 2: Community Growth (Days -21 to -14)
```typescript
// Add remaining members
// Create first wave of requests (mostly completed now)
// Award karma for historical help
// Build trust scores
```

### Phase 3: Active Period (Days -7 to today)
```typescript
// Recent requests (some active, some completed)
// Recent karma awards
// Active conversations
// Current matches in progress
```

### Phase 4: Current State (Today)
```typescript
// 20-30 active open requests
// 10-15 in-progress matches
// Active community members
```

## Production Seeding Command

Create a production-specific seeding script:

```bash
#!/bin/bash
# scripts/seed-production.sh

echo "======================================"
echo "Production Data Seeding"
echo "======================================"
echo ""

# Get production database URL
DB_URL=$(docker exec karmyq-postgres env | grep POSTGRES_PASSWORD | cut -d= -f2)
export DATABASE_URL="postgresql://karmyq_prod:${DB_URL}@localhost:5432/karmyq_prod"

echo "Database: karmyq_prod"
echo "Seeding with realistic demo data..."
echo ""

cd ~/karmyq/tests

# Run seeding script with production profile
npm run seed -- \
  --profile realistic \
  --communities 5 \
  --users-per-community "30,25,25,10,10" \
  --requests 150 \
  --timespan 30d \
  --categories "transportation,groceries,errands,tech-support,companionship,home-repair,childcare" \
  --verify

echo ""
echo "✓ Production seeding complete"
echo ""
echo "Verification:"
echo "  Communities: SELECT COUNT(*) FROM communities.communities;"
echo "  Users: SELECT COUNT(*) FROM auth.users;"
echo "  Requests: SELECT COUNT(*) FROM requests.help_requests;"
echo "  Karma: SELECT COUNT(*) FROM reputation.karma_records;"
```

## Data Characteristics

### User Profiles
Using `realisticDataFactory.ts` age distributions:
- Helpers (give more than receive): 30% of users
  - Age: Skewed older (35-65)
  - High karma scores (100-500)
  - Many completed helps

- Receivers (receive more than give): 20% of users
  - Age: Varied
  - Lower karma scores (10-50)
  - Fewer completed helps

- Balanced (equal give/receive): 50% of users
  - Age: Normal distribution (25-55)
  - Medium karma scores (50-200)
  - Mix of helping and receiving

### Request Categories Distribution
- Transportation: 20%
- Groceries/Errands: 25%
- Tech Support: 15%
- Home Repair: 10%
- Companionship: 10%
- Childcare: 10%
- Other: 10%

### Geographic Distribution (Bay Area)
- Oakland: 30%
- Berkeley: 25%
- San Francisco: 20%
- Other East Bay: 15%
- Peninsula: 10%

## Verification Queries

After seeding, run these to verify:

```sql
-- Community counts
SELECT name,
  (SELECT COUNT(*) FROM communities.members WHERE community_id = c.id) as member_count
FROM communities.communities c;

-- Request status distribution
SELECT status, COUNT(*)
FROM requests.help_requests
GROUP BY status;

-- Karma distribution
SELECT
  CASE
    WHEN total_karma < 50 THEN 'Low (0-49)'
    WHEN total_karma < 200 THEN 'Medium (50-199)'
    ELSE 'High (200+)'
  END as karma_level,
  COUNT(*) as user_count
FROM reputation.trust_scores
GROUP BY karma_level;

-- Request completion rate
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as completion_rate
FROM requests.help_requests;

-- Recent activity (last 7 days)
SELECT DATE(created_at) as date, COUNT(*) as requests_created
FROM requests.help_requests
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Maintenance

### Regular Cleanup
The cleanup service will automatically:
- Expire old requests (after 60 days by default)
- Archive completed requests
- Clean up stale data

### Monitoring
Check data health:
```bash
# Active requests
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT COUNT(*) FROM requests.help_requests WHERE status IN ('open', 'matched');"

# User activity (users who acted in last 7 days)
docker exec -i karmyq-postgres psql -U karmyq_prod -d karmyq_prod \
  -c "SELECT COUNT(DISTINCT requester_id) FROM requests.help_requests WHERE created_at > NOW() - INTERVAL '7 days';"
```

## Safety

### Before Seeding
```bash
# Backup current database
docker exec karmyq-postgres pg_dump -U karmyq_prod karmyq_prod > backup-pre-seed-$(date +%Y%m%d).sql
```

### Rollback if Needed
```bash
# Restore from backup
cat backup-pre-seed-YYYYMMDD.sql | docker exec -i karmyq-postgres psql -U karmyq_prod karmyq_prod
```

## Timeline

1. **Backup database** (5 min)
2. **Run seeding script** (10-15 min for 100 users, 150 requests)
3. **Verify data** (5 min)
4. **Test application** (10 min)

**Total time**: ~30-40 minutes

## Next Steps After Seeding

1. Test user flows in production
2. Verify karma calculations
3. Test matching algorithm with real data
4. Check notification delivery
5. Verify feed generation
6. Test search and filtering

## Notes

- Use realistic but obviously fake data (emails like test1@example.com, names like "Demo User 1")
- Make it clear this is demo data for platform demonstration
- Can be cleared and re-seeded as needed
- Consider adding a banner "Demo Data - Not Real Users" to production if showing to stakeholders
