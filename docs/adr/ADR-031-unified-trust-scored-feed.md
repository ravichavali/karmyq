# ADR-031: Unified Trust-Scored Feed & Community Specialization

**Status**: Accepted
**Date**: 2026-02-12
**Context**: Request Service, Reputation Service, Community Service, Social Graph Service, Feed Service
**Impact**: Critical — Connects trust, karma, skills, and community configuration into a cohesive user experience
**Related**: ADR-011 (Reputation Decay), ADR-019 (Referral Chain Trust), ADR-020 (Trust-First Design), ADR-021 (Trust Path Filtering), ADR-022 (Multi-Tier Feed), ADR-030 (Community Configuration)

---

## Context

Karmyq v9.0 shipped a polymorphic request system, curated feed with match scoring, community configuration, and trust path computation. These subsystems work individually but are **not connected** — the feed doesn't consider trust distance, community configs don't influence scoring, and karma is awarded in a single community even when requests span multiple communities.

### Gap Analysis: Vision vs. Implementation

| System | What's Built | What's Missing |
|--------|-------------|----------------|
| **Skills** | `auth.user_skills` table, CRUD in auth-service, `ServiceMatcher` uses skills at 50% weight | Hardcoded skill→category mappings; community can't define "needed skills" |
| **Curated Feed** | `/requests/curated` with multi-factor scoring, type preferences | No trust distance factor, no community config influence on scoring |
| **Trust Paths** | BFS computation (social-graph-service), `TrustPathBadge.tsx` display | Display only — not used as feed ranking signal |
| **Community Configs** | Full CRUD + templates + public browsing (ADR-030 Phase 1) | **Not consumed by any algorithm** — stored but ignored |
| **Karma** | Per-community karma with 6-month decay (ADR-011), milestone bonuses | Single community per match; cross-community requests don't propagate |
| **Trust Scores** | `reputation.trust_scores` per user per community, feedback integration | Not shown on requests/offers in feed |
| **Multi-Tier Feed** | ADR-022 accepted | **Zero implementation** — no `visibility_scope`, no tier filtering |
| **Feed Service** | Social activity feed (milestones, stories, health) | Separate from curated request feed; no integration point |

### The Core Problem

A user joins Karmyq, joins a community, adds their skills, and sees a curated feed. But:

1. The feed doesn't know **how trusted** the requester is (trust path not factored in)
2. The community's **specialization** (service-focused? ride-focused?) doesn't affect what appears
3. Karma and trust scores are **invisible** on requests and offers — no way to gauge reliability
4. When they help someone via a cross-community request, karma only goes to **one** community
5. There's no path from "community member" to "trusted platform contributor" (multi-tier feed unbuilt)

These are not independent features — they form a single coherent system that this ADR defines.

---

## Decision

### 1. End-to-End User Journey

The system should support this progression:

```
JOIN              CONTRIBUTE           EARN              EXPAND
 │                  │                   │                  │
 ▼                  ▼                   ▼                  ▼
Join community → Set skills →     See curated     → Offer help →
                                  feed ranked by     Earn karma in
                                  skills + trust     shared communities
                                  + community config
                                       │
                                       ▼
                                  Trust score grows →  Feed expands
                                  Karma visible on     to trust network
                                  your offers           (ADR-022 Tier 2)
                                       │
                                       ▼
                                  High trust + karma → Platform-wide
                                  Badges on profile    visibility
                                  Community endorsement (ADR-022 Tier 3)
```

Each step is enabled by connecting existing subsystems that currently operate in isolation.

### 2. Community Specialization → Feed Scoring

Community configs (ADR-030) define values that MUST influence how requests are scored in the curated feed.

**Config fields that affect scoring:**

```typescript
// From communities.community_configs (ADR-030) — existing fields
{
  enabled_request_types: ['service', 'borrow'],  // Filter: only show these types
  trust_depth_weight: 0.7,   // How much trust path depth matters (vs breadth)
  trust_breadth_weight: 0.3, // How much number of connections matters
  karma_split_helper: 70,    // Helper gets 70% of karma points
  karma_split_requestor: 30, // Requester gets 30%
}

// New fields: feed scoring weights (must sum to 1.0)
{
  feed_weight_skill_match: 0.40,          // How much skills matter in feed ranking
  feed_weight_trust_distance: 0.30,       // How much trust proximity matters
  feed_weight_community_relevance: 0.20,  // How much request-type fit matters
  feed_weight_urgency: 0.10,              // How much urgency matters
}
```

**Why configurable weights?** Different communities have different values:
- A **professional services** community sets `skill_match: 0.60, trust: 0.15` — skills matter most
- A **tight-knit neighborhood** sets `trust: 0.50, skill: 0.15` — trust matters most
- A **disaster relief** community sets `urgency: 0.40, skill: 0.30` — urgency-first

Config templates (ADR-030) include preset weight profiles for common community types.

**Platform defaults** (used when community has no config): `skill: 0.40, trust: 0.30, relevance: 0.20, urgency: 0.10`

**How configs influence the curated feed:**

The `/requests/curated` endpoint currently scores by skills + request type preferences. We add two new scoring factors and make the weights community-configurable:

```
Final Score = (skill_match × W_skill) + (trust_distance × W_trust) + (community_relevance × W_relevance) + (urgency × W_urgency)
```

Where W_* values come from the request's community config (or platform defaults), and:
- **skill_match** (existing): `calculateMatchScore()` from `@karmyq/shared/matching`
- **trust_distance** (new): Based on social graph degrees of separation (see §3)
- **community_relevance** (new): Boost if request type matches community's `enabled_request_types`
- **urgency** (existing): From `applyUrgencyBonus()`

**Community relevance scoring:**

```typescript
function scoreCommunityRelevance(
  requestType: string,
  communityConfig: CommunityConfig
): number {
  // If community has enabled_request_types configured
  if (communityConfig.enabled_request_types?.length > 0) {
    // Full score if request type is in community's specialization
    if (communityConfig.enabled_request_types.includes(requestType)) {
      return 100;
    }
    // Reduced score if not specialized (still visible, just ranked lower)
    return 40;
  }
  // No config = neutral (all types equal)
  return 70;
}
```

**Implementation**: The curated feed endpoint (`services/request-service/src/routes/requests.ts:193-321`) needs to:
1. Fetch community config for each request's `community_id`
2. Pass config to a new `scoreCommunityRelevance()` function
3. Combine with existing skill match score

### 3. Trust Distance as Feed Ranking Signal

Trust paths computed by social-graph-service should directly influence feed ranking.

**Scoring by trust distance:**

| Degrees of Separation | Trust Score | Label |
|----------------------|-------------|-------|
| 1 (direct connection) | 100 | "Direct connection" |
| 2 | 75 | "Friend of a friend" |
| 3 | 50 | "3rd degree" |
| 4+ or no path | 20 | "Community member" |

**Implementation**: The curated feed endpoint needs to:
1. For each request in results, call social-graph-service to get trust distance to requester
2. Convert degrees to a 0-100 score using the table above
3. Weight using the community's `feed_weight_trust_distance` config (default: 0.30)

**Performance consideration**: Batch trust path lookups. Add a new endpoint to social-graph-service:
```
POST /social-graph/trust-distances/batch
Body: { from_user_id: string, to_user_ids: string[] }
Response: { distances: { [user_id: string]: { degrees: number, path: string[], score: number } } }
```

This avoids N+1 API calls for N feed items.

### 4. Trust & Karma Visibility on Feed Items

Currently trust badges (`TrustPathBadge.tsx`) only show on user profiles. They need to appear on every request and offer in the feed.

**What to show on each feed item:**

```
┌─────────────────────────────────────────────┐
│ 🔧 Need help with plumbing repair           │
│ Posted by Alice · Karmyq Helpers             │
│                                              │
│ 🔗 Direct connection · ⭐ 85 karma · Trust: 92│
│ ──────────────────────────────────────────── │
│ Skills match: plumbing (95%)                 │
│ [Offer Help]                                 │
└─────────────────────────────────────────────┘
```

**Data required per feed item:**
- `trust_degrees`: From social-graph-service batch lookup
- `trust_path`: Names of intermediaries (for tooltip)
- `requester_karma`: From reputation-service (`getUserKarmaWithDecay`)
- `requester_trust_score`: From `reputation.trust_scores`

**On offers (when someone offers to help your request):**

```
┌─────────────────────────────────────────────┐
│ Bob offered to help                          │
│ 🤝 2° connection (via Charlie)              │
│ ⭐ 120 karma · Trust: 88 · 15 helps given   │
│ [Accept] [Message]                           │
└─────────────────────────────────────────────┘
```

**Implementation**:
- Curated feed endpoint enriches each result with trust/karma data
- Frontend `FeedItem.tsx` renders `TrustPathBadge` (already imported)
- Frontend adds karma display component (new, simple)

### 5. Cross-Community Karma (Shared Community Model)

**Current behavior**: A single request links to multiple communities via the `requests.request_communities` junction table. When a match completes, karma is awarded in only ONE community (and the query was broken — `help_requests` has no `community_id` column).

**New behavior**: When a match completes:

1. **Find shared communities**: Intersect `request_communities` (communities the request was posted to) with communities where BOTH requester and helper are active members
2. **Cap at 3 communities**: Prioritize by helper's existing karma (rewards continued participation)
3. **Award karma in each**: Using that community's configured `karma_split_helper` / `karma_split_requestor` ratios from `community_configs`
4. **Update trust scores**: In each shared community
5. **Update social graph**: Person-to-person trust path (community-independent)

**No duplicate cleanup needed**: The schema uses a junction table (`request_communities`) — there's ONE request row linked to N communities, not N duplicate requests. The match completion already sets the single request to `'completed'`.

**Implementation in `karmaService.ts`:**

```typescript
// Find communities where request was posted AND both users are members (capped at 3)
async function getSharedRequestCommunities(request_id, requester_id, responder_id) {
  return query(`
    SELECT rc.community_id
    FROM requests.request_communities rc
    JOIN communities.members cm1 ON rc.community_id = cm1.community_id
      AND cm1.user_id = $2 AND cm1.status = 'active'
    JOIN communities.members cm2 ON rc.community_id = cm2.community_id
      AND cm2.user_id = $3 AND cm2.status = 'active'
    LEFT JOIN (
      SELECT community_id, SUM(points) as total_karma
      FROM reputation.karma_records WHERE user_id = $3
      GROUP BY community_id
    ) kr ON kr.community_id = rc.community_id
    WHERE rc.request_id = $1
    ORDER BY COALESCE(kr.total_karma, 0) DESC
    LIMIT 3
  `, [request_id, requester_id, responder_id]);
}

// For each shared community, fetch config and award karma with community-specific splits
for (const community_id of sharedCommunities) {
  const config = await getCommunityKarmaConfig(community_id);
  const helperKarma = Math.round(DEFAULTS.HELP_PROVIDED * (config.karma_split_helper / 100));
  const requesterKarma = Math.round(DEFAULTS.HELP_RECEIVED * (config.karma_split_requestor / 100));
  // ... award, milestones, trust scores, activity tracking
}
```

### 6. Skills Enhancement: Community Skill Demand

The current skill system works (auth.user_skills → ServiceMatcher at 50% weight). Enhancement: communities can signal which skills they need most.

**Community skill demand** (stored in community config):

```sql
-- New column in communities.community_configs
ALTER TABLE communities.community_configs
ADD COLUMN skill_demand JSONB DEFAULT '[]'::jsonb;
-- Example: [{"skill": "plumbing", "demand": "high"}, {"skill": "tutoring", "demand": "medium"}]
```

**Feed scoring boost**: When a user has a skill that matches a community's high-demand skill, their offers on requests in that community get a bonus:

```typescript
function applySkillDemandBonus(
  userSkills: string[],
  communitySkillDemand: SkillDemand[]
): number {
  let bonus = 0;
  for (const demand of communitySkillDemand) {
    if (userSkills.includes(demand.skill)) {
      bonus += demand.demand === 'high' ? 15 : demand.demand === 'medium' ? 8 : 3;
    }
  }
  return Math.min(bonus, 25); // Cap at 25 bonus points
}
```

This is additive to the existing skill match score, not a replacement.

### 7. Three-Tier Visibility (ADR-022 Implementation Path)

ADR-022 defines three tiers: community, trust network, platform. This ADR does NOT change that design but defines the implementation sequence.

**Key insight**: We can deliver 80% of the value by just adding trust distance scoring to the existing community-scoped feed (Phases 1-3 below). Full multi-tier visibility (Phase 4) is a larger effort that requires `visibility_scope` on requests and RLS policy changes.

**What changes for ADR-022**:
- Phase 4 of this ADR implements the database schema changes from ADR-022
- The trust distance scoring (Phase 3) naturally extends to trust network tier
- Community configs gain a `default_request_scope` field (already in ADR-022 schema)

---

## Phased Implementation

### Phase 1: Cross-Community Karma

**Goal**: Fix karma distribution for `post_to_all_communities` requests. Use community config karma splits.

**Key insight**: The schema already supports multi-community requests via `requests.request_communities` junction table (ONE request → N communities). No duplicate cleanup needed.

**Files**:
| File | Change |
|------|--------|
| `services/reputation-service/src/services/karmaService.ts` | Find shared communities via junction table, loop karma award with per-community config splits, cap at 3 communities |
| `services/reputation-service/src/events/subscriber.ts` | No change (already receives match_completed) |

**Verification**: Complete a match on a cross-community request. Check `reputation.karma_records` — should have entries in all shared communities with community-specific karma amounts.

### Phase 2: Community Config → Feed Scoring ✅ IMPLEMENTED

**Goal**: Community specialization affects which requests rank higher. Feed scoring weights are community-configurable.

**Status**: Complete. Curated feed now uses `calculateFeedScore()` with community-configurable weights. Default weights: skill=0.40, trust=0.25, community_relevance=0.20, urgency=0.15.

**Files Changed**:
| File | Change |
|------|--------|
| `infrastructure/postgres/migrations/013_feed_scoring_weights.sql` | Migration: adds `feed_weight_*` columns to `community_configs` with sum-to-1.0 constraint |
| `infrastructure/postgres/init.sql` | Added feed weight columns + constraint + updated seed templates |
| `packages/shared/src/matching/types.ts` | Added `FeedScoringWeights`, `FeedScoreInput`, `FeedScoreResult` interfaces |
| `packages/shared/src/matching/utils.ts` | Added `calculateFeedScore()`, `scoreUrgency()`, `scoreCommunityRelevance()`, `DEFAULT_FEED_WEIGHTS` |
| `services/request-service/src/routes/requests.ts` | Curated feed fetches community configs, calculates weighted `feedScore` per request |
| `services/community-service/src/services/config-validator.ts` | Added feed weight validation (0-1 range, sum-to-1.0 check) |
| `services/community-service/src/routes/config.ts` | GET/PUT config endpoints now include feed weight columns |

**Scoring Formula**:
```
feedScore = skillMatch × W_skill + trustDistance × W_trust + communityRelevance × W_community + urgency × W_urgency
```
Where `W_*` come from `communities.community_configs`. Trust distance uses neutral placeholder (50) until Phase 3.

**Template Presets**:
- Cohousing Default: skill=0.40, trust=0.25, relevance=0.20, urgency=0.15
- Neighborhood Cautious: skill=0.30, trust=0.35, relevance=0.20, urgency=0.15 (trust-building focus)
- Experimental Reciprocal: skill=0.35, trust=0.20, relevance=0.30, urgency=0.15 (community-focused)

**Tests**: 19 unit tests (shared/matching), 8 regression tests (config-validator), all passing.

**Verification**: Create two communities — one with `enabled_request_types: ['service']` and `feed_weight_skill_match: 0.60`, one generic with defaults. Post a service request. The specialized community should rank it higher. Adjust weights via config UI and verify scoring changes.

### Phase 3: Trust Distance in Feed + Trust/Karma Display ✅ IMPLEMENTED (Backend)

**Goal**: Feed ranking considers trust, and users see trust/karma on every feed item.

**Status**: Backend complete. Curated feed now uses real trust distance from `auth.social_distances` cache and includes requester karma + trust score in the response. Frontend components (badges on feed items) deferred to separate frontend task.

**Approach**: Instead of HTTP calls between services, the curated feed queries `auth.social_distances`, `reputation.karma_records`, and `reputation.trust_scores` directly (shared DB). Two batch queries fetch data for all requesters in one round-trip each.

**Trust Distance → Score Conversion**:
- 1 degree (direct connection): 100
- 2 degrees: 75
- 3 degrees: 50
- 4 degrees: 25
- null/unconnected: 10

**Files Changed**:
| File | Change |
|------|--------|
| `packages/shared/src/matching/utils.ts` | Added `scoreTrustDistance(degrees)` function |
| `services/request-service/src/routes/requests.ts` | Batch trust distance query + batch karma/trust query, real trust distance in scoring, `trustDegrees`, `requesterKarma`, `requesterTrustScore` in response |
| `packages/shared/src/matching/__tests__/feedScoring.test.ts` | 8 new tests for `scoreTrustDistance` + integration test |

**New Response Fields on Each Feed Item**:
```json
{
  "trustDegrees": 2,           // null if unconnected
  "requesterKarma": 145,       // total karma across communities
  "requesterTrustScore": 85,   // best trust score across shared communities
  "feedBreakdown": {
    "trustDistance": { "raw": 75, "weighted": 18.75 }
  }
}
```

**Tests**: 27 unit tests (shared/matching), all passing. 72 total shared package tests, 65 request-service tests.

**Frontend TODO** (separate task): Create `KarmaBadge` component, render `TrustPathBadge` + karma on `FeedItem.tsx` and `OfferItem.tsx`.

**Verification**: Browse curated feed. Each item should include trust degree, karma, and trust score in the API response. Items from closer connections should rank higher (all else equal).

### Phase 4: Multi-Tier Visibility (ADR-022) ✅ IMPLEMENTED (Backend)

**Goal**: Requests can be scoped to community, trust network, or platform.

**Status**: Backend complete. Requests now have a `visibility_scope` column. Curated feed performs three-tier filtering with user-configurable feed preferences. Communities can set a default visibility scope for new requests. Frontend UI (visibility selector, feed preferences page) deferred to separate frontend task.

**Three Tiers**:
- **Community** (default): Only visible to members of the request's communities. Same as pre-ADR-022 behavior.
- **Trust Network**: Visible to N-degree trust connections beyond own communities. Gated by both request's `visibility_max_degrees` and user's `feed_trust_network_max_degrees` preference (uses the stricter of the two).
- **Platform**: Visible to all users who opt in via `feed_show_platform` preference.

**Tier Resolution Logic** (`resolveSourceTier()`):
1. If user is in request's community → `community` (always, highest priority)
2. Else if request scope is `trust_network`/`platform` + user has trust path within degrees + user has trust_network enabled → `trust_network`
3. Else if request scope is `platform` + user has platform enabled → `platform`
4. Else → filtered out

**Files Changed**:
| File | Change |
|------|--------|
| `infrastructure/postgres/migrations/014_multi_tier_visibility.sql` | Migration: adds `visibility_scope` enum + columns to `help_requests`, `auth.user_feed_preferences` table, `default_request_scope` on `communities.communities` |
| `infrastructure/postgres/init.sql` | Added `visibility_scope_enum`, `visibility_scope`/`visibility_max_degrees` columns on `help_requests`, `user_feed_preferences` table, `default_request_scope` on `communities`, visibility index |
| `packages/shared/src/matching/types.ts` | Added `VisibilityScope`, `UserFeedPreferences`, `TierResolutionInput` types |
| `packages/shared/src/matching/utils.ts` | Added `resolveSourceTier()`, `DEFAULT_FEED_PREFERENCES`, `VALID_VISIBILITY_SCOPES` |
| `services/request-service/src/routes/requests.ts` | Request creation stores `visibility_scope`/`visibility_max_degrees`, curated feed does multi-tier query + tier-based filtering/sorting, response includes `sourceTier` and tier counts |
| `services/auth-service/src/routes/preferences.ts` | Added `GET /preferences/feed` and `PUT /preferences/feed` endpoints for feed visibility preferences |
| `packages/shared/src/matching/__tests__/feedScoring.test.ts` | 14 new tests for `resolveSourceTier` + constants |

**New API Response Fields on Curated Feed**:
```json
{
  "sourceTier": "community",
  "visibility_scope": "trust_network",
  "visibility_max_degrees": 3,
  "tiers": { "community": 12, "trust_network": 5, "platform": 2 },
  "feedPreferences": {
    "showTrustNetwork": true,
    "trustNetworkMaxDegrees": 3,
    "showPlatform": false
  }
}
```

**New Endpoints**:
- `GET /preferences/feed` — Read user's feed visibility preferences
- `PUT /preferences/feed` — Update feed preferences (trust_network toggle, max_degrees, platform opt-in)

**Tests**: 86 shared package tests (14 new for tier resolution), 148 request-service tests, 51 community-service tests — all passing.

**Frontend TODO** (separate task): Visibility scope selector on CreateRequest form, feed preferences panel on profile/settings page, tier badges on feed items.

**Verification**: Create request with `visibility_scope: 'trust_network'`. Verify it appears for users within N degrees but not for unconnected users. Create platform-scoped request, verify it appears for opt-in users.

---

## Consequences

### Positive

- **Cohesive experience**: Trust, karma, skills, and community config stop being isolated features and form a unified system
- **Community sovereignty** (ADR-030 fulfilled): Community configs actually influence scoring — communities can specialize and see results
- **Trust-first philosophy** (ADR-020 fulfilled): Trust distance directly affects what users see, making the system transparent about why items appear
- **Fair cross-community karma**: Users who help across communities are rewarded in all relevant contexts
- **Duplicate request cleanup**: Cross-community requests no longer leave orphaned open copies
- **Gradual rollout**: Phases 1-3 deliver most of the value within existing architecture; Phase 4 is a bigger lift but optional for MVP

### Negative

- **Feed latency**: Adding trust distance lookups and community config fetches increases curated feed response time. Batch APIs and caching mitigate this.
- **Scoring complexity**: Four-factor scoring with community-configurable weights is harder to debug than single-factor. Need scoring breakdown (including weights used) in API response. Normalization safety net prevents misconfigured weights from breaking scoring.
- **Cross-community karma edge cases**: What if users are in 10 shared communities? Karma awarded in all 10 may feel excessive. May need a cap (e.g., max 3 communities per match).
- **Community config dependency**: Feed now depends on community-service for configs. If community-service is down, feed scoring degrades (should fall back to neutral scoring).

### Neutral

- **Feed service role clarified**: Feed service (`port 3007`) handles social activity (milestones, stories, community health). Request-service handles curated request feed. These are complementary, not competing.
- **Existing tests unaffected**: Current unit/regression tests don't test cross-service scoring. New integration tests needed for the connected behavior.
- **No breaking API changes**: All new scoring is additive — existing curated feed responses gain new fields but don't lose existing ones.

---

## Alternatives Considered

### Alternative 1: Build Everything in Feed Service

Move curated request feed from request-service to feed-service, making feed-service the single orchestrator.

**Why rejected**: The curated feed is deeply integrated with request-service's database (request types, matching logic, type-specific schemas). Moving it would create tight coupling between feed-service and request-service's database, violating service boundaries.

### Alternative 2: Karma in ALL Communities (Not Just Shared)

Award karma in every community the request was posted to, even if the helper isn't a member.

**Why rejected**: Creates phantom karma — a helper gets reputation in communities they've never participated in. Violates the principle that community karma reflects community-witnessed interactions.

### Alternative 3: Skip Community Config Integration, Go Straight to Multi-Tier

Implement ADR-022's three-tier feed without wiring community configs into scoring.

**Why rejected**: Multi-tier visibility without community specialization means communities lose sovereignty. The tiers would expand reach but not quality. Community configs are the mechanism that makes wider reach safe — a service-focused community's high trust requirements protect quality when requests go to trust network tier.

### Alternative 4: Real-Time Trust Scoring via WebSocket

Push trust score updates to feed items in real-time as trust paths change.

**Why rejected**: Over-engineering for current scale. Batch lookups on feed load are sufficient. Can revisit when platform reaches 10k+ users.

---

## Implementation Notes

### Scoring Formula Detail

```typescript
// Platform defaults — used when community has no config
const DEFAULT_FEED_WEIGHTS: FeedWeights = {
  skill_match: 0.40,
  trust_distance: 0.30,
  community_relevance: 0.20,
  urgency: 0.10,
};

interface FeedWeights {
  skill_match: number;
  trust_distance: number;
  community_relevance: number;
  urgency: number;
}

interface FeedScoreBreakdown {
  skillMatch: number;          // 0-100 raw score
  trustDistance: number;        // 0-100 raw score
  communityRelevance: number;  // 0-100 raw score
  urgency: number;             // 0-100 raw score
  weights: FeedWeights;        // The weights used (from community config or defaults)
  finalScore: number;          // Weighted sum
}

function calculateFeedScore(
  skillScore: number,
  trustDegrees: number | null,
  communityConfig: CommunityConfig | null,
  requestType: string,
  requestUrgency: string
): FeedScoreBreakdown {
  const trustDistance = trustDegreesToScore(trustDegrees);
  const communityRelevance = scoreCommunityRelevance(requestType, communityConfig);
  const urgency = urgencyToScore(requestUrgency);

  // Get weights from community config, fall back to platform defaults
  const weights: FeedWeights = {
    skill_match: communityConfig?.feed_weight_skill_match ?? DEFAULT_FEED_WEIGHTS.skill_match,
    trust_distance: communityConfig?.feed_weight_trust_distance ?? DEFAULT_FEED_WEIGHTS.trust_distance,
    community_relevance: communityConfig?.feed_weight_community_relevance ?? DEFAULT_FEED_WEIGHTS.community_relevance,
    urgency: communityConfig?.feed_weight_urgency ?? DEFAULT_FEED_WEIGHTS.urgency,
  };

  // Normalize weights to sum to 1.0 (safety net if config is malformed)
  const totalWeight = weights.skill_match + weights.trust_distance + weights.community_relevance + weights.urgency;
  if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.01) {
    weights.skill_match /= totalWeight;
    weights.trust_distance /= totalWeight;
    weights.community_relevance /= totalWeight;
    weights.urgency /= totalWeight;
  }

  return {
    skillMatch: skillScore,
    trustDistance,
    communityRelevance,
    urgency,
    weights,
    finalScore: Math.round(
      skillScore * weights.skill_match +
      trustDistance * weights.trust_distance +
      communityRelevance * weights.community_relevance +
      urgency * weights.urgency
    )
  };
}

function trustDegreesToScore(degrees: number | null): number {
  if (degrees === null) return 20;  // No path found
  if (degrees === 1) return 100;
  if (degrees === 2) return 75;
  if (degrees === 3) return 50;
  return 20; // 4+ degrees
}
```

### Config Templates with Feed Weights

ADR-030 templates should include preset weight profiles:

```typescript
const CONFIG_TEMPLATES = {
  'professional-services': {
    feed_weight_skill_match: 0.55,
    feed_weight_trust_distance: 0.15,
    feed_weight_community_relevance: 0.20,
    feed_weight_urgency: 0.10,
  },
  'neighborhood': {
    feed_weight_skill_match: 0.15,
    feed_weight_trust_distance: 0.50,
    feed_weight_community_relevance: 0.20,
    feed_weight_urgency: 0.15,
  },
  'emergency-response': {
    feed_weight_skill_match: 0.25,
    feed_weight_trust_distance: 0.10,
    feed_weight_community_relevance: 0.20,
    feed_weight_urgency: 0.45,
  },
  'balanced': DEFAULT_FEED_WEIGHTS,  // The platform default
};
```

### Batch Trust Distance API

```typescript
// New endpoint in social-graph-service
// POST /social-graph/trust-distances/batch
router.post('/trust-distances/batch', async (req, res) => {
  const { from_user_id, to_user_ids } = req.body;

  const results: Record<string, TrustDistance> = {};
  for (const targetId of to_user_ids) {
    const path = await computeTrustPath(from_user_id, targetId);
    results[targetId] = {
      degrees: path ? path.length - 1 : null,
      path: path || [],
      score: trustDegreesToScore(path ? path.length - 1 : null)
    };
  }

  res.json({ success: true, data: { distances: results } });
});
```

### Cross-Community Karma Cap

To prevent excessive karma from users in many shared communities:

```typescript
const MAX_COMMUNITIES_PER_KARMA_AWARD = 3;

// If shared communities > 3, award in the 3 where user has highest existing karma
// (rewards continued participation in communities where they're already active)
const cappedCommunities = sharedCommunities
  .sort((a, b) => b.existing_karma - a.existing_karma)
  .slice(0, MAX_COMMUNITIES_PER_KARMA_AWARD);
```

---

## References

- [ADR-011: Reputation Decay System](ADR-011-reputation-decay.md) — 6-month half-life karma decay
- [ADR-019: Referral Chain Trust](ADR-019-referral-chain-trust.md) — Trust path mechanics
- [ADR-020: Trust-First Design Philosophy](ADR-020-trust-first-design.md) — Transparency principle
- [ADR-021: Trust Path Filtering](ADR-021-trust-path-filtering.md) — Degree-based filtering
- [ADR-022: Multi-Tier Feed Architecture](ADR-022-multi-tier-feed-architecture.md) — Three-tier feed (Phase 4)
- [ADR-030: Community Configuration System](ADR-030-community-configuration-system.md) — Config schema and CRUD
- **Code**: Curated feed in `services/request-service/src/routes/requests.ts:193-321`
- **Code**: Karma service in `services/reputation-service/src/services/karmaService.ts`
- **Code**: Trust path computation in `services/social-graph-service/src/services/pathComputation.ts`
- **Code**: Trust badge display in `apps/frontend/src/components/TrustPathBadge.tsx`
- **Code**: Community config routes in `services/community-service/src/routes/config.ts`
- **Code**: Match scoring in `packages/shared/src/matching/`
