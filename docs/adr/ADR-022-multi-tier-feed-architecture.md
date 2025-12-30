# ADR-022: Multi-Tier Feed Architecture (Explore-Exploit Balance)

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Product team, Engineering team
**Related**: ADR-003 (Multi-Tenant RLS), ADR-019 (Referral Chain Trust), ADR-021 (Trust Path Filtering)

## Context

Karmyq faces a fundamental tension between **community cohesion** (exploit) and **platform growth** (explore). Our current implementation (ADR-003) enforces strict community boundaries via Row-Level Security (RLS), which creates several problems:

### Current Problems

1. **Trust Paths Don't Work in Small Communities**
   - Communities with 10-50 people are fully connected (everyone knows everyone)
   - Trust path degrees (1-6) are meaningless when max separation is 1-2 degrees
   - ADR-021 (Trust Path Filtering) becomes pointless in small communities
   - Social graph features don't provide value until communities reach 150+ members

2. **Communities Can't Scale Beyond Dunbar's Number**
   - Strict RLS isolation means feeds only show "my community" requests
   - Once a community exceeds ~150 members, it becomes overwhelming
   - No mechanism for bridging across communities
   - Platform can't benefit from network effects

3. **Task Complexity Determines Optimal Scope**
   - **Simple, frequent tasks** (resume review, quick questions) benefit from wide reach
   - **Complex, infrequent tasks** (moving help, childcare) require high trust (community-bounded)
   - Current system forces all tasks into same visibility scope
   - No way to balance explore (growth) vs exploit (cohesion)

4. **Feed Scope vs Community Membership Are Conflated**
   - Current: Community membership = who you see in feed
   - Problem: Users may want to help beyond their community without joining it
   - Example: Expert in niche skill wants to help globally, but only belongs to local community

### The Explore-Exploit Trade-off

**Exploit (Community Cohesion):**
- High-trust, deep relationships
- Complex requests (moving help, long-term favors)
- Repeated interactions build reputation
- Strong sense of belonging
- **Risk**: Communities become insular, platform doesn't grow

**Explore (Platform Growth):**
- Low-friction, simple tasks
- Quick wins build confidence
- Viral spread ("I helped someone 3 degrees away!")
- Network effects
- **Risk**: Shallow connections, no community feeling

**Key Insight:** Task complexity should determine scope, not arbitrary user preferences.

## Decision

We will implement a **three-tier feed architecture** that balances community cohesion with platform growth, making the explore-exploit trade-off **tunable** at multiple levels.

### Three-Tier Feed System

#### Tier 1: My Communities (Exploit - High Trust)
```
Scope: Community members only
Use For: Complex, risky, time-intensive requests
Trust: Direct community membership
Examples: Moving help, childcare, lending tools, long-term mentorship
RLS Enforcement: Yes (maintains ADR-003 for sensitive data)
```

#### Tier 2: Trust Network (Balanced)
```
Scope: N-degree connections across communities
Use For: Medium complexity, skill-based requests
Trust: Social graph trust paths (ADR-019)
Examples: Career advice, skill swap, project collaboration
RLS Enforcement: Relaxed (reads span communities, writes stay in community)
```

#### Tier 3: Platform Network (Explore - Low Trust)
```
Scope: All users on platform (opt-in)
Use For: Simple, low-risk, high-frequency tasks
Trust: Platform reputation only (ADR-016)
Examples: Resume review, quick questions, digital tasks
RLS Enforcement: No (global visibility)
```

### Three Tuning Levers

#### Lever 1: Request Visibility Scope (Requester Choice)
When creating a request, requester chooses who can see it:

```typescript
interface RequestVisibility {
  scope: 'community' | 'trust_network' | 'platform';
  trust_degrees?: number; // 1-6, only if scope = 'trust_network'
}
```

**UI Guidance:**
- Community: Best for personal favors, time-intensive help
- Trust Network: Best for skill-based help (default for most requests)
- Platform: Best for quick questions, digital tasks

#### Lever 2: Feed Filter Preferences (Responder Choice)
Users configure what they see in their feed:

```typescript
interface FeedPreferences {
  community_requests: boolean;           // Always true (can't disable)
  trust_network_requests: boolean;       // Default: true
  trust_network_max_degrees: number;     // Default: 3 (1-6 range)
  platform_requests: boolean;            // Default: false (opt-in to explore)
  platform_request_categories: string[]; // Filter by category
}
```

**User Control:**
- "Always show my communities" (can't disable - ADR-003 integrity)
- "Show trust network up to N degrees" (configurable ceiling)
- "Opt-in to platform network" (exploration mode)
- "Filter platform by category" (e.g., only digital tasks)

#### Lever 3: Request Type Constraints (Platform Rules)
Certain request types have forced visibility rules for safety/trust:

```typescript
const REQUEST_TYPE_RULES = {
  'moving_help': {
    max_scope: 'community',
    reason: 'High trust required, physical safety'
  },
  'childcare': {
    max_scope: 'trust_network',
    max_degrees: 2,
    reason: 'Safety critical, background checks needed'
  },
  'resume_review': {
    min_scope: 'trust_network',
    reason: 'Better with wider pool, low risk'
  },
  'quick_question': {
    default_scope: 'platform',
    reason: 'Low friction, high volume, encourages exploration'
  }
}
```

### Feed Query Logic

```sql
WITH user_prefs AS (
  SELECT feed_show_trust_network, feed_trust_network_max_degrees,
         feed_show_platform, feed_platform_categories
  FROM auth.user_preferences
  WHERE user_id = $currentUser
),
user_communities AS (
  SELECT community_id
  FROM communities.members
  WHERE user_id = $currentUser
)
SELECT
  r.*,
  CASE
    WHEN r.community_id IN (SELECT community_id FROM user_communities)
      THEN 'community'
    WHEN tp.degrees <= LEAST(r.visibility_max_degrees, (SELECT feed_trust_network_max_degrees FROM user_prefs))
      THEN 'trust_network'
    ELSE 'platform'
  END as source_tier,
  tp.degrees as trust_distance,
  tp.path as trust_path_names
FROM requests.help_requests r
LEFT JOIN trust_paths tp ON tp.from_user = $currentUser AND tp.to_user = r.requester_id
WHERE
  r.status = 'open'
  AND (
    -- Tier 1: My communities (always shown)
    r.community_id IN (SELECT community_id FROM user_communities)

    OR

    -- Tier 2: Trust network (if enabled and within degrees)
    (r.visibility_scope IN ('trust_network', 'platform')
     AND (SELECT feed_show_trust_network FROM user_prefs) = true
     AND tp.degrees <= LEAST(r.visibility_max_degrees, (SELECT feed_trust_network_max_degrees FROM user_prefs)))

    OR

    -- Tier 3: Platform (if enabled and matches categories)
    (r.visibility_scope = 'platform'
     AND (SELECT feed_show_platform FROM user_prefs) = true
     AND r.category = ANY((SELECT feed_platform_categories FROM user_prefs)::text[]))
  )
ORDER BY
  CASE source_tier
    WHEN 'community' THEN 1      -- Community requests first
    WHEN 'trust_network' THEN 2  -- Trust network second
    WHEN 'platform' THEN 3       -- Platform last
  END,
  r.created_at DESC
LIMIT 50;
```

### Evolution of ADR-003 (Multi-Tenant RLS)

**ADR-003 Remains True For:**
- **Writes**: Requests/offers are still owned by a community
- **Sensitive Data**: User profiles, private messages, karma records
- **Community Management**: Membership, roles, settings

**ADR-003 Relaxed For:**
- **Feed Reads**: Can span communities via trust network
- **Trust Paths**: Computed globally across communities
- **Platform Requests**: Visible to all opted-in users

**Technical Implementation:**
```sql
-- RLS policies remain strict for writes
CREATE POLICY requests_insert ON requests.help_requests
  FOR INSERT WITH CHECK (
    community_id IN (SELECT community_id FROM communities.members WHERE user_id = current_user_id())
  );

-- RLS relaxed for reads (feed logic handles filtering)
CREATE POLICY requests_select ON requests.help_requests
  FOR SELECT USING (
    -- Community requests (RLS enforced)
    community_id IN (SELECT community_id FROM communities.members WHERE user_id = current_user_id())
    OR
    -- Trust network + platform requests (app-level filtering)
    visibility_scope IN ('trust_network', 'platform')
  );
```

## Consequences

### Positive Consequences

**Community Cohesion (Exploit):**
- Communities remain primary identity (ADR-003 integrity maintained)
- Complex, high-trust requests stay within community boundaries
- Strong sense of belonging through repeated local interactions
- Community admins can encourage/discourage platform participation

**Platform Growth (Explore):**
- Trust paths work globally (finally useful in small communities!)
- Simple tasks build confidence and viral spread
- Network effects: platform value scales with user count
- New users can contribute immediately (quick questions, digital tasks)

**User Agency:**
- **Requesters** choose visibility scope per request
- **Responders** choose what they see in feed
- **Platform** enforces safety constraints
- Granular control prevents overwhelming feeds

**Metrics-Driven Tuning:**
- Track explore/exploit ratio per user, community, platform
- Adjust defaults based on growth phase
- Identify healthy balance (60% community, 30% trust, 10% platform)
- Detect communities that are too insular or too open

**Trust Paths Finally Make Sense:**
- ADR-021 (Trust Path Filtering) becomes valuable
- Trust paths span communities ("You → Alice (Community A) → Bob (Community B)")
- Social graph features scale with platform, not just community size

### Negative Consequences

**Complexity:**
- Three-tier system is harder to explain than "just your community"
- Feed query is more complex (performance considerations)
- Users must understand visibility scopes
- More configuration options = potential confusion

**RLS Partial Relaxation:**
- Deviation from strict ADR-003 isolation
- Potential data leakage if feed query has bugs
- Trust path computation crosses community boundaries (privacy concern)
- Must carefully audit what data is exposed

**Potential for Exploitation:**
- Spammers might abuse platform tier
- Low-quality requests flood platform network
- Need robust reporting/moderation for platform tier
- Reputation gaming across communities

**Migration Complexity:**
- Existing requests default to 'community' scope (safe, but limits growth)
- Need to backfill trust paths globally (expensive computation)
- Users accustomed to community-only feeds may be confused
- Must communicate change clearly

### Neutral Consequences

**Feed Behavior Changes:**
- Users will see more requests (potentially overwhelming initially)
- Match rate may decrease (more competition) but match quality improves
- Geographic proximity less important (trust paths > location)

**Community Dynamics Shift:**
- Communities become "home base" not "walled gardens"
- Cross-community collaboration increases
- Community size may matter less (small communities viable long-term)

**Platform Culture:**
- Sets precedent: platform is about trust networks, not isolated communities
- Encourages helping strangers (if they're vouched for)
- May attract different user archetypes (open helpers vs. cautious helpers)

## Alternatives Considered

### Alternative 1: Keep Strict RLS (Status Quo - ADR-003)

**Description:**
- Maintain current architecture: communities are isolated silos
- Feed only shows requests from "my communities"
- No cross-community visibility

**Pros:**
- Simple to understand and implement
- Maximum privacy and data isolation
- Clear boundaries prevent spam/abuse
- Aligns with original ADR-003 design

**Cons:**
- Trust paths don't work in small communities (< 150 people)
- Platform can't scale beyond sum of isolated communities
- No network effects
- Forces all tasks into same visibility scope
- Communities can't bridge to each other

**Why Rejected:**
- Trust path features become useless in small communities
- Platform growth is artificially limited
- Doesn't balance explore/exploit trade-off

### Alternative 2: Global Feed (No Communities)

**Description:**
- Remove community boundaries entirely
- All requests visible to all users (with optional filters)
- Communities become tags, not isolation boundaries

**Pros:**
- Maximum reach and discoverability
- Trust paths work at any scale
- Simplest implementation (no RLS complexity)
- Network effects maximized

**Cons:**
- No sense of community or belonging
- High-trust requests (moving help, childcare) feel unsafe
- Feed overwhelm (thousands of requests)
- Loses core value proposition (trusted mutual aid)
- Violates ADR-003 and trust-first philosophy (ADR-020)

**Why Rejected:**
- Destroys community cohesion (too much explore, no exploit)
- Users won't trust platform for complex/risky requests
- Becomes generic marketplace, not mutual aid

### Alternative 3: Federated Communities

**Description:**
- Communities can "federate" with each other (admin decision)
- Feed shows: my communities + federated communities
- Trust paths span federated network
- Still RLS-isolated from non-federated communities

**Pros:**
- Balances isolation and scale
- Community admins control boundaries
- Natural clustering (e.g., geographic regions federate)
- Maintains ADR-003 for non-federated data

**Cons:**
- Complex implementation (federation protocol needed)
- Admin overhead (who to federate with?)
- Network effects limited to federation size
- Doesn't solve trust path problem in small federations
- Political issues (federation disputes, defederation drama)

**Why Rejected:**
- Too complex for MVP (might revisit post-launch)
- Doesn't solve core problem (small communities still isolated)
- Federation mechanics are orthogonal to explore/exploit balance
- Could layer on top of multi-tier architecture later

### Alternative 4: ML-Based Personalized Feeds

**Description:**
- Machine learning algorithm determines what each user sees
- Based on past behavior, time of day, request urgency, etc.
- No explicit user configuration

**Pros:**
- Maximally personalized experience
- No user configuration needed (just works)
- Could optimize for match quality
- Adapts to changing user behavior

**Cons:**
- Black box (users don't understand why they see what they see)
- Requires massive data set to train
- Privacy nightmare (extensive tracking needed)
- Removes user agency (violates ADR-020 trust-first philosophy)
- Expensive to build and maintain

**Why Rejected:**
- Violates trust-first philosophy (transparency > optimization)
- Too complex for current stage
- Privacy trade-offs unacceptable
- Users should control their own exposure

## Implementation Notes

### Phase 1: Database Schema (Immediate)

```sql
-- Add to auth.users table (origin tracking)
ALTER TABLE auth.users
ADD COLUMN origin_community_id UUID REFERENCES communities.communities(id);
-- The community user was first invited to (never changes)

ALTER TABLE auth.users
ADD COLUMN invited_at TIMESTAMPTZ;
-- When user first joined platform (distinct from community join dates)

-- Add to requests.help_requests table (visibility control)
ALTER TABLE requests.help_requests
ADD COLUMN visibility_scope VARCHAR(50) DEFAULT 'community'
  CHECK (visibility_scope IN ('community', 'trust_network', 'platform'));

ALTER TABLE requests.help_requests
ADD COLUMN visibility_max_degrees INTEGER DEFAULT 3
  CHECK (visibility_max_degrees BETWEEN 1 AND 6);

-- Add to auth.user_preferences table (feed filtering)
ALTER TABLE auth.user_preferences
ADD COLUMN feed_show_trust_network BOOLEAN DEFAULT true;

ALTER TABLE auth.user_preferences
ADD COLUMN feed_trust_network_max_degrees INTEGER DEFAULT 3
  CHECK (feed_trust_network_max_degrees BETWEEN 1 AND 6);

ALTER TABLE auth.user_preferences
ADD COLUMN feed_show_platform BOOLEAN DEFAULT false; -- Opt-in to explore

ALTER TABLE auth.user_preferences
ADD COLUMN feed_platform_categories JSONB DEFAULT '["digital", "questions"]'::jsonb;

-- Add to communities.communities table (per-community defaults)
ALTER TABLE communities.communities
ADD COLUMN default_request_scope VARCHAR(50) DEFAULT 'trust_network';

ALTER TABLE communities.communities
ADD COLUMN encourage_platform_participation BOOLEAN DEFAULT false;
```

### Phase 2: Feed Service Updates (Backlog)

**Files Affected:**
- `services/feed-service/src/index.ts` - Implement three-tier query logic
- `services/social-graph-service/src/services/pathComputation.ts` - Global trust paths
- `services/request-service/src/routes/requests.ts` - Add visibility_scope field
- `apps/frontend/src/components/CreateRequest.tsx` - Visibility scope selector
- `apps/frontend/src/pages/profile.tsx` - Feed preferences UI

**Migration Path:**
1. Add database columns with safe defaults (no breaking changes)
2. Backfill `origin_community_id` for existing users (first community joined)
3. Backfill `visibility_scope = 'community'` for existing requests (safe default)
4. Update Feed API to implement three-tier logic (backward compatible)
5. Add UI for visibility scope and feed preferences (opt-in feature discovery)
6. Announce feature to communities with recommended settings

**Rollback Strategy:**
- Set all `visibility_scope` to 'community' (reverts to ADR-003 behavior)
- Set all `feed_show_trust_network` to false
- Set all `feed_show_platform` to false
- Feature flag in Feed API to disable trust network and platform tiers

### Phase 3: Metrics & Tuning (Post-Launch)

```sql
CREATE TABLE platform.explore_exploit_metrics (
  date DATE,
  user_id UUID,
  community_id UUID,

  -- Feed composition
  community_requests_seen INTEGER,
  trust_network_requests_seen INTEGER,
  platform_requests_seen INTEGER,

  -- Match outcomes
  community_matches_completed INTEGER,
  trust_network_matches_completed INTEGER,
  platform_matches_completed INTEGER,

  -- Calculated ratios
  explore_ratio FLOAT, -- platform / (community + trust_network)

  PRIMARY KEY (date, user_id, community_id)
);
```

**Healthy Balance Indicators:**
- 60-70% of matches within communities (strong cohesion)
- 20-30% within trust network (building bridges)
- 10-20% platform-wide (exploration/growth)

**Tuning Levers:**
- Adjust default visibility scopes per request category
- Adjust default feed preferences for new users
- Per-community tuning (privacy-focused vs. growth-focused)
- A/B test different defaults

## References

- **Related ADR**: [ADR-003: Multi-Tenant RLS Database Design](ADR-003-multi-tenant-rls.md) - Evolved, not replaced
- **Related ADR**: [ADR-019: Referral Chain Trust System](ADR-019-referral-chain-trust.md) - Trust paths now global
- **Related ADR**: [ADR-020: Trust-First Design Philosophy](ADR-020-trust-first-design.md) - User agency maintained
- **Related ADR**: [ADR-021: Trust Path Filtering](ADR-021-trust-path-filtering.md) - Now makes sense at scale
- **Research**: [Dunbar's Number](https://en.wikipedia.org/wiki/Dunbar%27s_number) - 150-person limit on community size
- **Research**: [Explore-Exploit Trade-off](https://en.wikipedia.org/wiki/Multi-armed_bandit) - Balancing exploitation vs. exploration
- **Code**: Feed query logic in `services/feed-service/src/index.ts`
- **Code**: Trust path computation in `services/social-graph-service/src/services/pathComputation.ts`
