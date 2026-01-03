# Polymorphic Request System - Extensible Request Types

**Status**: Backlog
**Priority**: Medium
**Inspiration**: "Original Sins" book discussion on diversity of ideas
**Date**: 2026-01-03

## Vision

Build a system where communities can define and enable custom polymorphic request types, allowing the platform to adapt to different community needs rather than forcing all communities into a single mold.

## Problem Statement

Currently, request types are hardcoded in the system (ride requests, generic requests, etc.). This creates a monoculture where all communities must fit into our predefined request schemas. Different communities have different needs:
- A tool-sharing community needs equipment requests
- A skill-exchange community needs mentorship requests
- A food-sharing community needs meal requests with dietary requirements
- A childcare community needs time-bound care requests with specific needs

Each community should be able to define what types of help they exchange.

## Proposed Solution

### Community-Configurable Request Types

Allow community admins to:
1. **Enable/disable request types** from a marketplace
2. **Create custom request types** with configurable fields
3. **Define validation rules** for each type
4. **Set matching algorithms** appropriate for that type

### Architecture

```
Request Type Definition:
{
  id: "tool-lending",
  name: "Tool Lending Request",
  icon: "🔨",
  schema: {
    tool_name: { type: "string", required: true },
    needed_from: { type: "datetime", required: true },
    needed_until: { type: "datetime", required: true },
    deposit_required: { type: "boolean", default: false },
    location_pickup: { type: "location", required: true }
  },
  validation: { ... },
  matching_algorithm: "time_availability_match"
}
```

### Implementation Phases

**Phase 1: Request Type Marketplace (v9.0)**
- Predefined request types available for communities to enable
- Community settings to toggle which types are allowed
- Basic schema validation

**Phase 2: Custom Field Configuration (v10.0)**
- Allow communities to add custom fields to existing types
- Field type library (text, number, date, location, boolean, choice)
- Custom validation rules

**Phase 3: Full Custom Types (v11.0)**
- Community admins can create entirely new request types
- Visual schema builder
- Custom matching algorithm selection
- Request type marketplace (communities can share types)

## Technical Considerations

### Database Schema
```sql
-- Request type definitions table
CREATE TABLE community.request_type_definitions (
  id UUID PRIMARY KEY,
  community_id UUID REFERENCES communities.communities(id),
  base_type VARCHAR(50), -- 'generic', 'ride', 'custom'
  name VARCHAR(255),
  icon VARCHAR(10),
  schema JSONB, -- Field definitions
  validation_rules JSONB,
  matching_algorithm VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Polymorphic requests with dynamic schema
CREATE TABLE requests.help_requests (
  -- ... existing fields ...
  request_type_id UUID REFERENCES community.request_type_definitions(id),
  type_data JSONB, -- Dynamic fields based on request type
  -- ... existing fields ...
);
```

### API Design
```typescript
// Get available request types for a community
GET /api/communities/:id/request-types

// Enable a request type for community
POST /api/communities/:id/request-types/:typeId/enable

// Create custom request type
POST /api/communities/:id/request-types
{
  name: "Tool Lending",
  baseType: "generic",
  schema: { ... },
  validationRules: { ... }
}

// Create request with custom type
POST /api/requests
{
  communityId: "...",
  requestTypeId: "...",
  typeData: {
    tool_name: "Circular Saw",
    needed_from: "2026-01-05T09:00:00Z",
    needed_until: "2026-01-05T17:00:00Z"
  }
}
```

## Benefits

1. **Platform Adaptability**: Communities aren't forced into a one-size-fits-all model
2. **Innovation**: Communities can experiment with new exchange types
3. **Specialization**: Each community can optimize for their specific use case
4. **Growth**: Platform becomes more valuable as communities create and share types
5. **Cultural Diversity**: Different cooperation models can coexist

## Philosophical Foundation

From "Original Sins" and complexity thinking:

> **Monoculture vs. Diversity**: As societies scaled, we simplified cooperation models to the lowest common denominator. We lost rich, complex cooperation patterns that existed in smaller communities.

> **Technology as Scaffolding**: Modern technology can now support the complexity that was previously only manageable at small scale. We can have both scale AND diversity.

> **Human Capability**: Like bees collaborate at scale on simple tasks, humans with larger brains can collaborate on complex tasks. But we need the right technological scaffolding.

This system provides that scaffolding - allowing complex, diverse cooperation models while maintaining the benefits of a shared platform.

## Examples of Future Request Types

**Tool Library Community**:
- Equipment requests (with condition ratings, replacement value)
- Repair skill requests (with tool compatibility)

**Skill Exchange Community**:
- Mentorship requests (with time commitment, expertise level)
- Workshop hosting requests (with capacity, materials needed)

**Time Banking Community**:
- Service exchange requests (with hour equivalents)
- Skill matching (with certification requirements)

**Care Network Community**:
- Childcare requests (with ages, special needs, certifications required)
- Elder care requests (with medical requirements, timing flexibility)

**Food Sharing Community**:
- Meal sharing requests (with dietary restrictions, allergens, portion sizes)
- Garden produce requests (with seasonal availability)

## Related Work

- **ADR-006**: Multi-Tenant RLS Database Design (foundation)
- **ADR-004**: Microservices Event-Driven Architecture (enables extensibility)
- **Community Settings System**: Already supports per-community configuration

## Success Metrics

- Number of communities using custom request types
- Diversity of request types across platform
- Community retention for communities with custom types vs. default types
- Number of successful matches from custom types

## Open Questions

1. **Marketplace vs. DIY**: Should communities create from scratch or remix existing types?
2. **Matching Algorithms**: How configurable should these be?
3. **Migration**: How do communities transition from generic to specialized types?
4. **Governance**: Who can create types? Admins only or community vote?
5. **Quality Control**: How do we prevent poorly designed types?

## Next Steps

1. Create ADR-007 documenting this architectural decision
2. Prototype schema-driven UI rendering system
3. Design request type marketplace interface
4. Research other platforms with similar extensibility
5. Interview 5-10 communities about their specific needs

---

**Related Documents**:
- ADR-007: Community-Configurable Polymorphic Request System (to be created)
- LANDING_PAGE_VISION.md (companion backlog item)
- Community Settings Implementation (services/community-service)

**Tags**: #platform-extensibility #diversity #cooperation-models #future-vision
