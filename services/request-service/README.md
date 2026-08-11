# Request Service

Manages help requests and offers within communities for the Karmyq platform.

## Overview

Handles creation and management of help requests and help offers. Users can post what they need help with or what they can offer to help with within their communities.

## Port

**3003**

## API Endpoints

### GET /health
Service health check

### Requests

- `GET /requests` - List all requests
- `GET /requests/:id` - Get request details
- `POST /requests` - Create new help request
- `PUT /requests/:id` - Update request
- `DELETE /requests/:id` - Delete request
- `GET /communities/:communityId/requests` - Get requests for a community

### Offers

- `GET /offers` - List all offers
- `GET /offers/:id` - Get offer details
- `POST /offers` - Create new help offer
- `PUT /offers/:id` - Update offer
- `DELETE /offers/:id` - Delete offer
- `GET /communities/:communityId/offers` - Get offers for a community

### Responses

- `POST /requests/:id/responses` - Respond to a request
- `GET /requests/:id/responses` - Get responses to a request

## Database Schema

### requests.requests
- id, community_id, requester_id
- title, description, category, urgency
- status, created_at, updated_at

### requests.offers
- id, community_id, offerer_id
- title, description, category
- availability, status
- created_at, updated_at

### requests.responses
- id, request_id, responder_id
- message, status
- created_at

## Categories

- transportation, errands, tech_support
- home_repair, gardening, childcare
- pet_care, tutoring, other

## Urgency Levels

- low, medium, high, urgent

## Environment Variables

```env
PORT=3003
DATABASE_URL=postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db
REDIS_URL=redis://localhost:6379
```

## Related Services

- Community Service - Validates community membership
- Matching Service - Matches requests with offers
- Reputation Service - Updates karma on completion

## License

AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.
