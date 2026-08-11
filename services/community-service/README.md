# Community Service

Manages communities, memberships, and community norms for the Karmyq platform.

## Overview

Handles community creation, membership management, and community governance through norms and approvals. Communities are limited to 150 members (Dunbar's number) to maintain trust and authentic connections.

## Port

**3002**

## API Endpoints

### GET /health
Service health check

### Communities

- `GET /communities` - List all communities
- `GET /communities/:id` - Get community details
- `POST /communities` - Create new community
- `PUT /communities/:id` - Update community
- `DELETE /communities/:id` - Delete community

### Members

- `GET /communities/:id/members` - List community members
- `POST /communities/:id/members` - Join community
- `DELETE /communities/:id/members/:userId` - Leave/remove member

### Norms

- `GET /communities/:id/norms` - List community norms
- `POST /communities/:id/norms` - Create norm
- `POST /communities/:id/norms/:normId/approve` - Approve norm

## Database Schema

### communities.communities
- id, name, description, location, category
- max_members (default 150), current_members
- access_type, status, creator_id
- created_at, updated_at

### communities.members
- id, community_id, user_id, role
- invited_by, joined_at, status

### communities.norms
- id, community_id, proposed_by
- title, description, approval_threshold
- status, created_at

### communities.norm_approvals
- id, norm_id, user_id, approved
- comment, created_at

## Environment Variables

```env
PORT=3002
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
```

## Related Services

- Auth Service - User validation
- Request Service - Community-based requests

## License

AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.
