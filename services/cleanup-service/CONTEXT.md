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
| Mark Expired | Every hour (`:00`) | Soft delete data past `expires_at` (help_requests filtered to `status = 'open'` — Sprint 85 dropped the phantom `'pending'` token, never a real help_requests status) |
| Hard Delete | Daily 2:00 AM | Permanently delete data expired >7 days |
| Reputation Decay | Daily 3:00 AM | Recalculate trust scores with decay |
| Activity Log Cleanup | Weekly Sun 4:00 AM | Remove old activity logs (>90 days) |
| Decay Report | Weekly Mon 9:00 AM | Generate community decay statistics |
| Expire Dibs | Every 5 minutes | Find pending `requests.dibs` records past `expires_at`, set `status=expired`, reset `help_requests.status` to `open`, publish `dibs_expired` event |
| Trust Edge Sweep | Daily 4:30 AM | Delete `social_graph.trust_edges` where `current_weight < disappearance_threshold` (via `trust_edges_live` view) |
| ~~Request TTL Sweep~~ | **RETIRED (Sprint 90 / ADR-069)** | `requestTtlSweepJob` (`sweepExpiredRequests`) hard-deleted completed+rated requests + their matches (cascade-deleting conversations/messages) at 30 days — destroyed the aggregate ADR-069 keeps, before the 180-day anonymize window. **Superseded by Memory Retention** (anonymize, keep aggregates). Job file, cron, and `/jobs/sweep-request-ttl` endpoint removed. |
| Memory Retention (Sprint 90 / ADR-069) | Daily 3:30 AM | `memoryRetentionJob.forgetExchangeContent()` — anonymize aged completed-request free-text (`title`/`description`/`payload`/`requirements` → `'[forgotten]'`/`'{}'`) **and cascade-forget its conversation's `messages.content` in one atomic CTE** (the Exchange Unit); hard-delete `expired = TRUE` + **unmatched** requests aged from `updated_at`; backstop old messages. **`reputation.karma_records` is never touched** (no PII; `reason` is a load-bearing enum). Windows resolve **per-request: per-community override → global → fallback** (MAX over the request's communities via `request_communities` → `retention_config`). Manual trigger: `POST /jobs/forget-content`. |

## Memory Retention Job (Sprint 90 — ADR-069)

`src/jobs/memoryRetentionJob.ts`. Three statements per run, each idempotent via partial-index predicates:

1. **Exchange Unit cascade** — one data-modifying CTE: `UPDATE requests.help_requests` (completed, aged
   past `completed_request_window_days`, `content_forgotten_at IS NULL`) → sentinel + stamp
   `content_forgotten_at`; the second CTE forgets every `messaging.messages.content` whose conversation
   links (request → match → conversation, `conversations.request_match_id`) to a just-forgotten request.
   Atomic — request text and its messages forget together or not at all.
2. **Expired hard-delete** — `DELETE FROM requests.help_requests WHERE expired = TRUE AND NOT EXISTS (a
   match) AND updated_at < now() - expired_request_window_days`. Age from `updated_at` (the expiration
   job stamps it when it flips the flag), **never `created_at`**.
3. **Message backstop** — anonymize any `messages.content` older than `message_window_days` the cascade
   missed (`forgotten_at IS NULL`).

Per-community windows: the completed-anonymize and expired-delete branches resolve each request's
effective window in SQL as `MAX(COALESCE(community_override, global))` over the request's communities
(`request_communities` → `retention_config`) — the conservative choice, so a shared request is never
forgotten earlier than ANY owning community wants; a request with no community rows uses the global
default. The standalone message backstop uses the global window (a loose message isn't reliably
attributable to one community; per-community message retention is honored via the cascade).

`resolveRetentionWindows(rows, communityId?)` is a pure exported helper (community → global → hardcoded
fallback `{180, 30, 180}`) used to resolve the global default passed to the SQL. Config table:
`requests.retention_config` (partial unique index on the NULL global row + `WHERE NOT EXISTS` guarded
seed). Marker columns: `help_requests.content_forgotten_at`, `messages.forgotten_at`, each with a partial
index `WHERE ... IS NULL`.

**Sprint 90 retired `requestTtlSweepJob`** (`sweepExpiredRequests`): it hard-deleted completed+rated
requests and their matches (cascade-deleting conversations + messages) at 30 days, which both destroyed
the aggregate ADR-069 keeps and fired before the 180-day anonymize window. The memory retention job now
owns the completed-request lifecycle. The job file, its cron, and `/jobs/sweep-request-ttl` were removed.

## Database Schema

### Tables Used

- `communities.settings` - Per-community TTL and decay configuration
- `reputation.activity_log` - User activity tracking
- `reputation.trust_scores` - Trust scores with `last_activity_at`
- `requests.help_requests` - `expires_at`, `expired` columns; `status` reset to `open` on dibs expiry; Sprint 90: `content_forgotten_at` marker (anonymization stamp)
- `requests.retention_config` - Sprint 90 (ADR-069): per-community + global retention windows (`completed_request_window_days`/`expired_request_window_days`/`message_window_days`)
- `requests.dibs` - `status`, `expires_at` columns (Sprint 42)
- `requests.help_offers` - `expires_at`, `expired` columns
- `messaging.messages` - `expires_at`, `expired` columns; Sprint 90: `content` anonymized + `forgotten_at` marker on cascade
- `notifications.notifications` - `expires_at`, `expired` columns

### Functions Used

```sql
communities.calculate_expires_at(community_id, entity_type, created_at)
  → Returns expiration timestamp based on community TTL settings

reputation.calculate_decayed_karma(user_id, community_id)
  → Returns karma with exponential time decay applied
  → Formula: karma * 0.5^(months_ago / half_life_months)
```

## Security (Sprint 54 — ADR-052)

### SQL Injection Protection — `batchHardDelete()`
`batchHardDelete()` in `src/jobs/expirationJob.ts` interpolates a table name directly into a SQL query. Sprint 54 added `ALLOWED_CLEANUP_TABLES` (exported constant) that gates all calls:
```typescript
export const ALLOWED_CLEANUP_TABLES = new Set([
  'requests.help_requests', 'requests.help_offers',
  'messaging.messages', 'notifications.notifications',
]);
```
Any table name not in this set throws immediately before any DB call. This prevents SQL injection via the table parameter.

### Schema Typo Fix
`src/index.ts` admin auth check queried `community.members` (wrong schema). Fixed to `communities.members`. The bug caused all admin-authenticated endpoints to always return 403.

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

POST /jobs/sweep-trust-edges
  // Manually trigger trust edge sweep (delete decayed edges below threshold)

POST /jobs/forget-content
  // Manually trigger memory retention (Sprint 90 / ADR-069): anonymize aged completed-request
  // free-text + cascade-forget messages, hard-delete expired/unmatched requests. Karma untouched.

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

## Recent Changes

### Sprint 44: Structured Logging + Type Safety (2026-04-04)
- **NEW**: Added `createLogger` + `requestLoggingMiddleware` from `@karmyq/shared/utils/logger` to `src/index.ts` — request-scoped logging now active
- **FIXED**: Replaced `any` types in Express middleware helpers with typed `ExtendedRequest`, `Response`, `NextFunction` interfaces
- **FIXED**: Catch variable `error: any` replaced with `unknown` + `instanceof Error` narrowing
- **FIXED**: `db.ts` query helper params typed as `unknown[]` instead of `any[]`
- Route handler cron and admin endpoint errors now emit structured `{ service, step/endpoint, error.message }` via `(req as any).logger?.error()`

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

---

## Sprint 122 — Express 5 (2026-07-29)

`@types/express` **4.17.21 → 5.0.6**. Express 5's `path-to-regexp` 8 widened route params to
`string | string[]` (a repeatable `:ids+` or wildcard `*splat` segment captures an array), which
surfaced as `TS2345` at every `req.params` read. Karmyq declares no such segment, so params are
narrowed back to `string` via **`RouteParams`** (exported from `@karmyq/shared/middleware/auth`)
rather than widened with `as any`. The invariant is enforced by
`tests/regression/sprint-122-express5-route-params.test.ts`, which fails if any route literal
introduces wildcard or repeatable syntax.

No route file changed in this service — only the `@types/express` range; it type-checks clean at 0
errors under Express 5. Every async handler here try/catches internally and answers via the inline
`sendInternalError`, so no rejection escapes to Express 5's new auto-forwarding — which is why this
service needs no express error middleware.

**Also fixed here: `@karmyq/shared` was imported but never declared.** `src/index.ts` imports
`createLogger` and `requestLoggingMiddleware` from it, while an inline comment claimed the service
"doesn't use shared package" — stale and wrong. Now declared as `"*"`, and the comment corrected to
say what is actually true: the service consumes the shared *logger* but deliberately keeps its own
response helpers.

Express **4.18.2 → 5.2.1**, supplied by the root `package.json` **production** dependency
(the Dockerfiles copy the root manifest and `npm install --omit=dev`). **No endpoint, payload,
status code or event contract changed** — `feedback:check` flags this service's `src/routes/`
diff as a "route change", but the diff is type annotations only, so the API Endpoints section
above is still accurate.

Express 5 semantics now in force: async handler rejections auto-forward to the error middleware,
`res.status()` throws `RangeError` on an out-of-range code, and `req.query` is a getter rather
than a writable own property.
