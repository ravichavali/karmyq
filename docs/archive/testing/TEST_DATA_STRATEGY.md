# Test Data Strategy - Karmyq v9.0

## Overview

This document outlines the strategy for generating comprehensive, realistic test data for Karmyq that serves both development and automated testing needs.

## Goals

1. **Scale**: 2,000 users, 100 communities, 10,000+ requests
2. **Realism**: Power-law distribution matching real-world usage patterns
3. **Testability**: Data supports E2E testing of complete user flows
4. **Repeatability**: Can reset and regenerate consistently
5. **Performance**: Test data includes edge cases for performance testing

---

## Phases

### Phase 1: UI Development (Current)
**Status**: In Progress
**Blocker**: UI only supports generic requests

**Deliverables**:
- [ ] Ride request form with map picker
- [ ] Service request form with skill/category selectors
- [ ] Event request form with date/participant management
- [ ] Borrow request form with duration picker
- [ ] Request type selector/router

**Timeline**: Complete before Phase 2

---

### Phase 2: API-Based User Flow Tests
**Status**: Not Started
**Depends On**: Phase 1 completion

**Approach**: Create test scripts that simulate complete user journeys while populating data.

#### Test Flows to Implement

**Flow 1: New User Onboarding**
```javascript
// tests/e2e/flows/user-onboarding.test.js
describe('User Onboarding Flow', () => {
  it('should complete full onboarding journey', async () => {
    // 1. Register new user
    const user = await registerUser({
      email: faker.internet.email(),
      name: faker.person.fullName()
    });

    // 2. Join first community via invite code
    const community = await joinCommunity(user.token, INVITE_CODE);

    // 3. Browse requests feed
    const feed = await getFeed(user.token);
    expect(feed.requests.length).toBeGreaterThan(0);

    // 4. Create first request
    const request = await createRequest(user.token, {
      community_id: community.id,
      request_type: 'generic',
      title: 'Need help moving boxes',
      description: 'First time asking for help'
    });

    // 5. Receive first offer
    // 6. Accept match
    // 7. Complete exchange
    // 8. Give feedback
  });
});
```

**Flow 2: Power Helper Journey**
```javascript
// User who helps frequently and builds karma
describe('Power Helper Flow', () => {
  it('should build karma through multiple helps', async () => {
    const helper = await createUser('power.helper@test.com');

    // Create offer
    await createOffer(helper.token, {
      community_id: community.id,
      title: 'Available for tech support',
      type: 'tech_support'
    });

    // Complete 10 matches over time
    for (let i = 0; i < 10; i++) {
      await completeMatchFlow(helper.token);
    }

    // Verify karma progression
    const karma = await getKarma(helper.token);
    expect(karma.total_points).toBeGreaterThan(100);
  });
});
```

**Flow 3: Community Admin Journey**
```javascript
// Create and manage a community
describe('Community Admin Flow', () => {
  it('should create and grow a community', async () => {
    const admin = await createUser('admin@test.com');

    // Create community
    const community = await createCommunity(admin.token, {
      name: 'Downtown Helpers',
      description: 'Help your neighbors',
      location: 'San Francisco, CA'
    });

    // Invite members (simulate 20 joins)
    for (let i = 0; i < 20; i++) {
      const member = await createUser(faker.internet.email());
      await joinCommunity(member.token, community.invite_code);
    }

    // Moderate requests
    // View analytics
    // Send announcements
  });
});
```

**Flow 4: Polymorphic Request Lifecycle**
```javascript
// Test each request type end-to-end
describe('Ride Request Lifecycle', () => {
  it('should complete ride share from request to completion', async () => {
    const rider = await createUser('rider@test.com');
    const driver = await createUser('driver@test.com');

    // Create ride request
    const request = await createRideRequest(rider.token, {
      origin: { address: 'Downtown SF', lat: 37.7749, lng: -122.4194 },
      destination: { address: 'SFO Airport', lat: 37.6213, lng: -122.3790 },
      seats_needed: 2,
      departure_time: tomorrow()
    });

    // Driver responds
    const match = await createMatch(driver.token, request.id);

    // Rider accepts
    await acceptMatch(rider.token, match.id);

    // Complete ride
    await completeMatch(rider.token, match.id);

    // Verify karma awarded
    const riderKarma = await getKarma(rider.token);
    const driverKarma = await getKarma(driver.token);
    expect(driverKarma.total_points).toBeGreaterThan(0);
  });
});
```

#### Implementation Plan

**File Structure**:
```
tests/
  e2e/
    flows/
      user-onboarding.test.js          # New user journey
      power-helper.test.js             # Frequent helper
      community-admin.test.js          # Community management
      ride-request-lifecycle.test.js   # Ride sharing flow
      service-request-lifecycle.test.js # Service request flow
      event-request-lifecycle.test.js  # Event participation flow
      borrow-request-lifecycle.test.js # Item borrowing flow

    helpers/
      user-factory.js                  # Create test users
      community-factory.js             # Create communities
      request-factory.js               # Create all request types
      match-factory.js                 # Create matches
      api-client.js                    # HTTP client wrapper

    fixtures/
      realistic-data-generator.js      # Main generator script
      personas.js                      # Test persona definitions
```

---

### Phase 3: Large-Scale Data Generation
**Status**: Not Started
**Depends On**: Phase 2 completion

**Approach**: Generate 2,000 users and 100 communities with realistic distributions.

#### User Distribution (Power Law)

```javascript
// Realistic activity distribution
const USER_PERSONAS = {
  // 5% - Very Active (make 50% of requests)
  power_helpers: {
    count: 100,
    avg_requests_per_month: 15,
    avg_offers_per_month: 20,
    karma_range: [500, 2000]
  },

  // 20% - Active (make 30% of requests)
  active_users: {
    count: 400,
    avg_requests_per_month: 4,
    avg_offers_per_month: 5,
    karma_range: [100, 500]
  },

  // 45% - Moderate (make 15% of requests)
  moderate_users: {
    count: 900,
    avg_requests_per_month: 1,
    avg_offers_per_month: 1,
    karma_range: [10, 100]
  },

  // 30% - Occasional (make 5% of requests)
  occasional_users: {
    count: 600,
    avg_requests_per_month: 0.2,
    avg_offers_per_month: 0.1,
    karma_range: [0, 10]
  }
};
```

#### Community Distribution

```javascript
const COMMUNITY_TYPES = {
  // 20 large communities (50-150 members each)
  large: {
    count: 20,
    member_range: [50, 150],
    activity_level: 'very_high',
    avg_requests_per_day: 10
  },

  // 60 medium communities (15-50 members)
  medium: {
    count: 60,
    member_range: [15, 50],
    activity_level: 'medium',
    avg_requests_per_day: 3
  },

  // 120 small communities (3-15 members)
  small: {
    count: 120,
    member_range: [3, 15],
    activity_level: 'low',
    avg_requests_per_day: 0.5
  }
};
```

#### Request Type Distribution

```javascript
const REQUEST_TYPE_DISTRIBUTION = {
  generic: 40,   // 40% - backward compatibility, general help
  ride: 20,      // 20% - popular in urban areas
  service: 20,   // 20% - repairs, tutoring, etc.
  borrow: 15,    // 15% - tools, equipment
  event: 5       // 5% - community events
};
```

#### Temporal Distribution

```javascript
// Simulate 6 months of history
const TEMPORAL_PATTERN = {
  // Requests per day varies
  weekday_multiplier: 1.0,
  weekend_multiplier: 1.5,

  // Seasonal variation
  month_multipliers: {
    'january': 0.7,
    'may': 1.2,      // Moving season
    'june': 1.3,     // Summer events
    'december': 0.8   // Holidays
  },

  // Time of day
  morning: { weight: 0.2, hours: [6, 12] },
  afternoon: { weight: 0.4, hours: [12, 18] },
  evening: { weight: 0.3, hours: [18, 22] },
  night: { weight: 0.1, hours: [22, 6] }
};
```

---

### Phase 4: UI Automation Tests
**Status**: Not Started
**Depends On**: Phase 1 completion

**Approach**: Use Playwright to automate UI interactions and create data.

#### UI Test Flows

**Create Request via UI**
```javascript
// tests/ui/create-request.spec.ts
test('should create ride request via UI', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Login
  await page.fill('[name=email]', 'alice@test.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  // Navigate to create request
  await page.click('text=Create Request');

  // Select ride type
  await page.click('[data-request-type=ride]');

  // Fill form
  await page.fill('[name=title]', 'Ride to airport');
  await page.fill('[name=description]', 'Need ride Friday morning');

  // Use map picker for origin
  await page.click('[data-map-picker=origin]');
  await page.click('[data-lat=37.7749][data-lng=-122.4194]');

  // Use map picker for destination
  await page.click('[data-map-picker=destination]');
  await page.click('[data-lat=37.6213][data-lng=-122.3790]');

  // Set seats and time
  await page.fill('[name=seats_needed]', '2');
  await page.fill('[name=departure_time]', '2024-06-15T05:30');

  // Submit
  await page.click('button[type=submit]');

  // Verify success
  await expect(page.locator('text=Request created')).toBeVisible();
});
```

---

## Implementation Timeline

### Week 1: UI Forms
- [ ] Design polymorphic form components
- [ ] Implement ride request form
- [ ] Implement service request form
- [ ] Implement event request form
- [ ] Implement borrow request form
- [ ] Add request type selector

### Week 2: API Flow Tests
- [ ] Set up test infrastructure
- [ ] Create user/community/request factories
- [ ] Implement onboarding flow test
- [ ] Implement power helper flow test
- [ ] Implement community admin flow test
- [ ] Implement polymorphic lifecycle tests

### Week 3: Large-Scale Generator
- [ ] Design data generation strategy
- [ ] Implement user persona generator
- [ ] Implement community generator
- [ ] Implement temporal request distribution
- [ ] Add progress tracking and logging
- [ ] Create reset/cleanup scripts

### Week 4: UI Automation
- [ ] Set up Playwright
- [ ] Create UI test helpers
- [ ] Implement form automation tests
- [ ] Add visual regression tests
- [ ] Integration with CI/CD

---

## Scripts to Create

### 1. Reset Database
```bash
# scripts/reset-database.sh
#!/bin/bash
docker-compose down -v
docker-compose up -d postgres redis
sleep 10
# Database is now fresh with schema only
```

### 2. Generate Full Dataset
```bash
# scripts/generate-full-dataset.sh
#!/bin/bash
echo "🚀 Generating full test dataset..."

# Step 1: Create users (2000)
node scripts/generators/create-users.js 2000

# Step 2: Create communities (100)
node scripts/generators/create-communities.js 100

# Step 3: Assign memberships
node scripts/generators/assign-memberships.js

# Step 4: Generate 6 months of requests
node scripts/generators/create-historical-requests.js --months 6

# Step 5: Generate matches and completions
node scripts/generators/create-matches.js

# Step 6: Calculate karma and trust scores
node scripts/generators/calculate-karma.js

echo "✅ Dataset generation complete!"
```

### 3. Quick Seed (for development)
```bash
# scripts/quick-seed.sh
#!/bin/bash
# 50 users, 5 communities, 100 requests
node scripts/generators/quick-seed.js
```

---

## Data Validation

After generation, validate data quality:

```javascript
// scripts/validate-dataset.js
async function validateDataset() {
  // Check user distribution
  const userStats = await db.query(`
    SELECT
      COUNT(*) as total_users,
      AVG(request_count) as avg_requests,
      MAX(request_count) as max_requests
    FROM (
      SELECT requester_id, COUNT(*) as request_count
      FROM requests.help_requests
      GROUP BY requester_id
    ) user_activity
  `);

  // Verify power law distribution
  assert(userStats.max_requests > userStats.avg_requests * 10);

  // Check request type distribution
  const typeStats = await db.query(`
    SELECT request_type, COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
    FROM requests.help_requests
    GROUP BY request_type
  `);

  // Verify community sizes
  const communityStats = await db.query(`
    SELECT
      COUNT(*) as member_count,
      COUNT(DISTINCT community_id) as community_count
    FROM communities.members
    GROUP BY community_id
  `);

  console.log('✅ Dataset validation passed');
}
```

---

## Performance Targets

- Generate 2,000 users: < 2 minutes
- Generate 100 communities: < 1 minute
- Generate 10,000 requests: < 5 minutes
- Total dataset generation: < 10 minutes

---

## Next Steps

**Immediate** (This Week):
1. Build polymorphic request forms in UI
2. Test creating each request type manually
3. Validate form validation works with Zod schemas

**Short Term** (Next 2 Weeks):
1. Create API flow test infrastructure
2. Implement key user journey tests
3. Build data generation factories

**Medium Term** (Next Month):
1. Implement large-scale generator
2. Add UI automation tests
3. Set up CI/CD integration

---

## Questions to Resolve

1. **Should we use faker.js for realistic names/addresses?**
   - Pros: Very realistic data
   - Cons: Adds dependency, slower generation

2. **How to handle timeline for historical data?**
   - Option A: All dates relative to "today"
   - Option B: Fixed dates (easier for screenshots/demos)

3. **Should test data be committed to git?**
   - Option A: Commit SQL dump (fast loading, large file)
   - Option B: Commit generator script only (slower, smaller repo)

4. **Performance testing dataset?**
   - Separate 10,000 user dataset for load testing?
   - Or use same dataset?
