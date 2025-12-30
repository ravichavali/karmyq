# ADR-011: Reputation Decay System (Social Karma v2)

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team
**Related**: services/reputation-service, docs/DEVELOPMENT_ROADMAP.md

## Context

Karma/reputation systems often suffer from:
- Early adopters dominating forever
- Inactive users retaining high scores
- No incentive to keep helping
- "Karma hoarding" behavior

We needed a system where **recent helpfulness matters more than past contributions**.

## Decision

**Time-based karma decay with 6-month half-life.**

### Decay Formula

```javascript
current_karma = base_karma * (0.5 ^ (months_since_earned / 6))
```

**Example:**
- Earned 100 karma today → 100 karma
- After 6 months → 50 karma
- After 12 months → 25 karma
- After 18 months → 12.5 karma

### Implementation

**Reputation Service (Port 3004):**
- Calculates decayed karma on-the-fly
- Stores `base_karma` and `earned_at` in database
- Returns `current_karma` (decay applied)

```sql
SELECT
  SUM(points * POW(0.5, EXTRACT(EPOCH FROM (NOW() - created_at)) / (6 * 30 * 24 * 60 * 60))) as current_karma
FROM reputation.karma_records
WHERE user_id = $1 AND community_id = $2;
```

### Configurable Per Community

```javascript
{
  karma_decay_enabled: true,
  karma_half_life_months: 6  // Communities can adjust
}
```

## Consequences

### Positive

- **Fair**: Recent helpers rank higher than inactive veterans
- **Incentive**: Must keep helping to maintain score
- **Realistic**: Matches how human memory works
- **Prevents Hoarding**: Can't "retire" on old karma
- **Community Health**: Encourages ongoing participation

### Negative

- **Query Complexity**: Decay calculation on every query
- **User Confusion**: "Where did my karma go?"
- **Migration**: Existing high-karma users will see drops
- **Performance**: More complex SQL queries

## Alternatives Considered

### Alternative 1: No Decay (Permanent Karma)

- **Why rejected**: Creates permanent hierarchies, discourages new helpers

### Alternative 2: Hard Expiration (Delete After X Months)

- **Why rejected**: Too harsh, loses all history

### Alternative 3: Linear Decay

- **Why rejected**: Exponential decay more realistic (half-life model)

## References

- Reputation service: `services/reputation-service/src/services/karmaService.ts`
- Decay preview: `services/community-service/src/routes/settings.ts`
- Database: `infrastructure/postgres/init.sql` (karma_records table)
