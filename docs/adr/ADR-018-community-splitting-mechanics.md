# ADR-018: Community Splitting Mechanics

**Date**: 2025-12-29
**Status**: Accepted
**Updated**: 2026-03-04 (Sprint 15 — Phase 1 approach selected, community_links schema finalized)
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

### Phase 1: Community Links — Voluntary Sister Model (v9.2, Sprint 15) ✅

**Chosen Approach**: Voluntary linking between existing communities by mutual admin consent.
This is simpler than full splitting mechanics and covers the majority of real-world use cases
(peer networks, geographic chapters, communities of practice) without forced division.

**Implemented schema** (`migration 025-community-links.sql`):
```sql
CREATE TABLE communities.community_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_a_id UUID NOT NULL REFERENCES communities.communities(id),
  community_b_id UUID NOT NULL REFERENCES communities.communities(id),
  link_type TEXT NOT NULL CHECK (link_type IN ('sister', 'parent_child', 'split_origin')),
  trust_carry_factor NUMERIC(3,2) DEFAULT 0.40,
  show_in_sister_feeds BOOLEAN DEFAULT FALSE,
  created_by_admin_a UUID,
  created_by_admin_b UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_a_id, community_b_id)
);
```

**Link types**:
- `sister` — peer communities (trust_carry default 0.40)
- `parent_child` — one spawned from another (trust_carry default 0.60)
- `split_origin` — two communities from a formal split (trust_carry default 0.50)

**API** (community-service):
- `POST /communities/:id/links` — propose a link (admin only)
- `PUT /communities/:id/links/:linkId` — approve/update
- `GET /communities/:id/links` — list links
- `DELETE /communities/:id/links/:linkId` — remove

**Feed integration** (feed-service):
- `GET /requests/curated?includeSisterCommunities=true` — includes requests from linked communities where `show_in_sister_feeds=true`, scored at `trust_carry_factor × original_score`

### Phase 2: Monitoring & Split Proposal (v10.0)
- Track community size; alert admins at thresholds (120, 130, 140)
- `split_proposals` table for admin-initiated guided splits
- Member assignment and prestige-weighted voting

### Phase 3: Cross-Community Features (v11.0+)
- Cross-community request posting
- Shared event calendar
- Family tree visualization

### Legacy Schema Proposal (superseded by Phase 1 above)

The original proposal used a `community_relationships` table. Phase 1's `community_links`
table is simpler and covers the same ground for now. The `split_proposals` table remains
planned for Phase 2.

```sql
-- PLANNED (Phase 2, not yet implemented)
CREATE TABLE community.split_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    proposed_by UUID NOT NULL REFERENCES auth.users(id),
    split_type TEXT NOT NULL, -- 'geographic', 'interest', 'size'
    rationale TEXT,
    proposed_communities JSONB,
    status TEXT DEFAULT 'discussion',
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decision_date TIMESTAMPTZ
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
