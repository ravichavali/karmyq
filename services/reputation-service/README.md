# Reputation Service

Manages karma points and trust scores for users in the Karmyq platform.

## Overview

Tracks karma earned through helping others and calculates trust scores. Implements gamification with milestones and badges to encourage community participation.

## Port

**3004**

## API Endpoints

### GET /health
Service health check

### Karma

- `GET /users/:userId/karma` - Get user's total karma
- `GET /users/:userId/karma/history` - Get karma history
- `POST /karma/award` - Award karma (internal use)

### Trust Scores

- `GET /users/:userId/trust-score` - Get user's trust score (0-100)
- `GET /communities/:communityId/trust-scores` - Get community trust scores

### Leaderboards

- `GET /leaderboards/global` - Global karma leaderboard
- `GET /leaderboards/community/:communityId` - Community leaderboard

### Badges

- `GET /users/:userId/badges` - Get user's badges
- `GET /badges` - List all available badges

## Karma System

### Earning Karma

- **Help Completed**: +10 points
- **First Help**: +15 bonus points
- **Receive Help**: +5 points

### Milestones

- 10 exchanges: +10 bonus
- 50 exchanges: +50 bonus
- 100 exchanges: +100 bonus

### Trust Score Calculation

Score = min(100, karma / 10)
- 0-100 karma = 0-10 trust score
- 1000+ karma = 100 trust score

## Database Schema

### reputation.karma_records
- id, user_id, amount, source
- reference_id, reference_type
- created_at

### reputation.trust_scores
- user_id, score, total_karma
- total_exchanges, updated_at

### reputation.badges
- id, user_id, badge_type
- awarded_at

## Events

### Listens To

- `match_completed` - Awards karma when help is completed

### Publishes

- `karma_awarded` - Notifies when karma is awarded

## Environment Variables

```env
PORT=3004
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
```

## Related Services

- Request Service - Triggers karma awards
- Notification Service - Notifies users of karma

## License

AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.
