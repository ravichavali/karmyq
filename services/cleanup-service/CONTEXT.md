# Cleanup Service Context

**Port**: 3008
**Purpose**: Automated data expiration and reputation decay management
**Tech**: Node.js, TypeScript, PostgreSQL, node-cron

## What This Service Does

The Cleanup Service handles:
1. **Ephemeral Data (TTL)** - Automatic expiration for requests, offers, messages, notifications
2. **Reputation Decay** - Time-based karma decay calculation
3. **Activity Tracking** - Log user activities for decay reset
4. **Data Cleanup** - Hard deletion of expired data after grace period

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Mark Expired | Every hour (`:00`) | Soft delete data past `expires_at` |
| Hard Delete | Daily 2:00 AM | Permanently delete data expired >7 days |
| Reputation Decay | Daily 3:00 AM | Recalculate trust scores with decay |
| Activity Log Cleanup | Weekly Sun 4:00 AM | Remove old activity logs (>90 days) |
| Decay Report | Weekly Mon 9:00 AM | Generate community decay statistics |

## Database Schema

### Tables Used

- `communities.settings` - Per-community TTL and decay configuration
- `reputation.activity_log` - User activity tracking
- `reputation.trust_scores` - Trust scores with `last_activity_at`
- `requests.help_requests` - `expires_at`, `expired` columns
- `requests.help_offers` - `expires_at`, `expired` columns
- `messaging.messages` - `expires_at`, `expired` columns
- `notifications.notifications` - `expires_at`, `expired` columns

### Functions Used

```sql
communities.calculate_expires_at(community_id, entity_type, created_at)
  → Returns expiration timestamp based on community TTL settings

reputation.calculate_decayed_karma(user_id, community_id)
  → Returns karma with exponential time decay applied
  → Formula: karma * 0.5^(months_ago / half_life_months)
```

## API Endpoints (Manual Triggers)

All endpoints are for testing/admin purposes. Normal operation uses cron.

```typescript
POST /jobs/mark-expired
  // Manually run expiration job

POST /jobs/hard-delete
  // Manually run hard delete job

POST /jobs/update-decay
  // Manually recalculate trust scores

POST /jobs/cleanup-activity-logs
  // Manually cleanup old logs

GET /jobs/decay-report
  // Generate decay report (check logs)

GET /health
  // Service health check
```

## Configuration

Environment variables:
```bash
PORT=3008
DATABASE_URL=postgresql://user:pass@host:port/db
LOG_LEVEL=info  # debug, info, warn, error
```

## How It Works

### 1. Expiration Flow

```
Hourly Job
├─ Query items where expires_at <= NOW() AND expired = FALSE
├─ Set expired = TRUE (soft delete)
└─ Log count of expired items

Daily Job (2 AM)
├─ Query items where expired = TRUE AND updated_at <= (NOW() - 7 days)
├─ DELETE permanently (hard delete)
└─ Log count of deleted items
```

### 2. Reputation Decay Flow

```
Daily Job (3 AM)
├─ For each trust_score:
│   ├─ Call calculate_decayed_karma(user_id, community_id)
│   ├─ Compare new score to current score
│   └─ UPDATE if changed
└─ Log total updated count
```

### 3. Decay Formula

```
decayed_karma = Σ (karma_points * 0.5^(months_ago / half_life_months))

Example (6-month half-life):
- Karma earned today: 100 * 1.0 = 100 points
- Karma from 6 months ago: 100 * 0.5 = 50 points
- Karma from 12 months ago: 100 * 0.25 = 25 points
- Karma from 18 months ago: 100 * 0.125 = 12.5 points
```

### 4. Activity Tracking

When users complete exchanges:
- `complete_request` - Helped someone (responder)
- `complete_offer` - Received help (requester)

This resets `last_activity_at`, preventing decay for active users.

## Common Tasks

### Manually Run a Job

```bash
# Mark expired data
curl -X POST http://localhost:3008/jobs/mark-expired

# Update reputation decay
curl -X POST http://localhost:3008/jobs/update-decay

# Generate decay report
curl http://localhost:3008/jobs/decay-report
# Then check logs: docker logs karmyq-cleanup-service
```

### Check Job Logs

```bash
# Real-time logs
docker logs -f karmyq-cleanup-service

# Last 100 lines
docker logs --tail 100 karmyq-cleanup-service

# Specific job
docker logs karmyq-cleanup-service | grep "Reputation decay"
```

### Query Activity Data

```sql
-- Recent activities
SELECT * FROM reputation.activity_log
ORDER BY created_at DESC
LIMIT 20;

-- User's last activity
SELECT user_id, community_id, last_activity_at
FROM reputation.trust_scores
WHERE user_id = 'user-uuid'
ORDER BY last_activity_at DESC;

-- Community decay stats
SELECT
  c.name,
  AVG(EXTRACT(EPOCH FROM (NOW() - ts.last_activity_at)) / (30.44 * 24 * 60 * 60)) as avg_months_inactive
FROM communities.communities c
JOIN reputation.trust_scores ts ON c.id = ts.community_id
GROUP BY c.name
ORDER BY avg_months_inactive DESC;
```

## Monitoring

### Key Metrics

Watch logs for:
- Items expired per hour
- Items deleted per day
- Trust scores updated per day
- Errors/failures

### Health Checks

```bash
# Service health
curl http://localhost:3008/health

# Response
{
  "status": "healthy",
  "service": "cleanup-service",
  "uptime": 3600,
  "timestamp": "2025-01-15T12:00:00Z"
}
```

## Troubleshooting

### Jobs Not Running

**Check cron patterns**:
```typescript
// In src/index.ts
cron.schedule('0 * * * *', ...) // Every hour
cron.schedule('0 2 * * *', ...) // Daily 2 AM
```

**Verify timezone**: Cron uses server timezone. Check:
```bash
docker exec karmyq-cleanup-service date
```

### Too Much Data Deleted

**Check TTL settings**:
```sql
SELECT community_id, request_ttl_days, offer_ttl_days, message_ttl_days
FROM communities.settings
WHERE request_ttl_days < 30; -- Find aggressive settings
```

**Adjust grace period**: Edit `expirationJob.ts`:
```typescript
const deleteThreshold = new Date();
deleteThreshold.setDate(deleteThreshold.getDate() - 7); // Change this
```

### Reputation Decay Too Aggressive

**Check half-life settings**:
```sql
SELECT community_id, reputation_half_life_months
FROM communities.settings
WHERE reputation_half_life_months < 6;
```

**Test decay calculation**:
```sql
SELECT reputation.calculate_decayed_karma('user-uuid', 'community-uuid');
```

## Performance Considerations

### Large Datasets

For communities with millions of records:

1. **Batch Delete**: Already implemented in `batchHardDelete()`
   ```typescript
   await batchHardDelete('requests.help_requests', 1000);
   ```

2. **Indexes**: Created on `expires_at` and `expired` columns
   ```sql
   CREATE INDEX idx_help_requests_expires_at
   ON requests.help_requests(expires_at)
   WHERE expired = FALSE;
   ```

3. **Off-Peak**: Jobs run at 2-4 AM (low traffic)

### Database Load

- **Mark Expired** (hourly): Low load, updates only
- **Hard Delete** (daily): Moderate load, batch deletes
- **Decay Update** (daily): High load, reads all trust_scores

For very large platforms, consider:
- Partition activity_log by created_at
- Run decay updates in batches (e.g., 1000 users at a time)
- Cache community settings

## Security

### Soft Delete First

- 7-day grace period allows recovery
- Admins can restore expired data before hard delete
- Audit trail in activity_log

### Access Control

- Manual trigger endpoints should be admin-only
- Consider adding authentication middleware
- Currently open for testing

## Integration

### Event Flow

```
Match Completed
  ↓
Reputation Service
  ├─ Award Karma
  ├─ Update Trust Score
  └─ Record Activity → Cleanup Service Activity Log
       ↓
Cleanup Service (Daily 3 AM)
  └─ Recalculate Decay
```

### Dependencies

- **PostgreSQL**: Required (all jobs query DB)
- **Redis**: Not used (could add for job locks in multi-instance setup)
- **Other Services**: Independent (can run standalone)

## Future Enhancements

- [ ] Redis-based job locks for multi-instance deployment
- [ ] Webhook notifications for decay events
- [ ] Admin UI for job management
- [ ] Configurable job schedules per community
- [ ] Data export before hard delete
- [ ] Metrics export (Prometheus)

---

**Last Updated**: 2025-01-15
**Version**: 5.1.0
**Related**: See `docs/PHASE3_EPHEMERAL_DATA_DECAY.md` for full documentation
