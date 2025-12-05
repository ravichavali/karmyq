# Phase 3: Ephemeral Data & Reputation Decay

**Status**: In Progress (60% Complete)
**Version**: v5.1.0
**Started**: 2025-01-15

## Overview

This phase implements:
1. **Ephemeral Data (TTL)** - Automatic expiration for requests, offers, messages, and notifications
2. **Reputation Decay** - Time-based karma decay with configurable half-life
3. **Activity Tracking** - Track user activities that reset decay timers
4. **Cleanup Service** - Automated jobs for data expiration and deletion

## ✅ Completed

### 1. Database Schema (Migration: 001_ephemeral_data_and_decay.sql)

**New Table: `communities.settings`**
- Per-community configuration for TTL and decay parameters
- Columns:
  - `request_ttl_days` (default: 60)
  - `offer_ttl_days` (default: 60)
  - `message_ttl_days` (default: 60)
  - `notification_ttl_days` (default: 60)
  - `reputation_half_life_months` (default: 6)
  - `activity_types` (JSONB array, default: `["complete_request", "complete_offer"]`)

**New Table: `reputation.activity_log`**
- Tracks user activities for decay calculation
- Columns: `user_id`, `community_id`, `activity_type`, `related_entity_id`, `created_at`

**Schema Changes:**
- Added `expires_at TIMESTAMP` to:
  - `requests.help_requests`
  - `requests.help_offers`
  - `messaging.messages`
  - `notifications.notifications`
- Added `expired BOOLEAN` (soft delete flag) to all above tables
- Added `last_activity_at TIMESTAMP` to `reputation.trust_scores`

**Database Functions:**
```sql
communities.calculate_expires_at(community_id, entity_type, created_at)
  → Returns calculated expiration timestamp based on community TTL settings

reputation.calculate_decayed_karma(user_id, community_id)
  → Returns karma adjusted for time-based exponential decay
  → Formula: karma * 0.5^(months_ago / half_life_months)
```

**Triggers:**
- Auto-set `expires_at` on INSERT for requests, offers, messages, notifications
- Based on community settings + created_at

### 2. Cleanup Service (Port 3008)

**Location**: `services/cleanup-service/`

**Scheduled Jobs:**

1. **Mark Expired Data** - Every hour
   - Marks data past `expires_at` as `expired = TRUE`
   - Soft delete for requests, offers, messages, notifications

2. **Hard Delete Expired Data** - Daily at 2:00 AM
   - Permanently deletes data expired for > 7 days
   - 7-day grace period for recovery

3. **Reputation Decay Update** - Daily at 3:00 AM
   - Recalculates all trust scores using time-decayed karma
   - Uses `calculate_decayed_karma()` function
   - Only updates if score changed

4. **Activity Log Cleanup** - Weekly Sunday at 4:00 AM
   - Removes activity logs older than 90 days

5. **Decay Report** - Weekly Monday at 9:00 AM
   - Generates report on community decay rates
   - Shows inactive users per community

**Manual Trigger Endpoints** (for testing/admin):
- `POST /jobs/mark-expired` - Run expiration job now
- `POST /jobs/hard-delete` - Run hard delete now
- `POST /jobs/update-decay` - Update reputation decay now
- `POST /jobs/cleanup-activity-logs` - Cleanup logs now
- `GET /jobs/decay-report` - Generate decay report now

**Health Check:**
- `GET /health` - Service health status

### 3. Docker Integration

Added to `infrastructure/docker/docker-compose.yml`:
- cleanup-service container (port 3008)
- Runs scheduled cron jobs
- Depends on PostgreSQL

## 🚧 In Progress

### 4. Service API Updates

Need to filter expired data in existing services:

**Request Service**
- [ ] Filter `WHERE expired = FALSE` in GET endpoints
- [ ] Update list/search queries
- [ ] Handle expiration in match logic

**Messaging Service**
- [ ] Filter expired messages from conversations
- [ ] Update message retrieval logic

**Notification Service**
- [ ] Filter expired notifications
- [ ] Update notification list endpoint

**Reputation Service**
- [ ] Add activity tracking on match completion
- [ ] Call `recordActivity()` when users complete exchanges
- [ ] Integrate with cleanup service

### 5. Activity Tracking Integration

Events that should trigger activity tracking:
- `complete_request` - User completes helping someone
- `complete_offer` - User receives help from someone
- (Configurable per community)

Need to add to reputation-service event handlers:
```typescript
import { recordActivity } from '../utils/activityTracker';

// On match_completed event
await recordActivity(helper_id, community_id, 'complete_request', match_id);
await recordActivity(requester_id, community_id, 'complete_offer', match_id);
```

### 6. Testing

Need comprehensive tests for:
- [ ] TTL expiration logic
- [ ] Reputation decay calculation
- [ ] Activity tracking
- [ ] Cleanup jobs
- [ ] Edge cases (no settings, old data, etc.)

### 7. Documentation

Need to update:
- [ ] PROJECT_STATUS.md with Phase 3 completion
- [ ] README.md with cleanup service info
- [ ] Create cleanup-service/CONTEXT.md
- [ ] API documentation for new endpoints
- [ ] Migration guide for existing deployments

## 📊 Configuration

### Community Settings

Admins can configure per-community:

```typescript
{
  request_ttl_days: 60,          // Default: 60 days
  offer_ttl_days: 60,            // Default: 60 days
  message_ttl_days: 60,          // Default: 60 days
  notification_ttl_days: 60,     // Default: 60 days
  reputation_half_life_months: 6, // Default: 6 months
  activity_types: [              // Default: both
    "complete_request",
    "complete_offer"
  ]
}
```

### Activity Types

Communities can choose what counts as "activity" to prevent decay:
- `complete_request` - Helped someone
- `complete_offer` - Received help
- Future: `post_request`, `post_offer`, `message_sent`, etc.

## 🔍 How It Works

### Ephemeral Data Flow

1. **Creation**: New request/offer/message created
2. **Trigger**: INSERT trigger fires
3. **Calculate**: `calculate_expires_at()` sets `expires_at` based on community settings
4. **Hourly Job**: Cleanup service marks expired data (`expired = TRUE`)
5. **Daily Job**: After 7 days, permanently delete

### Reputation Decay Flow

1. **User Activity**: User completes exchange
2. **Track**: Activity logged to `activity_log`
3. **Update**: `last_activity_at` updated in `trust_scores`
4. **Daily Decay**: Cleanup service recalculates all trust scores
5. **Formula**: Old karma weighted less using exponential decay

**Decay Formula:**
```
decayed_karma = Σ (karma_points * 0.5^(months_ago / half_life_months))

where:
  months_ago = (now - karma_earned_at) in months
  half_life_months = community setting (default 6)

Example with 6-month half-life:
  - Karma from today: 100% value
  - Karma from 6 months ago: 50% value
  - Karma from 12 months ago: 25% value
  - Karma from 18 months ago: 12.5% value
```

## 🎯 Next Steps

### Immediate (to complete Phase 3):

1. **Update Service APIs** (2-3 hours)
   - Add `WHERE expired = FALSE` filters
   - Update all list/get endpoints
   - Test with expired data

2. **Activity Tracking** (1-2 hours)
   - Add to reputation-service match_completed handler
   - Test activity logging
   - Verify last_activity_at updates

3. **Testing** (3-4 hours)
   - Create test suite for ephemeral data
   - Test decay calculations
   - Test cleanup jobs
   - Integration tests

4. **Documentation** (1-2 hours)
   - Update all relevant docs
   - Create migration guide
   - API documentation

### After Phase 3:

**Phase 4: Data Export API** (v5.2.0)
- Community data export endpoint
- JSON/CSV formats
- Privacy controls
- GDPR compliance

**Phase 5: Admin UI** (v5.3.0)
- Community settings management
- TTL configuration UI
- Decay rate configuration
- Activity type selection

## 📝 Migration Guide

### Applying the Migration

```bash
# Connect to database
docker exec -it karmyq-postgres psql -U karmyq_user -d karmyq_db

# Run migration
\i /path/to/migrations/001_ephemeral_data_and_decay.sql

# Verify
SELECT * FROM communities.settings LIMIT 5;
SELECT * FROM reputation.activity_log LIMIT 5;
```

### Backwards Compatibility

- ✅ Existing data: `expires_at` calculated retroactively
- ✅ All communities: Default settings created automatically
- ✅ No breaking changes to existing APIs (yet)
- ⚠️ After API updates: Expired data filtered out

### Rollback Plan

If needed to rollback:

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS trigger_set_request_expires_at ON requests.help_requests;
DROP TRIGGER IF EXISTS trigger_set_offer_expires_at ON requests.help_offers;
DROP TRIGGER IF EXISTS trigger_set_message_expires_at ON messaging.messages;
DROP TRIGGER IF EXISTS trigger_set_notification_expires_at ON notifications.notifications;

-- Remove columns (optional - data loss)
ALTER TABLE requests.help_requests DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS expired;
ALTER TABLE requests.help_offers DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS expired;
ALTER TABLE messaging.messages DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS expired;
ALTER TABLE notifications.notifications DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS expired;
ALTER TABLE reputation.trust_scores DROP COLUMN IF EXISTS last_activity_at;

-- Remove tables
DROP TABLE IF EXISTS reputation.activity_log;
DROP TABLE IF EXISTS communities.settings;
```

## 🔒 Security Considerations

- **Data Retention**: Communities control their own data retention
- **Privacy**: Hard delete is permanent (cannot recover)
- **Audit Trail**: Activity logs track what triggered decay resets
- **Grace Period**: 7 days to recover accidentally expired data
- **Soft Delete First**: Expired data hidden but retrievable

## 🚀 Performance Considerations

- **Indexes**: Created on `expires_at` and `expired` columns
- **Batch Delete**: Can process 1000s of records efficiently
- **Off-Peak**: Hard delete runs at 2 AM (low traffic)
- **Incremental**: Hourly soft delete prevents large batches
- **Partitioning**: Consider for very large deployments (future)

## 📈 Monitoring

Cleanup service logs:
- Items marked expired per job
- Items permanently deleted per job
- Trust scores updated per job
- Decay rates per community (weekly report)

Check logs:
```bash
docker logs karmyq-cleanup-service
```

## ✨ Benefits

1. **Ephemeral by Design**: Matches mutual aid philosophy (temporary help)
2. **Active Communities**: Rewards ongoing participation
3. **Storage Efficiency**: Auto-cleanup prevents database bloat
4. **Configurable**: Each community sets own parameters
5. **Graceful Decay**: Exponential formula prevents sudden drops
6. **Activity-Based**: Staying active maintains reputation

---

**Next**: Complete API updates, testing, and documentation to finish Phase 3!
