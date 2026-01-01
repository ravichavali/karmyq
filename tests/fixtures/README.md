# API-Based Test Data Generator with Time Travel

**Version**: 2.0
**Date**: 2025-12-31
**Status**: Active
**Replaces**: 5+ inconsistent SQL-based scripts

---

## Overview

This is the **consolidated, API-first test data generator** for Karmyq. It replaces all previous SQL-based scripts with a single, holistic approach that:

- ✅ **Uses real APIs** (triggers business logic, not SQL hacks)
- ✅ **Supports time travel** (backdated records for karma decay testing)
- ✅ **Handles volume** (2000 users, 200 communities)
- ✅ **Generates realistic data** (polymorphic requests, complete workflows)
- ✅ **Environment-aware** (different passwords for staging vs prod)
- ✅ **Idempotent** (safe to re-run)

---

## Quick Start

```bash
# Local development (20 users, fast)
cd tests
npm run seed

# Staging environment (2000 users)
npm run seed:staging

# Production demo (requires DEMO_PASSWORD env var)
DEMO_PASSWORD=secret123 npm run seed:production
```

---

## Architecture

```
tests/fixtures/
├── index.ts                      ← Existing factories (UserFactory, CommunityFactory, etc.)
├── timeTravelFactory.ts          ← NEW: Backdating utilities
├── realisticDataFactory.ts       ← NEW: Polymorphic requests, realistic names
├── volumeSeeder.ts               ← NEW: Bulk creation with batching
├── consolidatedSeeder.ts         ← NEW: Main orchestrator
└── README.md                     ← This file

tests/scripts/
└── seed-data.ts                  ← CLI entry point
```

---

## Data Profiles

### Quick (Local Development)
- **Users**: 20
- **Communities**: 5
- **Requests**: ~40
- **Age**: 1 month
- **Password**: `password123`
- **Time**: ~30 seconds

### Staging (Full Volume Testing)
- **Users**: 2000
- **Communities**: 200
- **Requests**: ~10,000
- **Age**: 6 months (realistic karma decay)
- **Password**: `test123`
- **Test Personas**: Included
- **Time**: ~5-10 minutes

### Production (Demo Data)
- **Users**: 2000
- **Communities**: 200
- **Requests**: ~10,000
- **Age**: 6 months
- **Password**: `$DEMO_PASSWORD` (from environment)
- **Test Personas**: Excluded
- **Time**: ~5-10 minutes

---

## Usage Examples

### Basic Usage

```bash
# Quick local seeding (default)
npm run seed

# Full staging volume
npm run seed:staging

# Staging with 50% volume (1000 users)
npm run seed -- --profile staging --size medium

# Production (requires env var)
DEMO_PASSWORD=secret123 npm run seed:production
```

### Advanced Options

```bash
# Custom database URL
npm run seed -- --profile staging \
  --database-url postgresql://user:pass@host:5432/db

# Custom password
npm run seed -- --profile staging --password test456

# Verbose progress logging
npm run seed -- --profile staging --verbose
```

### Help

```bash
npm run seed -- --help
```

---

## What Data Gets Generated

### Users
- Realistic names (diverse, international)
- Email: `user{N}@test.karmyq.com`
- Account age: Distributed from 0 to 6 months
- Activity levels: Power law distribution
  - 5% very active (15-30 requests)
  - 20% active (8-15 requests)
  - 45% moderate (3-8 requests)
  - 30% occasional (0-3 requests)

### Communities
- Realistic names (geographic, interest-based, demographic)
- Size distribution:
  - 10% large (50-150 members)
  - 30% medium (15-50 members)
  - 60% small (3-15 members)
- Categories: neighborhood, interest, skill-share, parents, etc.
- Locations: Realistic city/state combinations

### Requests (Polymorphic)
- **Ride requests**: Origin, destination, departure time, seats needed
- **Event requests**: Location, event time, max participants
- **Service requests**: Skills needed, duration, urgency
- **Question requests**: Category, accepts multiple answers
- **Item requests**: Item name, borrow duration, deposit

### Complete Workflows
30% of requests become complete workflows:
1. Request created (N days ago)
2. Offer made (N-1 days ago)
3. Match accepted (N-2 days ago)
4. Messages exchanged (N-2 to N-5 days)
5. Match completed (N-5 days ago)
6. Karma awarded (N-5 days ago)

---

## Time Travel Features

### Backdated Records

```typescript
import { TimeTravelFactory } from './fixtures/timeTravelFactory';

const timeTravel = new TimeTravelFactory(pool);

// Create karma from 6 months ago
await timeTravel.createBackdatedKarma(userId, communityId, {
  monthsAgo: 6,
  points: 100,
  eventType: 'help_given'
});

// Create expired request (>60 days old)
await timeTravel.createExpiredRequest(communityId, requesterId, {
  daysAgo: 65,
  title: 'Need help moving'
});

// Create complete aged workflow
await timeTravel.createAgedWorkflow(community, requester, helper, {
  requestCreatedDaysAgo: 30,
  offerCreatedDaysAgo: 29,
  matchCreatedDaysAgo: 28,
  matchCompletedDaysAgo: 25
});
```

### Use Cases
- **Karma decay testing**: Create 6-month-old karma to verify half-life calculation
- **Ephemeral data cleanup**: Create expired requests to test TTL enforcement
- **Trust score evolution**: Test reputation changes over time
- **Realistic dashboards**: Demo environments look like they've been running for months

---

## Why API-First (Not SQL)?

### Problems with SQL Scripts
❌ Bypass business logic (no karma calculation, no events)
❌ Skip database triggers (no decay, no trust updates)
❌ Break referential integrity (orphaned records)
❌ Don't test the system (you're testing SQL, not your API)
❌ Hard to debug (is it the script or the service?)
❌ Cause "weird inconsistencies" (user's feedback)

### Benefits of API-First
✅ Triggers all business logic (karma, events, notifications)
✅ Validates data (same validation as production)
✅ Tests the real system (integration test, not SQL test)
✅ Easier to maintain (changes to API flow through)
✅ Time travel still works (backdate after creation)

---

## Migration from Old Scripts

### Old Scripts (Deprecated)

```bash
# OLD (SQL-based, inconsistent)
npm run generate-test-data        # generates SQL file
npm run load-test-data            # loads via psql
```

**Problems**:
- Bypasses API
- No business logic
- Creates "weird inconsistencies"
- No time travel support

### New Script (Recommended)

```bash
# NEW (API-based, consolidated)
npm run seed                      # quick profile
npm run seed:staging              # full volume
```

**Benefits**:
- Uses real APIs
- Triggers business logic
- Time travel support
- Realistic polymorphic data

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | No | `postgresql://...` | Database connection string |
| `DEMO_PASSWORD` | Yes (prod) | N/A | Password for production seeding |
| `SKIP_CONFIRMATION` | No | `false` | Skip production confirmation prompt |

---

## Troubleshooting

### Services Not Running

**Error**: `ECONNREFUSED 127.0.0.1:3001`

**Solution**: Start services first:
```bash
docker-compose up -d
```

### Production Confirmation

**Error**: `Production seeding requires confirmation`

**Solution**: Set environment variable:
```bash
SKIP_CONFIRMATION=true npm run seed:production
```

### Database Connection

**Error**: `Connection refused`

**Solution**: Check `DATABASE_URL`:
```bash
# Verify database is running
docker ps | grep postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

---

## Performance

| Profile | Volume | Time | API Calls |
|---------|--------|------|-----------|
| Quick | 20 users | ~30s | ~100 |
| Staging | 2000 users | ~5-10min | ~15,000 |
| Production | 2000 users | ~5-10min | ~15,000 |

**Optimization**:
- Batching: 50 concurrent API calls
- Progress reporting: Real-time updates
- Error handling: Retries for transient failures

---

## Backlog Items Resolved

This implementation resolves:

- **Backlog #2** (P0): Test Data Determinism & Time Travel
- **Backlog #3** (P0): Consolidate Data Generation Scripts

See [DEVELOPMENT_ROADMAP.md](../../docs/DEVELOPMENT_ROADMAP.md) for details.

---

## Related Documentation

- [DEVELOPMENT_ROADMAP.md](../../docs/DEVELOPMENT_ROADMAP.md) - Backlog items #2 and #3
- [DEPLOYMENT_DECISION.md](../../docs/DEPLOYMENT_DECISION.md) - Track B: Production deployment
- [Tangent T-013](../../docs/DEVELOPMENT_ROADMAP.md#active-tangents) - This implementation

---

## Future Enhancements

### Planned
- [ ] Deterministic data (fixed seed for reproducible tests)
- [ ] Known test personas (alice@test.com, bob@test.com with predictable data)
- [ ] Snapshot/restore (save DB state for fast test resets)
- [ ] Performance mode (skip time travel for faster seeding)

### Ideas
- [ ] GraphQL schema validation (ensure polymorphic payloads match schema)
- [ ] Cross-community trust paths (seed data with invitation chains)
- [ ] A/B test data (seed control vs. experiment groups)

---

## Contributing

When modifying test data generation:

1. **Update this README** if adding new features
2. **Add tests** for new factories (see `timeTravelFactory.test.ts`)
3. **Test all profiles** before committing:
   ```bash
   npm run seed:quick    # Fast check
   npm run seed:staging  # Full volume check
   ```
4. **Document in roadmap** if resolving backlog items

---

## Questions?

See [DEVELOPMENT_ROADMAP.md](../../docs/DEVELOPMENT_ROADMAP.md) or ask in #dev-questions.
