# ADR-018: Community Splitting Mechanics

**Date**: 2025-12-29
**Status**: Proposed
**Deciders**: Development Team
**Related**: ADR-017 (Cohort Layers), ADR-003 (Multi-Tenant)

## Context

Communities have a cognitive limit (Dunbar's Number ~150). Beyond this, trust and cohesion break down. We need a healthy process for communities to split before reaching dysfunction.

Biological and social systems handle growth through cell division, not unlimited expansion. Examples:
- Hunter-gatherer bands split at 150-200 people
- Religious congregations split at similar sizes
- Open source projects fork when vision diverges

Current Karmyq implementation has no splitting mechanism, risking:
- Overcrowded communities with diluted trust
- Admin burnout from managing large groups
- Loss of intimacy and shared culture

## Decision

**Implement graceful community splitting at 130-140 members with "sister community" relationships.**

### Splitting Triggers

**Size-Based (Automatic Suggestion)**:
- Warning at 120 members: "Community approaching optimal size"
- Suggestion at 130 members: "Consider community split"
- Strong recommendation at 140 members

**Culture-Based (Manual)**:
- Geographic division (e.g., Portland splits into North/South)
- Interest-based (e.g., Tool Library splits into Woodworking/Gardening)
- Vision divergence (different interpretations of norms)

### Splitting Process

**1. Discussion Phase (1-2 months)**
- Community-wide discussion about splitting
- Identify natural division points (geography, interests, subgroups)
- Address concerns and resistance
- Prestige-weighted vote on split proposal

**2. Planning Phase (1 month)**
- Define boundaries of new communities
- Assign members to communities (with opt-out)
- Transfer norms and settings (customizable)
- Choose new community names

**3. Transition Phase (1 month)**
- Gradual transition with cross-posting
- Member assignments finalized
- New admin teams established
- Sister community relationship formalized

**4. Independence Phase**
- Communities operate independently
- Shared history maintained
- Cross-community trust preserved
- Optional periodic joint events

### Sister Community Relationship

**Parent-Child Model**:
```javascript
{
  parentCommunityId: "portland-tools-uuid",
  childCommunities: [
    "north-portland-tools-uuid",
    "east-portland-tools-uuid"
  ],
  splitDate: "2025-06-15",
  sharedHistory: true, // Can see pre-split exchanges
  trustTransfer: 0.8   // 80% trust carries over
}
```

**Sibling Model** (equal split):
```javascript
{
  forkedFrom: "portland-tools-uuid",
  siblingCommunities: [
    "portland-woodworking-uuid",
    "portland-gardening-uuid"
  ],
  splitDate: "2025-06-15",
  sharedHistory: true,
  trustTransfer: 0.9   // 90% trust (more similar culture)
}
```

### Cross-Community Features Post-Split

**Trust Transfer**:
- Karma from parent community partially transfers (configurable %)
- Prestige badges carry over with annotation
- Interaction history visible but marked as "from parent community"

**Cross-Community Exchanges**:
- Members can post requests to sister communities
- Trust decay formula: `trust_in_sister = trust_in_home * trustTransfer * (1 - 0.1 * months_since_split)`

**Shared Resources**:
- Optional shared tool libraries
- Joint events (reunions, celebrations)
- Shared documentation and norms

## Consequences

### Positive

- **Prevents Dysfunction**: Splits before communities become unmanageable
- **Maintains Intimacy**: Smaller communities preserve deep trust
- **Natural Growth**: Mirrors biological/social patterns
- **Cultural Evolution**: Communities can specialize and experiment
- **Reduced Admin Burden**: Distributed leadership across multiple communities

### Negative

- **Emotional Difficulty**: Members may resist splitting (feels like divorce)
- **Coordination Overhead**: Managing relationships between communities
- **Fragmentation Risk**: Too many small communities may dilute network effects
- **Trust Loss**: Some trust inevitably lost in transition

## Alternatives Considered

### Alternative 1: Unlimited Community Size

- **Why rejected**: Violates Dunbar's Number; trust breaks down at scale

### Alternative 2: Hard Cap at 150 Members

- **Why rejected**: Too rigid; doesn't allow for graceful transition

### Alternative 3: Subgroups Within Community

- **Why rejected**: Creates hierarchy; doesn't solve overcrowding

## Implementation Notes

### Phase 1: Monitoring & Alerts (v9.0)
- Track community size
- Alert admins at thresholds (120, 130, 140)
- Educational content about splitting

### Phase 2: Splitting Wizard (v10.0)
- Guided splitting process
- Member assignment interface
- Sister community relationship setup
- Trust transfer configuration

### Phase 3: Cross-Community Features (v11.0+)
- Cross-community exchanges
- Shared event calendar
- Family tree visualization

### Database Schema

```sql
CREATE TABLE communities.community_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    related_community_id UUID NOT NULL REFERENCES communities.communities(id),
    relationship_type VARCHAR(50) NOT NULL, -- 'parent', 'child', 'sibling'
    trust_transfer_rate DECIMAL(3,2) DEFAULT 0.8,
    split_date TIMESTAMP NOT NULL,
    shared_history BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communities.split_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    proposed_by UUID NOT NULL REFERENCES auth.users(id),
    split_type VARCHAR(50) NOT NULL, -- 'geographic', 'interest', 'size'
    rationale TEXT,
    proposed_communities JSONB, -- Array of {name, description, memberIds[]}
    status VARCHAR(50) DEFAULT 'discussion', -- discussion, voting, approved, rejected
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decision_date TIMESTAMP
);
```

### UI Components

**Split Wizard**:
1. **Why Split?** - Educational content, size metrics, benefits
2. **Division Strategy** - Geographic, interest-based, or custom
3. **Member Assignment** - Drag-and-drop interface, opt-out option
4. **Settings Transfer** - Choose which norms/settings transfer
5. **Review & Vote** - Community approval process
6. **Transition Plan** - Timeline and milestones

**Sister Community Dashboard**:
- Family tree visualization
- Cross-community activity feed
- Shared calendar
- Combined member directory

## References

- Dunbar, R. "How Many Friends Does One Person Need?" (2010)
- Coase's theory of firm size and transaction costs
- Open source project forking patterns
- Religious congregation splitting studies
- Hutterite community division practices (~150 people)
