# Karmyq Synthetic User Simulation Service

**Version**: 1.0.0 (Phase 1: Foundation)
**Status**: Production Ready
**ADR**: [ADR-006: Synthetic User Simulation](../../docs/adr/ADR-006-synthetic-user-simulation.md)

---

## Overview

Creates a **living demo environment** by simulating realistic user behavior continuously on the production platform. This service runs 10-100 synthetic users who perform actions like browsing requests, creating help requests, offering assistance, messaging, and completing matches.

### Why This Exists

- **Living Demo**: Platform always shows recent, realistic activity
- **Continuous Testing**: Catches bugs and performance issues in production
- **Data Maturation**: Organic growth of karma, relationships, and interaction patterns
- **Investor Appeal**: Demonstrates active platform with realistic usage
- **Load Testing**: Continuous stress testing in production-like conditions

---

## Features

### Phase 1 (Current - v1.0.0)

✅ **5 User Behavior Profiles**:
- Active Helper (30%) - Frequently offers help, completes matches
- Requester (25%) - Creates requests, accepts offers
- Browser (25%) - Browses without much action
- Community Builder (10%) - Creates communities, invites members
- Social User (10%) - Messages heavily, views profiles

✅ **5 Core Workflows**:
- Browse requests
- Create help request
- Offer help on request
- Send messages
- Complete matches

✅ **Business Hours Scheduling**: Active 9am-9pm Pacific Time

✅ **Rate Limiting**: Respects production rate limits with exponential backoff

✅ **Session Management**: Realistic session durations (5-60 minutes)

---

## Architecture

```
simulation-service/
  src/
    profiles/          # User behavior profiles
      index.ts         # All 5 profiles (Active Helper, Requester, etc.)
    workflows/         # Action workflows
      browse-workflow.ts
      request-workflow.ts
      offer-workflow.ts
      message-workflow.ts
      complete-match-workflow.ts
    config/            # Configuration
      default.json     # Default settings
    api-client.ts      # Karmyq API client
    session-manager.ts # User session lifecycle
    simulator.ts       # Main orchestrator
    index.ts           # Entry point
```

---

## Configuration

### Environment Variables

```bash
# Required
API_BASE_URL=https://karmyq.com/api

# Optional
SIMULATION_ENABLED=true
ENVIRONMENT=production
MIN_CONCURRENT_SESSIONS=10
MAX_CONCURRENT_SESSIONS=50
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=21:00
TIMEZONE=America/Los_Angeles
```

### Configuration File

See [src/config/default.json](src/config/default.json) for full configuration options:

```json
{
  "enabled": true,
  "users": {
    "total": 100,
    "concurrentSessions": { "min": 10, "max": 50 },
    "profiles": {
      "activeHelper": 0.30,
      "requester": 0.25,
      "browser": 0.25,
      "communityBuilder": 0.10,
      "socialUser": 0.10
    }
  },
  "rateLimit": {
    "respectLimits": true,
    "minDelayMs": 2000,
    "maxRetries": 3
  }
}
```

---

## Setup

### 1. Extract User Credentials

The simulation service needs real user accounts from the database. Extract credentials by running this on the production server:

```bash
cd services/simulation-service
node extract-user-credentials.js
```

This creates `.env.production.users` with 100 user accounts from the database. All seeded users share the password: `password123`.

**Note**: This file contains sensitive credentials. Never commit it to git (already in `.gitignore`).

### 2. Configure Environment

See [Configuration](#configuration) section below.

---

## Usage

### Development

```bash
# Install dependencies
npm install

# Run simulation
npm run dev

# Build TypeScript
npm run build
```

### Production (Docker)

```bash
# Build image
docker build -t karmyq-simulation-service .

# Run container
docker run -d \
  --name simulation-service \
  --env-file .env \
  karmyq-simulation-service
```

### Docker Compose

Add to `docker-compose.yml`:

```yaml
simulation-service:
  build: ./services/simulation-service
  environment:
    - API_BASE_URL=http://frontend:3000/api
    - SIMULATION_ENABLED=true
    - ENVIRONMENT=production
  restart: unless-stopped
  depends_on:
    - frontend
    - auth-service
    - community-service
    - request-service
```

---

## How It Works

### 1. User Profiles

Each simulated user is assigned a profile that determines their behavior:

```typescript
ACTIVE_HELPER: {
  frequency: 'high',
  actions: {
    offerHelp: { weight: 0.6, avgPerSession: 3 },
    browseRequests: { weight: 0.8, avgPerSession: 5 },
    sendMessages: { weight: 0.7, avgPerSession: 4 },
    completeMatches: { weight: 0.5, avgPerSession: 2 }
  },
  sessionDuration: { min: 15, max: 45, unit: 'minutes' }
}
```

### 2. Session Lifecycle

1. User logs in (or registers if needed)
2. Performs actions based on profile weights
3. Waits realistic delays between actions (1-3 minutes)
4. Continues until session duration expires
5. Logs out

### 3. Action Selection

Actions are chosen probabilistically based on profile weights:

- **Active Helper**: 60% chance to offer help per opportunity
- **Requester**: 80% chance to create a request
- **Browser**: 90% chance to just browse

### 4. Rate Limiting

- Minimum 2-second delay between actions
- Exponential backoff on 429 errors
- Maximum 3 retries per action
- Respects production rate limits by design

---

## Monitoring

### Logs

```bash
# View logs
docker logs -f simulation-service

# Sample output
[simuser-123@simulation.karmyq.com] Starting session (Active Helper)
[simuser-123@simulation.karmyq.com] Browsing requests...
[simuser-123@simulation.karmyq.com] Found 15 requests
[simuser-123@simulation.karmyq.com] Offering help on request: "Need help moving"
[simuser-123@simulation.karmyq.com] Offered help successfully
```

### Metrics (Future)

- Active simulated users per hour
- Actions performed per type
- Error rates by action
- Average session duration
- Rate limit hits

---

## Future Phases

### Phase 2: Realistic Behavior (v2.0)
- Message conversations with natural delays
- Match completion workflows with feedback
- Session-based activity patterns

### Phase 3: Advanced Features (v3.0)
- Community creation workflows
- Invitation workflows with social graph
- Karma/reputation growth tracking
- A/B testing scenarios

### Phase 4: Self-Healing & Intelligence (v4.0)
- ML-based behavior adjustment
- Automatic workflow creation for new features
- Performance optimization
- Self-healing on errors

---

## Troubleshooting

### Simulation not starting

Check:
1. `SIMULATION_ENABLED=true` in environment
2. API base URL is correct
3. Services are running and accessible

### Too many rate limit errors

Adjust configuration:
- Increase `rateLimit.minDelayMs` (default: 2000)
- Decrease `users.concurrentSessions.max`

### Users not logging in

Ensure:
- Auth service is running
- Test user accounts exist (simuser-*@simulation.karmyq.com)
- Or auto-registration is enabled

---

## Development

### Adding a New Workflow

1. Create workflow file in `src/workflows/`:

```typescript
import { Workflow } from '../types';

export const myWorkflow: Workflow = async (context) => {
  const { session, config } = context;
  // Implement workflow
};
```

2. Export in `src/workflows/index.ts`
3. Add to simulator action selection in `simulator.ts`

### Adding a New Profile

1. Define profile in `src/profiles/index.ts`:

```typescript
export const NEW_PROFILE: UserProfile = {
  name: 'New Profile',
  frequency: 'medium',
  actions: { /* ... */ },
  sessionDuration: { min: 10, max: 30, unit: 'minutes' }
};
```

2. Update profile distribution in config
3. Add to `assignProfile()` function

---

## Related Documentation

- [ADR-006: Synthetic User Simulation](../../docs/adr/ADR-006-synthetic-user-simulation.md) - Architecture decision
- [DEVELOPMENT_ROADMAP.md](../../docs/DEVELOPMENT_ROADMAP.md) - Backlog #37
- [API Documentation](../../docs/API.md) - Karmyq API reference

---

## License

Internal use only - Karmyq Platform

---

**Last Updated**: 2026-01-03
**Maintainer**: Development Team
