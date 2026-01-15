# FR-009: Data Cleanup

**Status:** ✅ Implemented | **Priority:** High | **Version:** 5.1.0

## Overview

Automated data cleanup service that enforces TTL policies and karma decay for ephemeral data management.

## Key Features

### FR-009.1: TTL Enforcement
- [x] Marks expired data based on community settings
- [x] Soft delete (sets expired=true or status='expired')
- [x] Hard delete after grace period
- [x] Runs daily via cron job
- [x] Per-community TTL configuration

### FR-009.2: Data Types Cleaned
- [x] Help requests (request_ttl_days)
- [x] Offers (offer_ttl_days)
- [x] Matches (match_ttl_days)
- [x] Messages (message_ttl_days)
- [x] Notifications (notification_ttl_days)
- [x] Sessions (session_ttl_days)

### FR-009.3: Karma Decay
- [x] Optional exponential decay
- [x] Configurable half-life per community
- [x] Decay calculation: `points * (0.5 ^ (age / half_life))`
- [x] Updates karma_records table
- [x] Recalculates trust scores

### FR-009.4: Cleanup Jobs
- [x] Request expiration job
- [x] Match expiration job
- [x] Message cleanup job
- [x] Notification cleanup job
- [x] Session cleanup job
- [x] Karma decay job

### FR-009.5: Monitoring
- [x] Logs cleanup operations
- [x] Reports items processed
- [x] Error logging
- [x] No data loss on errors

## Implementation
- Service: `cleanup-service`
- Schedule: Daily at 2 AM UTC (configurable)
- Library: node-cron
- Database: Writes to all schemas
- Concurrency: Sequential jobs (no overlap)

## Configuration
From `community_settings` table:
```typescript
{
  request_ttl_days: 30,
  offer_ttl_days: 30,
  match_ttl_days: 90,
  notification_ttl_days: 30,
  message_ttl_days: 90,
  session_ttl_days: 30,
  karma_decay_enabled: true,
  karma_half_life_months: 6
}
```

## Safety
- Transaction-based operations
- Rollback on errors
- Idempotent jobs
- No cascading deletes (manual cleanup)

## Related
- [NFR-005: Ephemeral Data](../non-functional/NFR-005-ephemeral.md)
- [FR-002: Communities](FR-002-communities.md)
- [FR-005: Reputation](FR-005-reputation.md)
