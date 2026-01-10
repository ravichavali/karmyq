# Trust and Reputation Framework

**Date**: 2026-01-09
**Status**: Draft - Conceptual Framework
**Purpose**: Clarify the relationship between Trust Scores, Karma Points, and measuring positive community behavior

## Core Question

**What are we actually measuring, and why?**

The fundamental insight from your description: **"The most important thing is improved interactions."**

This leads to a key philosophical question:
- **Should we measure individual worthiness** (karma/reputation)?
- **Or should we measure relationship quality** (trust)?
- **Or both, with clear separation of concerns**?

## Current System Analysis

### What We Have Now (v8.0)

1. **Karma Points (Individual Metric)**
   - Stored in: `reputation.karma_records`
   - Awarded for: completing matches, receiving ratings
   - Decays over time (6-month half-life - ADR-011)
   - Scoped to: `(user_id, community_id)` - community-specific
   - Purpose: Measure recent helpfulness

2. **Trust Paths (Relationship Metric)**
   - Computed via: Social graph service
   - Measured in: Degrees of separation (1-6)
   - Filterable by: User preference (ADR-021)
   - Purpose: Show how people are connected

3. **Prestige Badges (Symbolic Recognition)**
   - Referenced in: ADR-016 (prestige-based recognition)
   - Purpose: Qualitative recognition, not quantitative scoring
   - Status: Proposed, not yet implemented

4. **Referral Chain (Accountability Metric)**
   - Documented in: ADR-019
   - Creates: Shared reputation during accountability period
   - Purpose: Vouching system, not performance metric
   - Status: Proposed, not yet implemented

## Conceptual Framework: Three Dimensions

### Dimension 1: Individual Contribution (Karma)

**What It Measures**: How much someone has helped their community recently

**Current Implementation**: Karma points with decay
- Earned: +10 for completed match, +5 for rated positively
- Decays: 6-month half-life
- Scope: Per-community

**Design Intent**:
- Reward active helpers
- Prevent karma hoarding
- Reflect recent contribution, not lifetime achievement

**Key Insight**: Karma is **individual** and **temporal** - "What have you done for the community lately?"

**Your Observation**: "Asking help and helping both are positive"

**Implication**: Should requesting help ALSO earn karma? Current system only rewards helpers.

**Proposed Enhancement**:
```javascript
// Current system
help_completed: +10 karma (helper only)
help_received: 0 karma (requester)

// Proposed system
help_completed: +10 karma (helper)
help_requested_and_completed: +5 karma (requester) // Why?
  // 1. Takes courage to ask for help
  // 2. Successful request means good request quality (clear, reasonable, respectful)
  // 3. Closing the loop (marking complete, rating) is valuable contribution
  // 4. Requesting creates opportunity for helpers to earn karma
```

**Rationale**: In mutual aid, **asking is giving** - you give others the gift of being helpful.

---

### Dimension 2: Relationship Trust (Trust Scores)

**What It Measures**: How much you trust a specific person based on your relationship

**Current Implementation**: Trust paths (degrees of separation)
- 1° = Direct connection (you referred them or they referred you)
- 2° = Friend of friend
- 3° = Extended network
- 4-6° = Distant connections

**Design Intent**:
- Reflect strength of social connection
- Enable trust-based filtering
- Show "who knows who"

**Your Question**: "Is trust score an individual or a relationship?"

**Answer**: Trust is **relational**, not individual. Trust exists between two people.

**Implications**:

1. **Trust is Asymmetric**: Alice may trust Bob more than Bob trusts Alice
2. **Trust is Contextual**: I trust you to borrow tools, but not babysit my kids
3. **Trust is Experiential**: Built through positive interactions, damaged by negative ones

**Proposed Model**: Trust Score as Relationship Metric

```typescript
interface TrustScore {
  from_user_id: UUID;           // Who is trusting
  to_user_id: UUID;             // Who is being trusted
  community_id: UUID;           // Context matters

  // Base trust (from social graph)
  social_distance: number;      // 1-6 degrees
  referral_chain_length: number; // How many people vouched in between

  // Experiential trust (from interactions)
  direct_interactions: number;   // How many times you've worked together
  successful_outcomes: number;   // How many went well
  trust_rating: number;          // 0-1 scale, based on experience

  // Computed
  composite_trust_score: number; // Weighted combination of above

  last_interaction: timestamp;
  created_at: timestamp;
}
```

**Key Insight**: Trust score is **directional** and **experience-based**:
- Starts with social distance (inherited trust via referral chain)
- Strengthens with positive direct interactions
- Weakens with negative interactions or time without interaction

---

### Dimension 3: Community Health (Aggregate Metrics)

**What It Measures**: Quality of interactions in the community as a whole

**Your Insight**: "The most important thing is improved interactions"

**Question**: How do we measure "improved interactions"?

**Proposed Metrics**:

1. **Match Completion Rate**
   - % of matches that complete successfully
   - Higher = better quality matching
   - Target: >80%

2. **Requester Satisfaction**
   - Average rating given by requesters to helpers
   - Higher = helpers are truly helpful
   - Target: >4.0/5.0

3. **Helper Satisfaction**
   - Average rating given by helpers about requests
   - Were requests clear, reasonable, respectful?
   - Target: >4.0/5.0

4. **Reciprocity Index**
   - % of members who both ask AND offer help
   - Higher = healthier mutual aid culture
   - Target: >60% (avoid pure requesters or pure helpers)

5. **Trust Expansion Rate**
   - How often do people help someone further from their network?
   - Measures willingness to trust strangers
   - Target: Gradual increase over time

6. **Repeat Interaction Rate**
   - % of matches that lead to future direct trust
   - Do one-time exchanges become ongoing relationships?
   - Target: >30%

**Key Insight**: Community health is **emergent** from individual behaviors.

---

## Answering Your Core Questions

### 1. "Are Karma points any different from Trust scores?"

**YES - Fundamentally different:**

| Aspect | Karma Points | Trust Scores |
|--------|--------------|--------------|
| **What** | Individual contribution | Relational connection |
| **Scope** | User × Community | User × User × Community |
| **Temporal** | Decays over time | Grows/shrinks with interactions |
| **Purpose** | Reward active helpers | Enable risk assessment |
| **Public/Private** | Public (leaderboards) | Private (only visible to trustor) |
| **Incentive** | Encourages helping | Encourages relationship building |

**Analogy**:
- **Karma** = Credit score (how financially responsible are you?)
- **Trust** = Personal reference (would YOU lend them money?)

### 2. "How do we measure good things of individuals?"

**For Individuals**, measure:

1. **Contribution (Karma)**
   - Helps given
   - Helps received (controversial but important!)
   - Quality ratings
   - Community participation

2. **Reliability**
   - Match completion rate
   - Response time
   - Cancellation rate (lower is better)

3. **Relationship Building**
   - Number of unique people helped
   - Number of repeat interactions
   - Referrals made (quality of people you invite)

4. **Cultural Stewardship**
   - Conflict resolution participation
   - Community event attendance
   - Helpful feedback on requests/offers

**Display on Profile**:
```
Alex Chen
Portland Tools Community

Contribution
- 150 karma (top 15%)
- 25 successful matches this year
- 4.8 helper rating, 4.7 requester rating

Relationships
- Helped 18 different people
- 12 people would help again
- Referred 3 members (all active)

Joined 8 months ago via Sarah's referral
```

### 3. "How do we measure good things of communities?"

**For Communities**, measure:

1. **Activity Level**
   - Requests posted per week
   - Matches made per week
   - Active members (posted/helped in last 30 days)

2. **Match Quality**
   - Completion rate
   - Average satisfaction ratings
   - Time to match (faster = healthier)

3. **Inclusivity**
   - Reciprocity index (% who both ask and offer)
   - New member integration rate
   - Distribution of karma (concentrated or spread?)

4. **Trust Depth**
   - Average trust path filter setting
   - % of cross-network matches (distant connections)
   - Referral chain health

5. **Sustainability**
   - Member retention (% still active after 6 months)
   - Request variety (diverse categories)
   - Self-governance (conflict resolution rate)

**Display on Community Page**:
```
Portland Tools
158 active members

This Month
- 47 requests posted
- 52 matches made
- 89% completion rate
- 4.6 average satisfaction

Community Culture
- 72% of members both ask and help
- Average trust: 3.2 degrees (balanced openness)
- 94% of new members still active after 3 months

Strongest in: Tool lending, home repair, moving help
```

---

## Design Implications

### Implication 1: Separate Schemas

**Karma** and **Trust** should live in different database schemas:

```sql
-- reputation.karma_records (INDIVIDUAL)
user_id, community_id, points, created_at

-- social_graph.trust_scores (RELATIONAL)
from_user_id, to_user_id, community_id, score, last_interaction

-- community.health_metrics (AGGREGATE)
community_id, metric_name, metric_value, calculated_at
```

### Implication 2: Different Display Contexts

**Karma** is public:
- Leaderboards
- Profile badges
- Community rankings

**Trust** is private:
- Only you see your trust score for someone
- Trust path shown to both parties
- Aggregate stats (avg trust in community) are public

### Implication 3: Different Incentive Structures

**Karma** drives individual behavior:
- Gamification: earn points, climb leaderboard
- Recognition: badges, prestige levels
- Access: higher karma = more privileges

**Trust** drives relationship behavior:
- Quality over quantity: better to have deep trust with few people
- No leaderboard (can't "win" at trust)
- Personal safety: you decide who you're comfortable helping

---

## Your Specific Ideas: Analysis

### Idea 1: "Trust path and Trust scores should be displayed on offers and requests"

**Agreement**: YES - critical for risk assessment

**Design**:
```
[Request Card]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Need help moving couch
Saturday 2pm, 30 min
Maria Garcia

[Trust Path Badge]
2° connection
via Sarah → Maria

[Your Trust Score for Maria]
⭐⭐⭐⭐☆ Medium Trust
(Based on 0 direct interactions)

[Community Info]
150 karma, 92% completion rate
Member for 5 months
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**What to show**:
1. **Trust Path**: Degrees of separation + names in chain (with privacy controls)
2. **Your Trust Score**: Personal assessment based on your relationship
3. **Community Karma**: Their contribution level
4. **Reliability Stats**: Completion rate, ratings

### Idea 2: "Incentivize helping outside your comfort level of trust"

**Agreement**: YES - promotes trust expansion

**Design**: Karma Bonuses for Trust Expansion

```javascript
// Base karma for helping
const baseKarma = 10;

// Bonus for helping distant connections
const trustDistanceBonus = {
  1: 0,   // Direct connection (no bonus)
  2: 2,   // +2 karma (20% bonus)
  3: 4,   // +4 karma (40% bonus)
  4: 6,   // +6 karma (60% bonus)
  5: 8,   // +8 karma (80% bonus)
  6: 10   // +10 karma (100% bonus - doubled!)
};

// Total karma = base + distance bonus
// Helping a 6° connection earns 20 karma instead of 10
```

**Rationale**:
- Rewards courage to trust strangers
- Incentivizes network expansion
- Helps new members (who are far from everyone)
- Builds stronger communities

**Additional Incentive**: "Trust Bridge" Badge
- Awarded for helping 5+ people outside your 3° network
- Visible on profile
- Social recognition for being open/generous

### Idea 3: "Public vs Private User Profiles"

**Agreement**: YES - essential for safety and privacy

**Proposed Two-Tier System**:

**Public Profile** (visible to anyone in community):
- Name (or pseudonym)
- Karma score
- Join date
- Referral chain (if they choose to share)
- Skills offered
- Badges/prestige
- Number of successful matches (not details)

**Private Profile** (only visible to people you've matched with):
- Contact info (email, phone)
- Specific location
- Request/offer history
- Detailed ratings and reviews
- Personal bio/story

**Control**:
```typescript
interface PrivacySettings {
  profile_visibility: 'public' | 'members_only' | 'matches_only';
  show_referral_chain: boolean;
  show_karma_score: boolean;
  show_real_name: boolean; // vs pseudonym
  allow_messages_from: 'anyone' | 'connections_only' | 'matches_only';
}
```

**Your Idea**: "Show invite paths on public profiles"

**Enhancement**:
```
[Public Profile]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Alex Chen
Portland Tools

Invited by: Sarah (if Alex shares this)
Invited: Maria, James, Lisa (3 members)

2° connection to you
via Sarah → Alex
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Benefit**:
- Shows accountability (who vouched for them)
- Displays trust-building behavior (who they brought in)
- Helps you assess if you have mutual connections

---

## Implementation Priorities

### High Priority (Next 2 Sprints)

1. **Clarify Karma vs Trust Separation** ✅
   - Document in ADR
   - Update database schema comments
   - Ensure UI labels are clear

2. **Display Trust Info on Request/Offer Cards** 🎯
   - Trust path badge (already exists)
   - Add trust score display
   - Add karma + reliability stats
   - Estimated time: 8-12 hours

3. **Karma Bonus for Trust Distance** 🎯
   - Update reputation service calculation
   - Display in UI ("You earned +4 bonus karma for helping someone new!")
   - Estimated time: 4-6 hours

### Medium Priority (Next 4-6 Sprints)

4. **Public/Private Profile System** 📋
   - Privacy settings UI
   - Profile visibility controls
   - Estimated time: 20-30 hours

5. **Trust Score Calculation & Storage** 📋
   - New `social_graph.trust_scores` table
   - Calculation based on interactions
   - Private display to user
   - Estimated time: 30-40 hours

6. **Community Health Dashboard** 📋
   - Aggregate metrics calculation
   - Admin dashboard display
   - Estimated time: 15-20 hours

### Low Priority (v10.0+)

7. **Requester Karma** 💭
   - Award karma for completing requests
   - Requires community feedback/testing
   - Estimated time: 6-8 hours

8. **Trust Bridge Badges** 💭
   - Prestige system implementation
   - Related to ADR-016
   - Estimated time: 12-16 hours

---

## Open Questions for Discussion

1. **Should requesters earn karma?**
   - Pro: Encourages asking (reduces stigma)
   - Con: May incentivize fake requests
   - Proposed: Small amount (+5) only on completion with positive rating

2. **Should trust scores be symmetric or asymmetric?**
   - Symmetric: Alice trusts Bob = Bob trusts Alice (simpler)
   - Asymmetric: Alice trusts Bob ≠ Bob trusts Alice (more realistic)
   - Proposed: Start symmetric, add asymmetry in v10

3. **How much karma bonus is right for distant connections?**
   - Current proposal: +100% for 6° (10 → 20 karma)
   - Too much? Too little?
   - Proposed: A/B test different bonus structures

4. **Should trust scores factor into feed ranking?**
   - Option A: Filter only (ADR-021 approach)
   - Option B: Filter + rank by trust (higher trust = top of feed)
   - Proposed: Start with filter, add ranking in v10

5. **What counts as "freerider problem" we're ignoring for now?**
   - People who only request, never offer?
   - People who accept help but don't mark complete / rate?
   - People who inflate their requests to get more help?
   - Proposed: Monitor reciprocity index, address if <40%

---

## Next Steps

1. **Review this framework** - Does it match your mental model?
2. **Decide on quick wins** - Which items from High Priority list?
3. **Create ADR if needed** - Should we formalize trust vs karma distinction?
4. **Update backlog** - Turn this into actionable tickets
5. **Design mocks** - Trust display on request cards (need designer?)
6. **Landing page content** - Use this framework to explain value prop

---

## Related Documents

- [ADR-011: Reputation Decay](../adr/ADR-011-reputation-decay.md)
- [ADR-019: Referral Chain Trust System](../adr/ADR-019-referral-chain-trust.md)
- [ADR-020: Trust-First Design Philosophy](../adr/ADR-020-trust-first-design.md)
- [ADR-021: Trust Path Filtering](../adr/ADR-021-trust-path-filtering.md)
- [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md)
