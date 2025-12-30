# ADR-021: Configurable Trust Path Filtering & Adaptive Trust Preferences

**Date**: 2025-01-01
**Status**: Accepted
**Deciders**: Product team, Engineering team
**Related**: ADR-019 (Referral Chain Trust System), ADR-020 (Trust-First Design Philosophy)

## Context

Karmyq's core value proposition is trust-based mutual aid through social graphs. As communities grow, users need control over how far out in their trust network they see requests and offers. Without filtering:

- **Feed Overwhelm**: Large communities create noise, making it hard to find relevant requests
- **Safety Concerns**: Users may not trust people 5-6 degrees away as much as direct connections
- **Discovery vs. Privacy Trade-off**: Need balance between helping strangers and personal comfort
- **One-Size-Fits-All Problem**: Some users are naturally more open, others more cautious

Current implementation shows trust paths on feed items but doesn't filter based on degree. Every user sees all requests regardless of connection distance.

### The "Dunbar Problem"
Research shows humans can maintain:
- ~5 close relationships (1st degree)
- ~15 good friends (2nd degree)
- ~50 friends (3rd degree)
- ~150 meaningful relationships (Dunbar's number)

Beyond 3 degrees, trust becomes theoretical rather than felt.

### User Archetypes
1. **Open Helpers**: Trust easily, want to see all requests (5-6 degrees)
2. **Selective Helpers**: Want to help but prefer closer connections (2-3 degrees)
3. **Cautious Helpers**: Only help people they know or are one step away (1-2 degrees)
4. **Adaptive Helpers**: Start cautious, expand with positive experiences

## Decision

We will implement **two-phased trust path filtering**:

### Phase 1: Static Configurable Filtering (Immediate)

**Community-Level Defaults:**
- Community admins set default trust path filter (1-6 degrees)
- Default for new communities: **3 degrees** (Dunbar sweet spot)
- Applies to all members unless overridden

**User-Level Preferences:**
- Users can override community default with personal preference
- Range: 1-6 degrees of separation
- Stored in user preferences table
- Synced across all user's communities

**Feed Filtering:**
- Feed API filters requests/offers by `trust_path.degrees <= user_preference`
- Trust path badge shows degree number (e.g., "2° connection")
- Clear UI indication of current filter setting

### Phase 2: Adaptive Trust Ladder (Future - Post-Launch)

**Behavioral Tracking:**
- Track interaction outcomes (matches completed successfully, abandoned, rated)
- Calculate "trust comfort score" based on history
- No PII or detailed negative interaction data stored

**Intelligent Nudging:**
- After **5 successful exchanges** at current level → nudge to expand by 1 degree
- After **2 negative experiences** → gentle suggestion to contract by 1 degree
- Nudges sent via notification service (max once per month)
- User can accept, dismiss, or opt-out entirely

**Nudge Copy Examples:**
- Expand: "You've had 5 great exchanges! Would you like to help people 3 degrees away? [Yes] [Not now]"
- Contract: "We noticed some recent challenges. Want to focus on closer connections for now? [Yes] [Keep current]"

**Privacy & Transparency:**
- Users can view their trust score breakdown
- Clear explanation of why nudge is happening
- Opt-out in preferences (no questions asked)

## Consequences

### Positive Consequences

**User Safety & Comfort:**
- Users control their exposure to distant connections
- Reduces anxiety about helping strangers
- Prevents spam/scam requests from reaching cautious users

**Feed Quality:**
- Less noise in large communities
- More relevant requests (closer connections)
- Higher match rate (people more likely to help those they "know")

**Community Scalability:**
- System can handle communities of 1,000+ members without overwhelming feeds
- Natural segmentation by trust distance

**Behavioral Growth:**
- Adaptive nudging teaches users to trust gradually
- Positive feedback loop: good experiences → expand network → more good experiences
- Data-driven rather than arbitrary

**Platform Differentiation:**
- No other mutual aid platform has trust-based filtering
- Aligns with "trust-first" philosophy (ADR-020)

### Negative Consequences

**Potential Silos:**
- Communities might fragment if everyone sets low trust filters
- New users (distant from most members) get less help initially

**Complexity:**
- Two preference layers (community + user) can confuse users
- Settings UI needs careful UX design

**Data Requirements (Phase 2):**
- Requires interaction outcome tracking
- Potential privacy concerns if not designed carefully

**Risk of Over-Optimization:**
- Adaptive nudging could feel manipulative if poorly implemented
- Users might game the system (fake positive reviews to expand reach)

### Neutral Consequences

**Changes Feed Behavior:**
- Some requests that were previously visible will be hidden
- May reduce total matches but increase match quality

**Sets Precedent:**
- Establishes pattern for other preference-based filtering (location, skills, etc.)

## Alternatives Considered

### Alternative 1: No Filtering (Status Quo)

**Description:**
- Show all requests regardless of trust path distance
- Rely on trust path badge to inform user decision

**Pros:**
- Simple to implement (already done)
- Maximum discoverability
- No risk of missing urgent requests

**Cons:**
- Feed overwhelm in large communities
- Users feel unsafe with distant connections
- No control over exposure

**Why Rejected:**
- Doesn't scale beyond ~100 member communities
- User research shows desire for control

### Alternative 2: Hard Cutoff at 3 Degrees (No Preferences)

**Description:**
- System-wide rule: only show requests up to 3 degrees
- No user or community configuration

**Pros:**
- Dead simple to implement
- Consistent behavior across platform
- Research-backed number (Dunbar)

**Cons:**
- One-size-fits-all doesn't fit user diversity
- No flexibility for small vs. large communities
- Blocks naturally open helpers

**Why Rejected:**
- Too rigid for diverse user base
- Doesn't allow for growth/learning

### Alternative 3: Machine Learning Based Filtering

**Description:**
- ML algorithm automatically determines what each user should see
- Based on past behavior, time of day, request urgency, etc.

**Pros:**
- Most personalized experience
- No user configuration needed (just works)
- Could optimize for match quality

**Cons:**
- Black box (users don't understand why they see what they see)
- Requires massive data set to train
- Privacy nightmare (extensive tracking needed)
- Removes user agency

**Why Rejected:**
- Violates trust-first philosophy (transparency > optimization)
- Too complex for current stage
- Privacy trade-offs unacceptable

### Alternative 4: Location-Based Filtering Only

**Description:**
- Filter by geographic proximity instead of trust path
- Assumption: nearby people are more helpful

**Pros:**
- Intuitive (help your neighbors)
- Easy to understand
- Aligns with mutual aid traditions

**Cons:**
- Misses remote help (skill-based, digital tasks)
- Doesn't address trust/safety concerns
- Urban density creates same overwhelm problem

**Why Rejected:**
- Geographic proximity ≠ trust
- Limits platform to local-only use cases

## Implementation Notes

### Phase 1: Static Filtering (4-6 hours)

**Database Changes:**
```sql
-- Community default setting
ALTER TABLE community.communities
ADD COLUMN default_trust_path_filter INTEGER DEFAULT 3 CHECK (default_trust_path_filter BETWEEN 1 AND 6);

-- User preference override
ALTER TABLE auth.user_preferences
ADD COLUMN trust_path_filter_preference INTEGER CHECK (trust_path_filter_preference BETWEEN 1 AND 6);
-- NULL means use community default
```

**Files Affected:**
- `services/community-service/src/routes/communities.ts` - GET/PATCH settings endpoint
- `services/feed-service/src/index.ts` - Add filter to feed query
- `apps/frontend/src/pages/profile.tsx` - User preference UI
- `apps/frontend/src/pages/communities/[id]/settings.tsx` - Community admin UI
- `apps/frontend/src/components/TrustPathBadge.tsx` - Show degree number

**API Changes:**
```typescript
// GET /feed/requests?trust_filter=true (default: true)
// Respects user preference, falls back to community default

// GET /communities/:id/settings
// Returns { default_trust_path_filter: 3, ... }

// PATCH /communities/:id/settings (admin only)
// { default_trust_path_filter: 4 }

// GET /users/me/preferences
// Returns { trust_path_filter_preference: 2, ... }

// PATCH /users/me/preferences
// { trust_path_filter_preference: 5 }
```

**Migration Path:**
1. Add database columns with defaults (no breaking changes)
2. Update Feed API to respect filter (backward compatible - defaults to 6)
3. Add UI for preferences (opt-in feature discovery)
4. Announce feature to communities with recommended settings

**Rollback Strategy:**
- Set all `default_trust_path_filter` to 6 (show all)
- Set all user preferences to NULL (use community default)
- Feature flag in Feed API to disable filtering

### Phase 2: Adaptive Nudging (12-20 hours)

**Database Changes:**
```sql
-- Track interaction outcomes
CREATE TABLE reputation.interaction_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  community_id UUID REFERENCES community.communities(id),
  match_id UUID REFERENCES requests.matches(id),
  outcome VARCHAR(50) CHECK (outcome IN ('completed', 'abandoned', 'rated_positive', 'rated_negative')),
  trust_path_degree INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trust comfort score
ALTER TABLE auth.users
ADD COLUMN trust_comfort_score JSONB DEFAULT '{"current_level": 3, "successful_exchanges": 0, "negative_exchanges": 0, "last_nudge_at": null}'::jsonb;
```

**Files Affected:**
- `services/reputation-service/src/jobs/calculateTrustComfort.ts` - Background job
- `services/notification-service/src/templates/trust-nudge.ts` - Notification templates
- `services/request-service/src/routes/matches.ts` - Track outcomes on completion

**Nudge Triggers:**
- Daily cron job calculates trust comfort scores
- Queues nudge notifications for eligible users
- Notification service delivers via preferences (email/push/in-app)

**A/B Testing:**
- 50% of users get nudges, 50% control group
- Measure: nudge acceptance rate, average trust level over time, match completion rate

**Privacy Compliance:**
- No detailed interaction data (just counts)
- Users can request deletion of their trust score data
- Transparent in privacy policy

## References

- **Research**: [Dunbar's Number](https://en.wikipedia.org/wiki/Dunbar%27s_number)
- **Research**: [Six Degrees of Separation](https://en.wikipedia.org/wiki/Six_degrees_of_separation)
- **UX Pattern**: [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- **Related ADR**: [ADR-019: Referral Chain Trust System](ADR-019-referral-chain-trust.md)
- **Related ADR**: [ADR-020: Trust-First Design Philosophy](ADR-020-trust-first-design.md)
- **Code**: Trust path computation in `services/social-graph-service/src/services/pathComputation.ts`
- **UI**: Trust path badge in `apps/frontend/src/components/TrustPathBadge.tsx`
