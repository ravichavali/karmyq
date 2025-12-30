# ADR-016: Prestige-Based Recognition System

**Date**: 2025-12-29
**Status**: Proposed
**Deciders**: Development Team
**Related**: ADR-011 (Reputation Decay), docs/philosophy/prestige-systems.md

## Context

Traditional karma/reputation systems often create extractive dynamics (accumulation-focused) rather than generative ones (contribution-focused). We need a recognition system that:
- Rewards ongoing contribution, not just accumulation
- Creates intrinsic motivation through social recognition
- Prevents gaming and status competition
- Reflects cultural evolution research on prestige systems

Joseph Henrich's work in "The Secret of Our Success" shows that prestige-based systems (freely conferred deference based on contribution) were crucial for human cultural evolution, unlike dominance (power through force).

## Decision

**Implement prestige-based recognition system inspired by anthropological gift economies.**

### Prestige Categories

**The Connector**
- Introduces people who can help each other
- Organizes community events and gatherings
- Facilitates cross-community relationships
- Badge: "Bridge Builder"

**The Reliable**
- Consistently follows through on commitments
- Available during community emergencies
- Maintains tools/resources for community use
- Badge: "Steady Hand"

**The Teacher**
- Shares skills and knowledge freely
- Mentors newcomers to the community
- Creates learning opportunities
- Badge: "Wisdom Keeper"

**The Catalyst**
- Initiates community improvements and projects
- Turns ideas into reality through organizing
- Mobilizes community action
- Badge: "Community Architect"

**The Caregiver**
- Provides emotional support during difficult times
- Checks on vulnerable community members
- Creates inclusive, welcoming environment
- Badge: "Heart of the Community"

### Recognition Mechanics

**Peer Nomination**: Community members nominate others for prestige categories
**Story-Based**: Recognition includes specific stories of contribution
**Rotating Focus**: Different prestige categories highlighted seasonally
**Temporal**: Prestige requires ongoing contribution (6-month half-life like karma)

### The Humility Principle

High prestige comes with **greater responsibility**, not greater privilege:
- More responsibility to help others
- Expectation to mentor newcomers
- First call for community emergencies
- Obligation to participate in governance

### Prestige-Weighted Governance

- Community decisions weighted by prestige + recency of contribution
- Prevents new member manipulation while avoiding entrenched oligarchy
- Transparent calculation visible to all members

## Consequences

### Positive

- **Intrinsic Motivation**: Social recognition more powerful than points
- **Anti-Gaming**: Story-based recognition harder to manipulate
- **Cultural Transmission**: Communities learn what they value through recognition
- **Sustainable Leadership**: Rotating prestige prevents burnout
- **Virtuous Cycle**: Pursuing prestige benefits everyone

### Negative

- **Popularity Contest Risk**: Could favor charismatic over genuinely helpful
- **Exclusion Risk**: Newcomers may feel intimidated by high-prestige members
- **Gaming Potential**: People may perform "visible help" over quiet support
- **Implementation Complexity**: Requires cultural design, not just code

## Alternatives Considered

### Alternative 1: Pure Karma Points

- **Why rejected**: Encourages accumulation, not contribution; can be gamed

### Alternative 2: No Recognition System

- **Why rejected**: Lacks intrinsic motivation; doesn't reward consistent contributors

### Alternative 3: Algorithmic Reputation

- **Why rejected**: Black-box calculations; doesn't tell stories; centralized

## Implementation Notes

### Phase 1: Basic Recognition (v9.0)
- Thank-you system for completed exchanges
- Community-visible appreciation posts
- Simple badges for consistent participation

### Phase 2: Prestige Categories (v10.0)
- Peer nomination system
- Story collection for each badge
- Prestige-weighted governance

### Phase 3: Cultural Evolution (v11.0+)
- Community-specific prestige norms
- Cross-community prestige transfer
- Recognition rituals and ceremonies

### Database Schema

```sql
CREATE TABLE reputation.prestige_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    badge_icon VARCHAR(50),
    community_id UUID REFERENCES communities.communities(id)
);

CREATE TABLE reputation.prestige_nominations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nominee_id UUID NOT NULL REFERENCES auth.users(id),
    nominator_id UUID NOT NULL REFERENCES auth.users(id),
    category_id UUID NOT NULL REFERENCES reputation.prestige_categories(id),
    story TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reputation.prestige_awards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    category_id UUID NOT NULL REFERENCES reputation.prestige_categories(id),
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- 6-month half-life
    story_ids UUID[] -- Array of nomination story IDs
);
```

## References

- Henrich, J. "The Secret of Our Success" (2015)
- Potlatch systems (Pacific Northwest indigenous cultures)
- Big Man systems (Melanesian cultures)
- Gift economy research (Marcel Mauss, Lewis Hyde)
