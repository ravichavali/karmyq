# Social Graph Service

**Port**: 3010
**Status**: ✅ Production
**Version**: 9.1.0

## Quick Start

```bash
# Development
cd services/social-graph-service
npm install
npm run dev

# Docker
docker-compose up social-graph-service
```

## Purpose

Manages invitation tracking, social graph computation, and trust path visualization. Shows users how they're connected through invitation chains.

## Key Features

- **Invitation Code Generation**: `KARMYQ-{NAME}-{YEAR}-{RANDOM}` format
- **Path Computation**: Bidirectional BFS, max 4 degrees
- **Path Caching**: 7-day TTL, ~95% hit rate
- **Batch Processing**: Up to 50 paths per request (for feed ranking)
- **Privacy Controls**: User-configurable visibility

## API Endpoints

### Invitations

```bash
POST   /invitations/generate     # Generate invitation code
POST   /invitations/accept       # Accept invitation code
GET    /invitations              # Get invitation history
GET    /invitations/stats        # Get inviter statistics (gamification)
```

### Paths

```bash
GET    /paths/:targetUserId      # Get shortest path to user
POST   /paths/batch              # Get paths to multiple users (feed ranking)
```

## Example Usage

### Generate Invitation Code

```bash
curl -X POST http://localhost:3010/invitations/generate \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "code": "KARMYQ-MIKE-2024-A7B3",
    "url": "http://localhost:3000/invite/KARMYQ-MIKE-2024-A7B3"
  }
}
```

### Get Path Between Users

```bash
curl http://localhost:3010/paths/{targetUserId} \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "degrees_of_separation": 2,
    "path": [
      { "id": "user-123", "name": "You" },
      { "id": "user-456", "name": "Mike Chen", "karma": 87 },
      { "id": "user-789", "name": "Sarah Rodriguez" }
    ],
    "trust_score": 87,
    "cached": true
  }
}
```

## Database Tables

- `auth.user_invitations` - Invitation graph
- `auth.social_distances` - Precomputed paths (cache)
- `auth.inviter_stats` - Gamification metrics

## Performance

| Operation | Target | Typical |
|-----------|--------|---------|
| Path (cached) | <100ms | ~50ms |
| Path (uncached) | <1s | ~500ms |
| Batch (50 users) | <5s | ~2s |
| Code generation | <200ms | ~100ms |

## Integration

### Feed Service
Calls `/paths/batch` to get social proximity scores for feed ranking.

### Request Service
Calls `/paths/:userId` to show "Connected through X" badge on request cards.

### Auth Service
Calls `/invitations/accept` during user signup.

## Documentation

- **Full Documentation**: [CONTEXT.md](CONTEXT.md)
- **Design Document**: [../../docs/features/SOCIAL_GRAPH_TRUST_PATHS.md](../../docs/features/SOCIAL_GRAPH_TRUST_PATHS.md)
- **Migration**: [../../infrastructure/postgres/migrations/009_social_graph.sql](../../infrastructure/postgres/migrations/009_social_graph.sql)

---

**Service Owner**: Platform Team
**Last Updated**: 2025-12-27
