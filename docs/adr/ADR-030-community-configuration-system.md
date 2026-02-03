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

## Frontend Implementation

### UI Components

Created comprehensive frontend implementation for configuration management:

#### Core Components

**`apps/frontend/src/components/CommunityConfigEditor.tsx`** (Created)
- Reusable configuration editor with read-only and edit modes
- 5 collapsible accordion sections:
  1. **Identity & Boundaries**: member_cap, visibility_mode, outsider_response_allowed
  2. **Request Types**: CRUD interface for enabled_request_types with validation
  3. **Karma Mechanics**: karma splits, base pool, decay settings
  4. **Trust Mechanics**: depth/breadth weights (auto-adjusting to sum to 1.0), decay, path settings
  5. **Onboarding Rules**: approval requirements, lockout periods
- Real-time validation with error display
- Help text for complex fields
- Auto-adjusts trust weights when one changes (ensures sum = 1.0)

**Type Definitions** (`apps/frontend/src/types/community-config.ts`)
```typescript
export interface CommunityConfig {
  member_cap: number
  visibility_mode: 'public' | 'members_only' | 'hybrid'
  outsider_response_allowed: boolean
  enabled_request_types: RequestType[]
  karma_split_helper: number
  karma_split_requestor: number
  base_karma_pool_per_request: number
  karma_decay_half_life_days: number
  trust_depth_weight: number
  trust_breadth_weight: number
  trust_decay_half_life_days: number
  trust_path_max_hops: number
  min_interactions_for_trust: number
  request_approval_required: boolean
  new_member_karma_lockout_days: number
  join_approval_required: boolean
  joining_counts_as_interaction: boolean
  template_source?: string
}

export interface RequestType {
  name: string
  description: string
  karma_multiplier: number
}
```

#### Pages

**1. Template Browser** (`apps/frontend/src/pages/communities/config-templates.tsx`)
- Browse pre-made configuration templates
- Card grid display with sort options (usage/name/date)
- Template preview with key settings highlighted
- "Use This Template" button navigates to community creation

**2. Community Creation** (`apps/frontend/src/pages/communities/new.tsx` - Modified)
- Multi-step flow: basic info → configuration (optional)
- Template-based initialization via URL query param `?template={id}`
- Custom configuration editing with CommunityConfigEditor
- Validation before submit
- Sends `config: {template_id, custom_config}` on creation

**3. Admin Configuration Panel** (`apps/frontend/src/pages/communities/[id]/admin.tsx` - Modified)
- New "Configuration" tab for founders
- Edit mode with CommunityConfigEditor
- Comprehensive validation (trust weights, request type uniqueness, ranges)
- Save with optimistic updates
- Founder-only access control

**4. Public Configuration View** (`apps/frontend/src/pages/communities/[id].tsx` - Modified)
- New "Configuration" tab on community profile
- Read-only CommunityConfigEditor display
- "Edit Configuration" link for founders → redirects to admin panel
- Visible to all community members

**5. Thriving Communities Browser** (`apps/frontend/src/pages/communities/configs/public.tsx`)
- Browse configurations from successful communities (with member filters)
- Filter by minimum members: 5/10/25/50/100+
- Community cards showing config previews
- Expandable config details
- **Copy Configuration Modal**:
  - Founder-only feature
  - Select source community and target community (from user's founded communities)
  - Option to include/exclude request types
  - Warning about overwriting current configuration

### API Integration

Modified `apps/frontend/src/lib/api.ts` to add configuration endpoints:
```typescript
// Configuration Management
getConfig: (communityId: string) =>
  communityApi.get(`/communities/${communityId}/config`),

updateConfig: (communityId: string, config: any) =>
  communityApi.put(`/communities/${communityId}/config`, config),

getConfigTemplates: (params?: {sort_by?: string, public_only?: boolean}) =>
  communityApi.get('/communities/config-templates', {params}),

copyConfigFrom: (communityId: string, sourceId: string, includeRequestTypes = true) =>
  communityApi.post(`/communities/${communityId}/config/copy-from/${sourceId}`, {
    include_request_types: includeRequestTypes
  }),

getThrivingCommunities: (minMembers = 5) =>
  communityApi.get('/communities/configs/public', {
    params: {min_members: minMembers}
  }),
```

### User Workflows

**1. Create Community with Template**
```
Browse Templates → Select Template → Fill Basic Info →
(Optional) Customize Config → Create Community
```

**2. Update Community Configuration** (Founder only)
```
Community Profile → Admin Panel → Configuration Tab →
Edit Config → Validate → Save
```

**3. Copy Configuration from Thriving Community**
```
Browse Thriving Communities → View Config → Copy →
Select Target Community → Confirm
```

**4. View Community Configuration** (Any member)
```
Community Profile → Configuration Tab → View Read-Only Config
```

### Validation Rules (Client-Side)

Frontend enforces same validation as backend:
- Trust weights must sum to 1.0 (±0.001 tolerance)
- Request type names must be unique and `lowercase_underscore` format
- Karma multipliers: 0.5-2.0
- Member cap: 10-150
- Karma splits: helper (0-100), requestor (-50 to 100)
- All numeric fields within documented ranges

### Files Modified/Created

**Created:**
- `apps/frontend/src/components/CommunityConfigEditor.tsx` (~350 lines)
- `apps/frontend/src/types/community-config.ts` (~40 lines)
- `apps/frontend/src/pages/communities/config-templates.tsx` (~120 lines)
- `apps/frontend/src/pages/communities/configs/public.tsx` (~280 lines)

**Modified:**
- `apps/frontend/src/lib/api.ts` (added 5 config endpoints)
- `apps/frontend/src/pages/communities/new.tsx` (multi-step flow + template support)
- `apps/frontend/src/pages/communities/[id]/admin.tsx` (Configuration tab)
- `apps/frontend/src/pages/communities/[id].tsx` (read-only Configuration tab)

**Total:** ~600 lines of frontend code

### Access Control (Frontend)

- **Template browsing**: Public (anyone can view)
- **Configuration viewing**: Community members only
- **Configuration editing**: Founders only (Phase 1)
- **Configuration copying**: Founders only (can only copy to communities they founded)

### Future Frontend Work (Phase 2+)

- [ ] User preference overlay UI (filter request types, adjust personal karma weights)
- [ ] Configuration history/versioning view
- [ ] A/B testing configuration selector
- [ ] Democratic governance interface (vote on config changes)
- [ ] Configuration analytics dashboard
- [ ] Mobile app implementation (React Native)

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
- **Related**: [ADR-007](ADR-007-polymorphic-request-system.md) - Polymorphic Request System (community configs enable simpler taxonomy approach)
- **Related**: Migration 011 - Database schema for configs
- **Tangential**: [Gemini Review Roadmap](../archive/gemini-review/roadmap.md) - Discusses request type polymorphism; community configs take a simpler "community-defined taxonomy" approach instead

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
