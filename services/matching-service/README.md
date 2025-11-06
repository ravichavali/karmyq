# Matching Service

Intelligent matching system for help requests and offers in the Karmyq platform.

## Overview

Automatically matches help requests with suitable offers based on skills, availability, location, and other criteria. Creates conversations when matches are found.

## Port

**3007** (if implemented)

## Status

⚠️ **Partially Implemented** - Basic structure in place, matching algorithm pending

## Planned API Endpoints

### GET /health
Service health check

### Matching

- `POST /match/request/:requestId` - Find matches for a request
- `POST /match/offer/:offerId` - Find requests matching an offer
- `GET /matches/:userId` - Get user's matches
- `POST /matches/:matchId/accept` - Accept a match
- `POST /matches/:matchId/decline` - Decline a match

## Matching Criteria

### Primary Factors

1. **Skills Match**: Request category matches offer category
2. **Location Proximity**: Within same community or nearby
3. **Availability**: Offer time matches request urgency
4. **Trust Score**: Higher scores prioritized

### Secondary Factors

1. **Response Time**: Faster responders ranked higher
2. **Completion Rate**: Users with high completion rates
3. **Karma Points**: More karma = higher priority
4. **Community Membership**: Same community preferred

## Matching Algorithm

```
Score = (skill_match * 0.4)
      + (proximity * 0.3)
      + (trust_score * 0.2)
      + (availability * 0.1)
```

## Database Schema (Planned)

### matching.matches
- id, request_id, offer_id
- requester_id, offerer_id
- match_score, status
- created_at, accepted_at, completed_at

### matching.match_history
- id, match_id, action, actor_id
- notes, created_at

## Events

### Listens To

- `request_created` - New request to match
- `offer_created` - New offer to match
- `user_updated` - User skills/location changed

### Publishes

- `match_created` - New match found
- `match_accepted` - Match accepted by both parties
- `match_completed` - Help exchange completed
- `match_declined` - Match declined

## Implementation TODO

- [ ] Implement matching algorithm
- [ ] Add location-based scoring
- [ ] Add time-based availability matching
- [ ] Implement notification on match
- [ ] Add match acceptance workflow
- [ ] Create conversation on match acceptance

## Environment Variables

```env
PORT=3007
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
MATCHING_THRESHOLD=0.6  # Minimum score to create match
```

## Related Services

- Request Service - Source of requests
- Reputation Service - Provides trust scores
- Messaging Service - Creates conversations on match
- Notification Service - Notifies users of matches

## License

MIT
