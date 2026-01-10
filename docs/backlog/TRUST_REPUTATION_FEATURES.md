# Trust & Reputation Features Backlog

**Date Created**: 2026-01-09
**Last Updated**: 2026-01-09
**Status**: ⚠️ SUPERSEDED - See [Minimal Karma Measurement](MINIMAL_KARMA_MEASUREMENT.md) and [Fractal Karma & Trust](../concepts/FRACTAL_KARMA_TRUST.md)
**Related**:
- [Trust and Reputation Framework](../concepts/TRUST_AND_REPUTATION_FRAMEWORK.md) - Original thinking
- [Fractal Karma & Trust](../concepts/FRACTAL_KARMA_TRUST.md) - **CURRENT** thinking
- [Minimal Karma Measurement](MINIMAL_KARMA_MEASUREMENT.md) - **CURRENT** implementation plan
**Owner**: Product & Engineering Team

## ⚠️ Status: Under Revision

**This document represents initial thinking** but has been **superseded by a major conceptual shift**:

### Original Approach (This Document)
- Karma and Trust as separate systems
- Public karma displays and leaderboards
- Gamification elements
- Complex multi-phase rollout

### New Approach (See Updated Docs)
- **Fractal design**: Karma and Trust apply to both users AND communities
- **Private by default**: No public displays, no leaderboards
- **Encouragement over gamification**: Opt-in self-awareness, not competition
- **Minimal first**: Simple karma calculation, validate before expanding

**Please refer to**:
1. [Fractal Karma & Trust](../concepts/FRACTAL_KARMA_TRUST.md) - Updated philosophy
2. [Minimal Karma Measurement](MINIMAL_KARMA_MEASUREMENT.md) - Current implementation plan

---

## Original Content (For Reference)

**Key Architectural Principles**:
1. **Karma** = Individual contribution (temporal, public)
2. **Trust** = Relational connection (experiential, private)
3. **Community Health** = Aggregate interaction quality

---

## Epic 1: Trust Display on Requests/Offers 🎯

**Goal**: Help users assess risk by showing trust path, trust score, and reliability metrics on every request/offer card

**Priority**: P0 - High Priority
**Estimated Effort**: 8-12 hours
**Value**: Critical for user safety and decision-making

### User Stories

**Story 1.1**: Display Trust Path on Request Cards
- **As a** helper browsing requests
- **I want to** see how I'm connected to the requester
- **So that** I can assess my comfort level offering help

**Acceptance Criteria**:
- Trust path badge shows degree of separation (1-6°)
- Hover/tap shows full path (e.g., "You → Sarah → Maria")
- Path respects privacy settings (users can hide their name)
- Works on both web and mobile

**Story 1.2**: Display Personal Trust Score
- **As a** user viewing a request/offer
- **I want to** see MY trust level with this person
- **So that** I can make informed decisions about helping/accepting

**Acceptance Criteria**:
- Shows trust score (0-5 stars) based on:
  - Social distance (base trust from referral chain)
  - Direct interactions (if any)
  - Community reputation
- Only visible to logged-in user (private)
- Shows breakdown on hover/tap (e.g., "Based on 0 direct interactions, 2° connection")
- Placeholder message if no trust data yet

**Story 1.3**: Display Reliability Metrics
- **As a** user considering a match
- **I want to** see the other person's track record
- **So that** I know if they're reliable

**Acceptance Criteria**:
- Shows karma score (community contribution)
- Shows completion rate (% of matches completed)
- Shows average rating (if they have ratings)
- Shows member duration (e.g., "Member for 5 months")
- All metrics scoped to current community

### Technical Tasks

- [ ] Create `TrustScoreDisplay` component (web + mobile)
- [ ] Add trust path API endpoint to social-graph-service
- [ ] Add reliability stats API endpoint (aggregate karma, completion rate)
- [ ] Update `RequestCard` and `OfferCard` components to include trust info
- [ ] Add privacy controls (users can hide their metrics)
- [ ] Write component tests
- [ ] Add E2E test for trust display

### Design Mocks Needed

```
┌──────────────────────────────────┐
│ [Request Card]                   │
│                                  │
│ Need help moving couch           │
│ Saturday 2pm, 30 min             │
│ Maria Garcia                     │
│                                  │
│ ┌──────────────────────────────┐│
│ │ Trust Info                   ││
│ │ ─────────────────────────────││
│ │ 2° connection via Sarah      ││
│ │ ⭐⭐⭐⭐☆ Medium Trust        ││
│ │ (0 direct interactions)      ││
│ │                              ││
│ │ Community Standing           ││
│ │ • 150 karma (top 15%)        ││
│ │ • 92% completion rate        ││
│ │ • 4.6★ average rating        ││
│ │ • Member for 5 months        ││
│ └──────────────────────────────┘│
│                                  │
│ [Offer to Help] [Pass]           │
└──────────────────────────────────┘
```

### Files Affected

**Frontend**:
- `apps/frontend/src/components/TrustScoreDisplay.tsx` (new)
- `apps/frontend/src/components/RequestCard.tsx`
- `apps/frontend/src/components/OfferCard.tsx`
- `apps/mobile/src/components/TrustScoreDisplay.tsx` (new)
- `apps/mobile/src/components/RequestCard.tsx`

**Backend**:
- `services/social-graph-service/src/routes/trust-paths.ts` (enhance)
- `services/reputation-service/src/routes/reliability-stats.ts` (new)
- `services/feed-service/src/index.ts` (include trust data in feed)

**Database**: No schema changes needed (uses existing data)

---

## Epic 2: Trust Distance Karma Bonuses 🎯

**Goal**: Incentivize helping people outside your comfort zone by awarding bonus karma for distant connections

**Priority**: P0 - High Priority
**Estimated Effort**: 4-6 hours
**Value**: Encourages network expansion and helps new members

### User Stories

**Story 2.1**: Earn Bonus Karma for Distant Connections
- **As a** helper
- **I want to** earn more karma when I help someone far from my network
- **So that** I'm incentivized to trust strangers and expand the community

**Acceptance Criteria**:
- Karma calculation includes distance bonus:
  - 1° (direct): 0 bonus (10 karma total)
  - 2° (friend of friend): +2 bonus (12 karma total)
  - 3°: +4 bonus (14 karma total)
  - 4°: +6 bonus (16 karma total)
  - 5°: +8 bonus (18 karma total)
  - 6° (distant): +10 bonus (20 karma total - doubled!)
- Bonus shown in UI ("You earned +4 bonus karma for helping someone new!")
- Bonus stored separately in karma_records for analytics

**Story 2.2**: Display Distance Bonus on Match Completion
- **As a** user completing a match
- **I want to** see the bonus I earned
- **So that** I understand the incentive and feel rewarded

**Acceptance Criteria**:
- Match completion notification shows karma breakdown
- Example: "Match complete! Earned 10 karma + 4 distance bonus = 14 total"
- Bonus explanation on first time ("Helping distant connections earns bonus karma!")

### Technical Tasks

- [ ] Update karma calculation in reputation-service
- [ ] Add `distance_bonus` field to `karma_records` table
- [ ] Update match completion logic to calculate trust distance
- [ ] Update UI to display bonus on completion
- [ ] Add unit tests for karma bonus calculation
- [ ] Write integration test for end-to-end flow

### Database Changes

```sql
-- Add distance bonus tracking
ALTER TABLE reputation.karma_records
ADD COLUMN trust_distance INTEGER,
ADD COLUMN distance_bonus INTEGER DEFAULT 0;

-- Update to separate base karma from bonus
-- Example record:
-- points: 14 (total)
-- trust_distance: 3
-- distance_bonus: 4
-- base_karma: 10
```

### Files Affected

**Backend**:
- `services/reputation-service/src/services/karmaService.ts`
- `services/request-service/src/routes/matches.ts` (completion logic)
- `infrastructure/postgres/init.sql` (schema)

**Frontend**:
- `apps/frontend/src/components/MatchCompletionModal.tsx`
- `apps/mobile/src/screens/MatchCompletionScreen.tsx`

---

## Epic 3: Public vs Private User Profiles 📋

**Goal**: Allow users to control what information is public vs private

**Priority**: P1 - Medium Priority
**Estimated Effort**: 20-30 hours
**Value**: Safety, privacy, user control

### User Stories

**Story 3.1**: Configure Profile Privacy Settings
- **As a** user
- **I want to** control what's visible on my public profile
- **So that** I can maintain privacy while participating

**Acceptance Criteria**:
- Privacy settings page with toggles:
  - Profile visibility: Public / Members Only / Matches Only
  - Show referral chain: Yes / No
  - Show karma score: Yes / No
  - Show real name: Yes / No (use pseudonym)
  - Allow messages from: Anyone / Connections Only / Matches Only
- Settings saved per-user
- Default: Reasonably private (members only, show karma, real name, connections only)

**Story 3.2**: Public Profile View
- **As a** community member
- **I want to** see basic info about other members
- **So that** I can decide if I trust them

**Acceptance Criteria**:
- Public profile shows (respecting privacy settings):
  - Name or pseudonym
  - Karma score (if enabled)
  - Join date
  - Referral chain (if enabled)
  - Skills offered
  - Badges/prestige
  - Number of successful matches (not details)
- Does NOT show:
  - Contact info
  - Location details
  - Request/offer history
  - Ratings/reviews

**Story 3.3**: Private Profile View (After Match)
- **As a** user who matched with someone
- **I want to** see their full profile including contact info
- **So that** I can coordinate the help exchange

**Acceptance Criteria**:
- After matching, both parties see:
  - Contact info (email, phone if provided)
  - Specific location (for in-person help)
  - Relevant request/offer history
  - Detailed ratings from past matches
  - Personal bio/story
- Access revoked if match is cancelled/completed (configurable)

**Story 3.4**: Display Invite Paths on Public Profiles
- **As a** user viewing another member's profile
- **I want to** see who invited them and who they invited
- **So that** I can assess accountability and find mutual connections

**Acceptance Criteria**:
- Public profile shows (with privacy toggle):
  - "Invited by: [Name]" (if they enable sharing)
  - "Invited: [Name], [Name], [Name]" (people they brought in)
  - "2° connection to you via [Path]"
- Privacy: Can hide who invited you, can hide who you invited
- Links to click through to those profiles

### Technical Tasks

- [ ] Create privacy settings database table
- [ ] Add privacy settings API endpoints (GET/PATCH)
- [ ] Create privacy settings UI page
- [ ] Update profile API to respect privacy settings
- [ ] Split profile route into `/profile/public/:id` and `/profile/private/:id`
- [ ] Add middleware to check if private access allowed
- [ ] Update all profile displays to use appropriate view
- [ ] Add referral chain display to public profile
- [ ] Write tests for privacy enforcement

### Database Changes

```sql
CREATE TABLE auth.user_privacy_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  profile_visibility VARCHAR(50) DEFAULT 'members_only' CHECK (profile_visibility IN ('public', 'members_only', 'matches_only')),
  show_referral_chain BOOLEAN DEFAULT TRUE,
  show_karma_score BOOLEAN DEFAULT TRUE,
  show_real_name BOOLEAN DEFAULT TRUE,
  allow_messages_from VARCHAR(50) DEFAULT 'connections_only' CHECK (allow_messages_from IN ('anyone', 'connections_only', 'matches_only')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Files Affected

**Backend**:
- `services/auth-service/src/routes/privacy-settings.ts` (new)
- `services/auth-service/src/routes/users.ts` (update profile routes)
- `services/auth-service/src/middleware/profileAccess.ts` (new)
- `infrastructure/postgres/init.sql`

**Frontend**:
- `apps/frontend/src/pages/settings/privacy.tsx` (new)
- `apps/frontend/src/pages/profile/[id].tsx` (split into public/private)
- `apps/frontend/src/components/ReferralChainDisplay.tsx` (new)

---

## Epic 4: Trust Score Calculation & Storage 📋

**Goal**: Compute and store directional trust scores based on social distance and interaction history

**Priority**: P1 - Medium Priority
**Estimated Effort**: 30-40 hours
**Value**: Foundation for trust-based features

### User Stories

**Story 4.1**: Calculate Base Trust from Social Graph
- **As a** system
- **I want to** compute initial trust score based on social distance
- **So that** users have a starting point for assessing new connections

**Acceptance Criteria**:
- Trust score computation:
  - 1° (direct referral): 0.9 trust (very high)
  - 2°: 0.7 trust (high)
  - 3°: 0.5 trust (medium)
  - 4°: 0.3 trust (low)
  - 5°: 0.2 trust (very low)
  - 6°: 0.1 trust (minimal)
- Computed on-demand or cached
- Updated when referral paths change

**Story 4.2**: Update Trust Based on Interactions
- **As a** system
- **I want to** increase trust after successful interactions
- **So that** trust reflects real experience, not just social distance

**Acceptance Criteria**:
- After successful match completion:
  - Both parties' trust scores for each other increase by 0.1
  - After 5 successful interactions, trust caps at 1.0 (maximum)
- After negative interaction (low rating <3 stars):
  - Trust decreases by 0.2
  - Trust can drop below social distance baseline
- Trust updates are directional (A→B ≠ B→A)

**Story 4.3**: Display Trust Score to User (Private)
- **As a** user
- **I want to** see MY trust level with another person
- **So that** I can make informed decisions

**Acceptance Criteria**:
- Trust score shown on profile, request cards, offer cards
- Scale: 0-5 stars (0.0 = no trust, 5.0 = maximum trust)
- Breakdown shown: "Based on 3 direct interactions, 2° connection"
- Only visible to YOU (not public)

### Technical Tasks

- [ ] Create `social_graph.trust_scores` table
- [ ] Implement trust score calculation algorithm
- [ ] Add API endpoint: `GET /trust-scores/for-user/:userId`
- [ ] Create background job to update trust scores after matches
- [ ] Add trust score update logic to match completion
- [ ] Add trust score to feed API responses
- [ ] Write unit tests for trust calculation
- [ ] Write integration tests for trust updates

### Database Changes

```sql
CREATE TABLE social_graph.trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_user_id UUID NOT NULL REFERENCES auth.users(id),
  community_id UUID NOT NULL REFERENCES community.communities(id),

  -- Base trust (from social graph)
  social_distance INTEGER NOT NULL, -- 1-6 degrees
  base_trust DECIMAL(3,2) NOT NULL, -- 0.00-1.00

  -- Experiential trust (from interactions)
  direct_interactions INTEGER DEFAULT 0,
  successful_interactions INTEGER DEFAULT 0,
  negative_interactions INTEGER DEFAULT 0,
  experience_adjustment DECIMAL(3,2) DEFAULT 0.00, -- -1.00 to +1.00

  -- Computed score
  composite_trust_score DECIMAL(3,2) NOT NULL, -- 0.00-1.00 (base + experience)

  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_user_id, to_user_id, community_id),
  CHECK (base_trust BETWEEN 0.00 AND 1.00),
  CHECK (composite_trust_score BETWEEN 0.00 AND 1.00)
);

CREATE INDEX idx_trust_scores_from_user ON social_graph.trust_scores(from_user_id, community_id);
CREATE INDEX idx_trust_scores_to_user ON social_graph.trust_scores(to_user_id, community_id);
```

### Files Affected

**Backend**:
- `services/social-graph-service/src/services/trustScoreService.ts` (new)
- `services/social-graph-service/src/routes/trust-scores.ts` (new)
- `services/request-service/src/routes/matches.ts` (update on completion)
- `services/reputation-service/src/jobs/updateTrustScores.ts` (new - background job)
- `infrastructure/postgres/init.sql`

---

## Epic 5: Community Health Dashboard 📋

**Goal**: Display aggregate metrics showing community interaction quality

**Priority**: P2 - Low Priority
**Estimated Effort**: 15-20 hours
**Value**: Community transparency, admin insights

### User Stories

**Story 5.1**: View Community Health Metrics (Public)
- **As a** prospective member or current member
- **I want to** see how healthy/active a community is
- **So that** I know if it's worth joining/staying

**Acceptance Criteria**:
- Community page shows aggregate metrics:
  - Active members (posted/helped in last 30 days)
  - Requests posted this month
  - Matches made this month
  - Completion rate (% matches completed)
  - Average satisfaction (rating)
  - Reciprocity index (% who both ask and offer)
  - Average trust path filter (community openness)
  - Retention rate (% still active after 6 months)
- Metrics updated daily
- Historical trends shown (graph over time)

**Story 5.2**: Community Admin Dashboard
- **As a** community admin
- **I want to** see detailed health metrics
- **So that** I can improve community culture

**Acceptance Criteria**:
- Admin dashboard shows:
  - All public metrics (more detailed)
  - Karma distribution (concentrated or spread?)
  - Request category breakdown
  - Top contributors
  - New member integration rate
  - Conflict resolution stats
  - Trust expansion trends
- Export to CSV for analysis
- Recommendations for improvement

### Technical Tasks

- [ ] Create community health metrics calculation job
- [ ] Create `community.health_metrics` table
- [ ] Add metrics API endpoint
- [ ] Create community dashboard page
- [ ] Add charts/visualizations
- [ ] Create admin-only detailed dashboard
- [ ] Schedule daily metrics calculation
- [ ] Write tests

### Database Changes

```sql
CREATE TABLE community.health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES community.communities(id),
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL,

  UNIQUE(community_id, metric_name, calculated_at)
);

CREATE INDEX idx_health_metrics_community ON community.health_metrics(community_id, calculated_at DESC);
```

---

## Epic 6: Requester Karma (Controversial) 💭

**Goal**: Award karma for successfully requesting help (not just offering)

**Priority**: P3 - Future / Experimental
**Estimated Effort**: 6-8 hours
**Value**: Reduces stigma of asking, incentivizes good requests

### Open Questions

1. **Should we award karma for requesting?**
   - Pro: Encourages asking, reduces shame
   - Con: May incentivize fake requests
   - **Proposal**: Test in one community, gather feedback

2. **How much karma?**
   - Option A: Same as helper (10 karma)
   - Option B: Half (5 karma)
   - Option C: Small amount (2-3 karma)
   - **Proposal**: Start with 5 karma, adjust based on data

3. **What counts as "good request"?**
   - Must be completed (not abandoned)
   - Must rate helper positively (4+ stars)
   - Must mark complete within reasonable time
   - Must be clear, specific, respectful

### User Stories

**Story 6.1**: Earn Karma for Completing Request
- **As a** requester
- **I want to** earn karma when my request is successfully completed
- **So that** I'm recognized for asking well and closing the loop

**Acceptance Criteria**:
- Award +5 karma to requester when:
  - Match is marked complete
  - Helper rated 4+ stars
  - Completed within expiration period
- Shown in completion notification
- Counted separately in analytics

### Technical Tasks

- [ ] Update karma award logic in reputation-service
- [ ] Add requester karma to match completion flow
- [ ] Add feature flag (enable per-community)
- [ ] A/B test in 2-3 communities
- [ ] Gather feedback via survey
- [ ] Analyze: does it increase requests? fake requests?
- [ ] Decide: rollout or rollback

---

## Epic 7: Trust Bridge Badges (Prestige) 💭

**Goal**: Award badges for helping outside your trust network

**Priority**: P3 - Future
**Estimated Effort**: 12-16 hours
**Value**: Social recognition, gamification

### User Stories

**Story 7.1**: Earn "Trust Bridge" Badge
- **As a** helper
- **I want to** earn a badge for helping distant connections
- **So that** I'm recognized for being open and generous

**Acceptance Criteria**:
- Badge awarded for:
  - Helping 5+ people outside 3° network
  - OR helping 10+ people outside 2° network
- Displayed on profile
- Multiple tiers:
  - Bronze: 5 distant helps
  - Silver: 15 distant helps
  - Gold: 30 distant helps
- Part of larger prestige system (ADR-016)

**Story 7.2**: Display Badges on Profile
- **As a** user viewing a profile
- **I want to** see their badges
- **So that** I understand their contribution style

**Acceptance Criteria**:
- Badge collection visible on public profile
- Click badge for explanation
- Badges sorted by rarity/impressiveness

### Technical Tasks

- [ ] Implement prestige badge system (ADR-016)
- [ ] Define Trust Bridge badge criteria
- [ ] Create badge artwork
- [ ] Add badge award logic
- [ ] Display badges on profile
- [ ] Write tests

**Note**: Blocked on implementing full prestige system (ADR-016)

---

## Implementation Priorities Summary

### Phase 1: Quick Wins (Next 2 Sprints) 🎯
1. **Epic 1**: Trust Display on Request/Offer Cards (8-12h)
2. **Epic 2**: Trust Distance Karma Bonuses (4-6h)

**Total**: 12-18 hours
**Value**: Immediate user safety + network expansion incentive

### Phase 2: Medium Term (Next 4-6 Sprints) 📋
3. **Epic 3**: Public/Private Profiles (20-30h)
4. **Epic 4**: Trust Score Calculation (30-40h)
5. **Epic 5**: Community Health Dashboard (15-20h)

**Total**: 65-90 hours
**Value**: Complete trust system foundation

### Phase 3: Future / Experimental (v10.0+) 💭
6. **Epic 6**: Requester Karma (6-8h)
7. **Epic 7**: Trust Bridge Badges (12-16h)

**Total**: 18-24 hours
**Value**: Advanced gamification and cultural experimentation

---

## Success Metrics

### Epic 1 & 2 (Trust Display + Bonuses)
- **Adoption**: % of users who click on trust info
- **Safety**: Reduction in match abandonment rate
- **Network Expansion**: % increase in distant connection matches
- **Karma Growth**: Average karma earned per user (should increase with bonuses)

### Epic 3 (Privacy)
- **Usage**: % of users who customize privacy settings
- **Retention**: Do privacy controls increase user comfort/retention?
- **Safety Reports**: Reduction in privacy-related complaints

### Epic 4 (Trust Scores)
- **Accuracy**: Correlation between trust score and successful match outcome
- **Experience Adjustment**: How much does interaction history change base trust?
- **User Feedback**: Do users find trust scores helpful? (survey)

### Epic 5 (Community Health)
- **Transparency**: % of communities with healthy metrics (>80% completion rate)
- **Admin Engagement**: % of admins who use dashboard monthly
- **Community Growth**: Correlation between health metrics and member retention

### Epic 6 (Requester Karma)
- **A/B Test Results**: Does it increase requests? Quality of requests?
- **Gaming Detection**: Are users creating fake requests for karma?
- **Community Feedback**: Do communities like this feature?

---

## Related Documents

- [Trust and Reputation Framework](../concepts/TRUST_AND_REPUTATION_FRAMEWORK.md) - Conceptual foundation
- [ADR-011: Reputation Decay](../adr/ADR-011-reputation-decay.md) - Karma decay system
- [ADR-019: Referral Chain Trust](../adr/ADR-019-referral-chain-trust.md) - Referral system
- [ADR-020: Trust-First Design](../adr/ADR-020-trust-first-design.md) - Design philosophy
- [ADR-021: Trust Path Filtering](../adr/ADR-021-trust-path-filtering.md) - Feed filtering
- [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) - Overall roadmap

---

## Next Steps

1. **Review and prioritize** - Which epics for next sprint?
2. **Design mocks** - Trust display on request cards (need designer?)
3. **Technical spike** - Trust score calculation complexity
4. **Create tickets** - Break down Epic 1 & 2 into Jira/GitHub issues
5. **Landing page content** - Use framework to explain trust system
