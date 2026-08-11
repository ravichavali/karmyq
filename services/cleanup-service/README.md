# Cleanup Service

Automated data expiration and reputation decay management for Karmyq.

## Features

- **Ephemeral Data (TTL)** - Automatic expiration for requests, offers, messages, notifications
- **Reputation Decay** - Time-based karma decay (6-month half-life default)
- **Activity Tracking** - Log user activities to reset decay
- **Scheduled Jobs** - Automated cleanup via cron jobs
- **Data Lifecycle** - Soft delete → grace period → hard delete

## Port

**3008**

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Mark Expired | Every hour (`:00`) | Soft delete data past `expires_at` |
| Hard Delete | Daily 2:00 AM | Permanently delete data expired >7 days |
| Reputation Decay | Daily 3:00 AM | Recalculate trust scores with decay |
| Activity Log Cleanup | Weekly Sun 4:00 AM | Remove old activity logs (>90 days) |
| Decay Report | Weekly Mon 9:00 AM | Generate community decay statistics |

## API Endpoints (Manual Triggers)

All endpoints are for testing/admin purposes. Normal operation uses cron.

### POST /jobs/mark-expired
Manually run expiration job.

### POST /jobs/hard-delete
Manually run hard delete job.

### POST /jobs/update-decay
Manually recalculate trust scores.

### POST /jobs/cleanup-activity-logs
Manually cleanup old logs.

### GET /jobs/decay-report
Generate decay report (check logs).

### GET /health
Service health check.

**Response:**
```json
{
  "status": "healthy",
  "service": "cleanup-service"
}
```

## How It Works

### Expiration Flow

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

### Reputation Decay

```
decayed_karma = Σ (karma_points * 0.5^(months_ago / half_life_months))

Example (6-month half-life):
- Karma earned today: 100 * 1.0 = 100 points
- Karma from 6 months ago: 100 * 0.5 = 50 points
- Karma from 12 months ago: 100 * 0.25 = 25 points
- Karma from 18 months ago: 100 * 0.125 = 12.5 points
```

Active users (completed exchanges recently) have `last_activity_at` updated, preventing decay.

## Environment Variables

```bash
PORT=3008
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db
LOG_LEVEL=info  # debug, info, warn, error
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test
```

## Manual Testing

```bash
# Mark expired data
curl -X POST http://localhost:3008/jobs/mark-expired

# Update reputation decay
curl -X POST http://localhost:3008/jobs/update-decay

# Generate decay report
curl http://localhost:3008/jobs/decay-report

# Check logs
docker logs -f karmyq-cleanup-service
```

## Database Tables

### Writes To (Cross-Schema)

- `requests.help_requests` - Mark expired, hard delete
- `requests.offers` - Mark expired, hard delete
- `messaging.messages` - Mark expired, hard delete
- `notifications.notifications` - Mark expired, hard delete
- `reputation.trust_scores` - Update scores with decay
- `reputation.activity_log` - Cleanup old logs

### Reads From

- `community.settings` - TTL and decay configuration
- All tables above for expiration and decay queries

## Security

- **Soft Delete First**: 7-day grace period allows recovery
- **Audit Trail**: Activity log tracks all changes
- **No Authentication**: Manual endpoints open for testing (should add auth in production)

## Performance

- **Batch Deletes**: 1000 records at a time
- **Indexed Queries**: `expires_at` and `expired` indexed
- **Off-Peak Jobs**: Run at 2-4 AM (low traffic)

For large datasets:
- Partition `activity_log` by `created_at`
- Run decay updates in batches
- Cache community settings

## Monitoring

Watch logs for:
- Items expired per hour
- Items deleted per day
- Trust scores updated per day
- Errors/failures

Access logs:
```bash
# Real-time
docker logs -f karmyq-cleanup-service

# Last 100 lines
docker logs --tail 100 karmyq-cleanup-service

# Specific job
docker logs karmyq-cleanup-service | grep "Reputation decay"
```

## Troubleshooting

### Jobs Not Running

**Check cron patterns** in `src/index.ts`:
```typescript
cron.schedule('0 * * * *', ...) // Every hour
cron.schedule('0 2 * * *', ...) // Daily 2 AM
```

**Verify timezone**:
```bash
docker exec karmyq-cleanup-service date
```

### Too Much Data Deleted

**Check TTL settings**:
```sql
SELECT community_id, request_ttl_days, offer_ttl_days
FROM community.settings
WHERE request_ttl_days < 30;
```

### Reputation Decay Too Aggressive

**Check half-life settings**:
```sql
SELECT community_id, reputation_half_life_months
FROM community.settings
WHERE reputation_half_life_months < 6;
```

**Test decay calculation**:
```sql
SELECT reputation.calculate_decayed_karma('user-uuid', 'community-uuid');
```

## Related Documentation

- **Detailed Context**: [CONTEXT.md](./CONTEXT.md)
- **Feature Guide**: [docs/guides/EPHEMERAL_DATA_GUIDE.md](../../docs/guides/EPHEMERAL_DATA_GUIDE.md)
- **Requirement**: [FR-009: Data Cleanup](../../docs/requirements/functional/FR-009-cleanup.md)

## Future Enhancements

- Redis-based job locks for multi-instance deployment
- Webhook notifications for decay events
- Admin UI for job management
- Configurable job schedules per community
- Data export before hard delete
- Metrics export (Prometheus)

## License

AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.
