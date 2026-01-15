# Fractal Karma & Trust: Communities as Extensions of People

**Date**: 2026-01-09
**Status**: Conceptual Exploration
**Related**: [Trust and Reputation Framework](TRUST_AND_REPUTATION_FRAMEWORK.md)

## Core Insight

**"Communities are extensions of people. We are fractals."**

This suggests that karma and trust shouldn't be fundamentally different concepts for users vs communities. Instead, they should be **the same measurement applied at different scales**.

---

## The Fractal Pattern

### Current Thinking (OUTDATED)

We were thinking:
- **Karma** = Individual contribution (just for users)
- **Trust** = Relational connection (just between users)
- **Community Health** = Aggregate metrics (separate concept)

### New Fractal Thinking

Both users and communities should have:
- **Karma** = Contribution/value to the broader ecosystem
- **Trust** = Quality of relationships/connections

**Why?** Because communities ARE people, just at a larger scale.

---

## What This Means

### Users Have Karma & Trust

**User Karma** (individual contribution):
- How much have you helped?
- How actively do you participate?
- What value do you bring to communities?

**User Trust** (relational quality):
- How connected are you to others?
- How reliable have you been in exchanges?
- What's the quality of your relationships?

### Communities Have Karma & Trust

**Community Karma** (collective contribution):
- How much help flows through this community?
- How active/vibrant is this community?
- What value does this community bring to the broader ecosystem?

**Community Trust** (relational quality):
- How well do members trust each other?
- How strong are the internal connections?
- What's the quality of interactions within the community?

### The Fractal Connection

```
Individual Person
├─ Has karma (contribution)
└─ Has trust (relationships)
    │
    └─ Forms/Joins Communities
        │
        └─ Community (collective of people)
            ├─ Has karma (aggregate contribution)
            └─ Has trust (aggregate relationships)
                │
                └─ Communities connect to other communities
                    │
                    └─ Meta-community / Movement
                        ├─ Has karma (systemic contribution)
                        └─ Has trust (cross-community bonds)
```

**It's recursive all the way up.**

---

## Measuring Karma at Different Scales

### Individual Karma

**What we measure**:
- Completed matches (helped someone)
- Requests fulfilled (asked and received)
- Response quality (ratings)
- Consistency over time

**How it decays**: 6-month half-life (recent activity matters)

**Why it matters**: Shows current engagement, not lifetime achievement

### Community Karma

**What we measure**:
- Total matches completed within community
- Match completion rate (% of requests fulfilled)
- Member retention (people stay because it works)
- Cross-community help (community members helping in other communities)

**How it decays**: Similar pattern - recent activity matters more than size

**Why it matters**: Shows if this community is actually functioning

### System-Level Karma (Future: Movement/Network)

**What we measure**:
- Total help flowing across all communities
- Community creation rate (are new communities forming?)
- Cross-community collaboration
- Real-world impact

**How it decays**: Slower decay (systemic change takes longer)

---

## Measuring Trust at Different Scales

### Individual Trust

**What we measure**:
- Social distance (degrees of separation)
- Direct interaction history
- Reliability in matches
- Referral quality (who you vouch for)

**Private or public**: **Private** - only you see your trust in someone

**Why it matters**: Personal safety and decision-making

### Community Trust

**What we measure**:
- Average trust distance members operate at (openness)
- Reciprocity index (% who both ask and offer)
- Conflict resolution success rate
- Referral chain quality (vouching works)

**Private or public**: **Public** - this is community health transparency

**Why it matters**: Prospective members assess if they'd fit

### System-Level Trust (Future)

**What we measure**:
- Cross-community trust paths
- Communities vouching for other communities
- Movement coherence (shared values despite diversity)

**Why it matters**: Building broader social fabric

---

## The Gamification Concern

### Your Insight

> "I have some issues with gamifying and showing stats, we have to think about it... it can be a private feature to encourage folks..."

**Critical distinction**: Metrics for ENCOURAGEMENT vs metrics for COMPETITION

### Private by Default

**Individual Karma & Trust** should be:
- **Private to you** - You see your own scores
- **Purpose**: Self-awareness, encouragement, personal growth
- **NOT**: Public leaderboard, competition, status hierarchy

**Exception**: You can choose to share (opt-in, not opt-out)

### Community Metrics: Transparent but Not Competitive

**Community Karma & Trust** should be:
- **Transparent** - Members see their own community's health
- **Purpose**: Collective awareness, course correction, celebration
- **NOT**: Community ranking, competition between communities

**Show**:
- ✅ "Your community completed 52 matches this month" (celebration)
- ✅ "89% completion rate" (health indicator)
- ✅ "Average trust: 3.2 degrees" (openness indicator)

**Don't show**:
- ❌ "Ranked #4 out of 50 communities" (creates competition)
- ❌ "Top contributors leaderboard" (creates hierarchy)
- ❌ "Beat your karma score from last month!" (gamifies)

### The Design Principle

**Measure to understand, not to judge.**
**Encourage growth, not competition.**
**Celebrate collective success, not individual status.**

---

## Revised Mental Model

### Users

```typescript
interface User {
  // Identity
  id: UUID;
  name: string;

  // Private self-awareness (only you see this)
  myKarma: {
    currentScore: number;
    recentHelps: number;
    recentRequests: number;
    trend: 'growing' | 'stable' | 'declining';
  };

  // Private relationship awareness
  myTrustIn: Map<User, TrustScore>; // Your trust in others

  // Public (opt-in sharing)
  publicProfile?: {
    totalMatches?: number;
    memberSince: Date;
    skills: string[];
  };
}
```

### Communities

```typescript
interface Community {
  // Identity
  id: UUID;
  name: string;

  // Public health metrics (transparent to members)
  healthMetrics: {
    karma: {
      matchesCompleted: number;
      completionRate: number;
      trend: 'growing' | 'stable' | 'declining';
    };
    trust: {
      reciprocityIndex: number; // % who both ask and offer
      averageTrustDistance: number; // How open members are
      conflictResolutionRate: number;
    };
  };

  // NOT included: rankings, comparisons to other communities
}
```

---

## Implementation Implications

### What We Build First (Simple Karma Measurement)

Per your guidance: "we can for now go with creating some ways to measure karma scores... but these look very primitive... but good start."

**Phase 1: Basic Private Karma (Minimal)**

1. **Calculate karma** (backend only, not displayed yet)
   - Track completed matches
   - Apply decay over time
   - Store per user, per community

2. **Private API endpoint** (user can request their own karma)
   - `GET /users/me/karma` (only returns YOUR karma)
   - No public access
   - No leaderboards

3. **Opt-in display** (user chooses to see it)
   - Settings toggle: "Show my karma score"
   - Default: OFF (don't show)
   - If enabled: small indicator on profile

**Why start here**:
- Builds the measurement infrastructure
- Doesn't force gamification on anyone
- Lets us learn if people find it useful
- Can expand later if it's helpful

### What We DON'T Build Yet

- ❌ Public karma displays
- ❌ Leaderboards
- ❌ Karma badges/levels
- ❌ Karma requirements (e.g., "must have 50 karma to...")
- ❌ Karma competitions

### Future Explorations (After Learning)

**Questions to answer first**:
1. Do people find private karma scores useful for self-awareness?
2. Does seeing your karma ENCOURAGE you to help more?
3. Does it feel gamified/pressuring even when private?
4. Would some people benefit from seeing it, others not?

**Then we can decide**:
- Should communities see aggregate karma? (probably yes)
- Should users see others' karma? (probably not)
- Should there be badges for milestones? (maybe, if not competitive)

---

## The Deeper Philosophy

### Why Fractals Matter

If communities are extensions of people, then:

1. **Consistent principles across scales**
   - What makes a good person makes a good community
   - Trust works the same way at every level
   - Contribution matters whether individual or collective

2. **Recursive health**
   - Healthy individuals → healthy communities
   - Healthy communities → healthy movements
   - Unhealthy at any level affects all levels

3. **No special rules for institutions**
   - Communities aren't separate entities with different logic
   - They're people cooperating, scaled up
   - They deserve the same dignity and assessment

### This Changes Our Design

**Before**: Users vs communities are different categories with different metrics

**After**: Users and communities are the same pattern at different scales

**Implications**:
- Use same terminology (karma, trust)
- Use similar measurement approaches
- Apply same ethical principles (privacy, encouragement, transparency)
- Think recursively (what works at one scale works at others)

---

## Open Questions

1. **Should communities have trust scores with each other?**
   - Can Portland Tools "trust" Seattle Makers?
   - What would that mean?
   - How would it be measured?

2. **Should there be meta-communities?**
   - "All tool-sharing communities"
   - Measured as aggregate?
   - Cross-community collaboration incentives?

3. **How do we connect users across communities via karma?**
   - Does helping in Portland increase your karma in Seattle?
   - Or is karma purely local to each community?
   - What's the right balance?

4. **Is there a global karma/trust?**
   - Your contribution to the entire Karmyq ecosystem?
   - Or is everything always scoped to a context?

5. **What about negative karma/trust?**
   - Do we track harm, not just help?
   - Or do we only measure positive contribution?
   - How do we handle bad actors without creating punishment systems?

---

## Next Steps

1. **Validate this mental model** - Does the fractal thinking resonate?
2. **Decide on scope** - Karma only, or karma + trust?
3. **Design minimal implementation** - Private karma calculation only?
4. **Define success criteria** - How do we know if it's helpful?
5. **Plan future research** - What do we need to learn from users?

---

## Related Documents

- [Trust and Reputation Framework](TRUST_AND_REPUTATION_FRAMEWORK.md) - Original thinking (needs revision)
- [Trust & Reputation Features Backlog](../backlog/TRUST_REPUTATION_FEATURES.md) - Implementation plan (needs revision)
- [ADR-011: Reputation Decay](../adr/ADR-011-reputation-decay.md) - Current karma system
- [ADR-020: Trust-First Design](../adr/ADR-020-trust-first-design.md) - Philosophy
- [Landing Page Vision](../backlog/LANDING_PAGE_VISION.md) - Communities as experiments

---

## Quotes to Remember

> "Communities are extensions of people. We are fractals."

> "I have some issues with gamifying and showing stats... it can be a private feature to encourage folks."

> "Measure to understand, not to judge. Encourage growth, not competition."
