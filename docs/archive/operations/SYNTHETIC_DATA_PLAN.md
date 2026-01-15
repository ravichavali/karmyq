# Synthetic Data Generation Plan

**Created**: 2026-01-03
**Status**: Planning
**Priority**: P0 (Critical - Next Work Stream)

---

## 📋 Overview

This document outlines the plan to consolidate 5+ data generation scripts into a single, unified data generation system with support for:
- **Deterministic data** (fixed seed for reproducibility)
- **Time travel** (backdated data for testing time-based features)
- **Multiple environments** (dev, staging, production)
- **Realistic scenarios** (aged karma, expired requests, trust paths)

---

## 🎯 Goals

1. **Consolidate Scripts**: Merge 5 different scripts into one master generator
2. **Deterministic Mode**: Support fixed seed for reproducible test data
3. **Time Travel**: Create backdated data (6-12 months old) for testing karma decay, ephemeral data cleanup
4. **Known Test Users**: Predictable test accounts with specific characteristics
5. **Environment Support**: Different data sets for dev/staging/production

---

## 📊 Current State - Script Audit

### Existing Scripts

| Script | Purpose | Users | Communities | Timeline | Type | Status |
|--------|---------|-------|-------------|----------|------|--------|
| `generate-realistic-data.ts` | Most complete | 2000 | 200 | 1 year | TypeScript | **MASTER** |
| `seed-test-data.js` | Older approach | Variable | Variable | Current | JavaScript | Deprecate |
| `populate-polymorphic-data.js` | Polymorphic request types | Uses existing | Uses existing | Current | JavaScript | Merge |
| `create-test-feed-data.js` | Basic feed data | Uses existing | Uses existing | Current | JavaScript | Deprecate |
| `generate-large-dataset.js` | Performance testing | Uses existing | Uses existing | Current | JavaScript | Keep separate |

### Problems with Current Approach

1. **Inconsistency**: Different scripts create different data structures
2. **Overlapping Functionality**: Multiple scripts do similar things
3. **No Time Travel**: All data created with `NOW()` timestamps
4. **Non-Deterministic**: Random seeds cause different data each run
5. **No Known Test Users**: Can't reliably test specific scenarios
6. **Environment Confusion**: Same script for dev/staging/prod

---

## 🏗️ Proposed Architecture

### Master Script: `generate-data.ts`

Single unified script with multiple modes:

```bash
# Development: Small, fast, deterministic
npm run generate-data -- --mode=dev --seed=12345

# Staging: Realistic, with aged data
npm run generate-data -- --mode=staging --aged=180

# Production: Large dataset with time travel
npm run generate-data -- --mode=production --aged=365

# Testing: Known test users only
npm run generate-data -- --mode=test --users=known
```

### Configuration-Driven Approach

**File**: `scripts/data-configs/`
- `dev.json` - 50 users, 5 communities, current timestamps
- `staging.json` - 500 users, 50 communities, 90 days aged
- `production.json` - 2000 users, 200 communities, 365 days aged
- `test.json` - 10 known users, 3 communities, specific scenarios

### Time Travel Support

**Approach**: Backdating timestamps during data creation

```typescript
interface TimeTravel Options {
  ageInDays: number;          // How far back to start timeline
  spreadInDays: number;       // How much to spread data across time
  karmaDecay: boolean;        // Apply decay to old karma
  ephemeralExpiry: boolean;   // Create expired requests
}

// Example: Create karma from 6 months ago
await createKarmaRecord({
  userId,
  communityId,
  points: 100,
  createdAt: daysAgo(180)  // 6 months old
});

// Example: Create expired request
await createRequest({
  title: 'Old expired request',
  createdAt: daysAgo(65),
  expiresAt: daysAgo(5)  // Expired 5 days ago
});
```

### Known Test Users

Pre-defined users with predictable characteristics:

```typescript
const KNOWN_USERS = {
  alice: {
    email: 'alice@test.com',
    role: 'super_helper',      // High karma, many exchanges
    karma: 500,
    exchanges: 50,
    joinedDaysAgo: 365
  },
  bob: {
    email: 'bob@test.com',
    role: 'new_member',         // Just joined, no karma
    karma: 0,
    exchanges: 0,
    joinedDaysAgo: 1
  },
  charlie: {
    email: 'charlie@test.com',
    role: 'moderator',          // Community admin
    karma: 200,
    communities: ['creator', 'admin'],
    joinedDaysAgo: 180
  },
  diana: {
    email: 'diana@test.com',
    role: 'requester',          // Often asks for help
    karma: -50,
    exchanges: 20,
    requestToOfferRatio: 5,     // 5 requests per 1 offer
    joinedDaysAgo: 90
  },
  eve: {
    email: 'eve@test.com',
    role: 'inactive',           // Joined but inactive
    karma: 10,
    exchanges: 2,
    lastActiveDaysAgo: 60,
    joinedDaysAgo: 120
  }
};
```

### Deterministic Mode

Use fixed seed for reproducible data:

```typescript
import { faker } from '@faker-js/faker';

// Set seed for deterministic random
if (options.seed) {
  faker.seed(options.seed);
  Math.seedrandom(options.seed);  // Also seed native Math.random
}

// Now all random data is reproducible
const name = faker.person.fullName();  // Same every time with same seed
```

---

## 📝 Implementation Plan

### Phase 1: Consolidation (4-6 hours)

**Goal**: Merge all scripts into `generate-data.ts`

1. **Extract Best Parts**:
   - Use `generate-realistic-data.ts` as base (TypeScript, most complete)
   - Merge polymorphic request logic from `populate-polymorphic-data.js`
   - Keep `generate-large-dataset.js` as separate performance testing tool

2. **Create Configuration Files**:
   - `scripts/data-configs/dev.json`
   - `scripts/data-configs/staging.json`
   - `scripts/data-configs/production.json`
   - `scripts/data-configs/test.json`

3. **Command-Line Interface**:
   ```bash
   generate-data --mode=dev --seed=12345 --fresh
   ```

4. **Archive Old Scripts**:
   - Move to `scripts/archive/`
   - Update documentation pointing to new script

**Deliverables**:
- ✅ Single `generate-data.ts` script
- ✅ 4 configuration files
- ✅ Updated documentation
- ✅ Archived old scripts

---

### Phase 2: Time Travel Support (4-6 hours)

**Goal**: Add backdating capability for time-based testing

1. **Helper Functions**:
   ```typescript
   function daysAgo(days: number): Date;
   function hoursAgo(hours: number): Date;
   function createBackdatedKarma(userId, communityId, options);
   function createExpiredRequest(communityId, options);
   function createAgedUser(options);
   ```

2. **Timeline Spread**:
   - Users join over time (not all on day 1)
   - Requests/offers distributed across timeline
   - Matches completed at realistic intervals
   - Karma awarded on completion dates

3. **Test Scenarios**:
   ```typescript
   // Scenario: Test karma decay (6-month half-life)
   await createKarmaRecord({
     userId: alice.id,
     points: 100,
     createdAt: daysAgo(180)  // Should decay to ~50 points
   });

   // Scenario: Test ephemeral data cleanup (60-day TTL)
   await createRequest({
     title: 'Should be cleaned up',
     createdAt: daysAgo(65),
     expiresAt: daysAgo(5)
   });

   // Scenario: Test trust path growth over time
   await createInvitationChain({
     depth: 4,
     startDate: daysAgo(365),
     spreadDays: 90  // Invitations spread over 3 months
   });
   ```

**Deliverables**:
- ✅ Time travel helper functions
- ✅ Timeline spread logic
- ✅ Test scenario generators
- ✅ Integration tests for time-based features

---

### Phase 3: Deterministic Mode (2-3 hours)

**Goal**: Reproducible data for consistent testing

1. **Seed Management**:
   ```typescript
   // Always use same seed in test mode
   const DEFAULT_SEEDS = {
     dev: 12345,
     test: 99999,
     staging: null,  // Random
     production: null  // Random
   };
   ```

2. **Known Test Users**:
   - Create 10 predefined users with specific characteristics
   - Predictable user IDs, emails, names
   - Specific karma levels, exchange counts, roles

3. **Snapshot Testing**:
   - Generate data with fixed seed
   - Export database snapshot
   - Compare snapshots to detect schema changes

**Deliverables**:
- ✅ Fixed seed support
- ✅ 10 known test users defined
- ✅ Snapshot export script
- ✅ Documentation on reproducible testing

---

### Phase 4: Test Helpers (3-4 hours)

**Goal**: Easy-to-use functions for integration tests

1. **Test Factories**:
   ```typescript
   // In tests/fixtures/data-factories.ts
   export const TestData = {
     createUser: (overrides?) => Promise<User>;
     createCommunity: (overrides?) => Promise<Community>;
     createRequest: (overrides?) => Promise<Request>;
     createBackdatedKarma: (monthsAgo, points) => Promise<Karma>;
     createExpiredRequest: (daysAgo) => Promise<Request>;
     createInvitationChain: (depth, startDate) => Promise<User[]>;
   };
   ```

2. **Integration Test Utilities**:
   ```typescript
   // Setup function for each test
   beforeEach(async () => {
     await TestData.resetDatabase();
     await TestData.seedKnownUsers();
   });

   // Example test
   it('should decay karma after 6 months', async () => {
     const user = await TestData.createUser();
     await TestData.createBackdatedKarma(6, 100);  // 6 months ago

     const karma = await getKarma(user.id);
     expect(karma.current).toBeCloseTo(50, 5);  // Half-life decay
   });
   ```

3. **Common Scenarios**:
   - New user with no history
   - Active user with high karma
   - Inactive user (no recent activity)
   - User with expired requests
   - User with invitation chain (4 degrees deep)

**Deliverables**:
- ✅ Test factory functions
- ✅ Database reset/seed utilities
- ✅ 10 common test scenarios
- ✅ Updated integration tests using new helpers

---

### Phase 5: Documentation (1-2 hours)

**Goal**: Complete workflow documentation

1. **Main Documentation**:
   - Update README.md with new data generation workflow
   - Create DATA_GENERATION_GUIDE.md with all modes and options
   - Document known test users and their characteristics

2. **Migration Guide**:
   - How to migrate from old scripts
   - Breaking changes (if any)
   - Troubleshooting common issues

3. **Testing Guide**:
   - How to use test helpers in integration tests
   - Best practices for deterministic data
   - Examples of time-travel testing

**Deliverables**:
- ✅ DATA_GENERATION_GUIDE.md
- ✅ Updated README.md
- ✅ Migration guide
- ✅ Testing examples

---

## 📅 Timeline

| Phase | Duration | Dependencies | Status |
|-------|----------|--------------|--------|
| Phase 1: Consolidation | 4-6 hours | None | Pending |
| Phase 2: Time Travel | 4-6 hours | Phase 1 | Pending |
| Phase 3: Deterministic Mode | 2-3 hours | Phase 1 | Pending |
| Phase 4: Test Helpers | 3-4 hours | Phases 1, 2, 3 | Pending |
| Phase 5: Documentation | 1-2 hours | All phases | Pending |

**Total Estimate**: 14-21 hours

---

## 🎯 Success Criteria

### Phase 1: Consolidation
- [ ] Single `generate-data.ts` script replaces all 5 scripts
- [ ] Configuration files for each environment
- [ ] Old scripts archived with deprecation notice
- [ ] Can generate dev/staging/production data from one script

### Phase 2: Time Travel
- [ ] Can create data 6-12 months in the past
- [ ] Karma decay tests pass with aged karma
- [ ] Ephemeral data cleanup tests pass with expired requests
- [ ] Trust path tests work with invitation chains over time

### Phase 3: Deterministic Mode
- [ ] Same seed produces identical data every time
- [ ] 10 known test users created with predictable IDs
- [ ] Integration tests can rely on specific user characteristics
- [ ] Database snapshots match across runs with same seed

### Phase 4: Test Helpers
- [ ] `createBackdatedKarma()` helper works correctly
- [ ] `createExpiredRequest()` helper works correctly
- [ ] `createInvitationChain()` helper works correctly
- [ ] Integration tests updated to use new helpers
- [ ] 10 common test scenarios documented and working

### Phase 5: Documentation
- [ ] DATA_GENERATION_GUIDE.md complete with all options
- [ ] Migration guide explains how to switch from old scripts
- [ ] Testing guide shows examples of time-travel testing
- [ ] README.md updated with quick start

---

## 🔗 Related Documentation

- [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) - Backlog items #2 (Time Travel) and #3 (Consolidation)
- [LOCAL_TESTING.md](../testing/LOCAL_TESTING.md) - How to run tests with synthetic data
- [DEVELOPMENT_PROCESS.md](../DEVELOPMENT_PROCESS.md) - Process for making changes

---

## 📊 Current Backlog Items

This plan addresses:
- **Backlog #2**: Test Data Determinism & Time Travel
- **Backlog #3**: Consolidate Data Generation Scripts

---

## 🚀 Next Steps

1. User review and approval of this plan
2. Begin Phase 1: Consolidation
3. Create configuration files for each environment
4. Implement time travel support
5. Add test helpers for integration tests

---

**Plan Status**: Ready for review
**Next Action**: User approval to proceed with Phase 1
