# ADR-006: Synthetic User Simulation for Demo Environment

**Status**: Proposed
**Date**: 2026-01-02
**Deciders**: Product Team
**Tags**: #demo #testing #automation #future

## Context

Currently, production seeding creates static demo data (2000 users, 200 communities, historical requests/matches). While this provides initial data, it lacks the dynamic, living quality of a real platform:

- Demo data becomes stale over time
- No ongoing activity for potential users/investors to observe
- Missing realistic usage patterns and data maturation
- Manual effort required to refresh demo environment

### Vision

Transform the production environment into a **living demo** with synthetic users that continuously perform realistic actions:
- 10-100 users "active" during business hours
- Realistic workflows: browse, create requests, offer help, message, complete matches
- Organic data growth: karma accumulation, message threads, community engagement
- Platform maturation: stress testing, bug detection, feature validation

## Decision

We will create a **Synthetic User Simulation System** that:

1. **Runs continuously** as a background service or scheduled task
2. **Simulates realistic user behavior** with configurable profiles
3. **Respects rate limits** by design (no special bypass needed)
4. **Grows organically** with new features (extensible architecture)
5. **Provides observability** through logs and metrics

## Architecture Options

### Option 1: Dedicated Simulation Service (Recommended)

```
services/
  simulation-service/
    src/
      profiles/          # User behavior profiles
        active-helper.ts
        requester.ts
        browser.ts
        community-builder.ts
        social-user.ts
      workflows/         # Action sequences
        help-workflow.ts
        request-workflow.ts
        message-workflow.ts
      scheduler/         # Activity timing
        business-hours.ts
        session-manager.ts
      index.ts           # Main service loop
```

**Pros**:
- Containerized, runs alongside other services
- Easy to deploy and monitor
- Configurable via environment variables
- Can scale independently

**Cons**:
- Additional service to maintain
- Requires container orchestration

### Option 2: Scheduled Scripts via Cron

```
scripts/
  simulate-user-activity.ts
  config/
    behavior-profiles.json
    workflow-weights.json
```

Run via cron: `0 * * * * /usr/local/bin/node simulate-user-activity.ts`

**Pros**:
- Simple deployment
- No new service required
- Easy to debug

**Cons**:
- Less control over timing
- Harder to maintain state across runs
- Limited observability

### Option 3: Hybrid Approach

Scheduled scripts for major activities, lightweight service for real-time simulation.

## Implementation Strategy

### Phase 1: Foundation (v1.0)
- **Goal**: Basic user simulation with 3 core workflows
- **Scope**:
  - 5 user behavior profiles
  - 3 workflows: browse, create request, offer help
  - Simple scheduling (hourly cron)
  - Basic logging
- **Duration**: ~2 weeks
- **Dependencies**: Completed production seeding

### Phase 2: Realistic Behavior (v2.0)
- **Goal**: Lifelike user patterns
- **Scope**:
  - Business hours weighting (9am-9pm peak activity)
  - Session-based activity (5-30 minute sessions)
  - Message conversations with delays
  - Match completion workflows
- **Duration**: ~1 week
- **Dependencies**: Phase 1

### Phase 3: Advanced Features (v3.0)
- **Goal**: Full ecosystem simulation
- **Scope**:
  - Community creation and management
  - Invitation workflows
  - Karma/reputation growth
  - A/B testing scenarios
  - Metrics dashboard
- **Duration**: ~2 weeks
- **Dependencies**: Phase 2

### Phase 4: Self-Healing & Intelligence (v4.0)
- **Goal**: Autonomous, adaptive simulation
- **Scope**:
  - ML-based behavior adjustment
  - Automatic workflow creation for new features
  - Self-healing (restart on errors)
  - Performance optimization
- **Duration**: ~3 weeks
- **Dependencies**: Phase 3

## User Behavior Profiles

### 1. Active Helper (30% of simulated users)
```typescript
{
  name: "Active Helper",
  frequency: "high",
  actions: {
    offerHelp: { weight: 0.6, avgPerSession: 3 },
    browseRequests: { weight: 0.8, avgPerSession: 5 },
    sendMessages: { weight: 0.7, avgPerSession: 4 },
    completeMatches: { weight: 0.5, avgPerSession: 2 },
    createRequests: { weight: 0.1, avgPerSession: 0.3 }
  },
  sessionDuration: { min: 15, max: 45, unit: "minutes" },
  responseTime: { min: 5, max: 30, unit: "minutes" }
}
```

### 2. Requester (25% of simulated users)
```typescript
{
  name: "Requester",
  frequency: "medium",
  actions: {
    createRequests: { weight: 0.8, avgPerSession: 2 },
    acceptOffers: { weight: 0.6, avgPerSession: 1.5 },
    sendMessages: { weight: 0.5, avgPerSession: 3 },
    browseRequests: { weight: 0.3, avgPerSession: 2 },
    offerHelp: { weight: 0.1, avgPerSession: 0.2 }
  },
  sessionDuration: { min: 10, max: 30, unit: "minutes" },
  responseTime: { min: 30, max: 120, unit: "minutes" }
}
```

### 3. Browser (25% of simulated users)
```typescript
{
  name: "Browser",
  frequency: "low",
  actions: {
    browseRequests: { weight: 0.9, avgPerSession: 10 },
    viewProfiles: { weight: 0.4, avgPerSession: 3 },
    offerHelp: { weight: 0.1, avgPerSession: 0.5 },
    createRequests: { weight: 0.05, avgPerSession: 0.1 }
  },
  sessionDuration: { min: 5, max: 15, unit: "minutes" },
  responseTime: { min: 60, max: 240, unit: "minutes" }
}
```

### 4. Community Builder (10% of simulated users)
```typescript
{
  name: "Community Builder",
  frequency: "medium",
  actions: {
    createCommunities: { weight: 0.3, avgPerSession: 0.2 },
    inviteMembers: { weight: 0.6, avgPerSession: 5 },
    moderateContent: { weight: 0.4, avgPerSession: 2 },
    createRequests: { weight: 0.5, avgPerSession: 1 },
    offerHelp: { weight: 0.4, avgPerSession: 2 }
  },
  sessionDuration: { min: 20, max: 60, unit: "minutes" },
  responseTime: { min: 10, max: 60, unit: "minutes" }
}
```

### 5. Social User (10% of simulated users)
```typescript
{
  name: "Social User",
  frequency: "high",
  actions: {
    sendMessages: { weight: 0.9, avgPerSession: 8 },
    browseRequests: { weight: 0.6, avgPerSession: 4 },
    viewProfiles: { weight: 0.7, avgPerSession: 6 },
    offerHelp: { weight: 0.3, avgPerSession: 1 },
    createRequests: { weight: 0.2, avgPerSession: 0.5 }
  },
  sessionDuration: { min: 15, max: 45, unit: "minutes" },
  responseTime: { min: 2, max: 15, unit: "minutes" }
}
```

## Example Workflow: Help Exchange

```typescript
async function simulateHelpWorkflow(user: SimulatedUser) {
  const session = new UserSession(user);

  // 1. Login
  await session.login();

  // 2. Browse dashboard
  await session.viewDashboard();
  await delay(random(5, 15, "seconds"));

  // 3. Browse requests
  const requests = await session.browseRequests({ limit: 5 });
  await delay(random(10, 30, "seconds"));

  // 4. Offer help (40% chance)
  if (Math.random() < 0.4 && requests.length > 0) {
    const request = pickRandom(requests);
    await session.offerHelp(request.id);
    await delay(random(5, 10, "seconds"));
  }

  // 5. Check messages
  const messages = await session.getMessages();
  await delay(random(5, 15, "seconds"));

  // 6. Reply to messages (30% chance per message)
  for (const msg of messages) {
    if (Math.random() < 0.3) {
      await session.sendMessage(msg.conversationId, generateReply(msg));
      await delay(random(10, 30, "seconds"));
    }
  }

  // 7. Complete a match (20% chance)
  const activeMatches = await session.getActiveMatches();
  if (Math.random() < 0.2 && activeMatches.length > 0) {
    const match = pickRandom(activeMatches);
    await session.completeMatch(match.id);
  }

  // 8. Logout
  await session.logout();
}
```

## Rate Limiting Strategy

**Design Principle**: Respect production rate limits by default

1. **Exponential Backoff**: On 429 errors, wait progressively longer
2. **Configurable Delays**: Minimum time between actions per user
3. **Session Throttling**: Limit concurrent active sessions
4. **Smart Scheduling**: Distribute activity throughout the day

```typescript
const rateLimitConfig = {
  minDelayBetweenActions: 2000, // ms
  maxConcurrentSessions: 20,
  backoffStrategy: "exponential",
  maxRetries: 3
};

async function executeAction(action: Action) {
  let retries = 0;
  while (retries < rateLimitConfig.maxRetries) {
    try {
      await action.execute();
      await delay(rateLimitConfig.minDelayBetweenActions);
      return;
    } catch (err) {
      if (err.status === 429) {
        const waitTime = Math.pow(2, retries) * 1000;
        await delay(waitTime);
        retries++;
      } else {
        throw err;
      }
    }
  }
}
```

## Extensibility

**Auto-Discovery of New Features**:
```typescript
// When new API endpoints are added, simulation automatically learns them
interface FeatureDetector {
  scanRoutes(): Promise<Route[]>;
  generateWorkflow(route: Route): Workflow;
  addToSimulation(workflow: Workflow): void;
}
```

**Plugin Architecture**:
```typescript
// Add custom behaviors without modifying core
interface SimulationPlugin {
  name: string;
  initialize(): Promise<void>;
  getUserActions(): Action[];
  onSessionStart(session: UserSession): void;
  onSessionEnd(session: UserSession): void;
}
```

## Monitoring & Observability

1. **Metrics**:
   - Active simulated users per hour
   - Actions performed per type
   - Error rates by action
   - Average session duration
   - Rate limit hits

2. **Logs**:
   - Structured JSON logs
   - Action traces with timing
   - Error details for debugging

3. **Dashboard** (Future):
   - Real-time activity visualization
   - Behavior profile distribution
   - System health metrics

## Configuration

```typescript
// config/simulation.json
{
  "enabled": true,
  "environment": "production",
  "schedule": {
    "type": "continuous", // or "cron"
    "businessHours": {
      "start": "09:00",
      "end": "21:00",
      "timezone": "America/Los_Angeles"
    }
  },
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

## Consequences

### Positive

- **Living Demo**: Platform always shows realistic, recent activity
- **Continuous Testing**: Catches bugs and performance issues early
- **Data Maturation**: Organic growth of karma, relationships, patterns
- **Feature Validation**: New features immediately tested with synthetic users
- **Investor Appeal**: Demonstrates active platform with real usage patterns
- **Load Testing**: Continuous stress testing in production-like conditions

### Negative

- **Maintenance Overhead**: Simulation code must evolve with platform
- **Data Pollution**: Synthetic data mixed with potential real user data
- **Resource Usage**: Additional load on production infrastructure
- **Complexity**: Another system to monitor and debug

### Mitigation

1. **Data Separation**: Tag all synthetic users clearly in database
2. **Resource Limits**: Cap concurrent sessions, respect rate limits
3. **Kill Switch**: Easy way to disable simulation if needed
4. **Gradual Rollout**: Start small (10 users), scale up over time

## Alternatives Considered

### Alternative 1: Manual Demo Refresh
Periodically wipe and reseed production database.

**Rejected because**: High manual effort, loses historical data, disrupts demos

### Alternative 2: Separate Demo Environment
Dedicated demo.karmyq.com with simulation.

**Rejected because**: Infrastructure cost, duplicated effort, data divergence

### Alternative 3: Recorded Replay
Record real user sessions, replay them.

**Rejected because**: Privacy concerns, not adaptive to new features

## Related Decisions

- ADR-004: Microservices Event-Driven Architecture (provides foundation for simulation service)
- ADR-003: Multi-Tenant RLS Database Design (enables data isolation for synthetic users)

## Future Enhancements

1. **Machine Learning**: Learn from real user patterns to improve simulation
2. **Adversarial Testing**: Simulate edge cases and abuse scenarios
3. **A/B Testing**: Test feature variants with synthetic users
4. **Performance Benchmarking**: Track performance metrics over time
5. **Community Growth Simulation**: Model network effects and viral growth

## References

- [Synthetic Data Generation Best Practices](https://martinfowler.com/articles/synthetic-data.html)
- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Load Testing Strategies](https://www.thoughtworks.com/insights/blog/load-testing-strategies)

## Status

**Proposed** - Awaiting completion of:
1. Production seeding (in progress)
2. Database trigger fixes (in progress)
3. Initial production deployment validation

**Target Start**: After production environment is stable (estimated: Q1 2026)

---

**Last Updated**: 2026-01-02
**Next Review**: After production seeding completion
