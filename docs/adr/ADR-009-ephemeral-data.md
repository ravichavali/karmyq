# ADR-009: Ephemeral Data Design

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: docs/MULTI_TENANT_GUIDE.md, services/cleanup-service

## Context

Mutual aid data has a natural lifecycle. Old requests, expired offers, and ancient messages lose relevance over time. We needed to decide how to handle data retention.

## Decision

**Data fades like memory** - Configurable TTL with automatic cleanup.

### Implementation

**Cleanup Service (Port 3008):**
- Runs daily at 2 AM
- Deletes data past TTL
- Configurable per-community

**Default TTLs:**
```javascript
{
  request_ttl_days: 60,        // Help requests
  offer_ttl_days: 60,          // Help offers
  match_ttl_days: 90,          // Completed matches
  notification_ttl_days: 30,   // Notifications
  message_ttl_days: 90,        // Chat messages
  session_ttl_days: 30         // User sessions
}
```

**Database Flags:**
```sql
ALTER TABLE requests.help_requests ADD COLUMN expired BOOLEAN DEFAULT FALSE;
ALTER TABLE requests.help_requests ADD COLUMN expires_at TIMESTAMP;
```

### Cleanup Logic

```sql
-- Mark as expired (reversible)
UPDATE requests.help_requests
SET expired = TRUE
WHERE created_at < NOW() - INTERVAL '60 days'
  AND expired = FALSE;

-- Hard delete after grace period
DELETE FROM requests.help_requests
WHERE expired = TRUE
  AND created_at < NOW() - INTERVAL '90 days';
```

## Consequences

### Positive

- **Storage Savings**: Database doesn't grow unbounded
- **Privacy-Friendly**: Old data automatically removed
- **Performance**: Smaller tables = faster queries
- **Realistic**: Matches how human memory works
- **Configurable**: Communities control their own retention

### Negative

- **Data Loss**: No long-term history
- **Analytics Limited**: Can't analyze old patterns
- **Accidental Deletion**: No easy undo after hard delete
- **Export Required**: Communities must export before deletion

## Alternatives Considered

### Alternative 1: Keep Everything Forever

- **Why rejected**: Storage costs, privacy concerns, GDPR compliance

### Alternative 2: Archive to S3

- **Why rejected**: Adds complexity, most communities don't need archives

### Alternative 3: Manual Deletion Only

- **Why rejected**: Requires active community management, defaults to hoarding

## References

- Cleanup service: `services/cleanup-service/`
- Multi-tenant guide: `docs/MULTI_TENANT_GUIDE.md`
- Community settings: `services/community-service/src/routes/settings.ts`
