# Packages Directory

## Overview
Shared code used across services and apps via Turborepo workspaces.

## packages/shared/

### middleware/
Reusable Express middleware:
- `auth.ts` - `authenticateToken`, `extractCommunityContext`, `requireRole`
- `rateLimit.ts` - Rate limiting with Redis backend
- `validation.ts` - Request validation helpers

### types/
TypeScript interfaces:
- API response types
- Entity types (User, Community, Request, etc.)
- Event payload types

### utils/
Utility functions:
- Database query helpers
- Date formatting
- Error handling

### api/
Shared API client configuration

### constants/
Application constants:
- Role names
- Status values
- Default TTL values

## Usage in Services
```typescript
// Import middleware
import { authenticateToken, extractCommunityContext } from '@karmyq/shared/middleware/auth';

// Import types
import { ApiResponse, User } from '@karmyq/shared/types';

// Import utilities
import { formatDate } from '@karmyq/shared/utils';
```

## Adding Shared Code
1. Add to appropriate subdirectory
2. Export from index.ts
3. Run `npm run build` in packages/shared
4. Import in consuming service
