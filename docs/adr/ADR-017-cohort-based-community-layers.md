# ADR-017: Cohort-Based Community Layers

**Date**: 2025-12-29
**Status**: Proposed
**Deciders**: Development Team
**Related**: ADR-003 (Multi-Tenant RLS), ADR-011 (Reputation Decay)

## Context

Human communities naturally organize in layers based on interaction frequency and trust depth. Anthropological research (Robin Dunbar, etc.) shows:
- Inner circles: 5-7 people (high frequency, deep trust)
- Active community: ~50 people (regular interactions, medium trust)
- Extended network: ~150 people (Dunbar's Number, baseline trust)

Current Karmyq implementation treats all community members equally, missing opportunity to model natural social structures.

## Decision

**Implement cohort-based community layers reflecting natural human social organization.**

### Layer Structure

**Inner Circle (5-7 people)**
- High frequency interactions (weekly or more)
- Deep trust relationships
- Core decision-making group
- Regular mutual assistance
- Quick response to urgent requests

**Active Community (~15-50 people)**
- Regular interactions (monthly)
- Medium trust relationships
- Engaged in community governance
- Consistent participation in exchanges
- Shared norms and culture

**Extended Network (~50-150 people)**
- Occasional interactions (quarterly or less)
- Baseline trust relationships
- Broader community participation
- Resource sharing network
- Discovery layer for new connections

### Layer Assignment

**Self-Organizing**: Layers determined by interaction patterns, not manual assignment
**Algorithm**:
```javascript
// Interaction frequency score
const innerCircleThreshold = 4; // interactions per month
const activeCommunityThreshold = 1; // interactions per month

function calculateLayer(userId, communityId) {
  const last6MonthsInteractions = getInteractions(userId, communityId, 6);
  const interactionsPerMonth = last6MonthsInteractions.length / 6;

  if (interactionsPerMonth >= innerCircleThreshold) {
    return 'inner_circle';
  } else if (interactionsPerMonth >= activeCommunityThreshold) {
    return 'active_community';
  } else {
    return 'extended_network';
  }
}
```

### Layer Benefits

**Inner Circle Members**:
- Priority notification for urgent requests
- Access to "inner circle only" exchanges
- Stronger voice in governance decisions
- Cross-community introduction privileges

**Active Community Members**:
- Standard notification priority
- Access to most exchanges
- Full governance participation
- Community event organizing rights

**Extended Network Members**:
- Lower notification priority (opt-in for urgent)
- Access to public exchanges
- Observation of governance (limited voting)
- Path to active participation

### Dynamic Movement

Members naturally move between layers based on participation:
- Increased interaction → move to more engaged layer
- Decreased interaction → move to less engaged layer
- Transparent calculation visible to member
- No stigma attached to layer (it's descriptive, not prescriptive)

## Consequences

### Positive

- **Models Reality**: Reflects how humans naturally organize
- **Reduces Noise**: Notifications targeted by interaction frequency
- **Encourages Depth**: Inner circles build deeper trust
- **Scales Gracefully**: Extended network can grow without overwhelming actives
- **Measurable Engagement**: Clear metrics for community health

### Negative

- **Exclusion Feelings**: Extended network members may feel "second-class"
- **Gaming Potential**: People may artificially boost interaction frequency
- **Calculation Complexity**: Algorithm must balance multiple factors
- **Cultural Sensitivity**: Some communities may reject hierarchy

## Alternatives Considered

### Alternative 1: Flat Community Structure

- **Why rejected**: Doesn't model human social reality; overwhelms engaged members with noise

### Alternative 2: Manual Role Assignment

- **Why rejected**: Creates explicit hierarchy; subject to politics and favoritism

### Alternative 3: Fixed Member Tiers

- **Why rejected**: Rigid; doesn't adapt to changing participation patterns

## Implementation Notes

### Phase 1: Read-Only Layer Display (v9.0)
- Calculate layers based on interaction history
- Display in member profiles
- No functional differences (just informational)

### Phase 2: Layer-Based Features (v10.0)
- Notification priority by layer
- "Inner circle only" request option
- Layer-weighted governance

### Phase 3: Cross-Layer Dynamics (v11.0+)
- Mentorship programs (inner → extended)
- Layer transition rituals
- Inter-layer trust building activities

### Database Schema

```sql
-- No new tables needed! Just computed values
CREATE OR REPLACE FUNCTION calculate_community_layer(
    p_user_id UUID,
    p_community_id UUID
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_interactions_per_month DECIMAL;
BEGIN
    SELECT COUNT(*) / 6.0 INTO v_interactions_per_month
    FROM (
        -- Requests created
        SELECT created_at FROM requests.help_requests
        WHERE requester_id = p_user_id
          AND created_at > NOW() - INTERVAL '6 months'

        UNION ALL

        -- Offers made
        SELECT created_at FROM requests.help_offers
        WHERE offerer_id = p_user_id
          AND community_id = p_community_id
          AND created_at > NOW() - INTERVAL '6 months'

        UNION ALL

        -- Messages sent
        SELECT created_at FROM messaging.messages
        WHERE sender_id = p_user_id
          AND created_at > NOW() - INTERVAL '6 months'
    ) interactions;

    IF v_interactions_per_month >= 4 THEN
        RETURN 'inner_circle';
    ELSIF v_interactions_per_month >= 1 THEN
        RETURN 'active_community';
    ELSE
        RETURN 'extended_network';
    END IF;
END;
$$ LANGUAGE plpgsql;
```

### API Changes

```typescript
// GET /communities/:id/members response
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "user-uuid",
        "name": "Alice",
        "layer": "inner_circle",
        "interactionsPerMonth": 5.2,
        "layerSince": "2025-01-15T00:00:00Z"
      }
    ],
    "layerCounts": {
      "inner_circle": 7,
      "active_community": 42,
      "extended_network": 98
    }
  }
}
```

## References

- Dunbar, R. "Grooming, Gossip, and the Evolution of Language" (1996)
- Dunbar's Number research (cognitive limit of ~150 stable relationships)
- Social Brain Hypothesis
- Anthropological studies of hunter-gatherer band sizes
