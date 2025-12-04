# FR-010: Community Norms

**Status:** ✅ Implemented | **Priority:** Low | **Version:** 5.1.0

## Overview

Community norms are guidelines and behavioral expectations set by community admins.

## Key Features

### FR-010.1: Create Norms
- [x] Admins can create norms
- [x] Title and description required
- [x] Optional category
- [x] Active/inactive status
- [x] Display order

### FR-010.2: View Norms
- [x] All members can view norms
- [x] Displayed on community page
- [x] Sorted by display order
- [x] Only active norms shown to members
- [x] Admins see all norms

### FR-010.3: Update Norms
- [x] Admins can edit norms
- [x] Update title, description, status
- [x] Change display order
- [x] History tracked (updated_at)

### FR-010.4: Delete Norms
- [x] Admins can delete norms
- [x] Hard delete (no soft delete)
- [x] Confirmation required (frontend)

### FR-010.5: Norm Categories
Suggested categories:
- Code of Conduct
- Communication Guidelines
- Request Guidelines
- Matching Etiquette
- Privacy
- Safety

## Data Model
```sql
CREATE TABLE communities.norms (
  id UUID PRIMARY KEY,
  community_id UUID REFERENCES communities.communities(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  display_order INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Implementation
- Service: `community-service`
- Endpoints: CRUD at `/communities/:id/norms`
- Authorization: Admins only for CUD operations
- RLS: Community isolation enforced

## Use Cases
1. **Code of Conduct** - Expected behavior
2. **Request Guidelines** - How to write good requests
3. **Response Guidelines** - How to offer help effectively
4. **Privacy Policy** - Data handling expectations
5. **Conflict Resolution** - How disputes are handled

## Related
- [FR-002: Communities](FR-002-communities.md)
