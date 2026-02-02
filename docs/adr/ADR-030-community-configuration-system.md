# ADR-030: Community Configuration System (Phase 1)

**Status**: Accepted
**Date**: 2026-02-02
**Context**: Community Service
**Impact**: Critical - Defines foundation for trust, karma, and coordination mechanics

---

## Context

Karmyq communities are "digital villages" (max 150 members) that coordinate non-monetary exchanges. Different communities have different values, trust models, and coordination patterns. We need a system where communities can define their own rules and discover what works through observable patterns.

**Core Philosophy**: Communities are sovereign entities that define their own values through configuration. Successful configurations should be observable and copyable, enabling evolutionary discovery.

### Current Limitations

Before this ADR:
- Communities had fixed trust and karma mechanics (hardcoded)
- No way for communities to express different values or coordination patterns
- No mechanism for communities to learn from each other's configurations
- All communities forced into same trust/karma model regardless of context

### Requirements

1. **Community Sovereignty**: Each community defines its own:
   - Trust mechanics (depth vs breadth, decay rates, path lengths)
   - Karma distribution (helper/requestor splits, decay, request type multipliers)
   - Coordination rules (visibility, approval workflows, onboarding)

2. **Evolutionary Discovery**: Communities can:
   - Browse configurations from thriving communities
   - Copy successful patterns
   - Use pre-made templates as starting points
   - See which configs are most popular

3. **Phase 1 Scope**:
   - Founder-only configuration updates (no governance yet)
   - Configuration templates for common patterns
   - Public browsing of successful configs
   - No user preference layer (Phase 2)
   - No trust/karma computation yet (Phase 3/4 - this is the config they'll use)

---

## Decision

### 1. Database Schema

Create two new tables in `communities` schema:

#### `community_configs`
Stores comprehensive configuration for each community:

```sql
CREATE TABLE communities.community_configs (
    id UUID PRIMARY KEY,
    community_id UUID NOT NULL UNIQUE REFERENCES communities.communities(id),

    -- Identity & Boundaries
    member_cap INTEGER DEFAULT 150 CHECK (10-150),
    visibility_mode VARCHAR(50) DEFAULT 'public',  -- public/members_only/hybrid
    outsider_response_allowed BOOLEAN DEFAULT FALSE,

    -- Request Types (community-defined)
    enabled_request_types JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Karma Mechanics
    karma_split_helper INTEGER DEFAULT 60 CHECK (0-100),
    karma_split_requestor INTEGER DEFAULT 40 CHECK (-50 to 100),
    base_karma_pool_per_request INTEGER DEFAULT 100 CHECK (10-1000),
    karma_decay_half_life_days INTEGER DEFAULT 0 CHECK (0-365),

    -- Trust Mechanics
    trust_depth_weight DECIMAL(3,2) DEFAULT 0.60,
    trust_breadth_weight DECIMAL(3,2) DEFAULT 0.40,
    trust_decay_half_life_days INTEGER DEFAULT 90 CHECK (30-365),
    trust_path_max_hops INTEGER DEFAULT 3 CHECK (1-5),
    min_interactions_for_trust INTEGER DEFAULT 1 CHECK (1-10),

    -- Community Onboarding
    request_approval_required BOOLEAN DEFAULT FALSE,
    new_member_karma_lockout_days INTEGER DEFAULT 0 CHECK (0-30),
    join_approval_required BOOLEAN DEFAULT TRUE,
    joining_counts_as_interaction BOOLEAN DEFAULT TRUE,

    -- Metadata
    template_source VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    CONSTRAINT trust_weights_sum CHECK (
        ABS((trust_depth_weight + trust_breadth_weight) - 1.0) < 0.01
    )
);
```

#### `config_templates`
Pre-made templates for browsing and copying:

```sql
CREATE TABLE communities.config_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    config_json JSONB NOT NULL,  -- full config as JSON
    is_public BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 2. Starter Templates

Three templates seeded on initialization:

1. **Cohousing Default**: High-trust, balanced (60/40 karma), public, relationship-focused
2. **Neighborhood Cautious**: Helper-focused (80/20 karma), members-only, gradual trust
3. **Experimental Reciprocal**: Equal split (50/50 karma), hybrid visibility, rapid evolution

### 3. API Endpoints

- `POST /communities` - Now accepts optional `config` parameter (template_id or custom_config)
- `GET /communities/:id/config` - View community configuration
- `PUT /communities/:id/config` - Update config (founder only, Phase 1)
- `GET /communities/config-templates` - Browse available templates
- `POST /communities/:id/config/copy-from/:source_id` - Copy from another community
- `GET /communities/configs/public` - Browse configs from thriving communities

### 4. Validation Rules

Comprehensive validation enforces:
- Trust weights must sum to 1.0 (±0.001 tolerance)
- Karma splits can sum to >100 or <100 (explicitly allowed)
- Request type names must be `lowercase_underscore` format
- At least 1 enabled request type required
- Karma multipliers between 0.5 and 2.0
- All numeric fields within safe ranges

### 5. Event Publishing

New events for future service consumption:
- `community.config.created` - When config is created
- `community.config.updated` - When config is updated

### 6. Configuration Hierarchy

Phase 1 establishes the "floor":
```
Community Config (this ADR)
   ↓ sets what's allowed
User Preferences (Phase 2)
   ↓ filters within bounds
Feed Service (Phase 2+)
   ↓ respects both hierarchies
Trust/Karma Computation (Phase 3/4)
   ↓ consumes config values
```

---

## Implementation

### Migration 011

Created `infrastructure/postgres/migrations/011_community_configuration_system.sql`:
- Creates `community_configs` table with all constraints
- Creates `config_templates` table
- Seeds 3 starter templates
- Adds indexes for performance
- Includes rollback script

### Validation Service

Created `services/community-service/src/services/config-validator.ts`:
- `validateCommunityConfig()` - Comprehensive validation
- `mergeAndValidateConfig()` - For partial updates
- `getDefaultConfig()` - Returns Cohousing Default
- 39 unit tests covering all validation rules

### Routes

Created `services/community-service/src/routes/config.ts`:
- All 5 configuration endpoints
- Authorization checks (founder-only for updates)
- Event publishing integration

### Updated POST /communities

Modified `services/community-service/src/routes/communities.ts`:
- Now creates `community_configs` record on community creation
- Accepts optional `config: {template_id, custom_config}`
- Defaults to "Cohousing Default" template if not specified
- Increments template `usage_count` when used

---

## Consequences

### Positive

✅ **Community Sovereignty**: Each community can define its own values and rules

✅ **Evolutionary Discovery**: Communities can observe and copy successful patterns

✅ **Gradual Rollout**: Phase 1 is simple (founder-only), can add governance later

✅ **Future-Proof Foundation**: Sets up Phase 2 (user preferences) and Phase 3/4 (trust/karma computation)

✅ **Prevents Lock-In**: Communities not forced into one-size-fits-all model

✅ **Observable Patterns**: Public config browsing enables learning across communities

✅ **Template System**: Pre-made configs make onboarding easier for new communities

### Negative

⚠️ **Complexity**: More configuration surface area to maintain

⚠️ **Founder Power**: Phase 1 is founder-only (no democratic governance yet)

⚠️ **Migration Required**: Existing communities need default configs created

⚠️ **Validation Overhead**: Complex validation rules to maintain

### Neutral

🔶 **Config Versioning Not Included**: Can add later if needed (config history, rollback)

🔶 **A/B Testing Not Included**: Phase 1 doesn't include experiment framework

🔶 **No UI Yet**: Frontend needs to be built to expose these configs

---

## Alternatives Considered

### 1. Hardcoded Configurations

**Rejected**: Forces all communities into same model, prevents experimentation

### 2. Full Governance System (Phase 1)

**Deferred to Phase 2+**: Too complex for initial rollout. Start with founder-only, add democratic governance later.

### 3. User Preferences First (No Community Config)

**Rejected**: User preferences need community config as "floor" to work within

### 4. Config as Code (YAML/JSON files)

**Rejected**: Want configs in database for:
- Querying (find communities with similar configs)
- Real-time updates (no redeployment needed)
- Template browsing (usage counts, popularity)

---

## Related

- **Future**: ADR-031 (User Preference Layer - Phase 2)
- **Future**: ADR-032 (Trust Computation Using Configs - Phase 3)
- **Future**: ADR-033 (Karma Computation Using Configs - Phase 4)
- **Related**: [ADR-011](ADR-011-reputation-decay.md) - Reputation Decay (now configurable per community)
- **Related**: Migration 011 - Database schema for configs

---

## Notes

### Request Type Philosophy

Communities define their own request type taxonomy (no platform-wide categories). Examples:
- Cohousing: meal_share, tool_borrow, ride_share, childcare
- Tech Community: code_review, mentorship, pair_programming
- Neighborhood: errand_help, pet_sitting, skill_share

Each type has a `karma_multiplier` (0.5-2.0) to adjust karma pool for that request type.

### Karma Split Philosophy

Helper/requestor splits can sum to:
- **>100**: Generous system (both benefit more than base pool)
- **=100**: Balanced system (splits base pool)
- **<100**: Conservative system (some karma "destroyed")

Requestor split can be **negative** to discourage asking (helper gets >100% of pool).

### Trust Weights Philosophy

- **Depth-focused** (0.7/0.3): Values repeated interactions with same people
- **Balanced** (0.6/0.4): Default, moderate on both
- **Breadth-focused** (0.4/0.6): Values network diversity over depth

### Visibility Modes

- **public**: Anyone can see requests, responses visible
- **members_only**: Only members see anything
- **hybrid**: Public listings exist but details require membership

---

**Decision Made By**: Development Team
**Approved By**: Project Lead
**Implementation PR**: #[TBD]
**Migration**: 011_community_configuration_system.sql
